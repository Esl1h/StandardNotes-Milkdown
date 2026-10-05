import { afterEach, describe, expect, it } from 'vitest';
import {
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
  readOutline,
  writeOutline,
  readFocusMode,
  writeFocusMode,
  setPreferenceStore,
} from './layout';

afterEach(() => {
  setPreferenceStore(null);
  window.localStorage.clear();
});

describe('layout preferences', () => {
  it('round trips every preference through storage', () => {
    writeMode('split');
    expect(readMode()).toBe('split');
    writeOrientation('horizontal');
    expect(readOrientation()).toBe('horizontal');
    writeTopbar(false);
    expect(readTopbar()).toBe(false);
    writeTopbarPosition('bottom');
    expect(readTopbarPosition()).toBe('bottom');
    writeLayoutBar(false);
    expect(readLayoutBar()).toBe(false);
    expect(readOutline()).toBe(false);
    writeOutline(true);
    expect(readOutline()).toBe(true);
    expect(readFocusMode()).toBe(false);
    writeFocusMode(true);
    expect(readFocusMode()).toBe(true);
  });

  it('falls back to the defaults for unknown stored values', () => {
    window.localStorage.setItem('standardnotes-milkdown-mode', 'hex');
    window.localStorage.setItem('standardnotes-milkdown-orientation', 'diagonal');
    window.localStorage.setItem('standardnotes-milkdown-topbar', 'maybe');
    window.localStorage.setItem('standardnotes-milkdown-topbar-position', 'middle');
    window.localStorage.setItem('standardnotes-milkdown-layout-bar', 'gone');

    expect(readMode()).toBe('visual');
    expect(readOrientation()).toBe('vertical');
    expect(readTopbar()).toBe(true);
    expect(readTopbarPosition()).toBe('top');
    expect(readLayoutBar()).toBe(true);
  });

  it('prefers the component data store and writes to it', () => {
    const data: Record<string, string> = { 'topbar-position': 'bottom' };
    setPreferenceStore({ get: (key) => data[key], set: (key, value) => (data[key] = value) });
    window.localStorage.setItem('standardnotes-milkdown-topbar-position', 'top');

    expect(readTopbarPosition()).toBe('bottom');
    writeMode('source');
    expect(data.mode).toBe('source');
  });

  it('falls back to localStorage while the store is not ready', () => {
    setPreferenceStore({
      get: () => {
        throw new Error('The component has not been initialized.');
      },
      set: () => {
        throw new Error('The component has not been initialized.');
      },
    });

    writeOrientation('horizontal');
    expect(readOrientation()).toBe('horizontal');
  });
});
