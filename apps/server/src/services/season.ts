import { and, eq } from 'drizzle-orm';
import { GALAXY, SEASON, SERVERS, generateGalaxy, type GalaxySpec } from '@astera/rules';
import type { Db } from '../db/client.js';
import { planets, seasons, shards } from '../db/schema.js';
import { addMinutes } from '../clock.js';

/**
 * The galaxy is never stored slot by slot — it is regenerated from `seed`
 * wherever it is needed, identically on server, simulator and client.
 *
 * ASTEROIDS NO LONGER GET ROWS EITHER (D19). They used to, on the grounds that
 * impacts must be schedulable; impacts were never scheduled, and the field is now
 * a deterministic function of the seed like everything else. The only fact about a
 * rock that a formula and a clock cannot produce is how much ore somebody else has
 * already taken out of it, and that lives in `asteroid_claims`.
 */
const cache = new Map<string, GalaxySpec>();

export function galaxyOf(
  seasonId: string,
  seed: number,
  slots: number = GALAXY.defaultSlots,
): GalaxySpec {
  const key = `${seasonId}:${slots}`;
  let spec = cache.get(key);
  if (!spec) {
    spec = generateGalaxy(seed, slots);
    cache.set(key, spec);
  }
  return spec;
}

/**
 * An ordinal for a shard that was created without one.
 *
 * The ten real galaxies are numbered 1..10 by `bootstrapServers`, and the ordinal
 * carries the sequential-fill rule — so a shard made outside that path (every test
 * fixture, and any one-off galaxy) needs a number that is unique, stable across
 * re-creation, and provably out of the way of the real ten. A hash offset past
 * `SERVERS.count` is all three: the same code always lands on the same ordinal, so
 * `onConflictDoUpdate` on a re-run is a no-op rather than a silent renumbering.
 */
function incidentalOrdinal(code: string): number {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return SERVERS.count + 1 + (Math.abs(h) % 1_000_000);
}

export interface CreateSeasonInput {
  shardCode: string;
  shardName?: string;
  /** Fill order. Ten galaxies fill strictly in ascending ordinal. D21. */
  ordinal?: number;
  seed: number;
  startsAt: Date;
  days?: number;
  playerCap?: number;
}

export async function createSeason(db: Db, input: CreateSeasonInput) {
  const cap = input.playerCap ?? SERVERS.capacity;
  const name = input.shardName ?? input.shardCode;
  const ordinal = input.ordinal ?? incidentalOrdinal(input.shardCode);

  const [shard] = await db
    .insert(shards)
    .values({ code: input.shardCode, name, ordinal, playerCap: cap })
    .onConflictDoUpdate({ target: shards.code, set: { name, ordinal, playerCap: cap } })
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

  return { shard: shard!, season: season!, galaxy: galaxyOf(season!.id, input.seed, cap) };
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
