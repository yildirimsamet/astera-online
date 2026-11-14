import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DWELL_MS, ERROR_DWELL_MS, ToastProvider, useToast, useSilenceToasts } from '../src/ui/Toast.js';

const cues = vi.hoisted(() => ({ playSound: vi.fn(), haptic: vi.fn() }));
vi.mock('../src/lib/sound.js', async (importActual) => ({ ...await importActual<Record<string, unknown>>(), playSound: cues.playSound }));
vi.mock('../src/lib/haptics.js', async (importActual) => ({ ...await importActual<Record<string, unknown>>(), haptic: cues.haptic }));

function QuietAcademy() { useSilenceToasts(); return null; }

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

type Line = readonly [string, 'info' | 'warn' | 'error'];

function Speaker({ lines }: { lines: readonly Line[] }) {
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

const speak = (lines: readonly Line[]) => {
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
  it('discards existing and new Academy toasts, then restores normal notifications on exit', () => {
    const tree = (quiet: boolean) => <ToastProvider>{quiet && <QuietAcademy />}<Speaker lines={[["notice", 'info'], ['refusal', 'error']]} /></ToastProvider>;
    const view = render(tree(false));
    act(() => { screen.getByRole('button', { name: 'speak' }).click(); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    view.rerender(tree(true));
    act(() => { screen.getByRole('button', { name: 'speak' }).click(); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    view.rerender(tree(false));
    act(() => { vi.advanceTimersByTime(ERROR_DWELL_MS * 3); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => { screen.getByRole('button', { name: 'speak' }).click(); });
    expect(screen.getByRole('status')).toHaveTextContent('notice');
  });
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
      vi.advanceTimersByTime(DWELL_MS + 100);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('holds a refusal long enough to read and lets the player dismiss it', () => {
    speak([['Command Core must be raised first', 'error']]);
    act(() => {
      vi.advanceTimersByTime(DWELL_MS + 100);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Command Core must be raised first');
    expect(ERROR_DWELL_MS).toBeGreaterThan(DWELL_MS);
    act(() => {
      screen.getByRole('button', { name: 'Dismiss message' }).click();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  /**
   * A message arriving behind the current one must not restart its dwell, or a
   * steady trickle of news would pin the first line on screen forever.
   *
   * TIMED OFF `DWELL_MS` RATHER THAN OFF A LITERAL. The rule this protects is
   * "queuing does not extend the line already showing"; the pacing itself is a
   * tuned number, and a test that hard-codes it goes red on a change of taste
   * while saying nothing about the behaviour it exists to hold.
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
    // Most of the way through the first one's turn.
    act(() => {
      vi.advanceTimersByTime(DWELL_MS * 0.75);
    });
    // A second message, said with a quarter of the first still to run.
    act(() => {
      screen.getByRole('button', { name: 'speak' }).click();
    });
    act(() => {
      vi.advanceTimersByTime(DWELL_MS * 0.3);
    });
    // The first has had its turn and handed over — one line, not two.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});

/**
 * THE TOAST ON THE KIT (G1-d3, 2026-11-14). The answer every action gets is a kit toast: a
 * cut line that drops in under the top bar, its rim and mark in the colour of what it says —
 * news in the info blue, a "done, but" in the warning amber, a refusal in the enemy's red —
 * and the words in plain ink so any of them reads. A refusal is said aloud at once and felt in
 * the hand; a warning is felt and stays as long as a refusal, because both ask to be read.
 */
describe('the toast on the kit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cues.playSound.mockReset();
    cues.haptic.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['info', 'Ore home · +812 alloy', null],
    ['warn', '1,2K collected · 3K left in the pool', 'gk-banner--warn'],
    ['error', 'Command Core must be raised first', 'gk-banner--hostile'],
  ] as const)('wears the colour of what it says: %s', (tone, text, paint) => {
    speak([[text, tone]]);
    const toast = screen.getByRole('status').querySelector('.gk-banner');
    expect(toast).toHaveClass('gk-banner--toast');
    expect(toast).toHaveTextContent(text);
    for (const other of ['gk-banner--warn', 'gk-banner--hostile']) {
      if (other === paint) expect(toast).toHaveClass(other);
      else expect(toast).not.toHaveClass(other);
    }
  });

  it('says a refusal at once', () => {
    speak([['Command Core must be raised first', 'error']]);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByRole('alert')).toHaveTextContent('Command Core must be raised first');
  });

  it('says a warning when the reader is free: it is not a refusal', () => {
    speak([['1,2K collected · 3K left in the pool', 'warn']]);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['info', 'confirm', null],
    ['warn', 'confirm', 'warn'],
    ['error', 'alert', 'warn'],
  ] as const)('answers %s with its sound, and in the hand only when it asks to be read', (tone, cue, buzz) => {
    speak([['line', tone]]);
    expect(cues.playSound).toHaveBeenCalledWith(cue);
    if (buzz === null) expect(cues.haptic).not.toHaveBeenCalled();
    else expect(cues.haptic).toHaveBeenCalledWith(buzz);
  });

  it('holds a warning as long as a refusal', () => {
    speak([['1,2K collected · 3K left in the pool', 'warn']]);
    act(() => { vi.advanceTimersByTime(DWELL_MS + 100); });
    expect(screen.getByRole('status')).toHaveTextContent('3K left in the pool');
    act(() => { vi.advanceTimersByTime(ERROR_DWELL_MS - DWELL_MS); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('closes with the kit\u2019s round button', () => {
    speak([['only', 'info']]);
    const close = screen.getByRole('button', { name: 'Dismiss message' });
    expect(close).toHaveClass('gk-round', 'gk-round--small');
    act(() => {
      fireEvent.pointerDown(close, { button: 0 });
      fireEvent.pointerUp(close);
      fireEvent.click(close, { detail: 1 });
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lets the Academy keep its refusals and drops its warnings with its news', () => {
    function QuietButRefusing() { useSilenceToasts(true); return null; }
    render(<ToastProvider><QuietButRefusing /><Speaker lines={[['kept back', 'warn'], ['news', 'info'], ['refused', 'error']]} /></ToastProvider>);
    act(() => { screen.getByRole('button', { name: 'speak' }).click(); });
    expect(screen.getByRole('status')).toHaveTextContent('refused');
    act(() => { vi.advanceTimersByTime(ERROR_DWELL_MS + 100); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
