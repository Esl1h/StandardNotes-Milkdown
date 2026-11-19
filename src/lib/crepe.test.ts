import { describe, expect, it, vi } from 'vitest';

describe('loadLatex', () => {
  it('tries the chunk again after the prefetch failed', async () => {
    vi.resetModules();
    let attempts = 0;
    vi.doMock('./latex', () => {
      if (++attempts === 1) {
        throw new Error('chunk failed');
      }
      return { latex: 'latex-feature' };
    });
    const { loadLatex } = await import('./crepe');

    // The import above already started (and failed) the prefetch.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(loadLatex()).resolves.toMatchObject({ latex: 'latex-feature' });
  });
});
