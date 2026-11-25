import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type CrepeBuilder } from '@milkdown/crepe/builder';
import { editorViewCtx } from '@milkdown/kit/core';
import { type Ctx } from '@milkdown/kit/ctx';
import { type Node } from '@milkdown/kit/prose/model';
import { type Selection } from '@milkdown/kit/prose/state';
import { type EditorView } from '@milkdown/kit/prose/view';
import { replaceAll } from '@milkdown/kit/utils';
import { createCrepe } from '../lib/crepe';
import { setNoteTextSource } from '../lib/image';
import { countText, type Count, type TextStats } from '../lib/wordCount';
import { headingsOf, type Heading } from '../lib/headings';
// The common styles one by one: the aggregate style.css also pulls the
// Latex (KaTeX, with its fonts), AI and diff styles of unused features.
import '@milkdown/crepe/theme/common/prosemirror.css';
import '@milkdown/crepe/theme/common/reset.css';
import '@milkdown/crepe/theme/common/block-edit.css';
import '@milkdown/crepe/theme/common/code-mirror.css';
import '@milkdown/crepe/theme/common/cursor.css';
import '@milkdown/crepe/theme/common/image-block.css';
import '@milkdown/crepe/theme/common/link-tooltip.css';
import '@milkdown/crepe/theme/common/list-item.css';
import '@milkdown/crepe/theme/common/placeholder.css';
import '@milkdown/crepe/theme/common/toolbar.css';
import '@milkdown/crepe/theme/common/table.css';
import '@milkdown/crepe/theme/common/top-bar.css';
import '@milkdown/crepe/theme/frame.css';

/** How long the visual pane waits for the text to settle before applying it. */
const APPLY_DELAY_MS = 150;

interface CrepeViewProps {
  rawText: string;
  /** Bumped on every note switch; recreates the Crepe instance. */
  epoch: number;
  /** Whether the fixed top bar feature is enabled. */
  topbar: boolean;
  onTextChange: (text: string) => void;
  /** Receives the word count of the document and of the selection. */
  onStats?: (stats: TextStats) => void;
  /** Receives the top level headings whenever the document changes. */
  onHeadings?: (headings: Heading[]) => void;
  /** Receives the ProseMirror view once created, and null when it goes. */
  onView?: (view: EditorView | null) => void;
  /** Rendered at the right end of the Crepe top bar, when it is on. */
  topBarAccessory?: React.ReactNode;
  /** Receives the Crepe top bar height whenever it changes (it wraps). */
  onTopBarHeight?: (height: number) => void;
}

/**
 * The word counts of one editor, over the rendered text, so Markdown syntax
 * never inflates them. Walking the whole note on every key made large ones
 * slow: `document` counts it and is for the pauses, `selection` counts the
 * selected text alone.
 */
function createStats(report: (stats: TextStats) => void) {
  let total: Count = { words: 0, characters: 0 };
  let selecting = false;
  const count = (doc: Node, from: number, to: number) =>
    countText(doc.textBetween(from, to, '\n', ' '));
  const publish = (doc: Node, selection: Selection) => {
    selecting = !selection.empty;
    report({ total, selection: selecting ? count(doc, selection.from, selection.to) : null });
  };
  return {
    document(doc: Node, selection: Selection) {
      total = count(doc, 0, doc.content.size);
      publish(doc, selection);
    },
    selection(doc: Node, selection: Selection) {
      // A cursor moving about changes neither count.
      if (!selection.empty || selecting) {
        publish(doc, selection);
      }
    },
  };
}

/**
 * Owns the Milkdown Crepe instance. The Crepe has no API to reset its undo
 * history, so switching notes (epoch) or toggling the top bar recreates the
 * instance; that also guarantees undo can never reach into another note.
 *
 * Text flows one way at a time:
 * - user edits fire `markdownUpdated` and bubble through onTextChange;
 * - external text (note switch, remote sync, source pane edit) is applied
 *   with `replaceAll` under a suppress flag, so the echo never saves.
 */
