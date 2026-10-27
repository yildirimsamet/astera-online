import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ARENA_LAYOUT, ARENA_MAX_SEATS, ARENA_POOLS, ARENA_PROTOCOL, ARENA_ROSTER_MAX, ARENA_TUNING as T, FAR_EVERY, FAR_WIDTH, MAX_REMOTE_PILOTS, MID_EVERY, PILOT_WIDTH, REMOTE_NEAR_RANGE, REMOTE_WIDTH, createPilot, createSandboxWorld, shipStats,
  decodeArenaSnapshot, keyFeed, packFar, packPilot, packRemote, unpackFar, unpackPilot, unpackRemote, type ArenaSnapshot, type Pilot,
} from '../../src/arena/index.js';

function snapshot(): ArenaSnapshot {
  const self = createPilot(4);
  self.landed = 3; self.nx = 0; self.ny = 1; self.nz = 0; self.mining = true; self.cargo = 12.5; self.hold = [2.5, 6, 4];
  return { kind: 'snap', tick: 10, ack: 3, self: packPilot(self), others: [packRemote(createPilot(5))], mid: [packRemote(createPilot(7))], far: [packFar(createPilot(6))],
    ...keyFeed(createSandboxWorld({ bots: 0 })), scan: [6] };
}

/** A remote ship with every field the client draws set to something other than its default. */
function drawn(id: number): Pilot {
  const p = createPilot(id);
  Object.assign(p.p, { x: 1234.5678, y: -87.654321, z: 4321.0049 });
  const n = Math.hypot(0.1, 0.7, -0.2, 0.68); Object.assign(p.q, { x: 0.1 / n, y: 0.7 / n, z: -0.2 / n, w: 0.68 / n });
  p.s = 63.4567; p.throttle = 0.4567; p.omegaYaw = -0.83219; p.omegaPitch = 0.41234;
  p.landed = 3; p.nx = 0.6; p.ny = 0.8; p.nz = 0; p.hull = 287.456; p.shield = 40; p.turboActive = true; p.mining = true;
  p.gun = 1; p.shots = 917; p.phase = 'flying';
  return p;
}

