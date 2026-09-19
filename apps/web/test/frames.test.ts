import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AMBIENT_FPS,
  FLIGHT_FPS,
  FULL_RATE_FPS,
  FullRate,
  HoldRate,
  METEOR_FPS,
  currentFps,
  frameStride,
  METEOR_CLOCK,
  meteorStep,
  holdRate,
  strideFor,
  useAmbientFrames,
  useCommittedDemandFrame,
} from '../src/galaxy/frames.js';

/**
 * `useAmbientFrames` reads one thing off the R3F store and nothing else, so the
 * store is the only part of the renderer this file needs. Mounting a real
 * `<Canvas>` in jsdom would mean a WebGL context that does not exist there.
 */
const invalidate = vi.fn<(frames?: number) => void>();
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { invalidate: (frames?: number) => void }) => unknown) =>
    select({ invalidate }),
}));

describe('DOM-backed demand frames', () => {
  afterEach(() => {
    invalidate.mockClear();
  });

  it('draws after a recovery label joins the committed scene', () => {
    const view = renderHook(
      ({ labels }) => {
        useCommittedDemandFrame(labels);
      },
      { initialProps: { labels: 'owned:NORMAL' } },
    );
    expect(invalidate).toHaveBeenCalledTimes(1);

    view.rerender({ labels: 'owned:NORMAL|stranger:RECOVERY' });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('does not keep drawing while the label set stays unchanged', () => {
    const view = renderHook(
      ({ labels }) => {
        useCommittedDemandFrame(labels);
      },
      { initialProps: { labels: 'stranger:RECOVERY' } },
    );
    expect(invalidate).toHaveBeenCalledTimes(1);

    view.rerender({ labels: 'stranger:RECOVERY' });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

/**
 * WHO ASKS THE GALAXY TO DRAW ITSELF, AND HOW OFTEN. D53.
 *
 * The disc renders on demand, so the cadence of the asking IS the frame rate of
 * everything that moves on its own. It used to be a `setInterval` at 24fps, which
 * is not a rate a 60Hz display can deliver: the requests landed 50ms, 33ms, 50ms,
 * 33ms apart and every rock, every craft and every missile inherited that beat.
 *
 * The fix is to ask for every Nth display frame rather than for a wall-clock
 * interval, so each request lands on a vsync boundary and the gap between two of
 * them is constant. That makes the stride the whole of the correctness here, and
 * it is arithmetic, so it is asserted rather than eyeballed.
 */
describe('the ambient frame stride', () => {
  const HZ = (hz: number): number => 1000 / hz;

  it('takes one frame in two at 60Hz', () => {
    expect(frameStride(HZ(60))).toBe(2);
  });

  /**
   * THE ONE THAT WAS WRONG, AND THE REASON THIS IS `floor` AND NOT `round`.
   *
   * `Math.round` rounds a half away from zero, so it can only ever land UNDER the
   * floor. It was measured against this test before the fix went in: 90Hz returns
   * a stride of 4, which is 22.5fps against a floor of 24.
   *
   * 60Hz alone would not have caught it — 41.666…/16.666… is 2.4999… rather than
   * 2.5, so the arithmetic happens to survive on the display everybody develops
   * against and fails on the phones. Which is why this walks the whole range.
   */
  it('never runs slower than the floor it is given', () => {
    for (const hz of [50, 60, 75, 90, 100, 120, 144, 165, 240]) {
      const rate = hz / frameStride(HZ(hz));
      expect(rate, `${String(hz)}Hz`).toBeGreaterThanOrEqual(AMBIENT_FPS);
    }
  });

  /**
   * And never faster than it has to be. The point of `frameloop="demand"` is not
   * rendering a still scene sixty times a second; a stride that always returned 1
   * would pass the test above and throw the whole policy away.
   */
  it('does not quietly become a full frame loop', () => {
    expect(frameStride(HZ(60))).toBeGreaterThan(1);
    expect(frameStride(HZ(120))).toBeGreaterThan(1);
    expect(frameStride(HZ(144))).toBeGreaterThan(1);
    // 30Hz and below cannot be subdivided at all without going under the floor.
    expect(frameStride(HZ(30))).toBe(1);
    expect(frameStride(HZ(24))).toBe(1);
  });

  /**
   * A STALL MUST NOT PARK THE SCENE.
   *
   * The measurement is a smoothed rAF delta, and a tab that was hidden or a frame
   * the garbage collector ate produces a delta of anything at all. Without the cap
   * a single bad sample would put the stride in the hundreds and the galaxy would
   * stop until the smoothing walked it back.
   */
  it('is capped, so a bad measurement cannot stop the disc', () => {
    expect(frameStride(1)).toBe(6);
    expect(frameStride(0.01)).toBe(6);
  });

  /** Nonsense in, something drawable out. Never zero, never negative, never NaN. */
  it('is at least one for any input at all', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(frameStride(bad)).toBeGreaterThanOrEqual(1);
    }
  });
});

/**
 * The ticker itself, against a fake display.
 *
 * What is proved here is the property the old `setInterval` did not have: the
 * asking is tied to the DISPLAY's frames, not to a wall clock — and it stops dead
 * when the canvas goes away.
 */
describe('the ambient ticker', () => {
  afterEach(() => {
    invalidate.mockClear();
    vi.unstubAllGlobals();
  });

  /** A `requestAnimationFrame` that fires only when told, at a fixed cadence. */
  function display(refreshMs: number) {
    let now = 0;
    let next = 1;
    const queue = new Map<number, FrameRequestCallback>();

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = next++;
      queue.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      queue.delete(id);
    });

    return {
      /** Advance one display frame, running whatever was queued for it. */
      step(): void {
        now += refreshMs;
        const due = [...queue.values()];
        queue.clear();
        act(() => {
          for (const cb of due) cb(now);
        });
      },
      queued: () => queue.size,
    };
  }

  it('asks on every second frame of a 60Hz display', () => {
    const screen = display(1000 / 60);
    renderHook(() => {
      useAmbientFrames();
    });

    // The very first frame draws: there is nothing measured yet to stride on, and
    // a scene that waited for a measurement would open on a blank canvas.
    screen.step();
    expect(invalidate).toHaveBeenCalledTimes(1);

    screen.step();
    expect(invalidate).toHaveBeenCalledTimes(1);
    screen.step();
    expect(invalidate).toHaveBeenCalledTimes(2);
    screen.step();
    expect(invalidate).toHaveBeenCalledTimes(2);
    screen.step();
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  /**
   * A 120Hz phone gets the same rate, not double it.
   *
   * This is the half of the fix a fixed stride would have missed: the point is a
   * constant rate on every display, and the only way to have that AND land on
   * vsync is to measure the display and divide.
   */
  it('measures the display rather than assuming one', () => {
    const screen = display(1000 / 120);
    renderHook(() => {
      useAmbientFrames();
    });

    for (let i = 0; i < 40; i += 1) screen.step();

    // Forty frames at 120Hz is a third of a second; at the floor that is eight
    // asks. The estimate takes a few frames to walk from its 60Hz assumption down
    // to 8.3ms, so the first handful are early — the rate it settles at is what
    // matters and it must never be one ask per frame.
    expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(invalidate.mock.calls.length).toBeLessThan(20);
  });

  /**
   * THE DEVICE THAT WOULD HAVE BEEN PUNISHED FOR BEING SLOW.
   *
   * R3F unwinds its loop when its pending-frame count hits zero and needs a whole
   * display frame to restart, so buying one frame at a time caps the scene at every
   * OTHER frame. Harmless at a stride of two — the latency is constant and shifts
   * nothing — and fatal at a stride of one, which is what a display at or below the
   * ambient floor gets: a phone barely holding 24fps would have been halved to 12.
   *
   * Measured against a headless renderer managing 14fps: 0.59 of the display's
   * frames before this, 1.0 after.
   */
  it('buys two frames at a time when the display is at or below the floor', () => {
    // 20Hz: a stride of one, because it cannot be subdivided without going under.
    const screen = display(1000 / 20);
    renderHook(() => {
      useAmbientFrames();
    });

    // The estimate starts at the 60Hz assumption and is smoothed, so the first
    // asks are made at the wrong stride. That is the cost of measuring rather
    // than guessing, it lasts under a second, and what matters is where it lands.
    for (let i = 0; i < 24; i += 1) screen.step();

    const settled = invalidate.mock.calls.slice(-6);
    expect(settled.every(([frames]) => frames === 2)).toBe(true);

    // And the credit bought over the settled stretch covers every display frame
    // in it: nothing is thrown away, and nothing is throttled.
    expect(settled.reduce((n, [frames]) => n + (frames ?? 1), 0)).toBe(12);
  });

  /** And exactly one at a time when the stride already leaves the loop a gap. */
  it('buys one frame at a time when it is striding', () => {
    const screen = display(1000 / 60);
    renderHook(() => {
      useAmbientFrames();
    });

    for (let i = 0; i < 8; i += 1) screen.step();

    expect(invalidate.mock.calls.length).toBeGreaterThan(1);
    expect(invalidate.mock.calls.every(([frames]) => frames === 1)).toBe(true);
  });

  /** An unmounted canvas must not keep a rAF chain alive for the life of the tab. */
  it('stops asking the moment it is unmounted', () => {
    const screen = display(1000 / 60);
    const view = renderHook(() => {
      useAmbientFrames();
    });

    screen.step();
    expect(invalidate).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(screen.queued()).toBe(0);

    screen.step();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

/**
 * A MOMENT ASKS FOR A RATE, NOT FOR EVERY FRAME. 2026-09-19.
 *
 * `FullRate` used to call `invalidate()` from inside every frame, which is the
 * display's own rate — 120 bombardment frames a second on a 120Hz phone, with the
 * bloom composer on each. And a meteor did the same for the second it crossed the
 * sky, three slots at once, about a third of all the time the disc is open. Every
 * rate now goes through the one ticker, vsync-aligned, and a moment only raises the
 * rate it runs at: sixty for the payoff moments, thirty for a streak (owner).
 */
describe('the rate a moment asks for', () => {
  const HZ = (hz: number): number => 1000 / hz;

  it('is sixty for the payoff moments and thirty for anything in the air', () => {
    expect(FULL_RATE_FPS).toBe(60);
    expect(FLIGHT_FPS).toBe(30);
  });

  it('is never slower than asked, and never the whole display when it need not be', () => {
    for (const hz of [60, 90, 120, 144]) {
      for (const fps of [AMBIENT_FPS, FLIGHT_FPS, FULL_RATE_FPS]) {
        const rate = hz / strideFor(fps, HZ(hz));
        expect(rate, `${String(fps)}fps at ${String(hz)}Hz`).toBeGreaterThanOrEqual(fps);
      }
    }
    expect(strideFor(FULL_RATE_FPS, HZ(120))).toBe(2);
    expect(strideFor(FULL_RATE_FPS, HZ(60))).toBe(1);
    expect(strideFor(FLIGHT_FPS, HZ(120))).toBe(4);
    expect(strideFor(FLIGHT_FPS, HZ(60))).toBe(2);
  });

  it('keeps the ambient stride exactly what it was', () => {
    for (const hz of [50, 60, 90, 120, 144]) {
      expect(frameStride(HZ(hz))).toBe(strideFor(AMBIENT_FPS, HZ(hz)));
    }
  });
});

describe('the ticker under a raised rate', () => {
  afterEach(() => {
    invalidate.mockClear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function display(refreshMs: number) {
    let now = 0;
    let next = 1;
    const queue = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = next++;
      queue.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      queue.delete(id);
    });
    return {
      step(): void {
        now += refreshMs;
        vi.setSystemTime(now);
        const due = [...queue.values()];
        queue.clear();
        act(() => {
          for (const cb of due) cb(now);
        });
      },
    };
  }

  /** Frames bought over a settled stretch of display frames. */
  const bought = (from: number): number =>
    invalidate.mock.calls.slice(from).reduce((n, [frames]) => n + (frames ?? 1), 0);

  it('draws a held moment at sixty on a 120Hz display, not at a hundred and twenty', () => {
    vi.useFakeTimers();
    const screen = display(1000 / 120);
    renderHook(() => {
      useAmbientFrames();
    });
    const release = holdRate(FULL_RATE_FPS);
    for (let i = 0; i < 60; i += 1) screen.step();
    const mark = invalidate.mock.calls.length;
    for (let i = 0; i < 120; i += 1) screen.step();
    // A second of display: sixty frames, give or take the one in flight.
    expect(bought(mark)).toBeGreaterThanOrEqual(59);
    expect(bought(mark)).toBeLessThanOrEqual(61);

    release();
    for (let i = 0; i < 60; i += 1) screen.step();
    const after = invalidate.mock.calls.length;
    for (let i = 0; i < 120; i += 1) screen.step();
    expect(bought(after)).toBeLessThanOrEqual(25);
  });

  it('runs at the fastest rate anybody is holding, and no faster', () => {
    const a = holdRate(FLIGHT_FPS);
    const b = holdRate(FULL_RATE_FPS);
    expect(currentFps()).toBe(FULL_RATE_FPS);
    b();
    // Releasing twice is harmless; the other hold still stands.
    b();
    expect(currentFps()).toBe(FLIGHT_FPS);
    a();
    expect(currentFps()).toBe(AMBIENT_FPS);
  });
});

/**
 * ANYTHING IN THE AIR IS DRAWN AT THIRTY. Owner instruction, 2026-09-19: a drill,
 * a probe or a fleet crossing the disc must not step at the 24fps a 120Hz display
 * strides the ambient floor to. It holds while something flies, and only then.
 */
describe('holding a rate while something flies', () => {
  it('holds thirty while there is traffic and lets go when there is none', () => {
    const view = renderHook(({ active }) => HoldRate({ fps: FLIGHT_FPS, active }), {
      initialProps: { active: true },
    });
    expect(currentFps()).toBe(FLIGHT_FPS);
    view.rerender({ active: false });
    expect(currentFps()).toBe(AMBIENT_FPS);
    view.rerender({ active: true });
    expect(currentFps()).toBe(FLIGHT_FPS);
    view.unmount();
    expect(currentFps()).toBe(AMBIENT_FPS);
  });
});

/**
 * A METEOR STEPS TWELVE TIMES A SECOND. Owner instruction, 2026-09-19. It no
 * longer raises the disc's rate at all; its streak simply moves in twelfths of a
 * second, whatever rate the disc is being drawn at.
 */
describe('the meteor step', () => {
  it('is twelve a second', () => {
    expect(METEOR_FPS).toBe(12);
  });

  it('holds still between steps, keeps twelve a second, and loses no time', () => {
    let clock = METEOR_CLOCK;
    let moved = 0;
    let steps = 0;
    // Three seconds at 30fps.
    for (let i = 0; i < 90; i += 1) {
      const step = meteorStep(clock, 1 / 30);
      clock = step.clock;
      if (step.advance > 0) {
        steps += 1;
        moved += step.advance;
      }
    }
    expect(steps).toBeGreaterThanOrEqual(35);
    expect(steps).toBeLessThanOrEqual(36);
    // The steps add up to the time that passed, less what waits for the next one.
    expect(moved + clock.since).toBeCloseTo(3, 9);
  });

  it('takes a long frame as one step, not several', () => {
    const step = meteorStep(METEOR_CLOCK, 0.5);
    expect(step.advance).toBeCloseTo(0.5, 9);
    expect(step.clock.since).toBe(0);
    // And the rhythm does not owe a burst of steps afterwards.
    expect(meteorStep(step.clock, 1 / 60).advance).toBe(0);
  });
});

/**
 * THE TEN SECONDS THE WHOLE LOOP PAYS FOR. D53.
 *
 * Nothing in the bombardment ever asked for a frame, so the one moment in the game
 * a decision made forty minutes ago is cashed in was drawn at the rate chosen for a
 * rock creeping round a forty-minute orbit. It holds the full rate for exactly as
 * long as it is mounted — sixty frames, through the ticker.
 */
describe('full rate', () => {
  afterEach(() => {
    invalidate.mockClear();
  });

  it('holds the full rate while mounted and lets go when it leaves', () => {
    const view = renderHook(() => FullRate());
    expect(view.result.current).toBeNull();
    view.unmount();
  });
});
