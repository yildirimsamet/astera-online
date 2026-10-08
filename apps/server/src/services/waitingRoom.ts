import { eq } from 'drizzle-orm';
import type { Queryable, Tx } from '../db/client.js';
import { players, shards } from '../db/schema.js';
import { GameError } from './planet.js';

/**
 * SILENT SPACE IS A WAITING ROOM. D212, owner rule 2026-10-07.
 *
 * Two halves, one rule. `markProgress` records the orders that keep a commander in a
 * main galaxy — a building, a ship or ground defence, a research, a combat launch — and
 * the sweep moves anyone thirty hours past the last one. `assertOutsideSilentSpace`
 * closes every fight and every farm once they are there, so quiet growth in Silent Space
 * is never the better plan than coming back.
 */

/**
 * Called inside the transaction that commits the order, after its checks passed, so a
 * refused order stamps nothing. Paths that call it already write `players` (wealth or a
 * spent shield) after their planet locks; this adds no new lock order.
 */
export async function markProgress(tx: Tx, playerId: string, at: Date): Promise<void> {
  await tx.update(players).set({ lastProgressAt: at }).where(eq(players.id, playerId));
}

/** A season's shard role never changes, so one primary-key read answers it. */
export async function isSilentSpaceShard(tx: Queryable, shardId: string): Promise<boolean> {
  const [shard] = await tx.select({ role: shards.role }).from(shards).where(eq(shards.id, shardId));
  return shard?.role === 'WAITING';
}

/** For lanes that start from a season rather than a loaded world (a clan war mark). */
export async function assertSeasonOutsideSilentSpace(tx: Queryable, season: { shardId: string }): Promise<void> {
  assertOutsideSilentSpace({ silentSpace: await isSilentSpaceShard(tx, season.shardId) });
}

/** Placed right after the origin world is loaded, before any target or fleet is read. */
export function assertOutsideSilentSpace(world: { silentSpace: boolean }): void {
  if (!world.silentSpace) return;
  throw new GameError(
    'SILENT_SPACE_LOCKED',
    'Attacks and gathering are closed in Silent Space. Return to your galaxy to use them.',
    409,
  );
}
