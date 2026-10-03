/**
 * Persisted layout preferences, kept in localStorage (per browser). Storage
 * failures degrade to the defaults; unknown stored values fall back too, so
 * a stale value from an older version never breaks the layout.
 */

type Mode = 'visual' | 'split' | 'source';
type Orientation = 'vertical' | 'horizontal';
type TopbarPosition = 'top' | 'bottom';

const DEFAULT_MODE: Mode = 'visual';
const DEFAULT_ORIENTATION: Orientation = 'vertical';
const DEFAULT_TOPBAR = true;
const DEFAULT_TOPBAR_POSITION: TopbarPosition = 'top';

const STORAGE_PREFIX = 'standardnotes-milkdown';

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}-${key}`);
    const value = allowed.find((candidate) => candidate === stored);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}-${key}`);
    if (stored === 'true') {
      return true;
    }
    if (stored === 'false') {
      return false;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
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

export type { Mode, Orientation, TopbarPosition };
export {
  DEFAULT_MODE,
  DEFAULT_ORIENTATION,
  DEFAULT_TOPBAR,
  DEFAULT_TOPBAR_POSITION,
  readMode,
  writeMode,
  readOrientation,
  writeOrientation,
  readTopbar,
  writeTopbar,
  readTopbarPosition,
  writeTopbarPosition,
};
