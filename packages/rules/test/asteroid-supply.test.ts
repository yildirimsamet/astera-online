import { describe, expect, it } from 'vitest';
import { ASTEROID_DYNAMIC, planAsteroidHour, supplyPopulation } from '../src/index.js';

/**
 * WHO COUNTS TOWARD THE SKY, AND HOW FAST THAT FIGURE MAY MOVE. Plan §15.6, the asteroid row.
 *
 * The field follows the people playing it — one rock per active commander per hour — which is the
 * right rule and an open door. The plan names the door: *"Sybil sınırı şart"*. A raw count of
 * whoever logged in during the last hour pays the galaxy for accounts, and accounts are free.
 *
 * TWO GATES, BOTH REQUIRED, and the plan's "24 saat / küçük Core eşiği" is read as AND rather than
 * OR deliberately. Either alone is cheap to fake: a throwaway account passes the clock by doing
 * nothing for a day, and a scripted one passes a small Core in minutes. Together they cost a day
 * AND real production per fake commander, which is the whole defence.
 *
 * A NEW COMMANDER STILL GETS THE FIELD. This gate is about what they ADD to the global supply,
 * not about what they may fly at.
 */
describe('who counts toward the asteroid supply', () => {
  it('states both gates rather than hiding them inline', () => {
    expect(ASTEROID_DYNAMIC.supply.graceMinutes).toBe(24 * 60);
    expect(ASTEROID_DYNAMIC.supply.coreLevel).toBeGreaterThan(1);
    expect(ASTEROID_DYNAMIC.supply.windowHours).toBeGreaterThan(1);
  });
});

/**
 * AND THE FIGURE IS A ROLLING ONE, NOT THE LAST HOUR'S HEADCOUNT.
 *
 * *"Ham 1 saatlik login yerine yuvarlanan/tavanlı uygun-aktif nüfus."* A raw hour lets one
 * coordinated login move the whole galaxy's supply for that hour and lets one quiet hour empty it.
 * Averaging over a window is the cap: a spike is divided by the window, and a genuine rise still
 * arrives — just over hours rather than in one.
 */
describe('how fast the supply figure may move', () => {
  it('is the last hour when there is no history to average with', () => {
    expect(supplyPopulation(12, [])).toBe(12);
  });

  it('averages the window, so one spike cannot move the sky', () => {
    const steady = [10, 10, 10, 10, 10];
    expect(supplyPopulation(10, steady)).toBe(10);
    // A hundred logins in one hour, against five quiet ones.
    const spiked = supplyPopulation(100, steady);
    expect(spiked).toBeGreaterThan(10);
    expect(spiked).toBeLessThan(30);
  });

  /**
   * THE WINDOW HOLDS RAW ELIGIBLE COUNTS, NOT THE SMOOTHED FIGURES IT PRODUCED.
   *
   * Feeding its own output back would filter twice and a real rise would crawl toward the truth
   * without ever arriving. Averaging the raw counts arrives exactly, and takes a window to do it —
   * which is the whole intent: a spike is divided, a trend is honoured.
   */
  it('lets a genuine rise through, over hours rather than in one', () => {
    let history: number[] = [10, 10, 10, 10, 10];
    const seen: number[] = [];
    for (let hour = 0; hour < ASTEROID_DYNAMIC.supply.windowHours; hour++) {
      seen.push(supplyPopulation(40, history));
      history = [40, ...history].slice(0, ASTEROID_DYNAMIC.supply.windowHours - 1);
    }
    // It climbs every hour and lands on the truth once the window has turned over.
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThan(seen[i - 1]!);
    expect(seen.at(-1)).toBe(40);
  });

  it('reads only as far back as the window', () => {
    const long = Array.from({ length: 40 }, () => 0);
    expect(supplyPopulation(60, long))
      .toBe(Math.round(60 / ASTEROID_DYNAMIC.supply.windowHours));
  });

  it('never returns a fraction of a commander, or a negative one', () => {
    expect(Number.isInteger(supplyPopulation(7, [4, 5]))).toBe(true);
    expect(supplyPopulation(0, [0, 0])).toBe(0);
    expect(() => supplyPopulation(-1, [])).toThrow();
    expect(() => supplyPopulation(1.5, [])).toThrow();
  });

  /** And the planner still reads it as a headcount, so nothing downstream changed shape. */
  it('feeds the hour planner exactly as the raw count did', () => {
    const lanes = planAsteroidHour({
      activePlayers: supplyPopulation(12, [12, 12]),
      hourStartsAtMinute: 0,
      spawnFromMinute: 0,
      seasonEndsAtMinute: 60_000,
      showers: [],
    });
    expect(lanes).toHaveLength(1);
    expect(lanes[0]!.count).toBe(12 * ASTEROID_DYNAMIC.perPlayerPerHour);
  });
});
