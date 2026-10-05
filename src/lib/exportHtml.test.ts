import { describe, expect, it } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { exportFileName, htmlDocument, noteHtml } from './exportHtml';

describe('htmlDocument', () => {
  const html = htmlDocument('Trip plan', '<h1>Trip plan</h1><p>Body</p>');

  it('is a complete page that opens by itself', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<title>Trip plan</title>');
    expect(html).toContain('<style>');
    expect(html.endsWith('\n')).toBe(true);
  });

  it('puts the rendered note in the body, as it is', () => {
    expect(html).toContain('<main>\n<h1>Trip plan</h1><p>Body</p>\n</main>');
  });

  it('escapes the title, which is text and not markup', () => {
    const page = htmlDocument('<script>alert(1)</script> & "q"', '<p>x</p>');

    expect(page).toContain(
      '<title>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;</title>'
    );
    expect(page).not.toContain('<title><script>');
  });

  it('has a light and a dark look', () => {
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('color-scheme: light dark');
  });
});

describe('exportFileName', () => {
  it('uses the title', () => {
    expect(exportFileName('Trip plan')).toBe('Trip plan.html');
  });

  it('drops the characters a file name cannot have', () => {
    expect(exportFileName('Plan: 2026/10 "draft"?')).toBe('Plan 202610 draft.html');
  });

  it('collapses spaces and trims the ends', () => {
    expect(exportFileName('  a   b  ')).toBe('a b.html');
  });

  it('falls back to a generic name for an empty or unusable title', () => {
    expect(exportFileName('')).toBe('note.html');
    expect(exportFileName('///')).toBe('note.html');
  });

  it('keeps the name a reasonable length', () => {
    expect(exportFileName('x'.repeat(200))).toBe(`${'x'.repeat(80)}.html`);
  });
});

describe('noteHtml', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
      heading: {
        group: 'block',
        content: 'text*',
        attrs: { level: { default: 1 } },
        toDOM: (node) => [`h${node.attrs.level}`, 0],
      },
      frontmatter: {
        group: 'block',
        content: 'text*',
        toDOM: () => ['pre', { class: 'frontmatter' }, ['code', 0]],
      },
      text: { group: 'inline' },
      math: {
        group: 'inline',
        inline: true,
        atom: true,
        // What KaTeX draws: MathML, plus HTML that needs the KaTeX styles.
        toDOM: () => [
          'span',
          { class: 'katex' },
          ['span', { class: 'katex-mathml' }, 'x2'],
          ['span', { class: 'katex-html' }, 'x 2'],
        ],
      },
    },
    marks: { strong: { toDOM: () => ['strong', 0] } },
  });
  const html = (...blocks: ReturnType<Schema['node']>[]) =>
    noteHtml({ state: { schema, doc: schema.node('doc', null, blocks) } } as never);
  const paragraph = (...inline: ReturnType<Schema['text']>[]) =>
    schema.node('paragraph', null, inline);

  it('renders the document the way its schema draws each node', () => {
    expect(
      html(
        schema.node('heading', { level: 2 }, [schema.text('Title')]),
        paragraph(
          schema.text('a '),
          schema.text('bold', [schema.marks.strong.create()]),
          schema.text(' word & <tag>')
        )
      )
    ).toBe('<h2>Title</h2><p>a <strong>bold</strong> word &amp; &lt;tag&gt;</p>');
  });

  it('leaves the front matter out of the page', () => {
    expect(
      html(
        schema.node('frontmatter', null, [schema.text('title: x')]),
        paragraph(schema.text('Body'))
      )
    ).toBe('<p>Body</p>');
  });

  it('keeps the MathML of a formula and drops the HTML that needs KaTeX styles', () => {
    expect(html(paragraph(schema.text('E '), schema.node('math')))).toBe(
      '<p>E <span class="katex"><span class="katex-mathml">x2</span></span></p>'
    );
  });

  it('drops the empty paragraphs the editor keeps', () => {
    expect(html(paragraph(schema.text('a')), schema.node('paragraph'))).toBe('<p>a</p>');
  });
});
