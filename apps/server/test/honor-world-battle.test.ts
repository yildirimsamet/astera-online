import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, type Fleet } from '@astera/rules';
import { battleReports, honorEvents, honorTotals, planets, players, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { readBattleReports } from '../src/services/reports.js';
import { reportsSchema } from '../../web/src/api/schemas.js';
import { setDefencePosture } from '../src/services/clanSupport.js';
import { recallFlight } from '../src/services/movement.js';
import { fuelUp, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

describe.each([{ rulesetVersion: 1, honorVersion: 3 }, { rulesetVersion: MULTI_WORLD.rulesetVersion, honorVersion: 3 },
  { rulesetVersion: MULTI_WORLD.rulesetVersion, honorVersion: 4 }] as const)('Honor integrated with real normal raid transactions · ruleset $rulesetVersion / Honor $honorVersion', ({ rulesetVersion, honorVersion }) => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 9921);
    await f.db.update(seasons).set({ rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ defencePosture: 'HOLD' }).where(eq(planets.seasonId, f.seasonId));
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    await levelWorld(f.db, f.planetIds);
    await grant(f.db, f.planetIds[1]!, 60_000, 20_000);
    await giveUnits(f.db, f.planetIds[0]!, { BALLISTA: 60 });
    await giveUnits(f.db, f.planetIds[1]!, { BALLISTA: 6 });
    // The defender's reserve is elsewhere: target selection remains a valid skill.
    await f.db.insert(units).values({ planetId: f.planetIds[1]!, ownerPlayerId: f.playerIds[1]!,
      hull: 'BALLISTA', count: 54, location: randomUUID() });
    await fuelUp(f.db, f.planetIds[0]!, 50_000);
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, honorVersion === 4 ? 'SHADOW' : 'ACTIVE', f.clock, honorVersion));
    f.clock.advance(250);
  });
  const raid = async (fleet: Fleet = { BALLISTA: 60 }) => {
    const launch = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, fleet, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, launch.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    return { launch, event: event! };
  };

  it('books the real permanent casualties and loot once while Dominion remains zero-sum', async () => {
    const { launch, event } = await raid();
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry?.sourceId).toBe(launch.missionId);
    expect(entry?.outcome.attack.total).toBeGreaterThan(0);
    expect(entry?.outcome.defence.total).toBeGreaterThanOrEqual(0);
    expect(entry?.evidence.defence[0]?.combatLoss).toBeGreaterThan(0);
    const visible = reportsSchema.parse(await readBattleReports(f.db, f.playerIds[0]!));
    const battle = visible.reports.find(row => row.kind !== 'STRATEGIC' && row.kind !== 'MONUMENT');
    if (honorVersion === 4) expect(battle?.honor).toBeNull();
    else expect(battle?.honor).toMatchObject({ delta: entry!.outcome.attack.total, reason: 'COMBAT', breakdown: {
      teamDelta: entry!.outcome.attack.total, participants: 1, contributionPpm: 1_000_000,
      militaryDamage: entry!.evidence.defence[0]!.combatLoss, permanentLoss: entry!.evidence.attack[0]!.loss,
    } });
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    expect(report?.defenderLosses.BALLISTA).toBeGreaterThan(0);
    const totals = await f.db.select().from(honorTotals);
    await onMissionArrival({ db: f.db, clock: f.clock }, event);
    expect(await f.db.select().from(honorTotals)).toEqual(totals);
    expect(await f.db.select().from(honorEvents)).toHaveLength(1);
    const commanders = await f.db.select().from(players);
    expect(commanders.reduce((sum, row) => sum + row.dominionTaken - row.dominionLost, 0)).toBe(0);
  });

  it('empty resource loot is not positive Honor and does not punish the passive defender', async () => {
    await f.db.delete(units).where(eq(units.ownerPlayerId, f.playerIds[1]!));
    await f.db.update(planets).set({ shield: 0 }).where(eq(planets.id, f.planetIds[1]!));
    const { launch } = await raid();
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry?.outcome.attack.total).toBe(0);
    expect(entry?.outcome.defence.total).toBe(0);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    expect(report!.loot.alloy + report!.loot.crystal + report!.loot.deuterium).toBeGreaterThan(0);
  });

  it('shrinking a current target does not erase its recorded tier and navy peak', async () => {
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 9);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 6);
    await f.db.delete(units).where(and(eq(units.ownerPlayerId, f.playerIds[1]!), eq(units.count, 54)));
    await raid();
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry?.outcome.attack.total).toBeGreaterThan(0);
    expect(entry?.outcome.defence.total).toBeGreaterThanOrEqual(0);
    expect(entry?.outcome.pool.attack.exposures[0]?.bullying).toBe(false);
    expect(entry!.evidence.defence[0]!.navy).toBeGreaterThanOrEqual(entry!.evidence.attack[0]!.navy);
    expect(entry!.evidence.defence[0]!.tier).toBeGreaterThanOrEqual(entry!.evidence.attack[0]!.tier);
  });

  it('a genuinely lower-tier and smaller target loses the attacker Honor without debiting the victim', async () => {
    // Arrange genuine initial weakness before activation; downgrading an already-recorded
    // large fleet would retain its 24h reference and would test a different case.
    f = await seedWorld(2, 9922);
    await f.db.update(seasons).set({ rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ defencePosture: 'HOLD' }).where(eq(planets.seasonId, f.seasonId));
    await grant(f.db, f.planetIds[1]!, 10_000, 2000);
    await fuelUp(f.db, f.planetIds[0]!, 50_000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 9);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 6);
    await giveUnits(f.db, f.planetIds[0]!, { BALLISTA: 60 });
    await giveUnits(f.db, f.planetIds[1]!, { BALLISTA: 6 });
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, honorVersion === 4 ? 'SHADOW' : 'ACTIVE', f.clock, honorVersion));
    f.clock.advance(250);
    await raid();
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry?.outcome.attack.total).toBeLessThan(0);
    expect(entry?.outcome.defence.total).toBeGreaterThanOrEqual(0);
    expect(entry?.outcome.pool.attack.exposures[0]?.bullying).toBe(true);
  });

  it('a mosquito attack earns no participation credit and debits its actual loss', async () => {
    await giveUnits(f.db, f.planetIds[1]!, { BALLISTA: 600 });
    await giveUnits(f.db, f.planetIds[0]!, { DART: 1 });
    await raid({ DART: 1 });
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry?.evidence.attack[0]?.loss).toBeGreaterThan(0);
    expect(entry?.evidence.defence[0]?.combatLoss).toBe(0);
    expect(entry?.outcome.attack.total).toBeLessThan(0);
    expect(entry?.outcome.defence.total).toBe(0);
  });
  it.runIf(rulesetVersion === MULTI_WORLD.rulesetVersion)('an actual tactical escape leaves no invented permanent military credit', async () => {
    await fuelUp(f.db, f.planetIds[1]!, 50_000);
    await f.db.transaction(tx => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!,
      toggles: { escape: true, support: false }, clock: f.clock }));
    const { launch } = await raid();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    const [entry] = await f.db.select().from(honorEvents);
    expect(report?.fleetEscape?.kind).toBe('ESCAPED');
    expect(entry?.evidence.defence[0]?.combatLoss).toBe(0);
    expect(entry?.outcome.attack.total).toBe(0);
    expect(entry?.outcome.defence.total).toBe(0);
  });
  it.runIf(rulesetVersion === MULTI_WORLD.rulesetVersion)('recall and a stale arrival callback cannot create a battle or consume Honor budgets', async () => {
    await placeAt(f.db, f.planetIds[0]!, { x: 0 });
    await placeAt(f.db, f.planetIds[1]!, { x: 400 });
    const launch = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { BALLISTA: 60 }, f.clock);
    const [stale] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, launch.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
    f.clock.set(new Date(f.clock.now().getTime() + 1000));
    const returned = await recallFlight(f.db, launch.missionId, f.clock, f.playerIds[0]!);
    f.clock.set(new Date(returned.arriveAt.getTime() + 1));
    const [fresh] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, launch.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
    await onMissionArrival({ db: f.db, clock: f.clock }, fresh!);
    await onMissionArrival({ db: f.db, clock: f.clock }, stale!);
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    expect(await f.db.select().from(battleReports)).toHaveLength(0);
    const home = await f.db.select().from(units).where(and(eq(units.ownerPlayerId, f.playerIds[0]!), eq(units.location, 'home')));
    expect(home.filter(row => row.hull === 'BALLISTA').reduce((sum, row) => sum + row.count, 0)).toBe(60);
  });
});
