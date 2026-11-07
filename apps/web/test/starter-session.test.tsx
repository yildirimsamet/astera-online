import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { claimSchema, meSchema } from '../src/api/schemas.js';
import { useSession } from '../src/session/useSession.js';
import { isStarterMode, setStarterMode } from '../src/starter/transport.js';
import { wireVessel } from './starterVesselFixture.js';

const base = { accountId: 'acc', username: 'new', displayName: 'New', country: 'TR', isAdmin: false, placement: null };
const standing = { id: 'ship-1', name: 'Newcomer', status: 'ACTIVE', starterGalaxyId: 'galaxy-1' };
const onPlanet = { ...base, placement: { shard: 'EU-1', shardName: 'Vantage', planetName: 'Home' } };
const aboard = { ...base, vessel: standing, starterEligible: false };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Answers `/api/auth/me` from a list, in turn, and whatever else from `routes`. */
function server(mes: unknown[], routes: Record<string, () => Response> = {}) {
  const left = [...mes];
  return vi.fn<typeof globalThis.fetch>((input) => {
    const path = new URL((typeof input === 'string' ? input : input instanceof URL ? input.href : input.url), 'https://x').pathname;
    if (path === '/api/auth/refresh') return Promise.resolve(json({ accountId: 'acc', username: 'new', displayName: 'New', country: 'TR', accessToken: 'token' }));
    if (path === '/api/auth/me') return Promise.resolve(json(left.length > 1 ? left.shift() : left[0]));
    const route = routes[path];
    return Promise.resolve(route ? route() : json({ error: 'NOPE', message: 'nope' }, 404));
  });
}

function open(fetch: typeof globalThis.fetch) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch, authTransport: null });
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  return { client, ...renderHook(useSession, { wrapper }) };
}

beforeEach(() => { window.sessionStorage.clear(); setStarterMode(false); });
afterEach(() => { setStarterMode(false); });

describe('claiming the prologue', () => {
  const session = { accountId: 'acc', username: 'new', displayName: 'New', country: 'TR', accessToken: 'token' };
  const shipClaim = { ...session, placement: null, applied: [], planet: null, vessel: wireVessel() };
  const proof = { version: COMMUNITY_POLICY_VERSION, locale: 'en' } as const;
  const claiming = (answer: () => Response) => server([{ ...base, vessel: null, starterEligible: false }], { '/api/onboarding/claim': answer });

  it('reads the answer a new account gets: a ship, with no planet and no placement', () => {
    expect(claimSchema.parse(shipClaim).vessel?.id).toBe(wireVessel().id);
  });

  it('stands the new account on its ship, with the transport turned on', async () => {
    const { result } = open(claiming(() => json(shipClaim)));
    await waitFor(() => { expect(['landing', 'servers']).toContain(result.current.session.phase); });
    await act(async () => { await result.current.claim('new', 'fixture-password-123', [], undefined, proof); });
    expect(result.current.session.phase).toBe('ready');
    expect(isStarterMode()).toBe(true);
    const ready = result.current.session;
    expect(ready.phase === 'ready' && ready.standing.planetName).toBe(wireVessel().name);
  });

  it('has the ship on the screen at once, with no second read', async () => {
    const { client, result } = open(claiming(() => json(shipClaim)));
    await waitFor(() => { expect(['landing', 'servers']).toContain(result.current.session.phase); });
    await act(async () => { await result.current.claim('new', 'fixture-password-123', [], undefined, proof); });
    expect(client.getQueryData<{ vessel?: { id: string } }>(keys.planet)?.vessel?.id).toBe(wireVessel().id);
  });

  it('asks for the very hull the prologue showed', async () => {
    const fetch = claiming(() => json(shipClaim));
    const { result } = open(fetch);
    await waitFor(() => { expect(['landing', 'servers']).toContain(result.current.session.phase); });
    await act(async () => { await result.current.claim('new', 'fixture-password-123', [], undefined, proof, 'WEDGE'); });
    const sent = fetch.mock.calls.find(([input]) => String(input instanceof Request ? input.url : input).includes('/api/onboarding/claim'));
    const raw = sent?.[1]?.body;
    const body: unknown = JSON.parse(typeof raw === 'string' ? raw : '{}');
    expect(body).toMatchObject({ vesselHull: 'WEDGE' });
  });

  it('remembers the ship for a page restore', async () => {
    const { result } = open(claiming(() => json(shipClaim)));
    await waitFor(() => { expect(['landing', 'servers']).toContain(result.current.session.phase); });
    await act(async () => { await result.current.claim('new', 'fixture-password-123', [], undefined, proof); });
    const remembered = meSchema.parse(JSON.parse(window.sessionStorage.getItem('astera:ready-session') ?? '{}'));
    expect(remembered.vessel?.id).toBe(wireVessel().id);
    expect(remembered.placement).toBeNull();
  });
});

