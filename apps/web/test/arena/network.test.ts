import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARENA_LAYOUT, ARENA_PROTOCOL, createSandboxWorld } from '@astera/rules/arena';
import { createArenaNetwork, rankStandings } from '../../src/arena/network.js';

class FakeSocket {
  static readonly OPEN = 1;
  static last: FakeSocket | null = null;
  readyState = 0; bufferedAmount = 0; sent: unknown[] = [];
  onopen: (() => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(readonly url: string) { FakeSocket.last = this; }
  send(data: string): void { this.sent.push(JSON.parse(data)); }
  close(): void { this.readyState = 3; this.onclose?.(); }
  open(): void { this.readyState = 1; this.onopen?.(); }
  receive(value: unknown): void { this.onmessage?.({ data: JSON.stringify(value) }); }
}

const socket = (): FakeSocket => { if (!FakeSocket.last) throw new Error('no socket'); return FakeSocket.last; };
const welcome = (pilots: unknown[]) => ({ kind: 'welcome', v: ARENA_PROTOCOL, pilotId: 4, tick: 0, seq: 0, tickRate: 30,
  snapshotRate: 15, layoutVersion: ARENA_LAYOUT.version, pilots });

beforeEach(() => { FakeSocket.last = null; vi.stubGlobal('WebSocket', FakeSocket); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('arena network', () => {
  it('greets the live room with a fresh session token', async () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined,
      () => Promise.resolve('token-alice'));
    network.connect();
    socket().open();
    await vi.waitFor(() => { expect(socket().sent).toHaveLength(1); });
    expect(socket().sent[0]).toMatchObject({ kind: 'hello', v: ARENA_PROTOCOL, mode: 'enter', token: 'token-alice' });
    network.dispose();
  });

  it('keeps the guest hello when no session is behind the sandbox', () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect();
    socket().open();
    const hello = socket().sent[0] as { guestId?: string; token?: string };
    expect(hello.guestId).toMatch(/^[a-zA-Z0-9-]{8,96}$/);
    expect(hello.token).toBeUndefined();
    network.dispose();
  });

  it('turns the roster into ranked standings and reports why the room refused', async () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined,
      () => Promise.resolve('token-alice'));
    network.connect();
    socket().open();
    await vi.waitFor(() => { expect(socket().sent).toHaveLength(1); });
    socket().receive(welcome([{ id: 4, name: 'Alice', points: 12, kills: 1, deaths: 2 }, { id: 5, name: 'Bob', points: 30, kills: 0, deaths: 0 }]));
    expect(network.getSnapshot()).toMatchObject({ phase: 'online', pilots: 2 });
    expect(network.getSnapshot().board.map(row => [row.name, row.self])).toEqual([['Bob', false], ['Alice', true]]);
    socket().receive({ kind: 'kick', reason: 'denied' });
    expect(network.getSnapshot()).toMatchObject({ phase: 'failed', reason: 'denied' });
    network.dispose();
  });
});

describe('room standings', () => {
  it('ranks by farm points, then kills, then fewer deaths, then name; bots never rank', () => {
    const board = rankStandings([
      { id: 1, name: 'hunter', role: 'hunter' },
      { id: 4, name: 'Cem', points: 40, kills: 2, deaths: 1 },
      { id: 5, name: 'Ada', points: 40, kills: 2, deaths: 1 },
      { id: 6, name: 'Bora', points: 40, kills: 2, deaths: 0 },
      { id: 8, name: 'Deniz', points: 40, kills: 3, deaths: 5 },
      { id: 9, name: 'Ece', points: 90, kills: 0, deaths: 4 },
      { id: 7, name: 'Can' },
    ], 7);
    expect(board.map(row => row.name)).toEqual(['Ece', 'Deniz', 'Bora', 'Ada', 'Cem', 'Can']);
    expect(board.at(-1)).toEqual({ id: 7, name: 'Can', points: 0, kills: 0, deaths: 0, self: true });
  });
});
