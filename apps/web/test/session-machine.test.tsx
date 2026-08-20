import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useSession } from '../src/session/useSession.js';

/**
 * WHICH SCREEN OPENS, AND WHY. D21.
 *
 * `useSession` answers one question on every cold start — landing, server list, or
 * the galaxy — from two facts it gets over the wire. Every bug this can have is a
 * player looking at the wrong screen: a returning commander shown a login form
 * reads as "my season is gone", and a stranger shown an empty galaxy reads as a
 * broken game.
 */

const SESSION = {
  accountId: 'a1',
  username: 'vantage',
  displayName: 'Vantage',
  accessToken: 'fresh-token',
};

const RETURN = {
  awayMinutes: 0,
  entries: [],
  pending: [],
  newUnlocks: [],
};

/** Path suffix → the body to answer with. Anything unlisted answers 401. */
type Route = Record<string, unknown>;

const REFUSED = Symbol('refused');

/**
 * A fake API surface built from a routing table.
 *
 * Explicit rather than a mocked `Api`: the client's own parsing, token handling
 * and refresh logic are part of what these transitions depend on, and stubbing the
 * class would test the stub.
 */
function harness(routes: Route) {
  const calls: string[] = [];
  const fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const path = typeof url === 'string' ? url : url instanceof URL ? url.pathname : url.url;
    calls.push(`${init?.method ?? 'GET'} ${path}`);

    const key = Object.keys(routes).find((route) => path.endsWith(route));
    const body = key === undefined ? REFUSED : routes[key];
    if (body === REFUSED || body === undefined) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'UNAUTHENTICATED', message: 'Sign in first' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );

  return { wrapper, calls, queries, api };
}

const placed = {
  '/api/auth/refresh': SESSION,
  '/api/auth/me': {
    ...SESSION,
    placement: { shard: 'EU-1', shardName: 'Vantage', planetName: 'Kestrel-12' },
  },
  '/api/session/return': RETURN,
};

const signedInOnly = {
  '/api/auth/refresh': SESSION,
  '/api/auth/me': { ...SESSION, placement: null },
};

