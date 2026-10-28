import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { HULLS, MULTI_WORLD, buildingCost, hashSeed, mulberry32, type BuildingId } from '@astera/rules';
import { botProfiles, buildOrders, playerResearch, players, researchOrders, rewardGrants, seasons, units } from '../src/db/schema.js';
import { addBot, retireBot } from '../src/services/bots/roster.js';
import { ensureBotSeats, runBotSweep } from '../src/services/bots/sweep.js';
import { drawLane, openLanes, probeCandidates, runBotTurn, type BotSeat } from '../src/services/bots/brain.js';
import { personaNamed } from '../src/services/bots/personas.js';
import { planetView } from '../src/services/planetView.js';
import { guardPlayerIds } from '../src/services/bots/guardPolicy.js';
import { guardGoals, guardProjectedLevel, guardGoalAvailable, guardQuote } from '../src/services/bots/guardRoute.js';
import { guardWindow } from '../src/services/bots/guardPolicy.js';
import { buildUnits, upgradeBuilding } from '../src/services/build.js';
import { grant, giveUnits, seedWorld, setLevel, settleBuilds, testDb, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
let f: Fixture, seat: BotSeat;
const view = () => f.db.transaction(tx => planetView(tx, seat.planetId, f.clock));
const setLevels = async (levels: Partial<Record<BuildingId, number>>) => {
  for (const [id, level] of Object.entries(levels)) await setLevel(f.db, seat.planetId, id, level);
};
const research = async (id: 'STARSHIP_ENGINEERING' | 'SHIP_POWER' | 'SHIP_ARMOR' | 'SHIP_SHIELDS' | 'DEUTERIUM_SYNTHESIS', level: number) => {
  await f.db.insert(playerResearch).values({ playerId: seat.playerId, projectId: id, level, completedAt: f.clock.now() })
    .onConflictDoUpdate({ target: [playerResearch.playerId, playerResearch.projectId], set: { level } });
};

beforeEach(async () => {
  f = await seedWorld(8);
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
  await addBot(f.db, 'BuilderFixture', f.clock);
  const bot = await addBot(f.db, 'GuardFixture', f.clock);
  await ensureBotSeats(f.db, f.clock, silent);
  const [p] = await f.db.select().from(players).where(eq(players.accountId, bot.accountId));
  const worlds = await f.db.query.planets.findMany();
  seat = { accountId: bot.accountId, playerId: p!.id, planetId: worlds.find(w => w.controllerPlayerId === p!.id)!.id,
    seasonId: f.seasonId, seasonSeed: f.seed, ordinal: bot.ordinal, persona: 'RAIDER' };
  await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
});
afterAll(async () => { await (await testDb()).close(); });

describe('paid guard development in an active season', () => {
  it('selects the existing Raider account without changing its profile or minting resources', async () => {
    const before = await f.db.select().from(botProfiles);
    expect(await guardPlayerIds(f.db, f.seasonId)).toContain(seat.playerId);
    expect(await f.db.select().from(botProfiles)).toEqual(before);
    await retireBot(f.db, 'GuardFixture');
    expect(await guardPlayerIds(f.db, f.seasonId)).toContain(seat.playerId);
  });

  it('starts from current holdings and does not refill obsolete T2/T3 hulls after Engineering 2', async () => {
    await setLevels({ CORE: 16, REFINERY: 16, EXTRACTOR: 16, SHIPYARD: 6, HANGAR: 5 });
    await research('STARSHIP_ENGINEERING', 2); await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    const goals = guardGoals(await view());
    expect(goals.some(g => g.kind === 'hull' && ['VIPER', 'SENTINEL', 'TEMPEST', 'BALLISTA', 'PRAETORIAN'].includes(g.id))).toBe(false);
  });

  it('keeps cargo hulls eligible even when combat technology is already at T4', async () => {
    await setLevels({ CORE: 16, REFINERY: 16, EXTRACTOR: 16, SHIPYARD: 6, HANGAR: 5 });
    await research('STARSHIP_ENGINEERING', 2); await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    await giveUnits(f.db, seat.planetId, { PROSPECTOR: 2, THORN: 4, HARPOON: 2, BASTION: 2 });
    expect(guardGoals(await view()).find(goal => goal.kind === 'hull')).toMatchObject({ id: 'COURIER', target: 2 });
  });

  it('reserves for Engineering 2 instead of spending its savings on early ships', async () => {
    await setLevels({ CORE: 14, REFINERY: 14, EXTRACTOR: 14, VAULT: 3, SHIPYARD: 6, HANGAR: 5, DEUTERIUM_PLANT: 4 });
    await research('DEUTERIUM_SYNTHESIS', 2); await research('STARSHIP_ENGINEERING', 1);
    await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    await grant(f.db, seat.planetId, 25_000, 12_000);
    await runBotTurn(f.db, f.clock, seat, silent);
    const orders = await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
    expect(orders.filter(o => ['DART', 'VIPER', 'SENTINEL'].includes(o.subject))).toEqual([]);
  });

  it('pays for Engineering 2 through the same-season research queue and never grants a completed level', async () => {
    await setLevels({ CORE: 16, REFINERY: 16, EXTRACTOR: 16, VAULT: 6, SHIPYARD: 6, HANGAR: 5, DEUTERIUM_PLANT: 6 });
    await research('DEUTERIUM_SYNTHESIS', 2); await research('STARSHIP_ENGINEERING', 1);
    await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    await research('SHIP_SHIELDS', 1);
    await grant(f.db, seat.planetId, 150_000, 100_000);
    await runBotTurn(f.db, f.clock, seat, silent);
    const orders = await f.db.select().from(researchOrders).where(eq(researchOrders.playerId, seat.playerId));
    expect(orders.some(o => o.projectId === 'STARSHIP_ENGINEERING' && o.level === 2)).toBe(true);
    expect((await view()).research.find(r => r.id === 'STARSHIP_ENGINEERING')?.level).toBe(1);
    await settleBuilds(f, seat.planetId);
    expect((await view()).research.find(r => r.id === 'STARSHIP_ENGINEERING')?.level).toBe(2);
  });

  it('does not spend research savings on the optional probe flight', async () => {
    await setLevels({ CORE: 14, REFINERY: 14, EXTRACTOR: 14, VAULT: 3, SHIPYARD: 6, HANGAR: 5, DEUTERIUM_PLANT: 4 });
    await research('DEUTERIUM_SYNTHESIS', 2); await research('STARSHIP_ENGINEERING', 1);
    await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2); await research('SHIP_SHIELDS', 1);
    await grant(f.db, seat.planetId, 25_000, 12_000);
    const current = await view(), start = f.clock.now().getTime();
    const now = Array.from({ length: 100 }, (_, i) => new Date(start + i * 1000)).find(at =>
      drawLane(personaNamed('RAIDER'), openLanes(current, 0), mulberry32(hashSeed('astera:bots:turn', seat.playerId, at.getTime()))) === 'probe');
    expect(now).toBeDefined();
    f.clock.set(now!);
    expect((await probeCandidates(f.db, f.clock.now(), seat, current)).length).toBeGreaterThan(0);
    const turn = await runBotTurn(f.db, f.clock, seat, silent);
    expect(turn.did).not.toContain('probe');
    expect((await view()).research.find(r => r.id === 'STARSHIP_ENGINEERING')?.level).toBe(1);
  });

  it('counts queued, away and docked hulls and reserves room for every queued batch', async () => {
    await grant(f.db, seat.planetId, 100_000, 100_000);
    await setLevel(f.db, seat.planetId, 'HANGAR', 5);
    await buildUnits(f.db, seat.planetId, 'DART', 2, f.clock, seat.playerId);
    await buildUnits(f.db, seat.planetId, 'DART', 3, f.clock, seat.playerId);
    const current = await view();
    expect(guardProjectedLevel({ ...current, fleetAway: { DART: 2 }, fleetDocked: { DART: 3 } },
      { kind: 'hull', id: 'DART', target: 20, minCore: 0 })).toBe((current.fleet.DART ?? 0) + 10);
  });

  it('buys capacity rather than deleting the existing large fleet or blocking forever', async () => {
    await setLevels({ CORE: 16, REFINERY: 16, EXTRACTOR: 16, VAULT: 6, SHIPYARD: 6, HANGAR: 2 });
    await research('STARSHIP_ENGINEERING', 2); await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    await giveUnits(f.db, seat.planetId, { DART: 60, PROSPECTOR: 2, COURIER: 2, THORN: 4, HARPOON: 2, BASTION: 2 });
    const goals = guardGoals(await view());
    expect(goals.find(g => g.kind === 'building' && g.id === 'HANGAR')?.target).toBe(3);
    const before = await f.db.select().from(units).where(eq(units.planetId, seat.planetId));
    await grant(f.db, seat.planetId, 25_000, 12_000);
    await runBotTurn(f.db, f.clock, seat, silent);
    expect(await f.db.select().from(units).where(eq(units.planetId, seat.planetId))).toEqual(before);
    const orders = await f.db.select().from(buildOrders).where(and(eq(buildOrders.planetId, seat.planetId), eq(buildOrders.subject, 'HANGAR')));
    expect(orders.length).toBeGreaterThan(0);
  });

  it('raises storage for an existing full-orbit world whose next purchase cannot fit', async () => {
    await setLevels({ CORE: 14, REFINERY: 14, EXTRACTOR: 14, VAULT: 3, SHIPYARD: 6, HANGAR: 5, DEUTERIUM_PLANT: 6 });
    await research('DEUTERIUM_SYNTHESIS', 2); await research('STARSHIP_ENGINEERING', 1);
    await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2); await research('SHIP_SHIELDS', 1);
    const current = await view();
    // Simulate retained older hardware: no free slot and no Foundry output bonus.
    const full = { ...current, orbit: ['UPLINK', 'BEACON'] as const };
    const goals = guardGoals({ ...full, orbit: [...full.orbit] });
    expect(goals[0]).toMatchObject({ kind: 'building', id: 'VAULT', target: 4 });
    expect(goals.some(g => g.kind === 'satellite' && g.id === 'FOUNDRY')).toBe(false);
  });

  it('keeps mobile production available when retained guns fill the ground pool', async () => {
    await setLevels({ CORE: 16, REFINERY: 16, EXTRACTOR: 16, VAULT: 3, SHIPYARD: 6, HANGAR: 5 });
    await research('STARSHIP_ENGINEERING', 2); await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    await giveUnits(f.db, seat.planetId, { THORN: 30, PROSPECTOR: 2, COURIER: 2 });
    const current = await view();
    expect(current.capacity.groundUsed).toBe(current.capacity.ground);
    const yard = guardGoals(current).find(goal => goal.kind === 'hull');
    expect(yard).toMatchObject({ id: 'CORSAIR' });
    expect(guardGoalAvailable(current, yard!)).toBe(true);
  });

  it('raises storage before an emergency Hangar whose own invoice cannot fit', async () => {
    await setLevels({ CORE: 16, REFINERY: 12, EXTRACTOR: 12, VAULT: 3, SHIPYARD: 6, HANGAR: 5 });
    await research('STARSHIP_ENGINEERING', 2); await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    await giveUnits(f.db, seat.planetId, { DART: 510, PROSPECTOR: 2, COURIER: 2, THORN: 4, HARPOON: 2, BASTION: 2 });
    const current = await view();
    expect(buildingCost('HANGAR', 5).alloy).toBeGreaterThan(current.planet.alloyCap);
    expect(guardGoals(current)[0]).toMatchObject({ kind: 'building', id: 'VAULT', target: 4 });
  });

  it('keeps cheap producer growth when neither emergency capacity nor another Vault is reachable', async () => {
    await setLevels({ CORE: 16, REFINERY: 2, EXTRACTOR: 2, VAULT: 16, SHIPYARD: 6, HANGAR: 5, DEUTERIUM_PLANT: 2 });
    await research('DEUTERIUM_SYNTHESIS', 1);
    await research('STARSHIP_ENGINEERING', 2); await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    await giveUnits(f.db, seat.planetId, { DART: 510, PROSPECTOR: 2, COURIER: 2, THORN: 4, HARPOON: 2, BASTION: 2 });
    const current = await view();
    expect(buildingCost('HANGAR', 5).alloy).toBeGreaterThan(current.planet.alloyCap);
    expect(buildingCost('VAULT', 16).alloy).toBeGreaterThan(current.planet.alloyCap);
    expect(guardGoals(current).find(g => g.kind === 'building')).toMatchObject({ id: 'REFINERY', target: 3 });
  });

  it('starts fuel production before buying storage for fuel that is not being produced', async () => {
    await setLevels({ CORE: 9, REFINERY: 9, EXTRACTOR: 9, VAULT: 1, DEUTERIUM_PLANT: 0 });
    await research('DEUTERIUM_SYNTHESIS', 1);
    const current = await view();
    expect(current.planet.deuteriumPerHour).toBe(0);
    expect(guardGoals(current)[0]).toMatchObject({ kind: 'building', id: 'DEUTERIUM_PLANT', target: 1 });
  });

  it('buys the part of a hull target that fits the final Hangar rung', async () => {
    await setLevels({ CORE: 16, REFINERY: 16, EXTRACTOR: 16, VAULT: 6, SHIPYARD: 6, HANGAR: 10 });
    await research('STARSHIP_ENGINEERING', 2); await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    await giveUnits(f.db, seat.planetId, { DART: 2410, WARDEN: 0, PROSPECTOR: 2, COURIER: 2, THORN: 4, HARPOON: 2, BASTION: 2 });
    await grant(f.db, seat.planetId, 25_000, 12_000);
    const current = await view(), goal = { kind: 'hull', id: 'CORSAIR', target: 3, minCore: 14 } as const;
    expect(guardQuote(current, goal).count).toBe(2);
    expect(guardGoalAvailable(current, goal)).toBe(true);
    const result = await buildUnits(f.db, seat.planetId, goal.id, guardQuote(current, goal).count, f.clock, seat.playerId);
    expect(result.planet.capacity.hangarUsed + 26).toBeLessThanOrEqual(result.planet.capacity.hangar);
    expect(guardGoalAvailable(result.planet, goal)).toBe(false);
    expect(result.planet.queues.YARD.filter(order => order.subject === 'CORSAIR')).toMatchObject([{ count: 2 }]);
  });

  it('splits a target invoice larger than storage without waiting for the whole package', async () => {
    await setLevels({ CORE: 16, REFINERY: 16, EXTRACTOR: 16, VAULT: 3, SHIPYARD: 6, HANGAR: 5, DEUTERIUM_PLANT: 6 });
    await research('DEUTERIUM_SYNTHESIS', 2);
    const current = await view(), goal = { kind: 'hull', id: 'CORSAIR', target: 30, minCore: 14 } as const;
    expect(HULLS.CORSAIR.alloy * 30).toBeGreaterThan(current.planet.alloyCap);
    const quote = guardQuote(current, goal);
    expect(quote.count).toBeGreaterThan(0);
    expect(quote.count).toBeLessThan(30);
    expect(quote.cost.alloy).toBeLessThanOrEqual(current.planet.alloyCap);
    expect(quote.cost.crystal).toBeLessThanOrEqual(current.planet.crystalCap);
    expect(quote.cost.deuterium).toBeLessThanOrEqual(current.planet.deuteriumCap);
  });

  it('does not duplicate paid research or ships, and keeps research completion as a cross-queue gate', async () => {
    await grant(f.db, seat.planetId, 100_000, 80_000);
    await runBotTurn(f.db, f.clock, seat, silent);
    const once = await f.db.select().from(researchOrders).where(eq(researchOrders.playerId, seat.playerId));
    await runBotTurn(f.db, f.clock, seat, silent);
    const twice = await f.db.select().from(researchOrders).where(eq(researchOrders.playerId, seat.playerId));
    expect(twice.filter(o => o.projectId === 'DEUTERIUM_SYNTHESIS' && o.level === 1)).toHaveLength(1);
    expect(once.filter(o => o.projectId === 'DEUTERIUM_SYNTHESIS')).toHaveLength(1);
    expect(guardGoalAvailable(await view(), { kind: 'building', id: 'DEUTERIUM_PLANT', target: 1, minCore: 2 })).toBe(false);
  });

  it('preserves active-season paid order identities, prices and completion times while adopting the route', async () => {
    await setLevels({ CORE: 9, REFINERY: 9, EXTRACTOR: 9, DEUTERIUM_PLANT: 2 });
    await research('DEUTERIUM_SYNTHESIS', 1);
    await grant(f.db, seat.planetId, 25_000, 12_000);
    await upgradeBuilding(f.db, seat.planetId, 'HANGAR', f.clock, seat.playerId);
    await buildUnits(f.db, seat.planetId, 'COURIER', 1, f.clock, seat.playerId);
    await buildUnits(f.db, seat.planetId, 'PROSPECTOR', 1, f.clock, seat.playerId);
    const before = await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
    await runBotTurn(f.db, f.clock, seat, silent);
    const after = await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
    for (const order of before) expect(after.find(row => row.id === order.id)).toEqual(order);
    expect(after.filter(order => order.subject === 'COURIER')).toHaveLength(1);
    expect(after.filter(order => order.subject === 'PROSPECTOR')).toHaveLength(1);
  });

  it('drives guard sessions without human activity but keeps first-day attack protection', async () => {
    const now = Array.from({ length: 120 }, (_, i) => new Date(Date.UTC(2026, 0, 1, 5, i)))
      .find(t => guardWindow(seat.playerId, t))!;
    f.clock.set(now);
    await f.db.update(players).set({ lastActiveAt: new Date(now.getTime() - 3_600_000) });
    await runBotSweep(f.db, f.clock, silent);
    const [profile] = await f.db.select().from(botProfiles).where(eq(botProfiles.accountId, seat.accountId));
    expect(profile?.sessionPlayerId).toBe(seat.playerId);
    expect(profile?.sessionUntilAt!.getTime()).toBeGreaterThan(now.getTime());
    const turn = await runBotTurn(f.db, f.clock, seat, silent);
    expect(turn.did).not.toContain('attack');
    const [owner] = await f.db.select().from(players).where(eq(players.id, seat.playerId));
    expect(owner?.newcomerShieldUntil!.getTime()).toBeGreaterThan(now.getTime());
  });

  it('claims only earned normal rewards once and refreshes the bank between purchases', async () => {
    await setLevel(f.db, seat.planetId, 'CORE', 5);
    const result = await runBotTurn(f.db, f.clock, seat, silent);
    expect(result.did).toContain('reward:CORE:5');
    const again = await runBotTurn(f.db, f.clock, seat, silent);
    expect(again.did).not.toContain('reward:CORE:5');
    const claims = await f.db.select().from(rewardGrants).where(eq(rewardGrants.playerId, seat.playerId));
    expect(new Set(claims.map(c => c.rewardId)).size).toBe(claims.length);
    expect(claims.some(c => c.rewardId.startsWith('SOCIAL'))).toBe(false);
  });

});