function CrepeView(props: CrepeViewProps) {
  const { rawText, epoch, topbar, onTextChange, topBarAccessory } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<CrepeBuilder | null>(null);
  const statsRef = useRef<ReturnType<typeof createStats> | null>(null);
  const suppressRef = useRef(false);
  // The serialized text the note holds, from a programmatic apply or the
  // last saved user edit; an identical markdownUpdated echo is dropped even
  // without the flag. Tracking user edits too keeps an undo back to the
  // opened text from being mistaken for an echo.
  const lastAppliedRef = useRef(rawText);
  const onTextChangeRef = useRef(onTextChange);
  const onStatsRef = useRef(props.onStats);
  const onViewRef = useRef(props.onView);
  const onHeadingsRef = useRef(props.onHeadings);
  const onTopBarHeightRef = useRef(props.onTopBarHeight);
  useEffect(() => {
    onHeadingsRef.current = props.onHeadings;
    onTopBarHeightRef.current = props.onTopBarHeight;
    onTextChangeRef.current = onTextChange;
    onStatsRef.current = props.onStats;
    onViewRef.current = props.onView;
  });
  // The Crepe top bar element of the current instance, for the portal.
  const [topBarElement, setTopBarElement] = useState<HTMLElement | null>(null);
  // An error boundary only catches errors thrown while rendering, not a
  // rejected boot promise: the failure is rethrown from render below.
  const [bootError, setBootError] = useState<unknown>(null);
  if (bootError) {
    throw bootError instanceof Error ? bootError : new Error(String(bootError));
  }

  const rawTextRef = useRef(rawText);
  useEffect(() => {
    rawTextRef.current = rawText;
  });

  // Recreate the instance on mount, note switch or top bar change.
  useEffect(() => {
    let disposed = false;
    // What the prop was when this boot started; only a change during the
    // async boot needs the catch-up replaceAll below.
    const bootText = rawTextRef.current;
    // Typing in a paragraph leaves the headings alone: telling the layout
    // shell each time would re-render it on every key.
    let headingsSignature: string | null = null;
    const reportHeadings = (doc: Node) => {
      const headings = headingsOf(doc);
      const signature = headings.map((h) => `${h.level}:${h.pos}:${h.text}`).join('\n');
      if (signature !== headingsSignature) {
        headingsSignature = signature;
        onHeadingsRef.current?.(headings);
      }
    };
    const stats = createStats((value) => {
      if (!disposed) {
        onStatsRef.current?.(value);
      }
    });
    statsRef.current = stats;
    const boot = async () => {
      const crepe = await createCrepe(
        containerRef.current as HTMLElement,
        rawTextRef.current,
        topbar
      );
      if (disposed) {
        return;
      }
      suppressRef.current = true;
      await crepe.create();
      if (disposed) {
        await crepe.destroy();
        return;
      }
      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          // The milkdown listener debounces by 200 ms, longer than the
          // suppress flag below holds, so the guard is the serialized
          // form of the last programmatically applied text.
          // `disposed`: destroy is async, and a late update from the
          // previous note's instance would be saved into the new note.
          if (disposed || suppressRef.current || markdown === lastAppliedRef.current) {
            return;
          }
          lastAppliedRef.current = markdown;
          onTextChangeRef.current(markdown);
        });
        // selectionUpdated runs while the transaction is being applied, so
        // view.state is still the old one: count from what it hands over.
        listener.selectionUpdated((_ctx, selection) =>
          stats.selection(selection.$from.doc, selection)
        );
        // Debounced by Milkdown (200 ms): once per pause, not per key.
        listener.updated((ctx, doc) => {
          if (!disposed) {
            const { state } = ctx.get(editorViewCtx);
            stats.document(state.doc, state.selection);
            reportHeadings(doc);
          }
        });
      });
      crepeRef.current = crepe;
      // Uploads count the images the note already holds.
      setNoteTextSource(() => crepe.getMarkdown());
      suppressRef.current = false;
      // The serializer normalizes (list markers, table padding), so the
      // reference for echoes is the serialized form, not the raw input.
      lastAppliedRef.current = crepe.getMarkdown();
      // The note changed while the (async) boot was in flight.
      if (rawTextRef.current !== bootText) {
        suppressRef.current = true;
        try {
          crepe.editor.action(replaceAll(rawTextRef.current, true));
          lastAppliedRef.current = crepe.getMarkdown();
        } finally {
          suppressRef.current = false;
        }
      }
      crepe.editor.action((ctx: Ctx) => {
        const view = ctx.get(editorViewCtx);
        stats.document(view.state.doc, view.state.selection);
        reportHeadings(view.state.doc);
        onViewRef.current?.(view);
      });
      setTopBarElement(
        containerRef.current?.querySelector<HTMLElement>('.milkdown-top-bar') ?? null
      );
    };
    boot().catch((error: unknown) => {
      if (!disposed) {
        setBootError(error);
      }
    });
    return () => {
      disposed = true;
      setTopBarElement(null);
      setNoteTextSource(null);
      onViewRef.current?.(null);
      const crepe = crepeRef.current;
      if (crepe) {
        crepeRef.current = null;
        void crepe.destroy();
      }
    };
  }, [epoch, topbar]);

  // External text on the same note: apply without saving it back. Typing in
  // the source pane changes it on every key, and each replaceAll reparses the
  // whole visual document (rebuilding code and Mermaid blocks), so a burst is
  // applied once, after a pause.
  const lastRawRef = useRef(rawText);
  const lastEpochRef = useRef(epoch);
  useEffect(() => {
    // On mount and on a note switch the instance boots from this text; applying
    // it again later would overwrite what was typed in between.
    const settled = epoch !== lastEpochRef.current || rawText === lastRawRef.current;
    lastEpochRef.current = epoch;
    lastRawRef.current = rawText;
    if (settled) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const crepe = crepeRef.current;
      // A text the editor reported itself comes back through the props. The
      // user may have typed more since, and that is newer than this text:
      // applying it would delete the new keys and drop the caret.
      if (
        !crepe ||
        rawTextRef.current === lastAppliedRef.current ||
        crepe.getMarkdown() === rawTextRef.current
      ) {
        return;
      }
      suppressRef.current = true;
      try {
        crepe.editor.action(replaceAll(rawTextRef.current, true));
        lastAppliedRef.current = crepe.getMarkdown();
      } finally {
        suppressRef.current = false;
      }
      // A flushed replace fires no `updated`: count the new text here.
      crepe.editor.action((ctx: Ctx) => {
        const { state } = ctx.get(editorViewCtx);
        statsRef.current?.document(state.doc, state.selection);
      });
    }, APPLY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rawText, epoch]);

  useEffect(() => {
    // jsdom has no ResizeObserver.
    if (!topBarElement || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    // A recreated instance removes the old bar, which then reports 0 and
    // could land after the new bar's height.
    const observer = new ResizeObserver(() => {
      if (topBarElement.isConnected) {
        onTopBarHeightRef.current?.(topBarElement.offsetHeight);
      }
    });
    observer.observe(topBarElement);
    return () => observer.disconnect();
  }, [topBarElement]);

  return (
    <div className="crepe-container" ref={containerRef}>
      {topBarElement &&
        topBarAccessory &&
        createPortal(<div className="top-bar-accessory">{topBarAccessory}</div>, topBarElement)}
    </div>
  );
}

export default React.memo(CrepeView);
