import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  MULTI_WORLD,
  SERVERS,
  clanHangarCapacity,
  clanLevelUpgradeCost,
} from '@astera/rules';
import { pino } from 'pino';
import {
  accounts,
  clanTreasuryEvents,
  clans,
  planets,
  players,
  seasons,
} from '../src/db/schema.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  createClan,
  disbandClan,
  leaveClan,
  publicClan,
} from '../src/services/clan.js';
import { donateToClanTreasury, upgradeClanLevel } from '../src/services/clanTreasury.js';
import { readClanWar } from '../src/services/clanWar.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { reclaimIdleSeats } from '../src/services/reclaim.js';
import {
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  testDb,
  testEnv,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const JOINT: number = MULTI_WORLD.clanJointWarRulesetVersion;

async function setup(count = 3, rulesetVersion = JOINT): Promise<Fixture> {
  const fixture = await seedWorld(count, 220920);
  await fixture.db.update(seasons).set({ rulesetVersion })
    .where(eq(seasons.id, fixture.seasonId));
  for (const planetId of fixture.planetIds) {
    await grant(fixture.db, planetId, 400_000, 200_000);
    await setLevel(fixture.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(fixture.db, fixture.planetIds);
  return fixture;
}

async function foundClan(f: Fixture, leaderIndex = 0): Promise<string> {
  const actor = await clanActor(f.db, f.accountIds[leaderIndex]!);
  const result = await f.db.transaction((tx) => createClan(tx, {
    actor,
    name: 'Orion Guard',
    tag: 'OG',
    description: 'Five commanders, one horizon.',
    recruiting: true,
    clock: f.clock,
  }));
  return result.clanId;
}

async function joinClan(f: Fixture, clanId: string, candidateIndex: number): Promise<void> {
  const candidate = await clanActor(f.db, f.accountIds[candidateIndex]!);
  const application = await f.db.transaction((tx) => applyToClan(tx, {
    actor: candidate,
    clanId,
    now: f.clock.now(),
  }));
  const leader = await clanActor(f.db, f.accountIds[0]!);
  await f.db.transaction((tx) => acceptClanRequest(tx, {
    actor: leader,
    requestId: application.requestId,
    acknowledgeHostile: true,
    now: f.clock.now(),
  }));
}

const donate = (
  f: Fixture,
  accountIndex: number,
  planetId: string,
  resources: { alloy: number; crystal: number; deuterium: number },
) => f.db.transaction(async (tx) => {
  const actor = await clanActor(tx, f.accountIds[accountIndex]!);
  return donateToClanTreasury(tx, { actor, planetId, resources, clock: f.clock });
});

const upgrade = (f: Fixture, accountIndex: number, expectedLevel: number) =>
  f.db.transaction(async (tx) => {
    const actor = await clanActor(tx, f.accountIds[accountIndex]!);
    return upgradeClanLevel(tx, { actor, expectedLevel, clock: f.clock });
  });

const fill = async (f: Fixture, clanId: string, level: number): Promise<void> => {
  const cost = clanLevelUpgradeCost(level);
  await f.db.update(clans).set({
    treasuryAlloy: cost.alloy,
    treasuryCrystal: cost.crystal,
    treasuryDeuterium: cost.deuterium,
  }).where(eq(clans.id, clanId));
};

/* ── the opening state ──────────────────────────────────────────── */

describe('a joint-war clan opens at level one with nothing saved', () => {
  it('starts at level 1, an empty purse and the level-1 Klan Hangarı', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    const [row] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(row!.level).toBe(1);
    expect(row!.treasuryAlloy).toBe(0);

    const view = await readClanWar(f.db, await clanActor(f.db, f.accountIds[0]!), f.clock.now());
    expect(view.available).toBe(true);
    expect(view.level).toBe(1);
    expect(view.treasury).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    /*
      TWICE THE PERSONAL RUNG, FOR TWICE THE ROOM. Owner decision, 2026-09-22 — read through
      `clanLevelUpgradeCost` rather than `buildingCost` so the clan ladder's own rule is what this
      asserts, not the personal ladder it is derived from.
    */
    expect(view.nextCost).toEqual(clanLevelUpgradeCost(1));
    expect(view.hangar.total).toBe(clanHangarCapacity(1));
    expect(view.hangar.used).toBe(0);
    expect(view.hangar.reserved).toBe(0);
    expect(view.maxLevel).toBe(false);
  });

  it('is closed, and levelless, in a season dealt before the ruleset', async () => {
    const f = await setup(3, JOINT - 1);
    const clanId = await foundClan(f);
    const [row] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(row!.level).toBeNull();

    const view = await readClanWar(f.db, await clanActor(f.db, f.accountIds[0]!), f.clock.now());
    expect(view.available).toBe(false);
    expect(view.level).toBeNull();
    await expect(donate(f, 0, f.planetIds[0]!, { alloy: 10, crystal: 0, deuterium: 0 }))
      .rejects.toMatchObject({ code: 'CLAN_JOINT_WAR_UNAVAILABLE' });
    await expect(upgrade(f, 0, 1))
      .rejects.toMatchObject({ code: 'CLAN_JOINT_WAR_UNAVAILABLE' });
  });
});

/* ── donation ───────────────────────────────────────────────────── */

describe('donating to the clan purse', () => {
  it('moves ore out of the chosen world and into the purse, once', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const result = await donate(f, 0, f.planetIds[0]!, { alloy: 500, crystal: 100, deuterium: 0 });
    expect(result.treasury).toEqual({ alloy: 500, crystal: 100, deuterium: 0 });

    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(Math.round(before!.alloy - after!.alloy)).toBe(500);
    expect(Math.round(before!.crystal - after!.crystal)).toBe(100);

    const events = await f.db.select().from(clanTreasuryEvents)
      .where(and(eq(clanTreasuryEvents.clanId, clanId), eq(clanTreasuryEvents.kind, 'DONATION')));
    expect(events).toHaveLength(1);
    expect(events[0]!.alloy).toBe(500);
    expect(events[0]!.sourcePlanetId).toBe(f.planetIds[0]!);
  });

  it('takes a partial donation from a member who is not yet mature', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 1);
    // The newcomer is inside their twelve-hour adaptation and may still pay in.
    const result = await donate(f, 1, f.planetIds[1]!, { alloy: 0, crystal: 90, deuterium: 0 });
    expect(result.treasury.crystal).toBe(90);
  });

  it('refuses a commander who belongs to no clan', async () => {
    const f = await setup();
    await foundClan(f);
    await expect(donate(f, 1, f.planetIds[1]!, { alloy: 10, crystal: 0, deuterium: 0 }))
      .rejects.toMatchObject({ code: 'NOT_IN_CLAN' });
  });

  it('refuses a world the donor does not control', async () => {
    const f = await setup();
    await foundClan(f);
    await expect(donate(f, 0, f.planetIds[1]!, { alloy: 10, crystal: 0, deuterium: 0 }))
      .rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
  });

  it('refuses more than the world actually holds', async () => {
    const f = await setup();
    await foundClan(f);
    // Inside the purse cap, and beyond what this world can pay.
    await f.db.update(planets).set({ alloy: 10 }).where(eq(planets.id, f.planetIds[0]!));
    await expect(donate(f, 0, f.planetIds[0]!, { alloy: 500, crystal: 0, deuterium: 0 }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
    const [row] = await f.db.select().from(clans).where(eq(clans.seasonId, f.seasonId));
    expect(row!.treasuryAlloy).toBe(0);
  });

  /**
   * The Hangar ladder is priced in alloy and crystal only, so the deuterium cap is
   * permanently zero and a fuel donation can never be accepted. That is the cap
   * rule working, not a gap: fuel in the purse would be money the clan can never
   * spend. The surface has to stop offering the field rather than take the ore.
   */
  it('has no room for fuel at any rung, because no rung is priced in it', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    for (const level of [1, 5, 9]) {
      await f.db.update(clans).set({ level }).where(eq(clans.id, clanId));
      const view = await readClanWar(f.db, await clanActor(f.db, f.accountIds[0]!), f.clock.now());
      expect(view.nextCost!.deuterium).toBe(0);
      expect(view.room!.deuterium).toBe(0);
    }
    await expect(donate(f, 0, f.planetIds[0]!, { alloy: 0, crystal: 0, deuterium: 1 }))
      .rejects.toMatchObject({ code: 'CLAN_TREASURY_OVER_CAP' });
  });

  it('refuses a donation that moves nothing at all', async () => {
    const f = await setup();
    await foundClan(f);
    await expect(donate(f, 0, f.planetIds[0]!, { alloy: 0, crystal: 0, deuterium: 0 }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('refuses the whole request when it would overflow the next rung, never trimming it', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    const cost = clanLevelUpgradeCost(1);
    await expect(donate(f, 0, f.planetIds[0]!, {
      alloy: cost.alloy + 1, crystal: 0, deuterium: 0,
    })).rejects.toMatchObject({ code: 'CLAN_TREASURY_OVER_CAP' });
    const [row] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(row!.treasuryAlloy).toBe(0);
    // Exactly the cap is accepted.
    await donate(f, 0, f.planetIds[0]!, { alloy: cost.alloy, crystal: 0, deuterium: 0 });
    const [full] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(full!.treasuryAlloy).toBe(cost.alloy);
    // And one unit past it is refused.
    await expect(donate(f, 0, f.planetIds[0]!, { alloy: 1, crystal: 0, deuterium: 0 }))
      .rejects.toMatchObject({ code: 'CLAN_TREASURY_OVER_CAP' });
  });

  it('cannot be overfilled by two donations racing for the last unit', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 1);
    const cost = clanLevelUpgradeCost(1);
    const half = Math.ceil(cost.alloy * 0.7);
    const results = await Promise.allSettled([
      donate(f, 0, f.planetIds[0]!, { alloy: half, crystal: 0, deuterium: 0 }),
      donate(f, 1, f.planetIds[1]!, { alloy: half, crystal: 0, deuterium: 0 }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const [row] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(row!.treasuryAlloy).toBe(half);
    expect(row!.treasuryAlloy).toBeLessThanOrEqual(cost.alloy);
  });

  it('closes donation entirely at the top rung', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await f.db.update(clans).set({ level: 10 }).where(eq(clans.id, clanId));
    const view = await readClanWar(f.db, await clanActor(f.db, f.accountIds[0]!), f.clock.now());
    expect(view.maxLevel).toBe(true);
    expect(view.nextCost).toBeNull();
    expect(view.hangar.total).toBe(clanHangarCapacity(10));
    await expect(donate(f, 0, f.planetIds[0]!, { alloy: 1, crystal: 0, deuterium: 0 }))
      .rejects.toMatchObject({ code: 'CLAN_LEVEL_MAX' });
  });
});

/* ── the rung itself ────────────────────────────────────────────── */

describe('buying the next rung', () => {
  it('is the leader’s alone and spends the exact price', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 1);
    await fill(f, clanId, 1);

    await expect(upgrade(f, 1, 1)).rejects.toMatchObject({ code: 'CLAN_LEADER_REQUIRED' });
    const result = await upgrade(f, 0, 1);
    expect(result.level).toBe(2);
    expect(result.treasury).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(result.capacity).toBe(clanHangarCapacity(2));

    const events = await f.db.select().from(clanTreasuryEvents)
      .where(and(eq(clanTreasuryEvents.clanId, clanId), eq(clanTreasuryEvents.kind, 'LEVEL_UP')));
    expect(events).toHaveLength(1);
    expect(events[0]!.levelBefore).toBe(1);
    expect(events[0]!.levelAfter).toBe(2);
    expect(events[0]!.alloy).toBe(-clanLevelUpgradeCost(1).alloy);
  });

  it('refuses a purse that is one unit short', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await fill(f, clanId, 1);
    await f.db.update(clans)
      .set({ treasuryAlloy: clanLevelUpgradeCost(1).alloy - 1 })
      .where(eq(clans.id, clanId));
    await expect(upgrade(f, 0, 1))
      .rejects.toMatchObject({ code: 'CLAN_TREASURY_INSUFFICIENT' });
  });

  it('refuses a rung the caller did not think they were buying', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await fill(f, clanId, 1);
    await expect(upgrade(f, 0, 2)).rejects.toMatchObject({ code: 'CLAN_LEVEL_STALE' });
  });

  it('lets only one of two concurrent buyers through', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await fill(f, clanId, 1);
    const results = await Promise.allSettled([upgrade(f, 0, 1), upgrade(f, 0, 1)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const [row] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(row!.level).toBe(2);
    expect(row!.treasuryAlloy).toBe(0);
  });

  it('has nothing left to buy at the top rung', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await f.db.update(clans).set({ level: 10 }).where(eq(clans.id, clanId));
    await expect(upgrade(f, 0, 10)).rejects.toMatchObject({ code: 'CLAN_LEVEL_MAX' });
  });
});

