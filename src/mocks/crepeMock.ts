/**
 * In-memory stand-in for the Milkdown Crepe class, so component tests can
 * drive the wrapper contract (create/destroy lifecycle, markdownUpdated,
 * replaceAll echoes) without booting a real ProseMirror editor in jsdom.
 *
 * The real editor is exercised by the Playwright suite against the build.
 *
 * Used through async vi.mock factories (see the component tests), which is
 * why nothing here imports the module under test.
 */

class FakeCrepe {
  static Feature = { TopBar: 'top-bar', Latex: 'latex', AI: 'ai' } as const;
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
  async create() {
    this.created = true;
    return this as unknown as object;
  }
  async destroy() {
    this.destroyed = true;
    return this as unknown as object;
  }
  get editor() {
    // editor.action(replaceAll(md)) ends up here; replaceAll runs with the
    // ctx and applies the text, echoing markdownUpdated like the real one.
    return {
      action: (fn: (ctx: unknown) => void) =>
        fn({
          __replace: (markdown: string) => {
            this.markdown = markdown;
            this.emit(markdown);
          },
        }),
    };
  }
  getMarkdown() {
    return this.markdown;
  }
  on(fn: (api: { markdownUpdated: (cb: (ctx: unknown, markdown: string) => void) => void }) => void) {
    fn({ markdownUpdated: (cb) => this.listeners.push(cb) });
    return this;
  }
  emit(markdown: string) {
    for (const listener of this.listeners) {
      listener({}, markdown);
    }
  }
}

/** The module mock for '@milkdown/kit/utils': replaceAll via the fake ctx. */
const fakeReplaceAll = (markdown: string, _flush?: boolean) => (ctx: unknown) => {
  (ctx as { __replace: (markdown: string) => void }).__replace(markdown);
};

export { FakeCrepe, fakeReplaceAll };
