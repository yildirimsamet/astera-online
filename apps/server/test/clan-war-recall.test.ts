import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { CLAN, MULTI_WORLD, hangarLoad } from '@astera/rules';
import {
  clanWarContributions,
  clanWarMissions,
  clanWarOperations,
  missions,
  planets,
  seasons,
  units,
} from '../src/db/schema.js';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  createClan,
  disbandClan,
  kickClanMember,
  leaveClan,
  transferClanLeadership,
} from '../src/services/clan.js';
import {
  cancelClanWarOperation,
  markClanWarTarget,
  readClanWar,
  recallClanWarContribution,
  sendClanWarContribution,
} from '../src/services/clanWar.js';
import { baysOf } from '../src/services/flight.js';
import { rememberWorld } from '../src/services/intel.js';
import { planetView } from '../src/services/planetView.js';
import { EventWorker } from '../src/worker/loop.js';
import {
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

async function setup(count = 4): Promise<Fixture> {
  const f = await seedWorld(count, 606606);
  await f.db.update(seasons).set({ rulesetVersion: JOINT }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) {
    await grant(f.db, planetId, 600_000, 300_000);
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(f.db, f.planetIds);
  for (const planetId of f.planetIds) {
    await setLevel(f.db, planetId, 'HANGAR', 10);
    await giveUnits(f.db, planetId, { DART: 200, COURIER: 20 });
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

async function mature(f: Fixture, playerId: string): Promise<void> {
  const { clanMemberships } = await import('../src/db/schema.js');
  const joinedAt = new Date(f.clock.now().getTime() - 13 * 3_600_000);
  await f.db.update(clanMemberships)
    .set({ joinedAt, matureAt: new Date(joinedAt.getTime() + CLAN.adaptationMinutes * 60_000) })
    .where(eq(clanMemberships.playerId, playerId));
}

async function readyOperation(f: Fixture): Promise<string> {
  const leader = await clanActor(f.db, f.accountIds[0]!);
  const created = await f.db.transaction((tx) => createClan(tx, {
    actor: leader,
    name: 'Orion Guard',
    tag: 'OG',
    description: 'One horizon.',
    recruiting: true,
    clock: f.clock,
  }));
  for (const index of [1, 3]) {
    const candidate = await clanActor(f.db, f.accountIds[index]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate,
      clanId: created.clanId,
      now: f.clock.now(),
    }));
    await f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: true,
      now: f.clock.now(),
    }));
  }
  for (const index of [0, 1, 3]) await mature(f, f.playerIds[index]!);
  await f.db.transaction(async (tx) => markClanWarTarget(tx, {
    actor: await clanActor(tx, f.accountIds[0]!),
    targetPlanetId: f.planetIds[2]!,
    clock: f.clock,
  }));
  return created.clanId;
}

const send = (f: Fixture, accountIndex: number, originPlanetId: string, fleet: Record<string, number>) =>
  f.db.transaction(async (tx) => sendClanWarContribution(tx, {
    actor: await clanActor(tx, f.accountIds[accountIndex]!),
    originPlanetId,
    fleet,
    acknowledgeShieldLoss: false,
    clock: f.clock,
  }));

const recall = (f: Fixture, accountIndex: number, contributionId: string) =>
  f.db.transaction(async (tx) => recallClanWarContribution(tx, {
    actor: await clanActor(tx, f.accountIds[accountIndex]!),
    contributionId,
    clock: f.clock,
  }));

const cancel = (f: Fixture) =>
  f.db.transaction(async (tx) => cancelClanWarOperation(tx, {
    actor: await clanActor(tx, f.accountIds[0]!),
    clock: f.clock,
  }));

const view = (f: Fixture, planetId: string) =>
  f.db.transaction((tx) => planetView(tx, planetId, f.clock));

const readWar = async (f: Fixture, accountIndex: number) =>
  readClanWar(f.db, await clanActor(f.db, f.accountIds[accountIndex]!), f.clock.now());

const contributionRows = (f: Fixture) => f.db.select().from(clanWarContributions);
const operationRow = async (f: Fixture) => {
  const [row] = await f.db.select().from(clanWarOperations);
  return row!;
};

