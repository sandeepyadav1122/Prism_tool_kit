export type ToolCategory = 'image' | 'pdf' | 'bg-remover' | 'convert';

export interface ToolDefinition {
  id: string;
  name: string;
  category: ToolCategory;
  secondaryCategories?: ToolCategory[];
  shortDesc: string;
  popular?: boolean;
  badge?: string;
  lazyModules: string[];
  limitationsNote: string;
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    id: 'img-resize',
    name: 'Image Resizer & Presets',
    category: 'image',
    shortDesc: 'Resize by exact pixels, percentage, or social/passport presets with aspect-ratio lock.',
    popular: true,
    lazyModules: ['Canvas 2D Engine'],
    limitationsNote: 'Upscaling beyond original dimensions interpolates pixels and will not add new optical detail.'
  },
  {
    id: 'img-compress',
    name: 'Image Compressor (Target KB)',
    category: 'image',
    shortDesc: 'Compress JPEG, WebP, and PNG with binary-search target KB/MB size optimization.',
    popular: true,
    badge: 'Target KB',
    lazyModules: ['Canvas Encoder', 'Binary-Search Optimizer'],
    limitationsNote: 'Target KB uses iterative quality + resolution search. Extremely low targets (<5 KB) have a physical entropy floor.'
  },
  {
    id: 'img-convert',
    name: 'Image Format Converter',
    category: 'convert',
    secondaryCategories: ['image'],
    shortDesc: 'Convert between JPG, PNG, WebP, BMP, ICO, GIF, SVG, and lazy-loaded AVIF/HEIC/TIFF.',
    popular: true,
    lazyModules: ['Magic-Byte Validator', 'SVG Sanitizer', 'BMP/ICO Binary Codec', 'Optional HEIC/TIFF/AVIF Decoders'],
    limitationsNote: 'Animated GIF/WebP/APNG exported to static formats (JPG/PNG/BMP/ICO) preserve the first frame only.'
  },
  {
    id: 'img-edit',
    name: 'Crop, Rotate & Adjust Studio',
    category: 'image',
    shortDesc: 'Crop to aspect ratios, rotate/flip, tune brightness/contrast/saturation/grayscale, and strip EXIF.',
    lazyModules: ['Canvas Filter Pipeline'],
    limitationsNote: 'Re-encoding cleanly strips camera EXIF/GPS metadata to protect privacy.'
  },
  {
    id: 'img-passport',
    name: 'Passport & ID Photo Maker',
    category: 'image',
    shortDesc: 'Create US 2x2", India/UK/EU 35x45mm, Exam/PAN, or custom ID photos + printable 4x6" sheets.',
    popular: true,
    badge: 'Print Sheet',
    lazyModules: ['Biometric Grid Overlay', '300 DPI Sheet Composer'],
    limitationsNote: 'Provides standard physical/pixel dimensions and background fills; does not guarantee automatic government compliance.'
  },
  {
    id: 'img-batch',
    name: 'Batch Image Converter & ZIP',
    category: 'convert',
    secondaryCategories: ['image'],
    shortDesc: 'Process up to 30 images with shared resize/format/quality settings and download as a single ZIP.',
    lazyModules: ['Queue Manager', 'JSZip / Native PKZIP Engine'],
    limitationsNote: 'Processes files with bounded concurrency (2 jobs at a time) so failed files never halt the batch.'
  },
  {
    id: 'bg-remove',
    name: 'AI & Smart Background Remover',
    category: 'bg-remover',
    secondaryCategories: ['image'],
    shortDesc: 'Remove backgrounds locally via on-demand WebGPU/WASM segmentation or smart edge-chroma matting.',
    popular: true,
    badge: 'Lazy-Loaded AI',
    lazyModules: ['@imgly/background-removal (ONNX WebGPU/WASM)', 'Web Worker Edge/Chroma Matting Fallback'],
    limitationsNote: 'AI model weights download only when triggered and are cached in IndexedDB/CacheStorage. Low-memory devices automatically use the fast Web Worker matting engine.'
  },
  {
    id: 'pdf-organize',
    name: 'PDF Merge, Split & Organize',
    category: 'pdf',
    shortDesc: 'Merge multiple PDFs, reorder thumbnails, rotate individual pages, delete, or split by ranges.',
    popular: true,
    lazyModules: ['pdf-lib / Native PDF 1.7 Engine', 'PDF.js Page Renderer'],
    limitationsNote: 'Encrypted or corrupted PDFs cannot be modified without unlocking first.'
  },
  {
    id: 'pdf-compress',
    name: 'PDF Optimizer & Compressor',
    category: 'pdf',
    shortDesc: 'Reduce PDF size using Low/Medium/High page reconstruction presets or metadata stripping.',
    popular: true,
    lazyModules: ['PDF.js Rasterizer', 'JPEG Stream Rebuilder'],
    limitationsNote: 'Reconstructing pages as compressed images significantly shrinks scanned PDFs but flattens selectable text, links, and vector paths.'
  },
  {
    id: 'pdf-to-img',
    name: 'PDF to JPG / PNG',
    category: 'convert',
    secondaryCategories: ['pdf'],
    shortDesc: 'Render selected or all PDF pages to high-resolution JPG or PNG images and export as ZIP.',
    popular: true,
    lazyModules: ['PDF.js Renderer', 'PKZIP Archive Builder'],
    limitationsNote: 'High DPI settings on 100+ page documents require substantial browser memory; processed in sequential batches.'
  },
  {
    id: 'img-to-pdf',
    name: 'Images to PDF Converter',
    category: 'convert',
    secondaryCategories: ['pdf'],
    shortDesc: 'Combine multiple images into one PDF or separate PDFs with A4, Letter, Legal, margins, and fit modes.',
    popular: true,
    lazyModules: ['Native PDF 1.7 Page Composer'],
    limitationsNote: 'Preserves full image resolution within your chosen page geometry and margin settings.'
  },
  {
    id: 'pdf-watermark',
    name: 'PDF Watermark & Page Numbers',
    category: 'pdf',
    shortDesc: 'Stamp custom text/image watermarks and formatted Page X of Y numbering across PDF pages.',
    lazyModules: ['PDF Content Stream Stamper'],
    limitationsNote: 'Stamps vector text or embedded image XObjects directly into page content streams.'
  },
  {
    id: 'pdf-metadata-text',
    name: 'PDF Metadata, Text & Image Extractor',
    category: 'pdf',
    shortDesc: 'Edit Title/Author/Keywords metadata, extract plain text streams, or pull embedded JPEG images.',
    lazyModules: ['PDF Stream Inspector'],
    limitationsNote: 'Extracts text from digital text-based PDFs. For scanned image-only PDFs, use the Optional OCR tool.'
  },
  {
    id: 'pdf-ocr',
    name: 'Optical Character Recognition (OCR)',
    category: 'pdf',
    shortDesc: 'Recognize text from scanned PDFs or images with lazy-loaded browser OCR and contrast preprocessing.',
    badge: 'Optional WASM',
    lazyModules: ['Tesseract.js WASM (Lazy-Loaded)', 'Adaptive Threshold Preprocessor'],
    limitationsNote: 'Recognition accuracy depends on scan DPI and handwriting/font clarity. Distinguishes plain text export from searchable PDF layer generation.'
  }
];
