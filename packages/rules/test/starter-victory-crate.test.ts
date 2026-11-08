import { describe, expect, it } from 'vitest';
import {
  HULLS, STARTER, STARTER_CRATES, crateStates, dockBill, fleetEntries, mulberry32, normalizeHpDamage, openingProgress, readyCrates, starterBattle,
  type Fleet, type VesselProgress,
} from '../src/index.js';

/**
 * THE FIRST VICTORY'S CRATE (owner 2026-11-08, N9). An outpost gives what the surviving holds carry, so
 * a first hunt costs more ships than it brings home and would teach that outposts are not worth it. One
 * crate, once, for the first decisive outpost win, pays the ships back on whichever road was taken.
 */
const victory = STARTER_CRATES.find(crate => crate.fact === 'FIRST_OUTPOST_VICTORY');
const { guards } = STARTER.sites.outposts;

/** The first hunt's roads (plan §5): the yard's two Darts at the Warden wall, or a counter build at level two. */
const ROADS: readonly [string, Fleet, Fleet][] = [
  ['two Darts at the Warden wall', { DART: 2 }, { WARDEN: guards[0] }],
  ['two Darts and two Pikes at a Dart guard', { DART: 2, PIKE: 2 }, { DART: guards[1] }],
  ['two Darts and two Wardens at a Pike guard', { DART: 2, WARDEN: 2 }, { PIKE: guards[1] }],
];
const SEEDS = 400;

/** What a decisive win on this road costs on average: the ships lost and the station's bill for the rest. */
function costOfWinning(fleet: Fleet, guard: Fleet): { alloy: number; crystal: number } {
  let wins = 0;
  let alloy = 0;
  let crystal = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const result = starterBattle(
      [{ contributionId: 'hunt', playerId: 'ship', fleet, tech: { tech: {} } }],
      [{ stackId: 'outpost', playerId: '', fleet: guard, tech: { tech: {} }, maintenanceExempt: true }],
      0, mulberry32(seed),
    );
    if (result.grade !== 'DECISIVE') continue;
    wins++;
    for (const [hull, count] of fleetEntries(result.attackerLosses)) {
      alloy += HULLS[hull].alloy * count;
      crystal += HULLS[hull].crystal * count;
    }
    const bill = dockBill(normalizeHpDamage(result.attackerSurvivors, result.attackerDamage)).cost;
    alloy += bill.alloy;
    crystal += bill.crystal;
  }
  expect(wins).toBeGreaterThan(SEEDS / 2);
  return { alloy: alloy / wins, crystal: crystal / wins };
}

describe('the first victory crate', () => {
  const yard: VesselProgress = { ...openingProgress(), modules: { ...openingProgress().modules, REFINERY: 3, SURVEY: 1, SHIPYARD: 1 } };
  const won: VesselProgress = { ...yard, facts: ['FIRST_OUTPOST_VICTORY'] };

  it('stands in the yard\'s bay and opens with the first decisive outpost win, once', () => {
    expect(victory).toMatchObject({ module: 'SHIPYARD', stage: 1 });
    if (!victory) return;
    expect(readyCrates(yard, []).map(crate => crate.id)).not.toContain(victory.id);
    expect(readyCrates(won, []).map(crate => crate.id)).toContain(victory.id);
    expect(readyCrates(won, [victory.id]).map(crate => crate.id)).not.toContain(victory.id);
    const state = (progress: VesselProgress, opened: readonly string[]) => crateStates(progress, opened).find(crate => crate.id === victory.id);
    expect(state(yard, [])).toMatchObject({ state: 'sealed', fact: 'FIRST_OUTPOST_VICTORY' });
    expect(state(won, [])?.state).toBe('ready');
    expect(state(won, [victory.id])?.state).toBe('opened');
  });

  it('asks a repair crate for its repair alone', () => {
    const repairs = STARTER_CRATES.filter(crate => crate.fact === null);
    expect(repairs.length).toBe(STARTER_CRATES.length - 1);
    expect(crateStates(yard, []).filter(crate => crate.fact === null && crate.module === 'SHIPYARD').every(crate => crate.state === 'ready')).toBe(true);
  });

  it.each(ROADS)('pays back, in each resource, what a win costs: %s', (_, fleet, guard) => {
    const cost = costOfWinning(fleet, guard);
    expect(victory?.reward.alloy).toBeGreaterThanOrEqual(cost.alloy);
    expect(victory?.reward.crystal).toBeGreaterThanOrEqual(cost.crystal);
  });

  it('is a payback, not a prize: worth less than the two Darts the yard hands over', () => {
    expect(victory?.reward.alloy).toBeLessThan(2 * HULLS.DART.alloy);
    expect(victory?.reward.crystal).toBeLessThan(2 * HULLS.DART.crystal);
  });
});
