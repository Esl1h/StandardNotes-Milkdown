import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import CrepeView from './CrepeView';
import { FakeCrepe } from '../mocks/crepeMock';

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

afterEach(() => {
  vi.useRealTimers();
});

const lastCrepe = () => FakeCrepe.all[FakeCrepe.all.length - 1];

function setup(props: Partial<Parameters<typeof CrepeView>[0]> = {}) {
  const onTextChange = vi.fn();
  const view = render(
    <CrepeView rawText={'# Hello'} epoch={0} topbar={true} onTextChange={onTextChange} {...props} />
  );
  return { onTextChange, view };
}

/** Resolves the async boot so listeners are wired. */
async function booted() {
  await waitFor(() => expect(lastCrepe()?.created).toBe(true));
}

describe('CrepeView', () => {
  it('creates the editor with the top bar feature', async () => {
    setup();
    await booted();

    expect(lastCrepe().config.topBar).toBe(true);
  });

  it('reports user edits through onTextChange', async () => {
    const { onTextChange } = setup();
    await booted();

    lastCrepe().emit('# Hello world');

    expect(onTextChange).toHaveBeenCalledWith('# Hello world');
  });

  it('saves an edit that brings the text back to the loaded one', async () => {
    const { onTextChange } = setup();
    await booted();

    // Typing and then undoing returns the doc to the opened text; the
    // note already holds the typed version, so the undo must be saved.
    lastCrepe().emit('# Hello!');
    lastCrepe().emit('# Hello');

    expect(onTextChange).toHaveBeenCalledTimes(2);
    expect(onTextChange).toHaveBeenLastCalledWith('# Hello');
  });

  it('applies external text without saving it back', async () => {
    const { onTextChange, view } = setup();
    await booted();

    view.rerender(
      <CrepeView rawText={'# Changed'} epoch={0} topbar={true} onTextChange={onTextChange} />
    );

    // The replaceAll echo fired markdownUpdated; nothing may reach the host.
    await waitFor(() => expect(lastCrepe().getMarkdown()).toBe('# Changed'));
    expect(onTextChange).not.toHaveBeenCalled();
  });

  it('applies a burst of external text once, after a pause', async () => {
    const { onTextChange, view } = setup();
    await booted();
    vi.useFakeTimers();
    const rerender = (rawText: string) =>
      view.rerender(
        <CrepeView rawText={rawText} epoch={0} topbar={true} onTextChange={onTextChange} />
      );

    // Typing in the source pane changes the text on every key; reparsing the
    // visual document each time is what made the split mode slow.
    rerender('# H');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender('# He');
    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(lastCrepe().getMarkdown()).toBe('# Hello');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(lastCrepe().getMarkdown()).toBe('# He');
    expect(onTextChange).not.toHaveBeenCalled();
  });

  it('does not undo typing that follows an edit it just reported', async () => {
    const { onTextChange, view } = setup();
    await booted();
    vi.useFakeTimers();
    const rerender = (rawText: string) =>
      view.rerender(
        <CrepeView rawText={rawText} epoch={0} topbar={true} onTextChange={onTextChange} />
      );

    // The user types, the editor reports the text and the parent hands it back.
    lastCrepe().markdown = '# Hello w';
    lastCrepe().emit('# Hello w');
    rerender('# Hello w');
    // More keys land before the delayed apply of that text runs.
    lastCrepe().markdown = '# Hello wo';
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(lastCrepe().getMarkdown()).toBe('# Hello wo');
  });

  it('drops a pending apply when the view unmounts', async () => {
    const { onTextChange, view } = setup();
    await booted();
    vi.useFakeTimers();

    view.rerender(
      <CrepeView rawText={'# Changed'} epoch={0} topbar={true} onTextChange={onTextChange} />
    );
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(lastCrepe().getMarkdown()).toBe('# Hello');
  });

  it('does not reapply the opened text over typing right after a note switch', async () => {
    const { onTextChange, view } = setup();
    await booted();

    view.rerender(
      <CrepeView rawText={'# Other note'} epoch={1} topbar={true} onTextChange={onTextChange} />
    );
    await waitFor(() => expect(FakeCrepe.all).toHaveLength(2));
    await booted();
    // Typed before the 200 ms listener debounce has told the host.
    lastCrepe().markdown = '# Other note, typed';
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(lastCrepe().getMarkdown()).toBe('# Other note, typed');
  });

  it('recreates the editor when the note changes, destroying the old one', async () => {
    const { onTextChange, view } = setup();
    await booted();
    const first = lastCrepe();

    view.rerender(
      <CrepeView rawText={'# Other note'} epoch={1} topbar={true} onTextChange={onTextChange} />
    );
    await booted();

    expect(first?.destroyed).toBe(true);
    expect(FakeCrepe.all).toHaveLength(2);
    expect(lastCrepe().getMarkdown()).toBe('# Other note');
    expect(onTextChange).not.toHaveBeenCalled();
  });

  it('ignores late updates from the instance of the previous note', async () => {
    const { onTextChange, view } = setup();
    await booted();
    const first = lastCrepe();

    view.rerender(
      <CrepeView rawText={'# Other note'} epoch={1} topbar={true} onTextChange={onTextChange} />
    );
    await booted();
    // A debounced update still in flight while the old instance shuts down
    // would otherwise be saved into the newly opened note.
    first.emit('# Hello, late');

    expect(onTextChange).not.toHaveBeenCalled();
  });

  it('recreates the editor when the top bar is toggled', async () => {
    const { onTextChange, view } = setup();
    await booted();

    view.rerender(
      <CrepeView rawText={'# Hello'} epoch={0} topbar={false} onTextChange={onTextChange} />
    );
    await booted();

    expect(lastCrepe().config.topBar).toBe(false);
  });

  it('destroys the editor on unmount', async () => {
    const { view } = setup();
    await booted();

    view.unmount();

    expect(lastCrepe().destroyed).toBe(true);
  });
});
