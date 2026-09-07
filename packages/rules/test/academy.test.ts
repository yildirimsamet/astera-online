import { describe, expect, it } from 'vitest';
import { ACADEMY_STEPS, academyCheckpoint, TUTORIAL_EXIT, academyRaidBattle, academyRaidLoot, academyPirateLoot, academyMinedOre, ACADEMY_FLIGHT_DISTANCE, academyOrderSeconds } from '../src/academy.js';
import { PLANET_START, START_BUILDINGS } from '../src/constants.js';
import { hangarCapacity, hangarLoad } from '../src/index.js';
import { academyExitCheckpoint, academyLessonFleet, academyPirateHomecoming, academyPirateBattle } from '../src/academy.js';

describe('the authored Academy boundary', () => {
  it('leaves paid work after any early skip without awarding unfinished lessons', () => {
    for (let step = 0; step <= ACADEMY_STEPS.length; step++) {
      const taught = academyCheckpoint(step);
      const exit = academyExitCheckpoint(step);
      expect(exit.buildings).toEqual(taught.buildings);
      expect(exit.fleet).toEqual(taught.fleet);
      expect(exit.claimedRewards).toEqual(taught.claimedRewards);
      expect(exit.queue).not.toBeNull();
      expect(exit.queue!.seconds).toBeGreaterThan(60);
      expect(Object.values(exit.resources).every((n) => n >= 0)).toBe(true);
    }
    expect(academyExitCheckpoint(ACADEMY_STEPS.length)).toEqual(TUTORIAL_EXIT);
  });
  it('separates visible targets and caps only Academy order clocks', () => {
    expect(ACADEMY_FLIGHT_DISTANCE).toBeGreaterThan(50);
    expect(academyOrderSeconds(20)).toBe(8);
    expect(academyOrderSeconds(0)).toBe(1);
  });
  it('carries actual battle loot and mined works through the checkpoint', () => {
    const after = (id: string) => academyCheckpoint(ACADEMY_STEPS.findIndex((s) => s.id === id) + 1);
    const before = (id: string) => academyCheckpoint(ACADEMY_STEPS.findIndex((s) => s.id === id));
    expect(after('pirate').resources.alloy - before('pirate').resources.alloy).toBe(academyPirateLoot().alloy);
    expect(after('mine').buffer).toEqual(academyMinedOre());
    expect(academyRaidBattle().grade).toBe('DECISIVE');
    expect(academyRaidLoot().alloy).toBeGreaterThan(0);
    expect(after('raid').resources.alloy - before('raid').resources.alloy).toBe(academyRaidLoot().alloy);
    expect(after('raid').resources.deuterium).toBeLessThan(before('raid').resources.deuterium);
  });
  it.each([-1, 0.5, NaN, Infinity, 999])('refuses an unauthored step %s', (step) => {
    expect(() => academyCheckpoint(step)).toThrow();
  });
  it('starts from ordinary low-level buildings and preserves the neutral grant', () => {
    expect(academyCheckpoint(0).buildings).toEqual(START_BUILDINGS);
    expect(PLANET_START).toEqual({ alloy: 1218, crystal: 233, deuterium: 40 });
    expect(academyCheckpoint(0).resources.alloy).toBeLessThanOrEqual(PLANET_START.alloy);
    expect(academyCheckpoint(0).resources.crystal).toBeLessThanOrEqual(PLANET_START.crystal);
  });
  it('keeps every checkpoint affordable, legal and independently mutable', () => {
    for (let step = 0; step <= ACADEMY_STEPS.length; step++) {
      const state = academyCheckpoint(step);
      for (const amount of Object.values(state.resources)) expect(amount).toBeGreaterThanOrEqual(0);
      for (const level of Object.values(state.buildings)) expect(level).toBeLessThanOrEqual(state.buildings.CORE);
      expect(hangarLoad(state.fleet)).toBeLessThanOrEqual(hangarCapacity(state.buildings.HANGAR));
      expect(new Set(state.claimedRewards).size).toBe(state.claimedRewards.length);
      state.buildings.CORE = 99;
      expect(academyCheckpoint(step).buildings.CORE).not.toBe(99);
    }
  });
  it('keeps the taught buildings, survivors, miner and cargo and a paid real queue', () => {
    expect(TUTORIAL_EXIT.buildings).toMatchObject({ CORE: 2, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 });
    expect(TUTORIAL_EXIT.instruments.AEGIS).toBe(1);
    expect(TUTORIAL_EXIT.fleet).toMatchObject({ DART: 3, WARDEN: 1, PROSPECTOR: 1, COURIER: 1 });
    expect(TUTORIAL_EXIT.builtEver.DART).toBe(4);
    expect(TUTORIAL_EXIT.claimedRewards).toEqual(expect.arrayContaining(['EXTRACTOR:2', 'VAULT:1', 'AEGIS:1', 'PIRATE:1', 'SHIPS:2', 'MINE:1']));
    expect(TUTORIAL_EXIT.queue?.building).toBe('CORE');
    expect(TUTORIAL_EXIT.queue?.seconds).toBeGreaterThan(60);
  });
  it('does not award a lesson before its reward step', () => {
    const index = ACADEMY_STEPS.findIndex((s) => s.id === 'vault');
    expect(academyCheckpoint(index + 1).buildings.VAULT).toBe(1);
    expect(academyCheckpoint(index + 1).claimedRewards).not.toContain('VAULT:1');
    expect(academyCheckpoint(index + 2).claimedRewards).toContain('VAULT:1');
  });
});

