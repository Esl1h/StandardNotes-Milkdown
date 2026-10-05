/**
 * Preview of ```mermaid code blocks as diagrams. Mermaid is large, so it is
 * only downloaded the first time a note has such a block; the note keeps
 * the diagram source, as any other Markdown tool expects.
 *
 * The diagram colors are fixed when it is drawn, so a change of the app
 * theme is watched: the diagrams on screen are drawn again, in place, with
 * the new theme.
 */

type Mermaid = (typeof import('mermaid'))['default'];

let mermaidLoad: Promise<Mermaid> | null = null;
// Renders run one at a time: mermaid is not safe to call concurrently, and
// a queue keeps a slow render from overwriting a newer one while typing.
let queue: Promise<unknown> = Promise.resolve();
let renderCount = 0;

// The source of the diagrams drawn, by the id of their svg: the preview
// panel keeps only the svg, and drawing again needs the source. Bounded,
// since every keystroke in a diagram draws a new one.
const SOURCE_LIMIT = 200;
const sources = new Map<string, string>();
// The theme mermaid was last initialized with.
let appliedDark: boolean | null = null;

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

/** Initializes mermaid for the page theme, unless it already is. */
function applyTheme(mermaid: Mermaid): void {
  const dark = isDarkBackground();
  if (dark !== appliedDark) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'default',
    });
    appliedDark = dark;
  }
}

function loadMermaid(): Promise<Mermaid> {
  mermaidLoad ??= import('mermaid').then(({ default: mermaid }) => {
    applyTheme(mermaid);
    watchTheme();
    return mermaid;
  });
  return mermaidLoad;
}

/** Draws the diagrams on screen again with the current theme. A diagram
 * that fails to draw keeps the one it has. */
function redrawDiagrams(): void {
  queue = queue.then(loadMermaid).then(async (mermaid) => {
    applyTheme(mermaid);
    for (const svg of document.querySelectorAll<SVGElement>('svg[id^="mermaid-preview-"]')) {
      const source = sources.get(svg.id);
      const container = svg.parentElement;
      if (source === undefined || !container) {
        continue;
      }
      const id = `mermaid-preview-${++renderCount}`;
      try {
        const { svg: markup } = await mermaid.render(id, source);
        remember(id, source);
        container.innerHTML = markup;
      } catch {
        // Keep what is shown.
      }
    }
  });
}

function remember(id: string, source: string): void {
  sources.set(id, source);
  if (sources.size > SOURCE_LIMIT) {
    sources.delete(sources.keys().next().value as string);
  }
}

let watching = false;

/**
 * The app theme arrives as a stylesheet added to the page, and the page
 * background only changes once it has loaded; so every change to the
 * document head or to the root elements is followed by a few checks, and
 * the diagrams are drawn again only when the theme turned out different.
 */
function watchTheme(): void {
  if (watching) {
    return;
  }
  watching = true;
  let timers: number[] = [];
  const check = () => {
    if (isDarkBackground() !== appliedDark) {
      redrawDiagrams();
    }
  };
  const schedule = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [0, 150, 600, 2000].map((delay) => window.setTimeout(check, delay));
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLLinkElement) {
          node.addEventListener('load', schedule);
        }
      });
    }
    schedule();
  });
  observer.observe(document.head, { childList: true, subtree: true, attributes: true });
  observer.observe(document.documentElement, { attributes: true });
  observer.observe(document.body, { attributes: true });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', schedule);
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
    .then((mermaid) => {
      applyTheme(mermaid);
      const id = `mermaid-preview-${++renderCount}`;
      remember(id, content);
      return mermaid.render(id, content);
    })
    .then(({ svg }) => applyPreview(svg))
    .catch((error: unknown) => applyPreview(errorElement(error)));
  return undefined;
}

export { renderMermaidPreview };
