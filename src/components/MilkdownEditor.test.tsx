import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import MilkdownEditor from './MilkdownEditor';
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
  window.localStorage.clear();
});

function setup(rawText = '# Hello') {
  const onTextChange = vi.fn();
  const onInsertSample = vi.fn();
  const view = render(
    <MilkdownEditor
      rawText={rawText}
      historyEpoch={0}
      onTextChange={onTextChange}
      onInsertSample={onInsertSample}
    />
  );
  return { onTextChange, onInsertSample, view };
}

describe('MilkdownEditor', () => {
  it('shows the visual editor alone by default', async () => {
    setup();
    await waitFor(() => expect(FakeCrepe.all[FakeCrepe.all.length - 1]?.created).toBe(true));

    expect(document.querySelector('.crepe-container')).toBeTruthy();
    expect(document.querySelector('.cm-editor')).toBeNull();
  });

  it('switches panes with the mode buttons and persists the choice', () => {
    const { view } = setup();

    fireEvent.click(view.getByTitle('Edit the Markdown source only'));
    expect(document.querySelector('.cm-editor')).toBeTruthy();
    expect(document.querySelector('.crepe-container')).toBeNull();
    expect(window.localStorage.getItem('standardnotes-milkdown-mode')).toBe('source');

    fireEvent.click(view.getByTitle('Show the source next to the visual editor'));
    expect(document.querySelector('.cm-editor')).toBeTruthy();
    expect(document.querySelector('.crepe-container')).toBeTruthy();
    expect(window.localStorage.getItem('standardnotes-milkdown-mode')).toBe('split');

    fireEvent.click(view.getByTitle('Edit visually, without the Markdown source'));
    expect(document.querySelector('.cm-editor')).toBeNull();
    expect(document.querySelector('.crepe-container')).toBeTruthy();
  });

  it('toggles the split orientation and persists it', () => {
    const { view } = setup();
    fireEvent.click(view.getByTitle('Show the source next to the visual editor'));

    const panes = document.querySelector('.panes') as HTMLElement;
    expect(panes.className).toContain('orientation-vertical');
    // The container starts stacked per the default; toggle once.
    fireEvent.click(view.getByTitle('Panes side by side; click to stack them'));
    expect(document.querySelector('.panes')?.className).toContain('orientation-horizontal');
    expect(window.localStorage.getItem('standardnotes-milkdown-orientation')).toBe('horizontal');
  });

  it('toggles the top bar and its position, recreating the editor', async () => {
    const { view } = setup();
    await waitFor(() => expect(FakeCrepe.all[FakeCrepe.all.length - 1]?.created).toBe(true));

    fireEvent.click(view.getByTitle('Show or hide the fixed formatting bar'));
    await waitFor(() => expect(FakeCrepe.all).toHaveLength(2));
    expect(FakeCrepe.all[1]?.config.features).toEqual({
      [FakeCrepe.Feature.TopBar]: false,
      [FakeCrepe.Feature.Latex]: false,
      [FakeCrepe.Feature.AI]: false,
    });
    expect(window.localStorage.getItem('standardnotes-milkdown-topbar')).toBe('false');

    fireEvent.click(view.getByTitle('Show or hide the fixed formatting bar'));
    await waitFor(() => expect(FakeCrepe.all).toHaveLength(3));

    fireEvent.click(view.getByTitle('The bar sticks to the top; click to move it to the bottom'));
    expect(document.querySelector('.panes')?.getAttribute('data-topbar')).toBe('bottom');
    expect(window.localStorage.getItem('standardnotes-milkdown-topbar-position')).toBe('bottom');
  });

  it('offers the sample for an empty note only', () => {
    const { onInsertSample, view } = setup('');
    fireEvent.click(view.getByText('Add sample'));
    expect(onInsertSample).toHaveBeenCalledTimes(1);
    view.unmount();

    const filled = setup('# Not empty');
    expect(filled.view.queryByText('Add sample')).toBeNull();
    filled.view.unmount();
  });
});
