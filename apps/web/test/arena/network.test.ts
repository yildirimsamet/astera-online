import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARENA_LAYOUT, ARENA_MAX_SEATS, ARENA_PROTOCOL, ARENA_TUNING as T, FAR_EVERY, MID_EVERY, createInput, createPilot, createSandboxWorld, keyFeed, packFar, packPilot, packRemote, scanTargets,
  type ArenaFeed, type Pilot } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';
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
    network.connect('kilavuz', 'smoke');
    socket().open();
    await vi.waitFor(() => { expect(socket().sent).toHaveLength(1); });
    expect(socket().sent[0]).toMatchObject({ kind: 'hello', v: ARENA_PROTOCOL, mode: 'enter', token: 'token-alice' });
    network.dispose();
  });

  it('keeps the guest hello when no session is behind the sandbox', () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('kilavuz', 'smoke');
    socket().open();
    const hello = socket().sent[0] as { guestId?: string; token?: string };
    expect(hello.guestId).toMatch(/^[a-zA-Z0-9-]{8,96}$/);
    expect(hello.token).toBeUndefined();
    network.dispose();
  });

  it('turns the roster into ranked standings and reports why the room refused', async () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined,
      () => Promise.resolve('token-alice'));
    network.connect('kilavuz', 'smoke');
    socket().open();
    await vi.waitFor(() => { expect(socket().sent).toHaveLength(1); });
    socket().receive(welcome([{ id: 4, name: 'Alice', ship: 'kilavuz', points: 12, kills: 1, deaths: 2 }, { id: 5, name: 'Bob', ship: 'akinci', points: 30, kills: 0, deaths: 0 }]));
    expect(network.getSnapshot()).toMatchObject({ phase: 'online', pilots: 2 });
    expect(network.getSnapshot().board.map(row => [row.name, row.self])).toEqual([['Bob', false], ['Alice', true]]);
    socket().receive({ kind: 'kick', reason: 'denied' });
    expect(network.getSnapshot()).toMatchObject({ phase: 'failed', reason: 'denied' });
    network.dispose();
  });
});

// Owner 2026-10-23: the room seats ARENA_SEATS (up to ARENA_MAX_SEATS). The client took a
// roster of 16 rows at most and closed the link on a bigger one: the 14th pilot in cut everyone off.
describe('a full room', () => {
  it('stays online through a roster of every seat and the three bots', async () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined,
      () => Promise.resolve('token-alice'));
    network.connect('kilavuz', 'smoke');
    socket().open();
    await vi.waitFor(() => { expect(socket().sent).toHaveLength(1); });
    const bots = (['hunter', 'miner', 'patrol'] as const).map((role, i) => ({ id: i + 1, name: role, role, ship: 'kilavuz' }));
    const pilots = Array.from({ length: ARENA_MAX_SEATS }, (_, i) => ({ id: i + 4, name: `Pilot ${String(i + 1)}`, ship: 'muhafiz', points: 0, kills: 0, deaths: 0 }));
    socket().receive(welcome([...bots, ...pilots]));
    expect(network.getSnapshot()).toMatchObject({ phase: 'online', pilots: ARENA_MAX_SEATS });
    socket().receive({ kind: 'roster', pilots: [...bots, ...pilots] });
    expect(network.getSnapshot()).toMatchObject({ phase: 'online', pilots: ARENA_MAX_SEATS });
    expect(socket().readyState).toBe(FakeSocket.OPEN);
    network.dispose();
  });

  it('says the room is full without a seat count that no longer holds', async () => {
    for (const language of ['tr', 'en']) {
      await i18n.changeLanguage(language);
      expect(arenaCopy().kicks.full).not.toMatch(/\d/);
    }
  });
});

