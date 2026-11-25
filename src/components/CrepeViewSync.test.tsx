import { describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { TextSelection } from '@milkdown/kit/prose/state';
import { type EditorView } from '@milkdown/kit/prose/view';
import CrepeView from './CrepeView';

// The real editor, as in src/mocks/roundTrip.ts: the sync guards under test
// live in the listeners this component wires, which the mock cannot exercise.
// Each test drives real keypresses against the real 200 ms debounce of the
// Milkdown listener, so they take seconds.

async function boot(rawText: string, props: Partial<Parameters<typeof CrepeView>[0]> = {}) {
  const onTextChange = vi.fn();
  const onHeadings = vi.fn();
  let view: EditorView | null = null;
  const component = render(
    <CrepeView
      rawText={rawText}
      epoch={0}
      topbar={false}
      onTextChange={onTextChange}
      onHeadings={onHeadings}
      onView={(given) => {
        view = given;
      }}
      {...props}
    />
  );
  await waitFor(() => expect(view).not.toBeNull());
  return { component, onTextChange, onHeadings, view: () => view as EditorView };
}

describe('external text against a pending save', () => {
  it('is not overwritten by the typing that preceded it', async () => {
    const { component, onTextChange, view } = await boot('one\n');
    onTextChange.mockClear();

    // Typing queues a debounced update 200 ms away.
    act(() => {
      view().dispatch(view().state.tr.insertText('B'));
    });
    // Remote text lands inside that window and is applied after 150 ms.
    component.rerender(
      <CrepeView
        rawText={'remote\n'}
        epoch={0}
        topbar={false}
        onTextChange={onTextChange}
        onView={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 600));

    // The editor holds the remote text; nothing of the typing reached the host.
    expect(view().state.doc.textBetween(0, view().state.doc.content.size, '\n')).toBe('remote');
    expect(onTextChange).not.toHaveBeenCalled();
  }, 30000);

  it('still saves typing that comes after the remote text', async () => {
    const { component, onTextChange, view } = await boot('one\n');
    onTextChange.mockClear();

    component.rerender(
      <CrepeView
        rawText={'remote\n'}
        epoch={0}
        topbar={false}
        onTextChange={onTextChange}
        onView={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    onTextChange.mockClear();
    act(() => {
      // The user has the caret in the note, at the end of the text.
      const editor = view();
      const end = editor.state.doc.content.size - 1;
      editor.dispatch(
        editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(end)))
      );
      editor.dispatch(editor.state.tr.insertText('!'));
    });
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(view().state.doc.textBetween(0, view().state.doc.content.size, '\n')).toBe('remote!');
    expect(onTextChange).toHaveBeenCalledWith('remote!\n');
  }, 30000);

  it('refreshes the headings after the remote text is applied', async () => {
    const { component, onHeadings, view } = await boot('# Title\n');
    onHeadings.mockClear();

    component.rerender(
      <CrepeView
        rawText={'## Remote\n'}
        epoch={0}
        topbar={false}
        onTextChange={vi.fn()}
        onHeadings={onHeadings}
        onView={() => undefined}
      />
    );
    await waitFor(() =>
      expect(onHeadings).toHaveBeenLastCalledWith([{ level: 2, text: 'Remote', pos: 0 }])
    );
    expect(view().state.doc.firstChild?.type.name).toBe('heading');
  }, 30000);
});
