import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CLAN,
  MULTI_WORLD,
  clanHangarCapacity,
  distance,
  fleetSpeedMult,
  fleetTravelExact,
  hangarLoad,
  missionFuel,
  missionFuelForDistances,
} from '@astera/rules';
import {
  clanWarContributions,
  clanWarMissions,
  clanWarOperations,
  clans,
  missions,
  planets,
  players,
  seasons,
  units,
} from '../src/db/schema.js';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  createClan,
} from '../src/services/clan.js';
import {
  markClanWarTarget,
  quoteClanWarContribution,
  readClanWar,
  sendClanWarContribution,
} from '../src/services/clanWar.js';
import { baysOf } from '../src/services/flight.js';
import { rememberWorld } from '../src/services/intel.js';
import { planetView } from '../src/services/planetView.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveNewcomerShield,
  giveSatellite,
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const JOINT: number = MULTI_WORLD.clanJointWarRulesetVersion;

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

async function setup(count = 4): Promise<Fixture> {
  const f = await seedWorld(count, 505505);
  await f.db.update(seasons).set({ rulesetVersion: JOINT }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) {
    await grant(f.db, planetId, 600_000, 300_000);
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(f.db, f.planetIds);
  for (const planetId of f.planetIds) {
    await setLevel(f.db, planetId, 'HANGAR', 10);
    await giveUnits(f.db, planetId, { DART: 200, COURIER: 20, WAYFARER: 5 });
  }
  for (const observerPlayerId of f.playerIds) {
    for (const targetPlanetId of f.planetIds) {
      await f.db.transaction((tx) => rememberWorld(tx, {
        observerPlayerId,
        targetPlanetId,
        seasonId: f.seasonId,
        seenAt: f.clock.now(),
        source: 'PROBE',
      }));
    }
  }
  return f;
}

async function foundClan(f: Fixture): Promise<string> {
  const actor = await clanActor(f.db, f.accountIds[0]!);
  const result = await f.db.transaction((tx) => createClan(tx, {
    actor,
    name: 'Orion Guard',
    tag: 'OG',
    description: 'One horizon.',
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

/**
 * Push a member past their twelve-hour adaptation without moving the clock.
 *
 * The join is backdated with it: `clan_memberships_maturity_check` insists a
 * membership cannot mature before it began, which is the constraint doing its job.
 */
async function mature(f: Fixture, playerId: string): Promise<void> {
  const { clanMemberships } = await import('../src/db/schema.js');
  const joinedAt = new Date(f.clock.now().getTime() - 13 * 3_600_000);
  await f.db.update(clanMemberships)
    .set({ joinedAt, matureAt: new Date(joinedAt.getTime() + CLAN.adaptationMinutes * 60_000) })
    .where(eq(clanMemberships.playerId, playerId));
}

const markTarget = (f: Fixture, targetPlanetId: string) =>
  f.db.transaction(async (tx) => {
    const actor = await clanActor(tx, f.accountIds[0]!);
    return markClanWarTarget(tx, { actor, targetPlanetId, clock: f.clock });
  });

const send = (
  f: Fixture,
  accountIndex: number,
  originPlanetId: string,
  fleet: Record<string, number>,
  acknowledgeShieldLoss = false,
) => f.db.transaction(async (tx) => {
  const actor = await clanActor(tx, f.accountIds[accountIndex]!);
  return sendClanWarContribution(tx, {
    actor,
    originPlanetId,
    fleet,
    acknowledgeShieldLoss,
    clock: f.clock,
  });
});

const quote = async (
  f: Fixture,
  accountIndex: number,
  originPlanetId: string,
  fleet: Record<string, number>,
) => quoteClanWarContribution(f.db, {
  actor: await clanActor(f.db, f.accountIds[accountIndex]!),
  originPlanetId,
  fleet,
  clock: f.clock,
});

/** `planetView` needs a transaction; tests only ever want the finished shape. */
const view = (f: Fixture, planetId: string) =>
  f.db.transaction((tx) => planetView(tx, planetId, f.clock));

const readWar = async (f: Fixture, accountIndex: number) =>
  readClanWar(f.db, await clanActor(f.db, f.accountIds[accountIndex]!), f.clock.now());

/**
 * Move the clock to the last joint-war arrival and run the worker.
 *
 * Only those: the galaxy's own `season_end` is also on the queue, and jumping to
 * THAT wipes the world the test is about.
 */
async function landEverything(f: Fixture): Promise<void> {
  const rows = await f.db
    .select({ arriveAt: missions.arriveAt })
    .from(missions)
    .where(eq(missions.status, 'in_flight'));
  const latest = rows.reduce(
    (at, row) => Math.max(at, row.arriveAt.getTime()),
    f.clock.now().getTime(),
  );
  f.clock.set(new Date(latest + 1_000));
  await workerFor(f).tick();
}

/** A clan with a mature member, a marked target, and everybody ready to fly. */
async function readyOperation(f: Fixture): Promise<void> {
  const clanId = await foundClan(f);
  await joinClan(f, clanId, 1);
  await mature(f, f.playerIds[0]!);
  await mature(f, f.playerIds[1]!);
  await markTarget(f, f.planetIds[2]!);
}

/* ── the quote ──────────────────────────────────────────────────── */

describe('quoting a wave', () => {
  it('prices three legs for a member and two for the leader capital', async () => {
    const f = await setup();
    await readyOperation(f);
    const fleet = { DART: 10, COURIER: 2 };

    const member = await quote(f, 1, f.planetIds[1]!, fleet);
    expect(member.ok).toBe(true);
    expect(member.sourceKind).toBe('PHYSICAL');
    expect(member.fuel.legs.map((leg) => leg.leg))
      .toEqual(['ORIGIN_TO_STAGING', 'STAGING_TO_TARGET', 'TARGET_TO_ORIGIN']);
    expect(member.fuel.total).toBe(
      member.fuel.legs.reduce((sum, leg) => sum + leg.fuel, 0),
    );

    const leader = await quote(f, 0, f.planetIds[0]!, fleet);
    expect(leader.sourceKind).toBe('LEADER_CAPITAL');
    expect(leader.fuel.legs.map((leg) => leg.leg))
      .toEqual(['STAGING_TO_TARGET', 'TARGET_TO_STAGING']);
    expect(leader.travel.stagingMinutes).toBe(0);
    expect(leader.travel.stagingEta).toBeNull();
    expect(leader.bays.total).toBe(0);
  });

  it('charges each leg on its own distance, through the one fuel formula', async () => {
    const f = await setup();
    await readyOperation(f);
    const fleet = { DART: 10, COURIER: 2 };
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    const [staging] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const [target] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[2]!));
    const legs = [
      distance(origin!, staging!),
      distance(staging!, target!),
      distance(target!, origin!),
    ];

    const quoted = await quote(f, 1, f.planetIds[1]!, fleet);
    expect(quoted.fuel.total).toBe(missionFuelForDistances(fleet, legs));
    expect(quoted.fuel.legs[0]!.fuel).toBe(missionFuel(fleet, legs[0]!, 1));
  });

  it('shows that a contributed wave frees no personal room at all', async () => {
    const f = await setup();
    await readyOperation(f);
    const quoted = await quote(f, 1, f.planetIds[1]!, { DART: 30 });
    expect(quoted.personalHangar.afterSend).toBe(quoted.personalHangar.used);
    expect(quoted.clanHangar.afterSend).toBe(quoted.bulk);
    expect(quoted.bulk).toBe(hangarLoad({ DART: 30 }));
  });

  it('lists every refusal at once rather than only the first', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 1);
    await mature(f, f.playerIds[0]!);
    await markTarget(f, f.planetIds[2]!);
    // The member is still inside adaptation AND holds a first-day shield.
    await giveNewcomerShield(
      f.db,
      f.playerIds[1]!,
      new Date(f.clock.now().getTime() + 6 * 3_600_000),
    );
    const quoted = await quote(f, 1, f.planetIds[1]!, { DART: 10 });
    const codes = quoted.refusals.map((row) => row.code);
    expect(codes).toContain('CLAN_WAR_MEMBER_IMMATURE');
    expect(codes).toContain('SHIELD_WOULD_DROP');
    expect(quoted.ok).toBe(false);
    expect(quoted.shieldWouldDrop).toMatchObject({ kind: 'NEWCOMER' });
  });

  it('shows a launch shield warning only to the protected operation leader', async () => {
    const f = await setup();
    await readyOperation(f);
    const until = new Date(f.clock.now().getTime() + 6 * 3_600_000);
    await giveNewcomerShield(f.db, f.playerIds[0]!, until);

    const leader = await readWar(f, 0);
    const member = await readWar(f, 1);

    expect(leader.operation?.startShieldWouldDrop).toEqual({
      kind: 'NEWCOMER', until: until.toISOString(),
    });
    expect(member.operation?.startShieldWouldDrop).toBeNull();
  });

  it.each([
    ['protectedUntil', 'OCCUPATION_PROTECTED'],
    ['recoveryUntil', 'WORLD_RECOVERING'],
  ] as const)('refuses a target whose %s began after marking', async (field, code) => {
    const f = await setup();
    await readyOperation(f);
    await f.db.update(planets)
      .set({ [field]: new Date(f.clock.now().getTime() + 3_600_000) })
      .where(eq(planets.id, f.planetIds[2]!));

    const quoted = await quote(f, 0, f.planetIds[0]!, { DART: 10 });
    expect(quoted.ok).toBe(false);
    expect(quoted.refusals).toContainEqual(expect.objectContaining({ code }));
    await expect(send(f, 0, f.planetIds[0]!, { DART: 10 }))
      .rejects.toMatchObject({ code });
    expect(await f.db.select().from(clanWarContributions)).toHaveLength(0);
    expect((await readWar(f, 0)).operation).toMatchObject({ status: 'ASSEMBLING' });
  });

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])('uses the staging Beacon for the combined estimate (origin=%s staging=%s)', async (
    originBeacon,
    stagingBeacon,
  ) => {
    const f = await setup();
    await readyOperation(f);
    if (originBeacon) await giveSatellite(f.db, f.planetIds[1]!, 'BEACON');
    if (stagingBeacon) await giveSatellite(f.db, f.planetIds[0]!, 'BEACON');
    const fleet = { DART: 10 };
    const [staging, target] = await Promise.all([
      f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)).then((rows) => rows[0]!),
      f.db.select().from(planets).where(eq(planets.id, f.planetIds[2]!)).then((rows) => rows[0]!),
    ]);

    const quoted = await quote(f, 1, f.planetIds[1]!, fleet);
    expect(quoted.travel.combinedMinutes).toBe(fleetTravelExact(
      distance(staging, target),
      fleet,
      { boost: fleetSpeedMult(stagingBeacon ? ['BEACON'] : []), tech: {} },
    ));
  });

  it('rejects the exact season edge computed without an origin-only Beacon shortcut', async () => {
    const f = await setup();
    await readyOperation(f);
    await giveSatellite(f.db, f.planetIds[1]!, 'BEACON');
    const fleet = { DART: 10 };
    const [operation] = await f.db.select().from(clanWarOperations);
    const initial = await quote(f, 1, f.planetIds[1]!, fleet);
    f.clock.set(new Date(
      operation!.expiresAt.getTime() - initial.travel.stagingMinutes * 60_000 - 1_000,
    ));
    const authoritative = await quote(f, 1, f.planetIds[1]!, fleet);
    const exactHomeAt = new Date(authoritative.travel.earliestHome!);
    await f.db.update(seasons).set({ endsAt: exactHomeAt })
      .where(eq(seasons.id, f.seasonId));
    expect((await quote(f, 1, f.planetIds[1]!, fleet)).refusals)
      .not.toContainEqual(expect.objectContaining({ code: 'CLAN_WAR_SEASON_TOO_SHORT' }));
    await f.db.update(seasons).set({ endsAt: new Date(exactHomeAt.getTime() - 1) })
      .where(eq(seasons.id, f.seasonId));

    const quoted = await quote(f, 1, f.planetIds[1]!, fleet);
    expect(quoted.refusals).toContainEqual(expect.objectContaining({
      code: 'CLAN_WAR_SEASON_TOO_SHORT',
    }));
    await expect(send(f, 1, f.planetIds[1]!, fleet))
      .rejects.toMatchObject({ code: 'CLAN_WAR_SEASON_TOO_SHORT' });
  });

  it('accepts a wave of nothing but holds', async () => {
    const f = await setup();
    await readyOperation(f);
    const quoted = await quote(f, 1, f.planetIds[1]!, { COURIER: 4 });
    expect(quoted.ok).toBe(true);
  });

  it('refuses ground guns, miners, an empty wave and a fractional count', async () => {
    const f = await setup();
    await readyOperation(f);
    await giveUnits(f.db, f.planetIds[1]!, { BASTION: 4, PROSPECTOR: 2 });
    await expect(quote(f, 1, f.planetIds[1]!, { BASTION: 1 }))
      .rejects.toMatchObject({ code: 'GROUND_UNIT' });
    await expect(quote(f, 1, f.planetIds[1]!, { PROSPECTOR: 1 }))
      .rejects.toMatchObject({ code: 'NOT_A_WARSHIP' });
    await expect(quote(f, 1, f.planetIds[1]!, {}))
      .rejects.toMatchObject({ code: 'EMPTY_FLEET' });
    await expect(quote(f, 1, f.planetIds[1]!, { DART: 1.5 }))
      .rejects.toMatchObject({ code: 'BAD_FLEET' });
  });

  it('refuses a world the sender does not hold, and more ships than stand on it', async () => {
    const f = await setup();
    await readyOperation(f);
    await expect(quote(f, 1, f.planetIds[0]!, { DART: 1 }))
      .rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
    await expect(quote(f, 1, f.planetIds[1]!, { DART: 5_000 }))
      .rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
  });

  it('refuses a commander whose clan has no target at all', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 1);
    await mature(f, f.playerIds[1]!);
    await expect(quote(f, 1, f.planetIds[1]!, { DART: 5 }))
      .rejects.toMatchObject({ code: 'CLAN_WAR_NOT_FOUND' });
  });
});

