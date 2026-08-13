import type { PrivacyZone } from '@camera.ui/sdk';

export async function maskPrivacyZones(source: Blob | string, zones: PrivacyZone[]): Promise<Blob | null> {
  const polygons = zones.filter((zone) => zone.points.length >= 3);
  if (polygons.length === 0) return typeof source === 'string' ? dataUrlToBlob(source) : source;

  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.drawImage(image, 0, 0);
    context.fillStyle = '#000';
    for (const zone of polygons) {
      context.beginPath();
      for (const [index, [x, y]] of zone.points.entries()) {
        const px = (x / 100) * canvas.width;
        const py = (y / 100) * canvas.height;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    }

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image failed to load'));
    image.src = url;
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return await (await fetch(dataUrl)).blob();
}
