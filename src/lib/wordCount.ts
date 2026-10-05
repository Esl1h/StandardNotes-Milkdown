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

/** Minutes to read `words` at 200 words a minute; 0 for an empty note. */
function readingMinutes(words: number): number {
  return Math.ceil(words / 200);
}

function formatCount(total: Count, selection: Count | null): { label: string; title: string } {
  if (selection) {
    return {
      label: `${selection.words} of ${total.words} words`,
      title: `${selection.characters} of ${total.characters} characters`,
    };
  }
  const label = `${total.words} ${total.words === 1 ? 'word' : 'words'}`;
  const minutes = readingMinutes(total.words);
  if (minutes === 0) {
    return { label, title: `${total.characters} characters` };
  }
  return {
    label: `${label} · ${minutes} min`,
    title: `${total.characters} characters, about ${minutes} min to read`,
  };
}

export type { Count, TextStats };
export { countText, formatCount, readingMinutes };
