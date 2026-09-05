import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DEUTERIUM, HULLS, RESEARCH_PROJECTS } from '@astera/rules';
import { atMinute } from '../src/clock.js';
import {
  battleReports,
  miningRuns,
  missions,
  planetResearch,
  playerResearch,
  planets,
  probeReports,
  researchOrders,
  scheduledEvents,
} from '../src/db/schema.js';
import { buildUnits, upgradeBuilding } from '../src/services/build.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { launchMining, visibleAsteroids } from '../src/services/mining.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { planetView } from '../src/services/planetView.js';
import { abandonResearchOrder, completeResearch } from '../src/services/research.js';
import { projectedResearchLevels } from '../src/services/researchQueue.js';
import { researchView } from '../src/services/researchState.js';
import { loadLocked } from '../src/services/planet.js';
import { EventWorker } from '../src/worker/loop.js';
import { strandedBuildCount, sweepStranded } from '../src/worker/abandon.js';
import {
  giveResearch,
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
    expect(await f.db.select().from(playerResearch)).toHaveLength(0);

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
    expect(await f.db.select().from(playerResearch)).toHaveLength(0);
  });

  it('charges once and returns exactly the same authoritative planet view as GET', async () => {
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    await grant(f.db, mine, 20_000, 4_000);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const result = await completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock);
    const get = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));

    expect(before!.crystal - after!.crystal).toBe(
      RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.costAt(1).crystal,
    );
    expect(result.planet).toEqual(get);
    expect(result.planet.research.find((p) => p.id === 'ISOTOPE_SPECTROMETRY')).toMatchObject({
      completed: false,
      available: true,
    });
    expect(result.planet.queues.CONSTRUCTION).toEqual([]);
    expect(result.planet.researchQueue).toEqual([
      expect.objectContaining({ projectId: 'ISOTOPE_SPECTROMETRY' }),
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
      RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.costAt(1).crystal,
    );
    await settleBuilds(f, mine);
    expect(await f.db.select().from(playerResearch)).toHaveLength(1);
  });

  it('discovers Dense Fuel Cells from a cargo-limited raid, keeping PvP in the loop', async () => {
    const target = f.planetIds[1]!;
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    await grant(f.db, mine, 30_000, 5_000);
    await grant(f.db, target, 100_000, 20_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { DART: 30, COURIER: 1 });
    await completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock);
    await settleBuilds(f, mine);

    const launch = await launchAttack(f.db, mine, target, { DART: 30, COURIER: 1 }, f.clock);
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
    await giveUnits(f.db, mine, { DART: 30, COURIER: 1 });
    const launch = await launchAttack(f.db, mine, target, { DART: 30, COURIER: 1 }, f.clock);
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
    expect(dense.planet.researchQueue.map((order) => order.projectId)).toEqual([
      'ISOTOPE_SPECTROMETRY',
      'DENSE_FUEL_CELLS',
    ]);
  });

  it('refuses a tier-three transport until its engineering and propulsion rungs are complete', async () => {
    await grant(f.db, mine, 30_000, 5_000);
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await expect(buildUnits(f.db, mine, 'ATLAS', 1, f.clock)).rejects.toMatchObject({
      code: 'NEEDS_HULL_RESEARCH',
    });

    await giveResearch(f.db, mine, 'STARSHIP_ENGINEERING');
    await giveResearch(f.db, mine, 'SHIP_PROPULSION', 2);
    await f.db.update(planets).set({ deuterium: HULLS.ATLAS.deuterium }).where(eq(planets.id, mine));
    await expect(buildUnits(f.db, mine, 'ATLAS', 1, f.clock)).resolves.toMatchObject({
      hull: 'ATLAS',
      built: 1,
    });
  });

  it('discovers Gravitic Charges only after an Aegis meaningfully absorbs a raid', async () => {
    const target = f.planetIds[1]!;
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    const crystalBudget = RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.costAt(1).crystal
      + RESEARCH_PROJECTS.GRAVITIC_CHARGES.costAt(1).crystal;
    await grant(f.db, mine, 30_000, crystalBudget);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { DART: 30 });
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

    const launch = await launchAttack(f.db, mine, target, { DART: 30 }, f.clock);
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
      RESEARCH_PROJECTS.GRAVITIC_CHARGES.costAt(1).crystal,
    );
    expect(resourcesBefore!.deuterium - resourcesAfter!.deuterium).toBe(
      RESEARCH_PROJECTS.GRAVITIC_CHARGES.costAt(1).deuterium,
    );
  });

  it('refuses the Nullifier until engineering and Gravitic Charges are complete', async () => {
    await grant(f.db, mine, 30_000, 5_000);
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await f.db.update(planets).set({ deuterium: 500 }).where(eq(planets.id, mine));
    await expect(buildUnits(f.db, mine, 'NULLIFIER', 1, f.clock)).rejects.toMatchObject({
      code: 'NEEDS_HULL_RESEARCH',
    });

    await giveResearch(f.db, mine, 'STARSHIP_ENGINEERING');
    await giveResearch(f.db, mine, 'GRAVITIC_CHARGES');
    const [before] = await f.db
      .select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium })
      .from(planets)
      .where(eq(planets.id, mine));
    await expect(buildUnits(f.db, mine, 'NULLIFIER', 1, f.clock)).resolves.toMatchObject({
      hull: 'NULLIFIER',
      built: 1,
    });
    const [after] = await f.db
      .select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium })
      .from(planets)
      .where(eq(planets.id, mine));
    expect(before!.alloy - after!.alloy).toBe(HULLS.NULLIFIER.alloy);
    expect(before!.crystal - after!.crystal).toBe(HULLS.NULLIFIER.crystal);
    expect(before!.deuterium - after!.deuterium).toBe(HULLS.NULLIFIER.deuterium);
  });

  it('shows an isotope anomaly when active and gates its fuel', async () => {
    const rock = f.asteroids.find((asteroid) => asteroid.isotopeRich);
    expect(rock).toBeDefined();
    const seasonStart = new Date('2026-01-01T00:00:00.000Z');
    f.clock.set(atMinute(seasonStart, rock!.appearsAt - 0.01));
    expect(await visibleAsteroids(f.db, f.seasonId, f.clock.now(), false)).not.toContainEqual(
      expect.objectContaining({ index: rock!.index }),
    );

    await giveResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY');
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

  /**
   * THE PROBE'S DEUTERIUM BAND IS NOT SOLD BY RESEARCH ANY MORE. D166 — owner
   * instruction: *"isotope_spectrometry araştırmasının sonda verisi ile olan
   * ilişkisini kes. sonda → yağmalanabilir döteryumu da default olarak göstersin."*
   *
   * THE GATE WAS ALREADY LEAKING, WHICH IS WHY IT HAD TO GO ONE WAY OR THE OTHER.
   * The report's headline `stock` band comes from `raidableStock`, which sums ALL
   * THREE resources — so a commander with no spectroscopy was reading the deuterium
   * through the total anyway, while a commander who had paid for it saw the same
   * ore twice: once inside the band and once on its own line. A gate that cannot be
   * enforced is not a gate; it is a rule the interface teaches wrongly.
   *
   * WHAT THE PROJECT STILL SELLS is unchanged and is the part that was never
   * leaking: mining an isotope anomaly at all (`NEEDS_ISOTOPE_SPECTROMETRY`), and
   * seeing which rocks are rich. Reading a world is the probe's job.
   */
  it('bands the raidable Deuterium for every commander, researched or not', async () => {
    const target = f.planetIds[1]!;
    await grant(f.db, mine, 20_000, 4_000);
    await setLevel(f.db, mine, 'SHIPYARD', 2);
    await f.db.update(planets).set({ deuterium: 3_000 }).where(eq(planets.id, target));

    const launch = await launchProbe(f.db, mine, target, f.clock);
    f.clock.set(launch.arriveAt);
    await worker(f).tick();
    const [report] = await f.db.select().from(probeReports);

    expect(report!.deuteriumStock).not.toBeNull();
    expect(report!.deuteriumStock!.low).toBeGreaterThanOrEqual(0);
    expect(report!.deuteriumStock!.high).toBeGreaterThan(report!.deuteriumStock!.low);
  });

  /**
   * AND IT IS THE RAIDABLE FIGURE, NOT THE STORE. The line sits beside a band that
   * already means "what a fleet could carry away", so a total would be the one
   * number on that screen measuring something else — the exact confusion D144 was
   * reported for on alloy and crystal.
   */
  it('bands what a raid could take rather than the whole tank', async () => {
    const target = f.planetIds[1]!;
    await grant(f.db, mine, 20_000, 4_000);
    await setLevel(f.db, mine, 'SHIPYARD', 2);
    await f.db.update(planets).set({ deuterium: 3_000 }).where(eq(planets.id, target));

    const launch = await launchProbe(f.db, mine, target, f.clock);
    f.clock.set(launch.arriveAt);
    await worker(f).tick();
    const [report] = await f.db.select().from(probeReports);

    // A DECISIVE raid takes `COMBAT.lootDecisive` of what is exposed, so the band
    // has to sit under the tank rather than on it.
    expect(report!.deuteriumStock!.high).toBeLessThan(3_000);
  });
});

