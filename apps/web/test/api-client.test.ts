import { describe, expect, it, vi } from 'vitest';
import { Api, ApiError } from '../src/api/client.js';
import { planetView } from './fixtures.js';

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

const SESSION = {
  accountId: 'a1',
  username: 'vantage',
  displayName: 'Vantage',
  accessToken: 'fresh-token',
};

/**
 * The payload this test feeds to the real parser.
 *
 * Built from the shared fixture rather than hand-written. It used to be an
 * untyped literal, which meant the compiler could not see it drift: `fleetAway`
 * was added to `planetSchema` and this object silently stopped parsing, failing at
 * runtime in a test about token refresh — a failure that says nothing about the
 * thing under test.
 */
const PLANET = planetView(
  { nextCosts: { CORE: { alloy: 200, crystal: 0 } }, score: { wealth: 1200, dominion: 0 } },
  {
    position: { x: 1, y: 2, z: 3 },
    alloy: 100,
    crystal: 20,
    alloyCap: 1000,
    crystalCap: 200,
    alloyPerHour: 40,
    crystalPerHour: 14,
    bufferAlloyCap: 640,
    bufferCrystalCap: 224,
    vaultFloor: 300,
  },
);

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
      json({ error: 'BASH_LIMIT', message: 'You have hit this planet too many times recently' }, 403),
    );

    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(api.launch('p2', { WASP: 1 })).rejects.toMatchObject({
      code: 'BASH_LIMIT',
      status: 403,
      message: 'You have hit this planet too many times recently',
    });
  });

  it('rejects a response whose shape has drifted instead of rendering undefined', async () => {
    const fetch = vi.fn(() => json({ planet: { id: 'p1' } }));
    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(api.planet()).rejects.toThrow();
  });

  /* ── identity, D21 ──────────────────────────────────────── */

  describe('signing in', () => {
    it('holds the access token in memory after a register', async () => {
      const fetch = vi.fn(() => json(SESSION));
      const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });

      expect(api.accessToken).toBeNull();
      const session = await api.register('Vantage', 'a-real-password');

      expect(session.username).toBe('vantage');
      expect(api.accessToken).toBe('fresh-token');
    });

    it('sends the credentials as a body, never as a query string', async () => {
      const seen: { url: string; body: string }[] = [];
      const fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
        // Narrowed to a string here rather than at the assertion: `RequestInit`'s
        // body is a union that includes Blob and streams, and stringifying it
        // later is how a test starts asserting against "[object Object]".
        seen.push({
          url: pathOf(url),
          body: typeof init?.body === 'string' ? init.body : '',
        });
        return json(SESSION);
      });

      const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
      await api.login('Vantage', 'a-real-password');

      // A password in a URL lands in every proxy log between here and the server.
      expect(seen[0]?.url).toBe('/api/auth/login');
      expect(seen[0]?.url).not.toContain('a-real-password');
      expect(seen[0]?.body).toContain('a-real-password');
    });

    /**
     * A 401 from a LOGIN is the answer, not a stale token. Refreshing and retrying
     * would turn one wrong password into two requests and a rotated cookie.
     */
    it('does not try to refresh when a login is refused', async () => {
      const calls: string[] = [];
      const fetch = vi.fn((url: string | URL | Request) => {
        calls.push(pathOf(url));
        return json({ error: 'BAD_CREDENTIALS', message: 'That name and password do not match' }, 401);
      });

      const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
      await expect(api.login('Vantage', 'wrong')).rejects.toMatchObject({
        code: 'BAD_CREDENTIALS',
      });
      expect(calls).toEqual(['/api/auth/login']);
    });

    it('drops the token on sign-out even when the request fails', async () => {
      const fetch = vi.fn((url: string | URL | Request) => {
        if (pathOf(url).endsWith('/api/auth/logout')) return Promise.reject(new Error('offline'));
        return json(SESSION);
      });

      const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
      await api.login('Vantage', 'a-real-password');
      expect(api.accessToken).toBe('fresh-token');

      // Must not throw, and must not leave this tab holding a live credential.
      await api.logout();
      expect(api.accessToken).toBeNull();
    });
  });

  describe('choosing a galaxy', () => {
    const SERVERS = {
      servers: [
        {
          code: 'EU-1',
          name: 'Vantage',
          ordinal: 1,
          planets: 38,
          capacity: 50,
          online: 6,
          status: 'open',
          endsAt: '2026-03-15T00:00:00.000Z',
          yours: false,
        },
      ],
      placement: null,
    };

    it('reads the list without a token', async () => {
      const fetch = vi.fn(() => json(SERVERS));
      const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });

      const list = await api.servers();
      expect(list.servers[0]?.status).toBe('open');
      expect(list.servers[0]?.endsAt).toBeInstanceOf(Date);
      expect(list.placement).toBeNull();
    });

    it('rejects a status the client does not know how to draw', async () => {
      const fetch = vi.fn(() =>
        json({ ...SERVERS, servers: [{ ...SERVERS.servers[0], status: 'maintenance' }] }),
      );
      const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
      await expect(api.servers()).rejects.toThrow();
    });

    it('escapes the shard code rather than pasting it into a path', async () => {
      const calls: string[] = [];
      const fetch = vi.fn((url: string | URL | Request) => {
        calls.push(pathOf(url));
        return json({ error: 'NO_SUCH_SERVER', message: 'No galaxy by that name' }, 404);
      });

      const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
      await expect(api.joinServer('EU-1/../admin')).rejects.toMatchObject({
        code: 'NO_SUCH_SERVER',
      });
      expect(calls[0]).toBe('/api/servers/EU-1%2F..%2Fadmin/join');
    });
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
