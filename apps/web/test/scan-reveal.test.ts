import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { galaxySchema } from '../src/api/schemas.js';
import { CLANMATE_COLOUR, PIN_COLOUR } from '../src/galaxy/PlanetField.js';
import {
  freshlyKnown, knownIds, nearestFirst, planScan, readSeen, rememberSeen, SCAN_ARRIVES, SCAN_ENDS, SCAN_LOCKS, SCAN_SEEN_KEY,
  scanFrame, scanLength, waveFrame, type ScanEye,
} from '../src/galaxy/scanReveal.js';
import { planetNodes, toWorld, type PlanetNode, type Vec3Tuple } from '../src/galaxy/scene.js';

/*
  THE TELESCOPE FINDS OUT WHO HOLDS A HIDDEN WORLD (owner approved the lab scan, 2026-11-12, and its
  trigger: "once per world, the first time it is known"). A world coming into a Telescope's reach is
  reached by a wave from that world's eyes and the worlds light one by one by distance; a world a
  probe reaches is swept where the probe stands. What became known while the player was away plays
  on the next open. The client compares the galaxy with the worlds it has already shown; nothing on
  the server changes.
*/

const planet = (over: Record<string, unknown>) => galaxySchema.shape.planets.element.parse({
  intel: 'RESOLVED', isSelf: false, isOwned: false, state: { kind: 'NORMAL' }, kind: 'CAPITAL', ...over,
});
const at = (x: number, z: number) => ({ x, y: 0, z });
const nodes = (...over: Record<string, unknown>[]): PlanetNode[] => planetNodes(over.map(planet));
const home = { id: 'home', isSelf: true, isOwned: true, position: at(0, 0) };
const gap = (p: Vec3Tuple, q: Vec3Tuple) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const eye = (x: number, z: number, reach: number): ScanEye => ({ at: toWorld(at(x, z)), reach });

describe('the scan, second by second', () => {
  it('the wave reaches the world before its sweep starts', () => {
    expect(scanFrame(SCAN_ARRIVES - 0.05).band).toBe(0);
    expect(scanFrame(SCAN_ARRIVES + 0.05).band).toBeGreaterThan(0);
  });

  it('a band sweeps the world once, top to bottom, leaving a grid behind', () => {
    let last = Infinity;
    for (let t = SCAN_ARRIVES + 0.05; t < SCAN_LOCKS; t += 0.1) {
      const frame = scanFrame(t);
      expect(frame.band).toBeGreaterThan(0);
      expect(frame.sweep).toBeLessThan(last);
      last = frame.sweep;
    }
    expect(scanFrame(SCAN_ARRIVES + 0.4).grid).toBeGreaterThan(0.9);
    expect(scanFrame(SCAN_LOCKS + 0.3).band).toBe(0);
  });

  it('the reticle closes in and snaps on the lock', () => {
    expect(scanFrame(SCAN_ARRIVES + 0.2).reticleSize).toBeGreaterThan(scanFrame(SCAN_LOCKS).reticleSize);
    expect(scanFrame(SCAN_LOCKS + 0.05).reticle).toBeGreaterThan(0.9);
    expect(scanFrame(SCAN_LOCKS + 0.02).flash).toBeGreaterThan(0.8);
  });

  it('the holder shows only once the sweep has passed, then gives the world back to its own look', () => {
    expect(scanFrame(SCAN_LOCKS - 0.1).reveal).toBe(0);
    expect(scanFrame(SCAN_LOCKS + 0.5).reveal).toBeGreaterThan(0.9);
    const end = scanFrame(SCAN_ENDS);
    expect(end.reveal + end.reticle + end.grid + end.band + end.flash).toBe(0);
  });

  it('bad clocks show nothing, never NaN', () => {
    for (const t of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const frame = scanFrame(t);
      expect(Object.values(frame).every(Number.isFinite)).toBe(true);
      expect(frame.band + frame.reveal + frame.reticle + frame.grid + frame.flash).toBe(0);
    }
  });

  it('the wave runs past its farthest world and fades out', () => {
    expect(waveFrame(0).alpha).toBe(0);
    expect(waveFrame(1).radius).toBeCloseTo(1, 9);
    expect(waveFrame(1).alpha).toBeGreaterThan(0.9);
    expect(waveFrame(1.5).alpha).toBe(0);
    for (const p of [Number.NaN, -1, Number.POSITIVE_INFINITY]) expect(waveFrame(p)).toEqual({ radius: 0, alpha: 0 });
  });
});

