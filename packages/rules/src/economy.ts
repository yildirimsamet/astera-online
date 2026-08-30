import { yardSpeedMult } from './tech.js';
import type { TechLevels } from './tech.js';
import {
  BUILD,
  DISRUPTION,
  DEUTERIUM,
  ECON,
  EMPLACEMENT,
  HANGAR,
  INSTRUMENT_COST_MULT,
  INSTRUMENT_LEVEL_WORTH,
  SATELLITES,
  SEASON,
  SHIELD,
} from './constants.js';
import {
  INSTRUMENT_IDS,
  type BuildingId,
  type InstrumentId,
  type InstrumentLevels,
  type Resources,
  type SatelliteId,
  type SatelliteSet,
} from './types.js';

/**
 * Instrument levels, by known key.
 *
 * `Object.values()` on a `Partial<Record<K, number>>` is typed `number[]`, which
 * quietly hides the fact that a value can be undefined at runtime. Iterating the
 * key list keeps the types honest and matches how hulls are handled.
 */
export function instrumentEntries(kit: InstrumentLevels): [InstrumentId, number][] {
  const out: [InstrumentId, number][] = [];
  for (const id of INSTRUMENT_IDS) {
    const level = kit[id];
    if (level !== undefined && level > 0) out.push([id, level]);
  }
  return out;
}

/** Whether a satellite is in orbit. Presence is the whole state — D25, no levels. */
export const hasSatellite = (orbit: SatelliteSet, id: SatelliteId): boolean =>
  orbit.includes(id);

/**
 * HOW MANY BODIES A PLANET MAY KEEP IN ORBIT. D25.
 *
 * Owner's figure: the Command Core opens a slot at levels 1, 3, 5 and 9. Nothing
 * else grants one, and there is no separate building to detour through — capacity
 * arrives as a by-product of the growth every player is doing anyway.
 *
 * FOUR SLOTS AND FOUR SATELLITES IS NOT A CHECKLIST, because the fourth arrives at
 * Core 9. For most of a fourteen-day season a planet runs one, two or three of
 * them, so the live question is WHICH — and answering it is what makes two
 * developed worlds different from each other. Owning the set is a late-game state
 * you work toward, not the state you play in.
 */
export const satelliteSlots = (coreLevel: number): number =>
  coreLevel >= 9 ? 4 : coreLevel >= 5 ? 3 : coreLevel >= 3 ? 2 : coreLevel >= 1 ? 1 : 0;

/**
 * HOW MANY CRAFT A PLANET MAY HAVE IN THE AIR AT ONCE. D28.
 *
 * Every craft that leaves — an attack, a probe, a mining run — holds one slot for
 * the WHOLE ROUND TRIP, and gives it back when it lands. One mining run is one
 * slot however many Prospectors are in it: a squadron is a decision, not five.
 *
 * THIS IS THE UNIT OF PACING, and it replaces nothing that was working. D4 ruled
 * out build timers, correctly, and then nothing took over the job of occupying
 * time — so a session is "collect, buy the one thing you can afford, close", and
 * closes with nothing pending. A slot count is the honest version of the return
 * hook: a dark bay on your own dashboard says *you have not finished your turn*
 * without a notification, a streak or a bonus.
 *
 * IT REMOVES MORE RULES THAN IT ADDS. `PROBE.maxInFlight` was a special case for
 * one craft type; this is the general form of it, and the general form also closes
 * the mining exploit — unlimited concurrent runs — without a second special case.
 *
 * BASE THREE, NOT TWO. Owner decision, and the conservative one: three is exactly
 * today's probe cap, so nothing a player can do now becomes impossible. It means
 * scarcity is not felt in the first hour, which is the cost; what it buys is that
 * the mechanic can never read as a wall to somebody who has just arrived.
 */
