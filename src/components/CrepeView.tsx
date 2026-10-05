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
import { countText, type TextStats } from '../lib/wordCount';
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
}

/** Counts the rendered text, so Markdown syntax never inflates the count. */
function statsOf(doc: Node, selection: Selection): TextStats {
  return {
    total: countText(doc.textBetween(0, doc.content.size, '\n', ' ')),
    selection: selection.empty
      ? null
      : countText(doc.textBetween(selection.from, selection.to, '\n', ' ')),
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
  useEffect(() => {
    onHeadingsRef.current = props.onHeadings;
    onTextChangeRef.current = onTextChange;
    onStatsRef.current = props.onStats;
    onViewRef.current = props.onView;
  });
  // The Crepe top bar element of the current instance, for the portal.
  const [topBarElement, setTopBarElement] = useState<HTMLElement | null>(null);

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
        const report = (doc: Node, selection: Selection) => {
          if (!disposed) {
            onStatsRef.current?.(statsOf(doc, selection));
          }
        };
        // selectionUpdated runs while the transaction is being applied, so
        // view.state is still the old one: count from what it hands over.
        listener.selectionUpdated((_ctx, selection) => report(selection.$from.doc, selection));
        listener.updated((ctx, doc) => {
          report(doc, ctx.get(editorViewCtx).state.selection);
          if (!disposed) {
            onHeadingsRef.current?.(headingsOf(doc));
          }
        });
      });
      crepeRef.current = crepe;
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
        onStatsRef.current?.(statsOf(view.state.doc, view.state.selection));
        onHeadingsRef.current?.(headingsOf(view.state.doc));
        onViewRef.current?.(view);
      });
      setTopBarElement(
        containerRef.current?.querySelector<HTMLElement>('.milkdown-top-bar') ?? null
      );
    };
    void boot();
    return () => {
      disposed = true;
      setTopBarElement(null);
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
      if (!crepe || crepe.getMarkdown() === rawTextRef.current) {
        return;
      }
      suppressRef.current = true;
      try {
        crepe.editor.action(replaceAll(rawTextRef.current, true));
        lastAppliedRef.current = crepe.getMarkdown();
      } finally {
        suppressRef.current = false;
      }
    }, APPLY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rawText, epoch]);

  return (
    <div className="crepe-container" ref={containerRef}>
      {topBarElement &&
        topBarAccessory &&
        createPortal(<div className="top-bar-accessory">{topBarAccessory}</div>, topBarElement)}
    </div>
  );
}

export default CrepeView;
