import { and, eq, sql } from 'drizzle-orm';
import {
  applyDisruption,
  bookBattle,
  computeLoot,
  fleetCargo,
  fleetCount,
  fleetEntries,
  fleetTravelMinutes,
  seededFrom,
  resolveCombat,
  vaultProtects,
  type Fleet,
  type Ledger,
} from '@blindspace/rules';
import { addMinutes, atMinute, minutesSince, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  battleReports,
  missions,
  notifications,
  planets,
  players,
  units,
} from '../db/schema.js';
import { loadLocked, recomputeWealth, saveResources, setUnits } from '../services/planet.js';
import { clearMissionUnits, fleetOfMission } from '../services/mission.js';
import { resolveProbe } from '../services/intel.js';
import { schedule, type EventRow } from './queue.js';
import { publish } from '../stream/bus.js';

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

async function notify(
  tx: Tx,
  playerId: string,
  kind: typeof notifications.$inferInsert.kind,
  payload: Record<string, unknown>,
  at: Date,
): Promise<void> {
  // `at` comes from the injected clock, never from the database's now(). There is
  // exactly one clock in this system; letting defaultNow() supply timestamps put a
  // second one in, and the "while you were gone" window silently never closed.
  await tx.insert(notifications).values({ playerId, kind, payload, createdAt: at });
  // NOTIFY is transactional — it fires on COMMIT and is discarded on rollback, so
  // a client can never be told about a battle that was subsequently undone.
  await publish(tx, playerId, kind);
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
    const mission = await claimMission(tx, missionId);
    if (!mission) return; // already resolved by another worker

    // Ascending id order, always — two planets raiding each other simultaneously
    // would otherwise deadlock.
    const [firstId, secondId] =
      mission.originPlanetId < mission.targetPlanetId
        ? [mission.originPlanetId, mission.targetPlanetId]
        : [mission.targetPlanetId, mission.originPlanetId];
    await loadLocked(tx, firstId, clock);
    await loadLocked(tx, secondId, clock);

    if (mission.kind === 'return') {
      // A return leg travels BACKWARDS: its origin is the planet that was raided
      // and its target is the attacker's home, which is where the ships live.
      await settleReturn(tx, mission, mission.targetPlanetId, clock.now());
      return;
    }

    if (mission.kind === 'probe') {
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
        if (target) {
          // Bearing is in the payload, but what the player is shown is decided at
          // read time by their radar level — never here.
          await notify(tx, target.playerId, 'scan_detected', { bearing }, clock.now());
        }
      }
      return;
    }

    const defender = await loadLocked(tx, mission.targetPlanetId, clock);
    const attackerPlanet = await loadLocked(tx, mission.originPlanetId, clock);

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

    const loot = computeLoot(
      { alloy: defender.alloy, crystal: defender.crystal },
      vaultProtects(defender.buildings.VAULT),
      result.grade,
      fleetCargo(result.attackerSurvivors),
    );

    const disruptedUntilMinutes = applyDisruption(
      defender.disruptedUntil ? minutesSince(defender.seasonStart, defender.disruptedUntil) : 0,
      defender.nowMinutes,
      result.grade,
    );

    await saveResources(tx, defender.planetId, {
      alloy: defender.alloy - loot.alloy,
      crystal: defender.crystal - loot.crystal,
      shield: result.shieldLeft,
      disruptedUntil:
        disruptedUntilMinutes > defender.nowMinutes
          ? atMinute(defender.seasonStart, disruptedUntilMinutes)
          : defender.disruptedUntil,
    });

    const attackerLedger = await ledgerOf(tx, attackerPlanet.playerId);
    const defenderLedger = await ledgerOf(tx, defender.playerId);
    bookBattle(attackerLedger, defenderLedger, loot.alloy + loot.crystal, result);
    await saveLedger(tx, attackerLedger);
    await saveLedger(tx, defenderLedger);

    await tx.insert(battleReports).values({
      seasonId: mission.seasonId,
      missionId,
      attackerPlayerId: attackerPlanet.playerId,
      defenderPlayerId: defender.playerId,
      grade: result.grade,
      rounds: result.rounds,
      loot,
      attackerLosses: result.attackerLosses,
      defenderLosses: result.defenderLosses,
      createdAt: defender.now,
    });

    // The attacking stack is gone from the origin either way; survivors become a
    // new return mission, and the dead simply cease to exist.
    await clearMissionUnits(tx, mission.originPlanetId, missionId);

    if (fleetCount(result.attackerSurvivors) > 0) {
      const home = fleetTravelMinutes(mission.distance, result.attackerSurvivors);
      const arriveAt = addMinutes(attackerPlanet.now, home);
      const [ret] = await tx
        .insert(missions)
        .values({
          seasonId: mission.seasonId,
          kind: 'return',
          originPlanetId: mission.targetPlanetId,
          targetPlanetId: mission.originPlanetId,
          fleet: result.attackerSurvivors,
          loot,
          distance: mission.distance,
          departAt: attackerPlanet.now,
          arriveAt,
        })
        .returning();
      await setUnits(tx, mission.originPlanetId, result.attackerSurvivors, ret!.id);
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
    await recomputeWealth(tx, attackerPlanet.planetId);

    await notify(
      tx,
      defender.playerId,
      'raided',
      {
        grade: result.grade,
        lootAlloy: loot.alloy,
        lootCrystal: loot.crystal,
        unitsLost: fleetCount(result.defenderLosses),
      },
      defender.now,
    );
  });
};

