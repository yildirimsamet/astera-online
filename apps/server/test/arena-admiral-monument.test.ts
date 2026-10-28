import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MONUMENT_CAPACITY, distance, missionFuel, type Fleet } from '@astera/rules';
import { arenaShips, monumentBattleParticipants, monuments, monumentWaves, planets, seasons } from '../src/db/schema.js';
import { chooseShip } from '../src/services/arenaShips.js';
import { readCommanderShip } from '../src/services/arenaShipState.js';
import { quoteMonument, sendMonument } from '../src/services/monument.js';
import { resolveMonumentArrival } from '../src/services/monumentArrival.js';
import { recallMonument, resolveMonumentReturn } from '../src/services/monumentMovement.js';
import { closeSeasonMonuments } from '../src/services/monumentSeasonClose.js';
import { readMonuments } from '../src/services/monumentView.js';
import { readMonumentBattleReports } from '../src/services/monumentReports.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * THE COMMANDER SHIP ESCORTS A MONUMENT WAVE (Y9, owner 2026-10-25, doc 22 "Amiral savaşmaz").
 * It flies out with the wave, lends its bonus and is never hit. A won fight puts the fleet in the
 * monument and sends the escort home alone; a lost one brings it home with the fleet; a wave lost
 * to the last ship leaves it to fly home alone and repair. Its Kılavuz road is the outbound leg.
 */