// V6g, 2026-10-23 (docs/komutan-gemisi/17-paket-kucultme-plani.md): shared rows arrive as change.
describe('the snapshot feed on the client', () => {
  const online = async (): Promise<{ network: ReturnType<typeof createArenaNetwork>; world: ReturnType<typeof createSandboxWorld> }> => {
    const world = createSandboxWorld({ bots: 0 });
    const network = createArenaNetwork(world, { sensitivity: 1, invertPitch: false }, () => undefined, () => Promise.resolve('token-alice'));
    network.connect('kilavuz', 'smoke'); socket().open();
    await vi.waitFor(() => { expect(socket().sent).toHaveLength(1); });
    socket().receive(welcome([]));
    return { network, world };
  };
  const empty: ArenaFeed = { key: 0, bullets: [], bulletsGone: [], smoke: [], smokeGone: [], impacts: [], cargo: [], cargoGone: [], minerals: [], missiles: [] };
  const snap = (tick: number, feed: Partial<ArenaFeed>) => ({ kind: 'snap', tick, ack: 0, self: packPilot(createPilot(4)), others: [], mid: [], far: [], scan: [], ...empty, ...feed });

  it('flies a bullet from the snapshot it was born in until the room says it went', async () => {
    const { network, world } = await online();
    socket().receive(snap(10, { key: 1, minerals: keyFeed(world).minerals, bullets: [[7, 100, 0, 0, 1200, 0, 0, 0.6, 9]] }));
    expect(world.projectiles[7]).toMatchObject({ life: 0.6, owner: 9 });
    network.step(createInput()); network.step(createInput());
    expect(world.projectiles[7]?.p.x).toBeCloseTo(100 + 2 * 1200 / T.tickRate, 6);
    expect(world.projectiles[7]?.life).toBeCloseTo(0.6 - 2 / T.tickRate, 6);
    // Nothing about it in the next delta: it keeps flying. Then it hits something.
    socket().receive(snap(12, {}));
    expect(world.projectiles[7]?.life).toBeGreaterThan(0);
    socket().receive(snap(14, { bulletsGone: [7] }));
    expect(world.projectiles[7]?.life).toBeLessThanOrEqual(0);
    network.dispose();
  });

  it('ages smoke between snapshots and puts it out at the end of its life, as the room does', async () => {
    const { network, world } = await online();
    socket().receive(snap(10, { key: 1, minerals: keyFeed(world).minerals, smoke: [[3, 5, 5, 5, T.smokeLife - 1 / T.tickRate, 9]] }));
    expect(world.smoke[3]?.active).toBe(true);
    network.step(createInput()); network.step(createInput());
    expect(world.smoke[3]?.active).toBe(false);
    network.dispose();
  });

  it('starts over from a key frame', async () => {
    const { network, world } = await online();
    socket().receive(snap(10, { key: 1, minerals: keyFeed(world).minerals, bullets: [[7, 100, 0, 0, 1200, 0, 0, 0.6, 9]], cargo: [[2, 1, 2, 3, 4, 1]] }));
    socket().receive(snap(12, { key: 1, minerals: keyFeed(world).minerals }));
    expect(world.projectiles[7]?.life).toBeLessThanOrEqual(0);
    expect(world.cargoDrops[2]?.active).toBe(false);
    network.dispose();
  });

  it('tells the player to reload when the room speaks another version', async () => {
    const { network } = await online();
    socket().receive({ kind: 'kick', reason: 'version' });
    expect(network.getSnapshot()).toMatchObject({ phase: 'failed', reason: 'version' });
    for (const language of ['tr', 'en']) {
      await i18n.changeLanguage(language);
      expect(arenaCopy().kicks.version).toBeTruthy();
    }
    network.dispose();
  });
});

describe('room standings', () => {
  it('ranks by farm points, then kills, then fewer deaths, then name; bots never rank', () => {
    const board = rankStandings([
      { id: 1, name: 'hunter', ship: 'kilavuz', role: 'hunter' },
      { id: 4, name: 'Cem', ship: 'kilavuz', points: 40, kills: 2, deaths: 1 },
      { id: 5, name: 'Ada', ship: 'kilavuz', points: 40, kills: 2, deaths: 1 },
      { id: 6, name: 'Bora', ship: 'kilavuz', points: 40, kills: 2, deaths: 0 },
      { id: 8, name: 'Deniz', ship: 'kilavuz', points: 40, kills: 3, deaths: 5 },
      { id: 9, name: 'Ece', ship: 'kilavuz', points: 90, kills: 0, deaths: 4 },
      { id: 7, name: 'Can', ship: 'kilavuz' },
    ], 7);
    expect(board.map(row => row.name)).toEqual(['Ece', 'Deniz', 'Bora', 'Ada', 'Cem', 'Can']);
    expect(board.at(-1)).toEqual({ id: 7, name: 'Can', points: 0, kills: 0, deaths: 0, self: true });
  });
});