/** A surviving fleet reaches home: ships rejoin the garrison, loot lands in the vault. */
async function settleReturn(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  homePlanetId: string,
  at: Date,
): Promise<void> {
  const returning = await fleetOfMission(tx, homePlanetId, mission.id);
  const home = await loadLockedHome(tx, homePlanetId);

  const merged: Fleet = { ...home.fleet };
  for (const [hull, n] of fleetEntries(returning)) {
    merged[hull] = (merged[hull] ?? 0) + n;
  }
  await clearMissionUnits(tx, homePlanetId, mission.id);
  await setUnits(tx, homePlanetId, merged, 'home');

  if (mission.loot) {
    await tx
      .update(planets)
      .set({
        alloy: sql`${planets.alloy} + ${mission.loot.alloy}`,
        crystal: sql`${planets.crystal} + ${mission.loot.crystal}`,
      })
      .where(eq(planets.id, homePlanetId));
  }

  await recomputeWealth(tx, homePlanetId);

  const [planet] = await tx.select().from(planets).where(eq(planets.id, homePlanetId));
  if (planet) {
    await notify(
      tx,
      planet.playerId,
      'fleet_returned',
      {
        ships: fleetCount(returning),
        lootAlloy: mission.loot?.alloy ?? 0,
        lootCrystal: mission.loot?.crystal ?? 0,
      },
      at,
    );
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
 * "Incoming fleet · ETA 9 min."
 *
 * The highest-value notification in the game: it converts a passive loss into an
 * active decision, because the player can still spend their stock, launch their
 * own fleet out, or stand and fight.
 */
export const onRadarWarning: Handler = async ({ db, clock }, event) => {
  const missionId = event.refId;
  if (!missionId) throw new Error('radar_warning without refId');

  await db.transaction(async (tx) => {
    const [mission] = await tx.select().from(missions).where(eq(missions.id, missionId));
    // Nothing to warn about if it already landed or was somehow cancelled.
    if (mission?.status !== 'in_flight') return;

    const [target] = await tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId));
    if (!target) return;

    const payload = event.payload as { radarLevel?: number } | null;
    const radarLevel = payload?.radarLevel ?? 0;
    const etaMinutes = Math.max(
      0,
      Math.round((mission.arriveAt.getTime() - clock.now().getTime()) / 60_000),
    );

    await notify(
      tx,
      target.playerId,
      'incoming_fleet',
      {
        etaMinutes,
        // Size is revealed only from Radar L4, exact composition only from L5.
        ...(radarLevel >= 4 ? { estimatedShips: fleetCount(mission.fleet) } : {}),
        ...(radarLevel >= 5 ? { fleet: mission.fleet, origin: mission.originPlanetId } : {}),
      },
      clock.now(),
    );
  });
};

export const HANDLERS: Partial<Record<EventRow['kind'], Handler>> = {
  mission_arrival: onMissionArrival,
  radar_warning: onRadarWarning,
};
