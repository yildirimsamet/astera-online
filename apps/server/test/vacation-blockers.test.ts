import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { GALAXY_EVENTS, TRADE } from '@astera/rules';
import { clanSupportWaves, clanWarContributions, clanWarOperations, clans, miningRuns, missions,
  monumentProbes, monuments, monumentWaves, pirateRaids, planets, seasons, galaxyEventOccurrences,
  tradeRuns, intergalacticConvoyRuns, strategicAssets, radiationBombFlights, scheduledEvents } from '../src/db/schema.js';
import { startVacation, vacationStatus } from '../src/services/vacation.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(3);
  await f.db.update(planets).set({ deuterium: 100000 });
});
afterAll(async () => { await (await testDb()).close(); });
const later = () => new Date(f.clock.now().getTime() + 3600000);
const status = (days = 1) => vacationStatus(f.db, f.playerIds[0]!, f.clock, days);
async function flight(over: Partial<typeof missions.$inferInsert> = {}) {
  return (await f.db.insert(missions).values({ seasonId: f.seasonId, ownerPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!, kind: 'attack',
    fleet: { DART: 1 }, fuelPaid: 0, distance: 1, departAt: f.clock.now(), arriveAt: later(), ...over }).returning())[0]!;
}
async function group() {
  return (await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Vacation', nameKey: 'vacation',
    tag: 'VAC', createdAt: f.clock.now() }).returning())[0]!;
}

it.each([
  ['attack', 'VACATION_FLEET'], ['probe', 'VACATION_PROBES'], ['return', 'VACATION_FLEET'],
  ['transfer', 'VACATION_FLEET'], ['settlement', 'VACATION_FLEET'], ['death_star', 'VACATION_FLEET'],
  ['clan_transfer', 'VACATION_FLEET'], ['clan_support', 'VACATION_SUPPORT_SENT'], ['clan_war', 'VACATION_CLAN_FLEET'],
] as const)('explains own %s flights and stops blocking when they resolve', async (kind, reason) => {
  const row = await flight({ kind });
  expect(await status()).toMatchObject({ blocker: 'VACATION_FLIGHTS', reasons: [reason] });
  await f.db.update(missions).set({ status: 'resolved' }).where(eq(missions.id, row.id));
  expect(await status()).toMatchObject({ blocker: null, reasons: [] });
});

it.each(['attack', 'probe', 'clan_war', 'clan_support'] as const)('keeps foreign %s flights generic and ignores unrelated flights', async kind => {
  await flight({ kind, ownerPlayerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, targetPlanetId: f.planetIds[2]! });
  expect(await status()).toMatchObject({ blocker: null, reasons: [] });
  await flight({ kind, ownerPlayerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, targetPlanetId: f.planetIds[0]! });
  expect(await status()).toMatchObject({ blocker: 'VACATION_FLIGHTS', reasons: ['VACATION_FLIGHTS'] });
});

it('returns concurrent duration, flight and funds obstacles without changing admission error priority', async () => {
  await f.db.update(planets).set({ deuterium: 0, bufferDeuterium: 0 }).where(eq(planets.id, f.planetIds[0]!));
  await f.db.update(seasons).set({ endsAt: new Date(f.clock.now().getTime() + 2 * 86400000) }).where(eq(seasons.id, f.seasonId));
  await flight(); await flight(); await flight({ kind: 'probe' });
  const q = await status(2);
  expect(q).toMatchObject({ blocker: 'VACATION_DURATION' });
  expect(q).toHaveProperty('reasons', ['VACATION_DURATION', 'VACATION_FLEET', 'VACATION_PROBES', 'VACATION_FUNDS']);
  await expect(startVacation(f.db, f.playerIds[0]!, 2, q.fingerprint, randomUUID(), f.clock))
    .rejects.toMatchObject({ code: 'VACATION_DURATION' });
});

it.each(['outbound', 'returning', 'done'] as const)('reports %s mining and pirate activity independently', async state => {
  await f.db.insert(miningRuns).values({ seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
    status: state, asteroidIndex: 0, craft: 1, holdEach: 200, interceptX: 1, interceptY: 0, interceptZ: 0,
    departAt: f.clock.now(), arriveAt: later() });
  await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
    pirateIndex: 0, status: state, fleet: { DART: 1 }, interceptX: 1, interceptY: 0, interceptZ: 0,
    departAt: f.clock.now(), arriveAt: later() });
  const q = await status();
  expect(q).toHaveProperty('reasons', state === 'done' ? [] : ['VACATION_MINING', 'VACATION_PIRATES']);
});

