import { HULLS } from './hulls.js';
import type { HullId } from './types.js';
import { profileIncome, profileBuilding, profileInvoice, profileHull } from './economy-profile.js';
import { ECONOMY_ADJUSTMENT } from './tempo.js';
import { robotSpeedMult, yardSpeedMult } from './tech.js';
import type { TechLevels } from './tech.js';
import {
  ABUSE,
  BUILD,
  DISRUPTION,
  FAULT,
  DEUTERIUM,
  ECON,
  INSTRUMENT_COST_MULT,
  INSTRUMENT_COST_DISCOUNT,
  SENSOR_INSTRUMENT_COST_GROWTH,
  EMPLACEMENT,
  HANGAR,
  SATELLITES,
  SEASON,
  UPLINK_BUILD_MINUTES,
  SHIELD,
} from './constants.js';
import {
  INSTRUMENT_IDS,
  hasFault,
  type BuildingId,
  type FaultSet,
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
 * Every fleet or mining squadron that leaves holds one slot for the WHOLE ROUND
 * TRIP and gives it back when it lands. Explorer probes are the explicit
 * exception: their paid launches are paced per target and never occupy these bays.
 * One mining run is one slot however many Prospectors are in it.
 *
 * THIS IS THE UNIT OF PACING, and it replaces nothing that was working. D4 ruled
 * out build timers, correctly, and then nothing took over the job of occupying
 * time — so a session is "collect, buy the one thing you can afford, close", and
 * closes with nothing pending. A slot count is the honest version of the return
 * hook: a dark bay on your own dashboard says *you have not finished your turn*
 * without a notification, a streak or a bonus.
 *
 * Mining still uses the general bay rule, closing unlimited concurrent runs
 * without a one-run-per-target special case.
 *
 * BASE THREE, NOT TWO. Owner decision, and the conservative one: three is exactly
 * today's probe cap, so nothing a player can do now becomes impossible. It means
 * scarcity is not felt in the first hour, which is the cost; what it buys is that
 * the mechanic can never read as a wall to somebody who has just arrived.
 */
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

/**
 * HOW MUCH FLEET A WORLD MAY HOLD, IN ROOM. See the `HANGAR` block for the ladder.
 *
 * A missing row reads as the base rather than as nothing: a world seeded before the
 * Hangar existed still keeps the fleet it had, and the refusal it meets is "raise
 * your Hangar", never "you have no Hangar at all".
 */
export const hangarCapacity = (hangarLevel: number): number => {
  const rung = Math.min(HANGAR.maxLevel, Math.max(1, Math.floor(hangarLevel)));
  return HANGAR.capacity[rung] ?? HANGAR.capacity[1];
};

/**
 * THE TALLEST HANGAR THIS COMMAND CORE ALLOWS. The rungs open at the Core levels
 * where a development tier changes (`coreTier`), and a Core-16 world may buy every
 * rung the ladder has. The one statement of the gate: the build door, the strike
 * clamp and the client all read it.
 */
export function hangarCeiling(coreLevel: number): number {
  let top = 0;
  for (let rung = 1; rung <= HANGAR.maxLevel; rung++) {
    if (coreLevel >= HANGAR.coreGate[rung]!) top = rung;
  }
  return top;
}

/** The rung a Core opens by itself; what a live world is handed when the Hangar returns. */
export const hangarSeedLevel = (coreLevel: number): number =>
  Math.min(HANGAR.seedTop, hangarCeiling(coreLevel));

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
 * THE OPENING LIFT ON ALLOY, AND IT ENDS BY DECAYING. See `ECONOMY_ADJUSTMENT`.
 *
 * Flat across the opening, then a straight line back to 1.00 at
 * `alloyLiftEndLevel` — the version with an EDGE at L9 made the next upgrade a
 * downgrade, which is the one thing a ladder may never do.
 */
const alloyLift = (level: number): number => {
  const { earlyAlloyOutputMultiplier: lift, earlyAlloyMaxLevel: flat, alloyLiftEndLevel: end }
    = ECONOMY_ADJUSTMENT;
  if (level < 1) return 1;
  if (level <= flat) return lift;
  if (level >= end) return 1;
  return 1 + (lift - 1) * (end - level) / (end - flat);
};

/**
 * `base × L × growth^L` per hour. See `ECON.alloyBase` for why the linear factor
 * is there: it is what makes L1 → L2 a doubling and L17 → L18 a sixteenth.
 *
 * Level 0 produces nothing, which is correct — a planet is created with the
 * Refinery and the Extractor both at 1 and neither can ever go down.
 */
export const alloyRate = (level: number): number =>
  profileIncome(level).alloy * ECONOMY_ADJUSTMENT.producerOutput * alloyLift(level);

export const crystalRate = (level: number): number =>
  profileIncome(level).crystal * ECONOMY_ADJUSTMENT.producerOutput;

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

/**
 * THE VAULT'S OWN PRICE LADDER. D169, and it is the other half of
 * `ECON.storageHoursLadder`.
 *
 * The Vault left the shared building curve because its effect did. A store that
 * opens at three hours and reaches forty is the difference between banking an
 * afternoon and banking two days, and the old curve charged 55 alloy for the first
 * level of that — the price of a rounding error for the most consequential
 * building on the world.
 *
 * Indexed by the level being REACHED, one-based: `VAULT_PRICE[0]` takes a world
 * from Vault 0 to Vault 1. The figures are the owner's own table, typed rather
 * than generated, and `test/vault-table` holds every cell.
 */
export function buildingCost(type: BuildingId, level: number): Resources {
  return profileBuilding(type, level + 1).cost;
}

/**
 * Cost to take an instrument from `level` to `level + 1`. D22 · D191.
 *
 * A building's price with the instrument's own multiplier on it. Price is the only
 * gate on an instrument — any of the four, in any order, at any time — so it is
 * what has to make choosing between them cost something.
 *
 * THE `id` WENT UNREAD FOR A RELEASE and all four cost the same. That is not a
 * neutral simplification: Radar out-reaches Telescope at every level, so at one
 * price Radar is strictly the better buy and the choice this function exists to
 * price stops being one. `INSTRUMENT_COST_MULT` had carried the differential since
 * D22 and the economy cutover stopped consulting it.
 *
 * Telescope stays dearer than Radar. Both seeing instruments use a gentler level
 * growth than the two counter-measures so the added L6–L8 reach remains attainable.
 */
export function instrumentCost(id: InstrumentId, level: number): Resources {
  const growth = id === 'TELESCOPE' || id === 'RADAR'
    ? SENSOR_INSTRUMENT_COST_GROWTH
    : 2;
  const base = profileInvoice(profileIncome(Math.min(30, (level + 1) * 2)),
    { alloy: 0.8 * growth ** level, crystal: 1.2 * growth ** level, deuterium: 0 });
  // Normalised on the cheap three, so this reads as "the Telescope is dearer"
  // rather than "everything went up".
  const mult = INSTRUMENT_COST_MULT[id] / INSTRUMENT_COST_MULT.RADAR;
  /*
    THE SENSOR DISCOUNT, APPLIED LAST AND ROUNDED.

    It lands on the finished figure rather than inside the invoice so the quote
    is exactly `round(undiscounted x INSTRUMENT_COST_DISCOUNT[id])` — the form the
    owner asked for and the form a reader can check with a calculator. Folding it
    into `base` instead would ceil a different intermediate and put two rungs one
    unit above the authored table for no reason anybody could reconstruct.
  */
  const discount = INSTRUMENT_COST_DISCOUNT[id];
  return {
    alloy: Math.round(Math.ceil(base.alloy * mult) * discount),
    crystal: Math.round(Math.ceil(base.crystal * mult) * discount),
    deuterium: 0,
  };
}

/** What a satellite costs. Flat — it is bought once and never raised. D25. */
export const satelliteCost = (id: SatelliteId): Resources => {
  // The Uplink is priced by hand (D209); the three multipliers stay on the profile.
  if (id === 'UPLINK') return { alloy: SATELLITES.UPLINK.alloy, crystal: SATELLITES.UPLINK.crystal, deuterium: 0 };
  const effort = { FOUNDRY: 4, DERRICK: 4, BEACON: 5 }[id];
  return profileInvoice(profileIncome(6), { alloy: effort, crystal: effort, deuterium: 0 });
};

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
  satelliteCost(id).alloy + satelliteCost(id).crystal;

/**
 * Hours of production the STORE holds, and the Vault is what makes it taller.
 *
 * Separate from `storageCap` because three callers need the hours rather than the
 * amount — the interface states them, and the invariant test compares them against
 * `protectedHours`.
 */
export const storageHours = (vaultLevel: number): number => {
  const level = Math.max(0, Math.floor(vaultLevel));
  const authoredFloor = storageTableHours(level) * ECON.storageScale;
  if (level === 0) return authoredFloor;

  /*
   * SAME-LEVEL PURCHASE GUARANTEE. A Vault at L must hold 110% of the resources
   * needed to take the matching Alloy Refinery / Crystal Extractor from L to
   * L+1. The ordinary Vault ladder remains the floor; this derived ceiling takes
   * over only when upgrade prices begin outgrowing the linear extrapolation.
   * Deuterium storage consumes these same hours through deuteriumStorageCap, so
   * all three producers retain the same storage window.
   */
  const refinery = buildingCost('REFINERY', level);
  const extractor = buildingCost('EXTRACTOR', level);
  const alloyTarget = Math.ceil(refinery.alloy * ECON.producerUpgradeStorageMargin);
  const crystalTarget = Math.ceil(extractor.crystal * ECON.producerUpgradeStorageMargin);
  const purchaseHours = Math.max(
    alloyTarget / alloyRate(level),
    crystalTarget / crystalRate(level),
  );
  return Math.max(authoredFloor, purchaseHours);
};

/**
 * The Vault's own table, in its own units, before `ECON.storageScale`. D171.
 *
 * Separate because the two answer different questions: this is the SHAPE of the
 * building's progression, which the owner authored, and the scale is what one of
 * its steps is worth in ore. `storageHours` above is the only composer of them,
 * and the only figure any caller in the game should ever read.
 */
const storageTableHours = (vaultLevel: number): number => {
  const ladder = ECON.storageHoursLadder;
  const level = Math.max(0, Math.floor(vaultLevel));
  const top = ladder.length - 1;
  if (level <= top) return ladder[level] ?? ladder[0];
  /*
    PAST THE TABLE, THE LAST STEP CONTINUES. The Command Core has no ceiling, so
    neither may the Vault — and a store that stopped growing at Vault 20 would
    re-create the crossing `ECON.storageHoursLadder` exists to prevent: an upgrade
    that costs more alloy than any store can hold, refused with nothing in the
    interface to explain it.
  */
  const lastStep = (ladder[top] ?? 0) - (ladder[top - 1] ?? 0);
  return (ladder[top] ?? 0) + lastStep * (level - top);
};

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
  profileIncome(Math.max(0, level)).deuterium * ECONOMY_ADJUSTMENT.producerOutput;

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
  Math.min(ECON.protectedHoursCap, storageHours(vaultLevel) * ECON.protectedShare);

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
 *
 * THE INSTRUMENT AND SATELLITE HALF OF THE CONSTRUCTION QUEUE. `buildingMinutes`
 * is the other; both take `tech` and both apply `robotSpeedMult`, because a queue
 * where two of three kinds feel a research is worse than one where none does.
 *
 * `tech` is REQUIRED, for the reason written over `shipMinutes`: a silently
 * neutral default is how a multiplier ends up honoured on the server and
 * forgotten in the preview.
 */
export const buildMinutes = (
  cost: Resources,
  coreLevel: number,
  tech: TechLevels,
): number =>
  Math.min(BUILD.capMinutes, totalOf(cost) / constructionThroughput(coreLevel) * ECONOMY_ADJUSTMENT.buildTime)
    * robotSpeedMult(tech);

/**
 * A SATELLITE'S TIMER — THE QUOTE EVERY SATELLITE ORDER READS. D209.
 *
 * The Uplink takes the owner's fixed `UPLINK_BUILD_MINUTES`; the other three are the
 * ordinary `buildMinutes` off their price. Both take the robot discount, because the
 * rule is the Construction QUEUE (D198), never a list of structures. `tech` is
 * required for the same reason it is on the other two quotes.
 */
export const satelliteMinutes = (
  id: SatelliteId,
  coreLevel: number,
  tech: TechLevels,
): number =>
  id === 'UPLINK'
    ? UPLINK_BUILD_MINUTES * ECONOMY_ADJUSTMENT.buildTime * robotSpeedMult(tech)
    : buildMinutes(satelliteCost(id), coreLevel, tech);

/**
 * WHAT A BUILDING'S TIMER ACTUALLY READS, AND THE ONLY THING THAT MAY BE QUOTED.
 * D198.
 *
 * `profileBuilding().minutes` is authored design work — the reference the economy
 * tools measure against — and it knows nothing about a commander. This is the
 * quote: the same figure after whatever that commander has automated. Server,
 * client and simulator all come through here, so the three cannot disagree.
 *
 * THE DISCOUNT LANDS AFTER THE CEILING, unlike `shipMinutes`, and that asymmetry
 * is deliberate rather than an oversight to be tidied up. `research.ts` already
 * records what a multiplier inside a clamp costs — at `BUILD.capMinutes` "further
 * cost stops being felt as time at all" — and a commander who bought five rungs
 * and watched a Core timer refuse to move would be reading exactly that defect.
 * The cap bounds the WORK; the robots shorten what comes out of it.
 */
export const buildingMinutes = (
  id: BuildingId,
  level: number,
  tech: TechLevels,
): number => profileBuilding(id, level).minutes * ECONOMY_ADJUSTMENT.buildTime * robotSpeedMult(tech);

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
  Math.min(BUILD.capMinutes, (totalOf(cost) / yardThroughput(shipyardLevel)) * yardSpeedMult(tech)
    * ECONOMY_ADJUSTMENT.buildTime);

export const defenceMinutes = (cost: Resources, shipyardLevel: number): number =>
  Math.min(BUILD.capMinutes, totalOf(cost) / defenceThroughput(shipyardLevel) * ECONOMY_ADJUSTMENT.buildTime);

export const researchMinutes = (cost: Resources, coreLevel: number): number =>
  Math.min(
    BUILD.capMinutes,
    (BUILD.researchTimeMult * totalOf(cost)) / constructionThroughput(coreLevel) * ECONOMY_ADJUSTMENT.buildTime,
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

/* ── Legacy persisted disruption compatibility ─────────────────── */

/** Legacy calculation retained for persisted pre-change deadlines and records. */
export const disruptionMinutes = (grade: 'DECISIVE' | 'PARTIAL' | 'REPELLED'): number =>
  grade === 'DECISIVE'
    ? DISRUPTION.decisiveMinutes
    : grade === 'PARTIAL'
      ? DISRUPTION.partialMinutes
      : 0;

/** Legacy deadline helper retained for persisted pre-change state and records. */
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

/**
 * HOURS OF PRODUCTION A SPAN IS WORTH, WITH THE RECOVERY BOOST APPLIED. 2026-09-16.
 *
 * Productive hours, plus the extra share `ABUSE.recoveryProductionMult` pays for
 * every productive minute before `boostUntil`. One statement for the server's lazy
 * tick and the client's works projection, so the vessel the player watches fill
 * and the figure a collection moves cannot disagree about a boosted hour.
 *
 * The boost is bounded by wall time and paid on productive time: a disruption
 * inside the window is still offline, and the window does not wait for it.
 * Anything that is not a finite instant is no boost at all.
 */
export function productionHours(
  from: number,
  to: number,
  disruptedUntil = 0,
  boostUntil: number | null = null,
): number {
  const ordinary = productiveMinutes(from, to, disruptedUntil);
  if (boostUntil === null || !Number.isFinite(boostUntil) || boostUntil <= from) {
    return ordinary / 60;
  }
  const boosted = productiveMinutes(from, Math.min(to, boostUntil), disruptedUntil);
  return (ordinary + boosted * (ABUSE.recoveryProductionMult - 1)) / 60;
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
  /**
   * LEAKED AND WAITING TO BECOME A PUBLIC FIELD. Koloni arızaları, `VAULT_LEAK`.
   *
   * Optional so every caller written before the fault system reads exactly the state
   * it always did; `advanceEconomy` always returns all three, at zero on a world with
   * nothing leaking. `vault_leak_flush` is the only thing that empties them, and what
   * it empties them INTO is a debris field anybody can see.
   */
  pendingLeakAlloy?: number;
  pendingLeakCrystal?: number;
  pendingLeakDeuterium?: number;
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
  /**
   * WHEN THIS WORLD'S RECOVERY BOOST ENDS, in season minutes. 2026-09-16.
   *
   * Absent or null on every world that was not the one a heavy defeat struck. The
   * server stamps it with the shield's end and cuts it to the instant the shield is
   * spent, so this function never has to know about the commander's shield itself.
  */
  recoveryBoostUntilMinutes?: number | null;
  /**
   * WHAT IS BROKEN ON THIS WORLD. Koloni arızaları; absent means nothing is.
   *
   * Three of the eight are read here and the other five are read where their effect
   * lives — a shield at the battle, a departure at the flight bay, a radius at the
   * sensor post. Nothing about a fault is central except the row it is written in.
   */
  faults?: FaultSet;
  /**
   * WHAT THIS LEAK HAS ALREADY PUT INTO ORBIT, so `FAULT.leakTotalStores` can stop it.
   *
   * Cumulative for the CURRENT occurrence and held on the fault row, not the planet:
   * a repaired and re-broken vault starts its budget again, which is what makes the
   * ceiling a property of the fault rather than of the world.
   */
  leakedSoFar?: Resources;
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

  /*
    HOURS OF PRODUCTION, NOT HOURS OF CLOCK. With no recovery boost this is exactly
    the productive hours it always was; with one, every boosted productive minute
    counts double. The collector ceilings below read the RATE, which the boost does
    not touch — the same vessel fills faster and is never made bigger.
  */
  const producing = productionHours(
    state.lastTickMinutes,
    nowMinutes,
    state.disruptedUntilMinutes,
    input.recoveryBoostUntilMinutes ?? null,
  );
  const wall = (nowMinutes - state.lastTickMinutes) / 60;

  /*
    NOMINAL RATES FIRST, AND THE DISTINCTION IS LOAD-BEARING.

    What a world's hardware is RATED at decides three ceilings — the works' own, the
    store's, and therefore how fast a broken vault bleeds. What it is PRODUCING is that
    same figure with an outage applied. Reading one number for both would mean a
    refinery outage quietly stopped the leak as well, and a commander could hold the
    ore by breaking the mine.
  */
  const boost = input.production ?? 1;
  const nominalA = alloyRate(input.refineryLevel) * boost;
  const nominalC = crystalRate(input.extractorLevel) * boost;
  const nominalD = deuteriumRate(input.plantLevel) * boost;

  const faults = input.faults;
  const ra = hasFault(faults, 'REFINERY_OUTAGE') ? 0 : nominalA;
  const rc = hasFault(faults, 'EXTRACTOR_OUTAGE') ? 0 : nominalC;
  const rd = hasFault(faults, 'PLANT_OUTAGE') ? 0 : nominalD;
  const maxShield = shieldHp(input.aegisLevel);

  /*
    THE LEAK RUNS ON PRODUCTIVE MINUTES, LIKE THE WORKS AND UNLIKE THE SHIELD.

    `disruptedUntil` says the surface is not running, and a plant nobody is running is
    not bleeding either. The shield stays the one exception for the reason it always
    was: it is a separate system that a raid should not freeze.
  */
  const nominal = { alloy: nominalA, crystal: nominalC, deuterium: nominalD };
  const leaking = hasFault(faults, 'VAULT_LEAK');
  const rate = leaking ? leakRates(nominal, input.vaultLevel) : NO_LEAK;
  const budget = leaking ? leakBudget(nominal, input.vaultLevel) : NO_LEAK;
  const spent = input.leakedSoFar ?? NO_LEAK;
  const room = (column: keyof Resources): number =>
    Math.max(0, budget[column] - spent[column]);

  const alloy = leakColumn({
    store: state.alloy,
    buffer: state.bufferAlloy,
    cap: collectorCap(nominalA),
    produce: ra,
    leak: rate.alloy,
    hours: producing,
    budget: room('alloy'),
  });
  const crystal = leakColumn({
    store: state.crystal,
    buffer: state.bufferCrystal,
    cap: collectorCap(nominalC),
    produce: rc,
    leak: rate.crystal,
    hours: producing,
    budget: room('crystal'),
  });
  /*
    A WORLD WITH NO PLANT IS LEFT EXACTLY WHERE IT WAS. T5's rule, kept: with no rate
    there is no ceiling to clamp a mined haul against, so the works are carried across
    by hand. It also means such a column never leaks — `leakRates` prices the leak off
    production and a tap that is not running cannot drip.
  */
  const deuterium = nominalD <= 0
    ? { store: state.deuterium, buffer: state.bufferDeuterium, leaked: 0 }
    : leakColumn({
      store: state.deuterium,
      buffer: state.bufferDeuterium,
      cap: deuteriumCollectorCap(nominalD, nominalC),
      produce: rd,
      leak: rate.deuterium,
      hours: producing,
      budget: room('deuterium'),
    });

  return {
    alloy: alloy.store,
    crystal: crystal.store,
    deuterium: deuterium.store,
    bufferAlloy: alloy.buffer,
    bufferCrystal: crystal.buffer,
    bufferDeuterium: deuterium.buffer,
    shield:
      maxShield > 0
        ? Math.min(maxShield, state.shield + maxShield * SHIELD.regenPerHour * wall)
        : 0,
    lastTickMinutes: nowMinutes,
    disruptedUntilMinutes: state.disruptedUntilMinutes,
    pendingLeakAlloy: (state.pendingLeakAlloy ?? 0) + alloy.leaked,
    pendingLeakCrystal: (state.pendingLeakCrystal ?? 0) + crystal.leaked,
    pendingLeakDeuterium: (state.pendingLeakDeuterium ?? 0) + deuterium.leaked,
  };
}

const NO_LEAK: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

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

/** Physical hull workload, shared by the real queue and its UI quote. */
export function hullWorkMinutes(id: HullId, count: number, yard: number, tech: TechLevels): number {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(yard) || yard < 0) throw new Error('Invalid hull work');
  return profileHull(HULLS[id]).workMinutes * count / (1 + 0.12 * yard) * yardSpeedMult(tech)
    * ECONOMY_ADJUSTMENT.buildTime;
}

/* ── the vault leak ──────────────────────────────────────────────────── */

/** The three production rates a world runs at, per hour. */
export interface ProductionRates {
  alloy: number;
  crystal: number;
  deuterium: number;
}

/**
 * HOW FAST EACH COLUMN BLEEDS, PER HOUR. Two clauses, and both are load-bearing:
 *
 *   · a FULL store empties in `leakDrainHours` — the owner's rule, and what makes the
 *     leak a threat to the bank rather than to the income;
 *   · never faster than `leakIncomeCap` times what the world makes — without which the
 *     same rule reads as 1.1× production at core 6 and 273× at core 30.
 *
 * Per column rather than one total: deuterium's store is sized off the CRYSTAL rate,
 * so a shared figure emptied that column before the player could read the notification.
 */
export function leakRates(rates: ProductionRates, vaultLevel: number): Resources {
  const fromStore = (cap: number): number => cap / FAULT.leakDrainHours;
  return {
    alloy: Math.min(fromStore(storageCap(rates.alloy, vaultLevel)), rates.alloy * FAULT.leakIncomeCap),
    crystal: Math.min(fromStore(storageCap(rates.crystal, vaultLevel)), rates.crystal * FAULT.leakIncomeCap),
    deuterium: Math.min(
      fromStore(deuteriumStorageCap(rates.deuterium, rates.crystal, vaultLevel)),
      rates.deuterium * FAULT.leakIncomeCap,
    ),
  };
}

/** The most one leak may ever cost, per column. Owner's ceiling: one full store. */
export function leakBudget(rates: ProductionRates, vaultLevel: number): Resources {
  const stores = FAULT.leakTotalStores;
  return {
    alloy: storageCap(rates.alloy, vaultLevel) * stores,
    crystal: storageCap(rates.crystal, vaultLevel) * stores,
    deuterium: deuteriumStorageCap(rates.deuterium, rates.crystal, vaultLevel) * stores,
  };
}

export interface LeakColumnInput {
  /** Spendable, in the vault. */
  store: number;
  /** Uncollected, in the works. Drains FIRST — owner's *"önce havuzdan akar"*. */
  buffer: number;
  /** The works' own ceiling, so production past it is never credited. */
  cap: number;
  produce: number;
  leak: number;
  hours: number;
  /** What this occurrence has left to spend before `leakTotalStores` is reached. */
  budget: number;
}

export interface LeakColumnResult {
  store: number;
  buffer: number;
  /** What reached orbit. This is what becomes a public field. */
  leaked: number;
}

/**
 * ONE COLUMN, LEAKING, ACROSS A SPAN — AND IT IS CONTINUOUS, NOT A BLOCK.
 *
 * THE OBVIOUS VERSION IS WRONG AND WAS MEASURED TO BE. "Add the production, then
 * subtract the leak" over-charges a long absence badly: the works idle at `cap` in the
 * first step and the leak then eats that ceiling PLUS the store, where a world that
 * actually bled continuously would have kept its works running (the buffer never
 * fills, so production never stops) and lost only the difference between the two
 * rates. On a day's absence the block version took about 67% more than the truth.
 *
 * Continuous is a closed form, because both rates are constant across the span:
 *
 *   · LEAK ≤ PRODUCTION — the works out-run the drain. The buffer fills as usual, the
 *     store is never touched, and once the buffer caps the works simply throttle to
 *     match. What the fault costs is the production that never arrived, and nothing
 *     the commander had already banked. This is the case `leakIncomeCap` creates at
 *     the bottom of the Core ladder, and it is the honest reading of *"önce havuzdan
 *     akar"*: the store's turn only comes when the works cannot keep up.
 *   · LEAK > PRODUCTION — the piles fall at the difference, buffer first, then store.
 *     When BOTH run dry the leak can only carry off what is being made, so the rate
 *     drops to production for the rest of the span. That is the owner's *"malzeme
 *     yoksa da doldukça akmalı"* stated as arithmetic, and it is why an empty world
 *     never goes negative.
 *
 * THE BUDGET IS SPENT FIRST AND THE REST OF THE SPAN IS AN ORDINARY ONE. Once the
 * occurrence has leaked its full store the world goes back to producing normally for
 * whatever is left of the interval — the fault stays, the loyalty goes on falling and
 * the repair is still owed, but there is nothing left to bleed.
 */
export function leakColumn(input: LeakColumnInput): LeakColumnResult {
  const { cap, produce, leak, hours } = input;
  if (!(hours > 0) || leak <= 0 || input.budget <= 0) {
    return ordinary(input.store, input.buffer, cap, produce, hours);
  }

  const drain = leak - produce;
  // When the piles can run dry the leak rate falls to `produce`; solving for the span
  // that spends exactly the budget has to know which side of that moment it lands on.
  const dry = drain > 0 ? (input.buffer + input.store) / drain : Number.POSITIVE_INFINITY;
  const spent = (span: number): number => (span <= dry
    ? leak * span
    : leak * dry + produce * (span - dry));

  let leaking = hours;
  if (spent(hours) > input.budget) {
    leaking = input.budget <= leak * Math.min(dry, hours)
      ? input.budget / leak
      : dry + (input.budget - leak * dry) / Math.max(produce, Number.MIN_VALUE);
    leaking = Math.min(hours, Math.max(0, leaking));
  }

  let { store, buffer } = input;
  let leaked = 0;
  if (leaking > 0) {
    if (drain <= 0) {
      buffer = Math.min(cap, buffer - drain * leaking);
      leaked = leak * leaking;
    } else if (leaking <= dry) {
      const removed = drain * leaking;
      const fromBuffer = Math.min(buffer, removed);
      buffer -= fromBuffer;
      // `Math.max` because `leaking === dry` removes the piles EXACTLY, and exactly is
      // a thing binary floating point cannot land on. A store of -1e-13 is a negative
      // balance everywhere downstream that reads it.
      store = Math.max(0, store - (removed - fromBuffer));
      leaked = leak * leaking;
    } else {
      buffer = 0;
      store = 0;
      leaked = leak * dry + produce * (leaking - dry);
    }
  }

  const rest = ordinary(store, buffer, cap, produce, hours - leaking);
  return { store: rest.store, buffer: rest.buffer, leaked };
}

/** A span with nothing leaking: the works fill to their ceiling and stop. */
function ordinary(
  store: number,
  buffer: number,
  cap: number,
  produce: number,
  hours: number,
): LeakColumnResult {
  return {
    store,
    buffer: hours > 0 ? Math.min(cap, buffer + produce * hours) : buffer,
    leaked: 0,
  };
}
