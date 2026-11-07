import { describe, expect, it } from 'vitest';
import { fleetCount, mulberry32, starterBattle, starterOutcomeTable, type Fleet } from '../src/index.js';

const SEEDS = 8;
const TOLERANCE = 0.05;
const CLOSE_ENOUGH_TO_ANCHOR = 0.06;

/** Mixed small fleets, as a hangar of this galaxy can hold them. Short by design, not a simulation. */
function fleets(): Fleet[] {
  const out: Fleet[] = [];
  for (const n of [3, 4, 5, 6, 8, 10, 12, 14, 16]) {
    const third = Math.ceil(n / 3);
    out.push({ DART: n }, { PIKE: n }, { WARDEN: n }, { DART: third, PIKE: third, WARDEN: Math.max(1, n - 2 * third) });
  }
  return out;
}

describe('the outcome table of the starter galaxy', () => {
  it('has the rows the main table has', () => {
    expect(starterOutcomeTable().map(row => row.ratio)).toEqual([1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3]);
  });

  it('agrees with the real solver within five points', () => {
    const rows = starterOutcomeTable();
    const buckets = rows.map(() => ({ n: 0, weak: 0, strong: 0 }));
    for (const a of fleets()) for (const d of fleets()) for (let seed = 0; seed < SEEDS; seed++) {
      const result = starterBattle(
        [{ contributionId: 'a', playerId: 'a', fleet: a, tech: { tech: {} } }],
        [{ stackId: 'd', playerId: 'd', fleet: d, tech: { tech: {} } }],
        0, mulberry32(seed * 13 + 5),
      );
      if (!result.balance) throw new Error('a fight of armed fleets has a balance');
      const { attackerPower, defenderPower } = result.balance;
      const ratio = Math.max(attackerPower, defenderPower) / Math.min(attackerPower, defenderPower);
      const index = rows.findIndex(row => Math.abs(row.ratio - ratio) <= CLOSE_ENOUGH_TO_ANCHOR);
      if (index < 0) continue;
      const bucket = buckets[index]!;
      const attackerStrong = attackerPower >= defenderPower;
      const attackerKept = fleetCount(result.attackerSurvivors) / fleetCount(a);
      const defenderKept = fleetCount(result.defenderSurvivors) / fleetCount(d);
      bucket.n++;
      bucket.weak += attackerStrong ? defenderKept : attackerKept;
      bucket.strong += attackerStrong ? 1 - attackerKept : 1 - defenderKept;
    }
    rows.forEach((row, i) => {
      const bucket = buckets[i]!;
      expect(bucket.n, `1:${String(row.ratio)} has fights`).toBeGreaterThan(0);
      expect(Math.abs(bucket.weak / bucket.n - row.weakKeeps.low), `weak at 1:${String(row.ratio)}`).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(bucket.strong / bucket.n - row.strongLoses.low), `strong at 1:${String(row.ratio)}`).toBeLessThanOrEqual(TOLERANCE);
    });
  }, 120_000);
});
