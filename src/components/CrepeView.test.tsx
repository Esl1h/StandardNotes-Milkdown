import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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

const lastCrepe = () => FakeCrepe.all[FakeCrepe.all.length - 1];

function setup(props: Partial<Parameters<typeof CrepeView>[0]> = {}) {
  const onTextChange = vi.fn();
  const view = render(
    <CrepeView
      rawText={'# Hello'}
      epoch={0}
      topbar={true}
      onTextChange={onTextChange}
      {...props}
    />
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
    expect(lastCrepe().getMarkdown()).toBe('# Changed');
    expect(onTextChange).not.toHaveBeenCalled();
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
