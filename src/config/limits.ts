export interface SafetyLimits {
  maxFileSizeMB: number;
  maxImageDimensionPx: number;
  maxImageMegapixels: number;
  maxBatchFiles: number;
  maxPdfPages: number;
  maxConcurrentJobs: number;
}

export const DEFAULT_LIMITS: SafetyLimits = {
  maxFileSizeMB: 50,
  maxImageDimensionPx: 8192,
  maxImageMegapixels: 48,
  maxBatchFiles: 30,
  maxPdfPages: 200,
  maxConcurrentJobs: 2,
};

export const PASSPORT_PRESETS = [
  { id: 'us-2x2', name: 'US Passport / Visa (2x2 in)', widthPx: 600, heightPx: 600, mmText: '51 x 51 mm (300 DPI)', bg: '#FFFFFF' },
  { id: 'in-uk-eu', name: 'India / UK / EU / Schengen (35x45 mm)', widthPx: 413, heightPx: 531, mmText: '35 x 45 mm (300 DPI)', bg: '#FFFFFF' },
  { id: 'in-pan-exam', name: 'India Exam / PAN / SSC (3.5x4.5 cm, 200 DPI)', widthPx: 276, heightPx: 354, mmText: '35 x 45 mm (20-50 KB)', bg: '#FFFFFF' },
  { id: 'cn-visa', name: 'China Visa (33x48 mm)', widthPx: 390, heightPx: 567, mmText: '33 x 48 mm (300 DPI)', bg: '#FFFFFF' },
  { id: 'ca-passport', name: 'Canada Passport (50x70 mm)', widthPx: 591, heightPx: 827, mmText: '50 x 70 mm (300 DPI)', bg: '#FFFFFF' },
  { id: 'linkedin', name: 'LinkedIn / Resume Profile (1:1)', widthPx: 800, heightPx: 800, mmText: '800 x 800 px Square', bg: '#F8FAFC' },
];

export const SOCIAL_PRESETS = [
  { id: 'ig-square', name: 'Instagram Square (1:1)', width: 1080, height: 1080 },
  { id: 'ig-portrait', name: 'Instagram Portrait (4:5)', width: 1080, height: 1350 },
  { id: 'ig-story', name: 'Instagram / Reels Story (9:16)', width: 1080, height: 1920 },
  { id: 'yt-thumb', name: 'YouTube Thumbnail (16:9)', width: 1280, height: 720 },
  { id: 'linkedin-banner', name: 'LinkedIn Cover Banner', width: 1584, height: 396 },
  { id: 'ecom-product', name: 'Ecommerce Marketplace Zoom (1:1)', width: 2000, height: 2000 },
];
