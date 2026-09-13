/** Shared executable economy. No I/O, clock, mutable selection or runtime dependencies. */
import type { BuildingId, Hull, ResearchProjectId, Resources } from './types.js';
import { resourceValue } from './valuation.js';

/**
 * `tradeShip` AND `asteroidShower` SHIP ON, AND THE ECONOMY IS STILL MEASURED
 * WITHOUT THEM. Owner instruction, 2026-09-12: *"asteroid shower, tradeShip
 * eventleri açılacak! sadece ekonomi testlerine dahil edilmeyecek. Bu ARR falan
 * hesaplamalarına!"*
 *
 * These are the GAME's switches: `seedGalaxyEventCalendar` deals a season its
 * showers and merchant windows only while they are on. They were false from
 * 2026-09-10 as a measurement state, which cost every new season its calendar.
 *
 * THE MEASUREMENT NO LONGER NEEDS THEM OFF. ARR, VFR and the rest are derived
 * against what a commander PRODUCES — D183's rule that every outside income is a
 * share of a frozen reference needs that reference measured clean — and the
 * simulator gets that by construction: it mines the base asteroid field and never
 * deals a calendar, a shower lane or a merchant. `packages/sim/test/economy-scope.test.ts`
 * holds that construction; do not reach for these flags to keep an event out of a
 * balance reading.
 */
export const ECONOMY_PROFILE: Readonly<{
  id: string; progressionDays: number; seasonDays: number; collectorHours: number;
  propulsionPerLevel: number; distanceFactor: number; tradeShip: boolean; asteroidShower: boolean;
}> = {
  id: 'season-30-v1', progressionDays: 30, seasonDays: 30,
  collectorHours: 10, propulsionPerLevel: 0.125, distanceFactor: 1.2,
  tradeShip: true, asteroidShower: true,
} as const;

/** Frozen output of the paid, isolated 30-day reference; not a live-player income multiplier. */
export const MONTHLY_REFERENCE: Readonly<Resources> = {
  alloy: 1517487.4114387825, crystal: 744575.7697515059, deuterium: 20230.384213232468,
};

export const SETTLEMENT_CAPITAL: Resources = { alloy: 800, crystal: 400, deuterium: 0 };
export const SETTLEMENT_FEE: Resources = { alloy: 200, crystal: 100, deuterium: 0 };
export const SETTLEMENT_CHARGE: Resources = {
  alloy: SETTLEMENT_CAPITAL.alloy + SETTLEMENT_FEE.alloy,
  crystal: SETTLEMENT_CAPITAL.crystal + SETTLEMENT_FEE.crystal,
  deuterium: SETTLEMENT_CAPITAL.deuterium + SETTLEMENT_FEE.deuterium,
};

const keys = ['alloy', 'crystal', 'deuterium'] as const;
const finite = (n: number) => Number.isFinite(n) && n >= 0;
const rung = (n: number) => {
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('Invalid design level');
};

const horizonScale = (days: number = ECONOMY_PROFILE.progressionDays) => {
  if (!Number.isInteger(days) || days < 7 || days > 365) throw new Error('Invalid progression horizon');
  return days / 14;
};

/** Design reference income at a producer level. Not granted income at a calendar day. */
export function profileIncome(level: number): Resources {
  if (!Number.isInteger(level) || level < 0 || level > 100) throw new Error('Invalid income level');
  return { alloy: 100 * level ** 1.3, crystal: 50 * level ** 1.3, deuterium: 4 * level ** 1.2 };
}

/** Each component consumes its own reference production-hours; there is no automatic conversion. */
export function profileInvoice(income: Resources, hours: Resources): Resources {
  if (keys.some(k => !finite(income[k]) || !finite(hours[k]))) throw new Error('Invalid invoice input');
  return { alloy: Math.ceil(income.alloy * hours.alloy), crystal: Math.ceil(income.crystal * hours.crystal),
    deuterium: Math.ceil(income.deuterium * hours.deuterium) };
}

/**
 * THE LAST YARD RUNG THAT UNLOCKS A HULL. D185.
 *
 * Written here rather than read from `HULLS`, which imports this file — the cycle
 * is the reason, not a preference. `yard-ladder.test.ts` holds it against
 * `max(minShipyard)` so the two can never part company.
 *
 * Below it the Yard sells hull TIERS and is priced on the economy it supports.
 * Above it there is nothing left to unlock and it sells THROUGHPUT, which grows by
 * a flat rung; see `profileBuilding`.
 */
export const YARD_GATE_TOP = 6;

