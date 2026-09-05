import { and, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import {
  ANTI_STRATEGIC,
  PROBE,
  applyDisruption,
  disruptionMinutes,
  bookBattle,
  computeLoot,
  deuteriumOf,
  fleetCargo,
  fleetCount,
  fleetEntries,
  fleetSpeedMult,
  fleetValue,
  fleetTravelExact,
  garrisonOf,
  distance,
  massClass,
  interceptionRange,
  orbitStandoff,
  pointAlong,
  radarRange,
  radarRevealsOrigin,
  sensorSphere,
  seededFrom,
  sphereEntryFraction,
  surfaceStandoff,
  visualLeg,
  worldRadius,
  DEBRIS,
  HULLS,
  NON_COMBATANT_HULLS,
  SEASON,
  SERVERS,
  resolveCombat,
  travelExact,
  vaultProtects,
  type Fleet,
  type Ledger,
} from '@astera/rules';
import { addMinutes, atMinute, minutesSince, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  accounts,
  battleReports,
  buildings,
  buildOrders,
  clanMemberships,
  clans,
  debrisFields,
  miningRuns,
  missions,
  neutralPlanetState,
  planets,
  players,
  probeReports,
  scheduledEvents,
  seasonResults,
  seasons,
  shards,
  strategicAssets,
  strategicImpacts,
  strategicInterceptions,
  units,
} from '../db/schema.js';
import {
  loadLocked,
  lockSeason,
  orbitOf,
  recomputePlayerWealth,
  recomputeWealth,
  saveResources,
  setUnits,
} from '../services/planet.js';
import { clearMissionUnits, fleetOfMission } from '../services/mission.js';
import { resolvePirateArrival, resolvePirateReturn } from '../services/pirateRaid.js';
import { resolveTradeArrival, resolveTradeReturn } from '../services/trade.js';
import { techOf } from '../services/researchState.js';
import { applyResearchCompletion } from '../services/research.js';
import {
  instrumentLevels,
  levelOf,
  rememberVisitedWorld,
  rememberWorld,
  resolveProbe,
} from '../services/intel.js';
import {
  LEAD_TOLERANCE,
  inboundRadarLead,
  interceptBefore,
  nextInboundRadarCheck,
  recheckRadarLegsForWorld,
  wakeStrategicInterceptions,
} from '../services/radar.js';
import { resolveMiningArrival, resolveMiningReturn } from '../services/mining.js';
import { announceUnlocks, notify } from '../services/notifications.js';
import {
  publicDominionLeader,
  publicPlanetIdentity,
  recordGalaxyEvent,
} from '../services/chronicle.js';
import { publish, publishShard, publishStrategicSight } from '../stream/bus.js';
import { fleetChangesWatch, publishWatchChanges } from '../services/watchEvents.js';
import { wipeAllServers } from '../services/servers.js';
import { schedule, type EventRow } from './queue.js';
import {
  applyDeathStarStrike,
  endOccupation,
  endRecovery,
  finishDeathStarBuild,
} from '../services/strategic.js';
import { resolveSettlement, resolveTransfer } from '../services/movement.js';
import { safeHomePlanet } from '../services/ownership.js';
import {
  reinforceNeutral,
  resolveNeutralBattle,
  returnAttackUntouched,
} from '../services/neutral.js';
import { applyBuildCompletion } from '../services/buildQueue.js';
import { allocateClanLoot, recordClanBattleScore } from '../services/clanLoot.js';
import { resolveClanAid } from '../services/clanAid.js';
import { processGalaxyEventLifecycle } from '../services/galaxyEvents.js';

export interface HandlerContext {
  db: Db;
  clock: Clock;
}

export type Handler = (ctx: HandlerContext, event: EventRow) => Promise<void>;

/**
 * Claim a mission for resolution, exactly once.
 *
 * Returns null if another worker already resolved it. This is what makes event
 * handling idempotent: an event delivered twice does nothing the second time,
 * so a crashed-and-retried worker cannot double-resolve a battle.
 */
async function claimMission(tx: Tx, missionId: string) {
  const rows = await tx
    .update(missions)
    .set({ status: 'resolved' })
    .where(and(eq(missions.id, missionId), eq(missions.status, 'in_flight')))
    .returning();
  return rows[0] ?? null;
}

async function ledgerOf(tx: Tx, playerId: string): Promise<Ledger & { id: string }> {
  const [row] = await tx.select().from(players).where(eq(players.id, playerId));
  if (!row) throw new Error(`player ${playerId} vanished`);
  return { id: row.id, taken: row.dominionTaken, lost: row.dominionLost };
}

async function saveLedger(tx: Tx, ledger: Ledger & { id: string }): Promise<void> {
  await tx
    .update(players)
    .set({ dominionTaken: ledger.taken, dominionLost: ledger.lost })
    .where(eq(players.id, ledger.id));
}

/* ── mission arrival ────────────────────────────────────────── */

/**
 * An attacking fleet lands.
 *
 * Everything below happens in ONE transaction: combat, loot, disruption, both
 * ledgers, the report, and the return leg. Either all of it happened or none of
 * it did — there is no state in which a fleet has fought but not come home.
 */
export const onMissionArrival: Handler = async ({ db, clock }, event) => {
  const missionId = event.refId;
  if (!missionId) throw new Error('mission_arrival without refId');

  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    const mission = await claimMission(tx, missionId);
    if (!mission) return; // already resolved by another worker

    /**
     * THE WHOLE GALAXY WATCHES A FLIGHT END. D53.
     *
     * Every branch below ends a leg that somebody else could see: a raid resolving
     * into a debris field, a probe going home, a squadron landing. All of it is
     * public and all of it used to arrive on a twenty-second poll — which, for a
     * raid, meant the bombardment finished and the squadron then hung over the
     * world it had already destroyed until a timer happened along.
     *
     * Published on the CLAIM rather than at the end, for the reason the claim
     * exists: a redelivered event finds the mission already resolved, claims
     * nothing, returns here, and must not send three hundred clients to refetch a galaxy
     * that has not changed. And it is inside the transaction, so a resolution that
     * rolls back is never announced.
     */
    await publishShard(tx, mission.seasonId, 'arrival');
    if (fleetChangesWatch(mission.fleet)) {
      await publishWatchChanges(tx, [mission.originPlanetId, mission.targetPlanetId]);
    }

    // Every arrival may touch both endpoints; an acquisition also serializes on
    // its commander's immutable capital. Take all of them in one stable order.
    const [ownerCapital] = await tx
      .select({ id: planets.id })
      .from(planets)
      .where(and(
        eq(planets.controllerPlayerId, mission.ownerPlayerId),
        eq(planets.kind, 'CAPITAL'),
      ));
    const lockedPlanetIds = [...new Set([
      mission.originPlanetId,
      mission.targetPlanetId,
      ...(ownerCapital ? [ownerCapital.id] : []),
    ])].sort();
    for (const id of lockedPlanetIds) {
      await tx.select({ id: planets.id }).from(planets).where(eq(planets.id, id)).for('update');
    }

    if (mission.kind === 'death_star') {
      const [earlierImpact] = await tx
        .select({ id: missions.id })
        .from(missions)
        .where(and(
          eq(missions.kind, 'death_star'),
          eq(missions.status, 'in_flight'),
          eq(missions.targetPlanetId, mission.targetPlanetId),
          eq(missions.arriveAt, mission.arriveAt),
          sql`${missions.id} < ${mission.id}`,
        ))
        .limit(1);
      if (earlierImpact) {
        throw new Error(`death star ${mission.id} is waiting for ${earlierImpact.id}`);
      }
    }

    if (mission.kind === 'death_star') {
      const result = await applyDeathStarStrike(tx, mission, clock.now());
      // Core loss changes the drawn endpoint and may cap Radar/Telescope. Wake
      // every other inbound leg now so none keeps an obsolete crossing time.
      await recheckRadarLegsForWorld(tx, mission.targetPlanetId, clock.now());
      await wakeStrategicInterceptions(tx, mission.targetPlanetId, clock.now());
      const outcome = result.outcome;
      await tx.insert(strategicImpacts).values({
        seasonId: mission.seasonId,
        missionId: mission.id,
        attackerPlayerId: mission.ownerPlayerId,
        defenderPlayerId: result.previousPlayerId,
        targetPlanetId: mission.targetPlanetId,
        outcome,
        damage: result.damage,
        destroyedFleet: result.destroyedFleet,
        destroyedResources: result.destroyedResources,
        levelChanges: result.levelChanges,
        destroyedOrders: result.destroyedOrders,
        shieldDestroyed: result.shieldDestroyed,
        createdAt: clock.now(),
      }).onConflictDoNothing({ target: strategicImpacts.missionId });
      await tx
        .update(strategicAssets)
        .set({ status: 'CONSUMED' })
        .where(and(
          eq(strategicAssets.missionId, mission.id),
          eq(strategicAssets.status, 'LAUNCHED'),
        ));
      await notify(tx, {
        playerId: mission.ownerPlayerId,
        kind: 'death_star_result',
        payload: { outcome, targetPlanetId: mission.targetPlanetId },
        at: clock.now(),
        refId: mission.id,
      });
      if (outcome === 'CAPTURED') {
        await notify(tx, {
          playerId: mission.ownerPlayerId,
          kind: 'colony_captured',
          payload: { targetPlanetId: mission.targetPlanetId },
          at: clock.now(),
          refId: mission.id,
        });
      }
      if (result.previousPlayerId && result.previousPlayerId !== mission.ownerPlayerId) {
        await notify(tx, {
          playerId: result.previousPlayerId,
          kind: outcome === 'CAPTURED' ? 'colony_lost' : 'death_star_result',
          payload: { outcome, targetPlanetId: mission.targetPlanetId },
          at: clock.now(),
          refId: mission.id,
        });
      }
      const [impactWorld] = await tx
        .select({ name: planets.name, kind: planets.kind })
        .from(planets)
        .where(eq(planets.id, mission.targetPlanetId));
      if (impactWorld) {
        await recordGalaxyEvent(tx, {
          seasonId: mission.seasonId,
          kind: 'death_star_impact',
          refId: mission.id,
          subjectPlanetId: mission.targetPlanetId,
          payload: {
            planetName: impactWorld.name,
            outcome,
            capturable: impactWorld.kind !== 'CAPITAL',
          },
          occurredAt: clock.now(),
        });
      }
      if (outcome === 'CAPTURED') {
        const captured = await publicPlanetIdentity(tx, mission.targetPlanetId);
        if (captured) {
          await recordGalaxyEvent(tx, {
            seasonId: mission.seasonId,
            kind: 'control_transfer',
            refId: mission.id,
            subjectPlanetId: mission.targetPlanetId,
            payload: captured,
            occurredAt: clock.now(),
          });
        }
      }

      /**
       * AND THE CRAFT SAW THE WORLD IT REACHED. D151.
       *
       * Written AFTER the strike rather than before it, so the record is the world
       * the weapon LEFT: two Core levels down, the dome gone, and — on a capture —
       * flying the striker's own flag. On a capture it is immediately redundant,
       * because a world you hold resolves; on every other outcome it is the only
       * place the crater's owner learns what their own weapon did.
       */
      await rememberVisitedWorld(tx, {
        observerPlayerId: mission.ownerPlayerId,
        targetPlanetId: mission.targetPlanetId,
        seasonId: mission.seasonId,
        seenAt: clock.now(),
      });

      await publishShard(tx, mission.seasonId, outcome === 'CAPTURED' ? 'control' : 'impact');
      return;
    }

    if (mission.kind === 'transfer') {
      const outcome = await resolveTransfer(tx, mission, clock.now());
      if (outcome !== 'DELIVERED') {
        const [target] = await tx
          .select({ name: planets.name })
          .from(planets)
          .where(eq(planets.id, mission.targetPlanetId));
        await notify(tx, {
          playerId: mission.ownerPlayerId,
          kind: 'fleet_returned',
          payload: {
            trip: 'transfer_rerouted',
            reason: outcome === 'REROUTED_CAPACITY' ? 'CAPACITY' : 'OWNERSHIP',
            craft: fleetCount(mission.fleet),
            targetPlanetId: mission.targetPlanetId,
            targetPlanetName: target?.name ?? 'an unknown world',
          },
          at: clock.now(),
          refId: mission.id,
        });
      }
      await publishShard(tx, mission.seasonId, 'transfer');
      return;
    }

    if (mission.kind === 'clan_transfer') {
      await resolveClanAid(tx, mission, clock.now());
      await publishShard(tx, mission.seasonId, 'transfer');
      return;
    }

    if (mission.kind === 'settlement') {
      const outcome = await resolveSettlement(tx, mission, clock.now());
      await notify(tx, {
        playerId: mission.ownerPlayerId,
        kind: outcome === 'CAPTURED' ? 'settlement_success' : 'settlement_lost',
        payload: { targetPlanetId: mission.targetPlanetId },
        at: clock.now(),
        refId: mission.id,
      });
      if (outcome === 'CAPTURED') {
        const captured = await publicPlanetIdentity(tx, mission.targetPlanetId);
        if (captured) {
          await recordGalaxyEvent(tx, {
            seasonId: mission.seasonId,
            kind: 'control_transfer',
            refId: mission.id,
            subjectPlanetId: mission.targetPlanetId,
            payload: captured,
            occurredAt: clock.now(),
          });
        }
      }
      /**
       * AND THE SETTLERS SAW THE ROCK THEY REACHED. D151.
       *
       * The interesting outcome here is the one that FAILED. A settlement whose
       * claim window closed under it is rerouted home having flown all the way to
       * a world somebody else now holds — and "who beat me to it" is precisely the
       * question the commander is left with. On a capture this is inert, because a
       * world you hold resolves without any record at all.
       *
       * A `transfer` and a `clan_transfer` are deliberately NOT here: one lands on
       * your own world and the other on a teammate's, whose identity and worlds
       * D114 already publishes live to the whole clan. Neither is a look at
       * anything the fog was hiding.
       */
      await rememberVisitedWorld(tx, {
        observerPlayerId: mission.ownerPlayerId,
        targetPlanetId: mission.targetPlanetId,
        seasonId: mission.seasonId,
        seenAt: clock.now(),
      });

      await publishShard(tx, mission.seasonId, outcome === 'CAPTURED' ? 'control' : 'transfer');
      return;
    }

    if (mission.kind === 'return') {
      // A return leg travels BACKWARDS: its origin is the planet that was raided
      // and its target is the attacker's home, which is where the ships live.
      await settleReturn(tx, mission, mission.targetPlanetId, clock.now());
      return;
    }

    if (mission.kind === 'probe') {
      /**
       * A probe coming home.
       *
       * Nothing is measured on this leg — the snapshot was taken when it arrived.
       * All that happens here is that the answer becomes readable, which is the
       * point of making it fly back at all: the intel is a round trip, so scouting
       * is a commitment rather than a purchase.
       */
      if (mission.parentMissionId) {
        const deliveredAt = clock.now();
        const [delivered] = await tx
          .update(probeReports)
          .set({ deliveredAt })
          .where(and(
            eq(probeReports.missionId, mission.parentMissionId),
            isNull(probeReports.deliveredAt),
          ))
          .returning();
        // Nothing came back means a redelivery of an event already handled; the
        // report was marked delivered the first time and its owner already told.
        if (!delivered) return;

        if (delivered.silhouette) {
          await rememberWorld(tx, {
            observerPlayerId: delivered.observerPlayerId,
            targetPlanetId: delivered.targetPlanetId,
            seasonId: mission.seasonId,
            source: 'PROBE',
            reportId: delivered.id,
            silhouette: delivered.silhouette,
            // The record is what the probe SAW at the far world, not when the
            // return craft finally reached home. `createdAt` is that observation
            // instant; `deliveredAt` only gates when the player may read it.
            seenAt: delivered.createdAt,
          });
        }

        /**
         * THE INTEL HAS LANDED, AND SAYING SO IS THE POINT. D45.
         *
         * This branch used to set a timestamp and stop. A probe is the most
         * deliberate purchase in the game — alloy, a flight bay, a round trip, and
         * the risk of being caught — and the moment its answer became readable was
         * the one moment nothing was published: no notification, no stream event,
         * so not even the intel panel refreshed for a player who had it open.
         * "The information is the game", and the information arrived in silence.
         */
        const scouted = await identityOfPlanet(tx, delivered.targetPlanetId);
        await notify(tx, {
          playerId: delivered.observerPlayerId,
          kind: 'probe_report',
          payload: {
            targetPlanetId: delivered.targetPlanetId,
            targetUsername: scouted?.username ?? 'someone',
            targetPlanetName: scouted?.planetName ?? 'an unknown world',
            ...(scouted?.clanTag ? { targetClanTag: scouted.clanTag } : {}),
            // Their radar caught it. The intel screen says so too; this is the
            // first time the player finds out, and it decides whether they are
            // expected.
            detected: delivered.detected,
          },
          at: deliveredAt,
          refId: mission.parentMissionId,
        });
        return;
      }

      /*
        Seeded from the mission id like combat, so a report — and whether it was
        detected — can be re-derived from its inputs.

        The BEARING is not read here any more. `resolveProbe` writes it to
        `scan_events`, which is the row `readRadarLog` gates from Radar L2; it used
        to be copied into the notification payload as well, where nothing gated it
        at all. One fact, one surface, one gate.
      */
      const { detected } = await resolveProbe(
        tx,
        mission,
        clock.now(),
        seededFrom(missionId),
      );
      if (detected) {
        const [target] = await tx
          .select()
          .from(planets)
          .where(eq(planets.id, mission.targetPlanetId));
        if (target?.controllerPlayerId) {
          /**
           * THE BEARING IS NOT IN THIS PAYLOAD, AND IT USED TO BE.
           *
           * The comment here said the bearing was carried and "what the player is
           * shown is decided at read time by their radar level". The read-time
           * gate was never written: `/api/notifications` returns `payload` raw, so
           * a Radar 1 defender could read the compass direction straight off the
           * API while `readRadarLog` — the surface that SELLS it from L2 — was
           * carefully returning null. Fog enforced in the UI is not enforced.
           *
           * It is not redacted here either, because there is nothing to redact:
           * the bearing belongs to the radar log, which is gated correctly and is
           * where the notification already sends the reader. One fact, one surface,
           * one gate. `scan_events` still records it for that log.
           */
          await notify(tx, {
            playerId: target.controllerPlayerId,
            kind: 'scan_detected',
            payload: {},
            at: clock.now(),
            refId: missionId,
          });
          // "Was someone poking at me?" — the feeling that opens the Radar, and
          // the one that opens the Veil. Design Law #2.
          await announceUnlocks(tx, target.controllerPlayerId, clock.now());
        }
      }

      // The trip home. Symmetric, because a probe is the same craft going the
      // other way — and it is scheduled inside the same transaction as the
      // snapshot, so a report can never exist with no way to reach its owner.
      const home = travelExact(mission.distance, PROBE.speed);
      const backAt = addMinutes(clock.now(), home);
      const [ret] = await tx
        .insert(missions)
        .values({
          seasonId: mission.seasonId,
          kind: 'probe',
          ownerPlayerId: mission.ownerPlayerId,
          originPlanetId: mission.targetPlanetId,
          targetPlanetId: mission.originPlanetId,
          fleet: {},
          distance: mission.distance,
          departAt: clock.now(),
          arriveAt: backAt,
          parentMissionId: mission.id,
        })
        .returning();
      await schedule(tx, {
        seasonId: mission.seasonId,
        kind: 'mission_arrival',
        refId: ret!.id,
        resolveAt: backAt,
      });
      return;
    }

    const [targetWorld] = await tx
      .select({
        kind: planets.kind,
        recoveryUntil: planets.recoveryUntil,
        protectedUntil: planets.protectedUntil,
      })
      .from(planets)
      .where(eq(planets.id, mission.targetPlanetId));
    if (!targetWorld) throw new Error('attack target vanished');
    if (
      (targetWorld.recoveryUntil !== null && targetWorld.recoveryUntil > clock.now())
      || (targetWorld.protectedUntil !== null && targetWorld.protectedUntil > clock.now())
    ) {
      await returnAttackUntouched(tx, mission, clock);
      /**
       * AND THE CRAFT SAW THE WORLD IT REACHED. D151.
       *
       * A squadron that finds a shield standing and turns round still CROSSED the
       * distance and still sat in that orbit. It is also the arrival where the
       * record matters most: "it was protected" is the answer to "why did nothing
       * happen", and a map that went on showing a pre-flight snapshot would leave
       * the commander with no way to reach it.
       */
      await rememberVisitedWorld(tx, {
        observerPlayerId: mission.ownerPlayerId,
        targetPlanetId: mission.targetPlanetId,
        seasonId: mission.seasonId,
        seenAt: clock.now(),
      });
      return;
    }
    if (targetWorld.kind === 'NEUTRAL') {
      await resolveNeutralBattle(tx, mission, clock);
      /**
       * AND THE CRAFT SAW THE WORLD IT REACHED. D151.
       *
       * A rock is a world like any other here: the fleet was there, and what it
       * found — the tier's development, the claim window it may just have opened —
       * is what the disc has to draw until somebody looks again.
       */
      await rememberVisitedWorld(tx, {
        observerPlayerId: mission.ownerPlayerId,
        targetPlanetId: mission.targetPlanetId,
        seasonId: mission.seasonId,
        seenAt: clock.now(),
      });
      return;
    }

    const defender = await loadLocked(tx, mission.targetPlanetId, clock);
    const attackerHomeId = await safeHomePlanet(tx, mission.ownerPlayerId, mission.originPlanetId);
    const attackerOrbit = await orbitOf(tx, attackerHomeId);

    const attackingFleet = await fleetOfMission(tx, mission.originPlanetId, missionId);
    if (fleetCount(attackingFleet) === 0) return;

    // Fighting hulls at home plus the emplacements, and the mining craft in
    // neither. `garrisonOf` is the single definition every battle surface reads.
    /*
      TWO SIDES, TWO MOMENTS. T8 · T9.

      The attacker's ladders were snapshotted onto the mission when they committed
      it; the defender's are read now, at the fight. An attacker who finished a
      doctrine mid-flight does not get it, and a defender who did does — which is
      the only reading under which each figure belongs to a decision somebody
      actually made.
    */
    const attackerTech = mission.tech ?? {};
    const defenderTech = await techOf(tx, defender.playerId);
    const defenders = garrisonOf(defender.homeFleet, defender.ground);
    // Seeded from the mission id: any report can be re-derived from its inputs,
    // which makes battles auditable and bug reports reproducible.
    const result = resolveCombat(
      attackingFleet, defenders, defender.shield, seededFrom(missionId),
      { attacker: { tech: attackerTech }, defender: { tech: defenderTech } },
    );

    // Defender: survivors, plus whatever salvages out of the wreckage.
    const defenderHome: Fleet = {};
    for (const [hull, standing] of fleetEntries(defender.homeFleet)) {
      /**
       * A CRAFT THAT NEVER ENTERED THE BATTLE IS CARRIED ACROSS BY HAND.
       *
       * It is absent from `defenderSurvivors` because it was absent from the
       * defending line, and `?? 0` reads that absence as annihilation — so the
       * change that stops a raid killing miners would, without this branch,
       * delete every one of them on every raid instead. The rule and its
       * bookkeeping have to move together.
       */
      defenderHome[hull] = NON_COMBATANT_HULLS.includes(hull)
        ? standing
        : result.defenderSurvivors[hull] ?? 0;
    }
    for (const [hull] of fleetEntries(defender.ground)) {
      defenderHome[hull] =
        (result.defenderSurvivors[hull] ?? 0) + (result.defenceSalvage[hull] ?? 0);
    }
    await setUnits(tx, defender.planetId, defenderHome, 'home');

    /**
     * Two piles, two exposures (D16).
     *
     * Storage is taken in full above the vault floor; ore still uncollected in the
     * works is taken at `COMBAT.lootBufferShare` and the vault does not reach it at
     * all. `computeLoot` reports the split precisely because this code has to debit
     * two different columns — deriving one from the other would silently overdraw
     * whichever pile happened to be smaller.
     */
    const exposedStock = {
      alloy: defender.alloy,
      crystal: defender.crystal,
      deuterium: defender.deuterium,
    };
    const exposedBuffer = {
      alloy: defender.bufferAlloy,
      crystal: defender.bufferCrystal,
      deuterium: defender.bufferDeuterium,
    };
    const vaultFloor = vaultProtects(
      defender.buildings.VAULT,
      defender.buildings.REFINERY,
      defender.buildings.EXTRACTOR,
      defender.buildings.DEUTERIUM_PLANT,
    );
    const loot = computeLoot(
      exposedStock,
      exposedBuffer,
      vaultFloor,
      result.grade,
      // The ATTACKER's holds: it is their fleet carrying it home. T8.
      fleetCargo(result.attackerSurvivors, attackerTech),
    );
    /**
     * Dense Fuel Cells is discovered by a real PvP lesson, not a counter. D94.
     * Re-price the same exposed piles with effectively unlimited cargo; if more
     * was legally available than came home, cargo capacity changed the outcome.
     * This remains true even when proportional rounding leaves one unit unused.
     */
    const uncappedLoot = computeLoot(
      exposedStock,
      exposedBuffer,
      vaultFloor,
      result.grade,
      Number.MAX_SAFE_INTEGER,
    );
    const cargoLimited =
      uncappedLoot.alloy + uncappedLoot.crystal + uncappedLoot.deuterium
      > loot.alloy + loot.crystal + loot.deuterium;
    const shieldAbsorbed = result.rounds.reduce((sum, round) => sum + round.shieldAbsorbed, 0);

    const disruptedUntilMinutes = applyDisruption(
      defender.disruptedUntil ? minutesSince(defender.seasonStart, defender.disruptedUntil) : 0,
      defender.nowMinutes,
      result.grade,
    );

    await saveResources(tx, defender.planetId, {
      alloy: defender.alloy - loot.fromStock.alloy,
      crystal: defender.crystal - loot.fromStock.crystal,
      deuterium: defender.deuterium - loot.fromStock.deuterium,
      bufferAlloy: defender.bufferAlloy - loot.fromBuffer.alloy,
      bufferCrystal: defender.bufferCrystal - loot.fromBuffer.crystal,
      bufferDeuterium: defender.bufferDeuterium - loot.fromBuffer.deuterium,
      shield: result.shieldLeft,
      disruptedUntil:
        disruptedUntilMinutes > defender.nowMinutes
          ? atMinute(defender.seasonStart, disruptedUntilMinutes)
          : defender.disruptedUntil,
    });

    const attackerLedger = await ledgerOf(tx, mission.ownerPlayerId);
    const defenderLedger = await ledgerOf(tx, defender.playerId);
    const leaderBefore = await publicDominionLeader(tx, mission.seasonId);
    const before = attackerLedger.taken - attackerLedger.lost;
    const defenderBefore = defenderLedger.taken - defenderLedger.lost;
    bookBattle(
      attackerLedger,
      defenderLedger,
      loot.alloy + loot.crystal + loot.deuterium,
      result,
    );
    // Measured from the ledger itself rather than recomputed, so the report can
    // never disagree with the ladder about what a battle was worth.
    const dominionSwing = attackerLedger.taken - attackerLedger.lost - before;
    const defenderDominionSwing = defenderLedger.taken - defenderLedger.lost - defenderBefore;
    await saveLedger(tx, attackerLedger);
    await saveLedger(tx, defenderLedger);
    await recordClanBattleScore(tx, {
      missionId: mission.id,
      seasonId: mission.seasonId,
      attackerDelta: dominionSwing,
      defenderDelta: defenderDominionSwing,
      at: defender.now,
    });
    if (
      Math.round(before) !== Math.round(attackerLedger.taken - attackerLedger.lost)
      || Math.round(defenderBefore) !== Math.round(defenderLedger.taken - defenderLedger.lost)
    ) {
      await publishShard(tx, mission.seasonId, 'score');
    }

    /**
     * PRICED HERE RATHER THAN AT THE INSERT BELOW, SO THE REPORT CAN CARRY IT.
     *
     * It is a pure function of the two loss lists, so computing it early moves
     * nothing: the debris row still uses this same figure a few lines down. What
     * it buys is a report that can say what the fight left in orbit — which is
     * the one consequence of a battle that belongs to whoever gets there first.
     */
    const wreckValue =
      (flyingValue(result.attackerLosses) + flyingValue(result.defenderLosses)) * DEBRIS.share;

    await tx.insert(battleReports).values({
      seasonId: mission.seasonId,
      missionId,
      attackerPlayerId: mission.ownerPlayerId,
      defenderPlayerId: defender.playerId,
      targetPlanetId: defender.planetId,
      targetKind: 'PLAYER',
      grade: result.grade,
      rounds: result.rounds,
      // Totals only: the split is for debiting the defender, not for the record.
      loot: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
      attackerLosses: result.attackerLosses,
      defenderLosses: result.defenderLosses,
      // The two rosters that were on the board. Each side is shown only its own.
      attackerFleet: attackingFleet,
      defenderFleet: defenders,
      defenceSalvage: result.defenceSalvage,
      /*
        THE DOWNTIME STANDING AFTER THIS BATTLE, from its own instant — never the
        absolute deadline, which is meaningless once the report is an hour old.

        ZERO WHENEVER THE GRADE CAUSED NONE, and that guard is not decorative.
        `applyDisruption` returns the EXISTING deadline untouched when a grade adds
        nothing, so a raid REPELLED by a world that was already offline from an
        earlier raid would have stored that leftover figure — and the defender's own
        report would have read "your works were knocked offline for two hours" about
        an attack they had just beaten.
      */
      disruptedMinutes: disruptionMinutes(result.grade) === 0
        ? 0
        : Math.max(0, disruptedUntilMinutes - defender.nowMinutes),
      // Below `DEBRIS.minimum` no field is written at all, so the report says
      // none rather than advertising wreckage nobody can fly out and collect.
      wreckValue: wreckValue >= DEBRIS.minimum ? wreckValue : 0,
      cargoLimited,
      shieldAbsorbed,
      dominionSwing,
      createdAt: defender.now,
    });

    // The attacking stack is gone from the origin either way; survivors become a
    // new return mission, and the dead simply cease to exist.
    /**
     * THE WRECKAGE. D32.
     *
     * A share of every non-ground hull destroyed on BOTH sides, left at the
     * defender's coordinates for anyone to come and take. Ground units are excluded
     * because they already have `defenceSalvage` — counting them here would return
     * about 85% of a defender's losses and make a fortress profit from being
     * attacked.
     *
     * `!HULLS[id].ground` rather than `MOBILE_HULLS` membership, and the filter
     * stays that way even though a Prospector no longer defends: it is the LOSSES
     * that are priced here, and a craft that was never in the line never appears
     * in them. Narrowing this to `MOBILE_HULLS` would drop a hull the day one is
     * added that is neither ground nor attack-legal.
     *
     * WEALTH, NEVER DOMINION. Nothing here touches a ledger — wreckage was not
     * taken FROM anybody, so crediting it to the ladder would create score from
     * nothing and break the zero-sum guarantee D2 rests on.
     *
     * `wreckValue` is priced above the battle report, which carries the same figure.
     */
    let wreckFieldId: string | null = null;
    if (wreckValue >= DEBRIS.minimum) {
      // Split the way the hulls were priced, so each recovered material keeps the
      // composition of the craft that actually died.
      const alloyRaw = flyingAlloy(result.attackerLosses) + flyingAlloy(result.defenderLosses);
      const crystalRaw =
        flyingCrystal(result.attackerLosses) + flyingCrystal(result.defenderLosses);
      const deuteriumRaw =
        flyingDeuterium(result.attackerLosses) + flyingDeuterium(result.defenderLosses);
      const totalRaw = flyingValue(result.attackerLosses) + flyingValue(result.defenderLosses);
      const [wreck] = await tx
        .insert(debrisFields)
        .values({
          seasonId: mission.seasonId,
          planetId: defender.planetId,
          // Stored beside the anchor, so a void field and a world field are read
          // through the same three columns. D150.
          x: defender.x,
          y: defender.y,
          z: defender.z,
          missionId,
          alloy: totalRaw > 0 ? wreckValue * (alloyRaw / totalRaw) : 0,
          crystal: totalRaw > 0 ? wreckValue * (crystalRaw / totalRaw) : 0,
          deuterium: totalRaw > 0 ? wreckValue * (deuteriumRaw / totalRaw) : 0,
          createdAt: defender.now,
        })
        .returning({ id: debrisFields.id });
      wreckFieldId = wreck?.id ?? null;
    }

    await clearMissionUnits(tx, mission.originPlanetId, missionId);

    if (fleetCount(result.attackerSurvivors) > 0) {
      /**
       * THE BEACON APPLIES TO THE TRIP HOME TOO. D25 said "out and back".
       *
       * `launchAttack` passes `fleetSpeedMult(origin.orbit)`; this called the
       * two-argument form, so `boost` defaulted to 1 and a raid flew out 1.3× faster
       * and came home at walking pace. The satellite costs 11,000 alloy and 3,500
       * crystal, the card copy promises the round trip, and `packages/sim` already
       * prices the return leg WITH the multiplier — so the simulator was valuing a
       * benefit the server did not deliver, which is the mirror image of the
       * standing rule that it must not price what it refuses to simulate.
       *
       * It reads the ATTACKER's orbit, which is where the beacon is. Reading the
       * mission's own origin would be wrong on a return leg: a return row is stored
       * with its two ends swapped (D28), so `originPlanetId` is the world that was
       * raided.
       */
      const home = fleetTravelExact(
        mission.distance,
        result.attackerSurvivors,
        fleetSpeedMult(attackerOrbit),
        attackerTech,
      );
      const arriveAt = addMinutes(defender.now, home);
      const [ret] = await tx
        .insert(missions)
        .values({
          seasonId: mission.seasonId,
          kind: 'return',
          ownerPlayerId: mission.ownerPlayerId,
          originPlanetId: mission.targetPlanetId,
          targetPlanetId: mission.originPlanetId,
          fleet: result.attackerSurvivors,
          loot: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
          tech: mission.tech,
          distance: mission.distance,
          departAt: defender.now,
          arriveAt,
          // Links safely docked loot back to the immutable D114 launch roster.
          parentMissionId: mission.id,
        })
        .returning();
      await setUnits(
        tx,
        mission.originPlanetId,
        result.attackerSurvivors,
        ret!.id,
        mission.ownerPlayerId,
      );
      await schedule(tx, {
        seasonId: mission.seasonId,
        kind: 'mission_arrival',
        refId: ret!.id,
        resolveAt: arriveAt,
      });
    }

    // A raid moves stock and destroys units on both sides, so both Wealth figures
    // are stale the moment it resolves — and Wealth gates who may attack whom.
    await recomputeWealth(tx, defender.planetId);
    await recomputePlayerWealth(tx, mission.ownerPlayerId);

    const [attackerIdentity, defenderIdentity] = await Promise.all([
      identityOfPlanet(tx, attackerHomeId),
      identityOfPlanet(tx, defender.planetId),
    ]);

    if (defenderIdentity) {
      await recordGalaxyEvent(tx, {
        seasonId: mission.seasonId,
        kind: 'bombardment',
        refId: missionId,
        subjectPlanetId: defender.planetId,
        payload: {
          planetName: defenderIdentity.planetName,
          commanderName: defenderIdentity.username,
        },
        occurredAt: defender.now,
      });
      if (wreckFieldId) {
        await recordGalaxyEvent(tx, {
          seasonId: mission.seasonId,
          kind: 'wreck_formed',
          refId: wreckFieldId,
          subjectPlanetId: defender.planetId,
          payload: {
            planetName: defenderIdentity.planetName,
            commanderName: defenderIdentity.username,
          },
          occurredAt: defender.now,
        });
      }
    }

    const leaderAfter = await publicDominionLeader(tx, mission.seasonId);
    if (leaderAfter && leaderAfter.planetId !== leaderBefore?.planetId) {
      await recordGalaxyEvent(tx, {
        seasonId: mission.seasonId,
        kind: 'dominion_leader',
        refId: missionId,
        subjectPlanetId: leaderAfter.planetId,
        payload: {
          planetName: leaderAfter.planetName,
          commanderName: leaderAfter.commanderName,
        },
        occurredAt: defender.now,
      });
    }

    /**
     * BOTH SIDES ARE TOLD. D45.
     *
     * Only the defender used to be. An attacker learned the outcome of their own
     * raid when the survivors got home carrying the loot — and if there were no
     * survivors there was nothing to come home, so the single most expensive thing
     * that can happen to a player produced no notification, no stream event, and
     * therefore not even a refetch: they watched the bombardment and the screen
     * simply never changed. Measured, on a fleet annihilated by ground defence.
     *
     * The battle report has always held the detail. What was missing was anybody
     * being told it exists.
     */
    await notify(tx, {
      playerId: defender.playerId,
      kind: 'raided',
      payload: {
        ...(attackerIdentity
          ? {
              originPlanetId: attackerHomeId,
              originUsername: attackerIdentity.username,
              originPlanetName: attackerIdentity.planetName,
              ...(attackerIdentity.clanTag
                ? { originClanTag: attackerIdentity.clanTag }
                : {}),
            }
          : {}),
        grade: result.grade,
        lootAlloy: loot.alloy,
        lootCrystal: loot.crystal,
        lootDeuterium: loot.deuterium,
        unitsLost: fleetCount(result.defenderLosses),
        // What holding the line cost them. Already in the defender's own battle
        // report, so this reveals nothing new — it lets "you repelled a raid" say
        // what the raid paid, which is the difference between a fact and a result.
        theirLosses: fleetCount(result.attackerLosses),
        /**
         * HOW LONG THE WORKS ARE DOWN — THE THING THAT ACTUALLY HAPPENED.
         *
         * Without this the notification could only report the two figures that
         * were often zero, and on a live shard that is exactly how it read: a
         * commander raided six times in an evening was told "−0 taken · 0 units
         * lost" six times, because the vault floor makes a poor planet unlootable
         * and an undefended one loses no units. Nothing in the line was false and
         * nothing in it was the point — every one of those raids had knocked their
         * production offline for the disruption window.
         *
         * Sent as minutes FROM NOW rather than as an instant, because that is what
         * the sentence says and it cannot then drift as the row ages: a
         * notification is a record of a moment, not a live countdown. The planet
         * view carries `disruptedUntil` for the countdown.
         */
        disruptedMinutes: Math.max(0, disruptedUntilMinutes - defender.nowMinutes),
      },
      at: defender.now,
      refId: missionId,
    });

    await notify(tx, {
      playerId: mission.ownerPlayerId,
      kind: 'raid_result',
      payload: {
        grade: result.grade,
        targetPlanetId: defender.planetId,
        targetUsername: defenderIdentity?.username ?? 'someone',
        targetPlanetName: defender.name,
        ...(defenderIdentity?.clanTag ? { targetClanTag: defenderIdentity.clanTag } : {}),
        lootAlloy: loot.alloy,
        lootCrystal: loot.crystal,
        lootDeuterium: loot.deuterium,
        unitsLost: fleetCount(result.attackerLosses),
        shipsHome: fleetCount(result.attackerSurvivors),
        dominion: dominionSwing,
      },
      at: defender.now,
      refId: missionId,
    });

    // "Where did his fleet go?" — the first battle, won or lost, is what opens the
    // Telescope; being on the receiving end is what opens the Radar. Design Law #2,
    // which until now was computed and never announced to anyone.
    /**
     * AND THE CRAFT SAW THE WORLD IT REACHED. D151.
     *
     * THE CASE THE WHOLE DECISION WAS ABOUT. A commander who has just fought over
     * a world knows whose flag is on it, how developed it is and what is in its
     * orbit — and until D151 the map refused to keep any of it, so the disc went
     * on drawing a probe record from three owners ago. The defender gets nothing
     * from this: sight is bought by GOING somewhere, and being attacked tells you
     * who came, never what their home looks like.
     */
    await rememberVisitedWorld(tx, {
      observerPlayerId: mission.ownerPlayerId,
      targetPlanetId: mission.targetPlanetId,
      seasonId: mission.seasonId,
      seenAt: defender.now,
    });

    await announceUnlocks(tx, mission.ownerPlayerId, defender.now);
    await announceUnlocks(tx, defender.playerId, defender.now);
  });
};

