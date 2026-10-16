import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedImage, safeImageSrc } from './image';

describe('embedImage', () => {
  it('embeds a small image as is', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'dot.png', { type: 'image/png' });

    expect(await embedImage(file)).toBe('data:image/png;base64,iVBORw==');
  });

  describe('an SVG', () => {
    afterEach(() => {
      delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
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