/**
 * RESEARCH BELONGS TO THE COMMANDER, NOT TO A WORLD. T7.
 *
 * `planet_research` was keyed on the planet, which was tolerable while every
 * project was a one-off PERMISSION: buying Dense Fuel Cells twice bought nothing,
 * so the duplication was invisible. It stops being invisible the moment a project
 * is a MULTIPLIER — a commander with three colonies would buy the same ladder four
 * times, which is the "micromanagement grows" regression signal stated outright.
 *
 * ONE SLOT, ONE COMMANDER. A second world may not start a second project, and the
 * serialisation point is the player row rather than the planet row — two worlds
 * hold two different planet locks and would otherwise both pass the same check.
 */
describe('research is held by the commander', () => {
  let f: Fixture;
  let capital: string;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [capital, colony] = f.planetIds as [string, string, string];
    // A second world for the SAME commander: research must span both.
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    for (const id of [capital, colony]) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
      await grant(f.db, id, 400_000, 150_000);
    }
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes + 1);
  });

  const isotopeOn = async (planetId: string): Promise<void> => {
    await completeResearch(f.db, planetId, 'ISOTOPE_SPECTROMETRY', f.clock);
    await settleBuilds(f, planetId);
  };

  it('completes on one world and is complete on every world', async () => {
    await isotopeOn(capital);

    for (const id of [capital, colony]) {
      const view = await f.db.transaction((tx) => planetView(tx, id, f.clock));
      const isotope = view.research.find((project) => project.id === 'ISOTOPE_SPECTROMETRY');
      expect(isotope?.completed, `${id} should already hold it`).toBe(true);
    }
  });

  it('cannot be bought a second time from the other world', async () => {
    await isotopeOn(capital);

    await expect(
      completeResearch(f.db, colony, 'ISOTOPE_SPECTROMETRY', f.clock),
    ).rejects.toMatchObject({ code: 'RESEARCH_ALREADY_COMPLETE' });
  });

  it('uses one shared commander queue when another world funds the next project', async () => {
    await completeResearch(f.db, capital, 'ISOTOPE_SPECTROMETRY', f.clock);
    const result = await completeResearch(f.db, colony, 'DEUTERIUM_SYNTHESIS', f.clock);

    expect(result.planet.researchQueue.map((order) => order.projectId)).toEqual([
      'ISOTOPE_SPECTROMETRY',
      'DEUTERIUM_SYNTHESIS',
    ]);
    const capitalView = await f.db.transaction((tx) => planetView(tx, capital, f.clock));
    expect(capitalView.researchQueue).toEqual(result.planet.researchQueue);
    expect(result.planet.queues.CONSTRUCTION).toEqual([]);
    expect(result.planet.queues.YARD).toEqual([]);
  });

  it('names the only next move when the irreversible queue is full', async () => {
    await completeResearch(f.db, capital, 'DEUTERIUM_SYNTHESIS', f.clock);
    await completeResearch(f.db, colony, 'YARD_AUTOMATION', f.clock);
    await completeResearch(f.db, capital, 'CARGO_HOLDS', f.clock);

    await expect(completeResearch(f.db, colony, 'SHIP_POWER', f.clock))
      .rejects.toMatchObject({ code: 'RESEARCH_QUEUE_FULL' });
  });

  it('returns each system-abandoned order to the world that funded it', async () => {
    const [capitalBefore] = await f.db.select().from(planets).where(eq(planets.id, capital));
    const [colonyBefore] = await f.db.select().from(planets).where(eq(planets.id, colony));
    await completeResearch(f.db, capital, 'DEUTERIUM_SYNTHESIS', f.clock);
    await completeResearch(f.db, colony, 'DEUTERIUM_SYNTHESIS', f.clock);
    const queue = await f.db.select().from(researchOrders)
      .where(eq(researchOrders.status, 'BUILDING'))
      .orderBy(researchOrders.slot);

    await abandonResearchOrder(f.db, queue[0]!.id, f.clock);

    const [capitalAfter] = await f.db.select().from(planets).where(eq(planets.id, capital));
    const [colonyAfter] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(capitalAfter).toMatchObject({
      alloy: capitalBefore!.alloy,
      crystal: capitalBefore!.crystal,
      deuterium: capitalBefore!.deuterium,
    });
    expect(colonyAfter).toMatchObject({
      alloy: colonyBefore!.alloy,
      crystal: colonyBefore!.crystal,
      deuterium: colonyBefore!.deuterium,
    });
  });

  it('lets exactly one of two worlds win a simultaneous start', async () => {
    const results = await Promise.allSettled([
      completeResearch(f.db, capital, 'ISOTOPE_SPECTROMETRY', f.clock),
      completeResearch(f.db, colony, 'ISOTOPE_SPECTROMETRY', f.clock),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected');
    const reason: unknown = lost?.status === 'rejected' ? lost.reason : undefined;
    const code = typeof reason === 'object' && reason !== null && 'code' in reason
      ? reason.code
      : undefined;
    expect(code).toBe('RESEARCH_ALREADY_COMPLETE');
  });

  it('opens the slot again once the project lands', async () => {
    await isotopeOn(capital);
    // The frontier's second rung is discovered by a raid, not by the clock — but
    // the SLOT being free again is what this asserts, and the refusal proves it:
    // an undiscovered project is refused for discovery, never for the slot.
    await expect(
      completeResearch(f.db, colony, 'DENSE_FUEL_CELLS', f.clock),
    ).rejects.toMatchObject({ code: 'RESEARCH_NOT_DISCOVERED' });
  });

  /**
   * The discovery reads were always keyed on the ATTACKER, which is a commander —
   * so a rung opened by a raid flown from one world has to be open on the other.
   * Moving the completions to the player must not quietly re-plant that on a planet.
   */
  it('carries a rung discovered by one world to the other', async () => {
    const enemy = f.planetIds[2]!;
    await grant(f.db, enemy, 100_000, 20_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, capital, { DART: 30, COURIER: 1 });
    await isotopeOn(capital);

    // A real cargo-limited raid, flown from the CAPITAL. Nothing about it touches
    // the colony, and the rung has to be open there all the same.
    const launch = await launchAttack(f.db, capital, enemy, { DART: 30, COURIER: 1 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker(f).tick();
    expect((await f.db.select().from(battleReports))[0]).toMatchObject({ cargoLimited: true });

    const view = await f.db.transaction((tx) => planetView(tx, colony, f.clock));
    const dense = view.research.find((project) => project.id === 'DENSE_FUEL_CELLS');
    expect(dense?.discovered).toBe(true);
  });
});

/**
 * THE MOVE ITSELF, AND NOTHING A PLAYER PAID FOR MAY BE LOST IN IT. T7.
 *
 * The backfill is read off the migration file rather than restated here, so there
 * is exactly one copy of the statement and this test exercises the one that will
 * actually run against the live shard. A restatement would pass forever while the
 * real migration drifted.
 */
describe('the backfill from planet research to commander research', () => {
  let f: Fixture;

  const backfill = async (db: Fixture['db']): Promise<void> => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = readFileSync(path.join(here, '../drizzle/0038_familiar_the_hand.sql'), 'utf8');
    const statement = file.split('--> statement-breakpoint').at(-1);
    if (!statement?.includes('INSERT INTO "player_research"')) {
      throw new Error('the backfill is no longer the last statement of its migration');
    }
    await db.execute(sql.raw(statement));
  };

  beforeEach(async () => {
    f = await seedWorld(2);
  });

  it('carries every project a commander held on any of their worlds', async () => {
    const [capital, second] = f.planetIds as [string, string];
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, second));
    await f.db.insert(planetResearch).values([
      { planetId: capital, projectId: 'ISOTOPE_SPECTROMETRY', completedAt: f.clock.now() },
      // Held only on the colony: a per-world model let that happen, and the move
      // must not quietly drop it.
      { planetId: second, projectId: 'DENSE_FUEL_CELLS', completedAt: f.clock.now() },
    ]);

    await backfill(f.db);

    const rows = await f.db
      .select()
      .from(playerResearch)
      .where(eq(playerResearch.playerId, f.playerIds[0]!));
    expect(rows.map((row) => row.projectId).sort())
      .toEqual(['DENSE_FUEL_CELLS', 'ISOTOPE_SPECTROMETRY']);
    expect(rows.every((row) => row.level === 1)).toBe(true);
  });

  it('keeps the earliest completion, so the date still means when you first held it', async () => {
    const [capital, second] = f.planetIds as [string, string];
    const early = f.clock.now();
    const late = new Date(early.getTime() + 60 * 60_000);
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, second));
    await f.db.insert(planetResearch).values([
      { planetId: second, projectId: 'ISOTOPE_SPECTROMETRY', completedAt: late },
      { planetId: capital, projectId: 'ISOTOPE_SPECTROMETRY', completedAt: early },
    ]);

    await backfill(f.db);

    const [row] = await f.db
      .select()
      .from(playerResearch)
      .where(eq(playerResearch.playerId, f.playerIds[0]!));
    expect(row?.completedAt).toEqual(early);
  });

  /** Run twice by a retried deploy, it must not throw and must not double up. */
  it('is idempotent', async () => {
    await f.db.insert(planetResearch).values({
      planetId: f.planetIds[0]!,
      projectId: 'ISOTOPE_SPECTROMETRY',
      completedAt: f.clock.now(),
    });

    await backfill(f.db);
    await backfill(f.db);

    expect(await f.db.select().from(playerResearch)).toHaveLength(1);
  });

  /**
   * A caretaker world has no commander, so there is nobody to carry its rows to.
   * The join has to drop them rather than fail on a null key.
   */
  it('ignores research sitting on a world nobody controls', async () => {
    const orphan = f.planetIds[1]!;
    // A world with no controller must also declare itself NEUTRAL — the table's
    // own check constraint says the two move together.
    await f.db
      .update(planets)
      .set({ controllerPlayerId: null, kind: 'NEUTRAL' })
      .where(eq(planets.id, orphan));
    await f.db.insert(planetResearch).values({
      planetId: orphan,
      projectId: 'GRAVITIC_CHARGES',
      completedAt: f.clock.now(),
    });

    await backfill(f.db);

    expect(await f.db.select().from(playerResearch)).toHaveLength(0);
  });

  /** The source is left intact, so a rolled-back deploy still has what it copied. */
  it('leaves the old table exactly as it found it', async () => {
    await f.db.insert(planetResearch).values({
      planetId: f.planetIds[0]!,
      projectId: 'ISOTOPE_SPECTROMETRY',
      completedAt: f.clock.now(),
    });

    await backfill(f.db);

    expect(await f.db.select().from(planetResearch)).toHaveLength(1);
  });
});

