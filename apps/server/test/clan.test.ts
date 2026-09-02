import { pino } from 'pino';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { CLAN, HULLS, SEASON, distance, hangarCapacity, missionFuel } from '@astera/rules';
import {
  attackCommitments,
  battleReports,
  clanAidCommitments,
  clanEvents,
  clanLootShares,
  clanMemberships,
  clanRaidRoster,
  clans,
  missions,
  planets,
  players,
  seasonResults,
  seasons,
  units,
} from '../src/db/schema.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  createClan,
  leaveClan,
  readClanBadge,
  setClanAidPolicy,
} from '../src/services/clan.js';
import {
  launchClanAid,
  quoteClanAid,
  readClanAid,
} from '../src/services/clanAid.js';
import {
  markClanChatRead,
  postClanChat,
  readClanChat,
} from '../src/services/clanChat.js';
import { readClanStrength } from '../src/services/clanStrength.js';
import {
  allocateClanLoot,
  claimClanLoot,
  clanPurseForPlayer,
  readClanDepot,
} from '../src/services/clanLoot.js';
import { launchAttack } from '../src/services/mission.js';
import { readBattleReports } from '../src/services/reports.js';
import { launchProbe } from '../src/services/intel.js';
import { prepareClanAttack } from '../src/services/clanCombat.js';
import { reclaimIdleSeats } from '../src/services/reclaim.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveUnits,
  giveResearch,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  testEnv,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

