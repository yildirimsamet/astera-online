import { and, eq } from 'drizzle-orm';
import { afterAll, expect, it, vi } from 'vitest';
import { clanMemberships, clans, clanSupportWaves, honorEvents, missions, planets, players, scheduledEvents } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { launchAttack } from '../src/services/mission.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';
import { giveUnits, seedWorld, setLevel, settledAt, testDb } from './helpers.js';
import * as streamBus from '../src/stream/bus.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { enqueueReturn } from '../src/services/returnQueue.js';
import { readHonorRelations } from '../src/services/honorRelations.js';

afterAll(async () => { await (await testDb()).close(); });

it('a real supported battle does not reward a host related to its attacker', async () => {
  const f = await supportWorld(3, 5519);
  await formClan(f, 0, [1]);
  await giveUnits(f.db, f.planetIds[0]!, { PIKE: 80 });
  // Host and attacker were together 3 days ago; their combat ceasefire has expired.
  const [oldClan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Old Group',
    nameKey: 'old group', tag: 'OG', createdAt: new Date(f.clock.now().getTime() - 6 * 86_400_000) }).returning();
  for (const [slot, index] of [1, 2].entries()) await f.db.insert(clanMemberships).values({
    seasonId: f.seasonId, clanId: oldClan!.id, playerId: f.playerIds[index]!, slot,
    joinedAt: new Date(f.clock.now().getTime() - 6 * 86_400_000),
    matureAt: new Date(f.clock.now().getTime() - 5 * 86_400_000),
    leftAt: new Date(f.clock.now().getTime() - 3 * 86_400_000), aidPolicyChangedAt: f.clock.now(),
  });
  await f.db.transaction(tx => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!,
    toggles: { escape: false, support: true }, clock: f.clock }));
  const { wave } = await f.db.transaction(tx => sendClanSupport(tx, { senderPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: { PIKE: 40 }, clock: f.clock }));
  f.clock.set(new Date(wave.arriveAt));
  const [stored] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id));
  const [landing] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, stored!.outboundMissionId), eq(scheduledEvents.kind, 'mission_arrival')));
  await onMissionArrival({ db: f.db, clock: f.clock }, landing!);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
  const raid = await launchAttack(f.db, f.planetIds[2]!, f.planetIds[1]!, { DART: 30 }, f.clock);
  f.clock.set(settledAt(raid.arriveAt));
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, raid.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
  await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  const [entry] = await f.db.select().from(honorEvents);
  expect(entry!.evidence.relations.find(row => row.b === f.playerIds[1])!.related).toBe(true);
  const host = entry!.outcome.defence.shares.find(row => row.actor === f.playerIds[1])!;

  expect(host.points).toBe(0);
});

it.each([3, 4] as const)('a real return and subsequent late support do not roll back the actual raid, v%s', async version => {
  const f = await supportWorld(3, 5519);
  await giveUnits(f.db, f.planetIds[0]!, { PIKE: 200 });
  await f.db.update(planets).set({ x: 2000 }).where(eq(planets.id, f.planetIds[2]!));
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock, undefined, { ownerRequested: true })).status).toBe('MOVED');
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version));
  const raid = await launchAttack(f.db, f.planetIds[2]!, f.planetIds[1]!, { DART: 30 }, f.clock);
  f.clock.advance(1);
  const application = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[0]!, f.seasonId, f.clock, application.id)).status).toBe('MOVED');
  await formClan(f, 0, [1]);
  await f.db.transaction(tx => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!,
    toggles: { escape: false, support: true }, clock: f.clock }));
  const { wave } = await f.db.transaction(tx => sendClanSupport(tx, { senderPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: { PIKE: 40 }, clock: f.clock }));
  expect(new Date(wave.arriveAt).getTime()).toBeLessThan(raid.arriveAt.getTime());
  f.clock.set(new Date(wave.arriveAt));
  const [stored] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id));
  const [landing] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, stored!.outboundMissionId), eq(scheduledEvents.kind, 'mission_arrival')));
  await onMissionArrival({ db: f.db, clock: f.clock }, landing!);
  f.clock.set(settledAt(raid.arriveAt));
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, raid.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
  let error: unknown;
  try { await onMissionArrival({ db: f.db, clock: f.clock }, event!); } catch (caught) { error = caught; }
  const [mission] = await f.db.select().from(missions).where(eq(missions.id, raid.missionId));

  expect(error).toBeUndefined();
  expect(mission!.status).toBe('resolved');
  const [entry] = await f.db.select().from(honorEvents);
  expect(entry?.outcome.defence.total).toBe(0);
  if (version === 4) expect(entry?.evidence.eligible).toBe(true);
});

it('an Honor-only score movement publishes a ranking refresh to other commanders', async () => {
  const f = await seedWorld(3, 5519);
  for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
  for (const id of f.planetIds.slice(0, 2)) await giveUnits(f.db, id, { PIKE: 30 });
  await f.db.update(planets).set({ shield: 0, defencePosture: 'HOLD' });
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  f.clock.advance(250);
  const raid = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { PIKE: 30 }, f.clock);
  f.clock.set(settledAt(raid.arriveAt));
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, raid.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
  const publishing = vi.spyOn(streamBus, 'publishShard');
  try {
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    const [entry] = await f.db.select().from(honorEvents);
    const commanders = await f.db.select().from(players);

    expect(entry!.outcome.attack.total).toBeGreaterThan(0);
    expect(entry!.outcome.defence.total).toBeGreaterThan(0);
    // With ship shields a mirror fight no longer ends level, so Dominion may move too and publish
    // once itself. The Honor ledger's own refresh is the one counted on top of it.
    const dominionMoved = commanders.some(row => row.dominionTaken !== row.dominionLost);
    expect(publishing.mock.calls.filter(row => row[2] === 'score')).toHaveLength(dominionMoved ? 2 : 1);
  } finally { publishing.mockRestore(); }
});

it('recent clanmates keep the relationship restriction when both return from Silent Space', async () => {
  const f = await supportWorld(3, 5519);
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  for (const index of [0, 1]) expect((await transferCommander(f.db, f.playerIds[index]!, waiting!.id, f.clock)).status).toBe('MOVED');
  await formClan(f, 0, [1]);
  f.clock.advance(1);
  const before = await readHonorRelations(f.db, { seasonId: waiting!.id, attack: [f.playerIds[0]!], defence: [f.playerIds[1]!],
    at: f.clock.now(), adminUsernames: new Set() });
  expect(before.relations[0]!.related).toBe(true);
  for (const index of [0, 1]) {
    const application = await enqueueReturn(f.db, f.accountIds[index]!, f.clock, 1);
    expect((await transferCommander(f.db, f.playerIds[index]!, f.seasonId, f.clock, application.id)).status).toBe('MOVED');
  }
  const after = await readHonorRelations(f.db, { seasonId: f.seasonId, attack: [f.playerIds[0]!], defence: [f.playerIds[1]!],
    at: f.clock.now(), adminUsernames: new Set() });

  expect(after.relations[0]!.related).toBe(true);
});
