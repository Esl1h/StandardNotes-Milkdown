import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real mermaid needs a layout engine; a stand-in that records the theme
// each render was made with is enough to see when and how often it renders.
const initialize = vi.fn();
const render = vi.fn(async (id: string, source: string) => ({
  svg: `<svg id="${id}"><desc>${source}|${initialize.mock.lastCall?.[0].theme}</desc></svg>`,
}));

type Preview = Awaited<typeof import('./mermaid')>;

async function load(): Promise<Preview> {
  vi.resetModules();
  vi.doMock('mermaid', () => ({ default: { initialize, render } }));
  return import('./mermaid');
}

const setBackground = (color: string) => {
  document.body.style.backgroundColor = color;
};
const DARK = 'rgb(20, 20, 20)';
const LIGHT = 'rgb(250, 250, 250)';

/** Stands in for the code block: shows what applyPreview is given, the way
 * the Crepe preview panel does, as markup inside a `.preview` element. */
function codeBlock() {
  const panel = document.createElement('div');
  panel.className = 'preview-panel';
  const preview = document.createElement('div');
  preview.className = 'preview';
  panel.appendChild(preview);
  document.body.appendChild(panel);
  const applied: Array<null | string | HTMLElement> = [];
  const applyPreview = (value: null | string | HTMLElement) => {
    applied.push(value);
    if (typeof value === 'string') {
      preview.innerHTML = value;
    }
  };
  return { preview, applyPreview, applied };
}

// Each load() is a fresh module with its own watcher on the same document;
// the ones of earlier tests must not keep acting on it.
const watchers: MutationObserver[] = [];
const RealMutationObserver = window.MutationObserver;

beforeEach(() => {
  vi.useFakeTimers();
  window.MutationObserver = class extends RealMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      watchers.push(this);
    }
  };
  initialize.mockClear();
  render.mockClear();
  setBackground(LIGHT);
});

afterEach(() => {
  watchers.splice(0).forEach((watcher) => watcher.disconnect());
  window.MutationObserver = RealMutationObserver;
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
});

describe('renderMermaidPreview', () => {
  it('ignores other languages and empty diagrams', async () => {
    const { renderMermaidPreview } = await load();
    const { applyPreview } = codeBlock();

    expect(renderMermaidPreview('js', 'const a = 1', applyPreview)).toBeNull();
    expect(renderMermaidPreview('mermaid', '  \n', applyPreview)).toBeNull();
    expect(render).not.toHaveBeenCalled();
  });

  it('renders a diagram later through applyPreview', async () => {
    const { renderMermaidPreview } = await load();
    const { applyPreview, preview } = codeBlock();

    expect(renderMermaidPreview('mermaid', 'graph LR', applyPreview)).toBeUndefined();

    await vi.waitFor(() => expect(preview.innerHTML).toContain('graph LR'));
  });

  it('uses the theme that matches the page at the time of each render', async () => {
    const { renderMermaidPreview } = await load();
    const { applyPreview, preview } = codeBlock();
    setBackground(DARK);
    renderMermaidPreview('mermaid', 'A', applyPreview);
    await vi.waitFor(() => expect(preview.innerHTML).toContain('A|dark'));

    setBackground(LIGHT);
    renderMermaidPreview('mermaid', 'B', applyPreview);

    await vi.waitFor(() => expect(preview.innerHTML).toContain('B|default'));
    // Initialized again only because the theme changed.
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('does not initialize again while the theme stays the same', async () => {
    const { renderMermaidPreview } = await load();
    const { applyPreview, preview } = codeBlock();
    renderMermaidPreview('mermaid', 'A', applyPreview);
    await vi.waitFor(() => expect(preview.innerHTML).toContain('A|default'));

    renderMermaidPreview('mermaid', 'B', applyPreview);
    await vi.waitFor(() => expect(preview.innerHTML).toContain('B|default'));

    expect(initialize).toHaveBeenCalledTimes(1);
  });
});

describe('when the app theme changes', () => {
  it('draws the diagrams on screen again with the new theme', async () => {
    const { renderMermaidPreview } = await load();
    const { applyPreview, preview } = codeBlock();
    renderMermaidPreview('mermaid', 'graph LR', applyPreview);
    await vi.waitFor(() => expect(preview.innerHTML).toContain('graph LR|default'));

    // The app switches theme: its stylesheet changes the page background.
    setBackground(DARK);

    await vi.waitFor(() => expect(preview.innerHTML).toContain('graph LR|dark'));
    expect(preview.querySelectorAll('svg')).toHaveLength(1);
  });

  it('draws every diagram of the note, each with its own source', async () => {
    const { renderMermaidPreview } = await load();
    const first = codeBlock();
    const second = codeBlock();
    renderMermaidPreview('mermaid', 'first', first.applyPreview);
    renderMermaidPreview('mermaid', 'second', second.applyPreview);
    await vi.waitFor(() => expect(second.preview.innerHTML).toContain('second|default'));

    setBackground(DARK);

    await vi.waitFor(() => expect(second.preview.innerHTML).toContain('second|dark'));
    expect(first.preview.innerHTML).toContain('first|dark');
  });

  it('shows the latest source of a diagram that was edited', async () => {
    const { renderMermaidPreview } = await load();
    const { applyPreview, preview } = codeBlock();
    renderMermaidPreview('mermaid', 'v1', applyPreview);
    renderMermaidPreview('mermaid', 'v2', applyPreview);
    await vi.waitFor(() => expect(preview.innerHTML).toContain('v2|default'));

    setBackground(DARK);

    await vi.waitFor(() => expect(preview.innerHTML).toContain('v2|dark'));
    expect(preview.innerHTML).not.toContain('v1');
  });

  it('leaves the diagrams alone when the background changes but not the theme', async () => {
    const { renderMermaidPreview } = await load();
    const { applyPreview, preview } = codeBlock();
    renderMermaidPreview('mermaid', 'graph LR', applyPreview);
    await vi.waitFor(() => expect(preview.innerHTML).toContain('graph LR|default'));
    render.mockClear();

    setBackground('rgb(255, 255, 255)');
    await vi.advanceTimersByTimeAsync(3000);

    expect(render).not.toHaveBeenCalled();
  });

  it('keeps the old diagram when drawing it again fails', async () => {
    const { renderMermaidPreview } = await load();
    const { applyPreview, preview } = codeBlock();
    renderMermaidPreview('mermaid', 'graph LR', applyPreview);
    await vi.waitFor(() => expect(preview.innerHTML).toContain('graph LR|default'));
    render.mockRejectedValueOnce(new Error('boom'));

    setBackground(DARK);
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(2));

    expect(preview.innerHTML).toContain('graph LR|default');
  });
});
