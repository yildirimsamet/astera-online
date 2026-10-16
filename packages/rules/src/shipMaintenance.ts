import { SHIP_DAMAGE } from './constants.js';
import { HULLS, fleetEntries } from './hulls.js';
import { normalizeHpDamage, type HpDamageLot, type HpDamageLots } from './radiationHp.js';
import type { Fleet, Resources } from './types.js';

/** Location never heals a ship; every survivor keeps its exact wounds at home. */
export function maintenanceLanding(fleet: Fleet, damage: HpDamageLots | null | undefined) {
  return { home: clean(fleet), damage: normalizeHpDamage(fleet, damage), autoRepaired: [], docked: [] };
}

const clean = (fleet: Fleet): Fleet => Object.fromEntries(fleetEntries(fleet));
export const healthGroupKey = (lot: Pick<HpDamageLot, 'hull' | 'damageBp' | 'remainderBp'>): string =>
  `${lot.hull}:${String(lot.damageBp)}:${String(lot.remainderBp ?? 0)}`;

/** Strictly more than 5% HP; compare components to preserve sub-bp boundaries. */
export function shipCanFight(lot: Pick<HpDamageLot, 'damageBp' | 'remainderBp'>): boolean {
  const remainder = lot.remainderBp ?? 0;
  if (!Number.isInteger(lot.damageBp) || lot.damageBp < 0 || lot.damageBp >= SHIP_DAMAGE.destroyedBp
    || !Number.isFinite(remainder) || remainder < 0 || remainder >= 1) throw new RangeError('bad ship health');
  return lot.damageBp < 9500;
}

/** Physical population includes the healthy ships omitted from injury metadata. */
export function shipHealthGroups(fleet: Fleet, damage: HpDamageLots | null | undefined): HpDamageLot[] {
  const lots = normalizeHpDamage(fleet, damage);
  const injured: Fleet = {};
  for (const lot of lots) injured[lot.hull] = (injured[lot.hull] ?? 0) + lot.count;
  for (const [hull, count] of fleetEntries(fleet)) {
    const healthy = count - (injured[hull] ?? 0);
    if (healthy > 0) lots.push({ hull, count: healthy, damageBp: 0, remainderBp: 0 });
  }
  return lots;
}

/** Older percentage sources add whole basis points without discarding carried fractions. */
export function applyMaintenanceDoseBp(fleet: Fleet, damage: HpDamageLots | null | undefined, doseBp: number) {
  if (!Number.isSafeInteger(doseBp) || doseBp < 0) throw new RangeError('bad radiation dose');
  const survivors = clean(fleet);
  const destroyed: Fleet = {};
  const kept: HpDamageLot[] = [];
  for (const lot of shipHealthGroups(fleet, damage)) {
    if (doseBp >= SHIP_DAMAGE.destroyedBp - lot.damageBp) {
      destroyed[lot.hull] = (destroyed[lot.hull] ?? 0) + lot.count;
      survivors[lot.hull] = (survivors[lot.hull] ?? 0) - lot.count;
    } else kept.push({ ...lot, damageBp: lot.damageBp + doseBp });
  }
  const remaining = clean(survivors);
  return { fleet: remaining, lots: normalizeHpDamage(remaining, kept), destroyed };
}

/** For planet participation only. Monuments keep passive ships as physical targets. */
export function partitionCombatFleet(fleet: Fleet, damage: HpDamageLots | null | undefined) {
  const normalized = normalizeHpDamage(fleet, damage);
  const eligible: Fleet = { ...fleet };
  const excluded: Fleet = {};
  const excludedDamage = normalized.filter((lot) => !HULLS[lot.hull].ground && !shipCanFight(lot));
  for (const lot of excludedDamage) {
    eligible[lot.hull] = (eligible[lot.hull] ?? 0) - lot.count;
    excluded[lot.hull] = (excluded[lot.hull] ?? 0) + lot.count;
  }
  return { eligible: clean(eligible), damage: normalized.filter((lot) => HULLS[lot.hull].ground || shipCanFight(lot)),
    excluded, excludedDamage };
}

export interface HealthSelection {
  selected: Fleet;
  selectedDamage: HpDamageLot[];
  remaining: Fleet;
  remainingDamage: HpDamageLot[];
}