/** A surviving fleet reaches home: ships rejoin the garrison, loot lands in the vault. */

/**
 * Resource value of the hulls in a fleet that are NOT ground emplacements.
 *
 * Derived from `Hull.ground` rather than from `MOBILE_HULLS`, which excludes the
 * Prospector — and a Prospector at home is part of the defence and really can be
 * destroyed. A destroyed ship is wreckage whatever it was built for; the only
 * exclusion the rule wants is the one that already has a salvage mechanism.
 */
const flyingValue = (fleet: Fleet): number =>
  fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground)
    .reduce(
      (sum, [id, n]) =>
        sum + n * (HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium),
      0,
    );

const flyingAlloy = (fleet: Fleet): number =>
  fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground)
    .reduce((sum, [id, n]) => sum + n * HULLS[id].alloy, 0);

const flyingCrystal = (fleet: Fleet): number =>
  fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground)
    .reduce((sum, [id, n]) => sum + n * HULLS[id].crystal, 0);

const flyingDeuterium = (fleet: Fleet): number =>
  fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground)
    .reduce((sum, [id, n]) => sum + n * HULLS[id].deuterium, 0);

async function settleReturn(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  homePlanetId: string,
  at: Date,
): Promise<void> {
  // The mission's original home may have changed controller while the fleet was
  // away. Ownership follows `mission.ownerPlayerId`; delivery follows that
  // commander's still-owned world, falling back to the immutable capital.
  const storagePlanetId = homePlanetId;
  const destinationPlanetId = await safeHomePlanet(tx, mission.ownerPlayerId, homePlanetId);
  const returning = await fleetOfMission(tx, storagePlanetId, mission.id);
  const home = await loadLockedHome(tx, destinationPlanetId);

  const merged: Fleet = { ...home.fleet };
  for (const [hull, n] of fleetEntries(returning)) {
    merged[hull] = (merged[hull] ?? 0) + n;
  }
  await clearMissionUnits(tx, storagePlanetId, mission.id);
  await setUnits(tx, destinationPlanetId, merged, 'home', mission.ownerPlayerId);

  const landedLoot = mission.loot ? await allocateClanLoot(tx, mission, at) : null;
  if (landedLoot) {
    await tx
      .update(planets)
      .set({
        alloy: sql`${planets.alloy} + ${landedLoot.alloy}`,
        crystal: sql`${planets.crystal} + ${landedLoot.crystal}`,
        deuterium: sql`${planets.deuterium} + ${deuteriumOf(landedLoot)}`,
      })
      .where(eq(planets.id, destinationPlanetId));
  }

  await recomputeWealth(tx, destinationPlanetId);

  const [planet] = await tx.select().from(planets).where(eq(planets.id, destinationPlanetId));
  if (planet?.controllerPlayerId === mission.ownerPlayerId) {
    // A return leg flies backwards, so the world it came FROM is its origin.
    const from = await identityOfPlanet(tx, mission.originPlanetId);
    await notify(tx, {
      playerId: mission.ownerPlayerId,
      kind: 'fleet_returned',
      payload: {
        // THE DISCRIMINANT. D45. Three different things come home under this one
        // kind and the client has to tell them apart before it can read a single
        // field — a mining run's payload has no `ships` in it and never did.
        trip: 'raid',
        ships: fleetCount(returning),
        fromPlanetId: mission.originPlanetId,
        fromUsername: from?.username ?? null,
        fromPlanetName: from?.planetName ?? null,
        ...(from?.clanTag ? { fromClanTag: from.clanTag } : {}),
        lootAlloy: landedLoot?.alloy ?? 0,
        lootCrystal: landedLoot?.crystal ?? 0,
        lootDeuterium: landedLoot ? deuteriumOf(landedLoot) : 0,
      },
      at,
      refId: mission.id,
    });
  }
}

