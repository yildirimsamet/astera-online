import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { battleReports, honorEvents, honorTotals, planets, scheduledEvents, seasons } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { launchAttack } from '../src/services/mission.js';
import { lockWorlds, transferPlanetControl } from '../src/services/ownership.js';
import { secedeColony } from '../src/services/loyalty.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { fuelUp, giveUnits, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

describe('a real normal raid meets changed colony ownership', () => {
  let f: Fixture;
  let target: string;
  beforeEach(async () => {
    f = await seedWorld(4, 19928);
    target = f.planetIds[3]!;
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[1]!,
      statsOwnerPlayerId: f.playerIds[1]!, defencePosture: 'HOLD' }).where(eq(planets.id, target));
    await fuelUp(f.db, f.planetIds[0]!, 50000);
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 12);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 80 });
    await giveUnits(f.db, target, { DART: 10, THORN: 10 });
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    f.clock.advance(250);
  });
  afterAll(async () => { await (await testDb()).close(); });

  const launch = async () => {
    const raid = await launchAttack(f.db, f.planetIds[0]!, target, { DART: 80 }, f.clock);
    f.clock.set(new Date(f.clock.now().getTime() + 1000));
    return raid;
  };
  const land = async (raid: Awaited<ReturnType<typeof launchAttack>>) => {
    f.clock.set(settledAt(raid.arriveAt));
    const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, raid.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  };
  const transfer = (newPlayerId: string) => f.db.transaction(async tx => {
    await lockWorlds(tx, f.planetIds);
    await transferPlanetControl(tx, { targetPlanetId: target, newPlayerId,
      expectedControllerPlayerId: f.playerIds[1]!, now: f.clock.now(), protectedUntil: f.clock.now() });
  });

  it('settles real combat against a replacement owner without inheriting the old target’s Honor conditions', async () => {
    const raid = await launch();
    await transfer(f.playerIds[2]!);
    await land(raid);
    const reports = await f.db.select().from(battleReports).where(eq(battleReports.missionId, raid.missionId));
    expect(reports).toHaveLength(1);
    expect(reports[0]?.defenderPlayerId).toBe(f.playerIds[2]);
    const entries = await f.db.select().from(honorEvents);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.evidence).toMatchObject({ eligible: false, exclusion: 'TARGET_CHANGED' });
    expect(entries[0]?.outcome.attack.total).toBe(0);
    expect(entries[0]?.outcome.defence.total).toBe(0);
    expect(entries[0]?.outcome.pairs).toHaveLength(0);
    expect(entries[0]?.evidence.defence[0]?.id).toBe(f.playerIds[2]);
    expect((await f.db.select().from(honorTotals)).every(row => row.score === 0)).toBe(true);
  });

  it('returns from a colony now held by the attacker without fighting its own ships', async () => {
    const raid = await launch();
    await transfer(f.playerIds[0]!);
    await land(raid);
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    expect(await f.db.select().from(battleReports).where(eq(battleReports.missionId, raid.missionId))).toHaveLength(0);
  });

  it('does not award competitive Honor after the target really secedes to the caretaker', async () => {
    const raid = await launch();
    await f.db.transaction(async tx => {
      await lockWorlds(tx, f.planetIds);
      expect(await secedeColony(tx, target, f.clock.now(), raid.missionId)).toBe(true);
    });
    await land(raid);
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, target));
    expect(world?.kind).toBe('NEUTRAL');
  });
});
