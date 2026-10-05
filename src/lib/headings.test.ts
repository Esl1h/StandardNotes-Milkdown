import { describe, expect, it } from 'vitest';
import { Schema, type Node } from '@milkdown/kit/prose/model';
import { headingsOf } from './headings';

// Just enough of the Markdown schema: the nodes that can hold a heading.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    heading: { group: 'block', content: 'text*', attrs: { level: { default: 1 } } },
    blockquote: { group: 'block', content: 'block+' },
    bullet_list: { group: 'block', content: 'list_item+' },
    list_item: { content: 'block+' },
    text: { group: 'inline' },
  },
});

const text = (value: string) => schema.text(value);
const heading = (level: number, value: string) =>
  schema.node('heading', { level }, value ? [text(value)] : []);
const paragraph = (value: string) => schema.node('paragraph', null, [text(value)]);
const doc = (...blocks: Node[]) => schema.node('doc', null, blocks);

describe('headingsOf', () => {
  it('lists the top level headings with their level and text', () => {
    const headings = headingsOf(doc(heading(1, 'Title'), paragraph('body'), heading(2, 'Part')));

    expect(headings.map(({ level, text: value }) => [level, value])).toEqual([
      [1, 'Title'],
      [2, 'Part'],
    ]);
  });

  it('finds a heading inside a blockquote', () => {
    const headings = headingsOf(
      doc(paragraph('intro'), schema.node('blockquote', null, [heading(2, 'Quoted')]))
    );

    expect(headings.map((h) => h.text)).toEqual(['Quoted']);
  });

  it('finds a heading inside a list item', () => {
    const list = schema.node('bullet_list', null, [
      schema.node('list_item', null, [heading(3, 'Item heading'), paragraph('text')]),
    ]);

    expect(headingsOf(doc(list)).map((h) => [h.level, h.text])).toEqual([[3, 'Item heading']]);
  });

  it('keeps the document order across the nesting levels', () => {
    const headings = headingsOf(
      doc(
        heading(1, 'One'),
        schema.node('blockquote', null, [heading(2, 'Two')]),
        heading(1, 'Three')
      )
    );

    expect(headings.map((h) => h.text)).toEqual(['One', 'Two', 'Three']);
  });

  it('gives each heading the document position of its node', () => {
    const document = doc(
      paragraph('ab'),
      schema.node('blockquote', null, [heading(2, 'Quoted')]),
      heading(1, 'Last')
    );

    for (const found of headingsOf(document)) {
      expect(document.nodeAt(found.pos)?.type.name).toBe('heading');
      expect(document.nodeAt(found.pos)?.textContent).toBe(found.text);
    }
  });

  it('is empty for a note without headings', () => {
    expect(headingsOf(doc(paragraph('just text')))).toEqual([]);
  });
});
