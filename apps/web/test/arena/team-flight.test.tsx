import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARENA_LAYOUT, ARENA_PROTOCOL, createPilot, keyFeed, packPilot, packRemote, type ArenaWorld, type TeamView } from '@astera/rules/arena';
import type { HudStore } from '../../src/arena/store.js';
import type { ArenaControls } from '../../src/arena/input.js';
import i18n from '../../src/i18n/index.js';

const flight = vi.hoisted(() => ({ args: null as { world: ArenaWorld; store: HudStore; controls: ArenaControls } | null,
  friendAt: vi.fn(() => 5), reset: vi.fn(), setSpectator: vi.fn() }));
vi.mock('../../src/arena/assets/load.js', () => ({ loadArenaAssets: () => Promise.resolve({ colliders: new Map(), rivals: [], classes: new Map(), fx: new Map(), sounds: new Map(), music: new Map() }) }));
vi.mock('../../src/arena/assets/memory.js', () => ({ assetTextureBytes: () => 0, releaseKtx2: () => undefined }));
vi.mock('../../src/arena/client.js', () => ({ createArenaClient: (args: typeof flight.args) => {
  flight.args = args;
  return { warm: () => Promise.resolve(), start: vi.fn(), setHud: vi.fn(), setPhase: vi.fn(), dispose: vi.fn(),
    setSpectator: flight.setSpectator, reset: flight.reset, friendAt: flight.friendAt, metrics: { fps: 60 } };
} }));
const { default: Sandbox } = await import('../../src/arena/Sandbox.js');
class Socket {
  static readonly OPEN = 1; static last: Socket | null = null;
  readyState = 0; bufferedAmount = 0; sent: unknown[] = [];
  onopen: (() => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor() { Socket.last = this; }
  send(raw: string) { this.sent.push(JSON.parse(raw)); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function lobby(state: 'forming' | 'flying' = 'forming'): TeamView {
  return { playerId: id(1), clanId: id(10), canCreate: false, capacity: 5, claims: [], team: { id: id(20), state,
    leaderId: id(1), joined: true, members: [1, 2].map(n => ({ playerId: id(n), name: n === 1 ? 'Ada' : 'Bora', ready: true,
      tactic: 'radar', outcome: null, blocked: null, ship: { class: 'kilavuz', level: 3, fuel: 250, fuelMax: 250, readyAt: null } })) } };
}
const zero = { alloy: 0, crystal: 0, deuterium: 0 };
let language: string;
beforeEach(async () => {
  language = i18n.language; await i18n.changeLanguage('tr'); Socket.last = null; flight.args = null; vi.clearAllMocks();
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('screen', { orientation: {} });
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/arena/hangar' ? {
    core: 9, minCore: 9, ship: { class: 'kilavuz', level: 3, fuel: 250, ammo: 100, hold: [0, 0, 0], readyAt: null,
      readyReason: null, flying: true, changeUntil: null, xp: 0, xpNext: 150, levelCap: 9, abilities: {}, upgrade: zero },
    refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 500, alloy: 500, crystal: 500, cap: zero, sent: zero,
    resetsAt: '2026-10-25T00:00:00Z', entryClosesAt: '2026-11-25T00:00:00Z',
  } : lobby(url === '/arena/team/start' ? 'flying' : 'forming')), { status: 200 }))));
});
afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage(language); });