async function loadLockedHome(tx: Tx, planetId: string): Promise<{ fleet: Fleet }> {
  const rows = await tx
    .select()
    .from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
  const fleet: Fleet = {};
  for (const r of rows) if (r.count > 0) fleet[r.hull] = r.count;
  return { fleet };
}

/* ── radar warning ──────────────────────────────────────────── */

/**
 * "Incoming fleet · lands in 9 min."
 *
 * The highest-value notification in the game: it converts a passive loss into an
 * active decision, because the player can still spend their stock, launch their
 * own fleet out, or stand and fight.
 *
 * THE DEFENDER'S RADAR IS READ HERE, AT THE MOMENT OF FIRING. D45.
 *
 * It used to be read at launch and frozen into the event's payload, which broke
 * the ladder in both directions:
 *
 *   · A defender with no radar had no event scheduled at all, so installing one
 *     while a fleet was in the air bought nothing — while `pendingThreads`, which
 *     reads the live level, put "inbound fleet" on their strip. One fact, two
 *     surfaces, opposite answers.
 *   · A defender who went Radar 3 → 5 mid-flight was warned with an L3 payload:
 *     no size, no composition, for a rung they had already paid for.
 *
 * Every raid now schedules one warning at the widest crossing any radar could
 * catch it at, and this handler hops down `RADAR_RANGES` until the reach the
 * defender has actually earned matches where the fleet actually is. D9 is
 * untouched: the warning still fires when the fleet crosses in, never at launch,
 * and a wider reach can never be bought retroactively — a radar installed with the
 * fleet already four minutes out warns at four minutes.
 *
 * D49 TURNED THE RUNGS FROM MINUTES INTO DISTANCES. The conversion back to a
 * warning instant uses the exact visual leg, including surface departure and
 * orbital arrival, because that is the only way the drawn shell and alert agree.
 */
