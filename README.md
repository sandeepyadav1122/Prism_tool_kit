# Prism Toolkit — Lightweight Client-Side Image + PDF Suite

Prism Toolkit is a privacy-first, zero-backend web application that combines everyday image optimization, format conversion, passport photo preparation, AI/smart background removal, and PDF document management in a single compact interface. Every core operation runs directly inside the user's browser using native HTML5 Canvas, Web Workers, TypedArrays, IndexedDB, and on-demand WebAssembly/WebGPU modules—eliminating server processing fees, cold-start latency, and document upload privacy risks.

## 1. Architecture & Directory Layout

The codebase separates UI presentation from binary file-processing pipelines so each tool loads only when opened:

- `src/components/` — Reusable UI primitives (Top Navigation Bar, Searchable Tool Directory Grid, Drag-and-Drop Upload Zone, Before/After Split Preview, Memory & Safety Banner).
- `src/config/` — Tool registry (`toolRegistry.ts`), device-safe configurable file limits (`limits.ts`), and passport/social presets.
- `src/lib/` — Shared zero-dependency binary utilities (`coreEngine.mjs` for magic-byte file signature inspection, SVG sanitization, BMP/ICO binary encoders, PKZIP archive generation, and native PDF 1.7 stream construction/inspection; `workspaceDb.ts` for IndexedDB history).
- `src/tools/image/` — Client-side resizing, binary-search target-KB compression, multi-format conversion, crop/rotate/filter adjustments, passport & 4×6" print sheet generator, and batch conversion queue.
- `src/tools/background-removal/` — Lazy-loaded browser segmentation (`@imgly/background-removal` ONNX WebGPU/WASM) with an offline Web Worker edge-preserving chroma/corner flood-fill fallback.
- `src/tools/pdf/` — PDF merge, page range split/extract, thumbnail rotation/reordering, DPI-guided page reconstruction compression, PDF-to-JPG/PNG, Images-to-PDF, text/image watermarks, page numbering, metadata editing, text/JPEG stream extraction, and optional lazy-loaded OCR (`tesseract.js`).
- `src/workers/` — Web Worker scripts (`segmentation.worker.ts`) for off-main-thread pixel matting and adaptive thresholding.
- `tests/` — Automated Node.js unit and integration tests (`run-tests.mjs`) verifying magic bytes, SVG sanitization, BMP/ICO headers, ZIP archives, and PDF 1.7 structure.

## 2. Installation, Build, Testing, and Deployment

### Local Development & Build

1. Install dependencies (Node.js 18+ recommended):
   ```bash
   npm install
   ```
