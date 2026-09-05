import { ALL_HULLS, HULLS, type HullId } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import {
  DEATH_STAR_LIGHT,
  FOOTPRINT_EXPONENT,
  HULL_LIGHT,
  HULL_VISUAL_SCALE,
  FORMATION_SPACING,
  TRACKING_MARK,
  UNKNOWN_CONTACT_MARK,
  formationAimDirection,
  formationLayout,
  hullVisualScale,
} from '../src/galaxy/flightVisual.js';
import { slotOffset, type Marker } from '../src/galaxy/Squadrons.js';

describe('flight identity colours', () => {
  it('covers every hull, including future ground-to-home transfer safety', () => {
    expect(Object.keys(HULL_LIGHT).sort()).toEqual([...ALL_HULLS].sort());
    for (const hull of ALL_HULLS) {
      expect(HULL_LIGHT[hull].glow).toMatch(/^#[0-9a-f]{6}$/i);
      expect(HULL_LIGHT[hull].flame).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  /**
   * THE FAMILY IS THE HUE, and the owner re-authored the three that had drifted.
   *
   * Cargo is the green a hold is drawn in everywhere else in the interface, the
   * Nullifier fires the threat red its charge is priced in, and the Death Star
   * keeps its own deeper red. What the assertion protects is not the codes but
   * that a skirmisher, a hold and a shield-breaker never share one.
   */
  it('keeps cargo green, the Nullifier red and the Death Star its own red', () => {
    expect(HULL_LIGHT.WAYFARER.glow).toBe('#0bc089');
    expect(HULL_LIGHT.NULLIFIER.glow).toBe('#ff3f52');
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
    expect(hullVisualScale('DART', 10)).toBeCloseTo(7, 8);
    expect(hullVisualScale('TALON', 10)).toBeCloseTo(12.5, 8);
    expect(hullVisualScale('CITADEL', 10)).toBeCloseTo(25, 8);
    expect(hullVisualScale('PROSPECTOR', 10)).toBe(10);
  });

  /**
   * SIZE IS THE TIER, WHICH IS THE OWNER'S RULE AND NOT A BAND.
   *
   * The old assertion was a window — every multiplier between 0.8 and 1.4 — and a
   * window is exactly what stops saying anything once the numbers move: it passed
   * a catalogue in which a capital was 1.6× a Dart and would have passed one in
   * which the order was scrambled. What a reader has to be able to do is glance at
   * a formation and read WEIGHT off it, so the rule is the ordering: no hull is
   * ever drawn smaller than a hull of a lower tier.
   */
  it('never draws a heavier tier smaller than a lighter one', () => {
    const tiers = new Map<number, number[]>();
    for (const hull of ALL_HULLS) {
      expect(Number.isFinite(HULL_VISUAL_SCALE[hull]), hull).toBe(true);
      expect(HULL_VISUAL_SCALE[hull], hull).toBeGreaterThan(0);
      const tier = HULLS[hull].tier;
      if (tier === null) continue;
      tiers.set(tier, [...(tiers.get(tier) ?? []), HULL_VISUAL_SCALE[hull]]);
    }

    const ordered = [...tiers.entries()].sort(([a], [b]) => a - b);
    for (const [index, [tier, sizes]] of ordered.entries()) {
      const lighter = ordered[index - 1];
      if (!lighter) continue;
      expect(Math.min(...sizes), `tier ${String(tier)}`)
        .toBeGreaterThanOrEqual(Math.max(...lighter[1]));
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

    expect(FORMATION_SPACING).toBeGreaterThan(1.5);
    expect(capitals.scale).toBe(hullVisualScale('CITADEL', base));
    expect(separation(capitals.slots, 0, 1)).toBeGreaterThan(capitals.scale);
    expect(separation(capitals.slots, 0, 1)).toBeGreaterThan(separation(darts.slots, 0, 1));
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
        expect(separation(layout.slots, i, j)).toBeGreaterThan(layout.scale);
      }
    }
  });
});

const separation = (
  slots: readonly (readonly [number, number, number])[],
  a: number,
  b: number,
): number => Math.hypot(
  slots[a]![0] - slots[b]![0],
  slots[a]![1] - slots[b]![1],
  slots[a]![2] - slots[b]![2],
);

const marker = (hull: HullId, ordinal: number): Marker => ({ hull, filled: 10, ordinal });
const extentOf = (slots: readonly (readonly [number, number, number])[]): number =>
  Math.max(...slots.map((slot) => Math.hypot(slot[0], slot[1], slot[2])));

/**
 * THE FORMATION IS PACKED BY FOOTPRINT AND ORDERED BY WEIGHT. Owner report.
 *
 * Every slot used to be laid on ONE grid, and that grid was sized by the largest
 * hull in the squadron — which was very nearly free while the authored sizes ran
 * from 0.84 to 1.38, and stopped being free the moment a Cataclysm became four
 * times a Dart. A raid of one capital and nineteen Darts was then drawn on a
 * Cataclysm-sized lattice: the capital had the room it needed and every Dart in
 * the wing sat alone in a hole three of its own lengths across. The owner's
 * report was the hole, not the capital.
 *
 * So a craft now takes the room ITS OWN SIZE needs — the radius advances with the
 * footprint already placed rather than with a count — and the heaviest hull leads,
 * which is both the fix's free half and the thing the owner asked for: a wing that
 * reads as ordered rather than as scattered.
 */
describe('how a mixed formation is packed', () => {
  const base = 10;
  const cataclysm = hullVisualScale('CATACLYSM', base);

  /** The wing in the owner's screenshot: one capital leading a cloud of Darts. */
  const mixed = [marker('CATACLYSM', 0), ...Array.from({ length: 19 }, (_, i) => marker('DART', i))];

  it('no longer lays small craft out on the largest hull’s grid', () => {
    const layout = formationLayout(mixed, base);
    /*
      The old rule, kept here as the thing being measured against rather than as a
      thing anything still calls: one spacing for every slot, sized by the biggest
      hull present.
    */
    const onOneGrid = mixed.map((_, index) =>
      slotOffset(index, cataclysm * FORMATION_SPACING));

    expect(extentOf(layout.slots)).toBeLessThan(extentOf(onOneGrid) * 0.6);
  });

  it('puts the heaviest hull at the point and every lighter one behind it', () => {
    const layout = formationLayout([
      marker('DART', 0),
      marker('CITADEL', 0),
      marker('VIPER', 0),
      marker('CATACLYSM', 0),
    ], base);

    // The tip is the Cataclysm's, whatever order the markers arrived in.
    expect(layout.slots[3]).toEqual([0, 0, 0]);
    const depth = (index: number): number => Math.hypot(...layout.slots[index]!);
    expect(depth(3)).toBeLessThan(depth(1));
    expect(depth(1)).toBeLessThan(depth(2));
    expect(depth(2)).toBeLessThan(depth(0));
  });

  /**
   * The slot list stays in the CALLER's order. Pips, drive lights, rank badges and
   * a volley all index it against the marker list, so a layout that reordered its
   * own output would hang every one of those on the wrong ship.
   */
  it('returns slots in the marker order it was given', () => {
    const forward = formationLayout([marker('DART', 0), marker('CITADEL', 0)], base);
    const reversed = formationLayout([marker('CITADEL', 0), marker('DART', 0)], base);

    expect(forward.slots[1]).toEqual(reversed.slots[0]);
    expect(forward.slots[0]).toEqual(reversed.slots[1]);
    expect(forward.slots[1]).toEqual([0, 0, 0]);
  });

  /**
   * NO CRAFT IS EVER DRAWN TIGHTER THAN A UNIFORM WING ALREADY IS.
   *
   * Packing by footprint is what closes the holes, and it is also what could open
   * a hull onto its neighbour: a big craft's sunflower neighbours are smaller, so
   * they advance the radius slowly and creep inside its own length. Measuring the
   * gap between two craft against their own sizes gives one number that holds for
   * both — 0.59 of a spacing is the closest a uniform formation ever puts two
   * models, and no mixed pair may beat it.
   */
  it('never draws two hulls closer, for their size, than a uniform wing does', () => {
    const uniform = formationLayout(
      Array.from({ length: 12 }, (_, i) => marker('CATACLYSM', i)),
      base,
    );
    let tightest = Infinity;
    for (let i = 0; i < uniform.slots.length; i += 1) {
      for (let j = i + 1; j < uniform.slots.length; j += 1) {
        tightest = Math.min(tightest, separation(uniform.slots, i, j) / cataclysm);
      }
    }

    const crowd = [
      ...Array.from({ length: 2 }, (_, i) => marker('CATACLYSM', i)),
      ...Array.from({ length: 3 }, (_, i) => marker('CITADEL', i)),
      ...Array.from({ length: 4 }, (_, i) => marker('TEMPEST', i)),
      ...Array.from({ length: 6 }, (_, i) => marker('VIPER', i)),
      ...Array.from({ length: 25 }, (_, i) => marker('DART', i)),
    ];
    const layout = formationLayout(crowd, base);
    const sizes = crowd.map((m) => hullVisualScale(m.hull, base));

    for (let i = 0; i < layout.slots.length; i += 1) {
      for (let j = i + 1; j < layout.slots.length; j += 1) {
        const room = (sizes[i]! + sizes[j]!) / 2;
        expect(
          separation(layout.slots, i, j) / room,
          `${crowd[i]!.hull} ${String(i)} against ${crowd[j]!.hull} ${String(j)}`,
        ).toBeGreaterThanOrEqual(tightest);
      }
    }
  });

  /**
   * A wing of one hull is UNCHANGED — the shape the owner tuned, at the spacing
   * they tuned it at. Only a mixed wing was ever wrong, so only a mixed wing moves.
   */
  it('leaves a single-hull wing exactly where it was', () => {
    const markers = Array.from({ length: 24 }, (_, i) => marker('CITADEL', i));
    const layout = formationLayout(markers, base);
    const spacing = hullVisualScale('CITADEL', base) * FORMATION_SPACING;

    for (const [index, slot] of layout.slots.entries()) {
      const expected = slotOffset(index, spacing);
      for (const axis of [0, 1, 2] as const) {
        expect(slot[axis]).toBeCloseTo(expected[axis], 8);
      }
    }
  });

  /** Softer than a strict area share, which is the whole margin above. */
  it('shares room by a softened footprint rather than by raw area', () => {
    expect(FOOTPRINT_EXPONENT).toBeGreaterThan(1);
    expect(FOOTPRINT_EXPONENT).toBeLessThan(2);
  });

  it('is deterministic, so a squadron does not reshuffle between frames', () => {
    expect(formationLayout(mixed, base)).toEqual(formationLayout(mixed, base));
  });

  it('still answers for a craft that has no roster at all', () => {
    expect(formationLayout(null, base)).toEqual({ slots: [[0, 0, 0]], scale: base });
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
