import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DEATH_STAR, MULTI_WORLD, type Grade } from '@astera/rules';
import { battleReports, clans, clanWarOperations, missions, planets, seasons, strategicAssets } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { recallFlight } from '../src/services/movement.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, grant, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

describe('personal raids involving tier 1–3 commanders', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let colony: string;
  let me: string;
  let them: string;
  const raid = (target = theirs) => launchAttack(f.db, mine, target, { DART: 1 }, f.clock);
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));

  beforeEach(async () => {
    f = await seedWorld(4);
    [mine, theirs, colony] = f.planetIds as [string, string, string];
    [me, them] = f.playerIds as [string, string];
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.clanRulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ controllerPlayerId: them, statsOwnerPlayerId: them, kind: 'COLONY' }).where(eq(planets.id, colony));
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 7);
      await grant(f.db, id, 100_000, 10_000);
      await fuelUp(f.db, id, 100_000);
      await giveUnits(f.db, id, { DART: 20 });
      await setLevel(f.db, id, 'CORE', 7);
    }
    f.clock.advance(250);
  });

  /** A completed historical fight, independent of the current fleet/protection state. */
  async function history(at: Date, origin = mine, target = theirs, attacker = me, defender = them) {
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId, kind: 'attack', status: 'resolved', ownerPlayerId: attacker,
      originPlanetId: origin, targetPlanetId: target, fleet: { DART: 1 }, fuelPaid: 0, distance: 100,
      departAt: new Date(at.getTime() - 3_600_000), arriveAt: at,
    }).returning();
    await f.db.insert(battleReports).values({
      seasonId: f.seasonId, missionId: mission!.id, attackerPlayerId: attacker,
      defenderPlayerId: defender, targetPlanetId: target, grade: 'REPELLED', rounds: [],
      loot: { alloy: 0, crystal: 0, deuterium: 0 }, attackerLosses: { DART: 1 }, defenderLosses: {}, createdAt: at,
    });
    return mission!.id;
  }

  it.each([[1, 1], [4, 7], [7, 7], [7, 10], [10, 7]])('blocks a second fight for Core levels %i / %i', async (a, b) => {
    await setLevel(f.db, mine, 'CORE', a);
    for (const id of [theirs, colony]) await setLevel(f.db, id, 'CORE', b);
    await history(f.clock.now());
    await expect(raid(colony)).rejects.toMatchObject({ code: 'PERSONAL_RAID_COOLDOWN' });
  });

  it('starts twelve hours at battle time and opens at the exact boundary', async () => {
    const at = f.clock.now();
    await history(at);
    const until = new Date(at.getTime() + 12 * 3_600_000);
    f.clock.set(new Date(until.getTime() - 1));
    await expect(raid()).rejects.toMatchObject({ code: 'PERSONAL_RAID_COOLDOWN', params: { until: until.toISOString() } });
    f.clock.set(until);
    await expect(raid()).resolves.toHaveProperty('missionId');
  });

  it('keeps the opposite direction and other commanders independent', async () => {
    await history(f.clock.now(), theirs, mine, them, me);
    await expect(raid()).resolves.toHaveProperty('missionId');
    await expect(launchAttack(f.db, colony, mine, { DART: 1 }, f.clock)).rejects.toMatchObject({ code: 'PERSONAL_RAID_COOLDOWN' });
  });

  it('reserves one outgoing raid across the target commander’s planets', async () => {
    await raid();
    await expect(raid(colony)).rejects.toMatchObject({ code: 'PERSONAL_RAID_PENDING' });
  });

  it.each([1, MULTI_WORLD.clanRulesetVersion])('reserves the current colony owner’s allowance after a transfer in ruleset %i', async (rulesetVersion) => {
    await f.db.update(seasons).set({ rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await raid(colony);
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[3]!, statsOwnerPlayerId: f.playerIds[3]! }).where(eq(planets.id, colony));

    await expect(raid(f.planetIds[3])).rejects.toMatchObject({ code: 'PERSONAL_RAID_PENDING' });
  });

  it.each([1, MULTI_WORLD.clanRulesetVersion])('releases the former colony owner’s pending reservation in ruleset %i', async (rulesetVersion) => {
    await f.db.update(seasons).set({ rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await raid(colony);
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[3]!, statsOwnerPlayerId: f.playerIds[3]! }).where(eq(planets.id, colony));

    await expect(raid()).resolves.toHaveProperty('missionId');
  });

  it('releases the current colony owner’s reservation when the raid is recalled', async () => {
    const first = await raid(colony);
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[3]!, statsOwnerPlayerId: f.playerIds[3]! }).where(eq(planets.id, colony));
    await expect(raid(f.planetIds[3])).rejects.toMatchObject({ code: 'PERSONAL_RAID_PENDING' });

    f.clock.advance(0.01);
    await recallFlight(f.db, first.missionId, f.clock, me);
    await expect(raid(f.planetIds[3])).resolves.toHaveProperty('missionId');
  });

  it('does not expire an unresolved flight’s reservation twelve hours after departure', async () => {
    await raid();
    f.clock.advance(721);
    await expect(raid(colony)).rejects.toMatchObject({ code: 'PERSONAL_RAID_PENDING' });
  });

  it('serializes concurrent launches at different target planets', async () => {
    const results = await Promise.allSettled([raid(), raid(colony)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { code: 'PERSONAL_RAID_PENDING' } });
  });

  it('serializes launches from different origin colonies as well', async () => {
    const otherOrigin = f.planetIds[3]!;
    await f.db.update(planets).set({ controllerPlayerId: me, statsOwnerPlayerId: me, kind: 'COLONY' }).where(eq(planets.id, otherOrigin));
    await giveUnits(f.db, otherOrigin, { DART: 20 });
    const results = await Promise.allSettled([
      raid(), launchAttack(f.db, otherOrigin, colony, { DART: 1 }, f.clock),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { code: 'PERSONAL_RAID_PENDING' } });
  });

  it('keeps a different commander’s allowance independent', async () => {
    await history(f.clock.now());
    await expect(raid(f.planetIds[3])).resolves.toHaveProperty('missionId');
  });

  it.each<Grade>(['DECISIVE', 'PARTIAL', 'REPELLED'])('counts a %s battle equally', async (grade) => {
    const missionId = await history(f.clock.now());
    await f.db.update(battleReports).set({ grade }).where(eq(battleReports.missionId, missionId));
    await expect(raid()).rejects.toMatchObject({ code: 'PERSONAL_RAID_COOLDOWN' });
  });

  it('does not start a cooldown for a fleet lost without a battle', async () => {
    const first = await raid();
    await f.db.update(missions).set({ status: 'resolved', fleet: {} }).where(eq(missions.id, first.missionId));
    await expect(raid(colony)).resolves.toHaveProperty('missionId');
  });

  it('ignores a joint clan battle in the new personal cooldown', async () => {
    const missionId = await history(f.clock.now());
    const [clan] = await f.db.insert(clans).values({
      seasonId: f.seasonId, name: 'Raid test', nameKey: 'raid test', tag: 'RT', createdAt: f.clock.now(),
    }).returning();
    const [operation] = await f.db.insert(clanWarOperations).values({
      seasonId: f.seasonId, clanId: clan!.id, clanName: 'Raid test', clanTag: 'RT',
      leaderPlayerId: me, stagingPlanetId: mine, targetPlanetId: theirs, targetPlayerId: them,
      targetPlanetName: 'Target', targetX: 150, targetY: 0, targetZ: 0,
      createdAt: f.clock.now(), expiresAt: new Date(f.clock.now().getTime() + 86_400_000),
    }).returning();
    await f.db.update(battleReports).set({ clanWarOperationId: operation!.id }).where(eq(battleReports.missionId, missionId));
    await f.db.update(missions).set({ kind: 'clan_war', status: 'in_flight' }).where(eq(missions.id, missionId));
    await expect(raid(colony)).resolves.toHaveProperty('missionId');
  });

  it('allows a Death Star during the ordinary-raid cooldown', async () => {
    await history(f.clock.now());
    // Existing ready stock survives the newer Core 13 build gate. Core 12
    // stays in reach of the tier 3 defender whose raid allowance is tested.
    await setLevel(f.db, mine, 'CORE', 12);
    await setLevel(f.db, mine, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await f.db.insert(strategicAssets).values({ planetId: mine, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
    await expect(launchDeathStar(f.db, mine, theirs, f.clock)).resolves.toHaveProperty('missionId');
    await expect(raid(colony)).rejects.toMatchObject({ code: 'PERSONAL_RAID_COOLDOWN' });
  });

  it('a launched Death Star does not reserve the ordinary-raid allowance', async () => {
    // Existing ready stock survives the newer Core 13 build gate. Core 12
    // stays in reach of the tier 3 defender whose raid allowance is tested.
    await setLevel(f.db, mine, 'CORE', 12);
    await setLevel(f.db, mine, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await f.db.insert(strategicAssets).values({ planetId: mine, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
    await launchDeathStar(f.db, mine, theirs, f.clock);
    await expect(raid(colony)).resolves.toHaveProperty('missionId');
  });

  it('releases a recalled raid without starting a cooldown', async () => {
    const first = await raid();
    f.clock.advance(0.01);
    await recallFlight(f.db, first.missionId, f.clock, me);
    await expect(raid(colony)).resolves.toHaveProperty('missionId');
  });

  it('does not impose the new limit when both current tiers are four or higher', async () => {
    await history(f.clock.now());
    for (const id of [mine, theirs, colony]) await setLevel(f.db, id, 'CORE', 10);
    await expect(raid()).resolves.toHaveProperty('missionId');
    await expect(raid(colony)).resolves.toHaveProperty('missionId');
  });

  it('uses the real worker’s battle time, not the outbound departure', async () => {
    await giveUnits(f.db, theirs, { BASTION: 100 });
    const first = await raid();
    f.clock.set(settledAt(first.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, first.missionId));
    expect(report).toBeDefined();
    await expect(raid(colony)).rejects.toMatchObject({
      code: 'PERSONAL_RAID_COOLDOWN',
      params: { until: new Date(report!.createdAt.getTime() + 12 * 3_600_000).toISOString() },
    });
  });
});
