import { describe, expect, it } from 'vitest';
import {
  BUILD,
  HULLS,
  buildMinutes,
  buildingCost,
  defenceMinutes,
  researchMinutes,
  shipMinutes,
  type HullId,
} from '@astera/rules';
import { orderMinutes, projectedCore, projectedShipyard } from '../src/lib/orderTime.js';

/**
 * HOW LONG WILL THIS TAKE — the question no surface in the game answered.
 *
 * `buildMinutes`, `shipMinutes`, `defenceMinutes` and `researchMinutes` have been
 * pure, exported and correct in `@astera/rules` since the economy was written, and
 * `apps/web` called NONE of them. A commander pressed BUILD on a Citadel with no
 * way of knowing whether it landed before dinner or after the weekend, and the one
 * time `UpgradeRow` did print was `affordableIn` — when the price is met, which is
 * a different question and the one nobody asked.
 *
 * THE POINT OF THIS MODULE IS THAT ITS ANSWER IS THE SERVER'S ANSWER. A quoted
 * duration the server then contradicts is worse than no quote: it teaches the
 * player that the interface guesses. So every test below pins the helper against
 * the same rules function `apps/server/src/services/build.ts` calls, including the
 * projection — the server prices an order against the queue it will INHERIT, not
 * against the levels standing today.
 */

/** What a batch of one hull costs, the way `build.ts` builds it. */
const priceOf = (hull: HullId, count = 1) => ({
  alloy: HULLS[hull].alloy * count,
  crystal: HULLS[hull].crystal * count,
  deuterium: HULLS[hull].deuterium * count,
});

const order = (
  kind: 'BUILDING' | 'INSTRUMENT' | 'SATELLITE',
  subject: string,
  count = 1,
) => ({ kind, subject, count });

const planet = (
  over: Partial<Parameters<typeof orderMinutes>[2]> = {},
): Parameters<typeof orderMinutes>[2] => ({
  buildings: { CORE: 5, SHIPYARD: 4 },
  research: [],
  ...over,
});

describe('the projection the server prices against', () => {
  it('reads the levels standing today when nothing is queued', () => {
    expect(projectedCore(planet())).toBe(5);
    expect(projectedShipyard(planet())).toBe(4);
  });

  /**
   * A Core already in the CONSTRUCTION queue is a level the next order inherits —
   * `projectOrder` in `buildQueue.ts`. Quoting today's Core would make every row
   * on a screen with a Core upgrade queued quote a time the server will not honour.
   */
  it('counts a queued Core, because the next order inherits it', () => {
    const view = planet({
      queues: { CONSTRUCTION: [order('BUILDING', 'CORE')], YARD: [] },
    });
    expect(projectedCore(view)).toBe(6);
  });

  it('counts several queued levels of the same building', () => {
    const view = planet({
      queues: {
        CONSTRUCTION: [order('BUILDING', 'CORE'), order('BUILDING', 'CORE')],
        YARD: [],
      },
    });
    expect(projectedCore(view)).toBe(7);
  });

  /**
   * THE TWO QUEUES RUN IN PARALLEL AND DO NOT PROJECT INTO EACH OTHER.
   * `buildQueueContext`: "a Shipyard still building in CONSTRUCTION cannot honestly
   * unlock a hull that may finish first in YARD."
   */
  it('does not let a queued Shipyard shorten a hull already in the yard', () => {
    const view = planet({
      queues: { CONSTRUCTION: [order('BUILDING', 'SHIPYARD')], YARD: [] },
    });
    expect(projectedShipyard(view)).toBe(4);
  });

  it('ignores queued things that are not the building in question', () => {
    const view = planet({
      queues: {
        CONSTRUCTION: [order('BUILDING', 'VAULT'), order('INSTRUMENT', 'TELESCOPE')],
        YARD: [],
      },
    });
    expect(projectedCore(view)).toBe(5);
  });
});

