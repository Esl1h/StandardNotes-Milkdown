import React, { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { replaceAll } from '@milkdown/kit/utils';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

interface CrepeViewProps {
  rawText: string;
  /** Bumped on every note switch; recreates the Crepe instance. */
  epoch: number;
  /** Whether the fixed top bar feature is enabled. */
  topbar: boolean;
  onTextChange: (text: string) => void;
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
  const { rawText, epoch, topbar, onTextChange } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const suppressRef = useRef(false);
  // The serialized text the note holds, from a programmatic apply or the
  // last saved user edit; an identical markdownUpdated echo is dropped even
  // without the flag. Tracking user edits too keeps an undo back to the
  // opened text from being mistaken for an echo.
  const lastAppliedRef = useRef(rawText);
  const onTextChangeRef = useRef(onTextChange);
  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  });

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
      const crepe = new Crepe({
        root: containerRef.current as HTMLElement,
        defaultValue: rawTextRef.current,
        // Everything except the top bar is on by default; Latex stays off
        // to keep the bundle small (it drags KaTeX in).
        features: {
          [Crepe.Feature.TopBar]: topbar,
          [Crepe.Feature.Latex]: false,
          [Crepe.Feature.AI]: false,
        },
      });
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
    };
    void boot();
    return () => {
      disposed = true;
      const crepe = crepeRef.current;
      if (crepe) {
        crepeRef.current = null;
        void crepe.destroy();
      }
    };
  }, [epoch, topbar]);

  // External text on the same note: apply without saving it back.
  useEffect(() => {
    const crepe = crepeRef.current;
    if (!crepe || crepe.getMarkdown() === rawText) {
      return;
    }
    suppressRef.current = true;
    try {
      crepe.editor.action(replaceAll(rawText, true));
      lastAppliedRef.current = crepe.getMarkdown();
    } finally {
      suppressRef.current = false;
    }
  }, [rawText]);

  return <div className="crepe-container" ref={containerRef} />;
}

export default CrepeView;
