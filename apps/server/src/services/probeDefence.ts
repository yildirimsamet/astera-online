import { and, desc, eq, gt, sql } from 'drizzle-orm';
import {
  PROBE_DEFENCE,
  probeBatteryCharges,
  probeBatteryLevel,
  probeBatteryOnline,
  settleProbeBattery,
  spendProbeCharge,
  type Bearing,
  type ProbeBatteryStock,
  type Vec3,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { accounts, notifications, planets, players, probeBatteries, probeShots, scanEvents } from '../db/schema.js';
import type { missions } from '../db/schema.js';
import { publish } from '../stream/bus.js';
import { notify } from './notifications.js';
import { GameError, assertWorldOperational, loadLocked, saveResources } from './planet.js';
import { buildPlanetResult, loadPlanetViewData } from './planetView.js';
import { markProgress } from './waitingRoom.js';

/**
 * THE PROBE DEFENCE BATTERY. Owner decisions K1–K8, 2026-11-24
 * (`docs/sonda-bataryasi-plani-2026-11-24.md`).
 *
 * "A battery with a ready charge catches probes more easily and shoots down what it
 * catches; once its charges are gone the world is as if it had no battery."
 *
 * One roll per probe (`probeCatchRoll`). A probe flying at a world with a battery is
 * given one `probe_defence` event, at the point on its approach where the battery
 * fires (`probeShotMoment`); charges and levels are computed from the stored row.
 */

type Battery = typeof probeBatteries.$inferSelect;

export const stockOf = (row: Pick<Battery, 'charges' | 'chargedAt'>): ProbeBatteryStock =>
  ({ charges: row.charges, chargedAt: row.chargedAt.getTime() });

/** The row at `at` with a finished upgrade folded in (`settleProbeBattery`). */
export const settledOf = (row: Battery, at: Date) => settleProbeBattery({
  level: row.level,
  charges: row.charges,
  chargedAt: row.chargedAt.getTime(),
  upgradeLevel: row.upgradeLevel,
  upgradeReadyAt: row.upgradeReadyAt?.getTime() ?? null,
}, at.getTime());

/**
 * THE ONE ORDER: install level 1, or raise a standing battery one level (owner, 2026-11-24).
 * Real minutes, outside every build queue. While an upgrade runs the battery works at its
 * old level; at the finish the new charges stand ready.
 */
export async function installProbeBattery(db: Db, planetId: string, clock: Clock, expectedPlayerId?: string) {
  return db.transaction(async (tx) => {
    const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(planet);
    const [existing] = await tx.select().from(probeBatteries).where(eq(probeBatteries.planetId, planetId)).for('update');
    const settled = existing ? settledOf(existing, planet.now) : null;
    if (existing && (existing.readyAt > planet.now || settled?.upgrading === true)) {
      throw new GameError('PROBE_BATTERY_BUSY', 'This battery is already being built', 409);
    }
    const next = settled ? settled.level + 1 : 1;
    if (next > PROBE_DEFENCE.levels.length) {
      throw new GameError('PROBE_BATTERY_MAX', 'This battery is at its top level', 409, { maxLevel: PROBE_DEFENCE.levels.length });
    }
    const spec = probeBatteryLevel(next);
    // The EFFECTIVE rung, as the shot reads it: a Radar with no Uplink has no reach.
    const radar = planet.effectiveInstruments.RADAR ?? 0;
    if (radar < spec.requiredRadar) {
      throw new GameError('PROBE_BATTERY_LOCKED', 'Raise the Radar first', 403, { requiredRadar: spec.requiredRadar, radar, level: next });
    }
    const { cost } = spec;
    if (planet.alloy < cost.alloy || planet.crystal < cost.crystal || planet.deuterium < cost.deuterium) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }
    const readyAt = addMinutes(planet.now, spec.buildMinutes);
    if (readyAt >= planet.seasonEndsAt) {
      throw new GameError('SEASON_ENDS_BEFORE_BUILD', 'That order cannot finish before the season ends', 409, {
        endsAt: planet.seasonEndsAt.toISOString(),
      });
    }
    await saveResources(tx, planetId, {
      alloy: planet.alloy - cost.alloy,
      crystal: planet.crystal - cost.crystal,
      deuterium: planet.deuterium - cost.deuterium,
    });
    if (!existing || !settled) {
      // Full on completion: the refill clock starts where the build ends.
      await tx.insert(probeBatteries).values({
        planetId, startedAt: planet.now, readyAt, level: 1, charges: spec.capacity, chargedAt: readyAt,
      });
    } else {
      await tx.update(probeBatteries).set({
        level: settled.level,
        charges: settled.stock.charges,
        chargedAt: new Date(settled.stock.chargedAt),
        upgradeLevel: next,
        upgradeStartedAt: planet.now,
        upgradeReadyAt: readyAt,
      }).where(eq(probeBatteries.planetId, planetId));
    }
    await markProgress(tx, planet.playerId, planet.now); // D212: a defence order is production
    return { readyAt, planet: await loadPlanetViewData(tx, planetId, clock) };
  }).then(buildPlanetResult);
}

