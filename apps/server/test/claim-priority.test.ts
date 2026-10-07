import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  GALAXY,
  MULTI_WORLD,
  SERVERS,
  SETTLEMENT_CLAIM_MINUTES,
  SETTLEMENT_PRIORITY_MINUTES,
  distance,
  fleetTravelExact,
} from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { FixedClock, addMinutes } from '../src/clock.js';
import { galaxyEvents, missions, neutralPlanetState, planets, units } from '../src/db/schema.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { launchAttack } from '../src/services/mission.js';
import { launchSettlement } from '../src/services/movement.js';
import { techOf } from '../src/services/researchState.js';
import { createSeason } from '../src/services/season.js';
import { EventWorker } from '../src/worker/loop.js';
import { galaxySchema } from '../../web/src/api/schemas.js';
import { giveUnits, joinSettled, makeAccount, setLevel, testDb, testEnv, truncateAll } from './helpers.js';

/**
 * THE RAIDER'S FIRST HOUR. Owner decision, 2026-10-07: "bir koloniye birisi saldırıp,
 * koloninin durumunu HAK AÇIK hale getirirse -> ilk 60dk sadece o kişi koloniyi
 * elegeçirebilir olsun" — a commander who broke the guard was losing the world to a
 * stranger's Couriers before their own could land.
 *
 * Owner answers, same day: the window stays ninety minutes (sixty theirs, thirty everyone's);
 * a raider with no free colony slot reserves nothing, or they could lock worlds they can
 * never take; and the rule is about LANDING — anybody may leave early and land as the hour ends.
 */

const silent = pino({ level: 'silent' });
const COLONY_CORE = MULTI_WORLD.colonyCoreThresholds[0];
const SETTLERS = { COURIER: MULTI_WORLD.settlement.transports } as const;
const TARGET_AT = { x: 150, y: 0, z: 0 };