export const onRadarWarning: Handler = async ({ db, clock }, event) => {
  const missionId = event.refId;
  if (!missionId) throw new Error('radar_warning without refId');

  await db.transaction(async (tx) => {
    const [mission] = await tx.select().from(missions).where(eq(missions.id, missionId));
    // Nothing to warn about if it already landed or was somehow cancelled.
    if (mission?.status !== 'in_flight') return;

    const now = clock.now();
    const remaining = (mission.arriveAt.getTime() - now.getTime()) / 60_000;
    // Already over the target: the engagement window keeps the mission in flight
    // for ten more seconds, and a warning that arrives with the fleet is noise.
    if (remaining <= 0) return;

    const [target] = await tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId));
    if (!target) return;

    const [[origin], coreRows, levels] = await Promise.all([
      tx.select().from(planets).where(eq(planets.id, mission.originPlanetId)),
      tx.select({ planetId: buildings.planetId, level: buildings.level })
        .from(buildings)
        .where(and(
          inArray(buildings.planetId, [mission.originPlanetId, mission.targetPlanetId]),
          eq(buildings.type, 'CORE'),
        )),
      instrumentLevels(tx, [target.id]),
    ]);
    if (!origin) return;
    const radarLevel = levelOf(levels, target.id, 'RADAR');
    const coreByPlanet = new Map(coreRows.map((row) => [row.planetId, row.level]));
    /**
     * The whole leg, so a reach in units can be turned into minutes of notice.
     *
     * The endpoints and current public Core tiers define the same shortened leg
     * the client draws. The warning fires when the visible fleet crosses the shell.
     */
    const oneWay = (mission.arriveAt.getTime() - mission.departAt.getTime()) / 60_000;
    const leg = {
      from: { x: origin.x, y: origin.y, z: origin.z },
      to: { x: target.x, y: target.y, z: target.z },
      originCoreLevel: coreByPlanet.get(origin.id) ?? 1,
      targetCoreLevel: coreByPlanet.get(target.id) ?? 1,
      oneWayMinutes: oneWay,
    };
    const lead = inboundRadarLead(radarRange(radarLevel), leg);

    /**
     * Not yet — or never.
     *
     * `TOLERANCE` absorbs the sub-second gap between the instant this was
     * scheduled for and the instant the worker actually claimed it. Without it a
     * check armed for `arriveAt − 12` that fires 40 ms late reads 11.999 minutes
     * remaining against a 12-minute lead, decides the defender has not earned it,
     * and silently demotes a Radar 5 warning to the 8-minute rung.
     */
    if (lead <= 0 || remaining > lead + LEAD_TOLERANCE) {
      const next = nextInboundRadarCheck(remaining, leg);
      if (next !== null) {
        await schedule(tx, {
          seasonId: mission.seasonId,
          kind: 'radar_warning',
          refId: missionId,
          resolveAt: addMinutes(mission.arriveAt, -inboundRadarLead(next, leg)),
        });
      }
      return;
    }

    if (!target.controllerPlayerId) return;
    /*
      AND NEVER BOTH THINGS AT ONCE. T10.

      The interception resolves first and closes the mission, so by the time this
      runs a destroyed weapon is no longer `in_flight` — but redelivery can bring
      this handler back with a stale row in hand. Telling a defender that something
      is coming, beside the news that it is already wreckage, is the interface
      contradicting itself at the one moment it matters most.
    */
    const [live] = await tx
      .select({ status: missions.status })
      .from(missions)
      .where(eq(missions.id, missionId));
    if (live?.status !== 'in_flight') return;
    await notify(tx, {
      playerId: target.controllerPlayerId,
      kind: mission.kind === 'death_star' ? 'strategic_incoming' : 'incoming_fleet',
      payload: {
        /**
         * THE INSTANT, not only the countdown. D39, applied to a notification.
         *
         * `etaMinutes` is measured from the moment this row was written, so a
         * notification read an hour later still claimed "ETA 12 min" — a live
         * countdown frozen at the moment it stopped being true. The client reads
         * `arriveAt` against its own clock and puts the line into the past tense
         * once the fleet has landed. The defender already has this instant on
         * their pending strip; the radar ladder sells whether and how early you
         * are warned, never the precision of the clock.
         */
        arriveAt: mission.arriveAt.toISOString(),
        etaMinutes: Math.max(0, Math.round(remaining)),
        /**
         * WHICH OF THE DEFENDER'S WORLDS IT IS AIMED AT.
         *
         * Not a radar product — the radar ladder sells the ATTACKER's side, and
         * this is the recipient's own world. It was missing, so a commander with
         * four worlds got "incoming, twelve minutes" and no way to know where to
         * move the garrison. The pending strip carries the same fact.
         */
        targetPlanetName: target.name,
        // L4 buys a coarse mass band. Exact composition (and therefore any exact
        // count derivable from it) begins at L5.
        ...(radarLevel >= 4 ? { mass: massClass(mission.fleet) } : {}),
        // A NAME, never the id. Every other L5 reveal in the game sends the
        // planet's name (`readRadarLog`); this one sent a raw uuid, which is why
        // nothing ever displayed it and L5 read exactly like L4.
        ...(radarRevealsOrigin(radarLevel)
          ? {
              fleet: mission.fleet,
              ...(await identityOfPlanet(tx, mission.originPlanetId).then((origin) =>
                origin
                  ? {
                      originPlanetId: mission.originPlanetId,
                      originUsername: origin.username,
                      originPlanetName: origin.planetName,
                      ...(origin.clanTag ? { originClanTag: origin.clanTag } : {}),
                    }
                  : {},
              )),
            }
          : {}),
      },
      at: now,
      refId: missionId,
    });
  });
};