describe('orderMinutes agrees with the rules the server charges', () => {
  it('prices a building against the projected Core', () => {
    const cost = buildingCost('REFINERY', 6);
    expect(orderMinutes('BUILDING', cost, planet())).toBe(buildMinutes(cost, 5));
  });

  it('prices an instrument and a satellite as construction too', () => {
    const cost = { alloy: 900, crystal: 400, deuterium: 0 };
    expect(orderMinutes('INSTRUMENT', cost, planet())).toBe(buildMinutes(cost, 5));
    expect(orderMinutes('SATELLITE', cost, planet())).toBe(buildMinutes(cost, 5));
  });

  it('prices a warship against the Shipyard, through the yard multiplier', () => {
    const cost = priceOf('VIPER');
    const view = planet();
    expect(orderMinutes('HULL', cost, view)).toBe(shipMinutes(cost, 4, {}));
  });

  /**
   * A ground gun is NOT a ship: `build.ts` branches on `spec.ground` and uses
   * `defenceMinutes`, which has its own throughput because a wall has to be
   * buildable inside the window it exists to survive.
   */
  it('prices a ground gun on the defence throughput, not the yard', () => {
    const cost = priceOf('THORN');
    const view = planet();
    expect(orderMinutes('DEFENCE', cost, view)).toBe(defenceMinutes(cost, 4));
    expect(orderMinutes('DEFENCE', cost, view)).not.toBe(shipMinutes(cost, 4, {}));
  });

  /**
   * `BUILD.researchTimeMult` is 0.62 — research runs SHORTER than construction of
   * the same price, on the same Core. Pinned rather than assumed: the multiplier is
   * the only thing separating the two quotes, so a row that showed a building's
   * time on a research card would be off by a factor nobody would notice by eye.
   */
  it('prices research against the Core, on its own shorter clock', () => {
    const cost = { alloy: 2000, crystal: 1500, deuterium: 0 };
    expect(orderMinutes('RESEARCH', cost, planet())).toBe(researchMinutes(cost, 5));
    expect(orderMinutes('RESEARCH', cost, planet())).toBeLessThan(buildMinutes(cost, 5));
    expect(orderMinutes('RESEARCH', cost, planet()))
      .toBeCloseTo(buildMinutes(cost, 5) * BUILD.researchTimeMult, 6);
  });

  /**
   * AND RESEARCH USES THE CORE STANDING TODAY, NOT THE PROJECTED ONE.
   *
   * `research.ts` reads `planet.buildings.CORE` directly — D134 gave research its
   * own commander-wide lane and it never picked up the build queue's projection.
   * A helper that "tidied" this into consistency would quote a time the server
   * does not charge, which is the one failure this module exists to prevent.
   */
  it('does not let a queued Core shorten a research quote', () => {
    const cost = { alloy: 2000, crystal: 1500, deuterium: 0 };
    const view = planet({
      queues: { CONSTRUCTION: [order('BUILDING', 'CORE')], YARD: [] },
    });
    expect(orderMinutes('RESEARCH', cost, view)).toBe(researchMinutes(cost, 5));
    // ...while a building on the same screen DOES take the queued level.
    expect(orderMinutes('BUILDING', cost, view)).toBe(buildMinutes(cost, 6));
  });

  /** The commander's yard automation is theirs, and the preview must spend it. */
  it('spends the commander\'s yard automation on a hull quote', () => {
    const cost = priceOf('VIPER');
    const plain = planet();
    const automated = planet({
      research: [{ id: 'YARD_AUTOMATION', level: 3 }],
    });
    expect(orderMinutes('HULL', cost, automated))
      .toBe(shipMinutes(cost, 4, { YARD_AUTOMATION: 3 }));
    expect(orderMinutes('HULL', cost, automated)).toBeLessThan(orderMinutes('HULL', cost, plain));
  });

  /** Nothing in the game may quote longer than the cap. */
  it('never exceeds the build cap, however dear the order', () => {
    const absurd = { alloy: 9_000_000_000, crystal: 9_000_000_000, deuterium: 0 };
    for (const kind of ['BUILDING', 'HULL', 'DEFENCE', 'RESEARCH'] as const) {
      expect(orderMinutes(kind, absurd, planet())).toBeLessThanOrEqual(BUILD.capMinutes);
    }
  });

  /** A batch of ten hulls is ten hulls' worth of yard time, not one. */
  it('multiplies a hull quote by the number ordered', () => {
    const cost = priceOf('DART');
    const view = planet();
    expect(orderMinutes('HULL', cost, view, 10)).toBeCloseTo(
      orderMinutes('HULL', cost, view) * 10,
      6,
    );
  });
});
