import {
  HULLS,
  PROSPECTOR,
  buildMinutes,
  collect,
  defenceMinutes,
  instrumentCost,
  instrumentMaxed,
  productionMult,
  satelliteCost,
  satelliteSlots,
  seeingUnlocked,
  shipMinutes,
  upgradeCost,
  type BuildingId,
  type HullId,
  type InstrumentId,
  type SatelliteId,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { buildQueueContext, placeBuildOrder } from './buildQueue.js';
import { planetView, type PlanetView } from './planetView.js';
import {
  GameError,
  assertWorldOperational,
  refreshWealth,
  saveResources,
  withPlanetLock,
  type LockedPlanet,
} from './planet.js';

/**
 * Ordinary purchases commit into one of two queues. This file owns the item gates
 * and prices; `buildQueue.ts` owns timing, persistence, cancellation and completion.
 */

/**
 * EVERY MUTATION ANSWERS WITH THE WHOLE WORLD. D53.
 *
 * Each of these used to return a fragment — a level, a hull count, two resource
 * figures — and the client threw it away and refetched `/api/planet` to find out
 * what had actually happened. Two round trips for one tap, in a game whose entire
 * construction model is "instant on payment, no build timers": on a phone that is
 * three to eight hundred milliseconds of a dead button after a decision the design
 * promises agrees with the tap.
 *
 * The view is free here — see `planetView` — and it is authoritative, because it
 * is built inside the same transaction under the same row lock. The fragment stays
 * beside it: it is what the toast and the animation read, and it says what THIS
 * action did, which the whole-world payload cannot.
 */
export interface WithPlanet {
  planet: PlanetView;
}

export interface CollectResult extends WithPlanet {
  moved: { alloy: number; crystal: number; deuterium: number };
  /** Would not fit; still sitting in the works. */
  blocked: { alloy: number; crystal: number; deuterium: number };
  alloy: number;
  crystal: number;
  deuterium: number;
  bufferAlloy: number;
  bufferCrystal: number;
  bufferDeuterium: number;
}

/**
 * Empty the works into storage. D16.
 *
 * The one manual step in the economy, and the reason to open the game when
 * nothing is in flight. Runs under the planet lock like every other mutation, so
 * a double-tap on a flaky connection cannot collect the same ore twice: the second
 * transaction blocks, re-reads an emptied buffer, and moves nothing.
 *
 * Deliberately NOT an error when there is nothing to collect. A player pressing a
 * button the interface offered them should never be told off; moving zero is a
 * perfectly good answer and the response says so.
 */
export async function collectWorks(
  db: Db,
  planetId: string,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<CollectResult> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    const result = collect(
      {
        alloy: planet.alloy,
        crystal: planet.crystal,
        deuterium: planet.deuterium,
        bufferAlloy: planet.bufferAlloy,
        bufferCrystal: planet.bufferCrystal,
        bufferDeuterium: planet.bufferDeuterium,
        shield: planet.shield,
        lastTickMinutes: planet.nowMinutes,
        disruptedUntilMinutes: 0,
      },
      {
        refineryLevel: planet.buildings.REFINERY,
        extractorLevel: planet.buildings.EXTRACTOR,
        vaultLevel: planet.buildings.VAULT,
        aegisLevel: planet.effectiveInstruments.AEGIS ?? 0,
        production: productionMult(planet.orbit),
      },
    );

    await saveResources(tx, planetId, {
      alloy: result.state.alloy,
      crystal: result.state.crystal,
      deuterium: result.state.deuterium,
      bufferAlloy: result.state.bufferAlloy,
      bufferCrystal: result.state.bufferCrystal,
      bufferDeuterium: result.state.bufferDeuterium,
    });

    planet.alloy = result.state.alloy;
    planet.crystal = result.state.crystal;
    planet.deuterium = result.state.deuterium;
    planet.bufferAlloy = result.state.bufferAlloy;
    planet.bufferCrystal = result.state.bufferCrystal;
    planet.bufferDeuterium = result.state.bufferDeuterium;
    // Collected ore does not change what the player OWNS, only which pile it is
    // in — but Wealth is denormalised and the rank floor reads it, so it is
    // refreshed here rather than left to drift.
    await refreshWealth(tx, planet);

    return {
      moved: result.moved,
      blocked: result.blocked,
      alloy: result.state.alloy,
      crystal: result.state.crystal,
      deuterium: result.state.deuterium,
      bufferAlloy: result.state.bufferAlloy,
      bufferCrystal: result.state.bufferCrystal,
      bufferDeuterium: result.state.bufferDeuterium,
      planet: await planetView(tx, planetId, clock),
    };
  }, expectedPlayerId);
}

