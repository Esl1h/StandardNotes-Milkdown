import { describe, expect, it } from 'vitest';
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
} from './layout';

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
});
