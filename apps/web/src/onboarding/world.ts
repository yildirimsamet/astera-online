import {
  BUILD,
  BUILDING_IDS,
  HULLS,
  INSTRUMENT_IDS,
  RESEARCH_PROJECTS,
  SATELLITE_IDS,
  OPENING_BONUS,
  START,
  START_BUILDINGS,
  buildingCost,
  alloyRate,
  collectorCap,
  crystalRate,
  deuteriumCollectorCap,
  deuteriumRate,
  deuteriumStorageCap,
  flightSlots,
  groundLoad,
  groundSlots,
  hangarCapacity,
  hangarLoad,
  hullBulk,
  instrumentCost,
  productionMult,
  satelliteCost,
  satelliteSlots,
  storageCap,
  vaultProtects,
  wealth,
  type BuildingId,
  type HullId,
} from '@astera/rules';
import type {
  BuildOrderView,
  ClaimIntent,
  PlanetView,
  Preview,
} from '../api/schemas.js';

/**
 * THE REHEARSAL'S WORLD. D56.
 *
 * A planet that does not exist, kept in memory, driven by the same
 * `@astera/rules` the server validates against — and that shared module is the
 * whole reason this design is cheap here and would be reckless anywhere else. The
 * package has no clock, no I/O and no ambient randomness, so "what does the Core
 * cost at level 1" has exactly one answer on both sides of the wire.
 *
 * IT DECIDES NOTHING. Everything below produces two things: a `PlanetView` to
 * render, and an INTENT to remember. The intents are what travel at the end, and
 * the server runs them through `upgradeBuilding`, `buildUnits` and `launchAttack`
 * exactly as it would for a signed-in player. Principle 1 is not bent: the client
 * is rendering and sending intent, and the fact that it can also predict the
 * outcome is what lets the screen keep up with a finger.
 *
 * EVERY GUARD THE SERVER HAS IS RE-CHECKED HERE, and the reason is D53's rule
 * about optimistic prediction: a prediction that is only usually right is worse
 * than none. If this offered an upgrade the claim would refuse, the player would
 * watch their opening un-happen on the one screen the game is played on.
 */

export interface RehearsalWorld {
  /** The world the server said it would give this visitor. */
  reserved: Preview['reserved'];
  buildings: Record<BuildingId, number>;
  alloy: number;
  crystal: number;
  /**
   * THE TANK, AND IT IS THE ONE PART OF THE CUSHION THE REHEARSAL GETS. T6.
   *
   * `START` holds no deuterium because none of the four things the opening teaches
   * costs any — and that is exactly why withholding it teaches nothing. Since T6
   * every launch burns fuel, so a rehearsal opening on zero would find the guided
   * launch beat's own control greyed out, with no way forward and no explanation.
   * The scarcity the rehearsal is built to teach is in alloy and crystal, where the
   * four purchases actually compete.
   */
  deuterium: number;
  /** Paid decisions staged locally; claim gives them their server-authored clocks. */
  queues: NonNullable<PlanetView['queues']>;
  /** What was pressed, in the order it was pressed. This is what travels. */
  intents: ClaimIntent[];
}

export function openWorld(preview: Preview): RehearsalWorld {
  return {
    reserved: preview.reserved,
    buildings: { ...START_BUILDINGS },
    /**
     * THE REHEARSAL RUNS ON `START`, NOT ON WHAT THE PLANET IS CREATED WITH — and
     * the difference is deliberate. D58.
     *
     * `START` is the arithmetic the opening TEACHES: three mandatory upgrades that
     * spend the crystal to the last unit, and exactly two Wasps with what is left.
     * A beat says so out loud. Handing the rehearsal the cushion as well would make
     * that sentence false, let a fourth upgrade and a third Wasp become affordable
     * inside a guided beat, and turn a lesson in scarcity into a shopping trip.
     *
     * The cushion is what the commander finds when the rehearsal becomes a season —
     * the server creates the real planet with `PLANET_START`, the replay spends
     * `START` of it, and precisely `OPENING_BONUS` is left standing. So this is not
     * a misprediction that has to be reconciled: it is the same arithmetic, and the
     * only thing the player is not told in advance is the welcome.
     */
    alloy: START.alloy,
    crystal: START.crystal,
    deuterium: OPENING_BONUS.deuterium,
    queues: { CONSTRUCTION: [], YARD: [] },
    intents: [],
  };
}

/* ── what may be pressed ────────────────────────────────────── */

/** Why an opening step is refused, in the server's own vocabulary. */
export type Refusal =
  | 'CORE_CEILING'
  | 'GROUND_SLOTS_FULL'
  | 'HANGAR_FULL'
  | 'INSUFFICIENT_RESOURCES'
  | 'QUEUE_FULL'
  | 'SHIPYARD_TOO_LOW';

/** Durable state plus earlier staged Construction orders, exactly like the server gate. */
export function projectedBuildings(w: RehearsalWorld): Record<BuildingId, number> {
  const projected = { ...w.buildings };
  for (const order of w.queues.CONSTRUCTION) {
    if (order.kind !== 'BUILDING' || !BUILDING_IDS.includes(order.subject as BuildingId)) continue;
    const id = order.subject as BuildingId;
    projected[id] += 1;
  }
  return projected;
}

