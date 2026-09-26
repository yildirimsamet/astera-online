import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  battleReports,
  clanWarContributions,
  clanWarDominionEvents,
  clanWarMissions,
  clanWarOperations,
  clanWarParticipantResults,
  clanTreasuryEvents,
  clans,
  eventKind,
  missionKind,
  missions,
} from '../src/db/schema.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(3); });
afterAll(async () => { await (await testDb()).close(); });

const HOUR = 3_600_000;

async function makeClan(tag = 'OG', level: number | null = 1): Promise<string> {
  const [row] = await f.db.insert(clans).values({
    seasonId: f.seasonId,
    name: `Clan ${tag}`,
    nameKey: `clan ${tag}`.toLowerCase(),
    tag,
    level,
    createdAt: f.clock.now(),
  }).returning({ id: clans.id });
  return row!.id;
}

function operationRow(clanId: string, over: Partial<typeof clanWarOperations.$inferInsert> = {}) {
  const createdAt = f.clock.now();
  return {
    seasonId: f.seasonId,
    clanId,
    clanName: 'Clan OG',
    clanTag: 'OG',
    leaderPlayerId: f.playerIds[0]!,
    stagingPlanetId: f.planetIds[0]!,
    targetPlanetId: f.planetIds[1]!,
    targetPlayerId: f.playerIds[1]!,
    targetPlanetName: 'Kepler',
    targetX: 1.5,
    targetY: -2.5,
    targetZ: 3.5,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + 24 * HOUR),
    ...over,
  } satisfies typeof clanWarOperations.$inferInsert;
}

async function makeOperation(
  clanId: string,
  over: Partial<typeof clanWarOperations.$inferInsert> = {},
): Promise<string> {
  const [row] = await f.db.insert(clanWarOperations)
    .values(operationRow(clanId, over))
    .returning({ id: clanWarOperations.id });
  return row!.id;
}

function contributionRow(
  operationId: string,
  clanId: string,
  over: Partial<typeof clanWarContributions.$inferInsert> = {},
) {
  return {
    seasonId: f.seasonId,
    operationId,
    clanId,
    playerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!,
    fleet: { DART: 10 },
    tech: {},
    unitLocation: `clan-war:${randomUUID()}`,
    reservedBulk: 20,
    fuelPaid: 42,
    fuelLegs: [
      { leg: 'ORIGIN_TO_STAGING' as const, distance: 5, fuel: 14 },
      { leg: 'STAGING_TO_TARGET' as const, distance: 5, fuel: 14 },
      { leg: 'TARGET_TO_ORIGIN' as const, distance: 5, fuel: 14 },
    ],
    sentAt: f.clock.now(),
    ...over,
  } satisfies typeof clanWarContributions.$inferInsert;
}

async function makeContribution(
  operationId: string,
  clanId: string,
  over: Partial<typeof clanWarContributions.$inferInsert> = {},
): Promise<string> {
  const [row] = await f.db.insert(clanWarContributions)
    .values(contributionRow(operationId, clanId, over))
    .returning({ id: clanWarContributions.id });
  return row!.id;
}

async function makeMission(): Promise<string> {
  const departAt = f.clock.now();
  const [row] = await f.db.insert(missions).values({
    fuelPaid: 0,
    seasonId: f.seasonId,
    kind: 'clan_war',
    ownerPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!,
    targetPlanetId: f.planetIds[1]!,
    fleet: { DART: 10 },
    distance: 5,
    departAt,
    arriveAt: new Date(departAt.getTime() + 60_000),
  }).returning({ id: missions.id });
  return row!.id;
}

/* ── enums stay append-only ─────────────────────────────────────── */

describe('the additive joint war schema', () => {
  it('appends every enum value without moving an existing one', () => {
    expect(missionKind.enumValues).toEqual([
      'attack', 'probe', 'return', 'transfer', 'settlement', 'death_star',
      'clan_transfer', 'clan_war',
    ]);
    expect(eventKind.enumValues.at(-1)).toBe('neutral_census');
    // The values the joint war was built beside must not have shifted position.
    expect(eventKind.enumValues.indexOf('mission_arrival')).toBe(0);
    expect(eventKind.enumValues.slice(-6, -2)).toEqual([
      'fault_spawn', 'fault_repair_complete', 'vault_leak_flush', 'colony_secession',
    ]);
    expect(eventKind.enumValues.at(-2)).toBe('clan_war_expiry');
  });
});

/* ── clan level and treasury ────────────────────────────────────── */

