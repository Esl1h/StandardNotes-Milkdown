/**
 * How long a save can come back from the app as a stale echo. The app can
 * take several seconds to hand a save back (a busy sync, a large note, a
 * slow phone), long enough for many newer saves to have happened.
 */
const ECHO_WINDOW_MS = 60000;

/**
 * Length plus a 32 bit FNV-1a hash of the text: enough to tell saves apart
 * without keeping a copy of the note for every save inside the window.
 */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}:${hash >>> 0}`;
}

/**
 * Remembers the saves of the open note made within the window, so a late
 * echo of an earlier one is not applied over text typed after it: that would
 * revert the typing and move the caret out of the editor. Any other text (a
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
    const cutoff = this.now() - ECHO_WINDOW_MS;
    const key = fingerprint(text);
    return this.saves.some((save) => save.at >= cutoff && save.key === key);
  }
}

export { EchoGuard, ECHO_WINDOW_MS };
