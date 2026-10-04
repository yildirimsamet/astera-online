import { hangarCapacity } from './economy.js';
import { ALL_HULLS, HULLS, combatValue, hullBulk } from './hulls.js';
import { normalizeMonumentLots, type MonumentShipLot } from './monument.js';

/** Approved initial capacity, in the existing planet hangar's bulk units. */
export const MONUMENT_CAPACITY = hangarCapacity(10);

export interface MonumentHoldChoice {
  lotId: string;
  holdCount: number;
  returnCount: number;
}

export interface MonumentHoldSelection {
  /** A decision on source lots, not persisted copies with duplicate lot identities. */
  choices: MonumentHoldChoice[];
  usedCapacity: number;
  freeCapacity: number;
}

interface Demand {
  playerId: string;
  weight: bigint;
  demand: bigint;
}

interface Quota {
  numerator: bigint;
  denominator: bigint;
}

const byId = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const ascending = (a: bigint, b: bigint): number => a < b ? -1 : a > b ? 1 : 0;
const HULL_ORDER = new Map(ALL_HULLS.map((hull, index) => [hull, index]));
const withinOwner = (a: MonumentShipLot, b: MonumentShipLot): number =>
  (HULL_ORDER.get(a.hull) ?? 0) - (HULL_ORDER.get(b.hull) ?? 0)
  || (a.damageBp + a.remainderBp) - (b.damageBp + b.remainderBp)
  || byId(a.id, b.id);

/** Exact capped weighted bulk quotas. No float decides an indivisible ship. */
function capacityQuotas(capacity: number, demands: readonly Demand[]): Map<string, Quota> {
  const result = new Map(demands.map((row) => [row.playerId, { numerator: 0n, denominator: 1n }]));
  const powered = demands.filter((row) => row.weight > 0n).sort((a, b) =>
    ascending(a.demand * b.weight, b.demand * a.weight) || byId(a.playerId, b.playerId));
  if (powered.length === 0) {
    // No surviving combat owner can claim this tier's space. This also makes a
    // cargo-only preview deterministic; such a fleet cannot capture a monument.
    if (demands.length === 0) return result;
    return capacityQuotas(capacity, demands.map((row) => ({ ...row, weight: 1n })));
  }
  let remaining = BigInt(capacity);
  let weight = powered.reduce((sum, row) => sum + row.weight, 0n);
  for (let index = 0; index < powered.length; index++) {
    const row = powered[index]!;
    const numerator = remaining * row.weight;
    if (row.demand * weight <= numerator) {
      result.set(row.playerId, { numerator: row.demand, denominator: 1n });
      remaining -= row.demand;
      weight -= row.weight;
    } else {
      for (const other of powered.slice(index)) {
        result.set(other.playerId, { numerator: remaining * other.weight, denominator: weight });
      }
      return result;
    }
  }
  // Powered owners' tier demand fits entirely. Their unused room can still hold
  // the higher-tier cargo of another participant before going to a lower tier.
  if (remaining > 0n) {
    const unpowered = demands.filter((row) => row.weight === 0n);
    for (const [playerId, quota] of capacityQuotas(Number(remaining), unpowered)) result.set(playerId, quota);
  }
  return result;
}

/**
 * Attack size is unrestricted here; HOLD alone is capped. Highest surviving tier
 * goes first. Within a contested tier, the whole surviving owner's combat power
 * sets a bulk quota, then indivisible remainders go to the largest quota shortfall.
 * Equivalent hulls retain their least damaged ships first. No cargo quota exists.
 */
export function selectMonumentHold(
  lots: readonly MonumentShipLot[],
  capacity = MONUMENT_CAPACITY,
): MonumentHoldSelection {
  if (!Number.isSafeInteger(capacity) || capacity < 0) throw new RangeError('bad monument capacity');
  const rows = normalizeMonumentLots(lots);
  const held = new Map(rows.map((row) => [row.id, 0]));
  const power = new Map<string, bigint>();
  for (const row of rows) {
    const unitPower = combatValue({ [row.hull]: 1 });
    if (!Number.isSafeInteger(unitPower)) throw new RangeError('non-integral monument combat power');
    power.set(row.playerId, (power.get(row.playerId) ?? 0n) + BigInt(unitPower) * BigInt(row.count));
  }
  let remaining = capacity;
  for (const tier of [4, 3, 2, 1]) {
    const inTier = rows.filter((row) => HULLS[row.hull].tier === tier);
    const totalDemand = inTier.reduce((sum, row) => sum + BigInt(row.count) * BigInt(hullBulk(row.hull)), 0n);
    if (totalDemand <= BigInt(remaining)) {
      for (const row of inTier) held.set(row.id, row.count);
      remaining -= Number(totalDemand);
      continue;
    }
    const byOwner = new Map<string, MonumentShipLot[]>();
    for (const row of inTier) {
      const existing = byOwner.get(row.playerId) ?? [];
      existing.push(row);
      byOwner.set(row.playerId, existing);
    }
    const owners = [...byOwner].sort(([a], [b]) => byId(a, b));
    for (const [, ownerLots] of owners) ownerLots.sort(withinOwner);
    const quotas = capacityQuotas(remaining, owners.map(([playerId, ownerLots]) => ({
      playerId, weight: power.get(playerId) ?? 0n,
      demand: ownerLots.reduce((sum, row) => sum + BigInt(row.count) * BigInt(hullBulk(row.hull)), 0n),
    })));
    const usedByOwner = new Map(owners.map(([id]) => [id, 0]));
    const keep = (row: MonumentShipLot, count: number): void => {
      held.set(row.id, (held.get(row.id) ?? 0) + count);
      const bulk = count * hullBulk(row.hull);
      usedByOwner.set(row.playerId, (usedByOwner.get(row.playerId) ?? 0) + bulk);
      remaining -= bulk;
    };
    for (const [playerId, ownerLots] of owners) {
      const quota = quotas.get(playerId)!;
      for (const row of ownerLots) {
        const bulk = hullBulk(row.hull);
        const left = quota.numerator - BigInt(usedByOwner.get(playerId) ?? 0) * quota.denominator;
        const count = Math.min(row.count, Number(left / (BigInt(bulk) * quota.denominator)), Math.floor(remaining / bulk));
        if (count > 0) keep(row, count);
      }
    }
    // Each floor left less than one eligible ship's bulk in its owner's quota.
    // The loop is over those indivisible leftovers, not over the full army.
    while (remaining > 0) {
      let chosen: { row: MonumentShipLot; deficit: bigint; denominator: bigint } | undefined;
      for (const [playerId, ownerLots] of owners) {
        const row = ownerLots.find((candidate) => (held.get(candidate.id) ?? 0) < candidate.count && hullBulk(candidate.hull) <= remaining);
        if (!row) continue;
        const quota = quotas.get(playerId)!;
        const deficit = quota.numerator - BigInt(usedByOwner.get(playerId) ?? 0) * quota.denominator;
        if (!chosen || deficit * chosen.denominator > chosen.deficit * quota.denominator) {
          chosen = { row, deficit, denominator: quota.denominator };
        }
      }
      if (!chosen) break;
      keep(chosen.row, 1);
    }
  }
  return {
    choices: rows.map((row) => ({ lotId: row.id, holdCount: held.get(row.id) ?? 0, returnCount: row.count - (held.get(row.id) ?? 0) })),
    usedCapacity: capacity - remaining,
    freeCapacity: remaining,
  };
}