describe('which worlds are newly known', () => {
  const galaxy = nodes(
    home,
    { id: 'colony', isOwned: true, kind: 'COLONY', position: at(50, 0) },
    { id: 'rival', position: at(100, 0) },
    { id: 'probed', intel: 'REMEMBERED', position: at(400, 0) },
    { id: 'dark', intel: 'UNKNOWN', position: at(600, 0) },
    { id: 'ship', body: 'VESSEL', position: at(700, 0) },
    { id: 'outpost', body: 'OUTPOST', outpost: true, position: at(800, 0) },
  );

  it('the first look shows nothing: a new device or a first open never replays the whole map', () => {
    expect(freshlyKnown(galaxy, null)).toEqual([]);
  });

  it('a known world not shown before is new; a dark world, an own world, a ship or an outpost never is', () => {
    expect(freshlyKnown(galaxy, new Set()).map((node) => node.id)).toEqual(['rival', 'probed']);
  });

  it('a world already shown is not shown again, even when a probe record becomes a live reading', () => {
    const later = galaxy.map((node) => (node.id === 'probed' ? { ...node, intel: 'RESOLVED' as const } : node));
    expect(freshlyKnown(later, new Set(['rival', 'probed']))).toEqual([]);
  });

  it('a flood of news shows the worlds nearest the player’s own first', () => {
    const crowd = nodes(
      home,
      { id: 'colony', isOwned: true, kind: 'COLONY', position: at(1000, 0) },
      { id: 'far', position: at(500, 0) },
      { id: 'by-colony', position: at(1010, 0) },
      { id: 'near', position: at(20, 0) },
    );
    expect(nearestFirst(freshlyKnown(crowd, new Set()), crowd, 2).map((node) => node.id)).toEqual(['by-colony', 'near']);
    expect(nearestFirst([], crowd, 2)).toEqual([]);
  });

  it('the remembered set keeps every world ever known, even one that has gone dark again', () => {
    const ids = knownIds(galaxy, new Set(['gone-dark']));
    expect([...ids].sort()).toEqual(['colony', 'gone-dark', 'home', 'outpost', 'probed', 'rival', 'ship']);
  });
});

describe('where each scan comes from', () => {
  const galaxy = nodes(
    home,
    { id: 'colony', isOwned: true, kind: 'COLONY', position: at(2000, 0) },
    { id: 'near', position: at(100, 0) },
    { id: 'mid', position: at(250, 0) },
    { id: 'far', position: at(400, 0) },
    { id: 'by-colony', kind: 'NEUTRAL', position: at(2100, 0) },
    { id: 'probed-a', intel: 'REMEMBERED', position: at(700, 0) },
    { id: 'probed-b', intel: 'REMEMBERED', position: at(900, 0) },
  );
  const eyes = [eye(0, 0, 10), eye(2000, 0, 4)];
  const byId = (id: string) => galaxy.find((node) => node.id === id)!;
  const plan = planScan(freshlyKnown(galaxy, new Set()), galaxy, eyes);
  const target = (id: string) => plan.targets.find((item) => item.id === id)!;

  it('a world in a Telescope’s reach is reached by a wave from those eyes, and lights by distance', () => {
    expect(plan.waves).toHaveLength(2);
    const capital = plan.waves.find((wave) => gap(wave.at, byId('home').position) < 1e-9)!;
    expect(capital.reach).toBeCloseTo(gap(byId('far').position, capital.at), 9);
    expect(target('near').start).toBeLessThan(target('mid').start);
    expect(target('mid').start).toBeLessThan(target('far').start);
    expect(target('far').start).toBeCloseTo(capital.travel, 9);
    // The wave and the sweep agree: a world starts when the ring drawn at the wave's speed reaches it.
    expect(target('mid').start).toBeCloseTo(capital.travel * gap(byId('mid').position, capital.at) / capital.reach, 9);
    const colony = plan.waves.find((wave) => gap(wave.at, byId('colony').position) < 1e-9)!;
    expect(target('by-colony').start).toBeCloseTo(colony.travel, 9);
  });

  it('one world alone keeps the lab’s pace; many take longer, never past twice that', () => {
    const single = planScan(freshlyKnown(nodes(home, { id: 'one', position: at(100, 0) }), new Set()), nodes(home), [eye(0, 0, 10)]);
    expect(single.waves[0]!.travel).toBeCloseTo(SCAN_ARRIVES, 9);
    for (const wave of plan.waves) {
      expect(wave.travel).toBeGreaterThanOrEqual(SCAN_ARRIVES);
      expect(wave.travel).toBeLessThanOrEqual(2 * SCAN_ARRIVES);
    }
  });

  it('a world a probe reached is swept where it stands, one after another, with no wave', () => {
    expect(plan.targets.filter((item) => item.id.startsWith('probed'))).toHaveLength(2);
    expect(target('probed-a').start).toBeGreaterThan(0);
    expect(target('probed-b').start).toBeGreaterThan(target('probed-a').start);
    expect(plan.waves.every((wave) => wave.reach < gap(byId('probed-a').position, byId('home').position))).toBe(true);
  });

  it('a world outside every reach the client knows of is reached from the nearest own world', () => {
    const lone = nodes(home, { id: 'colony', isOwned: true, kind: 'COLONY', position: at(2000, 0) }, { id: 'odd', position: at(1800, 0) });
    const solo = planScan(freshlyKnown(lone, new Set()), lone, []);
    expect(solo.waves).toHaveLength(1);
    expect(gap(solo.waves[0]!.at, lone[1]!.position)).toBeLessThan(1e-9);
  });

  it('with no own world on the map either, the world is simply swept in place', () => {
    const bare = nodes({ id: 'odd', position: at(1800, 0) });
    const solo = planScan(freshlyKnown(bare, new Set()), bare, []);
    expect(solo.waves).toEqual([]);
    expect(solo.targets[0]!.start).toBeGreaterThan(0);
  });

  it('the world lights in the colour its map pin wears', () => {
    const coloured = nodes(home, { id: 'mate', clanmate: true, position: at(10, 0) }, { id: 'farm', kind: 'NEUTRAL', position: at(20, 0) },
      { id: 'enemy', kind: 'COLONY', position: at(30, 0) });
    const tones = Object.fromEntries(planScan(freshlyKnown(coloured, new Set()), coloured, []).targets.map((item) => [item.id, item.tone]));
    expect(tones).toEqual({ mate: CLANMATE_COLOUR, farm: PIN_COLOUR.neutral, enemy: PIN_COLOUR.rival });
  });

  it('the scan sits on the world as drawn, and the whole moment has an end', () => {
    expect(target('far').radius).toBe(byId('far').radius);
    expect(target('far').at).toEqual(byId('far').position);
    const last = Math.max(...plan.targets.map((item) => item.start));
    expect(scanLength(plan)).toBeCloseTo(last + SCAN_ENDS - SCAN_ARRIVES, 9);
    expect(scanLength({ waves: [], targets: [] })).toBe(0);
  });
});