/* ── dispatch ───────────────────────────────────────────────────── */

describe('committing a wave', () => {
  it('takes the ships off the home stack, keeps them on their own world, and flies', async () => {
    const f = await setup();
    await readyOperation(f);
    const before = await view(f, f.planetIds[1]!);
    const result = await send(f, 1, f.planetIds[1]!, { DART: 30, COURIER: 2 });

    expect(result.sourceKind).toBe('PHYSICAL');
    expect(result.status).toBe('OUTBOUND');
    const after = await view(f, f.planetIds[1]!);
    // Off the ground...
    expect(after.fleet.DART ?? 0).toBe((before.fleet.DART ?? 0) - 30);
    // ...and still on this world's books, so personal room did not move.
    expect(after.capacity.hangarUsed).toBe(before.capacity.hangarUsed);
    // Fuel came out of the tank, once.
    expect(Math.round(before.planet.deuterium - after.planet.deuterium)).toBe(result.fuelPaid);

    const rows = await f.db.select().from(units)
      .where(eq(units.planetId, f.planetIds[1]!));
    const parked = rows.filter((row) => row.location.startsWith('clan-war:'));
    expect(parked.length).toBeGreaterThan(0);
    expect(parked.every((row) => row.ownerPlayerId === f.playerIds[1])).toBe(true);

    const legs = await f.db.select().from(clanWarMissions);
    expect(legs).toHaveLength(1);
    expect(legs[0]!.leg).toBe('SUPPORT_OUT');
    // D212: a joint-war wave is a combat launch for the commander who sent it.
    const [sender] = await f.db.select({ at: players.lastProgressAt }).from(players).where(eq(players.id, f.playerIds[1]!));
    expect(sender!.at).toEqual(f.clock.now());
  });

  it('adds the leader capital instantly, with no flight and no bay', async () => {
    const f = await setup();
    await readyOperation(f);
    const before = await baysOf(f.db, f.planetIds[0]!, 16);
    const result = await send(f, 0, f.planetIds[0]!, { DART: 20 });
    expect(result.status).toBe('STAGED');
    expect(result.stagedAt).not.toBeNull();
    const after = await baysOf(f.db, f.planetIds[0]!, 16);
    expect(after.used).toBe(before.used);
    expect(await f.db.select().from(missions)).toHaveLength(0);
  });

  it('holds one bay per physical wave for its whole life', async () => {
    const f = await setup();
    await readyOperation(f);
    const before = await baysOf(f.db, f.planetIds[1]!, 16);
    await send(f, 1, f.planetIds[1]!, { DART: 10 });
    const after = await baysOf(f.db, f.planetIds[1]!, 16);
    expect(after.used).toBe(before.used + 1);
    // The support flight itself is not counted a second time.
    await landEverything(f);
    const staged = await baysOf(f.db, f.planetIds[1]!, 16);
    expect(staged.used).toBe(before.used + 1);
  });

  it('takes several waves from one world without one overwriting another', async () => {
    const f = await setup();
    await readyOperation(f);
    const first = await send(f, 1, f.planetIds[1]!, { DART: 10 });
    const second = await send(f, 1, f.planetIds[1]!, { DART: 15 });
    expect(first.contributionId).not.toBe(second.contributionId);

    const rows = await f.db.select().from(clanWarContributions);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.unitLocation)).size).toBe(2);
    const parked = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[1]!));
    const total = parked
      .filter((row) => row.location.startsWith('clan-war:') && row.hull === 'DART')
      .reduce((sum, row) => sum + row.count, 0);
    expect(total).toBe(25);
  });

  it('snapshots the sender’s own research, never the leader’s', async () => {
    const f = await setup();
    await readyOperation(f);
    const { giveResearch } = await import('./helpers.js');
    await giveResearch(f.db, f.planetIds[1]!, 'SHIP_POWER', 4);
    await send(f, 1, f.planetIds[1]!, { DART: 10 });
    await send(f, 0, f.planetIds[0]!, { DART: 10 });
    const rows = await f.db.select().from(clanWarContributions);
    const member = rows.find((row) => row.playerId === f.playerIds[1]);
    const leader = rows.find((row) => row.playerId === f.playerIds[0]);
    expect(member!.tech.SHIP_POWER).toBe(4);
    expect(leader!.tech.SHIP_POWER ?? 0).toBe(0);
  });

  it('charges fuel once and gives none of it back', async () => {
    const f = await setup();
    await readyOperation(f);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    const result = await send(f, 1, f.planetIds[1]!, { DART: 10 });
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(Math.round(before!.deuterium - after!.deuterium)).toBe(result.fuelPaid);
    const [row] = await f.db.select().from(clanWarContributions);
    expect(row!.fuelPaid).toBe(result.fuelPaid);
    expect(row!.fuelLegs.reduce((sum, leg) => sum + leg.fuel, 0)).toBe(row!.fuelPaid);
  });

  it('drops the sender’s own shield, once they have said yes', async () => {
    const f = await setup();
    await readyOperation(f);
    await giveNewcomerShield(
      f.db,
      f.playerIds[1]!,
      new Date(f.clock.now().getTime() + 6 * 3_600_000),
    );
    await expect(send(f, 1, f.planetIds[1]!, { DART: 10 }))
      .rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    await send(f, 1, f.planetIds[1]!, { DART: 10 }, true);
    const [row] = await f.db.select().from(players).where(eq(players.id, f.playerIds[1]!));
    expect(row!.newcomerShieldUntil).toBeNull();
  });

  it('refuses an immature member’s hulls', async () => {
    const f = await setup();
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 1);
    await mature(f, f.playerIds[0]!);
    await markTarget(f, f.planetIds[2]!);
    await expect(send(f, 1, f.planetIds[1]!, { DART: 10 }))
      .rejects.toMatchObject({ code: 'CLAN_WAR_MEMBER_IMMATURE' });
  });

  it('refuses a wave the clan hangar has no room for, and one that races for the last slot', async () => {
    const f = await setup();
    await readyOperation(f);
    const [clan] = await f.db.select().from(clans);
    const room = clanHangarCapacity(clan!.level!);
    expect(room).toBe(clanHangarCapacity(1));
    await expect(send(f, 1, f.planetIds[1]!, { DART: 200 }))
      .rejects.toMatchObject({ code: 'CLAN_HANGAR_FULL' });

    // Two waves that each fit alone and cannot both fit.
    const each = Math.ceil((room / hangarLoad({ DART: 1 })) * 0.6);
    const results = await Promise.allSettled([
      send(f, 1, f.planetIds[1]!, { DART: each }),
      send(f, 0, f.planetIds[0]!, { DART: each }),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const rows = await f.db.select().from(clanWarContributions);
    const held = rows.reduce((sum, row) => sum + row.reservedBulk, 0);
    expect(held).toBeLessThanOrEqual(clanHangarCapacity(1));
  });

  it('treats a leader colony like anybody else\u2019s world', async () => {
    const f = await setup();
    await readyOperation(f);
    // Hand the leader a second world and send from it.
    await f.db.update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, statsOwnerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, f.planetIds[3]!));
    await giveUnits(f.db, f.planetIds[3]!, { DART: 20 });
    const result = await send(f, 0, f.planetIds[3]!, { DART: 10 });
    expect(result.sourceKind).toBe('PHYSICAL');
    expect(result.status).toBe('OUTBOUND');
  });

  it('refuses a world with every bay in the air', async () => {
    const f = await setup();
    await readyOperation(f);
    const { total } = await baysOf(f.db, f.planetIds[1]!, 16);
    const bays = await view(f, f.planetIds[1]!);
    for (let sent = 0; sent < bays.flight.total; sent++) {
      await send(f, 1, f.planetIds[1]!, { DART: 1 });
    }
    expect(total).toBeGreaterThan(0);
    await expect(send(f, 1, f.planetIds[1]!, { DART: 1 }))
      .rejects.toMatchObject({ code: 'NO_FREE_BAY' });
  });

  it('refuses a world whose yard is in revolt', async () => {
    const f = await setup();
    await readyOperation(f);
    const { planetFaults } = await import('../src/db/schema.js');
    await f.db.insert(planetFaults).values({
      planetId: f.planetIds[1]!,
      kind: 'SHIPYARD_REVOLT',
      startedAt: f.clock.now(),
    });
    await expect(send(f, 1, f.planetIds[1]!, { DART: 10 }))
      .rejects.toMatchObject({ code: 'FAULT_SHIPYARD' });
  });

  it('refuses a wave with no fuel to fly it', async () => {
    const f = await setup();
    await readyOperation(f);
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, f.planetIds[1]!));
    await expect(send(f, 1, f.planetIds[1]!, { DART: 10 }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });
  });

  it('refuses a wave that could not get home before the galaxy ends', async () => {
    const f = await setup();
    await readyOperation(f);
    // The galaxy ends the instant the target does: a cancelled wave could not
    // possibly fly home after that.
    await f.db.update(seasons)
      .set({ endsAt: new Date(f.clock.now().getTime() + CLAN.warTargetMinutes * 60_000) })
      .where(eq(seasons.id, f.seasonId));
    await expect(send(f, 1, f.planetIds[1]!, { DART: 10 }))
      .rejects.toMatchObject({ code: 'CLAN_WAR_SEASON_TOO_SHORT' });
  });

  it('keeps the staged escrow out of the staging world’s own defence', async () => {
    const f = await setup();
    await readyOperation(f);
    const before = await view(f, f.planetIds[0]!);
    await send(f, 1, f.planetIds[1]!, { DART: 30 });
    await landEverything(f);
    const after = await view(f, f.planetIds[0]!);
    // The wave is staged, and the staging world's own board has not grown.
    expect(after.fleet.DART ?? 0).toBe(before.fleet.DART ?? 0);
    const rows = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!));
    expect(rows.some((row) => row.location.startsWith('clan-war:')
      && row.ownerPlayerId === f.playerIds[1])).toBe(false);
  });
});