async function identityOfPlanet(
  tx: Tx,
  planetId: string,
): Promise<{ username: string; planetName: string; clanTag: string | null } | undefined> {
  const [row] = await tx
    .select({
      username: accounts.displayName,
      planetName: planets.name,
      clanTag: clans.tag,
    })
    .from(planets)
    .innerJoin(players, eq(planets.controllerPlayerId, players.id))
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .leftJoin(
      clanMemberships,
      and(eq(clanMemberships.playerId, players.id), isNull(clanMemberships.leftAt)),
    )
    .leftJoin(
      clans,
      and(eq(clans.id, clanMemberships.clanId), isNull(clans.disbandedAt)),
    )
    .where(eq(planets.id, planetId));
  return row;
}

/**
 * A squadron meets its rock. D19.
 *
 * The whole claim happens inside one transaction under a lock on the claim row,
 * which is what makes the race honest: two squadrons landing in the same second
 * are serialised, and the second reads a total that already includes the first.
 */
export const onMiningArrival: Handler = async ({ db }, event) => {
  const runId = event.refId;
  if (!runId) throw new Error('mining_arrival without refId');
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    // Replay the meeting at the instant the queue promised, not when a delayed
    // worker happened to wake up. `resolveMiningArrival` derives ore decay,
    // claim timestamps and the whole return leg from this value; using wall time
    // here charged every minute of server downtime to the player's flight.
    await resolveMiningArrival(tx, runId, event.resolveAt);
  });
};

