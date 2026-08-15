import { and, eq } from 'drizzle-orm';
import { SEASON, generateGalaxy, type GalaxySpec } from '@blindspace/rules';
import type { Db } from '../db/client.js';
import { asteroids, planets, seasons, shards } from '../db/schema.js';
import { addMinutes } from '../clock.js';

/**
 * The galaxy is never stored slot by slot — it is regenerated from `seed`
 * wherever it is needed, identically on server, simulator and client. Only the
 * asteroids get rows, because impacts must be schedulable.
 */
const cache = new Map<string, GalaxySpec>();

export function galaxyOf(seasonId: string, seed: number, slots: number): GalaxySpec {
  const key = `${seasonId}:${slots}`;
  let spec = cache.get(key);
  if (!spec) {
    spec = generateGalaxy(seed, slots);
    cache.set(key, spec);
  }
  return spec;
}

export interface CreateSeasonInput {
  shardCode: string;
  seed: number;
  startsAt: Date;
  days?: number;
  playerCap?: number;
}

export async function createSeason(db: Db, input: CreateSeasonInput) {
  const cap = input.playerCap ?? 200;

  const [shard] = await db
    .insert(shards)
    .values({ code: input.shardCode, playerCap: cap })
    .onConflictDoUpdate({ target: shards.code, set: { playerCap: cap } })
    .returning();

  const days = input.days ?? SEASON.days;
  const [season] = await db
    .insert(seasons)
    .values({
      shardId: shard!.id,
      seed: input.seed,
      status: 'live',
      startsAt: input.startsAt,
      endsAt: addMinutes(input.startsAt, days * 24 * 60),
    })
    .returning();

  const spec = galaxyOf(season!.id, input.seed, cap);
  if (spec.asteroids.length > 0) {
    await db.insert(asteroids).values(
      spec.asteroids.map((a) => ({
        seasonId: season!.id,
        index: a.index,
        radius: a.radius,
        period: a.period,
        phase: a.phase,
        y: a.y,
        mass: a.mass,
      })),
    );
  }

  return { shard: shard!, season: season!, galaxy: spec };
}

export async function liveSeason(db: Db, shardCode: string) {
  const [row] = await db
    .select({ season: seasons, shard: shards })
    .from(seasons)
    .innerJoin(shards, eq(seasons.shardId, shards.id))
    .where(and(eq(shards.code, shardCode), eq(seasons.status, 'live')))
    .limit(1);
  return row;
}

export async function occupiedSlots(db: Db, seasonId: string): Promise<Set<number>> {
  const rows = await db
    .select({ slotIndex: planets.slotIndex })
    .from(planets)
    .where(eq(planets.seasonId, seasonId));
  return new Set(rows.map((r) => r.slotIndex));
}
