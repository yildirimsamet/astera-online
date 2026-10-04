import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { MONUMENT_CAPACITY } from '@astera/rules';
import { accounts, clans, clanMemberships, monumentBattles, monumentBattleParticipants, monuments, monumentShipLots, monumentWaves, planets, players, units } from '../src/db/schema.js';
import { departToSilentSpace, runSilentSpaceSweep } from '../src/services/silentSpace.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it.each(['manual', 'sweep'] as const)('keeps a delayed operator monument battle exempt during %s Silent Space clan dissolution', async (entry) => {
  const f = await seedWorld(3, 20_261_003);
  const start = f.clock.now();
  const clan = (await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Dormant Pact', nameKey: 'dormant pact', tag: 'DP', level: 1, createdAt: start }).returning())[0]!;
  for (const owner of [0, 1]) await f.db.insert(clanMemberships).values({ seasonId: f.seasonId,
    clanId: clan.id, playerId: f.playerIds[owner]!, slot: owner, role: owner === 0 ? 'LEADER' : 'MEMBER',
    joinedAt: start, matureAt: start, aidPolicyChangedAt: start });
  const monument = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1,
    x: 6000, y: 0, z: 0, capacity: MONUMENT_CAPACITY, productionPerMinute: 0,
    controllerClanId: clan.id, settledAt: start }).returning())[0]!;
  const holdingId = randomUUID();
  await f.db.insert(monumentWaves).values({ id: holdingId, seasonId: f.seasonId, monumentId: monument.id,
    playerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, unitLocation: `monument:${holdingId}`,
    purpose: 'REINFORCE', sentFleet: { DART: 1 }, tech: {}, route: [], fuelPaid: 0, status: 'HOLD',
    sentAt: start, heldAt: start, radiationSettledAt: start });
  await f.db.insert(monumentShipLots).values({ waveId: holdingId, hull: 'DART', count: 1, damageBp: 0, remainderBp: 0, deuterium: 0 });
  await f.db.insert(units).values({ planetId: f.planetIds[1]!, ownerPlayerId: f.playerIds[1]!, location: `monument:${holdingId}`, hull: 'DART', count: 1 });
  const attackId = randomUUID();
  const origin = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[2]!)))[0]!;
  const eta = new Date(start.getTime() + 60_000);
  await f.db.insert(monumentWaves).values({ id: attackId, seasonId: f.seasonId, monumentId: monument.id,
    playerId: f.playerIds[2]!, originPlanetId: origin.id, unitLocation: `monument:${attackId}`,
    purpose: 'ATTACK', sentFleet: { CATACLYSM: 20 }, tech: {}, fuelPaid: 0, status: 'OUTBOUND',
    route: [{ from: { x: origin.x, y: origin.y, z: origin.z }, to: { x: monument.x, y: monument.y, z: monument.z }, startMs: start.getTime(), endMs: eta.getTime() }],
    sentAt: start, arriveAt: eta, radiationSettledAt: start });
  await f.db.insert(monumentShipLots).values({ waveId: attackId, hull: 'CATACLYSM', count: 20, damageBp: 0, remainderBp: 0, deuterium: 0 });
  await f.db.insert(units).values({ planetId: origin.id, ownerPlayerId: f.playerIds[2]!, location: `monument:${attackId}`, hull: 'CATACLYSM', count: 20 });
  const operator = (await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[2]!)))[0]!;
  f.clock.advance(49 * 60);
  await f.db.update(players).set({ lastActiveAt: f.clock.now() }).where(eq(players.id, f.playerIds[2]!));
  if (entry === 'manual') {
    expect((await departToSilentSpace(f.db, f.clock, 'Tester0', { adminUsernames: [operator.username] })).status).toBe('MOVED');
  } else {
    expect(await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1, adminUsernames: [operator.username] })).toMatchObject({ ran: true, movedOut: 1, failed: 0 });
  }
  expect((await f.db.select().from(monumentBattles))[0]).toMatchObject({ eligible: false, transfer: 0, createdAt: eta });
  expect((await f.db.select().from(monumentBattleParticipants)).every((row) => row.dominionDelta === 0)).toBe(true);
  expect((await f.db.select().from(players)).every((row) => row.dominionTaken === 0 && row.dominionLost === 0)).toBe(true);
});
