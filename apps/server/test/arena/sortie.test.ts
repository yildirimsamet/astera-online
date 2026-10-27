import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ARENA_PROTOCOL, ARENA_TUNING as T, decodeArenaSnapshot, shipStats, type Pilot } from '@astera/rules/arena';
import { registerArena, type ArenaIdentify, type ArenaShips } from '../../src/arena/server.js';
import { systemClock } from '../../src/clock.js';
import { loadEnv } from '../../src/env.js';
import { GameError } from '../../src/services/planet.js';
import { fakeShips } from './fakeShips.js';

/**
 * Y6a: a commander's flight is a real sortie. The room asks the hangar to launch it, flies the ship
 * the hangar holds, reports its end exactly once, and recalls whatever is in the air when it shuts
 * down. Guests and debug flights never reach the capital.
 */
const ORIGIN = 'https://asteraonline.space';
const ACCOUNTS: Record<string, { accountId: string; username: string; name: string; pilot: boolean }> = {
  'token-alice': { accountId: 'acc-alice', username: 'alice', name: 'Alice', pilot: true },
  'token-bob': { accountId: 'acc-bob', username: 'bob', name: 'Bob', pilot: true },
  'token-dave': { accountId: 'acc-dave', username: 'dave', name: 'Dave', pilot: true },
  'token-eve': { accountId: 'acc-eve', username: 'eve', name: 'Eve', pilot: true },
  'token-carol': { accountId: 'acc-carol', username: 'carol', name: 'Carol', pilot: false },
};
const identify: ArenaIdentify = token => Promise.resolve(ACCOUNTS[token] ?? null);
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { while (closers.length) await closers.pop()?.(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function room(ships: ArenaShips, dev = false, seats?: number) {
  const env = loadEnv({ DATABASE_URL: 'postgres://test/arena_test', JWT_SECRET: 'test-secret-that-is-long-enough',
    ROLE: 'arena', ARENA_ENABLED: 'true', ARENA_ALLOWED_ORIGINS: ORIGIN, ARENA_DEV: dev ? 'true' : 'false', ...(seats === undefined ? {} : { ARENA_SEATS: String(seats) }) });
  const app = Fastify();
  app.decorate('clock', systemClock);
  const arena = registerArena(app, env, identify, ships);
  await app.listen({ port: 0, host: '127.0.0.1' });
  let closed = false;
  const close = async () => { if (!closed) { closed = true; await app.close(); } };
  closers.push(close);
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return { app, arena, close, url: `ws://127.0.0.1:${String(address.port)}/arena/ws` };
}

type Waiter = (match: (m: unknown) => boolean) => Promise<unknown>;
function connect(url: string, hello: Record<string, unknown>): Promise<{ socket: WebSocket; messages: unknown[]; next: Waiter }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin: ORIGIN });
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
const CLAN_ID = '00000000-0000-4000-8000-000000000011';
const TEAM_ID = '00000000-0000-4000-8000-000000000012';

describe('crash recovery admission', () => {
  it('refuses a launch when recovery fails and retries recovery before the next launch', async () => {
    let recalls = 0;
    const { ships, calls } = fakeShips({ recallOpen: () => ++recalls === 1 ? Promise.reject(new Error('database unavailable')) : Promise.resolve(0) });
    const r = await room(ships);
    const alice = await connect(r.url, { token: 'token-alice' });
    expect(await alice.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'hangar' });
    expect(calls.launch).toEqual([]);
    const bob = await connect(r.url, { token: 'token-bob' });
    await bob.next(kind('welcome'));
    expect(recalls).toBe(2); expect(calls.launch).toEqual(['acc-bob']);
  });
});