/**
 * THE FUEL CHAIN'S FIRST LINK. T5.
 *
 * Deuterium existed only on isotope rocks, only after the season's thirty-fifth
 * hour, and only for whoever got there first — the MEDIAN commander ends a
 * fourteen-day season holding ten of it. The Refinery is the guaranteed trickle
 * that makes it plannable, and its ceiling is a research rung: the Command Core's
 * rule said a second time, so there is nothing new to learn.
 */
describe('the deuterium refinery', () => {
  let f: Fixture;
  let mine: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    mine = f.planetIds[0]!;
    await setLevel(f.db, mine, 'CORE', 12);
    await grant(f.db, mine, 400_000, 150_000);
  });

  it('cannot be raised at all without the research', async () => {
    await expect(
      upgradeBuilding(f.db, mine, 'DEUTERIUM_PLANT', f.clock),
    ).rejects.toMatchObject({ code: 'RESEARCH_CEILING', params: { rung: 0, ceiling: 0 } });
  });

  it('opens exactly three levels per rung, and stops at the fourth', async () => {
    await giveResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', 1);

    for (let level = 0; level < DEUTERIUM.plantLevelsPerResearch; level++) {
      await upgradeBuilding(f.db, mine, 'DEUTERIUM_PLANT', f.clock);
      await settleBuilds(f, mine);
    }
    await expect(
      upgradeBuilding(f.db, mine, 'DEUTERIUM_PLANT', f.clock),
    ).rejects.toMatchObject({
      code: 'RESEARCH_CEILING',
      params: { rung: 1, ceiling: DEUTERIUM.plantLevelsPerResearch },
    });

    // The next rung opens three more, and nothing else had to change.
    await giveResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', 2);
    await expect(upgradeBuilding(f.db, mine, 'DEUTERIUM_PLANT', f.clock)).resolves.toBeTruthy();
  });

  /** The first rung is reachable on day one — the fuel chain cannot wait for an act. */
  it('offers its first rung from the opening minute, for no deuterium', async () => {
    const view = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    const synthesis = view.research.find((project) => project.id === 'DEUTERIUM_SYNTHESIS');
    expect(synthesis).toMatchObject({ discovered: true, available: true, level: 0 });
    expect(synthesis?.cost.deuterium).toBe(0);
    await expect(
      completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock),
    ).resolves.toBeTruthy();
  });

  it('is a ladder: the second rung is offered once the first lands', async () => {
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);
    await settleBuilds(f, mine);

    const view = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    const synthesis = view.research.find((project) => project.id === 'DEUTERIUM_SYNTHESIS');
    expect(synthesis).toMatchObject({ level: 1, completed: false, available: true });
    expect(synthesis?.cost.alloy).toBeGreaterThan(
      RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.costAt(1).alloy,
    );
  });

  /**
   * The whole point of the building: a world that could never produce deuterium
   * now produces it into the works, under the collector ceiling, like everything
   * else. The vault floor follows from the same rate without a special case.
   */
  it('fills the works, and gives the vault a deuterium floor to protect', async () => {
    await giveResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', 2);
    await setLevel(f.db, mine, 'DEUTERIUM_PLANT', 6);
    await setLevel(f.db, mine, 'VAULT', 5);

    const before = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    expect(before.planet.vaultCapacity.deuterium).toBeGreaterThan(0);

    f.clock.advance(120);
    const after = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    expect(after.planet.bufferDeuterium).toBeGreaterThan(before.planet.bufferDeuterium);
    expect(after.planet.deuteriumCap).toBeGreaterThan(0);
  });

  it('leaves a world with no plant exactly as it was', async () => {
    const before = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    f.clock.advance(60 * 24);
    const after = await f.db.transaction((tx) => planetView(tx, mine, f.clock));

    expect(after.planet.bufferDeuterium).toBe(before.planet.bufferDeuterium);
    expect(after.planet.vaultCapacity.deuterium).toBe(0);
  });
});

