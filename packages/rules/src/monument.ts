import { HULLS, MOBILE_HULLS, combatValue } from './hulls.js';
import { hangarCapacity } from './economy.js';
import {
  applyHpDose,
  hpLethalAtMs,
  segmentsExposureHp,
  type HpDamageLots,
  type HpRadiationSource,
} from './radiationHp.js';
import type { Segment } from './radiation.js';
import { cargoMult, type TechLevels } from './tech.js';
import type { MobileHullId, Vec3 } from './types.js';

/** The approved first monument season deal; only a ruleset-16 season consumes it. */
const monumentRing = (radius: number): readonly Vec3[] => Array.from({ length: 5 }, (_, index) => {
  const angle = (index * 2 * Math.PI) / 5;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle), z: 0 };
});

export const MONUMENT_SEASON_DEFAULTS = {
  count: 5,
  radius: 6_000,
  cloudRadius: 1_000,
  intensityHpPerMinute: 4,
  productionPerMinute: 10,
  capacity: hangarCapacity(10),
  garrison: { LEVIATHAN: 10 },
  garrisonTech: {},
  positions: monumentRing(6_000),
} as const;

/**
 * A physical group of identical ships. Every member has the same damage and
 * carries the same fraction of this lot's total deuterium. Unequal health or
 * fill means separate lots, even inside one wave. IDs survive lazy settlement.
 *
 * `waveId` preserves the launch/origin and its research snapshot. Returning a
 * part creates new lot IDs; the server supplies the corresponding return wave.
 */
export interface MonumentShipLot {
  readonly id: string;
  readonly playerId: string;
  readonly waveId: string;
  readonly hull: MobileHullId;
  readonly count: number;
  readonly damageBp: number;
  readonly remainderBp: number;
  readonly deuterium: number;
  readonly tech: TechLevels;
}

export interface MonumentProductionShare {
  playerId: string;
  /** Gross amount loaded, including cargo subsequently lost to radiation. */
  deuterium: number;
}

export interface MonumentProduction {
  lots: MonumentShipLot[];
  shares: MonumentProductionShare[];
  discardedDeuterium: number;
}

export interface MonumentRadiationLoss {
  lots: MonumentShipLot[];
  /** The lots as they were immediately before destruction, including their load. */
  destroyed: MonumentShipLot[];
  lostDeuterium: number;
}

const MOBILE: ReadonlySet<string> = new Set(MOBILE_HULLS);
const byId = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const canonical = (a: MonumentShipLot, b: MonumentShipLot): number => byId(a.id, b.id);

function assertAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError(`bad monument amount ${String(amount)}`);
}

/** Physical per-ship holds; fractional resource units are never rounded on a read. */
export function monumentCargoCapacity(lot: MonumentShipLot): number {
  if (!MOBILE.has(lot.hull) || !Number.isSafeInteger(lot.count) || lot.count < 1) {
    throw new RangeError('bad monument ship group');
  }
  const capacity = HULLS[lot.hull].family === 'CARGO'
    ? HULLS[lot.hull].cargo * cargoMult(lot.tech) * lot.count
    : 0;
  assertAmount(capacity);
  return capacity;
}

/** Validated, copied and canonicalized, without merging independently loaded ships. */
export function normalizeMonumentLots(lots: readonly MonumentShipLot[]): MonumentShipLot[] {
  const ids = new Set<string>();
  const out: MonumentShipLot[] = [];
  for (const row of lots) {
    if (!row.id || !row.playerId || !row.waveId || ids.has(row.id)) throw new RangeError('bad monument lot identity');
    ids.add(row.id);
    const capacity = monumentCargoCapacity(row);
    assertAmount(row.deuterium);
    if (row.deuterium > capacity) throw new RangeError('monument cargo exceeds its physical hold');
    applyHpDose({ [row.hull]: row.count }, [row], 0, row.tech);
    out.push({ ...row, tech: { ...row.tech } });
  }
  return out.sort(canonical);
}

interface Owner {
  playerId: string;
  power: number;
  room: number;
}

