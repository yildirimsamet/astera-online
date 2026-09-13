import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MULTI_WORLD,
  RESEARCH_PROJECTS,
  SERVERS,
  researchMinutes,
  shieldHp,
  type NeutralTier,
} from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import {
  neutralPlanetState,
  planets,
  playerResearch,
  researchOrders,
  satellites,
  units,
} from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { launchSettlement } from '../src/services/movement.js';
import { reinforceNeutral } from '../src/services/neutral.js';
import { colonyStanding, transferPlanetControl } from '../src/services/ownership.js';
import { completeResearch } from '../src/services/research.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveResearch,
  giveUnits,
  grant,
  joinSettled,
  makeAccount,
  seedWorld,
  setLevel,
  testDb,
  truncateAll,
  type Fixture,
} from './helpers.js';

/**
 * D209 — OWNER INSTRUCTION. The server half of the colony economy repair:
 * caretaker worlds are seeded and rebuilt from their template's own garrison and
 * dome, a settled world opens on the tier's capture stock and nothing else, and
 * research is gated and timed by the commander's CAPITAL rather than by whichever
 * captured world happens to fund it.
 */

const silent = pino({ level: 'silent' });
const tick = (db: Fixture['db'], clock: FixedClock) =>
  new EventWorker(db, clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

async function galaxy() {
  const { db } = await testDb();
  await truncateAll(db);
  const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
  const { season } = await createSeason(db, {
    shardCode: 'EU-D209',
    seed: 91273,
    startsAt: clock.now(),
    playerCap: SERVERS.capacity,
    rulesetVersion: MULTI_WORLD.rulesetVersion,
  });
  const account = await makeAccount(db, 'Settler');
  const joined = await joinSettled(db, account.id, season.id, clock);
  const neutrals = await db
    .select({ world: planets, state: neutralPlanetState })
    .from(planets)
    .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id));
  return { db, clock, season, joined, neutrals };
}

const garrisonOf = async (db: Fixture['db'], planetId: string) =>
  Object.fromEntries(
    (await db.select().from(units).where(and(eq(units.planetId, planetId), eq(units.location, 'home'))))
      .filter((row) => row.count > 0)
      .map((row) => [row.hull, row.count]),
  );

const aegisOf = async (db: Fixture['db'], planetId: string) =>
  (await db.select().from(satellites)
    .where(and(eq(satellites.planetId, planetId), eq(satellites.type, 'AEGIS'))))[0]?.level ?? 0;

describe('D209 caretaker seeding', () => {
  it('seeds 38 / 19 / 8 worlds, each with its template garrison, dome and shield', async () => {
    const g = await galaxy();
    expect(g.neutrals.filter((row) => row.state.tier === 1)).toHaveLength(38);
    expect(g.neutrals.filter((row) => row.state.tier === 2)).toHaveLength(19);
    expect(g.neutrals.filter((row) => row.state.tier === 3)).toHaveLength(8);

    for (const tier of [1, 2, 3] as const) {
      const template = MULTI_WORLD.neutral[tier];
      const sample = g.neutrals.find((row) => row.state.tier === tier)!;
      expect(await garrisonOf(g.db, sample.world.id), `tier ${String(tier)}`)
        .toEqual({ ...template.fleet, ...template.ground });
      expect(await aegisOf(g.db, sample.world.id)).toBe(template.instruments.AEGIS);
      expect(sample.world.shield).toBe(shieldHp(template.instruments.AEGIS));
      expect((await g.db.select().from(units).where(eq(units.planetId, sample.world.id)))
        .every((row) => row.ownerPlayerId === null)).toBe(true);
    }
  });
});

describe('D209 caretaker reinforcement', () => {
  it.each([2, 3] as const)('rebuilds a tier %i dome up to its template level', async (tier: NeutralTier) => {
    const g = await galaxy();
    const target = g.neutrals.find((row) => row.state.tier === tier)!;
    await g.db.delete(satellites).where(eq(satellites.planetId, target.world.id));
    await g.db.update(planets).set({
      alloy: 10_000_000, crystal: 10_000_000, deuterium: 10_000_000, lastTickAt: g.clock.now(),
    }).where(eq(planets.id, target.world.id));

    await g.db.transaction((tx) => reinforceNeutral(tx, target.world.id, g.clock.now()));

    expect(await aegisOf(g.db, target.world.id)).toBe(MULTI_WORLD.neutral[tier].instruments.AEGIS);
  });

  it('seeds the tier 1 dome but never rebuilds it after destruction', async () => {
    const g = await galaxy();
    const target = g.neutrals.find((row) => row.state.tier === 1)!;
    expect(await aegisOf(g.db, target.world.id)).toBe(MULTI_WORLD.neutral[1].instruments.AEGIS);
    await g.db.delete(satellites).where(eq(satellites.planetId, target.world.id));
    await g.db.update(planets).set({ shield: 0 }).where(eq(planets.id, target.world.id));
    await g.db.transaction((tx) => reinforceNeutral(tx, target.world.id, g.clock.now()));
    expect(await aegisOf(g.db, target.world.id)).toBe(0);
    const [after] = await g.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(after?.shield).toBe(0);
  });
});