// The calibrated monthly curve preserves the first three economic rungs.
const stretch = (level: number, days: number = ECONOMY_PROFILE.progressionDays) =>
  level <= 3 ? 1 : horizonScale(days);

export interface ProfileBuilding {
  cost: Resources;
  minutes: number;
  referenceLevel: number;
  repaymentHours: number;
  recipeHours: Resources;
}

/**
 * Prices follow marginal production and increasing repayment horizons; timers are
 * separately authored work.
 *
 * THE RETURN TYPE IS WRITTEN OUT because the Yard's flat regime asks this function
 * for its own gate rung, and TypeScript cannot infer through that call.
 */
export function profileBuilding(
  id: BuildingId, level: number, days: number = ECONOMY_PROFILE.progressionDays,
): ProfileBuilding {
  rung(level); horizonScale(days);
  const income = profileIncome(level), previous = profileIncome(level - 1);
  const delta = { alloy: income.alloy - previous.alloy, crystal: income.crystal - previous.crystal,
    deuterium: income.deuterium - previous.deuterium };
  const horizon = 0.5 * 1.5 ** (level - 1) * stretch(level, days);
  const labor = Math.min(480, 2 * 1.36 ** (level - 1));
  const shares: Record<BuildingId, Resources> = {
    REFINERY: { alloy: 0.8, crystal: 0.2, deuterium: 0 },
    EXTRACTOR: { alloy: 0.4, crystal: 0.6, deuterium: 0 },
    CORE: { alloy: 0.65, crystal: 0.35, deuterium: 0 },
    VAULT: { alloy: 0.8, crystal: 0.8, deuterium: 0 },
    SHIPYARD: { alloy: 1.3, crystal: 1, deuterium: 0 },
    DEUTERIUM_PLANT: { alloy: 0.6, crystal: 1.2, deuterium: 0 },
  };
  // The Yard has fewer rungs than the producers, so its price uses the economic stage it supports.
  const referenceLevel = id === 'SHIPYARD' ? Math.min(30, level * 2) : level;
  const reference = profileIncome(referenceLevel), before = profileIncome(referenceLevel - 1);
  const effectiveDelta = id === 'SHIPYARD'
    ? { alloy: reference.alloy - before.alloy, crystal: reference.crystal - before.crystal, deuterium: 0 } : delta;
  const h = id === 'SHIPYARD'
    ? 0.5 * 1.5 ** (referenceLevel - 1) * stretch(referenceLevel, days) : horizon;
  const hours = { alloy: h * shares[id].alloy, crystal: h * shares[id].crystal, deuterium: 0 };

  /**
   * PAST THE LAST GATE THE YARD SELLS A STRAIGHT LINE, SO IT COSTS ONE. D185.
   *
   * `yardThroughput` adds a flat rung of speed at every level, and this curve was
   * charging `1.5 ** (2 * level)` for it: rung 12 cost 1,912 hours of production —
   * eighty days of a thirty-day season — against the Command Core's 5.5 at the same
   * level, and the whole ladder above the gate came to three hundred times what a
   * season produces. Nobody bought it, which is the quiet failure: a rung nobody
   * can reach is not a decision, it is a row on a screen.
   *
   * Constant marginal effect, constant marginal price — held in HOURS, the unit
   * every other price here is written in, so a commander pays the same TIME for the
   * same speed at any stage and the resource figure grows only because their hour
   * is worth more. The gate rungs are untouched: this prices the half that had no
   * price, it does not discount the catalogue.
   */
  if (id === 'SHIPYARD' && level > YARD_GATE_TOP) {
    const gate = profileBuilding('SHIPYARD', YARD_GATE_TOP, days);
    const gateIncome = profileIncome(YARD_GATE_TOP);
    const own = profileIncome(level);
    const flat = {
      alloy: gate.cost.alloy / gateIncome.alloy,
      crystal: gate.cost.crystal / gateIncome.crystal,
      deuterium: 0,
    };
    return { cost: profileInvoice(own, flat), minutes: labor,
      referenceLevel, repaymentHours: h, recipeHours: flat };
  }

  return { cost: profileInvoice(effectiveDelta, hours), minutes: labor,
    referenceLevel, repaymentHours: h, recipeHours: hours };
}