/**
 * DOCTRINES: WHOSE, AND WHEN. T9.
 *
 * The attacker's ladders are frozen when they COMMIT; the defender's are read at
 * the fight. That is the mirror of the rule the radar already obeys from the other
 * side, and between them they say one thing: every figure belongs to the moment
 * its own decision was made.
 *
 * AND THEY HAVE TO BE VISIBLE. A 25% multiplier nobody can see silently eats the
 * value of every scouting flight, which D124 forbids outright — so a probe brings
 * them home, frozen at the look like the rest of the silhouette.
 */
describe('weapon doctrines', () => {
  let f: Fixture;
  let mine: string;
  let enemy: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, enemy] = f.planetIds as [string, string];
    await setLevel(f.db, mine, 'CORE', 8);
    await grant(f.db, mine, 200_000, 60_000);
    await grant(f.db, enemy, 40_000, 8_000);
    await levelWorld(f.db, f.planetIds);
    f.clock.advance(250);
  });

  it('freezes the attacker’s ladders onto the mission at launch', async () => {
    await giveResearch(f.db, mine, 'SHIP_POWER', 3);
    await giveUnits(f.db, mine, { DART: 20 });

    const launched = await launchAttack(f.db, mine, enemy, { DART: 20 }, f.clock);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(mission?.tech).toMatchObject({ SHIP_POWER: 3 });

    // Finishing a rung mid-flight must not change a battle already committed to.
    await giveResearch(f.db, mine, 'SHIP_POWER', 5);
    const [again] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(again?.tech).toMatchObject({ SHIP_POWER: 3 });
  });

  it('carries no ladders at all for a commander who has researched none', async () => {
    await giveUnits(f.db, mine, { DART: 20 });
    const launched = await launchAttack(f.db, mine, enemy, { DART: 20 }, f.clock);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(mission?.tech).toEqual({});
  });

  it('brings the target’s doctrines home on a probe, and only a probe', async () => {
    await giveResearch(f.db, enemy, 'SHIP_ARMOR', 2);
    await giveResearch(f.db, enemy, 'CARGO_HOLDS', 4);
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);

    const probe = await launchProbe(f.db, mine, enemy, f.clock);
    f.clock.set(probe.arriveAt);
    await worker(f).tick();
    f.clock.advance(600);
    await worker(f).tick();

    const [report] = await f.db.select().from(probeReports);
    expect(report?.silhouette?.doctrines).toMatchObject({ SHIP_ARMOR: 2 });
    // Only what changes a battle is published; the economy ladders stay private.
    expect(report?.silhouette?.doctrines).not.toHaveProperty('CARGO_HOLDS');
  });
});

