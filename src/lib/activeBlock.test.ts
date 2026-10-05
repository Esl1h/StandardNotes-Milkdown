import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { activeBlockRange } from './activeBlock';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    blockquote: { group: 'block', content: 'block+' },
    text: {},
  },
});

const p = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : []);
const doc = schema.node('doc', null, [
  p('first'),
  schema.node('blockquote', null, [p('quoted one'), p('quoted two')]),
  p('last'),
]);

function stateAt(pos: number) {
  return EditorState.create({ doc, selection: TextSelection.create(doc, pos) });
}

describe('activeBlockRange', () => {
  it('returns the paragraph holding the cursor', () => {
    // "first" spans 1..6; its paragraph is 0..7.
    expect(activeBlockRange(stateAt(3))).toEqual({ from: 0, to: 7 });
  });

  it('returns the whole top level block for a nested cursor', () => {
    const quote = doc.child(1);
    // Inside "quoted two", two levels deep.
    const inner = 7 + 1 + doc.child(1).child(0).nodeSize + 2;
    expect(activeBlockRange(stateAt(inner))).toEqual({ from: 7, to: 7 + quote.nodeSize });
  });

  it('follows the cursor to the last block', () => {
    const lastStart = doc.content.size - doc.lastChild!.nodeSize;
    expect(activeBlockRange(stateAt(doc.content.size - 1))).toEqual({
      from: lastStart,
      to: doc.content.size,
    });
  });
});