/** Permission and specialisation efforts; each has an economic reference stage, not an old price multiplier. */
const researchWork: Record<ResearchProjectId, { stage: number; hours: number; growth: number; fuel: number }> = {
  ISOTOPE_SPECTROMETRY: { stage: 4, hours: 3, growth: 1, fuel: 0 },
  DENSE_FUEL_CELLS: { stage: 5, hours: 4, growth: 1, fuel: 2 },
  GRAVITIC_CHARGES: { stage: 6, hours: 5, growth: 1, fuel: 3 },
  DEATH_STAR_PROTOCOL: { stage: 10, hours: 12, growth: 1, fuel: 12 },
  DEUTERIUM_SYNTHESIS: { stage: 1, hours: 2, growth: 3, fuel: 0 },
  YARD_AUTOMATION: { stage: 6, hours: 3, growth: 1.8, fuel: 0 },
  AI_ROBOTS: { stage: 6, hours: 3.5, growth: 1.8, fuel: 0 },
  PROSPECTOR_HOLDS: { stage: 5, hours: 3, growth: 1.8, fuel: 0 },
  CARGO_HOLDS: { stage: 5, hours: 3, growth: 1.8, fuel: 0 },
  STARSHIP_ENGINEERING: { stage: 4, hours: 7.5, growth: 5.5, fuel: 0 },
  SHIP_POWER: { stage: 4, hours: 3, growth: 2.3, fuel: 0.5 },
  SHIP_ARMOR: { stage: 4, hours: 3, growth: 2.3, fuel: 0.5 },
  SHIP_PROPULSION: { stage: 4, hours: 2.5, growth: 2.1, fuel: 1 },
  EMPLACEMENT_DOCTRINE: { stage: 4, hours: 2, growth: 2.1, fuel: 0.5 },
  INTERCEPTION_GRID: { stage: 9, hours: 8, growth: 1, fuel: 8 },
  STRATEGIC_STOCKPILE: { stage: 11, hours: 12, growth: 1, fuel: 12 },
};

export function profileResearch(id: ResearchProjectId, level: number, days: number = ECONOMY_PROFILE.progressionDays) {
  rung(level); horizonScale(days);
  // Income grows during the longer season: linear invoices alone compress milestone fractions.
  // Calibrated separately for the first permission and later specialisation; timers stay physical.
  const early = (id === 'STARSHIP_ENGINEERING' && level === 1) || (id === 'SHIP_POWER' && level <= 2);
  const work = researchWork[id], scale = id === 'DEUTERIUM_SYNTHESIS' && level === 1 ? 1
    : horizonScale(days) ** (early ? 2.3 : 1.8);
  const growth = work.growth ** (level - 1), h = work.hours * growth * scale;
  const hours = { alloy: h * 0.65, crystal: h, deuterium: work.fuel * growth * scale };
  const reference = profileIncome(work.stage);
  return { cost: profileInvoice(reference, hours), minutes: Math.min(480, 15 * work.hours * growth ** 0.6),
    referenceLevel: work.stage, recipeHours: hours };
}

/**
 * WHAT EACH HOLD PAYS FOR ITSELF IN MINUTES. D148, restored at D186.
 *
 * A cargo hull's round trip rises with its hold: 700 units get there, 6,000 take
 * their time. Flattening these to one figure — which the first cut of this profile
 * did — turns three hulls into one with three prices, because two Couriers then
 * arrive exactly when one Atlas does and the small hauler buys nothing.
 *
 * THE LAST ENTRY IS LOAD-BEARING BEYOND THIS FILE: `TRADE.speed` is anchored on the
 * slowest cargo hull so every hold leads the merchant (D156). Reorder this and the
 * merchant moves with it, which is the intended coupling and why it is a list
 * rather than three literals.
 */
export const SUPPORT_ROUND_TRIP = [17, 22, 32, 38] as const;

/** Catalogue speed for the full 1250-unit out-and-back trip, including ten seconds of combat. */
export const profileFlightSpeed = (roundTripMinutes: number): number =>
  2500 * ECONOMY_PROFILE.distanceFactor / (roundTripMinutes - 1 / 6);

export interface ProfileHull extends Hull { bulk: number; workMinutes: number; referenceRoundTrip: number | null }