/** A squadron gets home and unloads into storage. */
export const onMiningReturn: Handler = async ({ db, clock }, event) => {
  const runId = event.refId;
  if (!runId) throw new Error('mining_return without refId');
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    const delivered = await resolveMiningReturn(tx, runId, clock);
    if (!delivered) return; // already settled by another worker

    const [run] = await tx.select().from(miningRuns).where(eq(miningRuns.id, runId));
    if (!run) return;
    const [planet] = await tx.select().from(planets).where(eq(planets.id, run.planetId));
    if (!planet) return;

    await recomputeWealth(tx, run.planetId);
    /**
     * Reuses `fleet_returned` rather than inventing a kind: from the player's side
     * this IS craft coming home with cargo.
     *
     * IT CARRIES `trip`, AND THAT IS NOT COSMETIC. D45. This payload named its
     * discriminant `kind`, which collided with the notification's own `kind`, and
     * it shared none of its fields with the raid payload the client parsed. So the
     * parse failed on every single mining and harvest return and the client fell
     * back to "Your fleet is home." — no ore, no waste, nothing. A drill flew for
     * forty minutes and reported a sentence.
     *
     * `wasted` is the part that matters most and the part that had never once been
     * displayed: ore mined and then thrown away because the works were already
     * full is exactly the lesson D31 exists to teach, and it was being taught in
     * silence.
     */
    if (!planet.controllerPlayerId) return;
    await notify(tx, {
      playerId: planet.controllerPlayerId,
      kind: 'fleet_returned',
      payload: {
        trip: run.debrisFieldId === null ? 'mining' : 'harvest',
        craft: delivered.craft,
        alloy: Math.round(delivered.delivered.alloy),
        crystal: Math.round(delivered.delivered.crystal),
        deuterium: Math.round(delivered.delivered.deuterium),
        wastedAlloy: Math.round(delivered.wasted.alloy),
        wastedCrystal: Math.round(delivered.wasted.crystal),
        wastedDeuterium: Math.round(delivered.wasted.deuterium),
      },
      at: clock.now(),
      refId: runId,
    });
  });
};

/** Publish an act at its scheduled instant, even if a worker claims it slightly late. */
export const onSeasonAct: Handler = async ({ db }, event) => {
  const act = SEASON.actBoundaries.find(
    (candidate) => event.payload?.act === candidate.id,
  );
  if (!act || event.refId !== event.seasonId) throw new Error('season_act has invalid input');
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    await recordGalaxyEvent(tx, {
      seasonId: event.seasonId,
      kind: 'season_act',
      refId: `${event.seasonId}:${act.id}`,
      subjectPlanetId: null,
      payload: { act: act.id },
      occurredAt: event.resolveAt,
    });
  });
};

/* ── season freeze ─────────────────────────────────────────── */

/** Freeze one galaxy and preserve the identity/story that survives its world. D85. */
export const onSeasonEnd: Handler = async ({ db, clock }, event) => {
  const seasonId = event.refId ?? event.seasonId;
  if (seasonId !== event.seasonId) throw new Error('season_end refId does not match its season');

  await db.transaction(async (tx) => {
    const [season] = await tx
      .select()
      .from(seasons)
      .where(eq(seasons.id, seasonId))
      .for('update');
    if (!season || season.status === 'frozen' || season.status === 'wiped') return;
    if (season.status !== 'live') throw new Error(`season ${seasonId} is ${season.status}`);
    if (clock.now().getTime() < season.endsAt.getTime()) {
      throw new Error(`season_end for ${seasonId} fired before endsAt`);
    }

    // Recovery guard for pre-D85 rows and same-instant worker ordering. Delete
    // this processing event and replace it atomically; EventWorker's later
    // `complete()` update simply finds no old row.
    const [[missionCount], [miningCount], [buildCount], [strategicCount]] = await Promise.all([
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(missions)
        .where(and(eq(missions.seasonId, seasonId), eq(missions.status, 'in_flight'))),
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(miningRuns)
        .where(and(eq(miningRuns.seasonId, seasonId), ne(miningRuns.status, 'done'))),
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(buildOrders)
        .innerJoin(planets, eq(planets.id, buildOrders.planetId))
        .where(and(eq(planets.seasonId, seasonId), eq(buildOrders.status, 'BUILDING'))),
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(strategicAssets)
        .innerJoin(planets, eq(planets.id, strategicAssets.planetId))
        .where(and(
          eq(planets.seasonId, seasonId),
          inArray(strategicAssets.status, ['BUILDING', 'PAUSED']),
        )),
    ]);
    if (
      (missionCount?.n ?? 0) > 0
      || (miningCount?.n ?? 0) > 0
      || (buildCount?.n ?? 0) > 0
      || (strategicCount?.n ?? 0) > 0
    ) {
      await tx.delete(scheduledEvents).where(eq(scheduledEvents.id, event.id));
      await schedule(tx, {
        seasonId,
        kind: 'season_end',
        refId: seasonId,
        resolveAt: new Date(clock.now().getTime() + 1_000),
      });
      return;
    }

    const roster = await tx
      .select({
        playerId: players.id,
        accountId: players.accountId,
        joinedAt: players.joinedAt,
        taken: players.dominionTaken,
        lost: players.dominionLost,
        commanderName: accounts.displayName,
        planetName: planets.name,
      })
      .from(players)
      .innerJoin(accounts, eq(players.accountId, accounts.id))
      .innerJoin(
        planets,
        and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')),
      )
      .where(eq(players.seasonId, seasonId));
    const [reports, impacts, clanRows, membershipRows] = await Promise.all([
      tx.select().from(battleReports).where(eq(battleReports.seasonId, seasonId)),
      tx.select().from(strategicImpacts).where(eq(strategicImpacts.seasonId, seasonId)),
      tx.select({
        id: clans.id,
        name: clans.name,
        tag: clans.tag,
        taken: clans.dominionTaken,
        lost: clans.dominionLost,
        createdAt: clans.createdAt,
      }).from(clans).where(and(eq(clans.seasonId, seasonId), isNull(clans.disbandedAt))),
      tx.select({ playerId: clanMemberships.playerId, clanId: clanMemberships.clanId })
        .from(clanMemberships)
        .where(and(eq(clanMemberships.seasonId, seasonId), isNull(clanMemberships.leftAt))),
    ]);
    const identity = new Map(roster.map((row) => [row.playerId, row]));
    const ranked = [...roster].sort((a, b) =>
      Math.round(b.taken - b.lost) - Math.round(a.taken - a.lost)
      || a.joinedAt.getTime() - b.joinedAt.getTime()
      || a.playerId.localeCompare(b.playerId));
    const rankedClans = [...clanRows].sort((a, b) =>
      Math.round(b.taken - b.lost) - Math.round(a.taken - a.lost)
      || a.createdAt.getTime() - b.createdAt.getTime()
      || a.id.localeCompare(b.id));
    const clanRecapById = new Map(rankedClans.map((clan, index) => [clan.id, {
      name: clan.name,
      tag: clan.tag,
      finalRank: index + 1,
      dominion: Math.round(clan.taken - clan.lost),
      topThree: index < 3,
    }]));
    const clanIdByPlayer = new Map(membershipRows.map((membership) => [
      membership.playerId,
      membership.clanId,
    ]));

    const [shard] = await tx.select().from(shards).where(eq(shards.id, season.shardId));
    const shardLabel = shard?.name === ''
      ? shard.code
      : (shard?.name ?? shard?.code ?? 'the galaxy');
    const values = ranked.map((player, index) => {
      const mine = reports.filter((report) => report.targetKind === 'PLAYER' && (
        report.attackerPlayerId === player.playerId || report.defenderPlayerId === player.playerId
      ));
      const rivalCounts = new Map<string, number>();
      let damageDealt = 0;
      let damageTaken = 0;
      let attacks = 0;
      let defences = 0;
      let biggest: { value: number; opponentName: string } | null = null;
      for (const report of mine) {
        const attacking = report.attackerPlayerId === player.playerId;
        const opponentId = attacking ? report.defenderPlayerId : report.attackerPlayerId;
        if (opponentId === null) continue;
        rivalCounts.set(opponentId, (rivalCounts.get(opponentId) ?? 0) + 1);
        if (attacking) {
          attacks++;
          damageDealt += fleetValue(report.defenderLosses);
          damageTaken += fleetValue(report.attackerLosses);
          const value = report.loot.alloy + report.loot.crystal + deuteriumOf(report.loot);
          const opponentName = identity.get(opponentId)?.commanderName ?? 'Unknown commander';
          if (!biggest || value > biggest.value) biggest = { value, opponentName };
        } else {
          defences++;
          damageDealt += fleetValue(report.attackerLosses);
          damageTaken += fleetValue(report.defenderLosses);
        }
      }
      for (const impact of impacts) {
        if (impact.attackerPlayerId === player.playerId) damageDealt += impact.damage;
        if (impact.defenderPlayerId === player.playerId) damageTaken += impact.damage;
      }
      const rivalEntry = [...rivalCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      const rival = rivalEntry
        ? { commanderName: identity.get(rivalEntry[0])?.commanderName ?? 'Unknown commander', battles: rivalEntry[1] }
        : null;
      const dominion = player.taken - player.lost;
      const finalRank = index + 1;
      const title = finalRank === 1
        ? `Sovereign of ${shardLabel}`
        : finalRank <= 3 ? 'Vanguard' : dominion > 0 ? 'Conqueror' : 'Commander';
      const playerClanId = clanIdByPlayer.get(player.playerId);
      const clan = playerClanId ? clanRecapById.get(playerClanId) ?? null : null;
      return {
        seasonId,
        accountId: player.accountId,
        finalRank,
        dominion,
        damageDealt,
        damageTaken,
        rivalName: rival?.commanderName ?? null,
        biggestRaid: biggest?.value ?? 0,
        title,
        recap: {
          commanderName: player.commanderName,
          planetName: player.planetName,
          battles: mine.length,
          attacks,
          defences,
          rival,
          biggestRaid: biggest,
          clan,
        },
        createdAt: clock.now(),
      };
    });
    if (values.length > 0) {
      await tx.insert(seasonResults).values(values).onConflictDoNothing();
    }
    await tx.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, seasonId));
    await publishShard(tx, seasonId, 'season');
  });
};

