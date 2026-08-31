import { and, count, eq, inArray, isNull, max, or } from 'drizzle-orm';
import { colonyCapacity } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { buildings, missions, neutralPlanetState, planets, players, units } from '../db/schema.js';
import { GameError, lockSeason } from './planet.js';
import { refreshSensorEpoch } from './sensorHistory.js';

export interface CommanderWorld {
  playerId: string;
  seasonId: string;
  planetId: string;
  kind: 'CAPITAL' | 'COLONY';
}

export interface CommanderTopology {
  playerId: string;
  seasonId: string;
  capitalPlanetId: string;
  planetIds: string[];
}

/**
 * The small caller-specific prefix shared by the galaxy and traffic reads.
 *
 * One joined query replaces the old capital lookup followed by an owned-world
 * lookup. That distinction is material during a shard broadcast: hundreds of
 * callers wake together, and every avoidable round trip occupies a pool slot
 * while the next one waits.
 */
export async function commanderTopology(
  db: Queryable,
  accountId: string,
): Promise<CommanderTopology> {
  const rows = await db
    .select({
      playerId: players.id,
      seasonId: players.seasonId,
      planetId: planets.id,
      kind: planets.kind,
    })
    .from(players)
    .innerJoin(planets, eq(planets.controllerPlayerId, players.id))
    .where(eq(players.accountId, accountId));
  const first = rows[0];
  const capital = rows.find((row) => row.kind === 'CAPITAL');
  if (!first || !capital) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  return {
    playerId: first.playerId,
    seasonId: first.seasonId,
    capitalPlanetId: capital.planetId,
    planetIds: rows.map((row) => row.planetId),
  };
}

export async function commanderForAccount(
  db: Queryable,
  accountId: string,
): Promise<{ playerId: string; seasonId: string }> {
  const [row] = await db
    .select({ playerId: players.id, seasonId: players.seasonId })
    .from(players)
    .where(eq(players.accountId, accountId))
    .limit(1);
  if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  return row;
}

export async function capitalPlanet(
  db: Queryable,
  playerId: string,
): Promise<typeof planets.$inferSelect> {
  const [capital] = await db
    .select()
    .from(planets)
    .where(and(eq(planets.controllerPlayerId, playerId), eq(planets.kind, 'CAPITAL')))
    .limit(1);
  if (!capital) throw new GameError('NO_CAPITAL', 'Commander has no capital', 409);
  return capital;
}

/** Lock every world touched by a mutation in the global season → sorted planet order. */
export async function lockWorlds(
  tx: Tx,
  planetIds: string[],
): Promise<Map<string, typeof planets.$inferSelect>> {
  const unique = [...new Set(planetIds)].sort();
  const rows = await tx.select().from(planets).where(inArray(planets.id, unique));
  if (rows.length !== unique.length) {
    throw new GameError('PLANET_NOT_FOUND', 'One of those worlds no longer exists', 404);
  }
  const seasonIds = new Set(rows.map((world) => world.seasonId));
  if (seasonIds.size !== 1) {
    throw new GameError('CROSS_SEASON', 'Those worlds are in different galaxies', 403);
  }
  await lockSeason(tx, rows[0]!.seasonId);
  const locked: (typeof planets.$inferSelect)[] = [];
  for (const id of unique) {
    const [world] = await tx.select().from(planets).where(eq(planets.id, id)).for('update');
    if (!world) throw new GameError('PLANET_NOT_FOUND', 'One of those worlds no longer exists', 404);
    locked.push(world);
  }
  // Return the rows read under the locks. Controller and resource state may have
  // changed between the discovery query and our turn in the lock queue.
  return new Map(locked.map((world) => [world.id, world]));
}

export const ownedPlanets = (db: Queryable, playerId: string) => db
  .select()
  .from(planets)
  .where(eq(planets.controllerPlayerId, playerId));

export async function ownedPlanet(
  db: Queryable,
  accountId: string,
  planetId: string,
): Promise<CommanderWorld> {
  const commander = await commanderForAccount(db, accountId);
  const [world] = await db
    .select({ id: planets.id, kind: planets.kind, seasonId: planets.seasonId })
    .from(planets)
    .where(and(eq(planets.id, planetId), eq(planets.controllerPlayerId, commander.playerId)))
    .limit(1);
  if (!world || world.kind === 'NEUTRAL') {
    throw new GameError('PLANET_NOT_OWNED', 'You do not control that world', 403);
  }
  if (world.seasonId !== commander.seasonId) {
    throw new GameError('CROSS_SEASON', 'That world is in another galaxy', 403);
  }
  return {
    playerId: commander.playerId,
    seasonId: commander.seasonId,
    planetId: world.id,
    kind: world.kind,
  };
}

export interface ColonyStanding {
  highestCore: number;
  colonies: number;
  reservations: number;
  capacity: number;
}

export async function colonyStanding(tx: Queryable, playerId: string): Promise<ColonyStanding> {
  const controlled = await tx
    .select({ planetId: planets.id, kind: planets.kind })
    .from(planets)
    .where(eq(planets.controllerPlayerId, playerId));
  const ids = controlled.map((world) => world.planetId);
  const [[core], [reserved]] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([{ level: 0 }])
      : tx
          .select({ level: max(buildings.level) })
          .from(buildings)
          .where(and(inArray(buildings.planetId, ids), eq(buildings.type, 'CORE'))),
    tx
      .select({ n: count() })
      .from(missions)
      .where(and(
        eq(missions.ownerPlayerId, playerId),
        eq(missions.status, 'in_flight'),
        or(
          eq(missions.kind, 'settlement'),
          and(eq(missions.kind, 'death_star'), eq(missions.deathStarCapture, true)),
        ),
      )),
  ]);
  const highestCore = core?.level ?? 0;
  return {
    highestCore,
    colonies: controlled.filter((world) => world.kind === 'COLONY').length,
    reservations: reserved?.n ?? 0,
    capacity: colonyCapacity(highestCore),
  };
}