/**
 * HOW MUCH FLEET A HANGAR HOLDS. T4. See the `HANGAR` block for the fitting.
 *
 * Linear, because the thing it bounds is linear: a fleet is a sum of hulls and a
 * ceiling on it should read as a number of ships, not as a curve nobody can hold in
 * their head. The Core gate on every building is what makes this bite — a Hangar
 * may never reach its Core's level, so the ceiling is a property of how developed a
 * world is rather than of how much ore went into one row.
 */
export const hangarCapacity = (hangarLevel: number): number =>
  HANGAR.base + Math.max(0, hangarLevel) * HANGAR.perLevel;

/**
 * HOW MANY EMPLACEMENTS A COMMAND CORE STANDS. T4b. See the `EMPLACEMENT` block.
 *
 * Read off the CORE and not off a building of its own: a seventh building for this
 * would be a second thing to raise for one number, and the Core already answers
 * "how big is this world" for flight bays, orbit slots and colony capacity. One
 * more derived capacity is consistent; one more row on the planet screen is not.
 */
export const groundSlots = (coreLevel: number): number =>
  EMPLACEMENT.base + Math.max(0, coreLevel) * EMPLACEMENT.perLevel;

export const flightSlots = (coreLevel: number): number =>
  3 + Math.floor(Math.max(0, coreLevel) / 3);

/* ── what a satellite changes ───────────────────────────────────── */

/**
 * The multiplier on everything the works produce. D25.
 *
 * Applied to the RATE, so it lifts storage caps and collector caps with it — a
 * Foundry makes a planet bigger, not merely faster, which is what stops it being a
 * flat bonus a player forgets they own.
 */
export const productionMult = (orbit: SatelliteSet): number =>
  hasSatellite(orbit, 'FOUNDRY') ? SATELLITES.FOUNDRY.production : 1;

/** Whether the two seeing instruments may be built at all. The Uplink's whole job. */
export const seeingUnlocked = (orbit: SatelliteSet): boolean =>
  hasSatellite(orbit, 'UPLINK');

/** Every mining craft the planet owns carries this much more. */
export const drillHoldMult = (orbit: SatelliteSet): number =>
  hasSatellite(orbit, 'DERRICK') ? SATELLITES.DERRICK.hold : 1;

/** ...and crosses the disc this much faster. */
export const drillSpeedMult = (orbit: SatelliteSet): number =>
  hasSatellite(orbit, 'DERRICK') ? SATELLITES.DERRICK.speed : 1;

/** Every fleet that leaves this planet flies this much faster. */
export const fleetSpeedMult = (orbit: SatelliteSet): number =>
  hasSatellite(orbit, 'BEACON') ? SATELLITES.BEACON.speed : 1;

/**
 * `base × L × growth^L` per hour. See `ECON.alloyBase` for why the linear factor
 * is there: it is what makes L1 → L2 a doubling and L17 → L18 a sixteenth.
 *
 * Level 0 produces nothing, which is correct — a planet is created with the
 * Refinery and the Extractor both at 1 and neither can ever go down.
 */
export const alloyRate = (level: number): number =>
  ECON.alloyBase * level * Math.pow(ECON.alloyMult, level);

export const crystalRate = (level: number): number =>
  ECON.crystalBase * level * Math.pow(ECON.crystalMult, level);

/** Cost to go from `level` to `level + 1`. */
export function upgradeCost(level: number): Resources {
  return {
    alloy: Math.round(ECON.costBase * Math.pow(ECON.costMult, level)),
    crystal:
      level >= ECON.crystalCostFromLevel
        ? Math.round(ECON.crystalCostBase * Math.pow(ECON.crystalCostMult, level))
        : 0,
    deuterium: 0,
  };
}

/** Cost to raise one building, including the Hangar's strategic-room premium. */
export function buildingCost(type: BuildingId, level: number): Resources {
  const base = upgradeCost(level);
  const multiplier = type === 'HANGAR' ? HANGAR.costMultiplier : 1;
  return {
    alloy: base.alloy * multiplier,
    crystal: base.crystal * multiplier,
    deuterium: base.deuterium * multiplier,
  };
}

