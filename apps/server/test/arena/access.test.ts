import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ARENA_PROTOCOL, ARENA_TUNING as T, decodeArenaSnapshot, type ArenaSnapshot } from '@astera/rules/arena';
import { registerArena, type ArenaIdentify } from '../../src/arena/server.js';
import { systemClock } from '../../src/clock.js';
import { loadEnv } from '../../src/env.js';
import { fakeShips } from './fakeShips.js';

/**
 * The live playtest path: no guests, no debug actions. Pilots are real accounts on the
 * ARENA_PILOTS list, identified by their access token. Owner 2026-10-21: three bots
 * fly the room beside them; since 2026-10-27 only when the host asks (`ARENA_BOTS`).
 */
const ORIGIN = 'https://asteraonline.space';
const ACCOUNTS: Record<string, { accountId: string; username: string; name: string; pilot: boolean }> = {
  'token-alice': { accountId: '00000000-0000-4000-8000-00000000000a', username: 'alice', name: 'Alice', pilot: false },
  'token-bob': { accountId: '00000000-0000-4000-8000-00000000000b', username: 'bob', name: 'Bob', pilot: false },
  'token-carol': { accountId: '00000000-0000-4000-8000-00000000000c', username: 'carol', name: 'Carol', pilot: false },
  'token-dave': { accountId: '00000000-0000-4000-8000-00000000000d', username: 'dave', name: 'Dave', pilot: true },
};
const identify: ArenaIdentify = token => Promise.resolve(ACCOUNTS[token] ?? null);

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { while (closers.length) await closers.pop()?.(); });

async function room(pilots = 'alice,bob', extra: Record<string, string> = {}) {
  const env = loadEnv({ DATABASE_URL: 'postgres://test/arena_test', JWT_SECRET: 'test-secret-that-is-long-enough',
    ROLE: 'arena', ARENA_ENABLED: 'true', ARENA_ALLOWED_ORIGINS: ORIGIN, ARENA_PILOTS: pilots, ARENA_BOTS: '3', ...extra });
  const app = Fastify();
  app.decorate('clock', systemClock);
  // Every launch is granted: the hangar's own rules are `arena-ships.test.ts` and `sortie.test.ts`.
  const arena = registerArena(app, env, identify, fakeShips().ships);
  await app.listen({ port: 0, host: '127.0.0.1' });
  closers.push(() => app.close());
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return { app, arena, url: `ws://127.0.0.1:${String(address.port)}/arena/ws` };
}

type Waiter = (match: (m: unknown) => boolean) => Promise<unknown>;
function connect(url: string, hello: Record<string, unknown>, origin = ORIGIN): Promise<{ socket: WebSocket; messages: unknown[]; next: Waiter }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    const messages: unknown[] = [];
    const waiters: { match: (m: unknown) => boolean; done: (m: unknown) => void }[] = [];
    socket.on('message', raw => {
      const text = Array.isArray(raw) ? Buffer.concat(raw).toString('utf8') : Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.from(raw).toString('utf8');
      const value: unknown = JSON.parse(text);
      messages.push(value);
      for (const waiter of [...waiters]) if (waiter.match(value)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.done(value); }
    });
    socket.on('error', reject);
    socket.on('open', () => {
      socket.send(JSON.stringify({ kind: 'hello', v: ARENA_PROTOCOL, mode: 'enter', ship: 'kilavuz', tactic: 'smoke', ...hello }));
      closers.push(async () => { socket.close(); await Promise.resolve(); });
      resolve({ socket, messages, next: match => new Promise(done => {
        const found = messages.find(match);
        if (found) done(found); else waiters.push({ match, done });
      }) });
    });
  });
}

const kind = (k: string) => (m: unknown): boolean => typeof m === 'object' && m !== null && 'kind' in m && m.kind === k;
const isSnap = (m: unknown): m is ArenaSnapshot => decodeArenaSnapshot(m) !== null;
interface RosterRow { id: number; name: string; role?: string; points?: number; kills?: number; deaths?: number }
const pilotsOf = (m: unknown): RosterRow[] => (m as { pilots: RosterRow[] }).pilots;

