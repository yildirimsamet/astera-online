import { ALL_HULLS } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import {
  DEATH_STAR_LIGHT,
  HULL_LIGHT,
  TRACKING_MARK,
  UNKNOWN_CONTACT_MARK,
  formationAimDirection,
} from '../src/galaxy/flightVisual.js';

describe('flight identity colours', () => {
  it('covers every hull, including future ground-to-home transfer safety', () => {
    expect(Object.keys(HULL_LIGHT).sort()).toEqual([...ALL_HULLS].sort());
    for (const hull of ALL_HULLS) {
      expect(HULL_LIGHT[hull].glow).toMatch(/^#[0-9a-f]{6}$/i);
      expect(HULL_LIGHT[hull].flame).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('keeps Runner amber and Breacher and Death Star red', () => {
    expect(HULL_LIGHT.RUNNER.glow).toBe('#ffc247');
    expect(HULL_LIGHT.BREACHER.glow).toBe('#ff4059');
    expect(DEATH_STAR_LIGHT.glow).toBe('#ff274d');
    expect(new Set([
      HULL_LIGHT.WASP.glow,
      HULL_LIGHT.RUNNER.glow,
      HULL_LIGHT.BREACHER.glow,
    ]).size).toBe(3);
  });
});

describe('tracking mark restraint', () => {
  it('keeps ordinary probe and fleet marks tighter and thinner than the old frame', () => {
    expect(TRACKING_MARK.standardRadius).toBeLessThan(1.5);
    expect(TRACKING_MARK.ringOuter).toBeLessThan(1.05);
    expect(TRACKING_MARK.fleetTickWidth).toBeLessThan(0.06);
    expect(TRACKING_MARK.fleetTickLength).toBeLessThan(0.5);
  });

  it('makes an unidentified Radar return louder than ordinary tracking furniture', () => {
    expect(UNKNOWN_CONTACT_MARK.radius).toBeGreaterThan(TRACKING_MARK.standardRadius);
    expect(UNKNOWN_CONTACT_MARK.ringOuter - 1).toBeGreaterThan(
      (TRACKING_MARK.ringOuter - 1) * 3,
    );
    expect(UNKNOWN_CONTACT_MARK.opacity).toBeGreaterThanOrEqual(0.8);
    expect(UNKNOWN_CONTACT_MARK.glyphScale).toBeGreaterThanOrEqual(2.2);
  });

  it('defines Death Star light identity clearly', () => {
    expect(DEATH_STAR_LIGHT.glow).toBe('#ff274d');
    expect(DEATH_STAR_LIGHT.flame).toBe('#ff6b3d');
  });
});

describe('formation convergence', () => {
  it('aims every offset marker at one parent-local target', () => {
    const targetDistance = 7.5;
    for (const slot of [[0, 0, 0], [1.2, 0.4, -0.7], [-0.8, -0.3, -1.4]] as const) {
      const direction = formationAimDirection(slot, targetDistance);
      const remaining = Math.hypot(-slot[0], -slot[1], targetDistance - slot[2]);
      expect(slot[0] + direction[0] * remaining).toBeCloseTo(0, 8);
      expect(slot[1] + direction[1] * remaining).toBeCloseTo(0, 8);
      expect(slot[2] + direction[2] * remaining).toBeCloseTo(targetDistance, 8);
      expect(Math.hypot(...direction)).toBeCloseTo(1, 8);
    }
  });

  it('stays finite for a marker already on the target', () => {
    expect(formationAimDirection([0, 0, 3], 3).every(Number.isFinite)).toBe(true);
  });
});
