import { and, eq, inArray } from 'drizzle-orm';
import {
  DEBRIS,
  HULLS,
  MOBILE_HULLS,
  distance,
  engagementEndsAt,
  fleetCargo,
  fleetCount,
  fleetEntries,
  fleetSpeed,
  fleetSpeedMult,
  fleetTravelExact,
  computeLoot,
  interceptOrbit,
  missionFuel,
  pirateActive,
  pirateCapture,
  piratePosition,
  pirateStats,
  resolveCombat,
  seededFrom,
  sensorZone,
  type Fleet,
  type HullId,
  type PirateLevel,
  type PirateSpec,
  type Resources,
  type Vec3,
} from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { addMinutes, atMinute, minutesSince } from '../clock.js';
import { battleReports, debrisFields, pirateRaids, pirateState, planets, units } from '../db/schema.js';
import { publish, publishShard } from '../stream/bus.js';
import { assertFreeBay } from './flight.js';
import { assertFuel } from './fuel.js';
import { notify } from './notifications.js';
import { schedule } from '../worker/queue.js';
import { sensorPosts } from './traffic.js';
import { techOf } from './researchState.js';
import { pendingThreads, type PendingThread } from './session.js';
import { planetView, type PlanetView } from './planetView.js';
import {
  livingRoster,
  loadPirateSnapshot,
  pirateCallsign,
  pirateId,
  pirateIndexFromId,
  privatePirateField,
} from './pirateField.js';
import {
  GameError,
  assertSeasonOpenThrough,
  assertWorldOperational,
  loadLocked,
  orbitOf,
  recomputePlayerWealth,
  recomputeWealth,
  saveResources,
  setUnits,
  type LockedPlanet,
} from './planet.js';

/**
 * RAIDING A PIRATE. D150.
 *
 * The third target class, and the first one that MOVES. Everything a raid against
 * a world costs — a flight bay, prepaid fuel for both legs, doctrine frozen at
 * launch, an origin world reading `AWAY` for the whole trip — is charged here in
 * the same order and by the same helpers, because a PvE raid that were cheaper
 * than a PvP one would be a reason to stop raiding people.
 *
 * WHAT IS DELIBERATELY NOT CONNECTED, and each absence is a decision:
 *
 *   · NO DOMINION. `bookBattle` is never called and the report's swing is zero.
 *     Dominion is zero-sum between two commanders (D2); a pirate has no ledger to
 *     take from, so paying score for one would create it out of nothing.
 *   · NO `attack_commitments`, NO CLAN QUOTA, NO `canAttack`, NO `bashLimit`,
 *     NO RIVAL RECORD. Every one of those exists to govern what commanders do to
 *     each other. There is nobody on the other side.
 *   · NO CHRONICLE ENTRY. D96 records transitions that were legitimately public
 *     at the moment they happened, and a pirate dying in empty space is not.
 *
 * THE FOG GATE IS LIVE SIGHT AND NOT MEMORY. A rock is remembered once found
 * (D143); a pirate is a craft, and a craft outside your circles does not exist for
 * you (D123). You cannot aim at one you are merely remembering — which is what
 * makes a sensor upgrade buy opportunities rather than a bigger address book.
 */

export type PirateRaidRow = typeof pirateRaids.$inferSelect;

/** The fleet parked against this raid. `units.location` is namespaced, like mining. */
const raidLocation = (raidId: string): string => `pirate:${raidId}`;

async function fleetOfRaid(tx: Tx, planetId: string, raidId: string): Promise<Fleet> {
  const rows = await tx
    .select()
    .from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, raidLocation(raidId))));
  const fleet: Fleet = {};
  for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
  return fleet;
}

async function clearRaidUnits(tx: Tx, planetId: string, raidId: string): Promise<void> {
  await tx
    .delete(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, raidLocation(raidId))));
}

export interface PirateRaidLaunch {
  raidId: string;
  pirateId: string;
  level: PirateLevel;
  callsign: string;
  fleet: Fleet;
  departAt: Date;
  arriveAt: Date;
  flightMinutes: number;
  intercept: Vec3;
  /** Deuterium taken for both legs at launch. D136. */
  fuel: number;
  /**
   * The mission strip and the world, read INSIDE the launching transaction. D53.
   *
   * Not a convenience: a mutation answers with the same authoritative view its GET
   * would, so the craft is drawn on the frame the response lands rather than one
   * round trip later — and an older read that was already in flight cannot land
   * afterwards and erase it.
   */
  pending: PendingThread[];
  planet: PlanetView;
}

