import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CrepeView from './CrepeView';
import { FakeCrepe } from '../mocks/crepeMock';

vi.mock('@milkdown/crepe', async () => {
  const { FakeCrepe: MockCrepe } = await import('../mocks/crepeMock');
  return { Crepe: MockCrepe, default: MockCrepe };
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

    expect(lastCrepe().config.features).toEqual({
      [FakeCrepe.Feature.TopBar]: true,
      [FakeCrepe.Feature.Latex]: false,
      [FakeCrepe.Feature.AI]: false,
    });
  });

  it('reports user edits through onTextChange', async () => {
    const { onTextChange } = setup();
    await booted();

    lastCrepe().emit('# Hello world');

    expect(onTextChange).toHaveBeenCalledWith('# Hello world');
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

  it('recreates the editor when the top bar is toggled', async () => {
    const { onTextChange, view } = setup();
    await booted();

    view.rerender(
      <CrepeView rawText={'# Hello'} epoch={0} topbar={false} onTextChange={onTextChange} />
    );
    await booted();

    expect(lastCrepe().config.features).toEqual({
      [FakeCrepe.Feature.TopBar]: false,
      [FakeCrepe.Feature.Latex]: false,
      [FakeCrepe.Feature.AI]: false,
    });
  });

  it('destroys the editor on unmount', async () => {
    const { view } = setup();
    await booted();

    view.unmount();

    expect(lastCrepe().destroyed).toBe(true);
  });
});
