import { eq } from 'drizzle-orm';
import type { Tx } from '../db/client.js';
import { notifications, players, type NotificationKind } from '../db/schema.js';
import { publish } from '../stream/bus.js';
import { UNLOCK_COPY, currentUnlocks, type Unlockable } from './session.js';

/**
 * THE ONE PLACE A NOTIFICATION IS WRITTEN. D45.
 *
 * It lived inside `worker/handlers.ts` and was private to it, which was true only
 * while every notification came from a scheduled event. Assigning a telescope
 * announces an unlock and happens on an HTTP request, so the write path had to
 * come out of the worker rather than be copied into a second file.
 *
 * IDEMPOTENT BY `refId`. Call it twice for the same (player, kind, subject) and
 * the second call writes nothing and — this is the part that matters — publishes
 * nothing. An event that commits and is then redelivered (worker killed between
 * COMMIT and `complete()`, reaper returns the row) used to write a second copy of
 * the same news; the radar warning did exactly that, with a fresh ETA on it.
 *
 * Pass `refId: null` only for news that is about the player rather than about a
 * mission — an unlock. PostgreSQL treats NULLs as distinct, so those rows sit
 * outside the unique index instead of colliding with one another.
 *
 * ALWAYS CALLED INSIDE THE TRANSACTION THAT PRODUCED THE EVENT. `pg_notify` is
 * transactional: it fires on COMMIT and is discarded on rollback, so a client can
 * never be told about a battle that was subsequently undone.
 *
 * @returns whether this was new. Callers that do bookkeeping per announcement
 * (the unlock cascade) need to know the difference.
 */
export async function notify(
  tx: Tx,
  input: {
    playerId: string;
    kind: NotificationKind;
    payload: Record<string, unknown>;
    /** From the injected clock, never `defaultNow()` — there is one clock here. */
    at: Date;
    /** The mission or run this is about. `null` only for news about the player. */
    refId: string | null;
  },
): Promise<boolean> {
  const rows = await tx
    .insert(notifications)
    .values({
      playerId: input.playerId,
      kind: input.kind,
      payload: input.payload,
      createdAt: input.at,
      refId: input.refId,
    })
    .onConflictDoNothing({
      target: [notifications.playerId, notifications.kind, notifications.refId],
    })
    .returning({ id: notifications.id });

  if (rows.length === 0) return false;
  await publish(tx, input.playerId, input.kind);
  return true;
}

/**
 * DESIGN LAW #2, GIVEN A DELIVERY MECHANISM AT LAST. D45.
 *
 * "Every system unlocks at the moment the player feels its absence" — and the
 * moment was computed, recorded and never told to anybody. `UNLOCK_COPY`,
 * `/api/session/unlocks` and the client's `useUnlocks` all existed; nothing
 * imported any of them, because the only surface that ever announced an unlock
 * was the return overlay D23 deleted.
 *
 * WHAT IS UNLOCKED STAYS DERIVED. `currentUnlocks` reads the history that
 * justifies it, so the cascade cannot drift out of sync with what actually
 * happened; `unlocksSeen` records only what has been ANNOUNCED. That split is why
 * this is safe to call from anywhere and cheap to call twice.
 *
 * Called from the three places that can create one — a battle resolving, a scan
 * being detected, a telescope being pointed — rather than polled, because an
 * unlock is a moment and this codebase has no global tick.
 *
 * IT IS THE ONLY WRITER OF `unlocksSeen`. `buildReturnPayload` used to keep its
 * own copy of this diff-and-record, which was harmless only while it was the sole
 * surface that announced anything. With two writers, whichever ran first would
 * silently consume the other's announcement — and one of the two is an endpoint no
 * client calls, so the news would have vanished into a route nobody reads.
 *
 * @returns what was announced, so a caller can render the same list it just wrote.
 */
export async function announceUnlocks(
  tx: Tx,
  playerId: string,
  at: Date,
): Promise<Unlockable[]> {
  const [player] = await tx
    .select({ unlocksSeen: players.unlocksSeen })
    .from(players)
    .where(eq(players.id, playerId));
  if (!player) return [];

  const unlocked = await currentUnlocks(tx, playerId);
  const seen = new Set(player.unlocksSeen);
  const fresh = unlocked.filter((u) => !seen.has(u));
  if (fresh.length === 0) return [];

  for (const unlock of fresh) {
    await notify(tx, {
      playerId,
      kind: 'unlock',
      payload: { unlock, title: UNLOCK_COPY[unlock].title, body: UNLOCK_COPY[unlock].body },
      at,
      refId: null,
    });
  }

  await tx
    .update(players)
    .set({ unlocksSeen: [...seen, ...fresh] })
    .where(eq(players.id, playerId));
  return fresh;
}