/**
 * Send a combat fleet at a pirate.
 *
 * The rendezvous is solved ONCE, here, and stored. Re-deriving it later would let
 * the pirate's own motion silently move a flight already in the air onto a new
 * course, and a player watching their squadron cross the disc would see it jump.
 */
export async function launchPirateRaid(
  db: Db,
  planetId: string,
  target: string,
  fleet: Fleet,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<PirateRaidLaunch> {
  const requested: Fleet = {};
  for (const [hull, count] of Object.entries(fleet) as [HullId, number][]) {
    if (!Number.isInteger(count) || count <= 0) continue;
    if (!(MOBILE_HULLS as readonly string[]).includes(hull)) {
      throw new GameError('BAD_FLEET', `${hull} cannot fly an attack`, 400);
    }
    requested[hull] = count;
  }
  if (fleetCount(requested) === 0) {
    throw new GameError('BAD_FLEET', 'Send at least one ship', 400);
  }

  return db.transaction(async (tx) => {
    const origin = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(origin);

    for (const [hull, count] of fleetEntries(requested)) {
      const available = origin.homeFleet[hull] ?? 0;
      if (available < count) {
        throw new GameError('NOT_ENOUGH_SHIPS', `Only ${String(available)} ${HULLS[hull].name}`, 400, {
          hull,
          available,
        });
      }
    }

    const snapshot = await loadPirateSnapshot(tx, origin.seasonId, origin.now);
    const index = pirateIndexFromId(snapshot.key, snapshot.pirates, target);
    const spec = index === null ? undefined : snapshot.pirates[index];
    if (!spec || index === null) throw new GameError('NO_SUCH_PIRATE', 'No such pirate', 404);

    // Before the rendezvous solve: there is no point finding a meeting point for a
    // launch that has nowhere to launch from. D28, in mining's order.
    await assertFreeBay(tx, planetId, origin.buildings.CORE);

    const nowMinutes = minutesSince(snapshot.startsAt, origin.now);
    if (!pirateActive(spec, nowMinutes) || snapshot.destroyedAt(index) !== null) {
      throw new GameError('PIRATE_GONE', 'That pirate is no longer out there', 409);
    }
    if (fleetCount(snapshot.livingRosterOf(index)) === 0) {
      throw new GameError('PIRATE_GONE', 'That pirate is no longer out there', 409);
    }

    const [existing] = await tx
      .select({ id: pirateRaids.id })
      .from(pirateRaids)
      .where(and(
        eq(pirateRaids.planetId, planetId),
        eq(pirateRaids.pirateIndex, index),
        inArray(pirateRaids.status, ['outbound', 'returning']),
      ))
      .limit(1);
    if (existing) {
      throw new GameError('ALREADY_RAIDING_PIRATE', 'This world already has a raid out there', 409);
    }

    /**
     * THE FOG GATE. You may only aim at a pirate you can see RIGHT NOW.
     *
     * Tested against the pirate's current point through `sensorZone`, which is the
     * one statement of the three zones — the launch, the traffic projection and
     * the client's crossing solver all read it, so a target that is legal to shoot
     * at is exactly the one that is drawn on the disc.
     *
     * CONTACT is enough. You do not have to identify a pirate to fly at it; that
     * is what makes a Radar-only commander able to gamble on a question mark, and
     * what the Telescope sells is knowing what you are gambling against.
     */
    const spheres = await sensorPosts(tx, await ownWorldIds(tx, origin.playerId));
    if (sensorZone(spheres, piratePosition(spec, nowMinutes)) === 'NONE') {
      throw new GameError('PIRATE_OUT_OF_SIGHT', 'That pirate is not on your sensors', 403);
    }

    const tech = await techOf(tx, origin.playerId);
    const speed = fleetSpeed(requested, tech) * fleetSpeedMult(origin.orbit);
    const hit = interceptOrbit(
      origin,
      speed,
      (minutes) => piratePosition(spec, minutes),
      spec.expiresAt,
      nowMinutes,
    );
    if (!hit) {
      throw new GameError(
        'CANNOT_INTERCEPT',
        'It will be gone before your fleet could reach it',
        409,
      );
    }

    /**
     * FUEL FOR BOTH LEGS, AT LAUNCH, AND THE RETURN IS THE SAME DISTANCE. D136.
     *
     * The fleet flies home from the rendezvous point to the world it left, so the
     * two legs are the same straight line and `legs: 2` is exact — no extra rule.
     * Nothing is refunded if the raid fails: a launched fleet cannot be recalled,
     * and a quote that could be undone is not a decision.
     */
    const reach = distance(origin, hit.at);
    const fuel = missionFuel(requested, reach, 2);
    assertFuel(fuel, origin.deuterium);

    const arriveAt = atMinute(snapshot.startsAt, hit.meetsAtMinutes);
    const resolveAt = new Date(engagementEndsAt(arriveAt.getTime()));
    const homeMinutes = fleetTravelExact(
      reach,
      requested,
      fleetSpeedMult(origin.orbit),
      tech,
    );
    assertSeasonOpenThrough(origin, addMinutes(resolveAt, homeMinutes));

    const [raid] = await tx
      .insert(pirateRaids)
      .values({
        seasonId: origin.seasonId,
        planetId,
        pirateIndex: index,
        fleet: requested,
        // Frozen at launch and read at the fight, exactly like a mission. D137.
        tech,
        interceptX: hit.at.x,
        interceptY: hit.at.y,
        interceptZ: hit.at.z,
        departAt: origin.now,
        arriveAt,
      })
      .returning();

    const remaining: Fleet = { ...origin.homeFleet };
    for (const [hull, count] of fleetEntries(requested)) {
      remaining[hull] = (remaining[hull] ?? 0) - count;
    }
    await setUnits(tx, planetId, remaining, 'home');
    // Namespaced so nothing that reads mission ids can mistake this for one, and
    // so `fleetTruthFor` reads the world as AWAY — this is a raid, not mining.
    await setUnits(tx, planetId, requested, raidLocation(raid!.id));

    if (fuel > 0) {
      await saveResources(tx, planetId, {
        alloy: origin.alloy,
        crystal: origin.crystal,
        deuterium: origin.deuterium - fuel,
      });
    }

    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'pirate_arrival',
      refId: raid!.id,
      resolveAt,
    });

    await publishShard(tx, origin.seasonId, 'pirate');
    await publish(tx, origin.playerId, 'private:pirate');
    await recomputePlayerWealth(tx, origin.playerId);

    return {
      raidId: raid!.id,
      pirateId: pirateId(snapshot.key, index),
      level: spec.level,
      callsign: pirateCallsign(snapshot.key, index),
      fleet: requested,
      departAt: origin.now,
      arriveAt,
      flightMinutes: hit.flightMinutes,
      intercept: hit.at,
      fuel,
      // Deliberately sequential on this one transaction connection: each is the
      // projection its own GET uses, and no second request can race the launch.
      pending: await pendingThreads(tx, planetId, origin.now),
      planet: await planetView(tx, planetId, clock),
    };
  });
}