/* ── recall ─────────────────────────────────────────────────────── */

describe('recalling your own wave', () => {
  it('lets a wave still in the air finish its leg, then turn round', async () => {
    const f = await setup();
    await readyOperation(f);
    const wave = await send(f, 1, f.planetIds[1]!, { DART: 30 });

    const ordered = await recall(f, 1, wave.contributionId);
    expect(ordered.status).toBe('RECALL_ORDERED');
    // Nothing flies backwards in space: the outbound leg is untouched.
    const legs = await f.db.select().from(clanWarMissions);
    expect(legs).toHaveLength(1);
    expect(legs[0]!.leg).toBe('SUPPORT_OUT');

    await landEverything(f);
    const [afterLanding] = await contributionRows(f);
    expect(afterLanding!.status).toBe('RETURNING');
    const both = await f.db.select().from(clanWarMissions);
    expect(both.map((row) => row.leg).sort()).toEqual(['SUPPORT_OUT', 'SUPPORT_RETURN']);

    await landEverything(f);
    const [home] = await contributionRows(f);
    expect(home!.status).toBe('HOME');
  });

  it('sends a staged wave home immediately, and gives the ships back', async () => {
    const f = await setup();
    await readyOperation(f);
    const before = await view(f, f.planetIds[1]!);
    const wave = await send(f, 1, f.planetIds[1]!, { DART: 30 });
    await landEverything(f);

    const recalled = await recall(f, 1, wave.contributionId);
    expect(recalled.status).toBe('RETURNING');
    await landEverything(f);

    const after = await view(f, f.planetIds[1]!);
    expect(after.fleet.DART ?? 0).toBe(before.fleet.DART ?? 0);
    const parked = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[1]!));
    expect(parked.some((row) => row.location.startsWith('clan-war:'))).toBe(false);
  });

  it('stands the leader capital wave down on the spot', async () => {
    const f = await setup();
    await readyOperation(f);
    const before = await view(f, f.planetIds[0]!);
    const wave = await send(f, 0, f.planetIds[0]!, { DART: 40 });
    const recalled = await recall(f, 0, wave.contributionId);
    expect(recalled.status).toBe('HOME');
    const after = await view(f, f.planetIds[0]!);
    expect(after.fleet.DART ?? 0).toBe(before.fleet.DART ?? 0);
    expect(await f.db.select().from(missions)).toHaveLength(0);
  });

  it('is somebody else’s to give, never yours', async () => {
    const f = await setup();
    await readyOperation(f);
    const wave = await send(f, 1, f.planetIds[1]!, { DART: 10 });
    await expect(recall(f, 3, wave.contributionId))
      .rejects.toMatchObject({ code: 'CLAN_WAR_CONTRIBUTION_NOT_OWNED' });
    await expect(recall(f, 0, wave.contributionId))
      .rejects.toMatchObject({ code: 'CLAN_WAR_CONTRIBUTION_NOT_OWNED' });
  });

  it('answers a repeated recall with the state, not a second return', async () => {
    const f = await setup();
    await readyOperation(f);
    const wave = await send(f, 1, f.planetIds[1]!, { DART: 30 });
    await landEverything(f);
    const first = await recall(f, 1, wave.contributionId);
    const second = await recall(f, 1, wave.contributionId);
    expect(second.status).toBe(first.status);
    const returns = await f.db.select().from(clanWarMissions);
    expect(returns.filter((row) => row.leg === 'SUPPORT_RETURN')).toHaveLength(1);
  });

  it('frees the clan hangar the moment it is ordered back', async () => {
    const f = await setup();
    await readyOperation(f);
    const wave = await send(f, 1, f.planetIds[1]!, { DART: 30 });
    const held = await readWar(f, 1);
    expect(held.hangar.reserved).toBe(hangarLoad({ DART: 30 }));
    await recall(f, 1, wave.contributionId);
    const freed = await readWar(f, 1);
    expect(freed.hangar.used + freed.hangar.reserved).toBe(0);
  });

  it('keeps the flight bay until the ships are actually home', async () => {
    const f = await setup();
    await readyOperation(f);
    const before = await baysOf(f.db, f.planetIds[1]!, 16);
    const wave = await send(f, 1, f.planetIds[1]!, { DART: 30 });
    await landEverything(f);
    await recall(f, 1, wave.contributionId);
    const returning = await baysOf(f.db, f.planetIds[1]!, 16);
    expect(returning.used).toBe(before.used + 1);
    await landEverything(f);
    const landed = await baysOf(f.db, f.planetIds[1]!, 16);
    expect(landed.used).toBe(before.used);
  });

  it('takes no extra fuel and gives none back', async () => {
    const f = await setup();
    await readyOperation(f);
    const wave = await send(f, 1, f.planetIds[1]!, { DART: 30 });
    const [afterSend] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    await landEverything(f);
    await recall(f, 1, wave.contributionId);
    await landEverything(f);
    const [afterHome] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(Math.round(afterHome!.deuterium)).toBe(Math.round(afterSend!.deuterium));
  });
});

