import { eq, sql } from 'drizzle-orm';
import { SERVERS } from '@astera/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { players, returnReminders, vessels } from '../db/schema.js';
import { refreshReturnActivity } from './returnQueue.js';

/**
 * WHO IS IN THE GAME RIGHT NOW. D21.
 *
 * The server list promises a live population figure, and there is exactly one
 * honest source for it: when each commander last asked this API for something.
 *
 * THE DESIGN CONSTRAINT IS WRITE VOLUME, NOT ACCURACY. Stamping a row on every
 * request turns a read-mostly API into one write per request — the galaxy view
 * alone makes four — and does it on the hot path of every screen in the game. So
 * the stamp is throttled per account in memory and lands at most once a minute.
 * The figure it produces is a five-minute window (`SERVERS.onlineWindowMinutes`),
 * which a sixty-second resolution cannot meaningfully blur.
 *
 * WHY THE THROTTLE MAY BE IN MEMORY. It is a cache, not state. A second process
 * with a cold map asks once and finds the row already fresh, and a process that
 * dies loses nothing at all — the truth is the column. That is what makes this safe
 * to run behind more than one instance, which an in-memory *set* of online players
 * would not be.
 *
 * THE STAMP WAITS FOR NOBODY. It is one guarded write, and a row a game write holds
 * is skipped: a commander who is playing asks again within seconds, and the slot
 * comes round within a minute, which the five-minute window cannot see. Only a
 * commander with a queued return goes on to the locked path, which has to read the
 * application's deadline under the player lock.
 */
export class Presence {
  private readonly lastWrite = new Map<string, number>();

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly throttleMs = 60_000,
    private readonly reportError: (error: unknown) => void = (error) => { console.error('Presence write failed', error); },
  ) {}

  /**
   * Note that this account is playing. Returns whether it actually wrote.
   *
   * A failed write is reported and may be retried; it never promises renewed
   * queue priority. Explicit queue mutations use their own unthrottled transaction.
   */
  async touch(accountId: string): Promise<boolean> {
    const now = this.clock.now().getTime();
    const previous = this.lastWrite.get(accountId);
    if (previous !== undefined && now - previous < this.throttleMs) return false;

    // Claim the slot BEFORE awaiting. Two concurrent requests from one account
    // otherwise both read a stale entry and both write.
    this.lastWrite.set(accountId, now);
    this.sweep(now);

    try {
      const at = new Date(now).toISOString(), stale = new Date(now - this.throttleMs).toISOString();
      // Ship, settled world and reminder share one round trip and the same guarded stamp.
      const [stamped] = await this.db.execute<{ id: string; queued: boolean }>(sql`
        WITH ship AS (
          UPDATE ${vessels} SET last_seen_at = ${at}
          WHERE id IN (
            SELECT id FROM ${vessels}
            WHERE account_id = ${accountId} AND status IN ('ACTIVE', 'DORMANT') AND last_seen_at <= ${stale}
            FOR NO KEY UPDATE SKIP LOCKED
          ) RETURNING id
        ), world AS (
          UPDATE ${players} SET last_active_at = ${at}
          WHERE id IN (
            SELECT id FROM ${players}
            WHERE account_id = ${accountId} AND last_active_at <= ${stale}
              AND NOT EXISTS (SELECT 1 FROM ship)
            FOR NO KEY UPDATE SKIP LOCKED
          ) RETURNING id, EXISTS (
            SELECT 1 FROM return_applications WHERE player_id = players.id AND status = 'QUEUED'
          ) AS queued
        ), reminder AS (
          UPDATE ${returnReminders} SET absence_at = ${at}, summary_stage = 0, next_check_at = least(next_repair_at, ${at}::timestamptz + interval '24 hours')
          WHERE account_id = ${accountId} AND (EXISTS (SELECT 1 FROM ship) OR EXISTS (SELECT 1 FROM world))
        )
        SELECT id, false AS queued FROM ship UNION ALL SELECT id, queued FROM world
      `);
      if (!stamped) return false;
      if (stamped.queued) {
        await this.db.transaction(async (tx) => {
          // Presence never acquires season/admission locks after this player lock.
          await tx.select({ id: players.id }).from(players).where(eq(players.id, stamped.id)).for('update');
          await refreshReturnActivity(tx, stamped.id, this.clock);
        });
      }
      return true;
    } catch (error) {
      // Let the next request try again rather than staying quiet for a minute. A failed
      // queue renewal is the exception: its stamp committed, so the row's guard holds it to the next one.
      this.lastWrite.delete(accountId);
      this.reportError(error);
      return false;
    }
  }

  /**
   * Drop entries older than the online window.
   *
   * Without this the map is a slow leak: one entry per account that has ever
   * played, held for the life of the process. Swept opportunistically on write
   * rather than on a timer, because a timer would keep an idle server awake and
   * this map is only ever consulted on a write.
   */
  private sweep(now: number): void {
    if (this.lastWrite.size < SWEEP_THRESHOLD) return;
    const cutoff = now - SERVERS.onlineWindowMinutes * 60_000;
    for (const [id, at] of this.lastWrite) {
      if (at < cutoff) this.lastWrite.delete(id);
    }
  }
}

/** Below this the map is not worth walking; above it, it is worth it every write. */
const SWEEP_THRESHOLD = 256;