describe('arena live playtest access', () => {
  it('refuses a guest hello when development tools are off', async () => {
    const { url } = await room();
    const guest = await connect(url, { guestId: 'guest-live-test-a' });
    expect(await guest.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'auth' });
  });

  it('admits a commander seated from the admin desk with no env list', async () => {
    const { url } = await room('');
    const dave = await connect(url, { token: 'token-dave' });
    expect(await dave.next(kind('welcome'))).toMatchObject({ kind: 'welcome' });
    const carol = await connect(url, { token: 'token-carol' });
    expect(await carol.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'denied' });
  });

  it('refuses an unknown token and an account that is not on the pilot list', async () => {
    const { url } = await room();
    const forged = await connect(url, { token: 'forged' });
    expect(await forged.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'auth' });
    const carol = await connect(url, { token: 'token-carol' });
    expect(await carol.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'denied' });
  });

  it('seats listed pilots under their display names, beside the room\'s three bots', async () => {
    const { url } = await room();
    const alice = await connect(url, { token: 'token-alice' });
    await alice.next(kind('welcome'));
    const bob = await connect(url, { token: 'token-bob' });
    const welcome = await bob.next(kind('welcome'));
    const people = (m: unknown): RosterRow[] => pilotsOf(m).filter(p => p.role === undefined);
    expect(people(welcome).map(p => p.name).sort()).toEqual(['Alice', 'Bob']);
    expect(pilotsOf(welcome).flatMap(p => p.role ?? []).sort()).toEqual(['hunter', 'miner', 'patrol']);
    const roster = await alice.next(m => kind('roster')(m) && people(m).length === 2);
    expect(people(roster).every(p => p.points === 0 && p.kills === 0 && p.deaths === 0)).toBe(true);
  });

  it('opens the room to any signed-in account when the list is a star', async () => {
    const { url } = await room('*');
    const carol = await connect(url, { token: 'token-carol' });
    expect(await carol.next(kind('welcome'))).toMatchObject({ kind: 'welcome' });
  });

  it('gives the same account one ship: a second socket replaces the first', async () => {
    const { url } = await room();
    const first = await connect(url, { token: 'token-alice' });
    const a = await first.next(kind('welcome'));
    const second = await connect(url, { token: 'token-alice' });
    const b = await second.next(kind('welcome'));
    expect(await first.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'replaced' });
    expect((b as { pilotId: number }).pilotId).toBe((a as { pilotId: number }).pilotId);
  });

  it('ignores debug actions and refuses a restart while the ship still flies', async () => {
    const { url } = await room();
    const alice = await connect(url, { token: 'token-alice' });
    const welcome = await alice.next(kind('welcome'));
    const id = (welcome as { pilotId: number }).pilotId;
    alice.socket.send(JSON.stringify({ kind: 'dev', action: 'fuel', value: 0 }));
    alice.socket.send(JSON.stringify({ kind: 'dev', action: 'position', p: { x: 0, y: 0, z: 0 } }));
    alice.socket.send(JSON.stringify({ kind: 'dev', action: 'restart' }));
    const before = alice.messages.length;
    await new Promise(resolve => setTimeout(resolve, 300));
    const snaps = alice.messages.slice(before).filter(isSnap);
    expect(snaps.length).toBeGreaterThan(0);
    for (const snap of snaps) {
      expect(snap.self[0]).toBe(id);
      expect(snap.self[12]).toBeGreaterThan(T.fuelTank - 1);
    }
    // The spawn shield keeps counting down; a restart would have refilled it.
    const last = snaps[snaps.length - 1];
    expect(last?.self[24]).toBeLessThan(T.spawnShield * T.tickRate);
  });

  it('tallies kills and deaths for the room and keeps them across a restart', async () => {
    const { url, arena } = await room();
    const alice = await connect(url, { token: 'token-alice' });
    const aliceId = (await alice.next(kind('welcome')) as { pilotId: number }).pilotId;
    const bob = await connect(url, { token: 'token-bob' });
    const bobId = (await bob.next(kind('welcome')) as { pilotId: number }).pilotId;
    const ship = (id: number) => {
      const found = arena.world.drones.find(p => p.id === id);
      if (!found) throw new Error('no ship');
      return found;
    };
    ship(aliceId).kills = 1;
    Object.assign(ship(bobId), { phase: 'dead', hull: 0, lastAttacker: aliceId });
    const scored = (m: unknown): boolean => kind('roster')(m)
      && pilotsOf(m).some(p => p.id === aliceId && p.kills === 1) && pilotsOf(m).some(p => p.id === bobId && p.deaths === 1);
    await alice.next(scored);
    bob.socket.send(JSON.stringify({ kind: 'dev', action: 'restart' }));
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(ship(bobId).phase).toBe('flying');
    ship(aliceId).kills = 2;
    const again = await alice.next(m => kind('roster')(m) && pilotsOf(m).some(p => p.id === aliceId && p.kills === 2));
    expect(pilotsOf(again).find(p => p.id === bobId)).toMatchObject({ kills: 0, deaths: 1 });
  });
});

