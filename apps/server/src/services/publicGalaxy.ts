import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  SATELLITE_IDS,
  alloyRate,
  coreTier,
  crystalRate,
  neutralReserve,
  neutralThreat,
  storageCap,
  type NeutralReserve,
  type NeutralThreat,
  type SatelliteId,
  type Vec3,
} from '@astera/rules';
import type { Queryable } from '../db/client.js';
import {
  accounts,
  buildings,
  clanMemberships,
  clans,
  neutralPlanetState,
  planets,
  players,
  satellites,
} from '../db/schema.js';

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
 * CORE LEVEL IS PUBLIC AS OF THE DYSON RINGS, and it did not used to be. This
 * projection published only a coarse TIER, on the argument that knowing a world's
 * exact development is what a probe is for and that giving it away undercuts the
 * cheapest tier of intel. That argument still stands on its own terms — what
 * changed is the owner's decision that the disc should SHOW development at every
 * Core level rather than every third one: the ring count steps every three levels
 * and the colour steps every one, and there is no way to draw that from a tier.
 *
 * WHAT IT COSTS, stated rather than glossed: a probe's development reading is now
 * confirmation rather than news. What a probe still sells alone — and what decides
 * whether a raid pays — is the fleet, the ground defence, the shield strength and
 * the stores, none of which are here or anywhere near here.
 *
 * The tier stays, and is still what D49's ±2 attack band is defined on, so the
 * combat rule is unchanged and remains readable off the map before a fleet is
 * packed.
 *
 * TWO QUERIES FOR EVERY CORE LEVEL AND EVERY SATELLITE, never one per planet, and
 * both SCOPED TO THE SEASON. With multiple galaxies live in one database (D21/D100) an
 * unscoped read is ten times the rows to fetch and discard on the most frequent
 * read in the game.
 */
