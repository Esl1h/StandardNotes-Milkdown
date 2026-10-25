import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { ECHO_WINDOW_MS, EchoGuard } from './echoGuard';

describe('EchoGuard', () => {
  let t: number;
  let guard: EchoGuard;

  beforeEach(() => {
    t = 0;
    guard = new EchoGuard(() => t);
    // Pins the open note, as the first stream of a note does.
    guard.isStaleEcho('n1', 'a', 'a');
  });

  it('ignores an earlier save of the same note', () => {
    guard.recordSave('a');
    guard.recordSave('ab');
    expect(guard.isStaleEcho('n1', 'a', 'ab')).toBe(true);
  });

  it('accepts the current text', () => {
    guard.recordSave('a');
    guard.recordSave('ab');
    expect(guard.isStaleEcho('n1', 'ab', 'ab')).toBe(false);
  });

  it('accepts text that was never saved, like a remote edit', () => {
    guard.recordSave('a');
    guard.recordSave('ab');
    expect(guard.isStaleEcho('n1', 'xyz', 'ab')).toBe(false);
  });

  it('accepts any text after switching notes and forgets the saves', () => {
    guard.recordSave('a');
    guard.recordSave('ab');
    expect(guard.isStaleEcho('n2', 'a', 'ab')).toBe(false);
    expect(guard.isStaleEcho('n2', 'a', 'b')).toBe(false);
  });

  it('accepts an old save once the window has passed', () => {
    guard.recordSave('a');
    t = ECHO_WINDOW_MS + 1;
    expect(guard.isStaleEcho('n1', 'a', 'ab')).toBe(false);
  });

  it('ignores an echo that comes back many saves later', () => {
    const saves = Array.from({ length: 40 }, (_, index) => `text ${index}`);
    saves.forEach((text) => {
      guard.recordSave(text);
      t += 700;
    });
    expect(guard.isStaleEcho('n1', saves[0], saves[39])).toBe(true);
    expect(guard.isStaleEcho('n1', saves[20], saves[39])).toBe(true);
  });

  it('tells apart texts of the same length', () => {
    guard.recordSave('abc');
    expect(guard.isStaleEcho('n1', 'abd', 'abcd')).toBe(false);
    expect(guard.isStaleEcho('n1', 'abc', 'abcd')).toBe(true);
  });

  it('ignores the current text handed back with other whitespace', () => {
    const current = '# Title\n\nbody\n';
    expect(guard.isStaleEcho('n1', '# Title\n\nbody', current)).toBe(true);
    expect(guard.isStaleEcho('n1', `${current}\n`, current)).toBe(true);
    expect(guard.isStaleEcho('n1', '# Title\r\n\r\nbody\r\n', current)).toBe(true);
  });

  it('ignores an earlier save handed back with other whitespace', () => {
    guard.recordSave('first line\nsecond\n');
    expect(guard.isStaleEcho('n1', 'first line\r\nsecond', 'first line\nsecond!\n')).toBe(true);
  });

  it('still accepts a text that differs inside', () => {
    const current = '# Title\n\nbody\n';
    expect(guard.isStaleEcho('n1', '# Title\n\nbody changed\n', current)).toBe(false);
    expect(guard.isStaleEcho('n1', '# Title\n\nbo dy\n', current)).toBe(false);
  });

  it('forgets the saves that left the window', () => {
    guard.recordSave('a');
    t = ECHO_WINDOW_MS + 1;
    guard.recordSave('ab');
    expect(guard.isStaleEcho('n1', 'a', 'ab')).toBe(false);
    expect(guard.isStaleEcho('n1', 'ab', 'abc')).toBe(true);
  });
});

describe('EchoGuard properties', () => {
  const same = (text: string) => text.replace(/\r\n?/g, '\n').trim();

  it('never holds back the text already on screen', () => {
    fc.assert(
      fc.property(fc.array(fc.string()), fc.string(), (saves, current) => {
        const guard = new EchoGuard(() => 0);
        guard.isStaleEcho('n1', current, current);
        saves.forEach((text) => guard.recordSave(text));
        expect(guard.isStaleEcho('n1', current, current)).toBe(false);
      })
    );
  });

  it('knows a save of its own however the app spells it back', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (saved, current) => {
        fc.pre(same(saved) !== same(current));
        const guard = new EchoGuard(() => 0);
        guard.isStaleEcho('n1', current, current);
        guard.recordSave(saved);
        const echo = `${saved.replace(/\n/g, '\r\n')}\n`;
        expect(guard.isStaleEcho('n1', echo, current)).toBe(echo !== current);
      })
    );
  });

  it('lets through text from another note', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (saved, current) => {
        const guard = new EchoGuard(() => 0);
        guard.isStaleEcho('n1', current, current);
        guard.recordSave(saved);
        expect(guard.isStaleEcho('n2', saved, current)).toBe(false);
      })
    );
  });
});