/** Full real roster: keep identities, requirements and roles. No cargo hull is borrowed as a combat slot. */
/**
 * HOW FAR A TIER PUSHES ITS HULLS APART. D195, owner instruction, option A.
 *
 * The owner asked for the attack/armour trade to get SHARPER as hulls go up:
 * *"her level'da bu oranlarin iyilesmesi lazim"*. `role` is the deviation from an
 * even split — a Lance leans 4% toward attack, a Fortress 10% toward armour — and
 * this scales that deviation by tier, so a tier-4 Fortress is further from a tier-4
 * Lance than their tier-1 counterparts are.
 *
 * IT IS THE SPREAD THAT WIDENS, NEVER THE PRODUCT. `atk x hp` is exactly `power^2`
 * whatever `sharp` is, because one factor multiplies attack and divides armour by
 * the same amount. That is not a nicety, it is the only version of this that works:
 * a duel resolves on `atk x hp`, so paying a PRODUCT bonus for specialising would
 * make the extremes strictly better than the middle — the whole Skirmisher line
 * sits at role 1.000 and would earn nothing at all, and every Escort would be
 * dominated by a Fortress of its own counter class. Two dead branches, one of them
 * a third of the counter cycle. Within a tier, budget buys equal ordinary combat product across the four
 * profiles. D208 adds a modest product gain between tiers; the counter cycle
 * still decides fights. Nullifier pays an explicit shield-only ability premium.
 *
 * THE TIER-1 RUNG IS BELOW 1, so the entry hulls are the blunt ones. A commander
 * who cannot yet read a probe is not punished for guessing wrong, and the reward
 * for reaching tier 4 is that guessing right matters more.
 */
const ROLE_SPREAD = [0.8, 1, 1.2, 1.45] as const;

/**
 * WHAT A WARSHIP CARRIES. D195, owner instruction.
 *
 * *"Hepsinde az da olsa belirli miktarda kargo kapasitesi istiyorum. 50 100 vs."* —
 * every combat hull had a hold in the authored table and `profileHull` was
 * overwriting all of them with zero, so a raid could win a battle and take nothing
 * home unless a transport had been sent along with it. That is the half of the raid
 * economy that measurement kept finding empty.
 *
 * SMALL ON PURPOSE. The top of this ladder is a fraction of a Courier's, so a
 * serious haul still wants transports and a raiding fleet still makes the choice
 * D148 wants it to make — more guns, or more room. What it buys is that a raid is
 * never worth ZERO, which is a different thing from being worth a convoy.
 *
 * TILTED BY `referenceRoundTrip`, the owner's own rule: *"Hizli olan biraz daha az
 * kargosu olsun yavas olan biraz daha cok"*. The same figure tilts fuel the other
 * way in `hullFuelMass`, so a hull is fast, thirsty and empty-handed or slow,
 * frugal and deep-holded — one number, one trade, stated once.
 *
 * The rungs are set so no tier overlaps the one below it: the emptiest hull of any
 * tier still carries more than the fullest hull of the tier beneath. Cargo remains
 * a secondary profile trade; D208 calibrates a warship's combat return, rather than
 * granting every stat a simultaneous efficiency bonus.
 */
const COMBAT_HOLD = [40, 85, 180, 380] as const;

/**
 * Dedicated transport holds, retained at D208 because they already satisfy the
 * new value rule: capacity per A + 2C + 32D rises at every tier. Inflating the
 * whole ladder when tier-4 warships gained hold produced excess season loot;
 * transports remain over ten times as capacity-efficient as any warship.
 * Slow holds buy capacity with exposure.
 */
const SUPPORT_HOLD = [1000, 3400, 9500, 26000] as const;

/** The trip both of the above are neutral at. `FUEL.pivotRoundTrip` is the same figure. */
const PIVOT_ROUND_TRIP = 20;

/**
 * THE ESCORT'S TRIP. D207, owner instruction: *"Evet escort hızlanmalı"*, then
 * *"Biraz daha hızlandırsak yanlış mı olur?"*. Between the Raider's 15 and the
 * Fortress's 25, and quicker than the Striker's 20 — the Bulwark that is the smaller
 * hull buys its size back in speed. It never reaches the Raider's figure: speed is
 * that line's identity. The same trip tilts the hold down and the fuel up.
 */
const ESCORT_ROUND_TRIP = 18;

