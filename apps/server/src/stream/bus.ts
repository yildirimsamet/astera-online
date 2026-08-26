import { z } from 'zod';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Queryable } from '../db/client.js';

export const CHANNEL = 'astera_events';

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
const heartbeatPayload = z.object({ heartbeat: z.string().uuid() });

export type StreamEvent = z.infer<typeof eventPayload>;

/**
 * What a shard is told about, in the server's own words.
 *
 * The client decides which of its own reads each one moves — that mapping is a
 * client concern and lives there. This says what HAPPENED, never what to fetch.
 */
export type ShardEventKind =
  | 'launch'
  | 'arrival'
  | 'mining'
  | 'world'
  | 'score'
  | 'chat'
  | 'chronicle'
  | 'season'
  | 'rollover'
  | 'impact'
  | 'control'
  | 'transfer'
  | 'recovery'
  | 'protection'
  | 'clan';

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
export const PRIVATE_PREFIX = 'private:';

export type ClanPrivateEventKind = 'membership' | 'request' | 'chat' | 'depot' | 'aid';

/** `JSON.parse` throws on malformed input; the schema handles everything else. */
function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

type Listener = (event: StreamEvent) => void;
type ResetObserver = () => void;

export interface EventBusOptions {
  /** A self-NOTIFY proves the dedicated LISTEN socket is receiving, not merely allocated. */
  heartbeatMs?: number;
  /** Reads bypass projection caches once the last self-heartbeat is older than this. */
  heartbeatTimeoutMs?: number;
  /** Test hook for the explicit LISTEN reconnect loop. */
  reconnectBackoffSeconds?: number;
}