describe('arena protocol v14', () => {
  it('bounds the optional spectator viewpoint and preserves an explicit end of the team', () => {
    expect(decodeArenaSnapshot({ ...snapshot(), watching: 5 })?.watching).toBe(5);
    expect(decodeArenaSnapshot({ ...snapshot(), watching: -1 })?.watching).toBe(-1);
    for (const watching of [-2, 0.5, 1e9, Number.NaN, '5', null]) expect(decodeArenaSnapshot({ ...snapshot(), watching })).toBeNull();
  });
  it('is a new version: signatures and the B slot travel (Y4c, signatures.test.ts); others travel in three tiers', () => {
    // 15 (owner 2026-10-27): hulls 50 % stronger; the decoder's bounds moved with them, so a page on 14 reloads.
    expect(ARENA_PROTOCOL).toBe(15);
    // 800 m / 1.6 km / 2.4 km (owner 2026-10-23): every snapshot, every other one, every third one.
    expect(REMOTE_NEAR_RANGE).toBe(800);
    expect(MID_EVERY).toBe(T.tickRate / T.snapshotRate * 2);
    expect(FAR_EVERY).toBe(T.tickRate / T.snapshotRate * 3);
    // The view runs two snapshots behind (interpDelay): a middle ship is drawn between two of its samples.
    expect(MID_EVERY).toBeLessThanOrEqual(Math.round(T.interpDelay * T.tickRate));
    expect(PILOT_WIDTH).toBe(72);
    expect(MAX_REMOTE_PILOTS).toBe(50);
    expect(REMOTE_WIDTH).toBeLessThan(PILOT_WIDTH / 2);
    expect(FAR_WIDTH).toBeLessThan(REMOTE_WIDTH);
    // Every seat, an illusion for each (Y4d) and the bots fit one roster.
    expect(ARENA_ROSTER_MAX).toBeGreaterThanOrEqual(ARENA_MAX_SEATS * 2 + 3);
  });

  it('keeps every field a remote ship is drawn from, rounded to what the eye can see', () => {
    const source = drawn(9);
    const row = packRemote(source);
    expect(row).toHaveLength(REMOTE_WIDTH);
    const out = unpackRemote(row, createPilot(9));
    expect(out.id).toBe(9);
    for (const axis of ['x', 'y', 'z'] as const) expect(Math.abs(out.p[axis] - source.p[axis])).toBeLessThanOrEqual(0.005);
    for (const axis of ['x', 'y', 'z', 'w'] as const) expect(Math.abs(out.q[axis] - source.q[axis])).toBeLessThanOrEqual(5e-5);
    expect(Math.abs(out.s - source.s)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(out.throttle - source.throttle)).toBeLessThanOrEqual(0.005);
    expect(Math.abs(out.omegaYaw - source.omegaYaw)).toBeLessThanOrEqual(5e-4);
    expect(Math.abs(out.omegaPitch - source.omegaPitch)).toBeLessThanOrEqual(5e-4);
    expect(Math.abs(out.hull - source.hull)).toBeLessThanOrEqual(0.05);
    expect(out).toMatchObject({ landed: 3, nx: 0.6, ny: 0.8, nz: 0, turboActive: true, mining: true, gun: 1, shots: 917, phase: 'flying' });
    expect(out.shield).toBeGreaterThan(0);
    // What only its own pilot reads stays out: fuel, ammunition, hold.
    expect(row).not.toContain(source.fuel);
    const plain = unpackRemote(packRemote(createPilot(9)), createPilot(9));
    expect(plain).toMatchObject({ shield: 0, turboActive: false, mining: false });
  });

  it('carries a far ship as place, heading, speed and three flags', () => {
    const source = drawn(11);
    const row = packFar(source);
    expect(row).toHaveLength(FAR_WIDTH);
    const out = unpackFar(row, createPilot(11));
    for (const axis of ['x', 'y', 'z'] as const) expect(Math.abs(out.p[axis] - source.p[axis])).toBeLessThanOrEqual(0.05);
    for (const axis of ['x', 'y', 'z', 'w'] as const) expect(Math.abs(out.q[axis] - source.q[axis])).toBeLessThanOrEqual(5e-4);
    expect(Math.abs(out.s - source.s)).toBeLessThanOrEqual(0.05);
    expect(out).toMatchObject({ id: 11, turboActive: true, mining: true, phase: 'flying' });
    expect(out.landed).toBeGreaterThan(0);
    expect(unpackFar(packFar(createPilot(11)), createPilot(11))).toMatchObject({ landed: 0, turboActive: false, mining: false });
  });

  it('takes at most fifty other ships, each once, in rows of their tier', () => {
    const broken = (patch: Record<string, unknown>): unknown => ({ ...snapshot(), ...patch });
    const near = (n: number, from = 100): number[][] => Array.from({ length: n }, (_, i) => packRemote(createPilot(from + i)));
    const far = (n: number, from = 300): number[][] => Array.from({ length: n }, (_, i) => packFar(createPilot(from + i)));
    expect(decodeArenaSnapshot(broken({ others: near(10), mid: near(20, 200), far: far(20) }))).not.toBeNull();
    expect(decodeArenaSnapshot(broken({ others: near(10), mid: near(20, 200), far: far(21) }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ others: near(51), mid: [], far: [] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ others: [], mid: near(51), far: [] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ others: near(2), far: [packFar(createPilot(100))] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ others: near(2), mid: near(1, 101), far: [] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ mid: [packFar(createPilot(8))] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ others: [...near(1), ...near(1)] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ others: [packPilot(createPilot(5))] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ far: [packRemote(createPilot(6))] }))).toBeNull();
    const withoutFar: Record<string, unknown> = { ...snapshot() };
    delete withoutFar.far;
    expect(decodeArenaSnapshot(withoutFar)).toBeNull();
    const withoutMid: Record<string, unknown> = { ...snapshot() };
    delete withoutMid.mid;
    expect(decodeArenaSnapshot(withoutMid)).toBeNull();
    const field = (row: number[], i: number, value: number): number[] => row.map((n, j) => j === i ? value : n);
    const remote = packRemote(drawn(5)); const distant = packFar(drawn(6));
    expect(decodeArenaSnapshot(broken({ others: [field(remote, REMOTE_WIDTH - 1, 99)] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ others: [field(remote, 0, -1)] }))).toBeNull();
    // Another ship's row does not say its class or level: its hull is bounded by the sturdiest (a level-20 Muhafız).
    expect(decodeArenaSnapshot(broken({ others: [field(remote, 16, shipStats('muhafiz', 20).hull)] }))).not.toBeNull();
    expect(decodeArenaSnapshot(broken({ others: [field(remote, 16, shipStats('muhafiz', 20).hull + 1)] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ mid: [field(remote, 17, 8)] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ far: [field(distant, FAR_WIDTH - 1, 8)] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ far: [field(distant, 0, 1.5)] }))).toBeNull();
  });

  it('round-trips every pilot field, including landing and mining', () => {
    fc.assert(fc.property(fc.array(fc.double({ min: -1000, max: 1000, noNaN: true }), { minLength: 12, maxLength: 12 }), (v) => {
      const pilot = createPilot(7);
      pilot.p.x = v[0] ?? 0; pilot.p.y = v[1] ?? 0; pilot.p.z = v[2] ?? 0;
      pilot.s = Math.abs(v[3] ?? 0); pilot.landed = 5; pilot.nx = 0.6; pilot.ny = 0.8; pilot.nz = 0;
      pilot.landThrottle = 0.2; pilot.liftoff = 4; pilot.bump = 0.5; pilot.kx = 3; pilot.ky = -2; pilot.kz = 0.5; pilot.mining = true; pilot.phase = 'fuelOut';
      pilot.ammo = 123; pilot.shieldMax = 80; pilot.shieldHp = 35;
      pilot.hold = [Math.abs(v[4] ?? 0) / 10, Math.abs(v[5] ?? 0) / 10, Math.abs(v[6] ?? 0) / 10];
      pilot.cargo = pilot.hold.reduce((sum, n) => sum + n, 0);
      const packed = packPilot(pilot);
      expect(packed).toHaveLength(PILOT_WIDTH);
      expect(unpackPilot(packed)).toEqual(pilot);
    }), { numRuns: 40 });
  });

  it('accepts a well-formed snapshot and rejects malformed ones', () => {
    expect(snapshot().cargo.length).toBeGreaterThan(0);
    expect(decodeArenaSnapshot(snapshot())).toEqual(snapshot());
    const broken = (patch: Record<string, unknown>): unknown => ({ ...snapshot(), ...patch });
    expect(decodeArenaSnapshot(broken({ self: [1, 2, 3] }))).toBeNull();
    const badPhase = packPilot(createPilot(4));
    badPhase[badPhase.length - 1] = 99;
    expect(decodeArenaSnapshot(broken({ self: badPhase }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ tick: -1 }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ key: 2 }))).toBeNull();
    // The v4 shape (whole pools, a dry list, no key) is not a v5 snapshot.
    const withoutKey: Record<string, unknown> = { ...snapshot(), dry: ARENA_LAYOUT.deposits.map(() => 0) };
    delete withoutKey.key;
    expect(decodeArenaSnapshot(withoutKey)).toBeNull();
    // A crystal row names a real slot, a reserve within bounds, and a 0/1 dry flag.
    expect(decodeArenaSnapshot(broken({ minerals: [[0, 12.5, 1]] }))?.minerals).toEqual([[0, 12.5, 1]]);
    for (const row of [[ARENA_LAYOUT.deposits.length, 1, 0], [-1, 1, 0], [0.5, 1, 0], [0, Number.NaN, 0], [0, -1, 0], [0, T.crystalReserve + 1, 0], [0, 1, 2], [0, 1]]) {
      expect(decodeArenaSnapshot(broken({ minerals: [row] })), JSON.stringify(row)).toBeNull();
    }
    // A farm piece names its kind; an unknown kind would draw and score as nothing.
    const piece = [0, 1, 2, 3, 5, 2];
    expect(decodeArenaSnapshot(broken({ cargo: [piece] }))?.cargo).toEqual([piece]);
    expect(decodeArenaSnapshot(broken({ cargo: [[0, 1, 2, 3, 5, 3]] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ cargo: [[ARENA_POOLS.cargo, 1, 2, 3, 5, 0]] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ cargo: [[0, 1, 2, 3, 5]] }))).toBeNull();
    // Every row and every "gone" names a slot inside its pool, and no list outgrows its pool.
    const bullet = (slot: number): number[] => [slot, 1, 2, 3, 1200, 0, 0, 0.5, 4];
    expect(decodeArenaSnapshot(broken({ bullets: [bullet(ARENA_POOLS.bullets - 1)] }))).not.toBeNull();
    expect(decodeArenaSnapshot(broken({ bullets: [bullet(ARENA_POOLS.bullets)] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ bullets: [bullet(1.5)] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ bullets: Array.from({ length: ARENA_POOLS.bullets + 1 }, (_, i) => bullet(i % ARENA_POOLS.bullets)) }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ bullets: [[0, 1, 2, 3, 1200, 0, 0, 0.5]] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ bulletsGone: [3, 7] }))?.bulletsGone).toEqual([3, 7]);
    expect(decodeArenaSnapshot(broken({ bulletsGone: [ARENA_POOLS.bullets] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ smokeGone: [ARENA_POOLS.smoke] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ cargoGone: [-1] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ smoke: [[ARENA_POOLS.smoke, 1, 2, 3, 0.5, 4]] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ impacts: [[0, 1, 2, 3, 0.1, 4]] }))).not.toBeNull();
    expect(decodeArenaSnapshot(broken({ impacts: [[0, 1, 2, 3, 0.1, 5]] }))).toBeNull();
    // The ships a radar sweep marks: real ids, each a ship, no more than a room holds.
    expect(decodeArenaSnapshot(broken({ scan: [3, 9] }))?.scan).toEqual([3, 9]);
    for (const scan of [[-1], [1.5], ['3'], Array.from({ length: 51 }, (_, i) => i), 3]) {
      expect(decodeArenaSnapshot(broken({ scan })), JSON.stringify(scan)).toBeNull();
    }
    const noScan: Record<string, unknown> = { ...snapshot() }; delete noScan.scan;
    expect(decodeArenaSnapshot(noScan)).toBeNull();
    expect(decodeArenaSnapshot(broken({ impacts: [[ARENA_POOLS.impacts, 1, 2, 3, 0.1, 0]] }))).toBeNull();
    const negativeHold = packPilot(createPilot(4));
    negativeHold[PILOT_WIDTH - 6] = -1;
    expect(decodeArenaSnapshot(broken({ self: negativeHold }))).toBeNull();
    // Y4c/Y4d: an unknown tactic or warning, a copy that names no ship, or a missile in no slot.
    for (const [at, value] of [[PILOT_WIDTH - 21, 4], [PILOT_WIDTH - 21, 0.5], [PILOT_WIDTH - 17, 5], [PILOT_WIDTH - 23, -2], [PILOT_WIDTH - 23, 0.5]] as const) {
      const row = packPilot(createPilot(4)); row[at] = value;
      expect(decodeArenaSnapshot(broken({ self: row }))).toBeNull();
    }
    for (const at of [PILOT_WIDTH - 5, PILOT_WIDTH - 4, PILOT_WIDTH - 3]) {
      for (const value of [0, 6, 1.5]) {
        const row = packPilot(createPilot(4)); row[at] = value;
        expect(decodeArenaSnapshot(broken({ self: row }))).toBeNull();
      }
    }
    expect(decodeArenaSnapshot(broken({ missiles: [[32, 0, 0, 0, 0, 0, 0, 1, 0, -1]] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ missiles: [[0, 0, 0, 0, 0, 0, 0, 1, 0]] }))).toBeNull();
    // Ammunition and the shield layer are bounded: never more rounds than a magazine, never a shield over its maximum.
    const field = (patch: Partial<Pilot>): number[] => packPilot(Object.assign(createPilot(4), patch));
    expect(decodeArenaSnapshot(broken({ self: field({ ammo: 0, shieldMax: 40, shieldHp: 40 }) }))).not.toBeNull();
    expect(decodeArenaSnapshot(broken({ self: field({ ammo: T.ammoCapacity + 1 }) }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ self: field({ ammo: -1 }) }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ self: field({ shieldMax: 40, shieldHp: 41 }) }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ self: field({ shieldMax: -1, shieldHp: 0 }) }))).toBeNull();
  });
});
