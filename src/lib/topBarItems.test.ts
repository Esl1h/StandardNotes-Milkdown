import { describe, expect, it } from 'vitest';
import { editorViewCtx } from '@milkdown/kit/core';
import { type Ctx } from '@milkdown/kit/ctx';
import { TextSelection } from '@milkdown/kit/prose/state';
import { createCrepe } from './crepe';
import { buildTopBar } from './topBarItems';

type Run = (ctx: Ctx) => void;

/** The onRun of each item buildTopBar adds, by key. */
function topBarActions(): Record<string, Run> {
  const actions: Record<string, Run> = {};
  const group: Record<string, unknown> = {};
  group.addItem = (key: string, item: { onRun: Run }) => {
    actions[key] = item.onRun;
    return group;
  };
  group.addGroup = () => group;
  const builder = { getGroup: () => group, addGroup: () => group };
  buildTopBar(builder as never);
  return actions;
}

/** Opens `markdown` in the real editor, puts the caret after `caretAfter`,
 * runs the button, and returns the saved Markdown. */
async function run(button: string, markdown: string, caretAfter: string): Promise<string> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const crepe = await createCrepe(root, markdown, false);
  await crepe.create();
  try {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      let caret = -1;
      view.state.doc.descendants((node, pos) => {
        const index = node.isText ? (node.text ?? '').indexOf(caretAfter) : -1;
        if (index >= 0 && caret < 0) {
          caret = pos + index + caretAfter.length;
        }
      });
      expect(caret).toBeGreaterThan(-1);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, caret)));
      topBarActions()[button](ctx);
    });
    return crepe.getMarkdown();
  } finally {
    await crepe.destroy();
    root.remove();
  }
}

describe('callout button', () => {
  it('turns a paragraph into a NOTE alert', async () => {
    expect(await run('callout', 'Some text\n', 'Some')).toBe('> [!NOTE]\n> Some text\n');
  });

  // Wrapping is only offered for a plain paragraph: elsewhere the marker
  // would land inside the heading or cell and corrupt the saved Markdown.
  it('leaves a list item as it was', async () => {
    expect(await run('callout', '- item one\n- item two\n', 'item two')).toBe(
      '- item one\n- item two\n'
    );
  });

  it('leaves a table cell as it was', async () => {
    const table = '| a | b |\n| - | - |\n| c | d |\n';

    expect(await run('callout', table, 'c')).toBe(table);
  });

  it('leaves a heading as it was', async () => {
    expect(await run('callout', '# Title\n', 'Tit')).toBe('# Title\n');
  });
});

describe('toc button', () => {
  it('adds a [TOC] paragraph', async () => {
    expect(await run('toc', 'Some text\n', 'Some')).toContain('[TOC]');
  });
});
