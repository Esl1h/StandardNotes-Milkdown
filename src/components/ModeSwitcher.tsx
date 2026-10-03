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
  /** Collapses the whole bar into the ShowLayoutBarButton. */
  onHide: () => void;
  /** Extra content shown at the right end (the sample affordance). */
  trailing?: React.ReactNode;
}

/** 24px stroke icons, drawn in the current text color. */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  visual: (
    <Icon>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  split: (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
    </Icon>
  ),
  source: (
    <Icon>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
    </Icon>
  ),
  vertical: (
    <Icon>
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <rect x="14" y="4" width="7" height="16" rx="1" />
    </Icon>
  ),
  horizontal: (
    <Icon>
      <rect x="4" y="3" width="16" height="7" rx="1" />
      <rect x="4" y="14" width="16" height="7" rx="1" />
    </Icon>
  ),
  bar: (
    <Icon>
      <path d="M4 7V5h16v2M12 5v14M9 19h6" />
    </Icon>
  ),
  top: (
    <Icon>
      <path d="M4 4h16M12 20V9M7 13l5-5 5 5" />
    </Icon>
  ),
  bottom: (
    <Icon>
      <path d="M4 20h16M12 4v11M7 11l5 5 5-5" />
    </Icon>
  ),
  hide: (
    <Icon>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  ),
  show: (
    <Icon>
      <path d="M15 6l-6 6 6 6" />
    </Icon>
  ),
};

const MODE_TITLES: Record<Mode, string> = {
  visual: 'Edit visually, without the Markdown source',
  split: 'Show the source next to the visual editor',
  source: 'Edit the Markdown source only',
};

/** Persistent layout controls: the editing mode, the split orientation and
 * the fixed Crepe top bar (on/off and top/bottom). Icon buttons; the title
 * doubles as tooltip and accessible name. */
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
    onHide,
    trailing,
  } = props;

  const orientationTitle =
    orientation === 'vertical'
      ? 'Panes side by side; click to stack them'
      : 'Panes stacked; click to put them side by side';
  const positionTitle =
    topbarPosition === 'top'
      ? 'The bar sticks to the top; click to move it to the bottom'
      : 'The bar sticks to the bottom; click to move it to the top';

  return (
    <div className="mode-switcher" role="toolbar" aria-label="Editor layout">
      {(['visual', 'split', 'source'] as const).map((candidate) => (
        <button
          key={candidate}
          className={mode === candidate ? 'mode-button active' : 'mode-button'}
          onClick={() => onModeChange(candidate)}
          title={MODE_TITLES[candidate]}
          aria-label={MODE_TITLES[candidate]}
          aria-pressed={mode === candidate}
        >
          {ICONS[candidate]}
        </button>
      ))}
      {mode === 'split' && (
        <button
          className="orientation-button"
          onClick={() =>
            onOrientationChange(orientation === 'vertical' ? 'horizontal' : 'vertical')
          }
          title={orientationTitle}
          aria-label={orientationTitle}
        >
          {ICONS[orientation]}
        </button>
      )}
      <span className="spacer" />
      {trailing}
      <button
        className={topbar ? 'topbar-button active' : 'topbar-button'}
        onClick={() => onTopbarChange(!topbar)}
        title="Show or hide the fixed formatting bar"
        aria-label="Show or hide the fixed formatting bar"
        aria-pressed={topbar}
      >
        {ICONS.bar}
      </button>
      {topbar && (
        <button
          className="topbar-position-button"
          onClick={() => onTopbarPositionChange(topbarPosition === 'top' ? 'bottom' : 'top')}
          title={positionTitle}
          aria-label={positionTitle}
        >
          {ICONS[topbarPosition]}
        </button>
      )}
      <button
        className="layout-bar-hide"
        onClick={onHide}
        title="Hide the layout bar"
        aria-label="Hide the layout bar"
      >
        {ICONS.hide}
      </button>
    </div>
  );
}

/** All that is left of the layout bar while it is hidden. */
function ShowLayoutBarButton({ onShow }: { onShow: () => void }) {
  return (
    <button
      className="layout-bar-show"
      onClick={onShow}
      title="Show the layout bar"
      aria-label="Show the layout bar"
    >
      {ICONS.show}
    </button>
  );
}

export { ShowLayoutBarButton };

export default ModeSwitcher;
