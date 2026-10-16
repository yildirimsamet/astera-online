import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { HULLS, hangarLoad, type Fleet } from '@astera/rules';
import { clanWarContributions, clans, hpRadiationSources, missions, notifications, planets, players, scheduledEvents, seasons, strategicAssets, units } from '../src/db/schema.js';
import { clanActor } from '../src/services/clan.js';
import { markClanWarTarget, readClanWar, recallClanWarContribution, revalidateClanWarTargetPlanet, sendClanWarContribution, startClanWar } from '../src/services/clanWar.js';
import { formClan, supportWorld } from './clanSupportFixture.js';
import { giveInstrument, giveResearch, giveUnits, setLevel, testDb } from './helpers.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { activateRadiationBombs } from '../src/services/radiationBombAdoption.js';
import { loadLocked } from '../src/services/planet.js';
import { resolveClanWarLeg } from '../src/services/clanWar.js';
import { writeHomeHealth } from '../src/services/homeHealth.js';
import * as bus from '../src/stream/bus.js';
import { EventWorker } from '../src/worker/loop.js';

afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await (await testDb()).close(); });
const worker = (f: Awaited<ReturnType<typeof supportWorld>>) => new EventWorker(f.db, f.clock,
  { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));

async function setup(fleet: Fleet = { CITADEL: 1 }, options: { land?: boolean; wounded?: boolean; aegis?: number } = {}) {
  const f = await supportWorld(4, 20261017, 18);
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now() });
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 6);
    await setLevel(f.db, id, 'HANGAR', 12);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  if (options.aegis) {
    await giveInstrument(f.db, f.planetIds[0]!, 'AEGIS', options.aegis);
    await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, f.planetIds[0]!));
    await giveResearch(f.db, f.planetIds[0]!, 'RADIATION_SHIELDING', 4);
    await giveResearch(f.db, f.planetIds[1]!, 'RADIATION_SHIELDING', 2);
  }
  const clanId = await formClan(f, 0, [1]);
  await f.db.update(clans).set({ level: 5 }).where(eq(clans.id, clanId));
  await giveUnits(f.db, f.planetIds[1]!, { CITADEL: 1 });
  if (options.wounded) await f.db.transaction(tx => writeHomeHealth(tx, f.planetIds[1]!,
    { CITADEL: 1, DART: 120, COURIER: 10 }, [{ hull: 'CITADEL', count: 1, damageBp: 9400 }]));
  await f.db.transaction(async tx => markClanWarTarget(tx, { actor: await clanActor(tx, f.accountIds[0]!),
    targetPlanetId: f.planetIds[2]!, clock: f.clock }));
  await f.db.transaction(async tx => sendClanWarContribution(tx, { actor: await clanActor(tx, f.accountIds[1]!),
    originPlanetId: f.planetIds[1]!, fleet, acknowledgeShieldLoss: true, clock: f.clock }));
  const [wave] = await f.db.select().from(clanWarContributions);
  const [outbound] = await f.db.select().from(missions).where(eq(missions.kind, 'clan_war'));
  if (!wave || !outbound) throw new Error('Missing physical staging fixture');
  if (options.land !== false) {
    f.clock.set(outbound.arriveAt);
    await worker(f).tick();
  }
  const host = f.planetIds[0]!;
  const hit = async (resolve = true) => {
    const bomb = await buildRadiationBomb(f.db, f.planetIds[3]!, 1, f.clock, f.playerIds[3]);
    await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, bomb.assetId));
    const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[3]!, originPlanetId: f.planetIds[3]!,
      target: { kind: 'PLANET', id: host }, level: 1, key: randomUUID(), clock: f.clock });
    f.clock.set(new Date(sent.arriveAt));
    if (resolve) await resolveRadiationBomb(f.db, sent.flightId, f.clock);
    return sent;
  };
  const fresh = async () => (await f.db.select().from(clanWarContributions).where(eq(clanWarContributions.id, wave.id)))[0]!;
  const recall = () => f.db.transaction(async tx => recallClanWarContribution(tx, {
    actor: await clanActor(tx, f.accountIds[1]!), contributionId: wave.id, clock: f.clock }));
  return { f, host, wave, outbound, hit, fresh, recall };
}

it('protects assembled clan ships with host Aegis and the contributor’s carried research', async () => {
  const { f, host, hit, fresh } = await setup({ CITADEL: 1 }, { aegis: 5 });
  await hit();
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, host, f.clock));
  const [lot] = (await fresh()).damage!;
  expect(lot!.damageBp + (lot!.remainderBp ?? 0)).toBeCloseTo((9 - 5) * .68 / HULLS.CITADEL.hp * 10000, 7);
});