describe('the clan level and treasury columns', () => {
  it('leaves an old-ruleset clan at no level and an empty treasury', async () => {
    const clanId = await makeClan('OLD', null);
    const [row] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    expect(row!.level).toBeNull();
    expect(row!.treasuryAlloy).toBe(0);
    expect(row!.treasuryCrystal).toBe(0);
    expect(row!.treasuryDeuterium).toBe(0);
  });

  it('refuses a level outside the authored ladder', async () => {
    await expect(makeClan('LOW', 0)).rejects.toThrow();
    await expect(makeClan('HIGH', 11)).rejects.toThrow();
    await expect(makeClan('TOP', 10)).resolves.toBeTypeOf('string');
  });

  it('refuses a negative treasury balance', async () => {
    const clanId = await makeClan('NEG');
    await expect(
      f.db.update(clans).set({ treasuryAlloy: -1 }).where(eq(clans.id, clanId)),
    ).rejects.toThrow();
  });

  it('keeps an immutable audit row for every treasury movement', async () => {
    const clanId = await makeClan('AUD');
    await f.db.insert(clanTreasuryEvents).values({
      seasonId: f.seasonId,
      clanId,
      actorPlayerId: f.playerIds[0]!,
      sourcePlanetId: f.planetIds[0]!,
      kind: 'DONATION',
      alloy: 500,
      crystal: 200,
      deuterium: 0,
      createdAt: f.clock.now(),
    });
    const rows = await f.db.select().from(clanTreasuryEvents)
      .where(eq(clanTreasuryEvents.clanId, clanId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.alloy).toBe(500);
  });

  it('refuses a donation that moves nothing, or moves it the wrong way', async () => {
    const clanId = await makeClan('BAD');
    const base = {
      seasonId: f.seasonId,
      clanId,
      actorPlayerId: f.playerIds[0]!,
      sourcePlanetId: f.planetIds[0]!,
      kind: 'DONATION' as const,
      createdAt: f.clock.now(),
    };
    await expect(f.db.insert(clanTreasuryEvents).values({
      ...base, alloy: 0, crystal: 0, deuterium: 0,
    })).rejects.toThrow();
    await expect(f.db.insert(clanTreasuryEvents).values({
      ...base, alloy: -5, crystal: 0, deuterium: 0,
    })).rejects.toThrow();
  });

  it('refuses a level-up that does not climb exactly one rung', async () => {
    const clanId = await makeClan('LVL');
    const base = {
      seasonId: f.seasonId,
      clanId,
      actorPlayerId: f.playerIds[0]!,
      kind: 'LEVEL_UP' as const,
      alloy: -100,
      crystal: -50,
      deuterium: 0,
      createdAt: f.clock.now(),
    };
    await expect(f.db.insert(clanTreasuryEvents).values({
      ...base, levelBefore: 1, levelAfter: 3,
    })).rejects.toThrow();
    await expect(f.db.insert(clanTreasuryEvents).values({
      ...base, levelBefore: 1, levelAfter: 2,
    })).resolves.toBeDefined();
  });

  it('records a disband burn with no actor and no level movement', async () => {
    const clanId = await makeClan('BRN');
    await expect(f.db.insert(clanTreasuryEvents).values({
      seasonId: f.seasonId,
      clanId,
      kind: 'DISBAND_BURN',
      alloy: -400,
      crystal: -100,
      deuterium: -10,
      createdAt: f.clock.now(),
    })).resolves.toBeDefined();
  });
});

/* ── one open operation, and its clock ──────────────────────────── */

describe('the operation row', () => {
  it('allows exactly one unfinished operation per clan', async () => {
    const clanId = await makeClan('ONE');
    await makeOperation(clanId);
    await expect(makeOperation(clanId)).rejects.toThrow();
    // Closing the first one opens the door again.
    await f.db.update(clanWarOperations)
      .set({ status: 'COMPLETED', closeReason: 'EXPIRED', completedAt: f.clock.now() })
      .where(eq(clanWarOperations.clanId, clanId));
    await expect(makeOperation(clanId)).resolves.toBeTypeOf('string');
  });

  it('refuses an expiry that is not in the future of its own creation', async () => {
    const clanId = await makeClan('EXP');
    const createdAt = f.clock.now();
    await expect(makeOperation(clanId, { createdAt, expiresAt: createdAt }))
      .rejects.toThrow();
  });

  it('refuses a status whose timestamps contradict it', async () => {
    const clanId = await makeClan('TS');
    // Assembling cannot already have been started.
    await expect(makeOperation(clanId, { startedAt: f.clock.now() })).rejects.toThrow();
    // Completed cannot be missing its reason or its instant.
    await expect(makeOperation(clanId, {
      status: 'COMPLETED', completedAt: f.clock.now(),
    })).rejects.toThrow();
    await expect(makeOperation(clanId, {
      status: 'COMPLETED', closeReason: 'EXPIRED',
    })).rejects.toThrow();
    // Returning after a battle must know when the battle settled.
    await expect(makeOperation(clanId, {
      status: 'RETURNING', closeReason: 'BATTLE', resolvedAt: f.clock.now(),
    })).rejects.toThrow();
  });

  it('accepts the whole legal lifecycle in order', async () => {
    const clanId = await makeClan('LIFE');
    const id = await makeOperation(clanId);
    const now = f.clock.now();
    await f.db.update(clanWarOperations).set({ status: 'ATTACKING', startedAt: now })
      .where(eq(clanWarOperations.id, id));
    await f.db.update(clanWarOperations)
      .set({ status: 'RETURNING', closeReason: 'BATTLE', resolvedAt: now })
      .where(eq(clanWarOperations.id, id));
    await f.db.update(clanWarOperations).set({ status: 'COMPLETED', completedAt: now })
      .where(eq(clanWarOperations.id, id));
    const [row] = await f.db.select().from(clanWarOperations)
      .where(eq(clanWarOperations.id, id));
    expect(row!.status).toBe('COMPLETED');
    expect(row!.closeReason).toBe('BATTLE');
  });
});

/* ── contributions ──────────────────────────────────────────────── */

describe('the contribution row', () => {
  it('takes several waves from the same world without collision', async () => {
    const clanId = await makeClan('WAV');
    const operationId = await makeOperation(clanId);
    const first = await makeContribution(operationId, clanId);
    const second = await makeContribution(operationId, clanId);
    expect(first).not.toBe(second);
    const rows = await f.db.select().from(clanWarContributions)
      .where(eq(clanWarContributions.operationId, operationId));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.unitLocation)).size).toBe(2);
  });

  it('refuses two waves parked in the same unit location', async () => {
    const clanId = await makeClan('LOC');
    const operationId = await makeOperation(clanId);
    const unitLocation = `clan-war:${randomUUID()}`;
    await makeContribution(operationId, clanId, { unitLocation });
    await expect(makeContribution(operationId, clanId, { unitLocation })).rejects.toThrow();
  });

  it('refuses a negative reservation or a negative fuel charge', async () => {
    const clanId = await makeClan('FUE');
    const operationId = await makeOperation(clanId);
    await expect(makeContribution(operationId, clanId, { reservedBulk: -1 })).rejects.toThrow();
    await expect(makeContribution(operationId, clanId, { fuelPaid: -1 })).rejects.toThrow();
  });

  it('refuses a status outside the authored machine', async () => {
    const clanId = await makeClan('STA');
    const operationId = await makeOperation(clanId);
    const id = await makeContribution(operationId, clanId);
    await expect(f.db.execute(
      sql`update clan_war_contributions set status = 'PARKED' where id = ${id}`,
    )).rejects.toThrow();
  });
});