/** Place one building commitment inside an already-held planet transaction. */
export async function placeBuildingUpgrade(
  tx: Tx,
  planet: LockedPlanet,
  type: BuildingId,
): Promise<number> {
  assertWorldOperational(planet);
  const context = await buildQueueContext(tx, planet, 'CONSTRUCTION');
  const level = context.projected.buildings[type];

  if (type !== 'CORE' && level >= context.projected.buildings.CORE) {
    throw new GameError('CORE_CEILING', 'Command Core must be raised first');
  }

  const cost = upgradeCost(level);
  await placeBuildOrder(tx, planet, context, {
    kind: 'BUILDING',
    subject: type,
    count: 1,
    cost,
    minutes: buildMinutes(cost, context.projected.buildings.CORE),
  });
  return level + 1;
}

export async function upgradeBuilding(
  db: Db,
  planetId: string,
  type: BuildingId,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<WithPlanet & { type: BuildingId; level: number; alloy: number; crystal: number }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    const level = await placeBuildingUpgrade(tx, planet, type);
    return {
      type,
      level,
      alloy: planet.alloy,
      crystal: planet.crystal,
      planet: await planetView(tx, planetId, clock),
    };
  }, expectedPlayerId);
}

/** Place one hull batch inside an already-held planet transaction. */
export async function placeUnitBuild(
  tx: Tx,
  planet: LockedPlanet,
  hull: HullId,
  count: number,
): Promise<void> {
  if (!Number.isInteger(count) || count < 1) {
    throw new GameError('BAD_COUNT', 'Count must be a positive integer');
  }

  assertWorldOperational(planet);
  const context = await buildQueueContext(tx, planet, 'YARD');
  const spec = HULLS[hull];
  if (hull === 'RUNNER' && !context.projected.research.has('DENSE_FUEL_CELLS')) {
    throw new GameError('NEEDS_DENSE_FUEL_CELLS', 'Research Dense Fuel Cells first', 403);
  }
  if (hull === 'BREACHER' && !context.projected.research.has('GRAVITIC_CHARGES')) {
    throw new GameError('NEEDS_GRAVITIC_CHARGES', 'Research Gravitic Charges first', 403);
  }
  if (context.projected.buildings.SHIPYARD < spec.minShipyard) {
    throw new GameError('SHIPYARD_TOO_LOW', `Needs Shipyard L${spec.minShipyard}`, 400, {
      level: spec.minShipyard,
    });
  }
    /**
     * A DRILL IS A CRAFT, AND THE SHIPYARD BUILDS CRAFT. D25.
     *
     * It used to require a DRILL satellite, which was the wrong shape twice over:
     * a drill is not hardware holding station beside a world, and gating a hull on
     * an orbit slot made mining an all-or-nothing detour. `spec.minShipyard` above
     * is the only gate now; the DERRICK in orbit is what makes the craft BETTER.
     */

    /**
     * TWO PROSPECTORS, EVER. `PROSPECTOR.max`.
     *
     * Counted over every `units` row for this planet rather than over
     * `planet.homeFleet`, because a craft that is away mining is still a craft this
     * planet owns — counting only what is home would let a player build three, send
     * them out, and build three more while the first squadron was in the air.
     *
     * Inside the planet row lock, so two simultaneous builds cannot both see room
     * for the last one. This is the same check-then-act shape `assertFreeBay`
     * exists for, and it gets the same treatment.
     */
  if (hull === 'PROSPECTOR') {
    const have = context.projected.units.PROSPECTOR ?? 0;
    if (have + count > PROSPECTOR.max) {
      throw new GameError(
        'PROSPECTOR_CAP',
        have >= PROSPECTOR.max
          ? `You already have ${String(PROSPECTOR.max)} Prospectors. That is the limit.`
          : `You may hold ${String(PROSPECTOR.max)} Prospectors, and you have ${String(have)}.`,
        400,
        // `context` picks the variant client-side, the same way it picks the
        // wording here. i18next reads it off the params like any other value.
        { max: PROSPECTOR.max, have, ...(have >= PROSPECTOR.max ? { context: 'atLimit' } : {}) },
      );
    }
  }

  const cost = {
    alloy: spec.alloy * count,
    crystal: spec.crystal * count,
    deuterium: spec.deuterium * count,
  };
  await placeBuildOrder(tx, planet, context, {
    kind: 'HULL',
    subject: hull,
    count,
    cost,
    minutes: spec.ground
      ? defenceMinutes(cost, context.projected.buildings.SHIPYARD)
      : shipMinutes(cost, context.projected.buildings.SHIPYARD),
  });
}

