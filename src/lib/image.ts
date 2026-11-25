/**
 * Turns an uploaded image into a data URI stored in the note itself, since
 * Standard Notes does not host files for editors. A data URI makes the
 * note heavier on every device it syncs to, so large images are scaled down
 * and recompressed until they fit the budget.
 */

/** Largest data URI embedded in a note, in characters (about 375 KB of image). */
const MAX_DATA_URI_LENGTH = 500 * 1024;
/** All the embedded images of one note, in characters (about 3.75 MB of images). */
const MAX_NOTE_IMAGE_LENGTH = 5 * 1024 * 1024;
/** Longest side of a recompressed image, in pixels. */
const MAX_SIDE = 1600;
/** Below this longest side the image is too degraded to be worth keeping. */
const MIN_SIDE = 200;

// The note's current Markdown, to see how much of the budget its images use.
// The editor sets it per instance; null means no note, so no limit applies.
let noteText: (() => string) | null = null;

function setNoteTextSource(source: (() => string) | null): void {
  noteText = source;
}

/** The text of the open note, for limits outside the upload path. */
function getNoteText(): string | null {
  return noteText?.() ?? null;
}

function embeddedLength(text: string): number {
  let total = 0;
  for (const match of text.matchAll(/data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g)) {
    total += match[0].length;
  }
  return total;
}

/** Refuses an image that would take the note past its image budget. The
 * upload error only reaches the console, so the person is told directly. */
function checkNoteBudget(file: File, embedded: string): void {
  if (!noteText || embeddedLength(noteText()) + embedded.length <= MAX_NOTE_IMAGE_LENGTH) {
    return;
  }
  const message = `The note already holds about ${Math.round(
    MAX_NOTE_IMAGE_LENGTH / 1024 / 1024
  )} MB of images, the limit for one note. "${file.name}" was not added; remove an image first.`;
  window.alert(message);
  throw new Error(message);
}

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

/** An SVG drawn as pixels: browsers do not decode SVG files into an
 * ImageBitmap directly, only through an <img>. One without a size of its
 * own is drawn at the size browsers give such an image. */
async function svgBitmap(file: File): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return await createImageBitmap(image, {
      resizeWidth: image.naturalWidth || 300,
      resizeHeight: image.naturalHeight || 150,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function embedImage(file: File): Promise<string> {
  const embedded = await embedFile(file);
  checkNoteBudget(file, embedded);
  return embedded;
}

async function embedFile(file: File): Promise<string> {
  // An SVG is a document that can carry scripts: it is stored as pixels,
  // so the note never holds one, whatever later opens the image. Some
  // systems give a dropped .svg no type at all, so the name counts too.
  const isSvg = file.type === 'image/svg+xml' || (file.type === '' && /\.svg$/i.test(file.name));
  // Base64 is a third bigger than the file: one that cannot fit is not read
  // into memory only to be thrown away.
  if (!isSvg && (file.size * 4) / 3 <= MAX_DATA_URI_LENGTH) {
    const original = await readAsDataUri(file);
    if (original.length <= MAX_DATA_URI_LENGTH) {
      return original;
    }
  }
  const bitmap = isSvg ? await svgBitmap(file) : await createImageBitmap(file);
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

/**
 * The image address when it is one an image can be loaded from: http(s), a
 * data URI of an image or a relative path; otherwise empty. A note can say
 * `![x](javascript:...)`, harmless in an <img> but not for whatever else
 * reads the address later. Only the start is read, a data URI can be long,
 * and as browsers do, leading control characters and spaces and every tab
 * or newline are skipped.
 */
function safeImageSrc(src: string): string {
  let head = '';
  for (const char of src) {
    if ((head === '' && char <= ' ') || /[\t\n\r]/.test(char)) {
      continue;
    }
    head += char;
    if (head.length === 32) {
      break;
    }
  }
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(head);
  return !hasScheme || /^(https?:|data:image\/)/i.test(head) ? src : '';
}

export {
  embedImage,
  embeddedLength,
  getNoteText,
  MAX_DATA_URI_LENGTH,
  MAX_NOTE_IMAGE_LENGTH,
  safeImageSrc,
  setNoteTextSource,
};
