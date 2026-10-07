/** Shared executable economy. No I/O, clock, mutable selection or runtime dependencies. */
import type { BuildingId, GroundHullId, Hull, ResearchProjectId, Resources } from './types.js';
import { ECONOMY_ADJUSTMENT } from './tempo.js';
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

/**
 * LATE PRODUCER OUTPUT ACCELERATES. Owner request, 2026-09-20: output gains past rung 12 grow by six
 * per cent of the base curve a rung. It used to travel with a price exception (x1.25 invoice growth
 * past 12); that half is now `ECONOMY_CURVE`'s job.
 */
export const PRODUCER_LATE_OUTPUT = {
  startsAfter: 12,
  liftPerLevel: 0.06,
} as const;

export const producerOutputMult = (level: number): number =>
  level <= PRODUCER_LATE_OUTPUT.startsAfter
    ? 1
    : 1 + (level - PRODUCER_LATE_OUTPUT.startsAfter) * PRODUCER_LATE_OUTPUT.liftPerLevel;

/**
 * ONE INVOICE CURVE FOR THE PRODUCERS AND THE CORE THAT GATES THEM. Plan §15.7 (Faz 4.1),
 * owner decision 2026-09-22.
 *
 * A rung's price is `hours x the income it adds`, so its payback is the hours, and the curve IS the
 * growth of those hours. It was `1.5` per rung all the way up — while income grows as `L^1.3`, a
 * marginal gain of about x1.07 a rung — so payback compounded at x1.45 a rung against a season that
 * does not grow. The owner's brief put the cost of that plainly: Refinery 10, 11 and 12 are LOW
 * levels in this economy, and a three-to-five day payback there ended the producer ladder on day
 * five. The live season shows it: the field reached Refinery 11 by day 5 and stopped.
 *
 * TWO SLOPES, ONE SEAM. The opening keeps its calibrated `1.5` through `openingTop` — the Academy
 * and the rehearsal teach those rungs and nothing about the late ladder is a reason to re-teach
 * them. Past it every rung's hours grow by `growth`, so payback runs about a day at Refinery 10–12,
 * two at 16, and four and a half at 20, where the rational sunset lands in the last week.
 *
 * THE CORE HAS ITS OWN, GENTLER SLOPE — `coreGrowth`. Owner decision, 2026-09-23. No producer may
 * pass the Core, so a world at its own ceiling pays the Core rung AND the producer rungs for its
 * next level; left on the old slope the Core froze the whole ladder at Core 12 (measured in the sim).
 * On the producers' slope it went the other way: the sim's median reached Core 25 by day 30, and
 * ground emplacements, flight bays, the attack tier and colony loyalty — all read off the Core LEVEL
 * and balanced for Core ~12–18 — would each have needed re-balancing. The owner chose the middle:
 * the Core's level stays where the live game already plays (median 13, top 17 on day 9), and below
 * the Core ceiling a producer rung still repays in about a day.
 *
 * The Vault, the Shipyard and the Hangar keep their own prices; they buy protection, hulls and room,
 * not output, and are not part of this decision.
 *
 * THE L12 PRICE EXCEPTION IS GONE; THE LATE OUTPUT LIFT STAYS. `PRODUCER_LATE_CURVE` used to do
 * two things: bend the invoice to x1.25 past rung 12, and add six per cent of output a rung. The
 * first is this curve's job now. The second is the owner's own request of 2026-09-20 (Refinery 14
 * at 2,400 an hour, 15 at 2,750, late gains that accelerate), pinned in
 * `owner-request-2026-09-20.test.ts`, and it is kept — priced on what it adds, see
 * `producerOutputShare`, so it no longer bends the payback curve either.
 */
export const ECONOMY_CURVE = {
  /** The last rung priced on the opening slope. */
  openingTop: 6,
  openingGrowth: 1.5,
  /** Growth of a producer rung's repayment hours past the opening. */
  growth: 1.16,
  /** The Core's own growth past the opening — keeps its LEVEL in the range the level rules expect. */
  coreGrowth: 1.35,
} as const;

const curveHours = (level: number, growth: number): number =>
  ECONOMY_CURVE.openingGrowth ** (Math.min(level, ECONOMY_CURVE.openingTop) - 1)
  * growth ** Math.max(0, level - ECONOMY_CURVE.openingTop);

/**
 * THE OPENING LIFT ON ALLOY, AND IT ENDS BY DECAYING. See `ECONOMY_ADJUSTMENT`.
 *
 * Flat across the opening, then a straight line back to 1.00 at `alloyLiftEndLevel` — the version
 * with an EDGE at L9 made the next upgrade a downgrade, which is the one thing a ladder may never
 * do. It lives beside the invoice because the Refinery's price now reads it (see `profileBuilding`).
 */
