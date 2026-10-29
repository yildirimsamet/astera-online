import { and, eq, gt, inArray, isNull, not } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { accounts, nativeSessions, players } from '../db/schema.js';
import { accountIsBanned } from '../services/accountBan.js';
import type { EventBus } from './bus.js';

/** Why a stream must end: its credentials, or the galaxy it was opened in. */
export type Revocation = 'auth' | 'placement';

export interface FencedStream {
  playerId: string;
  accountId: string;
  /** The token's version; `requireAuth` matched it against the account at connect. */
  authVersion: number;
  seasonId: string;
  placementVersion: number;
  nativeSessionId?: string;
  /** Idempotent. Ends the socket; `placement` tells the client first. */
  revoke(reason: Revocation): void;
}

const SWEEP_MS = 60_000;
/** setTimeout's ceiling. A session further out closes early and the reconnect re-arms it. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * THE STREAM'S EPOCH, READ ONCE. Scaling plan F1.1 (M1).
 *
 * A connection is checked when it opens; after that its frames are delivered from
 * memory. What can end it arrives on the stream's own player topic, published by
 * the triggers in migration 0210. What a LISTEN gap may have swallowed is caught by
 * one batched read of every stream before the next frame (`settled`), and the same
 * read runs once a minute as a second line. A native session also closes at its
 * own expiry, which no row change announces.
 */
export class StreamFence {
  /** Each stream's native expiry timer, once one is set. */
  private readonly streams = new Map<FencedStream, ReturnType<typeof setTimeout> | null>();
  private gap: Promise<void> | null = null;
  private readonly sweep: ReturnType<typeof setInterval>;
  private readonly stopObserving: () => void;

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    bus: EventBus,
    private readonly log: FastifyBaseLogger,
    sweepMs = SWEEP_MS,
  ) {
    this.stopObserving = bus.observeReset(() => {
      const check = (this.gap ?? Promise.resolve()).then(() => this.verify([...this.streams.keys()], true));
      this.gap = check;
      void check.finally(() => { if (this.gap === check) this.gap = null; });
    });
    this.sweep = setInterval(() => { void this.verify([...this.streams.keys()], false); }, sweepMs);
    this.sweep.unref();
  }

  /** Registers a stream and runs its one epoch read; resolves once it passed or was revoked. */
  async admit(stream: FencedStream): Promise<void> {
    this.streams.set(stream, null);
    await this.verify([stream], true);
  }

  remove(stream: FencedStream): void {
    const timer = this.streams.get(stream);
    if (timer) clearTimeout(timer);
    this.streams.delete(stream);
  }

  /** Frames wait here after a LISTEN gap, so nothing it swallowed can be overtaken. */
  settled(): Promise<void> {
    return this.gap ?? Promise.resolve();
  }

  close(): void {
    clearInterval(this.sweep);
    this.stopObserving();
    for (const timer of this.streams.values()) if (timer) clearTimeout(timer);
    this.streams.clear();
  }

  private async verify(streams: FencedStream[], failClosed: boolean): Promise<void> {
    if (streams.length === 0) return;
    try {
      const now = this.clock.now();
      const nativeIds = [...new Set(streams.flatMap(stream => stream.nativeSessionId ? [stream.nativeSessionId] : []))];
      const rows = await this.db.select({ id: players.id, seasonId: players.seasonId,
        placementVersion: players.placementVersion, authVersion: accounts.authVersion }).from(players)
        .innerJoin(accounts, eq(accounts.id, players.accountId))
        .where(inArray(players.id, [...new Set(streams.map(stream => stream.playerId))]));
      const sessions = nativeIds.length === 0 ? [] : await this.db.select({ id: nativeSessions.id,
        accountId: nativeSessions.accountId, version: nativeSessions.version, expiresAt: nativeSessions.expiresAt })
        .from(nativeSessions).innerJoin(accounts, eq(accounts.id, nativeSessions.accountId))
        .where(and(inArray(nativeSessions.id, nativeIds), isNull(nativeSessions.revokedAt), gt(nativeSessions.expiresAt, now),
          isNull(accounts.deletionApprovedAt), not(accountIsBanned)));
      const byPlayer = new Map(rows.map(row => [row.id, row]));
      const bySession = new Map(sessions.map(session => [session.id, session]));
      for (const stream of streams) {
        if (!this.streams.has(stream)) continue;
        const row = byPlayer.get(stream.playerId);
        const session = stream.nativeSessionId === undefined ? undefined : bySession.get(stream.nativeSessionId);
        if (row?.authVersion !== stream.authVersion || (stream.nativeSessionId !== undefined
          && (session?.accountId !== stream.accountId || session.version !== stream.authVersion))) {
          stream.revoke('auth');
        } else if (row.seasonId !== stream.seasonId || row.placementVersion !== stream.placementVersion) {
          stream.revoke('placement');
        } else if (session && this.streams.get(stream) === null) {
          const timer = setTimeout(() => { stream.revoke('auth'); },
            Math.min(MAX_TIMER_MS, session.expiresAt.getTime() - now.getTime()));
          timer.unref();
          this.streams.set(stream, timer);
        }
      }
    } catch (err) {
      this.log.warn({ err }, 'stream fence check failed');
      if (failClosed) for (const stream of streams) if (this.streams.has(stream)) stream.revoke('auth');
    }
  }
}
