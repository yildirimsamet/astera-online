import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { publish, publishShard, type EventBus } from '../src/stream/bus.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE ONE REALTIME SURFACE, TESTED THROUGH A REAL SOCKET.
 *
 * `/api/stream` had no test of any kind, and it is the route the whole liveness
 * model now rests on: since D53 the client's polls are a sixty-second net under
 * it rather than the mechanism, so a stream that silently stopped carrying one of
 * its two topics would look exactly like a quiet galaxy.
 *
 * It cannot be exercised with `app.inject`. The handler calls `reply.hijack()` and
 * writes to the raw socket, which is precisely the part worth testing, so this
 * listens on an ephemeral port and reads the frames off a real response body.
 */
describe('the event stream', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let bus: EventBus;
  let close: () => Promise<void>;
  let url: string;
  let token: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    bus = built.bus;
    close = built.close;
    await app.ready();
    await bus.start();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    url = `http://127.0.0.1:${String(address.port)}/api/stream`;

    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    token = await tokens.issueAccess(f.accountIds[0]!);
  });

  afterEach(async () => {
    await close();
  });

  /**
   * Open a connection and collect SSE event names until `want` of them arrive.
   *
   * Returns a `done` promise and an `abort`, because a stream that is never closed
   * keeps a subscription and a heartbeat alive past the end of the test.
   *
   * IT GIVES UP, AND THAT IS NOT A DETAIL. The failure this file exists to catch is
   * an event that never arrives, and a reader with no deadline turns that into a
   * ninety-second hang and a timeout with nothing in it — measured, when the shard
   * subscription was removed to check these tests were real. A short deadline makes
   * the same failure arrive in two seconds saying what it was waiting for.
   */
  const PATIENCE_MS = 2000;

  const listen = (want: number) => {
    const controller = new AbortController();
    const names: string[] = [];
    const deadline = setTimeout(() => {
      controller.abort();
    }, PATIENCE_MS);
    const done = (async () => {
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (names.length < want) {
        const { done: finished, value } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });
        let split = buffer.indexOf('\n\n');
        while (split !== -1) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const name = frame
            .split('\n')
            .find((line) => line.startsWith('event:'))
            ?.slice(6)
            .trim();
          if (name) names.push(name);
          split = buffer.indexOf('\n\n');
        }
      }
      if (names.length < want) {
        throw new Error(
          `waited ${String(PATIENCE_MS)}ms for ${String(want)} event(s); got [${names.join(', ')}]`,
        );
      }
      return names;
    })().finally(() => {
      clearTimeout(deadline);
    });
    return {
      done,
      abort: () => {
        clearTimeout(deadline);
        controller.abort();
      },
      names,
    };
  };

  /** The socket has to be open before a NOTIFY can reach it. */
  const connected = async (playerId: string): Promise<void> => {
    for (let i = 0; i < 100; i += 1) {
      if (bus.subscriberCount(playerId) > 0) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('the stream never subscribed');
  };

  it('carries what happened to this commander', async () => {
    const stream = listen(1);
    await connected(f.playerIds[0]!);
    await publish(f.db, f.playerIds[0]!, 'raided');
    await expect(stream.done).resolves.toEqual(['raided']);
    stream.abort();
  });

  /**
   * AND WHAT HAPPENED IN THIS GALAXY. D53.
   *
   * The second topic, and the whole point of the phase: a neighbour launching is
   * not an event addressed to this commander and could never reach them before.
   */
  it('carries what happened in this galaxy', async () => {
    const stream = listen(1);
    await connected(f.playerIds[0]!);
    await publishShard(f.db, f.seasonId, 'launch');
    await expect(stream.done).resolves.toEqual(['shard:launch']);
    stream.abort();
  });

  /** Both topics on one connection: neither replaces the other. */
  it('carries both on the same socket', async () => {
    const stream = listen(2);
    await connected(f.playerIds[0]!);
    await publishShard(f.db, f.seasonId, 'arrival');
    await publish(f.db, f.playerIds[0]!, 'raided');
    const names = await stream.done;
    expect(names.sort()).toEqual(['raided', 'shard:arrival']);
    stream.abort();
  });

  /**
   * A GALAXY THIS COMMANDER IS NOT IN MUST NOT REACH THEM.
   *
   * Ten shards run on one deployment and share this Postgres channel, so the
   * subscription being scoped to the caller's OWN season — read from the player
   * row, never from anything a client can influence — is what keeps them apart.
   */
  it('does not carry another galaxy\'s events', async () => {
    const stream = listen(1);
    await connected(f.playerIds[0]!);
    await publishShard(f.db, crypto.randomUUID(), 'launch');
    // The foreign event must not arrive; the local one must, and its arrival is
    // what proves the socket was working rather than merely silent.
    await publish(f.db, f.playerIds[0]!, 'raided');
    await expect(stream.done).resolves.toEqual(['raided']);
    stream.abort();
  });

  /**
   * BOTH SUBSCRIPTIONS ARE RELEASED ON DISCONNECT.
   *
   * A leaked listener is one per reconnect, and a phone on a flaky connection
   * reconnects all day. The shard topic doubled the number of subscriptions a
   * connection holds, so it doubled what a missing `unsubscribeShard` would leak.
   */
  it('releases both subscriptions when the client goes away', async () => {
    const stream = listen(1);
    await connected(f.playerIds[0]!);
    expect(bus.shardSubscriberCount(f.seasonId)).toBe(1);

    stream.abort();
    await stream.done.catch(() => undefined); // aborted on purpose

    for (let i = 0; i < 100; i += 1) {
      if (bus.subscriberCount(f.playerIds[0]!) === 0) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(bus.subscriberCount(f.playerIds[0]!)).toBe(0);
    expect(bus.shardSubscriberCount(f.seasonId)).toBe(0);
  });

  it('refuses a connection with no credential', async () => {
    const res = await fetch(url);
    expect(res.status).toBe(401);
  });
});