/* ── arriving at the staging world ──────────────────────────────── */

describe('a wave reaching the staging world', () => {
  it('becomes STAGED without moving a single ship', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 30 });
    const before = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[1]!));

    await landEverything(f);
    const [row] = await f.db.select().from(clanWarContributions);
    expect(row!.status).toBe('STAGED');
    expect(row!.stagedAt).not.toBeNull();

    const after = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[1]!));
    expect(after.map((r) => `${r.hull}:${r.location}:${String(r.count)}`).sort())
      .toEqual(before.map((r) => `${r.hull}:${r.location}:${String(r.count)}`).sort());
  });

  it('is idempotent under a redelivered arrival', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 30 });
    await landEverything(f);
    const [first] = await f.db.select().from(clanWarContributions);
    await workerFor(f).tick();
    const [second] = await f.db.select().from(clanWarContributions);
    expect(second!.stagedAt?.getTime()).toBe(first!.stagedAt?.getTime());
  });
});

/* ── the pool, as the clan reads it ─────────────────────────────── */

describe('the pool on the clan war screen', () => {
  it('shows every wave, who owns it and what it is', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 10 });
    await send(f, 0, f.planetIds[0]!, { COURIER: 2 });

    const view = await readWar(f, 1);
    expect(view.operation!.contributions).toHaveLength(2);
    expect(view.operation!.pool.participants).toBe(2);
    expect(view.operation!.pool.waves).toBe(2);
    expect(view.operation!.pool.combatHulls).toBe(10);

    const mine = view.operation!.contributions.filter((row) => row.mine);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.playerId).toBe(f.playerIds[1]);
    expect(mine[0]!.canRecall).toBe(true);
    const theirs = view.operation!.contributions.find((row) => !row.mine)!;
    expect(theirs.canRecall).toBe(false);
    expect(theirs.username).toBeTypeOf('string');
  });

  it('counts the clan hangar as used once a wave has landed, reserved while it flies', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 10 });
    const flying = await readWar(f, 1);
    expect(flying.hangar.reserved).toBe(hangarLoad({ DART: 10 }));
    expect(flying.hangar.used).toBe(0);

    await landEverything(f);
    const staged = await readWar(f, 1);
    expect(staged.hangar.used).toBe(hangarLoad({ DART: 10 }));
    expect(staged.hangar.reserved).toBe(0);
  });
});