describe('Y7 team room', () => {
  it('puts confirmed teammates through one entrance despite intervening solo and other-team arrivals', async () => {
    const base = fakeShips();
    const { ships } = fakeShips({ launch: async account => ({ ...await base.ships.launch(account), clanId: CLAN_ID,
      ...(account === 'acc-alice' || account === 'acc-bob' ? { teamId: TEAM_ID } : account === 'acc-eve' ? { teamId: 'other-match' } : {}) }) });
    const { arena, url } = await room(ships);
    const alice = await flying(url, 'token-alice', arena); const dave = await flying(url, 'token-dave', arena);
    const eve = await flying(url, 'token-eve', arena); const bob = await flying(url, 'token-bob', arena);
    const gate = (pilot: Pilot): number => arena.world.layout.entries.reduce((best, entry, i, entries) =>
      Math.hypot(pilot.p.x - entry.x, pilot.p.y - entry.y, pilot.p.z - entry.z) < Math.hypot(pilot.p.x - entries[best]!.x, pilot.p.y - entries[best]!.y, pilot.p.z - entries[best]!.z) ? i : best, 0);
    expect(gate(bob.ship())).toBe(gate(alice.ship()));
    expect(gate(dave.ship())).not.toBe(gate(alice.ship())); expect(gate(eve.ship())).not.toBe(gate(alice.ship()));
    expect(Math.hypot(bob.ship().p.x - alice.ship().p.x, bob.ship().p.y - alice.ship().p.y, bob.ship().p.z - alice.ship().p.z)).toBeLessThanOrEqual(2 * T.spawnJitter);
    const cursor = arena.world.entryCursor;
    await connect(url, { token: 'token-bob', mode: 'resume' });
    expect(arena.world.entryCursor).toBe(cursor);
  });
  it('does not accept a forged team gate from a solo pilot', async () => {
    const { ships } = fakeShips(); const { arena, url } = await room(ships);
    const a = await connect(url, { token: 'token-alice', teamId: TEAM_ID }); await a.next(kind('welcome'));
    const cursor = arena.world.entryCursor;
    const b = await connect(url, { token: 'token-bob', teamId: TEAM_ID }); await b.next(kind('welcome'));
    expect(arena.world.entryCursor).not.toBe(cursor);
  });

  it('freezes server-owned clan and tactic metadata, sends a distant friend and admits an ended observer without another launch', async () => {
    const base = fakeShips();
    const { ships, calls } = fakeShips({
      launch: async account => ({ ...await base.ships.launch(account), clanId: CLAN_ID, teamId: TEAM_ID, tactic: 'radar' }),
      spectate: async account => ({ ...await base.ships.launch(account), clanId: CLAN_ID, teamId: TEAM_ID, tactic: 'radar', spectating: 'dead' }),
    });
    const { arena, url } = await room(ships);
    const a = await connect(url, { token: 'token-alice', clanId: 'forged', teamId: 'forged', appearance: { paint: 'arena-helios' } });
    const aId = (await a.next(kind('welcome')) as { pilotId: number }).pilotId;
    const b = await connect(url, { token: 'token-bob' });
    const bId = (await b.next(kind('welcome')) as { pilotId: number }).pilotId;
    const pa = arena.world.drones.find(p => p.id === aId); const pb = arena.world.drones.find(p => p.id === bId);
    if (!pa || !pb) throw new Error('missing pilots');
    expect(pa.clanId).toBe(CLAN_ID); expect(pa.tactic).toBe('radar');
    pa.p.x = 0; pa.p.y = 1100; pa.p.z = 0; pb.p.x = 4000; pb.p.y = 1100; pb.p.z = 0;
    await a.next(m => decodeArenaSnapshot(m)?.mid.some(row => row[0] === bId) === true);
    pb.phase = 'dead';
    await viWait(() => calls.end.some(e => e.accountId === 'acc-bob'));
    const launches = base.calls.launch.length;
    const observer = await connect(url, { token: 'token-bob', mode: 'spectate' });
    await observer.next(kind('welcome'));
    const snap = await observer.next(m => decodeArenaSnapshot(m)?.self.at(-1) === 2);
    expect(decodeArenaSnapshot(snap)?.self.at(-1)).toBe(2);
    expect(base.calls.launch).toHaveLength(launches + 1); // Only the observer fixture read; no call to the launch port.
  });
});

