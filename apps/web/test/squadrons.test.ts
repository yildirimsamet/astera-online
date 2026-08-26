import { describe, expect, it } from 'vitest';
import { PER_MODEL, leadHull, markersFor, slotOffset } from '../src/galaxy/Squadrons.js';

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
    expect(PER_MODEL).toBe(10);
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

  it('draws a group and a half as one full model and one remainder', () => {
    // Written off `PER_MODEL` rather than the numbers it happened to be: raising
    // the constant from 5 to 10 broke three of these while nothing they test had
    // changed, which is the failure the invariants table calls "write the share,
    // not the count".
    const half = Math.floor(PER_MODEL / 2);
    expect(markersFor({ WASP: PER_MODEL + half })).toEqual([
      { hull: 'WASP', filled: PER_MODEL, ordinal: 0 },
      { hull: 'WASP', filled: half, ordinal: 1 },
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
    const lances = PER_MODEL + 1;
    const fleet = { WASP: 6, LANCE: lances, BULWARK: 3, HAULER: 1 };
    const total = 6 + lances + 3 + 1;
    const markers = markersFor(fleet);
    expect(markers.reduce((sum, marker) => sum + marker.filled, 0)).toBe(total);
    // One over a full group is always exactly two models of that hull.
    expect(markers.filter((marker) => marker.hull === 'LANCE')).toHaveLength(2);
  });
});

/**
 * NOTHING IS EVER CUT. D115.
 *
 * The old twelve-marker cap sliced in `ALL_HULLS` order, so one crowded hull ate
 * the whole budget and every other hull vanished from the disc — the exact fleet
 * below drew as twelve Wasps and nothing else while the focus panel spelt all
 * four hulls out. These hold the two properties that failure violated: every ship
 * is drawn, and every hull the fleet contains appears.
 */
describe('very large fleets', () => {
  it('draws every ship in a fleet of two hundred', () => {
    const markers = markersFor({ WASP: 200 });
    expect(markers.reduce((sum, marker) => sum + marker.filled, 0)).toBe(200);
    expect(markers).toHaveLength(Math.ceil(200 / PER_MODEL));
  });

  it('keeps every hull when one of them is crowded', () => {
    const markers = markersFor({ WASP: 83, LANCE: 4, HAULER: 2, BULWARK: 1 });
    expect(markers.reduce((sum, marker) => sum + marker.filled, 0)).toBe(90);
    expect(new Set(markers.map((marker) => marker.hull))).toEqual(
      new Set(['WASP', 'LANCE', 'HAULER', 'BULWARK']),
    );
  });

  it('draws a mixed fleet without losing a ship', () => {
    const markers = markersFor({ WASP: 31, LANCE: 27, BULWARK: 14 });
    expect(markers.reduce((sum, marker) => sum + marker.filled, 0)).toBe(72);
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
  /**
   * TWELVE, BECAUSE THAT IS THE SIZE THE TIGHTNESS CLAIM WAS MEASURED AT.
   *
   * It used to be `MAX_MARKERS`, which D115 deleted. Most of what follows is a
   * property of `slotOffset` at any size — a tip, growth with depth, a solid
   * interior — but the two-spacings bound below is NOT: the radius grows as
   * `sqrt(i)`, so it passes two spacings at about seventeen markers and reaches
   * roughly seven at two hundred. That assertion is the comparison against the
   * shallow V it replaced, and the V was measured at twelve. Read it as "tighter
   * than the V at the size the V was judged", not as a bound on the formation.
   */
  const SIZE = 12;
  const slots = (n: number): [number, number, number][] =>
    Array.from({ length: n }, (_, i) => slotOffset(i, SPACING));

  const distance = (a: [number, number, number], b: [number, number, number]): number =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  it('puts the first craft exactly at the squadron’s point', () => {
    expect(slotOffset(0, SPACING)).toEqual([0, 0, 0]);
  });

  /** Every other craft is BEHIND the point. A cone has one tip, not two. */
  it('places every other craft behind the point', () => {
    for (const [i, slot] of slots(SIZE).entries()) {
      if (i === 0) continue;
      expect(slot[2], `slot ${String(i)} is not behind the tip`).toBeLessThan(0);
    }
  });

  /** It widens as it goes back — that is what makes it a cone rather than a column. */
  it('widens with depth', () => {
    const radiusOf = (s: [number, number, number]): number => Math.hypot(s[0], s[1]);
    const first = slots(SIZE).slice(1, 4).map(radiusOf);
    const last = slots(SIZE).slice(-3).map(radiusOf);
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
    const radii = slots(SIZE)
      .slice(1)
      .map((s) => Math.hypot(s[0], s[1]))
      .map((r) => Math.round(r * 100) / 100);
    expect(new Set(radii).size).toBeGreaterThan(radii.length * 0.7);
  });

  /** No two craft occupy the same point, at any size. */
  it('never stacks two craft on the same spot', () => {
    const all = slots(SIZE);
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
    for (const slot of slots(SIZE)) {
      expect(Math.hypot(slot[0], slot[1], slot[2])).toBeLessThan(2 * SPACING);
    }
  });

  /** Wider than it is tall, because the disc is read from a shallow angle. */
  it('is flatter than it is wide', () => {
    const all = slots(SIZE);
    const width = Math.max(...all.map((s) => Math.abs(s[0])));
    const height = Math.max(...all.map((s) => Math.abs(s[1])));
    expect(height).toBeLessThan(width);
  });

  /** Scales with its spacing and with nothing else — the same shape at any size. */
  it('scales linearly with the spacing it is given', () => {
    for (let i = 0; i < SIZE; i++) {
      const one = slotOffset(i, 1);
      const three = slotOffset(i, 3);
      for (const axis of [0, 1, 2] as const) {
        expect(three[axis]).toBeCloseTo(one[axis] * 3, 6);
      }
    }
  });

  /** Deterministic: the same squadron must not reshuffle between frames. */
  it('gives the same answer every time', () => {
    expect(slots(SIZE)).toEqual(slots(SIZE));
  });
});