/** Exact UI selection; a changed cohort is rejected rather than replaced by another. */
export function selectHealthGroups(fleet: Fleet, damage: HpDamageLots | null | undefined, selection: HpDamageLots): HealthSelection {
  if (selection.length === 0) throw new RangeError('empty health selection');
  const available = new Map(shipHealthGroups(fleet, damage).map((lot) => [healthGroupKey(lot), lot]));
  const seen = new Set<string>();
  const selected: Fleet = {};
  const selectedLots: HpDamageLot[] = [];
  const remaining = { ...fleet };
  for (const requested of selection) {
    const key = healthGroupKey(requested);
    const group = available.get(key);
    if (seen.has(key) || !group || !Number.isSafeInteger(requested.count) || requested.count < 1 || requested.count > group.count) {
      throw new RangeError('health selection changed or exceeds available ships');
    }
    seen.add(key);
    selected[requested.hull] = (selected[requested.hull] ?? 0) + requested.count;
    remaining[requested.hull] = (remaining[requested.hull] ?? 0) - requested.count;
    selectedLots.push({ ...group, count: requested.count });
    available.set(key, { ...group, count: group.count - requested.count });
  }
  return { selected, selectedDamage: normalizeHpDamage(selected, selectedLots), remaining: clean(remaining),
    remainingDamage: normalizeHpDamage(remaining, [...available.values()]) };
}

/** Ordinary hull/count launch selection: healthy first, then least injured. */
export function splitHealthFleet(fleet: Fleet, damage: HpDamageLots | null | undefined, requested: Fleet, combatOnly = false): HealthSelection {
  normalizeHpDamage(requested, []);
  const groups = shipHealthGroups(fleet, damage).sort((a, b) => a.damageBp - b.damageBp || (a.remainderBp ?? 0) - (b.remainderBp ?? 0));
  const selection: HpDamageLot[] = [];
  for (const [hull, count] of fleetEntries(requested)) {
    let left = count;
    for (const group of groups) {
      if (group.hull !== hull || (combatOnly && !HULLS[hull].ground && !shipCanFight(group))) continue;
      const taken = Math.min(left, group.count);
      if (taken > 0) selection.push({ ...group, count: taken });
      left -= taken;
      if (left === 0) break;
    }
    if (left > 0) throw new RangeError('not enough eligible ships');
  }
  if (selection.length === 0) return { selected: {}, selectedDamage: [], remaining: clean(fleet), remainingDamage: normalizeHpDamage(fleet, damage) };
  return selectHealthGroups(fleet, damage, selection);
}

/** Exact persisted decimal (including subnormal fractions), with no upward rounding. */
function decimalRatio(value: number): { num: bigint; den: bigint } {
  const [mantissa = '0', exponent = '0'] = String(value).split('e');
  const [integer = '0', decimals = ''] = mantissa.split('.');
  return { num: BigInt(integer + decimals), den: 10n ** BigInt(decimals.length - Number(exponent)) };
}

/** Sum exact surviving recipe shares, then floor once per resource for the batch. */
export function shipScrapReturn(fleet: Fleet, damage: HpDamageLots | null | undefined): Resources {
  const groups = shipHealthGroups(fleet, damage).map((lot) => ({ lot, ratio: decimalRatio(lot.remainderBp ?? 0) }));
  let denominator = 1n;
  for (const { ratio } of groups) if (ratio.den > denominator) denominator = ratio.den;
  const totals = { alloy: 0n, crystal: 0n, deuterium: 0n };
  for (const { lot, ratio } of groups) {
    const hull = HULLS[lot.hull];
    if (hull.ground) throw new RangeError('ground defences cannot be scrapped as ships');
    const remaining = BigInt(SHIP_DAMAGE.destroyedBp - lot.damageBp) * denominator - ratio.num * (denominator / ratio.den);
    for (const resource of ['alloy', 'crystal', 'deuterium'] as const) {
      totals[resource] += BigInt(hull[resource]) * BigInt(lot.count) * remaining;
    }
  }
  const scale = BigInt(SHIP_DAMAGE.destroyedBp * 2) * denominator;
  const result: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const resource of ['alloy', 'crystal', 'deuterium'] as const) {
    const amount = totals[resource] / scale;
    if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('scrap return exceeds integer range');
    result[resource] = Number(amount);
  }
  return result;
}
