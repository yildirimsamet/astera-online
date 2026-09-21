import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { CLAN, MULTI_WORLD } from '@astera/rules';
import {
  clanWarOperations,
  planets,
  players,
  scheduledEvents,
  seasons,
} from '../src/db/schema.js';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  createClan,
} from '../src/services/clan.js';
import {
  cancelClanWarOperation,
  markClanWarTarget,
  readClanWar,
  startClanWar,
} from '../src/services/clanWar.js';
import { idempotentMutation } from '../src/services/idempotency.js';
import { rememberWorld } from '../src/services/intel.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveNewcomerShield,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const JOINT: number = MULTI_WORLD.clanJointWarRulesetVersion;
const MINUTE = 60_000;

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

async function setup(count = 4, rulesetVersion = JOINT): Promise<Fixture> {
  const f = await seedWorld(count, 401401);
  await f.db.update(seasons).set({ rulesetVersion }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) {
    await grant(f.db, planetId, 400_000, 200_000);
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(f.db, f.planetIds);
  return f;
}

/** Every commander in the fixture has found every other commander's world. */
async function discoverAll(f: Fixture): Promise<void> {
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
}

async function foundClan(f: Fixture, leaderIndex = 0, tag = 'OG'): Promise<string> {
  const actor = await clanActor(f.db, f.accountIds[leaderIndex]!);
  const result = await f.db.transaction((tx) => createClan(tx, {
    actor,
    name: `Guard ${tag}`,
    tag,
    description: 'One horizon.',
    recruiting: true,
    clock: f.clock,
  }));
  return result.clanId;
}

async function joinClan(
  f: Fixture,
  clanId: string,
  leaderIndex: number,
  candidateIndex: number,
): Promise<void> {
  const candidate = await clanActor(f.db, f.accountIds[candidateIndex]!);
  const application = await f.db.transaction((tx) => applyToClan(tx, {
    actor: candidate,
    clanId,
    now: f.clock.now(),
  }));
  const leader = await clanActor(f.db, f.accountIds[leaderIndex]!);
  await f.db.transaction((tx) => acceptClanRequest(tx, {
    actor: leader,
    requestId: application.requestId,
    acknowledgeHostile: true,
    now: f.clock.now(),
  }));
}

const mark = (f: Fixture, accountIndex: number, targetPlanetId: string) =>
  f.db.transaction(async (tx) => {
    const actor = await clanActor(tx, f.accountIds[accountIndex]!);
    return markClanWarTarget(tx, { actor, targetPlanetId, clock: f.clock });
  });

const cancel = (f: Fixture, accountIndex: number) =>
  f.db.transaction(async (tx) => {
    const actor = await clanActor(tx, f.accountIds[accountIndex]!);
    return cancelClanWarOperation(tx, { actor, clock: f.clock });
  });

const readWar = async (f: Fixture, accountIndex: number) =>
  readClanWar(f.db, await clanActor(f.db, f.accountIds[accountIndex]!), f.clock.now());

const operationRow = async (f: Fixture) => {
  const [row] = await f.db.select().from(clanWarOperations)
    .where(eq(clanWarOperations.seasonId, f.seasonId));
  return row;
};

async function whileStagingIsLocked(f: Fixture, action: () => Promise<void>): Promise<void> {
  let announceLocked!: () => void;
  let release!: () => void;
  const locked = new Promise<void>((resolve) => { announceLocked = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  const holder = f.db.transaction(async (tx) => {
    await tx.select({ id: planets.id }).from(planets)
      .where(eq(planets.id, f.planetIds[0]!))
      .for('update');
    announceLocked();
    await released;
  });
  await locked;
  try {
    await action();
  } finally {
    release();
    await holder;
  }
}

/* ── who may mark, and what ─────────────────────────────────────── */

describe('marking a joint war target', () => {
  it('snapshots the target and the leader capital, and starts a 24 hour clock', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    const { operation } = await mark(f, 0, f.planetIds[1]!);

    expect(operation.status).toBe('ASSEMBLING');
    expect(operation.target.planetId).toBe(f.planetIds[1]);
    expect(operation.target.playerId).toBe(f.playerIds[1]);
    expect(operation.staging.planetId).toBe(f.planetIds[0]);
    expect(new Date(operation.expiresAt).getTime() - new Date(operation.createdAt).getTime())
      .toBe(CLAN.warTargetMinutes * MINUTE);

    const row = await operationRow(f);
    expect(row!.targetPlanetName).toBeTypeOf('string');
    expect(row!.clanTag).toBe('OG');
  });

  it('is the leader’s alone', async () => {
    const f = await setup();
    await discoverAll(f);
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 0, 1);
    await expect(mark(f, 1, f.planetIds[2]!))
      .rejects.toMatchObject({ code: 'CLAN_WAR_LEADER_ONLY' });
  });

  it('refuses a commander who leads no clan', async () => {
    const f = await setup();
    await discoverAll(f);
    await expect(mark(f, 0, f.planetIds[1]!))
      .rejects.toMatchObject({ code: 'CLAN_WAR_LEADER_ONLY' });
  });

  it('refuses a caretaker world', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await f.db.update(planets)
      .set({ kind: 'NEUTRAL', controllerPlayerId: null, statsOwnerPlayerId: null })
      .where(eq(planets.id, f.planetIds[3]!));
    await expect(mark(f, 0, f.planetIds[3]!))
      .rejects.toMatchObject({ code: 'CLAN_WAR_TARGET_INVALID' });
  });

  it('refuses a world the leader has never found', async () => {
    const f = await setup();
    await foundClan(f);
    // Out past every sensor the leader owns, and never probed.
    await f.db.update(planets).set({ x: 90_000, y: 90_000, z: 90_000 })
      .where(eq(planets.id, f.planetIds[3]!));
    await expect(mark(f, 0, f.planetIds[3]!))
      .rejects.toMatchObject({ code: 'CLAN_WAR_TARGET_UNDISCOVERED' });
  });

  it('accepts a world found only through probe memory, wherever it sits', async () => {
    const f = await setup();
    await foundClan(f);
    await f.db.update(planets).set({ x: 90_000, y: 90_000, z: 90_000 })
      .where(eq(planets.id, f.planetIds[3]!));
    await f.db.transaction((tx) => rememberWorld(tx, {
      observerPlayerId: f.playerIds[0]!,
      targetPlanetId: f.planetIds[3]!,
      seasonId: f.seasonId,
      seenAt: f.clock.now(),
      source: 'PROBE',
    }));
    await expect(mark(f, 0, f.planetIds[3]!)).resolves.toBeDefined();
  });

  it('refuses a clanmate', async () => {
    const f = await setup();
    await discoverAll(f);
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 0, 1);
    await expect(mark(f, 0, f.planetIds[1]!))
      .rejects.toMatchObject({ code: 'CLAN_FRIENDLY_FIRE' });
  });

  it('refuses a shielded commander without spending the leader’s own shield', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    const until = new Date(f.clock.now().getTime() + 6 * 3_600_000);
    await giveNewcomerShield(f.db, f.playerIds[1]!, until);
    await giveNewcomerShield(f.db, f.playerIds[0]!, until);
    await expect(mark(f, 0, f.planetIds[1]!))
      .rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
    // Marking spends nothing, so the leader keeps their own window.
    const [leader] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    expect(leader!.newcomerShieldUntil).not.toBeNull();
  });

  it('refuses a commander outside the leader’s own development band', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 1);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 16);
    await expect(mark(f, 0, f.planetIds[1]!))
      .rejects.toMatchObject({ code: 'TIER_BAND_WEAK' });
  });

  it('refuses a protected world', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await f.db.update(planets)
      .set({ protectedUntil: new Date(f.clock.now().getTime() + 3_600_000) })
      .where(eq(planets.id, f.planetIds[1]!));
    await expect(mark(f, 0, f.planetIds[1]!))
      .rejects.toMatchObject({ code: 'OCCUPATION_PROTECTED' });
  });

  it('refuses a galaxy that ends before the day is up', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await f.db.update(seasons)
      .set({ endsAt: new Date(f.clock.now().getTime() + 12 * 3_600_000) })
      .where(eq(seasons.id, f.seasonId));
    await expect(mark(f, 0, f.planetIds[1]!))
      .rejects.toMatchObject({ code: 'CLAN_WAR_SEASON_TOO_SHORT' });
  });

  it('is closed in a galaxy dealt before the ruleset', async () => {
    const f = await setup(4, JOINT - 1);
    await discoverAll(f);
    await foundClan(f);
    await expect(mark(f, 0, f.planetIds[1]!))
      .rejects.toMatchObject({ code: 'CLAN_JOINT_WAR_UNAVAILABLE' });
  });

  it('allows exactly one open operation, and says which state is in the way', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);
    await expect(mark(f, 0, f.planetIds[2]!))
      .rejects.toMatchObject({ code: 'CLAN_WAR_ALREADY_OPEN' });
  });

  it('tells the defender nothing at all', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);
    const { notifications } = await import('../src/db/schema.js');
    const rows = await f.db.select().from(notifications)
      .where(eq(notifications.playerId, f.playerIds[1]!));
    expect(rows).toHaveLength(0);
  });

  it('shares identity and coordinates with the clan, and no intel at all', async () => {
    const f = await setup();
    await discoverAll(f);
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 0, 2);
    await mark(f, 0, f.planetIds[1]!);

    // An immature member sees the target and the countdown.
    const view = await readWar(f, 2);
    expect(view.operation!.target.planetId).toBe(f.planetIds[1]);
    expect(view.operation!.target.username).toBeTypeOf('string');
    expect(view.serverNow).toBe(f.clock.now().toISOString());
    // Nothing about the target's fleet, buildings or stores travels with it.
    const payload = JSON.stringify(view.operation);
    expect(payload).not.toContain('silhouette');
    expect(payload).not.toContain('coreLevel');
  });
});

