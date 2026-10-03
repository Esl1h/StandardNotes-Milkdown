/**
 * Turns an uploaded image into a data URI stored in the note itself, since
 * Standard Notes does not host files for editors. A data URI makes the
 * note heavier on every device it syncs to, so large images are scaled down
 * and recompressed until they fit the budget.
 */

/** Largest data URI embedded in a note, in characters (about 375 KB of image). */
const MAX_DATA_URI_LENGTH = 500 * 1024;
/** Longest side of a recompressed image, in pixels. */
const MAX_SIDE = 1600;
/** Below this longest side the image is too degraded to be worth keeping. */
const MIN_SIDE = 200;

function readAsDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function encode(bitmap: ImageBitmap, side: number): string {
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL('image/webp', 0.82);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  // No WebP encoder (Safari falls back to PNG): JPEG has no alpha, so
  // paint transparent areas white instead of black.
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

async function embedImage(file: File): Promise<string> {
  const original = await readAsDataUri(file);
  if (original.length <= MAX_DATA_URI_LENGTH) {
    return original;
  }
  const bitmap = await createImageBitmap(file);
  try {
    for (let side = MAX_SIDE; side >= MIN_SIDE; side = Math.floor(side * 0.75)) {
      const encoded = encode(bitmap, side);
      if (encoded.length <= MAX_DATA_URI_LENGTH) {
        return encoded;
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error(`The image "${file.name}" is too large to embed in the note.`);
}

export { embedImage, MAX_DATA_URI_LENGTH };
