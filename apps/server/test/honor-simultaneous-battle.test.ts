import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { battleReports, honorEvents, honorSeasons, honorTotals, planets, players, scheduledEvents, seasons } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { launchAttack } from '../src/services/mission.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { fuelUp, giveUnits, levelWorld, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

describe('real opposing raids inside the candidate simultaneous journal', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 24017);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ defencePosture: 'HOLD' }).where(eq(planets.seasonId, f.seasonId));
    await levelWorld(f.db, f.planetIds);
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 12);
      await fuelUp(f.db, id, 50000);
      await giveUnits(f.db, id, { DART: 300 });
    }
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 2));
    f.clock.advance(250);
  });
  afterAll(async () => { await (await testDb()).close(); });

  it.each([false, true])('preserves real losses and proportionate shared pair credit, reversed callback order: %s', async reverse => {
    const a = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 120 }, f.clock);
    const b = await launchAttack(f.db, f.planetIds[1]!, f.planetIds[0]!, { DART: 120 }, f.clock);
    f.clock.set(settledAt(new Date(Math.max(a.arriveAt.getTime(), b.arriveAt.getTime()))));
    const launches = reverse ? [b, a] : [a, b];
    for (const raid of launches) {
      const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, raid.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
      await onMissionArrival({ db: f.db, clock: f.clock }, event!);
      await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    }
    const entries = await f.db.select().from(honorEvents);
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map(row => row.at.getTime())).size).toBe(1);
    expect(await f.db.select().from(battleReports)).toHaveLength(2);
    const rawByOwner = new Map<string, bigint>(), negativeByOwner = new Map<string, bigint>();
    for (const entry of entries) {
      expect(entry.evidence.eligible).toBe(true);
      expect(entry.evidence.attack[0]!.combatLoss + entry.evidence.defence[0]!.combatLoss).toBeGreaterThan(0);
      for (const side of ['attack', 'defence'] as const) {
        const owner = entry.evidence[side][0]!.id, raw = BigInt(entry.outcome.pool[side].raw);
        const ledger = raw > 0n ? rawByOwner : negativeByOwner;
        ledger.set(owner, (ledger.get(owner) ?? 0n) + raw);
      }
    }
    const rawTotal = [...rawByOwner.values()].reduce((sum, raw) => sum + raw, 0n);
    expect(rawTotal > 0n).toBe(true);
    const cap = 200_000_000n, fairCredit = cap * rawTotal / (cap + rawTotal);
    const totals = await f.db.select().from(honorTotals);
    const negativeTotal = [...negativeByOwner.values()].reduce((sum, raw) => sum + raw, 0n);
    expect(totals.reduce((sum, row) => sum + BigInt(row.score), 0n)).toBe(fairCredit + negativeTotal);
    for (const owner of f.playerIds) {
      const expected = fairCredit * (rawByOwner.get(owner) ?? 0n) / rawTotal + (negativeByOwner.get(owner) ?? 0n);
      const actual = BigInt(totals.find(row => row.playerId === owner)!.score);
      const dust = actual > expected ? actual - expected : expected - actual;
      expect(dust <= 2n).toBe(true);
    }
    const [config] = await f.db.select().from(honorSeasons);
    expect(config?.state.pairs).toHaveLength(1);
    expect(BigInt(config!.state.pairs[0]!.raw)).toBe(rawTotal);
    const commanders = await f.db.select().from(players);
    expect(commanders.reduce((sum, row) => sum + row.dominionTaken - row.dominionLost, 0)).toBe(0);
  });
});
