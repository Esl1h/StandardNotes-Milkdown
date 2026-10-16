import { describe, expect, it } from 'vitest';
import { embedImage, safeImageSrc } from './image';

describe('embedImage', () => {
  it('embeds a small image as is', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'dot.png', { type: 'image/png' });

    expect(await embedImage(file)).toBe('data:image/png;base64,iVBORw==');
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
