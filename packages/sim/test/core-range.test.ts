import { describe, expect, it } from 'vitest';
import { runSeason, type World } from '../src/index.js';

/**
 * THE CORE STAYS WHERE THE LEVEL RULES WERE BUILT FOR IT. Owner decision, 2026-09-23.
 *
 * Ground emplacements (+10 a level), flight bays (+1 per 3), the ±1 attack tier, colony loyalty
 * tiers and the satellite slots all read the Core LEVEL, and all of them were balanced for the range
 * the live game plays in — median Core 13, top 17 on day 9. Faz 4.1 first put the Core on the
 * producers' curve and the sim's median reached 25 by day 30; the owner chose to give the Core its own
 * gentler slope rather than re-balance every one of those rules. This is that choice, measured.
 *
 * The sim runs one or two rungs BEHIND the live field (it under-models outside income — see
 * `reports/sim-gerceklik-2026-09-22.md`), so the bounds are its own readings, not the live ones.
 */
describe('a thirty-day season on the Core curve', () => {
  const coresOnDay30: number[] = [];
  runSeason({
    players: 53, days: 30, seed: 42, activityProfiles: 'by-archetype',
    onDay: (day: number, world: World) => {
      if (day === 30) for (const p of world.players) coresOnDay30.push(p.buildings.CORE);
    },
  });
  const sorted = [...coresOnDay30].sort((a, b) => a - b);
  const at = (share: number): number => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0;

  it('keeps the median Core in the range the level rules were balanced for', () => {
    expect(at(0.5)).toBeGreaterThanOrEqual(14);
    expect(at(0.5)).toBeLessThanOrEqual(18);
  });

  it('keeps even the top tenth below the Core-20 edge', () => {
    expect(at(0.9)).toBeLessThanOrEqual(20);
  });
});
