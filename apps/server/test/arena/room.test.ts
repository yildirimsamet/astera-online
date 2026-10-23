import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ARENA_LAYOUT, ARENA_PROTOCOL, ARENA_TUNING as T, CLASS_STATS, FAR_EVERY, MAX_REMOTE_PILOTS, MID_EVERY, PHASES, PILOT_WIDTH, copyFlight, createFlightState, createPilot, decodeArenaSnapshot,
  pilotVisible, ROLE_SHIPS, SHIP_CLASSES, TACTICS, type ArenaSnapshot, type ArenaWorld, type Pilot, type ShipClass, type Tactic } from '@astera/rules/arena';
import { registerArena } from '../../src/arena/server.js';
import { systemClock } from '../../src/clock.js';
import { loadEnv } from '../../src/env.js';

const ORIGIN = 'http://localhost:5198';
const env = loadEnv({ DATABASE_URL: 'postgres://test/arena_test', JWT_SECRET: 'test-secret-that-is-long-enough',
  ROLE: 'arena', ARENA_ENABLED: 'true', ARENA_DEV: 'true', ARENA_ALLOWED_ORIGINS: ORIGIN });

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { while (closers.length) await closers.pop()?.(); });

/** The world of the room `room()` opened last. */
let roomWorld: ArenaWorld | null = null;
async function room(seats?: number): Promise<string> {
  const app = Fastify();
  app.decorate('clock', systemClock);
  roomWorld = registerArena(app, seats === undefined ? env : { ...env, ARENA_SEATS: seats }).world;
  await app.listen({ port: 0, host: '127.0.0.1' });
  closers.push(() => app.close());
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return `ws://127.0.0.1:${String(address.port)}/arena/ws`;
}

function connect(url: string, guestId: string, ship: ShipClass = 'kilavuz', tactic: Tactic = 'smoke'): Promise<{ socket: WebSocket; messages: unknown[]; next: (match: (m: unknown) => boolean) => Promise<unknown> }> {
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
      socket.send(JSON.stringify({ kind: 'hello', v: ARENA_PROTOCOL, guestId, mode: 'enter', ship, tactic }));
      closers.push(async () => { socket.close(); await Promise.resolve(); });
      resolve({ socket, messages, next: match => new Promise(done => {
        const found = messages.find(match);
        if (found) done(found); else waiters.push({ match, done });
      }) });
    });
  });
}

const isSnap = (m: unknown): m is ArenaSnapshot => decodeArenaSnapshot(m) !== null;
const kind = (k: string) => (m: unknown): boolean => typeof m === 'object' && m !== null && 'kind' in m && m.kind === k;

/** One guest in the room, its ship held still so distances to it do not drift. */
async function seatedAlone(guestId: string): Promise<{ world: ArenaWorld; guest: Awaited<ReturnType<typeof connect>>; self: Pilot }> {
  const url = await room();
  const world = roomWorld; if (!world) throw new Error('no world');
  const guest = await connect(url, guestId);
  const welcome = await guest.next(kind('welcome')) as { pilotId: number };
  await guest.next(isSnap);
  const self = world.drones.find(p => p.id === welcome.pilotId); if (!self) throw new Error('no pilot');
  self.s = 0; self.throttle = 0; self.shield = 0;
  return { world, guest, self };
}
interface Line { x: number; y: number; z: number }
/** A direction from `self` along which a ship is in plain view out to `length` (no dust, inside the arena). */
function clearLine(world: ArenaWorld, self: Pilot, length: number): Line {
  for (const d of [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }, { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 },
    { x: -Math.SQRT1_2, y: 0, z: -Math.SQRT1_2 }, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }]) {
    let clear = true;
    for (let r = 100; r <= length && clear; r += 50) {
      const probe = createPilot(99999); Object.assign(probe.p, { x: self.p.x + d.x * r, y: self.p.y + d.y * r, z: self.p.z + d.z * r });
      clear = Math.hypot(probe.p.x, probe.p.z) < T.arenaRadius - 300 && Math.abs(probe.p.y) < T.arenaHalfHeight - 100 && pilotVisible(world, self, probe);
    }
    if (clear) return d;
  }
  throw new Error('no clear line');
}
function place(world: ArenaWorld, id: number, self: Pilot, line: Line, distance: number): number {
  world.drones.push(createPilot(id)); world.dronePrevious.push(createFlightState());
  move(world, id, self, line, distance);
  return id;
}
function move(world: ArenaWorld, id: number, self: Pilot, line: Line, distance: number): void {
  const other = world.drones.find(p => p.id === id); if (!other) throw new Error('no ship');
  Object.assign(other.p, { x: self.p.x + line.x * distance, y: self.p.y + line.y * distance, z: self.p.z + line.z * distance });
  other.s = 0; other.throttle = 0;
  const i = world.drones.indexOf(other); const prior = world.dronePrevious[i]; if (prior) copyFlight(prior, other);
}

