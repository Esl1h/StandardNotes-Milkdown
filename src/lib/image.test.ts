import { describe, expect, it } from 'vitest';
import { embedImage } from './image';

describe('embedImage', () => {
  it('embeds a small image as is', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'dot.png', { type: 'image/png' });

    expect(await embedImage(file)).toBe('data:image/png;base64,iVBORw==');
  });
});
