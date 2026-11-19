import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_DATA_URI_LENGTH,
  MAX_NOTE_IMAGE_LENGTH,
  embedImage,
  safeImageSrc,
  setNoteTextSource,
} from './image';

describe('embedImage', () => {
  it('embeds a small image as is', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'dot.png', { type: 'image/png' });

    expect(await embedImage(file)).toBe('data:image/png;base64,iVBORw==');
  });

  /** jsdom draws nothing: stand-ins for the bitmap decoding and the canvas. */
  function stubBitmapPath() {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 24, height: 24, close: vi.fn() }))
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/webp;base64,UklGRg=='
    );
  }

  describe('a file too big to embed as is', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('goes straight to the bitmap without reading it into memory first', async () => {
      stubBitmapPath();
      const read = vi.spyOn(FileReader.prototype, 'readAsDataURL');
      // base64 makes it a third bigger: over the budget before reading.
      const file = new File(
        [new Uint8Array(Math.ceil((MAX_DATA_URI_LENGTH * 3) / 4) + 1)],
        'big.png',
        {
          type: 'image/png',
        }
      );

      expect(await embedImage(file)).toBe('data:image/webp;base64,UklGRg==');
      expect(read).not.toHaveBeenCalled();
    });
  });

  describe('the images of one note', () => {
    afterEach(() => {
      setNoteTextSource(null);
      vi.restoreAllMocks();
    });

    const png = () =>
      new File([new Uint8Array([137, 80, 78, 71])], 'dot.png', { type: 'image/png' });
    const noteWith = (length: number) => `![a](data:image/png;base64,${'A'.repeat(length)})`;

    it('are refused, with a warning, past the limit', async () => {
      const warn = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
      setNoteTextSource(() => noteWith(MAX_NOTE_IMAGE_LENGTH));

      await expect(embedImage(png())).rejects.toThrow(/limit/);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/limit/));
    });

    it('are accepted below the limit', async () => {
      const warn = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
      setNoteTextSource(() => noteWith(1000));

      expect(await embedImage(png())).toBe('data:image/png;base64,iVBORw==');
      expect(warn).not.toHaveBeenCalled();
    });

    it('count only data URIs, not the rest of the text', async () => {
      setNoteTextSource(() => 'x'.repeat(MAX_NOTE_IMAGE_LENGTH + 10));

      expect(await embedImage(png())).toBe('data:image/png;base64,iVBORw==');
    });
  });

  describe('an SVG', () => {
    afterEach(() => {
      delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('is recognised by its name when the browser gives no type', async () => {
      Object.defineProperty(HTMLImageElement.prototype, 'decode', {
        configurable: true,
        value: async () => undefined,
      });
      URL.createObjectURL = vi.fn(() => 'blob:icon');
      URL.revokeObjectURL = vi.fn();
      stubBitmapPath();
      const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'Icon.SVG', {
        type: '',
      });

      expect(await embedImage(file)).toBe('data:image/webp;base64,UklGRg==');
      expect(createImageBitmap).toHaveBeenCalledWith(
        expect.any(HTMLImageElement),
        expect.anything()
      );
    });

    it('is stored as pixels, never as SVG', async () => {
      // jsdom draws nothing: stand-ins for the decoding and the canvas.
      Object.defineProperty(HTMLImageElement.prototype, 'decode', {
        configurable: true,
        value: async () => undefined,
      });
      URL.createObjectURL = vi.fn(() => 'blob:icon');
      URL.revokeObjectURL = vi.fn();
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn(async () => ({ width: 24, height: 24, close: vi.fn() }))
      );
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage: vi.fn(),
      } as never);
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/webp;base64,UklGRg=='
      );
      const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'icon.svg', {
        type: 'image/svg+xml',
      });

      expect(await embedImage(file)).toBe('data:image/webp;base64,UklGRg==');
      expect(createImageBitmap).toHaveBeenCalledWith(expect.any(HTMLImageElement), {
        resizeWidth: 300,
        resizeHeight: 150,
      });
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:icon');
    });
  });
});

describe('safeImageSrc', () => {
  it.each([
    'https://example.com/cat.png',
    'http://example.com/cat.png',
    'data:image/png;base64,iVBORw==',
    'DATA:image/webp;base64,UklGRg==',
    'images/cat.png',
    '/cat.png',
    '',
  ])('keeps %j', (src) => {
    expect(safeImageSrc(src)).toBe(src);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' \u0001javascript:alert(1)',
    'java\tscript:alert(1)',
    'jav\na\rscript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
  ])('drops %j', (src) => {
    expect(safeImageSrc(src)).toBe('');
  });
});
