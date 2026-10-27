import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT as L, ARENA_TUNING as T, createSandboxWorld, nextEntry, spawnFlight, createFlightState, type Vec3 } from '../../src/arena/index.js';

/**
 * Owner 2026-10-23 (V6g, 48-bot study): 59–71 % of first contacts came within 1.5 km of the
 * entrance a pilot had just come through, a third of them with someone who spawned there
 * seconds before. Entrances are dealt round robin, so two arrivals in a row never share one.
 * (Teams, when the arena has them, arrive together through one entrance.)
 */
const nearest = (p: Vec3): number => {
  let best = -1; let distance = Infinity;
  L.entries.forEach((entry, i) => {
    const d = Math.hypot(p.x - entry.x, p.y - entry.y, p.z - entry.z);
    if (d < distance) { distance = d; best = i; }
  });
  return best;
};

describe('entrances, dealt in turn', () => {
  it('hands out every entrance once before any comes round again', () => {
    const world = createSandboxWorld({ bots: 0 });
    const start = nextEntry(world);
    const dealt = [start, ...Array.from({ length: L.entries.length }, () => nextEntry(world))];
    expect(new Set(dealt.slice(0, L.entries.length)).size).toBe(L.entries.length);
    expect(dealt[L.entries.length]).toBe(start);
  });

  it('puts a spawn on the entrance it is given, within the jitter', () => {
    const flight = createFlightState();
    expect(spawnFlight(flight, () => 0.5, L, 7)).toBe(7);
    const entry = L.entries[7];
    if (!entry) throw new Error('no entrance 7');
    expect(Math.hypot(flight.p.x - entry.x, flight.p.y - entry.y, flight.p.z - entry.z)).toBeLessThanOrEqual(T.spawnJitter + 1e-6);
  });

  it('spreads the pilot and the bots of a fresh room over different entrances', () => {
    const world = createSandboxWorld({ bots: 3 });
    const used = [world.pilot, ...world.drones].map(p => nearest(p.p));
    expect(new Set(used).size).toBe(4);
  });
});
