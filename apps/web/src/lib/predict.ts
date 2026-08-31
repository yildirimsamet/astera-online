import {
  BUILD,
  BUILDING_IDS,
  HULLS,
  INSTRUMENT_IDS,
  PROSPECTOR,
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECTS,
  SATELLITE_IDS,
  buildingCost,
  groundLoad,
  groundSlots,
  hangarCapacity,
  hangarLoad,
  hullBulk,
  instrumentCost,
  instrumentMaxed,
  satelliteSlots,
  satelliteCost,
  seeingUnlocked,
  type BuildQueueId,
  type BuildingId,
  type BuildingLevels,
  type HullId,
  type InstrumentId,
  type InstrumentLevels,
  type ResearchProjectId,
  type Resources,
  type SatelliteId,
} from '@astera/rules';
import type { BuildOrderView, PlanetView } from '../api/schemas.js';

/**
 * WHAT A TAP DOES, BEFORE THE SERVER SAYS SO. D53.
 *
 * A purchase commits immediately even though its result now finishes in a queue.
 * The optimistic frame therefore spends the resources and shows the commitment;
 * it never grants the building, hull or hardware before the server's named instant.
 *
 * IT IS A PREDICTION, NOT A DECISION. Principle 1 says the client never decides an
 * outcome, and nothing here does: the server validates against its own figures
 * inside a row lock, its answer overwrites this on arrival, and a refusal rolls it
 * back. `useProjected` has predicted the works between fetches on exactly this
 * basis since D16. What is new is only that a spend is predicted too.
 *
 * IT PREDICTS WHAT THE PLAYER IS LOOKING AT, AND NOTHING ELSE.
 *
 * That restraint is the whole design of this file. A full prediction would have to
 * re-derive storage caps from the new Refinery level, per-hour rates from the new
 * Foundry, orbit slots from the new Core, flight bays, Wealth — which is
 * `planetView` written a second time, in another language, guaranteed to drift the
 * first time a rule moves. So each predictor touches the two piles being spent, the
 * one thing being bought, and the price of the next one of it. Every derived figure
 * lands two hundred milliseconds later with the real answer, and nobody is staring
 * at a storage ceiling in those two hundred milliseconds.
 *
 * Each function is PURE and returns a new view. The caller decides whether to keep
 * it — see `useOptimisticPlanet` in `queries.ts`.
 */

/** Whether the two piles cover a price. The same test the server will apply. */
const affordable = (view: PlanetView, cost: Resources): boolean =>
  view.planet.alloy >= cost.alloy
  && view.planet.crystal >= cost.crystal
  && view.planet.deuterium >= cost.deuterium;

/** Pay for something, leaving every derived figure alone. */
function spend(view: PlanetView, cost: Resources): PlanetView {
  return {
    ...view,
    planet: {
      ...view.planet,
      alloy: view.planet.alloy - cost.alloy,
      crystal: view.planet.crystal - cost.crystal,
      deuterium: view.planet.deuterium - cost.deuterium,
    },
  };
}

/**
 * `null` means "do not predict this one".
 *
 * Returned whenever the answer is not certain from what the client holds — most
 * often because the player cannot afford it, in which case the server is about to
 * refuse and showing the purchase first would be a flicker of a lie. Predicting
 * only the certain cases is what keeps a rollback rare enough to be invisible.
 */
export type Prediction = PlanetView | null;

const BUILDINGS = new Set<string>(BUILDING_IDS);
const INSTRUMENTS = new Set<string>(INSTRUMENT_IDS);
const SATELLITES = new Set<string>(SATELLITE_IDS);
let optimisticOrder = 0;

export interface ProjectedQueueState {
  buildings: BuildingLevels;
  instruments: InstrumentLevels;
  /** Installed and queued hardware, including closed physical slots. */
  orbit: SatelliteId[];
  /** The prefix enabled by the projected Core level. */
  effectiveOrbit: SatelliteId[];
  /**
   * THE RUNG EACH PROJECT WILL STAND AT, not the set of ones held. T12.
   *
   * This was a `Set` of completed project ids, written when every project was a
   * permission. T7 gave them levels and the set could no longer say which rung —
   * so one queued rung of a five-rung ladder marked the whole thing held, which
   * refused the next rung on the same world and told the hull gates a ladder
   * queued at level one was finished.
   *
   * Missing is level zero. `researchHeld` is the permission question written on
   * top of it, so no caller has to remember which of the two it is asking.
   */
  research: Map<ResearchProjectId, number>;
  units: Partial<Record<HullId, number>>;
}

