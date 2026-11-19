import React from 'react';

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
  copy: (
    <Icon>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </Icon>
  ),
  focus: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    </Icon>
  ),
  outline: (
    <Icon>
      <path d="M4 6h16M8 12h12M12 18h8" />
    </Icon>
  ),
  search: (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </Icon>
  ),
  print: (
    <Icon>
      <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
      <rect x="6" y="14" width="12" height="7" />
    </Icon>
  ),
  copied: (
    <Icon>
      <path d="M5 12l5 5L20 7" />
    </Icon>
  ),
  // A page with a down arrow: the arrow over a line was the same drawing as
  // the one that moves the formatting bar to the bottom.
  download: (
    <Icon>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 11v5M9.5 13.5l2.5 2.5 2.5-2.5" />
    </Icon>
  ),
  more: (
    <Icon>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
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

export { ICONS };
