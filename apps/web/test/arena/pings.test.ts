import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT, type ArenaLayout, type ArenaObstacle } from '@astera/rules/arena';
import { PING_KINDS, PING_LIFE, createPings, pingSector, pingTarget } from '../../src/arena/pings.js';

// The Heart's centre is an open corridor in v6. A surface test needs an actual collider,
// not a landmark's bounding ball (which would incorrectly close flyable entrances).
const field = (...obstacles: ArenaObstacle[]): ArenaLayout => ({ ...ARENA_LAYOUT, obstacles, meshes: [] });

/**
 * Owner 2026-10-22: hold anywhere → a round wheel of four calls (düşman, farm, git, tehlike);
 * the chosen one marks that spot for 5 s, drawn from wherever each viewer stands.
 */
describe('ping wheel rules', () => {
  it('offers the four calls, enemy on top, then farm, go, danger round the wheel', () => {
    expect(PING_KINDS).toEqual(['enemy', 'farm', 'go', 'danger']);
    expect(pingSector(0, -60, 24)).toBe('enemy');
    expect(pingSector(60, 0, 24)).toBe('farm');
    expect(pingSector(0, 60, 24)).toBe('go');
    expect(pingSector(-60, 0, 24)).toBe('danger');
    expect(pingSector(40, -42, 24)).toBe('enemy');
    expect(pingSector(5, 6, 24)).toBeNull();
  });

  it('marks the first thing under the finger, or a point out along the line when nothing is there', () => {
    const layout = field({ id: 0, kind: 'rock', shape: 'sphere', p: { x: 0, y: 0, z: 0 }, radius: 50 });
    const eye = { x: 0, y: 0, z: 2500 };
    const hit = pingTarget(layout, eye, { x: 0, y: 0, z: -1 });
    const toHit = eye.z - hit.z;
    expect(toHit).toBeCloseTo(2448);
    expect(Math.abs(hit.x - eye.x)).toBeLessThan(1e-6);
    // Nothing on the line: the mark goes far out along it, not a few hundred metres off the nose (owner 2026-10-24).
    const out = { x: 0, y: 0, z: 20000 };
    const miss = pingTarget(ARENA_LAYOUT, out, { x: 0, y: 0, z: 1 });
    expect(miss.z - out.z).toBeCloseTo(4000);
  });

  it('marks a rock or a building kilometres off, where it is (owner 2026-10-24)', () => {
    const layout = field({ id: 0, kind: 'structure', shape: 'box', p: { x: 0, y: 0, z: 0 }, radius: 100,
      hx: 40, hy: 40, hz: 40, ux: 1, uz: 0 });
    const eye = { x: 0, y: 0, z: 3800 };
    const hit = pingTarget(layout, eye, { x: 0, y: 0, z: -1 });
    const toHit = eye.z - hit.z;
    expect(toHit).toBeGreaterThan(3000); expect(toHit).toBeLessThan(3800);
    expect(hit.z).toBeCloseTo(42);
  });

  it('keeps each mark 5 s, at most three at once, newest first', () => {
    const pings = createPings();
    const p = { x: 0, y: 0, z: 0 };
    pings.add('enemy', p, 0); pings.add('farm', p, 1); pings.add('go', p, 2); pings.add('danger', p, 3);
    expect(pings.live(3).map(m => m.kind)).toEqual(['danger', 'go', 'farm']);
    expect(pings.live(1 + PING_LIFE + 0.01).map(m => m.kind)).toEqual(['danger', 'go']);
    expect(pings.live(10)).toEqual([]);
  });
});