/** Whether a project is held AT ALL — the question every permission gate asks. */
export const researchHeld = (
  state: ProjectedQueueState,
  id: ResearchProjectId,
): boolean => (state.research.get(id) ?? 0) > 0;

const queueOrders = (view: PlanetView, queue: BuildQueueId): BuildOrderView[] =>
  view.queues?.[queue] ?? [];

/** The state after every order already ahead in one independent queue. */
export function projectedQueueState(
  view: PlanetView,
  queue: BuildQueueId,
): ProjectedQueueState {
  const state: ProjectedQueueState = {
    buildings: {
      CORE: view.buildings.CORE ?? 0,
      REFINERY: view.buildings.REFINERY ?? 0,
      EXTRACTOR: view.buildings.EXTRACTOR ?? 0,
      VAULT: view.buildings.VAULT ?? 0,
      SHIPYARD: view.buildings.SHIPYARD ?? 0,
      HANGAR: view.buildings.HANGAR ?? 0,
      DEUTERIUM_PLANT: view.buildings.DEUTERIUM_PLANT ?? 0,
    },
    instruments: { ...view.instruments },
    orbit: [...view.orbit],
    effectiveOrbit: [...(view.effectiveOrbit ?? view.orbit)],
    research: new Map(
      view.research
        .map((project) => [
          project.id,
          // An older server sends no `level`, where `completed` still means held.
          project.level ?? (project.completed ? 1 : 0),
        ] as const)
        .filter(([, level]) => level > 0),
    ),
    units: Object.fromEntries(
      Object.keys(HULLS).map((id) => {
        const hull = id as HullId;
        return [
          hull,
          (view.fleet[hull] ?? 0) + (view.ground[hull] ?? 0) + (view.fleetAway[hull] ?? 0),
        ];
      }),
    ),
  };

  for (const order of queueOrders(view, queue)) {
    if (order.kind === 'BUILDING' && BUILDINGS.has(order.subject)) {
      const id = order.subject as BuildingId;
      state.buildings[id] += 1;
      if (id === 'CORE') projectEffectiveOrbit(state);
    } else if (order.kind === 'HULL' && Object.hasOwn(HULLS, order.subject)) {
      const id = order.subject as HullId;
      state.units[id] = (state.units[id] ?? 0) + order.count;
    } else if (order.kind === 'INSTRUMENT' && INSTRUMENTS.has(order.subject)) {
      const id = order.subject as InstrumentId;
      state.instruments[id] = (state.instruments[id] ?? 0) + 1;
    } else if (order.kind === 'SATELLITE' && SATELLITES.has(order.subject)) {
      const id = order.subject as SatelliteId;
      if (!state.orbit.includes(id)) {
        state.orbit.push(id);
        projectEffectiveOrbit(state);
      }
    } else if (order.kind === 'RESEARCH' && Object.hasOwn(RESEARCH_PROJECTS, order.subject)) {
      /*
        THE ORDER'S `count` IS THE RUNG IT BUYS — that is how the server records
        it (`placeBuildOrder` in `services/research.ts`), and taking the larger of
        the two is the same `Math.max` `researchView` uses to project its own.
      */
      const id = order.subject as ResearchProjectId;
      state.research.set(id, Math.max(state.research.get(id) ?? 0, Math.max(1, order.count)));
    }
  }
  return state;
}

const projectEffectiveOrbit = (state: ProjectedQueueState): void => {
  state.effectiveOrbit = state.orbit.slice(0, satelliteSlots(state.buildings.CORE));
};

const queueHasRoom = (view: PlanetView, queue: BuildQueueId): boolean =>
  queueOrders(view, queue).length < BUILD.queueDepth;

/**
 * Add only the fact the client knows: an order was pressed and paid for.
 *
 * No fake completion instant is attached. The mutation response replaces this
 * short-lived marker with the server order carrying `startedAt` and `finishesAt`.
 */