/* ── the HTTP surface ───────────────────────────────────────────── */

describe('the contribution route', () => {
  it('replays a retry without a second wave, a second bay or a second tankful', async () => {
    const f = await setup();
    await readyOperation(f);
    const { buildApp } = await import('../src/app.js');
    const { TokenService } = await import('../src/auth/tokens.js');
    const { testEnv } = await import('./helpers.js');
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const headers = {
        authorization: `Bearer ${await tokens.issueAccess(f.accountIds[1]!)}`,
        'idempotency-key': 'clan-war-wave-0001',
      };
      const payload = {
        originPlanetId: f.planetIds[1]!,
        fleet: { DART: 20 },
        acknowledgeShieldLoss: false,
      };
      const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
      const [first, replay] = await Promise.all([
        built.app.inject({ method: 'POST', url: '/api/clan/war/contributions', headers, payload }),
        built.app.inject({ method: 'POST', url: '/api/clan/war/contributions', headers, payload }),
      ]);
      expect(first.statusCode).toBe(200);
      expect(replay.json()).toEqual(first.json());
      expect(first.json()).toMatchObject({
        war: {
          status: 'ASSEMBLING',
          contributions: [expect.objectContaining({ status: 'OUTBOUND', mine: true })],
        },
      });
      expect(first.json<{ traffic: { contacts: unknown[] } }>().traffic.contacts)
        .toBeInstanceOf(Array);

      const waves = await f.db.select().from(clanWarContributions);
      expect(waves).toHaveLength(1);
      const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
      expect(Math.round(before!.deuterium - after!.deuterium)).toBe(waves[0]!.fuelPaid);
      expect(await f.db.select().from(clanWarMissions)).toHaveLength(1);
    } finally {
      await built.close();
    }
  });

  it('quotes over HTTP without committing anything', async () => {
    const f = await setup();
    await readyOperation(f);
    const { buildApp } = await import('../src/app.js');
    const { TokenService } = await import('../src/auth/tokens.js');
    const { testEnv } = await import('./helpers.js');
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const response = await built.app.inject({
        method: 'POST',
        url: '/api/clan/war/contributions/quote',
        headers: { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[1]!)}` },
        payload: { originPlanetId: f.planetIds[1]!, fleet: { DART: 20 } },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ ok: true, sourceKind: 'PHYSICAL' });
      expect(await f.db.select().from(clanWarContributions)).toHaveLength(0);
    } finally {
      await built.close();
    }
  });
});