function ownersOf(lots: readonly MonumentShipLot[]): Owner[] {
  const owners = new Map<string, Owner>();
  for (const row of lots) {
    const owner = owners.get(row.playerId) ?? { playerId: row.playerId, power: 0, room: 0 };
    owner.power += combatValue({ [row.hull]: row.count });
    owner.room += monumentCargoCapacity(row) - row.deuterium;
    assertAmount(owner.power);
    assertAmount(owner.room);
    owners.set(owner.playerId, owner);
  }
  return [...owners.values()].sort((a, b) => byId(a.playerId, b.playerId));
}

/**
 * Continuous weighted flow with capacity limits. The first cap/power threshold
 * drops out, then its unclaimed production flows to the remaining eligible owners.
 * This is exactly the fill-event split for a constant-power interval.
 */
function ownerShares(owners: readonly Owner[], amount: number): Map<string, number> {
  const shares = new Map(owners.map((row) => [row.playerId, 0]));
  const eligible = owners.filter((row) => row.power > 0 && row.room > 0).sort((a, b) =>
    a.room / a.power - b.room / b.power || byId(a.playerId, b.playerId));
  let remaining = amount;
  let power = eligible.reduce((sum, row) => sum + row.power, 0);
  assertAmount(power);
  for (let index = 0; index < eligible.length; index++) {
    const row = eligible[index]!;
    const share = remaining * (row.power / power);
    if (row.room <= share) {
      shares.set(row.playerId, row.room);
      remaining = Math.max(0, remaining - row.room);
      power -= row.power;
      continue;
    }
    // Everyone left has room for their weighted part. The last receives the
    // remaining float amount, so repeated division never drops whole resources.
    const rest = eligible.slice(index);
    let assigned = 0;
    for (let seat = 0; seat < rest.length; seat++) {
      const target = rest[seat]!;
      const paid = Math.min(target.room, seat === rest.length - 1 ? Math.max(0, remaining - assigned) : remaining * (target.power / power));
      shares.set(target.playerId, paid);
      assigned += paid;
    }
    break;
  }
  return shares;
}

/** Lower fill ratios catch up; existing cargo never moves between physical lots. */
function fillOwner(lots: readonly MonumentShipLot[], amount: number): MonumentShipLot[] {
  if (amount === 0) return [...lots];
  const cargo = lots.map((row) => ({ row, capacity: monumentCargoCapacity(row) }))
    .filter((row) => row.capacity > 0)
    .sort((a, b) => a.row.deuterium / a.capacity - b.row.deuterium / b.capacity || canonical(a.row, b.row));
  let activeCapacity = 0;
  let initialLoad = 0;
  let fillRatio = 1;
  for (let index = 0; index < cargo.length; index++) {
    const current = cargo[index]!;
    activeCapacity += current.capacity;
    initialLoad += current.row.deuterium;
    assertAmount(activeCapacity);
    assertAmount(initialLoad);
    const next = cargo[index + 1];
    const nextRatio = next ? next.row.deuterium / next.capacity : 1;
    if (amount <= nextRatio * activeCapacity - initialLoad) {
      fillRatio = Math.min(1, (initialLoad + amount) / activeCapacity);
      break;
    }
  }
  return lots.map((row) => {
    const capacity = monumentCargoCapacity(row);
    return { ...row, deuterium: Math.min(capacity, Math.max(row.deuterium, capacity * fillRatio)) };
  });
}

/** Fixed monument output goes only into each eligible owner's own dedicated cargo. */
export function produceMonumentDeuterium(lots: readonly MonumentShipLot[], amount: number): MonumentProduction {
  assertAmount(amount);
  const rows = normalizeMonumentLots(lots);
  const owners = ownersOf(rows);
  return loadMonumentShares(rows, owners, amount);
}

function loadMonumentShares(rows: readonly MonumentShipLot[], owners: readonly Owner[], amount: number): MonumentProduction {
  const paid = ownerShares(owners, amount);
  const filled = owners.flatMap((owner) => fillOwner(rows.filter((row) => row.playerId === owner.playerId), paid.get(owner.playerId) ?? 0));
  const shares = owners.map((owner) => ({ playerId: owner.playerId, deuterium: paid.get(owner.playerId) ?? 0 }));
  const loaded = shares.reduce((sum, share) => sum + share.deuterium, 0);
  return { lots: filled.sort(canonical), shares, discardedDeuterium: Math.max(0, amount - loaded) };
}

/**
 * PvP loot keeps ordinary joint loot's capped equal-owner split, independently
 * of production's power weights. Only actual destroyed enemy loads are offered;
 * physical fractional units stay aboard rather than being rounded per ship.
 */