const workerFor = (db: Awaited<ReturnType<typeof testDb>>['db'], clock: FixedClock) =>
  new EventWorker(db, clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

async function setup() {
  const { db } = await testDb();
  await truncateAll(db);
  const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
  const { season } = await createSeason(db, {
    shardCode: 'EU-CLAIM',
    seed: 91273,
    startsAt: clock.now(),
    playerCap: SERVERS.capacity,
    rulesetVersion: MULTI_WORLD.rulesetVersion,
  });
  const join = async (name: string, at: { x: number; y: number; z: number }) => {
    const account = await makeAccount(db, name);
    const joined = await joinSettled(db, account.id, season.id, clock);
    await db.update(planets).set({ ...at, alloy: 10_000, crystal: 5_000, deuterium: 10_000 })
      .where(eq(planets.id, joined.planetId));
    await setLevel(db, joined.planetId, 'CORE', COLONY_CORE);
    await giveUnits(db, joined.planetId, SETTLERS);
    return { ...joined, accountId: account.id, username: account.username, at };
  };
  const raider = await join('Raider', { x: 0, y: 0, z: 0 });
  const rival = await join('Rival', { x: 300, y: 0, z: 0 });
  const [neutral] = await db
    .select({ id: planets.id })
    .from(planets)
    .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
    .where(eq(neutralPlanetState.tier, 1))
    .limit(1);
  if (!neutral) throw new Error('fixture season has no tier 1 world');
  // A fallen guard: tier 1 never re-arms (D209), so every raid below is a walkover.
  await db.delete(units).where(eq(units.planetId, neutral.id));
  await db.update(planets).set(TARGET_AT).where(eq(planets.id, neutral.id));

  const stateOf = async () => {
    const [state] = await db.select().from(neutralPlanetState)
      .where(eq(neutralPlanetState.planetId, neutral.id));
    return state;
  };

  /** One whole raid: out, decisive, and home again. Returns the instant the battle was judged. */
  const raid = async (by: { planetId: string; playerId: string }) => {
    await giveUnits(db, by.planetId, { DART: 1 });
    const away = await launchAttack(db, by.planetId, neutral.id, { DART: 1 }, clock);
    clock.set(new Date(away.arriveAt.getTime() + 11_000));
    await workerFor(db, clock).tick();
    const judgedAt = clock.now();
    const [home] = await db.select().from(missions).where(and(
      eq(missions.ownerPlayerId, by.playerId),
      eq(missions.kind, 'return'),
      eq(missions.status, 'in_flight'),
    ));
    if (home) {
      clock.set(home.arriveAt);
      await workerFor(db, clock).tick();
    }
    return judgedAt;
  };

  const settle = (by: { planetId: string; playerId: string }) =>
    launchSettlement(db, by.playerId, by.planetId, neutral.id, clock);

  const controllerOf = async () => {
    const [world] = await db.select().from(planets).where(eq(planets.id, neutral.id));
    return world?.controllerPlayerId ?? null;
  };

  return { db, clock, season, raider, rival, targetId: neutral.id, stateOf, raid, settle, controllerOf };
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the first hour of a claim belongs to the raider who opened it', () => {
  it('opens the claim with its first hour reserved for the commander whose raid broke the guard', async () => {
    const f = await setup();
    const at = await f.raid(f.raider);

    const state = await f.stateOf();
    expect(state?.claimUntil?.getTime()).toBe(at.getTime() + SETTLEMENT_CLAIM_MINUTES * 60_000);
    expect(state?.claimPriorityPlayerId).toBe(f.raider.playerId);
    expect(state?.claimPriorityUntil?.getTime()).toBe(at.getTime() + SETTLEMENT_PRIORITY_MINUTES * 60_000);
  });

  it('reserves nothing for a raider with no free colony slot', async () => {
    const f = await setup();
    await setLevel(f.db, f.raider.planetId, 'CORE', COLONY_CORE - 1);
    await f.raid(f.raider);

    const state = await f.stateOf();
    expect(state?.claimUntil).not.toBeNull();
    expect(state?.claimPriorityPlayerId).toBeNull();
    expect(state?.claimPriorityUntil).toBeNull();
    // And so the race is everyone's from its first minute.
    const launched = await f.settle(f.rival);
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    expect(await f.controllerOf()).toBe(f.rival.playerId);
  });

  it('refuses a rival whose Couriers would land inside the hour, and lets the raider take the world', async () => {
    const f = await setup();
    await f.raid(f.raider);
    const state = await f.stateOf();

    await expect(f.settle(f.rival)).rejects.toMatchObject({
      code: 'CLAIM_PRIORITY',
      status: 409,
      params: { priorityUntil: state!.claimPriorityUntil!.toISOString() },
    });
    // The refusal spent nothing.
    const [untouched] = await f.db.select().from(planets).where(eq(planets.id, f.rival.planetId));
    expect(untouched).toMatchObject({ alloy: 10_000, crystal: 5_000 });

    const launched = await f.settle(f.raider);
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    expect(await f.controllerOf()).toBe(f.raider.playerId);
  });

  it('lets a rival leave early when their Couriers land exactly as the hour ends', async () => {
    const f = await setup();
    await f.raid(f.raider);
    const now = f.clock.now();
    const oneWay = fleetTravelExact(
      distance(f.rival.at, TARGET_AT), SETTLERS, { boost: 1, tech: await techOf(f.db, f.rival.playerId) },
    );
    const landing = addMinutes(now, oneWay);

    // One millisecond inside the hour is inside it.
    await f.db.update(neutralPlanetState).set({ claimPriorityUntil: new Date(landing.getTime() + 1) })
      .where(eq(neutralPlanetState.planetId, f.targetId));
    await expect(f.settle(f.rival)).rejects.toMatchObject({ code: 'CLAIM_PRIORITY' });

    // Landing on the hour's last instant is landing after it.
    await f.db.update(neutralPlanetState).set({ claimPriorityUntil: landing })
      .where(eq(neutralPlanetState.planetId, f.targetId));
    const launched = await f.settle(f.rival);
    expect(launched.arriveAt.getTime()).toBe(landing.getTime());
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    expect(await f.controllerOf()).toBe(f.rival.playerId);
  });

  it('opens the race to everyone once the hour has passed', async () => {
    const f = await setup();
    await f.raid(f.raider);
    const state = await f.stateOf();
    f.clock.set(new Date(state!.claimPriorityUntil!.getTime() + 60_000));

    const launched = await f.settle(f.rival);
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    expect(await f.controllerOf()).toBe(f.rival.playerId);
  });

  /**
   * D112 kept: a raid on a LIVE claim changes nothing, so it cannot take the hour either.
   * A commander who breaks the guard again after the window closed opens a fresh one,
   * and the hour is theirs.
   */
  it('keeps the hour with whoever opened the claim, until a closed one is reopened', async () => {
    const f = await setup();
    await f.raid(f.raider);
    const opened = await f.stateOf();

    await f.raid(f.rival);
    const after = await f.stateOf();
    expect(after?.claimPriorityPlayerId).toBe(f.raider.playerId);
    expect(after?.claimPriorityUntil?.getTime()).toBe(opened!.claimPriorityUntil!.getTime());

    f.clock.set(new Date(opened!.claimUntil!.getTime() + 60_000));
    const reopenedAt = await f.raid(f.rival);
    const reopened = await f.stateOf();
    expect(reopened?.claimPriorityPlayerId).toBe(f.rival.playerId);
    expect(reopened?.claimPriorityUntil?.getTime())
      .toBe(reopenedAt.getTime() + SETTLEMENT_PRIORITY_MINUTES * 60_000);
  });

  /**
   * WHERE THE WORLD CHANGES HANDS, THE RULE IS CHECKED AGAIN. The launch refusal is the one
   * a commander meets; this is the one ownership depends on, so no path that ever puts a
   * stranger's Couriers down inside the hour can hand them the world.
   */
  it('turns back a stranger\'s settlement that lands inside someone else\'s hour', async () => {
    const f = await setup();
    await f.db.update(neutralPlanetState)
      .set({ claimUntil: addMinutes(f.clock.now(), 30) })
      .where(eq(neutralPlanetState.planetId, f.targetId));
    const launched = await f.settle(f.rival);
    await f.db.update(neutralPlanetState).set({
      claimPriorityPlayerId: f.raider.playerId,
      claimPriorityUntil: addMinutes(launched.arriveAt, 1),
    }).where(eq(neutralPlanetState.planetId, f.targetId));

    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    expect(await f.controllerOf()).toBeNull();
    const [turned] = await f.db.select().from(missions).where(and(
      eq(missions.ownerPlayerId, f.rival.playerId),
      eq(missions.kind, 'transfer'),
      eq(missions.status, 'in_flight'),
    ));
    expect(turned).toBeDefined();
  });

  /**
   * TWO GUARDS BROKEN AT ONCE OPEN ONE CLAIM, AND ITS HOUR HAS ONE OWNER. Two workers judge
   * two decisive raids on the same world in the same instant; the guarded update lets exactly
   * one of them open the window, and the hour is written with it, never beside it.
   */
  it('gives the hour to exactly one raider when two guards fall in the same instant', async () => {
    const f = await setup();
    await giveUnits(f.db, f.raider.planetId, { DART: 1 });
    await giveUnits(f.db, f.rival.planetId, { DART: 1 });
    const [left, right] = await Promise.all([
      launchAttack(f.db, f.raider.planetId, f.targetId, { DART: 1 }, f.clock),
      launchAttack(f.db, f.rival.planetId, f.targetId, { DART: 1 }, f.clock),
    ]);
    expect(left.arriveAt.getTime()).toBe(right.arriveAt.getTime());
    f.clock.set(new Date(left.arriveAt.getTime() + 11_000));
    await Promise.all([workerFor(f.db, f.clock).tick(), workerFor(f.db, f.clock).tick()]);
    await workerFor(f.db, f.clock).tick();

    const state = await f.stateOf();
    expect([f.raider.playerId, f.rival.playerId]).toContain(state?.claimPriorityPlayerId);
    expect(state!.claimUntil!.getTime() - state!.claimPriorityUntil!.getTime())
      .toBe((SETTLEMENT_CLAIM_MINUTES - SETTLEMENT_PRIORITY_MINUTES) * 60_000);
    const opened = await f.db.select().from(galaxyEvents).where(and(
      eq(galaxyEvents.kind, 'neutral_claim'), eq(galaxyEvents.subjectPlanetId, f.targetId),
    ));
    expect(opened).toHaveLength(1);
  });

  /**
   * A SEAT THAT IS GONE HOLDS NOTHING. Deleting an account removes its player row; the column
   * is SET NULL by the database and the hour goes with it. Nobody may be held back by a raider
   * who no longer exists — and nobody may be TOLD they are, or the map refuses what the
   * server allows.
   */
  it('opens the hour to everyone once the raider\'s account is deleted', async () => {
    const f = await setup();
    await f.raid(f.raider);
    await deleteAccount(f.db, f.clock, f.raider.username);

    const state = await f.stateOf();
    expect(state?.claimPriorityPlayerId).toBeNull();
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const response = await built.app.inject({
        method: 'GET', url: '/api/galaxy',
        headers: { authorization: `Bearer ${await tokens.issueAccess(f.rival.accountId)}` },
      });
      const world = galaxySchema.parse(response.json()).planets.find((planet) => planet.id === f.targetId);
      expect(world?.neutral?.claimUntil).not.toBeNull();
      expect(world?.neutral?.claimPriorityUntil ?? null).toBeNull();
    } finally {
      await built.close();
    }
    const launched = await f.settle(f.rival);
    f.clock.set(launched.arriveAt);
    await workerFor(f.db, f.clock).tick();
    expect(await f.controllerOf()).toBe(f.rival.playerId);
  });

  /**
   * THE CLOCK IS PUBLIC, THE NAME IS NOT. Every commander needs to know when they may land,
   * fogged world or not; only the raider is told the hour is theirs, and nobody is sent the
   * raider's identity — the Chronicle never named them either.
   */
  it('tells every commander when the hour ends, and only the raider that it is theirs', async () => {
    const f = await setup();
    await f.db.update(planets).set({ x: -GALAXY.radius, y: 0, z: 0 }).where(eq(planets.id, f.rival.planetId));
    await f.raid(f.raider);
    const state = await f.stateOf();
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const galaxyFor = async (accountId: string) => {
        const response = await built.app.inject({
          method: 'GET', url: '/api/galaxy',
          headers: { authorization: `Bearer ${await tokens.issueAccess(accountId)}` },
        });
        expect(response.statusCode).toBe(200);
        const body: unknown = response.json();
        const parsed = galaxySchema.parse(body);
        const row = z.object({ planets: z.array(z.object({ id: z.string() }).passthrough()) }).parse(body)
          .planets.find((planet) => planet.id === f.targetId);
        return { raw: JSON.stringify(row), world: parsed.planets.find((planet) => planet.id === f.targetId) };
      };

      const mine = await galaxyFor(f.raider.accountId);
      expect(mine.world?.neutral?.claimPriorityUntil?.getTime()).toBe(state!.claimPriorityUntil!.getTime());
      expect(mine.world?.claimPriorityMine).toBe(true);

      const theirs = await galaxyFor(f.rival.accountId);
      expect(theirs.world?.intel).toBe('UNKNOWN');
      expect(theirs.world?.neutral?.claimPriorityUntil?.getTime()).toBe(state!.claimPriorityUntil!.getTime());
      expect(theirs.world?.claimPriorityMine).toBeUndefined();
      expect(theirs.raw).not.toContain(f.raider.playerId);
    } finally {
      await built.close();
    }
  });
});