/* ── leaving, disbanding and what is public ─────────────────────── */

describe('what a donation is worth once given', () => {
  it('pays nothing back to a member who leaves', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 1);
    await donate(f, 1, f.planetIds[1]!, { alloy: 300, crystal: 0, deuterium: 0 });
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    const actor = await clanActor(f.db, f.accountIds[1]!);
    await f.db.transaction((tx) => leaveClan(tx, { actor, now: f.clock.now() }));
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(Math.round(after!.alloy)).toBe(Math.round(before!.alloy));
    const [clan] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(clan!.treasuryAlloy).toBe(300);
  });

  it('burns what is left on disband, with an audit row and an explicit yes', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await donate(f, 0, f.planetIds[0]!, { alloy: 400, crystal: 100, deuterium: 0 });

    const actor = await clanActor(f.db, f.accountIds[0]!);
    await expect(f.db.transaction((tx) => disbandClan(tx, {
      actor, now: f.clock.now(), acknowledgeTreasuryBurn: false,
    }))).rejects.toMatchObject({ code: 'CLAN_TREASURY_BURN_UNCONFIRMED' });

    await f.db.transaction((tx) => disbandClan(tx, {
      actor, now: f.clock.now(), acknowledgeTreasuryBurn: true,
    }));
    const [clan] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(clan!.treasuryAlloy).toBe(0);
    expect(clan!.treasuryCrystal).toBe(0);
    const burns = await f.db.select().from(clanTreasuryEvents)
      .where(and(eq(clanTreasuryEvents.clanId, clanId), eq(clanTreasuryEvents.kind, 'DISBAND_BURN')));
    expect(burns).toHaveLength(1);
    expect(burns[0]!.alloy).toBe(-400);
    expect(burns[0]!.crystal).toBe(-100);
  });

  it('burns an inactive leader-only clan and keeps a system audit after reclaim', async () => {
    const f = await setup(1);
    const clanId = await foundClan(f);
    await donate(f, 0, f.planetIds[0]!, { alloy: 400, crystal: 100, deuterium: 0 });
    const inactiveAt = new Date(
      f.clock.now().getTime() - (SERVERS.idleDays + 1) * 24 * 60 * 60_000,
    );
    await f.db.update(players).set({ lastActiveAt: inactiveAt, joinedAt: inactiveAt })
      .where(eq(players.id, f.playerIds[0]!));

    const result = await reclaimIdleSeats(f.db, f.clock);

    expect(result).toMatchObject({ failed: 0, reclaimed: [expect.any(String)] });
    const [clan] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(clan).toMatchObject({ treasuryAlloy: 0, treasuryCrystal: 0 });
    const events = await f.db.select().from(clanTreasuryEvents)
      .where(eq(clanTreasuryEvents.clanId, clanId));
    expect(events).toEqual([
      expect.objectContaining({
        kind: 'DISBAND_BURN',
        actorPlayerId: null,
        alloy: -400,
        crystal: -100,
      }),
    ]);
  });

  it('removes a donation audit cleanly when its donor deletes their account', async () => {
    const f = await setup(1);
    const clanId = await foundClan(f);
    await donate(f, 0, f.planetIds[0]!, { alloy: 250, crystal: 0, deuterium: 0 });
    const [account] = await f.db.select().from(accounts)
      .where(eq(accounts.id, f.accountIds[0]!));

    await expect(deleteAccount(f.db, f.clock, account!.username)).resolves.toBeDefined();

    const [clan] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(clan).toMatchObject({ treasuryAlloy: 0 });
    const events = await f.db.select().from(clanTreasuryEvents)
      .where(eq(clanTreasuryEvents.clanId, clanId));
    expect(events).toEqual([
      expect.objectContaining({ kind: 'DISBAND_BURN', actorPlayerId: null, alloy: -250 }),
    ]);
  });

  it('keeps the treasury when an active member succeeds an inactive leader', async () => {
    const f = await setup(2);
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 1);
    await donate(f, 0, f.planetIds[0]!, { alloy: 300, crystal: 0, deuterium: 0 });
    const inactiveAt = new Date(
      f.clock.now().getTime() - (SERVERS.idleDays + 1) * 24 * 60 * 60_000,
    );
    await f.db.update(players).set({ lastActiveAt: inactiveAt, joinedAt: inactiveAt })
      .where(eq(players.id, f.playerIds[0]!));

    const result = await reclaimIdleSeats(f.db, f.clock);

    expect(result.failed).toBe(0);
    const [clan] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(clan).toMatchObject({ treasuryAlloy: 300, disbandedAt: null });
    const burns = await f.db.select().from(clanTreasuryEvents)
      .where(and(
        eq(clanTreasuryEvents.clanId, clanId),
        eq(clanTreasuryEvents.kind, 'DISBAND_BURN'),
      ));
    expect(burns).toHaveLength(0);
  });

  it('disbands an empty clan with no acknowledgement at all', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    const actor = await clanActor(f.db, f.accountIds[0]!);
    await expect(f.db.transaction((tx) => disbandClan(tx, { actor, now: f.clock.now() })))
      .resolves.toMatchObject({ disbanded: true });
    const burns = await f.db.select().from(clanTreasuryEvents)
      .where(eq(clanTreasuryEvents.clanId, clanId));
    expect(burns).toHaveLength(0);
  });

  /**
   * A DONATION AND A DISBAND TAKE THE SAME TWO ROWS. `disbandClan` locks the clan
   * and then its members; every treasury path does the same, in that order. If the
   * two ever disagreed this pair would deadlock rather than refuse, and Postgres
   * would kill one of them with 40P01 instead of the game explaining itself.
   */
  it('never deadlocks against a disband running at the same instant', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 1);
    const actor = await clanActor(f.db, f.accountIds[0]!);
    const results = await Promise.allSettled([
      donate(f, 1, f.planetIds[1]!, { alloy: 200, crystal: 0, deuterium: 0 }),
      f.db.transaction((tx) => disbandClan(tx, {
        actor, now: f.clock.now(), acknowledgeTreasuryBurn: true,
      })),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        expect(String(result.reason)).not.toMatch(/deadlock/i);
      }
    }
    // Whichever won, the purse and the clan agree afterwards.
    const [clan] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    if (clan!.disbandedAt) expect(clan!.treasuryAlloy).toBe(0);
  });

  it('publishes the level and never the purse', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await donate(f, 0, f.planetIds[0]!, { alloy: 400, crystal: 0, deuterium: 0 });
    const outsider = await publicClan(f.db, f.accountIds[2]!, clanId);
    expect(outsider.level).toBe(1);
    expect(JSON.stringify(outsider)).not.toContain('treasury');
    expect(JSON.stringify(outsider)).not.toContain('400');
  });

  it('shows no level on a public profile from an older season', async () => {
    const f = await setup(3, JOINT - 1);
    const clanId = await foundClan(f);
    const outsider = await publicClan(f.db, f.accountIds[2]!, clanId);
    expect(outsider.level).toBeNull();
  });

  it('refuses the private read to a commander outside the clan', async () => {
    const f = await setup();
    await foundClan(f);
    await expect(readClanWar(f.db, await clanActor(f.db, f.accountIds[2]!), f.clock.now()))
      .rejects.toMatchObject({ code: 'NOT_IN_CLAN' });
  });
});