describe('D209 free reinforcement', () => {
  it.each([2, 3] as const)('rebuilds a destroyed tier %i garrison and dome in full without spending its stores', async (tier: NeutralTier) => {
    const g = await galaxy();
    const target = g.neutrals.find((row) => row.state.tier === tier)!;
    const template = MULTI_WORLD.neutral[tier];
    await g.db.delete(units).where(eq(units.planetId, target.world.id));
    await g.db.delete(satellites).where(eq(satellites.planetId, target.world.id));
    await g.db.update(planets).set({
      alloy: 0,
      crystal: 0,
      deuterium: 0,
      shield: 0,
      lastTickAt: g.clock.now(),
    })
      .where(eq(planets.id, target.world.id));

    await g.db.transaction((tx) => reinforceNeutral(tx, target.world.id, g.clock.now()));

    expect(await garrisonOf(g.db, target.world.id)).toEqual({ ...template.fleet, ...template.ground });
    expect(await aegisOf(g.db, target.world.id)).toBe(template.instruments.AEGIS);
    const [after] = await g.db.select().from(planets).where(eq(planets.id, target.world.id));
    expect(after).toMatchObject({
      alloy: 0,
      crystal: 0,
      deuterium: 0,
      shield: shieldHp(template.instruments.AEGIS),
    });
  });

  it('tops up a partial garrison without adding past the template', async () => {
    const g = await galaxy();
    const target = g.neutrals.find((row) => row.state.tier === 2)!;
    await g.db.update(units).set({ count: 3 })
      .where(and(eq(units.planetId, target.world.id), eq(units.hull, 'DART')));
    await g.db.transaction((tx) => reinforceNeutral(tx, target.world.id, g.clock.now()));
    await g.db.transaction((tx) => reinforceNeutral(tx, target.world.id, g.clock.now()));
    const template = MULTI_WORLD.neutral[2];
    expect(await garrisonOf(g.db, target.world.id)).toEqual({ ...template.fleet, ...template.ground });
  });

  it('never lets a building shortfall hold the garrison back', async () => {
    const g = await galaxy();
    const target = g.neutrals.find((row) => row.state.tier === 2)!;
    await setLevel(g.db, target.world.id, 'CORE', 1);
    await g.db.delete(units).where(eq(units.planetId, target.world.id));
    await g.db.update(planets).set({ alloy: 0, crystal: 0, deuterium: 0, lastTickAt: g.clock.now() })
      .where(eq(planets.id, target.world.id));
    await g.db.transaction((tx) => reinforceNeutral(tx, target.world.id, g.clock.now()));
    const template = MULTI_WORLD.neutral[2];
    expect(await garrisonOf(g.db, target.world.id)).toEqual({ ...template.fleet, ...template.ground });
  });

  it('waits out an open claim instead of re-arming a world somebody is racing to settle', async () => {
    const g = await galaxy();
    const target = g.neutrals.find((row) => row.state.tier === 2)!;
    const claimUntil = new Date(g.clock.now().getTime() + 20 * 60_000);
    await g.db.delete(units).where(eq(units.planetId, target.world.id));
    await g.db.update(neutralPlanetState).set({ claimUntil })
      .where(eq(neutralPlanetState.planetId, target.world.id));

    const next = await g.db.transaction((tx) => reinforceNeutral(tx, target.world.id, g.clock.now()));

    expect(next?.getTime()).toBe(claimUntil.getTime());
    expect(await garrisonOf(g.db, target.world.id)).toEqual({});
  });
});