const DEFAULT_HEARTBEAT_MS = 1_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 3_000;

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
  /** Distinguishes a retired postgres.js client from the one currently owned. */
  private connectionToken: symbol | null = null;
  private listener: postgres.ReservedSql | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInFlight = false;
  private connecting = false;
  private stopping = false;
  private registered = false;
  private reconnectAttempt = 0;
  private generation = 0;
  private reconnects = 0;
  private lastListenAt: number | null = null;
  private lastHeartbeatAt: number | null = null;
  private listenerPid: number | null = null;
  private readonly heartbeatId = randomUUID();
  private readonly heartbeatMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly listeners = new Map<string, Set<Listener>>();
  /** Internal consumers run before sockets, so a refetch cannot beat cache invalidation. */
  private readonly observers = new Set<Listener>();
  /** A lost LISTEN can miss invalidations; every local cache must reset across that gap. */
  private readonly resetObservers = new Set<ResetObserver>();
  /** Counters for `/health`, so a dead live path is visible from outside. */
  private delivered = 0;
  private fanoutDeliveries = 0;
  private maxFanout = 0;
  private lastEventAt: number | null = null;

  constructor(
    private readonly url: string,
    private readonly log: FastifyBaseLogger,
    private readonly options: EventBusOptions = {},
  ) {
    this.heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
    if (this.heartbeatMs <= 0 || this.heartbeatTimeoutMs <= this.heartbeatMs) {
      throw new Error('EventBus heartbeat timeout must be greater than its positive interval');
    }
  }

  /** LISTEN needs its own connection — it cannot share the request pool. */
  async start(): Promise<void> {
    if (this.connection) return;
    this.stopping = false;
    const connection = this.createConnection();
    try {
      await this.connectListener();
      this.heartbeatTimer = setInterval(() => {
        void this.pulse();
      }, this.heartbeatMs);
      this.heartbeatTimer.unref();
      await this.pulse();
    } catch (err) {
      this.stopping = true;
      this.registered = false;
      this.retireConnection(connection);
      await connection.end({ timeout: 0 }).catch(() => undefined);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.registered = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.listeners.clear();
    this.observers.clear();
    this.resetObservers.clear();
    const listener = this.listener;
    this.listener = null;
    try {
      if (listener) await listener.unsafe(`unlisten "${CHANNEL}"`);
    } catch {
      // Connection already gone; nothing to unlisten from.
    }
    listener?.release();
    if (this.connection) {
      const connection = this.connection;
      this.connection = null;
      this.connectionToken = null;
      await connection.end({ timeout: 5 });
    }
    this.listenerPid = null;
    this.lastHeartbeatAt = null;
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
    const decoded = safeJson(payload);
    const heartbeat = heartbeatPayload.safeParse(decoded);
    if (heartbeat.success) {
      if (heartbeat.data.heartbeat === this.heartbeatId) {
        const now = Date.now();
        // A half-open socket can recover without emitting a close. Anything may
        // have committed during the expired lease, so caches are discarded
        // before this pulse is allowed to make the bus healthy again.
        if (
          this.lastHeartbeatAt !== null
          && now - this.lastHeartbeatAt > this.heartbeatTimeoutMs
        ) {
          this.resetLocalState();
        }
        this.lastHeartbeatAt = now;
      }
      return;
    }
    const parsed = eventPayload.safeParse(decoded);
    if (!parsed.success) {
      this.log.warn({ payload }, 'unparseable event payload');
      return;
    }
    const event = parsed.data;
    this.delivered += 1;
    this.lastEventAt = Date.now();
    for (const observer of this.observers) {
      try {
        observer(event);
      } catch (err) {
        // Projection invalidation is an optimisation boundary. A broken observer
        // must be visible, but it must never silence the live galaxy.
        this.log.warn({ err }, 'event bus observer threw');
      }
    }
    const listeners = this.listeners.get(topicOf(event));
    const fanout = listeners?.size ?? 0;
    this.fanoutDeliveries += fanout;
    this.maxFanout = Math.max(this.maxFanout, fanout);
    for (const listener of listeners ?? []) {
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

  /** Observe every parsed event locally; used for replica-local cache invalidation. */
  observe(listener: Listener): () => void {
    this.observers.add(listener);
    return () => this.observers.delete(listener);
  }

  /** Reset replica-local derived state whenever LISTEN reconnects across a lossy gap. */
  observeReset(listener: ResetObserver): () => void {
    this.resetObservers.add(listener);
    return () => this.resetObservers.delete(listener);
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
  status(): {
    listening: boolean;
    generation: number;
    reconnects: number;
    lastListenAt: string | null;
    heartbeatAgeSeconds: number | null;
    topics: number;
    subscribers: number;
    delivered: number;
    fanoutDeliveries: number;
    maxFanout: number;
    idleSeconds: number | null;
  } {
    const now = Date.now();
    const heartbeatAgeMs = this.lastHeartbeatAt === null ? null : now - this.lastHeartbeatAt;
    return {
      listening:
        this.connection !== null
        && this.listener !== null
        && this.registered
        && heartbeatAgeMs !== null
        && heartbeatAgeMs <= this.heartbeatTimeoutMs,
      generation: this.generation,
      reconnects: this.reconnects,
      lastListenAt: this.lastListenAt === null ? null : new Date(this.lastListenAt).toISOString(),
      heartbeatAgeSeconds:
        heartbeatAgeMs === null ? null : Math.round(heartbeatAgeMs / 100) / 10,
      topics: this.listeners.size,
      subscribers: [...this.listeners.values()].reduce((total, set) => total + set.size, 0),
      delivered: this.delivered,
      fanoutDeliveries: this.fanoutDeliveries,
      maxFanout: this.maxFanout,
      /**
       * How long since anything came down the channel, or null if nothing ever has.
       *
       * `delivered` says whether the path has ever worked; this says whether it is
       * still working. A socket that is open, has a subscriber count, and has been
       * silent for an hour on a galaxy with people in it is the failure mode that
       * neither of the other two figures can show.
       */
      idleSeconds:
        this.lastEventAt === null ? null : Math.round((now - this.lastEventAt) / 1000),
    };
  }

  /** Diagnostic hook for the real reconnect integration test; never exposed by an HTTP route. */
  listenerBackendPid(): number | null {
    return this.listenerPid;
  }

  private async pulse(): Promise<void> {
    if (this.stopping || this.heartbeatInFlight || !this.listener) return;
    this.heartbeatInFlight = true;
    try {
      await this.listener.unsafe('select pg_notify($1, $2)', [
        CHANNEL,
        JSON.stringify({ heartbeat: this.heartbeatId }),
      ]);
    } catch {
      // `onclose` owns the reconnect and immediate cache reset. A query can fail
      // before that callback runs; the heartbeat lease is the second fail-closed
      // boundary and logging every pulse would hide the useful reconnect line.
    } finally {
      this.heartbeatInFlight = false;
    }
  }

  private async connectListener(): Promise<void> {
    if (this.stopping || this.connecting) return;
    this.connecting = true;
    let candidate: postgres.ReservedSql | null = null;
    const connection = this.connection ?? this.createConnection();
    try {
      const listener = await connection.reserve();
      candidate = listener;
      if (this.shouldStop() || this.connection !== connection) {
        listener.release();
        candidate = null;
        return;
      }
      const result = await listener.unsafe(`listen "${CHANNEL}"`);
      if (this.shouldStop() || this.connection !== connection) {
        listener.release();
        candidate = null;
        return;
      }
      const reconnect = this.generation > 0;
      // Clear before the socket is declared healthy. `onclose` normally already
      // did this; repeating it makes reconnect correct even after an unusual
      // driver path that reopens without surfacing the close callback.
      if (reconnect) this.resetLocalState();
      this.listener = listener;
      candidate = null;
      this.listenerPid = result.state.pid;
      this.generation += 1;
      if (reconnect) this.reconnects += 1;
      this.reconnectAttempt = 0;
      this.registered = true;
      this.lastListenAt = Date.now();
      this.lastHeartbeatAt = this.lastListenAt;
      void this.pulse();
      this.log.info(
        { generation: this.generation, reconnect },
        reconnect ? 'event bus reconnected' : 'event bus listening',
      );
    } catch (err) {
      candidate?.release();
      this.retireConnection(connection);
      if (this.generation === 0) throw err;
      void connection.end({ timeout: 0 }).catch(() => undefined);
      this.log.warn({ err }, 'event bus reconnect attempt failed');
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private onListenerClosed(token: symbol): void {
    if (this.stopping || token !== this.connectionToken || !this.connection) return;
    const wasRegistered = this.registered || this.listener !== null;
    const connection = this.connection;
    this.connection = null;
    this.connectionToken = null;
    this.registered = false;
    this.listener = null;
    this.listenerPid = null;
    this.lastHeartbeatAt = null;
    if (wasRegistered) this.resetLocalState();
    // A killed reserved postgres.js connection can leave a subsequent
    // `reserve()` pending forever. This client exists only for LISTEN, so retire
    // the whole one-connection pool and reconnect with a clean client.
    void connection.end({ timeout: 0 }).catch(() => undefined);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const configured = this.options.reconnectBackoffSeconds;
    const seconds = configured ?? Math.min(30, 2 ** Math.min(this.reconnectAttempt - 1, 5));
    const jitter = configured === undefined ? 0.75 + Math.random() * 0.5 : 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectListener().catch((err: unknown) => {
        this.log.warn({ err }, 'event bus reconnect failed');
        this.scheduleReconnect();
      });
    }, seconds * 1000 * jitter);
    this.reconnectTimer.unref();
  }

  /** `stop()` may run while an awaited reserve/LISTEN handshake is in flight. */
  private shouldStop(): boolean {
    return this.stopping;
  }

  private resetLocalState(): void {
    for (const observer of this.resetObservers) {
      try {
        observer();
      } catch (err) {
        this.log.warn({ err }, 'event bus reset observer threw');
      }
    }
  }

  /** A LISTEN client owns exactly one socket and is cheap to recreate after loss. */
  private createConnection(): postgres.Sql {
    const token = Symbol('event-bus-connection');
    const reconnectBackoffSeconds = this.options.reconnectBackoffSeconds;
    const connection = postgres(this.url, {
      max: 1,
      idle_timeout: 0,
      max_lifetime: 0,
      onnotice: () => undefined,
      // postgres.js' high-level `listen()` hides its private socket close and
      // reconnect lifecycle. A reserved connection makes loss observable at the
      // instant the driver sees it, which is the cache-correctness boundary.
      onnotify: (channel: string, payload: string) => {
        if (channel === CHANNEL) this.dispatch(payload);
      },
      onclose: () => {
        this.onListenerClosed(token);
      },
      connection: { application_name: 'astera-api-listen' },
      ...(reconnectBackoffSeconds === undefined
        ? {}
        : { backoff: () => reconnectBackoffSeconds }),
    } as postgres.Options<Record<string, never>> & {
      onnotify: (channel: string, payload: string) => void;
    });
    this.connection = connection;
    this.connectionToken = token;
    return connection;
  }

  private retireConnection(connection: postgres.Sql): void {
    if (this.connection !== connection) return;
    this.connection = null;
    this.connectionToken = null;
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

/** A narrow invalidation on the existing player-private topic. No private data rides SSE. */
export async function publishPrivate(
  tx: Queryable,
  playerId: string,
  kind: ClanPrivateEventKind,
): Promise<void> {
  await publish(tx, playerId, `${PRIVATE_PREFIX}clan-${kind}`);
}

/**
 * Announce that something happened in a galaxy, to everybody living in it. D53.
 *
 * Same transactional rule as `publish`, and the same reason: a launch that rolls
 * back must not send three hundred clients to refetch a fleet that does not exist.
 *
 * The shard is the SEASON id, which is what `/api/galaxy/traffic`, `/api/galaxy`
 * and `/api/mining/field` are all already scoped by — so a subscriber is told about exactly
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
