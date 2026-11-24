import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DAILY_QUESTS, DAILY_QUEST_HONOR } from '@astera/rules';
import { arenaShips, battleReports, dailyQuestClaims, miningRuns, missions, pirateRaids, planets } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { launchProbe } from '../src/services/intel.js';
import { claimDailyQuest, dailyQuestsView } from '../src/services/dailyQuests.js';
import { giveInstrument, giveSatellite, grant, levelWorld, seedWorld, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * GÜNLÜK GÖREVLER (owner, 2026-11-24).
 *
 * Progress is COUNTED from the day's rows, like `rewards`, so every case below arranges the WORLD —
 * fly a probe, land a run, win a fight — and asserts the panel notices. The fixture clock opens at
 * 2026-01-01T00:00Z, exactly a UTC midnight, which makes the day edges easy to stand on either side of.
 */
describe('daily quests', () => {
  let f: Fixture;
  let mine: string;
  const DAY = 86_400_000;
  const start = new Date('2026-01-01T00:00:00.000Z').getTime();

  const quest = async (id: string) => (await dailyQuestsView(f.db, mine, f.clock)).quests.find(row => row.id === id)!;
  const probeFrom = async (target: number) => { await launchProbe(f.db, mine, f.planetIds[target]!, f.clock); };
  const at = (ms: number) => { f.clock.set(new Date(ms)); };

  beforeEach(async () => {
    f = await seedWorld(4);
    mine = f.planetIds[0]!;
    await levelWorld(f.db, f.planetIds);
    await grant(f.db, mine, 20_000, 8_000);
    await giveSatellite(f.db, mine, 'UPLINK');
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);
    // A main galaxy ranks Honor from its opening, so the quests pay their quarter-Honor (see daily-quest-honor.test.ts).
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  });

  const sortie = (lastSortieAt: Date | null) => f.db.insert(arenaShips).values({
    playerId: f.playerIds[0]!, ship: 'akinci', chosenAt: f.clock.now(), fuel: 100, ammo: 100, lastSortieAt,
  }).onConflictDoUpdate({ target: arenaShips.playerId, set: { lastSortieAt } });

  const pirateFight = async (index: number, survivors: number, createdAt: Date, grade: 'DECISIVE' | 'REPELLED' = 'DECISIVE') => {
    const [raid] = await f.db.insert(pirateRaids).values({
      seasonId: f.seasonId, planetId: mine, ownerPlayerId: f.playerIds[0]!, pirateIndex: index, status: 'done',
      fleet: { DART: survivors }, interceptX: 0, interceptY: 0, interceptZ: 0, departAt: createdAt, arriveAt: createdAt,
    }).returning();
    await f.db.insert(battleReports).values({
      seasonId: f.seasonId, pirateRaidId: raid!.id, targetKind: 'PIRATE', attackerPlayerId: f.playerIds[0]!, grade,
      rounds: [], loot: { alloy: 0, crystal: 0, deuterium: 0 }, attackerFleet: { DART: 2 },
      attackerLosses: { DART: 2 - survivors }, defenderLosses: {}, createdAt,
    });
  };

  const run = (over: Partial<typeof miningRuns.$inferInsert>) => f.db.insert(miningRuns).values({
    seasonId: f.seasonId, planetId: mine, targetKind: 'asteroid', asteroidIndex: 3, status: 'returning', craft: 1,
    holdEach: 100, interceptX: 0, interceptY: 0, interceptZ: 0, departAt: f.clock.now(), arriveAt: f.clock.now(), ...over,
  });

  /* ── the panel ─────────────────────────────────────────────── */

  it('opens a fresh day with the owner’s four quests, all locked, and says when they start again', async () => {
    const view = await dailyQuestsView(f.db, mine, f.clock);
    expect(view.day).toBe('2026-01-01');
    expect(view.resetsAt).toBe('2026-01-02T00:00:00.000Z');
    expect(view.quests.map(row => [row.id, row.goal, row.progress, row.state])).toEqual(
      DAILY_QUESTS.map(row => [row.id, row.goal, 0, 'locked']));
    expect(view.claimable).toBe(0);
    for (const row of view.quests) expect(row.alloy + row.crystal).toBeGreaterThan(0);
  });

  it('shows every quest paying a quarter of one Honor beside its purse', async () => {
    const view = await dailyQuestsView(f.db, mine, f.clock);
    expect(view.quests.map(row => row.honor)).toEqual(DAILY_QUESTS.map(() => DAILY_QUEST_HONOR));
  });

  /* ── PROBES ────────────────────────────────────────────────── */

  it('counts three probes sent today, and only then opens the purse', async () => {
    await probeFrom(1);
    await probeFrom(2);
    expect(await quest('PROBES')).toMatchObject({ progress: 2, state: 'locked' });
    await probeFrom(3);
    expect(await quest('PROBES')).toMatchObject({ progress: 3, state: 'claimable' });
    expect((await dailyQuestsView(f.db, mine, f.clock)).claimable).toBe(1);
  });

  it('never shows more progress than the goal asks for', async () => {
    for (const target of [1, 2, 3]) await probeFrom(target);
    at(start + 60_000);
    await probeFrom(1);
    expect((await quest('PROBES')).progress).toBe(3);
  });

  it('does not count a probe the game itself cancelled', async () => {
    for (const target of [1, 2, 3]) await probeFrom(target);
    await f.db.update(missions).set({ status: 'cancelled' }).where(eq(missions.kind, 'probe'));
    expect((await quest('PROBES')).progress).toBe(0);
  });

  it('does not count yesterday’s probes, and counts the last millisecond of a day for that day', async () => {
    at(start + DAY - 1);
    for (const target of [1, 2, 3]) await probeFrom(target);
    expect((await quest('PROBES')).progress).toBe(3);
    at(start + DAY);
    const view = await dailyQuestsView(f.db, mine, f.clock);
    expect(view.day).toBe('2026-01-02');
    expect(view.quests.find(row => row.id === 'PROBES')).toMatchObject({ progress: 0, state: 'locked' });
  });

  /* ── RIFT ──────────────────────────────────────────────────── */

  it('counts a Yarık sortie flown today, not one from yesterday and not none at all', async () => {
    expect((await quest('RIFT')).progress).toBe(0);
    await sortie(new Date(start - 1));
    expect(await quest('RIFT')).toMatchObject({ progress: 0, state: 'locked' });
    await sortie(new Date(start));
    expect(await quest('RIFT')).toMatchObject({ progress: 1, state: 'claimable' });
  });

  /* ── PIRATE ────────────────────────────────────────────────── */

  it('counts a pirate beaten today with ships left, and nothing else', async () => {
    const now = f.clock.now();
    await pirateFight(1, 0, now);
    await pirateFight(2, 1, now, 'REPELLED');
    expect((await quest('PIRATE')).progress).toBe(0);
    await pirateFight(3, 1, new Date(start - 1));
    expect((await quest('PIRATE')).progress).toBe(0);
    await pirateFight(4, 1, now);
    expect(await quest('PIRATE')).toMatchObject({ progress: 1, state: 'claimable' });
  });

  it('counts the same pirate once, however many times it is beaten', async () => {
    await pirateFight(7, 1, f.clock.now());
    await pirateFight(7, 1, f.clock.now());
    expect((await quest('PIRATE')).progress).toBe(1);
  });

  /* ── ASTEROID ──────────────────────────────────────────────── */

  it('counts an asteroid run that reached its rock today, never one still outbound, recalled, or a wreck', async () => {
    await run({ status: 'outbound' });
    await run({ recalledAt: f.clock.now(), asteroidIndex: 4 });
    await run({ targetKind: 'debris', asteroidIndex: 5 });
    await run({ arriveAt: new Date(start - 1), asteroidIndex: 6 });
    expect((await quest('ASTEROID')).progress).toBe(0);
    await run({ asteroidIndex: 7 });
    expect(await quest('ASTEROID')).toMatchObject({ progress: 1, state: 'claimable' });
  });

  /* ── the claim ─────────────────────────────────────────────── */

  const finishProbes = async () => { for (const target of [1, 2, 3]) await probeFrom(target); };
  const stored = async () => (await f.db.select().from(planets).where(eq(planets.id, mine)))[0]!;

  it('pays the purse into the capital once and says what it paid', async () => {
    await finishProbes();
    const before = await stored();
    const preview = await quest('PROBES');
    const result = await claimDailyQuest(f.db, mine, 'PROBES', f.clock);
    expect(result.granted).toEqual({ alloy: preview.alloy, crystal: preview.crystal, honor: DAILY_QUEST_HONOR });
    expect(result.quests.quests.find(row => row.id === 'PROBES')!.state).toBe('claimed');
    const after = await stored();
    expect(after.alloy - before.alloy).toBeCloseTo(preview.alloy, 0);
    expect(after.crystal - before.crystal).toBeCloseTo(preview.crystal, 0);
    expect(await f.db.select().from(dailyQuestClaims)).toHaveLength(1);
  });

  it('files the Honor with the claim, one quarter Honor per quest and never twice', async () => {
    await finishProbes();
    await sortie(new Date(start));
    await claimDailyQuest(f.db, mine, 'PROBES', f.clock);
    await claimDailyQuest(f.db, mine, 'RIFT', f.clock);
    await expect(claimDailyQuest(f.db, mine, 'RIFT', f.clock)).rejects.toMatchObject({ code: 'DAILY_QUEST_TAKEN' });
    const rows = await f.db.select().from(dailyQuestClaims);
    expect(rows.map(row => row.honorMicros)).toEqual([DAILY_QUEST_HONOR, DAILY_QUEST_HONOR]);
  });

  it('refuses a second payment for the same quest on the same day', async () => {
    await finishProbes();
    await claimDailyQuest(f.db, mine, 'PROBES', f.clock);
    await expect(claimDailyQuest(f.db, mine, 'PROBES', f.clock)).rejects.toMatchObject({ code: 'DAILY_QUEST_TAKEN' });
    expect(await f.db.select().from(dailyQuestClaims)).toHaveLength(1);
  });

  it('pays once when two presses race', async () => {
    await finishProbes();
    const before = await stored();
    const results = await Promise.allSettled([
      claimDailyQuest(f.db, mine, 'PROBES', f.clock), claimDailyQuest(f.db, mine, 'PROBES', f.clock),
    ]);
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(await f.db.select().from(dailyQuestClaims)).toHaveLength(1);
    const preview = (await dailyQuestsView(f.db, mine, f.clock)).quests.find(row => row.id === 'PROBES')!;
    expect((await stored()).alloy - before.alloy).toBeCloseTo(preview.alloy, 0);
  });

  it('refuses a quest that is not done yet, naming the goal and the progress', async () => {
    await probeFrom(1);
    await expect(claimDailyQuest(f.db, mine, 'PROBES', f.clock)).rejects.toMatchObject({
      code: 'DAILY_QUEST_LOCKED', params: { goal: 3, progress: 1 },
    });
    expect(await f.db.select().from(dailyQuestClaims)).toHaveLength(0);
  });

  it('refuses a quest that does not exist', async () => {
    await expect(claimDailyQuest(f.db, mine, 'NOPE', f.clock)).rejects.toMatchObject({ code: 'NO_SUCH_DAILY_QUEST' });
  });

  it('starts every quest again the next UTC day, and pays that day’s purse separately', async () => {
    await finishProbes();
    await claimDailyQuest(f.db, mine, 'PROBES', f.clock);
    at(start + DAY);
    expect(await quest('PROBES')).toMatchObject({ progress: 0, state: 'locked' });
    await finishProbes();
    expect(await quest('PROBES')).toMatchObject({ progress: 3, state: 'claimable' });
    await claimDailyQuest(f.db, mine, 'PROBES', f.clock);
    expect(await f.db.select().from(dailyQuestClaims)).toHaveLength(2);
  });

  it('keeps one quest’s claim from touching another’s', async () => {
    await finishProbes();
    await sortie(new Date(start));
    await claimDailyQuest(f.db, mine, 'PROBES', f.clock);
    expect(await quest('RIFT')).toMatchObject({ state: 'claimable' });
    await claimDailyQuest(f.db, mine, 'RIFT', f.clock);
    expect((await dailyQuestsView(f.db, mine, f.clock)).claimable).toBe(0);
  });
});
