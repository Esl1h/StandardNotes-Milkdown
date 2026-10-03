import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('crepe exploded');
}

/** Renders the boundary around `children` with a fresh reset key. */
function setup(children: React.ReactNode, resetKey = 0) {
  const onRawTextChange = vi.fn();
  const view = render(
    <ErrorBoundary rawText={'# Note'} onRawTextChange={onRawTextChange} resetKey={resetKey}>
      {children}
    </ErrorBoundary>
  );
  return { onRawTextChange, view };
}

describe('ErrorBoundary', () => {
  it('shows the raw text fallback when the editor throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { view } = setup(<Boom />);

    expect(screen.getByRole('alert')).toHaveTextContent('crepe exploded');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('# Note');

    view.rerender(
      <ErrorBoundary rawText={'# Note'} onRawTextChange={vi.fn()} resetKey={0}>
        <Boom />
      </ErrorBoundary>
    );
  });

  it('saves edits made in the fallback textarea', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { onRawTextChange, view } = setup(<Boom />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Edited' } });

    expect(onRawTextChange).toHaveBeenCalledWith('# Edited');
    view.rerender(
      <ErrorBoundary rawText={'# Edited'} onRawTextChange={vi.fn()} resetKey={0}>
        <Boom />
      </ErrorBoundary>
    );
  });

  it('retries the editor when the note changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { view } = setup(<Boom />);

    view.rerender(
      <ErrorBoundary rawText={'# Note'} onRawTextChange={vi.fn()} resetKey={1}>
        <p>the editor is back</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('the editor is back')).toBeTruthy();
  });
});