/**
 * A CAPTURED WORLD DOES NOT HAND OVER ITS OWNER'S RESEARCH. T7.
 *
 * A research order belongs to its commander; the selected world only funded it.
 * Capturing that world must therefore neither cancel the project nor hand it to
 * the captor.
 */
describe('capturing a world that was researching', () => {
  let f: Fixture;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[1]!;
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 8);
    await grant(f.db, colony, 400_000, 150_000);
  });

  it('keeps the project with its commander after the funding world is captured', async () => {
    await completeResearch(f.db, colony, 'DEUTERIUM_SYNTHESIS', f.clock);
    const queued = await f.db
      .select()
      .from(researchOrders)
      .where(and(
        eq(researchOrders.fundingPlanetId, colony),
        eq(researchOrders.status, 'BUILDING'),
      ));
    expect(queued).toHaveLength(1);

    await f.db.transaction((tx) =>
      transferPlanetControl(tx, {
        targetPlanetId: colony,
        newPlayerId: f.playerIds[1]!,
        expectedControllerPlayerId: f.playerIds[0]!,
        now: f.clock.now(),
        protectedUntil: f.clock.now(),
      }),
    );

    const after = await f.db
      .select()
      .from(researchOrders)
      .where(eq(researchOrders.fundingPlanetId, colony));
    expect(after.map((row) => row.status)).toEqual(['BUILDING']);

    await settleBuilds(f, colony);
    const [held] = await f.db.select().from(playerResearch);
    expect(held).toMatchObject({
      playerId: f.playerIds[0],
      projectId: 'DEUTERIUM_SYNTHESIS',
      level: 1,
    });
  });
});

