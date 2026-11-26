import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArenaWorld } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';

const flight = vi.hoisted(() => ({ world: null as ArenaWorld | null }));
vi.mock('../../src/arena/assets/load.js', () => ({ loadArenaAssets: () => Promise.resolve({ colliders: new Map(), rivals: [], classes: new Map(), fx: new Map(), sounds: new Map(), music: new Map() }) }));
vi.mock('../../src/arena/assets/memory.js', () => ({ assetTextureBytes: () => 0, releaseKtx2: () => undefined }));
vi.mock('../../src/arena/client.js', () => ({ createArenaClient: (args: { world: ArenaWorld }) => {
  flight.world = args.world;
  return { warm: () => Promise.resolve(), start: vi.fn(), setHud: vi.fn(), setPhase: vi.fn(), dispose: vi.fn(), setSpectator: vi.fn(), reset: vi.fn(), friendAt: vi.fn(), metrics: { fps: 60 } };
} }));
const { default: Sandbox } = await import('../../src/arena/Sandbox.js');

const zero = { alloy: 0, crystal: 0, deuterium: 0 };
let language: string;
const answer = (entryClosesAt: string) => vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/arena/hangar' ? {
    core: 9, minCore: 9, ship: { class: 'akinci', level: 2, fuel: 223, ammo: 100, hold: [0, 0, 0], readyAt: null,
      readyReason: null, flying: false, changeUntil: null, xp: 0, xpNext: 150, levelCap: 9, abilities: {}, upgrade: zero },
    refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 500, alloy: 500, crystal: 500, cap: zero, sent: zero,
    resetsAt: '2026-10-25T00:00:00Z', entryClosesAt,
  } : { playerId: '00000000-0000-4000-8000-000000000001', clanId: null, canCreate: false, capacity: 5, claims: [], team: null }), { status: 200 })));
beforeEach(async () => {
  language = i18n.language; await i18n.changeLanguage('tr'); flight.world = null;
  vi.stubGlobal('screen', { orientation: {} });
  vi.stubGlobal('fetch', answer('2026-11-25T00:00:00Z'));
});
afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage(language); });

/**
 * Owner 2026-10-27: the hangar held an Akıncı, the preflight turned a Kılavuz round the dock (the
 * world's default pilot), and the flight then started in the Akıncı. The preflight shows the ship
 * the commander flies, from the moment the hangar answers; practice flies it too.
 */
describe('the preflight', () => {
  it('turns the commander\'s own class round the dock', async () => {
    render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    await screen.findByText('Akıncı');
    await waitFor(() => { expect(flight.world?.pilot.ship).toBe('akinci'); });
  });

  it('flies practice in the commander\'s own class', async () => {
    const view = render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    await screen.findByText('Akıncı');
    fireEvent.click(screen.getByRole('radio', { name: /Antrenman/ }));
    fireEvent.click(view.container.querySelector('.ap-launch')!);
    await waitFor(() => { expect(view.container.querySelector('main')?.dataset.screen).toBe('flight'); });
    expect(flight.world?.pilot.ship).toBe('akinci');
  });
});

/**
 * Owner 2026-11-26: entering Yarık waited a moment on "Connecting…": the room's socket was only
 * opened by the launch press. The launch screen opens it ahead; the launch then only says hello.
 */
describe('the room socket on the launch screen', () => {
  class FakeSocket {
    static readonly CONNECTING = 0; static readonly OPEN = 1; static readonly CLOSED = 3;
    static made: FakeSocket[] = [];
    readyState = 0; bufferedAmount = 0; sent: string[] = [];
    onopen: (() => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null; onmessage: (() => void) | null = null;
    constructor(readonly url: string) { FakeSocket.made.push(this); }
    send(data: string): void { this.sent.push(data); }
    close(): void { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.(); }
  }
  // A season still open for entry: a grounded ship keeps no socket.
  beforeEach(() => { FakeSocket.made = []; vi.stubGlobal('WebSocket', FakeSocket); vi.stubGlobal('fetch', answer('2099-01-01T00:00:00Z')); });

  it('opens the socket ahead, closes it for practice, and launches the real flight on it', async () => {
    const view = render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    await screen.findByText('Akıncı');
    await waitFor(() => { expect(FakeSocket.made).toHaveLength(1); });
    expect(FakeSocket.made[0]?.url).toMatch(/\/arena\/ws$/);
    fireEvent.click(screen.getByRole('radio', { name: /Antrenman/ }));
    await waitFor(() => { expect(FakeSocket.made[0]?.readyState).toBe(3); });
    fireEvent.click(screen.getByRole('radio', { name: /Gerçek uçuş/ }));
    await waitFor(() => { expect(FakeSocket.made).toHaveLength(2); });
    const spare = FakeSocket.made[1]!;
    spare.readyState = 1;
    fireEvent.click(view.container.querySelector('.ap-launch')!);
    await waitFor(() => { expect(spare.sent.some(data => data.includes('"kind":"hello"'))).toBe(true); });
    expect(FakeSocket.made).toHaveLength(2);
  });
});