async function ownWorldIds(tx: Tx, playerId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: planets.id })
    .from(planets)
    .where(eq(planets.controllerPlayerId, playerId));
  return rows.map((row) => row.id);
}

/** Everything that has to be true before a raid can be settled. */
interface ArrivalContext {
  raid: PirateRaidRow;
  spec: PirateSpec;
  key: string;
  origin: LockedPlanet;
}

/**
 * THE FLEET REACHES THE RENDEZVOUS.
 *
 * Idempotent by the same mechanism every other handler uses: the status transition
 * IS the claim, so an event delivered twice finds the raid already resolved and
 * does nothing. Lock order is the global one — season, then planet, then the
 * pirate row — so two worlds hitting the same pirate in the same second queue
 * behind each other rather than both reading the same crew.
 */
export async function resolvePirateArrival(
  tx: Tx,
  raidId: string,
  clock: Clock,
): Promise<void> {
  const claimed = await tx
    .update(pirateRaids)
    .set({ status: 'returning' })
    .where(and(eq(pirateRaids.id, raidId), eq(pirateRaids.status, 'outbound')))
    .returning();
  const raid = claimed[0];
  if (!raid) return;

  await publishShard(tx, raid.seasonId, 'pirate');

  const origin = await loadLocked(tx, raid.planetId, clock);
  const key = (await loadPirateSnapshot(tx, raid.seasonId, origin.now)).key;
  const spec = privatePirateField(key)[raid.pirateIndex];

  const attacking = await fleetOfRaid(tx, raid.planetId, raidId);
  if (fleetCount(attacking) === 0) {
    await tx.update(pirateRaids).set({ status: 'done' }).where(eq(pirateRaids.id, raidId));
    return;
  }

  /**
   * THE LANE NO LONGER HAS THIS PIRATE, AND THE FLEET STILL COMES HOME.
   *
   * A FLEET CAN NEVER DISAPPEAR — `architecture.md` states it, and this project has
   * already stranded a real player's ships once by breaking it. The lane is derived
   * from the season key, so a constants change or a `pirateRulesetVersion` bump can
   * leave a raid in the air pointing at an index that no longer resolves.
   *
   * This used to throw. A throw inside a handler is five retries and then
   * `exhausted`, which would have parked the squadron under `pirate:<id>` for the
   * rest of the season with its origin world reading AWAY the whole time — an
   * outage with no way back short of a manual write. Turning for home empty-handed
   * is the honest outcome of arriving to find nothing there, and it is the same
   * thing that happens when another commander wins the race.
   */
  if (!spec) {
    await turnForHome(tx, raid, attacking, origin, null, null);
    return;
  }

  await settleArrival(tx, { raid, spec, key, origin }, attacking);
}

