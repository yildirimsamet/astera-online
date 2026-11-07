import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { BUILDING_IDS, FIRST_SEASON_START, MULTI_WORLD, PLANET_START, START_BUILDINGS, academyExitCheckpoint, fleetEntries, findRewardTier, newcomerShieldUntil, pickSpawnSlot } from '@astera/rules';
import type { Db, Queryable, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { accounts, buildings, planets, players, seasons, shards, satellites, units, rewardGrants, mainVacancies, returnApplications } from '../db/schema.js';
import { lockAdmission } from './returnQueue.js';
import { galaxyOf } from './season.js';
import { GameError, loadLocked, recomputeWealth } from './planet.js';
import { registerLegacyParticipation } from './legacy.js';
import { placeBuildingUpgrade } from './build.js';
import { publishShard } from '../stream/bus.js';
import { refreshSensorEpoch } from './sensorHistory.js';
import { peopleIn } from './people.js';
import { equipAdminCapital } from './adminCapital.js';
import { ensureUnknownSignalSchedule } from './unknownSignalSchedule.js';
import {
  lockGalaxyEventAudience,
  notifyActiveGalaxyEventsForPlayer,
} from './galaxyEvents.js';
import {
  deliverSeasonRankReward,
  deliveredSeasonRankReward,
  type DeliveredSeasonRankReward,
} from './seasonRankRewards.js';

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
/**
 * THE NUMBER A CAPITAL IS CALLED BY, SCRAMBLED ACROSS EVERY SEATED ADDRESS.
 *
 * People stand on addresses below `capitalSlots` and the server's commanders on the
 * `botSlots` after them, so naming a world by its raw address made every bot a
 * four-digit "10xx" — readable at a glance, which is the one thing the roster may
 * never be (D159). A fixed stride coprime to the reserved range maps it onto itself
 * one-to-one: names stay unique and stable, and a bot's number is drawn from the
 * same spread as everyone else's. Addresses past the range keep their own number.
 */
const NAMED_ADDRESSES = MULTI_WORLD.capitalSlots + MULTI_WORLD.botSlots;
const NAME_STRIDE = 677;
const NAME_OFFSET = 131;
const nameNumber = (slotIndex: number): number =>
  slotIndex >= 0 && slotIndex < NAMED_ADDRESSES
    ? (slotIndex * NAME_STRIDE + NAME_OFFSET) % NAMED_ADDRESSES
    : slotIndex;

export const planetNameFor = (slotIndex: number): string => {
  const number = nameNumber(slotIndex);
  return `${NAMES[number % NAMES.length] ?? 'World'}-${String(number)}`;
};

export interface JoinResult {
  playerId: string;
  planetId: string;
  slotIndex: number;
  seasonId: string;
  /** Present on both the winning response and safe retries after a payout. */
  seasonReward: DeliveredSeasonRankReward | null;
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
export async function readPlacement(db: Queryable, accountId: string): Promise<JoinResult | null> {
  const [found] = await db
    .select({ player: players, planet: planets })
    .from(players)
    .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
    .where(eq(players.accountId, accountId))
    .limit(1);

  if (!found) return null;
  const seasonReward = await deliveredSeasonRankReward(db, accountId, found.player.seasonId);
  return {
    playerId: found.player.id,
    planetId: found.planet.id,
    slotIndex: found.planet.slotIndex,
    seasonId: found.player.seasonId,
    seasonReward,
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

/** Who is taking the seat: a person, or one of the server's own commanders. */
export type JoinSeat = 'COMMANDER' | 'SERVER';

/** Has this account left any receipt of a season? Wipes and seat reclaims keep these. */
async function hasPlayReceipt(q: Queryable, accountId: string): Promise<boolean> {
  const [history] = await q.execute<{ played: boolean }>(sql`
    select exists(select 1 from legacy_participation where account_id = ${accountId})
      or exists(select 1 from season_results where account_id = ${accountId})
      or exists(select 1 from players where account_id = ${accountId})
      or exists(select 1 from accounts where id = ${accountId} and (lifetime -> 'seasons') > '0'::jsonb)
      as played
  `);
  return history?.played !== false;
}

/**
 * HAS THIS ACCOUNT EVER PLAYED? The one question both `joinSeason`'s first-season package and the
 * colony ship's door depend on, so they can never disagree about who is new.
 */
export async function accountHasPlayHistory(q: Queryable, accountId: string): Promise<boolean> {
  const [account] = await q.select({ startedAt: accounts.firstSeasonStartedAt }).from(accounts).where(eq(accounts.id, accountId));
  return account?.startedAt !== null || await hasPlayReceipt(q, accountId);
}

/** Addresses kept for a commander on their way back: held only while someone is queued to come. */
export async function slotsHeldForReturn(q: Queryable, where: { seasonId: string; cycleId: string; shardId: string }, now: Date): Promise<number[]> {
  const [queued] = await q.select({ id: returnApplications.id }).from(returnApplications)
    .where(and(eq(returnApplications.cycleId, where.cycleId), eq(returnApplications.targetShardId, where.shardId),
      eq(returnApplications.status, 'QUEUED'), gt(returnApplications.expiresAt, now))).limit(1);
  if (!queued) return [];
  const reserved = await q.select({ slot: mainVacancies.slotIndex }).from(mainVacancies)
    .where(and(eq(mainVacancies.seasonId, where.seasonId), isNull(mainVacancies.consumedAt)));
  return reserved.map(row => row.slot);
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
 *
 * `seat: 'SERVER'` is the server commander's door. A server commander
 * stands on its own band of addresses (`GALAXY.strata.bot`, the `botSlots` after the
 * capitals), one layer inside the people, and takes the free one furthest from the
 * other bots so the roster scatters all the way round the galaxy. Server seats
 * retain their legacy Academy checkpoint; human first-season gifts are separate.
 */
export async function joinSeason(
  db: Db,
  accountId: string,
  seasonId: string,
  clock: Clock,
  academyStep?: number,
  seat: JoinSeat = 'COMMANDER',
  adminUsernames: ReadonlySet<string> = new Set(),
  /** An address the commander chose (plan §3.8). Gone by now, and they are asked again: it is never swapped for another. */
  preferredSlot?: number,
): Promise<JoinResult> {
  // Validate before even looking for a placement. Only creation consumes it.
  const checkpoint = academyStep === undefined ? null : academyExitCheckpoint(academyStep);
  // Human training never transfers a checkpoint, including requests from old clients.
  const academy = seat === 'SERVER' ? checkpoint : null;
  const existing = await readPlacement(db, accountId);
  if (existing) return settle(existing, seasonId);

  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  const [shard] = await db.select().from(shards).where(eq(shards.id, season.shardId));
  if (!shard) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  if (shard.role !== 'MAIN') {
    throw new GameError('WAITING_JOIN_FORBIDDEN', 'Join an available main galaxy', 403);
  }

  const spec = seat === 'SERVER'
    ? { slots: galaxyOf(seasonId, season.seed, MULTI_WORLD.capitalSlots + MULTI_WORLD.botSlots).slots
      .filter((slot) => slot.index >= MULTI_WORLD.capitalSlots) }
    : galaxyOf(seasonId, season.seed, shard.playerCap);
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        await lockAdmission(tx, season.cycleId, shard.id);
        await lockGalaxyEventAudience(tx, seasonId, 'membership');
        // Read after the audience lock. If a lifecycle transition won the race,
        // backfill is evaluated on its side of the exact boundary, never before it.
        let now = clock.now();
        const [current] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
        if (current?.status !== 'live' || now >= current.endsAt) {
          throw new GameError('SEASON_ENDED', 'This season has ended', 409);
        }
        const occupied = await tx.select({ slot: planets.slotIndex }).from(planets).where(eq(planets.seasonId, seasonId));
        const capitalIndices = new Set(spec.slots.map(row => row.index));
        const taken = new Set(occupied.map(row => row.slot).filter(index => capitalIndices.has(index)));
        for (const held of await slotsHeldForReturn(tx, { seasonId, cycleId: season.cycleId, shardId: shard.id }, now)) taken.add(held);
        const wanted = spec.slots.find(row => row.index === preferredSlot && !taken.has(row.index));
        if (preferredSlot !== undefined && !wanted) throw new GameError('LANDING_GONE', 'That address is no longer open', 409);
        const slot = wanted ?? pickSpawnSlot(spec.slots, taken);
        // The cap is PEOPLE (`people.ts`); a bot's seat is bounded by its own band.
        const full = seat === 'COMMANDER' && await peopleIn(tx, seasonId) >= shard.playerCap;
        if (!slot || full) throw new GameError('SHARD_FULL', 'This galaxy is full', 409);
        await tx.update(mainVacancies).set({ consumedAt: now, consumedReason: 'NEW_JOIN' })
          .where(and(eq(mainVacancies.seasonId, seasonId), eq(mainVacancies.slotIndex, slot.index), isNull(mainVacancies.consumedAt)));

        // The durable receipt is also the account lock across concurrent galaxy joins.
        // A rollback restores eligibility; season wipes and seat reclaim cannot.
        const [joiningAccount] = await tx.select({ startedAt: accounts.firstSeasonStartedAt })
          .from(accounts).where(eq(accounts.id, accountId)).for('update');
        // The account lock can wait beyond the season boundary. Start every
        // entitlement from admission time and leave it available if time ran out.
        now = clock.now();
        if (now >= current.endsAt) throw new GameError('SEASON_ENDED', 'This season has ended', 409);
        // During a rolling release an old replica can still join/reclaim a seat
        // without stamping the new column. Its retained receipt must also count.
        const firstSeason = joiningAccount?.startedAt === null && !(await hasPlayReceipt(tx, accountId));
        if (joiningAccount?.startedAt === null) await tx.update(accounts).set({ firstSeasonStartedAt: now })
          .where(eq(accounts.id, accountId));
        const opening = seat === 'COMMANDER' && firstSeason ? FIRST_SEASON_START : academy;

        // The conditional UPDATE consumes the independent shield entitlement.
        // A failed placement rolls it back; wipes leave the account entitlement consumed.
        const firstGame = seat === 'COMMANDER'
          ? await tx.update(accounts).set({ firstGameShieldAvailable: false })
            .where(and(eq(accounts.id, accountId), eq(accounts.firstGameShieldAvailable, true)))
            .returning({ id: accounts.id })
          : [];

        const [player] = await tx
          .insert(players)
          .values({
            accountId,
            seasonId,
            homeShardId: shard.id,
            mainEnteredAt: now,
            name: account?.displayName ?? 'Commander',
            joinedAt: now,
            lastSeenAt: now,
            lastActiveAt: now,
            // First game: 72h once. Every other season join: the existing 24h.
            // Taking a shot still gives it up after `SHIELD_WOULD_DROP` consent.
            newcomerShieldUntil: new Date(newcomerShieldUntil(now.getTime(), firstGame.length > 0)),
          })
          .onConflictDoNothing({ target: players.accountId })
          .returning();

        if (!player) throw new PlayerExists();
        await registerLegacyParticipation(tx, accountId, seasonId, now);

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
            // Gift resources are net. Only legacy server seats reimburse a queue
            // here before placing that ordinary paid order below.
            alloy: opening ? opening.resources.alloy + (academy?.queue?.cost.alloy ?? 0) : PLANET_START.alloy,
            crystal: opening ? opening.resources.crystal + (academy?.queue?.cost.crystal ?? 0) : PLANET_START.crystal,
            // The starting tank. T6: a world opens able to fly and unable to make
            // more fuel, which is the chain the opening has to teach.
            deuterium: opening ? opening.resources.deuterium + (academy?.queue?.cost.deuterium ?? 0) : PLANET_START.deuterium,
            academyStep: academy ? academyStep ?? null : null,
            builtEver: academy?.builtEver ?? {},
            statsOwnerPlayerId: player.id,
            seasonTelemetry: {
              produced: { alloy: 0, crystal: 0, deuterium: 0 },
              productiveSeconds: 0,
              shipsBuilt: academy?.builtEver ?? {},
            },
            bufferAlloy: opening?.buffer.alloy ?? 0,
            bufferCrystal: opening?.buffer.crystal ?? 0,
            bufferDeuterium: opening?.buffer.deuterium ?? 0,
            lastTickAt: now,
          })
          .onConflictDoNothing({ target: [planets.seasonId, planets.slotIndex] })
          .returning();

        if (!planet) throw new SlotTaken();

        await tx
          .insert(buildings)
          .values(STARTING_BUILDINGS.map((b) => ({ planetId: planet.id, ...b,
            level: opening?.buildings[b.type] ?? b.level })));

        if (opening) {
          const hardware = [
            ...opening.satellites.map((type) => ({ type, level: 1 })),
            ...Object.entries(opening.instruments).filter(([, level]) => level > 0)
              .map(([type, level]) => ({ type, level })),
          ];
          if (hardware.length) await tx.insert(satellites).values(hardware.map((item, slot) => ({
            planetId: planet.id, slot, ...item,
          })));
          const fleet = fleetEntries(opening.fleet);
          if (fleet.length) await tx.insert(units).values(fleet.map(([hull, count]) => ({
            planetId: planet.id, ownerPlayerId: player.id, hull, count, location: 'home',
          })));
          for (const id of academy?.claimedRewards ?? []) {
            const reward = findRewardTier(id);
            if (!reward) throw new Error(`Missing Academy reward ${id}`);
            await tx.insert(rewardGrants).values({ playerId: player.id, rewardId: id,
              ...reward.tier.reward, claimedAt: now });
          }
          if (academy?.queue) {
            // Ordinary paid queue, in this same creation transaction. No instant build.
            await placeBuildingUpgrade(tx, await loadLocked(tx, planet.id, clock), academy.queue.building);
          }
        }

        if (account && adminUsernames.has(account.username)) await equipAdminCapital(tx, planet.id, clock);

        const seasonReward = await deliverSeasonRankReward(tx, {
          accountId,
          targetCycleId: current.cycleId,
          deliveredSeasonId: seasonId,
          planetId: planet.id,
          deliveredAt: now,
        });

        // Without this a fresh commander's Wealth stays at the column default of
        // zero, and the rank floor then protects them from every attacker forever.
        await recomputeWealth(tx, planet.id, clock.now());
        await refreshSensorEpoch(tx, planet.id, now);
        if (seat === 'COMMANDER') await ensureUnknownSignalSchedule(tx, player.id, seasonId, now, false, firstGame.length > 0);
        await notifyActiveGalaxyEventsForPlayer(tx, {
          playerId: player.id,
          seasonId,
          at: now,
        });

        // A capital has appeared in the public galaxy and leaderboard. Publish
        // inside the transaction so every API replica invalidates only on commit.
        await publishShard(tx, seasonId, 'world');

        return {
          playerId: player.id,
          planetId: planet.id,
          slotIndex: slot.index,
          seasonId,
          seasonReward,
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

/**
 * THE TALLEST COMMAND CORE EACH OF THESE COMMANDERS HOLDS. D168.
 *
 * The band `canAttack` enforces is a statement about two PEOPLE, not about the two
 * worlds in a launch, so this is the reading it takes: max Core over everything
 * the commander controls, capital and colonies alike. Owner instruction —
 * *"user'ın tüm gezegenlerinden en yüksek tier'ı seçilir"*.
 *
 * ONE QUERY FOR THE WHOLE LIST, because both sides of a launch are asked at once
 * and this sits on the hot path of every raid. It is a `max` in the database
 * rather than rows fetched and reduced here: a commander with four worlds is four
 * rows, and there is no reason to move them.
 *
 * A COMMANDER WHO HOLDS NOTHING READS 1, NOT `undefined`. `coreTier` floors at 1
 * anyway, but the caller of this feeds arithmetic — a missing entry would arrive
 * as `NaN` inside `Math.abs`, and `NaN <= 1` is false, which would silently
 * become "refuse every launch" rather than an error anyone could see. The same
 * floor covers a world with no CORE row at all.
 *
 * IT IS DELIBERATELY NOT LOCKED. A Core upgrade landing in the same instant as a
 * launch can only move a commander one level, the tier is a three-level bucket,
 * and taking a row lock on the defender's worlds here would introduce exactly the
 * two-planet lock ordering the architecture rules forbid.
 */
export async function peakCoreLevels(
  db: Db | Tx,
  playerIds: readonly string[],
): Promise<Map<string, number>> {
  const peaks = new Map<string, number>();
  if (playerIds.length === 0) return peaks;
  for (const id of playerIds) peaks.set(id, 1);

  const rows = await db
    .select({
      playerId: planets.controllerPlayerId,
      peak: sql<number>`max(${buildings.level})::int`,
    })
    .from(planets)
    .innerJoin(buildings, and(
      eq(buildings.planetId, planets.id),
      eq(buildings.type, 'CORE'),
    ))
    .where(inArray(planets.controllerPlayerId, [...playerIds]))
    .groupBy(planets.controllerPlayerId);

  for (const row of rows) {
    if (row.playerId === null) continue;
    peaks.set(row.playerId, Math.max(1, row.peak));
  }
  return peaks;
}


/**
 * THE TWO ATTACK SHIELDS LIVE IN `attackProtection.ts`.
 *
 * `assertNewcomerShields` stood here while there was one column to read. The
 * 2026-09-14 recovery shield adds a second, and the composition of the two — plus
 * the storage reading and the outbound-raid refusal that decide when one is EARNED
 * — is a subject of its own rather than a paragraph in the join/placement service.
 * `assertAttackProtections` is what `mission.ts` and `strategic.ts` call now.
 */