/* ── mission legs ───────────────────────────────────────────────── */

describe('the mission leg relation', () => {
  it('binds one aggregate combined attack per operation and no more', async () => {
    const clanId = await makeClan('AGG');
    const operationId = await makeOperation(clanId);
    await f.db.insert(clanWarMissions).values({
      missionId: await makeMission(), operationId, leg: 'COMBINED_ATTACK',
    });
    await expect(f.db.insert(clanWarMissions).values({
      missionId: await makeMission(), operationId, leg: 'COMBINED_ATTACK',
    })).rejects.toThrow();
  });

  it('binds one leg of each kind per contribution and no more', async () => {
    const clanId = await makeClan('LEG');
    const operationId = await makeOperation(clanId);
    const contributionId = await makeContribution(operationId, clanId);
    await f.db.insert(clanWarMissions).values({
      missionId: await makeMission(), operationId, contributionId, leg: 'SUPPORT_OUT',
    });
    await f.db.insert(clanWarMissions).values({
      missionId: await makeMission(), operationId, contributionId, leg: 'SUPPORT_RETURN',
    });
    await expect(f.db.insert(clanWarMissions).values({
      missionId: await makeMission(), operationId, contributionId, leg: 'SUPPORT_OUT',
    })).rejects.toThrow();
  });

  it('refuses a combined attack that claims to belong to one contribution', async () => {
    const clanId = await makeClan('MIX');
    const operationId = await makeOperation(clanId);
    const contributionId = await makeContribution(operationId, clanId);
    await expect(f.db.insert(clanWarMissions).values({
      missionId: await makeMission(), operationId, contributionId, leg: 'COMBINED_ATTACK',
    })).rejects.toThrow();
  });

  it('refuses a support leg with no contribution behind it', async () => {
    const clanId = await makeClan('ORP');
    const operationId = await makeOperation(clanId);
    await expect(f.db.insert(clanWarMissions).values({
      missionId: await makeMission(), operationId, leg: 'SUPPORT_OUT',
    })).rejects.toThrow();
  });

  it('refuses a support leg bound to another operation contribution', async () => {
    const firstClanId = await makeClan('OPA');
    const secondClanId = await makeClan('OPB');
    const firstOperationId = await makeOperation(firstClanId);
    const secondOperationId = await makeOperation(secondClanId);
    const contributionId = await makeContribution(firstOperationId, firstClanId);

    await expect(f.db.insert(clanWarMissions).values({
      missionId: await makeMission(),
      operationId: secondOperationId,
      contributionId,
      leg: 'SUPPORT_OUT',
    })).rejects.toThrow();
  });
});

