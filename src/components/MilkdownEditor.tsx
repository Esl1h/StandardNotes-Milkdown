import React, { useState } from 'react';
import CrepeView from './CrepeView';
import SourceView from './SourceView';
import ModeSwitcher from './ModeSwitcher';
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
} from '../lib/layout';

interface MilkdownEditorProps {
  rawText: string;
  /** Bumped on every note switch; recreates both editors. */
  historyEpoch: number;
  onTextChange: (text: string) => void;
  onInsertSample: () => void;
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

  const empty = rawText.trim() === '';

  return (
    <div className={`milkdown-app mode-${mode}`}>
      <ModeSwitcher
        mode={mode}
        orientation={orientation}
        topbar={topbar}
        topbarPosition={topbarPosition}
        onModeChange={changeMode}
        onOrientationChange={changeOrientation}
        onTopbarChange={changeTopbar}
        onTopbarPositionChange={changeTopbarPosition}
        trailing={
          empty ? (
            <button className="insert-sample" onClick={onInsertSample}>
              Add sample
            </button>
          ) : undefined
        }
      />
      <div
        className={`panes${mode === 'split' ? ` orientation-${orientation}` : ''}`}
        data-topbar={topbarPosition}
      >
        {mode !== 'visual' && (
          <div className="source-pane">
            <SourceView rawText={rawText} epoch={historyEpoch} onTextChange={onTextChange} />
          </div>
        )}
        {mode !== 'source' && (
          <div className="crepe-pane">
            <CrepeView rawText={rawText} epoch={historyEpoch} topbar={topbar} onTextChange={onTextChange} />
          </div>
        )}
      </div>
    </div>
  );
}

export default MilkdownEditor;
