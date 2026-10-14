import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdf-lib')) return 'vendor-pdf-lib';
          if (id.includes('pdfjs-dist')) return 'vendor-pdfjs';
          if (id.includes('jszip')) return 'vendor-jszip';
          if (id.includes('@imgly/background-removal')) return 'vendor-ai-bg';
          if (id.includes('tesseract.js')) return 'vendor-ocr';
          if (id.includes('heic2any') || id.includes('utif')) return 'vendor-decoders';
        }
      }
    }
  },
  worker: {
    format: 'es'
  }
});
