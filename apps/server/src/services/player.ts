import { eq } from 'drizzle-orm';
import { pickSpawnSlot } from '@blindspace/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { accounts, buildings, planets, players, seasons, shards, units } from '../db/schema.js';
import { galaxyOf, occupiedSlots } from './season.js';
import { GameError, recomputeWealth } from './planet.js';

const STARTING_BUILDINGS = [
  { type: 'CORE', level: 1 },
  { type: 'REFINERY', level: 1 },
  { type: 'EXTRACTOR', level: 1 },
  { type: 'VAULT', level: 0 },
  { type: 'SHIPYARD', level: 0 },
  { type: 'RING', level: 0 },
];

/** Session one contains three concepts: planet, fleet, attack. Twelve Wasps is the fleet. */
const STARTING_FLEET = { WASP: 12 } as const;

const NAMES = [
  'Kestrel', 'Vantage', 'Halcyon', 'Tessellate', 'Orrery', 'Bellwether',
  'Cinder', 'Lodestar', 'Quillon', 'Marrow', 'Vesper', 'Thistle',
];

export interface JoinResult {
  playerId: string;
  planetId: string;
  slotIndex: number;
}

/**
 * Place a new player.
 *
 * Two players joining simultaneously can pick the same free slot; the unique
 * index on (season_id, slot_index) rejects the loser, who simply retries against
 * the now-smaller set of free slots.
 */
export async function joinSeason(
  db: Db,
  accountId: string,
  seasonId: string,
  clock: Clock,
  attempt = 0,
): Promise<JoinResult> {
  const existing = await db
    .select({ player: players, planet: planets })
    .from(players)
    .innerJoin(planets, eq(planets.playerId, players.id))
    .where(eq(players.accountId, accountId))
    .limit(1);
  const found = existing.find((r) => r.player.seasonId === seasonId);
  if (found) {
    return {
      playerId: found.player.id,
      planetId: found.planet.id,
      slotIndex: found.planet.slotIndex,
    };
  }

  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  const [shard] = await db.select().from(shards).where(eq(shards.id, season.shardId));

  const spec = galaxyOf(seasonId, season.seed, shard!.playerCap);
  const taken = await occupiedSlots(db, seasonId);
  if (taken.size >= shard!.playerCap) {
    throw new GameError('SHARD_FULL', 'This galaxy is full', 409);
  }

  const slot = pickSpawnSlot(spec.slots, taken);
  if (!slot) throw new GameError('SHARD_FULL', 'This galaxy is full', 409);

  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  const now = clock.now();

  try {
    return await db.transaction(async (tx) => {
      const [player] = await tx
        .insert(players)
        .values({
          accountId,
          seasonId,
          name: account?.displayName ?? 'Commander',
          joinedAt: now,
          lastSeenAt: now,
        })
        .returning();

      const planetName = `${NAMES[slot.index % NAMES.length]}-${slot.index}`;
      const [planet] = await tx
        .insert(planets)
        .values({
          playerId: player!.id,
          seasonId,
          name: planetName,
          slotIndex: slot.index,
          x: slot.x, y: slot.y, z: slot.z,
          lastTickAt: now,
        })
        .returning();

      await tx
        .insert(buildings)
        .values(STARTING_BUILDINGS.map((b) => ({ planetId: planet!.id, ...b })));

      await tx.insert(units).values(
        Object.entries(STARTING_FLEET).map(([hull, count]) => ({
          planetId: planet!.id,
          hull: hull as 'WASP',
          location: 'home',
          count,
        })),
      );

      // Without this a fresh commander's Wealth stays at the column default of
      // zero, and the rank floor then protects them from every attacker forever.
      await recomputeWealth(tx, planet!.id);

      return { playerId: player!.id, planetId: planet!.id, slotIndex: slot.index };
    });
  } catch (err) {
    // Lost the race for this slot. Retry against the smaller free set.
    if (attempt < 5) return joinSeason(db, accountId, seasonId, clock, attempt + 1);
    throw err;
  }
}

export async function touchLastSeen(db: Db, playerId: string, clock: Clock): Promise<void> {
  await db.update(players).set({ lastSeenAt: clock.now() }).where(eq(players.id, playerId));
}