function appendOrder(
  view: PlanetView,
  queue: BuildQueueId,
  kind: BuildOrderView['kind'],
  subject: string,
  count: number,
  cost: Resources,
): PlanetView {
  const orders = queueOrders(view, queue);
  const marker = {
    id: `optimistic-${String(++optimisticOrder)}`,
    queue,
    slot: orders.length,
    kind,
    subject,
    count,
    cost,
    optimistic: true as const,
  } satisfies BuildOrderView;
  const queues = view.queues ?? { CONSTRUCTION: [], YARD: [] };
  return {
    ...view,
    queues: {
      ...queues,
      [queue]: [...orders, marker],
    },
  };
}

export function predictUpgrade(view: PlanetView, type: BuildingId): Prediction {
  if (!queueHasRoom(view, 'CONSTRUCTION')) return null;
  const projected = projectedQueueState(view, 'CONSTRUCTION');
  const level = projected.buildings[type];
  // The durable next price comes from the server. Once an earlier order for this
  // same building is already queued, the shared rule prices the projected level
  // exactly as the server does; otherwise a second Core order would optimistically
  // spend the first Core's cheaper price before the response corrected it.
  const cost = level === view.buildings[type]
    ? view.nextCosts[type]
    : buildingCost(type, level);
  if (!cost) return null;
  if (!affordable(view, cost)) return null;
  /**
   * THE CORE CEILING, PREDICTED TOO. Otherwise the one refusal a player meets most
   * often — raising a structure past its Command Core — would show as a successful
   * upgrade that un-happens a moment later.
   */
  const core = projected.buildings.CORE;
  if (type !== 'CORE' && level >= core) return null;

  const next = spend(view, cost);
  return appendOrder(next, 'CONSTRUCTION', 'BUILDING', type, 1, cost);
}

export function predictBuild(view: PlanetView, hull: HullId, count: number): Prediction {
  if (!queueHasRoom(view, 'YARD')) return null;
  const projected = projectedQueueState(view, 'YARD');
  const spec = HULLS[hull];
  if (!Number.isInteger(count) || count < 1) return null;
  // The Shipyard gate, for the same reason the Core ceiling is checked above.
  if (projected.buildings.SHIPYARD < spec.minShipyard) return null;
  const completed = (project: 'DENSE_FUEL_CELLS' | 'GRAVITIC_CHARGES') =>
    researchHeld(projected, project);
  if (hull === 'RUNNER' && !completed('DENSE_FUEL_CELLS')) return null;
  if (hull === 'BREACHER' && !completed('GRAVITIC_CHARGES')) return null;

  const cost = {
    alloy: spec.alloy * count,
    crystal: spec.crystal * count,
    deuterium: spec.deuterium * count,
  };
  if (!affordable(view, cost)) return null;

  /**
   * A PROSPECTOR IS CAPPED BY WHAT YOU OWN, NOT BY WHAT IS AT HOME.
   *
   * `PROSPECTOR.max` counts craft wherever they are, which is why the payload
   * carries `fleetAway` at all. Predicting past that cap would offer a fourth
   * drill and then take it away.
   */
  const owned = projected.units[hull] ?? 0;
  if (hull === 'PROSPECTOR' && owned + count > PROSPECTOR.max) return null;

  // The order must fit the same ownership pool the server checks. Projected
  // units include every earlier Yard order, so two individually legal taps cannot
  // optimistically walk through the ceiling together.
  const capacity = spec.ground
    ? view.capacity?.ground ?? groundSlots(view.buildings.CORE ?? 0)
    : view.capacity?.hangar ?? hangarCapacity(view.buildings.HANGAR ?? 0);
  const used = spec.ground ? groundLoad(projected.units) : hangarLoad(projected.units);
  if (used + hullBulk(hull) * count > capacity) return null;

  const next = spend(view, cost);
  return appendOrder(next, 'YARD', 'HULL', hull, count, cost);
}

export function predictInstrument(view: PlanetView, type: InstrumentId): Prediction {
  if (!queueHasRoom(view, 'CONSTRUCTION')) return null;
  const projected = projectedQueueState(view, 'CONSTRUCTION');
  const level = projected.instruments[type] ?? 0;
  const cost = instrumentCost(type, level);
  if (!affordable(view, cost)) return null;
  /**
   * EVERY GUARD THE SERVER WILL APPLY, APPLIED HERE FIRST.
   *
   * The Uplink gate (D25), the Command Core ceiling, and the level an instrument's
   * own effect table stops at (D36). All three are pure functions this client
   * already imports, so declining is exact rather than approximate — and a
   * prediction that is only usually right is worse than none, because the flicker
   * lands on the one screen the whole information game is played on.
   */
  if (
    (type === 'TELESCOPE' || type === 'RADAR')
    && !seeingUnlocked(projected.effectiveOrbit)
  ) return null;
  if (level >= projected.buildings.CORE) return null;
  if (instrumentMaxed(type, level)) return null;

  const next = spend(view, cost);
  return appendOrder(next, 'CONSTRUCTION', 'INSTRUMENT', type, 1, cost);
}

