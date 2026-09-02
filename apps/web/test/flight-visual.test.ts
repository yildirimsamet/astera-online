import { ALL_HULLS } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import {
  DEATH_STAR_LIGHT,
  HULL_LIGHT,
  HULL_VISUAL_SCALE,
  FORMATION_SPACING,
  TRACKING_MARK,
  UNKNOWN_CONTACT_MARK,
  formationAimDirection,
  formationLayout,
  hullVisualScale,
} from '../src/galaxy/flightVisual.js';

describe('flight identity colours', () => {
  it('covers every hull, including future ground-to-home transfer safety', () => {
    expect(Object.keys(HULL_LIGHT).sort()).toEqual([...ALL_HULLS].sort());
    for (const hull of ALL_HULLS) {
      expect(HULL_LIGHT[hull].glow).toMatch(/^#[0-9a-f]{6}$/i);
      expect(HULL_LIGHT[hull].flame).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('keeps cargo amber, the Nullifier magenta and the Death Star red', () => {
    expect(HULL_LIGHT.WAYFARER.glow).toBe('#ffb43b');
    expect(HULL_LIGHT.NULLIFIER.glow).toBe('#d946ef');
    expect(DEATH_STAR_LIGHT.glow).toBe('#ff274d');
    expect(new Set([
      HULL_LIGHT.DART.glow,
      HULL_LIGHT.WAYFARER.glow,
      HULL_LIGHT.NULLIFIER.glow,
    ]).size).toBe(3);
  });
});

describe('authored hull presence', () => {
  it('covers every hull and applies each Fleet V2 model scale to flight geometry', () => {
    expect(Object.keys(HULL_VISUAL_SCALE).sort()).toEqual([...ALL_HULLS].sort());
    expect(hullVisualScale('DART', 10)).toBeCloseTo(8.4, 8);
    expect(hullVisualScale('TALON', 10)).toBeCloseTo(10, 8);
    expect(hullVisualScale('CITADEL', 10)).toBeCloseTo(13.8, 8);
    expect(hullVisualScale('PROSPECTOR', 10)).toBe(10);
  });

  it('keeps every authored multiplier finite and within the formation spacing budget', () => {
    for (const hull of ALL_HULLS) {
      expect(Number.isFinite(HULL_VISUAL_SCALE[hull]), hull).toBe(true);
      expect(HULL_VISUAL_SCALE[hull], hull).toBeGreaterThanOrEqual(0.8);
      expect(HULL_VISUAL_SCALE[hull], hull).toBeLessThanOrEqual(1.4);
    }
  });

  it('gives a formation enough room for its largest authored hull', () => {
    const base = 10;
    const darts = formationLayout([
      { hull: 'DART', filled: 10, ordinal: 0 },
      { hull: 'DART', filled: 10, ordinal: 1 },
    ], base);
    const capitals = formationLayout([
      { hull: 'CITADEL', filled: 10, ordinal: 0 },
      { hull: 'CITADEL', filled: 10, ordinal: 1 },
    ], base);
    const separation = (layout: typeof darts): number => Math.hypot(
      layout.slots[1]![0] - layout.slots[0]![0],
      layout.slots[1]![1] - layout.slots[0]![1],
      layout.slots[1]![2] - layout.slots[0]![2],
    );

    expect(FORMATION_SPACING).toBeGreaterThan(1.5);
    expect(capitals.scale).toBe(hullVisualScale('CITADEL', base));
    expect(separation(capitals)).toBeGreaterThan(capitals.scale);
    expect(separation(capitals)).toBeGreaterThan(separation(darts));
  });

  it('keeps every pair of large craft outside each other in a crowded formation', () => {
    const markers = Array.from({ length: 50 }, (_, ordinal) => ({
      hull: 'CITADEL' as const,
      filled: 10,
      ordinal,
    }));
    const layout = formationLayout(markers, 10);

    for (let i = 0; i < layout.slots.length; i += 1) {
      for (let j = i + 1; j < layout.slots.length; j += 1) {
        const a = layout.slots[i]!;
        const b = layout.slots[j]!;
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))
          .toBeGreaterThan(layout.scale);
      }
    }
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