/**
 * Take the pirate's damage row under a write lock, resolve the fight, and pay out.
 *
 * SPLIT OUT SO THE LOCK ORDER IS VISIBLE IN ONE PLACE: planet first (taken by
 * `loadLocked`), then this row. Two raids landing on the same pirate in the same
 * second is the intended case — that is the race — and the second one has to read
 * a crew that already has the first one's casualties in it.
 */
async function settleArrival(
  tx: Tx,
  ctx: ArrivalContext,
  attacking: Fleet,
): Promise<void> {
  const { raid, spec, key, origin } = ctx;
  const now = origin.now;

  const [state] = await tx
    .select()
    .from(pirateState)
    .where(and(eq(pirateState.seasonId, raid.seasonId), eq(pirateState.index, raid.pirateIndex)))
    .for('update');

  const crew = livingRoster(spec.roster, state?.losses);
  if (state?.destroyedAt != null || fleetCount(crew) === 0) {
    // Somebody else won the race. The fleet turns around with nothing.
    await turnForHome(tx, raid, attacking, origin, null, null);
    return;
  }

  /**
   * THE FIGHT. The pirate defends; its handicap is the only modifier in play.
   *
   * `shield: 0` — an Aegis is a building on a world, and there is no world here.
   * Seeded from the raid id so the report can be re-derived from its inputs.
   */
  const result = resolveCombat(attacking, crew, 0, seededFrom(raid.id), {
    attacker: { tech: raid.tech ?? {} },
    defender: { tech: {}, damageMult: pirateStats(spec.level).damageMult },
  });

  const losses: Fleet = { ...(state?.losses ?? {}) };
  for (const [hull, count] of fleetEntries(result.defenderLosses)) {
    losses[hull] = (losses[hull] ?? 0) + count;
  }
  const wiped = result.grade === 'DECISIVE';
  await tx
    .insert(pirateState)
    .values({
      seasonId: raid.seasonId,
      index: raid.pirateIndex,
      losses,
      destroyedAt: wiped ? now : null,
      destroyedByPlayerId: wiped ? origin.playerId : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [pirateState.seasonId, pirateState.index],
      set: {
        losses,
        ...(wiped ? { destroyedAt: now, destroyedByPlayerId: origin.playerId } : {}),
        updatedAt: now,
      },
    });

  /**
   * MUTUAL ANNIHILATION PAYS NOTHING, AND FLIES NOTHING HOME. G6.
   *
   * `resolveCombat` grades DECISIVE off the DEFENDER being gone, and the attacker
   * reaching zero in the same exchange is entirely possible. There is then nobody
   * left to load the hoard, nobody to tow a hull and nobody to fly a return leg —
   * so the raid ends here with a report and wreckage, which is the honest account
   * of what happened. Written as an explicit branch because the alternative is a
   * ghost return leg carrying loot for a fleet that does not exist.
   */
  const survived = fleetCount(result.attackerSurvivors) > 0;

  const loot = survived
    ? computeLoot(
        spec.hoard,
        { alloy: 0, crystal: 0, deuterium: 0 },
        { alloy: 0, crystal: 0, deuterium: 0 },
        result.grade,
        // WHAT THEY CAN CARRY, and the real throttle on this whole feature: cargo
        // room is bought with combat power on the way out. T8/D150.
        fleetCargo(result.attackerSurvivors, raid.tech ?? {}),
      )
    : null;
  /**
   * DID THE HOLDS, RATHER THAN THE HOARD, DECIDE WHAT CAME HOME? D94 · D150.
   *
   * Re-priced with effectively unlimited cargo: if more was legally available than
   * was carried, capacity is what capped the haul. This used to be written `false`
   * and that cost two separate things — the report could not tell a commander they
   * had left ore floating at the rendezvous, which is precisely the decision this
   * feature is built on (cargo room is bought with combat power on the way out),
   * and `researchState` reads this exact column to discover Dense Fuel Cells.
   *
   * A PIRATE RAID COUNTS FOR THAT DISCOVERY, like a caretaker raid already does.
   * The lesson is "your holds were too small", and it does not become a different
   * lesson because the ore was sitting on a wreck rather than on a world.
   */
  const uncapped = survived
    ? computeLoot(
        spec.hoard,
        { alloy: 0, crystal: 0, deuterium: 0 },
        { alloy: 0, crystal: 0, deuterium: 0 },
        result.grade,
        Number.MAX_SAFE_INTEGER,
      )
    : null;
  const cargoLimited =
    loot !== null
    && uncapped !== null
    && uncapped.alloy + uncapped.crystal + uncapped.deuterium
      > loot.alloy + loot.crystal + loot.deuterium;

  // The crew this raid actually met, so the towed hull is one it shot down rather
  // than one an earlier commander had already destroyed.
  const captured = survived
    ? pirateCapture(spec.level, crew, result.grade, seededFrom('pirate:capture', raid.id))
    : null;

  /**
   * WRECKAGE FROM BOTH SIDES, EXACTLY AS A PvP BATTLE PRICES IT.
   *
   * A caretaker world leaves only the attacker's losses because nothing it fields
   * is really there; a pirate flies real Fleet V2 hulls, so what dies here leaves
   * the same share of its value in orbit that a player battle would — and the
   * public race to collect it is half of what makes the fight worth watching (D32).
   *
   * IT IS AT THE RENDEZVOUS, NOT AT ANYBODY'S WORLD. That is why `debris_fields`
   * carries its own position now: there is no planet under this battle, and the
   * old row could only say "over that world".
   */
  const wreckValue =
    (flyingValue(result.attackerLosses) + flyingValue(result.defenderLosses)) * DEBRIS.share;
  await createVoidDebris(tx, raid, result.attackerLosses, result.defenderLosses, now);

  await tx.insert(battleReports).values({
    seasonId: raid.seasonId,
    missionId: null,
    targetPlanetId: null,
    pirateRaidId: raid.id,
    targetKind: 'PIRATE',
    attackerPlayerId: origin.playerId,
    defenderPlayerId: null,
    grade: result.grade,
    rounds: result.rounds,
    loot: loot
      ? { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium }
      : { alloy: 0, crystal: 0, deuterium: 0 },
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
    attackerFleet: attacking,
    defenderFleet: crew,
    defenceSalvage: {},
    disruptedMinutes: 0,
    wreckValue: wreckValue >= DEBRIS.minimum ? wreckValue : 0,
    cargoLimited,
    shieldAbsorbed: 0,
    /**
     * ZERO, AND STORED AS ZERO RATHER THAN LEFT NULL. D2 · D150.
     *
     * Dominion is a zero-sum transfer between two commanders. A pirate has no
     * ledger, so there is nothing to take it from and crediting any would create
     * score out of nothing. `bookBattle` is deliberately not called at all — the
     * column says zero so the report can state it rather than omit the line.
     */
    dominionSwing: 0,
    createdAt: now,
  });

  await notify(tx, {
    playerId: origin.playerId,
    kind: 'raid_result',
    payload: {
      targetKind: 'PIRATE',
      pirateLevel: spec.level,
      pirateCallsign: pirateCallsign(key, raid.pirateIndex),
      grade: result.grade,
      lootAlloy: loot?.alloy ?? 0,
      lootCrystal: loot?.crystal ?? 0,
      lootDeuterium: loot?.deuterium ?? 0,
      unitsLost: fleetCount(result.attackerLosses),
      shipsHome: fleetCount(result.attackerSurvivors),
      ...(captured ? { capturedHull: captured } : {}),
      dominion: 0,
    },
    at: now,
    refId: raid.id,
  });

  await turnForHome(
    tx,
    raid,
    result.attackerSurvivors,
    origin,
    loot ? { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium } : null,
    captured,
  );
}

