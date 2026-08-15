import { describe, expect, it, vi } from 'vitest';
import { Api, ApiError } from '../src/api/client.js';

/**
 * The credential path.
 *
 * Access tokens last fifteen minutes and a session lasts thirty days, so every
 * single request in this app will eventually meet a 401. What happens next is not
 * an edge case — it is the normal path — and getting it wrong looks exactly like
 * "the game logged me out for no reason".
 */

const json = (body: unknown, status = 200): Promise<Response> =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

/** fetch takes three different shapes of first argument; only the path matters here. */
const pathOf = (url: string | URL | Request): string =>
  typeof url === 'string' ? url : url instanceof URL ? url.pathname : url.url;

const SESSION = { accountId: 'a1', displayName: 'Vantage-317', accessToken: 'fresh-token' };

const PLANET = {
  planet: {
    id: 'p1',
    name: 'Kestrel-12',
    position: { x: 1, y: 2, z: 3 },
    alloy: 100,
    crystal: 20,
    alloyCap: 1000,
    crystalCap: 200,
    alloyPerHour: 40,
    crystalPerHour: 14,
    vaultFloor: 300,
    shield: 0,
    disruptedUntil: null,
  },
  buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, RING: 0 },
  nextCosts: { CORE: { alloy: 200, crystal: 0 } },
  satellites: {},
  satelliteSlots: 1,
  fleet: { WASP: 12 },
  ground: {},
  score: { wealth: 1200, dominion: 0 },
};

describe('the API client', () => {
  it('refreshes and retries once when the access token has expired', async () => {
    const calls: string[] = [];
    const fetch = vi.fn((url: string | URL | Request) => {
      const path = pathOf(url);
      calls.push(path);
      if (path.endsWith('/api/auth/refresh')) return json(SESSION);
      // Expired the first time, accepted after the refresh.
      if (calls.filter((c) => c.endsWith('/api/planet')).length === 1) {
        return json({ error: 'UNAUTHENTICATED', message: 'Sign in first' }, 401);
      }
      return json(PLANET);
    });

    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    const planet = await api.planet();

    expect(planet.planet.name).toBe('Kestrel-12');
    expect(calls).toEqual(['/api/planet', '/api/auth/refresh', '/api/planet']);
    expect(api.accessToken).toBe('fresh-token');
  });

  /**
   * Five queries expire in the same tick. If each one refreshed, four of the
   * resulting tokens would be discarded and the rotating refresh cookie would be
   * spent four times for nothing.
   */
  it('refreshes exactly once when several reads expire together', async () => {
    let refreshes = 0;
    const expired = new Set<string>();

    const fetch = vi.fn((url: string | URL | Request) => {
      const path = pathOf(url);
      if (path.endsWith('/api/auth/refresh')) {
        refreshes += 1;
        return json(SESSION);
      }
      if (!expired.has(path)) {
        expired.add(path);
        return json({ error: 'UNAUTHENTICATED', message: 'Sign in first' }, 401);
      }
      if (path.endsWith('/api/planet')) return json(PLANET);
      return json({ you: { planetId: 'p1', playerId: 'pl1' }, planets: [] });
    });

    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    await Promise.all([api.planet(), api.galaxy()]);

    expect(refreshes).toBe(1);
  });

  it('gives up rather than looping when the session is genuinely gone', async () => {
    const fetch = vi.fn(() =>
      json({ error: 'BAD_SESSION', message: 'Session is invalid or expired' }, 401),
    );

    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(api.planet()).rejects.toBeInstanceOf(ApiError);
    // The read, then one refresh attempt. There is no point re-sending a request
    // that is about to fail for the same reason, so it reports the original 401.
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(api.accessToken).toBeNull();
  });

  it('keeps the machine code so the UI can act on the refusal, not just print it', async () => {
    const fetch = vi.fn(() =>
      json({ error: 'NEWCOMER_GRACE', message: 'That commander is still under newcomer protection' }, 403),
    );

    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(api.launch('p2', { WASP: 1 })).rejects.toMatchObject({
      code: 'NEWCOMER_GRACE',
      status: 403,
      message: 'That commander is still under newcomer protection',
    });
  });

  it('rejects a response whose shape has drifted instead of rendering undefined', async () => {
    const fetch = vi.fn(() => json({ planet: { id: 'p1' } }));
    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(api.planet()).rejects.toThrow();
  });

  it('parses server-sent frames and ignores the heartbeats between them', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (text: string): void => {
          controller.enqueue(new TextEncoder().encode(text));
        };
        write(': connected\n\n');
        write('event: raided\ndata: {"playerId":"pl1","kind":"raided"}\n\n');
        write(': ping\n\n');
        // Split across two chunks: a frame must survive arriving in pieces.
        write('event: fleet_ret');
        write('urned\ndata: {"playerId":"pl1","kind":"fleet_returned"}\n\n');
        controller.close();
      },
    });

    const fetch = vi.fn(() => Promise.resolve(new Response(body, { status: 200 })));
    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });

    const seen: string[] = [];
    await api.stream((kind) => seen.push(kind), new AbortController().signal);

    expect(seen).toEqual(['raided', 'fleet_returned']);
  });
});
