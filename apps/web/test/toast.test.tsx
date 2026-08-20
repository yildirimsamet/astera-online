import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../src/ui/Toast.js';

/**
 * ONE LINE AT A TIME, AND ALL OF THEM IN TURN. D45.
 *
 * This held a single message in state, so `setMessage` overwrote whatever was on
 * screen. Two things happening in the same second showed one of them — and since
 * a caller looping over a batch overwrites on every iteration, the survivor was
 * whichever was said LAST. `useLiveAlerts` walks a list that arrives newest-first,
 * so the one thing the player saw was reliably the OLDEST item in the batch: a
 * fleet coming home could silently eat the warning that a raid was inbound.
 */

function Speaker({ lines }: { lines: readonly [string, 'info' | 'error'][] }) {
  const say = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        for (const [text, tone] of lines) say(text, tone);
      }}
    >
      speak
    </button>
  );
}

const speak = (lines: readonly [string, 'info' | 'error'][]) => {
  render(
    <ToastProvider>
      <Speaker lines={lines} />
    </ToastProvider>,
  );
  act(() => {
    screen.getByRole('button', { name: 'speak' }).click();
  });
};

describe('the toast queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the first thing said, not the last', () => {
    speak([
      ['Incoming fleet · lands in 9m', 'error'],
      ['Ore home · +812 alloy', 'info'],
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Incoming fleet · lands in 9m');
  });

  it('shows the rest in turn rather than dropping them', () => {
    speak([
      ['first', 'info'],
      ['second', 'info'],
    ]);
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.getByRole('status')).toHaveTextContent('second');
  });

  it('goes away once the queue is empty', () => {
    speak([['only', 'info']]);
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  /**
   * A message arriving behind the current one must not restart its four seconds,
   * or a steady trickle of news would pin the first line on screen forever.
   */
  it('does not extend the line on screen when something queues behind it', () => {
    render(
      <ToastProvider>
        <Speaker lines={[['first', 'info']]} />
      </ToastProvider>,
    );
    act(() => {
      screen.getByRole('button', { name: 'speak' }).click();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // A second message, said with one second of the first still to run.
    act(() => {
      screen.getByRole('button', { name: 'speak' }).click();
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    // The first has had its four seconds and handed over.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