async function viWait(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !check(); i++) await wait(20);
  expect(check()).toBe(true);
}
async function flying(url: string, token: string, arena: { world: { drones: Pilot[] } }) {
  const pilot = await connect(url, { token });
  const id = (await pilot.next(kind('welcome')) as { pilotId: number }).pilotId;
  const ship = (): Pilot => { const found = arena.world.drones.find(p => p.id === id); if (!found) throw new Error('no ship'); return found; };
  return { ...pilot, id, ship };
}

describe('a commander\'s sortie', () => {
  it('flies the ship the hangar holds, filled and loaded as the launch left it', async () => {
    const launched: string[] = [];
    const { ships, calls } = fakeShips({ launch: accountId => { launched.push(accountId);
      return Promise.resolve({ sortieId: `s-${accountId}`, ship: 'muhafiz', level: 7, fuel: 200, ammo: 100, hold: [30, 0, 5], refilled: 12, abilities: {} }); } });
    const { url, arena } = await room(ships);
    const alice = await flying(url, 'token-alice', arena);
    expect(alice.ship()).toMatchObject({ ship: 'muhafiz', level: 7, hull: shipStats('muhafiz', 7).hull, ammo: 100, hold: [30, 0, 5], cargo: 35, phase: 'flying' });
    // Everyone reads its level from the roster (Y6b).
    expect((await alice.next(kind('welcome')) as { pilots: { id: number; level?: number }[] }).pilots.find(row => row.id === alice.id)?.level).toBe(7);
    // The room and this test share one event loop: a tick may land before the welcome is read, and idling burns fuel.
    expect(alice.ship().fuel).toBeGreaterThan(195);
    expect(alice.ship().fuel).toBeLessThanOrEqual(200);
    expect(calls.recall).toBe(1);
    await flying(url, 'token-bob', arena);
    // A crash's open flights are recalled once, before the first launch.
    expect([calls.recall, launched]).toEqual([1, ['acc-alice', 'acc-bob']]);
  });

  it('turns a refused launch into a kick that names why, and seats nobody', async () => {
    const { ships } = fakeShips({ launch: () => Promise.reject(new GameError('SHIP_NOT_READY', 'Not ready', 409, { until: 'x', reason: 'repair' })) });
    const { url, app } = await room(ships);
    const alice = await connect(url, { token: 'token-alice' });
    expect(await alice.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'SHIP_NOT_READY' });
    expect((await app.inject({ method: 'GET', url: '/arena/health' })).json<{ pilots: number }>().pilots).toBe(0);
  });

  it('reports an exit once, with the hold, and tells the pilot what reached the capital', async () => {
    const { ships, calls } = fakeShips();
    const { url, arena } = await room(ships);
    const alice = await flying(url, 'token-alice', arena);
    Object.assign(alice.ship(), { hold: [100, 20, 3], cargo: 123, fuel: 80, ammo: 70, pilotKills: 2, assists: 1, phase: 'extracted' });
    expect(await alice.next(kind('sortie'))).toMatchObject({ kind: 'sortie', outcome: 'extracted', deposit: { alloy: 100 }, xp: { banked: 10 } });
    await wait(200);
    expect(calls.end).toEqual([{ accountId: 'acc-alice', sortieId: 'sortie-1',
      end: { outcome: 'extracted', fuel: 80, ammo: 70, hold: [100, 20, 3], pilotKills: 2, assists: 1, unseen: false } }]);
  });

  it('ends a death as lost and a departure as towed', async () => {
    const { ships, calls } = fakeShips();
    const { url, arena } = await room(ships);
    const alice = await flying(url, 'token-alice', arena);
    const bob = await flying(url, 'token-bob', arena);
    Object.assign(alice.ship(), { hold: [0, 0, 0], cargo: 0, phase: 'dead' });
    bob.ship().hold = [40, 0, 0]; bob.ship().cargo = 40;
    bob.socket.send(JSON.stringify({ kind: 'leave' }));
    await alice.next(kind('sortie'));
    await wait(200);
    expect(calls.end.map(call => [call.accountId, call.end.outcome])).toEqual(expect.arrayContaining([['acc-alice', 'dead'], ['acc-bob', 'towed']]));
    expect(calls.end).toHaveLength(2);
  });

  it('goes through the hangar again for the next flight, and stays down when it refuses', async () => {
    let ready = true;
    const base = fakeShips();
    const { ships, calls } = fakeShips({ launch: accountId => ready ? base.ships.launch(accountId)
      : Promise.reject(new GameError('SHIP_NOT_READY', 'Not ready', 409)) });
    const { url, arena } = await room(ships);
    const alice = await flying(url, 'token-alice', arena);
    alice.ship().phase = 'extracted';
    await alice.next(kind('sortie'));
    ready = false;
    alice.socket.send(JSON.stringify({ kind: 'dev', action: 'restart' }));
    expect(await alice.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'SHIP_NOT_READY' });
    expect(alice.ship().phase).toBe('extracted');
    ready = true;
    const again = await connect(url, { token: 'token-alice' });
    await again.next(kind('welcome'));
    await wait(100);
    expect(alice.ship().phase).toBe('flying');
    expect(calls.end).toHaveLength(1);
  });

  it('never lands a flight a debug action touched, nor a guest\'s', async () => {
    const { ships, calls } = fakeShips();
    const { url, arena } = await room(ships, true);
    const alice = await flying(url, 'token-alice', arena);
    alice.socket.send(JSON.stringify({ kind: 'dev', action: 'cargo', value: 200 }));
    await wait(100);
    alice.ship().phase = 'extracted';
    await alice.next(kind('sortie'));
    expect(calls.end.map(call => call.end.outcome)).toEqual(['test']);
    const guest = await connect(url, { guestId: 'guest-sortie-test-1' });
    await guest.next(kind('welcome'));
    expect(calls.launch).toEqual(['acc-alice']);
  });

  it('recalls the flights in the air when the room shuts down, hold aboard', async () => {
    const { ships, calls } = fakeShips();
    const { url, arena, close } = await room(ships);
    const alice = await flying(url, 'token-alice', arena);
    const bob = await flying(url, 'token-bob', arena);
    Object.assign(alice.ship(), { hold: [60, 20, 5], cargo: 85 });
    bob.ship().phase = 'extracted';
    await bob.next(kind('sortie'));
    await close();
    expect(calls.end.map(call => [call.accountId, call.end.outcome, call.end.hold])).toEqual([
      ['acc-bob', 'extracted', [0, 0, 0]], ['acc-alice', 'recalled', [60, 20, 5]]]);
  });

  it('tells the hangar which flights ended with nobody watching', async () => {
    const { ships, calls } = fakeShips(); const r = await room(ships);
    const alice = await connect(r.url, { token: 'token-alice' }); await alice.next(kind('welcome'));
    const bob = await connect(r.url, { token: 'token-bob' }); await bob.next(kind('welcome'));
    alice.socket.close(); await wait(100);
    await r.close();
    expect(calls.end.map(c => [c.accountId, c.end.unseen])).toEqual(expect.arrayContaining([['acc-alice', true], ['acc-bob', false]]));
  });

  it('tries a failed report again rather than leave the ship in the air', async () => {
    let failures = 1;
    const base = fakeShips();
    const { ships, calls } = fakeShips({ end: (accountId, sortieId, end) => failures-- > 0 ? Promise.reject(new Error('db down'))
      : base.ships.end(accountId, sortieId, end) });
    const { url, arena } = await room(ships);
    const alice = await flying(url, 'token-alice', arena);
    alice.ship().phase = 'extracted';
    expect(await alice.next(kind('sortie'))).toMatchObject({ outcome: 'extracted' });
    expect(calls.end).toHaveLength(0);
    expect(base.calls.end).toHaveLength(1);
  });
});