describe('what a mission lesson asks the commander to send', () => {
  /**
   * MAX IS THE ONLY ANSWER THE TUTORIAL TEACHES, SO MAX HAS TO BE ACCEPTED.
   *
   * Owner report, and it was two bugs wearing one coat. The raid lesson demanded
   * `{ DART: 2, COURIER: 1 }` while the commander was standing on THREE Darts —
   * one survivor of the pirate fight plus the two `reinforcements` had just
   * built. The tutorial's own hand points at Max, Max sends three, and the
   * private API refused the launch. The refusal was then invisible, because the
   * Academy silences toasts: the one irreversible button in the lesson simply did
   * nothing when pressed.
   *
   * So a lesson's expected fleet is not an authored guess that may drift from the
   * economy above it. It is EXACTLY what the commander can launch at that step,
   * for every hull the lesson names — which is what makes "press Max on each row"
   * a complete and correct instruction rather than a coin flip.
   *
   * The captured Warden is deliberately not named by either lesson: it stays out
   * of the picker (owner instruction) so the choice reads as the two hulls the
   * tutorial actually taught the commander to build.
   */
  it('asks for every ship of its own kinds that the commander is holding', () => {
    for (const kind of ['pirate', 'raid'] as const) {
      const held = academyCheckpoint(ACADEMY_STEPS.findIndex((s) => s.id === kind)).fleet;
      const want = academyLessonFleet(kind);

      expect(Object.keys(want).length, `${kind} asks for nothing`).toBeGreaterThan(0);
      for (const [hull, count] of Object.entries(want)) {
        // Pressing Max on this row produces `held[hull]`; the lesson must want it.
        expect(held[hull as keyof typeof held], `${kind} · ${hull}`).toBe(count);
      }
    }
  });

  it('never names the captured hull, so the picker stays the two taught ships', () => {
    for (const kind of ['pirate', 'raid'] as const) {
      expect(Object.keys(academyLessonFleet(kind))).not.toContain('WARDEN');
      expect(Object.keys(academyLessonFleet(kind))).not.toContain('PROSPECTOR');
    }
  });
});

describe('what comes home from the pirate lesson', () => {
  /**
   * THE PRIZE FLIES BACK WITH THE FLEET. Owner instruction.
   *
   * A DECISIVE win at a pirate tows one of its hulls home (D133/D150), and the
   * Academy's fight always wins one: the checkpoint hands the commander a Warden
   * they did not build. But the RETURN LEG on the disc was drawn from
   * `attackerSurvivors` alone, so the squadron that flew back was one Dart — the
   * captured ship simply appeared in the hangar afterwards, with nothing on screen
   * connecting it to the fight it was won in.
   *
   * One statement, read by the checkpoint and by the disc, so the fleet that flies
   * home and the fleet that lands can never disagree.
   */
  it('brings back the survivors and the hull they took', () => {
    const home = academyPirateHomecoming();
    expect(home).toEqual(academyPirateBattle().attackerSurvivors === home ? home : {
      ...academyPirateBattle().attackerSurvivors, WARDEN: 1,
    });
    expect(home.WARDEN).toBe(1);
    expect(Object.keys(home).length).toBeGreaterThan(1);
  });

  it('is exactly the fleet the lesson leaves in the hangar', () => {
    const after = academyCheckpoint(ACADEMY_STEPS.findIndex((s) => s.id === 'pirateReport'));
    expect(after.fleet).toEqual(academyPirateHomecoming());
  });
});
