import { and, eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { clanSupportWaves, honorEvents, scheduledEvents } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { launchAttack } from '../src/services/mission.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';
import { giveUnits, settledAt, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it.each([1, 3, 4] as const)('settles supported defence under immutable Honor version %s', async version => {
  const f = await supportWorld(3, 5519);
  await formClan(f, 0, [1]);
  await giveUnits(f.db, f.planetIds[0]!, { PIKE: 200 });
  await f.db.transaction(tx => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!,
    toggles: { escape: false, support: true }, clock: f.clock }));
  const { wave } = await f.db.transaction(tx => sendClanSupport(tx, { senderPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: { PIKE: 40 }, clock: f.clock }));
  f.clock.set(new Date(wave.arriveAt));
  const [storedWave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id));
  const [landing] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, storedWave!.outboundMissionId), eq(scheduledEvents.kind, 'mission_arrival')));
  await onMissionArrival({ db: f.db, clock: f.clock }, landing!);
  await f.db.transaction(async tx => {
    await prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version);
    for (const id of [...f.playerIds].sort()) await observeHonorOwner(tx, id, f.clock.now());
  });
  const raid = await launchAttack(f.db, f.planetIds[2]!, f.planetIds[1]!, { DART: 30 }, f.clock);
  f.clock.set(settledAt(raid.arriveAt));
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, raid.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
  await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  const [entry] = await f.db.select().from(honorEvents);
  expect(entry?.evidence.defence.map(row => row.id).sort()).toEqual([f.playerIds[0]!, f.playerIds[1]!].sort());
  if (version === 1) {
    expect(entry?.outcome.defence.total).toBeGreaterThan(0);
    expect(entry?.outcome.defence.shares.find(row => row.actor === f.playerIds[0])?.points).toBeGreaterThan(0);
  } else {
    expect(entry?.outcome.defence.total).toBe(0);
    expect(entry?.outcome.defence.shares.every(row => row.points === 0)).toBe(true);
    expect(entry?.outcome.pool.defence.exposures.every(row => row.positive === 0)).toBe(true);
  }
  expect(entry?.outcome.defence.shares.reduce((sum, row) => sum + row.points, 0)).toBe(entry?.outcome.defence.total);
  await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  expect(await f.db.select().from(honorEvents)).toHaveLength(1);
});