/**
 * Point whatever is left back at the world it came from — or close the raid out.
 *
 * With no survivors there is no leg to fly: the units row is cleared, `homeAt`
 * stays NULL for ever and the raid is `done`. Anything else would leave a flight
 * in the traffic projection carrying a fleet that was destroyed.
 */
async function turnForHome(
  tx: Tx,
  raid: PirateRaidRow,
  survivors: Fleet,
  origin: LockedPlanet,
  loot: Resources | null,
  captured: HullId | null,
): Promise<void> {
  if (fleetCount(survivors) === 0) {
    await clearRaidUnits(tx, raid.planetId, raid.id);
    await tx
      .update(pirateRaids)
      .set({ status: 'done', loot, capturedHull: captured, homeAt: null })
      .where(eq(pirateRaids.id, raid.id));
    await recomputeWealth(tx, raid.planetId);
    await recomputePlayerWealth(tx, origin.playerId);
    return;
  }

  const meet = { x: raid.interceptX, y: raid.interceptY, z: raid.interceptZ };
  const back = fleetTravelExact(
    distance(meet, origin),
    survivors,
    fleetSpeedMult(await orbitOf(tx, raid.planetId)),
    raid.tech ?? {},
  );
  const homeAt = addMinutes(origin.now, back);

  // Only the survivors fly home; the dead simply cease to exist.
  await clearRaidUnits(tx, raid.planetId, raid.id);
  await setUnits(tx, raid.planetId, survivors, raidLocation(raid.id), origin.playerId);

  await tx
    .update(pirateRaids)
    .set({ loot, capturedHull: captured, homeAt })
    .where(eq(pirateRaids.id, raid.id));

  await schedule(tx, {
    seasonId: raid.seasonId,
    kind: 'pirate_return',
    refId: raid.id,
    resolveAt: homeAt,
  });
  await recomputePlayerWealth(tx, origin.playerId);
}

