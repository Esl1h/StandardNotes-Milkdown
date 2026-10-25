import fc from 'fast-check';
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

  it('allows no script and only the page styles and images', () => {
    const policy = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('meta[http-equiv="Content-Security-Policy"]')
      ?.getAttribute('content');

    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain('img-src data: https: http:');
    expect(policy).toContain("style-src 'unsafe-inline'");
    expect(policy).not.toContain('script-src');
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

  it('cuts a long title at 80 characters without splitting one', () => {
    expect(exportFileName(`${'a'.repeat(79)}😀😀`)).toBe(`${'a'.repeat(79)}😀.html`);
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
        toDOM: (node) => [
          `h${node.attrs.level}`,
          { id: node.textContent.toLowerCase().replace(/\s+/g, '-') },
          0,
        ],
      },
      frontmatter: {
        group: 'block',
        content: 'text*',
        toDOM: () => ['pre', { class: 'frontmatter' }, ['code', 0]],
      },
      text: { group: 'inline' },
      image: {
        group: 'inline',
        inline: true,
        attrs: { src: {} },
        toDOM: (node) => ['img', { src: node.attrs.src }],
      },
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
    ).toBe('<h2 id="title">Title</h2><p>a <strong>bold</strong> word &amp; &lt;tag&gt;</p>');
  });

  it('empties image addresses an image does not load from', () => {
    const image = (src: string) => schema.node('image', { src });

    expect(
      html(
        schema.node('paragraph', null, [
          image('https://example.com/a.png'),
          image('data:image/png;base64,iVBORw=='),
          image('javascript:alert(1)'),
        ])
      )
    ).toBe(
      '<p><img src="https://example.com/a.png"><img src="data:image/png;base64,iVBORw=="><img src=""></p>'
    );
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

  it('turns a [TOC] line into links to the headings', () => {
    const page = html(
      schema.node('heading', { level: 1 }, [schema.text('One')]),
      paragraph(schema.text('[TOC]')),
      schema.node('heading', { level: 2 }, [schema.text('Two parts')])
    );

    expect(page).toBe(
      '<h1 id="one">One</h1>' +
        '<nav class="toc" aria-label="Table of contents"><ul>' +
        '<li class="toc-level-1"><a href="#one">One</a></li>' +
        '<li class="toc-level-2"><a href="#two-parts">Two parts</a></li>' +
        '</ul></nav>' +
        '<h2 id="two-parts">Two parts</h2>'
    );
  });

  it('leaves a [TOC] line without headings as an empty list', () => {
    expect(html(paragraph(schema.text('[TOC]')))).toBe(
      '<nav class="toc" aria-label="Table of contents"></nav>'
    );
  });

  it('drops the empty paragraphs the editor keeps', () => {
    expect(html(paragraph(schema.text('a')), schema.node('paragraph'))).toBe('<p>a</p>');
  });
});

// Any text, plus titles around the 80 character cut made of letters and
// emoji (two UTF-16 units each), where a cut by code unit splits one.
const titles = fc.oneof(
  fc.string({ unit: 'binary' }),
  fc
    .array(fc.constantFrom('a', ' ', '😀', '/', ':', '\u0001', '\t'), { maxLength: 120 })
    .map((chars) => chars.join('')),
  fc
    .array(fc.constantFrom('a', '😀'), { minLength: 41, maxLength: 90 })
    .map((chars) => chars.join(''))
);

describe('export properties', () => {
  it('turns any title into a safe file name', () => {
    fc.assert(
      fc.property(titles, (title) => {
        const file = exportFileName(title);
        expect(file.endsWith('.html')).toBe(true);
        const name = file.slice(0, -'.html'.length);
        expect(name.length).toBeGreaterThan(0);
        expect([...name].length).toBeLessThanOrEqual(80);
        expect(name).not.toMatch(/[\\/:*?"<>|]/);
        expect([...name].every((char) => char.charCodeAt(0) >= 32)).toBe(true);
        expect(name).toBe(name.trim());
        // No half of a surrogate pair left at the cut.
        expect(name).not.toMatch(
          /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/
        );
      })
    );
  });

  it('keeps the title from adding markup to the page', () => {
    fc.assert(
      fc.property(fc.string(), (title) => {
        const page = htmlDocument(title, '<p>x</p>');
        const inTitle = page.slice(page.indexOf('<title>') + 7, page.indexOf('</title>'));
        expect(inTitle).not.toMatch(/[<>"]/);
      })
    );
  });
});
