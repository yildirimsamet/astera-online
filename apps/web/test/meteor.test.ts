import { describe, expect, it } from 'vitest';
import { METEOR_FADE, meteorTrail, type MeteorPath } from '../src/galaxy/meteor.js';

/**
 * A SHOOTING STAR THAT FADES AS IT FLIES. Owner, 2026-09-25: *"Laglı gibi
 * kayıyorlar. Daha güzel olsun arkasında sönen ışık bırakıyor gibi olsun"* — and,
 * on seeing the head stop where it burnt out while the trail shrank into it:
 * *"gitmeye devam ederken sönecek ve sönme tamamen bittiğinde yok olacak. Şuanda
 * … bir noktaya çarpmış takılı kalmış ve sönmeye başlamış gibi."*
 *
 * The path is a pure function of age, so what the streak does is asserted here and
 * only how it looks is left to the photograph.
 */
const path: MeteorPath = {
  from: [10, 2, -4],
  direction: [1, 0, 0],
  speed: 40,
  length: 12,
  life: 1,
};

const end = path.life + METEOR_FADE;

const distance = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('a shooting star', () => {
  it('starts where it spawned and flies along its direction at its speed', () => {
    const start = meteorTrail(path, 0)!;
    expect(start.head).toEqual([10, 2, -4]);
    const later = meteorTrail(path, 0.5)!;
    expect(later.head[0]).toBeCloseTo(30, 9);
    expect(later.head[1]).toBeCloseTo(2, 9);
  });

  /** The trail is what it has already crossed: never longer, never behind the start. */
  it('draws its trail behind it, never longer than its length and never before it began', () => {
    for (let age = 0; age <= end; age += 0.02) {
      const trail = meteorTrail(path, age);
      if (!trail) continue;
      expect(distance(trail.head, trail.tail)).toBeLessThanOrEqual(path.length + 1e-9);
      expect(trail.tail[0]).toBeGreaterThanOrEqual(path.from[0] - 1e-9);
      expect(trail.tail[0]).toBeLessThanOrEqual(trail.head[0] + 1e-9);
    }
    expect(distance(meteorTrail(path, 0.1)!.head, meteorTrail(path, 0.1)!.tail)).toBeCloseTo(4, 9);
  });

  /** It flares in; a streak that pops on reads as a rendering fault. */
  it('brightens from nothing', () => {
    expect(meteorTrail(path, 0)!.headLight).toBeCloseTo(0, 6);
    expect(meteorTrail(path, 0.4)!.headLight).toBeGreaterThan(0.8);
    expect(meteorTrail(path, path.life)!.headLight).toBeGreaterThan(0.8);
  });

  /**
   * IT NEVER STOPS. It fades while it is still flying — the head keeps its speed and
   * its trail keeps its length the whole way — and it is gone only when the fade is.
   * Stopping the head where it burnt out read as a streak that hit something.
   */
  it('keeps flying at full speed while it fades, and is gone only when the fade is', () => {
    let previous = meteorTrail(path, path.life)!;
    for (let age = path.life + 0.05; age < end; age += 0.05) {
      const trail = meteorTrail(path, age)!;
      expect(trail.head[0] - previous.head[0]).toBeCloseTo(path.speed * 0.05, 6);
      expect(distance(trail.head, trail.tail)).toBeCloseTo(path.length, 6);
      expect(trail.headLight).toBeLessThanOrEqual(previous.headLight + 1e-9);
      expect(trail.trailLight).toBeLessThanOrEqual(previous.trailLight + 1e-9);
      previous = trail;
    }
    expect(previous.headLight).toBeLessThan(0.05);
    expect(previous.trailLight).toBeLessThan(0.05);
    expect(meteorTrail(path, end + 0.01)).toBeNull();
  });

  /** No step anywhere: the fade begins exactly where the burn left off. */
  it('fades without a step where the burn ends', () => {
    const before = meteorTrail(path, path.life - 1e-4)!;
    const after = meteorTrail(path, path.life + 1e-4)!;
    expect(Math.abs(after.headLight - before.headLight)).toBeLessThan(0.01);
    expect(Math.abs(after.trailLight - before.trailLight)).toBeLessThan(0.01);
  });

  it('is nothing before it starts or on a nonsense age', () => {
    expect(meteorTrail(path, -0.1)).toBeNull();
    expect(meteorTrail(path, Number.NaN)).toBeNull();
  });
});
