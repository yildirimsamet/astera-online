import { afterAll, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { honorSeasons, scheduledEvents, seasons } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { enableHonorBenefits } from '../src/services/honorBenefits.js';
import { inheritedHonorBenefitsProgram } from '../src/services/honorProgram.js';
import { createSeason } from '../src/services/season.js';
import { forceSeasonEnd, onSeasonRollover } from '../src/worker/handlers.js';
import { seedWorld, testDb } from './helpers.js';
afterAll(async () => { await (await testDb()).close(); });

it('one galaxy enabling benefits does not block successors while another has not enabled them yet', async () => {
  const f = await seedWorld(2, 24017);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  const [current] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  if (!current) throw new Error('Missing benefit source season');
  const other = await createSeason(f.db, { shardCode: 'HONOR-OTHER', seed: 24018, startsAt: current.startsAt,
    endsAt: current.endsAt, playerCap: 4, honorVersion: 3 });
  await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
  expect((await f.db.select().from(honorSeasons).where(eq(honorSeasons.seasonId, other.season.id)))[0]?.benefitsVersion).toBeNull();
  expect(await f.db.transaction(tx => inheritedHonorBenefitsProgram(tx, current.endsAt))).toBe(1);
});

it('the real successor inherits an explicitly enabled economic program without enabling trials or resetting scores', async () => {
  const f = await seedWorld(2, 24017);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.seasonId, f.seasonId), eq(scheduledEvents.kind, 'season_rollover')));
  if (!event) throw new Error('Missing benefit successor rollover');
  f.clock.set(event.resolveAt);
  await onSeasonRollover({ db: f.db, clock: f.clock }, event);
  const next = await f.db.select().from(seasons).where(eq(seasons.status, 'live'));
  const configs = await f.db.select().from(honorSeasons);
  expect(next.length).toBeGreaterThan(0);
  expect(next.every(row => configs.some(config => config.seasonId === row.id && config.mode === 'ACTIVE' && config.benefitsVersion === 1))).toBe(true);
});

it('the real Honor season rollover preserves the primary competition in its successor', async () => {
  const f = await seedWorld(2, 24017);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.seasonId, f.seasonId), eq(scheduledEvents.kind, 'season_rollover')));
  f.clock.set(event!.resolveAt);
  await onSeasonRollover({ db: f.db, clock: f.clock }, event!);
  const next = await f.db.select().from(seasons).where(eq(seasons.status, 'live'));
  const configs = await f.db.select().from(honorSeasons);

  expect(next.length).toBeGreaterThan(0);
  expect(next.every(row => configs.some(config => config.seasonId === row.id && config.mode === 'ACTIVE' && config.version === 3))).toBe(true);
});

it('a preallocated empty next cycle does not erase the last announced main-galaxy program', async () => {
  const f = await seedWorld(2, 24017);
  await f.db.transaction(tx => prepareHonorSeason(tx,f.seasonId,'ACTIVE',f.clock));
  const {seasonCycles} = await import('../src/db/schema.js');
  const {inheritedHonorProgram} = await import('../src/services/honorProgram.js');
  const [current] = await f.db.select().from(seasonCycles);
  const startsAt = new Date(current!.endsAt.getTime()+1);
  await f.db.insert(seasonCycles).values({ordinal:current!.ordinal+1,startsAt,
    endsAt:new Date(startsAt.getTime()+14*86400000)});
  expect(await f.db.transaction(tx=>inheritedHonorProgram(tx,startsAt))).toBe(3);
});