describe('a full room', () => {
  // Codex review CR1: the seat used to be checked after the hangar had filled and launched the ship.
  it('refuses a commander before the hangar launches anything', async () => {
    const { ships, calls } = fakeShips(); const { url } = await room(ships, false, 1);
    await (await connect(url, { token: 'token-alice' })).next(kind('welcome'));
    const bob = await connect(url, { token: 'token-bob' });
    expect(await bob.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'full' });
    expect(calls.launch).toEqual(['acc-alice']);
    expect(calls.end).toEqual([]);
  });

  it('holds the last seat for a launch still in the hangar, so a second arrival is refused unlaunched', async () => {
    const base = fakeShips(); let release = (): void => undefined;
    const held = new Promise<void>(resolve => { release = resolve; });
    const { ships, calls } = fakeShips({ launch: async account => { const flight = await base.ships.launch(account); if (account === 'acc-alice') await held; return flight; } });
    const { url } = await room(ships, false, 1);
    const alice = await connect(url, { token: 'token-alice' });
    await wait(50);
    const bob = await connect(url, { token: 'token-bob' });
    expect(await bob.next(kind('kick'))).toEqual({ kind: 'kick', reason: 'full' });
    release();
    await alice.next(kind('welcome'));
    expect(base.calls.launch).toEqual(['acc-alice']);
    expect(calls.end).toEqual([]);
  });
});