describe('D209 capture stock', () => {
  const settle = async (tier: NeutralTier) => {
    const g = await galaxy();
    const target = g.neutrals.find((row) => row.state.tier === tier)!;
    await g.db.update(planets).set({ x: 40, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await g.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 10_000, crystal: 5_000, deuterium: 5_000 })
      .where(eq(planets.id, g.joined.planetId));
    await setLevel(g.db, g.joined.planetId, 'CORE', MULTI_WORLD.colonyCoreThresholds[0]);
    await giveUnits(g.db, g.joined.planetId, { COURIER: MULTI_WORLD.settlement.transports });
    // The garrison is somebody else's fight; this suite is about what the settler finds.
    await g.db.delete(units).where(eq(units.planetId, target.world.id));
    await g.db.update(planets).set({ bufferAlloy: 777, bufferCrystal: 333, bufferDeuterium: 111 })
      .where(eq(planets.id, target.world.id));
    await g.db.update(neutralPlanetState)
      .set({ claimUntil: new Date(g.clock.now().getTime() + 30 * 60_000) })
      .where(eq(neutralPlanetState.planetId, target.world.id));
    const researchBefore = await g.db.select().from(playerResearch);

    const launched = await launchSettlement(g.db, g.joined.playerId, g.joined.planetId, target.world.id, g.clock);
    g.clock.set(launched.arriveAt);
    await tick(g.db, g.clock);
    const [captured] = await g.db.select().from(planets).where(eq(planets.id, target.world.id));
    return { g, target, captured: captured!, researchBefore };
  };

  it.each([1, 2, 3] as const)(
    'opens a settled tier %i world on exactly the capture stock, with empty works and no founding cargo',
    async (tier: NeutralTier) => {
      const { captured, target } = await settle(tier);
      const stock = MULTI_WORLD.neutral[tier].captureStock;
      expect(captured).toMatchObject({ kind: 'COLONY' });
      // The caretaker was holding far more than this; none of it survives the landing.
      expect(target.world.alloy).toBeGreaterThan(stock.alloy);
      expect(captured.alloy).toBe(stock.alloy);
      expect(captured.crystal).toBe(stock.crystal);
      expect(captured.deuterium).toBe(stock.deuterium);
      expect(captured.bufferAlloy).toBe(0);
      expect(captured.bufferCrystal).toBe(0);
      expect(captured.bufferDeuterium).toBe(0);
    },
  );

  it('never hands a caretaker garrison to the commander who settles the world', async () => {
    const g = await galaxy();
    const target = g.neutrals.find((row) => row.state.tier === 2)!;
    await g.db.update(planets).set({ x: 40, y: 0, z: 0 }).where(eq(planets.id, target.world.id));
    await g.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 10_000, crystal: 5_000, deuterium: 5_000 })
      .where(eq(planets.id, g.joined.planetId));
    await setLevel(g.db, g.joined.planetId, 'CORE', MULTI_WORLD.colonyCoreThresholds[0]);
    await giveUnits(g.db, g.joined.planetId, { COURIER: MULTI_WORLD.settlement.transports });
    await g.db.update(neutralPlanetState)
      .set({ claimUntil: new Date(g.clock.now().getTime() + 30 * 60_000) })
      .where(eq(neutralPlanetState.planetId, target.world.id));

    const launched = await launchSettlement(g.db, g.joined.playerId, g.joined.planetId, target.world.id, g.clock);
    g.clock.set(launched.arriveAt);
    await tick(g.db, g.clock);

    expect(await garrisonOf(g.db, target.world.id))
      .toEqual({ COURIER: MULTI_WORLD.settlement.transports });
  });

  it('limits caretaker stand-down to a neutral capture, preserving home rows on an owned transfer', async () => {
    const g = await galaxy();
    const target = g.neutrals.find((row) => row.state.tier === 1)!.world;
    const nextAccount = await makeAccount(g.db, 'Next owner');
    const next = await joinSettled(g.db, nextAccount.id, g.season.id, g.clock);
    await g.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: target.id,
      newPlayerId: g.joined.playerId,
      expectedControllerPlayerId: null,
      now: g.clock.now(),
      protectedUntil: g.clock.now(),
    }));
    await g.db.insert(units).values({
      planetId: target.id,
      ownerPlayerId: null,
      hull: 'DART',
      location: 'home',
      count: 3,
    });

    await g.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: target.id,
      newPlayerId: next.playerId,
      expectedControllerPlayerId: g.joined.playerId,
      now: g.clock.now(),
      protectedUntil: g.clock.now(),
    }));

    const rows = await g.db.select().from(units).where(eq(units.planetId, target.id));
    expect(rows).toContainEqual(expect.objectContaining({
      hull: 'DART',
      location: 'home',
      ownerPlayerId: next.playerId,
      count: 3,
    }));
  });

  it('writes no research to the commander who takes a world', async () => {
    const { g, researchBefore } = await settle(2);
    expect(await g.db.select().from(playerResearch)).toEqual(researchBefore);
  });
});

