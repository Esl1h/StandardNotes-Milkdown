import { $prose } from '@milkdown/kit/utils';
import { type EditorState, Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

/**
 * Marks the top level block holding the cursor with `is-active`, for the
 * active block highlight and the focus mode (both pure CSS on that class).
 *
 * Decorations never touch the document, so moving the cursor around never
 * produces a save. The set is rebuilt only when the active block changes.
 */

/** Start and end of the top level block holding the selection head. */
function activeBlockRange(state: EditorState): { from: number; to: number } | null {
  const { $head } = state.selection;
  if ($head.depth < 1) {
    // A node selection on a top level block (an image, a table) sits at depth 0.
    const node = state.doc.nodeAt($head.pos);
    return node ? { from: $head.pos, to: $head.pos + node.nodeSize } : null;
  }
  const from = $head.before(1);
  return { from, to: from + $head.node(1).nodeSize };
}

function build(state: EditorState): DecorationSet {
  const range = activeBlockRange(state);
  if (!range) {
    return DecorationSet.empty;
  }
  return DecorationSet.create(state.doc, [
    Decoration.node(range.from, range.to, { class: 'is-active' }),
  ]);
}

const activeBlockKey = new PluginKey<DecorationSet>('activeBlock');

const activeBlock = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: activeBlockKey,
      state: {
        init: (_, state) => build(state),
        apply: (tr, previous, oldState, newState) => {
          if (!tr.docChanged && !tr.selectionSet) {
            return previous;
          }
          const before = activeBlockRange(oldState);
          const after = activeBlockRange(newState);
          // Typing inside the same block: just map the existing decoration.
          if (before && after && tr.mapping.map(before.from) === after.from) {
            return previous.map(tr.mapping, tr.doc);
          }
          return build(newState);
        },
      },
      props: {
        decorations: (state) => activeBlockKey.getState(state),
      },
    })
);

export { activeBlock, activeBlockRange };
