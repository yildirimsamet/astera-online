import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingScreen } from '../src/shell/LoadingScreen.js';

describe('branded loading with truthful progress', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('updates measured progress without restarting the artwork or caption', () => {
    const { container, rerender } = render(<LoadingScreen caption="Loading assets" progress={0.2} />);
    const scene = container.querySelector('.opening-stage');
    rerender(<LoadingScreen caption="Loading assets" progress={0.8} />);
    expect(container.querySelector('.opening-stage')).toBe(scene);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  });

  it('does not introduce a cover when the game is already ready', () => {
    render(<LoadingScreen caption="Preparing scene" visible={false} />);
    expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument();
  });
  it('skips fleeting captions and shows the latest real phase after it settles', () => {
    vi.useFakeTimers();
    const { rerender } = render(<LoadingScreen caption="Connecting" />);
    rerender(<LoadingScreen caption="Loading assets" progress={0.5} />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    rerender(<LoadingScreen caption="Preparing scene" />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByText('Preparing scene')).toBeInTheDocument();
    expect(screen.queryByText('Loading assets')).not.toBeInTheDocument();
  });

  it('releases interaction immediately when ready and removes the fading cover shortly after', () => {
    vi.useFakeTimers();
    const { rerender } = render(<LoadingScreen caption="Preparing scene" />);
    rerender(<LoadingScreen caption="Preparing scene" visible={false} />);
    expect(screen.getByRole('status', { hidden: true })).toHaveAttribute('data-departing', 'true');
    expect(screen.getByRole('status', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
    act(() => { vi.advanceTimersByTime(180); });
    expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument();
  });

  it.each([NaN, Infinity, -Infinity])('never manufactures a percentage for %s', (progress) => {
    render(<LoadingScreen caption="Connecting" progress={progress} />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
  it('states the game name and return address as readable text immediately', () => {
    render(<LoadingScreen caption="Connecting to the galaxy" />);
    expect(screen.getByRole('heading', { name: 'Astera Online' })).toHaveTextContent(/Astera/i);
    expect(screen.getByText((_, node) => node?.tagName === 'P' && node.textContent === 'asteraonline.space')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it.each([[0, 0], [0.375, 38], [-1, 0], [2, 100]])('preserves measurable progress %s', (progress, pct) => {
    render(<LoadingScreen caption="Loading the galaxy" progress={progress} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(pct));
    expect(screen.getByText(`${String(pct)}%`)).toBeInTheDocument();
  });
});
