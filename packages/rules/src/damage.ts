import { MULTI_WORLD, SHIP_DAMAGE } from './constants.js';
import { hullWorkMinutes } from './economy.js';
import { claimDebris } from './galaxy.js';
import { ALL_HULLS, HULLS, fleetCargo, fleetEntries } from './hulls.js';
import { salvageCapacity } from './salvage.js';
import type { TechLevels } from './tech.js';
import type { Fleet, HullId, Resources } from './types.js';

/**
 * KALICI GEMİ HASARI — the pure half of persistent ship damage. Owner decision,
 * 2026-09-29 (`plan.md`).
 *
 * A battle already carried a part-damaged ship from one round into the next; it threw
 * that damage away when the battle ended. From ruleset 14 it stays on the ship. So does
 * radiation's. Both land in the one shape below, and every rule about what damage
 * MEANS — free patching, the dock, destruction, the repair bill — is in this file.
 *
 * `units` STAYS THE ONLY RECORD OF HOW MANY SHIPS EXIST. A lot says how damaged some of
 * them are; it never says there are more of them than `units` does.
 */

/** Some ships of one hull, all equally damaged. `damageBp` is 1..9999 of a full hull. */
export interface DamageLot {
  readonly hull: HullId;
  readonly count: number;
  readonly damageBp: number;
}

/** A fleet's damaged ships. A ship listed nowhere here is at full hull. */
export type DamageLots = readonly DamageLot[];

/** Whether a season was dealt persistent damage. Never inside a running one. */
export const shipDamageApplies = (rulesetVersion: number): boolean =>
  rulesetVersion >= MULTI_WORLD.shipDamageRulesetVersion;

/** Above the owner's twenty percent a ship waits for the Repair Station; at or under it, it is patched free. */
export const needsDock = (damageBp: number): boolean => damageBp > SHIP_DAMAGE.autoRepairMaxBp;

/**
 * WHERE A DOCKED LOT STANDS IN `units`. Namespaced like `mine:<run>` and the raid and
 * trade locations, so every reader of `home` — the launch lanes and the defending line —
 * refuses these ships without being told about the dock at all.
 */
export const dockLocation = (lotId: string): string => `dock:${lotId}`;
export const isDockLocation = (location: string): boolean => location.startsWith('dock:');

/**
 * THE LEFTOVER HIT A BATTLE ENDS ON, AS DAMAGE ON ONE SURVIVOR.
 *
 * A sliver rounds to healthy. A survivor never rounds to destroyed: whatever is left of
 * its hull, it is still flying, so the ceiling is one basis point short of a full hull.
 */
export function carryToBp(carry: number, hp: number): number {
  if (!(hp > 0) || !(carry >= 0) || !(carry < hp)) {
    throw new RangeError(`a survivor cannot carry ${String(carry)} of ${String(hp)} hull`);
  }
  return Math.min(SHIP_DAMAGE.destroyedBp - 1, Math.round((carry / hp) * SHIP_DAMAGE.destroyedBp));
}

const HULL_ORDER = new Map<HullId, number>(ALL_HULLS.map((id, index) => [id, index]));

/**
 * ONE ROW PER IDENTICAL DAMAGE STATE, in the order a battle kills them: catalogue order,
 * then the most damaged first. Empty and undamaged rows fall away; a malformed one is
 * refused rather than read as something it might have meant.
 */
export function normalizeLots(lots: DamageLots | null | undefined): DamageLot[] {
  const merged = new Map<string, DamageLot>();
  for (const row of lots ?? []) {
    if (!HULL_ORDER.has(row.hull)) throw new RangeError(`unknown hull ${row.hull}`);
    if (!Number.isInteger(row.count) || row.count < 0) {
      throw new RangeError(`bad damaged-ship count ${String(row.count)}`);
    }
    if (!Number.isInteger(row.damageBp) || row.damageBp < 0 || row.damageBp >= SHIP_DAMAGE.destroyedBp) {
      throw new RangeError(`bad damage ${String(row.damageBp)}`);
    }
    if (row.count === 0 || row.damageBp === 0) continue;
    const key = `${row.hull}:${String(row.damageBp)}`;
    merged.set(key, { hull: row.hull, count: (merged.get(key)?.count ?? 0) + row.count, damageBp: row.damageBp });
  }
  return [...merged.values()].sort((a, b) =>
    (HULL_ORDER.get(a.hull) ?? 0) - (HULL_ORDER.get(b.hull) ?? 0) || b.damageBp - a.damageBp);
}

