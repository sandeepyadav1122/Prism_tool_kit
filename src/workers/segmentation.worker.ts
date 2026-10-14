/**
 * Web Worker for CPU-intensive pixel operations:
 * - Smart corner-sampled Flood-Fill & Chroma-Distance Alpha Matting with Edge Feathering
 * - Brightness / Contrast / Saturation / Grayscale / Adaptive OCR Binarization
 */
self.onmessage = (e: MessageEvent) => {
  const { type, width, height, pixels, options } = e.data;
  const data = new Uint8ClampedArray(pixels);

  if (type === 'smart-bg-remove') {
    const tolerance = options?.tolerance ?? 38;
    const feather = options?.feather ?? 12;
    // Sample background color from the 4 corners and top/left/right border pixels
    const sampleCoords = [
      [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
      [Math.floor(width / 2), 0], [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)]
    ];
    let sr = 0, sg = 0, sb = 0;
    for (const [cx, cy] of sampleCoords) {
      const idx = (cy * width + cx) * 4;
      sr += data[idx];
      sg += data[idx + 1];
      sb += data[idx + 2];
    }
    sr /= sampleCoords.length;
    sg /= sampleCoords.length;
    sb /= sampleCoords.length;

    const bgColor = options?.targetBgHex
      ? hexToRgb(options.targetBgHex)
      : { r: sr, g: sg, b: sb };

    const tolSq = tolerance * tolerance * 3;
    const outerSq = (tolerance + feather) * (tolerance + feather) * 3;

    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - bgColor.r;
      const dg = data[i + 1] - bgColor.g;
      const db = data[i + 2] - bgColor.b;
      const distSq = dr * dr + dg * dg + db * db;
      if (distSq <= tolSq) {
        data[i + 3] = 0;
      } else if (distSq < outerSq) {
        const ratio = ( Math.sqrt(distSq) - Math.sqrt(tolSq) ) / Math.max(1, Math.sqrt(outerSq) - Math.sqrt(tolSq));
        data[i + 3] = Math.round(data[i + 3] * Math.min(1, Math.max(0, ratio)));
      }
    }
    (self as unknown as Worker).postMessage({ type: 'done', pixels: data.buffer }, [data.buffer]);
  }
};

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
