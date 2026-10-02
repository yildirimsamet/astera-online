import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  battleReports,
  clanSupportBattleResults,
  clanSupportDominionEvents,
  clanSupportWaves,
  clans,
  eventKind,
  missionKind,
  missions,
  notificationKind,
  planets,
  probeReports,
} from '../src/db/schema.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the additive schema (`docs/clan-defense-support-plan.md`, P4).
 */

let f: Fixture;
let clanId: string;
beforeEach(async () => {
  f = await seedWorld(3);
  clanId = await makeClan();
});
afterAll(async () => { await (await testDb()).close(); });

const HOUR = 3_600_000;

async function makeClan(): Promise<string> {
  const [row] = await f.db.insert(clans).values({
    seasonId: f.seasonId,
    name: 'Clan SD',
    nameKey: 'clan sd',
    tag: 'SD',
    level: 1,
    createdAt: f.clock.now(),
  }).returning({ id: clans.id });
  return row!.id;
}

async function makeMission(): Promise<string> {
  const now = f.clock.now();
  const [row] = await f.db.insert(missions).values({
    seasonId: f.seasonId,
    ownerPlayerId: f.playerIds[0]!,
    kind: 'clan_support',
    originPlanetId: f.planetIds[0]!,
    targetPlanetId: f.planetIds[1]!,
    fleet: { DART: 5 },
    fuelPaid: 0,
    distance: 100,
    departAt: now,
    arriveAt: new Date(now.getTime() + HOUR),
    status: 'in_flight',
  }).returning({ id: missions.id });
  return row!.id;
}

async function waveRow(over: Partial<typeof clanSupportWaves.$inferInsert> = {}) {
  const outboundMissionId = await makeMission();
  const now = f.clock.now();
  return {
    seasonId: f.seasonId,
    clanId,
    senderPlayerId: f.playerIds[0]!,
    hostPlayerId: f.playerIds[1]!,
    originPlanetId: f.planetIds[0]!,
    hostPlanetId: f.planetIds[1]!,
    unitLocation: `support:${randomUUID()}`,
    fleet: { DART: 5 },
    reservedBulk: 10,
    fuelPaid: 4,
    outboundMissionId,
    sentAt: now,
    arriveAt: new Date(now.getTime() + HOUR),
    ...over,
  } satisfies typeof clanSupportWaves.$inferInsert;
}

describe('the additive clan defence schema', () => {
  it('appends every enum value without moving an existing one', () => {
    expect(missionKind.enumValues).toEqual([
      'attack', 'probe', 'return', 'transfer', 'settlement', 'death_star',
      'clan_transfer', 'clan_war', 'clan_support',
    ]);
    expect(eventKind.enumValues.slice(-3)).toEqual([
      'clan_war_expiry', 'neutral_census', 'clan_support_expiry',
    ]);
    expect(notificationKind.enumValues.slice(-5)).toEqual([
      'radiation_lost',
      'clan_support_inbound',
      'clan_support_departed',
      'clan_support_result',
      'defence_posture_reset',
    ]);
  });
});

describe('the world’s defence posture', () => {
  it('starts every world at ESCAPE — the retreat a season has always had', async () => {
    const [row] = await f.db.select({ posture: planets.defencePosture })
      .from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(row!.posture).toBe('ESCAPE');
  });

  it('accepts the three postures and refuses anything else', async () => {
    for (const posture of ['SUPPORT', 'HOLD', 'ESCAPE'] as const) {
      await f.db.update(planets).set({ defencePosture: posture }).where(eq(planets.id, f.planetIds[0]!));
    }
    await expect(f.db.update(planets)
      .set({ defencePosture: 'BOTH' as 'HOLD' })
      .where(eq(planets.id, f.planetIds[0]!))).rejects.toThrow();
  });
});

