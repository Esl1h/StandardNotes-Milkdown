import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import { type Node } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey, type Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { type BlockEditFeatureConfig } from '@milkdown/crepe/feature/block-edit';
import { headingsOf, showHeading, type Heading } from './headings';
import { isTocText } from './tocMarker';

/**
 * A table of contents. The note keeps a paragraph that says only `[TOC]`,
 * which Typora, GitLab and other Markdown tools also read as one; the
 * editor draws the list of the headings under it, and keeps it up to date.
 */

/** Whether `node` is a paragraph with nothing but the marker. */
function isTocMarker(node: Node): boolean {
  return node.type.name === 'paragraph' && isTocText(node.textContent);
}

/** The list of headings, indented by level; a click goes to the heading. */
function tocList(headings: Heading[], onSelect: (heading: Heading) => void): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'toc-list';
  nav.setAttribute('aria-label', 'Table of contents');
  // A click on the list is not an edit: keep it from moving the selection.
  nav.addEventListener('mousedown', (event) => event.stopPropagation());
  if (headings.length === 0) {
    nav.textContent = 'Headings show up here.';
    return nav;
  }
  const list = document.createElement('ul');
  for (const heading of headings) {
    const item = document.createElement('li');
    item.className = `toc-level-${heading.level}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = heading.text || 'Untitled';
    button.addEventListener('click', () => onSelect(heading));
    item.appendChild(button);
    list.appendChild(item);
  }
  nav.appendChild(list);
  return nav;
}

/** What one top level block adds to a table of contents, positions relative
 * to the block. */
interface BlockOutline {
  headings: Heading[];
  markers: Array<{ pos: number; size: number }>;
}

// A block that was not edited is the same object, so it is only read once.
const blockOutlines = new WeakMap<Node, BlockOutline>();

function blockOutline(block: Node): BlockOutline {
  let outline = blockOutlines.get(block);
  if (!outline) {
    const found: BlockOutline = { headings: [], markers: [] };
    const visit = (node: Node, pos: number) => {
      if (node.type.name === 'heading') {
        found.headings.push({ level: node.attrs.level as number, text: node.textContent, pos });
        return false;
      }
      if (isTocMarker(node)) {
        found.markers.push({ pos, size: node.nodeSize });
        return false;
      }
      return true;
    };
    if (visit(block, 0)) {
      block.descendants((node, pos) => visit(node, pos + 1));
    }
    blockOutlines.set(block, (outline = found));
  }
  return outline;
}

/** The markers and headings of the document, and the key of each list. */
function tocOf(doc: Node) {
  const headings: Heading[] = [];
  const markers: BlockOutline['markers'] = [];
  doc.forEach((block, offset) => {
    const outline = blockOutline(block);
    headings.push(...outline.headings.map((h) => ({ ...h, pos: h.pos + offset })));
    markers.push(...outline.markers.map((m) => ({ ...m, pos: m.pos + offset })));
  });
  // No positions in the key: typing above a heading must not rebuild the list.
  const signature = headings.map((h) => `${h.level}:${h.text}`).join('\n');
  const keys = markers.map((_, index) => `toc:${index}:${signature}`);
  return { headings, markers, keys };
}

function draw(doc: Node, { headings, markers, keys }: ReturnType<typeof tocOf>): DecorationSet {
  return DecorationSet.create(
    doc,
    markers.flatMap(({ pos, size }, index) => [
      Decoration.node(pos, pos + size, { class: 'toc-marker' }),
      Decoration.widget(
        pos + size,
        (view) =>
          tocList(headings, (heading) => {
            // The list outlives edits that move the headings: look the
            // position up now.
            const current = headingsOf(view.state.doc)[headings.indexOf(heading)];
            if (current) {
              showHeading(view, current);
            }
          }),
        { side: -1, key: keys[index], stopEvent: () => true }
      ),
    ])
  );
}

function decorate(doc: Node): DecorationSet {
  return draw(doc, tocOf(doc));
}

/** Keeps the lists as they are while neither a marker nor a heading changed. */
function redecorate(previous: DecorationSet, tr: Transaction): DecorationSet {
  const toc = tocOf(tr.doc);
  const mapped = previous.map(tr.mapping, tr.doc);
  const wanted = toc.markers.flatMap(({ pos, size }, index) => [
    `${pos}:${pos + size}:`,
    `${pos + size}:${pos + size}:${toc.keys[index]}`,
  ]);
  const kept = mapped.find().map((d) => `${d.from}:${d.to}:${d.spec.key ?? ''}`);
  return wanted.sort().join('|') === kept.sort().join('|') ? mapped : draw(tr.doc, toc);
}

const tocKey = new PluginKey<DecorationSet>('tocDecorations');

const tocDecorations = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: tocKey,
      state: {
        init: (_, state) => decorate(state.doc),
        apply: (tr, previous) => (tr.docChanged ? redecorate(previous, tr) : previous),
      },
      props: {
        decorations: (state) => tocKey.getState(state),
      },
    })
);

const TOC_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
    <path fill="currentColor" d="M3 9h14V7H3v2zm0 4h14v-2H3v2zm0 4h14v-2H3v2zm16 0h2v-2h-2v2zm0-10v2h2V7h-2zm0 6h2v-2h-2v2z" />
  </svg>
`;

/** The slash menu entry that turns the current line into the marker. */
const addTocMenuItem: NonNullable<BlockEditFeatureConfig['buildMenu']> = (builder) => {
  builder.getGroup('advanced').addItem('toc', {
    label: 'Table of contents',
    icon: TOC_ICON,
    onRun: (ctx) => {
      ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.insertText('[TOC]'));
    },
  });
};

export { addTocMenuItem, decorate, isTocMarker, redecorate, tocDecorations, tocList };
