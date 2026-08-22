import { eq, sql } from 'drizzle-orm';
import {
  HULLS,
  PROSPECTOR,
  collect,
  coreTier,
  instrumentCost,
  instrumentMaxed,
  productionMult,
  satelliteCost,
  satelliteSlots,
  seeingUnlocked,
  upgradeCost,
  type BuildingId,
  type HullId,
  type InstrumentId,
  type SatelliteId,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { planets, satellites } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { planetView, type PlanetView } from './planetView.js';
import {
  GameError,
  addUnits,
  refreshWealth,
  saveResources,
  setBuildingLevel,
  totalUnitsOf,
  withPlanetLock,
} from './planet.js';

/**
 * Construction is INSTANT on payment. There are no build timers and no queues.
 *
 * A timer's return hook is "a bar filled up" — the weakest one available — and it
 * would be a whole state machine plus a permanent temptation to sell speed-ups.
 * It also makes the panic session better: converting stock into Bastions in the
 * nine minutes before a fleet lands is a real emergency option.
 */

/**
 * EVERY MUTATION ANSWERS WITH THE WHOLE WORLD. D53.
 *
 * Each of these used to return a fragment — a level, a hull count, two resource
 * figures — and the client threw it away and refetched `/api/planet` to find out
 * what had actually happened. Two round trips for one tap, in a game whose entire
 * construction model is "instant on payment, no build timers": on a phone that is
 * three to eight hundred milliseconds of a dead button after a decision the design
 * promises is immediate.
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
  moved: { alloy: number; crystal: number };
  /** Would not fit; still sitting in the works. */
  blocked: { alloy: number; crystal: number };
  alloy: number;
  crystal: number;
  bufferAlloy: number;
  bufferCrystal: number;
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
): Promise<CollectResult> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    const result = collect(
      {
        alloy: planet.alloy,
        crystal: planet.crystal,
        bufferAlloy: planet.bufferAlloy,
        bufferCrystal: planet.bufferCrystal,
        shield: planet.shield,
        lastTickMinutes: planet.nowMinutes,
        disruptedUntilMinutes: 0,
      },
      {
        refineryLevel: planet.buildings.REFINERY,
        extractorLevel: planet.buildings.EXTRACTOR,
        aegisLevel: planet.instruments.AEGIS ?? 0,
        production: productionMult(planet.orbit),
      },
    );

    await saveResources(tx, planetId, {
      alloy: result.state.alloy,
      crystal: result.state.crystal,
      bufferAlloy: result.state.bufferAlloy,
      bufferCrystal: result.state.bufferCrystal,
    });

    planet.alloy = result.state.alloy;
    planet.crystal = result.state.crystal;
    planet.bufferAlloy = result.state.bufferAlloy;
    planet.bufferCrystal = result.state.bufferCrystal;
    // Collected ore does not change what the player OWNS, only which pile it is
    // in — but Wealth is denormalised and the rank floor reads it, so it is
    // refreshed here rather than left to drift.
    await refreshWealth(tx, planet);

    return {
      moved: result.moved,
      blocked: result.blocked,
      alloy: result.state.alloy,
      crystal: result.state.crystal,
      bufferAlloy: result.state.bufferAlloy,
      bufferCrystal: result.state.bufferCrystal,
      planet: await planetView(tx, planetId, clock),
    };
  });
}

export async function upgradeBuilding(
  db: Db,
  planetId: string,
  type: BuildingId,
  clock: Clock,
): Promise<WithPlanet & { type: BuildingId; level: number; alloy: number; crystal: number }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    const level = planet.buildings[type];

    if (type !== 'CORE' && level >= planet.buildings.CORE) {
      throw new GameError('CORE_CEILING', 'Command Core must be raised first');
    }

    const cost = upgradeCost(level);
    if (planet.alloy < cost.alloy || planet.crystal < cost.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const alloy = planet.alloy - cost.alloy;
    const crystal = planet.crystal - cost.crystal;
    await saveResources(tx, planetId, { alloy, crystal });
    await setBuildingLevel(tx, planetId, type, level + 1);

    planet.buildings[type] = level + 1;
    planet.alloy = alloy;
    planet.crystal = crystal;
    await refreshWealth(tx, planet);

    /**
     * THE DISC IS TOLD ONLY WHEN THE DISC ACTUALLY CHANGED. D53.
     *
     * The rule for every shard broadcast is that it fires exactly when the public
     * payload it points at has moved, and no other time. `/api/galaxy` publishes
     * `coreTier` — a three-level bucket — and nothing else about a building, so a
     * Refinery going to L7 changes nothing anybody else can read, and a Core going
     * from 3 to 4 changes the silhouette of a world for the whole galaxy.
     *
     * Announcing every upgrade would have been simpler and would have leaked the
     * one thing this channel is careful not to carry: a timing signal for something
     * a refetch could not show. Fifty clients refetching a payload identical to the
     * one they hold is also just waste.
     */
    if (type === 'CORE' && coreTier(level + 1) !== coreTier(level)) {
      await publishShard(tx, planet.seasonId, 'world');
    }

    return { type, level: level + 1, alloy, crystal, planet: await planetView(tx, planetId, clock) };
  });
}

