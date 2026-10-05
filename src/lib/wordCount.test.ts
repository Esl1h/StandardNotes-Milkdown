import { describe, expect, it } from 'vitest';
import { countText, formatCount, readingMinutes } from './wordCount';

describe('countText', () => {
  it('counts words and characters', () => {
    expect(countText('Hello brave new world')).toEqual({ words: 4, characters: 21 });
  });

  it('ignores Markdown syntax tokens without letters or digits', () => {
    expect(countText('# Title\n\n- item one\n\n| a | 2 |\n| --- | --- |').words).toBe(5);
  });

  it('counts accented and non latin words', () => {
    expect(countText('ação rápida, 日本 3').words).toBe(4);
  });

  it('handles empty text', () => {
    expect(countText('   \n')).toEqual({ words: 0, characters: 4 });
  });
});

describe('readingMinutes', () => {
  it('reads 200 words a minute, rounding up', () => {
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(201)).toBe(2);
    expect(readingMinutes(2000)).toBe(10);
  });

  it('is nothing for an empty note', () => {
    expect(readingMinutes(0)).toBe(0);
  });
});

describe('formatCount', () => {
  it('shows the total and the reading time without a selection', () => {
    expect(formatCount({ words: 132, characters: 800 }, null)).toEqual({
      label: '132 words · 1 min',
      title: '800 characters, about 1 min to read',
    });
  });

  it('uses the singular for one word', () => {
    expect(formatCount({ words: 1, characters: 4 }, null).label).toBe('1 word · 1 min');
  });

  it('leaves the reading time out of an empty note', () => {
    expect(formatCount({ words: 0, characters: 0 }, null)).toEqual({
      label: '0 words',
      title: '0 characters',
    });
  });

  it('shows the selection against the total, with no reading time', () => {
    expect(formatCount({ words: 132, characters: 800 }, { words: 12, characters: 70 })).toEqual({
      label: '12 of 132 words',
      title: '70 of 800 characters',
    });
  });
});
