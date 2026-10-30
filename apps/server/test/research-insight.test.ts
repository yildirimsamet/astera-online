import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import { loadResearchInsight } from '../src/services/researchState.js';
import { giveResearch, seedWorld, testDb, testEnv, TEST_DATABASE_URL, type Fixture } from './helpers.js';

/**
 * WHAT A COMMANDER'S RAIDS HAVE TAUGHT THEM, READ ONCE. Scaling plan F1.8 (C5 + Q5).
 *
 * Two Frontier rungs are found by battle: Dense Fuel Cells by a cargo-limited raid,
 * Gravitic Charges by a shield that held at least a quarter of an attack. Every
 * planet read scanned the commander's whole report history for both, and summed
 * each report's round damage twice. The sum is now taken once, and the answer is
 * remembered per commander until a trigger says a report was filed for them as the
 * attacker — before the raid's own result reaches them, so the read it provokes
 * already sees the rung.
 */
const silent = pino({ level: 'silent' });
let f: Fixture;

/** A filed report: only the fields the insight reads, on a raid from `seat` at the other seat's world. */
async function report(seat: number, damage: readonly number[], absorbed: number, cargoLimited = false) {
  const attacker = f.playerIds[seat]!;
  const target = f.planetIds[1 - seat]!;
  const rounds = JSON.stringify(damage.map(attackerDamage => ({ attackerDamage })));
  await f.db.execute(sql`with mission as (
      insert into missions (season_id, kind, origin_planet_id, target_planet_id, fleet, distance, depart_at, arrive_at, owner_player_id, fuel_paid)
      values (${f.seasonId}, 'attack', ${f.planetIds[seat]!}, ${target}, '{}'::jsonb, 1, now(), now(), ${attacker}, 0) returning id)
    insert into battle_reports (season_id, mission_id, target_planet_id, attacker_player_id, grade, rounds, loot,
      attacker_losses, defender_losses, shield_absorbed, cargo_limited)
    select ${f.seasonId}, mission.id, ${target}, ${attacker}, 'DRAW', ${rounds}::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      ${absorbed}, ${cargoLimited} from mission`);
}

beforeEach(async () => { f = await seedWorld(2); });
afterAll(async () => { await (await testDb()).close(); });

describe('the insight, summed once', () => {
  const cases: { name: string; damage: number[]; absorbed: number; shield: boolean }[] = [
    { name: 'a shield on an attack that dealt nothing', damage: [0, 0], absorbed: 5, shield: false },
    { name: 'exactly a quarter, over several rounds', damage: [40, 60], absorbed: 25, shield: true },
    { name: 'just under a quarter', damage: [100], absorbed: 24.9, shield: false },
    { name: 'no shield at all', damage: [100], absorbed: 0, shield: false },
  ];
  for (const { name, damage, absorbed, shield } of cases) {
    it(`reads ${name}`, async () => {
      await report(0, damage, absorbed);
      expect(await loadResearchInsight(f.db, f.playerIds[0]!)).toEqual({ cargo: false, shield });
    });
  }

  it('reads a cargo-limited raid, and only the attacker’s own reports', async () => {
    await report(1, [100], 50, true);
    expect(await loadResearchInsight(f.db, f.playerIds[0]!)).toEqual({ cargo: false, shield: false });
    await report(0, [100], 0, true);
    expect(await loadResearchInsight(f.db, f.playerIds[0]!)).toEqual({ cargo: true, shield: false });
  });
});

describe('a planet read', () => {
  let built: BuiltApp;
  let client: ReturnType<typeof postgres>;
  const wire: string[] = [];
  beforeEach(async () => {
    client = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => undefined,
      debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
    built = buildApp({ db: drizzle(client, { schema }), clock: f.clock, logger: silent, env: testEnv() });
    await built.app.ready();
    await built.bus.start();
    await giveResearch(f.db, f.planetIds[0]!, 'ISOTOPE_SPECTROMETRY');
  });
  afterEach(async () => { await built.close(); await client.end(); });

  const gravitic = async () => {
    const response = await built.app.inject({ url: `/api/planets/${f.planetIds[0]!}`,
      headers: { authorization: `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}` } });
    expect(response.statusCode).toBe(200);
    return response.json<{ research: { id: string; discovered: boolean }[] }>().research.find(project => project.id === 'GRAVITIC_CHARGES');
  };

  it('stops scanning the report history once it has read it', async () => {
    await gravitic();
    wire.length = 0;
    await gravitic();
    expect(wire.filter(query => query.includes('from "battle_reports"'))).toEqual([]);
  });

  it('finds the rung on the read right after the report is filed', async () => {
    expect(await gravitic()).toMatchObject({ discovered: false });
    await report(0, [100], 30);
    await expect.poll(async () => (await gravitic())?.discovered, { timeout: 2_000, interval: 20 }).toBe(true);
  });
});