/**
 * Cost to take an instrument from `level` to `level + 1`. D22.
 *
 * A building's price with the instrument's own multiplier on it. Price is the only
 * gate on an instrument — any of the four, in any order, at any time — so it is
 * what has to make choosing between them cost something.
 */
export function instrumentCost(id: InstrumentId, level: number): Resources {
  const mult = INSTRUMENT_COST_MULT[id];
  // An instrument level is worth more than one building level, because there are
  // only five of them against a building's twelve-plus. D30.
  const base = upgradeCost(level * INSTRUMENT_LEVEL_WORTH);
  return {
    alloy: Math.round(base.alloy * mult),
    crystal: Math.round(base.crystal * mult),
    deuterium: 0,
  };
}

/** What a satellite costs. Flat — it is bought once and never raised. D25. */
export const satelliteCost = (id: SatelliteId): Resources => ({
  alloy: SATELLITES[id].alloy,
  crystal: SATELLITES[id].crystal,
  deuterium: 0,
});

/** Everything sunk into a building to reach `level`. Feeds the Wealth display. */
export function investedInBuilding(level: number, type?: BuildingId): number {
  let total = 0;
  for (let l = 0; l < level; l++) {
    const c = type === undefined ? upgradeCost(l) : buildingCost(type, l);
    total += c.alloy + c.crystal + c.deuterium;
  }
  return total;
}

/**
 * Everything sunk into one instrument to reach `level`.
 *
 * Separate from `investedInBuilding` because instruments are priced differently
 * (D22), and Wealth has to reflect what was actually spent — a Telescope L3 costs
 * three times a Vault L3 and would otherwise be valued at a third of its price,
 * which quietly makes the rank floor wrong for every player who invested in
 * looking rather than in producing.
 */
export function investedInInstrument(id: InstrumentId, level: number): number {
  let total = 0;
  for (let l = 0; l < level; l++) {
    const c = instrumentCost(id, l);
    total += c.alloy + c.crystal + c.deuterium;
  }
  return total;
}

/** What a satellite in orbit is worth. One purchase, so one price. */
export const investedInSatellite = (id: SatelliteId): number =>
  SATELLITES[id].alloy + SATELLITES[id].crystal;

/**
 * Hours of production the STORE holds, and the Vault is what makes it taller.
 *
 * Separate from `storageCap` because three callers need the hours rather than the
 * amount — the interface states them, and the invariant test compares them against
 * `protectedHours`.
 */
export const storageHours = (vaultLevel: number): number =>
  ECON.capHours + ECON.capHoursPerVault * Math.max(0, vaultLevel);

/**
 * THE CEILING ON STORED ORE, AND IT TAKES THE VAULT LEVEL. Economy v2.
 *
 * THE VAULT LEVEL IS REQUIRED, AND THAT IS DELIBERATE. It was written with a
 * default first, and every one of the two dozen existing call sites went on
 * compiling while silently reading the Vault-0 ceiling — wrong by a factor of
 * three on a developed world, with nothing to notice it by. A required argument
 * turns that into two dozen compiler errors, which is the only reliable way to
 * visit them all. A caller that genuinely means "no Vault" passes 0 and says so.
 *
 * `ECON.capHours` explains why the store has to grow at all: without it, one
 * upgrade eventually costs more than a full store can hold and progression stops
 * for a reason nothing in the interface explains.
 */
export const storageCap = (ratePerHour: number, vaultLevel: number): number =>
  Math.round(storageHours(vaultLevel) * ratePerHour);

/**
 * What the works hold before they stop. D16.
 *
 * This is a SECOND ceiling, in front of the storage ceiling rather than instead of
 * it. Production fills this one; a tap moves it into storage, which has its own.
 */
