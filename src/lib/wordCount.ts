interface Count {
  words: number;
  characters: number;
}

/** What the counter shows: the document and, when there is one, the selection. */
interface TextStats {
  total: Count;
  selection: Count | null;
}

// A word is a whitespace separated token with at least one letter or digit,
// so Markdown syntax in the source pane (#, -, |, ---) does not count.
const WORD = /[\p{L}\p{N}]/u;

function countText(text: string): Count {
  const words = text.split(/\s+/).filter((token) => WORD.test(token)).length;
  return { words, characters: text.length };
}

function formatCount(total: Count, selection: Count | null): { label: string; title: string } {
  if (selection) {
    return {
      label: `${selection.words} of ${total.words} words`,
      title: `${selection.characters} of ${total.characters} characters`,
    };
  }
  return {
    label: `${total.words} ${total.words === 1 ? 'word' : 'words'}`,
    title: `${total.characters} characters`,
  };
}

export type { Count, TextStats };
export { countText, formatCount };
