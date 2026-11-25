import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { editorViewCtx } from '@milkdown/kit/core';
import { createCrepe } from './crepe';
import { embedImage, MAX_DATA_URI_LENGTH, setNoteTextSource } from './image';
import { cleanPastedHtml } from './paste';

// embedImage stands in for the browser canvas: jsdom cannot decode or
// recompress a bitmap. What matters here is the decision (re-embed, keep or
// drop); the real recompression runs in the browser suite (e2e/paste.spec.js).
vi.mock('./image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./image')>();
  return { ...actual, embedImage: vi.fn() };
});
const embedImageMock = vi.mocked(embedImage);

const dataUri = (type: string, data: string) => `data:image/${type};base64,${data}`;
const smallImage = dataUri('png', 'iVBORw0KGgo=');
const svgImage = dataUri('svg+xml', 'PHN2Zy8+');
const overLimit = () => dataUri('png', 'A'.repeat(MAX_DATA_URI_LENGTH));
const heavyImage = dataUri('png', 'A'.repeat(100_000));
const recompressed = dataUri('webp', 'ZQ==');
const overBudgetNote = `![a](${dataUri('png', 'A'.repeat(5_200_000))})`;

describe('cleanPastedHtml', () => {
  beforeEach(() => {
    embedImageMock.mockReset();
  });

  afterEach(() => {
    setNoteTextSource(null);
    vi.restoreAllMocks();
  });

  it('leaves HTML without embedded images as it is', async () => {
    const html = '<p>text <img src="https://e.com/i.png"></p>';

    await expect(cleanPastedHtml(html)).resolves.toBe(html);
    expect(embedImageMock).not.toHaveBeenCalled();
  });

  it('keeps an image within the per image limit', async () => {
    const html = `<p>kept</p><img alt="a" src="${smallImage}">`;

    await expect(cleanPastedHtml(html)).resolves.toBe(html);
    expect(embedImageMock).not.toHaveBeenCalled();
  });

  it('re-embeds an image over the per image limit', async () => {
    embedImageMock.mockResolvedValue(recompressed);
    const html = `<p>kept</p><img alt="big" src="${overLimit()}">`;

    await expect(cleanPastedHtml(html)).resolves.toBe(
      `<p>kept</p><img alt="big" src="${recompressed}">`
    );
    expect(embedImageMock).toHaveBeenCalledTimes(1);
    expect(embedImageMock.mock.calls[0]![0].type).toBe('image/png');
  });

  it('drops one that cannot be re-embedded, with the reason', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    embedImageMock.mockRejectedValue(
      new Error('The image "image" is too large to embed in the note.')
    );
    const html = `<p>kept</p><img alt="big" src="${overLimit()}">`;

    await expect(cleanPastedHtml(html)).resolves.toBe('<p>kept</p>');
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('too large'));
  });

  it('drops an SVG document, like an uploaded one', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    embedImageMock.mockRejectedValue(new Error('no canvas here'));
    const html = `<img alt="svg" src="${svgImage}">`;

    await expect(cleanPastedHtml(html)).resolves.toBe('');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(embedImageMock.mock.calls[0]![0].type).toBe('image/svg+xml');
  });

  it('drops the images of a paste that would take the note over its budget', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    embedImageMock.mockResolvedValue(recompressed);
    setNoteTextSource(() => overBudgetNote);
    const html = `<p>kept</p><img alt="a" src="${heavyImage}">`;

    await expect(cleanPastedHtml(html)).resolves.toBe('<p>kept</p>');
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('limit for one note'));
  });

  it('keeps the images of a paste while the note is within its budget', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    embedImageMock.mockResolvedValue(recompressed);
    setNoteTextSource(() => overBudgetNote.slice(0, 300_000));
    const html = `<p>kept</p><img alt="a" src="${heavyImage}">`;

    // 300 KB in the note, 133 KB pasted: within the budget of 5 MB.
    await expect(cleanPastedHtml(html)).resolves.toBe(html);
    expect(alert).not.toHaveBeenCalled();
    expect(embedImageMock).not.toHaveBeenCalled();
  });

  it('finds the images however the base64 is laid out', () => {
    expect(
      fc.assert(
        fc.property(
          fc.string({ unit: fc.constantFrom(...'AB+/='), minLength: 1, maxLength: 40 }),
          fc.constantFrom('png', 'jpeg', 'webp', 'gif'),
          (data, type) => {
            const uri = dataUri(type, data);
            const html = `<img src="${uri}">`;
            const found = [...html.matchAll(/data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g)];
            return found.length === 1 && found[0]![0] === uri;
          }
        ),
        { numRuns: 500 }
      )
    );
  });
});

describe('pasteImageLimits on the editor', () => {
  it('drops the images over the limits of a paste into the note', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const crepe = await createCrepe(root, 'text', false);
    await crepe.create();
    try {
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const transfer = {
          types: ['text/html', 'text/plain'],
          setData: () => undefined,
          getData: (type: string) =>
            type === 'text/html'
              ? `<p>kept text</p><img alt="svg" src="${svgImage}"><img alt="big" src="${overLimit()}">`
              : type === 'text/plain'
                ? 'kept text'
                : '',
        } as unknown as DataTransfer;
        const pasted = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(pasted, 'clipboardData', { value: transfer });
        view.dom.dispatchEvent(pasted);
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      const markdown = crepe.getMarkdown();
      expect(markdown).toContain('kept text');
      expect(markdown).not.toContain('base64');
    } finally {
      await crepe.destroy();
      root.remove();
    }
  }, 30000);
});