export const alloyLift = (level: number): number => {
  const { earlyAlloyOutputMultiplier: lift, earlyAlloyMaxLevel: flat, alloyLiftEndLevel: end }
    = ECONOMY_ADJUSTMENT;
  if (level < 1) return 1;
  if (level <= flat) return lift;
  if (level >= end) return 1;
  return 1 + (lift - 1) * (end - level) / (end - flat);
};

/**
 * WHAT A PRODUCER RUNG ACTUALLY ADDS, AS A SHARE OF WHAT THE PROFILE SAYS IT ADDS. Faz 4.1 + 4.2.
 *
 * A rung is priced as `hours x the income it adds`, and the profile's delta is not what it adds
 * wherever a multiplier sits on the output:
 *
 *   · the opening alloy lift DECAYS from L6 to L10, so each Refinery rung there adds less alloy than
 *     its profile delta — 190, 145, 132, 118, 103 an hour — and a price read off the profile made
 *     payback jump from seven hours to eighty-two across four rungs: the dead zone, landing on a new
 *     commander's first two days;
 *   · the late output lift (`producerOutputMult`) makes every rung past 12 add MORE, and priced off
 *     the profile the payback fell off a cliff at 12→13 and then climbed again — the second seam.
 *
 * Priced on the output it really adds, every producer's payback follows the one curve: hours over
 * `producerOutput`, whatever lifts sit on the ladder. The flat opening keeps its calibrated prices —
 * the Refinery there still repays a quarter faster, which is what the opening lift was for.
 */
const producerOutputShare = (id: BuildingId, level: number): number => {
  if (id === 'REFINERY' && level <= ECONOMY_ADJUSTMENT.earlyAlloyMaxLevel) return 1;
  const key = id === 'REFINERY' ? 'alloy' : id === 'EXTRACTOR' ? 'crystal' : 'deuterium';
  const lift = (l: number): number => (id === 'REFINERY' ? alloyLift(l) : 1) * producerOutputMult(l);
  const at = (l: number): number => profileIncome(l)[key] * lift(l);
  const profile = profileIncome(level)[key] - profileIncome(level - 1)[key];
  return profile > 0 ? (at(level) - at(level - 1)) / profile : 1;
};

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

/** Exact early Yard invoices selected by the owner; indexed by the rung reached. */
const YARD_EARLY_COST: Readonly<Partial<Record<number, Resources>>> = {
  2: { alloy: 2293, crystal: 882, deuterium: 0 },
  3: { alloy: 3500, crystal: 1250, deuterium: 0 },
};

// The calibrated monthly curve preserves the first three economic rungs.
const stretch = (level: number, days: number = ECONOMY_PROFILE.progressionDays) =>
  level <= 3 ? 1 : horizonScale(days);

/**
 * THE STAGE A HANGAR RUNG IS PRICED AT; index is the rung bought. 2026-09-18.
 *
 * A gate rung costs what its gate Core's stage costs, so the rung that opens at
 * Core 7 is priced like Core-7 hardware. Rung 7 jumps two stages and each rung
 * after climbs one: roughly 3.6, 5.5, 8.4 and 12.8 days of one Core-16 world's output, a
 * luxury for the largest holdings that a thirty-day season can still reach.
 */
const HANGAR_PRICE_STAGE = [1, 1, 4, 7, 10, 13, 16, 18, 19, 20, 21] as const;
/**
 * A rung costs a quarter more than the Core upgrade at its stage USED to. Owner decision,
 * 2026-09-18 (was ×2). Since Faz 4.1 the Core rides `ECONOMY_CURVE` and the Hangar does not: the
 * staged rungs keep the original slope, so this reads as "a quarter over the old Core stage", and
 * the Core's reprice cannot move the Hangar silently. `hangar.test.ts` holds the figures.
 */
const HANGAR_PRICE_MULT = 1.25;

