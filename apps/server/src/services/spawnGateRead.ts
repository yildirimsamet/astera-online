import { and, eq, gte } from 'drizzle-orm';
import { gateSpawns } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { spawnGateSkips, type seasons } from '../db/schema.js';
import { minutesSince } from '../clock.js';
import { FIELD_LOOKBACK_HOURS } from './asteroidSpawn.js';

type GateSeason = Pick<typeof seasons.$inferSelect, 'id' | 'startsAt' | 'spawnGateFrom' | 'spawnGateThrough'>;

/**
 * THE ONE FILTER EVERY FIELD READ APPLIES (owner rule 2026-10-17, see `spawnGate.ts`).
 * Births before activation pass untouched; after it a read shows only what the worker has
 * already decided and kept, so no replica can show a rock or pirate the gate later skips.
 */
export async function applySpawnGate<T extends { index: number; appearsAt: number }>(
  db: Queryable,
  season: GateSeason,
  kind: 'ASTEROID' | 'PIRATE',
  field: readonly T[],
  now: Date,
): Promise<T[]> {
  if (season.spawnGateFrom === null || season.spawnGateThrough === null) return [...field];
  const rows = await db.select({ index: spawnGateSkips.index }).from(spawnGateSkips).where(and(
    eq(spawnGateSkips.seasonId, season.id),
    eq(spawnGateSkips.kind, kind),
    gte(spawnGateSkips.appearsAt, new Date(now.getTime() - FIELD_LOOKBACK_HOURS * 3_600_000)),
  ));
  return gateSpawns(field, {
    fromMinute: minutesSince(season.startsAt, season.spawnGateFrom),
    throughMinute: minutesSince(season.startsAt, season.spawnGateThrough),
  }, new Set(rows.map((row) => row.index)));
}
