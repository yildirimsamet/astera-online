import { HULLS, fleetEntries } from './hulls.js';
import { resourceValue } from './valuation.js';
import type { Fleet, Resources } from './types.js';

/**
 * WHAT ONE RAID ACTUALLY DID, IN THE THREE SENSES OF "PROFIT" THAT ARE NOT THE SAME.
 *
 * THIS EXISTS BECAUSE THE SAME QUESTION WAS ANSWERED THREE TIMES AND GOT THREE ANSWERS, each time
 * because something different was counted:
 *
 *   · the wreck was counted as income, when lifting a 345,830-unit field needs 24 Garbage
 *     Collectors — 624,000 alloy-equivalent of hull and 336 Hangar bulk before a single unit comes
 *     home;
 *   · the loot was counted without the cargo the survivors could actually carry (61 Citadels hold
 *     28,975 raw units);
 *   · and the losses were priced on `fleetValue` (A+C+D, the Dominion base) while the fuel was
 *     priced on `resourceValue` (A+2C+32D, the replacement base), so the subtraction was between
 *     two different units.
 *
 * A SHARED UNIT NOBODY ENFORCES IS WORSE THAN NO UNIT, because everyone believes the numbers are
 * comparable. This is the enforcement.
 *
 * IT DERIVES, IT DOES NOT PREDICT. Every field of `RaidFacts` is something a settled battle already
 * recorded; there is deliberately no second model of the combat rules here to drift from the one
 * the server runs.
 */
export interface RaidFacts {
  /** Hulls the attacker lost for good — not rebuilt from their own wreckage. */
  attackerLosses: Fleet;
  /** Hulls the defender lost, net of whatever its ground defence rebuilt. Denial, never income. */
  defenderLosses: Fleet;
  /** Resources actually carried home, after `computeLoot` enforced the survivors' cargo. */
  loot: Resources;
  /** Resources the surviving collectors actually lifted. NOT the field they left behind. */
  salvage: Resources;
  /** Deuterium paid at launch. Never refunded, so an empty-handed raid still paid it. */
  fuelPaid: number;
  /** Hulls taken from the target. An asset, not liquidity — see `wealth`. */
  captured?: Fleet;
}

export interface RaidLedger {
  /** Loot + salvage − fuel. What the raid put in the bank today, per resource. */
  liquid: Resources;
  /** Liquid, less the replacement cost of the hulls that simply stopped existing. */
  replacement: Resources;
  /** Replacement, plus what the captured hulls are worth to build. */
  wealth: Resources;
  /**
   * What the defender was denied. It is Dominion's input and the attacker's argument for the
   * ladder; it is NOT in any of the three views above, because none of it arrives in a store.
   */
  denied: Resources;
  /** The same three, on the one valuation. Vectors stay primary: a positive AE can still strand a
   * commander with no deuterium for the next launch. */
  ae: { liquid: number; replacement: number; wealth: number };
}

const ZERO = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });

const add = (a: Resources, b: Resources): Resources => ({
  alloy: a.alloy + b.alloy,
  crystal: a.crystal + b.crystal,
  deuterium: a.deuterium + b.deuterium,
});

const minus = (a: Resources, b: Resources): Resources => ({
  alloy: a.alloy - b.alloy,
  crystal: a.crystal - b.crystal,
  deuterium: a.deuterium - b.deuterium,
});

/** What these hulls cost to build — the only sense in which a destroyed ship is a number. */
export function hullCost(fleet: Fleet): Resources {
  const out = ZERO();
  for (const [id, n] of fleetEntries(fleet)) {
    const hull = HULLS[id];
    out.alloy += n * hull.alloy;
    out.crystal += n * hull.crystal;
    out.deuterium += n * hull.deuterium;
  }
  return out;
}

export function raidLedger(facts: RaidFacts): RaidLedger {
  const liquid = minus(
    add(facts.loot, facts.salvage),
    { alloy: 0, crystal: 0, deuterium: facts.fuelPaid },
  );
  const replacement = minus(liquid, hullCost(facts.attackerLosses));
  const wealth = add(replacement, hullCost(facts.captured ?? {}));
  return {
    liquid,
    replacement,
    wealth,
    denied: hullCost(facts.defenderLosses),
    ae: {
      liquid: resourceValue(liquid),
      replacement: resourceValue(replacement),
      wealth: resourceValue(wealth),
    },
  };
}
