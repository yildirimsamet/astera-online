import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { planets, sensorEpochs } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { refreshSensorEpoch, sensorHistoryForPlayer } from '../src/services/sensorHistory.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it.each([0, 1])('separates identical coordinates across seasons after %s minutes', async (minutes) => {
  const f = await seedWorld(1);
  const target = await createSeason(f.db, {
    shardCode: 'WAIT-SENSOR-TEST', seed: 42, startsAt: f.clock.now(), rulesetVersion: 1,
  });
  const planetId = f.planetIds[0]!;
  const playerId = f.playerIds[0]!;
  f.clock.advance(minutes);
  // Arrange the boundary directly: this tests epoch isolation, not a transfer engine.
  await f.db.update(planets).set({ seasonId: target.season.id }).where(eq(planets.id, planetId));
  await refreshSensorEpoch(f.db, planetId, f.clock.now());
  const rows = await f.db.select().from(sensorEpochs).where(eq(sensorEpochs.playerId, playerId));
  const current = rows.filter((row) => row.endsAt === null);
  expect(current).toHaveLength(1);
  expect(current[0]?.seasonId).toBe(target.season.id);
  expect(rows.filter((row) => row.seasonId === f.seasonId)).toHaveLength(minutes === 0 ? 0 : 1);
  const history = await sensorHistoryForPlayer(f.db, playerId, target.season.id);
  expect(history).toHaveLength(1);
  expect(history[0]?.startsAt).toBe(minutes);
});

it('never returns a source galaxy sensor epoch in a target query', async () => {
  const f = await seedWorld(1);
  const target = await createSeason(f.db, {
    shardCode: 'WAIT-SENSOR-TEST', seed: 42, startsAt: f.clock.now(), rulesetVersion: 1,
  });
  expect(await sensorHistoryForPlayer(f.db, f.playerIds[0]!, target.season.id)).toEqual([]);
});