/* ── cancel and expiry send everybody home ──────────────────────── */

describe('closing an operation with waves in it', () => {
  it('returns every wave on a leader cancel, and finishes when the last lands', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await send(f, 3, f.planetIds[3]!, { DART: 15 });
    await send(f, 0, f.planetIds[0]!, { DART: 15 });
    await landEverything(f);

    const { operation } = await cancel(f);
    expect(operation.status).toBe('RETURNING');
    expect(operation.closeReason).toBe('LEADER_CANCEL');
    const rows = await contributionRows(f);
    expect(rows.find((row) => row.sourceKind === 'LEADER_CAPITAL')!.status).toBe('HOME');
    expect(rows.filter((row) => row.status === 'RETURNING')).toHaveLength(2);

    await landEverything(f);
    const settled = await operationRow(f);
    expect(settled.status).toBe('COMPLETED');
    expect(settled.completedAt).not.toBeNull();
  });

  /**
   * A wave still in the AIR when its operation closes is the awkward case: it
   * cannot turn round, so the close only records the order and the wave acts on
   * it the moment it lands. Driven with a cancel rather than an expiry, because
   * an expiry needs a day of clock and every support flight takes minutes.
   */
  it('orders a wave still in the air back, and it turns round when it lands', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });

    const { operation } = await cancel(f);
    expect(operation.status).toBe('RETURNING');
    const [ordered] = await contributionRows(f);
    expect(ordered!.status).toBe('RECALL_ORDERED');
    expect(await f.db.select().from(clanWarMissions)).toHaveLength(1);

    await landEverything(f);
    const [returning] = await contributionRows(f);
    expect(returning!.status).toBe('RETURNING');
    await landEverything(f);
    const [home] = await contributionRows(f);
    expect(home!.status).toBe('HOME');
    expect((await operationRow(f)).status).toBe('COMPLETED');
  });

  it('sends a staged wave home when the target\u2019s day runs out', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    f.clock.set(new Date(f.clock.now().getTime() + CLAN.warTargetMinutes * 60_000 + 1_000));
    await workerFor(f).tick();

    const op = await operationRow(f);
    expect(op.closeReason).toBe('EXPIRED');
    expect(op.status).toBe('RETURNING');
    const [returning] = await contributionRows(f);
    expect(returning!.status).toBe('RETURNING');

    await landEverything(f);
    const [home] = await contributionRows(f);
    expect(home!.status).toBe('HOME');
    expect((await operationRow(f)).status).toBe('COMPLETED');
  });

  it('refuses a new target until the last wave is home', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 15 });
    await landEverything(f);
    await cancel(f);
    await expect(f.db.transaction(async (tx) => markClanWarTarget(tx, {
      actor: await clanActor(tx, f.accountIds[0]!),
      targetPlanetId: f.planetIds[3]!,
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_ALREADY_OPEN' });

    await landEverything(f);
    await expect(f.db.transaction(async (tx) => markClanWarTarget(tx, {
      actor: await clanActor(tx, f.accountIds[0]!),
      targetPlanetId: f.planetIds[2]!,
      clock: f.clock,
    }))).resolves.toBeDefined();
  });

  it('completes immediately when a recall empties the pool of a closing operation', async () => {
    const f = await setup();
    await readyOperation(f);
    const wave = await send(f, 0, f.planetIds[0]!, { DART: 20 });
    const { operation } = await cancel(f);
    expect(operation.status).toBe('COMPLETED');
    const [row] = await contributionRows(f);
    expect(row!.status).toBe('HOME');
    expect(wave.contributionId).toBe(row!.id);
  });
});

