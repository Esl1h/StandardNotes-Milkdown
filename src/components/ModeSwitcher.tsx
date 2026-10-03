import React from 'react';
import { type Mode, type Orientation, type TopbarPosition } from '../lib/layout';

interface ModeSwitcherProps {
  mode: Mode;
  orientation: Orientation;
  topbar: boolean;
  topbarPosition: TopbarPosition;
  onModeChange: (mode: Mode) => void;
  onOrientationChange: (orientation: Orientation) => void;
  onTopbarChange: (enabled: boolean) => void;
  onTopbarPositionChange: (position: TopbarPosition) => void;
  /** Extra content shown at the right end (the sample affordance). */
  trailing?: React.ReactNode;
}

/** Persistent layout controls: the editing mode, the split orientation and
 * the fixed Crepe top bar (on/off and top/bottom). */
function ModeSwitcher(props: ModeSwitcherProps) {
  const {
    mode,
    orientation,
    topbar,
    topbarPosition,
    onModeChange,
    onOrientationChange,
    onTopbarChange,
    onTopbarPositionChange,
    trailing,
  } = props;

  return (
    <div className="mode-switcher" role="toolbar" aria-label="Editor layout">
      {(['visual', 'split', 'source'] as const).map((candidate) => (
        <button
          key={candidate}
          className={mode === candidate ? 'mode-button active' : 'mode-button'}
          onClick={() => onModeChange(candidate)}
          title={
            candidate === 'visual'
              ? 'Edit visually, without the Markdown source'
              : candidate === 'split'
                ? 'Show the source next to the visual editor'
                : 'Edit the Markdown source only'
          }
        >
          {candidate}
        </button>
      ))}
      {mode === 'split' && (
        <button
          className="orientation-button"
          onClick={() =>
            onOrientationChange(orientation === 'vertical' ? 'horizontal' : 'vertical')
          }
          title={
            orientation === 'vertical'
              ? 'Panes side by side; click to stack them'
              : 'Panes stacked; click to put them side by side'
          }
        >
          {orientation === 'vertical' ? 'side by side' : 'stacked'}
        </button>
      )}
      <span className="spacer" />
      {trailing}
      <button
        className={topbar ? 'topbar-button active' : 'topbar-button'}
        onClick={() => onTopbarChange(!topbar)}
        title="Show or hide the fixed formatting bar"
      >
        bar
      </button>
      {topbar && (
        <button
          className="topbar-position-button"
          onClick={() => onTopbarPositionChange(topbarPosition === 'top' ? 'bottom' : 'top')}
          title={
            topbarPosition === 'top'
              ? 'The bar sticks to the top; click to move it to the bottom'
              : 'The bar sticks to the bottom; click to move it to the top'
          }
        >
          {topbarPosition}
        </button>
      )}
    </div>
  );
}

export default ModeSwitcher;
