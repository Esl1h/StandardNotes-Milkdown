import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { Schema, Slice, type Node } from '@milkdown/kit/prose/model';
import { EditorState, type Transaction } from '@milkdown/kit/prose/state';
import { canJoin, canSplit, findWrapping, liftTarget } from '@milkdown/kit/prose/transform';
import { type DecorationSet } from '@milkdown/kit/prose/view';
import * as syntax from './markdownSyntax';
import * as toc from './toc';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    heading: { group: 'block', content: 'text*', attrs: { level: { default: 1 } } },
    blockquote: { group: 'block', content: 'block+' },
    bullet_list: { group: 'block', content: 'list_item+' },
    list_item: { content: 'block+' },
    text: {},
  },
  marks: { strong: {} },
});

const paragraph = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : []);
const quote = (...children: Node[]) => schema.node('blockquote', null, children);
const heading = (text: string, level = 1) => schema.node('heading', { level }, [schema.text(text)]);
const list = (...children: Node[]) =>
  schema.node(
    'bullet_list',
    null,
    children.map((child) => schema.node('list_item', null, [child]))
  );

const BLOCKS = [
  () => paragraph('plain'),
  () => paragraph('see [[A note]] and [[B]]'),
  () => paragraph('[TOC]'),
  () => heading('Title'),
  () => quote(paragraph('[!NOTE]'), paragraph('[[C]]')),
  () => quote(quote(paragraph('[!TIP] nested'))),
  () => list(paragraph('[[D]]'), heading('In a list', 2), paragraph('[toc]')),
];
const block = fc.nat(BLOCKS.length - 1).map((index) => BLOCKS[index]!());
const document_ = fc
  .array(block, { minLength: 1, maxLength: 6 })
  .map((blocks) => schema.node('doc', null, blocks));

const TEXTS = ['x', ' ', '[', ']', '[[', ']]', '[!NOTE]', '[TOC]'];

/** One random edit; `a` and `b` pick the positions. */
const OPERATIONS: Array<(tr: Transaction, a: number, b: number, pick: number) => void> = [
  (tr, a, _b, pick) => tr.insertText(TEXTS[pick % TEXTS.length]!, a),
  (tr, a, b) => tr.delete(a, b),
  (tr, a) => canSplit(tr.doc, a) && tr.split(a),
  (tr, a) => canJoin(tr.doc, a) && tr.join(a),
  (tr, a, b) => {
    const range = tr.doc.resolve(a).blockRange(tr.doc.resolve(b));
    const wrapping = range && findWrapping(range, schema.nodes.blockquote!);
    if (range && wrapping) {
      tr.wrap(range, wrapping);
    }
  },
  (tr, a, b) => {
    const range = tr.doc.resolve(a).blockRange(tr.doc.resolve(b));
    const target = range && liftTarget(range);
    if (range && target !== null) {
      tr.lift(range, target);
    }
  },
  (tr, a, b) => tr.addMark(a, b, schema.mark('strong')),
  (tr, a, b) => tr.removeMark(a, b),
  (tr, a, b, pick) =>
    tr.setBlockType(a, b, pick % 2 ? schema.nodes.heading! : schema.nodes.paragraph!, {
      level: 1 + (pick % 3),
    }),
  (tr, a, _b, pick) => {
    const $a = tr.doc.resolve(a);
    tr.insert($a.depth ? $a.after(1) : a, BLOCKS[pick % BLOCKS.length]!());
  },
  // A block moved to the start or the end of the document.
  (tr, a, _b, pick) => {
    const $a = tr.doc.resolve(a);
    if ($a.depth && tr.doc.childCount > 1) {
      const node = $a.node(1);
      tr.delete($a.before(1), $a.after(1));
      tr.insert(pick % 2 ? 0 : tr.doc.content.size, node);
    }
  },
  // Replaced by the very same node: no object changes, mapping still drops.
  (tr, a) => {
    const $a = tr.doc.resolve(a);
    if ($a.depth) {
      tr.replaceWith($a.before(1), $a.after(1), $a.node(1));
    }
  },
  (tr, a, b) => tr.replace(a, b, Slice.empty),
  (tr, a, b) => tr.replace(a, a, tr.doc.slice(a, b)),
];

const edit = fc.record({
  operation: fc.nat(OPERATIONS.length - 1),
  from: fc.double({ min: 0, max: 1, noNaN: true }),
  to: fc.double({ min: 0, max: 1, noNaN: true }),
  pick: fc.nat(100),
});

function describeSet(set: DecorationSet): string[] {
  return set
    .find()
    .map((found) => {
      const { type, spec } = found as unknown as {
        type: { attrs?: { class?: string } };
        spec: { key?: string };
      };
      return `${found.from}-${found.to} ${type.attrs?.class ?? ''} ${spec.key ?? ''}`;
    })
    .sort();
}

describe.each([
  ['syntax', syntax],
  ['table of contents', toc],
])('incremental %s decorations', (_name, { decorate, redecorate }) => {
  it('equal the ones of the whole document after any edits', () => {
    fc.assert(
      fc.property(
        document_,
        fc.array(fc.array(edit, { minLength: 1, maxLength: 3 }), { maxLength: 8 }),
        (start, transactions) => {
          let state = EditorState.create({ doc: start });
          let set = decorate(state.doc);
          for (const edits of transactions) {
            const tr = state.tr;
            for (const { operation, from, to, pick } of edits) {
              const size = tr.doc.content.size;
              const a = Math.round(Math.min(from, to) * size);
              const b = Math.round(Math.max(from, to) * size);
              try {
                OPERATIONS[operation]!(tr, a, b, pick);
              } catch {
                // Not every random edit fits the schema; skip those that throw.
              }
            }
            state = state.apply(tr);
            if (tr.docChanged) {
              set = redecorate(set, tr);
            }
            expect(describeSet(set)).toEqual(describeSet(decorate(state.doc)));
          }
        }
      ),
      { numRuns: 1500 }
    );
  }, 60000);
});

describe('work done while typing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const blocks = Array.from({ length: 50 }, (_, i) => paragraph(`[[Note ${i}]]`));
  const doc = schema.node('doc', null, [paragraph('[TOC]'), heading('Title'), ...blocks]);

  it('searches only the edited block for wiki links', () => {
    const state = EditorState.create({ doc });
    const set = syntax.decorate(state.doc);
    const search = vi.spyOn(String.prototype, 'matchAll');

    syntax.redecorate(set, state.tr.insertText('x', doc.content.size - 1));

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('keeps the table of contents while headings only move', () => {
    const state = EditorState.create({ doc });
    const set = toc.decorate(state.doc);
    const widget = (decorations: DecorationSet) =>
      decorations.find().find((found) => found.from === found.to)!;

    const moved = toc.redecorate(set, state.tr.insert(0, paragraph('above')));

    expect(widget(moved).from).toBeGreaterThan(widget(set).from);
    expect(widget(moved).spec.key).toBe(widget(set).spec.key);
  });
});
