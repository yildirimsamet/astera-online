import { and, eq, inArray } from 'drizzle-orm';
import { SATELLITE_IDS, coreTier, type SatelliteId, type Vec3 } from '@astera/rules';
import type { Db } from '../db/client.js';
import { buildings, planets, players, satellites } from '../db/schema.js';

/**
 * EVERY WORLD IN A SEASON, AT THE DETAIL EVERYBODY IS ENTITLED TO.
 *
 * THIS IS THE FOG'S FLOOR, AND IT LIVES IN ONE PLACE ON PURPOSE. Two surfaces read
 * it now — `/api/galaxy`, which adds what the caller has EARNED on top (their own
 * world, and a fleet reading for anything they are watching), and `/api/preview`,
 * which is public and adds nothing at all. A second copy of this projection is a
 * second place a private column can be added by accident, and the one that is
 * unauthenticated is the copy nobody would think to check.
 *
 * Core level is exposed as a coarse TIER, never the exact number. Development level
 * is public — you can see a planet is big — but knowing it precisely is what a probe
 * is for, and leaking the exact level for free would make the cheapest tier of intel
 * redundant. Since D49 the tier also decides who may fight whom, so it has to be
 * readable off the map before a fleet is packed.
 *
 * TWO QUERIES FOR EVERY CORE LEVEL AND EVERY SATELLITE, never one per planet, and
 * both SCOPED TO THE SEASON. With ten galaxies live in one database (D21) an
 * unscoped read is ten times the rows to fetch and discard on the most frequent
 * read in the game.
 */
export interface PublicWorld {
  id: string;
  name: string;
  owner: string;
  position: Vec3;
  coreTier: number;
  /** Types only. Never levels — see the note on `publicOrbit`. */
  satellites: SatelliteId[];
  /** Is there a dome. Never how strong it is. */
  shielded: boolean;
}

/**
 * HARDWARE IS PUBLIC; READINGS ARE NOT. D15.
 *
 * Which satellites a planet carries is visible to everyone — they are physical
 * objects in orbit and the 3D galaxy draws them. Their LEVELS never leave the
 * owner's own planet payload: an Aegis is visible, its shield strength is not, and
 * shield strength is what decides whether a raid pays.
 *
 * Only SATELLITES are published. The four ground instruments — Telescope, Radar,
 * Aegis, Veil — are on the surface and are nobody else's business (D25): whether a
 * world can see you, and whether it can tell you are looking, is exactly what the
 * information game is about.
 */
const publicOrbit = (rows: readonly { planetId: string; type: string }[]) => {
  const known = new Set<string>(SATELLITE_IDS);
  const map = new Map<string, SatelliteId[]>();
  for (const row of rows) {
    if (!known.has(row.type)) continue;
    const list = map.get(row.planetId);
    if (list) list.push(row.type as SatelliteId);
    else map.set(row.planetId, [row.type as SatelliteId]);
  }
  return map;
};

/**
 * Who has a dome up. The one instrument fact that is public, and only as a boolean.
 *
 * A shielded world must read as shielded: a dome is a physical object like any
 * other, deterrence is meant to be legible, and a raider who cannot tell an
 * armoured world from a bare one is not making a decision. What stays private is
 * the LEVEL behind it, which is what actually decides the raid.
 */
const publicShields = (rows: readonly { planetId: string; type: string }[]) =>
  new Set(rows.filter((r) => r.type === 'AEGIS').map((r) => r.planetId));

export async function publicWorlds(db: Db, seasonId: string): Promise<PublicWorld[]> {
  const rows = await db
    .select({ planet: planets, ownerName: players.name })
    .from(planets)
    .innerJoin(players, eq(planets.playerId, players.id))
    .where(eq(planets.seasonId, seasonId));

  const ids = rows.map((r) => r.planet.id);
  if (ids.length === 0) return [];

  const [coreRows, satelliteRows] = await Promise.all([
    db
      .select({ planetId: buildings.planetId, level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.type, 'CORE'), inArray(buildings.planetId, ids))),
    db
      .select({ planetId: satellites.planetId, type: satellites.type })
      .from(satellites)
      .where(inArray(satellites.planetId, ids)),
  ]);

  const cores = new Map(coreRows.map((r) => [r.planetId, r.level]));
  const installed = publicOrbit(satelliteRows);
  const shielded = publicShields(satelliteRows);

  return rows.map((r) => ({
    id: r.planet.id,
    name: r.planet.name,
    owner: r.ownerName,
    position: { x: r.planet.x, y: r.planet.y, z: r.planet.z },
    coreTier: coreTier(cores.get(r.planet.id) ?? 1),
    satellites: installed.get(r.planet.id) ?? [],
    shielded: shielded.has(r.planet.id),
  }));
}