describe('a session on a ship', () => {
  it('stands on the ship, ready, with the transport turned on', async () => {
    const { result } = open(server([aboard]));
    await waitFor(() => { expect(result.current.session.phase).toBe('ready'); });
    expect(isStarterMode()).toBe(true);
    const session = result.current.session;
    expect(session.phase === 'ready' && session.standing.planetName).toBe('Newcomer');
  });

  it('never shows the galaxy list to somebody who has a ship', async () => {
    const { result } = open(server([aboard]));
    const seen: string[] = [];
    await waitFor(() => { seen.push(result.current.session.phase); expect(result.current.session.phase).toBe('ready'); });
    expect(seen).not.toContain('servers');
  });

  it('gives a new account its ship and then stands on it', async () => {
    const enlist = vi.fn(() => json({ vessel: wireVessel() }));
    const fetch = server([{ ...base, vessel: null, starterEligible: true }, aboard], { '/api/starter/enlist': enlist });
    const { result } = open(fetch);
    await waitFor(() => { expect(result.current.session.phase).toBe('ready'); });
    expect(enlist).toHaveBeenCalledTimes(1);
    expect(isStarterMode()).toBe(true);
  });

  it('sends a refused account to the galaxy list instead of leaving it stuck', async () => {
    const fetch = server([{ ...base, vessel: null, starterEligible: true }], {
      '/api/starter/enlist': () => json({ error: 'VESSEL_NOT_ELIGIBLE', message: 'no' }, 403),
    });
    const { result } = open(fetch);
    await waitFor(() => { expect(result.current.session.phase).toBe('servers'); });
    expect(isStarterMode()).toBe(false);
  });

  it('says so when the server fails, and can try again', async () => {
    const fetch = server([{ ...base, vessel: null, starterEligible: true }], { '/api/starter/enlist': () => json({ error: 'X', message: 'x' }, 503) });
    const { result } = open(fetch);
    await waitFor(() => { expect(result.current.session.phase).toBe('blocked'); });
  });

  it('leaves a commander with a planet exactly where they were', async () => {
    const { result } = open(server([onPlanet]));
    await waitFor(() => { expect(result.current.session.phase).toBe('ready'); });
    expect(isStarterMode()).toBe(false);
  });

  it('takes the planet over the ship if the server ever says both', async () => {
    const { result } = open(server([{ ...onPlanet, vessel: standing }]));
    await waitFor(() => { expect(result.current.session.phase).toBe('ready'); });
    expect(isStarterMode()).toBe(false);
    const session = result.current.session;
    expect(session.phase === 'ready' && session.standing.planetName).toBe('Home');
  });

  it('sends an account with neither to the galaxy list, as today', async () => {
    const { result } = open(server([{ ...base, vessel: null, starterEligible: false }]));
    await waitFor(() => { expect(result.current.session.phase).toBe('servers'); });
    expect(isStarterMode()).toBe(false);
  });

  it('comes back on the ship from the tab memory, with the transport on before any read', () => {
    window.sessionStorage.setItem('astera:ready-session', JSON.stringify(aboard));
    const { result } = open(server([aboard]));
    expect(result.current.session.phase).toBe('ready');
    expect(isStarterMode()).toBe(true);
  });

  it('turns the transport off on signing out', async () => {
    const { result } = open(server([aboard], { '/api/auth/logout': () => json({ ok: true }) }));
    await waitFor(() => { expect(isStarterMode()).toBe(true); });
    await act(async () => { await result.current.signOut(); });
    expect(isStarterMode()).toBe(false);
  });

  it('lands without the galaxy list in between, and with nothing of the ship in the cache', async () => {
    const { result, client } = open(server([aboard, onPlanet]));
    await waitFor(() => { expect(isStarterMode()).toBe(true); });
    client.setQueryData(keys.planet, { stale: 'the ship' });
    const seen: string[] = [];
    act(() => { result.current.rollover(); seen.push(result.current.session.phase); });
    await waitFor(() => { seen.push(result.current.session.phase); expect(isStarterMode()).toBe(false); });
    expect(seen).not.toContain('servers');
    expect(client.getQueryData(keys.planet)).toBeUndefined();
    const session = result.current.session;
    expect(session.phase === 'ready' && session.standing.planetName).toBe('Home');
  });
});
