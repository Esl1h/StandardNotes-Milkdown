import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { type EditorKitDelegate } from '@standardnotes/editor-kit';
import Editor from './Editor';
import { FakeCrepe } from '../mocks/crepeMock';

// Capture the delegate the Editor hands to EditorKit and observe saves, so
// the tests drive the same calls the real EditorKit makes against it.
const kit = vi.hoisted(() => ({
  delegate: undefined as unknown as EditorKitDelegate,
  save: undefined as unknown as (text: string) => void,
}));

vi.mock('@standardnotes/editor-kit', () => ({
  default: class {
    constructor(delegate: EditorKitDelegate) {
      kit.delegate = delegate;
    }
    onEditorValueChanged = (text: string) => kit.save(text);
  },
}));

vi.mock('../lib/crepe', async () => {
  const { fakeCreateCrepe } = await import('../mocks/crepeMock');
  return { createCrepe: fakeCreateCrepe };
});
vi.mock('@milkdown/kit/utils', async () => {
  const { fakeReplaceAll } = await import('../mocks/crepeMock');
  return { replaceAll: fakeReplaceAll };
});

beforeEach(() => {
  FakeCrepe.reset();
});

/**
 * Notes are loaded exactly as EditorKit does it: setEditorRawText first, then
 * clearUndoHistory when the note changed. The visual editor only exists
 * once the first note has arrived.
 */
function setup() {
  const save = vi.fn();
  kit.save = save;
  render(<Editor />);
  const delegate = kit.delegate;
  return {
    save,
    loadNote: (text: string) =>
      act(() => {
        delegate.setEditorRawText(text);
        delegate.clearUndoHistory?.();
      }),
    syncRemote: (text: string) => act(() => delegate.setEditorRawText(text)),
    /** Simulates a user edit in the visual editor. */
    typeInCrepe: (markdown: string) =>
      act(() => {
        FakeCrepe.all[FakeCrepe.all.length - 1].emit(markdown);
      }),
  };
}

describe('Editor', () => {
  it('does not save when a note is loaded or synced', async () => {
    const { save, loadNote, syncRemote } = setup();

    loadNote('# One');
    await waitFor(() => expect(FakeCrepe.all[FakeCrepe.all.length - 1]?.created).toBe(true));

    syncRemote('# One changed');

    expect(save).not.toHaveBeenCalled();
  });

  it('saves exactly once per visual edit', async () => {
    const { save, loadNote, typeInCrepe } = setup();
    loadNote('# One');
    await waitFor(() => expect(FakeCrepe.all[FakeCrepe.all.length - 1]?.created).toBe(true));

    typeInCrepe('# One and more');

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('# One and more');
  });

  it('recreates the visual editor when the note changes', async () => {
    const { loadNote } = setup();
    loadNote('# One');
    await waitFor(() => expect(FakeCrepe.all[FakeCrepe.all.length - 1]?.created).toBe(true));

    loadNote('# Two');
    await waitFor(() => expect(FakeCrepe.all).toHaveLength(2));

    expect(FakeCrepe.all[0]?.destroyed).toBe(true);
    expect(FakeCrepe.all[1]?.getMarkdown()).toBe('# Two');
  });

  it('waits for the note before rendering anything editable', () => {
    setup();
    // The EditorKit delegate has not delivered a note yet.
    expect(document.querySelector('.mode-switcher')).toBeNull();
  });
});