/* ── the HTTP surface ───────────────────────────────────────────── */

describe('the treasury routes', () => {
  it('replays a donation retry without charging the world twice', async () => {
    const f = await setup();
    await foundClan(f);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const headers = {
        authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`,
        'idempotency-key': 'clan-donate-0001',
      };
      const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
      const payload = {
        planetId: f.planetIds[0]!,
        resources: { alloy: 300, crystal: 100, deuterium: 0 },
      };
      const [first, replay] = await Promise.all([
        built.app.inject({ method: 'POST', url: '/api/clan/treasury/donate', headers, payload }),
        built.app.inject({ method: 'POST', url: '/api/clan/treasury/donate', headers, payload }),
      ]);
      expect(first.statusCode).toBe(200);
      expect(replay.json()).toEqual(first.json());
      const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
      expect(Math.round(before!.alloy - after!.alloy)).toBe(300);
      const events = await f.db.select().from(clanTreasuryEvents);
      expect(events).toHaveLength(1);
    } finally {
      await built.close();
    }
  });

  it('reads the private war state and refuses a fractional donation', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await fill(f, clanId, 1);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };

      const read = await built.app.inject({ method: 'GET', url: '/api/clan/war', headers: auth });
      expect(read.statusCode).toBe(200);
      expect(read.json()).toMatchObject({
        available: true,
        level: 1,
        canUpgrade: true,
        hangar: { total: clanHangarCapacity(1) },
      });

      const bad = await built.app.inject({
        method: 'POST',
        url: '/api/clan/treasury/donate',
        headers: { ...auth, 'idempotency-key': 'clan-donate-bad1' },
        payload: { planetId: f.planetIds[0]!, resources: { alloy: 1.5, crystal: 0, deuterium: 0 } },
      });
      expect(bad.statusCode).toBe(400);

      const bought = await built.app.inject({
        method: 'POST',
        url: '/api/clan/level/upgrade',
        headers: { ...auth, 'idempotency-key': 'clan-upgrade-0001' },
        payload: { expectedLevel: 1 },
      });
      expect(bought.statusCode).toBe(200);
      expect(bought.json()).toMatchObject({ level: 2, capacity: clanHangarCapacity(2) });
    } finally {
      await built.close();
    }
  });
});
