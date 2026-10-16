import { afterAll, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { honorObservations, players } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { openHonorRanking } from '../src/services/honorActivation.js';
import { commitHonor, worldHonorCommitment } from '../src/services/honorCommitment.js';
import { honorTargetPreview } from '../src/services/honorTarget.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { enqueueReturn } from '../src/services/returnQueue.js';
import { seedWorld, testDb } from './helpers.js';
afterAll(async () => { await (await testDb()).close(); });

async function roundTrip(mode: 'SHADOW' | 'ACTIVE', version: 3 | 4 = 3, sameInstant = false) {
  const f = await seedWorld(3, 24017);
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[2]!, waiting!.id, f.clock)).status).toBe('MOVED');
  // ACTIVE is prepared at the original advertised start in a separate fixture below.
  expect(mode).toBe('SHADOW');
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version));
  f.clock.advance(2 * 24 * 60);
  const sourceId = 'review-flight';
  await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'WORLD', id: sourceId,
    attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() }));
  if (!sameInstant) f.clock.advance(1);
  const application = await enqueueReturn(f.db, f.accountIds[2]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[2]!, f.seasonId, f.clock, application.id)).status).toBe('MOVED');
  return { ...f, sourceId };
}

it('a real returning commander has a present Honor reference without another gameplay mutation', async () => {
  const f = await roundTrip('SHADOW');
  const rows = await f.db.select().from(honorObservations).where(and(eq(honorObservations.seasonId, f.seasonId),
    eq(honorObservations.playerId, f.playerIds[2]!)));
  expect(rows.length).toBeGreaterThan(0);
});

it('a real return during SHADOW does not prevent the whole galaxy opening', async () => {
  const f = await roundTrip('SHADOW');
  await expect(openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: false })).resolves.toMatchObject({ status: 'READY' });
});

it('late support from a real returning commander cannot abort the settlement adapter', async () => {
  const f = await roundTrip('SHADOW');
  await expect(f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId, missionId: f.sourceId,
    host: f.playerIds[1]!, supporters: [f.playerIds[2]!], observedAt: f.clock.now(), adminUsernames: new Set() }))).resolves.toBeTruthy();
});

it('a returning commander after active preparation can read the target preview', async () => {
  const f = await seedWorld(3, 24017);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[2]!, waiting!.id, f.clock, undefined, { ownerRequested: true })).status).toBe('MOVED');
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  f.clock.advance(1);
  const application = await enqueueReturn(f.db, f.accountIds[2]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[2]!, f.seasonId, f.clock, application.id)).status).toBe('MOVED');
  await expect(honorTargetPreview(f.db, f.playerIds[2]!, f.planetIds[1]!, f.clock, new Set())).resolves.toMatchObject({ enabled: true });
});


for (const sameInstant of [false, true]) it(`launch policy keeps original target sanctions with returning support (same ms: ${String(sameInstant)})`, async () => {
  const f = await roundTrip('SHADOW', 4, sameInstant);
  const expanded = await f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
    missionId: f.sourceId, host: f.playerIds[1]!, supporters: [f.playerIds[2]!],
    observedAt: f.clock.now(), adminUsernames: new Set() }));
  expect(expanded?.eligible).toBe(true);
  expect(expanded?.exclusion).toBeUndefined();
  expect(expanded?.selectedDefenders).toEqual([f.playerIds[1]]);
  expect(expanded?.defence).toHaveLength(2);
});

it('does not mistake a missing history of a present player for a late entry', async () => {
  const f = await seedWorld(3, 24017);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
  await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'WORLD', id: 'broken',
    attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() }));
  await f.db.delete(honorObservations).where(eq(honorObservations.playerId, f.playerIds[2]!));
  await expect(f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
    missionId: 'broken', host: f.playerIds[1]!, supporters: [f.playerIds[2]!],
    observedAt: f.clock.now(), adminUsernames: new Set() }))).rejects.toThrow('Missing Honor reference history');
});

it('genuine new entrants in the launch policy do not erase the whole battle eligibility', async () => {
  const f = await seedWorld(3, 24017);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
  // The actual join is later; exclude that seat from the launch fixture's roster.
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await f.db.update(players).set({ seasonId: waiting!.id }).where(eq(players.id, f.playerIds[2]!));
  await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'WORLD', id: 'new',
    attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() }));
  await f.db.delete(honorObservations).where(eq(honorObservations.playerId, f.playerIds[2]!));
  f.clock.advance(1);
  await f.db.update(players).set({ seasonId: f.seasonId, joinedAt: f.clock.now() }).where(eq(players.id, f.playerIds[2]!));
  const { observeHonorOwner } = await import('../src/services/honorReference.js');
  await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[2]!, f.clock.now()));
  const result = await f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
    missionId: 'new', host: f.playerIds[1]!, supporters: [f.playerIds[2]!], observedAt: f.clock.now(), adminUsernames: new Set() }));
  expect(result?.eligible).toBe(true);
  expect(result?.exclusion).toBeUndefined();
});
it('does not reset season Core peak or keep an absent old navy as an unchanged boundary anchor forever', async () => {
  const f = await seedWorld(2, 7719);
  const { giveUnits, setLevel } = await import('./helpers.js');
  const { honorOwnerReference } = await import('../src/services/honorReference.js');
  await giveUnits(f.db, f.planetIds[0]!, { DART: 100 });
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 15);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
  const initial = await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now());
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  f.clock.advance(1);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock, undefined, { ownerRequested: true })).status).toBe('MOVED');
  await giveUnits(f.db, f.planetIds[0]!, { DART: 1 });
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 3);
  f.clock.advance(48 * 60);
  const application = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[0]!, f.seasonId, f.clock, application.id)).status).toBe('MOVED');
  const after = await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now());
  expect(after.tier).toBe(initial.tier);
  expect(after.navy).toBe(546);
});
