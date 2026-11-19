import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';
import SourceView from './SourceView';

function setup(rawText: string) {
  const onTextChange = vi.fn();
  const view = render(<SourceView rawText={rawText} epoch={0} onTextChange={onTextChange} />);
  const getView = () =>
    EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!;
  return { getView, onTextChange, view };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SourceView', () => {
  it('renders the raw text', () => {
    const { getView } = setup('# Hello');
    expect(getView().state.doc.toString()).toBe('# Hello');
  });

  it('applies external text without saving it back', () => {
    const { getView, onTextChange, view } = setup('# Hello');

    view.rerender(<SourceView rawText="# Changed" epoch={0} onTextChange={onTextChange} />);

    expect(getView().state.doc.toString()).toBe('# Changed');
    expect(onTextChange).not.toHaveBeenCalled();
  });

  it('keeps the cursor when external text changes elsewhere', () => {
    const { getView, onTextChange, view } = setup('# Hello\n\nfirst\n');
    act(() => {
      getView().dispatch({ selection: { anchor: 4 } });
    });

    // An edit in the visual pane, below the cursor of the source pane.
    view.rerender(
      <SourceView rawText={'# Hello\n\nfirst, edited\n'} epoch={0} onTextChange={onTextChange} />
    );

    expect(getView().state.doc.toString()).toBe('# Hello\n\nfirst, edited\n');
    expect(getView().state.selection.main.head).toBe(4);
  });

  it('does not undo external text, so it is neither reverted nor saved', () => {
    const { getView, onTextChange, view } = setup('a');

    view.rerender(<SourceView rawText="ab" epoch={0} onTextChange={onTextChange} />);
    let undone = true;
    act(() => {
      undone = undo(getView());
    });

    expect(undone).toBe(false);
    expect(getView().state.doc.toString()).toBe('ab');
    expect(onTextChange).not.toHaveBeenCalled();
  });

  it('saves exactly once per user edit', () => {
    const { getView, onTextChange } = setup('# Hello');

    act(() => {
      const view = getView();
      view.dispatch({
        changes: { from: view.state.doc.length, insert: ' world' },
        userEvent: 'input.type',
      });
    });

    expect(onTextChange).toHaveBeenCalledTimes(1);
    expect(onTextChange).toHaveBeenCalledWith('# Hello world');
  });

  it('recreates the view (and its history) when the note changes', () => {
    const { getView, onTextChange, view } = setup('# Hello');
    const first = getView();

    view.rerender(<SourceView rawText="# Other note" epoch={1} onTextChange={onTextChange} />);

    const second = getView();
    expect(second).not.toBe(first);
    expect(second.state.doc.toString()).toBe('# Other note');
    expect(onTextChange).not.toHaveBeenCalled();
  });

  it('counts a burst of typing once, after a pause', () => {
    vi.useFakeTimers();
    const onTextChange = vi.fn();
    const onStats = vi.fn();
    const view = render(
      <SourceView rawText="a" epoch={0} onTextChange={onTextChange} onStats={onStats} />
    );
    const editor = EditorView.findFromDOM(
      view.container.querySelector('.cm-editor') as HTMLElement
    )!;
    // The first report is immediate, so the counter is never empty.
    expect(onStats).toHaveBeenCalledTimes(1);

    act(() => {
      for (const insert of ['b', 'c', 'd']) {
        editor.dispatch({ changes: { from: editor.state.doc.length, insert } });
      }
    });
    expect(onStats).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onStats).toHaveBeenCalledTimes(2);
    expect(onStats).toHaveBeenLastCalledWith({
      total: { characters: 4, words: 1 },
      selection: null,
    });
  });

  it('hides a long data URI behind a placeholder without touching the text', () => {
    const uri = `data:image/png;base64,${'A'.repeat(5000)}`;
    const text = `before ![pic](${uri}) after\n`;
    const onTextChange = vi.fn();
    const view = render(<SourceView rawText={text} epoch={0} onTextChange={onTextChange} />);
    const editor = EditorView.findFromDOM(
      view.container.querySelector('.cm-editor') as HTMLElement
    )!;

    expect(view.container.querySelector('.cm-content')!.textContent).not.toContain('AAAAAAAAAA');
    expect(view.container.querySelector('.cm-image-data')?.textContent).toBe('[image data]');
    expect(editor.state.doc.toString()).toBe(text);
    expect(onTextChange).not.toHaveBeenCalled();
  });

  it('leaves short data URIs and plain URLs visible', () => {
    const text = '![dot](data:image/png;base64,AAAA) and https://example.com/a.png\n';
    const view = render(<SourceView rawText={text} epoch={0} onTextChange={vi.fn()} />);

    expect(view.container.querySelector('.cm-image-data')).toBeNull();
    expect(view.container.querySelector('.cm-content')!.textContent).toContain('data:image/png');
  });
});
