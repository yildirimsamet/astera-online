import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HULLS, RESEARCH_PROJECTS } from '@astera/rules';
import { atMinute } from '../src/clock.js';
import {
  battleReports,
  miningRuns,
  planetResearch,
  planets,
  probeReports,
} from '../src/db/schema.js';
import { buildUnits } from '../src/services/build.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { launchMining, visibleAsteroids } from '../src/services/mining.js';
import { planetView } from '../src/services/planetView.js';
import { completeResearch } from '../src/services/research.js';
import { researchView } from '../src/services/researchState.js';
import { loadLocked } from '../src/services/planet.js';
import { galaxyOf } from '../src/services/season.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveUnits,
  giveInstrument,
  grant,
  levelWorld,
  seedWorld,
  settleBuilds,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const worker = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the seasonal frontier', () => {
  let f: Fixture;
  let mine: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    mine = f.planetIds[0]!;
  });

  it('reveals spectroscopy from the shared clock, with no timer or stored discovery row', async () => {
    const before = await f.db.transaction(async (tx) => {
      const planet = await loadLocked(tx, mine, f.clock);
      return researchView(tx, planet);
    });
    expect(before.find((p) => p.id === 'ISOTOPE_SPECTROMETRY')).toMatchObject({
      discovered: false,
      available: false,
      completed: false,
    });
    expect(await f.db.select().from(planetResearch)).toHaveLength(0);

    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    const after = await f.db.transaction(async (tx) => {
      const planet = await loadLocked(tx, mine, f.clock);
      return researchView(tx, planet);
    });
    expect(after.find((p) => p.id === 'ISOTOPE_SPECTROMETRY')).toMatchObject({
      discovered: true,
      available: true,
      completed: false,
    });
    expect(await f.db.select().from(planetResearch)).toHaveLength(0);
  });

  it('charges once and returns exactly the same authoritative planet view as GET', async () => {
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    await grant(f.db, mine, 20_000, 4_000);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const result = await completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock);
    const get = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));

    expect(before!.crystal - after!.crystal).toBe(
      RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.cost.crystal,
    );
    expect(result.planet).toEqual(get);
    expect(result.planet.research.find((p) => p.id === 'ISOTOPE_SPECTROMETRY')).toMatchObject({
      completed: false,
      available: true,
    });
    expect(result.planet.queues.CONSTRUCTION).toEqual([
      expect.objectContaining({ kind: 'RESEARCH', subject: 'ISOTOPE_SPECTROMETRY' }),
    ]);
    await settleBuilds(f, mine);
    const completed = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    expect(completed.research.find((p) => p.id === 'ISOTOPE_SPECTROMETRY')).toMatchObject({
      completed: true,
      available: false,
    });
  });

  it('serialises racing taps so the project cannot be paid twice', async () => {
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    await grant(f.db, mine, 20_000, 4_000);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const attempts = await Promise.allSettled([
      completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock),
      completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock),
    ]);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(before!.crystal - after!.crystal).toBe(
      RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.cost.crystal,
    );
    await settleBuilds(f, mine);
    expect(await f.db.select().from(planetResearch)).toHaveLength(1);
  });

  it('discovers Dense Fuel Cells from a cargo-limited raid, keeping PvP in the loop', async () => {
    const target = f.planetIds[1]!;
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    await grant(f.db, mine, 30_000, 5_000);
    await grant(f.db, target, 100_000, 20_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { WASP: 30, HAULER: 1 });
    await completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock);
    await settleBuilds(f, mine);

    const launch = await launchAttack(f.db, mine, target, { WASP: 30, HAULER: 1 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker(f).tick();

    const [report] = await f.db.select().from(battleReports);
    expect(report).toMatchObject({ cargoLimited: true });
    const state = await f.db.transaction(async (tx) => {
      const planet = await loadLocked(tx, mine, f.clock);
      return researchView(tx, planet);
    });
    expect(state.find((p) => p.id === 'DENSE_FUEL_CELLS')).toMatchObject({
      discovered: true,
      available: true,
      completed: false,
    });
  });

  it('exposes and accepts a discovered project behind its queued prerequisite', async () => {
    const target = f.planetIds[1]!;
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    await grant(f.db, mine, 30_000, 5_000);
    await grant(f.db, target, 100_000, 20_000);
    await f.db.update(planets).set({ deuterium: 1_000 }).where(eq(planets.id, mine));
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { WASP: 30, HAULER: 1 });
    const launch = await launchAttack(f.db, mine, target, { WASP: 30, HAULER: 1 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker(f).tick();
    expect((await f.db.select().from(battleReports))[0]).toMatchObject({ cargoLimited: true });

    const isotope = await completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock);
    expect(isotope.planet.research.find((project) => project.id === 'DENSE_FUEL_CELLS'))
      .toMatchObject({
        discovered: false,
        available: false,
        queueDiscovered: true,
        queueAvailable: true,
      });

    const dense = await completeResearch(f.db, mine, 'DENSE_FUEL_CELLS', f.clock);
    expect(dense.planet.queues.CONSTRUCTION.map((order) => order.subject)).toEqual([
      'ISOTOPE_SPECTROMETRY',
      'DENSE_FUEL_CELLS',
    ]);
  });

  it('refuses Runner until Dense Fuel Cells is complete', async () => {
    await grant(f.db, mine, 30_000, 5_000);
    await setLevel(f.db, mine, 'SHIPYARD', 2);
    await expect(buildUnits(f.db, mine, 'RUNNER', 1, f.clock)).rejects.toMatchObject({
      code: 'NEEDS_DENSE_FUEL_CELLS',
    });

    await f.db.insert(planetResearch).values([
      { planetId: mine, projectId: 'ISOTOPE_SPECTROMETRY', completedAt: f.clock.now() },
      { planetId: mine, projectId: 'DENSE_FUEL_CELLS', completedAt: f.clock.now() },
    ]);
    await f.db.update(planets).set({ deuterium: 100 }).where(eq(planets.id, mine));
    await expect(buildUnits(f.db, mine, 'RUNNER', 1, f.clock)).resolves.toMatchObject({
      hull: 'RUNNER',
      built: 1,
    });
  });

  it('discovers Gravitic Charges only after an Aegis meaningfully absorbs a raid', async () => {
    const target = f.planetIds[1]!;
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    await grant(f.db, mine, 30_000, 5_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { WASP: 30 });
    await giveUnits(f.db, target, { BASTION: 3 });
    await giveInstrument(f.db, target, 'AEGIS', 10);
    await f.db.update(planets).set({ shield: 1_000 }).where(eq(planets.id, target));
    await completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock);
    await settleBuilds(f, mine);

    const before = await f.db.transaction(async (tx) => {
      const planet = await loadLocked(tx, mine, f.clock);
      return researchView(tx, planet);
    });
    expect(before.find((p) => p.id === 'GRAVITIC_CHARGES')).toMatchObject({
      discovered: false,
      available: false,
    });

    const launch = await launchAttack(f.db, mine, target, { WASP: 30 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker(f).tick();

    const [report] = await f.db.select().from(battleReports);
    const normalDamage = report!.rounds.reduce((sum, round) => sum + round.attackerDamage, 0);
    expect(report!.shieldAbsorbed / normalDamage).toBeGreaterThanOrEqual(0.25);
    const after = await f.db.transaction(async (tx) => {
      const planet = await loadLocked(tx, mine, f.clock);
      return researchView(tx, planet);
    });
    expect(after.find((p) => p.id === 'GRAVITIC_CHARGES')).toMatchObject({
      discovered: true,
      available: true,
      completed: false,
    });

    await f.db.update(planets).set({ deuterium: 1_000 }).where(eq(planets.id, mine));
    const [resourcesBefore] = await f.db
      .select({ crystal: planets.crystal, deuterium: planets.deuterium })
      .from(planets)
      .where(eq(planets.id, mine));
    await completeResearch(f.db, mine, 'GRAVITIC_CHARGES', f.clock);
    const [resourcesAfter] = await f.db
      .select({ crystal: planets.crystal, deuterium: planets.deuterium })
      .from(planets)
      .where(eq(planets.id, mine));
    expect(resourcesBefore!.crystal - resourcesAfter!.crystal).toBe(
      RESEARCH_PROJECTS.GRAVITIC_CHARGES.cost.crystal,
    );
    expect(resourcesBefore!.deuterium - resourcesAfter!.deuterium).toBe(
      RESEARCH_PROJECTS.GRAVITIC_CHARGES.cost.deuterium,
    );
  });

  it('refuses Breacher until Gravitic Charges is complete', async () => {
    await grant(f.db, mine, 30_000, 5_000);
    await setLevel(f.db, mine, 'SHIPYARD', 3);
    await f.db.update(planets).set({ deuterium: 500 }).where(eq(planets.id, mine));
    await expect(buildUnits(f.db, mine, 'BREACHER', 1, f.clock)).rejects.toMatchObject({
      code: 'NEEDS_GRAVITIC_CHARGES',
    });

    await f.db.insert(planetResearch).values([
      { planetId: mine, projectId: 'ISOTOPE_SPECTROMETRY', completedAt: f.clock.now() },
      { planetId: mine, projectId: 'GRAVITIC_CHARGES', completedAt: f.clock.now() },
    ]);
    const [before] = await f.db
      .select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium })
      .from(planets)
      .where(eq(planets.id, mine));
    await expect(buildUnits(f.db, mine, 'BREACHER', 1, f.clock)).resolves.toMatchObject({
      hull: 'BREACHER',
      built: 1,
    });
    const [after] = await f.db
      .select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium })
      .from(planets)
      .where(eq(planets.id, mine));
    expect(before!.alloy - after!.alloy).toBe(HULLS.BREACHER.alloy);
    expect(before!.crystal - after!.crystal).toBe(HULLS.BREACHER.crystal);
    expect(before!.deuterium - after!.deuterium).toBe(HULLS.BREACHER.deuterium);
  });

  it('shows an isotope anomaly when active and gates its fuel', async () => {
    const rock = galaxyOf(f.seasonId, 4242).asteroids.find((asteroid) => asteroid.isotopeRich);
    expect(rock).toBeDefined();
    const seasonStart = new Date('2026-01-01T00:00:00.000Z');
    f.clock.set(atMinute(seasonStart, rock!.appearsAt - 0.01));
    expect(await visibleAsteroids(f.db, f.seasonId, f.clock.now(), false)).not.toContainEqual(
      expect.objectContaining({ index: rock!.index }),
    );

    await f.db.insert(planetResearch).values({
      planetId: mine,
      projectId: 'ISOTOPE_SPECTROMETRY',
      completedAt: f.clock.now(),
    });
    f.clock.set(atMinute(seasonStart, rock!.appearsAt + 0.01));
    const visible = await visibleAsteroids(f.db, f.seasonId, f.clock.now(), true);
    expect(visible.find((asteroid) => asteroid.index === rock!.index)).toMatchObject({
      active: true,
      isotopeRich: true,
      deuteriumShare: rock!.deuteriumShare,
    });

    const unresearched = f.planetIds[1]!;
    await giveUnits(f.db, mine, { PROSPECTOR: 1 });
    await giveUnits(f.db, unresearched, { PROSPECTOR: 1 });
    await expect(
      launchMining(f.db, unresearched, rock!.index, 1, f.clock),
    ).rejects.toMatchObject({ code: 'NEEDS_ISOTOPE_SPECTROMETRY' });

    const launch = await launchMining(f.db, mine, rock!.index, 1, f.clock);
    f.clock.set(launch.arriveAt);
    await worker(f).tick();
    const [run] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, launch.runId));
    expect(run!.minedDeuterium).toBeGreaterThan(0);
  });

  it('keeps the Deuterium probe band hidden without spectroscopy', async () => {
    const target = f.planetIds[1]!;
    await grant(f.db, mine, 20_000, 4_000);
    await setLevel(f.db, mine, 'SHIPYARD', 2);
    await f.db.update(planets).set({ deuterium: 300 }).where(eq(planets.id, target));

    const launch = await launchProbe(f.db, mine, target, f.clock);
    f.clock.set(launch.arriveAt);
    await worker(f).tick();
    const [report] = await f.db.select().from(probeReports);

    expect(report!.deuteriumStock).toBeNull();
  });

  it('adds a banded Deuterium reading to probes after spectroscopy', async () => {
    const target = f.planetIds[1]!;
    await grant(f.db, mine, 20_000, 4_000);
    await setLevel(f.db, mine, 'SHIPYARD', 2);
    await f.db.update(planets).set({ deuterium: 300 }).where(eq(planets.id, target));
    await f.db.insert(planetResearch).values({
      planetId: mine,
      projectId: 'ISOTOPE_SPECTROMETRY',
      completedAt: f.clock.now(),
    });

    const launch = await launchProbe(f.db, mine, target, f.clock);
    f.clock.set(launch.arriveAt);
    await worker(f).tick();
    const [report] = await f.db.select().from(probeReports);

    expect(report!.deuteriumStock).not.toBeNull();
    expect(report!.deuteriumStock!.low).toBeGreaterThanOrEqual(0);
    expect(report!.deuteriumStock!.high).toBeGreaterThan(report!.deuteriumStock!.low);
  });
});