export interface BatteryAtShot {
  row: Battery;
  /** The level working at that instant, an upgrade that had finished included. */
  level: number;
  stock: ProbeBatteryStock;
  /** Charges standing then, whether or not the battery may fire. */
  ready: number;
  capacity: number;
  /** The level a probe meets, or 0: built, online and holding a charge. */
  armedLevel: number;
}

/**
 * The target's battery as it stood at `at`, row locked so probes meeting it together are
 * served one at a time. Null for a world without a finished battery, and for a world
 * nobody holds.
 */
export async function probeBatteryAt(
  tx: Tx,
  target: Pick<typeof planets.$inferSelect, 'id' | 'controllerPlayerId' | 'empUntil' | 'recoveryUntil'>,
  radar: number,
  at: Date,
): Promise<BatteryAtShot | null> {
  if (!target.controllerPlayerId) return null;
  const [row] = await tx.select().from(probeBatteries).where(eq(probeBatteries.planetId, target.id)).for('update');
  if (!row || row.readyAt > at) return null;
  const { level, stock } = settledOf(row, at);
  const ready = probeBatteryCharges(stock, at.getTime(), level).charges;
  const online = probeBatteryOnline({
    radar,
    emp: target.empUntil !== null && target.empUntil > at,
    recovering: target.recoveryUntil !== null && target.recoveryUntil > at,
  });
  return { row, level, stock, ready, capacity: probeBatteryLevel(level).capacity, armedLevel: online && ready > 0 ? level : 0 };
}

/**
 * THE SHOT. One charge, the scan row the target's radar log reads, the loss line with
 * where it happened, and the defender's gathered notice. The caller has claimed the
 * mission and writes no report and no return leg.
 */
export async function shootDownProbe(tx: Tx, input: {
  battery: BatteryAtShot;
  mission: Pick<typeof missions.$inferSelect, 'id' | 'seasonId' | 'ownerPlayerId' | 'originPlanetId'>;
  target: Pick<typeof planets.$inferSelect, 'id' | 'name' | 'controllerPlayerId'>;
  /** When the battery opened fire: the charge is spent then. */
  firedAt: Date;
  /** When the last round reached the craft. */
  shotAt: Date;
  point: Vec3;
  from: Vec3;
  bearing: Bearing;
  now: Date;
}): Promise<void> {
  const { battery, mission, target, firedAt, shotAt, point, from, now } = input;
  const defender = target.controllerPlayerId;
  if (!defender) throw new Error('a probe battery fired for a world nobody holds');
  const spent = spendProbeCharge(battery.stock, firedAt.getTime(), battery.level);
  if (!spent) throw new Error(`probe battery ${battery.row.planetId} fired with no charge`);
  const landed = battery.row.upgradeLevel !== null && battery.level === battery.row.upgradeLevel;
  await tx.update(probeBatteries)
    .set({
      level: battery.level,
      charges: spent.charges,
      chargedAt: new Date(spent.chargedAt),
      ...(landed ? { upgradeLevel: null, upgradeStartedAt: null, upgradeReadyAt: null } : {}),
    })
    .where(eq(probeBatteries.planetId, battery.row.planetId));
  await tx.insert(probeShots).values({
    seasonId: mission.seasonId,
    missionId: mission.id,
    attackerPlayerId: mission.ownerPlayerId,
    defenderPlayerId: defender,
    targetPlanetId: target.id,
    shotAt,
    x: point.x,
    y: point.y,
    z: point.z,
    firedAt,
    fromX: from.x,
    fromY: from.y,
    fromZ: from.z,
  });
  // A shot-down probe was caught: the radar log reads it under the usual gates.
  await tx.insert(scanEvents).values({
    targetPlanetId: target.id,
    originPlanetId: mission.originPlanetId,
    detected: true,
    shotDown: true,
    bearing: input.bearing,
    createdAt: now,
  });
  await noteProbeShot(tx, defender, target, mission.id, now);
}

