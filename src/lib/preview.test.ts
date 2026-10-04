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

  it('keeps the text of headings, emphasis and links', () => {
    expect(markdownPreview('# Title\n\n**bold** [link](https://e.com)')).toBe('Title bold link');
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
