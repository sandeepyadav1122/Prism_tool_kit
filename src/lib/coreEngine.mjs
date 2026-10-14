/**
 * Core binary validation, sanitization, BMP/ICO encoding, ZIP building,
 * and native PDF 1.7 generation/manipulation engine.
 * Zero external runtime dependencies; safe for Web Workers and main thread.
 */

export function detectFileSignature(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 4) return { format: 'unknown', mime: 'application/octet-stream', valid: false };

  // JPEG: FF D8 FF
  if (u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF) {
    return { format: 'jpeg', mime: 'image/jpeg', valid: true };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
    // Check for acTL chunk for APNG
    const ascii = new TextDecoder('latin1').decode(u8.subarray(0, Math.min(u8.length, 256)));
    const isAnimated = ascii.includes('acTL');
    return { format: isAnimated ? 'apng' : 'png', mime: isAnimated ? 'image/apng' : 'image/png', valid: true, animated: isAnimated };
  }
  // GIF: GIF87a or GIF89a
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x38) {
    return { format: 'gif', mime: 'image/gif', valid: true };
  }
  // RIFF (WebP): 52 49 46 46 ... 57 45 42 50
  if (u8.length >= 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
      u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) {
    const chunkHeader = new TextDecoder('latin1').decode(u8.subarray(12, Math.min(u8.length, 64)));
    const isAnimated = chunkHeader.includes('ANIM') || chunkHeader.includes('ANMF');
    return { format: 'webp', mime: 'image/webp', valid: true, animated: isAnimated };
  }
  // BMP: 42 4D ("BM")
  if (u8[0] === 0x42 && u8[1] === 0x4D) {
    return { format: 'bmp', mime: 'image/bmp', valid: true };
  }
  // ICO: 00 00 01 00
  if (u8[0] === 0x00 && u8[1] === 0x00 && u8[2] === 0x01 && u8[3] === 0x00) {
    return { format: 'ico', mime: 'image/x-icon', valid: true };
  }
  // TIFF: 49 49 2A 00 (LE) or 4D 4D 00 2A (BE)
  if ((u8[0] === 0x49 && u8[1] === 0x49 && u8[2] === 0x2A && u8[3] === 0x00) ||
      (u8[0] === 0x4D && u8[1] === 0x4D && u8[2] === 0x00 && u8[3] === 0x2A)) {
    return { format: 'tiff', mime: 'image/tiff', valid: true, extendedDecoderRequired: true };
  }
  // PDF: 25 50 44 46 ("%PDF")
  if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) {
    return { format: 'pdf', mime: 'application/pdf', valid: true };
  }
  // ISO BMFF (AVIF / HEIC): bytes 4..7 == "ftyp"
  if (u8.length >= 12 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
    const brand = new TextDecoder('latin1').decode(u8.subarray(8, 12)).toLowerCase();
    if (brand.startsWith('avif') || brand.startsWith('avis')) {
      return { format: 'avif', mime: 'image/avif', valid: true, extendedDecoderRequired: true };
    }
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) {
      return { format: 'heic', mime: 'image/heic', valid: true, extendedDecoderRequired: true };
    }
  }
  // SVG text check
  const headText = new TextDecoder('utf-8', { fatal: false }).decode(u8.subarray(0, Math.min(u8.length, 512))).trim();
  if (headText.startsWith('<svg') || (headText.startsWith('<?xml') && headText.includes('<svg'))) {
    return { format: 'svg', mime: 'image/svg+xml', valid: true };
  }

  return { format: 'unknown', mime: 'application/octet-stream', valid: false };
}

/**
 * Sanitizes SVG markup by removing <script>, <foreignObject>,<iframe>,
 * inline event handlers (onload, onerror, onclick, etc.), and javascript:/data:text/html URIs.
 */
export function sanitizeSvgContent(svgText) {
  if (typeof svgText !== 'string' || !svgText.includes('<svg')) {
    throw new Error('Invalid SVG file: missing <svg> root element.');
  }
  let cleaned = svgText
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(iframe|embed|object|applet|meta|link)[\s\S]*?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*["']\s*(javascript:|data:text\/html)[^"']*["']/gi, '');
  return cleaned;
}