/** Fifteen minutes after the snapshot, replace every galaxy in one commit. D88. */
export const onSeasonRollover: Handler = async ({ db, clock }, event) => {
  const seasonId = event.refId ?? event.seasonId;
  if (seasonId !== event.seasonId) {
    throw new Error('season_rollover refId does not match its season');
  }

  const result = await wipeAllServers(
    db,
    clock,
    {
      // A predecessor row records what that season admitted. It must never pin
      // the next world to a legacy 50-seat cap or resurrect retired ordinals.
      count: SERVERS.count,
      capacity: SERVERS.capacity,
    },
    { eventSeasonId: seasonId, requireAllFrozen: true },
  );
  if (!result.deferred) return;

  // A late season-end event must finish first. Replace this claimed event rather
  // than mutating it back to pending; `complete()` then safely finds no old row.
  await db.transaction(async (tx) => {
    const [source] = await tx
      .select({ status: seasons.status })
      .from(seasons)
      .where(eq(seasons.id, seasonId))
      .for('update');
    if (!source || source.status === 'wiped') return;
    await tx.delete(scheduledEvents).where(eq(scheduledEvents.id, event.id));
    await schedule(tx, {
      seasonId,
      kind: 'season_rollover',
      refId: seasonId,
      resolveAt: new Date(clock.now().getTime() + 1_000),
    });
  });
};

export const onDeathStarReady: Handler = async ({ db }, event) => {
  if (!event.refId || typeof event.payload?.expectedReadyAt !== 'string') return;
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    const ready = await finishDeathStarBuild(tx, event.refId!, event.payload!.expectedReadyAt as string);
    const planetId = ready[0]?.planetId;
    if (!planetId) return;
    if (ready[0]?.type === 'INTERCEPTOR') {
      await wakeStrategicInterceptions(tx, planetId, new Date(event.payload!.expectedReadyAt as string));
    }
    const [world] = await tx
      .select({ playerId: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, planetId));
    if (world?.playerId) await publish(tx, world.playerId, 'death_star_ready');
  });
};

export const onBuildComplete: Handler = async ({ db, clock }, event) => {
  if (!event.refId || typeof event.payload?.expectedReadyAt !== 'string') return;
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    const applied = await applyBuildCompletion(
      tx,
      event.refId!,
      event.payload!.expectedReadyAt as string,
      clock,
    );
    if (!applied) {
      // Migration 0047 keeps legacy completion events on their old enum value:
      // PostgreSQL cannot use a newly-added enum value until the migration
      // transaction commits. The migrated research row retains the same id and
      // expected instant, so this one-release bridge completes it safely.
      const research = await applyResearchCompletion(
        tx,
        event.refId!,
        event.payload!.expectedReadyAt as string,
        clock,
      );
      if (research) await publish(tx, research.playerId, 'research_complete');
      return;
    }
    const [owner] = await tx
      .select({ playerId: planets.controllerPlayerId })
      .from(buildOrders)
      .innerJoin(planets, eq(planets.id, buildOrders.planetId))
      .where(eq(buildOrders.id, event.refId!));
    // The absolute timer wakes an open planet screen. This event reconciles the
    // worker race and also reaches an owner who was looking elsewhere at the time.
    if (owner?.playerId) await publish(tx, owner.playerId, 'build_complete');
  });
};

export const onResearchComplete: Handler = async ({ db, clock }, event) => {
  if (!event.refId || typeof event.payload?.expectedReadyAt !== 'string') return;
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    const applied = await applyResearchCompletion(
      tx,
      event.refId!,
      event.payload!.expectedReadyAt as string,
      clock,
    );
    if (applied) await publish(tx, applied.playerId, 'research_complete');
  });
};

export const onRecoveryEnd: Handler = async ({ db, clock }, event) => {
  if (!event.refId || typeof event.payload?.expectedUntil !== 'string') return;
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    if (await endRecovery(tx, event.refId!, event.payload!.expectedUntil as string, clock.now())) {
      await publishShard(tx, event.seasonId, 'recovery');
    }
  });
};

export const onOccupationEnd: Handler = async ({ db }, event) => {
  if (!event.refId || typeof event.payload?.expectedUntil !== 'string') return;
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    if (await endOccupation(tx, event.refId!, event.payload!.expectedUntil as string)) {
      await publishShard(tx, event.seasonId, 'protection');
    }
  });
};

export const onNeutralReinforce: Handler = async ({ db, clock }, event) => {
  if (!event.refId || typeof event.payload?.expectedAt !== 'string') return;
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    const [state] = await tx
      .select({ next: neutralPlanetState.nextReinforcementAt })
      .from(neutralPlanetState)
      .where(eq(neutralPlanetState.planetId, event.refId!));
    if (state?.next?.getTime() !== new Date(event.payload!.expectedAt as string).getTime()) {
      return;
    }
    const next = await reinforceNeutral(tx, event.refId!, clock.now());
    if (next) {
      await schedule(tx, {
        seasonId: event.seasonId,
        kind: 'neutral_reinforce',
        refId: event.refId!,
        payload: { expectedAt: next.toISOString() },
        resolveAt: next,
      });
      await publishShard(tx, event.seasonId, 'world');
    }
  });
};

/**
 * A strategic weapon may be engaged in exactly two ways:
 *
 *   1. the TARGET world's effective Radar is L3+ and the weapon has crossed that
 *      Radar rung; L1/L2 deliberately have no interception circle;
 *   2. the weapon is IDENTIFIED by the Telescope sight of ANY world controlled by
 *      the defender.
 *
 * A ready charge still belongs to the target world. Seeing a weapon from a colony
 * does not teleport that colony's ammunition to the capital.
 */