describe('aim horizon', () => {
  it('knows how far behind our own shot the other ships are drawn (the aim horizon)', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('kilavuz', 'smoke');
    socket().open();
    socket().receive(welcome([]));
    expect(network.aimHorizon()).toBe(0);
    const snap = (tick: number, ack: number) => ({ kind: 'snap', tick, ack, self: packPilot(createPilot(4)), others: [packRemote(createPilot(9))], mid: [], far: [], scan: [],
      ...keyFeed(createSandboxWorld({ bots: 0 })) });
    socket().receive(snap(100, 0));
    const input = { ...createInput(), throttle: 1 };
    for (let i = 0; i < 6; i++) network.step(input);
    // Our ship runs 6 unacknowledged inputs ahead of tick 100; the others are drawn interpDelay behind it.
    expect(network.aimHorizon()).toBeCloseTo((6 + T.interpDelay * T.tickRate) / T.tickRate, 6);
    now += 100;
    socket().receive(snap(103, 4));
    network.step(input);
    // Two inputs were acknowledged, one more went out: three ahead of tick 103.
    expect(network.aimHorizon()).toBeCloseTo((3 + T.interpDelay * T.tickRate) / T.tickRate, 6);
    // A stalled link does not fling the lead mark across the screen.
    for (let i = 0; i < 60; i++) network.step(input);
    expect(network.aimHorizon()).toBe(0.6);
    network.dispose();
    vi.restoreAllMocks();
  });
});


// Owner 2026-10-23 (18-kademeli-gorunurluk-plani.md): ships to 1.6 km come in every snapshot,
// ships to 2.4 km every third (FAR_EVERY ticks). Each ship is drawn from its own samples.
// Ships between 800 m and 1.6 km come every other snapshot (MID_EVERY ticks).
describe('other ships in three tiers', () => {
  const SNAP_MS = 1000 / T.snapshotRate;
  const ship = (id: number, x: number): Pilot => { const p = createPilot(id); p.p.x = x; p.q = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }; p.s = 80; p.throttle = 1; return p; };
  /** A room that streams one snapshot every 2 ticks; `rows(tick)` says which ships it carries. */
  const stream = (rows: (tick: number) => { others?: Pilot[]; mid?: Pilot[]; far?: Pilot[] }) => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const world = createSandboxWorld({ bots: 0 });
    const network = createArenaNetwork(world, { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('kilavuz', 'smoke'); socket().open(); socket().receive(welcome([]));
    const feed = keyFeed(createSandboxWorld({ bots: 0 }));
    /** Ids drawn and their x after each snapshot, one frame later. */
    const frames: { tick: number; drawn: Map<number, number> }[] = [];
    const run = (from: number, to: number): void => {
      for (let tick = from; tick <= to; tick += 2) {
        const { others = [], mid = [], far = [] } = rows(tick);
        socket().receive({ kind: 'snap', tick, ack: 0, self: packPilot(createPilot(4)), others: others.map(packRemote), mid: mid.map(packRemote), far: far.map(packFar), scan: [],
          ...feed, key: tick === from ? 1 : 0 });
        now += SNAP_MS / 2; network.step(createInput()); now += SNAP_MS / 2; network.step(createInput());
        frames.push({ tick, drawn: new Map(world.drones.map(d => [d.id, d.p.x])) });
      }
    };
    return { run, frames, done: () => { network.dispose(); vi.restoreAllMocks(); } };
  };
  // 80 m/s along +x: 2.67 m a tick.
  const at = (id: number, tick: number, x0: number): Pilot => ship(id, x0 + tick * 80 / T.tickRate);

  it('keeps a far ship drawn between its rows and moves it smoothly', () => {
    const room = stream(tick => ({ far: tick % FAR_EVERY === 0 ? [at(30, tick, 2000)] : [] }));
    room.run(96, 140);
    const seen = room.frames.filter(f => f.tick >= 100);
    expect(seen.every(f => f.drawn.has(30))).toBe(true);
    const xs = seen.map(f => f.drawn.get(30) ?? 0);
    for (let i = 1; i < xs.length; i++) {
      const step = (xs[i] ?? 0) - (xs[i - 1] ?? 0);
      // A snapshot apart is 2 ticks, 5.3 m: never backwards, never a jump.
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThan(2 * 2 * 80 / T.tickRate);
    }
    room.done();
  });

  it('drops a near ship at the first snapshot without it: a dead or hidden ship never floats on', () => {
    const room = stream(tick => ({ others: tick < 110 ? [at(20, tick, 300)] : [] }));
    room.run(100, 114);
    expect(room.frames.find(f => f.tick === 108)?.drawn.has(20)).toBe(true);
    expect(room.frames.find(f => f.tick === 110)?.drawn.has(20)).toBe(false);
    room.done();
  });

  it('keeps a middle ship drawn between its rows, moving smoothly and never flown on past its newest one', () => {
    const room = stream(tick => ({ mid: tick % MID_EVERY === 0 ? [at(32, tick, 1000)] : [] }));
    room.run(96, 140);
    const seen = room.frames.filter(f => f.tick >= 100);
    expect(seen.every(f => f.drawn.has(32))).toBe(true);
    const xs = seen.map(f => f.drawn.get(32) ?? 0);
    for (let i = 1; i < xs.length; i++) {
      const step = (xs[i] ?? 0) - (xs[i - 1] ?? 0);
      // Steady 80 m/s: every snapshot apart the same 5.3 m, a row carried or not.
      expect(step).toBeCloseTo(2 * 80 / T.tickRate, 1);
    }
    room.done();
  });

  it('drops a middle ship once a middle snapshot comes without it', () => {
    const room = stream(tick => ({ mid: tick % MID_EVERY === 0 && tick < 112 ? [at(33, tick, 1000)] : [] }));
    room.run(100, 120);
    expect(room.frames.find(f => f.tick === 110)?.drawn.has(33)).toBe(true);
    expect(room.frames.find(f => f.tick === 112)?.drawn.has(33)).toBe(false);
    room.done();
  });

  it('drops a far ship once a far snapshot comes without it', () => {
    const room = stream(tick => ({ far: tick % FAR_EVERY === 0 && tick < 110 ? [at(31, tick, 2000)] : [] }));
    room.run(102, 120);
    expect(room.frames.find(f => f.tick === 110)?.drawn.has(31)).toBe(true);
    expect(room.frames.find(f => f.tick === 114)?.drawn.has(31)).toBe(false);
    room.done();
  });

  it('carries a ship across the tiers with no gap and no jump', () => {
    // Near rows to tick 110, middle to 126, then far: the room sends the first row of a new tier at once, then on its ticks.
    const room = stream(tick => tick <= 110 ? { others: [at(25, tick, 700)] }
      : tick <= 126 ? (tick === 112 || tick % MID_EVERY === 0 ? { mid: [at(25, tick, 700)] } : {})
        : tick === 128 || tick % FAR_EVERY === 0 ? { far: [at(25, tick, 700)] } : {});
    room.run(100, 160);
    const seen = room.frames.filter(f => f.tick >= 102);
    expect(seen.every(f => f.drawn.has(25))).toBe(true);
    const xs = seen.map(f => f.drawn.get(25) ?? 0);
    for (let i = 1; i < xs.length; i++) {
      const step = (xs[i] ?? 0) - (xs[i - 1] ?? 0);
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThan(2 * 2 * 80 / T.tickRate);
    }
    room.done();
  });
});

