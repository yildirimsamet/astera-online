import { VESSEL_HULLS, VESSEL_LOOKS, vesselHull } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { IntelScreen } from '../src/screens/IntelScreen.js';
import { setStarterMode, starterFetch } from '../src/starter/transport.js';
import { urlOf, wireVessel } from './starterVesselFixture.js';
import { neighbourShips, vesselGroups } from '../src/galaxy/mainSky.js';
import { readsForPrivateEvent } from '../src/session/shardEvents.js';
import { keys } from '../src/api/keys.js';
import { galaxySchema } from '../src/api/schemas.js';
import { describeNotification } from '../src/lib/notifications.js';

type Planet = Parameters<typeof neighbourShips>[0][number];

const planet = (over: Partial<Planet>): Planet => ({ id: 'x', position: { x: 1, y: 2, z: 3 }, isSelf: false, body: 'VESSEL', ...over });

describe('the ships around yours', () => {
  it('draws everyone but you, and only ships', () => {
    const ships = neighbourShips([planet({ id: 'me', isSelf: true }), planet({ id: 'them' }), planet({ id: 'world', body: undefined })]);
    expect(ships.map(ship => ship.id)).toEqual(['them']);
  });

  it('draws a ship nobody has looked at as a wreck, and a read one as read', () => {
    const [unread, read] = neighbourShips([planet({ id: 'a' }), planet({ id: 'b', look: 'RENEWED' })]);
    expect(unread!.look).toBe('WRECKED');
    expect(read!.look).toBe('RENEWED');
  });

  it('gives a ship the hull its id gives it everywhere else', () => {
    expect(neighbourShips([planet({ id: 'them' })])[0]!.hull).toBe(vesselHull('them'));
  });

  it('groups by model, so that one hull in one state is one instanced draw', () => {
    const ships = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => planet({ id }));
    const groups = vesselGroups(neighbourShips(ships));
    expect(groups.reduce((sum, group) => sum + group.ships.length, 0)).toBe(8);
    expect(new Set(groups.map(group => group.file)).size).toBe(groups.length);
    expect(groups.length).toBeLessThanOrEqual(VESSEL_HULLS.length * VESSEL_LOOKS.length);
  });
});

describe('the map schema', () => {
  it('keeps what a ship is and how it looks', () => {
    const body = galaxySchema.parse({ you: { planetId: 'a', playerId: 'a' }, planets: [{ id: 'b', intel: 'REMEMBERED', position: { x: 0, y: 0, z: 0 }, isSelf: false, isOwned: false, body: 'VESSEL', look: 'PATCHED', state: { kind: 'NORMAL' } }], rivals: [], result: null });
    expect(body.planets[0]).toMatchObject({ body: 'VESSEL', look: 'PATCHED' });
  });
});

describe('something landing on a ship', () => {
  it('moves everything a landing can change aboard', () => {
    const reads = readsForPrivateEvent('private:vessel-sight') ?? [];
    for (const key of [keys.planet, keys.planets, keys.intel, keys.pending, keys.notifications, keys.galaxy, keys.reports]) expect(reads).toContainEqual(key);
  });
});

describe('what a ship is told', () => {
  const at = new Date();
  const say = (kind: string, payload: unknown) => describeNotification({ id: 'n', kind, payload, seen: false, at }, at.getTime());

  it('names the repair that finished', () => {
    expect(say('REPAIR_DONE', { module: 'SURVEY', stage: 1 })).toContain('Survey');
  });

  it('says a probe report is in, and where from', () => {
    expect(say('PROBE_REPORT', { targetName: 'Ember' })).toContain('Ember');
  });

  it('says someone looked, and nothing of who', () => {
    expect(say('PROBE_DETECTED', {})).toBeTruthy();
  });

  it('still reads when a payload is not what this build expects', () => {
    expect(say('REPAIR_DONE', {})).toBeNull();
    expect(say('PROBE_REPORT', { targetName: 3 })).toBeNull();
  });
});

describe('the intel page aboard', () => {
  const opening = wireVessel();
  const open = (path: string) => {
    if (path.includes('/intel')) return { watching: [], radarLog: [], probeReports: [{ targetPlanetId: 'them', targetName: 'Ember', targetUsername: 'Ember', at: new Date().toISOString(), accuracy: 0.5, stock: { low: 1, high: 2 }, deuteriumStock: null, defence: { low: 1, high: 2 }, fleetSize: { low: 1, high: 2 }, fleetHome: true, detected: false, repair: { low: 30, high: 50 } }], probeCost: { alloy: 1, crystal: 1, deuterium: 0 } };
    if (path.includes('/galaxy')) return { you: { planetId: 'ship-1', playerId: 'ship-1' }, planets: [], rivals: [], result: null };
    return { vessel: opening };
  };
  const draw = async () => {
    const fetch = vi.fn((input: RequestInfo | URL) => Promise.resolve(new Response(JSON.stringify(open(urlOf(input))), { status: 200, headers: { 'content-type': 'application/json' } })));
    setStarterMode(true);
    const api = new Api({ fetch: starterFetch(fetch, () => true) });
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queries}><ApiProvider api={api}><IntelScreen onOpenOrbit={() => undefined} /></ApiProvider></QueryClientProvider>);
    await screen.findAllByText(/Telescope/);
  };
  afterEach(() => { setStarterMode(false); cleanup(); });

  it('speaks of a ship and sends you to repair, not to an orbit that does not exist', async () => {
    await draw();
    expect(screen.queryByText(/Open Orbit/i)).toBeNull();
    expect(screen.queryByText(/planet screen/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Open ship/i })).toBeTruthy();
  });

  it('keeps marks for the main galaxy', async () => {
    await draw();
    expect(document.querySelector('[data-rivals]')).toBeNull();
  });

  it('draws a read ship as a ship', async () => {
    await draw();
    const thumbs = [...document.querySelectorAll('[data-known="probe"] img')].map(img => img.getAttribute('src'));
    expect(thumbs[0]).toMatch(/hero-/);
  });
});
