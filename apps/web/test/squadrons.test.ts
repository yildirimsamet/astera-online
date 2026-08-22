import { describe, expect, it } from 'vitest';
import { MAX_MARKERS, PER_MODEL, formationFor, leadHull, markersFor, slotOffset } from '../src/galaxy/Squadrons.js';

/**
 * The owner stated this rule precisely, so it is tested precisely.
 *
 * "One model per PER_MODEL ships. That many pips above each model; as many filled
 * as that model carries."
 *
 * The group size is itself an owner decision, so one test locks it to five. The
 * remaining cases assert the shape: full groups first, the remainder last, every
 * ship accounted for, nothing over one model's capacity.
 */
describe('how a fleet becomes models', () => {
  it('represents exactly five ships with each model', () => {
    expect(PER_MODEL).toBe(5);
  });

  it('draws the owner’s worked example exactly', () => {
    // One of the first hull and one full group plus two of the second.
    const markers = markersFor({ WASP: 1, LANCE: PER_MODEL + 2 });

    expect(markers).toEqual([
      { hull: 'WASP', filled: 1, ordinal: 0 },
      { hull: 'LANCE', filled: PER_MODEL, ordinal: 0 },
      { hull: 'LANCE', filled: 2, ordinal: 1 },
    ]);
  });

  it('draws exactly one model for a full group', () => {
    expect(markersFor({ WASP: PER_MODEL })).toEqual([
      { hull: 'WASP', filled: PER_MODEL, ordinal: 0 },
    ]);
  });

  it('draws six ships as one full group and one remainder', () => {
    expect(markersFor({ WASP: 6 })).toEqual([
      { hull: 'WASP', filled: 5, ordinal: 0 },
      { hull: 'WASP', filled: 1, ordinal: 1 },
    ]);
  });

  /**
   * ONE OVER A FULL GROUP IS TWO MODELS, the second nearly empty. The full group
   * leads and the remainder trails, which is what stops a half-empty marker in the
   * middle of a formation reading as battle damage rather than as arithmetic.
   */
  it('draws one over a full group as a full model and a remainder of one', () => {
    expect(markersFor({ WASP: PER_MODEL + 1 })).toEqual([
      { hull: 'WASP', filled: PER_MODEL, ordinal: 0 },
      { hull: 'WASP', filled: 1, ordinal: 1 },
    ]);
  });

  it('draws one model with one pip for a single ship', () => {
    expect(markersFor({ HAULER: 1 })).toEqual([{ hull: 'HAULER', filled: 1, ordinal: 0 }]);
  });

  it('never draws a model for a hull that is not there', () => {
    expect(markersFor({ WASP: 0, LANCE: 3 })).toEqual([
      { hull: 'LANCE', filled: 3, ordinal: 0 },
    ]);
    expect(markersFor({})).toEqual([]);
  });

  /**
   * The partial group is always LAST for its hull. A half-filled marker in the
   * middle of a formation reads as battle damage rather than as arithmetic.
   */
  it('puts the partial group after the full ones', () => {
    const lances = markersFor({ LANCE: PER_MODEL * 2 + 2 }).map((m) => m.filled);
    expect(lances).toEqual([PER_MODEL, PER_MODEL, 2]);
  });

  it('accounts for every ship, for any count', () => {
    for (let n = 1; n <= 97; n++) {
      const total = markersFor({ WASP: n }).reduce((s, m) => s + m.filled, 0);
      expect(total).toBe(n);
    }
  });

  it('never fills a model beyond its own capacity', () => {
    for (let n = 1; n <= 97; n++) {
      for (const marker of markersFor({ BULWARK: n })) {
        expect(marker.filled).toBeGreaterThan(0);
        expect(marker.filled).toBeLessThanOrEqual(PER_MODEL);
      }
    }
  });

  it('keeps hulls in a fixed order so a formation looks the same every time', () => {
    const a = markersFor({ HAULER: 3, WASP: 2 }).map((m) => m.hull);
    const b = markersFor({ WASP: 2, HAULER: 3 }).map((m) => m.hull);
    expect(a).toEqual(b);
    expect(a[0]).toBe('WASP');
  });

  it('accounts for every ship in a mixed fleet', () => {
    const markers = markersFor({ WASP: 6, LANCE: 10, BULWARK: 3, HAULER: 1 });
    expect(markers.reduce((sum, marker) => sum + marker.filled, 0)).toBe(20);
    expect(markers.filter((marker) => marker.hull === 'LANCE')).toHaveLength(2);
  });
});

/**
 * A cap exists because two hundred Wasps is forty markers — a swarm nobody can
 * count and a frame cost nobody asked for. What matters is that the overflow is
 * REPORTED rather than silently dropped.
 */
