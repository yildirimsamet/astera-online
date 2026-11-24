import { FIRST_SEASON_START } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import type * as Runtime from '../src/lib/playerAnalytics/runtime.js';
import { ArrivalHost } from '../src/starter/ArrivalHost.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { HOLDER_CLOSE, WindowHolder } from './attentionFixture.js';
import { urlOf } from './starterVesselFixture.js';

const telemetry = vi.hoisted(() => ({ observe: vi.fn(), analyticsRecording: vi.fn(() => true) }));
vi.mock('../src/lib/playerAnalytics/runtime.js', async (original) => ({ ...await original<typeof Runtime>(), ...telemetry }));

/**
 * THE FIRST MOVE IN THE MAIN GALAXY (plan 2026-11-08 F7, moment 17). The card after the landing
 * keeps what came down, the first-season start and the total apart, and ends on a real choice:
 * fly out with what is ready, or build the Deuterium the new world does not make yet.
 */
const arrival = { shardName: 'Vantage', cargo: { alloy: 2000, crystal: 300, deuterium: 50, fleet: { DART: 6 } }, planetId: 'p1', hull: 'SPINE', ordinal: 2, berth: { x: 10, y: 0, z: -20 } };

const harness = () => {
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    const body = url.includes('/api/starter/arrival/seen') ? { ok: true } : { arrival, landedAt: new Date().toISOString() };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onPanel = vi.fn();
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider><ArrivalHost onPanel={onPanel} /></ToastProvider></ApiProvider></QueryClientProvider>);
  return { fetcher, onPanel };
};

const packageShips = Object.values(FIRST_SEASON_START.fleet).reduce<number>((sum, n) => sum + n, 0);

beforeEach(async () => {
  await i18n.changeLanguage('en');
  // The scene has played: the card itself is what these cases read.
  window.sessionStorage.setItem('astera:jump-scene-played', '1');
  telemetry.observe.mockClear();
});
afterEach(() => { cleanup(); window.sessionStorage.clear(); });

