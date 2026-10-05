const PREVIEW_LIMIT = 160;

/** One line of at most PREVIEW_LIMIT characters; never empty, or the app
 * would fall back to showing the whole note text. */
function truncatePreview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat === '') {
    return ' ';
  }
  return flat.length > PREVIEW_LIMIT ? `${flat.slice(0, PREVIEW_LIMIT - 1)}…` : flat;
}

/** Plain text of a Markdown note for the notes list: no syntax, no images
 * (embedded ones are data URIs hundreds of KB long), no front matter. */
function markdownPreview(markdown: string): string {
  const text = markdown
    .replace(/^(---|\+\+\+)\n[\s\S]*?\n\1\n/, '')
    .replace(/^\s*(```|~~~).*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, '')
    .replace(/[*_~`]+/g, '');
  return truncatePreview(text);
}

export { PREVIEW_LIMIT, markdownPreview, truncatePreview };