export interface PirateRaidDelivery {
  raidId: string;
  ships: number;
  delivered: Resources;
  capturedHull: HullId | null;
}

/**
 * THE SURVIVORS GET HOME.
 *
 * Loot lands in STORAGE — it was taken, not produced, so the collector has nothing
 * to do with it. A captured hull joins the garrison alongside them.
 *
 * A CAPTURED HULL LANDS EVEN OVER HANGAR CAPACITY, and that is D133 stated rather
 * than an oversight: no cap deletes overflow created by survivors or capture; it
 * only blocks new INGRESS. A return leg that could be refused for being too full
 * would evaporate the one thing this whole feature exists to hand over.
 *
 * `builtEver` IS NOT TOUCHED. That column counts what a commander has BUILT, and a
 * towed wreck was built by somebody else.
 */
export async function resolvePirateReturn(
  tx: Tx,
  raidId: string,
  clock: Clock,
): Promise<PirateRaidDelivery | null> {
  const claimed = await tx
    .update(pirateRaids)
    .set({ status: 'done' })
    .where(and(eq(pirateRaids.id, raidId), eq(pirateRaids.status, 'returning')))
    .returning();
  const raid = claimed[0];
  if (!raid) return null;

  await publishShard(tx, raid.seasonId, 'pirate');

  const home = await loadLocked(tx, raid.planetId, clock);
  const returning = await fleetOfRaid(tx, raid.planetId, raidId);
  const merged: Fleet = { ...home.homeFleet };
  for (const [hull, count] of fleetEntries(returning)) {
    merged[hull] = (merged[hull] ?? 0) + count;
  }
  if (raid.capturedHull) {
    merged[raid.capturedHull] = (merged[raid.capturedHull] ?? 0) + 1;
  }
  await clearRaidUnits(tx, raid.planetId, raidId);
  await setUnits(tx, raid.planetId, merged, 'home', home.playerId);

  const loot = raid.loot ?? { alloy: 0, crystal: 0, deuterium: 0 };
  await saveResources(tx, raid.planetId, {
    alloy: home.alloy + loot.alloy,
    crystal: home.crystal + loot.crystal,
    deuterium: home.deuterium + loot.deuterium,
  });

  await recomputeWealth(tx, raid.planetId);
  await recomputePlayerWealth(tx, home.playerId);

  await notify(tx, {
    playerId: home.playerId,
    kind: 'fleet_returned',
    payload: {
      trip: 'pirate',
      ships: fleetCount(returning),
      lootAlloy: loot.alloy,
      lootCrystal: loot.crystal,
      lootDeuterium: loot.deuterium,
      ...(raid.capturedHull ? { capturedHull: raid.capturedHull } : {}),
    },
    at: home.now,
    refId: raid.id,
  });
  await publish(tx, home.playerId, 'private:pirate');

  return {
    raidId,
    ships: fleetCount(returning),
    delivered: loot,
    capturedHull: raid.capturedHull ?? null,
  };
}