it('irradiates an assembled wave at staging, updating its private roster and capacity but not charging its origin again', async () => {
  const { f, host, wave, hit, fresh } = await setup({ CITADEL: 1, DART: 2 });
  await hit();
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, host, f.clock));
  const current = await fresh();
  expect(current.status).toBe('STAGED');
  expect(current.damage!.find(lot => lot.hull === 'CITADEL')!.damageBp).toBe(Math.floor(9 / HULLS.CITADEL.hp * 10000));
  const before = current.damage;
  await f.db.transaction(tx => loadLocked(tx, f.planetIds[1]!, f.clock));
  expect((await fresh()).damage).toEqual(before);
  const view = await readClanWar(f.db, await clanActor(f.db, f.accountIds[1]!), f.clock.now());
  expect(view.operation?.contributions.find(row => row.id === wave.id)).toMatchObject({
    fleet: { CITADEL: 1, DART: 2 }, bulk: hangarLoad({ CITADEL: 1, DART: 2 }), damage: before,
  });
});

it('settles the staged wound before manual recall and carries it into the real return mission', async () => {
  const { f, hit, fresh, recall } = await setup();
  await hit();
  f.clock.advance(1);
  await recall();
  const wave = await fresh();
  expect(wave.status).toBe('RETURNING');
  const [homeward] = await f.db.select().from(missions).where(and(eq(missions.kind, 'clan_war'),
    eq(missions.ownerPlayerId, f.playerIds[1]!), eq(missions.targetPlanetId, f.planetIds[1]!)));
  expect(homeward!.damage![0]!.damageBp + (homeward!.damage![0]!.remainderBp ?? 0))
    .toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});

it('removes dead staged ships offline and releases their pool reservation without per-death notices', async () => {
  const { f, host, wave, hit, fresh } = await setup({ DART: 2 });
  await f.db.delete(units).where(and(eq(units.planetId, host), eq(units.location, 'home')));
  const bomb = await hit();
  const [timer] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, host),
    eq(scheduledEvents.kind, 'planet_radiation_boundary'))).orderBy(scheduledEvents.resolveAt);
  expect(timer!.resolveAt.getTime()).toBeLessThan(new Date(bomb.arriveAt).getTime() + 3600000);
  f.clock.set(timer!.resolveAt);
  await worker(f).tick();
  expect(await fresh()).toMatchObject({ status: 'LOST', fleet: {}, reservedBulk: 0 });
  expect(await f.db.select().from(units).where(eq(units.location, wave.unitLocation))).toHaveLength(0);
  expect((await f.db.select().from(notifications)).every(row => row.kind !== 'radiation_lost')).toBe(true);
});

it('charges a late staging arrival from the real landing after the host cursor already advanced', async () => {
  const { f, host, outbound, hit, fresh } = await setup({ CITADEL: 1 }, { land: false });
  const bomb = await hit();
  expect(new Date(bomb.arriveAt).getTime()).toBeLessThan(outbound.arriveAt.getTime());
  f.clock.set(new Date(outbound.arriveAt.getTime() + 60000));
  await f.db.transaction(tx => loadLocked(tx, host, f.clock));
  await f.db.transaction(tx => resolveClanWarLeg(tx, outbound, f.clock.now()));
  const wave = await fresh();
  expect(wave.stagedAt).toEqual(outbound.arriveAt);
  expect(wave.damage![0]!.damageBp + (wave.damage![0]!.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});

it('refuses to launch a combined strike with newly critical staged ships while leaving manual recall available', async () => {
  const { f, hit, recall } = await setup({ CITADEL: 1 }, { wounded: true });
  await hit();
  f.clock.advance(3);
  await expect(f.db.transaction(async tx => startClanWar(tx, { actor: await clanActor(tx, f.accountIds[0]!),
    acknowledgeShieldLoss: true, clock: f.clock }))).rejects.toMatchObject({ code: 'NOT_ENOUGH_COMBAT_READY_SHIPS' });
  await expect(recall()).resolves.toMatchObject({ status: 'RETURNING' });
});


it('applies the same shelter and carried-tech protection to the waiting pool', async () => {
  const { f, host, hit, fresh } = await setup();
  const until = new Date(f.clock.now().getTime() + 600000);
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: host,
    x: 0, y: 0, z: 0, radius: 1, intensityHpPerMinute: 0, mode: 'SHELTER',
    activeFrom: f.clock.now(), activeUntil: until });
  await hit();
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, host, f.clock));
  expect((await fresh()).damage ?? []).toEqual([]);
  f.clock.set(new Date(until.getTime() + 60000));
  await f.db.transaction(tx => loadLocked(tx, host, f.clock));
  const lot = (await fresh()).damage![0]!;
  expect(lot.damageBp + (lot.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});