describe('the support wave row', () => {
  it('stores a wave and starts it OUTBOUND', async () => {
    const [row] = await f.db.insert(clanSupportWaves).values(await waveRow()).returning();
    expect(row!.status).toBe('OUTBOUND');
    expect(row!.battles).toBe(0);
    expect(row!.returnReason).toBeNull();
  });

  it('refuses two waves parked in the same unit location', async () => {
    const unitLocation = `support:${randomUUID()}`;
    await f.db.insert(clanSupportWaves).values(await waveRow({ unitLocation }));
    await expect(f.db.insert(clanSupportWaves).values(await waveRow({ unitLocation }))).rejects.toThrow();
  });

  it('refuses a commander supporting themself', async () => {
    await expect(f.db.insert(clanSupportWaves)
      .values(await waveRow({ hostPlayerId: f.playerIds[0]! }))).rejects.toThrow();
  });

  it('refuses negative room, fuel or battle counts', async () => {
    await expect(f.db.insert(clanSupportWaves).values(await waveRow({ reservedBulk: -1 }))).rejects.toThrow();
    await expect(f.db.insert(clanSupportWaves).values(await waveRow({ fuelPaid: -1 }))).rejects.toThrow();
    await expect(f.db.insert(clanSupportWaves).values(await waveRow({ battles: -1 }))).rejects.toThrow();
  });

  it('refuses a status or a reason outside the authored machine', async () => {
    await expect(f.db.insert(clanSupportWaves)
      .values(await waveRow({ status: 'STAGED' as 'OUTBOUND' }))).rejects.toThrow();
    await expect(f.db.insert(clanSupportWaves)
      .values(await waveRow({ returnReason: 'BORED' as 'RECALLED' }))).rejects.toThrow();
  });

  it('refuses a status whose timestamps contradict it', async () => {
    const now = f.clock.now();
    // Stationed with no clock of its own.
    await expect(f.db.insert(clanSupportWaves)
      .values(await waveRow({ status: 'STATIONED' }))).rejects.toThrow();
    // Returning with no reason.
    await expect(f.db.insert(clanSupportWaves)
      .values(await waveRow({ status: 'RETURNING', returnAt: now }))).rejects.toThrow();
    // Home with no resolution instant.
    await expect(f.db.insert(clanSupportWaves)
      .values(await waveRow({ status: 'HOME' }))).rejects.toThrow();
    // An expiry before the wave stood.
    await expect(f.db.insert(clanSupportWaves).values(await waveRow({
      status: 'STATIONED',
      stationedAt: now,
      expiresAt: new Date(now.getTime() - 1),
    }))).rejects.toThrow();
  });

  it('accepts the legal lifecycle in order', async () => {
    const now = f.clock.now();
    const [row] = await f.db.insert(clanSupportWaves).values(await waveRow()).returning({ id: clanSupportWaves.id });
    const id = row!.id;
    await f.db.update(clanSupportWaves).set({
      status: 'STATIONED', stationedAt: now, expiresAt: new Date(now.getTime() + 12 * HOUR),
    }).where(eq(clanSupportWaves.id, id));
    await f.db.update(clanSupportWaves).set({
      status: 'RETURNING', returnAt: now, returnReason: 'RECALLED',
    }).where(eq(clanSupportWaves.id, id));
    await f.db.update(clanSupportWaves).set({ status: 'HOME', resolvedAt: now }).where(eq(clanSupportWaves.id, id));
  });
});

