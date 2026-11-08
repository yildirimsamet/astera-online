import type { CombatRound } from '../combat.js';
import { fleetEntries, HULLS } from '../hulls.js';
import { shipRepairCost, shipRepairMinutes } from '../damage.js';
import { orbitPosition, type OrbitElements } from '../galaxy.js';
import { mulberry32 } from '../rng.js';
import type { HpDamageLot } from '../radiationHp.js';
import type { Fleet, Grade, Resources } from '../types.js';
import { STARTER } from './constants.js';

/** What the works aboard count as, for the hull timers the main game already has. */
const DOCK_YARD = 1;

/**
 * ROCKS GO ROUND, HERE AS THERE. Their orbit comes from their id, so nothing about it needs storing
 * and every reader agrees where a rock is.
 */
export function starterAsteroidOrbit(seed: number): OrbitElements {
  const random = mulberry32(seed);
  const radius = 250 + random() * (STARTER.radius - 250);
  const speed = 6 + random() * 6;
  return {
    radius,
    speed,
    period: (2 * Math.PI * radius) / speed,
    phase: random() * 2 * Math.PI,
    // Ships occupy the whole sphere, including its poles: their first rock must be reachable there too.
    inclination: (random() - 0.5) * Math.PI,
    ascendingNode: random() * 2 * Math.PI,
  };
}

/** The first four bytes of an id, as the number its orbit grows from. */
export const orbitSeedOf = (id: string): number => Number.parseInt(id.replace(/-/g, '').slice(0, 8), 16);

/**
 * THE FIRST ROCK (retention plan §6.3). Of the candidate ids, the first whose orbit passes between
 * `STARTER.firstRock.near` and `far` of the ship at this minute; null when none does.
 */
export function rockSeedNear(ship: { x: number; y: number; z: number }, minutes: number, ids: Iterable<string>): string | null {
  const { near, far } = STARTER.firstRock;
  for (const id of ids) {
    const at = orbitPosition(starterAsteroidOrbit(orbitSeedOf(id)), minutes);
    const d = Math.hypot(at.x - ship.x, at.y - ship.y, at.z - ship.z);
    if (d >= near && d <= far) return id;
  }
  return null;
}

/**
 * WHAT A FLEET CARRIES OFF AN OUTPOST. Nobody is robbed here, so the player raid's small share does
 * not apply: a clean win lifts what the holds can take, a partial one half of it.
 */
export function outpostHaul(stock: Resources, grade: Grade, hold: number): Resources {
  const share = grade === 'DECISIVE' ? 1 : grade === 'PARTIAL' ? 0.5 : 0;
  const wanted = (stock.alloy + stock.crystal + stock.deuterium) * share;
  const lifted = Math.min(wanted, Math.max(0, hold));
  if (lifted <= 0 || wanted <= 0) return { alloy: 0, crystal: 0, deuterium: 0 };
  const part = (lifted / wanted) * share;
  return { alloy: stock.alloy * part, crystal: stock.crystal * part, deuterium: stock.deuterium * part };
}

/** The holds stopped a raid only if a fleet lived to fill them: nothing is "full" on a fleet with none left. */
export const cargoWasLimited = (wanted: Resources, taken: Resources, hold: number): boolean =>
  hold > 0 && wanted.alloy + wanted.crystal + wanted.deuterium > taken.alloy + taken.crystal + taken.deuterium;

export interface DockBill { cost: Resources; minutes: number }

/**
 * A quarter of the main game's bill, twelve times its time: cheap, and a real wait (A14). Every wound
 * is billed: nothing mends itself on landing, here as in the main game (owner 2026-11-06).
 */
export function dockBill(lots: readonly HpDamageLot[]): DockBill {
  const { pct, dockTimeMult } = STARTER.repair;
  // The main station's own sums, which leave out a wound below a basis point: a battle can leave one.
  return { cost: shipRepairCost(lots, pct), minutes: shipRepairMinutes(lots, DOCK_YARD, {}, pct) * dockTimeMult };
}

/** A tenth of what died, and only if it is worth flying to (A15). */
export function battleDebrisOf(attackerLosses: Fleet, defenderLosses: Fleet): Resources | null {
  const { share, minimum } = STARTER.battleDebris;
  const sum: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const losses of [attackerLosses, defenderLosses]) {
    for (const [hull, count] of fleetEntries(losses)) {
      sum.alloy += HULLS[hull].alloy * count * share;
      sum.crystal += HULLS[hull].crystal * count * share;
      sum.deuterium += HULLS[hull].deuterium * count * share;
    }
  }
  return sum.alloy + sum.crystal + sum.deuterium >= minimum ? sum : null;
}

/** What a battle report keeps. Each side's view of it is drawn from this and never stored apart. */
export interface StarterBattleRecord {
  grade: Grade;
  rounds: CombatRound[];
  attackerSent: Fleet; defenderSent: Fleet;
  attackerLosses: Fleet; defenderLosses: Fleet;
  attackerRetreated: Fleet; defenderRetreated: Fleet;
  attackerDamage: HpDamageLot[]; defenderDamage: HpDamageLot[];
  loot: Resources;
  cargoLimited: boolean;
  shieldBefore: number; shieldAfter: number;
  recoveryUntil: string | null;
  siteKind: 'OUTPOST' | null;
  /** The raid left an outpost with no guard: until this time it stands open to a second fleet. */
  guardDownUntil?: string | null;
  wreckValue: number;
  /** The first decisive win over a standing outpost guard: the one that unseals the victory crate (N9). */
  firstVictory?: boolean;
  /** The guard was already down when this fleet landed: the ship whose raid took it. */
  beatenBy?: string | null;
}