describe('arena room protocol v2', () => {
  it('welcomes a guest with the v2 layout and streams decodable snapshots with mineral state', async () => {
    const url = await room();
    const pilot = await connect(url, 'guest-room-test-a');
    const welcome = await pilot.next(kind('welcome'));
    expect(welcome).toMatchObject({ v: ARENA_PROTOCOL, layoutVersion: ARENA_LAYOUT.version });
    const snap = await pilot.next(isSnap);
    if (!isSnap(snap)) throw new Error('no snapshot');
    expect(snap.self).toHaveLength(PILOT_WIDTH);
    // The first snapshot is a key frame on a snapshot tick: every crystal, none dry yet.
    expect(snap.key).toBe(1);
    expect(snap.tick % (T.tickRate / T.snapshotRate)).toBe(0);
    expect(snap.minerals.map(row => row[0])).toEqual(ARENA_LAYOUT.deposits.map((_, i) => i));
    expect(snap.minerals.every(row => row[2] === 0)).toBe(true);
    // Then deltas.
    const next = await pilot.next(m => isSnap(m) && m.tick > snap.tick);
    expect(next).toMatchObject({ key: 0 });
    const roster = (welcome as { pilots: { role?: string }[] }).pilots.map(p => p.role).filter(Boolean);
    expect(roster.sort()).toEqual(['hunter', 'miner', 'patrol']);
  });

  it('clamps an oversized aim-assist channel and rejects out-of-range input', async () => {
    const url = await room();
    const pilot = await connect(url, 'guest-room-test-b');
    await pilot.next(kind('welcome'));
    const send = (values: number[]): void => { pilot.socket.send(JSON.stringify({ kind: 'in', values })); };
    for (let seq = 1; seq <= 40; seq++) send([seq, 0, 0, 100, 0, 1000, 0, -1]);
    const later = await pilot.next(m => isSnap(m) && m.ack >= 30);
    if (!isSnap(later)) throw new Error('no snapshot');
    const omegaYaw = later.self[10] ?? 0;
    expect(Math.abs(omegaYaw)).toBeLessThanOrEqual(T.assistMax * T.turnRateMax * (1 + T.slowTurnBonus) + 1e-9);
    expect(Math.abs(omegaYaw)).toBeGreaterThan(0);
    const before = pilot.messages.length;
    send([41, 0, 0, 100, 0, 5000, 0, -1]);
    await new Promise(resolve => setTimeout(resolve, 300));
    const acks = pilot.messages.slice(before).filter(isSnap).map(m => m.ack);
    expect(acks.every(ack => ack < 41)).toBe(true);
  });
  it('answers a client of another protocol version instead of leaving it waiting', async () => {
    const url = await room();
    const socket = new WebSocket(url, { origin: ORIGIN });
    const reply = new Promise<unknown>(resolve => { socket.on('message', raw => { resolve(JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : '')); }); });
    await new Promise(resolve => socket.on('open', resolve));
    closers.push(async () => { socket.close(); await Promise.resolve(); });
    socket.send(JSON.stringify({ kind: 'hello', v: ARENA_PROTOCOL - 1, guestId: 'guest-old-client', mode: 'enter' }));
    expect(await reply).toEqual({ kind: 'kick', reason: 'version' });
  });
  it('keeps the stream light: shared rows rounded, the own pilot exact for reconciliation', async () => {
    const url = await room();
    const pilot = await connect(url, 'guest-room-test-c');
    await pilot.next(kind('welcome'));
    const snap = await pilot.next(m => isSnap(m) && m.cargo.length > 0);
    if (!isSnap(snap)) throw new Error('no snapshot');
    const decimals = (n: number): number => { const text = String(n); const dot = text.indexOf('.'); return dot < 0 ? 0 : text.length - dot - 1; };
    // Centimetres for places, milliseconds for clocks.
    for (const row of [...snap.cargo, ...snap.bullets, ...snap.smoke, ...snap.impacts, ...snap.minerals]) for (const n of row) expect(decimals(n), String(n)).toBeLessThanOrEqual(3);
    for (const row of snap.others) for (const n of row) expect(decimals(n), String(n)).toBeLessThanOrEqual(4);
    expect(snap.self.some(n => decimals(n) > 4)).toBe(true);
  });
  it('gives a full room\'s seat to a newcomer once a finished, disconnected pilot is holding it', async () => {
    const url = await room(8);
    const seated = await Promise.all(Array.from({ length: 8 }, (_, i) => connect(url, `guest-room-seat-${String(i)}`)));
    await Promise.all(seated.map(s => s.next(kind('welcome'))));
    const late = await connect(url, 'guest-room-seat-late');
    expect(await late.next(m => kind('kick')(m) || kind('welcome')(m))).toMatchObject({ kind: 'kick', reason: 'full' });
    const leaver = seated[0]; if (!leaver) throw new Error('no pilot');
    leaver.socket.send(JSON.stringify({ kind: 'dev', action: 'exit' }));
    await leaver.next(m => isSnap(m) && m.self[PILOT_WIDTH - 1] === PHASES.indexOf('extracted'));
    leaver.socket.close();
    await new Promise(resolve => setTimeout(resolve, 200));
    const newcomer = await connect(url, 'guest-room-seat-new');
    expect(await newcomer.next(m => kind('kick')(m) || kind('welcome')(m))).toMatchObject({ kind: 'welcome' });
  }, 15_000);
  it('accepts the LAND bit in an input (owner 2026-10-21: rocks and buildings land only on request)', async () => {
    const url = await room();
    const pilot = await connect(url, 'guest-room-test-land');
    await pilot.next(kind('welcome'));
    pilot.socket.send(JSON.stringify({ kind: 'in', values: [1, 0, 0, 15, 32, 0, 0, -1] }));
    expect(await pilot.next(m => isSnap(m) && m.ack >= 1)).toBeTruthy();
  });

  // Owner 2026-10-23 (18-kademeli-gorunurluk-plani.md): the nearest fifty within 2.4 km, full rows
  // to 1.6 km and far rows beyond, five times a second. Before: the nearest twelve within 1.6 km.
  it('sends the nearest fifty ships: every snapshot to 800 m, every other to 1.6 km, every third to 2.4 km, nobody past it', async () => {
    const { world, guest, self } = await seatedAlone('tier-guest-0001');
    const line = clearLine(world, self, 2600);
    const near = Array.from({ length: 20 }, (_, i) => place(world, 600 + i, self, line, 200 + i * 25));
    const mid = Array.from({ length: 20 }, (_, i) => place(world, 650 + i, self, line, 900 + i * 30));
    const far = Array.from({ length: 14 }, (_, i) => place(world, 700 + i, self, line, 1700 + i * 46));
    const beyond = place(world, 800, self, line, 2550);
    const at = world.tick;
    // A ship new to the viewer comes at once, whatever the tick.
    const first = await guest.next(m => isSnap(m) && m.tick > at) as ArenaSnapshot;
    const sent = [...first.others, ...first.mid, ...first.far].map(row => row[0] ?? -1);
    expect(sent).toHaveLength(MAX_REMOTE_PILOTS);
    expect(new Set(sent).size).toBe(sent.length);
    for (const id of near) expect(first.others.map(row => row[0])).toContain(id);
    for (const id of mid) expect(first.mid.map(row => row[0])).toContain(id);
    expect(sent).not.toContain(beyond);
    // Nearest first: a far ship left out is farther than every far ship sent.
    const distance = (id: number): number => { const p = world.drones.find(d => d.id === id); return p ? Math.hypot(p.p.x - self.p.x, p.p.y - self.p.y, p.p.z - self.p.z) : Infinity; };
    const keptFar = far.filter(id => sent.includes(id)); const droppedFar = far.filter(id => !sent.includes(id));
    expect(keptFar.length).toBeGreaterThan(0);
    for (const dropped of droppedFar) expect(distance(dropped)).toBeGreaterThan(Math.max(...keptFar.map(distance)));
    for (const id of keptFar) expect(first.far.map(row => row[0])).toContain(id);
    // Then near rows every snapshot, middle rows every other one (7.5 Hz), far rows every third (5 Hz).
    const later: ArenaSnapshot[] = [];
    for (let tick = first.tick; later.length < 9;) {
      const snap = await guest.next(m => isSnap(m) && m.tick > tick) as ArenaSnapshot; later.push(snap); tick = snap.tick;
    }
    for (const snap of later) {
      for (const id of near) expect(snap.others.map(row => row[0])).toContain(id);
      const midIds = snap.mid.map(row => row[0]); const farIds = snap.far.map(row => row[0]);
      if (snap.key === 1 || snap.tick % MID_EVERY === 0) for (const id of mid) expect(midIds).toContain(id);
      else expect(midIds).toEqual([]);
      if (snap.key === 1 || snap.tick % FAR_EVERY === 0) for (const id of keptFar) expect(farIds).toContain(id);
      else expect(farIds).toEqual([]);
      expect(snap.others.some(row => mid.includes(row[0] ?? -1) || far.includes(row[0] ?? -1))).toBe(false);
    }
    expect(later.some(snap => snap.key === 0 && snap.tick % MID_EVERY !== 0)).toBe(true);
  }, 15_000);

  it('moves a ship between tiers without a gap, and holds it across a 50 m band at 800 m and 1.6 km', async () => {
    const { world, guest, self } = await seatedAlone('tier-guest-0002');
    const line = clearLine(world, self, 2000);
    const id = place(world, 900, self, line, 700);
    type Tier = 'near' | 'mid' | 'far' | 'none';
    const tierOf = (snap: ArenaSnapshot): Tier => snap.others.some(row => row[0] === id) ? 'near' : snap.mid.some(row => row[0] === id) ? 'mid'
      : snap.far.some(row => row[0] === id) ? 'far' : 'none';
    const tierAfter = async (distance: number): Promise<{ tier: Tier; snaps: ArenaSnapshot[] }> => {
      move(world, id, self, line, distance);
      const at = world.tick; const snaps: ArenaSnapshot[] = [];
      for (let tick = at; snaps.length < 4;) { const snap = await guest.next(m => isSnap(m) && m.tick > tick) as ArenaSnapshot; snaps.push(snap); tick = snap.tick; }
      const first = snaps[0]; if (!first) throw new Error('no snapshot');
      return { tier: tierOf(first), snaps };
    };
    expect((await tierAfter(700)).tier).toBe('near');
    // Inside the band it keeps the tier it had, in every snapshot.
    const heldNear = await tierAfter(820);
    for (const snap of heldNear.snaps) expect(tierOf(snap)).toBe('near');
    // Leaving the band: the very next snapshot carries it in its new tier, on that tier's tick or not.
    expect((await tierAfter(900)).tier).toBe('mid');
    const heldMid = await tierAfter(780);
    for (const snap of heldMid.snaps) expect(['mid', 'none']).toContain(tierOf(snap));
    expect((await tierAfter(1500)).tier).toBe('mid');
    expect((await tierAfter(1620)).snaps.every(snap => tierOf(snap) !== 'far' && tierOf(snap) !== 'near')).toBe(true);
    expect((await tierAfter(1700)).tier).toBe('far');
    const back = await tierAfter(1580);
    expect(back.snaps.some(snap => tierOf(snap) === 'mid')).toBe(false);
    expect((await tierAfter(1500)).tier).toBe('mid');
    expect((await tierAfter(700)).tier).toBe('near');
  }, 15_000);

  // Owner 2026-10-23: the 8-seat limit was the prototype's; the room seats ARENA_SEATS (100).
  it('seats more than eight pilots', async () => {
    const url = await room();
    const seated = await Promise.all(Array.from({ length: 12 }, (_, i) => connect(url, `guest-many-seat-${String(i)}`)));
    const answers = await Promise.all(seated.map(s => s.next(m => kind('kick')(m) || kind('welcome')(m))));
    expect(answers.every(kind('welcome'))).toBe(true);
  }, 15_000);

  // Owner 2026-10-23: entrances in turn, so two arrivals in a row never meet at the door.
  it('brings arrivals in through the entrances in turn', async () => {
    const url = await room();
    const entryOf = (snap: ArenaSnapshot): number => {
      const [, x = 0, y = 0, z = 0] = snap.self;
      let best = -1; let distance = Infinity;
      ARENA_LAYOUT.entries.forEach((entry, i) => { const d = Math.hypot(x - entry.x, y - entry.y, z - entry.z); if (d < distance) { distance = d; best = i; } });
      return best;
    };
    const entries: number[] = [];
    for (const id of ['turn-guest-0001', 'turn-guest-0002', 'turn-guest-0003']) {
      const guest = await connect(url, id);
      entries.push(entryOf(await guest.next(isSnap) as ArenaSnapshot));
    }
    const n = ARENA_LAYOUT.entries.length;
    expect(((entries[1] ?? 0) - (entries[0] ?? 0) + n) % n).toBe(1);
    expect(((entries[2] ?? 0) - (entries[1] ?? 0) + n) % n).toBe(1);
  });

  // Owner 2026-10-23 (100 seats): every join, kill and death sent the whole roster to everyone
  // at once, N² messages; a busy room sends it at most twice a second, folded.
  it('folds roster changes into one message every half second', async () => {
    const url = await room();
    const first = await connect(url, 'roster-guest-0000');
    await first.next(kind('welcome'));
    const after = first.messages.length;
    await Promise.all(Array.from({ length: 9 }, (_, i) => connect(url, `roster-guest-000${String(i + 1)}`)));
    const humans = (m: unknown): number => (m as { pilots: { role?: string }[] }).pilots.filter(p => !p.role).length;
    await first.next(m => kind('roster')(m) && humans(m) === 10);
    await new Promise(resolve => setTimeout(resolve, 600));
    const rosters = first.messages.slice(after).filter(kind('roster'));
    expect(rosters.length).toBeLessThanOrEqual(3);
    expect(humans(rosters.at(-1))).toBe(10);
  });

  // V6g, 50-pilot socket battle: the rows everyone shares (bullets, smoke, cargo, minerals) are
  // built once a tick for the whole room, not once per pilot; each still gets its own ship.
  it('sends every pilot the same shared rows in one tick, and each its own ship', async () => {
    const url = await room();
    const a = await connect(url, 'shared-guest-0001');
    const b = await connect(url, 'shared-guest-0002');
    await Promise.all([a.next(kind('welcome')), b.next(kind('welcome'))]);
    for (let seq = 1; seq <= 30; seq++) a.socket.send(JSON.stringify({ kind: 'in', values: [seq, 0, 0, 100, 1, 0, 0, -1] }));
    const first = await a.next(m => isSnap(m) && m.bullets.length > 0) as ArenaSnapshot;
    const second = await b.next(m => isSnap(m) && m.tick === first.tick) as ArenaSnapshot;
    expect(first.key).toBe(0);
    for (const key of ['key', 'bullets', 'bulletsGone', 'smoke', 'smokeGone', 'impacts', 'cargo', 'cargoGone', 'minerals'] as const) expect(second[key], key).toEqual(first[key]);
    expect(first.self[0]).not.toBe(second.self[0]);
  });
});