/**
 * WHAT A COMMANDER MAY RESEARCH ON DAY ONE, AND WHY IT WAS NOT WHAT IT SAID.
 *
 * `discoveredWith` was written when there were four projects, all of them Frontier
 * content, and its last branch is the Death Star Protocol's rule: Gravitic Charges
 * held, and the War act open. It is a fall-through, so every id added to the enum
 * after it inherited that rule silently — all three economy ladders, all five
 * doctrines, and both strategic projects.
 *
 * Their own declarations say the opposite. `economyLadder` and `weaponLadder` both
 * write `availableAtMinutes: 0` and `prerequisite: null`, T8's docblock says "open
 * from the first minute like the refinery: they are not Frontier content", and T9
 * says the same. Ten of the fifteen projects were locked behind a chain nobody
 * designed them to be behind.
 *
 * NOTHING WENT RED, and the reason is worth recording. T8 and T9 tested their
 * EFFECTS against `RESEARCH_PROJECTS` directly; the only tests that go through
 * `researchView` are the Frontier ones above, which are unaffected. The web panel's
 * fixtures build their own rows with `discovered: true`, so they asserted a shape
 * the server never sends. The fixture lied in the same direction as the assumption.
 */
describe('what is open from the first minute', () => {
  let f: Fixture;
  let mine: string;

  const view = async () => f.db.transaction(async (tx) => {
    const planet = await loadLocked(tx, mine, f.clock);
    return researchView(tx, planet);
  });
  const stateOf = async (id: string) => (await view()).find((row) => row.id === id)!;

  beforeEach(async () => {
    f = await seedWorld();
    [mine] = f.planetIds as [string];
    await setLevel(f.db, mine, 'CORE', 12);
    await grant(f.db, mine, 5_000_000, 5_000_000);
    await f.db.update(planets).set({ deuterium: 500_000 }).where(eq(planets.id, mine));
  });

  it('opens every economy ladder to a brand new commander', async () => {
    for (const id of ['DEUTERIUM_SYNTHESIS', 'YARD_AUTOMATION', 'PROSPECTOR_HOLDS',
      'CARGO_HOLDS'] as const) {
      const state = await stateOf(id);
      expect(state.discovered, id).toBe(true);
      expect(state.available, id).toBe(true);
    }
  });

  it('opens engineering and emplacement research from the first minute', async () => {
    for (const id of ['STARSHIP_ENGINEERING', 'EMPLACEMENT_DOCTRINE'] as const) {
      const state = await stateOf(id);
      expect(state.discovered, id).toBe(true);
      expect(state.available, id).toBe(true);
    }
  });

  it('shows stat ladders immediately but keeps them behind their prerequisites', async () => {
    for (const id of ['SHIP_POWER', 'SHIP_ARMOR', 'SHIP_PROPULSION'] as const) {
      const state = await stateOf(id);
      expect(state.discovered, id).toBe(true);
      expect(state.available, id).toBe(false);
    }
  });

  it('actually lets one be bought', async () => {
    await expect(completeResearch(f.db, mine, 'CARGO_HOLDS', f.clock)).resolves.toBeTruthy();
  });

  /** The Frontier four are unchanged: they are still found rather than opened. */
  it('leaves the Frontier chain exactly where it was', async () => {
    for (const id of ['ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES',
      'DEATH_STAR_PROTOCOL'] as const) {
      expect((await stateOf(id)).discovered, id).toBe(false);
    }
  });

  /**
   * THE STRATEGIC PAIR IS DISCOVERED AND STILL SHUT, which is a different sentence
   * from "not discovered" and the one the card has to be able to say. Their own
   * `prerequisite` and `availableAtMinutes` do the gating; discovery is a Frontier
   * concept and they are not Frontier content.
   */
  it('discovers the strategic pair but keeps the War act in front of them', async () => {
    for (const id of ['INTERCEPTION_GRID', 'STRATEGIC_STOCKPILE'] as const) {
      const state = await stateOf(id);
      expect(state.discovered, id).toBe(true);
      expect(state.available, id).toBe(false);
    }
  });

  it('keeps the stockpile behind the weapon it stockpiles', async () => {
    expect(RESEARCH_PROJECTS.STRATEGIC_STOCKPILE.prerequisite).toBe('DEATH_STAR_PROTOCOL');
    expect((await stateOf('STRATEGIC_STOCKPILE')).available).toBe(false);
  });
});

