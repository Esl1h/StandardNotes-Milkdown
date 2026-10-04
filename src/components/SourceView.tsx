import React, { useEffect, useRef } from 'react';
import { Annotation, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { minimalSetup } from 'codemirror';
import { search, searchKeymap } from '@codemirror/search';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { countText, type TextStats } from '../lib/wordCount';

/** Marks transactions that sync the view with the prop, so they are not saved back. */
const External = Annotation.define<boolean>();

interface SourceViewProps {
  rawText: string;
  /** Bumped on every note switch; recreates the view and its undo history. */
  epoch: number;
  onTextChange: (text: string) => void;
  /** Receives the word count of the source and of the selection. */
  onStats?: (stats: TextStats) => void;
  /** Receives the CodeMirror view once created, and null when it goes. */
  onView?: (view: EditorView | null) => void;
}

function statsOf(state: EditorState): TextStats {
  const { main } = state.selection;
  return {
    total: countText(state.doc.toString()),
    selection: main.empty ? null : countText(state.sliceDoc(main.from, main.to)),
  };
}

const sourceTheme = () =>
  EditorView.theme({
    '&': {
      backgroundColor: 'var(--sn-stylekit-contrast-background-color)',
      color: 'var(--sn-stylekit-contrast-foreground-color)',
      fontFamily: 'var(--sn-stylekit-monospace-font, monospace)',
      fontSize: 'var(--sn-stylekit-font-size-editor)',
      height: '100%',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-line': { padding: '0 10px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--sn-stylekit-info-color-translucent)',
    },
  });

/** The single change turning `from` into `to`, trimmed to what differs, so
 * the cursor and scroll position outside the edit survive the sync. */
function changedRange(from: string, to: string) {
  let start = 0;
  const max = Math.min(from.length, to.length);
  while (start < max && from[start] === to[start]) {
    start++;
  }
  let end = 0;
  while (end < max - start && from[from.length - 1 - end] === to[to.length - 1 - end]) {
    end++;
  }
  return { from: start, to: from.length - end, insert: to.slice(start, to.length - end) };
}

/** The Markdown source pane, a slim CodeMirror with the same sync contract
 * the visual editor follows: external text is applied without saving back. */
function SourceView(props: SourceViewProps) {
  const { rawText, epoch, onTextChange } = props;
  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onTextChangeRef = useRef(onTextChange);
  const onStatsRef = useRef(props.onStats);
  const onViewRef = useRef(props.onView);
  useEffect(() => {
    onTextChangeRef.current = onTextChange;
    onStatsRef.current = props.onStats;
    onViewRef.current = props.onView;
  });

  // Wire the view once per note (epoch); rawText at mount time seeds the doc.
  const buildState = (doc: string) =>
    EditorState.create({
      doc,
      extensions: [
        minimalSetup,
        markdown({ base: markdownLanguage }),
        EditorView.lineWrapping,
        sourceTheme(),
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            !update.transactions.some((transaction) => transaction.annotation(External))
          ) {
            onTextChangeRef.current(update.state.doc.toString());
          }
          if (update.docChanged || update.selectionSet) {
            onStatsRef.current?.(statsOf(update.state));
          }
        }),
        search({ top: true }),
        keymap.of([...searchKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      ],
    });

  useEffect(() => {
    const view = new EditorView({
      parent: containerRef.current as HTMLElement,
      state: buildState(rawText),
    });
    viewRef.current = view;
    onStatsRef.current?.(statsOf(view.state));
    onViewRef.current?.(view);
    return () => {
      onViewRef.current?.(null);
      view.destroy();
      viewRef.current = null;
    };
    // Rebuilt once per epoch; later text changes arrive through rawText.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch]);

  // Keep the source identical to the prop (remote sync, visual pane edits).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === rawText) {
      return;
    }
    view.dispatch({
      changes: changedRange(current, rawText),
      // Not the user's edit: neither saved back nor undone from here.
      annotations: [External.of(true), Transaction.addToHistory.of(false)],
    });
  }, [rawText]);

  return <div className="source-container" ref={containerRef} />;
}

export default SourceView;