/** Y4, owner 2026-10-23: a pilot names its class in the hello; everyone's class rides the roster. */
describe('ship classes in the room', () => {
  interface Row { id: number; role?: 'hunter' | 'miner' | 'patrol'; ship: string }
  const pilots = (m: unknown): Row[] => (m as { pilots: Row[] }).pilots;

  it('flies the class the hello names, and the roster names every ship\'s class, bots by their role', async () => {
    const url = await room();
    const world = roomWorld; if (!world) throw new Error('no world');
    const guest = await connect(url, 'class-guest-muhafiz', 'muhafiz');
    const welcome = await guest.next(kind('welcome')) as { pilotId: number };
    const snap = await guest.next(isSnap) as ArenaSnapshot;
    expect(SHIP_CLASSES[snap.self[PILOT_WIDTH - 2] ?? -1]).toBe('muhafiz');
    const self = world.drones.find(p => p.id === welcome.pilotId);
    expect([self?.ship, self?.hull, self?.ammo]).toEqual(['muhafiz', CLASS_STATS.muhafiz.hull, CLASS_STATS.muhafiz.ammoCapacity]);
    const rows = pilots(welcome);
    expect(rows.find(row => row.id === welcome.pilotId)?.ship).toBe('muhafiz');
    for (const row of rows) if (row.role) expect(row.ship).toBe(ROLE_SHIPS[row.role]);
  });

  it('turns away a hello without a class or tactic, or with one it does not know, at once', async () => {
    const url = await room();
    for (const hello of [{ kind: 'hello', v: ARENA_PROTOCOL, guestId: 'class-guest-none', mode: 'enter', tactic: 'smoke' },
      { kind: 'hello', v: ARENA_PROTOCOL, guestId: 'class-guest-odd', mode: 'enter', ship: 'zeppelin', tactic: 'smoke' },
      { kind: 'hello', v: ARENA_PROTOCOL, guestId: 'class-guest-no-tactic', mode: 'enter', ship: 'akinci' },
      { kind: 'hello', v: ARENA_PROTOCOL, guestId: 'class-guest-odd-tactic', mode: 'enter', ship: 'akinci', tactic: 'mirror' }]) {
      const socket = new WebSocket(url, { origin: ORIGIN });
      const reply = new Promise<unknown>(resolve => { socket.on('message', raw => { resolve(JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : '')); }); });
      await new Promise(resolve => socket.on('open', resolve));
      closers.push(async () => { socket.close(); await Promise.resolve(); });
      socket.send(JSON.stringify(hello));
      expect(await reply).toEqual({ kind: 'kick', reason: 'protocol' });
    }
  });

  it('takes a new class at the next flight, never in the middle of one', async () => {
    const url = await room();
    const world = roomWorld; if (!world) throw new Error('no world');
    const first = await connect(url, 'class-guest-switch', 'akinci');
    const welcome = await first.next(kind('welcome')) as { pilotId: number };
    first.socket.close();
    const again = await connect(url, 'class-guest-switch', 'muhafiz');
    await again.next(kind('welcome'));
    const ship = (): string | undefined => world.drones.find(p => p.id === welcome.pilotId)?.ship;
    expect(ship()).toBe('akinci');
    const self = world.drones.find(p => p.id === welcome.pilotId); if (!self) throw new Error('no pilot');
    self.phase = 'dead';
    again.socket.send(JSON.stringify({ kind: 'dev', action: 'restart' }));
    await again.next(m => kind('roster')(m) && pilots(m).find(row => row.id === welcome.pilotId)?.ship === 'muhafiz');
    expect([ship(), self.hull]).toEqual(['muhafiz', CLASS_STATS.muhafiz.hull]);
  });

  it('caps the dev tank and hold at the class\'s own', async () => {
    const url = await room();
    const world = roomWorld; if (!world) throw new Error('no world');
    const guest = await connect(url, 'class-guest-dev', 'akinci');
    const welcome = await guest.next(kind('welcome')) as { pilotId: number };
    guest.socket.send(JSON.stringify({ kind: 'dev', action: 'fuel', value: 400 }));
    guest.socket.send(JSON.stringify({ kind: 'dev', action: 'cargo', value: 400 }));
    const self = world.drones.find(p => p.id === welcome.pilotId); if (!self) throw new Error('no pilot');
    await guest.next(isSnap);
    const seen = guest.messages.length;
    await guest.next(m => isSnap(m) && guest.messages.indexOf(m) >= seen);
    // The idle burn takes a hair off the tank between the order and the look.
    expect(self.fuel).toBeLessThanOrEqual(CLASS_STATS.akinci.fuelTank);
    expect(self.fuel).toBeGreaterThan(CLASS_STATS.akinci.fuelTank - 1);
    expect(self.cargo).toBe(CLASS_STATS.akinci.cargoCapacity);
  });
});