const positive = (fleet: Fleet): Fleet => {
  const out: Fleet = {};
  for (const [hull, count] of fleetEntries(fleet)) out[hull] = count;
  return out;
};

/** Damage may only be carried by ships that exist. */
export function assertDamageCarried(fleet: Fleet, lots: DamageLots): void {
  const damaged: Fleet = {};
  for (const row of lots) damaged[row.hull] = (damaged[row.hull] ?? 0) + row.count;
  for (const [hull, count] of fleetEntries(damaged)) {
    if (count > (fleet[hull] ?? 0)) {
      throw new RangeError(`${String(count)} damaged ${hull} in a fleet of ${String(fleet[hull] ?? 0)}`);
    }
  }
}

/**
 * THE DAMAGE THAT GOES WITH PART OF A FLEET. A transfer that leaves some hull types at
 * the far world and sends the rest home splits by hull, so each part takes exactly the
 * lots of the hulls in it.
 */
export function lotsWithin(lots: DamageLots | null | undefined, part: Fleet): DamageLot[] {
  const kept = normalizeLots(lots).filter((lot) => (part[lot.hull] ?? 0) > 0);
  assertDamageCarried(part, kept);
  return kept;
}

export interface Landing {
  /** Every ship that stands at home after landing: the healthy and the patched. */
  home: Fleet;
  /** Patched free on landing. Reported to the commander, never stored. */
  autoRepaired: DamageLot[];
  /** Waiting in the Repair Station. */
  docked: DamageLot[];
}

/**
 * WHAT THE REPAIR STATION DECIDES WHEN SHIPS TOUCH DOWN — or when a defender's battle
 * ends, which is the same judgement with no flight in front of it.
 */
export function splitForLanding(fleet: Fleet, lots: DamageLots | null | undefined): Landing {
  const damaged = normalizeLots(lots);
  assertDamageCarried(fleet, damaged);
  const home = positive(fleet);
  const autoRepaired: DamageLot[] = [];
  const docked: DamageLot[] = [];
  for (const row of damaged) {
    if (!needsDock(row.damageBp)) {
      autoRepaired.push(row);
      continue;
    }
    docked.push(row);
    home[row.hull] = (home[row.hull] ?? 0) - row.count;
  }
  return { home: positive(home), autoRepaired, docked };
}

export interface DoseOutcome {
  fleet: Fleet;
  lots: DamageLot[];
  destroyed: Fleet;
}

/**
 * ENVIRONMENTAL DAMAGE, THE SAME SHARE ON EVERY SHIP.
 *
 * Radiation is a share of a full hull per minute, so a Dart and a Citadel caught in the
 * same cloud for the same minutes take the same share. A ship already damaged simply
 * reaches a full hull sooner, and a ship that reaches it is gone.
 */
export function applyDose(fleet: Fleet, lots: DamageLots | null | undefined, doseBp: number): DoseOutcome {
  if (!Number.isInteger(doseBp) || doseBp < 0) throw new RangeError(`bad radiation dose ${String(doseBp)}`);
  const damaged = normalizeLots(lots);
  assertDamageCarried(fleet, damaged);
  if (doseBp === 0) return { fleet: positive(fleet), lots: damaged, destroyed: {} };

  const rows: DamageLot[] = [...damaged];
  const damagedCount: Fleet = {};
  for (const row of damaged) damagedCount[row.hull] = (damagedCount[row.hull] ?? 0) + row.count;
  for (const [hull, count] of fleetEntries(fleet)) {
    const healthy = count - (damagedCount[hull] ?? 0);
    if (healthy > 0) rows.push({ hull, count: healthy, damageBp: 0 });
  }

  const survivors = positive(fleet);
  const destroyed: Fleet = {};
  const kept: DamageLot[] = [];
  for (const row of rows) {
    const damageBp = row.damageBp + doseBp;
    if (damageBp < SHIP_DAMAGE.destroyedBp) {
      kept.push({ hull: row.hull, count: row.count, damageBp });
      continue;
    }
    destroyed[row.hull] = (destroyed[row.hull] ?? 0) + row.count;
    survivors[row.hull] = (survivors[row.hull] ?? 0) - row.count;
  }
  return { fleet: positive(survivors), lots: normalizeLots(kept), destroyed };
}