export const onStrategicIntercept: Handler = async ({ db, clock }, event) => {
  const missionId = event.refId;
  if (!missionId) throw new Error('strategic_intercept without refId');

  await db.transaction(async (tx) => {
    const [mission] = await tx
      .select()
      .from(missions)
      .where(eq(missions.id, missionId))
      .for('update');
    if (mission?.status !== 'in_flight' || mission.kind !== 'death_star') return;

    const now = clock.now();
    const remaining = (mission.arriveAt.getTime() - now.getTime()) / 60_000;
    // Already over the target: the strike is resolving and there is nothing to stop.
    if (remaining <= 0) return;

    const [target] = await tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId));
    // A caretaker world has no commander, no research and nothing to fire.
    if (!target?.controllerPlayerId) return;

    const [ownedWorlds, [origin]] = await Promise.all([
      tx.select({
        id: planets.id,
        x: planets.x,
        y: planets.y,
        z: planets.z,
      }).from(planets).where(eq(planets.controllerPlayerId, target.controllerPlayerId)),
      tx.select().from(planets).where(eq(planets.id, mission.originPlanetId)),
    ]);
    if (!origin) return;

    const worldIds = [...new Set([
      mission.originPlanetId,
      mission.targetPlanetId,
      ...ownedWorlds.map((world) => world.id),
    ])];
    const [coreRows, levels] = await Promise.all([
      tx.select({ planetId: buildings.planetId, level: buildings.level })
        .from(buildings)
        .where(and(inArray(buildings.planetId, worldIds), eq(buildings.type, 'CORE'))),
      instrumentLevels(tx, worldIds),
    ]);

    const coreByPlanet = new Map(coreRows.map((row) => [row.planetId, row.level]));
    const originPoint = { x: origin.x, y: origin.y, z: origin.z };
    const targetPoint = { x: target.x, y: target.y, z: target.z };
    const timedLeg = {
      from: originPoint,
      to: targetPoint,
      originCoreLevel: coreByPlanet.get(origin.id) ?? 1,
      targetCoreLevel: coreByPlanet.get(target.id) ?? 1,
      oneWayMinutes: (mission.arriveAt.getTime() - mission.departAt.getTime()) / 60_000,
    };
    const drawnLeg = visualLeg(
      originPoint,
      targetPoint,
      surfaceStandoff(worldRadius(timedLeg.originCoreLevel)),
      orbitStandoff(worldRadius(timedLeg.targetCoreLevel)),
    );
    const totalMs = Math.max(1, mission.arriveAt.getTime() - mission.departAt.getTime());
    const progress = (now.getTime() - mission.departAt.getTime()) / totalMs;
    const currentPoint = pointAlong(drawnLeg.from, drawnLeg.to, progress);

    // `interceptionRange` is zero at L1/L2. Do not replace this with the wider
    // contact radius: detection and anti-strategic engagement are separate rules.
    const reach = interceptionRange(levelOf(levels, target.id, 'RADAR'));
    const radarLead = reach > 0 ? inboundRadarLead(reach, timedLeg) : 0;
    const radarEligible = radarLead > 0 && remaining <= radarLead + LEAD_TOLERANCE;
    const telescopeSpheres = ownedWorlds.flatMap((world) => {
      const telescope = levelOf(levels, world.id, 'TELESCOPE');
      // The general sight model has a naked-eye floor for drawing nearby craft.
      // This rule explicitly requires Telescope sight, so no installed/effective
      // Telescope means no optical interception sphere.
      return telescope <= 0 ? [] : [sensorSphere(
        { x: world.x, y: world.y, z: world.z },
        telescope,
        0,
        world.id,
      )];
    });
    // The crossing solver resolves to milliseconds while positions are continuous.
    // One game unit is less than a second on this leg and prevents an exact edge
    // from being rounded a fraction outside and then losing its only event.
    const telescopeEligible = telescopeSpheres.some(
      (sphere) => distance(sphere.at, currentPoint) <= sphere.identify + 1,
    );

    if (!radarEligible && !telescopeEligible) {
      const candidates: { at: Date; radar: boolean }[] = [];
      if (radarLead > 0) {
        const crossing = addMinutes(mission.arriveAt, -radarLead);
        if (crossing.getTime() > now.getTime()) candidates.push({ at: crossing, radar: true });
      }
      const remainingFraction = Math.max(0, 1 - Math.max(0, Math.min(1, progress)));
      for (const sphere of telescopeSpheres) {
        const fraction = sphereEntryFraction(currentPoint, drawnLeg.to, sphere.at, sphere.identify);
        if (fraction === null || fraction <= 0) continue;
        const at = new Date(now.getTime() + totalMs * remainingFraction * fraction);
        if (at.getTime() > now.getTime() && at.getTime() < mission.arriveAt.getTime()) {
          candidates.push({ at, radar: false });
        }
      }
      const next = candidates.toSorted((a, b) => a.at.getTime() - b.at.getTime())[0];
      if (next) {
        await schedule(tx, {
          seasonId: mission.seasonId,
          kind: 'strategic_intercept',
          refId: missionId,
          // Radar shares a boundary with its warning and must win that ordering.
          // Telescope has no competing siren and fires on the exact sight edge.
          resolveAt: next.radar ? interceptBefore(next.at) : next.at,
        });
      }
      return;
    }

    /*
      ONE CHARGE, AND EXACTLY ONE WEAPON MAY HAVE IT.

      Held FOR UPDATE and spent with a status guard, because two strikes crossing
      one defender's ring in the same moment are a designed play — the stockpile
      research exists to send two — and the queue is drained with `SKIP LOCKED` by a
      worker that production runs as its own service. Read without the lock, both
      handlers selected the same READY row and both wrote CONSUMED over it, and one
      charge killed two Death Stars. D139's whole balance is that a loaded defender
      stops the FIRST and the stockpile is the reply.

      The guarded update is what makes it safe even if the lock is ever lost: the
      second writer updates nothing, `returning()` comes back empty, and its own
      strike goes on to land.
    */
    const [charge] = await tx
      .select({ id: strategicAssets.id })
      .from(strategicAssets)
      .where(and(
        eq(strategicAssets.planetId, target.id),
        eq(strategicAssets.type, 'INTERCEPTOR'),
        eq(strategicAssets.status, 'READY'),
      ))
      .limit(1)
      .for('update');
    if (!charge) return;

    const spent = await tx
      .update(strategicAssets)
      .set({ status: 'CONSUMED', missionId })
      .where(and(
        eq(strategicAssets.id, charge.id),
        eq(strategicAssets.status, 'READY'),
      ))
      .returning({ id: strategicAssets.id });
    if (!spent[0]) return;
    const claimed = await tx
      .update(missions)
      .set({ status: 'resolved' })
      .where(and(eq(missions.id, missionId), eq(missions.status, 'in_flight')))
      .returning({ id: missions.id });
    if (!claimed[0]) return;
    await tx
      .update(strategicAssets)
      .set({ status: 'CONSUMED' })
      .where(and(eq(strategicAssets.missionId, missionId), eq(strategicAssets.type, 'DEATH_STAR')));

    /*
      FIRE IMMEDIATELY; LET THE FLIGHT PROVIDE THE REACTION WINDOW.

      Delaying launch would make a ready defence look inert and could let the
      Death Star arrive while its counter was deliberately waiting. The missile
      instead takes eight seconds to meet it. If a charge becomes ready inside
      those final eight seconds, clamp the cinematic to the remaining journey so
      the interception can never explode after the strike's original arrival.
    */
    const flightMs = Math.min(
      ANTI_STRATEGIC.flightSeconds * 1_000,
      mission.arriveAt.getTime() - now.getTime(),
    );
    const impactAt = new Date(now.getTime() + flightMs);
    const impactProgress = (impactAt.getTime() - mission.departAt.getTime()) / totalMs;
    const collision = pointAlong(drawnLeg.from, drawnLeg.to, impactProgress);
    await tx.insert(strategicInterceptions).values({
      seasonId: mission.seasonId,
      missionId,
      attackerPlayerId: mission.ownerPlayerId,
      defenderPlayerId: target.controllerPlayerId,
      targetPlanetId: target.id,
      chargeId: charge.id,
      trigger: radarEligible ? 'RADAR' : 'TELESCOPE',
      launchAt: now,
      impactAt,
      launchX: target.x,
      launchY: target.y,
      launchZ: target.z,
      deathStarFromX: currentPoint.x,
      deathStarFromY: currentPoint.y,
      deathStarFromZ: currentPoint.z,
      collisionX: collision.x,
      collisionY: collision.y,
      collisionZ: collision.z,
    });
    await schedule(tx, {
      seasonId: mission.seasonId,
      kind: 'strategic_intercept_impact',
      refId: missionId,
      resolveAt: impactAt,
    });

    /*
      THE LAUNCH INSTANT IS NOT A GALAXY-WIDE FACT. D139.

      A shard `impact` here told every connected commander that a hidden weapon
      had just been intercepted, eight seconds before the public Chronicle moment.
      Address the two participants and only effective-Telescope witnesses instead;
      each recipient still refetches in time to see the rocket leave the planet.
    */
    const witnessWorlds = await tx
      .select({
        id: planets.id,
        controllerPlayerId: planets.controllerPlayerId,
        x: planets.x,
        y: planets.y,
        z: planets.z,
      })
      .from(planets)
      .where(and(
        eq(planets.seasonId, mission.seasonId),
        isNotNull(planets.controllerPlayerId),
      ));
    const witnessLevels = await instrumentLevels(tx, witnessWorlds.map((world) => world.id));
    const audience = new Set([mission.ownerPlayerId, target.controllerPlayerId]);
    for (const world of witnessWorlds) {
      const telescope = levelOf(witnessLevels, world.id, 'TELESCOPE');
      if (telescope <= 0 || !world.controllerPlayerId) continue;
      const sight = sensorSphere({ x: world.x, y: world.y, z: world.z }, telescope, 0, world.id);
      if (distance(sight.at, collision) <= sight.identify) audience.add(world.controllerPlayerId);
    }
    for (const playerId of audience) await publishStrategicSight(tx, playerId);
  });
};

/** Finish the reserved interception collision and publish its durable history. */
export const onStrategicInterceptImpact: Handler = async ({ db, clock }, event) => {
  const missionId = event.refId;
  if (!missionId) throw new Error('strategic_intercept_impact without refId');

  await db.transaction(async (tx) => {
    const [interception] = await tx
      .update(strategicInterceptions)
      .set({ resolvedAt: clock.now() })
      .where(and(
        eq(strategicInterceptions.missionId, missionId),
        isNull(strategicInterceptions.resolvedAt),
      ))
      .returning();
    if (!interception) return;

    await tx.insert(strategicImpacts).values({
      seasonId: interception.seasonId,
      missionId,
      attackerPlayerId: interception.attackerPlayerId,
      defenderPlayerId: interception.defenderPlayerId,
      targetPlanetId: interception.targetPlanetId,
      outcome: 'INTERCEPTED',
      damage: 0,
      destroyedFleet: {},
    });

    const identity = await publicPlanetIdentity(tx, interception.targetPlanetId);
    const collision = {
      x: interception.collisionX,
      y: interception.collisionY,
      z: interception.collisionZ,
    };
    const targetPoint = {
      x: interception.launchX,
      y: interception.launchY,
      z: interception.launchZ,
    };
    const interceptionRangeAtImpact = distance(targetPoint, collision);
    await recordGalaxyEvent(tx, {
      seasonId: interception.seasonId,
      kind: 'strategic_intercept',
      refId: missionId,
      subjectPlanetId: interception.targetPlanetId,
      payload: {
        planetName: identity?.planetName ?? 'Unknown world',
        commanderName: identity?.commanderName ?? 'Unknown commander',
        range: interceptionRangeAtImpact,
        trigger: interception.trigger,
      },
      occurredAt: interception.impactAt,
    });
    for (const playerId of [interception.defenderPlayerId, interception.attackerPlayerId]) {
      await notify(tx, {
        playerId,
        kind: 'strategic_intercepted',
        refId: missionId,
        payload: {
          planetId: interception.targetPlanetId,
          defended: playerId === interception.defenderPlayerId,
          trigger: interception.trigger,
          range: interceptionRangeAtImpact,
        },
        at: interception.impactAt,
      });
    }
    await publishShard(tx, interception.seasonId, 'impact');
  });
};

export const onGalaxyEventStart: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('galaxy_event_start without refId');
  await processGalaxyEventLifecycle(db, {
    occurrenceId: event.refId,
    seasonId: event.seasonId,
    lifecycle: 'start',
    processedAt: clock.now(),
  });
};

export const onGalaxyEventEnd: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('galaxy_event_end without refId');
  await processGalaxyEventLifecycle(db, {
    occurrenceId: event.refId,
    seasonId: event.seasonId,
    lifecycle: 'end',
    processedAt: clock.now(),
  });
};

/**
 * A RAID REACHES ITS PIRATE. D150.
 *
 * A thin wrapper on purpose: everything about the fight — the lock order, the
 * damage row, the payout and the mutual-annihilation branch — lives in
 * `pirateRaid.ts` beside the launch that created the row, so the two halves of one
 * feature cannot drift apart in two files.
 */
export const onPirateArrival: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('pirate_arrival without refId');
  const raidId = event.refId;
  await db.transaction(async (tx) => {
    await resolvePirateArrival(tx, raidId, clock);
  });
};

export const onPirateReturn: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('pirate_return without refId');
  const raidId = event.refId;
  await db.transaction(async (tx) => {
    await resolvePirateReturn(tx, raidId, clock);
  });
};

/**
 * A CONVOY REACHES THE MERCHANT, AND COMES HOME AGAIN. D156.
 *
 * Thin wrappers on purpose, exactly like the pirate pair above: the dock clock,
 * the return leg and the delivery all live in `trade.ts` beside the launch that
 * created the row, so the two halves of one feature cannot drift apart in two
 * files. The clock is the injected one and never database ambient time (A13).
 */
export const onTradeArrival: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('trade_arrival without refId');
  const runId = event.refId;
  await db.transaction(async (tx) => {
    await resolveTradeArrival(tx, runId, clock);
  });
};

export const onTradeReturn: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('trade_return without refId');
  const runId = event.refId;
  await db.transaction(async (tx) => {
    await resolveTradeReturn(tx, runId, clock);
  });
};

export const HANDLERS: Partial<Record<EventRow['kind'], Handler>> = {
  mission_arrival: onMissionArrival,
  radar_warning: onRadarWarning,
  strategic_intercept: onStrategicIntercept,
  strategic_intercept_impact: onStrategicInterceptImpact,
  mining_arrival: onMiningArrival,
  mining_return: onMiningReturn,
  pirate_arrival: onPirateArrival,
  pirate_return: onPirateReturn,
  trade_arrival: onTradeArrival,
  trade_return: onTradeReturn,
  season_end: onSeasonEnd,
  season_rollover: onSeasonRollover,
  season_act: onSeasonAct,
  death_star_ready: onDeathStarReady,
  build_complete: onBuildComplete,
  research_complete: onResearchComplete,
  recovery_end: onRecoveryEnd,
  occupation_end: onOccupationEnd,
  neutral_reinforce: onNeutralReinforce,
  galaxy_event_start: onGalaxyEventStart,
  galaxy_event_end: onGalaxyEventEnd,
};
