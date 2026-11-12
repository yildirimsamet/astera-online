import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEATH_STAR } from '@astera/rules';
import { NUKE_SECONDS, nukeLayers, nukeStrikeAxis } from '../src/galaxy/nukeLayers.js';
import type { Vec3Tuple } from '../src/galaxy/scene.js';

/**
 * THE DEATH STAR HIT AS A NUCLEAR STRIKE, SEEN FROM ORBIT (owner, 2026-11-12: "atom bombası,
 * hidrojen bombası gibi bir patlama"). One clock drives every layer: the flash, the fireball, the
 * shock front racing over the world, the condensation disc, the column, the cap and the crater
 * that is still burning when the EMP hour takes over.
 */
describe('the nuclear strike timeline', () => {
  const live = (seconds: number) => {
    const layer = nukeLayers(seconds);
    return [layer.flash, layer.fireball, layer.ring, layer.disc, layer.column, layer.cap, layer.ember, layer.ash, layer.light];
  };

  it('draws nothing before the strike or after its eight seconds', () => {
    expect(NUKE_SECONDS).toBe(DEATH_STAR.impactSeconds);
    expect(live(-0.01).every((value) => value === 0)).toBe(true);
    expect(live(NUKE_SECONDS).every((value) => value === 0)).toBe(true);
  });

  it('opens on a blinding flash that is gone within a second', () => {
    expect(nukeLayers(0).flash).toBe(1);
    expect(nukeLayers(0.9).flash).toBe(0);
  });

  it('runs the shock front across the face of the world and never back', () => {
    const fronts = Array.from({ length: 80 }, (_, i) => nukeLayers(i / 10).ringAngle);
    for (let i = 1; i < fronts.length; i++) expect(fronts[i]!).toBeGreaterThanOrEqual(fronts[i - 1]!);
    expect(nukeLayers(0).ringAngle).toBe(0);
    expect(nukeLayers(3).ringAngle).toBeGreaterThan(1.2);
    expect(nukeLayers(3).ringAngle).toBeLessThan(Math.PI / 2);
  });

  it('raises the column before the cap spreads', () => {
    expect(nukeLayers(0.4).cap).toBe(0);
    expect(nukeLayers(0.4).column).toBeGreaterThan(0);
    expect(nukeLayers(2).columnHeight).toBeGreaterThan(nukeLayers(1).columnHeight);
    expect(nukeLayers(3).cap).toBeGreaterThan(0.8);
  });

  it('leaves a crater still burning at the end, cooling as it goes', () => {
    expect(nukeLayers(7.9).ember).toBeGreaterThan(0.3);
    expect(nukeLayers(1).heat).toBeGreaterThan(nukeLayers(7).heat);
  });

  it('draws nothing from a clock it cannot read', () => {
    expect(live(Number.NaN).every((value) => value === 0)).toBe(true);
    expect(nukeLayers(Number.POSITIVE_INFINITY).ringAngle).toBe(0);
  });
});

/**
 * WHERE ON THE WORLD IT LANDS. No viewer is told where the weapon came from (a defender never is:
 * that is what Radar L5 sells), so the strike lands where this viewer sees it best: on the face
 * toward them, far enough round that the column stands in profile, rising up the screen and leaning
 * to one side so it never climbs into the world's name above it.
 */
describe('the strike point', () => {
  const dot = (a: Vec3Tuple, b: Vec3Tuple) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const length = (a: Vec3Tuple) => Math.sqrt(dot(a, a));
  const toCamera: Vec3Tuple = [0, 0, 5];
  const up: Vec3Tuple = [0, 1, 0];
  const right: Vec3Tuple = [1, 0, 0];

  it('is a point on the surface, on the face the viewer sees, with the column in profile', () => {
    for (const id of ['a', 'strike-17', 'contact:9f2c']) {
      const axis = nukeStrikeAxis(toCamera, up, id);
      expect(length(axis)).toBeCloseTo(1, 6);
      expect(dot(axis, [0, 0, 1])).toBeCloseTo(0.5, 6);
    }
  });

  it('rises up the screen, leaning to one side, never straight into the name above', () => {
    for (let i = 0; i < 40; i++) {
      const axis = nukeStrikeAxis(toCamera, up, `strike-${String(i)}`);
      expect(dot(axis, up)).toBeGreaterThan(0.25);
      expect(Math.abs(dot(axis, right))).toBeGreaterThan(0.25);
    }
  });

  it('is the same for the same strike and lands left and right across strikes', () => {
    expect(nukeStrikeAxis(toCamera, up, 'x')).toEqual(nukeStrikeAxis(toCamera, up, 'x'));
    const sides = new Set(Array.from({ length: 20 }, (_, i) => Math.sign(dot(nukeStrikeAxis(toCamera, up, `s${String(i)}`), right))));
    expect(sides).toEqual(new Set([-1, 1]));
  });

  it('follows the camera wherever it looks from', () => {
    const fromAbove = nukeStrikeAxis([0, 7, 0.001], [0, 0, -1], 'a');
    expect(dot(fromAbove, [0, 1, 0])).toBeCloseTo(0.5, 3);
    expect(dot(fromAbove, [0, 0, -1])).toBeGreaterThan(0.25);
  });

  it('still lands on the surface when the view is degenerate', () => {
    const views: [Vec3Tuple, Vec3Tuple][] = [[[0, 0, 0], up], [[0, 3, 0], [0, 1, 0]], [[Number.NaN, 0, 1], up]];
    for (const [camera, screenUp] of views) {
      const axis = nukeStrikeAxis(camera, screenUp, 'odd');
      expect(axis.every(Number.isFinite)).toBe(true);
      expect(length(axis)).toBeCloseTo(1, 6);
    }
  });
});

/**
 * NO REAL-TIME LIGHT AT THE MOMENT OF IMPACT (S22, 2026-11-13). A light that appears changes the
 * light count every lit material in the galaxy was compiled for, so each one compiles again on that
 * frame: the first strike of a session froze 101 ms on the S22 with one world in view, and a full
 * galaxy has many more. The strike lights the world from its own surface shell instead (owner: cheap
 * shader tricks over real-time lights).
 */
describe('the nuclear strike lights the world without a light', () => {
  it('brings no light into the scene', () => {
    expect(readFileSync('src/galaxy/NukeBlast.tsx', 'utf8')).not.toMatch(/pointLight|PointLight|spotLight|SpotLight|directionalLight|DirectionalLight/);
  });
});

/** It is mounted for the whole flight, to rehearse unseen (S22, 2026-11-13). */
describe('the nuclear strike in flight', () => {
  it('asks for the full frame rate only while it is on screen', () => {
    const source = readFileSync('src/galaxy/NukeBlast.tsx', 'utf8');
    expect(source).toContain('<HoldRate fps={FULL_RATE_FPS} active={live} />');
    expect(source).not.toContain('<FullRate />');
  });
});
