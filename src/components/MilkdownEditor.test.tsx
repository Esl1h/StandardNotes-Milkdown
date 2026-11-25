import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import MilkdownEditor from './MilkdownEditor';
import CrepeView from './CrepeView';
import ModeSwitcher from './ModeSwitcher';
import Outline from './Outline';
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
    expect(FakeCrepe.all[1]?.config.topBar).toBe(false);
    expect(window.localStorage.getItem('standardnotes-milkdown-topbar')).toBe('false');

    fireEvent.click(view.getByTitle('Show or hide the fixed formatting bar'));
    await waitFor(() => expect(FakeCrepe.all).toHaveLength(3));

    fireEvent.click(view.getByTitle('The bar sticks to the top; click to move it to the bottom'));
    expect(document.querySelector('.panes')?.getAttribute('data-topbar')).toBe('bottom');
    expect(window.localStorage.getItem('standardnotes-milkdown-topbar-position')).toBe('bottom');
  });

  it('hides the layout bar behind a single button and persists it', () => {
    const { view } = setup();

    fireEvent.click(view.getByTitle('Hide the layout bar'));
    expect(document.querySelector('.mode-switcher')).toBeNull();
    expect(window.localStorage.getItem('standardnotes-milkdown-layout-bar')).toBe('false');

    fireEvent.click(view.getByTitle('Show the layout bar'));
    expect(document.querySelector('.mode-switcher')).toBeTruthy();
    expect(view.queryByTitle('Show the layout bar')).toBeNull();
    expect(window.localStorage.getItem('standardnotes-milkdown-layout-bar')).toBe('true');
  });

  it('shows the word count in the formatting bar, else in the icon bar', async () => {
    const { view } = setup('# Hello brave world');
    await waitFor(() =>
      expect(document.querySelector('.milkdown-top-bar .word-count')?.textContent).toBe(
        '3 words · 1 min'
      )
    );

    fireEvent.click(view.getByTitle('Show or hide the fixed formatting bar'));
    await waitFor(() =>
      expect(document.querySelector('.mode-switcher .word-count')?.textContent).toBe(
        '3 words · 1 min'
      )
    );

    fireEvent.click(view.getByTitle('Hide the layout bar'));
    expect(document.querySelector('.word-count')).toBeNull();
  });

  it('copies the note as Markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { view } = setup('# Hello *there*');

    fireEvent.click(view.getByTitle('Copy the note as Markdown'));

    expect(writeText).toHaveBeenCalledWith('# Hello *there*');
    await waitFor(() => expect(view.getByTitle('Copied')).toBeTruthy());
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

describe('renders while typing', () => {
  const renders = { shell: 0, switcher: 0, outline: 0, crepe: 0 };
  const restore: Array<() => void> = [];

  /** Counts the renders of a React.memo component, keeping its memo. */
  function count(component: unknown, name: keyof typeof renders) {
    const memo = component as { type: (props: object) => React.ReactNode };
    const inner = memo.type;
    expect(inner, `${name} is memoized`).toBeTypeOf('function');
    memo.type = (props) => {
      renders[name]++;
      return inner(props);
    };
    restore.push(() => {
      memo.type = inner;
    });
  }

  // Called as a function, the shell keeps its state in this component, so
  // each of its renders passes through here.
  function CountedShell(props: Parameters<typeof MilkdownEditor>[0]) {
    renders.shell++;
    return MilkdownEditor(props);
  }

  afterEach(() => {
    restore.splice(0).forEach((undo) => undo());
  });

  async function setupCounted() {
    window.localStorage.setItem('standardnotes-milkdown-outline', 'true');
    const props = {
      rawText: 'one two three',
      historyEpoch: 0,
      onTextChange: vi.fn(),
      onInsertSample: vi.fn(),
    };
    const view = render(<CountedShell {...props} />);
    await waitFor(() =>
      expect(document.querySelector('.word-count')?.textContent).toContain('3 words')
    );
    const reset = () => Object.assign(renders, { shell: 0, switcher: 0, outline: 0, crepe: 0 });
    return { view, props, reset };
  }

  it('renders the counter alone for a new word count', async () => {
    count(CrepeView, 'crepe');
    count(ModeSwitcher, 'switcher');
    count(Outline, 'outline');
    const { reset } = await setupCounted();
    reset();

    act(() => FakeCrepe.all[0]!.select(0, 7));

    expect(document.querySelector('.word-count')?.textContent).toBe('2 of 3 words');
    expect(renders).toEqual({ shell: 0, switcher: 0, outline: 0, crepe: 0 });
  });

  it('renders the outline alone for new headings', async () => {
    count(CrepeView, 'crepe');
    count(ModeSwitcher, 'switcher');
    count(Outline, 'outline');
    const { view, reset } = await setupCounted();
    reset();

    act(() => FakeCrepe.all[0]!.emitUpdated([{ level: 1, text: 'Title' }]));

    expect(view.getByRole('button', { name: 'Title' })).toBeTruthy();
    expect(renders).toEqual({ shell: 0, switcher: 0, outline: 1, crepe: 0 });
  });

  it('leaves the icon bar and the outline alone when a save changes the text', async () => {
    count(ModeSwitcher, 'switcher');
    count(Outline, 'outline');
    const { view, props, reset } = await setupCounted();
    reset();

    view.rerender(<CountedShell {...props} rawText={'one two three four'} />);

    expect(renders).toMatchObject({ shell: 1, switcher: 0, outline: 0 });
  });
});
