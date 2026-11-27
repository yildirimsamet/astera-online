import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  eventKind,
  galaxyEventOccurrenceKind,
  missions,
  notificationKind,
  playerAsterium,
  playerCapsules,
  synthesisJobs,
} from '../src/db/schema.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/** ASTERYUM VE SENTEZ LABORATUVARI — the additive schema (plan 2026-11-24 §4.2, step 2). */

let f: Fixture;
beforeEach(async () => { f = await seedWorld(2); });
afterAll(async () => { await (await testDb()).close(); });

const MIN = 60_000;
const rejects = async (run: () => Promise<unknown>): Promise<void> => { await expect(run()).rejects.toThrow(); };

async function columnDefault(table: string, column: string): Promise<string | null> {
  const [row] = await f.db.execute<{ d: string | null }>(sql`
    select column_default as d from information_schema.columns
    where table_name = ${table} and column_name = ${column}`);
  if (!row) throw new Error(`${table}.${column} is missing`);
  return row.d;
}

describe('asterium stock, capsule inventory and the one synthesis job', () => {
  it('keeps a stock that cannot go negative', async () => {
    const playerId = f.playerIds[0]!;
    await f.db.insert(playerAsterium).values({ playerId, balance: 5, updatedAt: f.clock.now() });
    await rejects(() => f.db.execute(sql`update player_asterium set balance = -1 where player_id = ${playerId}`));
  });

  it('holds capsules by known id only, never below zero', async () => {
    const playerId = f.playerIds[0]!;
    await f.db.insert(playerCapsules).values({ playerId, capsuleId: 'OPTIC_VEIL', quantity: 2 });
    await rejects(() => f.db.execute(sql`insert into player_capsules (player_id, capsule_id, quantity) values (${playerId}, 'CLOAK', 1)`));
    await rejects(() => f.db.execute(sql`update player_capsules set quantity = -1 where player_id = ${playerId}`));
  });

  it('allows one job per commander, a bounded batch, and never more delivered than ordered', async () => {
    const playerId = f.playerIds[0]!;
    const now = f.clock.now();
    const job = {
      playerId, seasonId: f.seasonId, capsuleId: 'OPTIC_VEIL' as const, quantity: 3, delivered: 0,
      startedAt: now, completesAt: new Date(now.getTime() + 90 * MIN),
      paidAlloy: 6_000, paidCrystal: 9_000, paidDeuterium: 750, paidAsterium: 12,
    };
    await f.db.insert(synthesisJobs).values(job);
    await rejects(() => f.db.insert(synthesisJobs).values(job));
    await rejects(() => f.db.execute(sql`update synthesis_jobs set delivered = 4 where player_id = ${playerId}`));
    await rejects(() => f.db.execute(sql`update synthesis_jobs set quantity = 0 where player_id = ${playerId}`));
    await rejects(() => f.db.execute(sql`update synthesis_jobs set paid_asterium = -1 where player_id = ${playerId}`));
  });
});

describe('the columns existing tables gain', () => {
  it('starts every existing row on an empty or neutral value', async () => {
    expect(await columnDefault('missions', 'applied_capsules')).toContain("'[]'");
    expect(await columnDefault('battle_reports', 'applied_capsules')).toContain("'[]'");
    expect(await columnDefault('arena_ships', 'hold_asterium')).toBe('0');
    expect(await columnDefault('moons', 'asterium_fraction')).toBe('0');
    expect(await columnDefault('moons', 'asterium_synced_at')).toBe('now()');
    expect(await columnDefault('seasons', 'synthesis_starts_at')).toBeNull();
  });

  it('records an applied capsule list on a mission', async () => {
    const now = f.clock.now();
    const [row] = await f.db.insert(missions).values({
      seasonId: f.seasonId, ownerPlayerId: f.playerIds[0]!, kind: 'attack',
      originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!, fleet: { DART: 5 }, fuelPaid: 0, distance: 100,
      departAt: now, arriveAt: new Date(now.getTime() + 60 * MIN), status: 'in_flight',
      appliedCapsules: [{ id: 'OPTIC_VEIL', count: 1 }],
    }).returning({ applied: missions.appliedCapsules });
    expect(row?.applied).toEqual([{ id: 'OPTIC_VEIL', count: 1 }]);
  });
});

describe('enum values, appended last', () => {
  it('names the new lifecycle moments', () => {
    expect(eventKind.enumValues.at(-1)).toBe('synthesis_complete');
    expect(notificationKind.enumValues.at(-1)).toBe('synthesis_ready');
    // The Yarık Saati (owner 2026-11-27) was appended after it.
    expect(galaxyEventOccurrenceKind.enumValues.slice(-2)).toEqual(['ASTERIUM_STORM', 'RIFT_HOUR']);
  });
});
