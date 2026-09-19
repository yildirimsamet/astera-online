import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FpsReadout } from '../src/ui/FpsReadout.js';
import { galaxyFrames, setFpsMeterEnabled } from '../src/lib/fpsMeter.js';

/** The readout in the galaxy's corner: nothing while off, the drawn rate while on. */
describe('the fps readout', () => {
  afterEach(() => {
    setFpsMeterEnabled(false);
    vi.useRealTimers();
  });

  it('shows nothing while the setting is off', () => {
    const view = render(<FpsReadout />);
    expect(view.container).toBeEmptyDOMElement();
  });

  it('shows the frames drawn in the last second, refreshed twice a second', () => {
    vi.useFakeTimers();
    setFpsMeterEnabled(true);
    render(<FpsReadout />);
    const now = performance.now();
    for (let i = 0; i < 30; i += 1) galaxyFrames.frame(now - i * 30);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText(/^\d+ fps$/)).toBeInTheDocument();
  });
});
