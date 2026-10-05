import { describe, expect, it, vi } from 'vitest';
import { Schema, type Node } from '@milkdown/kit/prose/model';
import { isTocMarker, tocList } from './toc';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    heading: { group: 'block', content: 'text*', attrs: { level: { default: 1 } } },
    text: { group: 'inline' },
  },
});
const paragraph = (value: string): Node =>
  schema.node('paragraph', null, value ? [schema.text(value)] : []);

describe('isTocMarker', () => {
  it('is a paragraph that holds only [TOC]', () => {
    expect(isTocMarker(paragraph('[TOC]'))).toBe(true);
    expect(isTocMarker(paragraph(' [toc] '))).toBe(true);
  });

  it('is not any other text', () => {
    expect(isTocMarker(paragraph('see [TOC] here'))).toBe(false);
    expect(isTocMarker(paragraph('TOC'))).toBe(false);
    expect(isTocMarker(paragraph(''))).toBe(false);
  });

  it('is not a heading that happens to say [TOC]', () => {
    const heading = schema.node('heading', { level: 2 }, [schema.text('[TOC]')]);

    expect(isTocMarker(heading)).toBe(false);
  });
});

describe('tocList', () => {
  const headings = [
    { level: 1, text: 'Title', pos: 0 },
    { level: 2, text: 'Part', pos: 10 },
    { level: 3, text: '', pos: 20 },
  ];

  it('lists the headings by level, with a name for an empty one', () => {
    const list = tocList(headings, () => {});

    const items = Array.from(list.querySelectorAll('li'));
    expect(items.map((item) => item.className)).toEqual([
      'toc-level-1',
      'toc-level-2',
      'toc-level-3',
    ]);
    expect(items.map((item) => item.textContent)).toEqual(['Title', 'Part', 'Untitled']);
  });

  it('is a navigation landmark with a name', () => {
    const list = tocList(headings, () => {});

    expect(list.tagName).toBe('NAV');
    expect(list.getAttribute('aria-label')).toBe('Table of contents');
  });

  it('reports the heading that was clicked', () => {
    const onSelect = vi.fn();
    const list = tocList(headings, onSelect);

    (list.querySelectorAll('button')[1] as HTMLButtonElement).click();

    expect(onSelect).toHaveBeenCalledWith(headings[1]);
  });

  it('says so when there are no headings yet', () => {
    const list = tocList([], () => {});

    expect(list.querySelector('button')).toBeNull();
    expect(list.textContent).toBe('Headings show up here.');
  });

  it('does not let a click reach the editor behind the widget', () => {
    const list = tocList(headings, () => {});
    const outside = vi.fn();
    document.body.addEventListener('mousedown', outside);
    document.body.appendChild(list);

    list.querySelector('button')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    document.body.removeEventListener('mousedown', outside);
    list.remove();
    expect(outside).not.toHaveBeenCalled();
  });
});