export function queuedCount(
  w: RehearsalWorld,
  queue: 'CONSTRUCTION' | 'YARD',
  kind: BuildOrderView['kind'],
  subject: string,
): number {
  return w.queues[queue]
    .filter((order) => order.kind === kind && order.subject === subject)
    .reduce((sum, order) => sum + order.count, 0);
}

/**
 * The Core ceiling and the price, checked in that order — which is the order
 * `upgradeBuilding` checks them in, so the refusal a player sees is the refusal
 * they would have got.
 */
export function refusesUpgrade(w: RehearsalWorld, type: BuildingId): Refusal | null {
  if (w.queues.CONSTRUCTION.length >= BUILD.queueDepth) return 'QUEUE_FULL';
  const projected = projectedBuildings(w);
  const level = projected[type];
  if (type !== 'CORE' && level >= projected.CORE) return 'CORE_CEILING';
  const cost = buildingCost(type, level);
  if (w.alloy < cost.alloy || w.crystal < cost.crystal) return 'INSUFFICIENT_RESOURCES';
  return null;
}

export function refusesBuild(w: RehearsalWorld, hull: HullId, count: number): Refusal | null {
  if (w.queues.YARD.length >= BUILD.queueDepth) return 'QUEUE_FULL';
  const spec = HULLS[hull];
  if (w.buildings.SHIPYARD < spec.minShipyard) return 'SHIPYARD_TOO_LOW';
  if (w.alloy < spec.alloy * count || w.crystal < spec.crystal * count) {
    return 'INSUFFICIENT_RESOURCES';
  }
  const queued = Object.fromEntries(
    w.queues.YARD
      .filter((order) => order.kind === 'HULL')
      .map((order) => [order.subject, queuedCount(w, 'YARD', 'HULL', order.subject)]),
  );
  const capacity = spec.ground
    ? groundSlots(w.buildings.CORE)
    : hangarCapacity(w.buildings.HANGAR);
  const used = spec.ground ? groundLoad(queued) : hangarLoad(queued);
  if (used + hullBulk(hull) * count > capacity) {
    return spec.ground ? 'GROUND_SLOTS_FULL' : 'HANGAR_FULL';
  }
  return null;
}

/* ── pressing them ──────────────────────────────────────────── */

export function upgrade(w: RehearsalWorld, type: BuildingId): RehearsalWorld {
  if (refusesUpgrade(w, type)) return w;
  const projected = projectedBuildings(w);
  const cost = buildingCost(type, projected[type]);
  const order = {
    id: `rehearsal-construction-${String(w.queues.CONSTRUCTION.length)}`,
    queue: 'CONSTRUCTION' as const,
    slot: w.queues.CONSTRUCTION.length,
    kind: 'BUILDING' as const,
    subject: type,
    count: 1,
    cost,
    staged: true as const,
  } satisfies BuildOrderView;
  return {
    ...w,
    alloy: w.alloy - cost.alloy,
    crystal: w.crystal - cost.crystal,
    queues: {
      ...w.queues,
      CONSTRUCTION: [...w.queues.CONSTRUCTION, order],
    },
    intents: [...w.intents, { kind: 'upgrade', building: type }],
  };
}

export function build(w: RehearsalWorld, hull: HullId, count: number): RehearsalWorld {
  if (refusesBuild(w, hull, count)) return w;
  const spec = HULLS[hull];
  const cost = {
    alloy: spec.alloy * count,
    crystal: spec.crystal * count,
    deuterium: spec.deuterium * count,
  };
  const order = {
    id: `rehearsal-yard-${String(w.queues.YARD.length)}`,
    queue: 'YARD' as const,
    slot: w.queues.YARD.length,
    kind: 'HULL' as const,
    subject: hull,
    count,
    cost,
    staged: true as const,
  } satisfies BuildOrderView;
  return {
    ...w,
    alloy: w.alloy - cost.alloy,
    crystal: w.crystal - cost.crystal,
    queues: {
      ...w.queues,
      YARD: [...w.queues.YARD, order],
    },
    intents: [...w.intents, { kind: 'build', hull, count }],
  };
}

/* ── rendering it ───────────────────────────────────────────── */

/**
 * The world as `/api/planet` would describe it.
 *
 * Built to the production schema on purpose: the rehearsal hands this to the very
 * same `PlanetScreen` the game uses, which is what stops the tutorial teaching an
 * interface that does not exist. Every figure comes from the rules package, in the
 * same order `services/planetView.ts` derives them — including `productionMult`,
 * which lifts the rate and therefore both caps with it.
 */