describe('the report binder and the defence audit', () => {
  async function report(over: Partial<typeof battleReports.$inferInsert> = {}): Promise<string> {
    const missionId = await makeMission();
    const [row] = await f.db.insert(battleReports).values({
      seasonId: f.seasonId,
      missionId,
      attackerPlayerId: f.playerIds[2]!,
      defenderPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      grade: 'REPELLED',
      rounds: [],
      loot: { alloy: 0, crystal: 0, deuterium: 0 },
      attackerLosses: {},
      defenderLosses: {},
      ...over,
    }).returning({ id: battleReports.id });
    return row!.id;
  }

  const audit = {
    dominionEligible: true,
    dominionRuleVersion: 15,
    dominionLootValue: 100,
    dominionAttackerLossValue: 0,
    dominionDefenderLossValue: 200,
    dominionRawExchange: 300,
  } as const;

  it('defaults every report to one defender', async () => {
    const id = await report();
    const [row] = await f.db.select({ n: battleReports.defenderCount }).from(battleReports).where(eq(battleReports.id, id));
    expect(row!.n).toBe(1);
  });

  it('lets a supported battle store a corrected swing beside its raw exchange', async () => {
    await expect(report({ ...audit, dominionSwing: 100, defenderCount: 3 })).resolves.toBeTruthy();
  });

  it('still refuses a corrected swing on an unsupported, non-joint battle', async () => {
    await expect(report({ ...audit, dominionSwing: 100 })).rejects.toThrow();
  });

  it('refuses a defender count below one', async () => {
    await expect(report({ defenderCount: 0 })).rejects.toThrow();
  });

  it('keeps one result per commander per report, and only the host carries lost loot', async () => {
    const reportId = await report({ defenderCount: 2 });
    const base = {
      seasonId: f.seasonId,
      reportId,
      sent: { DART: 5 },
      losses: {},
      survivors: { DART: 5 },
    };
    await f.db.insert(clanSupportBattleResults).values({
      ...base, playerId: f.playerIds[1]!, role: 'HOST', lootLost: { alloy: 5, crystal: 0, deuterium: 0 },
    });
    await f.db.insert(clanSupportBattleResults).values({ ...base, playerId: f.playerIds[0]!, role: 'SUPPORT' });
    await expect(f.db.insert(clanSupportBattleResults)
      .values({ ...base, playerId: f.playerIds[0]!, role: 'SUPPORT' })).rejects.toThrow();
    await expect(f.db.insert(clanSupportBattleResults).values({
      ...base, playerId: f.playerIds[2]!, role: 'SUPPORT', lootLost: { alloy: 1, crystal: 0, deuterium: 0 },
    })).rejects.toThrow();
    await expect(f.db.insert(clanSupportBattleResults)
      .values({ ...base, playerId: f.playerIds[2]!, role: 'GUEST' as 'SUPPORT' })).rejects.toThrow();
  });

  it('keeps one Dominion journal row per commander per side, from two defenders up', async () => {
    const missionId = randomUUID();
    const row = {
      seasonId: f.seasonId,
      missionId,
      reportId: randomUUID(),
      rulesetVersion: 15,
      attackerCount: 1,
      defenderCount: 2,
      baseExchange: 300,
      adjustedTransfer: 600,
    };
    await f.db.insert(clanSupportDominionEvents).values({ ...row, playerId: f.playerIds[2]!, role: 'ATTACKER', delta: 600 });
    await f.db.insert(clanSupportDominionEvents).values({ ...row, playerId: f.playerIds[1]!, role: 'DEFENDER', delta: -450 });
    await expect(f.db.insert(clanSupportDominionEvents)
      .values({ ...row, playerId: f.playerIds[1]!, role: 'DEFENDER', delta: 0 })).rejects.toThrow();
    await expect(f.db.insert(clanSupportDominionEvents)
      .values({ ...row, missionId: randomUUID(), playerId: f.playerIds[0]!, role: 'DEFENDER', delta: 0, defenderCount: 1 }))
      .rejects.toThrow();
    await expect(f.db.insert(clanSupportDominionEvents)
      .values({ ...row, missionId: randomUUID(), playerId: f.playerIds[0]!, role: 'NEUTRAL' as 'DEFENDER', delta: 0 }))
      .rejects.toThrow();
  });
});

describe('the probe report', () => {
  it('stores a support reading and the posture, both optional', async () => {
    const missionId = await makeMission();
    const base = {
      observerPlayerId: f.playerIds[2]!,
      targetPlanetId: f.planetIds[1]!,
      missionId,
      accuracy: 0.8,
      stock: { low: 0, high: 10 },
      defence: { low: 0, high: 10 },
      fleetSize: { low: 0, high: 1 },
      fleetHome: true,
      detected: false,
    };
    await f.db.insert(probeReports).values(base);
    await f.db.insert(probeReports).values({
      ...base,
      missionId: await makeMission(),
      posture: 'SUPPORT',
      support: { supporters: 2, defence: { low: 800, high: 1_100 }, fleetSize: { low: 30, high: 40 }, classReading: null },
    });
    await expect(f.db.insert(probeReports)
      .values({ ...base, missionId: await makeMission(), posture: 'SIEGE' as 'HOLD' })).rejects.toThrow();
  });
});