/**
 * WHAT THE LATE HANGAR RUNGS COST — AUTHORED, AND DERIVED ONCE FROM THE FLEET THEY HOLD.
 * Plan §15.5b item 2B.3, owner decision 2026-09-22.
 *
 * THE DEFECT, MEASURED: against the formation that fills the room each rung adds, the ladder
 * charged 5% · 4% · 13% · 14% · 51% · 60% · 77% · 100% · 133%. The top rung cost a third MORE than
 * every ship it could hold — and at Core 16 a commander's whole alloy store is 50,252 against a
 * price of 931,263, eighteen full stores. Production past a store's ceiling overflows and is lost,
 * so those were not expensive rungs. They could not be bought at all, by anyone, ever.
 *
 * THE RULE: one third of the reference formation, in that formation's own resource mix. The
 * opening rungs are deliberately absent — they already cost 4–14% of what they hold, and a
 * commander learning the game must not pay for this fix.
 *
 * WRITTEN DOWN RATHER THAN COMPUTED AT RUNTIME, because 2B.3 is explicit that a hull rebalance
 * must not silently reprice infrastructure — and because the formation lives in `hulls.ts`, which
 * imports this file. `hangar-price.test.ts` holds these figures against the third they came from,
 * so a rebalance turns a test RED rather than quietly moving the economy.
 *
 * Keyed by the rung being BOUGHT; rungs 2–5 fall through to the staged curve below.
 */
export const HANGAR_LATE_COST: Readonly<Record<number, Resources>> = {
  6: { alloy: 71_760, crystal: 17_940, deuterium: 0 },
  7: { alloy: 136_509, crystal: 36_400, deuterium: 0 },
  8: { alloy: 163_324, crystal: 43_550, deuterium: 0 },
  9: { alloy: 190_138, crystal: 50_700, deuterium: 0 },
  10: { alloy: 219_390, crystal: 58_500, deuterium: 0 },
};

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
  const producer = id === 'REFINERY' || id === 'EXTRACTOR' || id === 'DEUTERIUM_PLANT';
  // The producers and the Core ride `ECONOMY_CURVE`, each on its own slope; everything else keeps
  // the original one.
  const slope = producer ? curveHours(level, ECONOMY_CURVE.growth)
    : id === 'CORE' ? curveHours(level, ECONOMY_CURVE.coreGrowth)
      : 1.5 ** (level - 1);
  const horizon = 0.5 * slope * stretch(level, days)
    * (producer ? producerOutputShare(id, level) : 1);
  const labor = Math.min(480, 2 * 1.36 ** (level - 1));
  const shares: Record<BuildingId, Resources> = {
    REFINERY: { alloy: 0.8, crystal: 0.2, deuterium: 0 },
    EXTRACTOR: { alloy: 0.4, crystal: 0.6, deuterium: 0 },
    // Past the opening the Core leans to crystal: on its own steeper slope it is most of a level's
    // price, and the old 0.65/0.35 pushed a level's crystal charge under the floor
    // `invariants.test.ts` holds. Value-neutral — a crystal is worth two alloy. Owner decision
    // 2026-09-23 (the Core's own curve).
    CORE: level > ECONOMY_CURVE.openingTop
      ? { alloy: 0.55, crystal: 0.45, deuterium: 0 }
      : { alloy: 0.65, crystal: 0.35, deuterium: 0 },
    VAULT: { alloy: 0.8, crystal: 0.8, deuterium: 0 },
    SHIPYARD: { alloy: 1.3, crystal: 1, deuterium: 0 },
    DEUTERIUM_PLANT: { alloy: 0.6, crystal: 1.2, deuterium: 0 },
    HANGAR: { alloy: 0.65 * HANGAR_PRICE_MULT, crystal: 0.35 * HANGAR_PRICE_MULT, deuterium: 0 },
  };
  // The Yard and the Hangar have fewer rungs than the producers, so each is priced
  // at the economic stage it supports rather than at its own rung number.
  const staged = id === 'SHIPYARD' || id === 'HANGAR';
  const referenceLevel = id === 'SHIPYARD' ? Math.min(30, level * 2)
    : id === 'HANGAR' ? HANGAR_PRICE_STAGE[Math.min(level, HANGAR_PRICE_STAGE.length - 1)]!
    : level;
  const reference = profileIncome(referenceLevel), before = profileIncome(referenceLevel - 1);
  const effectiveDelta = staged
    ? { alloy: reference.alloy - before.alloy, crystal: reference.crystal - before.crystal, deuterium: 0 } : delta;
  const h = staged
    ? 0.5 * 1.5 ** (referenceLevel - 1) * stretch(referenceLevel, days) : horizon;
  // A Hangar rung is raised at the pace of the stage it is priced at, not of its rung.
  const work = id === 'HANGAR' ? Math.min(480, 2 * 1.36 ** (referenceLevel - 1)) : labor;
  const hours = { alloy: h * shares[id].alloy, crystal: h * shares[id].crystal, deuterium: 0 };

  /**
   * THE LATE HANGAR RUNGS ARE PRICED BY THE FLEET THEY HOLD, NOT BY AN ECONOMY STAGE.
   * Plan 2B.3, owner decision 2026-09-22 — see `HANGAR.lateCost` for the measurement and the rule.
   *
   * It lands HERE rather than in `buildingCost` so there is exactly one answer to "what does this
   * rung cost": the timer beside it is authored work and is unaffected, which is the existing rule
   * that a building's clock is not its invoice.
   */
  const authored = id === 'HANGAR' ? HANGAR_LATE_COST[level] : undefined;
  if (authored) {
    return { cost: authored, minutes: work, referenceLevel, repaymentHours: h, recipeHours: hours };
  }

  const earlyYard = id === 'SHIPYARD' ? YARD_EARLY_COST[level] : undefined;
  if (earlyYard) {
    return { cost: earlyYard, minutes: work, referenceLevel, repaymentHours: h, recipeHours: hours };
  }

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

  return { cost: profileInvoice(effectiveDelta, hours), minutes: work,
    referenceLevel, repaymentHours: h, recipeHours: hours };
}

