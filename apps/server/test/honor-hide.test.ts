import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorEvents, honorSeasons, honorTotals, players, scheduledEvents, seasons } from '../src/db/schema.js';
import { hideHonorRanking, openHonorRanking } from '../src/services/honorActivation.js';
import { replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';
import { enableHonorBenefits } from '../src/services/honorBenefits.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { honorPodium } from '../src/services/honorPodium.js';
import { inheritedHonorProgram } from '../src/services/honorProgram.js';
import { readHonorReceipts } from '../src/services/honorReports.js';
import { sealHonor } from '../src/services/honorSeason.js';
import { forceSeasonEnd, onSeasonRollover } from '../src/worker/handlers.js';
import { giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

/** Owner 2026-10-20: ranked Honor goes back to invisible observation and opens with the next season. */
describe('hiding an opened Honor race until the next season', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 7719);
    for (const id of f.planetIds) { await setLevel(f.db, id, 'CORE', 9); await giveUnits(f.db, id, { DART: 30 }); }
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
    f.clock.advance(2 * 24 * 60);
  });
  const hide = (apply = false) => hideHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply });
  const open = () => openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
  const evidence = (over: Partial<HonorEvidence> = {}): HonorEvidence => ({
    source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(), eligible: true,
    attack: [{ id: f.playerIds[0]!, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 }],
    defence: [{ id: f.playerIds[1]!, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 1000, combatLoss: 1000, lootLost: 0 }],
    relations: [{ a: f.playerIds[0]!, b: f.playerIds[1]!, related: false }], ...over,
  });
  const settle = (value: HonorEvidence) => f.db.transaction(tx => settleHonor(tx, f.seasonId, value));
  const snapshot = async () => ({ config: await f.db.select().from(honorSeasons), events: await f.db.select().from(honorEvents),
    totals: await f.db.select().from(honorTotals), players: await f.db.select().from(players), seasons: await f.db.select().from(seasons) });
  /** Shadow trial before opening, then a ranked event after it. */
  const race = async () => {
    const trial = evidence(); await settle(trial);
    f.clock.advance(1); await open();
    f.clock.advance(1); const ranked = evidence({ at: f.clock.now().getTime() }); await settle(ranked);
    f.clock.advance(1);
    return { trial, ranked };
  };

  it('previews without writing anything', async () => {
    await race();
    const before = await snapshot();
    expect(await hide()).toMatchObject({ status: 'READY', applied: false, mode: 'SHADOW', rankedEvents: 1 });
    expect(await snapshot()).toEqual(before);
  });

  it('turns every ranked point back into invisible evidence over the whole season', async () => {
    const { trial, ranked } = await race();
    const before = await snapshot();
    expect(await hide(true)).toMatchObject({ status: 'READY', applied: true });
    const after = await snapshot();
    const { events: outcomes, ...expected } = replayHonor([trial, ranked], 4);
    expect(after.config[0]).toMatchObject({ mode: 'SHADOW', rankedAt: null, successorAnnounced: true,
      createdAt: before.config[0]!.createdAt, legacySources: before.config[0]!.legacySources, state: expected });
    expect(after.events.every(row => !row.ranked)).toBe(true);
    expect(after.events.map(row => row.outcome).sort((a, b) => a.key.localeCompare(b.key)))
      .toEqual([...outcomes].sort((a, b) => a.key.localeCompare(b.key)));
    expect(after.totals.map(row => ({ actor: row.playerId, score: row.score })).sort((a, b) => a.actor.localeCompare(b.actor)))
      .toEqual(expected.totals);
    for (const key of ['players', 'seasons'] as const) expect(after[key]).toEqual(before[key]);
    // Nothing ranked is visible any more: no receipts, no podium, no season-end Honor prizes.
    expect(await f.db.transaction(tx => readHonorReceipts(tx, f.playerIds[0]!, [ranked]))).toEqual(new Map());
    expect((await honorPodium(f.db, f.seasonId, new Set())).active).toBe(false);
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    expect(await f.db.transaction(tx => sealHonor(tx, { seasonId: f.seasonId, at: season!.endsAt, humanPlayerIds: f.playerIds }))).toBeNull();
  });

  it('keeps collecting invisible evidence consistently after hiding, late events included', async () => {
    const { trial, ranked } = await race();
    await hide(true);
    const later = evidence({ at: f.clock.now().getTime() }); await settle(later);
    const late = evidence({ at: trial.at + 1 }); await settle(late);
    const { events: _events, ...expected } = replayHonor([trial, ranked, later, late], 4);
    expect((await f.db.select().from(honorSeasons))[0]!.state).toEqual(expected);
    expect((await f.db.select().from(honorEvents)).every(row => !row.ranked)).toBe(true);
  });

  it('retries never write again', async () => {
    await race();
    await hide(true);
    const before = await snapshot();
    for (const apply of [false, true]) expect(await hide(apply)).toMatchObject({ status: 'ALREADY_HIDDEN', applied: false });
    expect(await snapshot()).toEqual(before);
  });

  it('refuses a race whose economic benefits are already on', async () => {
    await race();
    await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    await expect(hide(true)).rejects.toThrow('Honor benefits');
  });

  it('the next season starts with ranked Honor; an unannounced trial still does not carry', async () => {
    const [current] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    expect(await f.db.transaction(tx => inheritedHonorProgram(tx, current!.endsAt))).toBeUndefined();
    await race();
    await hide(true);
    expect(await f.db.transaction(tx => inheritedHonorProgram(tx, current!.endsAt))).toBe(4);
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    const [event] = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.seasonId, f.seasonId), eq(scheduledEvents.kind, 'season_rollover')));
    f.clock.set(event!.resolveAt);
    await onSeasonRollover({ db: f.db, clock: f.clock }, event!);
    const next = await f.db.select().from(seasons).where(eq(seasons.status, 'live'));
    const configs = await f.db.select().from(honorSeasons);
    expect(next.length).toBeGreaterThan(0);
    expect(next.every(row => configs.some(config => config.seasonId === row.id && config.mode === 'ACTIVE'
      && config.version === 4 && !config.successorAnnounced))).toBe(true);
  });
});