/* ── reports and the Dominion audit ─────────────────────────────── */

describe('the report binder and the Dominion audit', () => {
  it('leaves an ordinary report with no operation, and keeps its binder check', async () => {
    const [report] = await f.db.insert(battleReports).values({
      seasonId: f.seasonId,
      missionId: await makeMission(),
      attackerPlayerId: f.playerIds[0]!,
      defenderPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      targetKind: 'PLAYER',
      grade: 'DECISIVE',
      rounds: [],
      loot: { alloy: 0, crystal: 0, deuterium: 0 },
      attackerLosses: {},
      defenderLosses: {},
      createdAt: f.clock.now(),
    }).returning({ id: battleReports.id, clanWarOperationId: battleReports.clanWarOperationId });
    expect(report!.clanWarOperationId).toBeNull();
  });

  it('binds at most one report to an operation', async () => {
    const clanId = await makeClan('REP');
    const operationId = await makeOperation(clanId);
    const insert = async () => f.db.insert(battleReports).values({
      seasonId: f.seasonId,
      missionId: await makeMission(),
      attackerPlayerId: f.playerIds[0]!,
      defenderPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      targetKind: 'PLAYER',
      grade: 'DECISIVE',
      rounds: [],
      loot: { alloy: 0, crystal: 0, deuterium: 0 },
      attackerLosses: {},
      defenderLosses: {},
      clanWarOperationId: operationId,
      createdAt: f.clock.now(),
    }).returning({ id: battleReports.id });
    const [first] = await insert();
    expect(first!.id).toBeTypeOf('string');
    await expect(insert()).rejects.toThrow();
  });

  it('keeps one participant result per commander in an operation', async () => {
    const clanId = await makeClan('PAR');
    const operationId = await makeOperation(clanId);
    const row = {
      seasonId: f.seasonId,
      operationId,
      playerId: f.playerIds[0]!,
      sent: { DART: 10 },
      losses: { DART: 4 },
      survivors: { DART: 6 },
      loot: { alloy: 10, crystal: 5, deuterium: 0 },
      salvage: { alloy: 0, crystal: 0, deuterium: 0 },
      hullDamage: 123.5,
      dominionRaw: 900,
      dominionDelta: 300,
      createdAt: f.clock.now(),
    };
    await f.db.insert(clanWarParticipantResults).values(row);
    await expect(f.db.insert(clanWarParticipantResults).values(row)).rejects.toThrow();
  });

  it('keeps one Dominion audit row per commander per side', async () => {
    const clanId = await makeClan('DOM');
    const operationId = await makeOperation(clanId);
    const row = {
      seasonId: f.seasonId,
      operationId,
      playerId: f.playerIds[0]!,
      role: 'ATTACKER' as const,
      rulesetVersion: 10,
      attackerCount: 3,
      defenderCount: 1,
      baseExchange: 9_000,
      adjustedTransfer: 3_000,
      delta: 1_500,
      createdAt: f.clock.now(),
    };
    await f.db.insert(clanWarDominionEvents).values(row);
    await expect(f.db.insert(clanWarDominionEvents).values(row)).rejects.toThrow();
    // The same commander on the other side of the same operation is a different row.
    await expect(f.db.insert(clanWarDominionEvents).values({ ...row, role: 'DEFENDER' }))
      .resolves.toBeDefined();
  });

  it('refuses a head count below one on either side', async () => {
    const clanId = await makeClan('CNT');
    const operationId = await makeOperation(clanId);
    await expect(f.db.insert(clanWarDominionEvents).values({
      seasonId: f.seasonId,
      operationId,
      playerId: f.playerIds[0]!,
      role: 'ATTACKER',
      rulesetVersion: 10,
      attackerCount: 0,
      defenderCount: 1,
      baseExchange: 0,
      adjustedTransfer: 0,
      delta: 0,
      createdAt: f.clock.now(),
    })).rejects.toThrow();
  });
});
