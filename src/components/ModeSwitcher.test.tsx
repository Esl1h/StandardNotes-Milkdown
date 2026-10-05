import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ModeSwitcher from './ModeSwitcher';

type Listener = (event: { matches: boolean }) => void;

/** jsdom has no matchMedia: a narrow or wide viewport that can be flipped. */
function mockViewport(narrow: boolean) {
  const listeners = new Set<Listener>();
  window.matchMedia = vi.fn((query: string) => ({
    matches: narrow,
    media: query,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return {
    resize(next: boolean) {
      listeners.forEach((listener) => listener({ matches: next }));
    },
  };
}

function setup(overrides: Partial<React.ComponentProps<typeof ModeSwitcher>> = {}) {
  const props = {
    mode: 'visual' as const,
    orientation: 'vertical' as const,
    topbar: true,
    topbarPosition: 'top' as const,
    onModeChange: vi.fn(),
    onOrientationChange: vi.fn(),
    onTopbarChange: vi.fn(),
    onTopbarPositionChange: vi.fn(),
    onCopy: vi.fn().mockResolvedValue(true),
    outline: false,
    onOutlineChange: vi.fn(),
    onSearch: vi.fn(),
    onHide: vi.fn(),
    ...overrides,
  };
  render(<ModeSwitcher {...props} />);
  return props;
}

const more = () => screen.getByRole('button', { name: 'More actions' });
const openMore = () => fireEvent.click(more());

beforeEach(() => {
  window.print = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('on a wide bar', () => {
  beforeEach(() => {
    mockViewport(false);
  });

  it('shows every action inline and has no overflow menu', () => {
    setup();

    expect(screen.getByTitle('Copy the note as Markdown')).toBeInTheDocument();
    expect(screen.getByTitle('Print the note')).toBeInTheDocument();
    expect(screen.getByTitle('Show or hide the fixed formatting bar')).toBeInTheDocument();
    expect(
      screen.getByTitle('The bar sticks to the top; click to move it to the bottom')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });
});

describe('on a narrow bar', () => {
  beforeEach(() => {
    mockViewport(true);
  });

  it('moves the secondary actions into a menu and keeps the main ones', () => {
    setup();

    expect(screen.queryByTitle('Copy the note as Markdown')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Print the note')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Show or hide the fixed formatting bar')).not.toBeInTheDocument();
    expect(more()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTitle('Edit visually, without the Markdown source')).toBeInTheDocument();
    expect(screen.getByTitle('Show the outline')).toBeInTheDocument();
    expect(screen.getByTitle('Find and replace')).toBeInTheDocument();
    expect(screen.getByTitle('Hide the layout bar')).toBeInTheDocument();
  });

  it('opens a menu with the moved actions', () => {
    setup();

    openMore();

    expect(more()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Copy as Markdown',
      'Print',
      'Hide the formatting bar',
      'Move the bar to the bottom',
    ]);
  });

  it('prints from the menu and closes it', () => {
    setup();
    openMore();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Print' }));

    expect(window.print).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('copies from the menu and confirms on the menu button', async () => {
    const props = setup();
    openMore();

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy as Markdown' }));
    });

    expect(props.onCopy).toHaveBeenCalledTimes(1);
    expect(more()).toHaveAttribute('title', 'Copied');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('toggles and moves the formatting bar from the menu', () => {
    const props = setup();

    openMore();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide the formatting bar' }));
    expect(props.onTopbarChange).toHaveBeenCalledWith(false);

    openMore();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move the bar to the bottom' }));
    expect(props.onTopbarPositionChange).toHaveBeenCalledWith('bottom');
  });

  it('offers no bar position while the bar is off', () => {
    setup({ topbar: false });
    openMore();

    expect(screen.getByRole('menuitem', { name: 'Show the formatting bar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Move the bar/ })).not.toBeInTheDocument();
  });

  it('closes on Escape and on a click elsewhere', () => {
    setup();
    openMore();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

    openMore();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});

it('follows the viewport when it crosses the breakpoint', () => {
  const viewport = mockViewport(true);
  setup();
  expect(screen.queryByTitle('Print the note')).not.toBeInTheDocument();

  act(() => viewport.resize(false));

  expect(screen.getByTitle('Print the note')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
});
