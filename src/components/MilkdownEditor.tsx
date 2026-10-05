import React, { useState } from 'react';
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
} from '../lib/layout';
import { formatCount, type TextStats } from '../lib/wordCount';
import { copyText } from '../lib/clipboard';
import { downloadFile } from '../lib/download';
import { exportFileName, htmlDocument, noteHtml } from '../lib/exportHtml';

interface MilkdownEditorProps {
  rawText: string;
  /** Bumped on every note switch; recreates both editors. */
  historyEpoch: number;
  onTextChange: (text: string) => void;
  onInsertSample: () => void;
}

function WordCount({ stats }: { stats: TextStats }) {
  const { label, title } = formatCount(stats.total, stats.selection);
  return (
    <span className="word-count" title={title}>
      {label}
    </span>
  );
}

/** Layout shell: the persistent mode/orientation/top bar preferences plus
 * the visual editor, the source pane, or both. Text flows through the host
 * `Editor` state: each pane receives rawText and reports user edits only. */
function MilkdownEditor(props: MilkdownEditorProps) {
  const { rawText, historyEpoch, onTextChange, onInsertSample } = props;
  const [mode, setMode] = useState<Mode>(() => readMode());
  const [orientation, setOrientation] = useState<Orientation>(() => readOrientation());
  const [topbar, setTopbar] = useState<boolean>(() => readTopbar());
  const [topbarPosition, setTopbarPosition] = useState<TopbarPosition>(() => readTopbarPosition());
  const [layoutBar, setLayoutBar] = useState<boolean>(() => readLayoutBar());
  // Each pane counts its own text; the visual one wins whenever it is shown.
  const [visualStats, setVisualStats] = useState<TextStats | null>(null);
  const [sourceStats, setSourceStats] = useState<TextStats | null>(null);
  const [proseView, setProseView] = useState<ProseView | null>(null);
  const [sourceView, setSourceView] = useState<SourceEditorView | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [outline, setOutline] = useState<boolean>(() => readOutline());
  const [headings, setHeadings] = useState<Heading[]>([]);
  // A search belongs to one note's editor instance; a note switch closes it.
  const [searchEpoch, setSearchEpoch] = useState(historyEpoch);
  if (searchEpoch !== historyEpoch) {
    setSearchEpoch(historyEpoch);
    setSearchOpen(false);
  }

  const changeOutline = (next: boolean) => {
    setOutline(next);
    writeOutline(next);
  };

  // The outline needs the rendered document; source mode has none.
  const outlineShown = outline && mode !== 'source';

  const goToHeading = (heading: Heading) => {
    if (!proseView) {
      return;
    }
    showHeading(proseView, heading);
    // On narrow screens the outline covers the note: get out of the way.
    if (window.matchMedia('(max-width: 899px)').matches) {
      changeOutline(false);
    }
  };

  /** The source pane has CodeMirror's own panel; the visual one the SearchBar. */
  const openSearch = () => {
    if (mode === 'source') {
      if (sourceView) {
        openSearchPanel(sourceView);
      }
    } else {
      setSearchOpen(true);
    }
  };

  /** Saves the rendered note as a page of its own, named after its title. */
  const exportHtml = () => {
    if (!proseView) {
      return;
    }
    const title = headings[0]?.text ?? '';
    downloadFile(
      htmlDocument(title || 'Note', noteHtml(proseView)),
      exportFileName(title),
      'text/html'
    );
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    writeMode(next);
  };
  const changeOrientation = (next: Orientation) => {
    setOrientation(next);
    writeOrientation(next);
  };
  const changeTopbar = (next: boolean) => {
    setTopbar(next);
    writeTopbar(next);
  };
  const changeTopbarPosition = (next: TopbarPosition) => {
    setTopbarPosition(next);
    writeTopbarPosition(next);
  };

  const changeLayoutBar = (next: boolean) => {
    setLayoutBar(next);
    writeLayoutBar(next);
  };

  const empty = rawText.trim() === '';
  const stats = mode === 'source' ? sourceStats : visualStats;
  const wordCount = stats ? <WordCount stats={stats} /> : null;
  // The counter lives in the formatting bar when there is one, else in the
  // icon bar; with both gone the interface stays clean.
  const countInTopBar = topbar && mode !== 'source';

  return (
    <div className={`milkdown-app mode-${mode}${layoutBar ? '' : ' layout-bar-hidden'}`}>
      {layoutBar ? (
        <ModeSwitcher
          mode={mode}
          orientation={orientation}
          topbar={topbar}
          topbarPosition={topbarPosition}
          onModeChange={changeMode}
          onOrientationChange={changeOrientation}
          onTopbarChange={changeTopbar}
          onTopbarPositionChange={changeTopbarPosition}
          onCopy={() => copyText(rawText)}
          onExportHtml={mode === 'source' ? null : exportHtml}
          onSearch={openSearch}
          outline={mode === 'source' ? null : outline}
          onOutlineChange={changeOutline}
          onHide={() => changeLayoutBar(false)}
          trailing={
            <>
              {empty && (
                <button className="insert-sample" onClick={onInsertSample}>
                  Add sample
                </button>
              )}
              {!countInTopBar && wordCount}
            </>
          }
        />
      ) : (
        <ShowLayoutBarButton onShow={() => changeLayoutBar(true)} />
      )}
      {searchOpen && mode !== 'source' && proseView && (
        <SearchBar view={proseView} onClose={() => setSearchOpen(false)} />
      )}
      <div
        className={`panes${mode === 'split' ? ` orientation-${orientation}` : ''}${
          outlineShown ? ' with-outline' : ''
        }`}
        data-topbar={topbarPosition}
      >
        {mode !== 'visual' && (
          <div className="source-pane">
            <SourceView
              rawText={rawText}
              epoch={historyEpoch}
              onTextChange={onTextChange}
              onStats={setSourceStats}
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
              onStats={setVisualStats}
              onView={setProseView}
              onHeadings={setHeadings}
              topBarAccessory={countInTopBar ? wordCount : null}
            />
          </div>
        )}
        {outlineShown && <Outline headings={headings} onSelect={goToHeading} />}
      </div>
    </div>
  );
}

export default MilkdownEditor;