export function lootMonumentDeuterium(
  survivors: readonly MonumentShipLot[],
  destroyedEnemy: readonly MonumentShipLot[],
): MonumentProduction {
  const rows = normalizeMonumentLots(survivors);
  const enemy = normalizeMonumentLots(destroyedEnemy);
  const owners = ownersOf(rows);
  const own = new Set(owners.map((owner) => owner.playerId));
  if (enemy.some((row) => own.has(row.playerId))) throw new RangeError('a monument owner cannot loot their own cargo');
  const amount = enemy.reduce((sum, row) => sum + row.deuterium, 0);
  assertAmount(amount);
  return loadMonumentShares(rows, owners.map((owner) => ({ ...owner, power: 1 })), amount);
}

export interface MonumentShipBattleOutcome {
  survivors: number;
  damage: HpDamageLots;
}

/**
 * One source lot after combat. Casualties take their proportional original load;
 * differing surviving health states become new physical lots supplied by the server.
 */
export function splitMonumentBattleSurvivors(
  source: MonumentShipLot,
  outcome: MonumentShipBattleOutcome,
  newLotIds: readonly string[],
): { lots: MonumentShipLot[]; destroyedCount: number; destroyedDeuterium: number } {
  normalizeMonumentLots([source]);
  if (!Number.isSafeInteger(outcome.survivors) || outcome.survivors < 0 || outcome.survivors > source.count) {
    throw new RangeError('bad monument battle survivor count');
  }
  const fleet = { [source.hull]: outcome.survivors };
  const damage = applyHpDose(fleet, outcome.damage, 0, source.tech).lots;
  const groups = damage.map((row) => ({ count: row.count, damageBp: row.damageBp, remainderBp: row.remainderBp ?? 0 }));
  const healthy = outcome.survivors - groups.reduce((sum, row) => sum + row.count, 0);
  if (healthy > 0) groups.push({ count: healthy, damageBp: 0, remainderBp: 0 });
  const minDamage = source.damageBp + source.remainderBp;
  if (groups.some((row) => row.damageBp + row.remainderBp + 1e-8 < minDamage)) {
    throw new RangeError('monument battle cannot heal its survivors');
  }
  if (newLotIds.length !== groups.length || newLotIds.some((id) => !id) || new Set(newLotIds).size !== newLotIds.length) {
    throw new RangeError('bad monument battle lot identities');
  }
  const lots = groups.map((row, index) => {
    const preserve = row.damageBp + row.remainderBp < minDamage;
    const kept: MonumentShipLot = {
      ...source, ...row, id: newLotIds[index]!,
      damageBp: preserve ? source.damageBp : row.damageBp,
      remainderBp: preserve ? source.remainderBp : row.remainderBp,
      deuterium: source.deuterium * (row.count / source.count),
    };
    return { ...kept, deuterium: Math.min(monumentCargoCapacity(kept), kept.deuterium) };
  });
  const destroyedCount = source.count - outcome.survivors;
  return { lots: normalizeMonumentLots(lots), destroyedCount, destroyedDeuterium: source.deuterium * (destroyedCount / source.count) };
}

export interface MonumentRecallSelection {
  lotId: string;
  count: number;
  /** A new identity supplied by the server; never reused from a HOLD lot. */
  returnLotId: string;
}

/** Selected physical ships keep their health, owner, provenance and own cargo. */
export function recallMonumentShips(
  lots: readonly MonumentShipLot[],
  playerId: string,
  selections: readonly MonumentRecallSelection[],
): { remaining: MonumentShipLot[]; recalled: MonumentShipLot[] } {
  const rows = normalizeMonumentLots(lots);
  const ids = new Set(rows.map((row) => row.id));
  const selected = new Map<string, MonumentRecallSelection>();
  for (const selection of selections) {
    const row = rows.find((candidate) => candidate.id === selection.lotId);
    if (row?.playerId !== playerId || selected.has(selection.lotId)
      || !Number.isSafeInteger(selection.count) || selection.count < 1 || selection.count > row.count
      || !selection.returnLotId || ids.has(selection.returnLotId)) {
      throw new RangeError('invalid monument recall selection');
    }
    ids.add(selection.returnLotId);
    selected.set(selection.lotId, selection);
  }
  const remaining: MonumentShipLot[] = [];
  const recalled: MonumentShipLot[] = [];
  for (const row of rows) {
    const selection = selected.get(row.id);
    if (!selection) {
      remaining.push(row);
      continue;
    }
    const taken = row.deuterium * (selection.count / row.count);
    recalled.push({ ...row, id: selection.returnLotId, count: selection.count, deuterium: taken });
    if (selection.count < row.count) remaining.push({ ...row, count: row.count - selection.count, deuterium: row.deuterium - taken });
  }
  return { remaining, recalled: recalled.sort(canonical) };
}

