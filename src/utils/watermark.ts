/**
 * Client-side watermarking for Free-plan exports. Pro/Team get clean output.
 */

/** Overlay a tiled diagonal watermark onto a PNG data URL; returns a new PNG. */
export function watermarkPng(dataUrl: string, text: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Tiled diagonal wordmark, low opacity.
        const fs = Math.max(16, Math.round(canvas.width / 26));
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = '#7c3aed';
        ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 9);
        const step = fs * 3.2;
        for (let y = -canvas.height; y < canvas.height; y += step) {
          for (let x = -canvas.width; x < canvas.width; x += ctx.measureText(text).width + fs * 4) {
            ctx.fillText(text, x, y);
          }
        }
        ctx.restore();

        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