export const collectorCap = (ratePerHour: number): number =>
  Math.round(ECON.collectorHours * ratePerHour);

/**
 * THE THIRD PRODUCER. T5.
 *
 * Same shape as alloy and crystal — `base × level × mult^level` — because it is
 * the same kind of thing and a player who has read one ladder has read this one.
 * The multiplier is flatter on purpose; see the `deuteriumBase` block for the
 * measurement it is held against.
 */
export const deuteriumRate = (level: number): number =>
  level <= 0 ? 0 : ECON.deuteriumBase * level * Math.pow(ECON.deuteriumMult, level);

/**
 * DEUTERIUM ARRIVES TWO WAYS, SO THE CEILING IS SIZED FROM BOTH. T5, corrected.
 *
 * The containment figure was originally derived from the EXTRACTOR — not because
 * deuterium had anything to do with crystal, but because it was the honest way to
 * say "a world of this size can contain about this much" while the resource had no
 * production of its own. It has one now, and sizing the ceiling from the plant
 * ALONE looked like the tidy answer and was wrong in a way no test caught: a world
 * with no refinery got a ceiling of zero, and MINED isotope deuterium — the whole
 * of D93's second act — became impossible to collect on the worlds that had not
 * built one. Which is nearly all of them.
 *
 * So both terms are here, and each answers its own question:
 *
 *   · the industrial base a world has, which is what lets it hold what it MINES
 *     and is exactly the figure it always had;
 *   · plus hours of its own refinery, which is what lets a producer's store grow
 *     past what an unrelated mine would have allowed.
 *
 * At plant zero this is precisely the old number, so nothing about mining moved.
 */
export const deuteriumStorageCap = (
  deuteriumRatePerHour: number,
  crystalRatePerHour: number,
  vaultLevel: number,
): number => storageCap(
  crystalRatePerHour * DEUTERIUM.containmentRatio + deuteriumRatePerHour,
  vaultLevel,
);

/** The same two sources, in front of the store. Mined or made, it lands here first. */
export const deuteriumCollectorCap = (
  deuteriumRatePerHour: number,
  crystalRatePerHour: number,
): number => collectorCap(
  crystalRatePerHour * DEUTERIUM.containmentRatio + deuteriumRatePerHour,
);

/** Level 0 still protects the base amount — nobody is ever lootable to zero. */
/**
 * WHAT THE VAULT KEEPS SAFE, PER RESOURCE. D61.
 *
 * It returns a PAIR, and that shape is the fix. It used to return one number that
 * every caller applied to alloy and to crystal alike — which reads as symmetry and
 * is not: crystal income is 35% of alloy income, so the same floor covered 88% of
 * a young planet's crystal store and made the resource unraidable for the whole
 * opening. Returning two figures makes the asymmetry impossible to apply by
 * accident, which a second exported function would not have.
 */
export const protectedHours = (vaultLevel: number): number =>
  ECON.protectedHoursBase + ECON.protectedHoursPerVault * Math.max(0, vaultLevel);

/**
 * WHAT THE VAULT KEEPS SAFE, PER RESOURCE, IN HOURS OF THAT RESOURCE'S OWN
 * PRODUCTION. Economy v2, and the shape is the fix.
 *
 * It used to be one alloy figure that every caller applied to crystal as well,
 * which reads as symmetry and is not: crystal income is about 35% of alloy income,
 * so the same floor covered 88% of a young planet's crystal store and made the
 * resource unraidable for the whole opening. Pricing the floor in hours makes that
 * bug unrepresentable — there is no single number left that can be sized against
 * one resource and charged against another.
 *
 * IT TAKES THE PRODUCING LEVELS, not just the Vault's. That is what "hours of
 * production" means, and it is why the signature grew: a floor that did not know
 * the Refinery level could only ever be a flat amount again.
 *
 * `openingFloorAlloy` is the one flat term and it binds for a very young world
 * alone. It is measured, not decorative: removing it dropped `TI` under its floor
 * and cost the informed archetype the ladder. See `ECON.openingFloorAlloy`.
 */