/** Uniform per-ship HP damage, without transferring a dying transport's cargo. */
export function applyMonumentHpDose(lots: readonly MonumentShipLot[], doseHp: number): MonumentRadiationLoss {
  assertAmount(doseHp);
  const rows = normalizeMonumentLots(lots);
  const survivors: MonumentShipLot[] = [];
  const destroyed: MonumentShipLot[] = [];
  let lostDeuterium = 0;
  for (const row of rows) {
    const outcome = applyHpDose({ [row.hull]: row.count }, [row], doseHp, row.tech);
    if ((outcome.fleet[row.hull] ?? 0) === 0) {
      destroyed.push(row);
      lostDeuterium += row.deuterium;
    } else {
      const damage = outcome.lots[0];
      survivors.push({ ...row, damageBp: damage?.damageBp ?? 0, remainderBp: damage?.remainderBp ?? 0 });
    }
  }
  assertAmount(lostDeuterium);
  return { lots: survivors, destroyed, lostDeuterium };
}

export interface MonumentHoldWindow {
  fromMs: number;
  toMs: number;
  position: Vec3;
  productionPerMinute: number;
  sources: readonly HpRadiationSource[];
}

export interface MonumentHoldSettlement extends MonumentProduction, MonumentRadiationLoss {
  producedDeuterium: number;
}

/**
 * A genuinely stationary HOLD interval. Callers split it at arrivals, recalls,
 * battles and membership changes. Here the first HP casualty splits it again:
 * production before death uses the old fleet, afterwards uses only survivors.
 * Cargo filling is solved continuously inside each of those constant-power spans.
 */
export function settleMonumentHold(lots: readonly MonumentShipLot[], window: MonumentHoldWindow): MonumentHoldSettlement {
  const { fromMs, toMs, position, productionPerMinute, sources } = window;
  if (!Number.isSafeInteger(fromMs) || !Number.isSafeInteger(toMs) || fromMs < 0 || toMs < fromMs) {
    throw new RangeError('bad monument HOLD window');
  }
  assertAmount(productionPerMinute);
  const segment = (startMs: number, endMs: number): Segment[] => [{ from: position, to: position, startMs, endMs }];
  // Validate geometry/history even for an empty or zero-duration holding.
  segmentsExposureHp(segment(fromMs, toMs), sources);
  let rows = normalizeMonumentLots(lots);
  const paid = new Map(ownersOf(rows).map((owner) => [owner.playerId, 0]));
  const destroyed: MonumentShipLot[] = [];
  let cursor = fromMs;
  let lostDeuterium = 0;
  let discardedDeuterium = 0;
  const producedDeuterium = productionPerMinute * ((toMs - fromMs) / 60_000);
  assertAmount(producedDeuterium);
  while (cursor < toMs) {
    let until = toMs;
    for (const row of rows) {
      const death = hpLethalAtMs(segment(cursor, toMs), sources, { ...row });
      if (death !== null) until = Math.min(until, death);
    }
    const production = produceMonumentDeuterium(rows, productionPerMinute * ((until - cursor) / 60_000));
    for (const share of production.shares) paid.set(share.playerId, (paid.get(share.playerId) ?? 0) + share.deuterium);
    discardedDeuterium += production.discardedDeuterium;
    const loss = applyMonumentHpDose(production.lots, segmentsExposureHp(segment(cursor, until), sources));
    destroyed.push(...loss.destroyed);
    lostDeuterium += loss.lostDeuterium;
    rows = loss.lots;
    cursor = until;
  }
  return {
    lots: rows, destroyed, lostDeuterium, discardedDeuterium, producedDeuterium,
    shares: [...paid].map(([playerId, deuterium]) => ({ playerId, deuterium })),
  };
}