export function planetOf(w: RehearsalWorld): PlanetView {
  const boost = productionMult([]);
  const perHourAlloy = alloyRate(w.buildings.REFINERY) * boost;
  // The floor is hours of each resource's OWN production, so it needs the
  // producing levels as well as the Vault's. One call, three readings.
  const floor = vaultProtects(w.buildings.VAULT, w.buildings.REFINERY, w.buildings.EXTRACTOR, w.buildings.DEUTERIUM_PLANT);
  const perHourCrystal = crystalRate(w.buildings.EXTRACTOR) * boost;
  const perHourDeuterium = deuteriumRate(w.buildings.DEUTERIUM_PLANT) * boost;
  const committed = [...w.queues.CONSTRUCTION, ...w.queues.YARD]
    .reduce((sum, order) => ({
      alloy: sum.alloy + order.cost.alloy,
      crystal: sum.crystal + order.cost.crystal,
      deuterium: sum.deuterium + order.cost.deuterium,
    }), { alloy: 0, crystal: 0, deuterium: 0 });

  return {
    planet: {
      id: w.reserved.id,
      name: w.reserved.name,
      position: w.reserved.position,
      alloy: Math.floor(w.alloy),
      crystal: Math.floor(w.crystal),
      /*
        THE STARTING TANK, AND WITHOUT IT THE REHEARSAL DEAD-ENDS. T6.

        This read a hard zero, which was true while nothing burned deuterium. Since
        every launch does, `LaunchSheet` disables its commit when the fuel exceeds
        the tank — so a visitor reaching the guided launch beat would have found the
        one control the beat requires greyed out, with no way forward and no
        explanation. The rehearsal has to open with what a real world opens with.
      */
          deuterium: Math.floor(w.deuterium),
      alloyCap: storageCap(perHourAlloy, w.buildings.VAULT),
      crystalCap: storageCap(perHourCrystal, w.buildings.VAULT),
      deuteriumCap: deuteriumStorageCap(perHourDeuterium, perHourCrystal, w.buildings.VAULT),
      alloyPerHour: Math.round(perHourAlloy),
      deuteriumPerHour: Math.round(perHourDeuterium),
      crystalPerHour: Math.round(perHourCrystal),
      /**
       * THE WORKS ARE EMPTY AND STAY EMPTY.
       *
       * A rehearsal lasts two minutes and nothing accrues in it. Ticking a buffer
       * would be the one place this world drifts from the one the claim creates —
       * the server starts a planet's clock when the row is written, not when a
       * visitor started looking — and it would put a number on screen that the
       * first real payload then corrects downward.
       */
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      bufferAlloyCap: collectorCap(perHourAlloy),
      bufferCrystalCap: collectorCap(perHourCrystal),
      bufferDeuteriumCap: deuteriumCollectorCap(perHourDeuterium, perHourCrystal),
      // The same figure the server sends: what is actually safe, not the floor.
      vaultFloor:
        Math.min(w.alloy, floor.alloy) + Math.min(w.crystal, floor.crystal),
      vaultProtected: {
        alloy: Math.min(w.alloy, floor.alloy),
        crystal: Math.min(w.crystal, floor.crystal),
        deuterium: 0,
      },
      vaultCapacity: floor,
      shield: 0,
      shieldMax: 0,
      shieldPerHour: 0,
      disruptedUntil: null,
    },
    buildings: { ...w.buildings },
    nextCosts: Object.fromEntries(
      BUILDING_IDS.map((b) => [b, buildingCost(b, w.buildings[b])]),
    ),
    instruments: Object.fromEntries(INSTRUMENT_IDS.map((i) => [i, 0])),
    instrumentCosts: Object.fromEntries(
      INSTRUMENT_IDS.map((i) => [i, instrumentCost(i, 0)]),
    ),
    orbit: [],
    orbitSlots: satelliteSlots(w.buildings.CORE),
    satelliteCosts: Object.fromEntries(SATELLITE_IDS.map((s) => [s, satelliteCost(s)])),
    research: [
      {
        id: 'ISOTOPE_SPECTROMETRY',
        cost: RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.costAt(1),
        discovered: false,
        completed: false,
        completedAt: null,
        available: false,
        availableAt: new Date('2999-01-01T00:00:00.000Z'),
        prerequisite: null,
      },
      {
        id: 'DENSE_FUEL_CELLS',
        cost: RESEARCH_PROJECTS.DENSE_FUEL_CELLS.costAt(1),
        discovered: false,
        completed: false,
        completedAt: null,
        available: false,
        availableAt: new Date('2999-01-01T00:00:00.000Z'),
        prerequisite: 'ISOTOPE_SPECTROMETRY',
      },
    ],
    queues: w.queues,
    fleet: {},
    ground: {},
    fleetAway: {},
    flight: { used: 0, total: flightSlots(w.buildings.CORE) },
    capacity: {
      hangar: hangarCapacity(w.buildings.HANGAR),
      hangarUsed: 0,
      ground: groundSlots(w.buildings.CORE),
      groundUsed: 0,
    },
    score: {
      wealth: wealth({
        buildings: w.buildings,
        instruments: {},
        satellites: [],
        fleet: {},
        ground: {},
        alloy: w.alloy + committed.alloy,
        crystal: w.crystal + committed.crystal,
        deuterium: committed.deuterium,
      }),
      // Only combat makes Dominion, and none has happened.
      dominion: 0,
    },
  };
}
