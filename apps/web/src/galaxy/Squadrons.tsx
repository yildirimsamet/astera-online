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
 * group of craft sooner.
 *
 * NOTHING IS TRUNCATED. D115 removed the twelve-marker render budget, because the
 * cap sliced markers in `ALL_HULLS` order — so one crowded hull ate the entire
 * budget and deleted every other hull from the picture. 83 Wasps, 4 Lances, 2
 * Haulers and 1 Bulwark drew as twelve Wasps and nothing else, while the focus
 * panel spelt all four out. The numeric overflow D40 asked for was never drawn
 * anywhere, so the only thing the cap ever did was state a fleet wrongly with full
 * confidence. What it bought was real and is now spent: a marker costs two draw
 * calls and a depth clear, so a large fleet is a large formation. If that ever
 * becomes a frame problem the answer is instancing the hull, not cutting ships
 * back out of the picture.
 *
 * WHY IT IS WORTH THE TROUBLE. Rendering one marker per fleet tells a player
 * nothing they did not already know; rendering one model per SHIP is unreadable
 * past a dozen and ruinous past a hundred. This encodes an exact count in a shape
 * that stays legible at any size, and it degrades gracefully: at a glance you read
 * "three Lance groups", up close you read "twelve Lances".
 *
 * The pip is the load-bearing half. Without it a 10-ship group and a 1-ship group
 * look identical, and the player is being told a rounded number while believing it
 * is exact — worse than not showing it.
 */

/**
 * Ships one model stands for. Owner call: raised from 5 to 10.
 *
 * It is the trade between how many models a large fleet draws and how much
 * counting a single marker asks for. At 5 a hundred-Wasp fleet was twenty models
 * and a formation that filled the world it was leaving; at 10 it is ten, and the
 * tally above each marker wraps to two rows of five — still countable at a glance,
 * which is the property the pips exist to protect.
 */
export const PER_MODEL = 10;

export interface FormationHitBox {
  centre: [number, number, number];
  size: [number, number, number];
}

/**
 * One forgiving target that follows the WHOLE squadron.
 *
 * The old target only grew around the lead craft. A formation grows backwards as
 * `sqrt(markerCount)`, so its middle and tail eventually sat outside the sphere
 * even though the player was pressing directly on a visible ship. This box is the
 * local-space bounds of the exact slots we draw, padded by the original one-craft
 * tap radius. It therefore moves backwards with the fleet and covers every model
 * without growing into unrelated space ahead of it.
 */
export function formationHitBox(
  slots: readonly [number, number, number][],
  scale: number,
): FormationHitBox {
  const padding = Math.max(0.45, scale * 1.6);
  if (slots.length === 0) {
    const diameter = padding * 2;
    return { centre: [0, 0, 0], size: [diameter, diameter, diameter] };
  }

  const min: [number, number, number] = [...slots[0]!] as [number, number, number];
  const max: [number, number, number] = [...slots[0]!] as [number, number, number];
  for (const slot of slots.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis]!, slot[axis]!);
      max[axis] = Math.max(max[axis]!, slot[axis]!);
    }
  }

  return {
    centre: [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ],
    size: [
      max[0] - min[0] + padding * 2,
      max[1] - min[1] + padding * 2,
      max[2] - min[2] + padding * 2,
    ],
  };
}

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
  return slotAt(i, Math.sqrt(i), spacing);
}

/**
 * The same cone, with the radius handed in rather than derived from the count.
 *
 * `sqrt(i)` is what makes the arrangement solid, and it says something narrower
 * than that: it is the square root of the AREA already spent, at one unit of area
 * per craft. That holds only while every craft is the same size, which stopped
 * being true when a capital became four times a Dart — see `formationLayout`,
 * which spends area by footprint and calls this with the total.
 *
 * The angle still comes off the raw index, because the golden angle's whole job is
 * to keep successive craft off each other's bearing and it does that regardless of
 * how far out the radius has got.
 */
export function slotAt(
  index: number,
  spread: number,
  spacing: number,
): [number, number, number] {
  if (spread <= 0) return [0, 0, 0];
  const angle = index * GOLDEN_ANGLE;
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