export const vaultProtects = (
  vaultLevel: number,
  refineryLevel: number,
  extractorLevel: number,
  plantLevel: number,
): Resources => {
  const hours = protectedHours(vaultLevel);
  const openingCrystal = ECON.openingFloorAlloy * (ECON.crystalBase / ECON.alloyBase);
  return {
    alloy: Math.round(Math.max(ECON.openingFloorAlloy, hours * alloyRate(refineryLevel))),
    crystal: Math.round(Math.max(openingCrystal, hours * crystalRate(extractorLevel))),
    /*
      HOURS OF ITS OWN PRODUCTION, exactly like the other two. T5.

      This read zero with a note that deuterium had no passive rate, "so its floor
      is zero — that falls out of the rule rather than being a special case". It
      now has a rate, and the floor appears on its own: nothing was added here and
      nothing removed. A world with no plant still protects none, which is the same
      answer as before.

      NO OPENING FLOOR. Alloy and crystal carry one because a young world would
      otherwise be unraidable in the resource it is made of; deuterium is never
      what a new commander is farmed for, and a floor on a resource they cannot
      produce would protect a store that does not exist.
    */
    deuterium: Math.round(hours * deuteriumRate(plantLevel)),
  };
};

export const shieldHp = (level: number): number =>
  level <= 0 ? 0 : Math.round(SHIELD.base * Math.pow(SHIELD.mult, level));

/**
 * Hours for an upgrade at `level` to repay its own cost.
 *
 * TOTAL cost against the MARGINAL gain, and both had to be re-derived. The gain is
 * no longer `rate × (mult − 1)`: production is `base × L × growth^L`, whose
 * marginal is `base × growth^L × (0.1L + 1.1)`, so the old closed form was simply
 * the wrong derivative. Taking the difference of two rates cannot go stale the
 * next time the shape moves.
 *
 * Cost grows at 1.56 against production at 1.10, so payback lengthens with level.
 * THAT DRIFT IS WHAT STOPS A 14-DAY SEASON RUNNING AWAY, and it is what produces
 * the sunset: every player independently stops building on the final day, with no
 * rule announcing it.
 */
export function paybackHours(level: number): number {
  const cost = upgradeCost(level);
  const gain = alloyRate(level + 1) - alloyRate(level);
  if (gain <= 0) return Infinity;
  return (cost.alloy + cost.crystal + cost.deuterium) / gain;
}

/** Is building still rational, this many hours before the season ends? */
export const worthInvesting = (level: number, hoursRemaining: number): boolean =>
  paybackHours(level) < hoursRemaining * SEASON.investmentHorizonShare;

/* ── Build time ─────────────────────────────────────────────────── */

const totalOf = (cost: Resources): number => cost.alloy + cost.crystal + cost.deuterium;

/** Resource units per minute the surface can assemble. The Core is the works. */
export const constructionThroughput = (coreLevel: number): number =>
  BUILD.conBase * (1 + BUILD.conPerCore * Math.max(0, coreLevel));

/** ...and what the Shipyard can turn out, for anything that flies. */
export const yardThroughput = (shipyardLevel: number): number =>
  BUILD.yardBase * (1 + BUILD.yardPerYard * Math.max(0, shipyardLevel));

/**
 * Ground defence has its own rate, and it is DERIVED rather than chosen.
 *
 * A turret is bolted down, not fitted out in a yard — but the real reason is the
 * promise the radar makes. `docs/balance.md` sells a radar warning as *the window
 * to ARM*, so one gun has to be buildable inside one. See `BUILD.defBase`.
 */
export const defenceThroughput = (shipyardLevel: number): number =>
  BUILD.defBase * (1 + BUILD.defPerYard * Math.max(0, shipyardLevel));

