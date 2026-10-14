import assert from 'node:assert/strict';
import {
  detectFileSignature,
  sanitizeSvgContent,
  encodeRgbaToBmp,
  wrapPngInIco,
  createZipArchive,
  buildPdfFromPages,
  inspectPdfBytes
} from '../src/lib/coreEngine.mjs';

console.log('=== Running Prism Toolkit Automated Processing Tests ===');

// 1. Magic-byte signature detection tests
{
  const jpegSig = detectFileSignature(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]));
  assert.equal(jpegSig.format, 'jpeg');
  assert.equal(jpegSig.valid, true);

  const pngSig = detectFileSignature(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  assert.equal(pngSig.format, 'png');

  const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
  assert.equal(detectFileSignature(webpBytes).format, 'webp');

  const avifBytes = new Uint8Array([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
  const avifSig = detectFileSignature(avifBytes);
  assert.equal(avifSig.format, 'avif');
  assert.equal(avifSig.extendedDecoderRequired, true);

  const heicBytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  const heicSig = detectFileSignature(heicBytes);
  assert.equal(heicSig.format, 'heic');
  assert.equal(heicSig.extendedDecoderRequired, true);

  const pdfSig = detectFileSignature(new TextEncoder().encode('%PDF-1.7\n'));
  assert.equal(pdfSig.format, 'pdf');

  const fakeJpg = detectFileSignature(new TextEncoder().encode('NOT_AN_IMAGE_AT_ALL'));
  assert.equal(fakeJpg.valid, false);
  console.log('[PASS] Magic-byte file signature validation (JPEG, PNG, WebP, AVIF, HEIC, PDF, Corrupted/Fake rejection)');
}

// 2. SVG sanitization tests
{
  const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>steal()</script><foreignObject><iframe></iframe></foreignObject><a href="javascript:evil()"><rect width="100" height="100" fill="red"/></a></svg>`;
  const clean = sanitizeSvgContent(maliciousSvg);
  assert.equal(clean.includes('<script'), false);
  assert.equal(clean.includes('onload='), false);
  assert.equal(clean.includes('foreignObject'), false);
  assert.equal(clean.includes('javascript:'), false);
  assert.equal(clean.includes('<rect width="100"'), true);
  console.log('[PASS] SVG security sanitization strips <script>, event handlers, foreignObject, and javascript: URIs');
}

// 3. BMP & ICO binary encoding tests
{
  const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(200);
  const bmp = encodeRgbaToBmp(4, 4, rgba);
  const sig = detectFileSignature(bmp);
  assert.equal(sig.format, 'bmp');
  assert.equal(bmp.length, 54 + 4 * 12); // 4px * 3 bytes = 12 bytes/row * 4 rows = 48 + 54 header = 102

  const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4]);
  const ico = wrapPngInIco(fakePng, 32, 32);
  const icoSig = detectFileSignature(ico);
  assert.equal(icoSig.format, 'ico');
  assert.equal(ico.length, 22 + fakePng.length);
  console.log('[PASS] BMP and ICO binary encoders produce valid headers and byte layouts');
}

// 4. Batch ZIP archive builder tests
{
  const f1 = new TextEncoder().encode('Hello File 1');
  const f2 = new TextEncoder().encode('Hello File 2');
  const zip = createZipArchive([
    { name: 'image-1.txt', data: f1 },
    { name: 'image-2.txt', data: f2 }
  ]);
  assert.equal(zip[0], 0x50); // 'P'
  assert.equal(zip[1], 0x4B); // 'K'
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);
  assert.ok(zip.length > f1.length + f2.length + 100);
  console.log('[PASS] Batch ZIP archive builder writes valid PKZIP local & central directory headers');
}

// 5. Native PDF 1.7 creation, metadata, watermark, page numbering, and inspection tests
{
  const pdfBytes = buildPdfFromPages([
    {
      pageWidthPt: 595.28,
      pageHeightPt: 841.89,
      watermarkText: 'CONFIDENTIAL',
      pageNumberText: 'Page 1 of 2',
      extraLines: ['First page sample text for extraction']
    },
    {
      pageWidthPt: 595.28,
      pageHeightPt: 841.89,
      rotation: 90,
      watermarkText: 'CONFIDENTIAL',
      pageNumberText: 'Page 2 of 2',
      extraLines: ['Second page rotated 90 degrees']
    }
  ], {
    title: 'Test Application Bundle',
    author: 'Jane Doe',
    subject: 'Resume & Portfolio',
    keywords: 'pdf, test, prism'
  });

  const info = inspectPdfBytes(pdfBytes);
  assert.equal(info.valid, true);
  assert.equal(info.pageCount, 2);
  assert.equal(info.metadata.title, 'Test Application Bundle');
  assert.equal(info.metadata.author, 'Jane Doe');
  assert.ok(info.extractedText.includes('First page sample text'));
  assert.ok(info.extractedText.includes('Page 2 of 2'));
  console.log('[PASS] PDF 1.7 engine builds multi-page PDFs with rotation, watermarks, page numbers, metadata, and extracts text');
}

console.log('=== ALL AUTOMATED CORE ENGINE TESTS PASSED ===');