async function setup(count = 4): Promise<Fixture> {
  const fixture = await seedWorld(count, 114114);
  await fixture.db.update(seasons).set({ rulesetVersion: 3 })
    .where(eq(seasons.id, fixture.seasonId));
  for (const planetId of fixture.planetIds) {
    await grant(fixture.db, planetId, 120_000, 60_000);
    await setLevel(fixture.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(fixture.db, fixture.planetIds);
  return fixture;
}

async function foundClan(fixture: Fixture, leaderIndex = 0) {
  const actor = await clanActor(fixture.db, fixture.accountIds[leaderIndex]!);
  const result = await fixture.db.transaction((tx) => createClan(tx, {
    actor,
    name: '  Orion   Guard  ',
    tag: 'og',
    description: 'Five commanders, one horizon.',
    recruiting: true,
    clock: fixture.clock,
  }));
  return { actor, result };
}

async function joinClan(
  fixture: Fixture,
  clanId: string,
  leaderIndex: number,
  candidateIndex: number,
  acknowledgeHostile = false,
) {
  const candidate = await clanActor(fixture.db, fixture.accountIds[candidateIndex]!);
  const application = await fixture.db.transaction((tx) => applyToClan(tx, {
    actor: candidate,
    clanId,
    now: fixture.clock.now(),
  }));
  const leader = await clanActor(fixture.db, fixture.accountIds[leaderIndex]!);
  return fixture.db.transaction((tx) => acceptClanRequest(tx, {
    actor: leader,
    requestId: application.requestId,
    acknowledgeHostile,
    now: fixture.clock.now(),
  }));
}

const workerFor = (fixture: Fixture) => new EventWorker(
  fixture.db,
  fixture.clock,
  { pollMs: 1, batch: 100, staleMinutes: 5 },
  silent,
);

describe('ruleset-v3 clans', () => {
  it('requires Core 7, normalises identity and burns the founding cost exactly once', async () => {
    const f = await setup(2);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 6);
    const actor = await clanActor(f.db, f.accountIds[0]!);
    await expect(f.db.transaction((tx) => createClan(tx, {
      actor,
      name: 'Orion Guard',
      tag: 'OG',
      description: '',
      recruiting: true,
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CLAN_CORE_REQUIRED' });

    await setLevel(f.db, f.planetIds[0]!, 'CORE', 7);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const founded = await f.db.transaction((tx) => createClan(tx, {
      actor,
      name: '  Orion   Guard  ',
      tag: 'og',
      description: '',
      recruiting: true,
      clock: f.clock,
    }));
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(founded).toMatchObject({ name: 'Orion Guard', tag: 'OG' });
    expect(after!.alloy).toBe(before!.alloy - CLAN.creationCost.alloy);
    expect(after!.crystal).toBe(before!.crystal - CLAN.creationCost.crystal);
    const [membership] = await f.db.select().from(clanMemberships)
      .where(eq(clanMemberships.playerId, actor.playerId));
    expect(membership).toMatchObject({ role: 'LEADER', matureAt: membership!.joinedAt });
  });

  it('gives chat and friendly-fire safety immediately, while aid waits twelve hours', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    const accepted = await joinClan(f, result.clanId, 0, 1);

    await expect(f.db.transaction((tx) => postClanChat(tx, {
      playerId: f.playerIds[1]!,
      content: 'Reporting in.',
      now: f.clock.now(),
    }))).resolves.toMatchObject({ content: 'Reporting in.' });
    await expect(quoteClanAid(f.db, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 0, crystal: 0, deuterium: 0 },
      now: f.clock.now(),
    })).rejects.toMatchObject({ code: 'CLAN_ADAPTING' });
    await expect(launchProbe(
      f.db,
      f.planetIds[1]!,
      f.planetIds[0]!,
      f.clock,
      f.playerIds[1],
    )).rejects.toMatchObject({ code: 'CLAN_FRIENDLY_FIRE' });

    expect(new Date(accepted.matureAt).getTime() - f.clock.now().getTime())
      .toBe(CLAN.adaptationMinutes * 60_000);
    f.clock.advance(CLAN.adaptationMinutes);
    await expect(quoteClanAid(f.db, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 0, crystal: 0, deuterium: 0 },
      now: f.clock.now(),
    })).resolves.toMatchObject({ canLand: true, withinAllowance: true });
  });

  it('keeps clan chat unread separate from other clan attention', async () => {
    const f = await setup(2);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);

    expect(await readClanBadge(f.db, f.accountIds[1]!, f.clock.now()))
      .toMatchObject({ clanChatUnread: 0, attentionCount: 0 });
    const message = await f.db.transaction((tx) => postClanChat(tx, {
      playerId: f.playerIds[0]!,
      content: 'Rally at the rim.',
      now: f.clock.now(),
    }));
    expect(await readClanBadge(f.db, f.accountIds[1]!, f.clock.now()))
      .toMatchObject({ clanChatUnread: 1, attentionCount: 1 });

    await f.db.transaction((tx) => markClanChatRead(tx, {
      playerId: f.playerIds[1]!,
      messageId: message.id,
      now: f.clock.now(),
    }));
    expect(await readClanBadge(f.db, f.accountIds[1]!, f.clock.now()))
      .toMatchObject({ clanChatUnread: 0, attentionCount: 0 });
  });

  it('summarises the whole crew with a fixed aggregate payload', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    await f.db.update(players).set({ dominionTaken: 320, dominionLost: 20 })
      .where(eq(players.id, f.playerIds[0]!));
    await f.db.update(players).set({ dominionTaken: 180, dominionLost: 30 })
      .where(eq(players.id, f.playerIds[1]!));
    await giveUnits(f.db, f.planetIds[0]!, { DART: 2, BASTION: 1 });
    await giveUnits(f.db, f.planetIds[1]!, { PIKE: 3, PROSPECTOR: 1 });
    await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'transfer',
      status: 'in_flight',
      ownerPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { DART: 1 },
      distance: 10,
      departAt: f.clock.now(),
      arriveAt: new Date(f.clock.now().getTime() + 60_000),
    });

    const strength = await readClanStrength(f.db, f.accountIds[0]!);
    expect(strength.clan).toMatchObject({ id: result.clanId, tag: 'OG' });
    expect(strength.totals).toEqual({
      clanDominion: 0,
      memberDominion: 450,
      ships: 6,
      fleetValue:
        2 * (HULLS.DART.alloy + HULLS.DART.crystal + HULLS.DART.deuterium)
        + 3 * (HULLS.PIKE.alloy + HULLS.PIKE.crystal + HULLS.PIKE.deuterium)
        + HULLS.PROSPECTOR.alloy + HULLS.PROSPECTOR.crystal + HULLS.PROSPECTOR.deuterium,
      groundDefences: 1,
      worlds: 2,
      activeFlights: 1,
    });
    expect(strength.composition).toEqual([
      { hull: 'DART', count: 2 },
      { hull: 'PIKE', count: 3 },
      { hull: 'PROSPECTOR', count: 1 },
    ]);
    expect(strength.members).toMatchObject([
      { playerId: f.playerIds[0], role: 'LEADER', dominion: 300, ships: 2, worlds: 1 },
      { playerId: f.playerIds[1], role: 'MEMBER', dominion: 150, ships: 4, worlds: 1 },
    ]);
  });

  it('requires hostile-flight acknowledgement and binds the open launch to the joined clan', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    const candidate = await clanActor(f.db, f.accountIds[1]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate,
      clanId: result.clanId,
      now: f.clock.now(),
    }));
    await giveUnits(f.db, f.planetIds[1]!, { DART: 2 });
    const hostile = await launchAttack(
      f.db,
      f.planetIds[1]!,
      f.planetIds[0]!,
      { DART: 1 },
      f.clock,
      f.playerIds[1],
    );
    const leader = await clanActor(f.db, f.accountIds[0]!);
    await expect(f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: false,
      now: f.clock.now(),
    }))).rejects.toMatchObject({ code: 'CLAN_HOSTILE_FLIGHT_ACK_REQUIRED' });
    await expect(f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: true,
      now: f.clock.now(),
    }))).resolves.toMatchObject({ hostileFlightsContinue: true });
    const [commitment] = await f.db.select().from(attackCommitments)
      .where(eq(attackCommitments.missionId, hostile.missionId));
    expect(commitment?.quotaClanId).toBe(result.clanId);
  });

  it('enforces five clan launches per target commander and releases the exact twelve-hour boundary', async () => {
    const f = await setup(6);
    const { result } = await foundClan(f);
    for (let candidate = 1; candidate < CLAN.maxMembers; candidate += 1) {
      await joinClan(f, result.clanId, 0, candidate);
    }
    const targetPlayerId = f.playerIds[5]!;
    for (let attacker = 0; attacker < CLAN.maxMembers; attacker += 1) {
      const [mission] = await f.db.insert(missions).values({
        seasonId: f.seasonId,
        kind: 'attack',
        status: 'resolved',
        ownerPlayerId: f.playerIds[attacker]!,
        originPlanetId: f.planetIds[attacker]!,
        targetPlanetId: f.planetIds[5]!,
        fleet: { DART: 1 },
        distance: 1,
        departAt: f.clock.now(),
        arriveAt: f.clock.now(),
      }).returning();
      await f.db.insert(attackCommitments).values({
        seasonId: f.seasonId,
        missionId: mission!.id,
        attackerPlayerId: f.playerIds[attacker]!,
        targetPlayerId,
        quotaClanId: result.clanId,
        launchedAt: f.clock.now(),
        expiresAt: new Date(f.clock.now().getTime() + CLAN.attackWindowMinutes * 60_000),
      });
    }

    await expect(f.db.transaction((tx) => prepareClanAttack(tx, {
      seasonId: f.seasonId,
      attackerPlayerId: f.playerIds[0]!,
      targetPlayerId,
      now: f.clock.now(),
    }))).rejects.toMatchObject({ code: 'CLAN_ATTACK_LIMIT' });
    f.clock.advance(CLAN.attackWindowMinutes);
    await expect(f.db.transaction((tx) => prepareClanAttack(tx, {
      seasonId: f.seasonId,
      attackerPlayerId: f.playerIds[0]!,
      targetPlayerId,
      now: f.clock.now(),
    }))).resolves.toMatchObject({ personalRecent: 0, quotaClanId: result.clanId });
  });

  it('applies the leave lock and ceasefire immediately, then releases both at 24 hours', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    const member = await clanActor(f.db, f.accountIds[1]!);
    await f.db.transaction((tx) => leaveClan(tx, { actor: member, now: f.clock.now() }));
    await expect(f.db.transaction((tx) => applyToClan(tx, {
      actor: member,
      clanId: result.clanId,
      now: f.clock.now(),
    }))).rejects.toMatchObject({ code: 'CLAN_MEMBERSHIP_LOCKED' });
    await expect(launchProbe(
      f.db,
      f.planetIds[1]!,
      f.planetIds[0]!,
      f.clock,
      f.playerIds[1],
    )).rejects.toMatchObject({ code: 'CLAN_CEASEFIRE' });

    f.clock.advance(CLAN.membershipLockMinutes);
    await expect(f.db.transaction((tx) => applyToClan(tx, {
      actor: member,
      clanId: result.clanId,
      now: f.clock.now(),
    }))).resolves.toHaveProperty('requestId');
    await expect(launchProbe(
      f.db,
      f.planetIds[1]!,
      f.planetIds[0]!,
      f.clock,
      f.playerIds[1],
    )).resolves.toHaveProperty('missionId');
  });

  it('delivers resources physically, then returns the Hauler to its sender', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 2 });
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    const launch = await f.db.transaction((tx) => launchClanAid(tx, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 100, crystal: 50, deuterium: 0 },
      clock: f.clock,
    }));
    f.clock.set(new Date(launch.arriveAt));
    await workerFor(f).tick();

    const [commitment] = await f.db.select().from(clanAidCommitments)
      .where(eq(clanAidCommitments.missionId, launch.missionId));
    const [target] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    const [gifted] = await f.db.select().from(units).where(and(
      eq(units.planetId, f.planetIds[1]!),
      eq(units.ownerPlayerId, f.playerIds[1]!),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(commitment?.status).toBe('RETURNING');
    expect(gifted).toBeUndefined();
    expect(target?.alloy).toBe(before!.alloy + 100);
    expect(target?.crystal).toBe(before!.crystal + 50);
    const [returnMission] = await f.db.select().from(missions).where(and(
      eq(missions.parentMissionId, launch.missionId),
      eq(missions.status, 'in_flight'),
    ));
    expect(returnMission).toMatchObject({
      targetPlanetId: f.planetIds[0],
      cargo: { alloy: 0, crystal: 0, deuterium: 0 },
    });

    f.clock.set(returnMission!.arriveAt);
    await workerFor(f).tick();
    const [completed] = await f.db.select().from(clanAidCommitments)
      .where(eq(clanAidCommitments.missionId, launch.missionId));
    const home = await f.db.select().from(units).where(and(
      eq(units.planetId, f.planetIds[0]!),
      eq(units.ownerPlayerId, f.playerIds[0]!),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(completed?.status).toBe('DELIVERED');
    expect(home.reduce((sum, row) => sum + row.count, 0)).toBe(2);
    const incoming = await readClanAid(f.db, f.accountIds[1]!);
    expect(incoming.transfers[0]).toMatchObject({
      id: launch.missionId,
      direction: 'INCOMING',
      status: 'DELIVERED',
      cargo: { alloy: 100, crystal: 50, deuterium: 0 },
    });
  });

  it('keeps zero-cargo aid as an irreversible ship gift', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 1 });
    const launch = await f.db.transaction((tx) => launchClanAid(tx, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 0, crystal: 0, deuterium: 0 },
      clock: f.clock,
    }));

    f.clock.set(new Date(launch.arriveAt));
    await workerFor(f).tick();

    const [commitment] = await f.db.select().from(clanAidCommitments)
      .where(eq(clanAidCommitments.missionId, launch.missionId));
    const [gifted] = await f.db.select().from(units).where(and(
      eq(units.planetId, f.planetIds[1]!),
      eq(units.ownerPlayerId, f.playerIds[1]!),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(commitment?.status).toBe('DELIVERED');
    expect(gifted?.count).toBe(1);
    expect(await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId)))
      .toHaveLength(0);
  });

  it('returns a successful resource transport to the colony it launched from', async () => {
    const f = await setup(4);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    const colony = f.planetIds[3]!;
    await f.db.update(planets).set({
      controllerPlayerId: f.playerIds[0]!,
      kind: 'COLONY',
    }).where(eq(planets.id, colony));
    await f.db.delete(units).where(eq(units.planetId, colony));
    await grant(f.db, colony, 10_000, 5_000);
    await giveUnits(f.db, colony, { COURIER: 1 });

    const launch = await f.db.transaction((tx) => launchClanAid(tx, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: colony,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 100, crystal: 0, deuterium: 0 },
      clock: f.clock,
    }));
    f.clock.set(new Date(launch.arriveAt));
    await workerFor(f).tick();
    const [returnMission] = await f.db.select().from(missions)
      .where(eq(missions.parentMissionId, launch.missionId));
    expect(returnMission?.targetPlanetId).toBe(colony);

    f.clock.set(returnMission!.arriveAt);
    await workerFor(f).tick();
    const [home] = await f.db.select().from(units).where(and(
      eq(units.planetId, colony),
      eq(units.ownerPlayerId, f.playerIds[0]!),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(home?.count).toBe(1);
  });

  it('lands a returning transport at the sender capital if its launch colony was lost', async () => {
    const f = await setup(4);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    const colony = f.planetIds[3]!;
    await f.db.update(planets).set({
      controllerPlayerId: f.playerIds[0]!,
      kind: 'COLONY',
    }).where(eq(planets.id, colony));
    await f.db.delete(units).where(eq(units.planetId, colony));
    await grant(f.db, colony, 10_000, 5_000);
    await giveUnits(f.db, colony, { COURIER: 1 });
    const launch = await f.db.transaction((tx) => launchClanAid(tx, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: colony,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 100, crystal: 0, deuterium: 0 },
      clock: f.clock,
    }));
    f.clock.set(new Date(launch.arriveAt));
    await workerFor(f).tick();
    const [returnMission] = await f.db.select().from(missions)
      .where(eq(missions.parentMissionId, launch.missionId));
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[3]! })
      .where(eq(planets.id, colony));

    f.clock.set(returnMission!.arriveAt);
    await workerFor(f).tick();

    const [home] = await f.db.select().from(units).where(and(
      eq(units.planetId, f.planetIds[0]!),
      eq(units.ownerPlayerId, f.playerIds[0]!),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(home?.count).toBe(1);
  });

  it('quotes resource delivery as cargo-only allowance with round-trip fuel and no landing gate', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    await f.db.delete(units).where(eq(units.planetId, f.planetIds[1]!));
    await setLevel(f.db, f.planetIds[1]!, 'HANGAR', 0);
    await giveUnits(f.db, f.planetIds[1]!, { DART: hangarCapacity(0) });
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 1 });
    const payload = {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 100, crystal: 50, deuterium: 10 },
    };
    const quote = await quoteClanAid(f.db, { ...payload, now: f.clock.now() });
    const [origin, target] = await Promise.all([
      f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)).then((rows) => rows[0]!),
      f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!)).then((rows) => rows[0]!),
    ]);

    expect(quote).toMatchObject({
      canLand: true,
      value: payload.cargo,
      fuel: missionFuel(payload.fleet, distance(origin, target), 2),
    });
  });

  it('quotes and refuses an aid fleet that cannot fit in the destination Hangar', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    await f.db.delete(units).where(eq(units.planetId, f.planetIds[1]!));
    await setLevel(f.db, f.planetIds[1]!, 'HANGAR', 0);
    await giveUnits(f.db, f.planetIds[1]!, { DART: hangarCapacity(0) });
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 2 });
    const payload = {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 0, crystal: 0, deuterium: 0 },
    };

    await expect(quoteClanAid(f.db, { ...payload, now: f.clock.now() }))
      .resolves.toMatchObject({ canLand: false });
    await expect(f.db.transaction((tx) => launchClanAid(tx, { ...payload, clock: f.clock })))
      .rejects.toMatchObject({ code: 'CLAN_AID_CANNOT_LAND' });
  });

  it('revalidates advanced ship gifts against the recipient research', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    await giveUnits(f.db, f.planetIds[0]!, { ATLAS: 1 });
    const payload = {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { ATLAS: 1 },
      cargo: { alloy: 0, crystal: 0, deuterium: 0 },
    };

    await expect(quoteClanAid(f.db, { ...payload, now: f.clock.now() }))
      .resolves.toMatchObject({ canLand: false });
    await expect(f.db.transaction((tx) => launchClanAid(tx, { ...payload, clock: f.clock })))
      .rejects.toMatchObject({ code: 'CLAN_AID_CANNOT_LAND' });

    await giveResearch(f.db, f.planetIds[1]!, 'STARSHIP_ENGINEERING', 1);
    await giveResearch(f.db, f.planetIds[1]!, 'SHIP_PROPULSION', 2);
    await expect(quoteClanAid(f.db, { ...payload, now: f.clock.now() }))
      .resolves.toMatchObject({ canLand: true });
  });

  it('returns aid intact when the destination fills while it is flying', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    await f.db.delete(units).where(eq(units.planetId, f.planetIds[1]!));
    await setLevel(f.db, f.planetIds[1]!, 'HANGAR', 0);
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 2 });
    const launch = await f.db.transaction((tx) => launchClanAid(tx, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 0, crystal: 0, deuterium: 0 },
      clock: f.clock,
    }));
    await giveUnits(f.db, f.planetIds[1]!, { DART: hangarCapacity(0) });

    f.clock.set(new Date(launch.arriveAt));
    await workerFor(f).tick();
    const [commitment] = await f.db.select().from(clanAidCommitments)
      .where(eq(clanAidCommitments.missionId, launch.missionId));
    expect(commitment?.status).toBe('RETURNING');
    const [back] = await f.db.select().from(missions).where(and(
      eq(missions.parentMissionId, launch.missionId),
      eq(missions.status, 'in_flight'),
    ));
    expect(back).toBeDefined();

    f.clock.set(back!.arriveAt);
    await workerFor(f).tick();
    const home = await f.db.select().from(units).where(and(
      eq(units.planetId, f.planetIds[0]!),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(home.reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  it('returns the complete convoy when the recipient disables aid before arrival', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 2 });
    const launch = await f.db.transaction((tx) => launchClanAid(tx, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 100, crystal: 50, deuterium: 0 },
      clock: f.clock,
    }));
    const recipient = await clanActor(f.db, f.accountIds[1]!);
    await f.db.transaction((tx) => setClanAidPolicy(tx, {
      actor: recipient,
      enabled: false,
      now: f.clock.now(),
    }));

    f.clock.set(new Date(launch.arriveAt));
    await workerFor(f).tick();
    let [commitment] = await f.db.select().from(clanAidCommitments)
      .where(eq(clanAidCommitments.missionId, launch.missionId));
    expect(commitment?.status).toBe('RETURNING');
    const [returnMission] = await f.db.select().from(missions).where(and(
      eq(missions.parentMissionId, launch.missionId),
      eq(missions.kind, 'clan_transfer'),
      eq(missions.status, 'in_flight'),
    ));
    expect(returnMission).toBeDefined();
    f.clock.set(returnMission!.arriveAt);
    await workerFor(f).tick();
    [commitment] = await f.db.select().from(clanAidCommitments)
      .where(eq(clanAidCommitments.missionId, launch.missionId));
    const [home] = await f.db.select().from(units).where(and(
      eq(units.planetId, f.planetIds[0]!),
      eq(units.ownerPlayerId, f.playerIds[0]!),
      eq(units.hull, 'COURIER'),
      eq(units.location, 'home'),
    ));
    expect(commitment?.status).toBe('RETURNED');
    expect(home?.count).toBe(2);
  });

  it('credits equal personal shares only after PvP loot docks, then claims into the capital', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 5, COURIER: 2 });
    const launch = await launchAttack(
      f.db,
      f.planetIds[0]!,
      f.planetIds[2]!,
      { DART: 5, COURIER: 2 },
      f.clock,
      f.playerIds[0],
    );
    expect(await f.db.select().from(clanLootShares)).toHaveLength(0);

    f.clock.set(settledAt(launch.arriveAt));
    await workerFor(f).tick();
    expect(await f.db.select().from(clanLootShares)).toHaveLength(0);
    const [returnMission] = await f.db.select().from(missions).where(and(
      eq(missions.parentMissionId, launch.missionId),
      eq(missions.kind, 'return'),
    ));
    expect(returnMission).toBeDefined();
    f.clock.set(returnMission!.arriveAt);
    await workerFor(f).tick();

    const shares = await f.db.select().from(clanLootShares)
      .where(eq(clanLootShares.sourceMissionId, launch.missionId));
    expect(shares).toHaveLength(2);
    expect(shares[0]!.alloy).toBe(shares[1]!.alloy);
    expect(shares[0]!.crystal).toBe(shares[1]!.crystal);
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(shares.reduce((total, share) => total + share.alloy, 0))
      .toBeLessThanOrEqual(Math.floor(report!.loot.alloy * CLAN.raidLootShare));

    const depot = await readClanDepot(f.db, f.accountIds[1]!);
    expect(depot.resources.alloy + depot.resources.crystal).toBeGreaterThan(0);
    await f.db.update(planets).set({ alloy: 0, crystal: 0, deuterium: 0 })
      .where(eq(planets.id, f.planetIds[1]!));
    const claimed = await f.db.transaction((tx) => claimClanLoot(tx, {
      playerId: f.playerIds[1]!,
      clock: f.clock,
    }));
    expect(claimed.claimed.alloy + claimed.claimed.crystal).toBeGreaterThan(0);
    expect(claimed.remaining).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });

  it('serializes simultaneous loot returns against each personal purse ceiling', async () => {
    const f = await setup(2);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);

    const purseBefore = new Map(await Promise.all(f.playerIds.map(async (playerId) => [
      playerId,
      await clanPurseForPlayer(f.db, playerId),
    ] as const)));
    expect(purseBefore.get(f.playerIds[0]!)!.alloy).toBeGreaterThan(0);

    const roots = await f.db.insert(missions).values([0, 1].map((index) => ({
      seasonId: f.seasonId,
      kind: 'attack' as const,
      status: 'resolved' as const,
      ownerPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      distance: index + 1,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    }))).returning();
    await f.db.insert(clanRaidRoster).values(roots.flatMap((root) => f.playerIds.map(
      (playerId, slot) => ({ missionId: root.id, clanId: result.clanId, playerId, slot }),
    )));
    const returns = await f.db.insert(missions).values(roots.map((root) => ({
      seasonId: f.seasonId,
      kind: 'return' as const,
      status: 'resolved' as const,
      ownerPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[1]!,
      targetPlanetId: f.planetIds[0]!,
      fleet: { COURIER: 1 },
      loot: { alloy: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000 },
      distance: 1,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
      parentMissionId: root.id,
    }))).returning();

    await Promise.all(returns.map((mission) => f.db.transaction((tx) =>
      allocateClanLoot(tx, mission, f.clock.now()))));

    const shares = await f.db.select().from(clanLootShares)
      .where(inArray(clanLootShares.sourceMissionId, roots.map((root) => root.id)));
    for (const playerId of f.playerIds) {
      const credited = shares
        .filter((share) => share.playerId === playerId)
        .reduce((total, share) => ({
          alloy: total.alloy + share.remainingAlloy,
          crystal: total.crystal + share.remainingCrystal,
          deuterium: total.deuterium + share.remainingDeuterium,
        }), { alloy: 0, crystal: 0, deuterium: 0 });
      const ceiling = purseBefore.get(playerId)!;
      expect(credited.alloy).toBeLessThanOrEqual(ceiling.alloy);
      expect(credited.crystal).toBeLessThanOrEqual(ceiling.crystal);
      expect(credited.deuterium).toBeLessThanOrEqual(ceiling.deuterium);
    }
  });

  it('hides pre-join chat, paginates with a stable cursor and closes after afterglow', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await f.db.transaction((tx) => postClanChat(tx, {
      playerId: f.playerIds[0]!, content: 'Before you joined', now: f.clock.now(),
    }));
    f.clock.advance(1);
    await joinClan(f, result.clanId, 0, 1);
    const messages = [];
    for (const content of ['One', 'Two', 'Three']) {
      messages.push(await f.db.transaction((tx) => postClanChat(tx, {
        playerId: f.playerIds[0]!, content, now: f.clock.now(),
      })));
    }
    const page = await readClanChat(f.db, f.accountIds[1]!, { limit: 2, now: f.clock.now() });
    expect(page.messages.map((message) => message.content)).toEqual(['Two', 'Three']);
    expect(page.nextBefore).toBe(messages[1]!.id);
    const older = await readClanChat(f.db, f.accountIds[1]!, {
      before: page.nextBefore!,
      limit: 2,
      now: f.clock.now(),
    });
    expect(older.messages.map((message) => message.content)).toEqual(['One']);

    for (let index = 0; index < CLAN.chatBurst; index += 1) {
      await f.db.transaction((tx) => postClanChat(tx, {
        playerId: f.playerIds[1]!, content: `Burst ${String(index)}`, now: f.clock.now(),
      }));
    }
    await expect(f.db.transaction((tx) => postClanChat(tx, {
      playerId: f.playerIds[1]!, content: 'One too many', now: f.clock.now(),
    }))).rejects.toMatchObject({ code: 'CLAN_CHAT_RATE_LIMIT' });

    await f.db.update(seasons).set({ status: 'frozen', endsAt: f.clock.now() })
      .where(eq(seasons.id, f.seasonId));
    await expect(f.db.transaction((tx) => postClanChat(tx, {
      playerId: f.playerIds[0]!, content: 'Afterglow', now: f.clock.now(),
    }))).resolves.toMatchObject({ content: 'Afterglow' });
    f.clock.advance(SEASON.afterglowMinutes + 1);
    await expect(readClanChat(f.db, f.accountIds[1]!, { limit: 20, now: f.clock.now() }))
      .rejects.toMatchObject({ code: 'SEASON_FROZEN' });
  });

  it('promotes the oldest recently active member when an idle leader is reclaimed', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(1);
    await joinClan(f, result.clanId, 0, 2);
    const old = new Date(f.clock.now().getTime() - 4 * 24 * 60 * 60_000);
    await f.db.update(players).set({ lastActiveAt: old, joinedAt: old })
      .where(eq(players.id, f.playerIds[0]!));

    const reclaimed = await reclaimIdleSeats(f.db, f.clock);
    expect(reclaimed.reclaimed).toHaveLength(1);
    const [leader] = await f.db.select().from(clanMemberships).where(and(
      eq(clanMemberships.clanId, result.clanId),
      eq(clanMemberships.role, 'LEADER'),
      eq(clanMemberships.playerId, f.playerIds[1]!),
    ));
    expect(leader?.leftAt).toBeNull();
    const [event] = await f.db.select().from(clanEvents)
      .where(eq(clanEvents.kind, 'LEADERSHIP_RECLAIMED'));
    expect(event?.subjectPlayerId).toBe(f.playerIds[1]);
  });

  it('replays a founding request without double charging and rejects key reuse with new input', async () => {
    const f = await setup(1);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const headers = {
        authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`,
        'idempotency-key': 'found-clan-0001',
      };
      const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
      const payload = { name: 'Nova Hearth', tag: 'NH', description: '', recruiting: true };
      const [first, replay] = await Promise.all([
        built.app.inject({ method: 'POST', url: '/api/clan/create', headers, payload }),
        built.app.inject({ method: 'POST', url: '/api/clan/create', headers, payload }),
      ]);
      expect(first.statusCode).toBe(200);
      expect(replay.statusCode).toBe(200);
      expect(replay.json()).toEqual(first.json());
      expect(await f.db.select().from(clans)).toHaveLength(1);
      const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
      expect(after!.alloy).toBe(before!.alloy - CLAN.creationCost.alloy);
      expect(after!.crystal).toBe(before!.crystal - CLAN.creationCost.crystal);

      const conflict = await built.app.inject({
        method: 'POST',
        url: '/api/clan/create',
        headers,
        payload: { ...payload, tag: 'NEW' },
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json()).toMatchObject({ error: 'IDEMPOTENCY_CONFLICT' });
    } finally {
      await built.close();
    }
  });

  it('puts final clan rank in every current member recap and wipes the seasonal graph', async () => {
    const f = await setup(2);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    f.clock.set(season!.endsAt);
    const worker = workerFor(f);
    await worker.tick();
    const recaps = await f.db.select().from(seasonResults)
      .where(inArray(seasonResults.accountId, f.accountIds));
    expect(recaps).toHaveLength(2);
    expect(recaps.every((recap) => (
      recap.recap.clan?.tag === 'OG'
      && recap.recap.clan.finalRank === 1
      && recap.recap.clan.topThree
    ))).toBe(true);

    f.clock.set(new Date(season!.endsAt.getTime() + SEASON.afterglowMinutes * 60_000));
    await worker.tick();
    expect(await f.db.select().from(clans)).toHaveLength(0);
    expect(await f.db.select().from(clanMemberships)).toHaveLength(0);
    expect(await f.db.select().from(seasonResults)).toHaveLength(2);
  });

  /**
   * The quota column is rebound for twelve hours after launch so that attacking and
   * then joining cannot reset a clan's ceiling. A report is a different question —
   * it says what happened — and it used to read the same column.
   */
  it('never grows a clan tag on a battle report the attacker flew before joining', async () => {
    const f = await setup(3);
    const founder = await clanActor(f.db, f.accountIds[0]!);
    const clan = await f.db.transaction((tx) => createClan(tx, {
      actor: founder,
      name: 'Orion Guard',
      tag: 'OG',
      description: '',
      recruiting: true,
      clock: f.clock,
    }));
    await giveUnits(f.db, f.planetIds[1]!, { DART: 5 });
    const raid = await launchAttack(
      f.db, f.planetIds[1]!, f.planetIds[2]!, { DART: 3 }, f.clock, f.playerIds[1],
    );
    f.clock.set(settledAt(raid.arriveAt));
    await workerFor(f).tick();

    const before = await readBattleReports(f.db, f.playerIds[2]!, 20);
    expect(before.reports[0]?.attackerClan).toBeNull();

    // Still inside the twelve-hour commitment window, so the quota rebinds.
    await joinClan(f, clan.clanId, 0, 1, true);
    const [commitment] = await f.db.select().from(attackCommitments)
      .where(eq(attackCommitments.missionId, raid.missionId));
    expect(commitment?.quotaClanId).toBe(clan.clanId);
    expect(commitment?.attackerClanId).toBeNull();

    const after = await readBattleReports(f.db, f.playerIds[2]!, 20);
    expect(after.reports[0]?.attackerClan).toBeNull();
  });

  it('stamps the launch-time clan on a report and keeps it after the attacker leaves', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    await giveUnits(f.db, f.planetIds[1]!, { DART: 5 });
    const raid = await launchAttack(
      f.db, f.planetIds[1]!, f.planetIds[2]!, { DART: 3 }, f.clock, f.playerIds[1],
    );
    f.clock.set(settledAt(raid.arriveAt));
    await workerFor(f).tick();
    expect((await readBattleReports(f.db, f.playerIds[2]!, 20)).reports[0]?.attackerClan)
      .toMatchObject({ tag: 'OG' });

    const member = await clanActor(f.db, f.accountIds[1]!);
    await f.db.transaction((tx) => leaveClan(tx, { actor: member, now: f.clock.now() }));
    expect((await readBattleReports(f.db, f.playerIds[2]!, 20)).reports[0]?.attackerClan)
      .toMatchObject({ tag: 'OG' });
  });

  it('refuses clan aid aimed at the sender, and never quotes one', async () => {
    const f = await setup(2);
    const actor = await clanActor(f.db, f.accountIds[0]!);
    await f.db.transaction((tx) => createClan(tx, {
      actor,
      name: 'Solo Guard',
      tag: 'SG',
      description: '',
      recruiting: true,
      clock: f.clock,
    }));
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 2 });
    // The founder is mature at once, so nothing else would have stopped this.
    const payload = {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[0]!,
      targetPlanetId: f.planetIds[0]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 500, crystal: 0, deuterium: 0 },
    };
    await expect(quoteClanAid(f.db, { ...payload, now: f.clock.now() }))
      .rejects.toMatchObject({ code: 'CLAN_AID_SELF' });
    await expect(f.db.transaction((tx) => launchClanAid(tx, { ...payload, clock: f.clock })))
      .rejects.toMatchObject({ code: 'CLAN_AID_SELF' });
    expect(await f.db.select().from(clanAidCommitments)).toHaveLength(0);
  });

  it('quotes what is left of the receiver window without publishing the window', async () => {
    const f = await setup(3);
    const { result } = await foundClan(f);
    await joinClan(f, result.clanId, 0, 1);
    f.clock.advance(CLAN.adaptationMinutes);
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 2 });
    const quote = await quoteClanAid(f.db, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: { COURIER: 1 },
      cargo: { alloy: 100, crystal: 0, deuterium: 0 },
      now: f.clock.now(),
    });
    expect(quote.remaining.alloy).toBeGreaterThan(0);
    // Four hours of nominal production and a fifth of Deuterium capacity are the
    // recipient's Refinery, Extractor and Vault standing in disguise.
    expect(quote).not.toHaveProperty('allowance');
    expect(quote).not.toHaveProperty('used');
  });
});
