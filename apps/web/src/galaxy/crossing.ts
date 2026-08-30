import { sensorZone, type SensorSphere, type SensorZone, type Vec3 } from '@astera/rules';

/**
 * WHEN THE ANSWER CHANGES. D125, generalised to the owner's three zones.
 *
 * Traffic arrives as a bearing window a few minutes long and the client
 * interpolates inside it, but WHAT A CONTACT IS gets decided by the server per
 * request. So a craft that crosses one of the caller's circles mid-window would
 * keep its old appearance on screen until the next scheduled read and then pop —
 * and the crossing is the moment the whole ladder exists to sell.
 *
 * The fix is not to send identity early. It is to work out WHEN to ask again.
 * Position is linear in time inside a published window and the caller's own radii
 * are their own business, so the crossing instant is a closed-form solve the
 * client can do for itself. It refetches exactly then, the server decides the zone
 * exactly as it always did, and the transition lands on the right second.
 *
 * IT SOLVES AGAINST BOTH CIRCLES AT ONCE, and that is the change. It used to take
 * a flat `{at, reach}` and the caller passed it two different arrays — telescope
 * spheres in one call, radar spheres in another — which meant the caller was
 * re-deriving a model that already exists in `@astera/rules/sight`. There is one
 * call now and it wakes on every transition: NONE → CONTACT, CONTACT →
 * IDENTIFIED, and both of them in reverse.
 *
 * A closed form rather than a sampling loop, because it is shorter, exact, and has
 * no resolution to tune.
 */

export interface Segment {
  from: Vec3;
  to: Vec3;
  startAt: Date;
  endAt: Date;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * The fractions of the segment at which it meets one circle's surface.
 *
 * `|A + du - C|² = r²` expands to a quadratic in `u`; the roots inside `(0, 1)`
 * are the crossings that happen during this window. A tangent counts once and a
 * miss counts not at all, which is what the discriminant already says.
 */
function roots(segment: Segment, at: Vec3, radius: number): number[] {
  if (radius <= 0) return [];
  const d = sub(segment.to, segment.from);
  const e = sub(segment.from, at);
  const a = dot(d, d);
  if (a <= 0) return [];
  const b = 2 * dot(d, e);
  const c = dot(e, e) - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter((u) => u > 0 && u < 1);
}

const lerp = (segment: Segment, u: number): Vec3 => ({
  x: segment.from.x + (segment.to.x - segment.from.x) * u,
  y: segment.from.y + (segment.to.y - segment.from.y) * u,
  z: segment.from.z + (segment.to.z - segment.from.z) * u,
});

/** What the caller would see of this craft at one fraction along its window. */
export const zoneAlong = (
  segment: Segment,
  spheres: readonly SensorSphere[],
  u: number,
): SensorZone => sensorZone(spheres, lerp(segment, u));

/**
 * The first instant inside this window at which the caller's entitlement changes,
 * or null if it does not change at all.
 *
 * EVERY DIRECTION MATTERS. A craft entering the radar ring has to appear; one
 * entering telescope reach has to resolve into something readable; one leaving has
 * to go back to a question mark and then to nothing, or the disc would keep
 * showing a reading the player is no longer entitled to.
 *
 * The midpoint between consecutive roots is what is actually tested, because a
 * root is exactly ON a surface and floating point has no opinion about which side
 * of it that is.
 */
export function nextCrossing(
  segment: Segment,
  spheres: readonly SensorSphere[],
): Date | null {
  if (spheres.length === 0) return null;
  const span = segment.endAt.getTime() - segment.startAt.getTime();
  if (span <= 0) return null;

  const all = spheres
    .flatMap((sphere) => [
      ...roots(segment, sphere.at, sphere.identify),
      ...roots(segment, sphere.at, sphere.detect),
    ])
    .sort((x, y) => x - y)
    // A tangent has the same quadratic root twice. Overlapping circles — and the
    // two radii of one post — can also put several surfaces at the same fraction.
    // Treat that place as one candidate or an exact-on-the-surface `<=` can
    // manufacture a state change.
    .filter((u, index, values) => index === 0 || Math.abs(u - values[index - 1]!) > 1e-9);
  if (all.length === 0) return null;

  for (const [index, u] of all.entries()) {
    // Test open intervals on both sides. Testing the root itself is ambiguous by
    // definition (`distance === radius`) and made a tangential touch look like an
    // enter/leave transition even though entitlement never changed.
    const previous = all[index - 1] ?? 0;
    const next = all[index + 1] ?? 1;
    const before = zoneAlong(segment, spheres, (previous + u) / 2);
    const after = zoneAlong(segment, spheres, (u + next) / 2);
    if (before !== after) return new Date(segment.startAt.getTime() + u * span);
  }
  return null;
}