/* ── cancelling and expiry ──────────────────────────────────────── */

describe('closing an operation', () => {
  it('lets the leader cancel and immediately mark again', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);
    const { operation } = await cancel(f, 0);
    // No waves were ever sent, so the operation finishes in the same transaction.
    expect(operation.status).toBe('COMPLETED');
    expect(operation.closeReason).toBe('LEADER_CANCEL');
    await expect(mark(f, 0, f.planetIds[2]!)).resolves.toBeDefined();
  });

  it('refuses a cancel from a member, and a cancel with nothing open', async () => {
    const f = await setup();
    await discoverAll(f);
    const clanId = await foundClan(f);
    await joinClan(f, clanId, 0, 1);
    await expect(cancel(f, 0)).rejects.toMatchObject({ code: 'CLAN_WAR_NOT_FOUND' });
    await mark(f, 0, f.planetIds[2]!);
    await expect(cancel(f, 1)).rejects.toMatchObject({ code: 'CLAN_WAR_LEADER_ONLY' });
  });

  it('expires itself on the worker’s timer, exactly once', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);
    const scheduled = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'clan_war_expiry'));
    expect(scheduled).toHaveLength(1);

    f.clock.set(new Date(f.clock.now().getTime() + CLAN.warTargetMinutes * MINUTE));
    const worker = workerFor(f);
    await worker.tick();
    await worker.tick();

    const row = await operationRow(f);
    expect(row!.status).toBe('COMPLETED');
    expect(row!.closeReason).toBe('EXPIRED');
    const all = await f.db.select().from(clanWarOperations);
    expect(all).toHaveLength(1);
  });

  it('finishes an expired target inline when a read notices it first', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);
    f.clock.set(new Date(f.clock.now().getTime() + CLAN.warTargetMinutes * MINUTE + 1_000));

    const view = await readWar(f, 0);
    expect(view.operation).toBeNull();
    const row = await operationRow(f);
    expect(row!.closeReason).toBe('EXPIRED');
    // And the worker running afterwards changes nothing.
    await workerFor(f).tick();
    const after = await operationRow(f);
    expect(after!.completedAt?.getTime()).toBe(row!.completedAt?.getTime());
  });

  it('refuses a new target while the last one is still expired-but-open on the clock', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);
    // One second before the deadline the old target still holds the clan.
    f.clock.set(new Date(f.clock.now().getTime() + CLAN.warTargetMinutes * MINUTE - 1_000));
    await expect(mark(f, 0, f.planetIds[2]!))
      .rejects.toMatchObject({ code: 'CLAN_WAR_ALREADY_OPEN' });
    // One second after it, marking succeeds because the mark finalises it inline.
    f.clock.set(new Date(f.clock.now().getTime() + 2_000));
    await expect(mark(f, 0, f.planetIds[2]!)).resolves.toBeDefined();
  });
});

