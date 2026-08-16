import { and, eq, inArray } from 'drizzle-orm';
import { GALAXY, seededFrom, type Vec3 } from '@blindspace/rules';
import type { Db } from '../db/client.js';
import { missions, planets } from '../db/schema.js';

/**
 * TRAFFIC — the galaxy is busy tonight, and that is all you may know.
 *
 * The player asked to see other people's fleets moving. Taken literally that
 * deletes the game: if a departure is visible, the Telescope no longer sells
 * anything, the Veil hides nothing, and half of what a probe buys is free. D1 is
 * locked and the four intel systems are on the never-cut list.
 *
 * So this reveals motion without revealing ROUTES. Three rules make a contact
 * unattributable, and all three are load-bearing:
 *
 *   1. NO ENDPOINTS. A contact is only visible between 25% and 85% of its flight,
 *      so nobody ever sees one leave a planet or arrive at one.
 *   2. JITTER WIDER THAN THE PLANETS ARE SPACED. Offsets are drawn up to 1.4×
 *      `minSeparation`, so extrapolating a contact's line lands in a cloud holding
 *      several candidate planets rather than on one.
 *   3. SEEDED, NOT RANDOM. The offset comes from the mission id, so refreshing
 *      returns the same fuzzed path. Fresh randomness per request would let a
 *      player average many samples back to the truth — the same mistake the
 *      telescope's windowed seeding exists to prevent.
 *
 * It carries no id, no owner, no kind and no destination. There is nothing in the
 * payload for a modified client to reveal.
 *
 * KNOWN LIMIT: on a shard with a handful of players, a single contact plus a
 * telescope reading is more informative than the same contact among two hundred.
 * The jitter is sized for a full shard; a nine-player dev galaxy leaks more.
 */

/** Wide enough that a fuzzed line cannot be pinned to one planet. */
const JITTER = GALAXY.minSeparation * 1.4;

/** The middle of the flight. Outside this band a contact is not rendered at all. */
const VISIBLE_FROM = 0.25;
const VISIBLE_TO = 0.85;

export interface Contact {
  /** Where the contact appears — NOT where the fleet came from. */
  from: Vec3;
  /** Where it fades — NOT where the fleet is going. */
  to: Vec3;
  /** Wall-clock span the client animates across. */
  startAt: Date;
  endAt: Date;
}

/** A stable offset for one mission, drawn once from its id. */
function offsetFor(missionId: string, tag: string): Vec3 {
  const rng = seededFrom(`${missionId}:${tag}`);
  // Rejection-free spherical-ish scatter; exactness does not matter, only that it
  // is large, stable, and unrelated to the true path.
  const theta = rng() * Math.PI * 2;
  const radius = JITTER * (0.45 + rng() * 0.55);
  return {
    x: Math.cos(theta) * radius,
    y: (rng() * 2 - 1) * GALAXY.thickness * 0.6,
    z: Math.sin(theta) * radius,
  };
}

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

const shift = (point: Vec3, by: Vec3): Vec3 => ({
  x: point.x + by.x,
  y: point.y + by.y,
  z: point.z + by.z,
});

/**
 * Every in-flight mission in the season, as an unattributable contact.
 *
 * The caller's own missions are excluded: those are rendered from the player's own
 * data at full fidelity, and a ghost of your own fleet beside the real one would
 * be both confusing and a free calibration sample for working out the jitter.
 */
export async function galaxyTraffic(
  db: Db,
  seasonId: string,
  ownPlanetId: string,
  now: Date,
): Promise<Contact[]> {
  const rows = await db
    .select({ mission: missions })
    .from(missions)
    .where(and(eq(missions.seasonId, seasonId), eq(missions.status, 'in_flight')));

  if (rows.length === 0) return [];

  const ids = new Set<string>();
  for (const { mission } of rows) {
    ids.add(mission.originPlanetId);
    ids.add(mission.targetPlanetId);
  }
  const planetRows = await db
    .select({ id: planets.id, x: planets.x, y: planets.y, z: planets.z })
    .from(planets)
    .where(inArray(planets.id, [...ids]));
  const positions = new Map<string, Vec3>(
    planetRows.map((p) => [p.id, { x: p.x, y: p.y, z: p.z }]),
  );

  const out: Contact[] = [];

  for (const { mission } of rows) {
    if (mission.originPlanetId === ownPlanetId || mission.targetPlanetId === ownPlanetId) {
      continue;
    }
    const origin = positions.get(mission.originPlanetId);
    const target = positions.get(mission.targetPlanetId);
    if (!origin || !target) continue;

    const depart = mission.departAt.getTime();
    const arrive = mission.arriveAt.getTime();
    const span = arrive - depart;
    if (span <= 0) continue;

    // BOTH ends of the band are enforced here, not just the far one.
    //
    // Returning a contact whose window has not opened yet would defeat the entire
    // point of the band: the client would learn a mission exists the instant it
    // launched, which is a departure, which is the Telescope's whole product. The
    // first version only checked the far end and a test caught it immediately.
    const startAt = new Date(depart + span * VISIBLE_FROM);
    const endAt = new Date(depart + span * VISIBLE_TO);
    if (startAt > now || endAt <= now) continue;

    out.push({
      from: shift(lerp(origin, target, VISIBLE_FROM), offsetFor(mission.id, 'a')),
      to: shift(lerp(origin, target, VISIBLE_TO), offsetFor(mission.id, 'b')),
      startAt,
      endAt,
    });
  }

  return out;
}