it('keeps a leader capital wave exposed and returns its wound on an instant stand-down', async () => {
  const { f, host, hit } = await setup();
  await giveUnits(f.db, host, { CITADEL: 1 });
  await f.db.transaction(async tx => sendClanWarContribution(tx, { actor: await clanActor(tx, f.accountIds[0]!),
    originPlanetId: host, fleet: { CITADEL: 1 }, acknowledgeShieldLoss: true, clock: f.clock }));
  const [wave] = await f.db.select().from(clanWarContributions).where(eq(clanWarContributions.playerId, f.playerIds[0]!));
  expect(wave!.sourceKind).toBe('LEADER_CAPITAL');
  await hit(); f.clock.advance(1);
  await f.db.transaction(async tx => recallClanWarContribution(tx, { actor: await clanActor(tx, f.accountIds[0]!),
    contributionId: wave!.id, clock: f.clock }));
  const [home] = await f.db.select().from(units).where(and(eq(units.planetId, host), eq(units.location, 'home'), eq(units.hull, 'CITADEL')));
  expect(home!.count).toBe(1);
  expect(home!.damage[0]!.damageBp + (home!.damage[0]!.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
});


it('settles the pool before an ownership-change hook automatically closes the target', async () => {
  const { f, hit, fresh } = await setup();
  await hit(); f.clock.advance(1);
  await f.db.transaction(async tx => {
    await tx.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[3]! }).where(eq(planets.id, f.planetIds[2]!));
    await revalidateClanWarTargetPlanet(tx, f.planetIds[2]!, f.clock.now());
  });
  expect((await fresh()).status).toBe('RETURNING');
  const [returning] = await f.db.select().from(missions).where(and(eq(missions.kind, 'clan_war'),
    eq(missions.ownerPlayerId, f.playerIds[1]!), eq(missions.targetPlanetId, f.planetIds[1]!)));
  expect(returning!.damage?.[0]?.damageBp).toBe(Math.floor(9 / HULLS.CITADEL.hp * 10000));
});


it('defers the ownership-close hook while an earlier bomb impact is pending without aborting the capture', async () => {
  const { f, hit, fresh } = await setup();
  const bomb = await hit(false); f.clock.advance(1);
  await expect(f.db.transaction(async tx => {
    await tx.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[3]! }).where(eq(planets.id, f.planetIds[2]!));
    await revalidateClanWarTargetPlanet(tx, f.planetIds[2]!, f.clock.now());
  })).resolves.toBeUndefined();
  expect((await fresh()).status).toBe('STAGED');
  await resolveRadiationBomb(f.db, bomb.flightId, f.clock);
  await readClanWar(f.db, await clanActor(f.db, f.accountIds[1]!), f.clock.now());
  expect((await fresh()).status).toBe('RETURNING');
});


it('activates radiation for an already assembled pool without charging its pre-cutover wait', async () => {
  const { f, host, fresh } = await setup();
  await f.db.update(seasons).set({ radiationBombStartsAt: null, monumentMotionStartsAt: f.clock.now() });
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: host,
    x: 0, y: 0, z: 0, radius: 1, intensityHpPerMinute: 9, mode: 'EMIT', activeFrom: f.clock.now() });
  f.clock.advance(60);
  const cutover = f.clock.now();
  await activateRadiationBombs(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
  await f.db.transaction(tx => loadLocked(tx, host, f.clock));
  expect((await fresh()).damage ?? []).toEqual([]);
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, host, f.clock));
  const lot = (await fresh()).damage![0]!;
  expect(lot.damageBp + (lot.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
  expect((await f.db.select().from(seasons))[0]!.radiationBombStartsAt).toEqual(cutover);
});


it('does not trigger another clan read for every fractional wound while opening the war screen', async () => {
  const { f, hit } = await setup();
  await hit(); f.clock.advance(1);
  const publish = vi.spyOn(bus, 'publishPrivate');
  await readClanWar(f.db, await clanActor(f.db, f.accountIds[1]!), f.clock.now());
  expect(publish.mock.calls.filter(([, , kind]) => kind === 'war')).toHaveLength(0);
});
