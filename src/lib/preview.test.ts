import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PREVIEW_LIMIT, markdownPreview } from './preview';

describe('markdownPreview', () => {
  it('drops embedded images, however long their data URI is', () => {
    const note = `# Photo\n\n![x](data:image/png;base64,${'A'.repeat(5000)})\n\ncaption`;
    const preview = markdownPreview(note);
    expect(preview).not.toContain('data:');
    expect(preview.length).toBeLessThanOrEqual(PREVIEW_LIMIT);
  });

  it('skips the front matter', () => {
    expect(markdownPreview('---\ntitle: x\n---\n\n# Hello')).toBe('Hello');
  });

  it('skips TOML front matter too', () => {
    expect(markdownPreview('+++\ntitle = "x"\n+++\n\n# Hello')).toBe('Hello');
  });

  it('does not take a lone +++ line for front matter', () => {
    expect(markdownPreview('+++\ntext')).toBe('+++ text');
  });

  it('keeps the text of headings, emphasis and links', () => {
    expect(markdownPreview('# Title\n\n**bold** [link](https://e.com)')).toBe('Title bold link');
  });

  it('leaves no tag opening behind, even when it is never closed', () => {
    expect(markdownPreview('<b>bold</b> text')).toBe('bold text');
    expect(markdownPreview('text <script')).toBe('text script');
    expect(markdownPreview('a <img src=x onerror=alert(1)')).not.toMatch(/<[a-z]/i);
    expect(markdownPreview('<a><script')).toBe('script');
    expect(markdownPreview('<<script')).toBe('script');
    expect(markdownPreview('<<<img src=x')).toBe('img src=x');
    expect(markdownPreview('<**script')).toBe('script');
    expect(markdownPreview('<_img src=x')).toBe('img src=x');
  });

  it('keeps a less-than sign that cannot open a tag', () => {
    expect(markdownPreview('a < b')).toBe('a < b');
  });

  it('is a single space for an empty note, never an empty string', () => {
    expect(markdownPreview('')).toBe(' ');
    expect(markdownPreview('  \n')).toBe(' ');
  });

  it('cuts long text at the limit with an ellipsis', () => {
    const preview = markdownPreview('x'.repeat(500));
    expect(preview).toHaveLength(PREVIEW_LIMIT);
    expect(preview.endsWith('…')).toBe(true);
  });
});

// Random text rarely looks like Markdown, so also draw notes from the
// fragments the preview has to take apart.
const fragment = fc.constantFrom(
  '<',
  '<<',
  '>',
  'script',
  '<img src=x onerror=alert(1)',
  '</b>',
  '<!--',
  '# ',
  '> ',
  '- [x] ',
  '1. ',
  '**',
  '_',
  '`',
  '```js\n',
  '![a](data:image/png;base64,AAAA)',
  '[x](https://e.com)',
  '---\n',
  '+++\n',
  '\n',
  ' ',
  'a < b',
  'text'
);
const note = fc.oneof(
  fc.string(),
  fc.array(fragment, { maxLength: 40 }).map((parts) => parts.join(''))
);

describe('markdownPreview properties', () => {
  it('is one non-empty line within the limit', () => {
    fc.assert(
      fc.property(note, (text) => {
        const preview = markdownPreview(text);
        expect(preview.length).toBeGreaterThan(0);
        expect(preview.length).toBeLessThanOrEqual(PREVIEW_LIMIT);
        expect(preview).not.toMatch(/\n/);
      })
    );
  });

  it('never leaves a < that could open a tag', () => {
    fc.assert(
      fc.property(note, (text) => {
        expect(markdownPreview(text)).not.toMatch(/<[a-zA-Z/!?]/);
      })
    );
  });
});
