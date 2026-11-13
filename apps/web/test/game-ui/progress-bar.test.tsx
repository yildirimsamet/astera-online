import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from '../../src/game-ui/readouts.js';

/**
 * THE BAR. A thin bar only shows how far; a bar that carries words is thick enough to hold
 * them (owner 2026-11-12: "Depo dolu" did not fit on the thin one).
 */

describe('the progress bar', () => {
  it('fills to its share and names itself for a screen reader', () => {
    render(<ProgressBar value={6} max={24} label="İnşaat" />);
    const bar = screen.getByRole('progressbar', { name: 'İnşaat' });
    expect(bar).toHaveAttribute('aria-valuenow', '6');
    expect(bar.querySelector<HTMLElement>('.gk-bar__fill')?.style.width).toBe('25%');
  });

  it('stays thin when it carries no words', () => {
    const { container } = render(<ProgressBar value={1} max={2} />);
    expect(container.querySelector('.gk-bar')).not.toHaveClass('gk-bar--thick');
  });

  it('grows thick whenever it carries words, so they always fit', () => {
    const { container } = render(<ProgressBar value={1} max={1} tone="warn" text="Depo dolu" label="Depo" />);
    expect(container.querySelector('.gk-bar')).toHaveClass('gk-bar--thick');
    expect(screen.getByText('Depo dolu')).toBeVisible();
  });
});
