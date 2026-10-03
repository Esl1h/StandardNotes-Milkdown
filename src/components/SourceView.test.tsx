import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import SourceView from './SourceView';

function setup(rawText: string) {
  const onTextChange = vi.fn();
  const view = render(<SourceView rawText={rawText} epoch={0} onTextChange={onTextChange} />);
  const getView = () =>
    EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!;
  return { getView, onTextChange, view };
}

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
});
