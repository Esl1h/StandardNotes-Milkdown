import React, { useEffect, useRef, useState } from 'react';
import { ICONS } from './icons';
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
  /** Copies the note as Markdown; resolves to whether it worked. */
  onCopy: () => Promise<boolean>;
  /** Saves the rendered note as an HTML file; null with no rendered note. */
  onExportHtml: (() => void) | null;
  /** Whether the outline is open; null where it is not available. */
  outline: boolean | null;
  onOutlineChange: (open: boolean) => void;
  /** Whether the focus mode dims every block but the active one. */
  focusMode: boolean;
  onFocusModeChange: (enabled: boolean) => void;
  /** Opens find and replace for the current mode. */
  onSearch: () => void;
  /** Collapses the whole bar into the ShowLayoutBarButton. */
  onHide: () => void;
  /** Extra content shown at the right end (the sample affordance). */
  trailing?: React.ReactNode;
}

const MODE_TITLES: Record<Mode, string> = {
  visual: 'Edit visually, without the Markdown source',
  split: 'Show the source next to the visual editor',
  source: 'Edit the Markdown source only',
};

/** Below this width the secondary actions move into a menu. The iframe is
 * as wide as the note pane, so this also holds on a big screen with a
 * narrow pane. */
const NARROW = '(max-width: 520px)';

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(NARROW).matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.(NARROW);
    if (!query) {
      return undefined;
    }
    const update = (event: { matches: boolean }) => setNarrow(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}

interface MenuAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

/** The "..." button and the menu of the actions that do not fit the bar. */
function MoreMenu({ actions, copied }: { actions: MenuAction[]; copied: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // The focus goes back to the button: the menu is about to unmount, and a
  // keyboard user would otherwise lose their place.
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (open) {
      listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      // No preventDefault: the Tab goes on from the button.
      close();
      return;
    }
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const current = items.indexOf(document.activeElement as HTMLElement);
    const target = {
      ArrowDown: (current + 1) % items.length,
      ArrowUp: (current - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (target !== undefined) {
      event.preventDefault();
      items[target]?.focus();
    }
  };

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  return (
    <div className="more-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        className="more-button"
        onClick={() => setOpen(!open)}
        title={copied ? 'Copied' : 'More actions'}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {copied ? ICONS.copied : ICONS.more}
      </button>
      {open && (
        <div className="more-menu-list" role="menu" ref={listRef} onKeyDown={onMenuKeyDown}>
          {actions.map((action) => (
            <button
              key={action.key}
              role="menuitem"
              onClick={() => {
                action.onSelect();
                setOpen(false);
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
    onCopy,
    onExportHtml,
    onSearch,
    outline,
    onOutlineChange,
    focusMode,
    onFocusModeChange,
    onHide,
    trailing,
  } = props;

  const narrow = useNarrow();
  // The check shows on whichever button copied: the inline one or the menu's.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = () => void onCopy().then(setCopied);
  // Prints this iframe only: the app's own print would capture its UI.
  const print = () => window.print();

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
      {mode !== 'source' && (
        <button
          className={focusMode ? 'focus-button active' : 'focus-button'}
          onClick={() => onFocusModeChange(!focusMode)}
          title={
            focusMode ? 'Turn the focus mode off' : 'Focus mode: dim all but the current block'
          }
          aria-label={focusMode ? 'Turn the focus mode off' : 'Focus mode'}
          aria-pressed={focusMode}
        >
          {ICONS.focus}
        </button>
      )}
      {outline !== null && (
        <button
          className={outline ? 'outline-button active' : 'outline-button'}
          onClick={() => onOutlineChange(!outline)}
          title={outline ? 'Hide the outline' : 'Show the outline'}
          aria-label={outline ? 'Hide the outline' : 'Show the outline'}
          aria-pressed={outline}
        >
          {ICONS.outline}
        </button>
      )}
      <button
        className="search-button"
        onClick={onSearch}
        title="Find and replace"
        aria-label="Find and replace"
      >
        {ICONS.search}
      </button>
      {narrow ? (
        <MoreMenu
          copied={copied}
          actions={[
            { key: 'copy', label: 'Copy as Markdown', icon: ICONS.copy, onSelect: copy },
            { key: 'print', label: 'Print', icon: ICONS.print, onSelect: print },
            ...(onExportHtml
              ? [
                  {
                    key: 'html',
                    label: 'Export as HTML',
                    icon: ICONS.download,
                    onSelect: onExportHtml,
                  },
                ]
              : []),
            {
              key: 'bar',
              label: topbar ? 'Hide the formatting bar' : 'Show the formatting bar',
              icon: ICONS.bar,
              onSelect: () => onTopbarChange(!topbar),
            },
            ...(topbar
              ? [
                  {
                    key: 'position',
                    label:
                      topbarPosition === 'top'
                        ? 'Move the bar to the bottom'
                        : 'Move the bar to the top',
                    icon: ICONS[topbarPosition === 'top' ? 'bottom' : 'top'],
                    onSelect: () =>
                      onTopbarPositionChange(topbarPosition === 'top' ? 'bottom' : 'top'),
                  },
                ]
              : []),
          ]}
        />
      ) : (
        <>
          <button
            className="copy-button"
            onClick={copy}
            title={copied ? 'Copied' : 'Copy the note as Markdown'}
            aria-label={copied ? 'Copied' : 'Copy the note as Markdown'}
          >
            {copied ? ICONS.copied : ICONS.copy}
          </button>
          <button
            className="print-button"
            onClick={print}
            title="Print the note"
            aria-label="Print the note"
          >
            {ICONS.print}
          </button>
          {onExportHtml && (
            <button
              className="export-html-button"
              onClick={onExportHtml}
              title="Export as HTML"
              aria-label="Export as HTML"
            >
              {ICONS.download}
            </button>
          )}
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
        </>
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
