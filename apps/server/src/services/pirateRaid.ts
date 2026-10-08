import { and, eq, gt, inArray } from 'drizzle-orm';
import {
  DEBRIS,
  ENGAGEMENT_STANDOFF,
  HULLS,
  MOBILE_HULLS,
  PIRATE,
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
  pirateOverrun,
  pirateStats,
  resolveCombat,
  resolveBattle,
  soloStack,
  hpRadiationApplies,
  capLoadToSurvivors,
  seededFrom,
  settleWreck,
  surfaceStandoff,
  toGame,
  toWorld,
  visualLeg,
  worldRadius,
  pirateZone,
  type Fleet,
  type HullId,
  type PirateLevel,
  type PirateSpec,
  type Resources,
  type Vec3,
  shipDamageApplies,
  type HpDamageLots,
} from '@astera/rules';
import { dockNotice, landShips, shipsIn } from './shipDamage.js';
import type { Db, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { addMinutes, atMinute, minutesSince } from '../clock.js';
import { battleReports, debrisFields, pirateRaids, pirateState, planets, seasons, units } from '../db/schema.js';
import { publish, publishShard } from '../stream/bus.js';
import { assertFreeBay } from './flight.js';
import { assertFuel } from './fuel.js';
import { notify } from './notifications.js';
import { schedule } from '../worker/queue.js';
import { safeHomePlanet } from './ownership.js';
import { sensorPosts } from './traffic.js';
import { sensorHistoryForPlayer } from './sensorHistory.js';
import { techOf } from './researchState.js';
import { flightPrefix, flightSegment, settleSpecialFlightRadiation } from './specialFlightRadiation.js';
import { assertRadiationSafe } from './radiation.js';
import { pendingThreads, type PendingThread } from './session.js';
import { planetView, type PlanetView } from './planetView.js';
import {
  livingRoster,
  loadPirateSnapshot,
  pirateCallsign,
  pirateId,
  pirateIndexFromId,
  pirateSpecAt,
} from './pirateField.js';
import {
  GameError,
  assertSeasonOpenThrough,
  assertWorldOperational,
  buildingLevelsOf,
  loadLocked,
  orbitOf,
  recomputePlayerWealth,
  recomputeWealth,
  saveResources,
  setUnits,
  type LockedPlanet,
} from './planet.js';
import { assertOutsideSilentSpace, markProgress } from './waitingRoom.js';

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
 * THE FOG GATE IS IDENTIFICATION. Radar sees an anonymous question mark, but a
 * commander can raid only after Telescope sight has identified that pirate once.
 * Discovery memory then keeps the target actionable for the rest of its life.
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
  /**
   * THE FLIGHT TIME THE PLAYER WAS LOOKING AT WHEN THEY PRESSED. D183.
   *
   * Owner report: *"Gönderirken 10dk yazıyordu, gönderme tuşuna bastım 40dk'ya
   * çıktı."* The rendezvous table on `/api/pirates` is an instantaneous solve, and
   * a quote that is even half a minute old drifts past a minute about 1.5% of the
   * time — worst measured case 5.1 minutes to 56.3. It JUMPS rather than slides
   * because `interceptOrbit` finds the FIRST meeting: a wing slower than the pirate
   * waits for the orbit to come round, and a fleet leaving a moment too late misses
   * that narrow window and is quoted the next lap.
   *
   * A raid cannot be recalled (P3), so this is the one surface that must never
   * commit a fleet to a number the player never saw. Optional because a caller may
   * genuinely not have one (the simulator, a bot, an older client); when it is
   * given, the launch is refused rather than flown at a different answer.
   */
  quotedMinutes?: number,
  acknowledgeRadiationLoss = false,
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
    assertOutsideSilentSpace(origin);

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
    const spec = index === null ? undefined : snapshot.spec(index);
    if (!spec || index === null) throw new GameError('NO_SUCH_PIRATE', 'No such pirate', 404);

    // Before the rendezvous solve: there is no point finding a meeting point for a
    // launch that has nowhere to launch from. D28, in mining's order.
    await assertFreeBay(tx, planetId, origin.buildings.CORE, origin.faults);

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
     * THE FOG GATE. You may only aim at a pirate you have identified.
     *
     * Tested through `pirateZone`, which is live `sensorZone` — the one statement
     * of the three zones — floored at IDENTIFIED by D158/D160's discovery memory.
     * The launch, the traffic projection and the pirate list all read that one
     * function, so a target that is legal to shoot at is exactly the one that is
     * drawn on the disc.
     *
     * D158 WIDENED THIS DELIBERATELY, and it is the same rule the rock lane has
     * had since D143: a target you have found once stays yours to send a fleet at,
     * because an opportunity that expires while the commander is picking hulls is
     * not a decision. D160 then made what memory hands back the reading the
     * commander already paid for — the epoch's reach IS the telescope's.
     *
     * CONTACT stays an anonymous Radar mark. IDENTIFIED can come from live
     * Telescope sight or from the same Telescope discovery memory rocks use.
     */
    const spheres = await sensorPosts(tx, await ownWorldIds(tx, origin.playerId));
    const epochs = await sensorHistoryForPlayer(tx, origin.playerId, origin.seasonId);
    const zone = pirateZone(spheres, spec, piratePosition(spec, nowMinutes), epochs, nowMinutes);
    if (zone === 'NONE') {
      throw new GameError('PIRATE_OUT_OF_SIGHT', 'That pirate is not on your sensors', 403);
    }
    if (zone !== 'IDENTIFIED') {
      throw new GameError('PIRATE_NOT_IDENTIFIED', 'Identify this pirate with a Telescope before attacking', 403);
    }

    const tech = await techOf(tx, origin.playerId);
    const speed = fleetSpeed(requested, tech) * fleetSpeedMult(origin.orbit);
    const hit = interceptOrbit(
      origin,
      speed,
      spec,
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

    /*
      AND IT IS THE MEETING THE PLAYER READ. D183.

      Checked here, before a bay, a hull or a drop of fuel is committed, so a
      refusal costs nothing and can simply be re-read. The refusal NAMES the new
      minute: a commander told only "that moved" learns nothing, and the number
      they need is the one this transaction just solved for.
    */
    if (
      quotedMinutes !== undefined
      && Number.isFinite(quotedMinutes)
      && Math.abs(hit.flightMinutes - quotedMinutes) > PIRATE.quoteToleranceMinutes
    ) {
      throw new GameError(
        'RENDEZVOUS_MOVED',
        'That pirate has moved on its orbit. Check the new flight time before you commit.',
        409,
        { minutes: Math.round(hit.flightMinutes * 10) / 10 },
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
      { boost: fleetSpeedMult(origin.orbit), tech },
    );
    if (hpRadiationApplies(origin.rulesetVersion)) await assertRadiationSafe(tx, {
      seasonId: origin.seasonId, from: origin, to: hit.at, departAt: origin.now, arriveAt, fleet: requested,
      tech, acknowledged: acknowledgeRadiationLoss, path: [flightSegment(origin, hit.at, origin.now, arriveAt),
        flightSegment(hit.at, hit.at, arriveAt, resolveAt), flightSegment(hit.at, origin, resolveAt, addMinutes(resolveAt, homeMinutes))],
    });
    assertSeasonOpenThrough(origin, addMinutes(resolveAt, homeMinutes));

    const [raid] = await tx
      .insert(pirateRaids)
      .values({
        seasonId: origin.seasonId,
        planetId,
        // The fleet follows its COMMANDER home, not the pad. See the column.
        ownerPlayerId: origin.playerId,
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
    await markProgress(tx, origin.playerId, origin.now); // D212

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
  let raid = claimed[0];
  if (!raid) return;

  await publishShard(tx, raid.seasonId, 'pirate');

  const origin = await loadLocked(tx, raid.planetId, clock);
  const key = (await loadPirateSnapshot(tx, raid.seasonId, origin.now)).key;
  const spec = await pirateSpecAt(tx, raid.seasonId, raid.pirateIndex);

  let attacking = await fleetOfRaid(tx, raid.planetId, raidId);
  if (hpRadiationApplies(origin.rulesetVersion)) {
    const meet = { x: raid.interceptX, y: raid.interceptY, z: raid.interceptZ };
    const dose = await settleSpecialFlightRadiation(tx, { id: raid.id, leg: 'OUT', seasonId: raid.seasonId, rulesetVersion: origin.rulesetVersion,
      planetId: raid.planetId, playerId: raid.ownerPlayerId, location: raidLocation(raid.id),
      path: [flightSegment(origin, meet, raid.departAt, raid.arriveAt),
        flightSegment(meet, meet, raid.arriveAt, new Date(engagementEndsAt(raid.arriveAt.getTime())))],
      damage: raid.damage, tech: raid.tech ?? {}, radiationSettledAt: raid.radiationSettledAt });
    raid = { ...raid, damage: dose.damage.length ? [...dose.damage] : null, radiationSettledAt: dose.radiationSettledAt };
    await tx.update(pirateRaids).set({ damage: raid.damage, radiationSettledAt: raid.radiationSettledAt }).where(eq(pirateRaids.id, raid.id));
    attacking = dose.fleet;
  }
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
    await tellTargetGone(tx, raid, {
      callsign: pirateCallsign(key, raid.pirateIndex),
      ships: fleetCount(attacking),
    }, origin.now);
    await turnForHome(tx, raid, attacking, origin, null, null, null, raid.damage);
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
  const now = hpRadiationApplies(origin.rulesetVersion) ? new Date(engagementEndsAt(raid.arriveAt.getTime())) : origin.now;

  /**
   * TAKE THE ROW INTO EXISTENCE BEFORE LOCKING IT.
   *
   * `SELECT ... FOR UPDATE` locks a ROW, and it cannot lock one that is not there.
   * An untouched pirate has no `pirate_state` row at all, so on the FIRST hit the
   * lock below held nothing: two arrivals inside one transaction window both read
   * "full crew, nothing shot off", both fought it, and the second `ON CONFLICT DO
   * UPDATE` wrote its own total over the first one's. The pirate was then paid for
   * twice — two full hoards, two capture rolls — and its crew quietly came back to
   * life in between.
   *
   * `ON CONFLICT DO NOTHING` is the serialisation point: a concurrent inserter of
   * the same key waits on this transaction before it may proceed, so whichever
   * arrival gets here second reads the first one's committed casualties. A seeded
   * row with no losses and no `destroyed_at` is indistinguishable from no row to
   * every reader — `livingRosterOf`, `destroyedAt` and `standing` all answer the
   * same — so this creates state without creating meaning.
   *
   * The lock order is unchanged and still the global one: season, then planet
   * (both taken by `loadLocked`), then this row last.
   */
  await tx
    .insert(pirateState)
    .values({ seasonId: raid.seasonId, index: raid.pirateIndex, losses: {}, updatedAt: now })
    .onConflictDoNothing({ target: [pirateState.seasonId, pirateState.index] });

  const [state] = await tx
    .select()
    .from(pirateState)
    .where(and(eq(pirateState.seasonId, raid.seasonId), eq(pirateState.index, raid.pirateIndex)))
    .for('update');

  const crew = livingRoster(spec.roster, state?.losses);
  if (state?.destroyedAt != null || fleetCount(crew) === 0) {
    // Somebody else won the race. The fleet turns around with nothing — and is
    // told so HERE, at the instant it becomes true, rather than a return leg
    // later when the squadron lands and the row says "empty-handed".
    await tellTargetGone(tx, raid, {
      callsign: pirateCallsign(key, raid.pirateIndex),
      level: spec.level,
      ships: fleetCount(attacking),
    }, now);
    await turnForHome(tx, raid, attacking, origin, null, null, null, raid.damage);
    return;
  }

  /**
   * THE FIGHT. The pirate defends; its handicap is the only modifier in play.
   *
   * `shield: 0` — an Aegis is a building on a world, and there is no world here.
   * Seeded from the raid id so the report can be re-derived from its inputs.
   */
  const combatTech = {
    attacker: { tech: raid.tech ?? {} },
    defender: { tech: {}, damageMult: pirateStats(spec.level).damageMult },
  };
  const fought = hpRadiationApplies(origin.rulesetVersion)
    ? resolveBattle([soloStack(attacking, combatTech.attacker, raid.damage ?? undefined)],
      [{ stackId: 'pirate', playerId: '', fleet: crew, tech: combatTech.defender }], 0, seededFrom(raid.id), 'HP_PLANET')
    : resolveCombat(attacking, crew, 0, seededFrom(raid.id), combatTech, raid.damage ?? undefined);
  /*
    UNESCORTED HOLDS DO NOT ESCAPE (owner report, 2026-10-06): once the crew's last warship is down
    and this wing still has a gun, the holds left are taken — destroyed, wreckage, a DECISIVE grade.
  */
  const result = pirateOverrun(fought);
  /*
    KALICI GEMİ HASARI. The hunters carry their part-hit ships home to be judged on
    landing; the crew is nobody's and carries nothing (plan D1).
  */
  const attackerDamage = shipDamageApplies(origin.rulesetVersion) ? result.attackerDamage : [];

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
      destroyedByPlayerId: wiped ? raid.ownerPlayerId : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [pirateState.seasonId, pirateState.index],
      set: {
        losses,
        ...(wiped ? { destroyedAt: now, destroyedByPlayerId: raid.ownerPlayerId } : {}),
        updatedAt: now,
      },
    });

  if (wiped) {
    await turnRaidsFromDestroyedPirate(tx, raid, spec, key, now);
  }

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
  /*
    AND THE SQUADRON'S COLLECTORS TAKE THEIR SHARE BEFORE THE FIELD IS PUBLIC. D200.
    Settled once, so the report, the field and the leg home read one remainder.
    A squadron annihilated here has no collector left to lift anything.
  */
  const { salvage, field: wreck } = settleWreck(
    voidWreck(result.attackerLosses, result.defenderLosses),
    result.attackerSurvivors,
  );
  const lifted = salvage.alloy + salvage.crystal + salvage.deuterium > 0;
  const wreckValue = wreck ? wreck.alloy + wreck.crystal + wreck.deuterium : 0;
  await createVoidDebris(tx, raid, wreck, now);

  await tx.insert(battleReports).values({
    seasonId: raid.seasonId,
    missionId: null,
    targetPlanetId: null,
    pirateRaidId: raid.id,
    targetKind: 'PIRATE',
    /*
      THE COMMANDER WHO COMMITTED THE FLEET, NOT THE WORLD'S CURRENT HOLDER. D150.

      `reports.ts` gates a report's visibility on this column, so reading the pad's
      controller here did not merely mislabel the row: a colony taken while the
      squadron was out handed the raider's own battle report to the captor, and the
      commander who fought it could no longer open it at all.
    */
    attackerPlayerId: raid.ownerPlayerId,
    defenderPlayerId: null,
    grade: result.grade,
    rounds: result.rounds,
    loot: loot
      ? { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium }
      : { alloy: 0, crystal: 0, deuterium: 0 },
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
    attackerDamage,
    attackerFleet: attacking,
    defenderFleet: crew,
    defenceSalvage: {},
    disruptedMinutes: 0,
    wreckValue,
    salvage,
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
    // The same rule as the report above and the delivery below: D150's column.
    playerId: raid.ownerPlayerId,
    kind: 'raid_result',
    payload: {
      targetKind: 'PIRATE',
      pirateLevel: spec.level,
      pirateCallsign: pirateCallsign(key, raid.pirateIndex),
      grade: result.grade,
      lootAlloy: loot?.alloy ?? 0,
      lootCrystal: loot?.crystal ?? 0,
      lootDeuterium: loot?.deuterium ?? 0,
      ...(lifted
        ? {
            salvageAlloy: salvage.alloy,
            salvageCrystal: salvage.crystal,
            salvageDeuterium: salvage.deuterium,
          }
        : {}),
      unitsLost: fleetCount(result.attackerLosses),
      shipsHome: fleetCount(result.attackerSurvivors),
      ...(attackerDamage.length > 0 ? { damaged: shipsIn(attackerDamage) } : {}),
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
    lifted ? salvage : null,
    attackerDamage,
  );
}

/**
 * THE TRIP THAT ARRIVED AT NOTHING. D177.
 *
 * A raid can be pointless for two reasons that are one fact to the commander who
 * flew it: another commander wiped the crew first, or the lane no longer carries
 * that pirate at all. Both end in `turnForHome` with no loot, and both used to end
 * in SILENCE — `raid_result` is written by the fight, so a trip with no fight in it
 * wrote nothing and the news waited for the squadron to land.
 *
 * IT NAMES THE PIRATE AND NOT THE WINNER. Who got there first is somebody else's
 * raid, and D127 does not hand it over because this commander happened to aim at
 * the same target. Idempotent by `(player, kind, refId)` like every other
 * notification, so a redelivered arrival cannot say it twice.
 */
async function tellTargetGone(
  tx: Tx,
  raid: PirateRaidRow,
  what: { callsign: string; level?: number; ships: number },
  at: Date,
): Promise<void> {
  await notify(tx, {
    // THE COMMANDER, NEVER THE PAD. `loadLocked` reads whoever holds the origin
    // world right now, which is the wrong answer to "whose raid is this" the
    // moment a colony changes hands mid-flight. D150.
    playerId: raid.ownerPlayerId,
    kind: 'target_gone',
    payload: { targetKind: 'PIRATE', ...what },
    at,
    refId: raid.id,
  });
}

/**
 * Pirate return rendering normally starts one engagement standoff in front of the
 * stored rendezvous. An early turn has no engagement, so store the point just far
 * enough beyond the physical turn for that existing projection to begin exactly
 * where the outbound marker was. The short-leg branch mirrors `visualLeg`'s
 * half-leg clamp.
 */
function pirateReturnAnchor(turn: Vec3, home: Vec3): Vec3 {
  const h = toWorld(home);
  const t = toWorld(turn);
  const dx = t[0] - h[0];
  const dy = t[1] - h[1];
  const dz = t[2] - h[2];
  const distanceFromHome = Math.hypot(dx, dy, dz);
  if (distanceFromHome <= 0) return turn;

  const anchorDistance = distanceFromHome < ENGAGEMENT_STANDOFF
    ? distanceFromHome * 2
    : distanceFromHome + ENGAGEMENT_STANDOFF;
  const scale = anchorDistance / distanceFromHome;
  return toGame([
    h[0] + dx * scale,
    h[1] + dy * scale,
    h[2] + dz * scale,
  ]);
}

/**
 * TURN ONE OUTBOUND RAID FOR HOME, NOW, FROM WHERE IT IS.
 *
 * The one statement of an early turn, shared by the two things that cause one: the
 * pirate destroyed by somebody else, and the commander calling the raid back (owner,
 * 2026-10-08). The outbound dose is settled up to the turn, the craft fly home at
 * their own speed from the point they occupy, and every return projection reads the
 * stored turn point and instant.
 *
 * Replacing the stored intercept with the turn point and `arriveAt` with the turn
 * instant deliberately reuses every existing return projection. The stale arrival
 * event remains safe because the conditional status update below owns the state
 * transition. Returns `missed` when that update lost to the arrival.
 */
async function turnRaidNow(
  tx: Tx,
  raid: PirateRaidRow,
  rulesetVersion: number | undefined,
  now: Date,
  recall: boolean,
): Promise<{ outcome: 'turned'; homeAt: Date; ships: number } | { outcome: 'lost' } | { outcome: 'missed' }> {
  const precise = rulesetVersion !== undefined && hpRadiationApplies(rulesetVersion);
  const [home] = await tx.select().from(planets).where(eq(planets.id, raid.planetId));
  if (!home) throw new Error(`pirate raid ${raid.id} references a missing planet`);
  let fleet = await fleetOfRaid(tx, raid.planetId, raid.id);
  let damage = raid.damage;
  let radiationSettledAt = raid.radiationSettledAt;
  if (precise) {
    const dose = await settleSpecialFlightRadiation(tx, { id: raid.id, leg: 'OUT', seasonId: raid.seasonId,
      rulesetVersion, planetId: raid.planetId, playerId: raid.ownerPlayerId, location: raidLocation(raid.id),
      path: flightPrefix([flightSegment(home, { x: raid.interceptX, y: raid.interceptY, z: raid.interceptZ }, raid.departAt, raid.arriveAt)], now),
      damage: raid.damage, tech: raid.tech ?? {}, radiationSettledAt: raid.radiationSettledAt });
    fleet = dose.fleet;
    damage = dose.damage.length ? [...dose.damage] : null;
    radiationSettledAt = dose.radiationSettledAt;
  }
  if (fleetCount(fleet) === 0) {
    const closed = await tx
      .update(pirateRaids)
      .set({ status: 'done', damage, radiationSettledAt, ...(recall ? { recalledAt: now } : {}) })
      .where(and(eq(pirateRaids.id, raid.id), eq(pirateRaids.status, 'outbound')))
      .returning({ id: pirateRaids.id });
    return closed[0] ? { outcome: 'lost' } : { outcome: 'missed' };
  }

  const [buildings, orbit] = await Promise.all([
    buildingLevelsOf(tx, raid.planetId),
    orbitOf(tx, raid.planetId),
  ]);
  const outbound = visualLeg(
    home,
    { x: raid.interceptX, y: raid.interceptY, z: raid.interceptZ },
    surfaceStandoff(worldRadius(buildings.CORE)),
    ENGAGEMENT_STANDOFF,
  );
  const duration = raid.arriveAt.getTime() - raid.departAt.getTime();
  const progress = duration <= 0
    ? 0
    : Math.max(0, Math.min(1, (now.getTime() - raid.departAt.getTime()) / duration));
  const turn = {
    x: outbound.from.x + (outbound.to.x - outbound.from.x) * progress,
    y: outbound.from.y + (outbound.to.y - outbound.from.y) * progress,
    z: outbound.from.z + (outbound.to.z - outbound.from.z) * progress,
  };
  const returnAnchor = pirateReturnAnchor(turn, home);
  const homeAt = addMinutes(
    now,
    fleetTravelExact(
      distance(turn, outbound.from),
      fleet,
      { boost: fleetSpeedMult(orbit), tech: raid.tech ?? {} },
    ),
  );

  const claimed = await tx
    .update(pirateRaids)
    .set({
      status: 'returning',
      interceptX: returnAnchor.x,
      interceptY: returnAnchor.y,
      interceptZ: returnAnchor.z,
      arriveAt: now,
      returnDepartAt: precise ? now : null,
      damage,
      radiationSettledAt,
      homeAt,
      loot: null,
      salvage: null,
      capturedHull: null,
      ...(recall ? { recalledAt: now } : {}),
    })
    .where(and(
      eq(pirateRaids.id, raid.id),
      eq(pirateRaids.status, 'outbound'),
      gt(pirateRaids.arriveAt, now),
    ))
    .returning({ id: pirateRaids.id });
  if (!claimed[0]) return { outcome: 'missed' };

  await schedule(tx, {
    seasonId: raid.seasonId,
    kind: 'pirate_return',
    refId: raid.id,
    resolveAt: homeAt,
  });
  await publish(tx, raid.ownerPlayerId, 'private:pirate');
  return { outcome: 'turned', homeAt, ships: fleetCount(fleet) };
}

/**
 * A pirate has just been destroyed. Fleets that are still on their outbound leg
 * turn at their current position immediately; they do not fly on to the dead
 * pirate's old rendezvous.
 */
async function turnRaidsFromDestroyedPirate(
  tx: Tx,
  winner: PirateRaidRow,
  spec: PirateSpec,
  key: string,
  now: Date,
): Promise<void> {
  const candidates = await tx
    .select()
    .from(pirateRaids)
    .where(and(
      eq(pirateRaids.seasonId, winner.seasonId),
      eq(pirateRaids.pirateIndex, winner.pirateIndex),
      eq(pirateRaids.status, 'outbound'),
      gt(pirateRaids.arriveAt, now),
    ));
  const [season] = await tx.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons).where(eq(seasons.id, winner.seasonId));

  let turned = false;
  for (const raid of candidates) {
    const result = await turnRaidNow(tx, raid, season?.rulesetVersion, now, false);
    if (result.outcome !== 'turned') continue;
    turned = true;
    await tellTargetGone(tx, raid, {
      callsign: pirateCallsign(key, raid.pirateIndex),
      level: spec.level,
      ships: result.ships,
    }, now);
  }

  if (turned) await publishShard(tx, winner.seasonId, 'pirate');
}

/**
 * CALL A PIRATE RAID BACK. Owner, 2026-10-08: "Diğerlerinin olup bunun olmaması yanlış."
 *
 * The same one turn a raid at a world has (K8) and a Prospector squadron has: once,
 * only while the raid is still outbound and strictly before its engagement begins.
 * It turns where it is and flies home; nothing is fought or taken, the pirate's crew
 * is untouched and the fuel for both legs stays spent.
 *
 * KEYED ON THE COMMANDER, NEVER ON THE PAD (D150). A raid that is not this commander's
 * answers 404, like one that does not exist. Lock order matches the arrival worker:
 * the raid row, then the world (inside the shared turn).
 */
export async function recallPirateRaid(
  db: Db,
  raidId: string,
  clock: Clock,
  expectedPlayerId: string,
): Promise<{ raidId: string; homeAt: Date | null }> {
  return db.transaction(async (tx) => {
    const [raid] = await tx.select().from(pirateRaids).where(eq(pirateRaids.id, raidId)).for('update');
    if (raid?.ownerPlayerId !== expectedPlayerId) {
      throw new GameError('NOT_FOUND', 'That flight no longer exists', 404);
    }
    const [season] = await tx.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons).where(eq(seasons.id, raid.seasonId));
    const now = clock.now();
    if (raid.status !== 'outbound' || raid.recalledAt !== null || now.getTime() >= raid.arriveAt.getTime()) {
      throw new GameError('NOT_RECALLABLE', 'That flight cannot be called back', 409);
    }
    const result = await turnRaidNow(tx, raid, season?.rulesetVersion, now, true);
    if (result.outcome === 'missed') throw new GameError('NOT_RECALLABLE', 'That flight cannot be called back', 409);
    if (result.outcome === 'lost') {
      await clearRaidUnits(tx, raid.planetId, raid.id);
      await recomputePlayerWealth(tx, raid.ownerPlayerId);
    }
    await publishShard(tx, raid.seasonId, 'pirate');
    return { raidId: raid.id, homeAt: result.outcome === 'turned' ? result.homeAt : null };
  });
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
  /** What its Garbage Collectors lifted at the rendezvous, or null. D200. */
  salvage: Resources | null,
  /** What the survivors carry home to the Repair Station. Kalıcı gemi hasarı. */
  damage: HpDamageLots | null,
): Promise<void> {
  if (fleetCount(survivors) === 0) {
    await clearRaidUnits(tx, raid.planetId, raid.id);
    await tx
      .update(pirateRaids)
      .set({ status: 'done', loot, salvage, capturedHull: captured, homeAt: null })
      .where(eq(pirateRaids.id, raid.id));
    await recomputeWealth(tx, raid.planetId);
    await recomputePlayerWealth(tx, raid.ownerPlayerId);
    return;
  }

  const meet = { x: raid.interceptX, y: raid.interceptY, z: raid.interceptZ };
  const back = fleetTravelExact(
    distance(meet, origin),
    survivors,
    { boost: fleetSpeedMult(await orbitOf(tx, raid.planetId)), tech: raid.tech ?? {} },
  );
  const returnDepartAt = hpRadiationApplies(origin.rulesetVersion)
    ? new Date(engagementEndsAt(raid.arriveAt.getTime())) : origin.now;
  const homeAt = addMinutes(returnDepartAt, back);

  // Only the survivors fly home; the dead simply cease to exist.
  const returning: Fleet = { ...survivors };
  if (hpRadiationApplies(origin.rulesetVersion) && captured) returning[captured] = (returning[captured] ?? 0) + 1;
  await clearRaidUnits(tx, raid.planetId, raid.id);
  await setUnits(tx, raid.planetId, returning, raidLocation(raid.id), raid.ownerPlayerId);

  await tx
    .update(pirateRaids)
    .set({ loot, salvage, capturedHull: captured, homeAt, returnDepartAt, damage: damage && damage.length > 0 ? [...damage] : null })
    .where(eq(pirateRaids.id, raid.id));

  await schedule(tx, {
    seasonId: raid.seasonId,
    kind: 'pirate_return',
    refId: raid.id,
    resolveAt: homeAt,
  });
  await recomputePlayerWealth(tx, raid.ownerPlayerId);
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
 * A CAPTURED HULL ALWAYS LANDS. D133 stated rather
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
  let raid = claimed[0];
  if (!raid) return null;

  await publishShard(tx, raid.seasonId, 'pirate');

  /**
   * WHERE THE SQUADRON IS PARKED, AND WHERE IT IS ACTUALLY DELIVERED. D97 · D134.
   *
   * They are the same world on every ordinary trip and they are NOT the same world
   * the moment the origin colony falls while the fleet is away. Ownership follows
   * `raid.ownerPlayerId`; delivery follows that commander's still-owned world,
   * falling back to the capital, which cannot be captured and is therefore always
   * an answer. This is `settleReturn`'s arithmetic, and it is shared rather than
   * restated so the two lanes cannot drift.
   *
   * Reading the destination off `planets.controller_player_id` instead handed the
   * whole raid — squadron, hoard and towed hull — to the commander who had just
   * taken the pad, which paid an attacker for their victim's flight.
   */
  const storagePlanetId = raid.planetId;
  const destinationPlanetId = await safeHomePlanet(tx, raid.ownerPlayerId, storagePlanetId);
  const home = await loadLocked(tx, destinationPlanetId, clock);
  let returning = await fleetOfRaid(tx, storagePlanetId, raidId);
  let capturedHull = raid.capturedHull;
  if (hpRadiationApplies(home.rulesetVersion) && raid.homeAt) {
    // Captured hulls are already physical from acquisition; HOME never creates one.
    const dose = await settleSpecialFlightRadiation(tx, { id: raid.id, leg: 'HOME', seasonId: raid.seasonId, rulesetVersion: home.rulesetVersion,
      planetId: storagePlanetId, playerId: raid.ownerPlayerId, location: raidLocation(raid.id),
      path: [flightSegment({ x: raid.interceptX, y: raid.interceptY, z: raid.interceptZ }, home,
        raid.returnDepartAt ?? new Date(engagementEndsAt(raid.arriveAt.getTime())), raid.homeAt)],
      damage: raid.damage, tech: raid.tech ?? {}, radiationSettledAt: raid.radiationSettledAt });
    returning = dose.fleet;
    if (capturedHull && (returning[capturedHull] ?? 0) === 0) capturedHull = null;
    const cargo = capLoadToSurvivors({ loot: raid.loot, salvage: raid.salvage }, returning, raid.tech ?? {});
    raid = { ...raid, damage: dose.damage.length ? [...dose.damage] : null, loot: cargo.loot, salvage: cargo.salvage,
      capturedHull: null, radiationSettledAt: dose.radiationSettledAt };
    await tx.update(pirateRaids).set({ damage: raid.damage, radiationSettledAt: raid.radiationSettledAt, loot: raid.loot, salvage: raid.salvage }).where(eq(pirateRaids.id, raid.id));
    if (fleetCount(returning) === 0) return null;
  }
  // The towed hull comes home whole: it was the pirate's, and its damage was the pirate's.
  const landing: Fleet = { ...returning };
  if (raid.capturedHull) landing[raid.capturedHull] = (landing[raid.capturedHull] ?? 0) + 1;
  await clearRaidUnits(tx, storagePlanetId, raidId);
  const dockReport = await landShips(tx, {
    planetId: destinationPlanetId,
    ownerPlayerId: raid.ownerPlayerId,
    fleet: landing,
    damage: raid.damage,
    at: home.now,
  });

  const loot = raid.loot ?? { alloy: 0, crystal: 0, deuterium: 0 };
  // The wreck its collectors lifted lands beside the hoard, whole. D200.
  const salvage = raid.salvage;
  await saveResources(tx, destinationPlanetId, {
    alloy: home.alloy + loot.alloy + (salvage?.alloy ?? 0),
    crystal: home.crystal + loot.crystal + (salvage?.crystal ?? 0),
    deuterium: home.deuterium + loot.deuterium + (salvage?.deuterium ?? 0),
  });

  /*
    THE WORLD THE SQUADRON LEFT IS SOMEBODY ELSE'S NOW, AND ITS WEALTH MOVED TOO.
    Wealth counts units by the world they sit on, so a captor was carrying the
    parked stack on their books for the whole flight. Both commanders are settled.
  */
  await recomputePlayerWealth(tx, raid.ownerPlayerId);
  if (destinationPlanetId !== storagePlanetId) await recomputeWealth(tx, storagePlanetId);

  await notify(tx, {
    playerId: raid.ownerPlayerId,
    kind: 'fleet_returned',
    payload: {
      trip: 'pirate',
      // Called back before its engagement (owner, 2026-10-08): nothing was fought.
      ...(raid.recalledAt !== null ? { recalled: true } : {}),
      ships: fleetCount(returning),
      lootAlloy: loot.alloy,
      lootCrystal: loot.crystal,
      lootDeuterium: loot.deuterium,
      ...(salvage
        ? {
            salvageAlloy: salvage.alloy,
            salvageCrystal: salvage.crystal,
            salvageDeuterium: salvage.deuterium,
          }
        : {}),
      ...(capturedHull ? { capturedHull } : {}),
      ...dockNotice(dockReport),
    },
    at: home.now,
    refId: raid.id,
  });
  await publish(tx, raid.ownerPlayerId, 'private:pirate');

  return {
    raidId,
    ships: fleetCount(returning),
    delivered: loot,
    capturedHull,
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
 * THE WRECK A PIRATE BATTLE MAKES, AT THE RENDEZVOUS.
 *
 * Both sides, priced by `DEBRIS.share` off the same two loss lists the report
 * carries — a pirate's hulls are ordinary Fleet V2 hulls and there is no reason
 * their remains behave differently from a player's.
 *
 * SPLIT BY MATERIAL rather than dumped into alloy, the same way both world-battle
 * paths do it: what a Prospector brings back has to resemble what died.
 */
function voidWreck(attackerLosses: Fleet, pirateLosses: Fleet): Resources {
  const alloy = flyingMaterial(attackerLosses, 'alloy') + flyingMaterial(pirateLosses, 'alloy');
  const crystal =
    flyingMaterial(attackerLosses, 'crystal') + flyingMaterial(pirateLosses, 'crystal');
  const deuterium =
    flyingMaterial(attackerLosses, 'deuterium') + flyingMaterial(pirateLosses, 'deuterium');
  const total = alloy + crystal + deuterium;
  if (total <= 0) return { alloy: 0, crystal: 0, deuterium: 0 };
  const wreck =
    (flyingValue(attackerLosses) + flyingValue(pirateLosses)) * DEBRIS.share;
  return {
    alloy: (wreck * alloy) / total,
    crystal: (wreck * crystal) / total,
    deuterium: (wreck * deuterium) / total,
  };
}

/**
 * THE FIELD WHAT IS LEFT OF IT BECOMES — `settleWreck`'s answer, never re-derived.
 *
 * `DEBRIS.minimum` IS THE SAME FLOOR EVERY OTHER FIELD ANSWERS TO, applied to what
 * the collectors left. Below it there is no row at all, so a skirmish does not
 * litter the disc with fields worth less than the flight out to them.
 */
async function createVoidDebris(
  tx: Tx,
  raid: PirateRaidRow,
  field: Resources | null,
  now: Date,
): Promise<void> {
  if (!field) return;
  await tx.insert(debrisFields).values({
    seasonId: raid.seasonId,
    planetId: null,
    x: raid.interceptX,
    y: raid.interceptY,
    z: raid.interceptZ,
    pirateRaidId: raid.id,
    alloy: field.alloy,
    crystal: field.crystal,
    deuterium: field.deuterium,
    createdAt: now,
  });
}