/**
 * THE DEFENDER HEARS ONE LINE PER WINDOW (K7). A shot inside `noticeWindowMinutes` of
 * the last one on the same world raises that line's count and rings it again; a shot
 * after a quiet window opens a new line.
 */
async function noteProbeShot(
  tx: Tx,
  playerId: string,
  target: Pick<typeof planets.$inferSelect, 'id' | 'name'>,
  missionId: string,
  at: Date,
): Promise<void> {
  const since = new Date(at.getTime() - PROBE_DEFENCE.noticeWindowMinutes * 60_000);
  const [open] = await tx.select({ id: notifications.id, payload: notifications.payload }).from(notifications)
    .where(and(
      eq(notifications.playerId, playerId),
      eq(notifications.kind, 'scan_detected'),
      sql`${notifications.payload}->>'planetId' = ${target.id}`,
      sql`${notifications.payload}->>'shotDown' = 'true'`,
      gt(notifications.createdAt, since),
    ))
    .orderBy(desc(notifications.createdAt))
    .limit(1)
    .for('update');
  if (open) {
    const count = typeof open.payload.count === 'number' ? open.payload.count : 1;
    await tx.update(notifications)
      .set({ payload: { ...open.payload, count: count + 1 }, seen: false, createdAt: at })
      .where(eq(notifications.id, open.id));
    await publish(tx, playerId, 'scan_detected');
    return;
  }
  await notify(tx, {
    playerId,
    kind: 'scan_detected',
    payload: { shotDown: true, count: 1, planetId: target.id, planetName: target.name },
    at,
    refId: missionId,
  });
}

/** How far back the intel centre lists a commander's lost probes. */
const LOSS_LIST_HOURS = 24;

/**
 * THE SENDER'S LOSSES (plan §3.5): a shot-down probe brings no report, so the intel
 * centre lists the loss in its place — where, whose and when. The defender at the shot
 * is the name the sender's notice already carried.
 */
export async function readProbeLosses(db: Db, playerId: string, now: Date, limit = 20) {
  const since = new Date(now.getTime() - LOSS_LIST_HOURS * 3_600_000);
  return db.select({
    missionId: probeShots.missionId,
    targetPlanetId: probeShots.targetPlanetId,
    targetName: planets.name,
    targetUsername: accounts.displayName,
    at: probeShots.shotAt,
    point: { x: probeShots.x, y: probeShots.y, z: probeShots.z },
    firedAt: probeShots.firedAt,
    from: { x: probeShots.fromX, y: probeShots.fromY, z: probeShots.fromZ },
  }).from(probeShots)
    .innerJoin(planets, eq(planets.id, probeShots.targetPlanetId))
    .innerJoin(players, eq(players.id, probeShots.defenderPlayerId))
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .where(and(eq(probeShots.attackerPlayerId, playerId), gt(probeShots.shotAt, since)))
    .orderBy(desc(probeShots.shotAt))
    .limit(limit);
}

/** How far back the holder's galaxy replays its battery's shots. */
const FIRED_LIST_MINUTES = 30;

/**
 * THE HOLDER'S OWN SHOTS, WITH WHERE THEY HAPPENED, for the galaxy's moment (owner playtest,
 * 2026-11-24: the shot belongs on the probe). Neither the sender nor where it came from:
 * only the point on the approach, which the holder's Radar watched the craft fly along.
 */
export async function readProbeShotsFired(db: Db, playerId: string, now: Date, limit = 20) {
  const since = new Date(now.getTime() - FIRED_LIST_MINUTES * 60_000);
  return db.select({
    id: probeShots.id,
    planetId: probeShots.targetPlanetId,
    at: probeShots.shotAt,
    point: { x: probeShots.x, y: probeShots.y, z: probeShots.z },
    firedAt: probeShots.firedAt,
    from: { x: probeShots.fromX, y: probeShots.fromY, z: probeShots.fromZ },
  }).from(probeShots)
    .where(and(eq(probeShots.defenderPlayerId, playerId), gt(probeShots.shotAt, since)))
    .orderBy(desc(probeShots.shotAt))
    .limit(limit);
}
