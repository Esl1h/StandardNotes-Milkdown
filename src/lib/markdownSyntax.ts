import { defaultHandlers, type Handle } from 'mdast-util-to-markdown';
import { remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { type Ctx } from '@milkdown/kit/ctx';
import { $prose } from '@milkdown/kit/utils';
import { type Node } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey, type Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

/**
 * Syntaxes from other Markdown tools that CommonMark keeps as plain text:
 * GitHub alerts (`> [!NOTE]`), wiki links (`[[Note]]`) and the `[TOC]`
 * marker of a table of contents. The serializer
 * escaped their opening bracket (`\[!NOTE]`, `\[\[Note]]`) on the first
 * edit, breaking them in GitHub and Obsidian. They stay plain text in the
 * document (typed alerts work too); the serializer drops the escape, and
 * decorations render them.
 */

const ALERT_MARKER = /^\[!(note|tip|important|warning|caution)\]/i;
const ESCAPED_ALERT = /^(>[ \t]*)\\\[!(note|tip|important|warning|caution)\]/i;
const WIKI_LINK = /\[\[[^[\]\n]+\]\]/g;
const ESCAPED_WIKI_LINK = /\\\[\\\[([^[\]\n]+)\]\]/g;
// A paragraph that is only the table of contents marker.
const ESCAPED_TOC = /^\\\[(toc)\]$/i;

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
          text(node, parent, state, info)
            .replace(ESCAPED_WIKI_LINK, '[[$1]]')
            .replace(ESCAPED_TOC, '[$1]'),
      },
    };
  });
}

/** The decorations of the blocks between `from` and `to`, two block boundaries. */
function decorationsIn(doc: Node, from: number, to: number): Decoration[] {
  const decorations: Decoration[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
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
  return decorations;
}

function decorate(doc: Node): DecorationSet {
  return DecorationSet.create(doc, decorationsIn(doc, 0, doc.content.size));
}

/**
 * The top level blocks of `tr.doc` that may need new decorations, as one range.
 * A block left alone is still the same object; the step maps add what was
 * replaced by an identical copy, whose decorations the mapping drops. The
 * blocks before and after the range are those of the previous document.
 */
function changedBlocks({ before, doc, mapping }: Transaction): { from: number; to: number } {
  const shorter = Math.min(before.childCount, doc.childCount);
  let head = 0;
  let from = 0;
  while (head < shorter && before.child(head) === doc.child(head)) {
    from += doc.child(head++).nodeSize;
  }
  let tail = 0;
  let to = doc.content.size;
  while (
    tail < shorter - head &&
    before.child(before.childCount - 1 - tail) === doc.child(doc.childCount - 1 - tail)
  ) {
    to -= doc.child(doc.childCount - 1 - tail++).nodeSize;
  }
  if (head === before.childCount && head === doc.childCount) {
    [from, to] = [Infinity, -Infinity];
  }
  mapping.maps.forEach((map, index) => {
    const later = mapping.slice(index + 1);
    map.forEach((_oldFrom, _oldTo, start, end) => {
      from = Math.min(from, later.map(start, -1));
      to = Math.max(to, later.map(end, 1));
    });
  });
  if (from > to) {
    // Nothing changed: an empty range at the end of both documents.
    return { from: doc.content.size, to: doc.content.size };
  }
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  return { from: $from.depth ? $from.before(1) : from, to: $to.depth ? $to.after(1) : to };
}

/** Moves the decorations along and redraws only the blocks `tr` touched:
 * redrawing the whole note on every key made large ones slow. */
function redecorate(previous: DecorationSet, tr: Transaction): DecorationSet {
  const { from, to } = changedBlocks(tr);
  const oldTo = tr.before.content.size - (tr.doc.content.size - to);
  // Removed before mapping: afterwards the set may no longer match the tree and
  // `remove` misses some. `find` also returns what only touches the range.
  const stale = previous.find(from, oldTo).filter((d) => d.from >= from && d.to <= oldTo);
  return previous
    .remove(stale)
    .map(tr.mapping, tr.doc)
    .add(tr.doc, decorationsIn(tr.doc, from, to));
}

const syntaxDecorationsKey = new PluginKey<DecorationSet>('syntaxDecorations');

const syntaxDecorations = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: syntaxDecorationsKey,
      state: {
        init: (_, state) => decorate(state.doc),
        apply: (tr, previous) => (tr.docChanged ? redecorate(previous, tr) : previous),
      },
      props: {
        decorations: (state) => syntaxDecorationsKey.getState(state),
      },
    })
);

export { decorate, preserveSyntaxOnSave, redecorate, syntaxDecorations };