/** Value of the destroyed hulls that were not ground emplacements. */
const flyingValue = (fleet: Fleet): number =>
  fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground)
    .reduce(
      (sum, [id, n]) => sum + n * (HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium),
      0,
    );

/** What one material contributed to the wreck, so the field splits the way the losses did. */
const flyingMaterial = (fleet: Fleet, material: 'alloy' | 'crystal' | 'deuterium'): number =>
  fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground)
    .reduce((sum, [id, n]) => sum + n * HULLS[id][material], 0);

/**
 * THE WRECK FIELD A PIRATE BATTLE LEAVES, AT THE RENDEZVOUS.
 *
 * Both sides, priced by `DEBRIS.share` off the same two loss lists the report
 * carries — a pirate's hulls are ordinary Fleet V2 hulls and there is no reason
 * their remains behave differently from a player's.
 *
 * SPLIT BY MATERIAL rather than dumped into alloy, the same way both world-battle
 * paths do it: what a Prospector brings back has to resemble what died.
 *
 * `DEBRIS.minimum` IS THE SAME FLOOR EVERY OTHER FIELD ANSWERS TO. Below it there
 * is no row at all, so a skirmish does not litter the disc with fields worth less
 * than the flight out to them.
 */
async function createVoidDebris(
  tx: Tx,
  raid: PirateRaidRow,
  attackerLosses: Fleet,
  pirateLosses: Fleet,
  now: Date,
): Promise<void> {
  const wreck =
    (flyingValue(attackerLosses) + flyingValue(pirateLosses)) * DEBRIS.share;
  if (wreck < DEBRIS.minimum) return;

  const alloy = flyingMaterial(attackerLosses, 'alloy') + flyingMaterial(pirateLosses, 'alloy');
  const crystal =
    flyingMaterial(attackerLosses, 'crystal') + flyingMaterial(pirateLosses, 'crystal');
  const deuterium =
    flyingMaterial(attackerLosses, 'deuterium') + flyingMaterial(pirateLosses, 'deuterium');
  const total = alloy + crystal + deuterium;
  if (total <= 0) return;

  await tx.insert(debrisFields).values({
    seasonId: raid.seasonId,
    planetId: null,
    x: raid.interceptX,
    y: raid.interceptY,
    z: raid.interceptZ,
    pirateRaidId: raid.id,
    alloy: (wreck * alloy) / total,
    crystal: (wreck * crystal) / total,
    deuterium: (wreck * deuterium) / total,
    createdAt: now,
  });
}
