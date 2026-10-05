import { describe, expect, it } from 'vitest';
import { roundTrip } from '../mocks/roundTrip';

// The first edit rewrites the note in the shape of the visual editor. These
// pairs pin that shape, so a change in Milkdown or in our config shows up
// here instead of in someone's notes.
describe('serializer normalizations', () => {
  it.each([
    [
      'reference links become inline and the definition goes',
      'See [docs][1].\n\n[1]: https://example.com\n',
      'See [docs](https://example.com).\n',
    ],
    [
      'a two space line break becomes a backslash',
      'line one  \nline two\n',
      'line one\\\nline two\n',
    ],
    ['a setext heading becomes ATX', 'Title\n=====\n', '# Title\n'],
    [
      'tables are padded and their alignment rewritten',
      '| a | b |\n|:--|--:|\n| 1 | 2 |\n',
      '| a  |  b |\n| :- | -: |\n| 1  |  2 |\n',
    ],
    ['a stray asterisk is escaped', 'price 5*3 and a_b_c\n', 'price 5\\*3 and a_b_c\n'],
    [
      'a bare URL gets angle brackets',
      'Visit https://example.com now\n',
      'Visit <https://example.com> now\n',
    ],
    [
      'block HTML gets a blank line before the closing tag',
      '<details>\n<summary>S</summary>\n\nBody\n</details>\n',
      '<details>\n<summary>S</summary>\n\nBody\n\n</details>\n',
    ],
  ])(
    '%s',
    async (_name, input, output) => {
      expect(await roundTrip(input)).toBe(output);
    },
    20000
  );
});

describe('syntaxes that survive unchanged', () => {
  it.each([
    ['footnotes', 'Text[^1].\n\n[^1]: The note.\n'],
    ['inline HTML', 'Press <kbd>Ctrl</kbd> now\n'],
    ['an ordered list starting at 3', '3. a\n4. b\n'],
    ['inline math', 'Energy $E=mc^2$ inline\n'],
    ['underscore emphasis', '__bold__ and _italic_\n'],
    ['front matter', '---\ntitle: x\n---\n\n# Hello\n'],
    ['TOML front matter', '+++\ntitle = "x"\ntags = ["a", "b"]\n+++\n\n# Hello\n'],
    ['wiki links', '[[Note]] and [[Other]]\n'],
    ['a table of contents marker', '# A\n\n[TOC]\n\n## B\n'],
  ])(
    '%s',
    async (_name, markdown) => {
      expect(await roundTrip(markdown)).toBe(markdown);
    },
    20000
  );
});
