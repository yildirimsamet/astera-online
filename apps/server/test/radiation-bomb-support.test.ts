import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, expect, it } from 'vitest';
import { HULLS } from '@astera/rules';
import { clanSupportWaves, missions, planets, players, seasons, strategicAssets } from '../src/db/schema.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { recallClanSupport, resolveClanSupportLeg, sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { loadLocked } from '../src/services/planet.js';
import { readHomeHealth } from '../src/services/homeHealth.js';
import { EventWorker } from '../src/worker/loop.js';
import { formClan, supportWorld } from './clanSupportFixture.js';
import { giveInstrument, giveResearch, giveUnits, setLevel, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });
async function setup(fleet: { CITADEL: number } | { DART: number }, aegis = 0) {
  const f = await supportWorld(3, 20261015, 18);
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await setLevel(f.db, id, 'HANGAR', 12);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  if (aegis > 0) {
    await giveInstrument(f.db, f.planetIds[1]!, 'AEGIS', aegis);
    await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, f.planetIds[1]!));
    await giveResearch(f.db, f.planetIds[0]!, 'RADIATION_SHIELDING', 2);
    await giveResearch(f.db, f.planetIds[1]!, 'RADIATION_SHIELDING', 4);
  }
  await formClan(f, 0, [1]);
  await giveUnits(f.db, f.planetIds[0]!, { CITADEL: 2 });
  await f.db.transaction(tx => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!,
    toggles: { escape: false, support: true }, clock: f.clock }));
  const { wave } = await f.db.transaction(tx => sendClanSupport(tx, { senderPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet, clock: f.clock }));
  f.clock.set(new Date(wave.arriveAt));
  await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  const built = await buildRadiationBomb(f.db, f.planetIds[2]!, 1, f.clock, f.playerIds[2]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[2]!, originPlanetId: f.planetIds[2]!,
    target: { kind: 'PLANET', id: f.planetIds[1]! }, level: 1, key: randomUUID(), clock: f.clock });
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  return { f, waveId: wave.id };
}

it.each([5, 10])('protects clan support with host Aegis %s, followed by its own commander research', async aegis => {
  const { f, waveId } = await setup({ CITADEL: 1 }, aegis);
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, f.planetIds[1]!, f.clock));
  const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
  const [lot] = wave!.damage ?? [];
  expect(lot ? lot.damageBp + (lot.remainderBp ?? 0) : 0)
    .toBeCloseTo(Math.max(0, 9 - aegis) * .68 / HULLS.CITADEL.hp * 10000, 7);
});

it('damages stationed clan ships at their host and leaves their own unirradiated home ships alone', async () => {
  const { f, waveId } = await setup({ CITADEL: 1 });
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, f.planetIds[1]!, f.clock));
  const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
  expect(wave!.damage).toHaveLength(1);
  const [lot] = wave!.damage!;
  expect(lot!.damageBp + (lot!.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
  expect((await readHomeHealth(f.db, f.planetIds[0]!)).damage).toEqual([]);
});

it('settles support radiation before manual recall and carries the real wound into the return mission', async () => {
  const { f, waveId } = await setup({ CITADEL: 1 });
  f.clock.advance(1);
  await f.db.transaction(tx => recallClanSupport(tx, { playerId: f.playerIds[0]!, waveId, clock: f.clock }));
  const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
  expect(wave!.status).toBe('RETURNING');
  const [mission] = await f.db.select().from(missions).where(eq(missions.id, wave!.returnMissionId!));
  expect(mission!.damage).toHaveLength(1);
  expect(mission!.damage![0]!.damageBp + (mission!.damage![0]!.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});

it('removes a support wave that dies at the host, releasing its physical support reservation', async () => {
  const { f, waveId } = await setup({ DART: 2 });
  f.clock.advance(10);
  await f.db.transaction(tx => loadLocked(tx, f.planetIds[1]!, f.clock));
  const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
  expect(wave).toMatchObject({ status: 'LOST', reservedBulk: 0 });
});

it('refuses recall beyond an overdue second impact instead of letting support skip unpaid radiation', async () => {
  const { f, waveId } = await setup({ CITADEL: 1 });
  const built = await buildRadiationBomb(f.db, f.planetIds[2]!, 1, f.clock, f.playerIds[2]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const flight = await launchRadiationBomb(f.db, { playerId: f.playerIds[2]!, originPlanetId: f.planetIds[2]!,
    target: { kind: 'PLANET', id: f.planetIds[1]! }, level: 1, key: randomUUID(), clock: f.clock });
  f.clock.set(new Date(new Date(flight.arriveAt).getTime() + 60000));
  await expect(f.db.transaction(tx => recallClanSupport(tx, { playerId: f.playerIds[0]!, waveId, clock: f.clock })))
    .rejects.toMatchObject({ code: 'RADIATION_IMPACT_PENDING' });
  expect((await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId)))[0]!.status).toBe('STATIONED');
});

it('projects a stationed support wound for a read without persisting or waiting for the first death', async () => {
  const { f, waveId } = await setup({ CITADEL: 1 });
  const before = (await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId)))[0];
  f.clock.advance(1);
  const { readMySupport } = await import('../src/services/clanSupportView.js');
  const view = await f.db.transaction(tx => readMySupport(tx, f.playerIds[0]!, f.clock.now()), { accessMode: 'read only' });
  expect(view.waves.find(wave => wave.id === waveId)!.damaged).toBe(true);
  expect((await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId)))[0]).toEqual(before);
});

it('charges a delayed support arrival from its real landing even when the host cursor has already advanced', async () => {
  const { f } = await setup({ CITADEL: 1 });
  const sent = await f.db.transaction(tx => sendClanSupport(tx, { senderPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: { CITADEL: 1 }, clock: f.clock }));
  const [outbound] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, sent.wave.id));
  const [mission] = await f.db.select().from(missions).where(eq(missions.id, outbound!.outboundMissionId));
  f.clock.set(new Date(outbound!.arriveAt.getTime() + 60000));
  await f.db.transaction(tx => loadLocked(tx, f.planetIds[1]!, f.clock));
  await f.db.transaction(tx => resolveClanSupportLeg(tx, mission!, f.clock.now()));
  const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, sent.wave.id));
  expect(wave!.stationedAt).toEqual(outbound!.arriveAt);
  expect(wave!.damage).toHaveLength(1);
  expect(wave!.damage![0]!.damageBp + (wave!.damage![0]!.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});