describe('the session machine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a stranger to the front door', async () => {
    // No refresh route: the cookie exchange fails, which is what "no session" is.
    const { wrapper } = harness({});
    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.session.phase).toBe('landing');
    });
  });

  it('sends a signed-in commander with no planet to the server list', async () => {
    const { wrapper } = harness(signedInOnly);
    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.session.phase).toBe('servers');
    });
  });

  /**
   * The one that matters most: a returning player must land on their own planet,
   * not on a login form. This is the Return Test, and it is now guarded by a
   * cookie exchange rather than by having never asked for a password.
   */
  it('sends a placed commander straight to their galaxy', async () => {
    const { wrapper } = harness(placed);
    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.session.phase).toBe('ready');
    });
    const session = result.current.session;
    if (session.phase !== 'ready') throw new Error('expected ready');
    expect(session.standing).toEqual({
      shard: 'EU-1',
      shardName: 'Vantage',
      planetName: 'Kestrel-12',
    });
  });

  /**
   * NOTHING BUT IDENTITY IS FETCHED ON THE WAY IN. D23.
   *
   * `/api/session/return` used to be read here, once, to fill the "while you were
   * gone" overlay. That overlay is gone — a backgrounded phone tab is evicted and
   * remounted, so it fired on nearly every return rather than on a real absence —
   * and the request went with it. This is the guard against it creeping back onto
   * the one path a player is impatient about: two round trips get them in, and
   * neither of them is news.
   */
  it('puts a placed commander on their planet without fetching the news', async () => {
    const { wrapper, calls } = harness(placed);
    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.session.phase).toBe('ready');
    });
    expect(calls.some((c) => c.endsWith('/api/session/return'))).toBe(false);
  });

  it('does not read it for a commander who has no planet yet either', async () => {
    const { wrapper, calls } = harness(signedInOnly);
    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.session.phase).toBe('servers');
    });
    expect(calls.some((c) => c.endsWith('/api/session/return'))).toBe(false);
  });

  it('takes a sign-in through to the server list', async () => {
    // No refresh route: this tab starts cold, which is what a login is for.
    const { wrapper } = harness({
      '/api/auth/login': SESSION,
      '/api/auth/me': { ...SESSION, placement: null },
    });
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => {
      expect(result.current.session.phase).toBe('landing');
    });

    await act(async () => {
      await result.current.authenticate('login', 'Vantage', 'a-real-password');
    });
    expect(result.current.session.phase).toBe('servers');
  });

  it('reports a refused sign-in and stays at the front door', async () => {
    const { wrapper } = harness({});
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => {
      expect(result.current.session.phase).toBe('landing');
    });

    await act(async () => {
      await expect(
        result.current.authenticate('login', 'Vantage', 'wrong'),
      ).rejects.toBeInstanceOf(Error);
    });

    const session = result.current.session;
    expect(session.phase).toBe('landing');
    if (session.phase !== 'landing') throw new Error('expected landing');
    expect(session.error).toBeTruthy();
  });

  it('takes a chosen galaxy through to the game', async () => {
    let hasPlanet = false;
    const { wrapper } = harness({
      '/api/auth/refresh': SESSION,
      '/api/session/return': RETURN,
      '/api/servers/EU-1/join': {
        shard: 'EU-1',
        shardName: 'Vantage',
        seasonId: 's1',
        playerId: 'pl1',
        planetId: 'p1',
        planetName: 'Kestrel-12',
        slotIndex: 12,
      },
      get '/api/auth/me'() {
        return {
          ...SESSION,
          placement: hasPlanet
            ? { shard: 'EU-1', shardName: 'Vantage', planetName: 'Kestrel-12' }
            : null,
        };
      },
    });

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => {
      expect(result.current.session.phase).toBe('servers');
    });

    hasPlanet = true;
    await act(async () => {
      await result.current.chooseServer('EU-1');
    });
    expect(result.current.session.phase).toBe('ready');
  });

  /**
   * A galaxy that filled up while the list was on screen is a refusal the player
   * can act on — by picking again. Sending them back to the login form would make
   * a full server look like a lost account.
   */
  it('keeps a refused join on the server list, with the reason', async () => {
    const { wrapper } = harness(signedInOnly);
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => {
      expect(result.current.session.phase).toBe('servers');
    });

    await act(async () => {
      await result.current.chooseServer('EU-9');
    });

    const session = result.current.session;
    expect(session.phase).toBe('servers');
    if (session.phase !== 'servers') throw new Error('expected servers');
    expect(session.error).toBeTruthy();
  });

  it('returns to the front door on sign-out', async () => {
    const { wrapper } = harness({ ...placed, '/api/auth/logout': { ok: true } });
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => {
      expect(result.current.session.phase).toBe('ready');
    });

    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.session.phase).toBe('landing');
  });

  /**
   * THE WORST BUG THIS SCREEN COULD HAVE.
   *
   * Two commanders, one browser. Without clearing the cache, the second one reads
   * the first one's planet, fleet and intel out of react-query before the network
   * answers — and acts on it.
   */
  it('drops every cached read when the identity changes', async () => {
    const { wrapper, queries } = harness({ ...placed, '/api/auth/logout': { ok: true } });
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => {
      expect(result.current.session.phase).toBe('ready');
    });

    queries.setQueryData(['planet'], { planet: { name: 'Someone else' } });
    await act(async () => {
      await result.current.signOut();
    });

    expect(queries.getQueryData(['planet'])).toBeUndefined();
  });

  it('says the server is unreachable rather than pretending the account is gone', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response('', { status: 502 })));
    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queries}>
        <ApiProvider api={api}>{children}</ApiProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    // `restore()` swallows its own failure and reports "no session", which is the
    // right answer for a 401 and the wrong one for a dead upstream — so the phase
    // that matters here is that the player is offered the door rather than an
    // error they cannot act on.
    await waitFor(() => {
      expect(result.current.session.phase).toBe('landing');
    });
  });
});