/**
 * WHY A SHUT PROJECT IS SHUT, AS DATA RATHER THAN AS A GUESS. Live-shard report.
 *
 * A commander could not order the Interception Grid, and the card told them it was
 * researchable "in 0m" — a sentence about an act clock that had run out two days
 * earlier. The real refusal was the prerequisite: Gravitic Charges was not held.
 * The card had no way to say so, because `researchView` computed both prerequisite
 * gates and then published NEITHER of them, leaving the screen to guess from the
 * only gate it could see.
 *
 * FIVE PROJECTS STAND BEHIND A PREREQUISITE AND OUTSIDE THE FRONTIER'S DISCOVERY
 * RULE, so `discovered` is true for every one of them and cannot carry the reason:
 * the three Fleet V2 stat ladders and the two strategic projects. Publishing the
 * gate is what lets the card name the door instead of inventing a clock.
 */
describe('the reason a shut project is shut', () => {
  let f: Fixture;
  let mine: string;

  const view = async () => f.db.transaction(async (tx) => {
    const planet = await loadLocked(tx, mine, f.clock);
    return researchView(tx, planet);
  });
  const stateOf = async (id: string) => (await view()).find((row) => row.id === id)!;

  /** Every project whose only gate is a project, never the season clock. */
  const BEHIND_A_PROJECT = [
    'SHIP_POWER', 'SHIP_ARMOR', 'SHIP_PROPULSION',
    'INTERCEPTION_GRID', 'STRATEGIC_STOCKPILE',
  ] as const;

  beforeEach(async () => {
    f = await seedWorld();
    [mine] = f.planetIds as [string];
    await setLevel(f.db, mine, 'CORE', 12);
    await grant(f.db, mine, 5_000_000, 5_000_000);
    await f.db.update(planets).set({ deuterium: 500_000 }).where(eq(planets.id, mine));
  });

  it('publishes an unmet prerequisite on every project that stands behind one', async () => {
    for (const id of BEHIND_A_PROJECT) {
      const state = await stateOf(id);
      expect(state.discovered, id).toBe(true);
      expect(state.available, id).toBe(false);
      expect(state.prerequisiteMet, id).toBe(false);
      expect(state.queuePrerequisiteMet, id).toBe(false);
    }
  });

  it('reports a prerequisite met once it is held', async () => {
    await giveResearch(f.db, mine, 'STARSHIP_ENGINEERING');
    const state = await stateOf('SHIP_POWER');
    expect(state.prerequisiteMet).toBe(true);
    expect(state.queuePrerequisiteMet).toBe(true);
    expect(state.available).toBe(true);
  });

  /**
   * The queue gate counts what is PAID FOR, the durable one what has LANDED — and
   * the projection only exists on the served view, so this asks the payload the
   * client actually parses rather than the raw helper.
   */
  it('separates a queued prerequisite from a held one', async () => {
    await completeResearch(f.db, mine, 'STARSHIP_ENGINEERING', f.clock);
    const served = await planetView(f.db, mine, f.clock);
    const state = served.research.find((row) => row.id === 'SHIP_POWER')!;
    expect(state.prerequisiteMet).toBe(false);
    expect(state.queuePrerequisiteMet).toBe(true);
  });

  it('leaves a project with no prerequisite met by definition', async () => {
    expect(RESEARCH_PROJECTS.EMPLACEMENT_DOCTRINE.prerequisite).toBeNull();
    const state = await stateOf('EMPLACEMENT_DOCTRINE');
    expect(state.prerequisiteMet).toBe(true);
    expect(state.queuePrerequisiteMet).toBe(true);
  });
});

