import { SHIP_DAMAGE } from './constants.js';
import { hullWorkMinutes } from './economy.js';
import { HULLS, fleetEntries } from './hulls.js';
import { normalizeHpDamage, type HpDamageLot, type HpDamageLots } from './radiationHp.js';
import type { TechLevels } from './tech.js';
import type { Fleet, Resources } from './types.js';

export interface HpLanding {
  home: Fleet;
  autoRepaired: HpDamageLot[];
  docked: HpDamageLot[];
}

/** Compare components: 2000 + a subnormal fraction can round back to 2000. */
export const needsHpDock = (lot: Pick<HpDamageLot, 'damageBp' | 'remainderBp'>): boolean =>
  lot.damageBp > SHIP_DAMAGE.autoRepairMaxBp
  || (lot.damageBp === SHIP_DAMAGE.autoRepairMaxBp && (lot.remainderBp ?? 0) > 0);

/** The ordinary landing decision with the entire carried wound preserved. */
export function splitForHpLanding(fleet: Fleet, lots: HpDamageLots | null | undefined): HpLanding {
  const damaged = normalizeHpDamage(fleet, lots);
  const home: Fleet = Object.fromEntries(fleetEntries(fleet));
  const autoRepaired: HpDamageLot[] = [];
  const docked: HpDamageLot[] = [];
  for (const lot of damaged) {
    if (!needsHpDock(lot)) autoRepaired.push(lot);
    else {
      docked.push(lot);
      home[lot.hull] = (home[lot.hull] ?? 0) - lot.count;
    }
  }
  return { home: Object.fromEntries(fleetEntries(home)), autoRepaired, docked };
}

function repairLots(lots: HpDamageLots, pct: number): HpDamageLot[] {
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) throw new RangeError('bad HP repair share');
  const fleet: Fleet = {};
  for (const lot of lots) fleet[lot.hull] = (fleet[lot.hull] ?? 0) + lot.count;
  return normalizeHpDamage(fleet, lots);
}

/** Exact decimal ratio of the persisted number, including 5e-324. */
function fractionRatio(value: number): { num: bigint; den: bigint } {
  if (value === 0) return { num: 0n, den: 1n };
  const [mantissa = '0', exponent = '0'] = String(value).split('e');
  const [integer = '0', decimals = ''] = mantissa.split('.');
  return { num: BigInt(integer + decimals), den: 10n ** BigInt(decimals.length - Number(exponent)) };
}

function ceilHpShare(price: number, lot: HpDamageLot, pct: number): number {
  const fraction = fractionRatio(lot.remainderBp ?? 0);
  const numerator = BigInt(price) * BigInt(lot.count) * BigInt(pct)
    * (BigInt(lot.damageBp) * fraction.den + fraction.num);
  const denominator = BigInt(SHIP_DAMAGE.destroyedBp * 100) * fraction.den;
  const amount = numerator / denominator + (numerator % denominator > 0n ? 1n : 0n);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('HP repair invoice exceeds integer range');
  return Number(amount);
}

/** Same per-lot upward integer invoice as legacy repairs, with the fraction included. */
export function shipHpRepairCost(lots: HpDamageLots, pct: number): Resources {
  const cost: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const lot of repairLots(lots, pct)) {
    const hull = HULLS[lot.hull];
    cost.alloy += ceilHpShare(hull.alloy, lot, pct);
    cost.crystal += ceilHpShare(hull.crystal, lot, pct);
    cost.deuterium += ceilHpShare(hull.deuterium, lot, pct);
  }
  if (!Object.values(cost).every(Number.isSafeInteger)) throw new RangeError('HP repair cost exceeds integer range');
  return cost;
}

/** Research and yard are read at repair start, as in existing Repair Station jobs. */
export function shipHpRepairMinutes(lots: HpDamageLots, yard: number, tech: TechLevels, pct: number): number {
  const minutes = repairLots(lots, pct).reduce((sum, lot) => sum
    + hullWorkMinutes(lot.hull, lot.count, yard, tech) * ((lot.damageBp + (lot.remainderBp ?? 0)) / SHIP_DAMAGE.destroyedBp) * (pct / 100), 0);
  if (!Number.isFinite(minutes) || minutes < 0) throw new RangeError('bad HP repair duration');
  return minutes;
}
