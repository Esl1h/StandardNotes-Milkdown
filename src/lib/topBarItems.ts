import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { redoCommand, undoCommand } from '@milkdown/kit/plugin/history';
import {
  addBlockTypeCommand,
  blockquoteSchema,
  hardbreakSchema,
  liftListItemCommand,
  paragraphSchema,
  sinkListItemCommand,
  wrapInBlockTypeCommand,
} from '@milkdown/kit/preset/commonmark';
import { Fragment } from '@milkdown/kit/prose/model';
import { type TopBarFeatureConfig } from '@milkdown/crepe/feature/top-bar';

/**
 * Buttons added to the Crepe top bar. Undo, redo and the list indent are
 * there for touch screens, which have no Ctrl+Z or Tab. The SVG titles
 * are the hover tooltips (the bar has no labels of its own).
 */

const icon = (title: string, path: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>${title}</title><path d="${path}"/></svg>`;

const UNDO_ICON = icon(
  'Undo',
  'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z'
);
const REDO_ICON = icon(
  'Redo',
  'M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z'
);
const OUTDENT_ICON = icon(
  'Decrease indent',
  'M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z'
);
const INDENT_ICON = icon(
  'Increase indent',
  'M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z'
);
const CALLOUT_ICON = icon(
  'Callout',
  'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'
);
const TOC_ICON = icon(
  'Table of contents',
  'M3 9h14V7H3v2zm0 4h14v-2H3v2zm0 4h14v-2H3v2zm16 0h2v-2h-2v2zm0-10v2h2V7h-2zm0 6h2v-2h-2v2z'
);

const buildTopBar: NonNullable<TopBarFeatureConfig['buildTopBar']> = (builder) => {
  builder
    .getGroup('list')
    .addItem('outdent', {
      icon: OUTDENT_ICON,
      active: () => false,
      onRun: (ctx) => ctx.get(commandsCtx).call(liftListItemCommand.key),
    })
    .addItem('indent', {
      icon: INDENT_ICON,
      active: () => false,
      onRun: (ctx) => ctx.get(commandsCtx).call(sinkListItemCommand.key),
    });

  builder
    .getGroup('more')
    .addItem('callout', {
      icon: CALLOUT_ICON,
      active: () => false,
      // A GitHub alert: the marker line, then the text on the next one. The
      // line between them is a soft break, which Milkdown keeps as an
      // inline hardbreak node (a "\n" in the text would save as a space).
      onRun: (ctx) => {
        ctx
          .get(commandsCtx)
          .call(wrapInBlockTypeCommand.key, { nodeType: blockquoteSchema.type(ctx) });
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const marker = Fragment.from([
          state.schema.text('[!NOTE]'),
          hardbreakSchema.type(ctx).create({ isInline: true }),
        ]);
        view.dispatch(state.tr.insert(state.selection.$from.start(), marker));
      },
    })
    .addItem('toc', {
      icon: TOC_ICON,
      active: () => false,
      onRun: (ctx) => {
        const { schema } = ctx.get(editorViewCtx).state;
        ctx.get(commandsCtx).call(addBlockTypeCommand.key, {
          nodeType: paragraphSchema.type(ctx).create(null, schema.text('[TOC]')),
        });
      },
    });

  builder
    .addGroup('history', 'History')
    .addItem('undo', {
      icon: UNDO_ICON,
      active: () => false,
      onRun: (ctx) => ctx.get(commandsCtx).call(undoCommand.key),
    })
    .addItem('redo', {
      icon: REDO_ICON,
      active: () => false,
      onRun: (ctx) => ctx.get(commandsCtx).call(redoCommand.key),
    });
};

export { buildTopBar };
