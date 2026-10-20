import { eq } from 'drizzle-orm';
import { UNKNOWN_SIGNAL, seededFrom } from '@astera/rules';
import { addMinutes } from '../clock.js';
import type { Queryable, Tx } from '../db/client.js';
import { players, unknownSignalState } from '../db/schema.js';
import { schedule } from '../worker/queue.js';

export const unknownSignalSpawnKey = (playerId: string, at: Date) => `unknown-signal:spawn:${playerId}:${at.toISOString()}`;

export async function queueUnknownSignalSpawn(tx: Queryable, state: typeof unknownSignalState.$inferSelect): Promise<void> {
  if (!state.nextAt) return;
  await schedule(tx, { seasonId: state.seasonId, kind: 'unknown_signal_spawn', refId: state.playerId,
    resolveAt: state.nextAt, dedupeKey: unknownSignalSpawnKey(state.playerId, state.nextAt) });
}

/**
 * Registration and bounded backfill share one insert-only discovery chain. A first game
 * (the account's one three-day shield) hears its first signal within minutes, pirate-free.
 */
export async function ensureUnknownSignalSchedule(tx: Tx, playerId: string, seasonId: string, at: Date, backfill = false,
  firstGame = false): Promise<boolean> {
  const [min, max] = firstGame ? UNKNOWN_SIGNAL.firstGameGapMinutes
    : backfill ? [0, UNKNOWN_SIGNAL.gapMinutes[0]] : UNKNOWN_SIGNAL.gapMinutes;
  const nextAt = addMinutes(at, min + seededFrom(`unknown-signal:first:${seasonId}:${playerId}`)() * (max - min));
  const [state] = await tx.insert(unknownSignalState).values({ playerId, seasonId, nextAt, firstSignalSpared: firstGame })
    .onConflictDoNothing().returning();
  if (!state) return false;
  await queueUnknownSignalSpawn(tx, state);
  return true;
}

/** Latch T4 when it is reached: losing its colony must never restart discovery. */
export async function stopUnknownSignalSchedule(tx: Tx, playerId: string, seasonId: string): Promise<void> {
  await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for('update');
  await tx.insert(unknownSignalState).values({ playerId, seasonId, nextAt: null })
    .onConflictDoUpdate({ target: unknownSignalState.playerId, set: { nextAt: null } });
}