describe('the card after the landing', () => {
  // Review 2026-11-23: tasks already begun (on another screen, or a rock mined under a held card) leave the
  // founding-hour card nothing to start; it is put away, or it would hold the screen with nothing drawn.
  it('is put away once the founding hour\'s tasks have begun without it', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = urlOf(input);
      const body = url.includes('/api/starter/arrival/seen') ? { ok: true }
        : url.includes('/api/newcomer-scenario')
          ? { scenario: { step: 'PIRATE', pirateDefeated: false, holdsScreenUntil: new Date(Date.now() + 30 * 60_000).toISOString() } }
          : { arrival, landedAt: new Date().toISOString() };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
    const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider><ArrivalHost onPanel={vi.fn()} /></ToastProvider></ApiProvider></QueryClientProvider>);
    await waitFor(() => { expect(fetcher.mock.calls.some(([input]) => urlOf(input).includes('/api/starter/arrival/seen'))).toBe(true); });
    expect(screen.queryByTestId('landing-card')).toBeNull();
    // A server still sending the arrival back (a seen that did not land) is not asked again in a loop.
    await new Promise(resolve => { setTimeout(resolve, 300); });
    expect(fetcher.mock.calls.filter(([input]) => urlOf(input).includes('/api/starter/arrival/seen'))).toHaveLength(1);
  });

  // Pressed before the map was in, the flight had no world to fly through: a black screen for the scene.
  it('lets the flight be watched again only once the map it crosses is in', async () => {
    harness();
    await screen.findByTestId('arrival-carried');
    expect(screen.getByRole('button', { name: 'Watch again' })).toBeDisabled();
  });

  it('keeps what came down, the first-season start and the total apart', async () => {
    harness();
    const carried = await screen.findByTestId('arrival-carried');
    expect(carried).toHaveTextContent('2,000');
    expect(carried).toHaveTextContent('300');
    expect(carried).toHaveTextContent('6 ships');
    const start = screen.getByTestId('arrival-package');
    expect(start).toHaveTextContent(FIRST_SEASON_START.resources.alloy.toLocaleString('en'));
    expect(start).toHaveTextContent(`${String(packageShips)} ships`);
    const total = screen.getByTestId('arrival-total');
    expect(total).toHaveTextContent((2000 + FIRST_SEASON_START.resources.alloy).toLocaleString('en'));
    expect(total).toHaveTextContent((300 + FIRST_SEASON_START.resources.crystal).toLocaleString('en'));
    expect(total).toHaveTextContent(String(50 + FIRST_SEASON_START.resources.deuterium));
    expect(total).toHaveTextContent(`${String(6 + packageShips)} ships`);
  });

  // No sweep deletes an idle world (reclaim has had no caller since b27db1ae): the card must not threaten one.
  it('does not warn of a deletion the game never makes', async () => {
    harness();
    const card = await screen.findByTestId('landing-card');
    expect(card).not.toHaveTextContent(/deleted/iu);
    expect(i18n.exists('starter.landing.line.absence')).toBe(false);
  });

  // Plan 2026-11-13 §4.7 (Faz 3): how the new world is kept, each rule with the player's own number.
  it('says in one block how the new world is kept, with its numbers', async () => {
    harness();
    const guard = within(await screen.findByTestId('arrival-protection'));
    expect(guard.getByText(/72 hours/u)).toHaveTextContent(/pirates does not/iu);
    expect(guard.getByText(/Command Core 1–6/u)).toBeInTheDocument();
    expect(guard.getByText(/30 hours/u)).toHaveTextContent(/Silent Space/u);
    // The bare lines it replaces are gone, so the shield is not said twice.
    expect(i18n.exists('starter.landing.line.shield')).toBe(false);
    expect(i18n.exists('starter.landing.line.core')).toBe(false);
  });

  it('offers a first sortie with the fleet and fuel that are ready', async () => {
    const { onPanel, fetcher } = harness();
    const move = within(await screen.findByTestId('arrival-decide'));
    expect(move.getByTestId('arrival-outward')).toHaveTextContent(`${String(50 + FIRST_SEASON_START.resources.deuterium)} Deuterium`);
    fireEvent.click(move.getByRole('button', { name: /Plan a first sortie/u }));
    expect(onPanel).toHaveBeenCalledWith('intel');
    await waitFor(() => { expect(fetcher.mock.calls.some(([url]) => urlOf(url).includes('/api/starter/arrival/seen'))).toBe(true); });
  });

  it('offers to build the Deuterium the new world does not make', async () => {
    const { onPanel } = harness();
    const move = within(await screen.findByTestId('arrival-decide'));
    expect(move.getByTestId('arrival-grow')).toHaveTextContent(/output is zero. Research Deuterium Synthesis, then build the Deuterium Refinery/u);
    fireEvent.click(move.getByRole('button', { name: /Open Deuterium output/u }));
    expect(onPanel).toHaveBeenCalledWith('planet', undefined, undefined, { group: 'grow', itemId: 'DEUTERIUM_PLANT' });
  });

  // Plan 2026-11-20 Faz 0: which first move the player picked, or that they only closed the card.
  it('records the move that closed it', async () => {
    harness();
    const move = within(await screen.findByTestId('arrival-decide'));
    expect(telemetry.observe).toHaveBeenCalledWith('surface_visible', { surface: 'arrival_card' }, 'live');
    fireEvent.click(move.getByRole('button', { name: /Plan a first sortie/u }));
    expect(telemetry.observe).toHaveBeenCalledWith('surface_closed', { surface: 'arrival_card', code: 'act:outward' }, 'live');
  });
});

/** A defender's report of a raid: what was taken is written below zero (`reports.ts`). */
const raid = {
  id: 'b1', missionId: 'm1', at: new Date().toISOString(), grade: 'DECISIVE', attacking: false,
  opponentName: 'Sable', opponentPlanet: 'Grimhold', opponentPlanetId: 'p2', neutral: false, yourPlanet: 'Vantage-3',
  rounds: [], yourLosses: {}, theirLosses: {}, yourFleet: {}, theirFleet: { DART: 4 },
  lootAlloy: -400, lootCrystal: -120, lootDeuterium: 0, dominion: 0, shieldAbsorbed: 0, cargoLimited: false,
  defenceSalvage: {}, yourDamage: [], disruptedMinutes: 0, wreckValue: 0,
};
const tipHarness = (reports: object[], daysAgo: number) => {
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    const body = url.includes('/api/reports') ? { reports, rivals: [] } : { arrival: null, landedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString() };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider><ArrivalHost onPanel={vi.fn()} /></ToastProvider></ApiProvider></QueryClientProvider>);
};

