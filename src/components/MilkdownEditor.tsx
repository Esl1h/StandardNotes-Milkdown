import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type EditorView as ProseView } from '@milkdown/kit/prose/view';
import { type EditorView as SourceEditorView } from '@codemirror/view';
import { openSearchPanel } from '@codemirror/search';
import CrepeView from './CrepeView';
import { type Heading, showHeading } from '../lib/headings';
import Outline from './Outline';
import SourceView from './SourceView';
import ModeSwitcher, { ShowLayoutBarButton } from './ModeSwitcher';
import SearchBar from './SearchBar';
import {
  type Mode,
  type Orientation,
  type TopbarPosition,
  readMode,
  writeMode,
  readOrientation,
  writeOrientation,
  readTopbar,
  writeTopbar,
  readTopbarPosition,
  writeTopbarPosition,
  readLayoutBar,
  writeLayoutBar,
  readOutline,
  writeOutline,
  readFocusMode,
  writeFocusMode,
} from '../lib/layout';
import { formatCount, type TextStats } from '../lib/wordCount';
import { copyText } from '../lib/clipboard';
import { downloadFile } from '../lib/download';
import { exportFileName, htmlDocument, noteHtml } from '../lib/exportHtml';
import { type Store, createStore, useStore } from '../lib/store';

interface MilkdownEditorProps {
  rawText: string;
  /** Bumped on every note switch; recreates both editors. */
  historyEpoch: number;
  onTextChange: (text: string) => void;
  onInsertSample: () => void;
}

function WordCount({ store }: { store: Store<TextStats | null> }) {
  const stats = useStore(store);
  if (!stats) {
    return null;
  }
  const { label, title } = formatCount(stats.total, stats.selection);
  return (
    <span className="word-count" title={title}>
      {label}
    </span>
  );
}

/** A layout preference, written back on every change. */
function usePreference<T>(read: () => T, write: (value: T) => void) {
  const [value, setValue] = useState(read);
  const change = useCallback(
    (next: T) => {
      setValue(next);
      write(next);
    },
    [write]
  );
  return [value, change] as const;
}

/** Layout shell: the persistent mode/orientation/top bar preferences plus
 * the visual editor, the source pane, or both. Text flows through the host
 * `Editor` state: each pane receives rawText and reports user edits only.
 *
 * The panes and bars are memoized, so every callback handed to them is stable
 * and what changes while typing goes through a store. */
