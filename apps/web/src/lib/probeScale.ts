import { combatValue, computeLoot, fleetCount, fleetEntries, type Fleet } from '@astera/rules';
import type { PlanetView } from '../api/schemas.js';

/** Your own world, measured the way a probe measures a target. */
export interface Yardstick {
  /** What a decisive raid could take: the store above the Vault, and the raidable share of the works. */
  stock: number;
  /** The armed value of everything at home that fires, ground guns included. */
  defence: number;
  /** Every craft at home, unarmed ones too. */
  ships: number;
}

/**
 * THE SAME THREE MEASURES A PROBE TAKES (`services/intel.ts`), ON YOUR ACTIVE WORLD, so a
 * reading can be set beside its equivalent. Owner, 2026-09-24: the bars gave no way to
 * tell a big reading from a small one, because nothing on them was yours.
 */
export function yardstickOf(planet: PlanetView): Yardstick {
  const p = planet.planet;
  const loot = computeLoot(
    { alloy: p.alloy, crystal: p.crystal, deuterium: p.deuterium },
    { alloy: p.bufferAlloy, crystal: p.bufferCrystal, deuterium: p.bufferDeuterium },
    p.vaultCapacity,
    'DECISIVE',
    Number.MAX_SAFE_INTEGER,
  );
  const home: Fleet = {};
  for (const [hull, count] of [...fleetEntries(planet.fleet), ...fleetEntries(planet.ground)]) {
    home[hull] = (home[hull] ?? 0) + count;
  }
  return { stock: loot.alloy + loot.crystal + loot.deuterium, defence: combatValue(home), ships: fleetCount(home) };
}

/** Room past the larger mark, so neither the reading's top nor yours sits on the edge. */
const HEADROOM = 1.1;
/** A perfect read is zero wide, and a zero-width band is no picture. */
const MIN_WIDTH = 3;

/**
 * A READING ON A NUMBER LINE FROM ZERO, in percent of the row. The line runs to the larger
 * of the reading's top and yours, so the band's place says "smaller than mine" or "bigger
 * than mine"; `you` is null when there is no world of yours to measure.
 */
export function probeAxis(low: number, high: number, mine: number | null): { start: number; width: number; you: number | null } {
  const top = Math.max(1, high, mine ?? 0) * HEADROOM;
  const from = Math.max(0, Math.min(low, high));
  return {
    start: (from / top) * 100,
    width: Math.max(MIN_WIDTH, ((Math.max(0, high) - from) / top) * 100),
    you: mine === null ? null : (Math.max(0, mine) / top) * 100,
  };
}
