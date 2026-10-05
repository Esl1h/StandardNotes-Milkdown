import { DOMSerializer } from '@milkdown/kit/prose/model';
import { type EditorView } from '@milkdown/kit/prose/view';

const STYLE = `
:root { color-scheme: light dark; }
body {
  margin: 0;
  font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: #1b1b1f;
  background: #fff;
}
main { max-width: 46rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.6em 0 0.5em; }
h1 { font-size: 2em; margin-top: 0.5em; }
img, svg, video { max-width: 100%; height: auto; }
a { color: #0b62d6; }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
code { background: rgba(127, 127, 127, 0.15); border-radius: 4px; padding: 0.1em 0.35em; }
pre { overflow: auto; padding: 0.9rem 1rem; border-radius: 6px; background: rgba(127, 127, 127, 0.12); }
pre code { background: none; padding: 0; }
blockquote { margin: 1em 0; padding: 0.1em 1rem; border-left: 4px solid rgba(127, 127, 127, 0.5); color: inherit; opacity: 0.9; }
table { border-collapse: collapse; display: block; overflow-x: auto; }
th, td { border: 1px solid rgba(127, 127, 127, 0.45); padding: 0.4rem 0.7rem; text-align: left; }
th { background: rgba(127, 127, 127, 0.12); }
hr { border: 0; border-top: 1px solid rgba(127, 127, 127, 0.45); margin: 2rem 0; }
li > p, th > p, td > p { margin: 0.25em 0; }
th > p, td > p { margin: 0; }
li[data-item-type="task"] { display: flex; align-items: baseline; list-style: none; }
li[data-item-type="task"]::before { content: "\\2610"; flex: none; margin: 0 0.5em 0 -1.4em; }
li[data-item-type="task"][data-checked="true"]::before { content: "\\2611"; }
@media (prefers-color-scheme: dark) {
  body { color: #e4e4e8; background: #17171a; }
  a { color: #7ab4ff; }
}
@media print { main { max-width: none; padding: 0; } }
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A complete page for the note rendered as `body`, readable on its own. */
function htmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

/** The title as a file name: no path or reserved characters, 80 at most. */
function exportFileName(title: string): string {
  const name = [...title]
    // Control characters are not allowed in a file name either.
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();
  return `${name || 'note'}.html`;
}

/** The note as the HTML its schema draws, taken from the rendered editor so
 * the Markdown is not parsed a second time. What is metadata or only works
 * with the editor's styles is left out: the front matter, the HTML half of
 * a KaTeX formula (its MathML stays, and browsers draw that themselves) and
 * the empty paragraphs the editor keeps. */
function noteHtml(view: Pick<EditorView, 'state'>): string {
  const serializer = DOMSerializer.fromSchema(view.state.schema);
  const holder = document.createElement('div');
  holder.appendChild(serializer.serializeFragment(view.state.doc.content));
  holder.querySelectorAll('pre.frontmatter, .katex-html, p:empty').forEach((node) => node.remove());
  return holder.innerHTML;
}

export { exportFileName, htmlDocument, noteHtml };
