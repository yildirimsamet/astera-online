import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MONUMENT_SEASON_DEFAULTS } from '@astera/rules';
import { hpRadiationSources, monuments } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('the approved monument season deal', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(1, 20_261_004);
  });

  afterAll(async () => { await (await testDb()).close(); });

  it('opens new default seasons with monuments while preserving an existing season’s deal', async () => {
    const current = await createSeason(f.db, {
      shardCode: 'MONUMENT-DEFAULT', seed: 919, startsAt: f.clock.now(),
    });
    expect(current.season.rulesetVersion).toBe(16);
    expect(await f.db.select().from(monuments).where(eq(monuments.seasonId, current.season.id)))
      .toHaveLength(MONUMENT_SEASON_DEFAULTS.count);
    expect(await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.seasonId, current.season.id)))
      .toHaveLength(MONUMENT_SEASON_DEFAULTS.count);
    expect(await f.db.select().from(monuments).where(eq(monuments.seasonId, f.seasonId))).toEqual([]);
  });

  it('deals five deterministic monuments and one HP cloud per monument for ruleset 16', async () => {
    const { season } = await createSeason(f.db, {
      shardCode: 'MONUMENT-SEED-16', seed: 917, startsAt: f.clock.now(), rulesetVersion: 16,
    });
    const rows = await f.db.select().from(monuments).where(eq(monuments.seasonId, season.id)).orderBy(monuments.ordinal);
    const clouds = await f.db.select().from(hpRadiationSources).where(and(
      eq(hpRadiationSources.seasonId, season.id), eq(hpRadiationSources.anchorKind, 'MONUMENT'),
    )).orderBy(hpRadiationSources.createdAt, hpRadiationSources.id);
    expect(rows).toHaveLength(MONUMENT_SEASON_DEFAULTS.count);
    expect(rows.map((row) => ({ ordinal: row.ordinal, x: row.x, y: row.y, z: row.z }))).toEqual(
      MONUMENT_SEASON_DEFAULTS.positions.map((position, index) => ({ ...position, ordinal: index + 1 })),
    );
    expect(rows.every((row) => row.capacity === MONUMENT_SEASON_DEFAULTS.capacity
      && row.productionPerMinute === MONUMENT_SEASON_DEFAULTS.productionPerMinute
      && row.garrisonTemplate.LEVIATHAN === MONUMENT_SEASON_DEFAULTS.garrison.LEVIATHAN
      && Object.keys(row.garrisonTech).length === 0)).toBe(true);
    expect(clouds).toHaveLength(rows.length);
    expect(clouds.map((cloud) => ({ anchorId: cloud.anchorId, radius: cloud.radius,
      intensity: cloud.intensityHpPerMinute, activeFrom: cloud.activeFrom }))
      .sort((a, b) => (a.anchorId ?? '').localeCompare(b.anchorId ?? ''))).toEqual(
      rows.map((row) => ({ anchorId: row.id, radius: MONUMENT_SEASON_DEFAULTS.cloudRadius,
        intensity: MONUMENT_SEASON_DEFAULTS.intensityHpPerMinute, activeFrom: season.startsAt }))
        .sort((a, b) => a.anchorId.localeCompare(b.anchorId)),
    );
  });

  it('does not backfill monuments into a ruleset 15 season', async () => {
    const { season } = await createSeason(f.db, {
      shardCode: 'MONUMENT-SEED-15', seed: 918, startsAt: f.clock.now(), rulesetVersion: 15,
    });
    expect(await f.db.select().from(monuments).where(eq(monuments.seasonId, season.id))).toEqual([]);
    expect(await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.seasonId, season.id))).toEqual([]);
  });
});