/**
 * WHAT A WING CARRIES IS WHAT ITS SURVIVORS CAN HOLD. Plan D9.
 *
 * A ship a cloud finished took its hold with it: the loot is cut to the surviving
 * cargo, the lifted wreck to the surviving collectors, each in its own proportions and
 * floored per column — `claimDebris`, the same arithmetic that filled them. The last
 * ship takes the last of it. Applied BEFORE a clan's share is dealt, so the clan is
 * dealt what landed.
 */
export function capLoadToSurvivors(
  load: { loot: Resources | null; salvage: Resources | null },
  survivors: Fleet,
  tech: TechLevels,
): { loot: Resources | null; salvage: Resources | null } {
  const fit = (what: Resources | null, room: number): Resources | null =>
    what === null ? null : claimDebris(what.alloy, what.crystal, what.deuterium, room);
  return {
    loot: fit(load.loot, fleetCargo(survivors, tech)),
    salvage: fit(load.salvage, salvageCapacity(survivors)),
  };
}

/* ── the Repair Station's price and time ─────────────────────────── */

const REPAIR_SCALE = SHIP_DAMAGE.destroyedBp * 100;

function assertRepair(count: number, damageBp: number, pct: number): void {
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`bad repair count ${String(count)}`);
  if (!Number.isInteger(damageBp) || damageBp < 1 || damageBp >= SHIP_DAMAGE.destroyedBp) {
    throw new RangeError(`bad repair damage ${String(damageBp)}`);
  }
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) throw new RangeError(`bad repair share ${String(pct)}`);
}

/**
 * ROUNDED UP, AND IN INTEGERS. A float product such as 700 × 0.07 lands a hair above 49
 * and a ceiling taken on it charges 50, so the division is exact: quotient plus one when
 * anything remains.
 */
function ceilShare(price: number, count: number, damageBp: number, pct: number): number {
  const numerator = price * count * damageBp * pct;
  if (!Number.isSafeInteger(numerator) || numerator < 0) {
    throw new RangeError(`repair price out of range for ${String(count)} at ${String(price)}`);
  }
  const remainder = numerator % REPAIR_SCALE;
  return (numerator - remainder) / REPAIR_SCALE + (remainder > 0 ? 1 : 0);
}

/**
 * THE DAMAGED SHARE OF WHAT THE SHIPS COST TO BUILD, every production resource, deuterium
 * included. `pct` is the share Industrial leaves (100, 75 or 50).
 */
export function shipRepairInvoice(
  unit: Pick<Resources, 'alloy' | 'crystal' | 'deuterium'>,
  count: number,
  damageBp: number,
  pct: number,
): Resources {
  assertRepair(count, damageBp, pct);
  return {
    alloy: ceilShare(unit.alloy, count, damageBp, pct),
    crystal: ceilShare(unit.crystal, count, damageBp, pct),
    deuterium: ceilShare(unit.deuterium, count, damageBp, pct),
  };
}

/** Every lot at the catalogue price, invoiced lot by lot. */
export function shipRepairCost(lots: DamageLots, pct: number): Resources {
  const out: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const row of normalizeLots(lots)) {
    const bill = shipRepairInvoice(HULLS[row.hull], row.count, row.damageBp, pct);
    out.alloy += bill.alloy;
    out.crystal += bill.crystal;
    out.deuterium += bill.deuterium;
  }
  return out;
}

/** The damaged share of a production time. Ten minutes at forty percent is four. */
export function shipRepairWorkMinutes(productionMinutes: number, damageBp: number, pct: number): number {
  assertRepair(1, damageBp, pct);
  if (!Number.isFinite(productionMinutes) || productionMinutes < 0) {
    throw new RangeError(`bad production time ${String(productionMinutes)}`);
  }
  return productionMinutes * (damageBp / SHIP_DAMAGE.destroyedBp) * (pct / 100);
}

/**
 * THE YARD'S OWN TIME FOR THESE SHIPS, AT THIS WORLD. `yard` and `tech` are read when the
 * repair starts, exactly as a hull order reads them, so the Shipyard and Yard Automation
 * shorten a repair the way they shorten a build.
 */
export function shipRepairMinutes(lots: DamageLots, yard: number, tech: TechLevels, pct: number): number {
  let minutes = 0;
  for (const row of normalizeLots(lots)) {
    minutes += shipRepairWorkMinutes(hullWorkMinutes(row.hull, row.count, yard, tech), row.damageBp, pct);
  }
  return minutes;
}