describe('farm points', () => {
  it('banks a hold\'s points once per extraction and keeps adding them across flights', async () => {
    const { url, arena } = await room();
    const alice = await connect(url, { token: 'token-alice' });
    const id = (await alice.next(kind('welcome')) as { pilotId: number }).pilotId;
    const ship = () => {
      const found = arena.world.drones.find(p => p.id === id);
      if (!found) throw new Error('no ship');
      return found;
    };
    Object.assign(ship(), { hold: [10, 5, 2], cargo: 17, phase: 'extracted' });
    await alice.next(m => kind('roster')(m) && pilotsOf(m).some(p => p.id === id && p.points === 26));
    await new Promise(resolve => setTimeout(resolve, 150));
    const banked = alice.messages.filter(m => kind('roster')(m) && pilotsOf(m).some(p => p.id === id && (p.points ?? 0) > 26));
    expect(banked).toEqual([]);
    alice.socket.send(JSON.stringify({ kind: 'dev', action: 'restart' }));
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(ship()).toMatchObject({ phase: 'flying', cargo: 0, hold: [0, 0, 0] });
    Object.assign(ship(), { hold: [0, 0, 4], cargo: 4, phase: 'extracted' });
    await alice.next(m => kind('roster')(m) && pilotsOf(m).some(p => p.id === id && p.points === 38));
  });

  it('banks nothing for a ship that died with a full hold', async () => {
    const { url, arena } = await room();
    const alice = await connect(url, { token: 'token-alice' });
    const id = (await alice.next(kind('welcome')) as { pilotId: number }).pilotId;
    const ship = arena.world.drones.find(p => p.id === id);
    if (!ship) throw new Error('no ship');
    Object.assign(ship, { hold: [50, 0, 0], cargo: 50, phase: 'dead' });
    const roster = await alice.next(m => kind('roster')(m) && pilotsOf(m).some(p => p.id === id && p.deaths === 1));
    expect(pilotsOf(roster).find(p => p.id === id)?.points).toBe(0);
  });
});

describe('arena socket origins', () => {
  /** The bundled app's page is https://localhost; the API already trusts it through NATIVE_APP_ORIGINS. */
  it('admits the bundled app\'s origin the API trusts, and nothing else', async () => {
    const { url } = await room('alice', { NATIVE_APP_ORIGINS: 'https://localhost' });
    const app = await connect(url, { token: 'token-alice' }, 'https://localhost');
    expect(await app.next(kind('welcome'))).toMatchObject({ kind: 'welcome' });
    await expect(connect(url, { token: 'token-alice' }, 'https://evil.example')).rejects.toThrow(/403/);
  });

  it('keeps the app\'s origin out while the API does not trust it', async () => {
    const { url } = await room('alice');
    await expect(connect(url, { token: 'token-alice' }, 'https://localhost')).rejects.toThrow(/403/);
  });
});

describe('arena access probe', () => {
  it('answers whether the bearer may enter, without revealing anything else', async () => {
    const { app } = await room();
    const ask = async (authorization?: string) => (await app.inject({ method: 'GET', url: '/arena/access',
      headers: authorization ? { authorization } : {} })).json<unknown>();
    expect(await ask()).toEqual({ allowed: false });
    expect(await ask('Bearer forged')).toEqual({ allowed: false });
    expect(await ask('Bearer token-carol')).toEqual({ allowed: false });
    expect(await ask('Bearer token-alice')).toEqual({ allowed: true });
  });
});
