import { readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimPirateLoot, currentPirateGeneration, fleetCount, fleetEntries, piratePosition,
  pirateOverrun, pirateStats, remainingPirateLoot, resolveBattle, seededFrom, soloStack,
  type Fleet, type Resources,
} from '@astera/rules';
import { asteroidSpawnHours, battleReports, pirateRaids, pirateState, seasons, units } from '../src/db/schema.js';
import { loadPirateSnapshot, privatePirateHour } from '../src/services/pirateField.js';
import { resolvePirateArrival } from '../src/services/pirateRaid.js';
import { grant, seedWorld, testDb, type Fixture } from './helpers.js';

const zero = { alloy: 0, crystal: 0, deuterium: 0 };
const keys = ['alloy', 'crystal', 'deuterium'] as const;
const tech = { SHIP_POWER: 2, SHIP_ARMOR: 2, SHIP_PROPULSION: 2, STARSHIP_ENGINEERING: 2, CARGO_HOLDS: 2 };
afterAll(async () => { await (await testDb()).close(); });

describe('one shared pirate reward ledger', () => {
  let f: Fixture;
  let target: ReturnType<typeof privatePirateHour>[number];
  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
    await f.db.update(seasons).set({ rulesetVersion: 16, asteroidDynamicFrom: f.clock.now() }).where(eq(seasons.id, f.seasonId));
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const lane = { fromMinute: 0, untilMinute: 60, count: 128, generation: currentPirateGeneration() };
    await f.db.insert(asteroidSpawnHours).values({ seasonId: f.seasonId, hourStartsAt: f.clock.now(),
      spawnFrom: f.clock.now(), activePlayers: 512, lanes: [], pirateLane: lane });
    target = privatePirateHour(season!.asteroidKey, { hourOrdinal: 0, lane })
      .find(p => p.level === 4 && fleetCount(p.roster) >= 4)!;
    expect(target).toBeDefined();
    f.clock.set(new Date(season!.startsAt.getTime() + 61 * 60_000));
    for (const planetId of f.planetIds) await grant(f.db, planetId, 500_000, 100_000);
  });

  const state = async () => (await f.db.select().from(pirateState).where(and(
    eq(pirateState.seasonId, f.seasonId), eq(pirateState.index, target.index),
  )))[0]!;

  async function arrangedRaid(id: string, fleet: Fleet, owner = 0) {
    const at = piratePosition(target, 61);
    await f.db.insert(pirateRaids).values({ id, seasonId: f.seasonId, planetId: f.planetIds[owner]!,
      ownerPlayerId: f.playerIds[owner]!, pirateIndex: target.index, fleet, tech,
      interceptX: at.x, interceptY: at.y, interceptZ: at.z,
      departAt: new Date(f.clock.now().getTime() - 60_000), arriveAt: f.clock.now() });
    await f.db.insert(units).values(fleetEntries(fleet).map(([hull, count]) => ({
      planetId: f.planetIds[owner]!, ownerPlayerId: f.playerIds[owner]!, hull, count, location: `pirate:${id}`,
    })));
  }

  it('records a real partial payment, then limits the finishing raid to the original total budget', async () => {
    const first = '00000000-0000-4000-8000-000000009001';
    const partial = Array.from({ length: 20 }, (_, index): Fleet => ({ CORSAIR: index + 1, ARGOSY: 2 }))
      .find(fleet => {
        const result = pirateOverrun(resolveBattle([soloStack(fleet, { tech })],
          [{ stackId: 'pirate', playerId: '', fleet: target.roster, tech: { tech: {}, damageMult: pirateStats(4).damageMult } }],
          0, seededFrom(first), 'HP_PLANET'));
        return result.grade === 'PARTIAL' && fleetCount(result.attackerSurvivors) > 0;
      });
    expect(partial, 'fixture must produce a partial fight').toBeDefined();
    await arrangedRaid(first, partial!);
    await f.db.transaction(tx => resolvePirateArrival(tx, first, f.clock));
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.pirateRaidId, first));
    expect(report?.grade).toBe('PARTIAL');
    expect(report!.loot.alloy + report!.loot.crystal).toBeGreaterThan(0);
    expect((await state()).lootPaid).toEqual(report!.loot);
    const beforeKill = await loadPirateSnapshot(f.db, f.seasonId, f.clock.now());
    expect(beforeKill.remainingLootOf(target.index)).toEqual(remainingPirateLoot(target.hoard, report!.loot));
    const second = '00000000-0000-4000-8000-000000009002';
    await arrangedRaid(second, { CORSAIR: 30, ARGOSY: 2 }, 1);
    await f.db.transaction(tx => resolvePirateArrival(tx, second, f.clock));
    const reports = await f.db.select().from(battleReports);
    const paid: Resources = { ...zero };
    for (const row of reports) for (const key of keys) paid[key] += row.loot[key];
    expect(paid).toEqual(remainingPirateLoot(target.hoard, zero));
    expect((await state()).lootPaid).toEqual(paid);
    await f.db.transaction(tx => resolvePirateArrival(tx, second, f.clock));
    expect(await f.db.select().from(battleReports)).toHaveLength(2);
    expect((await state()).lootPaid).toEqual(paid);
  });

  it('serializes simultaneous first hits and pays the shared hoard once', async () => {
    const ids = ['00000000-0000-4000-8000-000000009011', '00000000-0000-4000-8000-000000009012'];
    for (const [owner, id] of ids.entries()) await arrangedRaid(id, { CORSAIR: 30, ARGOSY: 2 }, owner);
    await Promise.all(ids.map(id => f.db.transaction(tx => resolvePirateArrival(tx, id, f.clock))));
    const reports = await f.db.select().from(battleReports);
    expect(reports).toHaveLength(1);
    expect((await state()).lootPaid).toEqual(reports[0]!.loot);
    expect(reports[0]!.loot).toEqual(remainingPirateLoot(target.hoard, zero));
    expect((await f.db.select().from(pirateRaids)).every(row => row.status === 'returning')).toBe(true);
  });

  it('settles overlapping overdue arrivals without deadlocking while turning later raids home', async () => {
    const ids = ['00000000-0000-4000-8000-000000009041', '00000000-0000-4000-8000-000000009042'];
    for (const [owner, id] of ids.entries()) await arrangedRaid(id, { CORSAIR: 30, ARGOSY: 2 }, owner);
    await f.db.update(pirateRaids).set({ arriveAt: new Date(f.clock.now().getTime() + 20_000) })
      .where(eq(pirateRaids.id, ids[1]!));
    f.clock.set(new Date(f.clock.now().getTime() + 31_000));
    await f.db.insert(pirateState).values({ seasonId: f.seasonId, index: target.index,
      losses: {}, updatedAt: f.clock.now() });

    let release: () => void = () => undefined;
    let ready: () => void = () => undefined;
    const held = new Promise<void>(resolve => { ready = resolve; });
    const untilRelease = new Promise<void>(resolve => { release = resolve; });
    const guard = f.db.transaction(async tx => {
      await tx.select().from(pirateState).where(and(eq(pirateState.seasonId, f.seasonId),
        eq(pirateState.index, target.index))).for('update');
      ready();
      await untilRelease;
    });
    const arrivals: Promise<void>[] = [];
    const blocked = (count: number) => vi.waitFor(async () => {
      const rows = await f.db.execute<{ waiting: number }>(sql`
        SELECT count(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock' AND query LIKE '%pirate_state%'
      `);
      expect(rows[0]?.waiting).toBe(count);
    }, { timeout: 10_000, interval: 50 });
    try {
      await held;
      arrivals.push(f.db.transaction(tx => resolvePirateArrival(tx, ids[0]!, f.clock)));
      await blocked(1);
      arrivals.push(f.db.transaction(tx => resolvePirateArrival(tx, ids[1]!, f.clock)));
      await blocked(2);
    } finally {
      release();
      await guard;
    }
    await Promise.all(arrivals);
    const reports = await f.db.select().from(battleReports);
    expect(reports).toHaveLength(1);
    expect((await state()).lootPaid).toEqual(reports[0]!.loot);
    expect((await f.db.select().from(pirateRaids)).every(row => row.status === 'returning')).toBe(true);
  }, 60_000);

  it('rolls back the payment with the fight and retries without inventing another reward', async () => {
    const id = '00000000-0000-4000-8000-000000009021';
    const paid = claimPirateLoot(target.hoard, zero, 'PARTIAL', Number.MAX_SAFE_INTEGER).fromStock;
    await f.db.insert(pirateState).values({ seasonId: f.seasonId, index: target.index, losses: {}, lootPaid: paid, updatedAt: f.clock.now() });
    await arrangedRaid(id, { CORSAIR: 30, ARGOSY: 2 });
    await expect(f.db.transaction(async tx => {
      await resolvePirateArrival(tx, id, f.clock);
      throw new Error('rollback probe');
    })).rejects.toThrow('rollback probe');
    expect((await state()).lootPaid).toEqual(paid);
    expect(await f.db.select().from(battleReports)).toHaveLength(0);
    await f.db.transaction(tx => resolvePirateArrival(tx, id, f.clock));
    const [report] = await f.db.select().from(battleReports);
    expect(report!.loot).toEqual(remainingPirateLoot(target.hoard, paid));
    expect((await state()).lootPaid).toEqual(remainingPirateLoot(target.hoard, zero));
  });

  it('backfills historical hoard payments from reports, excluding salvage and tolerating old missing fuel', async () => {
    const id = '00000000-0000-4000-8000-000000009031';
    await arrangedRaid(id, { CORSAIR: 30, ARGOSY: 2, GARBAGE_COLLECTOR: 1 });
    await f.db.transaction(tx => resolvePirateArrival(tx, id, f.clock));
    const [report] = await f.db.select().from(battleReports);
    expect(report!.salvage.alloy).toBeGreaterThan(0);
    await f.db.update(pirateState).set({ lootPaid: zero });
    await f.db.execute(sql`UPDATE battle_reports SET loot = loot - 'deuterium' WHERE pirate_raid_id = ${id}`);
    const migration = readFileSync(new URL('../drizzle/0150_pirate_reward_ledger.sql', import.meta.url), 'utf8');
    const backfill = migration.split('--> statement-breakpoint')[1]!;
    expect(backfill).toBeDefined();
    await f.db.execute(sql.raw(backfill));
    expect((await state()).lootPaid).toEqual({ alloy: report!.loot.alloy, crystal: report!.loot.crystal, deuterium: 0 });
    expect((await state()).destroyedAt).not.toBeNull();
  });
});