2. Run the automated binary processing test suite:
   ```bash
   npm test
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Build the production static bundle (configured with Rollup `manualChunks` so heavy PDF, ZIP, OCR, and AI libraries never bloat the initial entry chunk):
   ```bash
   npm run build
   ```

### Static Hosting Deployment (Zero Fixed Server Cost)

Because Prism Toolkit performs all file manipulation locally in the browser, it deploys to any static host with no backend runtime:

- **Cloudflare Pages**: Connect your Git repository, set Build command to `npm run build`, and Build output directory to `dist`. Configure `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` headers in `public/_headers` if you want multi-threaded WebAssembly (`SharedArrayBuffer`) enabled for ONNX/Tesseract workers.
- **GitHub Pages**: Push the contents of `dist/` (or deploy `prism_image_pdf_toolkit.html` directly) via the `actions/deploy-pages` GitHub Action. Note that free static hosting plans enforce fair-use bandwidth policies and are not guaranteed to remain unlimited forever.

## 3. Supported Formats & Known Limitations

Every uploaded file is verified against binary magic-byte signatures (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `52 49 46 46...57 45 42 50` for WebP, `25 50 44 46` for PDF, ISO BMFF `ftyp` brands for AVIF/HEIC, etc.) rather than trusting filename extensions.

| Category | Format | Read / Decode Support | Write / Encode Support | Known Technical Limitations & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Raster** | JPEG / JPG | Native browser + magic-byte check | Native Canvas + binary-search target KB | Lossy format; does not support alpha transparency (transparent pixels fill with user-selected background color, defaulting to white). |
| **Standard Raster** | PNG | Native browser + APNG `acTL` detection | Native lossless PNG + palette quantization | Lossless format; target-KB compression requires optional palette quantization or dimension scaling when entropy is high. |
| **Standard Raster** | WebP | Native browser + `ANIM` chunk detection | Native lossy/lossless WebP + target KB | Animated WebP files converted to JPEG/PNG/BMP/ICO export the static first frame with a clear UI notice. |
| **Legacy / Icon** | BMP & ICO | Native browser decoder | Custom binary 24-bit BMP & 32-bit PNG-in-ICO encoders | ICO exports auto-scale large dimensions above 256×256 px to standard 256×256 icon containers. |
| **Vector** | SVG | XML parser + strict security sanitizer | Rasterizes to PNG, JPG, WebP, BMP, ICO, or PDF | Strips `<script>`, `<foreignObject>`, `<iframe>`, `onload`/`onerror` attributes, and `javascript:` URIs before rendering. External web fonts inside SVGs fall back to system fonts. |
| **Animated** | GIF / APNG | Native first-frame decode + animation flag | Static frame export to PNG/JPG/WebP/PDF | Browser Canvas exports a static first frame; full multi-frame GIF re-encoding is intentionally omitted to avoid multi-megabyte WASM encoders. |
| **Extended Formats** | AVIF, HEIC/HEIF, TIFF | Native browser support where available + on-demand `utif` / `heic2any` lazy decoders | Converts to JPG, PNG, WebP, or PDF | Decoders load over the network only when a matching magic-byte header is detected. Offline environments rely on native OS/browser codec support. |
| **Documents** | PDF 1.0–1.7 | Native PDF stream inspector + lazy-loaded `PDF.js` & `pdf-lib` | Native PDF 1.7 writer + `pdf-lib` | Password-encrypted (`/Encrypt`), damaged, or XFA dynamic form PDFs cannot be modified without unlocking. Page-reconstruction compression flattens selectable text, annotations, and vector paths into compressed JPEG streams. |

## 4. Actual Dependencies & Lazy-Loading Schedule

To keep initial page load fast on mobile and desktop connections, dependencies load strictly on demand:

| Dependency / Module | Approximate Size | When It Loads | Offline / Low-Memory Fallback |
| :--- | :--- | :--- | :--- |
| **App Shell & Tool Directory** | ~42 KB (gzipped) | Initial page load | Built-in zero-dependency UI and search directory. |
| **Core Binary Engine (`coreEngine`)** | ~11 KB | Initial load / First file selection | Runs 100% locally (Magic bytes, SVG sanitizer, BMP/ICO encoders, PKZIP writer, Native PDF 1.7 builder/inspector). |
| **Web Worker Matting (`segmentation.worker`)** | ~4 KB | When Background Remover or Image Studio opens | Instant local Blob-URL Web Worker using corner/border chroma sampling and feathered alpha matting. |
| **`pdf-lib` & `pdfjs-dist`** | ~420 KB (lazy CDN/chunk) | Only when opening a PDF tool | Falls back to the built-in Native PDF 1.7 Parser/Builder and Canvas page previewer when offline. |
| **`jszip`** | ~28 KB (lazy chunk) | Only when clicking "Download All as ZIP" | Falls back to the built-in `createZipArchive` CRC32 PKZIP binary generator. |
| **`@imgly/background-removal` (ONNX)** | ~1.2 MB code + ~40 MB model | Only after clicking "Run AI Model" in Background Remover | Separate download vs. inference progress bars; automatically falls back to the local Web Worker Smart Chroma/Edge Matting engine if offline or WebGPU/WASM memory is constrained. |
| **`tesseract.js` (OCR Engine)** | ~350 KB code + language traineddata | Only when running OCR on scanned documents | Built-in PDF `BT...ET` text-stream extractor + high-contrast adaptive document binarizer. |
| **`heic2any` / `utif`** | ~180 KB | Only when an uploaded file's magic bytes match HEIC or TIFF | Native browser `createImageBitmap` / `<img>` decoding where supported by the OS. |

## 5. Record of Tested and Untested Features

### Verified & Automated Tested Features
- **Magic-Byte Signature Verification**: Tested via `tests/run-tests.mjs` against valid JPEG, PNG, WebP, AVIF, HEIC, BMP, ICO, PDF headers, and corrupted/spoofed file payloads (confirming files with fake extensions are rejected safely).
- **SVG Sanitization**: Verified removal of `<script>`, `<foreignObject>`, `<iframe>`, inline `on*` event attributes, and `javascript:` links while preserving vector geometry.
- **Image Resizing, Target-KB Compression & Format Conversion**: Verified in headless Chromium (`Prism Toolkit` browser verification) across JPEG, PNG, WebP, BMP, and ICO outputs, confirming real byte reduction and accurate before/after percentage calculations.
- **Passport & Profile Photo Studio**: Verified preset dimension rendering (US 2×2", India/UK/EU 35×45 mm, PAN/Exam ID) and multi-photo 4×6" (1200×1800 px @ 300 DPI) printable sheet generation.
- **Background Removal (Local Worker & Transparent/Solid Export)**: Verified Web Worker alpha matting, checkerboard transparency preview, custom background color replacement, and PNG/JPEG download.
- **PDF Creation, Merge, Split, Rotate, Watermark, Page Numbers & Metadata**: Verified multi-page PDF 1.7 generation, page rotation (`0°/90°/180°/270°`), diagonal text watermarking, `Page X of Y` footer stamping, `/Info` dictionary metadata updates, text stream extraction, and batch ZIP archive generation.
- **Privacy & Zero Document Upload Verification**: Inspected browser network requests in headless Chromium during image and PDF processing to confirm zero document bytes or telemetry leave the device.

### Untested / Environment-Dependent Features
- **WebGPU Hardware-Accelerated ONNX Inference Across All Mobile GPUs**: While the lazy-loaded ONNX pipeline and Web Worker CPU fallback are implemented, hardware WebGPU shader compilation varies across older Android/iOS GPU drivers.
- **External CDN Model Downloads in Air-Gapped Environments**: In completely offline environments without prior browser cache, remote model weights (`@imgly/background-removal` and `tesseract.js` language packs) cannot be fetched; the app detects this immediately and switches to the built-in local Web Worker engines with a transparent status notice.
- **Native HEIC Decoding on Desktop Linux/Windows Without Network**: When offline on browsers without OS-level HEVC/HEIC codecs, HEIC decoding requires the lazy-loaded WASM decoder to have been cached previously.
