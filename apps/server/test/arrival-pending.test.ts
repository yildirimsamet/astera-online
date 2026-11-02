import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, planets, strategicAssets, units } from '../src/db/schema.js';
import { upgradeBuilding } from '../src/services/build.js';
import { launchAttack } from '../src/services/mission.js';
import { launchTransfer } from '../src/services/movement.js';
import { recallClanSupport, sendBackClanSupport, sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, seedWorld, settledAt, testDb, type Fixture } from './helpers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';

/**
 * ONCE AN ATTACK HAS REACHED A WORLD, ITS SHIPS AND CARGO STAY. Owner decision K12, 2026-10-28.
 *
 * The battle is computed when the worker reaches it, so between the attack's arrival and
 * that moment the owner could still fly the fleet out and leave nothing to fight. The
 * attacker's own recall closes at arrival for the same reason. Building and producing are
 * not departures and stay free, as are worlds nothing hostile has reached.
 */
afterAll(async () => { await (await testDb()).close(); });

const NO_CARGO = { alloy: 0, crystal: 0, deuterium: 0 };
const ONE_WAY = { alloy: 10, crystal: 0, deuterium: 0 };

describe('a world an attack has reached', () => {
  let f: Fixture;
  let world: string;
  let colony: string;
  let raider: string;
  let owner: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [world, colony, raider] = f.planetIds as [string, string, string];
    owner = f.playerIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: owner }).where(eq(planets.id, colony));
    for (const id of [world, raider]) await grant(f.db, id, 200_000, 20_000);
    await giveUnits(f.db, world, { COURIER: 4, DART: 4 });
    await giveUnits(f.db, raider, { DART: 4 });
    f.clock.advance(600);
  });

  const raid = async () => (await launchAttack(f.db, raider, world, { DART: 4 }, f.clock));
  const arrivalOf = async () => (await f.db.select().from(missions).where(eq(missions.kind, 'attack')))[0]!;
  const moveFleetOut = () => launchTransfer(f.db, owner, world, colony, { COURIER: 1 }, ONE_WAY, f.clock);

  it('lets the fleet leave while the attack is still flying', async () => {
    await raid();
    await expect(moveFleetOut()).resolves.toBeDefined();
  });

  it('refuses a transfer from the moment it arrives', async () => {
    await raid();
    const { arriveAt } = await arrivalOf();
    f.clock.set(arriveAt);
    await expect(moveFleetOut()).rejects.toMatchObject({ code: 'ARRIVAL_PENDING', status: 409 });
  });

  it('refuses the owner sending a raid of their own', async () => {
    await raid();
    f.clock.set((await arrivalOf()).arriveAt);
    await expect(launchAttack(f.db, world, raider, { DART: 2 }, f.clock))
      .rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
  });

  it('leaves everything where it stood when it refuses', async () => {
    await raid();
    f.clock.set((await arrivalOf()).arriveAt);
    const before = await f.db.select().from(units).where(eq(units.planetId, world));
    await expect(moveFleetOut()).rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
    expect(await f.db.select().from(units).where(eq(units.planetId, world))).toEqual(before);
  });

  it('frees the world once the battle is settled', async () => {
    await raid();
    const mission = await arrivalOf();
    f.clock.set(settledAt(mission.arriveAt));
    await expect(moveFleetOut()).rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
    await new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
    await giveUnits(f.db, world, { COURIER: 1 });
    await expect(moveFleetOut()).resolves.toBeDefined();
  });

  it('still lets the owner build, and leave a world nothing has reached', async () => {
    await raid();
    f.clock.set((await arrivalOf()).arriveAt);
    await expect(upgradeBuilding(f.db, world, 'CORE', f.clock)).resolves.toBeDefined();
    await giveUnits(f.db, colony, { COURIER: 1 });
    await expect(launchTransfer(f.db, owner, colony, world, { COURIER: 1 }, NO_CARGO, f.clock)).resolves.toBeDefined();
  });

  it('is not raised by the owner\'s own or a friendly flight', async () => {
    await giveUnits(f.db, colony, { COURIER: 1 });
    const { arriveAt } = await launchTransfer(f.db, owner, colony, world, { COURIER: 1 }, NO_CARGO, f.clock);
    f.clock.set(arriveAt);
    await expect(moveFleetOut()).resolves.toBeDefined();
  });

  it('treats a Death Star as hostile too', async () => {
    await raid();
    const { id, arriveAt } = await arrivalOf();
    await f.db.update(missions).set({ kind: 'death_star' }).where(eq(missions.id, id));
    f.clock.set(arriveAt);
    await expect(moveFleetOut()).rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
  });

  it('keeps a Death Star on the ground too', async () => {
    await f.db.insert(strategicAssets).values({ planetId: world, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
    await raid();
    f.clock.set((await arrivalOf()).arriveAt);
    await expect(launchDeathStar(f.db, world, raider, f.clock)).rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
  });
});

describe('a support wave standing on a world an attack has reached', () => {
  const standing = async () => {
    const f = await supportWorld(4, 15_609);
    await formClan(f, 0, [1, 2]);
    await f.db.transaction(tx => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!,
      toggles: { escape: false, support: true }, clock: f.clock }));
    const { wave } = await f.db.transaction(tx => sendClanSupport(tx, { senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: { DART: 10 }, clock: f.clock }));
    const [flight] = await f.db.select().from(missions).where(eq(missions.status, 'in_flight'));
    f.clock.set(new Date(flight!.arriveAt.getTime() + 30_000));
    await new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
    await grant(f.db, f.planetIds[3]!, 200_000, 20_000);
    await giveUnits(f.db, f.planetIds[3]!, { DART: 4 });
    const { arriveAt } = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, { DART: 4 }, f.clock);
    f.clock.set(arriveAt);
    return { f, waveId: wave.id };
  };

  it('stays for the battle when its sender recalls it', async () => {
    const { f, waveId } = await standing();
    await expect(f.db.transaction(tx => recallClanSupport(tx, { playerId: f.playerIds[0]!, waveId, clock: f.clock })))
      .rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
  });

  it('stays for the battle when its host sends it back', async () => {
    const { f, waveId } = await standing();
    await expect(f.db.transaction(tx => sendBackClanSupport(tx, { playerId: f.playerIds[1]!, waveId, clock: f.clock })))
      .rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
  });
});
