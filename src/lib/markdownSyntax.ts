import { defaultHandlers, type Handle } from 'mdast-util-to-markdown';
import { remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { type Ctx } from '@milkdown/kit/ctx';
import { $prose } from '@milkdown/kit/utils';
import { type Node } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

/**
 * Syntaxes from other Markdown tools that CommonMark keeps as plain text:
 * GitHub alerts (`> [!NOTE]`) and wiki links (`[[Note]]`). The serializer
 * escaped their opening bracket (`\[!NOTE]`, `\[\[Note]]`) on the first
 * edit, breaking them in GitHub and Obsidian. They stay plain text in the
 * document (typed alerts work too); the serializer drops the escape, and
 * decorations render them.
 */

const ALERT_MARKER = /^\[!(note|tip|important|warning|caution)\]/i;
const ESCAPED_ALERT = /^(>[ \t]*)\\\[!(note|tip|important|warning|caution)\]/i;
const WIKI_LINK = /\[\[[^[\]\n]+\]\]/g;
const ESCAPED_WIKI_LINK = /\\\[\\\[([^[\]\n]+)\]\]/g;

/**
 * Wraps the serializer handlers. Milkdown passes its own handlers (text
 * among them) as remark-stringify settings, which override any extension,
 * so the wrapping goes into those settings. The same settings write lists
 * with `-`, the GitHub and Obsidian default, instead of remark's `*`.
 */
function preserveSyntaxOnSave(ctx: Ctx): void {
  ctx.update(remarkStringifyOptionsCtx, (options) => {
    const handlers = (options.handlers ?? {}) as Record<string, Handle>;
    const quote = handlers.blockquote ?? defaultHandlers.blockquote;
    const text = handlers.text ?? defaultHandlers.text;
    return {
      ...options,
      bullet: '-' as const,
      handlers: {
        ...handlers,
        blockquote: (node, parent, state, info) =>
          quote(node, parent, state, info).replace(ESCAPED_ALERT, '$1[!$2]'),
        text: (node, parent, state, info) =>
          text(node, parent, state, info).replace(ESCAPED_WIKI_LINK, '[[$1]]'),
      },
    };
  });
}

function decorate(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'blockquote') {
      const first = node.firstChild;
      const kind = first?.type.name === 'paragraph' && first.textContent.match(ALERT_MARKER);
      if (kind) {
        const name = kind[1].toLowerCase();
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class: `markdown-alert markdown-alert-${name}`,
          }),
          // pos + 2: inside the blockquote, then inside its paragraph.
          Decoration.inline(pos + 2, pos + 2 + kind[0].length, { class: 'markdown-alert-marker' })
        );
      }
    }
    if (node.isText && node.text) {
      for (const match of node.text.matchAll(WIKI_LINK)) {
        const from = pos + (match.index ?? 0);
        decorations.push(Decoration.inline(from, from + match[0].length, { class: 'wiki-link' }));
      }
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
}

const syntaxDecorationsKey = new PluginKey<DecorationSet>('syntaxDecorations');

const syntaxDecorations = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: syntaxDecorationsKey,
      state: {
        init: (_, state) => decorate(state.doc),
        apply: (tr, previous) => (tr.docChanged ? decorate(tr.doc) : previous),
      },
      props: {
        decorations: (state) => syntaxDecorationsKey.getState(state),
      },
    })
);

export { preserveSyntaxOnSave, syntaxDecorations };