/**
 * MINUTES, PRICED IN RESOURCES. See `BUILD` for why there is no per-level table.
 *
 * Every one of these is capped, so nothing in the game can ever take longer than
 * `BUILD.capMinutes` however dear it gets.
 */
export const buildMinutes = (cost: Resources, coreLevel: number): number =>
  Math.min(BUILD.capMinutes, totalOf(cost) / constructionThroughput(coreLevel));

/**
 * Yard time, after whatever the commander has automated. T8.
 *
 * `tech` is REQUIRED rather than defaulted, so the compiler names every caller
 * that has to decide. A silently-neutral default is how a multiplier ends up
 * honoured on the server and forgotten in the preview.
 */
export const shipMinutes = (
  cost: Resources,
  shipyardLevel: number,
  tech: TechLevels,
): number =>
  Math.min(BUILD.capMinutes, (totalOf(cost) / yardThroughput(shipyardLevel)) * yardSpeedMult(tech));

export const defenceMinutes = (cost: Resources, shipyardLevel: number): number =>
  Math.min(BUILD.capMinutes, totalOf(cost) / defenceThroughput(shipyardLevel));

export const researchMinutes = (cost: Resources, coreLevel: number): number =>
  Math.min(
    BUILD.capMinutes,
    (BUILD.researchTimeMult * totalOf(cost)) / constructionThroughput(coreLevel),
  );

/**
 * What cancelling an order hands back. Floored, so the fee can never round in the
 * player's favour and be farmed.
 */
export const cancelRefund = (cost: Resources): Resources => ({
  alloy: Math.floor(cost.alloy * BUILD.cancelRefund),
  crystal: Math.floor(cost.crystal * BUILD.cancelRefund),
  deuterium: Math.floor(cost.deuterium * BUILD.cancelRefund),
});

/** Which of the two queues a thing is built in. They run independently. */
export type BuildQueueId = 'CONSTRUCTION' | 'YARD';

/**
 * One pending order, as the rules see it.
 *
 * Deliberately has no id, no planet and no clock: this package may not know what a
 * database row is. The server maps its own rows onto this and back.
 */
export interface PendingOrder {
  queue: BuildQueueId;
  /** Minutes of work the order still needs. */
  minutes: number;
}

/**
 * When each order in a queue finishes, given a start instant in season minutes.
 *
 * ORDERS RUN ONE AT A TIME, IN THE ORDER THEY WERE PLACED, and only the head of a
 * queue is running. That is what makes a queue a decision rather than a parallel
 * purchase: a third order behind two long ones is a real cost.
 *
 * Pure, and takes `nowMinutes` in — this package has no clock.
 */
export function resolveQueue(
  orders: readonly PendingOrder[],
  nowMinutes: number,
): number[] {
  const out: number[] = [];
  let at = nowMinutes;
  for (const order of orders) {
    at += Math.max(0, order.minutes);
    out.push(at);
  }
  return out;
}

/* ── Disruption ─────────────────────────────────────────────────── */

export const disruptionMinutes = (grade: 'DECISIVE' | 'PARTIAL' | 'REPELLED'): number =>
  grade === 'DECISIVE'
    ? DISRUPTION.decisiveMinutes
    : grade === 'PARTIAL'
      ? DISRUPTION.partialMinutes
      : 0;

/** Refreshes rather than stacks, and is capped — chain-raiding cannot bury a player. */
export function applyDisruption(
  disruptedUntil: number,
  now: number,
  grade: 'DECISIVE' | 'PARTIAL' | 'REPELLED',
): number {
  const add = disruptionMinutes(grade);
  if (add === 0) return disruptedUntil;
  return Math.min(now + DISRUPTION.maxPendingMinutes, Math.max(disruptedUntil, now + add));
}

/** Producing minutes inside [from, to), given surface works offline until `until`. */
export function productiveMinutes(from: number, to: number, until = 0): number {
  const span = Math.max(0, to - from);
  const lost = Math.max(0, Math.min(to, until) - from);
  return Math.max(0, span - lost);
}

