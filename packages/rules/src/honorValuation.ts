import { ALL_HULLS, HULLS } from './hulls.js';
import { honorInteger, honorNumber } from './honor.js';
import { honorResourceValue } from './honorRewards.js';
import type { Resources } from './types.js';
import { instrumentCost } from './economy.js';
import { ANTI_STRATEGIC, DEATH_STAR } from './constants.js';
import { RADIATION_BOMB, radiationBombLevel, type RadiationBombType } from './radiationBomb.js';

export interface HonorHullValue { value: number; armed: boolean; ground: boolean }
export type HonorCatalogue = Readonly<Record<string, HonorHullValue | undefined>>;
export type HonorStrategicCatalogue = Readonly<{ DEATH_STAR: number; INTERCEPTOR: number } & Partial<Record<RadiationBombType, number>>>;
type Counts = Readonly<Record<string, number | undefined>>;

export function createHonorStrategicCatalogue(includeRadiation = false): HonorStrategicCatalogue {
  return { DEATH_STAR: honorResourceValue(DEATH_STAR.cost), INTERCEPTOR: honorResourceValue(ANTI_STRATEGIC.cost),
    ...(includeRadiation ? {
      RADIATION_BOMB_L1: honorResourceValue(RADIATION_BOMB.levels[1].cost),
      RADIATION_BOMB_L2: honorResourceValue(RADIATION_BOMB.levels[2].cost),
      RADIATION_BOMB_L3: honorResourceValue(RADIATION_BOMB.levels[3].cost),
    } : {}) };
}

export function honorStrategicValue(catalogue: HonorStrategicCatalogue, type: string): number {
  const level = radiationBombLevel(type);
  const value = type === 'DEATH_STAR' || type === 'INTERCEPTOR' ? catalogue[type]
    : level === null ? undefined : catalogue[RADIATION_BOMB.levels[level].type];
  if (value === undefined) throw new Error('Unknown Honor strategic asset');
  honorInteger(value);
  return value;
}

/** Every representable cumulative Aegis level, frozen once for the season. */
export function createHonorShieldCatalogue(): readonly number[] {
  const values = [0];
  let total = 0;
  for (let level = 0; ; level++) {
    const cost = instrumentCost('AEGIS', level);
    const next = total + cost.alloy + 2 * cost.crystal + 32 * cost.deuterium;
    if (!Number.isSafeInteger(next)) break;
    total = next;
    values.push(total);
  }
  return values;
}

export function honorShieldInvestment(catalogue: readonly number[], level: number): number {
  honorInteger(level);
  const value = catalogue[level];
  if (value === undefined) throw new RangeError('Unrecorded Honor shield level');
  honorInteger(value);
  return value;
}

/** Live stores are fractional. Round the combined actual loot once, never each resource separately. */
export function honorLootValue(loot: Resources): number {
  for (const value of [loot.alloy, loot.crystal, loot.deuterium]) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid Honor loot');
  }
  const value = Math.floor(loot.alloy + 2 * loot.crystal + 32 * loot.deuterium);
  honorInteger(value);
  return value;
}

/** Persist this at season creation; never recreate it when replaying an older season. */
export function createHonorCatalogue(): HonorCatalogue {
  return Object.fromEntries(ALL_HULLS.map(id => {
    const hull = HULLS[id];
    return [id, { value: honorResourceValue(hull), armed: hull.atk > 0, ground: hull.ground }];
  }));
}

function entries(catalogue: HonorCatalogue, counts: Counts): [string, bigint, HonorHullValue][] {
  return Object.entries(counts).map(([id, count]) => {
    const hull = Object.hasOwn(catalogue, id) ? catalogue[id] : undefined;
    if (!hull || typeof count !== 'number') throw new Error('Unknown Honor hull or missing count');
    honorInteger(hull.value);
    return [id, honorInteger(count), hull];
  });
}

/** Counts each owned unit once; location and health are not discounts to the navy reference. */
export function honorFleetValue(catalogue: HonorCatalogue, fleet: Counts, armedOnly = false): number {
  return honorNumber(entries(catalogue, fleet).reduce((sum, [, count, hull]) =>
    sum + (!armedOnly || hull.armed ? count * BigInt(hull.value) : 0n), 0n));
}

/** Actual battle casualties only: escaping ships and pre-battle radiation are not losses here. */
export function honorLossEvidence(catalogue: HonorCatalogue, input: { sent: Counts; losses: Counts; rebuilt: Counts }): { all: number; armed: number } {
  const sent = new Map(entries(catalogue, input.sent).map(([id, count]) => [id, count]));
  const dead = entries(catalogue, input.losses);
  const lost = new Map(dead.map(([id, count]) => [id, count]));
  const rebuilt = new Map(entries(catalogue, input.rebuilt).map(([id, count, hull]) => {
    if (count > (lost.get(id) ?? 0n) || (count > 0n && !hull.ground)) throw new Error('Invalid Honor reconstruction');
    return [id, count];
  }));
  let all = 0n, armed = 0n;
  for (const [id, count, hull] of dead) {
    if (count > (sent.get(id) ?? 0n)) throw new Error('Honor loss exceeds starting roster');
    const value = (count - (rebuilt.get(id) ?? 0n)) * BigInt(hull.value);
    all += value;
    if (hull.armed) armed += value;
  }
  return { all: honorNumber(all), armed: honorNumber(armed) };
}