/**
 * Encodes raw RGBA pixel buffer (width, height, Uint8ClampedArray) into an uncompressed 24-bit BMP file.
 */
export function encodeRgbaToBmp(width, height, rgba) {
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelArraySize = rowStride * height;
  const fileSize = 54 + pixelArraySize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // BITMAPFILEHEADER (14 bytes)
  u8[0] = 0x42; // 'B'
  u8[1] = 0x4D; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true);

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // bottom-up
  view.setUint16(26, 1, true);     // planes
  view.setUint16(28, 24, true);    // 24-bit BGR
  view.setUint32(30, 0, true);     // BI_RGB
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true);   // 72 DPI
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4;
    const dstRow = 54 + y * rowStride;
    for (let x = 0; x < width; x++) {
      const a = rgba[srcRow + x * 4 + 3] / 255;
      const r = Math.round(rgba[srcRow + x * 4] * a + 255 * (1 - a));
      const g = Math.round(rgba[srcRow + x * 4 + 1] * a + 255 * (1 - a));
      const b = Math.round(rgba[srcRow + x * 4 + 2] * a + 255 * (1 - a));
      u8[dstRow + x * 3] = b;
      u8[dstRow + x * 3 + 1] = g;
      u8[dstRow + x * 3 + 2] = r;
    }
  }
  return u8;
}

/**
 * Wraps a PNG byte array into a standards-compliant Windows .ICO container.
 */
export function wrapPngInIco(pngBytes, width, height) {
  const pngU8 = pngBytes instanceof Uint8Array ? pngBytes : new Uint8Array(pngBytes);
  const out = new Uint8Array(22 + pngU8.length);
  const view = new DataView(out.buffer);
  // ICONDIR (6 bytes)
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type 1 = ICO
  view.setUint16(4, 1, true); // 1 image
  // ICONDIRENTRY (16 bytes)
  out[6] = width >= 256 ? 0 : width;
  out[7] = height >= 256 ? 0 : height;
  out[8] = 0; // palette
  out[9] = 0; // reserved
  view.setUint16(10, 1, true);  // color planes
  view.setUint16(12, 32, true); // 32 bpp
  view.setUint32(14, pngU8.length, true);
  view.setUint32(18, 22, true); // offset
  out.set(pngU8, 22);
  return out;
}

/**
 * Lightweight, zero-dependency ZIP archive generator (Store mode with CRC32)
 * for batch downloads when offline or before JSZip loads.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(u8) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) {
    crc = CRC_TABLE[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function createZipArchive(files) {
  // files: Array<{ name: string, data: Uint8Array }>
  const encoder = new TextEncoder();
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);

    // Local file header (30 + nameBytes.length)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // store
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x2100, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    // Central directory header (46 + nameBytes.length)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x2100, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localRecords.push(localHeader, data);
    centralRecords.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralRecords.reduce((acc, r) => acc + r.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralSize + 22;
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const r of localRecords) { out.set(r, pos); pos += r.length; }
  for (const r of centralRecords) { out.set(r, pos); pos += r.length; }
  out.set(eocd, pos);
  return out;
}

/**
 * Builds a valid multi-page PDF 1.7 document from JPEG images and/or text/watermark overlays.
 * Each page item: { jpegBytes?: Uint8Array, imgWidth?: number, imgHeight?: number,
 *                   pageWidthPt: number, pageHeightPt: number, marginPt?: number,
 *                   fitMode?: 'fit'|'fill'|'original', rotation?: number,
 *                   watermarkText?: string, pageNumberText?: string, extraLines?: string[] }
 */
