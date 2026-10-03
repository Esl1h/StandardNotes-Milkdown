/**
 * In-memory stand-in for the Milkdown Crepe editor, so component tests can
 * drive the wrapper contract (create/destroy lifecycle, markdownUpdated,
 * replaceAll echoes) without booting a real ProseMirror editor in jsdom.
 *
 * The real editor is exercised by the Playwright suite against the build.
 *
 * Used through async vi.mock factories (see the component tests), which is
 * why nothing here imports the module under test.
 */

class FakeCrepe {
  static all: FakeCrepe[] = [];

  static reset() {
    FakeCrepe.all = [];
  }

  created = false;
  destroyed = false;
  /** Current markdown, as getMarkdown would return it. */
  markdown: string;
  listeners: Array<(ctx: unknown, markdown: string) => void> = [];
  constructor(public config: Record<string, unknown>) {
    this.markdown = (config.defaultValue as string) ?? '';
    FakeCrepe.all.push(this);
  }
  topBar: HTMLElement | null = null;
  async create() {
    this.created = true;
    // The real top bar is a .milkdown-top-bar element inside the root.
    if (this.config.topBar) {
      this.topBar = document.createElement('div');
      this.topBar.className = 'milkdown-top-bar';
      (this.config.root as HTMLElement).appendChild(this.topBar);
    }
    return this as unknown as object;
  }
  async destroy() {
    this.destroyed = true;
    this.topBar?.remove();
    return this as unknown as object;
  }
  /** Enough of ctx.get(editorViewCtx) for the word count. */
  ctx() {
    const markdown = this.markdown;
    const view = {
      state: {
        doc: { content: { size: markdown.length }, textBetween: () => markdown },
        selection: { empty: true },
      },
    };
    return {
      get: () => view,
      __replace: (next: string) => {
        this.markdown = next;
        this.emit(next);
      },
    };
  }
  get editor() {
    // editor.action(replaceAll(md)) ends up here; replaceAll runs with the
    // ctx and applies the text, echoing markdownUpdated like the real one.
    return {
      action: (fn: (ctx: unknown) => void) => fn(this.ctx()),
    };
  }
  getMarkdown() {
    return this.markdown;
  }
  on(
    fn: (api: {
      markdownUpdated: (cb: (ctx: unknown, markdown: string) => void) => void;
      updated: (cb: (ctx: unknown) => void) => void;
      selectionUpdated: (cb: (ctx: unknown) => void) => void;
    }) => void
  ) {
    fn({
      markdownUpdated: (cb) => this.listeners.push(cb),
      updated: () => undefined,
      selectionUpdated: () => undefined,
    });
    return this;
  }
  emit(markdown: string) {
    for (const listener of this.listeners) {
      listener({}, markdown);
    }
  }
}

/** The module mock for '../lib/crepe': records what the editor was built with. */
const fakeCreateCrepe = (root: HTMLElement, defaultValue: string, topBar: boolean) =>
  new FakeCrepe({ root, defaultValue, topBar });

/** The module mock for '@milkdown/kit/utils': replaceAll via the fake ctx. */
const fakeReplaceAll = (markdown: string, _flush?: boolean) => (ctx: unknown) => {
  (ctx as { __replace: (markdown: string) => void }).__replace(markdown);
};

export { FakeCrepe, fakeCreateCrepe, fakeReplaceAll };