/** Permission and specialisation efforts; each has an economic reference stage, not an old price multiplier. */
const researchWork: Record<ResearchProjectId, { stage: number; hours: number; growth: number; fuel: number }> = {
  ISOTOPE_SPECTROMETRY: { stage: 4, hours: 3, growth: 1, fuel: 0 },
  DENSE_FUEL_CELLS: { stage: 5, hours: 4, growth: 1, fuel: 2 },
  GRAVITIC_CHARGES: { stage: 6, hours: 5, growth: 1, fuel: 3 },
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
  /** Owner K6, 2026-09-29: Yard Automation's own first two rungs. */
  INDUSTRIAL: { stage: 6, hours: 3, growth: 1.8, fuel: 0 },
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

/** Owner instruction, 2026-09-25: every shipyard-built fleet hull flies 25% slower. */
export const FLEET_SPEED_FACTOR = 0.75;

/**
 * EVERY CARGO HOLD FLIES 2.5x ITS RUNG. Owner instruction, 2026-10-06.
 *
 * A transport alone is moving stock between the commander's own worlds or meeting
 * the merchant; in a raid it already flies at its slowest warship's pace, so the
 * lift buys convenience and never a faster strike. Speed only: the rung
 * (`SUPPORT_ROUND_TRIP`) still orders the ladder and still tilts the fuel. The
 * merchant (`TRADE.speed`) and the collector are not holds and did not take it.
 */
export const TRANSPORT_SPEED_MULT = 2.5;

/** Catalogue speed for the full 1250-unit out-and-back trip, including ten seconds of combat. */
export const profileFlightSpeed = (roundTripMinutes: number): number =>
  2500 * ECONOMY_PROFILE.distanceFactor / (roundTripMinutes - 1 / 6);

export interface ProfileHull extends Hull { bulk: number; workMinutes: number; referenceRoundTrip: number | null }

/** Authored stationary profiles; exhaustive so a new ground id cannot inherit a peer by accident. */
const GROUND_PROFILE = {
  THORN: { alloy: 600, crystal: 150, atk: 42, hp: 215, bulk: 6, workMinutes: 3 },
  HARPOON: { alloy: 1200, crystal: 300, atk: 240, hp: 150, bulk: 10, workMinutes: 6 },
  BASTION: { alloy: 2400, crystal: 600, atk: 144, hp: 1000, bulk: 18, workMinutes: 10 },
} as const satisfies Record<GroundHullId, {
  alloy: number; crystal: number; atk: number; hp: number; bulk: number; workMinutes: number;
}>;

/** Full real roster: keep identities, requirements and roles. No cargo hull is borrowed as a combat slot. */
/**
 * HOW FAR A TIER PUSHES ITS HULLS APART. D195, owner instruction, option A.
 *
 * The owner asked for the attack/armour trade to get SHARPER as hulls go up, and
 * then made the visible boundary explicit: every Lance must show more attack than
 * hull strength. A tiny tilt around the catalogue's old 0.52 attack coefficient
 * could never cross that boundary; Pike still rendered as 21 / 75 and looked like
 * a second Raider with a different counter chip.
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
 * These are the authored ATTACK / HP ratios. They widen gently by tier while the
 * product stays fixed: cost and equal-budget efficiency do not move, only where a
 * Lance puts the power it already bought. Pike's tiny stats quantise 1.08 to 42/38,
 * visibly sharper than the next rung; forcing every later rounded ratio above that
 * erased the tier advantage at real budgets. Nullifier is included because it is a
 * Lance too; its shield multiplier remains a property of its live attack.
 */
// Ratios of 1.1–1.4 erased equal-budget Lance tier progression through one-salvo
// saturation. The owner's second adjustment moves the whole line further into
// attack, but this much narrower ladder still leaves D208's tier gain measurable.
const LANCE_ATTACK_HP_RATIO = [1.08, 1.081, 1.082, 1.083] as const;

/**
 * THE TWO SUR PROFILES ARE EQUAL-SIZED ALTERNATIVES. Owner instruction, D209.
 *
 * Fleet speed alone cannot carry the Escort identity because a transport or
 * Nullifier commonly sets the fleet pace. Both Bulwarks therefore buy the same
 * recipe and `ATK * HP` product: Escort puts that power into attack, Fortress into
 * armour. The roughly 25% mirror gap widens only gently so the established D195
 * tier-specialisation ladder survives integer rounding.
 */
const BULWARK_PROFILE_RATIO = [1.22, 1.25, 1.28, 1.31] as const;

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

/** Hangar room a collector occupies, by tier. Hand-set like its price; owner decision 2026-09-22. */
const COLLECTOR_BULK = [8, 17, 40, 86] as const;

export function profileHull(live: Hull): ProfileHull {
  const id = live.id, tier = live.tier ?? 1;
  const steps = [1, 2.5, 6, 15], base = [300, 750, 1800, 4500];
  const c = [60, 180, 450, 1200], d = [0, 2, 6, 20];
  const bulk = [3, 5, 8, 13], work = [2, 5, 12, 28];
  const fortress = live.profile === 'FORTRESS', escort = live.profile === 'ESCORT';
  const support = live.cls === 'SUPPORT';
  const premium = fortress || escort ? 1.25 : live.profile === 'SHIELD_BREAKER' ? 1.15 : 1;
  // Excess HP with too little attack failed to resolve even favourable equal-budget fights.
  let sharp = live.cls === 'LANCE'
    ? Math.sqrt(LANCE_ATTACK_HP_RATIO[tier - 1]!) / 0.52
    : 1;
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
  if (escort || fortress) {
    const bulwarkSharp = Math.sqrt(BULWARK_PROFILE_RATIO[tier - 1]!);
    sharp = escort ? bulwarkSharp : 1 / bulwarkSharp;
  }
  // The trip reads the PROFILE where a class holds two: an Escort trades part of the
  // Fortress hull for speed, which a class-only trip flew at the Fortress's pace (D207).
  const roundTrip = live.cls === 'SKIRMISHER' ? 15 : live.cls === 'LANCE' ? 20
    : live.profile === 'ESCORT' ? ESCORT_ROUND_TRIP : 25;
  const common = { ...live, ...recipe, atk: Math.round(power * 0.52 * sharp), hp: Math.round(power / 0.52 / sharp),
    speed: profileFlightSpeed(roundTrip) * FLEET_SPEED_FACTOR,
    cargo: Math.round((COMBAT_HOLD[tier - 1]! * roundTrip) / PIVOT_ROUND_TRIP),
    bulk: Math.ceil(bulk[tier - 1]! * premium), workMinutes: work[tier - 1]! * premium,
    referenceRoundTrip: roundTrip };
  if (live.ground) {
    const emplacement = GROUND_PROFILE[id as GroundHullId];
    return { ...common, ...emplacement, deuterium: 0, speed: 0, cargo: 0, referenceRoundTrip: null };
  }
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
    /*
      ITS ROOM IS HAND-SET TOO, LIKE ITS PRICE AND ITS THIRST. Owner decision, 2026-09-22: 40, up
      from the support table's 14. A collector is a claw and a hold for wreckage, and the hold is
      the point — a fleet of them has to compete with warships for the hangar, or lifting a field
      costs nothing anybody feels. See `SALVAGE.perCollector` for the measurement.
    */
    bulk: COLLECTOR_BULK[tier - 1]!, referenceRoundTrip: PIVOT_ROUND_TRIP,
    speed: profileFlightSpeed(PIVOT_ROUND_TRIP) * FLEET_SPEED_FACTOR };
  if (support) return { ...common, atk: 0, hp: Math.round(90 * steps[tier - 1]!),
    alloy: [600, 1500, 3600, 9000][tier - 1]!, crystal: [150, 400, 1000, 2600][tier - 1]!,
    deuterium: [0, 12, 48, 130][tier - 1]!,
    cargo: SUPPORT_HOLD[tier - 1]!, bulk: [3, 6, 14, 30][tier - 1]!,
    referenceRoundTrip: SUPPORT_ROUND_TRIP[tier - 1]!,
    speed: profileFlightSpeed(SUPPORT_ROUND_TRIP[tier - 1]!) * FLEET_SPEED_FACTOR
      * (live.profile === 'TRANSPORT' ? TRANSPORT_SPEED_MULT : 1) };
  return common;
}
