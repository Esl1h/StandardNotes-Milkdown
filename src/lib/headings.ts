import { type Node } from '@milkdown/kit/prose/model';

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

export type { Heading };
export { headingsOf };
