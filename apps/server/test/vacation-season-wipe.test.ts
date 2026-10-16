import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { honorTotals, planets, players, seasonResults, seasons, vacations } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { wipeAllServers } from '../src/services/servers.js';
import { joinSeason } from '../src/services/player.js';
import { endVacation, startVacation, vacationStatus } from '../src/services/vacation.js';
import { collectWorks, upgradeBuilding } from '../src/services/build.js';
import { planetView } from '../src/services/planetView.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it.each([false, true])('force wipe during paid vacation preserves the old record and starts a playable, non-vacation successor (Honor: %s)', async honor => {
  const f = await seedWorld(2);
  const playerId = f.playerIds[0]!, accountId = f.accountIds[0]!, worldId = f.planetIds[0]!;
  if (honor) {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId, score: 75_000_000 });
  }
  await f.db.update(players).set({ dominionTaken: 1000, dominionLost: 100 }).where(eq(players.id, playerId));
  await f.db.update(planets).set({ deuterium: 100_000 }).where(eq(planets.id, worldId));
  const quote = await vacationStatus(f.db, playerId, f.clock, 2);
  expect(quote.blocker).toBeNull();
  const started = await startVacation(f.db, playerId, 2, quote.fingerprint, randomUUID(), f.clock);
  if (!started.active) throw new Error('Expected paid vacation');
  f.clock.advance(60);
  expect(started.active.endsAt.getTime()).toBeGreaterThan(f.clock.now().getTime());
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  const records = await f.db.select().from(seasonResults).where(eq(seasonResults.seasonId, f.seasonId));
  expect(records).toHaveLength(2);
  expect(records.find(row => row.accountId === accountId)).toMatchObject({ dominion: 900,
    honorScore: honor ? 75_000_000 : null, honorRank: honor ? 1 : null });
  await expect(wipeAllServers(f.db, f.clock, { count: 1, capacity: 4, rulesetVersion: 18 }))
    .resolves.toMatchObject({ seasonsWiped: 1, playersCleared: 2 });
  expect(await f.db.select().from(vacations)).toEqual([]);
  expect(await f.db.select().from(players)).toEqual([]);
  const [next] = await f.db.select().from(seasons).where(eq(seasons.status, 'live'));
  if (!next) throw new Error('Expected successor season');
  await joinSeason(f.db, accountId, next.id, f.clock);
  const [commander] = await f.db.select().from(players).where(eq(players.accountId, accountId));
  if (!commander) throw new Error('Expected new commander');
  expect(commander.id).not.toBe(playerId);
  expect(commander).toMatchObject({ seasonId: next.id, vacationUntil: null, dominionTaken: 0, dominionLost: 0 });
  const [capital] = await f.db.select().from(planets).where(and(eq(planets.controllerPlayerId, commander.id), eq(planets.kind, 'CAPITAL')));
  if (!capital) throw new Error('Expected new capital');
  const view = await f.db.transaction(tx => planetView(tx, capital.id, f.clock));
  expect(view.vacationUntil).toBeNull();
  expect((await vacationStatus(f.db, commander.id, f.clock)).active).toBeNull();
  await expect(endVacation(f.db, commander.id, started.active.id, f.clock)).rejects.toMatchObject({ code: 'VACATION_NOT_FOUND' });
  await expect(collectWorks(f.db, capital.id, f.clock, commander.id)).resolves.toBeDefined();
  await expect(upgradeBuilding(f.db, capital.id, 'CORE', f.clock, commander.id)).resolves.toBeDefined();
  expect(await f.db.select().from(seasonResults).where(eq(seasonResults.seasonId, f.seasonId))).toEqual(records);
});