export function profileHull(live: Hull): ProfileHull {
  const id = live.id, tier = live.tier ?? 1;
  const steps = [1, 2.5, 6, 15], base = [300, 750, 1800, 4500];
  const c = [60, 180, 450, 1200], d = [0, 2, 6, 20];
  const bulk = [3, 5, 8, 13], work = [2, 5, 12, 28];
  const fortress = live.profile === 'FORTRESS', support = live.cls === 'SUPPORT';
  const premium = fortress ? 1.25 : live.profile === 'SHIELD_BREAKER' ? 1.15 : 1;
  // Excess HP with too little attack failed to resolve even favourable equal-budget fights.
  const role = live.cls === 'SKIRMISHER' ? 1 : live.cls === 'LANCE' ? 1.04 : fortress ? 0.9 : 0.96;
  const sharp = 1 + (role - 1) * ROLE_SPREAD[tier - 1]!;
  const recipe = { alloy: Math.ceil(base[tier - 1]! * premium), crystal: Math.ceil(c[tier - 1]! * premium),
    deuterium: Math.ceil(d[tier - 1]! * premium) };
  // Preserve the paid opening. Later tiers buy 6/12/18% more product per ECONOMIC
  // budget, not per raw resource count; sharpening the role never changes that product.
  // Smaller isotope invoices keep the raw-budget + full-research gap below the counter
  // cycle too, without inflating T4 past the unchanged ground guns.
  const efficiency = [1, 1.06, 1.12, 1.18] as const;
  // The specialist premium buys shield-only damage, not free ordinary firepower.
  // Fortress premiums still price a larger ordinary hull; Nullifier's do not.
  const ordinaryCost = live.profile === 'SHIELD_BREAKER'
    ? resourceValue({ alloy: base[tier - 1]!, crystal: c[tier - 1]!, deuterium: d[tier - 1]! })
    : resourceValue(recipe);
  const power = tier === 1 ? 40 * premium
    : Math.sqrt(21 * 77) * (ordinaryCost / 420) * Math.sqrt(efficiency[tier - 1]!);
  // The trip reads the PROFILE where a class holds two: an Escort trades part of the
  // Fortress hull for speed, which a class-only trip flew at the Fortress's pace (D207).
  const roundTrip = live.cls === 'SKIRMISHER' ? 15 : live.cls === 'LANCE' ? 20
    : live.profile === 'ESCORT' ? ESCORT_ROUND_TRIP : 25;
  const common = { ...live, ...recipe, atk: Math.round(power * 0.52 * sharp), hp: Math.round(power / 0.52 / sharp),
    speed: profileFlightSpeed(roundTrip),
    cargo: Math.round((COMBAT_HOLD[tier - 1]! * roundTrip) / PIVOT_ROUND_TRIP),
    bulk: Math.ceil(bulk[tier - 1]! * premium), workMinutes: work[tier - 1]! * premium,
    referenceRoundTrip: roundTrip };
  if (live.ground) return { ...common, alloy: id === 'THORN' ? 600 : 2400, crystal: id === 'THORN' ? 150 : 600,
    deuterium: 0, atk: id === 'THORN' ? 42 : 144, hp: id === 'THORN' ? 215 : 1000,
    speed: 0, cargo: 0, bulk: id === 'THORN' ? 6 : 18, workMinutes: id === 'THORN' ? 3 : 10, referenceRoundTrip: null };
  if (id === 'PROSPECTOR') return { ...common, atk: 0, hp: 150, alloy: 600, crystal: 180, deuterium: 0,
    speed: live.speed, cargo: live.cargo, bulk: 4, workMinutes: 5, referenceRoundTrip: null };
  /*
    THE GARBAGE COLLECTOR, BEFORE THE TRANSPORT BRANCH IT WOULD OTHERWISE FALL INTO.
    D200. It is Support class, and the line below would reprice it as a hauler with
    a hauler's hold. What it keeps from the table is the owner's hand-set price;
    what it takes from the tier is a transport's armour and room; and it flies the
    PIVOT trip, the middle of the counter triangle, because "ortalama bir hız" is
    the one trip nothing else in the catalogue is tilted against.
  */
  if (live.profile === 'COLLECTOR') return { ...common, atk: 0, hp: Math.round(90 * steps[tier - 1]!),
    alloy: live.alloy, crystal: live.crystal, deuterium: live.deuterium, cargo: 0,
    bulk: [3, 6, 14, 30][tier - 1]!, referenceRoundTrip: PIVOT_ROUND_TRIP,
    speed: profileFlightSpeed(PIVOT_ROUND_TRIP) };
  if (support) return { ...common, atk: 0, hp: Math.round(90 * steps[tier - 1]!),
    alloy: [600, 1500, 3600, 9000][tier - 1]!, crystal: [150, 400, 1000, 2600][tier - 1]!,
    deuterium: [0, 12, 48, 130][tier - 1]!,
    cargo: SUPPORT_HOLD[tier - 1]!, bulk: [3, 6, 14, 30][tier - 1]!,
    referenceRoundTrip: SUPPORT_ROUND_TRIP[tier - 1]!,
    speed: profileFlightSpeed(SUPPORT_ROUND_TRIP[tier - 1]!) };
  return common;
}