describe('D209 colony capacity reads the capital Core', () => {
  it('opens no slot for a tall colony while the capital is short, and counts the capital thresholds once it grows', async () => {
    const g = await galaxy();
    const [colony] = g.neutrals.filter((row) => row.state.tier === 3);
    await g.db.update(planets).set({ controllerPlayerId: g.joined.playerId, kind: 'COLONY' })
      .where(eq(planets.id, colony!.world.id));
    await setLevel(g.db, colony!.world.id, 'CORE', 12);
    for (const [capitalCore, capacity] of [
      [8, 0], [9, 1], [11, 1], [12, 2], [14, 2], [15, 3],
    ] as const) {
      await setLevel(g.db, g.joined.planetId, 'CORE', capitalCore);
      expect(await colonyStanding(g.db, g.joined.playerId), `capital Core ${String(capitalCore)}`)
        .toMatchObject({ capitalCore, colonies: 1, capacity });
    }
  });

  it('refuses a settlement when only a captured world is tall enough', async () => {
    const g = await galaxy();
    const [tall, target] = g.neutrals.filter((row) => row.state.tier === 1);
    await g.db.update(planets).set({ controllerPlayerId: g.joined.playerId, kind: 'COLONY' })
      .where(eq(planets.id, tall!.world.id));
    await g.db.delete(units).where(eq(units.planetId, tall!.world.id));
    await setLevel(g.db, tall!.world.id, 'CORE', 12);
    await setLevel(g.db, g.joined.planetId, 'CORE', MULTI_WORLD.colonyCoreThresholds[1] - 1);
    await g.db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 10_000, crystal: 5_000, deuterium: 5_000 })
      .where(eq(planets.id, g.joined.planetId));
    await g.db.update(planets).set({ x: 40, y: 0, z: 0 }).where(eq(planets.id, target!.world.id));
    await giveUnits(g.db, g.joined.planetId, { COURIER: MULTI_WORLD.settlement.transports });
    await g.db.update(neutralPlanetState)
      .set({ claimUntil: new Date(g.clock.now().getTime() + 30 * 60_000) })
      .where(eq(neutralPlanetState.planetId, target!.world.id));

    await expect(launchSettlement(g.db, g.joined.playerId, g.joined.planetId, target!.world.id, g.clock))
      .rejects.toMatchObject({ code: 'COLONY_CAP' });
  });
});

describe('D209 research reads the capital Core', () => {
  let f: Fixture;
  let capital: string;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [capital, colony] = f.planetIds as [string, string, string];
    await f.db.update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    for (const id of [capital, colony]) {
      await grant(f.db, id, 400_000, 150_000);
      await f.db.update(planets).set({ deuterium: 100_000 }).where(eq(planets.id, id));
    }
  });

  it('times research funded from a taller colony by the capital Core', async () => {
    const project = RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY;
    f.clock.advance(project.availableAtMinutes + 1);
    await setLevel(f.db, capital, 'CORE', 2);
    await setLevel(f.db, colony, 'CORE', 10);

    await completeResearch(f.db, colony, 'ISOTOPE_SPECTROMETRY', f.clock);

    const [order] = await f.db.select().from(researchOrders);
    expect(order?.fundingPlanetId).toBe(colony);
    expect(order?.remainingSeconds).toBe(Math.ceil(researchMinutes(project.costAt(1), 2) * 60));
  });

  it('refuses a Core-gated project from a colony when the capital is short, and allows it when it is not', async () => {
    const project = RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL;
    const requiredCore = project.requiredCore!;
    f.clock.advance(project.availableAtMinutes + 1);
    await giveResearch(f.db, capital, 'ISOTOPE_SPECTROMETRY');
    await giveResearch(f.db, capital, 'GRAVITIC_CHARGES');
    await setLevel(f.db, capital, 'CORE', requiredCore - 1);
    await setLevel(f.db, colony, 'CORE', requiredCore);

    await expect(completeResearch(f.db, colony, 'DEATH_STAR_PROTOCOL', f.clock))
      .rejects.toMatchObject({ code: 'RESEARCH_UNAVAILABLE', params: { requiredCore } });

    await setLevel(f.db, capital, 'CORE', requiredCore);
    await setLevel(f.db, colony, 'CORE', 1);
    await expect(completeResearch(f.db, colony, 'DEATH_STAR_PROTOCOL', f.clock)).resolves.toBeDefined();
  });

  it('reports the capital Core on the research menu of every world', async () => {
    const { planetView } = await import('../src/services/planetView.js');
    await setLevel(f.db, capital, 'CORE', 4);
    await setLevel(f.db, colony, 'CORE', 9);
    const view = await f.db.transaction((tx) => planetView(tx, colony, f.clock));
    expect(view.researchCore).toBe(4);
  });
});
