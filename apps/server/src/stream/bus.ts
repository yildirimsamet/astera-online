import { z } from 'zod';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import type { FastifyBaseLogger } from 'fastify';
import type { Queryable } from '../db/client.js';

export const CHANNEL = 'blindspace_events';

/**
 * TWO KINDS OF EVENT ON ONE CHANNEL. D53.
 *
 * A PLAYER event is something that happened TO ONE COMMANDER — a battle resolving,
 * a scan detected, a fleet inbound. It is addressed to them and nobody else sees
 * it. That is what this bus has always carried.
 *
 * A SHARD event is something that happened IN A GALAXY, addressed to everybody
 * living in it: a fleet left a world, a raid resolved, a drill went out, a world
 * grew. It carries no id, no owner and no position — only that something of that
 * shape happened here, just now. Every client in the shard hears it and refetches
 * the payload it already had the right to read.
 *
 * WHY IT EXISTS. The player stream fires only for what happens TO YOU, and most of
 * what makes a galaxy feel inhabited happens to somebody ELSE. None of that could
 * ever produce an event for you, so it arrived on a poll — up to twenty seconds
 * for a neighbour's launch, thirty for a world changing shape. A short flight had
 * covered a fifth of its leg before anybody but its owner knew it existed.
 *
 * WHY IT LEAKS NOTHING. The payload is a shard id and a kind. What it says is
 * exactly what the poll it replaces said, sooner: go and read `/api/traffic`,
 * which is fog-enforced in the query and has been since D24. It cannot name a
 * world, a player or a heading, because there is no field here to put one in.
 * Which is also why `raiseInstrument` does NOT publish one — a ground instrument
 * is private (D15/D25), it appears in no public payload, and a broadcast timed to
 * it would be the one fact on this channel that is not already derivable.
 */
const playerEvent = z.object({ playerId: z.string().min(1), kind: z.string().min(1) });
const shardEvent = z.object({ shard: z.string().min(1), kind: z.string().min(1) });
const eventPayload = z.union([playerEvent, shardEvent]);

export type StreamEvent = z.infer<typeof eventPayload>;

/**
 * What a shard is told about, in the server's own words.
 *
 * The client decides which of its own reads each one moves — that mapping is a
 * client concern and lives there. This says what HAPPENED, never what to fetch.
 */
export type ShardEventKind = 'launch' | 'arrival' | 'mining' | 'world';

/**
 * Shard kinds go out prefixed, and the prefix is not decoration.
 *
 * The browser reads the SSE `event:` name and nothing else, and the same string
 * space already holds every notification kind — which the client turns into
 * user-visible text. A shard kind colliding with a notification kind would put a
 * line in somebody's Signals feed that nothing wrote. The namespace makes the two
 * families impossible to confuse, in both directions.
 */
export const SHARD_PREFIX = 'shard:';

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
  /** Counters for `/health`, so a dead live path is visible from outside. */
  private delivered = 0;
  private lastEventAt: number | null = null;

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
    this.delivered += 1;
    this.lastEventAt = Date.now();
    for (const listener of this.listeners.get(topicOf(event)) ?? []) {
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
    return this.listen(playerTopic(playerId), listener);
  }

  /**
   * Everything happening in one galaxy, to whoever is living in it. D53.
   *
   * A connection subscribes to this AS WELL AS to its own player topic: the two
   * carry different things and neither is a superset of the other.
   */
  subscribeShard(shard: string, listener: Listener): () => void {
    return this.listen(shardTopic(shard), listener);
  }

  private listen(topic: string, listener: Listener): () => void {
    const set = this.listeners.get(topic) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(topic, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(topic);
    };
  }

  subscriberCount(playerId: string): number {
    return this.listeners.get(playerTopic(playerId))?.size ?? 0;
  }

  shardSubscriberCount(shard: string): number {
    return this.listeners.get(shardTopic(shard))?.size ?? 0;
  }

  /**
   * WHETHER THE LIVE PATH IS ACTUALLY UP, for `/health`. D53.
   *
   * This matters more than it did. While the client polled every twenty seconds a
   * dead bus was a degradation nobody would notice; now the polls are a sixty
   * second SAFETY NET under a channel that is meant to do the work, and a bus that
   * has quietly stopped listening looks exactly like a quiet galaxy. The one thing
   * an operator cannot infer from the outside is whether the socket is open, so
   * that is what is reported.
   */
  status(): { listening: boolean; topics: number; delivered: number; idleSeconds: number | null } {
    return {
      listening: this.connection !== null && this.unlisten !== null,
      topics: this.listeners.size,
      delivered: this.delivered,
      /**
       * How long since anything came down the channel, or null if nothing ever has.
       *
       * `delivered` says whether the path has ever worked; this says whether it is
       * still working. A socket that is open, has a subscriber count, and has been
       * silent for an hour on a galaxy with people in it is the failure mode that
       * neither of the other two figures can show.
       */
      idleSeconds:
        this.lastEventAt === null ? null : Math.round((Date.now() - this.lastEventAt) / 1000),
    };
  }
}

/**
 * One flat map, two namespaces.
 *
 * A shard id and a player id are both uuids out of the same generator, so a single
 * map keyed on the bare id would deliver a galaxy's traffic to whichever commander
 * happened to share its uuid. Astronomically unlikely and trivially prevented.
 */
const playerTopic = (playerId: string): string => `p:${playerId}`;
const shardTopic = (shard: string): string => `s:${shard}`;
const topicOf = (event: StreamEvent): string =>
  'playerId' in event ? playerTopic(event.playerId) : shardTopic(event.shard);

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

/**
 * Announce that something happened in a galaxy, to everybody living in it. D53.
 *
 * Same transactional rule as `publish`, and the same reason: a launch that rolls
 * back must not send fifty clients to refetch a fleet that does not exist.
 *
 * The shard is the SEASON id, which is what `/api/traffic`, `/api/galaxy` and
 * `/api/mining` are all already scoped by — so a subscriber is told about exactly
 * the rows it is entitled to read and never about a galaxy it is not in.
 */
export async function publishShard(
  tx: Queryable,
  shard: string,
  kind: ShardEventKind,
): Promise<void> {
  const payload = JSON.stringify({
    shard,
    kind: `${SHARD_PREFIX}${kind}`,
  } satisfies StreamEvent);
  await tx.execute(sql`select pg_notify(${CHANNEL}, ${payload})`);
}
