import { and, eq } from 'drizzle-orm';
import { BUILDING_IDS, PLANET_START, START_BUILDINGS, pickSpawnSlot } from '@astera/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { accounts, buildings, planets, players, seasons, shards } from '../db/schema.js';
import { galaxyOf, occupiedSlots } from './season.js';
import { GameError, recomputeWealth } from './planet.js';
import { publishShard } from '../stream/bus.js';

/**
 * The rows a fresh planet is written with, from the one table that decides it.
 *
 * `START_BUILDINGS` is in the rules package because the rehearsal shows a visitor
 * this same planet before it exists (D56), and a client that starts a level apart
 * from the server would show a first upgrade the claim then refuses.
 */
const STARTING_BUILDINGS = BUILDING_IDS.map((type) => ({
  type,
  level: START_BUILDINGS[type],
}));

const NAMES = [
  'Kestrel', 'Vantage', 'Halcyon', 'Tessellate', 'Orrery', 'Bellwether',
  'Cinder', 'Lodestar', 'Quillon', 'Marrow', 'Vesper', 'Thistle',
];

/**
 * What the world in a given slot is called.
 *
 * EXPORTED BECAUSE TWO PLACES NAME IT NOW. `joinSeason` names it when the row is
 * written, and `/api/preview` names it before the row exists — the rehearsal shows
 * a visitor the world they are about to be given, by name, and a preview that says
 * `Vesper-31` for a planet that turns out to be `Marrow-31` is the interface
 * contradicting itself at the one moment the player is deciding to trust it.
 * One function, so the two cannot drift.
 */
export const planetNameFor = (slotIndex: number): string =>
  `${NAMES[slotIndex % NAMES.length] ?? 'World'}-${String(slotIndex)}`;

export interface JoinResult {
  playerId: string;
  planetId: string;
  slotIndex: number;
  seasonId: string;
}

/**
 * Two joins raced for the same slot. Thrown to roll the transaction back, caught
 * by the retry loop, and never seen outside this file — which is exactly why it is
 * a class of its own rather than a bare `Error`: a `catch` that retries on
 * *anything* also retries on a bug, and hides it.
 */
class SlotTaken extends Error {}

/**
 * This account acquired a player row while we were building one.
 *
 * Distinct from `SlotTaken` because the answer is the opposite: a lost slot is
 * retried, a lost account race must never be — retrying would lose it again, for
 * the same reason, forever. The winner is read back outside the transaction and
 * decides between "here is your planet" and ALREADY_PLACED.
 */
class PlayerExists extends Error {}

/** How many times a join will re-pick a slot before giving up. */
const MAX_ATTEMPTS = 6;

/**
 * Where this account already stands, if anywhere.
 *
 * The join to `planets` is an inner one on purpose: a player row without a planet
 * is a half-finished join, and treating it as a placement would hand the caller a
 * planet id that does not exist. There is no path that creates one — both rows are
 * written in the same transaction — and this is what keeps that true if one ever
 * appears.
 */
async function readPlacement(db: Db, accountId: string): Promise<JoinResult | null> {
  const [found] = await db
    .select({ player: players, planet: planets })
    .from(players)
    .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
    .where(eq(players.accountId, accountId))
    .limit(1);

  if (!found) return null;
  return {
    playerId: found.player.id,
    planetId: found.planet.id,
    slotIndex: found.planet.slotIndex,
    seasonId: found.player.seasonId,
  };
}

/**
 * Turn an existing placement into either an idempotent success or a refusal.
 *
 * SAME GALAXY IS A SUCCESS. A retried request, a reinstall, or a double-tapped
 * button on a slow phone connection must land on the same planet rather than
 * acquiring a second one or being told off for something it did itself. A
 * DIFFERENT galaxy is the one-commander rule, and the caller has to be told rather
 * than silently redirected — being moved to a galaxy you did not choose is worse
 * than being refused the one you did.
 */
function settle(placement: JoinResult, seasonId: string): JoinResult {
  if (placement.seasonId !== seasonId) {
    throw new GameError('ALREADY_PLACED', 'You already command a planet in another galaxy', 409);
  }
  return placement;
}