/** The first week's note comes with the need (plan 2026-11-13 §4.8); the calendar is the fallback. */
describe('the first-week note', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('says the calendar line while nothing has happened', async () => {
    tipHarness([], 4);
    expect(await screen.findByTestId('landing-tip')).toHaveTextContent(/Dominion/u);
  });

  it('says the clan line once the player has been raided', async () => {
    tipHarness([raid], 4);
    await waitFor(() => { expect(screen.getByTestId('landing-tip')).toHaveTextContent(/clan/iu); });
  });

  // Plan 2026-11-20 §5.5: a light note never lies over a window.
  it('waits while a window has the screen, and comes once it is closed and the player is back on the map', async () => {
    render(<WindowHolder />);
    tipHarness([], 4);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(screen.queryByTestId('landing-tip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: HOLDER_CLOSE }));
    fireEvent.pointerDown(window);
    expect(await screen.findByTestId('landing-tip')).toBeInTheDocument();
  });

  it('closes on a thumb-sized button and stays closed', async () => {
    tipHarness([], 4);
    const close = within(await screen.findByTestId('landing-tip')).getByRole('button', { name: 'Dismiss' });
    fireEvent.click(close);
    expect(screen.queryByTestId('landing-tip')).toBeNull();
    cleanup();
    tipHarness([], 4);
    await screen.findByTestId('landing-card').catch(() => undefined);
    expect(screen.queryByTestId('landing-tip')).toBeNull();
  });
});

/**
 * A SHIP THAT NEVER FOUGHT ITS FIRST HUNT IS POINTED AT A PIRATE (plan 2026-11-13 §4.7). The first move
 * names the nearest one and how far it is, says a pirate fight keeps the shield, and frames it on the map.
 */
describe('the first move of a ship that never hunted', () => {
  const pirates = { originPlanetId: 'p1', pirates: [
    { id: 'far', callsign: 'K7QX', zone: 'IDENTIFIED', at: { x: 0, y: 0, z: 0 }, expiresInMinutes: 300, reachMinutes: 40, reach: [] },
    { id: 'near', callsign: 'R2VD', zone: 'IDENTIFIED', at: { x: 1, y: 0, z: 0 }, expiresInMinutes: 300, reachMinutes: 12, reach: [] },
    { id: 'blind', callsign: 'Z9AA', zone: 'CONTACT', at: { x: 2, y: 0, z: 0 }, expiresInMinutes: 300, reachMinutes: null, reach: [] },
  ] };
  const huntHarness = (hunted: boolean) => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = urlOf(input);
      const body = url.includes('/api/pirates') ? pirates
        : url.includes('/api/starter/arrival/seen') ? { ok: true } : { arrival: { ...arrival, hunted }, landedAt: new Date().toISOString() };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
    const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onFocusContact = vi.fn();
    const onPanel = vi.fn();
    render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider><ArrivalHost onPanel={onPanel} onFocusContact={onFocusContact} /></ToastProvider></ApiProvider></QueryClientProvider>);
    return { onFocusContact, onPanel };
  };

  it('names the nearest reachable pirate, says the shield holds, and frames it', async () => {
    const { onFocusContact, onPanel } = huntHarness(false);
    const move = await screen.findByRole('button', { name: /Hunt a pirate/u });
    expect(move).toHaveTextContent(/12 min/u);
    expect(move).toHaveTextContent(/does not drop your shield/u);
    fireEvent.click(move);
    expect(onFocusContact).toHaveBeenCalledWith('near');
    expect(onPanel).not.toHaveBeenCalled();
  });

  it('keeps the sortie for a ship that has hunted', async () => {
    huntHarness(true);
    await screen.findByTestId('landing-card');
    expect(screen.queryByRole('button', { name: /Hunt a pirate/u })).toBeNull();
    expect(screen.getByRole('button', { name: /Plan a first sortie/u })).toBeInTheDocument();
  });
});
