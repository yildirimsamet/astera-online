import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVERS } from '@astera/rules';
import {
  accounts,
  battleReports,
  buildings,
  debrisFields,
  miningRuns,
  missions,
  notifications,
  planets,
  players,
  probeReports,
  rewardGrants,
  satellites,
  scheduledEvents,
  units,
  watches,
} from '../src/db/schema.js';
import { idleSeatCount, reclaimIdleSeats } from '../src/services/reclaim.js';
import { launchAttack } from '../src/services/mission.js';
import { claimReward } from '../src/services/rewards.js';
import { EventWorker } from '../src/worker/loop.js';
import { pino } from 'pino';
import {
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * RECLAIMING A SEAT FROM SOMEBODY WHO STOPPED COMING BACK. Owner instruction.
 *
 * THIS IS THE MOST DESTRUCTIVE THING IN THE CODEBASE. Every other sweep repairs;
 * this one deletes a real person's world, and there is no undo but a nightly dump.
 * So the tests are weighted the way the risk is: a handful prove it frees a seat,
 * and the rest prove all the ways it must REFUSE to.
 *
 * The failure that would matter most is the one this project has already caused
 * once on a live galaxy — deleting a mission out from under a fleet, leaving a real
 * player's ships pointing at an id no safety net could reach. That is what the
 * deferral tests are about.
 */
describe('reclaiming idle seats', () => {
  let f: Fixture;
  let idle: string;
  let active: string;
  const DAY = 24 * 60 * 60_000;
  const IDLE_MS = SERVERS.idleDays * DAY;

  /** Push a commander's last sign of life back by `days`. */
  const lastSeen = async (playerId: string, daysAgo: number) => {
    const at = new Date(f.clock.now().getTime() - daysAgo * DAY);
    await f.db
      .update(players)
      .set({ lastActiveAt: at, joinedAt: at })
      .where(eq(players.id, playerId));
  };

  const planetsLeft = async () => (await f.db.select().from(planets)).length;

  /**
   * Fly every mission in the air to its end, however many legs that takes.
   *
   * A RAID IS A ROUND TRIP, and the second half is the part that catches people
   * out here: a return leg is stored with its origin and target SWAPPED, so the
   * flight home from a raid on the idle world still NAMES the idle world. The
   * sweep is right to defer while it is in the air — this drains it so the test
   * can ask about the state after.
   */
  const drain = async () => {
    const worker = new EventWorker(
      f.db,
      f.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5 },
      silent,
    );
    for (let i = 0; i < 8; i += 1) {
      const [next] = await f.db
        .select()
        .from(missions)
        .where(eq(missions.status, 'in_flight'))
        .orderBy(missions.arriveAt)
        .limit(1);
      if (!next) return;
      f.clock.set(settledAt(next.arriveAt));
      await worker.tick();
      await worker.tick();
    }
    throw new Error('missions never stopped arriving — the fixture is looping');
  };
  const gone = async (planetId: string) =>
    (await f.db.select().from(planets).where(eq(planets.id, planetId))).length === 0;

  beforeEach(async () => {
    f = await seedWorld(3);
    idle = f.planetIds[0]!;
    active = f.planetIds[1]!;
    await levelWorld(f.db, f.planetIds);
  });

  /* ── what it frees ─────────────────────────────────────────── */

  it('leaves a galaxy where everybody is still playing completely alone', async () => {
    const before = await planetsLeft();
    const result = await reclaimIdleSeats(f.db, f.clock);
    expect(result).toEqual({ reclaimed: [], deferred: 0, failed: 0 });
    expect(await planetsLeft()).toBe(before);
  });

  it('frees the seat of a commander who has been away past the threshold', async () => {
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);

    const result = await reclaimIdleSeats(f.db, f.clock);
    expect(result.reclaimed).toHaveLength(1);
    expect(await gone(idle)).toBe(true);
    // And nobody else was touched.
    expect(await gone(active)).toBe(false);
  });

  /**
   * THE BOUNDARY, FROM BOTH SIDES. A commander one hour inside the window keeps
   * their world; one hour past it does not. Asserted against the rule's own
   * constant rather than a literal, so moving `idleDays` moves the test with it.
   */
  it('is exact about the threshold', async () => {
    await f.db
      .update(players)
      .set({
        lastActiveAt: new Date(f.clock.now().getTime() - IDLE_MS + 60 * 60_000),
        joinedAt: new Date(f.clock.now().getTime() - 10 * DAY),
      })
      .where(eq(players.id, f.playerIds[0]!));

    expect((await reclaimIdleSeats(f.db, f.clock)).reclaimed).toHaveLength(0);
    expect(await gone(idle)).toBe(false);

    await f.db
      .update(players)
      .set({ lastActiveAt: new Date(f.clock.now().getTime() - IDLE_MS - 60 * 60_000) })
      .where(eq(players.id, f.playerIds[0]!));

    expect((await reclaimIdleSeats(f.db, f.clock)).reclaimed).toHaveLength(1);
    expect(await gone(idle)).toBe(true);
  });

  /**
   * A CLOCK SKEW OR A BAD BACKFILL must not be able to delete somebody who joined
   * an hour ago. `joinedAt` is checked as well, and it is not redundant.
   */
  it('never reclaims a commander who has not been in the galaxy that long', async () => {
    await f.db
      .update(players)
      .set({
        lastActiveAt: new Date(f.clock.now().getTime() - 30 * DAY),
        joinedAt: f.clock.now(),
      })
      .where(eq(players.id, f.playerIds[0]!));

    expect((await reclaimIdleSeats(f.db, f.clock)).reclaimed).toHaveLength(0);
    expect(await gone(idle)).toBe(false);
  });

  /* ── what it refuses to touch ──────────────────────────────── */

  /**
   * THE ONE THAT MATTERS MOST, and it is not hypothetical: deleting a mission out
   * from under a live fleet has happened on this project's own production database
   * once, and it left a real player's Wasps at a `location` naming a mission that
   * no longer existed, where every safety net was blind to them.
   *
   * An idle world is a target, and an ACTIVE commander can have a raid in the air
   * at it right now.
   */
  it('defers a world with somebody else’s raid in the air at it', async () => {
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);
    await grant(f.db, active, 20_000, 8_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, active, { WASP: 10 });
    await launchAttack(f.db, active, idle, { WASP: 4 }, f.clock);

    const result = await reclaimIdleSeats(f.db, f.clock);
    expect(result.reclaimed).toHaveLength(0);
    expect(result.deferred).toBe(1);
    expect(await gone(idle)).toBe(false);

    // The attacker's ships are exactly where they were.
    const away = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, active), eq(units.hull, 'WASP')));
    expect(away.reduce((n, r) => n + r.count, 0)).toBe(10);
  });

  it('reclaims it on a later sweep, once that raid has resolved', async () => {
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);
    await grant(f.db, active, 20_000, 8_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, active, { WASP: 10 });
    const { arriveAt } = await launchAttack(f.db, active, idle, { WASP: 4 }, f.clock);

    expect((await reclaimIdleSeats(f.db, f.clock)).deferred).toBe(1);

    // Let the raid land, fight, and fly all the way home.
    void arriveAt;
    await drain();

    // The idle commander did not come back just because they were raided.
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);
    const result = await reclaimIdleSeats(f.db, f.clock);
    expect(result.reclaimed).toHaveLength(1);
    expect(await gone(idle)).toBe(true);
  });

  /**
   * THE GAP THAT WAS NEARLY SHIPPED, and it is worth stating because it is subtle.
   *
   * Debris sits at the DEFENDER's planet, so a raid the idle commander flew left
   * wreckage at somebody ELSE's world — and `demolish()` has to delete that field,
   * because it points back at a mission about to go. The first draft's `busy()`
   * only looked at debris standing over the idle planet itself, so a third party's
   * harvest run in the air toward that other field would have been deleted out
   * from under its craft: the same stranding this project has already caused once
   * on a live galaxy.
   *
   * `busy()` and `demolish()` read one set now, and this is what holds them to it.
   */
  it('defers when a third party is harvesting wreckage this world’s raid created', async () => {
    await grant(f.db, idle, 40_000, 16_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, idle, { WASP: 12 });
    // Real HULLS on the defending side, not only ground guns: ground units leave
    // no wreckage by design, so a raid that only kills Thorns produces no field.
    await giveUnits(f.db, active, { WASP: 10, THORN: 2 });
    // The idle commander raids a NEIGHBOUR, leaving wreckage over the neighbour.
    await launchAttack(f.db, idle, active, { WASP: 8 }, f.clock);
    await drain();

    const [field] = await f.db.select().from(debrisFields);
    expect(field, 'the fixture produced no wreckage to harvest').toBeDefined();
    expect(field!.planetId).toBe(active);

    // A THIRD commander sends craft to it, and is still on their way.
    await f.db.insert(miningRuns).values({
      seasonId: f.seasonId,
      planetId: f.planetIds[2]!,
      targetKind: 'debris',
      debrisFieldId: field!.id,
      status: 'outbound',
      craft: 2,
      holdEach: 100,
      interceptX: 0,
      interceptY: 0,
      interceptZ: 0,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    });

    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);
    const result = await reclaimIdleSeats(f.db, f.clock);

    expect(result.reclaimed).toHaveLength(0);
    expect(result.deferred).toBe(1);
    expect(await gone(idle)).toBe(false);
    // And the harvest is untouched, which is the whole point.
    expect(await f.db.select().from(miningRuns)).toHaveLength(1);
  });

  it('defers a world whose own craft are still out mining', async () => {
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);
    await f.db.insert(miningRuns).values({
      seasonId: f.seasonId,
      planetId: idle,
      targetKind: 'asteroid',
      asteroidIndex: 2,
      status: 'outbound',
      craft: 1,
      holdEach: 100,
      interceptX: 0,
      interceptY: 0,
      interceptZ: 0,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    });

    expect((await reclaimIdleSeats(f.db, f.clock)).deferred).toBe(1);
    expect(await gone(idle)).toBe(false);
  });

  /**
   * THE RACE THE LOCK EXISTS FOR. The candidate list is read outside any
   * transaction; a commander who opens the game in the seconds between that read
   * and the delete must keep their world.
   */
  it('spares a commander who comes back between the read and the delete', async () => {
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);

    // Simulates `Presence` writing on their first authenticated request.
    let armed = true;
    const transaction = vi.spyOn(f.db, 'transaction');
    transaction.mockImplementationOnce(async (fn) => {
      if (armed) {
        armed = false;
        await f.db
          .update(players)
          .set({ lastActiveAt: f.clock.now() })
          .where(eq(players.id, f.playerIds[0]!));
      }
      return f.db.transaction(fn);
    });

    const result = await reclaimIdleSeats(f.db, f.clock);
    transaction.mockRestore();

    expect(result.reclaimed).toHaveLength(0);
    expect(await gone(idle)).toBe(false);
  });

  /* ── what it takes with it ─────────────────────────────────── */

  /**
   * Every row that could only exist because that planet did. A leftover is not
   * cosmetic: `planets_season_slot_idx` is unique, so a row this misses is a slot
   * that can never be handed to anybody again — the exact opposite of the point.
   */
  it('leaves nothing of the world behind', async () => {
    await grant(f.db, idle, 20_000, 8_000);
    await levelWorld(f.db, f.planetIds);
    await setLevel(f.db, idle, 'CORE', 4);
    await giveUnits(f.db, idle, { WASP: 3 });
    await claimReward(f.db, idle, 'CORE:3', f.clock);
    await f.db.insert(notifications).values({
      playerId: f.playerIds[0]!,
      kind: 'unlock',
      payload: { what: 'TELESCOPE' },
    });
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);

    expect((await reclaimIdleSeats(f.db, f.clock)).reclaimed).toHaveLength(1);

    expect(await f.db.select().from(units).where(eq(units.planetId, idle))).toHaveLength(0);
    expect(await f.db.select().from(buildings).where(eq(buildings.planetId, idle))).toHaveLength(0);
    expect(await f.db.select().from(satellites).where(eq(satellites.planetId, idle))).toHaveLength(0);
    expect(
      await f.db.select().from(rewardGrants).where(eq(rewardGrants.playerId, f.playerIds[0]!)),
    ).toHaveLength(0);
    expect(
      await f.db.select().from(notifications).where(eq(notifications.playerId, f.playerIds[0]!)),
    ).toHaveLength(0);
    expect(await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!))).toHaveLength(0);
  });

  /**
   * A BATTLE LEAVES ROWS AT BOTH ENDS, and the chain that is easy to miss is
   * `mining_runs → debris_fields → missions`. Every foreign key here is `ON DELETE
   * no action`, so a miss is a constraint violation and a world that can never be
   * reclaimed — which is how `wipeAllServers` was once unable to reset any galaxy
   * where a battle had happened.
   */
  it('takes apart a world that has fought, wreckage and reports and all', async () => {
    await grant(f.db, active, 40_000, 16_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, active, { WASP: 12 });
    await giveUnits(f.db, idle, { THORN: 2 });
    await launchAttack(f.db, active, idle, { WASP: 8 }, f.clock);
    await drain();

    // There is genuinely something to trip over.
    expect((await f.db.select().from(battleReports)).length).toBeGreaterThan(0);

    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);
    const result = await reclaimIdleSeats(f.db, f.clock);

    expect(result.failed).toBe(0);
    expect(result.reclaimed).toHaveLength(1);
    expect(await gone(idle)).toBe(true);
    expect(await f.db.select().from(missions)).toHaveLength(0);
    expect(await f.db.select().from(debrisFields).where(eq(debrisFields.planetId, idle))).toHaveLength(0);
    expect(await f.db.select().from(battleReports)).toHaveLength(0);
    // No orphaned planet wake-ups. Galaxy-owned season beats and deadlines must
    // survive reclaiming an individual seat.
    const remainingEvents = await f.db.select().from(scheduledEvents);
    expect(remainingEvents.map((event) => event.kind).sort()).toEqual([
      'season_act',
      'season_act',
      'season_act',
      'season_end',
      'season_rollover',
    ]);
  });

  /** Somebody else's telescope pointed at the world, and their probe report about it. */
  it('clears a watch and a probe report aimed at the reclaimed world', async () => {
    await f.db.insert(watches).values({
      observerPlayerId: f.playerIds[1]!,
      observerPlanetId: f.planetIds[1]!,
      slot: 0,
      targetPlanetId: idle,
    });
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);

    expect((await reclaimIdleSeats(f.db, f.clock)).reclaimed).toHaveLength(1);
    expect(await f.db.select().from(watches)).toHaveLength(0);
    expect(await f.db.select().from(probeReports)).toHaveLength(0);
  });

  /* ── what survives ─────────────────────────────────────────── */

  /**
   * THE ACCOUNT LIVES. Owner decision, and it is the whole reason this is called
   * reclaiming rather than deleting: the commander signs back in, finds no planet,
   * and is taken to the server list to join whatever galaxy is open. Their record
   * folds into the account exactly as a wipe folds it.
   */
  it('keeps the account and folds the season into its permanent record', async () => {
    await f.db
      .update(players)
      .set({ dominionTaken: 900, dominionLost: 200, wealth: 5_000 })
      .where(eq(players.id, f.playerIds[0]!));
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);

    await reclaimIdleSeats(f.db, f.clock);

    const [account] = await f.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, f.accountIds[0]!));
    expect(account).toBeDefined();
    expect(account!.lifetime).toMatchObject({
      seasons: 1,
      dominionTaken: 900,
      dominionLost: 200,
      bestWealth: 5_000,
    });
  });

  /**
   * AND THE SEAT IS ACTUALLY FREE. Not "the row is gone" — the galaxy will hand
   * that place to somebody new, which is the only reason any of this exists.
   */
  it('lets a new commander take the freed seat', async () => {
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);
    const before = await planetsLeft();
    await reclaimIdleSeats(f.db, f.clock);
    expect(await planetsLeft()).toBe(before - 1);

    const { makeAccount } = await import('./helpers.js');
    const { joinSeason } = await import('../src/services/player.js');
    const account = await makeAccount(f.db, 'Newcomer');
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);

    expect(joined.planetId).toBeTruthy();
    expect(await planetsLeft()).toBe(before);
  });

  /* ── reporting ─────────────────────────────────────────────── */

  it('counts what is eligible without touching any of it', async () => {
    expect(await idleSeatCount(f.db, f.clock)).toBe(0);
    await lastSeen(f.playerIds[0]!, SERVERS.idleDays + 1);
    expect(await idleSeatCount(f.db, f.clock)).toBe(1);
    // Counting is a read. Nothing moved.
    expect(await gone(idle)).toBe(false);
  });
});
