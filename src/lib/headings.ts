import { type Node } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import { type EditorView } from '@milkdown/kit/prose/view';

/** A heading of the document, for the outline. */
interface Heading {
  level: number;
  text: string;
  /** Document position of the heading node. */
  pos: number;
}

/** Every heading of the document, at any depth: a quote or a list item can
 * hold one too. The ProseMirror position makes each one reachable. */
function headingsOf(doc: Node): Heading[] {
  const headings: Heading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({ level: node.attrs.level as number, text: node.textContent, pos });
      // A heading holds only inline content.
      return false;
    }
    return true;
  });
  return headings;
}

/** Scrolls the heading to the top of the pane and puts the cursor in it. */
function showHeading(view: EditorView, heading: Heading): void {
  const dom = view.nodeDOM(heading.pos);
  if (dom instanceof HTMLElement) {
    dom.scrollIntoView({ block: 'start' });
  }
  const { state } = view;
  view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(heading.pos + 1))));
  view.focus();
}

export type { Heading };
export { headingsOf, showHeading };