/**
 * Place a player on a galaxy.
 *
 * THREE RACES, ALL SETTLED BY THE DATABASE RATHER THAN BY A PRIOR CHECK:
 *
 *   · Two accounts pick the same free slot. `planets_season_slot_idx` rejects the
 *     loser, who re-picks against the now-smaller free set.
 *   · One account joins two galaxies at once from two tabs. `players_account_idx`
 *     rejects the second — this is the one-commander rule, and it is a real race, not
 *     a theoretical one, because a double-tap on a slow connection sends two
 *     requests before either reply lands.
 *   · The final two contenders for one seat join together. Both pass the capacity
 *     read; the slot index then rejects one of them, and the retry finds no free
 *     slot and reports SHARD_FULL.
 *
 * Every one of those is expressed as `onConflictDoNothing` returning no row, so
 * the failure is a value to test and not an exception to classify. Nothing in this
 * file inspects a driver error code.
 */
export async function joinSeason(
  db: Db,
  accountId: string,
  seasonId: string,
  clock: Clock,
): Promise<JoinResult> {
  const existing = await readPlacement(db, accountId);
  if (existing) return settle(existing, seasonId);

  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  const [shard] = await db.select().from(shards).where(eq(shards.id, season.shardId));
  if (!shard) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);

  const spec = galaxyOf(seasonId, season.seed, shard.playerCap);
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  const now = clock.now();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const taken = await occupiedSlots(db, seasonId);
    if (taken.size >= shard.playerCap) {
      throw new GameError('SHARD_FULL', 'This galaxy is full', 409);
    }

    const slot = pickSpawnSlot(spec.slots, taken);
    if (!slot) throw new GameError('SHARD_FULL', 'This galaxy is full', 409);

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
            lastActiveAt: now,
          })
          .onConflictDoNothing({ target: players.accountId })
          .returning();

        if (!player) throw new PlayerExists();

        const planetName = planetNameFor(slot.index);
        const [planet] = await tx
          .insert(planets)
          .values({
            controllerPlayerId: player.id,
            kind: 'CAPITAL',
            seasonId,
            name: planetName,
            slotIndex: slot.index,
            x: slot.x, y: slot.y, z: slot.z,
            /**
             * The opening grant, from the rules package rather than the column
             * default. D22 makes `START` derived arithmetic — exactly the cost of
             * the first four things a commander does — so it has to come from the
             * one place that can be tested against those prices.
             *
             * `PLANET_START` is that arithmetic PLUS the cushion the owner added at
             * D58, because the arithmetic alone is spent to the last crystal by the
             * time onboarding ends and leaves nothing to press.
             */
            alloy: PLANET_START.alloy,
            crystal: PLANET_START.crystal,
            lastTickAt: now,
          })
          .onConflictDoNothing({ target: [planets.seasonId, planets.slotIndex] })
          .returning();

        if (!planet) throw new SlotTaken();

        await tx
          .insert(buildings)
          .values(STARTING_BUILDINGS.map((b) => ({ planetId: planet.id, ...b })));

        /**
         * NO STARTING FLEET. D22.
         *
         * A commander used to be handed twelve Wasps, which answered the only
         * question the opening asks — what do you spend on — before they had a
         * chance to. They are given the alloy for two instead, and whether that
         * alloy becomes ships, production or an instrument is the first real
         * decision in the game.
         *
         * No `units` rows are written at all: a fleet of zero is the absence of
         * rows, and `loadLocked` already reads a missing row as none.
         */

        // Without this a fresh commander's Wealth stays at the column default of
        // zero, and the rank floor then protects them from every attacker forever.
        await recomputeWealth(tx, planet.id);

        // A capital has appeared in the public galaxy and leaderboard. Publish
        // inside the transaction so every API replica invalidates only on commit.
        await publishShard(tx, seasonId, 'world');

        return {
          playerId: player.id,
          planetId: planet.id,
          slotIndex: slot.index,
          seasonId,
        };
      });
    } catch (err) {
      if (err instanceof SlotTaken) continue;
      if (err instanceof PlayerExists) {
        // The other request has committed by the time ON CONFLICT DO NOTHING
        // returns nothing, so the winner is readable now. Whether this is a
        // success or a refusal depends on which galaxy it landed in.
        const winner = await readPlacement(db, accountId);
        if (winner) return settle(winner, seasonId);
        // The winner rolled back after taking the row. Nothing is placed, so the
        // honest thing is to try again rather than to report a planet nobody has.
        continue;
      }
      throw err;
    }
  }

  throw new GameError('SHARD_FULL', 'This galaxy is full', 409);
}

export async function touchLastSeen(db: Db, playerId: string, clock: Clock): Promise<void> {
  await db.update(players).set({ lastSeenAt: clock.now() }).where(eq(players.id, playerId));
}