// Y4, owner 2026-10-23: the pilot names its class in the hello; the roster says everyone's.
describe('ship classes on the client', () => {
  it('names the chosen class and tactic in its hello', () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('muhafiz', 'cloak');
    socket().open();
    expect(socket().sent[0]).toMatchObject({ kind: 'hello', ship: 'muhafiz', tactic: 'cloak' });
    network.dispose();
  });

  it('sends the A slot as button 64 and its target last, -1 without one (Y4c)', () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('muhafiz', 'smoke'); socket().open();
    socket().receive(welcome([{ id: 4, name: 'Alice', ship: 'muhafiz' }]));
    const sentInput = (): number[] => {
      const last = [...socket().sent].reverse().find(m => typeof m === 'object' && m !== null && 'kind' in m && m.kind === 'in');
      return (last as { values: number[] }).values;
    };
    network.step({ ...createInput(), signature: true, signatureTarget: 4 });
    expect([(sentInput()[4] ?? 0) & 64, sentInput()[7]]).toEqual([64, 4]);
    network.step(createInput());
    expect([(sentInput()[4] ?? 0) & 64, sentInput()[7]]).toEqual([0, -1]);
    network.dispose();
  });

  it('flies each other ship as the class the roster names, and follows a change', () => {
    const world = createSandboxWorld({ bots: 0 });
    const network = createArenaNetwork(world, { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('kilavuz', 'smoke'); socket().open();
    socket().receive(welcome([{ id: 4, name: 'Alice', ship: 'kilavuz' }, { id: 7, name: 'Bob', ship: 'muhafiz' }]));
    const bob = createPilot(7, 'muhafiz'); bob.p.z = 200;
    const row = packRemote(bob);
    const snap = (tick: number) => ({ kind: 'snap', tick, ack: 0, self: packPilot(createPilot(4)), others: [row], mid: [], far: [], scan: [], key: 1,
      bullets: [], bulletsGone: [], smoke: [], smokeGone: [], impacts: [], cargo: [], cargoGone: [], minerals: keyFeed(world).minerals, missiles: [] });
    socket().receive(snap(10)); socket().receive(snap(12));
    network.step(createInput());
    expect(world.drones.map(p => [p.id, p.ship])).toEqual([[7, 'muhafiz']]);
    socket().receive({ kind: 'roster', pilots: [{ id: 4, name: 'Alice', ship: 'kilavuz' }, { id: 7, name: 'Bob', ship: 'akinci' }] });
    network.step(createInput());
    expect(world.drones[0]?.ship).toBe('akinci');
    network.dispose();
  });

  it('closes on a roster row without a class: a room of another protocol', () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('kilavuz', 'smoke'); socket().open();
    socket().receive(welcome([{ id: 4, name: 'Alice' }]));
    expect(socket().readyState).not.toBe(FakeSocket.OPEN);
    network.dispose();
  });
});

