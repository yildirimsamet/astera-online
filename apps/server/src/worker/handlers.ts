import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  PROBE,
  applyDisruption,
  bookBattle,
  computeLoot,
  deuteriumOf,
  fleetCargo,
  fleetCount,
  fleetEntries,
  fleetSpeedMult,
  fleetValue,
  fleetTravelExact,
  nextRadarCheck,
  radarLead,
  radarRange,
  radarRevealsOrigin,
  seededFrom,
  DEBRIS,
  HULLS,
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
  buildOrders,
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
import { instrumentLevels, levelOf, resolveProbe } from '../services/intel.js';
import { resolveMiningArrival, resolveMiningReturn } from '../services/mining.js';
import { announceUnlocks, notify } from '../services/notifications.js';
import {
  publicDominionLeader,
  publicPlanetIdentity,
  recordGalaxyEvent,
} from '../services/chronicle.js';
import { publish, publishShard } from '../stream/bus.js';
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
      await publishShard(tx, mission.seasonId, outcome === 'CAPTURED' ? 'control' : 'impact');
      return;
    }

    if (mission.kind === 'transfer') {
      await resolveTransfer(tx, mission, clock.now());
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
        const [delivered] = await tx
          .update(probeReports)
          .set({ deliveredAt: clock.now() })
          .where(eq(probeReports.missionId, mission.parentMissionId))
          .returning();
        // Nothing came back means a redelivery of an event already handled; the
        // report was marked delivered the first time and its owner already told.
        if (!delivered) return;

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
            // Their radar caught it. The intel screen says so too; this is the
            // first time the player finds out, and it decides whether they are
            // expected.
            detected: delivered.detected,
          },
          at: clock.now(),
          refId: mission.parentMissionId,
        });
        return;
      }

      // Seeded from the mission id like combat, so a report — and whether it was
      // detected — can be re-derived from its inputs.
      const { detected, bearing } = await resolveProbe(
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
          // Bearing is in the payload, but what the player is shown is decided at
          // read time by their radar level — never here.
          await notify(tx, {
            playerId: target.controllerPlayerId,
            kind: 'scan_detected',
            payload: { bearing },
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
      return;
    }
    if (targetWorld.kind === 'NEUTRAL') {
      await resolveNeutralBattle(tx, mission, clock);
      return;
    }

    const defender = await loadLocked(tx, mission.targetPlanetId, clock);
    const attackerHomeId = await safeHomePlanet(tx, mission.ownerPlayerId, mission.originPlanetId);
    const attackerOrbit = await orbitOf(tx, attackerHomeId);

    const attackingFleet = await fleetOfMission(tx, mission.originPlanetId, missionId);
    if (fleetCount(attackingFleet) === 0) return;

    const defenders: Fleet = { ...defender.homeFleet, ...defender.ground };
    // Seeded from the mission id: any report can be re-derived from its inputs,
    // which makes battles auditable and bug reports reproducible.
    const result = resolveCombat(attackingFleet, defenders, defender.shield, seededFrom(missionId));

    // Defender: survivors, plus whatever salvages out of the wreckage.
    const defenderHome: Fleet = {};
    for (const [hull] of fleetEntries(defender.homeFleet)) {
      defenderHome[hull] = result.defenderSurvivors[hull] ?? 0;
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
    );
    const loot = computeLoot(
      exposedStock,
      exposedBuffer,
      vaultFloor,
      result.grade,
      fleetCargo(result.attackerSurvivors),
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
    await saveLedger(tx, attackerLedger);
    await saveLedger(tx, defenderLedger);
    if (
      Math.round(before) !== Math.round(attackerLedger.taken - attackerLedger.lost)
      || Math.round(defenderBefore) !== Math.round(defenderLedger.taken - defenderLedger.lost)
    ) {
      await publishShard(tx, mission.seasonId, 'score');
    }

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
     * `!HULLS[id].ground` rather than `MOBILE_HULLS` membership: a Prospector
     * sitting at home is part of the defence and really does die, and it is
     * wreckage like anything else. `MOBILE_HULLS` excludes it and would silently
     * drop it.
     *
     * WEALTH, NEVER DOMINION. Nothing here touches a ledger — wreckage was not
     * taken FROM anybody, so crediting it to the ladder would create score from
     * nothing and break the zero-sum guarantee D2 rests on.
     */
    const wreckValue =
      (flyingValue(result.attackerLosses) + flyingValue(result.defenderLosses)) * DEBRIS.share;
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
          distance: mission.distance,
          departAt: defender.now,
          arriveAt,
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

  if (mission.loot) {
    await tx
      .update(planets)
      .set({
        alloy: sql`${planets.alloy} + ${mission.loot.alloy}`,
        crystal: sql`${planets.crystal} + ${mission.loot.crystal}`,
        deuterium: sql`${planets.deuterium} + ${deuteriumOf(mission.loot)}`,
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
        lootAlloy: mission.loot?.alloy ?? 0,
        lootCrystal: mission.loot?.crystal ?? 0,
        lootDeuterium: mission.loot ? deuteriumOf(mission.loot) : 0,
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
 * D49 TURNED THE RUNGS FROM MINUTES INTO DISTANCES, and the shape did not change
 * with them. Both are converted back to minutes-before-arrival by `radarLead`,
 * because that is the axis this event is scheduled on and the axis the mission row
 * can be read against.
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

    const levels = await instrumentLevels(tx, [target.id]);
    const radarLevel = levelOf(levels, target.id, 'RADAR');
    /**
     * The whole leg, so a reach in units can be turned into minutes of notice.
     *
     * `mission.distance` is stored at launch and `departAt`/`arriveAt` bound the
     * flight, so this is the same arithmetic the client draws the craft with — the
     * warning fires when the fleet the player can SEE crosses the circle.
     */
    const oneWay = (mission.arriveAt.getTime() - mission.departAt.getTime()) / 60_000;
    const lead = radarLead(radarRange(radarLevel), mission.distance, oneWay);

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
      const next = nextRadarCheck(remaining, mission.distance, oneWay);
      if (next !== null) {
        await schedule(tx, {
          seasonId: mission.seasonId,
          kind: 'radar_warning',
          refId: missionId,
          resolveAt: addMinutes(mission.arriveAt, -radarLead(next, mission.distance, oneWay)),
        });
      }
      return;
    }

    if (!target.controllerPlayerId) return;
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
        // Size is revealed only from Radar L4, exact composition only from L5.
        ...(radarLevel >= 4 ? { estimatedShips: fleetCount(mission.fleet) } : {}),
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

/**
 * Three seconds. Scheduling is exact; claiming a due event is not.
 *
 * IT WAS HALF A MINUTE, AND THAT STOPPED BEING A ROUNDING ERROR AT D63. The figure
 * exists to absorb the gap between the instant an event is scheduled for and the
 * instant a worker claims it — bounded by `WORKER_POLL_MS`, which is one second.
 * Half a minute was thirty times that even before hull speeds went up.
 *
 * Afterwards it was worse than generous, it was WRONG: Radar L3 buys 0.65 minutes
 * of warning on a long leg, so a tolerance of 0.5 was 77% of the entire lead and
 * every rung of the ladder fired at a visibly wider circle than it sold. An L3
 * defender was getting most of L4's warning, which is the ladder — the thing the
 * radar is actually sold on — quietly collapsing.
 *
 * Three seconds is three poll intervals. It still absorbs every claim delay the
 * queue can produce and is no longer a meaningful share of any lead the ladder
 * sells.
 */
const LEAD_TOLERANCE = 0.05;

async function identityOfPlanet(
  tx: Tx,
  planetId: string,
): Promise<{ username: string; planetName: string } | undefined> {
  const [row] = await tx
    .select({ username: accounts.displayName, planetName: planets.name })
    .from(planets)
    .innerJoin(players, eq(planets.controllerPlayerId, players.id))
    .innerJoin(accounts, eq(players.accountId, accounts.id))
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
export const onMiningArrival: Handler = async ({ db, clock }, event) => {
  const runId = event.refId;
  if (!runId) throw new Error('mining_arrival without refId');
  await db.transaction(async (tx) => {
    await lockSeason(tx, event.seasonId);
    await resolveMiningArrival(tx, runId, clock.now());
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
    const [reports, impacts] = await Promise.all([
      tx.select().from(battleReports).where(eq(battleReports.seasonId, seasonId)),
      tx.select().from(strategicImpacts).where(eq(strategicImpacts.seasonId, seasonId)),
    ]);
    const identity = new Map(roster.map((row) => [row.playerId, row]));
    const ranked = [...roster].sort((a, b) =>
      Math.round(b.taken - b.lost) - Math.round(a.taken - a.lost)
      || a.joinedAt.getTime() - b.joinedAt.getTime()
      || a.playerId.localeCompare(b.playerId));

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
    if (!applied) return;
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

export const HANDLERS: Partial<Record<EventRow['kind'], Handler>> = {
  mission_arrival: onMissionArrival,
  radar_warning: onRadarWarning,
  mining_arrival: onMiningArrival,
  mining_return: onMiningReturn,
  season_end: onSeasonEnd,
  season_rollover: onSeasonRollover,
  season_act: onSeasonAct,
  death_star_ready: onDeathStarReady,
  build_complete: onBuildComplete,
  recovery_end: onRecoveryEnd,
  occupation_end: onOccupationEnd,
  neutral_reinforce: onNeutralReinforce,
};