describe('the hangar desk', () => {
  it('accepts one named ability and rejects forged ranks, points and unknown abilities', async () => {
    const spent: string[] = [];
    const base = fakeShips();
    const { ships } = fakeShips({ ability: (account, ability) => { spent.push(`${account}:${ability}`); return base.ships.hangar(account); } });
    const { app } = await room(ships);
    const buy = (payload: Record<string, unknown>, token = 'token-alice') => app.inject({ method: 'POST', url: '/arena/ability',
      headers: { authorization: `Bearer ${token}` }, payload });
    expect((await buy({ ability: 'smoke' }, 'forged')).statusCode).toBe(401);
    expect((await buy({ ability: 'smoke' }, 'token-carol')).statusCode).toBe(403);
    for (const bad of [{ ability: 'unknown' }, { ability: 'smoke', rank: 5 }, { ability: 'smoke', points: -1 }, {}]) {
      expect((await buy(bad)).statusCode).toBe(400);
    }
    expect((await buy({ ability: 'smoke' })).statusCode).toBe(200);
    expect(spent).toEqual(['acc-alice:smoke']);
  });
  it('repairs only the signed-in seated pilot\'s ship, with no client supplied price or timer', async () => {
    const repaired: string[] = [];
    const base = fakeShips();
    const { ships } = fakeShips({ repair: accountId => { repaired.push(accountId); return base.ships.hangar(accountId); } });
    const { app } = await room(ships);
    const repair = (token?: string, payload: Record<string, unknown> = {}) => app.inject({ method: 'POST', url: '/arena/repair',
      headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
    expect((await repair()).statusCode).toBe(401);
    expect((await repair('forged')).statusCode).toBe(401);
    expect((await repair('token-carol')).statusCode).toBe(403);
    expect((await repair('token-alice', { minutes: 0, alloy: 0 })).statusCode).toBe(400);
    expect((await repair('token-alice')).statusCode).toBe(200);
    expect(repaired).toEqual(['acc-alice']);
  });
  // Owner 2026-10-27: the launch plan (half a tank, a light magazine) is the pilot's to set, in steps the rules offer.
  it('passes a launch plan on as whole steps, and rejects anything else', async () => {
    const plans: string[] = [];
    const base = fakeShips();
    const { ships } = fakeShips({ loadout: (accountId, plan) => { plans.push(`${accountId}:${String(plan.fuel)}/${String(plan.ammo)}`); return base.ships.hangar(accountId); } });
    const { app } = await room(ships);
    const set = (payload: Record<string, unknown>, token?: string) => app.inject({ method: 'POST', url: '/arena/loadout',
      headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
    expect((await set({ fuel: 50, ammo: 0 })).statusCode).toBe(401);
    expect((await set({ fuel: 50, ammo: 0 }, 'token-carol')).statusCode).toBe(403);
    for (const bad of [{ fuel: 50 }, { fuel: '50', ammo: 0 }, { fuel: 50.5, ammo: 0 }, { fuel: 50, ammo: 0, cost: 0 }]) {
      expect((await set(bad, 'token-alice')).statusCode).toBe(400);
    }
    expect((await set({ fuel: 50, ammo: 0 }, 'token-alice')).statusCode).toBe(200);
    expect(plans).toEqual(['acc-alice:50/0']);
  });
  it('tells the hangar how many pilots fly the Yarık right now, the asker\'s own ship counted once it flies', async () => {
    const { ships } = fakeShips();
    const { app, url, arena } = await room(ships);
    const live = async () => (await app.inject({ method: 'GET', url: '/arena/hangar', headers: { authorization: 'Bearer token-alice' } })).json<{ live?: { pilots: number } }>().live;
    // The room's own bots are not pilots: nobody is in the Yarık yet.
    expect(await live()).toEqual({ pilots: 0, yours: false });
    await flying(url, 'token-bob', arena);
    expect(await live()).toEqual({ pilots: 1, yours: false });
  });
  // F22: a pilot whose page closed comes back to a ship still in the air; the hangar says so.
  it('tells the hangar the asker\'s own ship is still in the air, gone page or not', async () => {
    const { ships } = fakeShips();
    const { app, url, arena } = await room(ships);
    const yours = async () => (await app.inject({ method: 'GET', url: '/arena/hangar', headers: { authorization: 'Bearer token-alice' } })).json<{ live?: { yours: boolean } }>().live?.yours;
    const alice = await flying(url, 'token-alice', arena);
    expect(await yours()).toBe(true);
    alice.socket.close(); await wait(100);
    expect(await yours()).toBe(true);
    alice.ship().phase = 'towed';
    expect(await yours()).toBe(false);
  });
  it('is for seated pilots, and passes the choice to the hangar', async () => {
    const { ships, calls } = fakeShips();
    const { app } = await room(ships);
    const get = (token?: string) => app.inject({ method: 'GET', url: '/arena/hangar', headers: token ? { authorization: `Bearer ${token}` } : {} });
    expect((await get()).statusCode).toBe(401);
    expect((await get('forged')).statusCode).toBe(401);
    expect((await get('token-carol')).statusCode).toBe(403);
    expect((await get('token-alice')).json()).toMatchObject({ core: 9, ship: null });
    const pick = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: '/arena/ship', headers: { authorization: 'Bearer token-alice' }, payload });
    expect((await pick({ ship: 'akinci' })).statusCode).toBe(200);
    for (const bad of [{ ship: 'galleon' }, {}, { ship: 'akinci', extra: 1 }]) expect((await pick(bad)).statusCode).toBe(400);
    expect(calls.choose).toEqual(['acc-alice:akinci']);
    const upgrade = (token?: string) => app.inject({ method: 'POST', url: '/arena/upgrade', headers: token ? { authorization: `Bearer ${token}` } : {} });
    expect([(await upgrade()).statusCode, (await upgrade('token-carol')).statusCode, (await upgrade('token-alice')).statusCode]).toEqual([401, 403, 200]);
    expect(calls.upgrade).toEqual(['acc-alice']);
  });
});
