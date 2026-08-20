import { StrictMode, createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  GALAXY_ASSETS,
  LANDING_ASSETS,
  preloadAll,
  usePreload,
  type Loader,
} from '../src/lib/preload.js';

/**
 * THE WAIT AT THE FRONT DOOR. D23.
 *
 * The landing page is a 3D scene with a form on top of it, and it now holds the
 * door shut until its own sky has arrived. That is only an improvement if the wait
 * is honest and, above all, if it always ends: a preloader that can hang is a game
 * nobody can get into, which is strictly worse than a page that pops in late.
 *
 * So these are about the two failure modes rather than the happy path. A broken
 * asset must count as settled, and the deadline must open the door regardless of
 * what is still in the air.
 */

const settled = (): Loader => () => Promise.resolve();
const never = (): Loader => () => new Promise<void>(() => undefined);

describe('counting what has loaded', () => {
  it('reports after every asset, in a fraction of the real list', async () => {
    const seen: [number, number][] = [];
    await preloadAll(['a', 'b', 'c'], settled(), (done, total) => {
      seen.push([done, total]);
    });

    expect(seen).toHaveLength(3);
    expect(seen.at(-1)).toEqual([3, 3]);
    // Every report is a real position in a real list — never a made-up curve.
    for (const [done, total] of seen) {
      expect(total).toBe(3);
      expect(done).toBeGreaterThan(0);
      expect(done).toBeLessThanOrEqual(total);
    }
  });

  /**
   * ONE 404 MUST NEVER HOLD THE GAME SHUT.
   *
   * A missing model is a scene that draws one fewer object. A preloader that
   * treats it as unfinished is a black screen forever, and the player has no way
   * to tell the two apart or do anything about either.
   */
  it('counts an asset that failed to load as settled', async () => {
    const load: Loader = (url) =>
      url === 'broken' ? Promise.reject(new Error('404')) : Promise.resolve();

    const seen: number[] = [];
    await expect(
      preloadAll(['a', 'broken', 'c'], load, (done) => {
        seen.push(done);
      }),
    ).resolves.toBeUndefined();
    expect(seen.at(-1)).toBe(3);
  });

  it('finishes immediately when there is nothing to load', async () => {
    const load = vi.fn(settled());
    await preloadAll([], load);
    expect(load).not.toHaveBeenCalled();
  });

  /** The list is what the scene actually asks for; an empty one would be a no-op. */
  it('has a list to load in the first place', () => {
    expect(LANDING_ASSETS.length).toBeGreaterThan(5);
    expect(new Set(LANDING_ASSETS).size).toBe(LANDING_ASSETS.length);
  });

  /**
   * The disc's list is built from several sources and one file now serves two of
   * them — the drill is both the mining craft and the Drill satellite's body. A
   * duplicate would be fetched twice and counted twice, so the bar would reach the
   * end having actually loaded less than it claimed.
   */
  it('never asks for the same file twice', () => {
    expect(GALAXY_ASSETS.length).toBeGreaterThan(5);
    expect(new Set(GALAXY_ASSETS).size).toBe(GALAXY_ASSETS.length);
  });
});

describe('the hook the door waits on', () => {
  it('opens once everything has settled, at a full bar', async () => {
    const { result } = renderHook(() => usePreload(['a', 'b'], { load: settled() }));

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.progress).toBe(1);
  });

  /**
   * THE DEADLINE IS THE WHOLE SAFETY NET. Without it a stalled request — a phone
   * that has just lost signal, a proxy that never answers — is a player who cannot
   * reach the game at all.
   */
  it('opens on the deadline even with everything still in the air', async () => {
    const { result } = renderHook(() =>
      usePreload(['a', 'b'], { load: never(), deadlineMs: 10 }),
    );

    expect(result.current.ready).toBe(false);
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.progress).toBe(1);
  });

  it('is ready at once when the list is empty', () => {
    const { result } = renderHook(() => usePreload([], { load: settled() }));
    expect(result.current.ready).toBe(true);
    expect(result.current.progress).toBe(1);
  });

  /**
   * STRICTMODE MOUNTS EVERY EFFECT TWICE — run, clean up, run — and the first
   * draft of this hook skipped the second run on a ref. That left the first run's
   * cleanup as the last thing to happen: the deadline had been cleared and the
   * guard flipped, so the door never opened at all. It failed only in
   * development, which is the one place nobody sits watching a loading screen.
   *
   * Both halves are asserted, because the fix has to hold both: the fetch happens
   * once, and the deadline still arrives.
   */
  const strict = ({ children }: { children: ReactNode }) =>
    createElement(StrictMode, null, children);

  it('fetches each asset once across a double mount, and still opens', async () => {
    const load = vi.fn(settled());
    const { result } = renderHook(() => usePreload(['a', 'b', 'c'], { load }), {
      wrapper: strict,
    });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('still opens on the deadline after a double mount', async () => {
    const { result } = renderHook(
      () => usePreload(['a', 'b'], { load: never(), deadlineMs: 20 }),
      { wrapper: strict },
    );

    expect(result.current.ready).toBe(false);
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
  });

  /** And the bar never walks backwards when two passes report out of order. */
  it('reports progress monotonically', async () => {
    const held: (() => void)[] = [];
    const load: Loader = (url) =>
      url === 'slow'
        ? new Promise<void>((resolve) => {
            held.push(resolve);
          })
        : Promise.resolve();

    const { result } = renderHook(() => usePreload(['a', 'slow'], { load }));
    await waitFor(() => {
      expect(result.current.progress).toBeGreaterThan(0);
    });
    const half = result.current.progress;

    for (const release of held) release();
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.progress).toBeGreaterThanOrEqual(half);
  });
});
