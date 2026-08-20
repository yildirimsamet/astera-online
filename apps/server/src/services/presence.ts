import { eq } from 'drizzle-orm';
import { SERVERS } from '@blindspace/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { players } from '../db/schema.js';

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
 * with a cold map simply writes one extra row per account per minute, and a
 * process that dies loses nothing at all — the truth is the column. That is what
 * makes this safe to run behind more than one instance, which an in-memory *set*
 * of online players would not be.
 */
export class Presence {
  private readonly lastWrite = new Map<string, number>();

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly throttleMs = 60_000,
  ) {}

  /**
   * Note that this account is playing. Returns whether it actually wrote.
   *
   * Never throws. Presence is a cosmetic figure on a lobby screen, and a failed
   * update of it must not be able to fail the request that carried it — the caller
   * is the middle of somebody's fleet launch.
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
      await this.db
        .update(players)
        .set({ lastActiveAt: this.clock.now() })
        .where(eq(players.accountId, accountId));
      return true;
    } catch {
      // Let the next request try again rather than staying quiet for a minute.
      this.lastWrite.delete(accountId);
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
