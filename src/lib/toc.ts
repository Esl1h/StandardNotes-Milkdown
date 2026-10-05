import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import { type Node } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
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

function decorate(doc: Node): DecorationSet {
  const markers: Array<{ pos: number; size: number }> = [];
  doc.descendants((node, pos) => {
    if (isTocMarker(node)) {
      markers.push({ pos, size: node.nodeSize });
      return false;
    }
    return true;
  });
  if (markers.length === 0) {
    return DecorationSet.empty;
  }
  const headings = headingsOf(doc);
  // The same key reuses the list as it is, instead of building it again.
  const signature = headings.map((h) => `${h.level}:${h.pos}:${h.text}`).join('|');
  return DecorationSet.create(
    doc,
    markers.flatMap(({ pos, size }) => [
      Decoration.node(pos, pos + size, { class: 'toc-marker' }),
      Decoration.widget(pos + size, (view) => tocList(headings, (h) => showHeading(view, h)), {
        side: -1,
        key: `toc:${pos}:${signature}`,
        stopEvent: () => true,
      }),
    ])
  );
}

const tocKey = new PluginKey<DecorationSet>('tocDecorations');

const tocDecorations = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: tocKey,
      state: {
        init: (_, state) => decorate(state.doc),
        apply: (tr, previous) => (tr.docChanged ? decorate(tr.doc) : previous),
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

export { addTocMenuItem, isTocMarker, tocDecorations, tocList };
