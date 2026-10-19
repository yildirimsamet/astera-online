import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { honorCommitments, honorEvents, planets, scheduledEvents, strategicAssets } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { giveInstrument, giveSatellite, giveUnits, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';
let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(3, 24017);
  await levelWorld(f.db, f.planetIds);
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 12);
    await giveUnits(f.db, id, { PIKE: 500 });
  }
  await giveInstrument(f.db, f.planetIds[1]!, 'AEGIS', 1);
  await giveUnits(f.db, f.planetIds[1]!, { THORN: 100 });
  await f.db.insert(strategicAssets).values({ planetId: f.planetIds[0]!, type: 'DEATH_STAR', status: 'READY',
    startedAt: f.clock.now(), remainingSeconds: 0 });
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
  f.clock.advance(250);
});
afterAll(async () => { await (await testDb()).close(); });
async function strike() {
  const sent = await launchDeathStar(f.db, f.planetIds[0]!, f.planetIds[1]!, f.clock);
  f.clock.set(sent.arriveAt);
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, sent.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
  await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  return sent;
}
it('freezes a real EMP launch and credits only its actual tactical effect once', async () => {
  await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, f.planetIds[1]!));
  const sent = await strike();
  const commitment = (await f.db.select().from(honorCommitments)).find(r => r.sourceId === sent.missionId);
  expect(commitment?.snapshot.version).toBe(4);
  const entries = await f.db.select().from(honorEvents);
  expect(entries).toHaveLength(1);
  expect(entries[0]?.source).toBe('STRATEGIC_IMPACT');
  expect(entries[0]?.outcome.attack.total).toBeGreaterThan(0);
  expect(entries[0]?.outcome.attack.total).toBeLessThan(12_000_000);
  expect(entries[0]?.evidence.attack[0]?.loss).toBe(0);
  expect(entries[0]?.evidence.defence[0]?.loss).toBe(0);
  expect(entries[0]?.outcome.defence.total).toBe(0);
});
it('does not reward a repeated blackout with no new effect', async () => {
  await f.db.update(planets).set({ shield: 0, empUntil: new Date(f.clock.now().getTime() + 86_400_000) }).where(eq(planets.id, f.planetIds[1]!));
  await strike();
  const [entry] = await f.db.select().from(honorEvents);
  expect(entry).toBeDefined();
  expect(entry?.outcome.attack.total).toBe(0);
});
it.each([true, false])('respects the leader exception for actual EMP pressure: leader=%s', async leader => {
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 15);
  if (!leader) await setLevel(f.db, f.planetIds[2]!, 'CORE', 16);
  await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, f.planetIds[1]!));
  const sent = await strike();
  const [entry] = await f.db.select().from(honorEvents);
  expect(entry?.evidence.id).toBe(sent.missionId);
  expect(entry?.evidence.galaxyTopTier).toBe(leader ? 5 : 6);
  expect(entry?.outcome.pool.attack.exposures[0]?.bullying).toBe(!leader);
  expect(entry?.evidence.attack[0]?.loss).toBe(0);
  expect(entry?.evidence.defence[0]?.loss).toBe(0);
  if (leader) expect(entry?.outcome.attack.total).toBeGreaterThan(0);
  else expect(entry?.outcome.attack.total).toBeLessThan(0);
});
it('a real intercepted weapon rewards its defender and records only the attacker weapon as a permanent loss', async () => {
  await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
  await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 5);
  await f.db.insert(strategicAssets).values({ planetId: f.planetIds[1]!, type: 'INTERCEPTOR', status: 'READY',
    startedAt: f.clock.now(), remainingSeconds: 0 });
  const sent = await strike();
  const [entry] = await f.db.select().from(honorEvents);
  expect(entry?.sourceId).toBe(sent.missionId);
  expect(entry?.source).toBe('STRATEGIC_INTERCEPTION');
  expect(entry?.outcome.attack.total).toBe(-21_600_000);
  expect(entry?.outcome.defence.total).toBeGreaterThan(0);
  expect(entry?.evidence.attack[0]?.loss).toBe(216000);
  expect(entry?.evidence.defence[0]?.loss).toBe(0);
});
it('a protected ineffective impact records zero tactical success', async () => {
  const sent = await launchDeathStar(f.db, f.planetIds[0]!, f.planetIds[1]!, f.clock);
  await f.db.update(planets).set({ protectedUntil: new Date(sent.arriveAt.getTime() + 60000) }).where(eq(planets.id, f.planetIds[1]!));
  f.clock.set(sent.arriveAt);
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, sent.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
  await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  const [entry] = await f.db.select().from(honorEvents);
  expect(entry?.outcome.attack.total).toBe(0);
});