/* ── The lazy tick ──────────────────────────────────────────────── */

export interface PlanetEconomyState {
  /** In STORAGE. Spendable, raidable in full, protected by the vault floor. */
  alloy: number;
  crystal: number;
  deuterium: number;
  /**
   * Sitting in the works, uncollected. D16.
   *
   * Not spendable until the player empties it, raidable at
   * `COMBAT.lootBufferShare`, and it stops growing at `collectorCap` — which is
   * what makes emptying it the reason to open the game.
   */
  bufferAlloy: number;
  bufferCrystal: number;
  bufferDeuterium: number;
  shield: number;
  lastTickMinutes: number;
  disruptedUntilMinutes: number;
}

export interface PlanetEconomyInput {
  refineryLevel: number;
  extractorLevel: number;
  /** The Deuterium Refinery. Zero on a world that has not researched one. T5. */
  plantLevel: number;
  aegisLevel: number;
  /**
   * The Vault level, because the STORE's ceiling depends on it. Economy v2.
   *
   * Required, for the same reason `storageCap` requires it: a caller that does not
   * know the Vault level cannot compute the ceiling it is about to clamp against.
   * See `ECON.capHours`.
   */
  vaultLevel: number;
  /**
   * The Foundry's multiplier on everything the works make. D25. Defaults to 1.
   *
   * Applied to the RATE, so the storage ceiling and the collector ceiling move with
   * it — a Foundry makes a planet bigger rather than merely faster. Optional so
   * every caller that predates the satellite reads exactly the number it always
   * did.
   */
  production?: number;
}

/**
 * Advance a planet's continuous state to `nowMinutes`.
 *
 * This is the entire offline-progression system. It is called at the top of any
 * transaction that touches a planet, and never on a timer — production for 300
 * players costs exactly zero background compute.
 *
 * PRODUCTION GOES INTO THE WORKS, NOT INTO STORAGE (D16). The buffer fills to
 * `collectorCap` and then the works stand idle; `collect()` is the only thing that
 * moves ore into storage. Two consequences worth stating, because both look like
 * bugs from the outside:
 *
 *   · Storage does not grow on its own any more. A planet nobody touches for a
 *     week has a full buffer and exactly the storage it started with.
 *   · The clamp is what stops time. Because the buffer is capped, an absence of a
 *     day and an absence of a month produce the same state — which is the honest
 *     version of a storage cap and the reason the ceiling is worth showing.
 *
 * Shield regeneration deliberately uses wall-clock minutes rather than productive
 * ones: it is a separate system and disruption should not freeze it.
 */
export function advanceEconomy(
  state: PlanetEconomyState,
  input: PlanetEconomyInput,
  nowMinutes: number,
): PlanetEconomyState {
  if (nowMinutes <= state.lastTickMinutes) return state;

  const producing = productiveMinutes(
    state.lastTickMinutes,
    nowMinutes,
    state.disruptedUntilMinutes,
  ) / 60;
  const wall = (nowMinutes - state.lastTickMinutes) / 60;

  const boost = input.production ?? 1;
  const ra = alloyRate(input.refineryLevel) * boost;
  const rc = crystalRate(input.extractorLevel) * boost;
  const rd = deuteriumRate(input.plantLevel) * boost;
  const maxShield = shieldHp(input.aegisLevel);

  return {
    alloy: state.alloy,
    crystal: state.crystal,
    deuterium: state.deuterium,
    bufferAlloy: Math.min(collectorCap(ra), state.bufferAlloy + ra * producing),
    bufferCrystal: Math.min(collectorCap(rc), state.bufferCrystal + rc * producing),
    /*
      THE LINE THAT WAS A CONSTANT. T5.

      This read `state.bufferDeuterium` — carried across untouched, because the
      resource had no production and the works could only ever receive what a
      mining craft brought home. It grows now, under the same collector ceiling the
      other two obey, and a world with no plant is left exactly where it was
      because its rate is zero. The Foundry's boost applies here as well: it
      multiplies everything the works make, and this is now something they make.
    */
    bufferDeuterium: rd <= 0
      ? state.bufferDeuterium
      : Math.min(deuteriumCollectorCap(rd, rc), state.bufferDeuterium + rd * producing),
    shield:
      maxShield > 0
        ? Math.min(maxShield, state.shield + maxShield * SHIELD.regenPerHour * wall)
        : 0,
    lastTickMinutes: nowMinutes,
    disruptedUntilMinutes: state.disruptedUntilMinutes,
  };
}

