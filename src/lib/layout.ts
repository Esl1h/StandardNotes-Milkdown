/**
 * Persisted layout preferences. The primary store is the component data
 * Standard Notes keeps on the editor's component item (synced, and immune
 * to iframe sandboxes or per-session origins that make localStorage fail or
 * forget); localStorage is the fallback, e.g. before registration or outside
 * the app. Unknown stored values fall back to the defaults, so a stale value
 * from an older version never breaks the layout.
 */

type Mode = 'visual' | 'split' | 'source';
type Orientation = 'vertical' | 'horizontal';
type TopbarPosition = 'top' | 'bottom';

/** Key/value store backed by the Standard Notes component data. */
interface PreferenceStore {
  get: (key: string) => unknown;
  set: (key: string, value: string) => void;
}

const DEFAULT_MODE: Mode = 'visual';
const DEFAULT_ORIENTATION: Orientation = 'vertical';
const DEFAULT_TOPBAR = true;
const DEFAULT_TOPBAR_POSITION: TopbarPosition = 'top';
const DEFAULT_LAYOUT_BAR = true;

const STORAGE_PREFIX = 'standardnotes-milkdown';

let preferenceStore: PreferenceStore | null = null;

function setPreferenceStore(store: PreferenceStore | null): void {
  preferenceStore = store;
}

function readRaw(key: string): string | null {
  try {
    const synced = preferenceStore?.get(key);
    if (typeof synced === 'string') {
      return synced;
    }
  } catch {
    // Not registered yet; localStorage below.
  }
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}-${key}`);
  } catch {
    return null;
  }
}

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const stored = readRaw(key);
  return allowed.find((candidate) => candidate === stored) ?? fallback;
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  const stored = readRaw(key);
  if (stored === 'true') {
    return true;
  }
  if (stored === 'false') {
    return false;
  }
  return fallback;
}

function writeStored(key: string, value: string): void {
  try {
    preferenceStore?.set(key, value);
  } catch {
    // Not registered yet; localStorage below still keeps it.
  }
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}-${key}`, value);
  } catch {
    // Non persistable contexts keep the in-memory preference only.
  }
}

const MODES = ['visual', 'split', 'source'] as const;
const ORIENTATIONS = ['vertical', 'horizontal'] as const;
const TOPBAR_POSITIONS = ['top', 'bottom'] as const;

function readMode(): Mode {
  return readStored('mode', MODES, DEFAULT_MODE);
}

function writeMode(mode: Mode): void {
  writeStored('mode', mode);
}

function readOrientation(): Orientation {
  return readStored('orientation', ORIENTATIONS, DEFAULT_ORIENTATION);
}

function writeOrientation(orientation: Orientation): void {
  writeStored('orientation', orientation);
}

function readTopbar(): boolean {
  return readStoredBoolean('topbar', DEFAULT_TOPBAR);
}

function writeTopbar(enabled: boolean): void {
  writeStored('topbar', String(enabled));
}

function readTopbarPosition(): TopbarPosition {
  return readStored('topbar-position', TOPBAR_POSITIONS, DEFAULT_TOPBAR_POSITION);
}

function writeTopbarPosition(position: TopbarPosition): void {
  writeStored('topbar-position', position);
}

function readLayoutBar(): boolean {
  return readStoredBoolean('layout-bar', DEFAULT_LAYOUT_BAR);
}

function writeLayoutBar(visible: boolean): void {
  writeStored('layout-bar', String(visible));
}

export type { Mode, Orientation, TopbarPosition, PreferenceStore };
export {
  DEFAULT_MODE,
  DEFAULT_ORIENTATION,
  DEFAULT_TOPBAR,
  DEFAULT_TOPBAR_POSITION,
  DEFAULT_LAYOUT_BAR,
  setPreferenceStore,
  readMode,
  writeMode,
  readOrientation,
  writeOrientation,
  readTopbar,
  writeTopbar,
  readTopbarPosition,
  writeTopbarPosition,
  readLayoutBar,
  writeLayoutBar,
};
