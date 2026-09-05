import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { MULTI_WORLD } from '@astera/rules';
import { pino } from 'pino';
import {
  battleReports,
  buildOrders,
  missions,
  playerResearch,
  researchOrders,
  seasons,
  units,
} from '../src/db/schema.js';
import { buildUnits } from '../src/services/build.js';
import { launchAttack } from '../src/services/mission.js';
import { joinSeason } from '../src/services/player.js';
import { completeResearch } from '../src/services/research.js';
import { wipeAllServers } from '../src/services/servers.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

describe('Fleet V2 offline season cutover', () => {
  let old: Fixture;

  beforeEach(async () => {
    old = await seedWorld(2);
  });

  afterAll(async () => {
    const { close } = await testDb();
    await close();
  });

  it('reclaims accounts into a v4 successor and completes the Fleet V2 smoke route', async () => {
    await giveUnits(old.db, old.planetIds[0]!, { DART: 3 });
    await old.db.insert(playerResearch).values({
      playerId: old.playerIds[0]!,
      projectId: 'SHIP_ARMOR',
      level: 1,
      completedAt: old.clock.now(),
    });

    const cutover = await wipeAllServers(old.db, old.clock, {
      count: 2,
      seedBase: 148,
    });
    expect(cutover).toMatchObject({ seasonsWiped: 1, playersCleared: 2, deferred: false });

    const [successor] = await old.db
      .select()
      .from(seasons)
      .where(eq(seasons.status, 'live'));
    /*
      A SUCCESSOR OPENS ON THE CURRENT RULESET, NOT ON THE FLEET V2 BOUNDARY.

      The two were the same number while `rulesetVersion` was 4, so this read
      `fleetCatalogRulesetVersion` and passed by coincidence. D156 moved the
      current ruleset to 5 for the trade lane and the coincidence ended. What this
      test is actually about is that the successor is at or past the Fleet V2
      boundary, so both halves are stated.
    */
    expect(successor?.rulesetVersion).toBe(MULTI_WORLD.rulesetVersion);
    expect(successor?.rulesetVersion)
      .toBeGreaterThanOrEqual(MULTI_WORLD.fleetCatalogRulesetVersion);
    expect(await old.db.select().from(playerResearch)).toHaveLength(0);

    const attacker = await joinSeason(old.db, old.accountIds[0]!, successor!.id, old.clock);
    const defender = await joinSeason(old.db, old.accountIds[1]!, successor!.id, old.clock);
    const worker = new EventWorker(
      old.db,
      old.clock,
      { pollMs: 1, batch: 100, staleMinutes: 5 },
      silent,
    );

    await grant(old.db, attacker.planetId, 250_000, 80_000);
    await setLevel(old.db, attacker.planetId, 'SHIPYARD', 6);
    await setLevel(old.db, attacker.planetId, 'HANGAR', 10);

    await buildUnits(old.db, attacker.planetId, 'DART', 2, old.clock);
    const [openingOrder] = await old.db
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, attacker.planetId), eq(buildOrders.status, 'BUILDING')));
    expect(openingOrder?.subject).toBe('DART');
    expect(openingOrder?.count).toBe(2);
    old.clock.set(openingOrder!.readyAt);
    await worker.tick();

    const [openingDarts] = await old.db
      .select()
      .from(units)
      .where(and(
        eq(units.planetId, attacker.planetId),
        eq(units.hull, 'DART'),
        eq(units.location, 'home'),
      ));
    expect(openingDarts?.count).toBe(2);

    await completeResearch(
      old.db,
      attacker.planetId,
      'STARSHIP_ENGINEERING',
      old.clock,
    );
    const [researchOrder] = await old.db
      .select()
      .from(researchOrders)
      .where(eq(researchOrders.status, 'BUILDING'));
    old.clock.set(researchOrder!.readyAt);
    await worker.tick();
    expect(await old.db.select().from(playerResearch)).toContainEqual(expect.objectContaining({
      projectId: 'STARSHIP_ENGINEERING',
      level: 1,
    }));

    await buildUnits(old.db, attacker.planetId, 'DART', 118, old.clock);
    const [fleetOrder] = await old.db
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, attacker.planetId), eq(buildOrders.status, 'BUILDING')));
    old.clock.set(fleetOrder!.readyAt);
    await worker.tick();

    await grant(old.db, defender.planetId, 60_000, 6_000);
    await giveUnits(old.db, defender.planetId, { DART: 5 });
    await levelWorld(old.db, [attacker.planetId, defender.planetId]);
    old.clock.advance(300);

    const launch = await launchAttack(
      old.db,
      attacker.planetId,
      defender.planetId,
      { DART: 120 },
      old.clock,
    );
    old.clock.set(settledAt(launch.arriveAt));
    await worker.tick();

    const [report] = await old.db
      .select()
      .from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(report?.grade).toBe('DECISIVE');
    const [returnMission] = await old.db
      .select()
      .from(missions)
      .where(eq(missions.kind, 'return'));
    expect(returnMission?.fleet.DART).toBeGreaterThan(0);

    old.clock.set(returnMission!.arriveAt);
    await worker.tick();
    const [home] = await old.db
      .select()
      .from(units)
      .where(and(
        eq(units.planetId, attacker.planetId),
        eq(units.hull, 'DART'),
        eq(units.location, 'home'),
      ));
    expect(home?.count).toBeGreaterThan(0);
    expect((await old.db.select().from(units)).every((row) =>
      !['WASP', 'LANCE', 'BULWARK', 'HAULER', 'RUNNER', 'BREACHER'].includes(row.hull)))
      .toBe(true);
  });
});
