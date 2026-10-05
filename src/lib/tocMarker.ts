const TOC_MARKER = /^\[toc\]$/i;

/** Whether `text` is nothing but the `[TOC]` marker of a table of contents. */
function isTocText(text: string): boolean {
  return TOC_MARKER.test(text.trim());
}

export { isTocText };
