import { describe, expect, it } from 'vitest';
import { countText, formatCount } from './wordCount';

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

describe('formatCount', () => {
  it('shows the total without a selection', () => {
    expect(formatCount({ words: 132, characters: 800 }, null)).toEqual({
      label: '132 words',
      title: '800 characters',
    });
  });

  it('uses the singular for one word', () => {
    expect(formatCount({ words: 1, characters: 4 }, null).label).toBe('1 word');
  });

  it('shows the selection against the total', () => {
    expect(
      formatCount({ words: 132, characters: 800 }, { words: 12, characters: 70 })
    ).toEqual({ label: '12 of 132 words', title: '70 of 800 characters' });
  });
});