// Y4d: the illusion and the sweep ride buttons 128 and 256; a sweep's marks come back as `scan`.
describe('tactics on the client (Y4d)', () => {
  const sentButtons = (): number => {
    const last = [...socket().sent].reverse().find(m => typeof m === 'object' && m !== null && 'kind' in m && m.kind === 'in');
    return (last as { values: number[] }).values[4] ?? 0;
  };

  it('sends the illusion as button 128 and the sweep as 256', () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('akinci', 'illusion'); socket().open();
    socket().receive(welcome([{ id: 4, name: 'Alice', ship: 'akinci' }]));
    network.step({ ...createInput(), illusion: true });
    expect(sentButtons() & (128 | 256)).toBe(128);
    network.step({ ...createInput(), radar: true });
    expect(sentButtons() & (128 | 256)).toBe(256);
    network.step(createInput());
    expect(sentButtons() & (128 | 256)).toBe(0);
    network.dispose();
  });

  it('marks the ships its own sweep found, as the room says, and none once the room stops saying it', () => {
    const world = createSandboxWorld({ bots: 0 });
    const network = createArenaNetwork(world, { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('akinci', 'radar'); socket().open();
    socket().receive(welcome([{ id: 4, name: 'Alice', ship: 'akinci' }, { id: 9, name: 'Bob', ship: 'muhafiz' }]));
    const bob = createPilot(9, 'muhafiz'); bob.p.z = 4000;
    const snap = (tick: number, scan: number[]) => ({ kind: 'snap', tick, ack: 0, self: packPilot(createPilot(4)), others: [], mid: [], far: scan.length ? [packFar(bob)] : [],
      scan, ...keyFeed(world) });
    socket().receive(snap(10, [9])); network.step(createInput());
    expect(scanTargets(world, world.pilot.id)).toEqual([9]);
    socket().receive(snap(12, [])); network.step(createInput());
    expect(scanTargets(world, world.pilot.id)).toEqual([]);
    network.dispose();
  });

  it('names an illusion like its pilot, and never ranks or counts it', () => {
    const world = createSandboxWorld({ bots: 0 });
    const network = createArenaNetwork(world, { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('akinci', 'illusion'); socket().open();
    socket().receive(welcome([{ id: 4, name: 'Alice', ship: 'akinci', points: 3, kills: 0, deaths: 0 }, { id: 5, name: 'Bob', ship: 'muhafiz', points: 1, kills: 0, deaths: 0 },
      { id: 11, name: 'Bob', ship: 'muhafiz', copyOf: 5 }]));
    expect(network.getSnapshot().pilots).toBe(2);
    expect(network.getSnapshot().board.map(row => row.id)).toEqual([4, 5]);
    // Drawn as Bob's class, and known for what it is: the radar leaves it out.
    const copy = createPilot(11, 'muhafiz'); copy.p.z = 300;
    socket().receive({ kind: 'snap', tick: 10, ack: 0, self: packPilot(createPilot(4)), others: [packRemote(copy)], mid: [], far: [], scan: [], ...keyFeed(world) });
    network.step(createInput());
    expect(world.drones.map(d => [d.id, d.ship, d.decoyOf])).toEqual([[11, 'muhafiz', 5]]);
    network.dispose();
  });

  it('takes a roster of every seat with an illusion each', () => {
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined);
    network.connect('akinci', 'smoke'); socket().open();
    const seats = Array.from({ length: ARENA_MAX_SEATS }, (_, i) => ({ id: 4 + i, name: `P${String(i)}`, ship: 'akinci' }));
    const copies = seats.map((row, i) => ({ ...row, id: 1000 + i, copyOf: row.id }));
    socket().receive(welcome([...seats, ...copies]));
    expect(network.getSnapshot()).toMatchObject({ phase: 'online', pilots: ARENA_MAX_SEATS });
    network.dispose();
  });
});