describe('very large fleets', () => {
  it('caps the models drawn and states what is not shown', () => {
    const { markers, hidden } = formationFor({ WASP: 200 });
    expect(markers.length).toBeLessThanOrEqual(12);
    expect(markers.reduce((s, m) => s + m.filled, 0) + hidden).toBe(200);
    expect(hidden).toBeGreaterThan(0);
  });

  it('counts mixed-hull overflow without losing a ship', () => {
    const { markers, hidden } = formationFor({ WASP: 31, LANCE: 27, BULWARK: 14 });
    expect(markers).toHaveLength(MAX_MARKERS);
    expect(markers.reduce((sum, marker) => sum + marker.filled, 0) + hidden).toBe(72);
    expect(hidden).toBe(16);
  });

  it('hides nothing when the fleet fits', () => {
    const { markers, hidden } = formationFor({ WASP: 5, LANCE: 5 });
    expect(hidden).toBe(0);
    expect(markers).toHaveLength(2);
  });
});

describe('what a squadron reads as', () => {
  it('takes its identity from the heaviest hull present', () => {
    expect(leadHull({ WASP: 40, BULWARK: 1 })).toBe('BULWARK');
    expect(leadHull({ WASP: 3, HAULER: 1 })).toBe('HAULER');
    expect(leadHull({})).toBeNull();
  });
});

/**
 * THE FORMATION, WHICH IS A SOLID CONE. Owner decision.
 *
 * It was a shallow V, and a V spreads with every ship added: seen from above a real
 * squadron came out as an enormous wedge that was mostly empty air, and from the
 * side it collapsed into a single row. The owner drew what they wanted instead — a
 * funnel with its interior filled — and asked for it tighter in every direction.
 *
 * These assert the properties that make it that, rather than the coordinates,
 * because the coordinates are a matter of taste and the properties are not.
 */
describe('where each model sits', () => {
  const SPACING = 1;
  const slots = (n: number): [number, number, number][] =>
    Array.from({ length: n }, (_, i) => slotOffset(i, SPACING));

  const distance = (a: [number, number, number], b: [number, number, number]): number =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  it('puts the first craft exactly at the squadron’s point', () => {
    expect(slotOffset(0, SPACING)).toEqual([0, 0, 0]);
  });

  /** Every other craft is BEHIND the point. A cone has one tip, not two. */
  it('places every other craft behind the point', () => {
    for (const [i, slot] of slots(MAX_MARKERS).entries()) {
      if (i === 0) continue;
      expect(slot[2], `slot ${String(i)} is not behind the tip`).toBeLessThan(0);
    }
  });

  /** It widens as it goes back — that is what makes it a cone rather than a column. */
  it('widens with depth', () => {
    const radiusOf = (s: [number, number, number]): number => Math.hypot(s[0], s[1]);
    const first = slots(MAX_MARKERS).slice(1, 4).map(radiusOf);
    const last = slots(MAX_MARKERS).slice(-3).map(radiusOf);
    expect(Math.max(...last)).toBeGreaterThan(Math.max(...first));
  });

  /**
   * SOLID, NOT HOLLOW — the specific thing the owner drew.
   *
   * A shell puts every craft at the same distance from the axis for a given depth.
   * This asks for the opposite: across the formation, the radii must take many
   * distinct values rather than clustering onto a few rings.
   */
  it('fills the interior rather than forming a shell', () => {
    const radii = slots(MAX_MARKERS)
      .slice(1)
      .map((s) => Math.hypot(s[0], s[1]))
      .map((r) => Math.round(r * 100) / 100);
    expect(new Set(radii).size).toBeGreaterThan(radii.length * 0.7);
  });

  /** No two craft occupy the same point, at any size. */
  it('never stacks two craft on the same spot', () => {
    const all = slots(MAX_MARKERS);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(distance(all[i]!, all[j]!), `slots ${String(i)} and ${String(j)}`).toBeGreaterThan(0.05);
      }
    }
  });

  /**
   * TIGHTER THAN THE V IT REPLACED, at every size. The V reached `rank * spacing`
   * across, which at twelve models is five and a half spacings; this is the
   * assertion that the owner's "biraz daha göt göte" actually happened.
   */
  it('keeps the whole formation inside two spacings of its centre', () => {
    for (const slot of slots(MAX_MARKERS)) {
      expect(Math.hypot(slot[0], slot[1], slot[2])).toBeLessThan(2 * SPACING);
    }
  });

  /** Wider than it is tall, because the disc is read from a shallow angle. */
  it('is flatter than it is wide', () => {
    const all = slots(MAX_MARKERS);
    const width = Math.max(...all.map((s) => Math.abs(s[0])));
    const height = Math.max(...all.map((s) => Math.abs(s[1])));
    expect(height).toBeLessThan(width);
  });

  /** Scales with its spacing and with nothing else — the same shape at any size. */
  it('scales linearly with the spacing it is given', () => {
    for (let i = 0; i < MAX_MARKERS; i++) {
      const one = slotOffset(i, 1);
      const three = slotOffset(i, 3);
      for (const axis of [0, 1, 2] as const) {
        expect(three[axis]).toBeCloseTo(one[axis] * 3, 6);
      }
    }
  });

  /** Deterministic: the same squadron must not reshuffle between frames. */
  it('gives the same answer every time', () => {
    expect(slots(MAX_MARKERS)).toEqual(slots(MAX_MARKERS));
  });
});
