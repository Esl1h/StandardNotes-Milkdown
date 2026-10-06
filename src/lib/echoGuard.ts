/**
 * How long a save can come back from the app as a stale echo. The app can
 * take several seconds to hand a save back (a busy sync, a large note, a
 * slow phone), long enough for many newer saves to have happened.
 */
const ECHO_WINDOW_MS = 60000;

/**
 * Length plus a 32 bit FNV-1a hash of the text: enough to tell saves apart
 * without keeping a copy of the note for every save inside the window.
 * Line endings and the whitespace around the note are left out: the app may
 * hand a save back with its final newline trimmed or its endings changed,
 * and that is still the same save.
 */
function fingerprint(text: string): string {
  const same = text.replace(/\r\n?/g, '\n').trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < same.length; i++) {
    hash ^= same.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${same.length}:${hash >>> 0}`;
}

/**
 * Remembers the saves of the open note made within the window, so a late
 * echo of an earlier one is not applied over text typed after it: that would
 * revert the typing and move the caret out of the editor. The same goes for
 * a text that only spells the current one differently. Any other text (a
 * remote edit, another note) passes through.
 */
class EchoGuard {
  private noteId: string | undefined;
  private saves: Array<{ key: string; at: number }> = [];

  constructor(private now: () => number = Date.now) {}

  recordSave(text: string): void {
    const now = this.now();
    this.saves = [
      ...this.saves.filter((save) => save.at >= now - ECHO_WINDOW_MS),
      { key: fingerprint(text), at: now },
    ];
  }

  /** True when `text` streamed for `noteId` is an earlier save of ours, not `current`. */
  isStaleEcho(noteId: string | undefined, text: string, current: string): boolean {
    if (noteId !== this.noteId) {
      this.noteId = noteId;
      this.saves = [];
      return false;
    }
    if (text === current) {
      return false;
    }
    const key = fingerprint(text);
    if (key === fingerprint(current)) {
      return true;
    }
    const cutoff = this.now() - ECHO_WINDOW_MS;
    return this.saves.some((save) => save.at >= cutoff && save.key === key);
  }
}

/**
 * Where two texts first differ, as sizes and code points: enough to see what
 * the app changed in a save (a newline, a space) without printing the note.
 */
function describeDifference(before: string, after: string): string {
  let at = 0;
  while (at < before.length && at < after.length && before[at] === after[at]) {
    at++;
  }
  const codes = (text: string) =>
    Array.from(text.slice(at, at + 6), (char) => char.codePointAt(0)).join(',') || 'end';
  return `length ${before.length} -> ${after.length}, first difference at ${at}: [${codes(
    before
  )}] -> [${codes(after)}]`;
}

export { EchoGuard, ECHO_WINDOW_MS, describeDifference };
