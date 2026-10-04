import { MULTI_WORLD, SHIP_DAMAGE } from './constants.js';
import { assertDamageCarried, type DamageLot } from './damage.js';
import { ALL_HULLS, HULLS, fleetEntries } from './hulls.js';
import {
  radiationRateProfile,
  type RadiationField,
  type RadiationRatePiece,
  type Segment,
} from './radiation.js';
import { hullTech, type TechLevels } from './tech.js';
import type { Fleet, HullId } from './types.js';

/**
 * Monument's fixed HP dose. No balance values or season gate live here: the old
 * percentage model remains its own API until a completed new ruleset opts in.
 *
 * A lot keeps its fractional basis point as well as its existing integer damage.
 * Dropping the fraction at a read, a fleet split or a battle boundary would turn
 * those actions into free healing. Callers must carry both through every adapter.
 */
export interface HpRadiationSource extends RadiationField {
  intensityHpPerMinute: number;
}

export interface HpDamageLot extends DamageLot {
  /** Absent on old damage lots; zero there. Always supplied by HP settlement. */
  readonly remainderBp?: number;
}

export type HpDamageLots = readonly HpDamageLot[];

/** Persisted season boundary; defining it does not advance the new-season default. */
export const hpRadiationApplies = (rulesetVersion: number): boolean => rulesetVersion >= MULTI_WORLD.monumentRulesetVersion;

export interface HpDoseOutcome {
  fleet: Fleet;
  lots: HpDamageLot[];
  destroyed: Fleet;
}

export interface HpRadiationShip {
  hull: HullId;
  damageBp?: number;
  remainderBp?: number;
  /** The committing wave's snapshot, never research re-read midway through a dose. */
  tech?: TechLevels;
}

const HULL_ORDER = new Map<HullId, number>(ALL_HULLS.map((hull, i) => [hull, i]));
const KNOWN_HULLS: ReadonlySet<string> = new Set(ALL_HULLS);
// In basis points, used by settlement AND threshold prediction. Only float noise
// at a whole basis point is rounded away; ordinary sub-bp doses stay on the lot.
const DAMAGE_EPSILON = 1e-8;

const exactBp = (lot: HpDamageLot): number => lot.damageBp + (lot.remainderBp ?? 0);
const cleanFleet = (fleet: Fleet): Fleet => Object.fromEntries(fleetEntries(fleet));

function assertFleetPopulation(fleet: Fleet, flying: boolean): void {
  for (const key of Object.keys(fleet)) {
    if (!KNOWN_HULLS.has(key)) throw new RangeError(`unknown flying hull ${key}`);
  }
  for (const hull of ALL_HULLS) {
    const count = fleet[hull];
    if (count === undefined) continue;
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError(`bad ship count ${String(count)}`);
    if (flying && count > 0 && HULLS[hull].ground) throw new RangeError(`ground hull ${hull} cannot fly through radiation`);
  }
}

function normalizeHpLots(fleet: Fleet, lots: HpDamageLots | null | undefined): HpDamageLot[] {
  const merged = new Map<string, HpDamageLot>();
  for (const row of lots ?? []) {
    const remainderBp = row.remainderBp ?? 0;
    if (!HULL_ORDER.has(row.hull)
      || !Number.isSafeInteger(row.count) || row.count < 0
      || !Number.isInteger(row.damageBp) || row.damageBp < 0 || row.damageBp >= SHIP_DAMAGE.destroyedBp
      || !Number.isFinite(remainderBp) || remainderBp < 0 || remainderBp >= 1) {
      throw new RangeError('bad HP damage lot');
    }
    if (row.count === 0) continue;
    const key = `${row.hull}:${String(row.damageBp)}:${String(remainderBp)}`;
    merged.set(key, { ...row, count: (merged.get(key)?.count ?? 0) + row.count, remainderBp });
  }
  const normalized = [...merged.values()];
  assertDamageCarried(fleet, normalized);
  return normalized.filter((row) => exactBp(row) > 0).sort((a, b) =>
    (HULL_ORDER.get(a.hull) ?? 0) - (HULL_ORDER.get(b.hull) ?? 0) || b.damageBp - a.damageBp || (b.remainderBp ?? 0) - (a.remainderBp ?? 0));
}

/** Shared exact health validation for battle/dock; ground populations are valid here. */
export function normalizeHpDamage(fleet: Fleet, lots: HpDamageLots | null | undefined): HpDamageLot[] {
  assertFleetPopulation(fleet, false);
  return normalizeHpLots(fleet, lots);
}

function fleetCohorts(fleet: Fleet, lots: HpDamageLots): HpDamageLot[] {
  const cohorts = [...lots];
  const damaged: Fleet = {};
  for (const row of lots) damaged[row.hull] = (damaged[row.hull] ?? 0) + row.count;
  for (const [hull, count] of fleetEntries(fleet)) {
    const healthy = count - (damaged[hull] ?? 0);
    if (healthy > 0) cohorts.push({ hull, count: healthy, damageBp: 0, remainderBp: 0 });
  }
  return cohorts;
}

function hpProfile(segments: readonly Segment[], sources: readonly HpRadiationSource[]): RadiationRatePiece[] {
  const pieces: RadiationRatePiece[] = [];
  let previousEnd = Number.NEGATIVE_INFINITY;
  for (const segment of segments) {
    if (segment.startMs < previousEnd) throw new RangeError('segments out of order');
    pieces.push(...radiationRateProfile(segment, sources, (source) => source.intensityHpPerMinute));
    previousEnd = segment.endMs;
  }
  return pieces;
}