export function predictSatellite(view: PlanetView, type: SatelliteId): Prediction {
  if (!queueHasRoom(view, 'CONSTRUCTION')) return null;
  const projected = projectedQueueState(view, 'CONSTRUCTION');
  if (projected.orbit.includes(type)) return null;
  const coreQueued = projected.buildings.CORE !== (view.buildings.CORE ?? 0);
  const slots = coreQueued ? satelliteSlots(projected.buildings.CORE) : view.orbitSlots;
  if (projected.orbit.length >= slots) return null;
  const cost = satelliteCost(type);
  if (!affordable(view, cost)) return null;

  const next = spend(view, cost);
  return appendOrder(next, 'CONSTRUCTION', 'SATELLITE', type, 1, cost);
}

export function predictResearch(view: PlanetView, projectId: ResearchProjectId): Prediction {
  const queue = view.researchQueue ?? [];
  if (queue.length >= BUILD.queueDepth) return null;
  /*
    THE RUNG BEING BOUGHT IS ONE ABOVE WHATEVER THE QUEUE WILL LEAVE STANDING, and
    the ladder's own ceiling is what stops it. Both were `costAt(1)` and a bare
    "is it held" check until T12: a commander buying rung three of Cargo Holds saw
    the rung-one price come off their wallet, and a rung already queued refused the
    next one on the same world.
  */
  const durable = view.research.find((project) => project.id === projectId)?.level ?? 0;
  const held = queue
    .filter((order) => order.projectId === projectId)
    .reduce((level, order) => Math.max(level, order.level), durable);
  const level = held + 1;
  if (level > RESEARCH_MAX_LEVEL[projectId]) return null;
  const state = view.research.find((project) => project.id === projectId);
  if (!(state?.queueAvailable ?? state?.available)) return null;
  const requiredCore = RESEARCH_PROJECTS[projectId].requiredCore ?? 0;
  if ((view.buildings.CORE ?? 0) < requiredCore) return null;
  const cost = RESEARCH_PROJECTS[projectId].costAt(level);
  if (!affordable(view, cost)) return null;
  const next = spend(view, cost);
  return {
    ...next,
    researchQueue: [
      ...(next.researchQueue ?? []),
      {
        id: `optimistic-research-${String(++optimisticOrder)}`,
        slot: queue.length,
        projectId,
        level,
        cost,
        optimistic: true as const,
      },
    ],
  };
}

/**
 * EMPTY THE WORKS. D16.
 *
 * The one tap a player makes every single session, and the one this matters most
 * for. Predicted from the caps the payload already carries rather than by calling
 * the rules' own `collect` — `alloyCap` and `bufferAlloyCap` are on the view, they
 * are computed server-side with the Foundry multiplier applied (D52a), and reading
 * them keeps this from being a second copy of that arithmetic.
 */
export function predictCollect(view: PlanetView): Prediction {
  const p = view.planet;
  const takeAlloy = Math.min(p.bufferAlloy, Math.max(0, p.alloyCap - p.alloy));
  const takeCrystal = Math.min(p.bufferCrystal, Math.max(0, p.crystalCap - p.crystal));
  const takeDeuterium = Math.min(
    p.bufferDeuterium,
    Math.max(0, p.deuteriumCap - p.deuterium),
  );
  if (takeAlloy <= 0 && takeCrystal <= 0 && takeDeuterium <= 0) return null;

  return {
    ...view,
    planet: {
      ...p,
      alloy: p.alloy + takeAlloy,
      crystal: p.crystal + takeCrystal,
      deuterium: p.deuterium + takeDeuterium,
      bufferAlloy: p.bufferAlloy - takeAlloy,
      bufferCrystal: p.bufferCrystal - takeCrystal,
      bufferDeuterium: p.bufferDeuterium - takeDeuterium,
    },
  };
}