export async function buildUnits(
  db: Db,
  planetId: string,
  hull: HullId,
  count: number,
  clock: Clock,
): Promise<WithPlanet & { hull: HullId; built: number; alloy: number; crystal: number }> {
  if (!Number.isInteger(count) || count < 1) {
    throw new GameError('BAD_COUNT', 'Count must be a positive integer');
  }

  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    const spec = HULLS[hull];
    if (planet.buildings.SHIPYARD < spec.minShipyard) {
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
      const have = (await totalUnitsOf(tx, planetId)).PROSPECTOR ?? 0;
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

    const totalAlloy = spec.alloy * count;
    const totalCrystal = spec.crystal * count;
    if (planet.alloy < totalAlloy || planet.crystal < totalCrystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const alloy = planet.alloy - totalAlloy;
    const crystal = planet.crystal - totalCrystal;
    await saveResources(tx, planetId, { alloy, crystal });
    await addUnits(tx, planetId, { [hull]: count });

    /**
     * THE ONLY PLACE A HULL COMES INTO EXISTENCE, so it is the only place that
     * has to remember one did.
     *
     * `units` is a live count and it goes DOWN — a squadron that dies takes its
     * row with it — so nothing downstream can ever reconstruct how many were
     * built. The reward panel's ships chain needs exactly that figure, and this
     * is the single write that keeps it. See `planets.builtEver` in the schema
     * for why it is the one derived-progress exception in the feature.
     *
     * Done in SQL rather than by reading the column and writing it back: this
     * transaction already holds the row lock, but expressing it as an update
     * against the stored value means the tally cannot be lost to a stale read if
     * that ever stops being true.
     */
    await tx
      .update(planets)
      .set({
        builtEver: sql`jsonb_set(
          ${planets.builtEver}, ${`{${hull}}`},
          to_jsonb(coalesce((${planets.builtEver} ->> ${hull})::int, 0) + ${count}), true)`,
      })
      .where(eq(planets.id, planetId));

    const bucket = spec.ground ? planet.ground : planet.homeFleet;
    bucket[hull] = (bucket[hull] ?? 0) + count;
    planet.alloy = alloy;
    planet.crystal = crystal;
    await refreshWealth(tx, planet);

    return { hull, built: count, alloy, crystal, planet: await planetView(tx, planetId, clock) };
  });
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
): Promise<WithPlanet & { type: InstrumentId; level: number }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    const level = planet.instruments[type] ?? 0;

    if (NEEDS_UPLINK.has(type) && !seeingUnlocked(planet.orbit)) {
      throw new GameError('NEEDS_UPLINK', 'Put an Uplink in orbit first', 403);
    }
    if (level >= planet.buildings.CORE) {
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
    if (planet.alloy < cost.alloy || planet.crystal < cost.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const alloy = planet.alloy - cost.alloy;
    const crystal = planet.crystal - cost.crystal;
    await saveResources(tx, planetId, { alloy, crystal });
    await writeInstalled(tx, planetId, type, level + 1);

    planet.instruments[type] = level + 1;
    planet.alloy = alloy;
    planet.crystal = crystal;
    await refreshWealth(tx, planet);

    return { type, level: level + 1, planet: await planetView(tx, planetId, clock) };
  });
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
): Promise<WithPlanet & { type: SatelliteId; slot: number }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    if (planet.orbit.includes(type)) {
      throw new GameError('ALREADY_IN_ORBIT', 'That satellite is already in orbit', 409);
    }
    if (planet.orbit.length >= satelliteSlots(planet.buildings.CORE)) {
      throw new GameError('NO_FREE_SLOT', 'Raise the Command Core for another orbit slot');
    }

    const cost = satelliteCost(type);
    if (planet.alloy < cost.alloy || planet.crystal < cost.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const alloy = planet.alloy - cost.alloy;
    const crystal = planet.crystal - cost.crystal;
    await saveResources(tx, planetId, { alloy, crystal });
    const slot = await writeInstalled(tx, planetId, type, 1);

    planet.orbit = [...planet.orbit, type];
    planet.alloy = alloy;
    planet.crystal = crystal;
    await refreshWealth(tx, planet);

    /**
     * Hardware in orbit is public (D15) and the disc draws it, so a satellite going
     * up changes what every other commander can see around this world. Always, not
     * conditionally: there is no bucketing here, every install is a new body.
     */
    await publishShard(tx, planet.seasonId, 'world');

    return { type, slot, planet: await planetView(tx, planetId, clock) };
  });
}

/**
 * Write one installed thing, instrument or satellite, into its own row.
 *
 * The `satellites` table is keyed on `(planetId, slot)`, so a thing that is already
 * installed keeps the slot it had and anything new takes the next one. The slot
 * number is storage, not gameplay: what rations orbit is `satelliteSlots`, counted
 * against what is actually up there.
 */
async function writeInstalled(
  tx: Tx,
  planetId: string,
  type: string,
  level: number,
): Promise<number> {
  const existing = await tx.select().from(satellites).where(eq(satellites.planetId, planetId));
  const slot =
    existing.find((s) => s.type === type)?.slot ??
    (existing.length > 0 ? Math.max(...existing.map((s) => s.slot)) + 1 : 0);

  await tx
    .insert(satellites)
    .values({ planetId, slot, type, level })
    .onConflictDoUpdate({
      target: [satellites.planetId, satellites.slot],
      set: { type, level },
    });

  return slot;
}