/**
 * Serialize acquisitions on the permanent capital row. Season is locked first,
 * and every caller then locks its target planets in ascending id order.
 */
export async function assertColonyCapacity(
  tx: Tx,
  playerId: string,
  seasonId: string,
): Promise<ColonyStanding> {
  await lockSeason(tx, seasonId);
  const capital = await capitalPlanet(tx, playerId);
  await tx.select({ id: planets.id }).from(planets).where(eq(planets.id, capital.id)).for('update');
  const standing = await colonyStanding(tx, playerId);
  if (standing.colonies + standing.reservations >= standing.capacity) {
    throw new GameError('COLONY_CAP', 'Your Command Core cannot hold another colony', 409, {
      capacity: standing.capacity,
    });
  }
  return standing;
}

export interface TransferControlInput {
  targetPlanetId: string;
  newPlayerId: string;
  expectedControllerPlayerId: string | null;
  now: Date;
  protectedUntil: Date;
}

/**
 * Shared atomic ownership primitive for settlement and the second strategic hit.
 *
 * ONE COMMANDER, ONE GALAXY — ENFORCED HERE, WHERE THE WRITE HAPPENS.
 *
 * The invariant has been stated as "DB-enforced" since D97, and at this seam it
 * was not enforced anywhere. `planets` has a unique index for one capital per
 * player and a check tying `kind` to the controller, and nothing at all saying a
 * colony must be in the same season as its owner — so this primitive would
 * cheerfully hand a commander in one galaxy a world in another.
 *
 * WHAT THAT PRODUCES IS A WORLD THAT EXISTS AND CANNOT BE SEEN. `commanderTopology`
 * joins on `controllerPlayerId` alone, so the cross-season world lands in
 * `planetIds` and appears in `/api/planets` — the worlds list shows it, the world
 * selector offers it. `publicWorlds` filters by the caller's season, so the disc
 * never draws it and every surface built on the galaxy payload behaves as though
 * it does not exist. Found by a dev tool that picked "the nearest unclaimed world"
 * without a season filter; the tool was wrong, and so was the absence of anything
 * here to stop it.
 *
 * Both real callers derive their target from a mission and are almost certainly
 * safe today. That is an argument for the guard being cheap, not for leaving the
 * primitive able to write a state no reader can cope with.
 */
export async function transferPlanetControl(
  tx: Tx,
  input: TransferControlInput,
): Promise<{ previousPlayerId: string | null; planetId: string }> {
  const [pair] = await tx
    .select({ planetSeason: planets.seasonId, playerSeason: players.seasonId })
    .from(planets)
    .innerJoin(players, eq(players.id, input.newPlayerId))
    .where(eq(planets.id, input.targetPlanetId));
  if (!pair) throw new GameError('TARGET_CHANGED', 'That world changed first', 409);
  if (pair.planetSeason !== pair.playerSeason) {
    throw new GameError('WRONG_GALAXY', 'That world is in another galaxy', 409);
  }

  const expected = input.expectedControllerPlayerId === null
    ? isNull(planets.controllerPlayerId)
    : eq(planets.controllerPlayerId, input.expectedControllerPlayerId);
  const rows = await tx
    .update(planets)
    .set({
      controllerPlayerId: input.newPlayerId,
      kind: 'COLONY',
      recoveryUntil: null,
      protectedUntil: input.protectedUntil,
      disruptedUntil: null,
      lastTickAt: input.now,
    })
    .where(and(eq(planets.id, input.targetPlanetId), expected))
    .returning({ id: planets.id });
  if (rows.length === 0) throw new GameError('TARGET_CHANGED', 'That world changed first', 409);

  await tx.delete(neutralPlanetState).where(eq(neutralPlanetState.planetId, input.targetPlanetId));
  await tx
    .update(units)
    .set({ ownerPlayerId: input.newPlayerId })
    .where(and(
      eq(units.planetId, input.targetPlanetId),
      or(eq(units.location, 'home'), eq(units.hull, 'PROSPECTOR')),
    ));
  await refreshSensorEpoch(tx, input.targetPlanetId, input.now);
  return { previousPlayerId: input.expectedControllerPlayerId, planetId: input.targetPlanetId };
}

/** Return destination for an owner whose former home world changed hands. */
export async function safeHomePlanet(
  tx: Queryable,
  ownerPlayerId: string,
  preferredPlanetId: string,
): Promise<string> {
  const [preferred] = await tx
    .select({ id: planets.id })
    .from(planets)
    .where(and(eq(planets.id, preferredPlanetId), eq(planets.controllerPlayerId, ownerPlayerId)));
  return preferred?.id ?? (await capitalPlanet(tx, ownerPlayerId)).id;
}

/** The API needs a transaction-safe list and does not trust arbitrary ids. */
export async function planetsForAccount(db: Db, accountId: string, _clock: Clock) {
  const commander = await commanderForAccount(db, accountId);
  const worlds = await ownedPlanets(db, commander.playerId);
  return {
    playerId: commander.playerId,
    seasonId: commander.seasonId,
    capitalPlanetId: worlds.find((world) => world.kind === 'CAPITAL')?.id ?? null,
    planets: worlds,
  };
}
