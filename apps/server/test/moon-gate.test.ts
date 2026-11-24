import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON, fleetEntries, gateChargeMs, jumpFuel, distance, type Fleet } from '@astera/rules';
import { moonMoves, moons, notifications, planets, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { hopFleet, jumpFleet } from '../src/services/moonMovement.js';
import { launchTransfer } from '../src/services/movement.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { HANDLERS } from '../src/worker/handlers.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, levelWorld, placeAt, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

/*
  F4 (S3, S12, S17, S18, S46, S49; plan §6.11, E4–E6, V8): the Moon Gate jumps a fleet between two of the
  commander's own moons. The gate opens for ten seconds — the ships still stand on the departure moon and
  fight there — then they are on the far moon. The smaller moon is the bottleneck; both gates charge;
  fuel is the route's one-leg transfer price, paid from the departure planet; no five-minute pause.
*/
const silent = pino({ level: 'silent' });

describe('the Moon Gate', () => {
  let f: Fixture;
  let home: string;
  let colony: string;
  let enemy: string;
  let owner: string;

  const onMoon = async (planetId: string) => Object.fromEntries((await f.db.select().from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, MOON_LOCATION)))).filter((row) => row.count > 0)
    .map((row) => [row.hull, row.count]));
  const putOnMoon = async (planetId: string, fleet: Fleet, ownerId = owner) => {
    for (const [hull, count] of fleetEntries(fleet)) {
      await f.db.insert(units).values({ planetId, ownerPlayerId: ownerId, hull, location: MOON_LOCATION, count })
        .onConflictDoUpdate({ target: [units.planetId, units.hull, units.location], set: { count } });
    }
  };
  const gateOf = async (planetId: string) =>
    (await f.db.select({ ready: moons.gateReadyAt }).from(moons).where(eq(moons.planetId, planetId)))[0]?.ready ?? null;
  const tank = async (planetId: string) =>
    (await f.db.select({ d: planets.deuterium }).from(planets).where(eq(planets.id, planetId)))[0]!.d;
  const finish = async () => {
    const [event] = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'moon_move_land'), eq(scheduledEvents.status, 'pending')));
    if (!event) throw new Error('no pending gate landing');
    f.clock.set(event.resolveAt);
    await HANDLERS.moon_move_land!({ db: f.db, clock: f.clock }, event);
    await f.db.update(scheduledEvents).set({ status: 'done' }).where(eq(scheduledEvents.id, event.id));
  };
  const jump = (fleet: Fleet, from = home, to = colony) => jumpFleet(f.db, owner, from, to, fleet, f.clock);

  beforeEach(async () => {
    f = await seedWorld(3, 20_130);
    [home, enemy, colony] = f.planetIds as [string, string, string];
    owner = f.playerIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await placeAt(f.db, home, { x: 0 });
    await placeAt(f.db, colony, { x: 900 });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await f.db.update(planets).set({
      controllerPlayerId: owner, kind: 'COLONY', statsOwnerPlayerId: owner,
      seasonTelemetry: { produced: { alloy: 0, crystal: 0, deuterium: 0 }, productiveSeconds: 0, shipsBuilt: {} },
    }).where(eq(planets.id, colony));
    await f.db.insert(moons).values([
      { planetId: home, rarity: 'EPIC', origin: 'BUILT', visualSeed: 1, bornAt: f.clock.now() },
      { planetId: colony, rarity: 'COMMON', origin: 'BUILT', visualSeed: 2, bornAt: f.clock.now() },
      { planetId: enemy, rarity: 'RARE', origin: 'BUILT', visualSeed: 3, bornAt: f.clock.now() },
    ]);
    await levelWorld(f.db, f.planetIds);
    for (const id of f.planetIds) await setLevel(f.db, id, 'HANGAR', 10);
    f.clock.advance(250);
    await fuelUp(f.db, home);
  });
  afterAll(async () => { const { close } = await testDb(); await close(); });

  it('jumps in ten seconds: the ships stand on the departure moon meanwhile, then on the far one, fuel paid from the planet', async () => {
    await putOnMoon(home, { DART: 30 });
    const before = await tank(home);
    const [a] = await f.db.select().from(planets).where(eq(planets.id, home));
    const [b] = await f.db.select().from(planets).where(eq(planets.id, colony));
    const move = await jump({ DART: 30 });
    expect(move.arriveAt.getTime() - f.clock.now().getTime()).toBe(MOON.gateOpenSeconds * 1_000);
    expect(await tank(home)).toBeCloseTo(before - jumpFuel({ DART: 30 }, distance(a!, b!)), 6);
    expect(await onMoon(home)).toEqual({ DART: 30 });

    await finish();
    expect(await onMoon(home)).toEqual({});
    expect(await onMoon(colony)).toEqual({ DART: 30 });
    // No unloading pause after a gate (S46).
    const [world] = await f.db.select({ ready: planets.transferReadyAt }).from(planets).where(eq(planets.id, colony));
    expect(world?.ready ?? null).toBeNull();
  });

  it('charges both gates for their own rarity and says so when each is ready again (S17)', async () => {
    await putOnMoon(home, { DART: 10 });
    const now = f.clock.now().getTime();
    await jump({ DART: 5 });
    expect((await gateOf(home))?.getTime()).toBe(now + gateChargeMs('EPIC'));
    expect((await gateOf(colony))?.getTime()).toBe(now + gateChargeMs('COMMON'));
    await expect(jump({ DART: 5 })).rejects.toMatchObject({ code: 'GATE_CHARGING' });

    const ready = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'moon_gate_ready'));
    expect(ready).toHaveLength(2);
    const homeReady = ready.find((row) => row.refId === home)!;
    f.clock.set(homeReady.resolveAt);
    await HANDLERS.moon_gate_ready!({ db: f.db, clock: f.clock }, homeReady);
    const told = await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, owner), eq(notifications.kind, 'moon_gate_ready')));
    expect(told).toHaveLength(1);
  });

  it('is limited by the smaller moon’s dock and the far world’s Hangar (S12)', async () => {
    // A Common far moon takes 470 bulk; 160 Darts are 480.
    await putOnMoon(home, { DART: 160 });
    await expect(jump({ DART: 160 })).rejects.toMatchObject({ code: 'GATE_CAPACITY' });
    await expect(jump({ DART: 150 })).resolves.toBeDefined();
  });

  it('refuses what is not two of the caller’s own open moons', async () => {
    await putOnMoon(home, { DART: 10 });
    await expect(jump({ DART: 10 }, home, enemy)).rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
    await expect(jump({ DART: 11 })).rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
    await f.db.update(moons).set({ closedUntil: new Date(f.clock.now().getTime() + 60_000) }).where(eq(moons.planetId, colony));
    await expect(jump({ DART: 10 })).rejects.toMatchObject({ code: 'GATE_CLOSED' });
    await f.db.delete(moons).where(eq(moons.planetId, colony));
    await expect(jump({ DART: 10 })).rejects.toMatchObject({ code: 'NO_MOON' });
  });

  it('holds the ships it has taken: nothing else may leave the moon with them during the opening', async () => {
    await putOnMoon(home, { DART: 10 });
    await jump({ DART: 8 });
    await expect(hopFleet(f.db, owner, home, 'DOWN', { DART: 3 }, f.clock)).rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
    await expect(hopFleet(f.db, owner, home, 'DOWN', { DART: 2 }, f.clock)).resolves.toBeDefined();
  });

  it('cancels when the far moon is gone or the far world is lost; the fuel stays spent (E6, V8)', async () => {
    await putOnMoon(home, { DART: 10 });
    const move = await jump({ DART: 10 });
    await f.db.delete(moons).where(eq(moons.planetId, colony));
    await finish();
    expect(await onMoon(home)).toEqual({ DART: 10 });
    const [row] = await f.db.select({ status: moonMoves.status }).from(moonMoves).where(eq(moonMoves.id, move.id));
    expect(row?.status).toBe('CANCELLED');
  });

  it('lets the survivors through when the departure moon is attacked during the opening (E4)', async () => {
    await putOnMoon(home, { DART: 40 });
    await giveUnits(f.db, enemy, { DART: 240, COURIER: 60 });
    await fuelUp(f.db, enemy);
    const raid = await launchAttack(f.db, enemy, home, { DART: 240, COURIER: 60 }, f.clock, undefined, false, undefined, false, new Set(), false, 'MOON');
    f.clock.set(new Date(raid.arriveAt.getTime() - 5_000));
    const move = await jump({ DART: 40 });
    // The raid reaches the moon inside the opening: the gate waits for the battle (K12), which wipes the
    // moon, and then carries whoever is left — nobody.
    f.clock.set(settledAt(raid.arriveAt));
    await new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent).tick();
    await finish();
    const [row] = await f.db.select({ status: moonMoves.status }).from(moonMoves).where(eq(moonMoves.id, move.id));
    expect(row?.status).toBe('LOST');
    expect(await onMoon(colony)).toEqual({});
  });

  it('lets a gated fleet raid at once (S18), and a moon-bound transfer counts the jump’s room', async () => {
    await putOnMoon(home, { DART: 20 });
    await jump({ DART: 20 });
    await finish();
    await fuelUp(f.db, colony);
    await expect(launchAttack(f.db, colony, enemy, { DART: 20 }, f.clock, undefined, false, undefined, false, new Set(), false, 'PLANET', 'MOON'))
      .resolves.toBeDefined();

    await putOnMoon(home, { DART: 100 });
    f.clock.advance(MOON.gateChargeHours.COMMON * 60 + 1);
    await jump({ DART: 100 });
    // 300 of the Common moon's 470 are spoken for by the jump; 60 Pikes (180) no longer fit.
    await giveUnits(f.db, home, { PIKE: 60 });
    await expect(launchTransfer(f.db, owner, home, colony, { PIKE: 60 }, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock,
      undefined, undefined, false, 'MOON')).rejects.toMatchObject({ code: 'DOCK_FULL' });
  });
});
