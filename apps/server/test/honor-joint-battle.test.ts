import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { clanWarContributions, clans, honorCommitments, honorEvents, missions, scheduledEvents, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { openHonorRanking } from '../src/services/honorActivation.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { markClanWarTarget, sendClanWarContribution, startClanWar } from '../src/services/clanWar.js';
import { clanActor } from '../src/services/clan.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';
import { giveUnits, settledAt, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it.each([{ afterLaunch: false, rankedOpening: false, openBeforeLaunch: false, version: 4 },
    { afterLaunch: false, rankedOpening: true, openBeforeLaunch: false, version: 4 },
    { afterLaunch: false, rankedOpening: false, openBeforeLaunch: true, version: 4 },
  { afterLaunch: false, rankedOpening: false, openBeforeLaunch: false, version: 3 },
  { afterLaunch: true, rankedOpening: false, openBeforeLaunch: false, version: 3 },
  { afterLaunch: false, rankedOpening: true, openBeforeLaunch: false, version: 3 },
  { afterLaunch: false, rankedOpening: false, openBeforeLaunch: true, version: 3 }] as const)('settles a real combined attack, boundary $afterLaunch/$rankedOpening/$openBeforeLaunch', async ({ afterLaunch, rankedOpening, openBeforeLaunch, version }) => {
  const f = await supportWorld(4, 5519);
  const clanId = await formClan(f, 0, [1, 2]);
  await f.db.update(clans).set({ level: 5 }).where(eq(clans.id, clanId));
  // A Harpoon kills at least one attacking Dart in its simultaneous first volley.
  // Random spread alone need not destroy any ship; this case must exercise real loss debits.
  await giveUnits(f.db, f.planetIds[3]!, { DART: 20, HARPOON: 1 });
  await giveUnits(f.db, f.planetIds[3]!, { DART: 100 }, randomUUID());
  await f.db.transaction(async tx => {
    if (!afterLaunch) {
      await prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version);
      for (const id of [...f.playerIds].sort()) await observeHonorOwner(tx, id, f.clock.now());
    }
    if (rankedOpening || openBeforeLaunch) f.clock.advance(2 * 24 * 60);
    await markClanWarTarget(tx, { actor: await clanActor(tx, f.accountIds[0]!), targetPlanetId: f.planetIds[3]!, clock: f.clock });
  });
  for (const member of [1, 2]) await f.db.transaction(async tx => sendClanWarContribution(tx, {
    actor: await clanActor(tx, f.accountIds[member]!), originPlanetId: f.planetIds[member]!, fleet: { DART: 30 },
    acknowledgeShieldLoss: true, clock: f.clock,
  }));
  const flying = await f.db.select().from(missions).where(eq(missions.status, 'in_flight'));
  const last = Math.max(...flying.map(row => row.arriveAt.getTime()));
  f.clock.set(new Date(last + 20_000));
  for (const mission of flying) {
    const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, mission.id), eq(scheduledEvents.kind, 'mission_arrival')));
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  }
  // Staged ships are not an attack yet. Their actual combined dispatch is the boundary.
  if (openBeforeLaunch) await openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
  const launch = await f.db.transaction(async tx => startClanWar(tx, {
    actor: await clanActor(tx, f.accountIds[0]!), acknowledgeShieldLoss: true, clock: f.clock,
  }));
  expect(await f.db.select().from(honorCommitments)).toHaveLength(afterLaunch ? 0 : 1);
  if (afterLaunch) await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version));
  if (rankedOpening) await openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
  f.clock.set(settledAt(new Date(launch.arriveAt)));
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, launch.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
  await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  if (afterLaunch || rankedOpening) {
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    const [resolved] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    expect(resolved?.status).toBe('resolved');
    expect((await f.db.select().from(clanWarContributions)).every(row => row.status !== 'IN_BATTLE')).toBe(true);
    return;
  }
  const [entry] = await f.db.select().from(honorEvents);
  expect(entry?.source).toBe('CLAN_WAR');
  expect(entry?.ranked).toBe(openBeforeLaunch);
  expect(entry?.outcome.attack.shares.map(row => row.actor).sort()).toEqual([f.playerIds[1]!, f.playerIds[2]!].sort());
  expect(entry?.outcome.attack.shares.some(row => row.actor === f.playerIds[0])).toBe(false);
  expect(entry?.outcome.attack.total).toBeLessThanOrEqual(0);
  const losses = entry!.evidence.attack.reduce((sum, row) => sum + row.loss, 0);
  expect(losses).toBeGreaterThan(0);
  expect(entry?.outcome.attack.total).toBe(-100 * losses);
  expect(entry?.outcome.pool.attack.exposures.every(row => row.positive === 0)).toBe(true);
  expect(Math.abs(entry!.outcome.attack.shares[0]!.points - entry!.outcome.attack.shares[1]!.points)).toBeLessThanOrEqual(1);
  const contributions = await f.db.select().from(clanWarContributions);
  expect(contributions.every(row => row.status === 'RETURNING' || row.status === 'HOME' || row.status === 'LOST')).toBe(true);
  const ownerIds = new Set((await f.db.select().from(units)).map(row => row.ownerPlayerId));
  expect(ownerIds.has(f.playerIds[1]!)).toBe(true);
  await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  expect(await f.db.select().from(honorEvents)).toHaveLength(1);
});