function MilkdownEditor(props: MilkdownEditorProps) {
  const { rawText, historyEpoch, onTextChange, onInsertSample } = props;
  const [mode, changeMode] = usePreference<Mode>(readMode, writeMode);
  const [orientation, changeOrientation] = usePreference<Orientation>(
    readOrientation,
    writeOrientation
  );
  const [topbar, changeTopbar] = usePreference<boolean>(readTopbar, writeTopbar);
  const [topbarPosition, changeTopbarPosition] = usePreference<TopbarPosition>(
    readTopbarPosition,
    writeTopbarPosition
  );
  const [layoutBar, changeLayoutBar] = usePreference<boolean>(readLayoutBar, writeLayoutBar);
  const [outline, changeOutline] = usePreference<boolean>(readOutline, writeOutline);
  const [focusMode, changeFocusMode] = usePreference<boolean>(readFocusMode, writeFocusMode);
  // Each pane counts its own text; the visual one wins whenever it is shown.
  const [stores] = useState(() => ({
    visualStats: createStore<TextStats | null>(null),
    sourceStats: createStore<TextStats | null>(null),
    headings: createStore<Heading[]>([]),
  }));
  const [proseView, setProseView] = useState<ProseView | null>(null);
  const [sourceView, setSourceView] = useState<SourceEditorView | null>(null);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  // A search belongs to one note's editor instance; a note switch closes it.
  const [searchEpoch, setSearchEpoch] = useState(historyEpoch);
  if (searchEpoch !== historyEpoch) {
    setSearchEpoch(historyEpoch);
    setSearchOpen(false);
  }
  const rawTextRef = useRef(rawText);
  useEffect(() => {
    rawTextRef.current = rawText;
  });

  // The outline needs the rendered document; source mode has none.
  const outlineShown = outline && mode !== 'source';

  const goToHeading = useCallback(
    (heading: Heading) => {
      if (!proseView) {
        return;
      }
      showHeading(proseView, heading);
      // On narrow screens the outline covers the note: get out of the way.
      if (window.matchMedia('(max-width: 899px)').matches) {
        changeOutline(false);
      }
    },
    [proseView, changeOutline]
  );

  /** The source pane has CodeMirror's own panel; the visual one the SearchBar. */
  const openSearch = useCallback(() => {
    if (mode === 'source') {
      if (sourceView) {
        openSearchPanel(sourceView);
      }
    } else {
      setSearchOpen(true);
    }
  }, [mode, sourceView]);

  /** Saves the rendered note as a page of its own, named after its title. */
  const exportHtml = useCallback(() => {
    if (!proseView) {
      return;
    }
    const title = stores.headings.get()[0]?.text ?? '';
    downloadFile(
      htmlDocument(title || 'Note', noteHtml(proseView)),
      exportFileName(title),
      'text/html'
    );
  }, [proseView, stores]);

  const copy = useCallback(() => copyText(rawTextRef.current), []);
  const hideLayoutBar = useCallback(() => changeLayoutBar(false), [changeLayoutBar]);

  const empty = rawText.trim() === '';
  const statsStore = mode === 'source' ? stores.sourceStats : stores.visualStats;
  const wordCount = useMemo(() => <WordCount store={statsStore} />, [statsStore]);
  // The counter lives in the formatting bar when there is one, else in the
  // icon bar; with both gone the interface stays clean.
  const countInTopBar = topbar && mode !== 'source';
  const trailing = useMemo(
    () => (
      <>
        {empty && (
          <button className="insert-sample" onClick={onInsertSample}>
            Add sample
          </button>
        )}
        {!countInTopBar && wordCount}
      </>
    ),
    [empty, onInsertSample, countInTopBar, wordCount]
  );

  const switcher = layoutBar ? (
    <ModeSwitcher
      mode={mode}
      orientation={orientation}
      topbar={topbar}
      topbarPosition={topbarPosition}
      onModeChange={changeMode}
      onOrientationChange={changeOrientation}
      onTopbarChange={changeTopbar}
      onTopbarPositionChange={changeTopbarPosition}
      onCopy={copy}
      onExportHtml={mode === 'source' ? null : exportHtml}
      onSearch={openSearch}
      outline={mode === 'source' ? null : outline}
      onOutlineChange={changeOutline}
      focusMode={focusMode}
      onFocusModeChange={changeFocusMode}
      onHide={hideLayoutBar}
      trailing={trailing}
    />
  ) : (
    <ShowLayoutBarButton onShow={() => changeLayoutBar(true)} />
  );
  // Visual mode with the formatting bar on top: that bar takes the top edge
  // and the icon bar floats right below it, over the note.
  const switcherBelowTopBar = layoutBar && topbar && topbarPosition === 'top' && mode === 'visual';

  return (
    <div
      className={`milkdown-app mode-${mode}${layoutBar ? '' : ' layout-bar-hidden'}${
        focusMode ? ' focus-mode' : ''
      }`}
    >
      {!switcherBelowTopBar && switcher}
      {searchOpen && mode !== 'source' && proseView && (
        <SearchBar view={proseView} onClose={() => setSearchOpen(false)} />
      )}
      <div
        className={`panes${mode === 'split' ? ` orientation-${orientation}` : ''}${
          outlineShown ? ' with-outline' : ''
        }`}
        data-topbar={topbarPosition}
        style={{ '--top-bar-height': `${topBarHeight}px` } as React.CSSProperties}
      >
        {switcherBelowTopBar && switcher}
        {mode !== 'visual' && (
          <div className="source-pane">
            <SourceView
              rawText={rawText}
              epoch={historyEpoch}
              onTextChange={onTextChange}
              onStats={stores.sourceStats.set}
              onView={setSourceView}
            />
          </div>
        )}
        {mode !== 'source' && (
          <div
            className="crepe-pane"
            onKeyDownCapture={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                setSearchOpen(true);
              }
            }}
          >
            <CrepeView
              rawText={rawText}
              epoch={historyEpoch}
              topbar={topbar}
              onTextChange={onTextChange}
              onStats={stores.visualStats.set}
              onView={setProseView}
              onHeadings={stores.headings.set}
              topBarAccessory={countInTopBar ? wordCount : null}
              onTopBarHeight={setTopBarHeight}
            />
          </div>
        )}
        {outlineShown && <Outline headings={stores.headings} onSelect={goToHeading} />}
      </div>
    </div>
  );
}

export default MilkdownEditor;
