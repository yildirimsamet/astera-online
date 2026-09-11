import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { MULTI_WORLD, SERVERS, generateGalaxy, rewardId, selectNeutralSlots } from '@astera/rules';
import {
  accountRewards,
  accounts,
  announcementReads,
  announcements,
  battleReports,
  botProfiles,
  buildings,
  commanderTransfers,
  missions,
  neutralPlanetState,
  notifications,
  planets,
  players,
  researchOrders,
  returnApplications,
  scheduledEvents,
  seasons,
  units,
  watches,
} from '../src/db/schema.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { launchAttack } from '../src/services/mission.js';
import { grantReward } from '../src/services/rewards.js';
import { GameError } from '../src/services/planet.js';
import { EventWorker } from '../src/worker/loop.js';
import { createSeason } from '../src/services/season.js';
/*
  A COMMANDER JOINED IN THIS FILE IS A SETTLED ONE. D183 — `joinSeason` stamps a day
  of newcomer shield on everybody, and this file's fixture needs raids to fly.
*/
import { joinSettled as joinSeason } from './helpers.js';
import { FixedClock } from '../src/clock.js';
import {
  TEST_SPACING,
  fuelUp,
  giveUnits,
  grant,
  levelWorld,
  makeAccount,
  placeAt,
  settledAt,
  testDb,
  truncateAll,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const SEED = 91_273;

/**
 * A GALAXY WITH CARETAKER WORLDS IN IT, which is the only kind this file is about.
 *
 * `seedWorld` opens a ruleset-v1 season and v1 predates multi-world, so it has no
 * neutrals to capture and none to give back. Production runs v4. The colony half
 * of this command cannot be tested against a galaxy that has no colonies in it.
 */
async function setup() {
  const { db } = await testDb();
  await truncateAll(db);
  const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
  const { season } = await createSeason(db, {
    shardCode: 'EU-DELETE',
    seed: SEED,
    startsAt: clock.now(),
    playerCap: SERVERS.capacity,
    rulesetVersion: MULTI_WORLD.rulesetVersion,
  });
  const accountIds: string[] = [];
  const playerIds: string[] = [];
  const planetIds: string[] = [];
  for (let i = 0; i < 2; i += 1) {
    const account = await makeAccount(db, `Tester${String(i)}`);
    const joined = await joinSeason(db, account.id, season.id, clock);
    accountIds.push(account.id);
    playerIds.push(joined.playerId);
    planetIds.push(joined.planetId);
    // Neighbours rather than antipodes, exactly as `seedWorld` arranges them.
    await placeAt(db, joined.planetId, { x: i * TEST_SPACING });
  }
  return { db, clock, seasonId: season.id, seed: SEED, accountIds, playerIds, planetIds };
}

type Fixture = Awaited<ReturnType<typeof setup>>;

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * DELETING A PERSON AT THEIR OWN REQUEST.
 *
 * The one operation `reclaim` deliberately stops short of. A reclaim takes the
 * SEASON PRESENCE and keeps the account, because the commander is expected back;
 * this takes the person too, because they asked to be forgotten. What a world
 * CONSISTS of is the same question in both, so this runs through the same
 * `commanderRows`/`busy`/`demolish` trio rather than forming a second opinion —
 * the reason those three exist as one set is that a sweep which checks a
 * different set from the one it deletes can delete something it never checked was
 * quiet, and this project has stranded a real player's fleet that way once.
 *
 * TWO THINGS ARE DIFFERENT, AND BOTH ARE TESTED HERE:
 *
 *   1. A CAPTURED COLONY GOES BACK TO BEING A CARETAKER WORLD. The galaxy is
 *      seeded with exactly 51 of them and `docs/deployment.md` accepts a live
 *      shard on `neutrals + colonies = 51`. A colony deleted outright is a world
 *      that has LEFT the galaxy: one fewer thing to fight over for the rest of the
 *      season, and that acceptance permanently red. So the address is re-seeded
 *      from the same generator the season was born from — same slot, same tier,
 *      same profile seed, same name.
 *   2. THE ACCOUNT ROW GOES, and with it the once-and-for-ever ledger a reclaim
 *      protects. `account_rewards` survives a reclaim because the person is coming
 *      back. It cannot survive the person.
 */
describe('deleting an account at the player’s request', () => {
  let f: Fixture;
  let leaver: string;
  let leaverPlayer: string;
  let leaverAccount: string;
  let neighbour: string;
  let username: string;
  let displayName: string;

  beforeEach(async () => {
    f = await setup();
    leaver = f.planetIds[0]!;
    leaverPlayer = f.playerIds[0]!;
    leaverAccount = f.accountIds[0]!;
    neighbour = f.planetIds[1]!;
    const [account] = await f.db.select().from(accounts).where(eq(accounts.id, leaverAccount));
    username = account!.username;
    displayName = account!.displayName;
  });

  /** Fly everything in the air to its end, however many legs that takes. */
  const drain = async () => {
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);
    for (let i = 0; i < 8; i += 1) {
      const [next] = await f.db
        .select().from(missions).where(eq(missions.status, 'in_flight'))
        .orderBy(missions.arriveAt).limit(1);
      if (!next) return;
      f.clock.set(settledAt(next.arriveAt));
      await worker.tick();
      await worker.tick();
    }
    throw new Error('missions never stopped arriving — the fixture is looping');
  };

  /** The caretaker world at a given tier, before anybody has taken it. */
  const neutralAt = async (tier: 1 | 2 | 3) => {
    const [row] = await f.db
      .select({ id: planets.id, slotIndex: planets.slotIndex, name: planets.name, x: planets.x, y: planets.y, z: planets.z })
      .from(planets)
      .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
      .where(and(eq(planets.seasonId, f.seasonId), eq(neutralPlanetState.tier, tier)))
      .orderBy(planets.slotIndex)
      .limit(1);
    if (!row) throw new Error(`no tier ${String(tier)} neutral in the fixture`);
    return row;
  };

  /** Hand the leaver a caretaker world through the door a settlement uses. */
  const capture = async (tier: 1 | 2 | 3) => {
    const world = await neutralAt(tier);
    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: world.id,
      newPlayerId: leaverPlayer,
      expectedControllerPlayerId: null,
      protectedUntil: f.clock.now(),
      now: f.clock.now(),
    }));
    return world;
  };

  const worldCount = async () =>
    (await f.db.select({ id: planets.id }).from(planets).where(eq(planets.seasonId, f.seasonId))).length;

  /**
   * THE ACCEPTANCE QUERY FROM `docs/deployment.md`, ASKED OF THE FIXTURE.
   *
   * *"Require `neutrals + colonies = 51` per live shard."* A fresh galaxy satisfies
   * it at 51/0 and a played one at 28/23; what may never change is the sum.
   */
  const caretakerPool = async () => {
    const rows = await f.db
      .select({ kind: planets.kind }).from(planets).where(eq(planets.seasonId, f.seasonId));
    return rows.filter((r) => r.kind === 'NEUTRAL' || r.kind === 'COLONY').length;
  };

  /* ── what it takes ─────────────────────────────────────────── */

  it('takes the commander, the account and the capital', async () => {
    await grant(f.db, leaver, 20_000, 8_000);
    await giveUnits(f.db, leaver, { DART: 3 });
    await f.db.insert(notifications).values({
      playerId: leaverPlayer, kind: 'unlock', payload: { what: 'TELESCOPE' },
    });

    const result = await deleteAccount(f.db, f.clock, username);

    expect(result.worldsRemoved).toHaveLength(1);
    expect(result.account).toBe(displayName);
    expect(await f.db.select().from(players).where(eq(players.id, leaverPlayer))).toHaveLength(0);
    expect(await f.db.select().from(accounts).where(eq(accounts.id, leaverAccount))).toHaveLength(0);
    expect(await f.db.select().from(planets).where(eq(planets.id, leaver))).toHaveLength(0);
    expect(await f.db.select().from(units).where(eq(units.planetId, leaver))).toHaveLength(0);
    expect(await f.db.select().from(buildings).where(eq(buildings.planetId, leaver))).toHaveLength(0);
    expect(
      await f.db.select().from(notifications).where(eq(notifications.playerId, leaverPlayer)),
    ).toHaveLength(0);
  });

  it('finds the commander by display name as well as by login', async () => {
    await deleteAccount(f.db, f.clock, displayName);
    expect(await f.db.select().from(accounts).where(eq(accounts.id, leaverAccount))).toHaveLength(0);
  });

  it('frees the login for whoever wants it next', async () => {
    await deleteAccount(f.db, f.clock, username);
    const [reused] = await f.db
      .insert(accounts)
      .values({ username, passwordHash: 'not-a-real-hash', displayName: 'Somebody Else' })
      .returning();
    expect(reused).toBeDefined();
  });

  /** An account between galaxies is still a person, and still deletable. */
  it('deletes an account that holds no world at all', async () => {
    const spare = await makeAccount(f.db, 'Between galaxies');
    await deleteAccount(f.db, f.clock, spare.username);
    expect(await f.db.select().from(accounts).where(eq(accounts.id, spare.id))).toHaveLength(0);
  });

  /* ── what it gives back ────────────────────────────────────── */

  /**
   * THE CONSERVATION `docs/deployment.md` ACCEPTS A LIVE SHARD ON.
   *
   * `neutrals + colonies = 51` per live shard. A colony deleted outright is a
   * world that has left the galaxy, and that query reads red on every deploy for
   * the rest of the season.
   */
  it('gives a captured colony back to the galaxy as a caretaker world', async () => {
    const colony = await capture(3);
    const before = await worldCount();

    const result = await deleteAccount(f.db, f.clock, username);

    expect(result.coloniesReturned).toEqual([colony.name]);
    // One world less — the capital. The colony is not lost, it is handed back.
    expect(await worldCount()).toBe(before - 1);
    expect(await caretakerPool()).toBe(51);

    const [restored] = await f.db
      .select().from(planets)
      .where(and(eq(planets.seasonId, f.seasonId), eq(planets.slotIndex, colony.slotIndex)));
    expect(restored).toBeDefined();
    expect(restored!.id).not.toBe(colony.id);
    expect(restored!.kind).toBe('NEUTRAL');
    expect(restored!.controllerPlayerId).toBeNull();
    // Same address, same name it was born with.
    expect(restored!.name).toBe(colony.name);
    expect(restored!.x).toBe(colony.x);
    expect(restored!.y).toBe(colony.y);
    expect(restored!.z).toBe(colony.z);
  });

  it('re-seeds the returned world from the season’s own generator', async () => {
    const colony = await capture(3);
    const original = selectNeutralSlots(f.seed, generateGalaxy(f.seed, MULTI_WORLD.neutralSlotPool).slots)
      .find((slot) => slot.slot.index === colony.slotIndex);

    await deleteAccount(f.db, f.clock, username);

    const [restored] = await f.db
      .select().from(planets)
      .where(and(eq(planets.seasonId, f.seasonId), eq(planets.slotIndex, colony.slotIndex)));
    const [state] = await f.db
      .select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, restored!.id));

    expect(state).toMatchObject({ tier: 3, claimUntil: null, profileSeed: original!.profileSeed });
    // A caretaker world is a garrison and a stockpile, not an empty address.
    const levels = await f.db.select().from(buildings).where(eq(buildings.planetId, restored!.id));
    expect(Object.fromEntries(levels.map((row) => [row.type, row.level])))
      .toEqual(MULTI_WORLD.neutral[3].buildings);
    expect(await f.db.select().from(units).where(eq(units.planetId, restored!.id))).not.toHaveLength(0);
    expect(restored!.alloy).toBeGreaterThan(0);
    // And its reinforcement clock is running again.
    expect(
      await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.refId, restored!.id)),
    ).not.toHaveLength(0);
  });

  it('keeps both tier pools whole across two captured colonies', async () => {
    const first = await capture(1);
    const second = await capture(3);
    const before = await worldCount();

    const result = await deleteAccount(f.db, f.clock, username);

    expect(result.coloniesReturned.toSorted()).toEqual([first.name, second.name].toSorted());
    expect(await worldCount()).toBe(before - 1);
    expect(await caretakerPool()).toBe(51);
    const tiers = await f.db
      .select({ tier: neutralPlanetState.tier })
      .from(neutralPlanetState)
      .innerJoin(planets, eq(planets.id, neutralPlanetState.planetId))
      .where(eq(planets.seasonId, f.seasonId));
    expect(tiers.filter((r) => r.tier === 1)).toHaveLength(MULTI_WORLD.neutralCounts[1]);
    expect(tiers.filter((r) => r.tier === 3)).toHaveLength(MULTI_WORLD.neutralCounts[3]);
  });

  /**
   * A COLONY AT AN ADDRESS THE GENERATOR NEVER PUT A NEUTRAL AT.
   *
   * Silent Space returns a commander onto a departure site, so a colony can stand
   * on a slot this season's neutral selection does not contain. There is nothing
   * to restore there — re-seeding one would ADD a 52nd world — so the address goes
   * back to being empty space, and the caller is told which ones did.
   */
  it('does not invent a caretaker world at an address that never had one', async () => {
    const [colony] = await f.db.insert(planets).values({
      controllerPlayerId: leaverPlayer, seasonId: f.seasonId, kind: 'COLONY',
      name: 'Off-plan', slotIndex: 999, x: 1500, y: 0, z: 0, lastTickAt: f.clock.now(),
    }).returning();
    const before = await worldCount();

    const result = await deleteAccount(f.db, f.clock, username);

    expect(result.coloniesReturned).toEqual([]);
    // The capital and the off-plan colony both go; nothing takes their place.
    expect(await worldCount()).toBe(before - 2);
    expect(await f.db.select().from(planets).where(eq(planets.id, colony!.id))).toHaveLength(0);
  });

  /* ── what it refuses ───────────────────────────────────────── */

  /**
   * THE REFUSAL THAT COSTS SOMEBODY THEIR FLEET IF IT IS WRONG.
   *
   * The same guard `reclaim` defers on, raised as an error here because this is a
   * command an operator typed rather than a sweep that will come round again.
   */
  it('refuses while anything is still in the air', async () => {
    await grant(f.db, neighbour, 40_000, 16_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, neighbour, { DART: 12 });
    await fuelUp(f.db, neighbour);
    await launchAttack(f.db, neighbour, leaver, { DART: 6 }, f.clock);

    await expect(deleteAccount(f.db, f.clock, username))
      .rejects.toMatchObject({ code: 'WORLD_BUSY' });
    // And nothing was taken while it refused.
    expect(await f.db.select().from(players).where(eq(players.id, leaverPlayer))).toHaveLength(1);
    expect(await f.db.select().from(accounts).where(eq(accounts.id, leaverAccount))).toHaveLength(1);
    expect(await f.db.select().from(planets).where(eq(planets.id, leaver))).toHaveLength(1);
  });

  it('goes through once that raid has flown home', async () => {
    await grant(f.db, neighbour, 40_000, 16_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, neighbour, { DART: 12 });
    await fuelUp(f.db, neighbour);
    await launchAttack(f.db, neighbour, leaver, { DART: 6 }, f.clock);
    await drain();

    await deleteAccount(f.db, f.clock, username);
    expect(await f.db.select().from(planets).where(eq(planets.id, leaver))).toHaveLength(0);
  });

  it('refuses a name nobody answers to', async () => {
    await expect(deleteAccount(f.db, f.clock, 'nobody-by-that-name'))
      .rejects.toBeInstanceOf(GameError);
    await expect(deleteAccount(f.db, f.clock, 'nobody-by-that-name'))
      .rejects.toMatchObject({ code: 'PLAYER_NOT_FOUND' });
  });

  /** A server-played commander is retired through its own roster, never deleted here. */
  it('refuses a commander the server plays', async () => {
    await f.db.insert(botProfiles).values({
      accountId: leaverAccount, ordinal: 0, persona: 'RAIDER',
      nextActionAt: f.clock.now(), createdAt: f.clock.now(),
    });
    await expect(deleteAccount(f.db, f.clock, username))
      .rejects.toMatchObject({ code: 'BOT_ACCOUNT' });
    expect(await f.db.select().from(accounts).where(eq(accounts.id, leaverAccount))).toHaveLength(1);
  });

  /** Global news outlives its author; deleting them would take the announcement with it. */
  it('refuses an account that has authored public news', async () => {
    await f.db.insert(announcements).values({
      authorAccountId: leaverAccount, title: 'Season two',
      bodyHtml: '<p>Soon.</p>', publishedAt: f.clock.now(),
    });
    await expect(deleteAccount(f.db, f.clock, username))
      .rejects.toMatchObject({ code: 'ANNOUNCEMENT_AUTHOR' });
  });

  /**
   * THE CHECK CONSTRAINT THAT WOULD OTHERWISE DECIDE THIS FOR US.
   *
   * `return_applications` keeps terminal history through `on delete set null`, but
   * a QUEUED row may not hold a null player — so deleting the commander under one
   * aborts the transaction with a constraint name instead of a sentence. Refuse in
   * words and let the operator close the application first.
   */
  it('refuses while a return application is still queued', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.insert(returnApplications).values({
      playerId: leaverPlayer, playerIdSnapshot: leaverPlayer,
      cycleId: season!.cycleId, targetShardId: season!.shardId, sequence: 1n,
      status: 'QUEUED', requestedAt: f.clock.now(),
      expiresAt: new Date(f.clock.now().getTime() + 86_400_000), updatedAt: f.clock.now(),
    });
    await expect(deleteAccount(f.db, f.clock, username))
      .rejects.toMatchObject({ code: 'RETURN_QUEUED' });
  });

  /**
   * Silent Space move history is not this command's to take: `main_vacancies`
   * hangs return addresses off it, and somebody else may be queued for one.
   */
  it('refuses an account with Silent Space move history', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.insert(commanderTransfers).values({
      playerId: leaverPlayer, accountId: leaverAccount, cycleId: season!.cycleId,
      sourceSeasonId: f.seasonId, targetSeasonId: f.seasonId,
      fromVersion: 0, toVersion: 1, direction: 'OUT', worlds: [], committedAt: f.clock.now(),
    });
    await expect(deleteAccount(f.db, f.clock, username))
      .rejects.toMatchObject({ code: 'TRANSFER_HISTORY' });
    expect(await f.db.select().from(accounts).where(eq(accounts.id, leaverAccount))).toHaveLength(1);
  });

  /* ── the rows only a deletion reaches ──────────────────────── */

  it('takes the once-and-for-ever ledger a reclaim protects', async () => {
    const [row] = await f.db.select().from(players).where(eq(players.id, leaverPlayer));
    await grantReward(f.db, row!.name, rewardId('SOCIAL', 1));
    const [announcement] = await f.db.insert(announcements).values({
      authorAccountId: f.accountIds[1]!, title: 'Read me',
      bodyHtml: '<p>Hi.</p>', publishedAt: f.clock.now(),
    }).returning();
    await f.db.insert(announcementReads).values({
      accountId: leaverAccount, announcementId: announcement!.id, readAt: f.clock.now(),
    });

    await deleteAccount(f.db, f.clock, username);

    expect(
      await f.db.select().from(accountRewards).where(eq(accountRewards.accountId, leaverAccount)),
    ).toHaveLength(0);
    expect(
      await f.db.select().from(announcementReads).where(eq(announcementReads.accountId, leaverAccount)),
    ).toHaveLength(0);
    // The announcement itself, and its author, are somebody else's and stay.
    expect(await f.db.select().from(announcements)).toHaveLength(1);
    expect(await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[1]!))).toHaveLength(1);
  });

  /**
   * THE GAP `demolish` HAD, AND WHY NOTHING HAS EVER SEEN IT.
   *
   * `research_orders` carries foreign keys to BOTH the commander and the world
   * that funded the project, and neither was swept. The reclaim sweep that shares
   * this function is switched off in production, so the violation has never fired
   * — it would have taken the seat with it when it did.
   */
  it('sweeps the research the commander funded', async () => {
    await f.db.insert(researchOrders).values({
      playerId: leaverPlayer, fundingPlanetId: leaver, slot: 0, projectId: 'STARSHIP_ENGINEERING',
      level: 1, status: 'COMPLETED', startedAt: f.clock.now(), readyAt: f.clock.now(),
      remainingSeconds: 0, cost: { alloy: 100, crystal: 50, deuterium: 0 },
    });
    await deleteAccount(f.db, f.clock, username);
    expect(await f.db.select().from(researchOrders)).toHaveLength(0);
  });

  /**
   * THE SECOND GAP, AND IT ONLY EXISTS BECAUSE WORLDS CHANGE HANDS.
   *
   * A battle at a caretaker world names an attacker and NO defender. Capture that
   * world afterwards and the report points at a planet this deletion removes,
   * through a mission this deletion also removes — while matching neither player
   * key `demolish` swept on.
   */
  it('sweeps a battle fought at a world before this commander took it', async () => {
    await grant(f.db, neighbour, 40_000, 16_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, neighbour, { DART: 8 });
    await fuelUp(f.db, neighbour);
    const target = await neutralAt(1);
    await launchAttack(f.db, neighbour, target.id, { DART: 4 }, f.clock);
    await drain();
    expect(await f.db.select().from(battleReports)).not.toHaveLength(0);

    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: target.id, newPlayerId: leaverPlayer,
      expectedControllerPlayerId: null, protectedUntil: f.clock.now(), now: f.clock.now(),
    }));

    await deleteAccount(f.db, f.clock, username);
    expect(await f.db.select().from(battleReports)).toHaveLength(0);
  });

  /** Somebody else's eyes on a world that stops existing come off it too. */
  it('clears another commander’s watch on the removed world', async () => {
    await f.db.insert(watches).values({
      observerPlayerId: f.playerIds[1]!, observerPlanetId: neighbour, slot: 0, targetPlanetId: leaver,
    });
    await deleteAccount(f.db, f.clock, username);
    expect(await f.db.select().from(watches)).toHaveLength(0);
  });

  it('leaves the rest of the galaxy exactly where it was', async () => {
    const before = await f.db
      .select({ id: planets.id }).from(planets)
      .where(and(eq(planets.seasonId, f.seasonId), isNull(planets.controllerPlayerId)));

    await deleteAccount(f.db, f.clock, username);

    const after = await f.db
      .select({ id: planets.id }).from(planets)
      .where(and(eq(planets.seasonId, f.seasonId), isNull(planets.controllerPlayerId)));
    expect(after).toHaveLength(before.length);
    expect(await f.db.select().from(players).where(eq(players.id, f.playerIds[1]!))).toHaveLength(1);
    expect(await f.db.select().from(planets).where(eq(planets.id, neighbour))).toHaveLength(1);
    expect(await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[1]!))).toHaveLength(1);
  });
});
