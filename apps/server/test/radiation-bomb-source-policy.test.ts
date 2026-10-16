import { afterAll, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { segmentsExposureHp } from '@astera/rules';
import { hpRadiationSources, seasons } from '../src/db/schema.js';
import { activeHpSourcesForSeason, hpRadiationForGalaxy, hpSourcesForSeason } from '../src/services/radiationSources.js';
import { assertRadiationSafe } from '../src/services/radiation.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });
it('accepts an empty authoritative route without constructing a non-finite source query window', async () => {
  const f = await seedWorld(1);
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await expect(f.db.transaction(tx => assertRadiationSafe(tx, { seasonId: f.seasonId,
    from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, departAt: f.clock.now(), arriveAt: f.clock.now(),
    fleet: { DART: 1 }, acknowledged: false, path: [] }))).resolves.toBeUndefined();
});
it('propagates the exact season cap epoch through historical, current and public source projections', async () => {
  const f = await seedWorld(1);
  const cutover = new Date(f.clock.now().getTime() + 10 * 60000);
  await f.db.update(seasons).set({ radiationBombStartsAt: cutover, rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  for (let i = 0; i < 2; i++) await f.db.insert(hpRadiationSources).values({
    seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: f.planetIds[0]!,
    x: 0, y: 0, z: 0, radius: 1, intensityHpPerMinute: 40, mode: 'EMIT', activeFrom: f.clock.now(),
  });
  const historical = await hpSourcesForSeason(f.db, f.seasonId);
  expect(historical.filter(source => source.activeFromMs >= cutover.getTime()).every(source => source.target?.id === f.planetIds[0])).toBe(true);
  expect(historical.every(source => source.totalCapFromMs === cutover.getTime())).toBe(true);
  const start = f.clock.now().getTime();
  const at = { x: 0, y: 0, z: 0 };
  expect(segmentsExposureHp([{ from: at, to: at, startMs: start, endMs: start + 20 * 60000,
    target: { kind: 'PLANET', id: f.planetIds[0]! } }], historical)).toBeCloseTo(1300);
  const current = await activeHpSourcesForSeason(f.db, f.seasonId, cutover);
  expect(current).toHaveLength(2);
  expect(current.every(source => source.target?.id === f.planetIds[0])).toBe(true);
  expect(segmentsExposureHp([{ from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 },
    startMs: cutover.getTime(), endMs: cutover.getTime() + 60000 }], current)).toBe(0);
  expect(current.every(source => source.totalCapFromMs === cutover.getTime())).toBe(true);
  const publicSources = await hpRadiationForGalaxy(f.db, f.seasonId, cutover);
  expect(publicSources).toHaveLength(2);
  expect(publicSources.every(source => source.origin === 'ENVIRONMENT')).toBe(true);
  expect(publicSources.filter(source => new Date(source.activeFrom) >= cutover).every(source => source.target?.id === f.planetIds[0])).toBe(true);
  expect(publicSources.every(source => source.totalCapFrom === cutover.toISOString())).toBe(true);
  expect(publicSources.every(source => !('ownerPlayerId' in source) && !('bombFlightId' in source))).toBe(true);
  await f.db.update(seasons).set({ radiationBombStartsAt: null }).where(eq(seasons.id, f.seasonId));
  expect((await hpSourcesForSeason(f.db, f.seasonId)).every(source => source.totalCapFromMs === undefined)).toBe(true);
});