describe('signatures in the room (Y4c)', () => {
  it('flies the tactic the hello names', async () => {
    const url = await room();
    const world = roomWorld; if (!world) throw new Error('no world');
    const guest = await connect(url, 'sig-guest-cloak', 'muhafiz', 'cloak');
    const welcome = await guest.next(kind('welcome')) as { pilotId: number };
    const snap = await guest.next(isSnap) as ArenaSnapshot;
    expect(TACTICS[snap.self[PILOT_WIDTH - 18] ?? -1]).toBe('cloak');
    expect(world.drones.find(p => p.id === welcome.pilotId)?.tactic).toBe('cloak');
  });

  it('casts the A slot at the pilot the input names: a Muhafız shields itself, and not another', async () => {
    const url = await room();
    const world = roomWorld; if (!world) throw new Error('no world');
    const guest = await connect(url, 'sig-guest-ward', 'muhafiz');
    const welcome = await guest.next(kind('welcome')) as { pilotId: number };
    await guest.next(isSnap);
    const self = world.drones.find(p => p.id === welcome.pilotId); if (!self) throw new Error('no pilot');
    const other = world.drones.find(p => p.id !== self.id); if (!other) throw new Error('no other');
    guest.socket.send(JSON.stringify({ kind: 'in', values: [1, 0, 0, 0, 64, 0, 0, other.id] }));
    guest.socket.send(JSON.stringify({ kind: 'in', values: [2, 0, 0, 0, 0, 0, 0, -1] }));
    guest.socket.send(JSON.stringify({ kind: 'in', values: [3, 0, 0, 0, 64, 0, 0, self.id] }));
    await guest.next(m => isSnap(m) && (decodeArenaSnapshot(m)?.self[PILOT_WIDTH - 7] ?? 0) > 0);
    expect([self.shieldHp, self.shieldMax, other.shieldHp]).toEqual([T.wardHp, T.wardHp, 0]);
  });

  it('turns away an input with a button or target out of range', async () => {
    const url = await room();
    const world = roomWorld; if (!world) throw new Error('no world');
    const guest = await connect(url, 'sig-guest-odd', 'muhafiz');
    const welcome = await guest.next(kind('welcome')) as { pilotId: number };
    await guest.next(isSnap);
    const self = world.drones.find(p => p.id === welcome.pilotId); if (!self) throw new Error('no pilot');
    guest.socket.send(JSON.stringify({ kind: 'in', values: [1, 0, 0, 0, 512 + 64, 0, 0, self.id] }));
    guest.socket.send(JSON.stringify({ kind: 'in', values: [2, 0, 0, 0, 64, 0, 0, -2] }));
    guest.socket.send(JSON.stringify({ kind: 'in', values: [3, 0, 0, 0, 64, 0, 0] }));
    const seen = guest.messages.length;
    await guest.next(m => isSnap(m) && guest.messages.indexOf(m) >= seen + 3);
    expect(self.shieldHp).toBe(0);
  });
});