describe('a prepared team flight', () => {
  it('keeps an explicitly reopened spectator in the team until the first authoritative snapshot arrives', async () => {
    const current = lobby('flying'); current.team!.members[0]!.outcome = 'dead';
    const original = fetch;
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => url === '/arena/team'
      ? Promise.resolve(new Response(JSON.stringify(current))) : original(url, init));
    const view = render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Takımı izle' }));
    const socket = Socket.last; if (!socket) throw new Error('No observer');
    act(() => { socket.open(); });
    await waitFor(() => { expect(socket.sent[0]).toMatchObject({ mode: 'spectate' }); });
    act(() => { socket.receive({ kind: 'welcome', v: ARENA_PROTOCOL, pilotId: 4, teamId: id(20), tick: 0, seq: 0, tickRate: 30,
      snapshotRate: 15, layoutVersion: ARENA_LAYOUT.version, pilots: [] }); });
    expect(view.container.querySelector('main')?.dataset.screen).toBe('spectate');
  });
  it('enters its reserved ship even when the hangar already reports flying, and taps a friend for support', async () => {
    const view = render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    const start = await screen.findByRole('button', { name: 'Birlikte kalk' });
    expect(screen.getAllByRole('radio', { name: /Tarama/ })).toHaveLength(1);
    fireEvent.click(start);
    await waitFor(() => { expect(view.container.querySelector('main')?.dataset.screen).toBe('flight'); });
    const socket = Socket.last; if (!socket || !flight.args) throw new Error('No team flight');
    act(() => { socket.open(); });
    await waitFor(() => { expect(socket.sent[0]).toMatchObject({ mode: 'enter' }); });
    const { world, controls, store } = flight.args;
    act(() => {
      socket.receive({ kind: 'welcome', v: ARENA_PROTOCOL, pilotId: 4, teamId: id(20), tick: 0, seq: 0, tickRate: 30,
        snapshotRate: 15, layoutVersion: ARENA_LAYOUT.version, pilots: [{ id: 4, name: 'Ada', ship: 'kilavuz', clanId: id(10), teamId: id(20) }] });
      world.pilot.tactic = 'radar'; store.publish(world, 'flight', false, false);
    });
    // Bora flies beside: the repair waits for a choice instead of going on the pilot (owner 2026-10-27).
    act(() => { world.drones.push(Object.assign(createPilot(5, 'kilavuz'), { clanId: world.pilot.clanId })); store.publish(world, 'flight', false, false); });
    controls.actionDown('signature', 1, performance.now()); controls.actionUp('signature', 1, performance.now());
    fireEvent.pointerDown(view.container.querySelector('main')!, { clientX: 120, clientY: 220 });
    expect(controls.sample()).toMatchObject({ signature: true, signatureTarget: 5 });
    expect(flight.friendAt).toHaveBeenCalled();
    controls.keyDown('KeyE'); controls.keyUp('KeyE'); expect(controls.sample().radar).toBe(true);
  });

  it('moves an ended member into the living teammate camera, then lets them see the result', async () => {
    const view = render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Birlikte kalk' }));
    await waitFor(() => { expect(Socket.last).not.toBeNull(); });
    const socket = Socket.last; if (!socket || !flight.args) throw new Error('No flight');
    const { world, store } = flight.args;
    act(() => { socket.open(); });
    await waitFor(() => { expect(socket.sent.length).toBeGreaterThan(0); });
    act(() => {
      socket.receive({ kind: 'welcome', v: ARENA_PROTOCOL, pilotId: 4, teamId: id(20), tick: 0, seq: 0, tickRate: 30,
        snapshotRate: 15, layoutVersion: ARENA_LAYOUT.version, pilots: [4, 5].map(n => ({ id: n, name: n === 4 ? 'Ada' : 'Bora', ship: 'kilavuz', clanId: id(10), teamId: id(20) })) });
      store.publish(world, 'flight', false, false);
    });
    act(() => {
      const self = createPilot(4); self.phase = 'dead'; const ally = createPilot(5); world.drones = [ally];
      socket.receive({ kind: 'snap', tick: 10, ack: 0, self: packPilot(self), others: [packRemote(ally)], mid: [], far: [], scan: [], ...keyFeed(world), watching: 5 });
      store.publish(world, 'flight', false, false);
    });
    await waitFor(() => { expect(view.container.querySelector('main')?.dataset.screen).toBe('spectate'); }, { timeout: 4000 });
    expect(flight.setSpectator).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByRole('button', { name: 'Sonuca dön' }));
    expect(view.container.querySelector('main')?.dataset.screen).toBe('result');
  });
});