export interface Collection {
  state: PlanetEconomyState;
  /** What actually moved into storage. */
  moved: Resources;
  /**
   * What would not fit and STAYED IN THE WORKS.
   *
   * Deliberately not destroyed. Collecting into a full store would otherwise
   * punish the player for pressing the button the interface is asking them to
   * press, and the honest answer — "your storage is full, spend something" — is
   * one the buffer can hold on to indefinitely.
   */
  blocked: Resources;
}

/**
 * Empty the works into storage. D16.
 *
 * The one manual step in the economy, and the whole reason to open the game when
 * nothing is in flight. Idempotent in the sense that matters: collecting twice in
 * a row moves nothing the second time.
 */
export function collect(
  state: PlanetEconomyState,
  input: PlanetEconomyInput,
): Collection {
  const boost = input.production ?? 1;
  const ra = alloyRate(input.refineryLevel) * boost;
  const rc = crystalRate(input.extractorLevel) * boost;
  /*
    DEUTERIUM'S OWN RATE, and this line is why the parameter was renamed. T5.

    It read `deuteriumStorageCap(rc, vault)` — the CRYSTAL rate — which was the only
    honest figure available while deuterium had no production of its own. After T5
    that argument means something else entirely, and both are `number`: the
    compiler could not see the difference and this clamp went on sizing a
    deuterium store off a mine that makes something else. Measured, the gap was
    twenty-four fold.
  */
  const rd = deuteriumRate(input.plantLevel) * boost;

  const vault = input.vaultLevel;
  const roomA = Math.max(0, storageCap(ra, vault) - state.alloy);
  const roomC = Math.max(0, storageCap(rc, vault) - state.crystal);
  const roomD = Math.max(0, deuteriumStorageCap(rd, rc, vault) - state.deuterium);
  const takeA = Math.min(state.bufferAlloy, roomA);
  const takeC = Math.min(state.bufferCrystal, roomC);
  const takeD = Math.min(state.bufferDeuterium, roomD);

  return {
    state: {
      ...state,
      alloy: state.alloy + takeA,
      crystal: state.crystal + takeC,
      deuterium: state.deuterium + takeD,
      bufferAlloy: state.bufferAlloy - takeA,
      bufferCrystal: state.bufferCrystal - takeC,
      bufferDeuterium: state.bufferDeuterium - takeD,
    },
    moved: { alloy: takeA, crystal: takeC, deuterium: takeD },
    blocked: {
      alloy: state.bufferAlloy - takeA,
      crystal: state.bufferCrystal - takeC,
      deuterium: state.bufferDeuterium - takeD,
    },
  };
}

/**
 * Minutes until the works fill and stop, or null if they already have.
 *
 * The number the interface leads with: "full in 3h 20m" is a reason to come back,
 * and "FULL — you are wasting 160/h" is a reason to come back right now.
 */
export function minutesUntilCollectorFull(
  buffer: number,
  ratePerHour: number,
): number | null {
  if (ratePerHour <= 0) return null;
  const room = collectorCap(ratePerHour) - buffer;
  if (room <= 0) return null;
  return (room / ratePerHour) * 60;
}
