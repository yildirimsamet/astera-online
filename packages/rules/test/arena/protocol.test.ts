import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ARENA_LAYOUT, PILOT_WIDTH, createPilot, decodeArenaSnapshot, packPilot, unpackPilot, type ArenaSnapshot,
} from '../../src/arena/index.js';

function snapshot(): ArenaSnapshot {
  const self = createPilot(4);
  self.landed = 3; self.nx = 0; self.ny = 1; self.nz = 0; self.mining = true; self.cargo = 12.5; self.hold = [2.5, 6, 4];
  return { kind: 'snap', tick: 10, ack: 3, self: packPilot(self), others: [packPilot(createPilot(5))],
    bullets: [], smoke: [], cargo: [], impacts: [], minerals: ARENA_LAYOUT.deposits.map(() => 40),
    dry: ARENA_LAYOUT.deposits.map(() => 0) };
}

describe('arena protocol v3', () => {
  it('round-trips every pilot field, including landing and mining', () => {
    fc.assert(fc.property(fc.array(fc.double({ min: -1000, max: 1000, noNaN: true }), { minLength: 12, maxLength: 12 }), (v) => {
      const pilot = createPilot(7);
      pilot.p.x = v[0] ?? 0; pilot.p.y = v[1] ?? 0; pilot.p.z = v[2] ?? 0;
      pilot.s = Math.abs(v[3] ?? 0); pilot.landed = 5; pilot.nx = 0.6; pilot.ny = 0.8; pilot.nz = 0;
      pilot.landThrottle = 0.2; pilot.liftoff = 4; pilot.bump = 0.5; pilot.kx = 3; pilot.ky = -2; pilot.kz = 0.5; pilot.mining = true; pilot.phase = 'fuelOut';
      pilot.hold = [Math.abs(v[4] ?? 0) / 10, Math.abs(v[5] ?? 0) / 10, Math.abs(v[6] ?? 0) / 10];
      pilot.cargo = pilot.hold.reduce((sum, n) => sum + n, 0);
      const packed = packPilot(pilot);
      expect(packed).toHaveLength(PILOT_WIDTH);
      expect(unpackPilot(packed)).toEqual(pilot);
    }), { numRuns: 40 });
  });

  it('accepts a well-formed snapshot and rejects malformed ones', () => {
    expect(decodeArenaSnapshot(snapshot())).toEqual(snapshot());
    const broken = (patch: Record<string, unknown>): unknown => ({ ...snapshot(), ...patch });
    expect(decodeArenaSnapshot(broken({ self: [1, 2, 3] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ minerals: [1] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ minerals: ARENA_LAYOUT.deposits.map(() => Number.NaN) }))).toBeNull();
    // A dry crystal stays dry until it regrows to half: the flag must travel, not be guessed.
    expect(decodeArenaSnapshot(broken({ dry: [1] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ dry: ARENA_LAYOUT.deposits.map(() => 2) }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ dry: ARENA_LAYOUT.deposits.map((_, i) => i % 2) }))?.dry[1]).toBe(1);
    const badPhase = packPilot(createPilot(4));
    badPhase[badPhase.length - 1] = 99;
    expect(decodeArenaSnapshot(broken({ self: badPhase }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ tick: -1 }))).toBeNull();
    // A farm piece names its kind; an unknown kind would draw and score as nothing.
    const piece = [0, 1, 2, 3, 5, 0, 2];
    expect(decodeArenaSnapshot(broken({ cargo: [piece] }))?.cargo).toEqual([piece]);
    expect(decodeArenaSnapshot(broken({ cargo: [[0, 1, 2, 3, 5, 0, 3]] }))).toBeNull();
    expect(decodeArenaSnapshot(broken({ cargo: [[0, 1, 2, 3, 5, 0]] }))).toBeNull();
    const negativeHold = packPilot(createPilot(4));
    negativeHold[PILOT_WIDTH - 2] = -1;
    expect(decodeArenaSnapshot(broken({ self: negativeHold }))).toBeNull();
  });
});