/** Exact HP lost by EACH non-exempt ship, over the source windows actually crossed. */
export function segmentsExposureHp(segments: readonly Segment[], sources: readonly HpRadiationSource[]): number {
  const dose = hpProfile(segments, sources).reduce((sum, piece) => sum + piece.rate * (piece.endMs - piece.startMs), 0);
  if (!Number.isFinite(dose)) throw new RangeError('HP exposure exceeds finite range');
  return dose;
}

/** Every ship takes this many HP; count and tier never divide or resist the dose. */
export function applyHpDose(
  fleet: Fleet,
  lots: HpDamageLots | null | undefined,
  doseHp: number,
  tech: TechLevels = {},
): HpDoseOutcome {
  if (!Number.isFinite(doseHp) || doseHp < 0) throw new RangeError(`bad HP dose ${String(doseHp)}`);
  assertFleetPopulation(fleet, true);
  const damaged = normalizeHpLots(fleet, lots);
  const survivors = cleanFleet(fleet);
  if (doseHp === 0) return { fleet: survivors, lots: damaged, destroyed: {} };

  const destroyed: Fleet = {};
  const kept: HpDamageLot[] = [];
  for (const row of fleetCohorts(fleet, damaged)) {
    // Probe is a separate mission object, never a HullId. The Collector and the
    // transports are SUPPORT too, so a class-wide exemption would protect them.
    if (row.hull === 'PROSPECTOR') {
      kept.push(row);
      continue;
    }
    const hp = HULLS[row.hull].hp * hullTech(tech, row.hull).hp;
    const totalBp = exactBp(row) + doseHp / hp * SHIP_DAMAGE.destroyedBp;
    const damageBp = Math.floor(totalBp + DAMAGE_EPSILON);
    if (damageBp >= SHIP_DAMAGE.destroyedBp) {
      destroyed[row.hull] = (destroyed[row.hull] ?? 0) + row.count;
      survivors[row.hull] = (survivors[row.hull] ?? 0) - row.count;
    } else {
      kept.push({ ...row, damageBp, remainderBp: Math.max(0, totalBp - damageBp) });
    }
  }
  return { fleet: cleanFleet(survivors), lots: normalizeHpLots(survivors, kept), destroyed };
}

function lethalFromProfile(
  pieces: readonly RadiationRatePiece[],
  row: HpDamageLot,
  tech: TechLevels,
): number | null {
  if (row.hull === 'PROSPECTOR') return null;
  const hp = HULLS[row.hull].hp * hullTech(tech, row.hull).hp;
  const neededBp = SHIP_DAMAGE.destroyedBp - exactBp(row);
  const aimBp = neededBp - DAMAGE_EPSILON / 2;
  let takenBp = 0;
  for (const piece of pieces) {
    const rateBp = piece.rate / hp * SHIP_DAMAGE.destroyedBp;
    const gainedBp = rateBp * (piece.endMs - piece.startMs);
    if (takenBp + gainedBp + DAMAGE_EPSILON >= neededBp) {
      const at = Math.ceil(Math.min(piece.endMs, piece.startMs + Math.max(0, aimBp - takenBp) / rateBp));
      // A fraction inside the epsilon band still lives at zero dose. At epoch-sized
      // timestamps its tiny remaining lifetime can round back to the piece start.
      return Math.max(Math.floor(piece.startMs) + 1, at);
    }
    takenBp += gainedBp;
  }
  return null;
}

/** First whole millisecond at which this ship's carried damage plus HP dose destroys it. */
export function hpLethalAtMs(
  segments: readonly Segment[],
  sources: readonly HpRadiationSource[],
  ship: HpRadiationShip,
): number | null {
  const fleet: Fleet = { [ship.hull]: 1 };
  assertFleetPopulation(fleet, true);
  const row: HpDamageLot = {
    hull: ship.hull, count: 1, damageBp: ship.damageBp ?? 0, remainderBp: ship.remainderBp ?? 0,
  };
  normalizeHpLots(fleet, [row]);
  return lethalFromProfile(hpProfile(segments, sources), row, ship.tech ?? {});
}

/**
 * The next casualty changes production weight or physical cargo capacity. Scheduling
 * only whole-wing death would keep dead ships earning resources in the meantime.
 */
export function firstHpLossAtMs(
  segments: readonly Segment[],
  sources: readonly HpRadiationSource[],
  fleet: Fleet,
  lots: HpDamageLots | null | undefined,
  tech: TechLevels = {},
): number | null {
  assertFleetPopulation(fleet, true);
  const damaged = normalizeHpLots(fleet, lots);
  const pieces = hpProfile(segments, sources);
  let first: number | null = null;
  for (const row of fleetCohorts(fleet, damaged)) {
    const at = lethalFromProfile(pieces, row, tech);
    if (at !== null && (first === null || at < first)) first = at;
  }
  return first;
}

/** The whole contact disappears only if every cohort is destroyed on the known path. */
export function hpWingLethalAtMs(segments: readonly Segment[], sources: readonly HpRadiationSource[], fleet: Fleet,
  lots: HpDamageLots | null | undefined, tech: TechLevels = {}): number | null {
  assertFleetPopulation(fleet, true);
  const cohorts = fleetCohorts(fleet, normalizeHpLots(fleet, lots));
  if (cohorts.length === 0) return null;
  const pieces = hpProfile(segments, sources);
  let last = Number.NEGATIVE_INFINITY;
  for (const cohort of cohorts) {
    const at = lethalFromProfile(pieces, cohort, tech);
    if (at === null) return null;
    last = Math.max(last, at);
  }
  return last;
}
