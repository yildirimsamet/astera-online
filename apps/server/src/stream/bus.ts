import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import type { FastifyBaseLogger } from 'fastify';
import type { Queryable } from '../db/client.js';

export const CHANNEL = 'blindspace_events';

export interface StreamEvent {
  playerId: string;
  kind: string;
}

type Listener = (event: StreamEvent) => void;

/**
 * Server-sent-event fan-out, backed by Postgres LISTEN/NOTIFY.
 *
 * The API and the worker are separate process groups: the worker writes a
 * notification row, the API holds the player's open connection. An in-memory
 * emitter would only ever work when both happen to be the same process, which is
 * true in local dev and false in production — the worst possible combination.
 *
 * NOTIFY is transactional in Postgres: the payload is delivered on COMMIT and
 * discarded on rollback, so a client can never be told about a battle that was
 * subsequently rolled back.
 */
export class EventBus {
  private connection: postgres.Sql | null = null;
  private unlisten: (() => Promise<void>) | null = null;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(
    private readonly url: string,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** LISTEN needs its own connection — it cannot share the request pool. */
  async start(): Promise<void> {
    if (this.connection) return;
    this.connection = postgres(this.url, { max: 1, onnotice: () => undefined });
    const handle = await this.connection.listen(CHANNEL, (payload) => {
      this.dispatch(payload);
    });
    this.unlisten = handle.unlisten.bind(handle);
    this.log.info('event bus listening');
  }

  async stop(): Promise<void> {
    this.listeners.clear();
    try {
      if (this.unlisten) await this.unlisten();
    } catch {
      // Connection already gone; nothing to unlisten from.
    }
    this.unlisten = null;
    if (this.connection) {
      await this.connection.end({ timeout: 5 });
      this.connection = null;
    }
  }

  private dispatch(payload: string): void {
    let event: StreamEvent;
    try {
      event = JSON.parse(payload) as StreamEvent;
    } catch {
      this.log.warn({ payload }, 'unparseable event payload');
      return;
    }
    for (const listener of this.listeners.get(event.playerId) ?? []) {
      try {
        listener(event);
      } catch (err) {
        // One broken connection must never stop the others being served.
        this.log.warn({ err }, 'stream listener threw');
      }
    }
  }

  /** @returns an unsubscribe function. Callers MUST invoke it on disconnect. */
  subscribe(playerId: string, listener: Listener): () => void {
    const set = this.listeners.get(playerId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(playerId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(playerId);
    };
  }

  subscriberCount(playerId: string): number {
    return this.listeners.get(playerId)?.size ?? 0;
  }
}

/**
 * Announce an event to whoever is watching this player's stream.
 *
 * Call this INSIDE the transaction that produced the event: NOTIFY only fires on
 * commit, so doing it here is both correct and impossible to forget afterwards.
 */
export async function publish(tx: Queryable, playerId: string, kind: string): Promise<void> {
  const payload = JSON.stringify({ playerId, kind } satisfies StreamEvent);
  await tx.execute(sql`select pg_notify(${CHANNEL}, ${payload})`);
}
