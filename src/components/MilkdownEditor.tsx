import React, { useState } from 'react';
import CrepeView from './CrepeView';
import SourceView from './SourceView';
import ModeSwitcher, { ShowLayoutBarButton } from './ModeSwitcher';
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
} from '../lib/layout';
import { formatCount, type TextStats } from '../lib/wordCount';
import { copyText } from '../lib/clipboard';

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
  const [topbarPosition, setTopbarPosition] = useState<TopbarPosition>(() =>
    readTopbarPosition()
  );
  const [layoutBar, setLayoutBar] = useState<boolean>(() => readLayoutBar());
  // Each pane counts its own text; the visual one wins whenever it is shown.
  const [visualStats, setVisualStats] = useState<TextStats | null>(null);
  const [sourceStats, setSourceStats] = useState<TextStats | null>(null);

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
      <div
        className={`panes${mode === 'split' ? ` orientation-${orientation}` : ''}`}
        data-topbar={topbarPosition}
      >
        {mode !== 'visual' && (
          <div className="source-pane">
            <SourceView
              rawText={rawText}
              epoch={historyEpoch}
              onTextChange={onTextChange}
              onStats={setSourceStats}
            />
          </div>
        )}
        {mode !== 'source' && (
          <div className="crepe-pane">
            <CrepeView
              rawText={rawText}
              epoch={historyEpoch}
              topbar={topbar}
              onTextChange={onTextChange}
              onStats={setVisualStats}
              topBarAccessory={countInTopBar ? wordCount : null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default MilkdownEditor;
