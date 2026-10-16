import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorObservations, honorSeasons, missions, planets, scheduledEvents, strategicAssets } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner, honorOwnerReference } from '../src/services/honorReference.js';
import { ownedHonorNavy } from '../src/services/honorNavy.js';
import { lockWorlds, transferPlanetControl } from '../src/services/ownership.js';
import { buildDeathStar, launchDeathStar } from '../src/services/strategic.js';
import { onDeathStarReady, onMissionArrival } from '../src/worker/handlers.js';
import { giveUnits, grant, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

describe('candidate strategic navy history uses frozen prices and real owners', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 24017);
    await levelWorld(f.db, f.planetIds);
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 13);
  });
  afterAll(async () => { await (await testDb()).close(); });
  const prepare = (version: 1 | 2 | 4 = 2) => f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version));
  const asset = (type: 'DEATH_STAR' | 'INTERCEPTOR', status: 'READY' | 'BUILDING' | 'PAUSED' | 'CONSUMED') =>
    f.db.insert(strategicAssets).values({ planetId: f.planetIds[0]!, type, status,
      startedAt: f.clock.now(), remainingSeconds: 0 });
  const current = async (index = 0) => {
    const [config] = await f.db.select().from(honorSeasons);
    return ownedHonorNavy(f.db, f.playerIds[index]!, config!);
  };

  it('freezes both prices and counts actual ready stocks once alongside armed ships', async () => {
    await asset('DEATH_STAR', 'READY');
    await asset('INTERCEPTOR', 'READY');
    await giveUnits(f.db, f.planetIds[0]!, { DART: 1, COURIER: 1 });
    await prepare();
    const [config] = await f.db.select().from(honorSeasons);
    expect(config?.strategicCatalogue).toEqual({ DEATH_STAR: 216000, INTERCEPTOR: 71710 });
    expect(await current()).toBe(216000 + 71710 + 546);
    expect(await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now()))
      .toMatchObject({ navy: 216000 + 71710 + 546 });
  });

  it('includes real strategic stock in the launch candidate with its own frozen catalogue', async () => {
    await asset('DEATH_STAR', 'READY');
    await asset('INTERCEPTOR', 'READY');
    await giveUnits(f.db, f.planetIds[0]!, { DART: 1 });
    await prepare(4);
    expect(await current()).toBe(216000 + 71710 + 546);
    expect((await f.db.select().from(honorSeasons))[0]?.strategicCatalogue)
      .toMatchObject({ DEATH_STAR: 216000, INTERCEPTOR: 71710 });
  });

  it('launch candidate counts a ready radiation bomb at frozen price and keeps exactly one airborne owner', async () => {
    await f.db.insert(strategicAssets).values({ planetId: f.planetIds[0]!, type: 'RADIATION_BOMB_L1', status: 'READY',
      startedAt: f.clock.now(), remainingSeconds: 0 });
    await prepare(4);
    expect(await current()).toBe(134000);
  });

  it('does not turn queued, paused or consumed stocks into a military reference', async () => {
    await asset('DEATH_STAR', 'BUILDING');
    await asset('INTERCEPTOR', 'PAUSED');
    await asset('DEATH_STAR', 'CONSUMED');
    await prepare();
    expect(await current()).toBe(0);
  });

  it('preserves legacy navy and never retrofits a strategic price catalogue into version 1', async () => {
    await asset('DEATH_STAR', 'READY');
    await asset('INTERCEPTOR', 'READY');
    await prepare(1);
    expect((await f.db.select().from(honorSeasons))[0]?.strategicCatalogue).toBeNull();
    expect(await current()).toBe(0);
  });

  it('uses its frozen catalogue rather than pricing an older stock from current constants', async () => {
    await asset('DEATH_STAR', 'READY');
    await prepare();
    const [config] = await f.db.select().from(honorSeasons);
    expect(await ownedHonorNavy(f.db, f.playerIds[0]!, { ...config!, strategicCatalogue: { DEATH_STAR: 123, INTERCEPTOR: 456 } })).toBe(123);
    await f.db.update(honorSeasons).set({ strategicCatalogue: null });
    await expect(current()).rejects.toThrow('Missing frozen Honor strategic catalogue');
  });

  it('records a real build completion at processing time, retaining the peak after consumption', async () => {
    const origin = f.planetIds[0]!;
    await grant(f.db, origin, 400000, 200000);
    await setLevel(f.db, origin, 'SHIPYARD', 5);
    f.clock.advance(250);
    const order = await buildDeathStar(f.db, origin, f.clock);
    await prepare();
    expect(await current()).toBe(0);
    f.clock.set(new Date(order.readyAt.getTime() + 60_000));
    const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, order.assetId), eq(scheduledEvents.kind, 'death_star_ready')));
    await onDeathStarReady({ db: f.db, clock: f.clock }, event!);
    expect(await current()).toBe(216000);
    const samples = await f.db.select().from(honorObservations).where(eq(honorObservations.playerId, f.playerIds[0]!));
    expect(samples.some(row => row.at.getTime() === f.clock.now().getTime() && row.navy === 216000)).toBe(true);
    await f.db.update(strategicAssets).set({ status: 'CONSUMED' });
    f.clock.advance(1);
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[0]!, f.clock.now()));
    expect(await current()).toBe(0);
    expect((await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now())).navy).toBe(216000);
  });

  it('launch movement does not duplicate a weapon and a real impact removes only current stock', async () => {
    await asset('DEATH_STAR', 'READY');
    await prepare();
    f.clock.advance(250);
    const launch = await launchDeathStar(f.db, f.planetIds[0]!, f.planetIds[1]!, f.clock);
    expect(await current()).toBe(216000);
    expect((await f.db.select().from(honorObservations).where(eq(honorObservations.playerId, f.playerIds[0]!))).length).toBe(1);
    f.clock.set(launch.arriveAt);
    const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, launch.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    expect(await current()).toBe(0);
    const [last] = (await f.db.select().from(honorObservations).where(eq(honorObservations.playerId, f.playerIds[0]!)))
      .sort((a, b) => b.id - a.id);
    expect(last).toMatchObject({ navy: 0, at: f.clock.now() });
    expect((await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now())).navy).toBe(216000);
  });

  it('a moved launch world transfers ready stock but never steals the airborne owner’s weapon', async () => {
    f = await seedWorld(3, 24017);
    const colony = f.planetIds[2]!;
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 13);
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]!,
      statsOwnerPlayerId: f.playerIds[0]! }).where(eq(planets.id, colony));
    for (const type of ['DEATH_STAR', 'INTERCEPTOR']) await f.db.insert(strategicAssets).values({
      planetId: colony, type, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
    await prepare();
    f.clock.advance(250);
    const launch = await launchDeathStar(f.db, colony, f.planetIds[1]!, f.clock);
    await f.db.transaction(async tx => {
      await lockWorlds(tx, f.planetIds);
      await transferPlanetControl(tx, { targetPlanetId: colony, newPlayerId: f.playerIds[1]!,
        expectedControllerPlayerId: f.playerIds[0]!, now: f.clock.now(), protectedUntil: f.clock.now() });
    });
    expect(await current(0)).toBe(216000);
    expect(await current(1)).toBe(71710);
    expect((await f.db.select().from(missions).where(eq(missions.id, launch.missionId)))[0]?.ownerPlayerId).toBe(f.playerIds[0]);
  });
});