export async function buildUnits(
  db: Db,
  planetId: string,
  hull: HullId,
  count: number,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<WithPlanet & { hull: HullId; built: number; alloy: number; crystal: number }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    await placeUnitBuild(tx, planet, hull, count);
    return {
      hull,
      built: count,
      alloy: planet.alloy,
      crystal: planet.crystal,
      planet: await planetView(tx, planetId, clock),
    };
  }, expectedPlayerId);
}

/**
 * RAISE A GROUND INSTRUMENT. D25.
 *
 * The four instruments — Telescope, Radar, Aegis, Veil — sit on the planet, carry
 * real levels, and take no orbit slot. Any of them, in any order: price is what
 * makes choosing between them cost something, and the Command Core is the ceiling
 * every structure on the planet obeys.
 *
 * THE UPLINK GATES THE TWO SEEING INSTRUMENTS. It is the one place a satellite is
 * allowed to gate anything, and it is what makes a planet's first orbit slot a real
 * decision: eyes, or production, or faster drills.
 */
export async function raiseInstrument(
  db: Db,
  planetId: string,
  type: InstrumentId,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<WithPlanet & { type: InstrumentId; level: number }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    const context = await buildQueueContext(tx, planet, 'CONSTRUCTION');
    const level = context.projected.instruments[type] ?? 0;

    if (NEEDS_UPLINK.has(type) && !seeingUnlocked(context.projected.effectiveOrbit)) {
      throw new GameError('NEEDS_UPLINK', 'Put an Uplink in orbit first', 403);
    }
    if (level >= context.projected.buildings.CORE) {
      throw new GameError('CORE_CEILING', 'Command Core must be raised first');
    }

    /**
     * NOTHING LEFT TO SELL. D36.
     *
     * A Radar past L5 and a Telescope past L5 have exhausted their own tables — the
     * warning is at its longest, the range is already everywhere, the origin is
     * already named. Before this the purchase went through, at an exponential
     * price, and changed nothing whatsoever. That is not a balance question; it is
     * the game taking money for a product it does not have.
     */
    if (instrumentMaxed(type, level)) {
      throw new GameError(
        'AT_MAX_LEVEL',
        `Your ${type === 'TELESCOPE' ? 'Telescope' : 'Radar'} is at its highest level. There is nothing further to gain.`,
        400,
        // The instrument is named by ID, not by its English label: the client has
        // its own name for it and would otherwise print "Telescope" in Turkish.
        { instrument: type },
      );
    }

    const cost = instrumentCost(type, level);
    await placeBuildOrder(tx, planet, context, {
      kind: 'INSTRUMENT',
      subject: type,
      count: 1,
      cost,
      minutes: buildMinutes(cost, context.projected.buildings.CORE),
    });

    return { type, level: level + 1, planet: await planetView(tx, planetId, clock) };
  }, expectedPlayerId);
}

/** The two that hang off the Uplink. The Aegis and the Veil stand on their own. */
const NEEDS_UPLINK = new Set<InstrumentId>(['TELESCOPE', 'RADAR']);

/**
 * PUT A SATELLITE IN ORBIT. D25.
 *
 * Bought once, never raised, and it takes one of the slots the Command Core opens
 * at levels 1, 3, 5 and 9. Four satellites and four slots is not a checklist,
 * because the fourth slot is a Core 9 planet — for the part of a season anybody
 * actually plays, a world runs one, two or three of them, and which ones is who it
 * is.
 *
 * THE REFUSAL IS THE DESIGN. `NO_FREE_SLOT` is the moment the choice becomes real,
 * so it says what would fix it rather than merely saying no.
 */
export async function installSatellite(
  db: Db,
  planetId: string,
  type: SatelliteId,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<WithPlanet & { type: SatelliteId; slot: number }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    const context = await buildQueueContext(tx, planet, 'CONSTRUCTION');
    if (context.projected.orbit.includes(type)) {
      throw new GameError('ALREADY_IN_ORBIT', 'That satellite is already in orbit', 409);
    }
    if (
      context.projected.orbit.length
      >= satelliteSlots(context.projected.buildings.CORE)
    ) {
      throw new GameError('NO_FREE_SLOT', 'Raise the Command Core for another orbit slot');
    }

    const cost = satelliteCost(type);
    const slot = context.projected.orbit.length;
    await placeBuildOrder(tx, planet, context, {
      kind: 'SATELLITE',
      subject: type,
      count: 1,
      cost,
      minutes: buildMinutes(cost, context.projected.buildings.CORE),
    });
    return { type, slot, planet: await planetView(tx, planetId, clock) };
  }, expectedPlayerId);
}
