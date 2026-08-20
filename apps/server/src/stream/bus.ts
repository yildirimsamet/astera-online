import { z } from 'zod';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import type { FastifyBaseLogger } from 'fastify';
import type { Queryable } from '../db/client.js';

export const CHANNEL = 'blindspace_events';

const eventPayload = z.object({ playerId: z.string().min(1), kind: z.string().min(1) });

export type StreamEvent = z.infer<typeof eventPayload>;

/** `JSON.parse` throws on malformed input; the schema handles everything else. */
function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
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

  /**
   * PARSED, NOT CAST.
   *
   * This was `JSON.parse(payload) as StreamEvent`, and the cast was a lie in two
   * measured ways.
   *
   * A HALF-FORMED MESSAGE WAS DELIVERED AS A REAL ONE. `{"playerId":"<a real id>"}`
   * with no `kind` parses to an object, matches a subscriber, and is handed to the
   * listener — which forwards it to the browser as a server-sent event with
   * `kind: undefined`. The client then invalidates queries on a message that says
   * nothing happened. There is a test for exactly this payload, and it fails
   * against the old code.
   *
   * AND `JSON.parse` ACCEPTS FAR MORE THAN AN OBJECT. `null`, `7` and `"hello"` are
   * all valid JSON documents, so on `null` the parse succeeded and `.playerId` threw
   * a TypeError on the next line — outside the `try`, inside a postgres.js
   * notification callback. Measured: postgres.js absorbs that, so the LISTEN socket
   * does survive today. But the fan-out for every player on the server then depends
   * on a library swallowing our exceptions, which is not a property this code should
   * be resting on.
   *
   * A schema costs one allocation per notification and removes both. This is the
   * boundary `engineering-standards.md` means by "parse untrusted input with Zod";
   * that a trusted process writes the payload today does not make the socket a safe
   * place to assume it.
   */
  private dispatch(payload: string): void {
    const parsed = eventPayload.safeParse(safeJson(payload));
    if (!parsed.success) {
      this.log.warn({ payload }, 'unparseable event payload');
      return;
    }
    const event = parsed.data;
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