/**
 * A RUNG IS PRICED AND STAMPED FROM THE QUEUE, NOT FROM WHAT IS HELD.
 *
 * `completeResearch` computed `level = state.level + 1` off the HELD level while
 * `queueAvailable` was computed off the QUEUED one. Queue the same ladder twice on
 * one world and both orders were stamped `count: 1` at rung one's price — and the
 * completion writes `GREATEST(level, count)`, so the second order bought nothing.
 * Measured: 680 alloy taken twice, ending at level 1.
 *
 * The client had already been corrected the other way (`predictResearch` prices
 * `queued + 1`), so the prediction and the authority disagreed — and the authority
 * was the one that was wrong.
 */
describe('queueing two rungs of one ladder', () => {
  let f: Fixture;
  let mine: string;

  beforeEach(async () => {
    f = await seedWorld();
    [mine] = f.planetIds as [string];
    await setLevel(f.db, mine, 'CORE', 12);
    await grant(f.db, mine, 5_000_000, 5_000_000);
    await f.db.update(planets).set({ deuterium: 500_000 }).where(eq(planets.id, mine));
  });

  // Live orders only: a cancelled one keeps its row, marked CANCELLED.
  const orders = async () => f.db.select().from(researchOrders)
    .where(and(
      eq(researchOrders.fundingPlanetId, mine),
      eq(researchOrders.status, 'BUILDING'),
    ));

  it('stamps the second order with the second rung', async () => {
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);

    expect((await orders()).map((row) => row.level).sort()).toEqual([1, 2]);
  });

  it('charges the second rung its own price', async () => {
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);
    const [mid] = await f.db.select().from(planets).where(eq(planets.id, mine));
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));

    expect(before!.alloy - mid!.alloy)
      .toBe(RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.costAt(1).alloy);
    expect(mid!.alloy - after!.alloy)
      .toBe(RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.costAt(2).alloy);
  });

  it('delivers both rungs when both complete', async () => {
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);
    for (let step = 0; step < 8; step++) {
      f.clock.advance(180);
      await worker(f).tick();
    }

    const [held] = await f.db.select().from(playerResearch)
      .where(eq(playerResearch.projectId, 'DEUTERIUM_SYNTHESIS'));
    expect(held?.level).toBe(2);
  });

  it('quotes the queued rung, so the screen and the charge agree', async () => {
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);
    const state = await f.db.transaction(async (tx) => {
      const planet = await loadLocked(tx, mine, f.clock);
      const projected = await projectedResearchLevels(tx, planet.playerId);
      return (await researchView(tx, planet, projected))
        .find((row) => row.id === 'DEUTERIUM_SYNTHESIS')!;
    });

    expect(state.cost).toEqual(RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.costAt(2));
  });

  it('refuses a rung past the ceiling however it is reached', async () => {
    await giveResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.maxLevel);

    await expect(completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock))
      .rejects.toMatchObject({ code: 'RESEARCH_ALREADY_COMPLETE' });
  });

  it('refuses a queued rung that would pass the ceiling', async () => {
    const top = RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.maxLevel;
    await giveResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', top - 1);
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);

    await expect(completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock))
      .rejects.toMatchObject({ code: 'RESEARCH_ALREADY_COMPLETE' });
  });

});

describe('research queue recovery', () => {
  let f: Fixture;
  let mine: string;

  beforeEach(async () => {
    f = await seedWorld();
    [mine] = f.planetIds as [string];
    await setLevel(f.db, mine, 'CORE', 12);
    await grant(f.db, mine, 5_000_000, 5_000_000);
    await f.db.update(planets).set({ deuterium: 500_000 }).where(eq(planets.id, mine));
  });

  it('detects and fully refunds overdue research whose event disappeared', async () => {
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    await completeResearch(f.db, mine, 'DEUTERIUM_SYNTHESIS', f.clock);
    const [order] = await f.db.select().from(researchOrders);
    await f.db.delete(scheduledEvents).where(eq(scheduledEvents.refId, order!.id));
    f.clock.set(new Date(order!.readyAt.getTime() + 6 * 60_000));

    expect(await strandedBuildCount(f.db, f.clock.now())).toBe(1);
    expect(await sweepStranded(f.db, f.clock)).toBe(1);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after).toMatchObject({ alloy: before!.alloy, crystal: before!.crystal });
    expect((await f.db.select().from(researchOrders))[0]?.status).toBe('FAILED');
  });
});