/* ── membership while the outcome is undecided ──────────────────── */

describe('membership during an operation', () => {
  it('holds a contributor in the clan until the outcome is settled', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });

    const member = await clanActor(f.db, f.accountIds[1]!);
    await expect(f.db.transaction((tx) => leaveClan(tx, { actor: member, now: f.clock.now() })))
      .rejects.toMatchObject({ code: 'CLAN_WAR_MEMBERSHIP_LOCKED' });
    const leader = await clanActor(f.db, f.accountIds[0]!);
    await expect(f.db.transaction((tx) => kickClanMember(tx, {
      actor: leader, playerId: f.playerIds[1]!, now: f.clock.now(),
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_MEMBERSHIP_LOCKED' });
  });

  it('holds them even after their own wave has come home', async () => {
    const f = await setup();
    await readyOperation(f);
    const wave = await send(f, 1, f.planetIds[1]!, { DART: 20 });
    await landEverything(f);
    await recall(f, 1, wave.contributionId);
    await landEverything(f);
    const [row] = await contributionRows(f);
    expect(row!.status).toBe('HOME');

    const member = await clanActor(f.db, f.accountIds[1]!);
    await expect(f.db.transaction((tx) => leaveClan(tx, { actor: member, now: f.clock.now() })))
      .rejects.toMatchObject({ code: 'CLAN_WAR_MEMBERSHIP_LOCKED' });
  });

  it('lets a member who committed nothing come and go', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });
    const bystander = await clanActor(f.db, f.accountIds[3]!);
    await expect(f.db.transaction((tx) => leaveClan(tx, { actor: bystander, now: f.clock.now() })))
      .resolves.toMatchObject({ left: true });
  });

  it('blocks a leadership handover and a disband while the pool stands', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });
    const leader = await clanActor(f.db, f.accountIds[0]!);
    await expect(f.db.transaction((tx) => transferClanLeadership(tx, {
      actor: leader, playerId: f.playerIds[1]!, now: f.clock.now(),
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_MEMBERSHIP_LOCKED' });
    await expect(f.db.transaction((tx) => disbandClan(tx, {
      actor: leader, now: f.clock.now(), acknowledgeTreasuryBurn: true,
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_MEMBERSHIP_LOCKED' });
  });

  it('blocks a leadership handover and a disband as soon as a target is marked', async () => {
    const f = await setup();
    await readyOperation(f);
    const leader = await clanActor(f.db, f.accountIds[0]!);

    await expect(f.db.transaction((tx) => transferClanLeadership(tx, {
      actor: leader, playerId: f.playerIds[1]!, now: f.clock.now(),
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_MEMBERSHIP_LOCKED' });
    await expect(f.db.transaction((tx) => disbandClan(tx, {
      actor: leader, now: f.clock.now(), acknowledgeTreasuryBurn: true,
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_MEMBERSHIP_LOCKED' });
  });

  it('lets everybody move again once the operation is settled, even mid-flight', async () => {
    const f = await setup();
    await readyOperation(f);
    await send(f, 1, f.planetIds[1]!, { DART: 20 });
    await landEverything(f);
    await cancel(f);
    // The wave is still flying home, and the outcome is already final.
    const [row] = await contributionRows(f);
    expect(row!.status).toBe('RETURNING');
    const member = await clanActor(f.db, f.accountIds[1]!);
    await expect(f.db.transaction((tx) => leaveClan(tx, { actor: member, now: f.clock.now() })))
      .resolves.toMatchObject({ left: true });
  });

  it('lets a commander leave a clan that never opened an operation', async () => {
    const f = await setup();
    await readyOperation(f);
    const member = await clanActor(f.db, f.accountIds[1]!);
    await expect(f.db.transaction((tx) => leaveClan(tx, { actor: member, now: f.clock.now() })))
      .resolves.toMatchObject({ left: true });
  });
});