describe('tactics in the room (Y4d)', () => {
  interface Row { id: number; name: string; ship: string; copyOf?: number; points?: number }
  const pilots = (m: unknown): Row[] => (m as { pilots: Row[] }).pilots;
  async function seated(guestId: string, tactic: Tactic, ship: ShipClass = 'akinci') {
    const url = await room();
    const world = roomWorld; if (!world) throw new Error('no world');
    const guest = await connect(url, guestId, ship, tactic);
    const welcome = await guest.next(kind('welcome')) as { pilotId: number };
    await guest.next(isSnap);
    const self = world.drones.find(p => p.id === welcome.pilotId); if (!self) throw new Error('no pilot');
    self.shield = 0;
    return { world, guest, self, welcome, url };
  }

  it('casts an illusion on bit 128, and names the copy in a roster before any snapshot draws it', async () => {
    const { world, guest, self, welcome } = await seated('tactic-guest-illusion', 'illusion');
    const name = pilots(welcome).find(row => row.id === self.id)?.name;
    // Inside the half-second fold the join just used: the copy's roster cannot wait for it.
    guest.socket.send(JSON.stringify({ kind: 'in', values: [1, 0, 0, 0, 128, 0, 0, -1] }));
    const drawn = await guest.next(m => isSnap(m) && (m.self[PILOT_WIDTH - 20] ?? -1) >= 0) as ArenaSnapshot;
    const copyId = drawn.self[PILOT_WIDTH - 20] ?? -1;
    const copy = world.drones.find(p => p.id === copyId);
    expect(copy?.decoyOf).toBe(self.id);
    const named = guest.messages.findIndex(m => kind('roster')(m) && pilots(m).some(row => row.id === copyId));
    expect(named).toBeGreaterThanOrEqual(0);
    expect(named).toBeLessThan(guest.messages.indexOf(drawn));
    const row = pilots(guest.messages[named]).find(r => r.id === copyId);
    expect(row).toEqual({ id: copyId, name, ship: 'akinci', copyOf: self.id });
  });

  it('gives the next pilot an id no copy holds', async () => {
    const { world, guest, url } = await seated('tactic-guest-ids', 'illusion');
    guest.socket.send(JSON.stringify({ kind: 'in', values: [1, 0, 0, 0, 128, 0, 0, -1] }));
    await guest.next(m => isSnap(m) && (m.self[PILOT_WIDTH - 20] ?? -1) >= 0);
    const late = await connect(url, 'tactic-guest-late');
    const welcome = await late.next(kind('welcome')) as { pilotId: number };
    expect(world.drones.filter(p => p.id === welcome.pilotId)).toHaveLength(1);
  });

  it('breaks the copy when its pilot flies again', async () => {
    const { world, guest, self } = await seated('tactic-guest-restart', 'illusion');
    guest.socket.send(JSON.stringify({ kind: 'in', values: [1, 0, 0, 0, 128, 0, 0, -1] }));
    await guest.next(m => isSnap(m) && (m.self[PILOT_WIDTH - 20] ?? -1) >= 0);
    guest.socket.send(JSON.stringify({ kind: 'dev', action: 'restart' }));
    await guest.next(m => isSnap(m) && m.impacts.some(row => row[5] === 4));
    expect(world.drones.some(p => p.decoyOf === self.id)).toBe(false);
  });

  it('sends a radar sweep\'s marks wherever they are, out of range and in dust, and only for the sweep', async () => {
    const { world, guest, self } = await seated('tactic-guest-radar', 'radar');
    const out = Math.hypot(self.p.x, self.p.z) || 1;
    const far = createPilot(9001); world.drones.push(far); world.dronePrevious.push(createFlightState());
    Object.assign(far.p, { x: self.p.x - self.p.x / out * 5000, y: self.p.y, z: self.p.z - self.p.z / out * 5000 });
    const sent = (m: ArenaSnapshot): boolean => [...m.others, ...m.mid, ...m.far].some(row => row[0] === 9001);
    const before = guest.messages.length;
    await guest.next(m => isSnap(m) && guest.messages.indexOf(m) > before + 1);
    expect(guest.messages.filter(isSnap).some(sent)).toBe(false);
    guest.socket.send(JSON.stringify({ kind: 'in', values: [1, 0, 0, 0, 256, 0, 0, -1] }));
    const marked = await guest.next(m => isSnap(m) && m.scan.includes(9001)) as ArenaSnapshot;
    expect(marked.far.some(row => row[0] === 9001)).toBe(true);
    expect(far.threat).toBe(4);
    const sweep = world.scans.find(scan => scan.owner === self.id); if (!sweep) throw new Error('no sweep');
    sweep.ticks = 1;
    const after = guest.messages.length;
    const clean = await guest.next(m => isSnap(m) && guest.messages.indexOf(m) > after + 1) as ArenaSnapshot;
    expect([clean.scan, sent(clean)]).toEqual([[], false]);
  });

  it('never sends a sweep\'s marks to a pilot who did not sweep', async () => {
    const url = await room();
    const world = roomWorld; if (!world) throw new Error('no world');
    const sweeper = await connect(url, 'tactic-guest-sweeper', 'akinci', 'radar');
    const other = await connect(url, 'tactic-guest-bystander');
    await Promise.all([sweeper.next(isSnap), other.next(isSnap)]);
    sweeper.socket.send(JSON.stringify({ kind: 'in', values: [1, 0, 0, 0, 256, 0, 0, -1] }));
    await sweeper.next(m => isSnap(m) && m.scan.length > 0);
    const after = other.messages.length;
    const seen = await other.next(m => isSnap(m) && other.messages.indexOf(m) > after) as ArenaSnapshot;
    expect(seen.scan).toEqual([]);
    expect(world.scans).toHaveLength(1);
  });
});
