import { and, eq, isNull } from 'drizzle-orm';
import { sensorSphere, type SensorEpoch } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { minutesSince } from '../clock.js';
import { planets, seasons, sensorEpochs } from '../db/schema.js';
import { instrumentLevels, levelOf } from './intel.js';

/**
 * Close/open a world's post only when owner, position or effective reach changed.
 * Callers place this inside the transaction that made the change, so there is no
 * instant where gameplay and discovery history disagree.
 */
export async function refreshSensorEpoch(
  db: Queryable,
  planetId: string,
  now: Date,
): Promise<void> {
  const [world] = await db
    .select({
      seasonId: planets.seasonId,
      playerId: planets.controllerPlayerId,
      x: planets.x,
      y: planets.y,
      z: planets.z,
    })
    .from(planets)
    .where(eq(planets.id, planetId))
    .limit(1);
  if (!world) return;

  const levels = await instrumentLevels(db, [planetId]);
  const reach = sensorSphere(
    { x: world.x, y: world.y, z: world.z },
    levelOf(levels, planetId, 'TELESCOPE'),
    0,
  ).identify;
  const [open] = await db
    .select()
    .from(sensorEpochs)
    .where(and(eq(sensorEpochs.planetId, planetId), isNull(sensorEpochs.endsAt)))
    .limit(1);

  const unchanged = open !== undefined
    && world.playerId !== null
    && open.playerId === world.playerId
    && open.x === world.x
    && open.y === world.y
    && open.z === world.z
    && open.reach === reach;
  if (unchanged) return;

  if (open) {
    if (open.startsAt >= now) {
      // A state may change twice in one transaction/instant. A zero-duration row
      // carries no possible contact and would violate the strict window check.
      await db.delete(sensorEpochs).where(eq(sensorEpochs.id, open.id));
    } else {
      await db.update(sensorEpochs).set({ endsAt: now }).where(eq(sensorEpochs.id, open.id));
    }
  }

  if (world.playerId === null) return;
  await db.insert(sensorEpochs).values({
    seasonId: world.seasonId,
    playerId: world.playerId,
    planetId,
    x: world.x,
    y: world.y,
    z: world.z,
    reach,
    startsAt: now,
  });
}

/** Convert durable wall-clock rows once at the rules boundary. */
export async function sensorHistoryForPlayer(
  db: Queryable,
  playerId: string,
  seasonStart?: Date,
): Promise<SensorEpoch[]> {
  const rows = await db
    .select({
      x: sensorEpochs.x,
      y: sensorEpochs.y,
      z: sensorEpochs.z,
      reach: sensorEpochs.reach,
      startsAt: sensorEpochs.startsAt,
      endsAt: sensorEpochs.endsAt,
      seasonStartsAt: seasons.startsAt,
    })
    .from(sensorEpochs)
    .innerJoin(seasons, eq(sensorEpochs.seasonId, seasons.id))
    .where(eq(sensorEpochs.playerId, playerId));
  return rows.map((row) => {
    const startsAt = seasonStart ?? row.seasonStartsAt;
    return {
      at: { x: row.x, y: row.y, z: row.z },
      reach: row.reach,
      startsAt: minutesSince(startsAt, row.startsAt),
      endsAt: row.endsAt === null ? null : minutesSince(startsAt, row.endsAt),
    };
  });
}
