import { readFileSync } from 'node:fs';
import type { VesselSystem } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { damageSpots, type VesselLights } from '../src/galaxy/mainSky.js';
import { BURN_FADE_SECONDS, burnOut, burnTargets, easeBurn, loopLayers, puffState, SMOKE_PUFFS, type BurnLook } from '../src/galaxy/vesselBurn.js';

/*
  THE WRECKED SHIP BURNS LIKE THE LAB'S (owner approved the smoke and flames, 2026-11-12): a smoke
  column off every burning bay, a flame that loops without a seam, a glow on the hull and now and
  then a burst of sparks. Each system still burns by its own repairs (plan F8), and a mended one goes
  out over a moment instead of vanishing.
*/

const all = (share: number): VesselLights => ({ REFINERY: share, SURVEY: share, DEFENCE: share, CARGO: share, DRIVE: share });
const look = (lights: VesselLights, system: VesselSystem): BurnLook => burnTargets(damageSpots(lights))[system];
const zero: BurnLook = { smoke: 0, flame: 0, glow: 0, sparks: 0 };

describe('how each bay burns', () => {
  it('a wrecked engine, works or shield burns with smoke and flame; the worse, the bigger', () => {
    const drive = look(all(0), 'DRIVE');
    expect(drive.flame).toBe(1);
    expect(drive.smoke).toBe(1);
    expect(drive.glow).toBeGreaterThan(0);
    expect(look(all(0), 'DEFENCE').flame).toBeLessThan(drive.flame);
  });

  it('wrecked wiring throws sparks over a thin wisp, with no flame', () => {
    const cargo = look(all(0), 'CARGO');
    expect(cargo.sparks).toBe(1);
    expect(cargo.flame).toBe(0);
    expect(cargo.smoke).toBeGreaterThan(0);
    expect(cargo.smoke).toBeLessThan(0.5);
  });

  it('a machine under repair smoulders: no flame, less smoke, dimmer as it mends', () => {
    const quarter = look({ ...all(0), DRIVE: 0.25 }, 'DRIVE');
    const most = look({ ...all(0), DRIVE: 0.75 }, 'DRIVE');
    expect(quarter.flame).toBe(0);
    expect(quarter.smoke).toBeGreaterThan(0);
    expect(quarter.smoke).toBeLessThan(look(all(0), 'DRIVE').smoke);
    expect(most.glow).toBeLessThan(quarter.glow);
  });

  it('a mended system is out, and a mended ship does not burn at all', () => {
    expect(look({ ...all(0), DEFENCE: 1 }, 'DEFENCE')).toEqual(zero);
    for (const system of ['REFINERY', 'SURVEY', 'DEFENCE', 'CARGO', 'DRIVE'] as const) expect(look(all(1), system)).toEqual(zero);
  });
});

describe('a bay that is out costs nothing', () => {
  it('is out only when nothing of it shows', () => {
    expect(burnOut(zero)).toBe(true);
    expect(burnOut({ ...zero, smoke: 0.01 })).toBe(false);
    expect(burnOut({ ...zero, sparks: 1 })).toBe(false);
  });

  it('draws none of its puffs or flames while the others burn', () => {
    const burn = readFileSync('src/galaxy/VesselBurn.tsx', 'utf8');
    expect(burn).toMatch(/if \(burnOut\(look\)\) \{[\s\S]{0,400}setMatrixAt\([^)]*none\)/);
  });
});

describe('a mended system goes out over a moment', () => {
  it('fades, never jumps, and is out within a few seconds', () => {
    const burning: BurnLook = { smoke: 1, flame: 1, glow: 1, sparks: 0.5 };
    const now = { ...burning };
    easeBurn(now, zero, 0.05);
    expect(now.flame).toBeGreaterThan(0.9);
    let before = now.flame;
    for (let i = 0; i < 60; i++) {
      easeBurn(now, zero, 0.05);
      expect(now.flame).toBeLessThanOrEqual(before);
      expect(now.flame).toBeGreaterThanOrEqual(0);
      before = now.flame;
    }
    expect(now).toEqual(zero);
    expect(BURN_FADE_SECONDS).toBeGreaterThan(0.3);
  });

  it('a bad frame time leaves it as it was', () => {
    for (const dt of [Number.NaN, -1, Number.NEGATIVE_INFINITY]) {
      const now: BurnLook = { smoke: 0.4, flame: 0.4, glow: 0.4, sparks: 0.4 };
      easeBurn(now, zero, dt);
      expect(now).toEqual({ smoke: 0.4, flame: 0.4, glow: 0.4, sparks: 0.4 });
    }
  });
});