/* ── target drift ───────────────────────────────────────────────── */

describe('a target that stops being the target', () => {
  it('cancels when the world changes hands', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);

    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: f.planetIds[1]!,
      newPlayerId: f.playerIds[3]!,
      expectedControllerPlayerId: f.playerIds[1]!,
      protectedUntil: f.clock.now(),
      now: f.clock.now(),
    }));
    const row = await operationRow(f);
    expect(row!.status).toBe('COMPLETED');
    expect(row!.closeReason).toBe('TARGET_CHANGED');
  });

  it('cancels when the target joins the attacking clan', async () => {
    const f = await setup();
    await discoverAll(f);
    const clanId = await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);
    await joinClan(f, clanId, 0, 1);
    const row = await operationRow(f);
    expect(row!.status).toBe('COMPLETED');
    expect(row!.closeReason).toBe('TARGET_CHANGED');
  });

  it('closes on the next read when an ownership hook skipped a locked staging world', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);

    await whileStagingIsLocked(f, async () => {
      await f.db.transaction((tx) => transferPlanetControl(tx, {
        targetPlanetId: f.planetIds[1]!,
        newPlayerId: f.playerIds[3]!,
        expectedControllerPlayerId: f.playerIds[1]!,
        protectedUntil: f.clock.now(),
        now: f.clock.now(),
      }));
      expect((await operationRow(f))!.status).toBe('ASSEMBLING');
    });

    expect((await readWar(f, 0)).operation).toBeNull();
    expect(await operationRow(f)).toMatchObject({
      status: 'COMPLETED',
      closeReason: 'TARGET_CHANGED',
    });
  });

  it('closes on the next read when a membership hook skipped a locked staging world', async () => {
    const f = await setup();
    await discoverAll(f);
    const clanId = await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);

    await whileStagingIsLocked(f, async () => {
      await joinClan(f, clanId, 0, 1);
      expect((await operationRow(f))!.status).toBe('ASSEMBLING');
    });

    expect((await readWar(f, 0)).operation).toBeNull();
    expect(await operationRow(f)).toMatchObject({
      status: 'COMPLETED',
      closeReason: 'TARGET_CHANGED',
    });
  });

  it('commits target drift before the start request returns its refusal', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);
    await whileStagingIsLocked(f, async () => {
      await f.db.transaction((tx) => transferPlanetControl(tx, {
        targetPlanetId: f.planetIds[1]!,
        newPlayerId: f.playerIds[3]!,
        expectedControllerPlayerId: f.playerIds[1]!,
        protectedUntil: f.clock.now(),
        now: f.clock.now(),
      }));
    });
    const actor = await clanActor(f.db, f.accountIds[0]!);

    await expect(idempotentMutation(f.db, {
      playerId: actor.playerId,
      operation: 'test.clan-war.target-drift',
      key: 'target-drift-start-0001',
      body: {},
      now: f.clock.now(),
    }, (tx) => startClanWar(tx, {
      actor,
      acknowledgeShieldLoss: false,
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CLAN_WAR_TARGET_CHANGED' });

    expect(await operationRow(f)).toMatchObject({
      status: 'COMPLETED',
      closeReason: 'TARGET_CHANGED',
    });
  });

  it('leaves the operation alone when the target merely becomes protected', async () => {
    const f = await setup();
    await discoverAll(f);
    await foundClan(f);
    await mark(f, 0, f.planetIds[1]!);
    await f.db.update(planets)
      .set({ protectedUntil: new Date(f.clock.now().getTime() + 3_600_000) })
      .where(eq(planets.id, f.planetIds[1]!));
    const row = await operationRow(f);
    expect(row!.status).toBe('ASSEMBLING');
    expect(row!.closeReason).toBeNull();
  });

  it('leaves another clan’s operation alone when a commander joins this one', async () => {
    const f = await setup(5);
    await discoverAll(f);
    const first = await foundClan(f, 0, 'OG');
    await foundClan(f, 3, 'ZZ');
    await mark(f, 3, f.planetIds[1]!);
    await joinClan(f, first, 0, 1);
    const row = await operationRow(f);
    expect(row!.status).toBe('ASSEMBLING');
  });
});

/* ── the war read ───────────────────────────────────────────────── */

describe('the clan war read', () => {
  it('has no operation before one is marked, and the purse beside it', async () => {
    const f = await setup();
    await foundClan(f);
    const view = await readWar(f, 0);
    expect(view.operation).toBeNull();
    expect(view.available).toBe(true);
    expect(view.level).toBe(1);
  });

  it('is refused to a commander outside the clan', async () => {
    const f = await setup();
    await foundClan(f);
    await expect(readWar(f, 2)).rejects.toMatchObject({ code: 'NOT_IN_CLAN' });
  });

  it('reports nothing in a galaxy dealt before the ruleset', async () => {
    const f = await setup(4, JOINT - 1);
    await foundClan(f);
    const view = await readWar(f, 0);
    expect(view.available).toBe(false);
    expect(view.operation).toBeNull();
  });
});
