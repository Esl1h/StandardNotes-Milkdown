/**
 * Preview of ```mermaid code blocks as diagrams. Mermaid is large, so it is
 * only downloaded the first time a note has such a block; the note keeps
 * the diagram source, as any other Markdown tool expects.
 */

type Mermaid = (typeof import('mermaid'))['default'];

let mermaidLoad: Promise<Mermaid> | null = null;
// Renders run one at a time: mermaid is not safe to call concurrently, and
// a queue keeps a slow render from overwriting a newer one while typing.
let queue: Promise<unknown> = Promise.resolve();
let renderCount = 0;

/** Follows the app theme: StyleKit sets the page background. */
function isDarkBackground(): boolean {
  const [r, g, b] = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) ?? []).map(
    Number
  );
  if (r === undefined) {
    return false;
  }
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

function loadMermaid(): Promise<Mermaid> {
  mermaidLoad ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDarkBackground() ? 'dark' : 'default',
    });
    return mermaid;
  });
  return mermaidLoad;
}

function errorElement(error: unknown): HTMLElement {
  const element = document.createElement('div');
  element.className = 'mermaid-error';
  element.textContent = `Diagram error: ${error instanceof Error ? error.message : String(error)}`;
  return element;
}

/**
 * The code block `renderPreview` hook: null for other languages, otherwise
 * undefined now (the block shows its loading label) and the diagram later
 * through applyPreview.
 */
function renderMermaidPreview(
  language: string,
  content: string,
  applyPreview: (value: null | string | HTMLElement) => void
): null | undefined {
  if (language.toLowerCase() !== 'mermaid' || content.trim() === '') {
    return null;
  }
  queue = queue
    .then(loadMermaid)
    .then((mermaid) => mermaid.render(`mermaid-preview-${++renderCount}`, content))
    .then(({ svg }) => applyPreview(svg))
    .catch((error: unknown) => applyPreview(errorElement(error)));
  return undefined;
}

export { renderMermaidPreview };
