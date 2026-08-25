import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { engagementEndsAt } from '@astera/rules';
import { useEngagement, useStrikeConsumed } from '../src/galaxy/Fleets.js';
import { resetClock } from '../src/lib/clock.js';

/**
 * THE TEN SECONDS THAT DECIDE WHETHER A BOMBARDMENT EXISTS. D44, D72.
 *
 * `useEngagement` mounts and unmounts the volley, so it is the one piece of the
 * disc a screenshot can never verify: a still frame of a squadron over a world
 * looks identical whether the window is open, closed, or stuck open.
 *
 * TIMERS ALONE ARE NOT ENOUGH, and that is what D72 fixed. A backgrounded tab has
 * its timeouts throttled to roughly one a minute and its animation frames stopped
 * altogether, so a phone in a pocket across a ten-second engagement comes back
 * holding whatever the flag was when it went away. For a raid that has since
 * resolved that is `true` — a squadron bombarding a world whose battle report the
 * player has already read.
 *
 * The clock is the authority; the timers only say when to look at it. These drive
 * that distinction directly: the system time is moved WITHOUT running any timer,
 * which is exactly what a throttled tab does.
 */
describe('the engagement window', () => {
  const NOW = new Date('2026-04-01T12:00:00.000Z').getTime();

  beforeEach(() => {
    resetClock(0);
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetClock(0);
  });

  /** A tab that was never backgrounded: the timers do the work. */
  it('opens on the arrival and closes when the battle is settled', () => {
    const arriveAt = NOW + 30_000;
    const { result } = renderHook(() => useEngagement(arriveAt));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(30_001);
    });
    expect(result.current, 'the volley never started').toBe(true);

    act(() => {
      vi.advanceTimersByTime(engagementEndsAt(arriveAt) - arriveAt);
    });
    expect(result.current, 'the volley never stopped').toBe(false);
  });

  /**
   * THE WEAPON IS THE EXPLOSION, SO THERE IS NOTHING LEFT TO DRAW. Owner
   * instruction, after watching a strike land: *"hedefe vardı, patlama gösterildi,
   * ama füze yok olmuyor, gezegenin üstünde 5-10 saniye öylece bekliyor."*
   *
   * Two payloads keep a Death Star on screen past its own detonation and both are
   * correct: the attacker's mission is only resolved on the worker's next tick, and
   * the finished mission is republished to the galaxy for the length of the effect
   * so a client that was elsewhere can still play it. What was missing was the rule
   * about what that means, and this is it.
   */
  describe('a strike that has landed', () => {
    it('takes the craft off the disc on the instant, and leaves it off', () => {
      const at = NOW + 20_000;
      const { result } = renderHook(() => useStrikeConsumed(at));
      expect(result.current).toBe(false);

      act(() => {
        vi.advanceTimersByTime(20_001);
      });
      expect(result.current, 'the weapon outlived its own explosion').toBe(true);

      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current).toBe(true);
    });

    it('is already spent when a client arrives after the strike', () => {
      const { result } = renderHook(() => useStrikeConsumed(NOW - 1_000));
      expect(result.current).toBe(true);
    });

    /** Nothing to be spent by: an ordinary craft has no strike instant at all. */
    it('leaves every other craft alone', () => {
      const { result } = renderHook(() => useStrikeConsumed(null));
      expect(result.current).toBe(false);
    });

    /**
     * A tab whose timers were throttled through the whole strike. The clock is the
     * authority; coming back to the front is when it gets read again.
     */
    it('catches up on a tab that was in the background for the strike', () => {
      const at = NOW + 20_000;
      const { result } = renderHook(() => useStrikeConsumed(at));
      expect(result.current).toBe(false);

      act(() => {
        // Time passes without a single timer firing, which is what a throttled tab
        // looks like from the inside.
        vi.setSystemTime(at + 5_000);
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current).toBe(true);
    });
  });

  it('is already open when it mounts inside the window', () => {
    const { result } = renderHook(() => useEngagement(NOW - 1_000));
    expect(result.current).toBe(true);
  });

  it('is closed when it mounts after the battle', () => {
    const { result } = renderHook(() => useEngagement(NOW - 60_000));
    expect(result.current).toBe(false);
  });

  it('never opens for a craft with no arrival at all', () => {
    const { result } = renderHook(() => useEngagement(null));
    expect(result.current).toBe(false);
  });

  /* ── the tab that was in a pocket ──────────────────────────── */

  /**
   * `setSystemTime` moves the clock WITHOUT firing a single timer, which is the
   * closest thing to a throttled tab a test can produce. Nothing but the
   * visibility event brings the flag back in step.
   */
  const sleepPast = (to: number): void => {
    act(() => {
      vi.setSystemTime(to);
      document.dispatchEvent(new Event('visibilitychange'));
    });
  };

  /**
   * MOUNTED INSIDE THE WINDOW, so the flag starts TRUE and something has to turn it
   * off. Starting before the arrival would pass on an accident — the flag is false
   * to begin with and no timer runs, so it stays false whether or not anything is
   * watching the clock.
   */
  it('closes a window the tab slept through, without a timer firing', () => {
    const arriveAt = NOW - 2_000;
    const { result } = renderHook(() => useEngagement(arriveAt));
    expect(result.current, 'the volley was not running to begin with').toBe(true);

    // Asleep across the settlement.
    sleepPast(engagementEndsAt(arriveAt) + 5_000);
    expect(result.current, 'woke up bombarding a world that had already resolved').toBe(false);
  });

  it('opens a window the tab slept into, without a timer firing', () => {
    const arriveAt = NOW + 30_000;
    const { result } = renderHook(() => useEngagement(arriveAt));

    // Asleep across the arrival, awake inside the ten seconds.
    sleepPast(arriveAt + 2_000);
    expect(result.current, 'woke up over the target with nothing happening').toBe(true);
  });

  /**
   * AND THE RE-ARMED TIMERS STILL CLOSE IT. Waking inside the window has to leave
   * a working end as well as a correct beginning — otherwise the volley runs for
   * ever on any device that was ever backgrounded.
   */
  it('still closes on its own after waking inside the window', () => {
    const arriveAt = NOW + 30_000;
    const { result } = renderHook(() => useEngagement(arriveAt));
    sleepPast(arriveAt + 2_000);
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(engagementEndsAt(arriveAt) - (arriveAt + 2_000) + 1);
    });
    expect(result.current, 'the volley never stopped after a wake').toBe(false);
  });

  /** A listener per mount that outlives it is a leak on the busiest list here. */
  it('stops listening when the craft leaves the disc', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useEngagement(NOW + 30_000));
    const added = add.mock.calls.filter(([kind]) => kind === 'visibilitychange').length;
    expect(added).toBe(1);

    unmount();
    const removed = remove.mock.calls.filter(([kind]) => kind === 'visibilitychange').length;
    expect(removed).toBe(1);
  });
});
