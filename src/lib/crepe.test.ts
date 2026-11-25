import { describe, expect, it, vi } from 'vitest';
import { createCrepe } from './crepe';

describe('caret', () => {
  it('is the native one: a virtual cursor forces a layout on every key', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const crepe = await createCrepe(root, 'text', false);
    await crepe.create();

    expect(root.querySelector('.ProseMirror')?.classList).not.toContain('virtual-cursor-enabled');

    await crepe.destroy();
    root.remove();
  }, 20000);
});

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