export function buildPdfFromPages(pages, metadata = {}) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [0]; // 1-indexed object offsets
  let byteLen = 0;

  function pushStr(str) {
    const b = enc.encode(str);
    chunks.push(b);
    byteLen += b.length;
  }
  function pushBytes(b) {
    chunks.push(b);
    byteLen += b.length;
  }
  function startObj(id) {
    offsets[id] = byteLen;
    pushStr(`${id} 0 obj\n`);
  }
  function endObj() {
    pushStr(`\nendobj\n`);
  }
  function escPdfText(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  pushStr('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');

  // Object 1: Catalog, Object 2: Pages, Object 3: Font (Helvetica), Object 4: Info
  const pageObjIds = [];
  let nextObjId = 5;

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageId = nextObjId++;
    const contentId = nextObjId++;
    const imgId = p.jpegBytes ? nextObjId++ : null;
    pageObjIds.push(pageId);

    const pw = p.pageWidthPt || 595.28;
    const ph = p.pageHeightPt || 841.89;
    const margin = p.marginPt ?? 24;
    const availW = Math.max(20, pw - margin * 2);
    const availH = Math.max(20, ph - margin * 2);

    const ops = [];
    // White page background
    ops.push(`q 1 1 1 rg 0 0 ${pw.toFixed(2)} ${ph.toFixed(2)} re f Q`);

    if (p.jpegBytes && p.imgWidth && p.imgHeight) {
      let drawW = availW;
      let drawH = availH;
      const imgAspect = p.imgWidth / p.imgHeight;
      const boxAspect = availW / availH;
      if (p.fitMode === 'fill') {
        if (imgAspect > boxAspect) { drawH = availH; drawW = availH * imgAspect; }
        else { drawW = availW; drawH = availW / imgAspect; }
      } else if (p.fitMode === 'original') {
        drawW = Math.min(availW, p.imgWidth * 0.75);
        drawH = Math.min(availH, p.imgHeight * 0.75);
      } else {
        // 'fit' preserve aspect ratio inside margins
        if (imgAspect > boxAspect) { drawW = availW; drawH = availW / imgAspect; }
        else { drawH = availH; drawW = availH * imgAspect; }
      }
      const dx = (pw - drawW) / 2;
      const dy = (ph - drawH) / 2;
      ops.push(`q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Im0 Do Q`);
    }

    if (p.extraLines && p.extraLines.length) {
      let ty = ph - 56;
      for (const line of p.extraLines) {
        ops.push(`BT /F1 12 Tf 0.12 0.16 0.23 rg 48 ${ty.toFixed(2)} Td (${escPdfText(line)}) Tj ET`);
        ty -= 18;
      }
    }

    if (p.watermarkText) {
      const wm = escPdfText(p.watermarkText);
      const cx = (pw * 0.22).toFixed(2);
      const cy = (ph * 0.45).toFixed(2);
      ops.push(`q 0.78 0.80 0.85 rg BT /F1 38 Tf 0.866 0.5 -0.5 0.866 ${cx} ${cy} Tm (${wm}) Tj ET Q`);
    }

    if (p.pageNumberText) {
      const pn = escPdfText(p.pageNumberText);
      ops.push(`q 0.35 0.38 0.44 rg BT /F1 10 Tf ${(pw / 2 - 28).toFixed(2)} 18 Td (${pn}) Tj ET Q`);
    }

    const contentStream = ops.join('\n');
    const contentBytes = enc.encode(contentStream);

    startObj(contentId);
    pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr(`\nendstream`);
    endObj();

    if (imgId && p.jpegBytes) {
      startObj(imgId);
      pushStr(`<< /Type /XObject /Subtype /Image /Width ${p.imgWidth} /Height ${p.imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`);
      pushBytes(p.jpegBytes);
      pushStr(`\nendstream`);
      endObj();
    }

    const rot = ((p.rotation || 0) % 360 + 360) % 360;
    const xobjRef = imgId ? `/XObject << /Im0 ${imgId} 0 R >>` : '';
    startObj(pageId);
    pushStr(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Rotate ${rot} /Resources << /Font << /F1 3 0 R >> ${xobjRef} >> /Contents ${contentId} 0 R >>`);
    endObj();
  }

  // Object 1: Catalog
  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  // Object 2: Pages
  startObj(2);
  pushStr(`<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`);
  endObj();

  // Object 3: Font
  startObj(3);
  pushStr(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
  endObj();

  // Object 4: Info
  startObj(4);
  const title = escPdfText(metadata.title || 'Prism Toolkit Document');
  const author = escPdfText(metadata.author || 'Prism Local Toolkit');
  const subject = escPdfText(metadata.subject || '');
  const keywords = escPdfText(metadata.keywords || '');
  const creator = escPdfText(metadata.creator || 'Prism Image + PDF Toolkit (Client-Side)');
  pushStr(`<< /Title (${title}) /Author (${author}) /Subject (${subject}) /Keywords (${keywords}) /Creator (${creator}) /Producer (Prism Native PDF 1.7 Engine) >>`);
  endObj();

  const xrefOffset = byteLen;
  pushStr(`xref\n0 ${nextObjId}\n0000000000 65535 f \n`);
  for (let id = 1; id < nextObjId; id++) {
    const off = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${nextObjId} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(byteLen);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * Inspects a PDF byte array to extract page count, dimensions, encryption status,
 * metadata fields, text strings, and embedded JPEG streams.
 */
export function inspectPdfBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const sig = detectFileSignature(u8);
  if (sig.format !== 'pdf') {
    throw new Error('Selected file is not a valid PDF document (missing %PDF header).');
  }
  const raw = new TextDecoder('latin1').decode(u8);
  const isEncrypted = /\/Encrypt\s+\d+\s+\d+\s+R/.test(raw) || raw.includes('/Filter /Standard');

  // Count /Type /Page (not /Pages)
  const pageMatches = raw.match(/\/Type\s*\/Page\b(?!s)/g);
  let pageCount = pageMatches ? pageMatches.length : 0;
  if (pageCount === 0) {
    const countMatch = raw.match(/\/Count\s+(\d+)/);
    pageCount = countMatch ? parseInt(countMatch[1], 10) : 1;
  }

  function extractInfoField(key) {
    const re = new RegExp(`\\/${key}\\s*\\(([^)]*)\\)`);
    const m = raw.match(re);
    return m ? m[1].replace(/\\\(/g, '(').replace(/\\\)/g, ')') : '';
  }

  const metadata = {
    title: extractInfoField('Title'),
    author: extractInfoField('Author'),
    subject: extractInfoField('Subject'),
    keywords: extractInfoField('Keywords'),
    creator: extractInfoField('Creator') || extractInfoField('Producer'),
  };

  // Extract readable text inside BT ... ET blocks
  const textBlocks = [];
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    const strRegex = /\((?:\\.|[^\\)])*\)/g;
    let sm;
    while ((sm = strRegex.exec(block)) !== null) {
      const inner = sm[0].slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      if (inner.trim()) textBlocks.push(inner);
    }
  }

  // Extract embedded JPEG streams (FFD8FF ... FFD9)
  const embeddedJpegs = [];
  let searchPos = 0;
  while (searchPos < u8.length - 4 && embeddedJpegs.length < 20) {
    if (u8[searchPos] === 0xFF && u8[searchPos + 1] === 0xD8 && u8[searchPos + 2] === 0xFF) {
      // look for FFD9
      let endPos = searchPos + 3;
      while (endPos < u8.length - 1) {
        if (u8[endPos] === 0xFF && u8[endPos + 1] === 0xD9) {
          endPos += 2;
          break;
        }
        endPos++;
      }
      if (endPos - searchPos > 128) {
        embeddedJpegs.push(u8.slice(searchPos, endPos));
      }
      searchPos = endPos;
    } else {
      searchPos++;
    }
  }

  return {
    valid: true,
    isEncrypted,
    pageCount: Math.max(1, pageCount),
    metadata,
    extractedText: textBlocks.join(' '),
    embeddedJpegCount: embeddedJpegs.length,
    embeddedJpegs,
    byteLength: u8.length,
  };
}