it.each(['OUTBOUND', 'STATIONED', 'RETURNING', 'HOME', 'LOST'] as const)('distinguishes sent and hosted %s clan support without any airborne mission', async state => {
  const clan = await group();
  const outward = await flight({ kind: 'clan_support', status: 'resolved' });
  const id = randomUUID();
  await f.db.insert(clanSupportWaves).values({ id, seasonId: f.seasonId, clanId: clan.id,
    senderPlayerId: f.playerIds[0]!, hostPlayerId: f.playerIds[1]!, originPlanetId: f.planetIds[0]!,
    hostPlanetId: f.planetIds[1]!, unitLocation: `support:${id}`, fleet: { DART: 1 }, reservedBulk: 1,
    fuelPaid: 5, status: state, outboundMissionId: outward.id, sentAt: f.clock.now(), arriveAt: later(),
    stationedAt: f.clock.now(), expiresAt: later(), returnAt: later(), returnReason: 'RECALLED', resolvedAt: later() });
  const live = state !== 'HOME' && state !== 'LOST';
  expect(await status()).toHaveProperty('reasons', live ? ['VACATION_SUPPORT_SENT'] : []);
  await f.db.update(clanSupportWaves).set({ senderPlayerId: f.playerIds[1]!, hostPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[1]!, hostPlanetId: f.planetIds[0]! }).where(eq(clanSupportWaves.id, id));
  expect(await status()).toHaveProperty('reasons', live ? ['VACATION_SUPPORT_HOSTED'] : []);
});

it.each(['OUTBOUND', 'STAGED', 'RECALL_ORDERED', 'IN_BATTLE', 'RETURNING'] as const)('explains %s joint fleet contributions independently of operation leadership', async state => {
  const clan = await group();
  const [op] = await f.db.insert(clanWarOperations).values({ seasonId: f.seasonId, clanId: clan.id,
    clanName: clan.name, clanTag: clan.tag, leaderPlayerId: f.playerIds[1]!, stagingPlanetId: f.planetIds[1]!,
    targetPlanetId: f.planetIds[2]!, targetPlayerId: f.playerIds[2]!, targetPlanetName: 'Target',
    targetX: 1, targetY: 0, targetZ: 0, createdAt: f.clock.now(), expiresAt: later() }).returning();
  await f.db.insert(clanWarContributions).values({ seasonId: f.seasonId, operationId: op!.id, clanId: clan.id,
    playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, fleet: { DART: 1 }, tech: {},
    unitLocation: `joint:${randomUUID()}`, reservedBulk: 1, fuelPaid: 5, fuelLegs: [], status: state, sentAt: f.clock.now() });
  expect(await status()).toHaveProperty('reasons', ['VACATION_CLAN_FLEET']);
  await f.db.update(clanWarOperations).set({ leaderPlayerId: f.playerIds[0]! }).where(eq(clanWarOperations.id, op!.id));
  expect(await status()).toHaveProperty('reasons', ['VACATION_CLAN_FLEET', 'VACATION_CLAN_OPERATION']);
});

it('keeps a foreign joint operation generic and ignores its completed history', async () => {
  const clan = await group();
  const [op] = await f.db.insert(clanWarOperations).values({ seasonId: f.seasonId, clanId: clan.id,
    clanName: clan.name, clanTag: clan.tag, leaderPlayerId: f.playerIds[1]!, stagingPlanetId: f.planetIds[1]!,
    targetPlanetId: f.planetIds[0]!, targetPlayerId: f.playerIds[0]!, targetPlanetName: 'Private target',
    targetX: 1, targetY: 0, targetZ: 0, createdAt: f.clock.now(), expiresAt: later() }).returning();
  expect(await status()).toHaveProperty('reasons', ['VACATION_FLIGHTS']);
  await f.db.update(clanWarOperations).set({ status: 'COMPLETED', closeReason: 'LEADER_CANCEL', completedAt: f.clock.now() }).where(eq(clanWarOperations.id, op!.id));
  expect(await status()).toHaveProperty('reasons', []);
});

it.each(['OUTBOUND', 'HOLD', 'RETURNING', 'HOME', 'LOST'] as const)('explains %s monument ships separately from monument probes', async state => {
  const [m] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: 7270, productionPerMinute: 0, settledAt: f.clock.now() }).returning();
  const id = randomUUID();
  await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m!.id,
    playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, unitLocation: `monument:${id}`, purpose: 'ATTACK',
    sentFleet: { DART: 1 }, tech: {}, route: [], fuelPaid: 5, status: state, sentAt: f.clock.now(), heldAt: f.clock.now(),
    arriveAt: later(), returnReason: state === 'RETURNING' ? 'RECALLED' : null, resolvedAt: later(), radiationSettledAt: f.clock.now() });
  await f.db.insert(monumentProbes).values({ seasonId: f.seasonId, monumentId: m!.id, playerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!, outboundRoute: [], departAt: f.clock.now(), arriveAt: later() });
  expect(await status()).toHaveProperty('reasons', state === 'HOME' || state === 'LOST'
    ? ['VACATION_MONUMENT_PROBES'] : ['VACATION_MONUMENT_FLEET', 'VACATION_MONUMENT_PROBES']);
});

