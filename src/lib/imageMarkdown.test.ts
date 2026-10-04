import { describe, expect, it } from 'vitest';
import { createCrepe } from './crepe';

/** Real Crepe, no mock: the bug lives in how the schemas read the Markdown. */
async function roundTrip(markdown: string): Promise<string> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const crepe = await createCrepe(root, markdown, false);
  await crepe.create();
  try {
    return crepe.getMarkdown();
  } finally {
    await crepe.destroy();
    root.remove();
  }
}

describe('image round trip', () => {
  it.each([
    ['an image without a title', '![A cat](https://e.com/c.png)\n'],
    ['an image with a title', '![A cat](https://e.com/c.png "t")\n'],
    ['an image without alt text', '![](https://e.com/c.png)\n'],
    ['an image block with a resize ratio', '![0.50](https://e.com/c.png)\n'],
    ['an inline image', 'text ![alt](https://e.com/i.png) more\n'],
    ['an inline image without alt text', 'a ![](https://e.com/i.png) b\n'],
  ])('keeps %s', async (_name, markdown) => {
    expect(await roundTrip(markdown)).toBe(markdown);
  }, 20000);
});