export interface PublicWorld {
  id: string;
  name: string;
  owner: string;
  kind: 'CAPITAL' | 'COLONY' | 'NEUTRAL';
  controller:
    | { kind: 'PLAYER'; playerId: string; displayName: string }
    | { kind: 'NEUTRAL'; tier: 1 | 2 | 3 };
  position: Vec3;
  coreTier: number;
  /**
   * The exact Command Core level. Public since the dyson rings — see the note
   * above for what that trades away. `coreTier` is derived from this and kept
   * because D49's attack band is defined on the tier, not on the level.
   */
  coreLevel: number;
  /** Types only. Never levels — see the note on `publicOrbit`. */
  satellites: SatelliteId[];
  /** Is there a dome. Never how strong it is. */
  shielded: boolean;
  state:
    | { kind: 'NORMAL' }
    | { kind: 'RECOVERY'; until: Date }
    | { kind: 'PROTECTED'; until: Date };
  neutral?: {
    tier: 1 | 2 | 3;
    threat: NeutralThreat;
    reserve: NeutralReserve;
    claimUntil: Date | null;
    nextReinforcementAt: Date | null;
  };
  clan?: { id: string; name: string; tag: string };
  /** Only the public podium; lower exact ranks stay on the leaderboard surface. */
  dominionRank?: 1 | 2 | 3;
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

/**
 * ONE WORLD'S OUTSIDE, AS A PROBE RECORDS IT. D127.
 *
 * Derived from the SAME `PublicWorld` the galaxy is built from rather than from a
 * second query of its own, because the two would drift the first time one of them
 * was edited — the failure `packages/rules/src/view.ts` exists to prevent, in a
 * different place. What a probe brings home and what a Telescope shows live have
 * to be the same shape or the interface tells two stories about one world.
 */
export const silhouetteOf = (world: PublicWorld): {
  owner: string;
  controllerPlayerId: string | null;
  clan: { id: string; name: string; tag: string } | null;
  kind: 'CAPITAL' | 'COLONY' | 'NEUTRAL';
  coreLevel: number;
  satellites: string[];
  shielded: boolean;
} => ({
  owner: world.owner,
  controllerPlayerId:
    world.controller.kind === 'PLAYER' ? world.controller.playerId : null,
  clan: world.clan ?? null,
  kind: world.kind,
  coreLevel: world.coreLevel,
  satellites: [...world.satellites],
  shielded: world.shielded,
});

export async function publicWorlds(
  db: Queryable,
  seasonId: string,
  now = new Date(),
  /**
   * Narrow to specific worlds. Used by the probe, which needs exactly one and must
   * not pay for the whole disc — and must not compute it a second way either.
   */
  planetIds?: readonly string[],
): Promise<PublicWorld[]> {
  const rows = await db
    .select({
      planet: planets,
      ownerName: accounts.displayName,
      neutral: neutralPlanetState,
      clanId: clans.id,
      clanName: clans.name,
      clanTag: clans.tag,
      // Left-joined, so a neutral world genuinely answers NULL here.
      playerScore: sql<number | null>`round(${players.dominionTaken} - ${players.dominionLost})`,
      playerJoinedAt: players.joinedAt,
    })
    .from(planets)
    .leftJoin(players, eq(planets.controllerPlayerId, players.id))
    .leftJoin(accounts, eq(players.accountId, accounts.id))
    .leftJoin(
      clanMemberships,
      and(eq(clanMemberships.playerId, players.id), isNull(clanMemberships.leftAt)),
    )
    .leftJoin(
      clans,
      and(eq(clans.id, clanMemberships.clanId), isNull(clans.disbandedAt)),
    )
    .leftJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
    .where(planetIds === undefined
      ? eq(planets.seasonId, seasonId)
      : and(eq(planets.seasonId, seasonId), inArray(planets.id, [...planetIds])));

  const ids = rows.map((r) => r.planet.id);
  if (ids.length === 0) return [];

  const [buildingRows, satelliteRows] = await Promise.all([
    db
      .select({ planetId: buildings.planetId, type: buildings.type, level: buildings.level })
      .from(buildings)
      .where(and(inArray(buildings.type, ['CORE', 'REFINERY', 'EXTRACTOR']), inArray(buildings.planetId, ids))),
    db
      .select({ planetId: satellites.planetId, type: satellites.type })
      .from(satellites)
      .where(inArray(satellites.planetId, ids)),
  ]);

  const levels = new Map(buildingRows.map((r) => [`${r.planetId}:${r.type}`, r.level]));
  const installed = publicOrbit(satelliteRows);
  const shielded = publicShields(satelliteRows);
  const commanders = new Map<string, { score: number; joinedAt: Date }>();
  for (const row of rows) {
    const playerId = row.planet.controllerPlayerId;
    if (!playerId || row.playerScore === null || !row.playerJoinedAt) continue;
    commanders.set(playerId, { score: row.playerScore, joinedAt: row.playerJoinedAt });
  }
  const dominionRanks = new Map(
    [...commanders]
      .sort(([leftId, left], [rightId, right]) =>
        right.score - left.score
        || left.joinedAt.getTime() - right.joinedAt.getTime()
        || leftId.localeCompare(rightId))
      .slice(0, 3)
      .map(([playerId], index) => [playerId, (index + 1) as 1 | 2 | 3] as const),
  );

  return rows.map((r) => {
    const core = levels.get(`${r.planet.id}:CORE`) ?? 0;
    const refinery = levels.get(`${r.planet.id}:REFINERY`) ?? 0;
    const extractor = levels.get(`${r.planet.id}:EXTRACTOR`) ?? 0;
    const vault = levels.get(`${r.planet.id}:VAULT`) ?? 0;
    const tier = (r.neutral?.tier ?? 1) as 1 | 2 | 3;
    const controller = r.planet.kind === 'NEUTRAL'
      ? { kind: 'NEUTRAL' as const, tier }
      : {
          kind: 'PLAYER' as const,
          playerId: r.planet.controllerPlayerId!,
          displayName: r.ownerName ?? 'Unknown commander',
        };
    const state = r.planet.recoveryUntil && r.planet.recoveryUntil > now
      ? { kind: 'RECOVERY' as const, until: r.planet.recoveryUntil }
      : r.planet.protectedUntil && r.planet.protectedUntil > now
        ? { kind: 'PROTECTED' as const, until: r.planet.protectedUntil }
        : { kind: 'NORMAL' as const };
    return {
      id: r.planet.id,
      name: r.planet.name,
      owner: r.ownerName ?? `Neutral T${String(tier)}`,
      kind: r.planet.kind,
      controller,
      position: { x: r.planet.x, y: r.planet.y, z: r.planet.z },
      coreTier: coreTier(core),
      coreLevel: core,
      satellites: installed.get(r.planet.id) ?? [],
      shielded: shielded.has(r.planet.id),
      state,
      ...(r.clanId && r.clanName && r.clanTag
        ? { clan: { id: r.clanId, name: r.clanName, tag: r.clanTag } }
        : {}),
      ...(r.planet.controllerPlayerId && dominionRanks.has(r.planet.controllerPlayerId)
        ? { dominionRank: dominionRanks.get(r.planet.controllerPlayerId)! }
        : {}),
      ...(r.planet.kind === 'NEUTRAL' && r.neutral
        ? {
            neutral: {
              tier,
              threat: neutralThreat(tier),
              reserve: neutralReserve(
                { alloy: r.planet.alloy, crystal: r.planet.crystal, deuterium: 0 },
                {
                  alloy: storageCap(alloyRate(refinery), vault),
                  crystal: storageCap(crystalRate(extractor), vault),
                  deuterium: 0,
                },
              ),
              claimUntil: r.neutral.claimUntil,
              nextReinforcementAt: r.neutral.nextReinforcementAt,
            },
          }
        : {}),
    };
  });
}