it.each(['outbound', 'returning', 'done'] as const)('distinguishes %s Trade Ship and Intergalactic Convoy trips', async state => {
  const base = { seasonId: f.seasonId, startsAt: f.clock.now(), endsAt: later(), definitionVersion: 1 };
  const [trade] = await f.db.insert(galaxyEventOccurrences).values({ ...base, sequence: 1000,
    kind: 'TRADE_SHIP', effect: { rate: TRADE.rate } }).returning();
  const effect = GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows[0]!.effect;
  const [convoy] = await f.db.insert(galaxyEventOccurrences).values({ ...base, sequence: 1001,
    kind: 'INTERGALACTIC_CONVOY', effect }).returning();
  const run = { seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
    status: state, fleet: { COURIER: 1 }, interceptX: 1, interceptY: 0, interceptZ: 0,
    departAt: f.clock.now(), arriveAt: later(), homeAt: new Date(later().getTime() + 3600000) };
  const resources = { alloy: 1, crystal: 0, deuterium: 0 };
  await f.db.insert(tradeRuns).values({ ...run, occurrenceId: trade!.id, give: resources, want: resources, rate: TRADE.rate });
  await f.db.insert(intergalacticConvoyRuns).values({ ...run, occurrenceId: convoy!.id, tech: {},
    engagementEndX: 1, engagementEndY: 0, engagementEndZ: 0, returnX: 0, returnY: 0, returnZ: 0,
    engagementEndsAt: new Date(later().getTime() + 5000), productionCap: resources,
    resourceQualityFactor: 1, shipQualityFactor: 1, quotedResourceReward: resources,
    ...(state === 'outbound' ? {} : { resourceReward: resources, awardedFleet: {} }) });
  expect(await status()).toHaveProperty('reasons', state === 'done' ? [] : ['VACATION_TRADE', 'VACATION_CONVOY']);
});

it('keeps a foreign strategic flight generic, but identifies the owner’s strategic flight', async () => {
  const [asset] = await f.db.insert(strategicAssets).values({ planetId: f.planetIds[1]!, status: 'LAUNCHED', startedAt: f.clock.now() }).returning();
  const [bomb] = await f.db.insert(radiationBombFlights).values({ assetId: asset!.id, seasonId: f.seasonId,
    ownerPlayerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, targetPlanetId: f.planetIds[0]!,
    targetKind: 'PLANET', level: 1, departAt: f.clock.now(), arriveAt: later(),
    originPosition: { x: 1, y: 0, z: 0 }, targetPosition: { x: 0, y: 0, z: 0 } }).returning();
  expect(await status()).toHaveProperty('reasons', ['VACATION_FLIGHTS']);
  await f.db.update(radiationBombFlights).set({ ownerPlayerId: f.playerIds[0]! }).where(eq(radiationBombFlights.id, bomb!.id));
  expect(await status()).toHaveProperty('reasons', ['VACATION_STRATEGIC']);
  await f.db.update(radiationBombFlights).set({ status: 'HIT', resolvedAt: later() }).where(eq(radiationBombFlights.id, bomb!.id));
  expect(await status()).toHaveProperty('reasons', []);
});

it('lists a due personal event and insufficient funds together, then clears after both resolve', async () => {
  await f.db.update(planets).set({ deuterium: 0, bufferDeuterium: 0 }).where(eq(planets.id, f.planetIds[0]!));
  const [event] = await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'fault_spawn',
    refId: f.planetIds[0]!, resolveAt: f.clock.now() }).returning();
  expect(await status()).toMatchObject({ blocker: 'VACATION_SETTLING', reasons: ['VACATION_SETTLING', 'VACATION_FUNDS'] });
  await f.db.update(scheduledEvents).set({ status: 'done' }).where(eq(scheduledEvents.id, event!.id));
  await f.db.update(planets).set({ deuterium: 100000 }).where(eq(planets.id, f.planetIds[0]!));
  expect(await status()).toMatchObject({ blocker: null, reasons: [] });
});

it('still rejects a new flight that starts after an eligible quote was read', async () => {
  const q = await status();
  expect(q).toMatchObject({ blocker: null, reasons: [] });
  await flight({ kind: 'probe' });
  await expect(startVacation(f.db, f.playerIds[0]!, 1, q.fingerprint, randomUUID(), f.clock))
    .rejects.toMatchObject({ code: 'VACATION_FLIGHTS' });
});
