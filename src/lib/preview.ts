const PREVIEW_LIMIT = 160;
/** How much of the note the preview looks at, after the images are gone. */
const SCAN_LIMIT = 2000;

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
    // The preview shows 160 characters: the later patterns would otherwise
    // rescan the whole note (the tag one is quadratic on many < without >).
    .slice(0, SCAN_LIMIT)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, '')
    .replace(/[*_~`]+/g, '')
    // An unclosed tag survives the tag strip; drop any < that could still
    // open one, but keep a plain "a < b". A < before another < goes too, or
    // "<<script" would leave "<script" behind. Last, so no later removal
    // (the ** of "<**script") can bring a letter next to a kept <.
    .replace(/<(?=[a-zA-Z/!?<])/g, '');
  return truncatePreview(text);
}

export { PREVIEW_LIMIT, markdownPreview, truncatePreview };