describe('a flame that loops without a seam', () => {
  it('two layers always add up to one full flame', () => {
    for (let t = 0; t < 5; t += 0.037) {
      const [a, b] = loopLayers(t, 24, 36, 0.3);
      expect(a.weight + b.weight).toBeCloseTo(1, 6);
      for (const layer of [a, b]) { expect(layer.frame).toBeGreaterThanOrEqual(0); expect(layer.frame).toBeLessThan(36); }
    }
  });

  it('a layer jumps from the last frame back to the first only while it is invisible', () => {
    const step = 1 / 240;
    for (let t = 0; t < 4; t += step) {
      const now = loopLayers(t, 24, 36, 0), next = loopLayers(t + step, 24, 36, 0);
      for (const i of [0, 1] as const) {
        if (next[i].frame < now[i].frame) expect(Math.max(now[i].weight, next[i].weight)).toBeLessThan(0.02);
      }
    }
  });
});

describe('a smoke column that never breaks', () => {
  const puffs = Array.from({ length: SMOKE_PUFFS }, (_, k) => k);

  it('puffs of one bay are reborn one at a time, never together', () => {
    let last = puffs.map((k) => puffState(0, k, 0).cycle);
    for (let t = 0.01; t < 20; t += 0.01) {
      const now = puffs.map((k) => puffState(0, k, t).cycle);
      expect(now.filter((cycle, k) => cycle !== last[k]).length).toBeLessThanOrEqual(1);
      last = now;
    }
  });

  it('always has smoke showing, spread along the column without holes', () => {
    for (let t = 0; t < 30; t += 0.1) {
      for (const bay of [0, 1, 2, 3, 4]) {
        expect(puffs.reduce((sum, k) => sum + puffState(bay, k, t).alpha, 0)).toBeGreaterThan(2);
        const ages = puffs.map((k) => puffState(bay, k, t).age).sort((x, y) => x - y);
        const gaps = ages.map((age, i) => (i === 0 ? age + 1 - ages[ages.length - 1]! : age - ages[i - 1]!));
        expect(Math.max(...gaps)).toBeLessThan(0.25);
      }
    }
  });

  it('a bad clock gives a quiet puff, never NaN', () => {
    for (const t of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const p = puffState(0, 0, t);
      expect(Object.values(p).every(Number.isFinite)).toBe(true);
      expect(p.alpha).toBe(0);
    }
  });
});

describe('the ship burns through one batched effect, with no real light', () => {
  it('the body draws its damage through the burn, not a sprite per flame', () => {
    const body = readFileSync('src/galaxy/VesselBody.tsx', 'utf8');
    expect(body).toMatch(/<VesselBurn\b/);
    expect(body).not.toMatch(/function (Blaze|Sparks)\b/);
    const burn = readFileSync('src/galaxy/VesselBurn.tsx', 'utf8');
    expect(burn).not.toMatch(/<(point|directional|spot|ambient)Light\b/);
  });

  it('a ship that has never been hit loads no fire art; once hit, it keeps the burn to let it go out', () => {
    const body = readFileSync('src/galaxy/VesselBody.tsx', 'utf8');
    expect(body).toMatch(/useState\(damage\.length > 0\)/);
    expect(body).toMatch(/\{lit && \(\s*<SkinAssetBoundary/);
  });

  it('a new hull frees only its own sparks, never the smoke and flames still in use', () => {
    const burn = readFileSync('src/galaxy/VesselBurn.tsx', 'utf8');
    expect(burn).toMatch(/useEffect\(\(\) => \(\) => \{ sparks\.geometry\.dispose\(\); sparks\.material\.dispose\(\); \}, \[sparks\]\)/);
  });
});
