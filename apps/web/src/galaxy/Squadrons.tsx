import { ALL_HULLS, HULLS, type Fleet, type HullId } from '@astera/rules';

/**
 * HOW A FLEET IS DRAWN — the owner's rule, made exact.
 *
 * "One model per FIVE ships of a type. Above each model, five pips; as many are
 * filled as that model actually carries."
 *
 * So a squadron of 1 Wasp and 17 Lances is drawn as:
 *
 *   · one Wasp   — pips ●○○○○   (1 of 5)
 *   · one Lance  — pips ●●●●●   (5 of 5)
 *   · one Lance  — pips ●●○○○   (2 of 5)
 *
 * Five is the current owner decision: small and medium fleets should read as a
 * group of craft sooner. `MAX_MARKERS` remains the hard render budget, and the
 * numeric overflow preserves the exact count when a large fleet exceeds it.
 *
 * WHY IT IS WORTH THE TROUBLE. Rendering one marker per fleet tells a player
 * nothing they did not already know; rendering one model per SHIP is unreadable
 * past a dozen and ruinous past a hundred. This encodes an exact count in a shape
 * that stays legible at any size, and it degrades gracefully: at a glance you read
 * "three Lance groups", up close you read "twelve Lances".
 *
 * The pip is the load-bearing half. Without it a 5-ship group and a 1-ship group
 * look identical, and the player is being told a rounded number while believing it
 * is exact — worse than not showing it.
 */

/** Ships one model stands for. */
export const PER_MODEL = 5;

export interface Marker {
  hull: HullId;
  /** How many real ships this model represents, 1..PER_MODEL. */
  filled: number;
  /** Which model of its hull this is, so positions can be spread apart. */
  ordinal: number;
}

/**
 * Split a fleet into the markers the galaxy draws.
 *
 * Full groups first, then the remainder — so the partial pip group is always the
 * LAST of its hull. That ordering matters visually: a half-empty marker in the
 * middle of a formation reads as damage rather than as arithmetic.
 */
export function markersFor(fleet: Fleet): Marker[] {
  const out: Marker[] = [];

  for (const hull of ALL_HULLS) {
    const n = fleet[hull] ?? 0;
    if (n <= 0) continue;

    const full = Math.floor(n / PER_MODEL);
    const rest = n % PER_MODEL;
    let ordinal = 0;

    for (let i = 0; i < full; i++) out.push({ hull, filled: PER_MODEL, ordinal: ordinal++ });
    if (rest > 0) out.push({ hull, filled: rest, ordinal: full });
  }

  return out;
}

/**
 * A cap on how many models one squadron may draw.
 *
 * Two hundred Wasps is forty markers, which is a swarm nobody can count and a
 * frame cost nobody asked for. Past the cap the formation is truncated and the
 * overflow is stated as a number instead — honest, and legible at a glance.
 */
export const MAX_MARKERS = 12;

export interface Formation {
  markers: Marker[];
  /** Ships not represented by a drawn model, because the cap was hit. */
  hidden: number;
}

export function formationFor(fleet: Fleet): Formation {
  const all = markersFor(fleet);
  if (all.length <= MAX_MARKERS) return { markers: all, hidden: 0 };

  const shown = all.slice(0, MAX_MARKERS);
  const hidden = all.slice(MAX_MARKERS).reduce((sum, m) => sum + m.filled, 0);
  return { markers: shown, hidden };
}

/**
 * The angle between successive craft. The golden angle, ~137.5 degrees.
 *
 * It is what stops the formation forming spokes. Any rational fraction of a turn
 * repeats — every nth craft lands on the same bearing — and repeated bearings read
 * as rows, which is the grid this arrangement exists to avoid.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Where each model sits relative to the squadron's centre.
 *
 * A SOLID CONE, TIP FORWARD. Owner decision, replacing a shallow V.
 *
 * The V was chosen because it survives an orbiting camera — a line vanishes
 * end-on and a grid turns into a moiré — and it did, but it also spread wider
 * with every ship added. Seen from above, a real squadron came out as an enormous
 * flying wedge that was mostly empty space, and from the side it was a single row.
 *
 * This packs the craft into a cone instead: one at the point, the rest filling the
 * volume behind it. Both the radius and the depth grow with the SQUARE ROOT of the
 * index, which is what makes it solid rather than hollow — square-root growth
 * spreads points evenly through an area, so successive craft take every radius in
 * turn instead of stacking onto a shell. Vertical spread is squashed, because the
 * disc is read from a shallow angle and a formation as tall as it is wide reads as
 * a cloud rather than as a heading.
 *
 * TIGHTER THAN THE V AT EVERY SIZE, also at owner request: at twelve models the V
 * reached five and a half spacings across, and this reaches under two.
 */
export function slotOffset(i: number, spacing: number): [number, number, number] {
  if (i === 0) return [0, 0, 0];
  const spread = Math.sqrt(i);
  const angle = i * GOLDEN_ANGLE;
  return [
    Math.cos(angle) * spread * spacing * 0.5,
    Math.sin(angle) * spread * spacing * 0.28,
    -spread * spacing * 0.42,
  ];
}

/** The heaviest hull present. A squadron reads as its biggest ship. */
export function leadHull(fleet: Fleet): HullId | null {
  let best: HullId | null = null;
  for (const hull of ALL_HULLS) {
    if ((fleet[hull] ?? 0) <= 0) continue;
    if (!best || HULLS[hull].hp > HULLS[best].hp) best = hull;
  }
  return best;
}