describe('the worlds already shown, across a reload', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('nothing remembered, or another commander’s worlds, is a first look', () => {
    expect(readSeen('me')).toBeNull();
    rememberSeen('someone-else', ['a']);
    expect(readSeen('me')).toBeNull();
  });

  it('keeps the set for this commander', () => {
    rememberSeen('me', ['a', 'b']);
    expect([...readSeen('me')!].sort()).toEqual(['a', 'b']);
  });

  it('a damaged record is a first look, never an error', () => {
    localStorage.setItem(SCAN_SEEN_KEY, '{not json');
    expect(readSeen('me')).toBeNull();
    localStorage.setItem(SCAN_SEEN_KEY, JSON.stringify({ self: 'me', ids: [1, 2] }));
    expect(readSeen('me')).toBeNull();
  });

  it('blocked storage is a first look every time, and writing to it does not throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readSeen('me')).toBeNull();
    expect(() => { rememberSeen('me', ['a']); }).not.toThrow();
  });
});

describe('the scan is in the galaxy, drawn without a real light', () => {
  it('the galaxy mounts it with the worlds, the commander and the eyes', () => {
    const canvas = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');
    expect(canvas).toMatch(/<ScanReveals\b[^>]*nodes=\{nodes\}[^>]*selfId=\{selfId\}[^>]*sensors=\{sensors\}/);
  });

  it('a few batched draws, rehearsed before its moment, never a light', () => {
    const scan = readFileSync('src/galaxy/ScanReveals.tsx', 'utf8');
    expect(scan).not.toMatch(/<(point|directional|spot|ambient)Light\b/);
    expect(scan).toContain('createRehearsal');
    expect(scan).toMatch(/new THREE\.InstancedMesh\(/);
  });

  it('keeps the nearest news when there is too much to show, and sounds every wave', () => {
    const scan = readFileSync('src/galaxy/ScanReveals.tsx', 'utf8');
    expect(scan).toMatch(/nearestFirst\(freshlyKnown\(nodes, seen\), nodes, MAX_TARGETS\)/);
    // A sound key holds for a minute: a second scan within one would be silent.
    expect(scan).not.toMatch(/key: 'scan:wave'/);
  });
});
