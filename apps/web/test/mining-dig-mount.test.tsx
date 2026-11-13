import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MiningRun } from '../src/api/schemas.js';
import { MINING_CRAFT_LENGTH, miningReach } from '../src/galaxy/MiningFlights.js';
import { VOID_RADIUS, wreckRadius, type WreckView } from '../src/galaxy/Wrecks.js';
import { asteroidRadius, type PlanetNode } from '../src/galaxy/scene.js';

const source = (file: string) => readFileSync(`src/galaxy/${file}`, 'utf8');
const run = (over: Partial<MiningRun> = {}): MiningRun => ({
  id: 'r1', planetId: 'p-home', targetKind: 'asteroid', asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw', debrisFieldId: null,
  craft: 2, status: 'outbound', departAt: new Date(0), arriveAt: new Date(60_000), recalledAt: null, homeAt: null,
  intercept: { x: 0, y: 0, z: 600 }, minedAlloy: 0, minedCrystal: 0, minedDeuterium: 0, ...over,
});
const rocks = [{ id: 'mJt7YvxMZEC5S7yYQ32SYw', level: 3 }];
const voidField: WreckView = { id: 'w-void', planetId: null, at: { x: 0, y: 0, z: 600 }, alloy: 10, crystal: 0, minutesLeft: 9 };
const ringField: WreckView = { id: 'w-ring', planetId: 'p-ring', at: { x: 0, y: 0, z: 600 }, alloy: 10, crystal: 0, minutesLeft: 9 };
const ringWorld = { id: 'p-ring', radius: 0.9 } as const satisfies Pick<PlanetNode, 'id' | 'radius'>;

/** The drill stops on its target's near face (owner approved the dig, 2026-11-12). */
describe('how far from its target a drill stops', () => {
  it('a rock: its drawn radius plus half the drill, at the galaxy’s model scale', () => {
    for (const scale of [1, 1.6]) {
      expect(miningReach(run(), rocks, [], [], scale)).toBeCloseTo(asteroidRadius(3, scale) + MINING_CRAFT_LENGTH * scale / 2, 9);
    }
  });

  it('a wreck field: its drawn rubble, a heap in open space or a ring about its world', () => {
    const debris = (id: string) => run({ targetKind: 'debris', asteroidId: null, debrisFieldId: id });
    expect(miningReach(debris('w-void'), rocks, [voidField], [], 1)).toBeCloseTo(wreckRadius(null) + MINING_CRAFT_LENGTH / 2, 9);
    expect(miningReach(debris('w-ring'), rocks, [ringField], [ringWorld], 1)).toBeCloseTo(wreckRadius(0.9) + MINING_CRAFT_LENGTH / 2, 9);
    expect(wreckRadius(0.9)).toBeGreaterThan(0.9);
  });

  it('a field whose world is not drawn: the ring the map draws about its stand-in world', () => {
    const debris = run({ id: 'r-ring-hidden', targetKind: 'debris', asteroidId: null, debrisFieldId: 'w-ring' });
    expect(miningReach(debris, rocks, [ringField], [], 1)).toBeCloseTo(wreckRadius(VOID_RADIUS) + MINING_CRAFT_LENGTH / 2, 9);
  });

  it('a target this client cannot see: no stand-off, the old path', () => {
    expect(miningReach(run({ asteroidId: 'zzzzzzzzzzzzzzzzzzzzzz' }), rocks, [], [], 1)).toBe(0);
    expect(miningReach(run({ targetKind: 'debris', asteroidId: null, debrisFieldId: 'gone' }), rocks, [voidField], [], 1)).toBe(0);
  });
});

describe('the dig is mounted on the craft that flies, and the camera follows the same path', () => {
  it('each run flies with its stand-off and carries its dig', () => {
    const mining = source('MiningFlights.tsx');
    expect(mining).toContain('runPosition(run, home, now, nodes, reach, rockAt)');
    expect(mining).toContain('reach={heldReach(run.id, miningReach(run, asteroids, wrecks, nodes, scale))}');
    expect(mining).toMatch(/<MiningDig\b/);
    // No dig where this client cannot see the target: it would spark in empty space, or inside a world.
    expect(mining).toMatch(/reach > 0 && \(\s*<SkinAssetBoundary[\s\S]{0,120}<MiningDig\b/);
  });

  it('a focused run is followed along the identical stand-off', () => {
    const canvas = source('GalaxyCanvas.tsx');
    expect(canvas).toMatch(/runPosition\(run, origin, serverNow\(\), nodes, heldReach\(run\.id, miningReach\(run, asteroids, wrecks, nodes, scale\)\), miningRockAt\(run, asteroids, seasonStart\)\)/);
    expect(canvas).toMatch(/<MiningFlights[\s\S]{0,260}seasonStart=\{seasonStart\}/);
    expect(canvas).toMatch(/<MiningFlights[\s\S]{0,200}asteroids=\{asteroids\}[\s\S]{0,80}wrecks=\{wrecks\}/);
  });

  it('lets go of the drill when the dig is torn down mid-bite (a late recall)', () => {
    expect(source('MiningDig.tsx')).toMatch(/useEffect\(\(\) => \{\s*const drill = motion\.current;\s*return \(\) => \{ drill\.roll = 0; drill\.shake = 0; \};/);
  });

  it('works without a real light: the cut’s glow is drawn, never lit', () => {
    const dig = source('MiningDig.tsx');
    expect(dig).not.toMatch(/<(point|directional|spot)Light\b/);
    expect(dig).toContain('createRehearsal');
  });
});
