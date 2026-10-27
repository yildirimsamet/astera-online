import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARENA_LAYOUT, ARENA_PROTOCOL } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';

// The Yarık pack never finishes here: the pilot is still on the loading screen.
vi.mock('../../src/arena/assets/load.js', async original => ({ ...await original<object>(), loadArenaAssets: () => new Promise<never>(() => undefined) }));
const { default: Sandbox } = await import('../../src/arena/Sandbox.js');
class Socket {
  static readonly OPEN = 1; static last: Socket | null = null;
  readyState = 0; bufferedAmount = 0; sent: { kind: string; mode?: string }[] = [];
  onopen: (() => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor() { Socket.last = this; }
  send(raw: string) { this.sent.push(JSON.parse(raw) as { kind: string }); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const zero = { alloy: 0, crystal: 0, deuterium: 0 };
const desk = (yours: boolean) => ({ core: 9, minCore: 9, ship: { class: 'kilavuz', level: 3, fuel: 250, ammo: 100, hold: [0, 0, 0], readyAt: null,
  readyReason: null, flying: true, changeUntil: null, xp: 0, xpNext: 150, levelCap: 9, abilities: {}, upgrade: zero },
  refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 500, alloy: 500, crystal: 500, cap: zero, sent: zero,
  resetsAt: '2026-10-25T00:00:00Z', entryClosesAt: '2026-11-25T00:00:00Z', live: { pilots: 2, yours } });
let language: string;
const serve = (yours: boolean) => vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/arena/hangar' ? desk(yours)
  : { playerId: '00000000-0000-4000-8000-000000000001', clanId: null, canCreate: false, capacity: 5, claims: [], team: null }), { status: 200 }))));
beforeEach(async () => { language = i18n.language; await i18n.changeLanguage('tr'); Socket.last = null; vi.stubGlobal('WebSocket', Socket); });
afterEach(async () => { vi.unstubAllGlobals(); vi.useRealTimers(); await i18n.changeLanguage(language); });

/**
 * F22 (2026-10-26 review): a reload or an app switch mid-flight dropped the pilot in the galaxy
 * with no way back, and the room towed the ship after its 30 s link grace. Coming back to the
 * Yarık now rejoins the ship at once, while the pack still loads, and holds the link with a
 * steady neutral input until the pilot can fly it.
 */
describe('coming back to a ship in the air', () => {
  it('rejoins it while the Yarık loads and keeps the link alive', async () => {
    serve(true);
    render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    await waitFor(() => { expect(Socket.last).not.toBeNull(); });
    const socket = Socket.last!;
    act(() => { socket.open(); });
    await waitFor(() => { expect(socket.sent[0]).toMatchObject({ kind: 'hello', v: ARENA_PROTOCOL, mode: 'enter', ship: 'kilavuz', token: 'tok' }); });
    act(() => { socket.receive({ kind: 'welcome', v: ARENA_PROTOCOL, pilotId: 7, tick: 10, seq: 0, tickRate: 30, snapshotRate: 15, layoutVersion: ARENA_LAYOUT.version, pilots: [] }); });
    await waitFor(() => { expect(socket.sent.filter(m => m.kind === 'in').length).toBeGreaterThan(1); }, { timeout: 2000 });
  });

  it('waits for the pilot when the room no longer holds the ship', async () => {
    serve(false);
    render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    expect(Socket.last).toBeNull();
  });
});
