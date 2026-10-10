import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MONUMENT_BALANCE, MONUMENT_SEASON_DEFAULTS, monumentDifficulty } from '@astera/rules';
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

  it('deals four Easy and four Hard spherical monuments with their own HP cloud for ruleset 16', async () => {
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
    expect(rows.filter(row => row.difficulty === 'EASY')).toHaveLength(4);
    expect(rows.filter(row => row.difficulty === 'HARD')).toHaveLength(4);
    for (const row of rows) {
      const difficulty = monumentDifficulty(row.ordinal);
      const balance = MONUMENT_BALANCE[difficulty];
      expect(row).toMatchObject({ difficulty, capacity: balance.capacity,
        productionPerMinute: balance.productionPerMinute, garrison: balance.garrison,
        garrisonTemplate: balance.garrison, garrisonTech: {} });
    }
    expect(clouds).toHaveLength(rows.length);
    expect(clouds.map((cloud) => ({ anchorId: cloud.anchorId, radius: cloud.radius,
      intensity: cloud.intensityHpPerMinute, activeFrom: cloud.activeFrom }))
      .sort((a, b) => (a.anchorId ?? '').localeCompare(b.anchorId ?? ''))).toEqual(
      rows.map((row) => ({ anchorId: row.id, radius: MONUMENT_SEASON_DEFAULTS.cloudRadius,
        intensity: MONUMENT_BALANCE[monumentDifficulty(row.ordinal)].intensityHpPerMinute, activeFrom: season.startsAt }))
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