describe('the admiral on a monument wave', () => {
  let f: Fixture; let target: typeof monuments.$inferSelect; let me: string;
  const ship = async () => (await f.db.select().from(arenaShips).where(eq(arenaShips.playerId, me)))[0]!;
  const input = (fleet: Fleet, admiral: boolean, purpose: 'ATTACK' | 'REINFORCE' = 'ATTACK') => ({
    senderPlayerId: me, originPlanetId: f.planetIds[0]!, monumentId: target.id, fleet, purpose, acknowledgeShieldLoss: true, clock: f.clock, admiral,
  });
  const send = (fleet: Fleet, admiral = true, purpose?: 'ATTACK' | 'REINFORCE') => f.db.transaction(tx => sendMonument(tx, input(fleet, admiral, purpose)));
  const quote = (fleet: Fleet, admiral: boolean) => f.db.transaction(tx => quoteMonument(tx, input(fleet, admiral)));
  const waveOf = async (id: string) => (await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, id)))[0]!;
  const arrive = async (id: string) => {
    const row = await waveOf(id);
    f.clock.set(row.arriveAt!);
    await f.db.transaction(tx => resolveMonumentArrival(tx, { waveId: id, generation: row.generation, at: row.arriveAt!, adminUsernames: [] }));
  };
  const landHome = async (id: string) => {
    const row = await waveOf(id);
    f.clock.set(row.arriveAt!);
    await f.db.transaction(tx => resolveMonumentReturn(tx, { waveId: id, generation: row.generation, at: row.arriveAt! }));
  };

  beforeEach(async () => {
    f = await seedWorld(3, 20_261_003);
    me = f.playerIds[0]!;
    for (const planetId of f.planetIds) {
      await setLevel(f.db, planetId, 'CORE', 6);
      await setLevel(f.db, planetId, 'HANGAR', 10);
      await grant(f.db, planetId, 100_000, 100_000);
      await giveUnits(f.db, planetId, { DART: 20, COURIER: 4 });
    }
    target = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
      capacity: MONUMENT_CAPACITY, productionPerMinute: 60, garrison: { DART: 1 }, settledAt: f.clock.now() }).returning())[0]!;
    await f.db.update(seasons).set({ rulesetVersion: 19 }).where(eq(seasons.id, f.seasonId));
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'kilavuz');
  });

  it('quotes and flies a Kılavuz wave shorter and on less outbound fuel, holding the ship only once sent', async () => {
    const plain = await quote({ DART: 10 }, false);
    const led = await quote({ DART: 10 }, true);
    expect(led.travelMinutes).toBeCloseTo(plain.travelMinutes * 0.97, 4);
    // A moving monument is met at a different point when escorted. Price that
    // actual outbound leg; the prepaid return reserve receives no escort discount.
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const outbound = missionFuel({ DART: 10 }, distance(origin!, led.targetPosition), 1);
    expect(led.outboundFuel).toBe(Math.ceil(outbound * 0.95));
    expect(led.returnFuelReserve).toBe(plain.returnFuelReserve);
    expect(led.fuel).toBe(led.outboundFuel! + led.returnFuelReserve!);
    expect((await ship()).admiralId).toBeNull();
    const { wave } = await send({ DART: 10 });
    expect(wave.fuelPaid).toBe(led.fuel);
    expect((await ship()).admiralId).not.toBeNull();
  });

  it('names itself on its commander\'s own wave, so the galaxy draws it at the rear', async () => {
    const led = await send({ DART: 10 });
    const plain = await send({ DART: 5 }, false);
    const view = await f.db.transaction(tx => readMonuments(tx, { playerId: me, seasonId: f.seasonId, at: f.clock.now(), adminUsernames: [] }));
    expect(view.waves.find(w => w.id === led.wave.id)?.admiral).toEqual({ ship: 'kilavuz', level: 1 });
    expect(view.waves.find(w => w.id === plain.wave.id)?.admiral).toBeUndefined();
  });

  it('refuses an escort before its season and sends nothing', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    await expect(send({ DART: 10 })).rejects.toMatchObject({ code: 'ADMIRAL_RULESET' });
    expect(await f.db.select().from(monumentWaves)).toHaveLength(0);
  });

  it('leaves the fleet in a won monument and flies home alone to service, with XP and its name on the report', async () => {
    const { wave } = await send({ DART: 10 });
    const leg = wave.arriveAt!.getTime() - wave.sentAt.getTime();
    await arrive(wave.id);
    expect((await waveOf(wave.id)).status).toBe('HOLD');
    const [mine] = await f.db.select().from(monumentBattleParticipants).where(eq(monumentBattleParticipants.playerId, me));
    expect(mine!.admiral).toEqual({ ship: 'kilavuz', level: 1 });
    const [report] = await f.db.transaction(tx => readMonumentBattleReports(tx, me, 10));
    expect(report!.admirals).toEqual([{ side: 'attack', ship: 'kilavuz', level: 1 }]);
    const home = await ship();
    expect(home).toMatchObject({ admiralId: null, readyReason: 'service' });
    expect(home.readyAt!.getTime()).toBe(wave.arriveAt!.getTime() + leg + 10 * 60_000);
    expect(home.xp).toBeGreaterThanOrEqual(10);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(await readCommanderShip(f.db, f.accountIds[0]!, f.clock)).toMatchObject({ ship: { status: 'admiral' }, homeward: {
      from: { x: 6000, y: 0, z: 0 }, to: { x: world!.x, y: world!.y, z: world!.z },
      departAt: wave.arriveAt!.toISOString(), arriveAt: new Date(wave.arriveAt!.getTime() + leg).toISOString() } });
  });

  it('flies home alone to repair when the wave is lost to the last ship', async () => {
    await f.db.update(monuments).set({ garrison: { CITADEL: 30 } }).where(eq(monuments.id, target.id));
    const { wave } = await send({ DART: 2 });
    const leg = wave.arriveAt!.getTime() - wave.sentAt.getTime();
    await arrive(wave.id);
    expect((await waveOf(wave.id)).status).toBe('LOST');
    const alone = await ship();
    expect(alone).toMatchObject({ admiralId: null, readyReason: 'repair' });
    expect(alone.readyAt!.getTime()).toBe(wave.arriveAt!.getTime() + leg + 60 * 60_000);
  });

  it('comes home with a recalled wave to service with the idle XP', async () => {
    const { wave } = await send({ DART: 10 });
    f.clock.set(new Date(wave.sentAt.getTime() + (wave.arriveAt!.getTime() - wave.sentAt.getTime()) / 2));
    await f.db.transaction(tx => recallMonument(tx, { playerId: me, waveId: wave.id, clock: f.clock, all: true }));
    expect((await ship()).admiralId).not.toBeNull();
    await landHome(wave.id);
    expect(await ship()).toMatchObject({ admiralId: null, readyReason: 'service', xp: 5 });
  });

  it('turns home from a reinforcement it never fought, with the idle XP', async () => {
    // Take it first, then let the ship come back from service.
    const taken = await send({ DART: 10 }, false);
    await arrive(taken.wave.id);
    const { wave } = await send({ DART: 5 }, true, 'REINFORCE');
    await arrive(wave.id);
    expect((await waveOf(wave.id)).status).toBe('HOLD');
    expect(await ship()).toMatchObject({ admiralId: null, readyReason: 'service', xp: 5 });
  });

  it('lands with the wave the season close brings home', async () => {
    const { wave } = await send({ DART: 10 });
    const cutoff = new Date(wave.sentAt.getTime() + 1_000);
    f.clock.set(cutoff);
    await f.db.transaction(tx => closeSeasonMonuments(tx, { seasonId: f.seasonId, cutoff, adminUsernames: [] }));
    expect((await waveOf(wave.id)).status).toBe('HOME');
    expect((await ship()).admiralId).toBeNull();
  });

  it('writes no escort on a wave sent without one', async () => {
    const { wave } = await send({ DART: 10 }, false);
    await arrive(wave.id);
    const [mine] = await f.db.select().from(monumentBattleParticipants).where(eq(monumentBattleParticipants.playerId, me));
    expect(mine!.admiral).toBeNull();
    expect((await ship()).admiralId).toBeNull();
  });
});
