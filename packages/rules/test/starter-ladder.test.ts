import { describe, expect, it } from 'vitest';
import {
  REPAIR_LADDER,
  STARTER,
  STARTER_CRATES,
  VESSEL_HULLS,
  VESSEL_MODULES,
  VESSEL_SYSTEMS,
  afterQueue,
  alloyRate,
  canLoadFuel,
  canOrderStep,
  crystalRate,
  moduleStage,
  nextRequiredStep,
  nextSteps,
  openingProgress,
  repairProgress,
  stepDependsOn,
  storageCap,
  systemProgress,
  vesselHull,
  vesselLook,
  type RepairStep,
  type VesselFact,
  type VesselModule,
  type VesselModules,
  type VesselProgress,
} from '../src/index.js';

const ALL_FACTS: readonly VesselFact[] = ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'];
const withModules = (modules: Partial<Record<VesselModule, number>>, more: Partial<VesselProgress> = {}): VesselProgress => ({
  ...openingProgress(), modules: { ...openingProgress().modules, ...modules }, ...more,
});
const find = (module: VesselModule, stage: number): RepairStep => {
  const step = REPAIR_LADDER.find(s => s.module === module && s.stage === stage);
  if (!step) throw new Error(`no ${module} ${String(stage)}`);
  return step;
};

/** The smallest set of repairs that lets `step` be ordered, read through the requirements. */
function closure(step: RepairStep): Partial<Record<VesselModule, number>> {
  const out: Partial<Record<VesselModule, number>> = { ...openingProgress().modules };
  const visit = (module: VesselModule, stage: number) => {
    if ((out[module] ?? 0) >= stage) return;
    out[module] = stage;
    for (let lower = stage; lower >= 1; lower--) {
      const found = REPAIR_LADDER.find(s => s.module === module && s.stage === lower);
      if (found) for (const need of found.requires) if (need.kind === 'MODULE') visit(need.module, need.stage);
    }
  };
  if (step.stage > 1) visit(step.module, step.stage - 1);
  for (const need of step.requires) if (need.kind === 'MODULE') visit(need.module, need.stage);
  return out;
}

describe('the repair ladder', () => {
  it('has all five systems, and no step twice', () => {
    expect(new Set(REPAIR_LADDER.map(s => s.system))).toEqual(new Set(VESSEL_SYSTEMS));
    const keys = REPAIR_LADDER.map(s => `${s.module}:${String(s.stage)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('holds the agreed bill for the steps a player must take', () => {
    const bill = (module: VesselModule, stage: number) => {
      const s = find(module, stage);
      return [s.alloy, s.crystal, s.minutes];
    };
    // Owner 2026-11-06: the first session's repairs take seconds (10 s, 10 s, 30 s, 60 s); then the ramp
    // of the retention plan (§6.1) instead of a cliff, softened by the owner 2026-11-07 (90 s, 2, 3, 5 min).
    expect(bill('REFINERY', 2)).toEqual([154, 20, 10 / 60]);
    expect(bill('EXTRACTOR', 1)).toEqual([44, 33, 10 / 60]);
    expect(bill('EXTRACTOR', 2)).toEqual([77, 58, 1]);
    expect(bill('REFINERY', 3)).toEqual([548, 69, 1.5]);
    expect(bill('VAULT', 1)).toEqual([300, 150, 2]);
    expect(bill('EXTRACTOR', 3)).toEqual([274, 206, 5]);
    expect(bill('REFINERY', 4)).toEqual([886, 111, 60]);
    expect(bill('DEUTERIUM_PLANT', 1)).toEqual([400, 300, 60]);
    expect(bill('DEUTERIUM_PLANT', 2)).toEqual([800, 600, 120]);
    expect(bill('SURVEY', 1)).toEqual([250, 120, 0.5]);
    expect(bill('SURVEY', 2)).toEqual([600, 350, 20]);
    expect(bill('SHIPYARD', 1)).toEqual([800, 300, 3]);
    expect(bill('HANGAR', 2)).toEqual([1000, 350, 30]);
    expect(bill('TELESCOPE', 1)).toEqual([700, 500, 40]);
    expect(bill('RADAR', 1)).toEqual([500, 380, 60]);
    // Owner 2026-11-08 (N4): four hours each, so the fuel and not the engine is what a ship waits on.
    expect(bill('DRIVE_HULL', 1)).toEqual([2200, 1100, 240]);
    expect(bill('DRIVE_THRUST', 1)).toEqual([1800, 1200, 240]);
  });

  it('keeps the price of the shield a player may choose', () => {
    expect([find('AEGIS', 1).alloy, find('AEGIS', 1).crystal, find('AEGIS', 1).minutes]).toEqual([315, 237, 45]);
  });

  it('counts 18 steps to the drive, with the opening refinery among them', () => {
    expect(REPAIR_LADDER.filter(s => s.required).length + 1).toBe(18);
  });

  it('marks the extras as optional, so a player can choose', () => {
    // Owner 2026-11-08 (N3): Aegis is the door to pirates and to other ships, not to the jump.
    for (const [module, stage] of [['AEGIS', 1], ['REFINERY', 5], ['EXTRACTOR', 4], ['VAULT', 2], ['SURVEY', 3], ['HANGAR', 3], ['TELESCOPE', 2], ['TELESCOPE', 3], ['RADAR', 2], ['RADAR', 3], ['AEGIS', 2]] as const) {
      expect(find(module, stage).required, `${module} ${String(stage)}`).toBe(false);
    }
  });

  it('never makes a required step wait on an optional one', () => {
    for (const step of REPAIR_LADDER.filter(s => s.required)) {
      for (const need of step.requires) {
        if (need.kind !== 'MODULE') continue;
        const under = REPAIR_LADDER.find(s => s.module === need.module && s.stage === need.stage);
        if (under) expect(under.required, `${step.module} needs ${need.module}`).toBe(true);
      }
    }
  });

  it('can reach every step, with no cycle', () => {
    let progress: VesselProgress = { ...openingProgress(), facts: ALL_FACTS, parts: STARTER.parts.needed };
    const left = new Set(REPAIR_LADDER);
    for (let pass = 0; pass <= REPAIR_LADDER.length && left.size > 0; pass++) {
      for (const step of [...left]) {
        if (canOrderStep(progress, step.module, step.stage).ok) {
          progress = { ...progress, modules: { ...progress.modules, [step.module]: step.stage } };
          left.delete(step);
        }
      }
    }
    expect([...left].map(s => s.module)).toEqual([]);
  });

  it('never asks for more than the store of that moment can hold', () => {
    const { alloy: openingAlloy, crystal: openingCrystal } = STARTER.opening;
    for (const step of REPAIR_LADDER) {
      const modules = closure(step);
      const vault = modules.VAULT ?? 0;
      const capA = Math.max(openingAlloy, storageCap(alloyRate(modules.REFINERY ?? 0), vault));
      const capC = Math.max(openingCrystal, storageCap(crystalRate(modules.EXTRACTOR ?? 0), vault));
      const name = `${step.module} ${String(step.stage)}`;
      expect(step.alloy, name).toBeLessThanOrEqual(capA);
      expect(step.crystal, name).toBeLessThanOrEqual(capC);
    }
  });

  /**
   * NO SHIP STRANDS ITSELF (plan F3). Past the short core nothing holds a spend, and crystal is the one
   * thing a ship makes none of until its first Extractor. Whatever a player buys before it, crates
   * opened, a repair it can pay is left; once the Extractor runs, waiting always pays.
   */
  it('leaves every ship a repair it can pay before its first Extractor, whatever it bought', () => {
    const stranded: string[] = [];
    const best = new Map<string, number>();
    const walk = (progress: VesselProgress, crystal: number) => {
      const key = JSON.stringify(Object.entries(progress.modules).sort());
      if ((best.get(key) ?? -1) >= crystal) return;
      best.set(key, crystal);
      if (moduleStage(progress, 'EXTRACTOR') >= 1) return;
      const payable = nextSteps(progress).filter(step => step.crystal <= crystal);
      if (payable.length === 0) stranded.push(`${key} with ${String(crystal)} crystal`);
      for (const step of payable) {
        const crate = STARTER_CRATES.filter(c => c.module === step.module && c.stage === step.stage).reduce((sum, c) => sum + c.reward.crystal, 0);
        walk({ ...progress, modules: { ...progress.modules, [step.module]: step.stage } }, crystal - step.crystal + crate);
      }
    };
    walk(openingProgress(), STARTER.opening.crystal);
    expect(crystalRate(0)).toBe(0);
    expect(crystalRate(1)).toBeGreaterThan(0);
    expect(stranded).toEqual([]);
  });

  it('stays inside what the numbers answer for', () => {
    const top = (module: VesselModule) => Math.max(...REPAIR_LADDER.filter(s => s.module === module).map(s => s.stage));
    expect(top('TELESCOPE')).toBe(STARTER.telescope.length - 1);
    expect(top('RADAR')).toBe(STARTER.radar.length - 1);
    expect(top('HANGAR')).toBe(STARTER.hangarRoom.length);
    expect(top('AEGIS')).toBe(STARTER.combat.aegisMax);
  });

  it('gives what the plan promises, once, on the step that names it', () => {
    expect(find('DEUTERIUM_PLANT', 1).grants).toEqual({ deuterium: STARTER.deuteriumGrant });
    expect(find('SHIPYARD', 1).grants).toEqual({ fleet: { PROSPECTOR: 1, DART: 2 } });
    expect(REPAIR_LADDER.filter(s => s.grants).length).toBe(2);
  });
});

describe('ordering a repair', () => {
  it('starts with the refinery running and nothing else', () => {
    expect(openingProgress()).toEqual({ modules: { REFINERY: 1 }, facts: [], parts: 0, fuel: 0 });
  });

  it('refuses a step the ladder does not hold', () => {
    expect(canOrderStep(openingProgress(), 'AEGIS', 3)).toEqual({ ok: false, code: 'UNKNOWN_STEP' });
    expect(canOrderStep(openingProgress(), 'REFINERY', 1)).toEqual({ ok: false, code: 'UNKNOWN_STEP' });
  });

  it('refuses what is already repaired', () => {
    expect(canOrderStep(withModules({ REFINERY: 3 }), 'REFINERY', 2)).toEqual({ ok: false, code: 'ALREADY_REPAIRED' });
  });

  it('refuses to skip a stage, and names what is missing', () => {
    expect(canOrderStep(openingProgress(), 'REFINERY', 3)).toEqual({
      ok: false, code: 'REPAIR_REQUIREMENT', missing: [{ kind: 'MODULE', module: 'REFINERY', stage: 2 }],
    });
  });

  it('names every requirement that is not met', () => {
    expect(canOrderStep(openingProgress(), 'SHIPYARD', 1)).toEqual({
      ok: false,
      code: 'REPAIR_REQUIREMENT',
      missing: [{ kind: 'MODULE', module: 'SURVEY', stage: 1 }, { kind: 'MODULE', module: 'REFINERY', stage: 3 }],
    });
  });

  it('asks for a real act where the plan asks for one', () => {
    const miss = (module: VesselModule, stage: number, progress: VesselProgress) => {
      const answer = canOrderStep(progress, module, stage);
      return answer.ok || answer.code !== 'REPAIR_REQUIREMENT' ? [] : answer.missing;
    };
    expect(miss('SURVEY', 2, withModules({ SURVEY: 1 }))).toEqual([{ kind: 'FACT', fact: 'FIRST_PROBE_REPORT' }]);
    expect(miss('HANGAR', 2, withModules({ SHIPYARD: 1 }))).toEqual([{ kind: 'FACT', fact: 'FIRST_MINING_RETURN' }]);
    expect(miss('DRIVE_THRUST', 1, withModules({ DRIVE_HULL: 1 }))).toEqual([{ kind: 'PARTS', count: STARTER.parts.needed }]);
    expect(miss('DRIVE_THRUST', 1, withModules({ DRIVE_HULL: 1 }, { parts: 2 }))).toEqual([{ kind: 'PARTS', count: STARTER.parts.needed }]);
    expect(canOrderStep(withModules({ DRIVE_HULL: 1 }, { parts: 3 }), 'DRIVE_THRUST', 1).ok).toBe(true);
  });

  it('opens the drive once the radar is up, with no battle asked of anyone', () => {
    const ready = withModules({ REFINERY: 4, EXTRACTOR: 3, SURVEY: 2, SHIPYARD: 1, HANGAR: 2, TELESCOPE: 1 });
    expect(canOrderStep(ready, 'DRIVE_HULL', 1)).toEqual({ ok: false, code: 'REPAIR_REQUIREMENT', missing: [{ kind: 'MODULE', module: 'RADAR', stage: 1 }] });
    expect(canOrderStep({ ...ready, modules: { ...ready.modules, RADAR: 1 } }, 'DRIVE_HULL', 1).ok).toBe(true);
    expect(find('DRIVE_HULL', 1).requires).not.toContainEqual({ kind: 'FACT', fact: 'FIRST_BATTLE_REPORT' });
  });

  it('never needs the shield on the way to the jump', () => {
    const needed = new Set<string>();
    const visit = (module: VesselModule, stage: number) => {
      const key = `${module}:${String(stage)}`;
      if (needed.has(key)) return;
      needed.add(key);
      const step = REPAIR_LADDER.find(s => s.module === module && s.stage === stage);
      if (!step) return;
      if (stage > 1) visit(module, stage - 1);
      for (const need of step.requires) if (need.kind === 'MODULE') visit(need.module, need.stage);
    };
    visit('DRIVE_THRUST', 1);
    visit('DEUTERIUM_PLANT', 2);
    expect([...needed].filter(key => !key.startsWith('HANGAR:1')).sort()).toEqual([
      'DEUTERIUM_PLANT:1', 'DEUTERIUM_PLANT:2', 'DRIVE_HULL:1', 'DRIVE_THRUST:1', 'EXTRACTOR:1', 'EXTRACTOR:2', 'EXTRACTOR:3',
      'HANGAR:2', 'RADAR:1', 'REFINERY:1', 'REFINERY:2', 'REFINERY:3', 'REFINERY:4', 'SHIPYARD:1', 'SURVEY:1', 'SURVEY:2', 'TELESCOPE:1',
    ]);
  });

  it('treats the shipyard as the first stage of the hangar', () => {
    expect(moduleStage(openingProgress(), 'HANGAR')).toBe(0);
    expect(moduleStage(withModules({ SHIPYARD: 1 }), 'HANGAR')).toBe(1);
    expect(moduleStage(withModules({ SHIPYARD: 1, HANGAR: 3 }), 'HANGAR')).toBe(3);
  });

  it('lists only what can be ordered now, required first in play order', () => {
    const opening = nextSteps(openingProgress()).map(s => `${s.module}:${String(s.stage)}`);
    expect(opening.slice(0, 2)).toEqual(['REFINERY:2', 'EXTRACTOR:1']);
    expect(opening).not.toContain('REFINERY:3');
    expect(opening).not.toContain('SURVEY:1');
    for (const step of nextSteps(openingProgress())) expect(canOrderStep(openingProgress(), step.module, step.stage).ok).toBe(true);
    const required = nextSteps(withModules({ REFINERY: 4, EXTRACTOR: 3 })).map(s => s.required);
    expect(required.lastIndexOf(true)).toBeLessThan(required.indexOf(false));
  });

  it('lets a queued repair count as done for the next order, but not a fact', () => {
    const queued = afterQueue(openingProgress(), [find('REFINERY', 2)]);
    expect(moduleStage(queued, 'REFINERY')).toBe(2);
    expect(canOrderStep(queued, 'REFINERY', 2)).toEqual({ ok: false, code: 'ALREADY_REPAIRED' });
    expect(canOrderStep(queued, 'REFINERY', 3).ok).toBe(true);
    expect(moduleStage(openingProgress(), 'REFINERY')).toBe(1);
  });
});

describe('cancelling out of a queue', () => {
  it('holds a later stage of the same module to the earlier one', () => {
    expect(stepDependsOn(find('REFINERY', 3), find('REFINERY', 2))).toBe(true);
    expect(stepDependsOn(find('REFINERY', 2), find('REFINERY', 3))).toBe(false);
  });

  it('holds a step to what it requires', () => {
    expect(stepDependsOn(find('SURVEY', 1), find('EXTRACTOR', 1))).toBe(true);
    expect(stepDependsOn(find('SHIPYARD', 1), find('REFINERY', 3))).toBe(true);
  });

  it('holds a step to a lower stage of what it requires', () => {
    expect(stepDependsOn(find('SURVEY', 3), find('EXTRACTOR', 1))).toBe(true);
    expect(stepDependsOn(find('SURVEY', 1), find('EXTRACTOR', 2))).toBe(false);
  });

  it('leaves unrelated steps free', () => {
    expect(stepDependsOn(find('REFINERY', 2), find('EXTRACTOR', 1))).toBe(false);
  });
});

describe('the list of modules', () => {
  it('names every module the ladder uses', () => {
    expect(new Set(REPAIR_LADDER.map(s => s.module))).toEqual(new Set(VESSEL_MODULES));
  });
});

describe('the progress line', () => {
  const everything = Object.fromEntries(REPAIR_LADDER.filter(s => s.required).map(s => [s.module, s.stage]));

  it('counts the opening refinery and the fuel', () => {
    expect(repairProgress(openingProgress())).toEqual({ done: 1, total: 19, share: 1 / 19 });
  });

  it('does not count optional steps', () => {
    // The shield is a player's choice (owner 2026-11-08, N3): neither of its stages moves the bar.
    expect(repairProgress(withModules({ AEGIS: 2, REFINERY: 2 })).done).toBe(2);
    expect(repairProgress(withModules({ TELESCOPE: 3 })).done).toBe(2);
  });

  it('reaches the whole only with the fuel in the tank', () => {
    expect(repairProgress(withModules(everything)).done).toBe(18);
    expect(repairProgress(withModules(everything, { fuel: STARTER.fuelForJump - 1 })).done).toBe(18);
    expect(repairProgress(withModules(everything, { fuel: STARTER.fuelForJump }))).toEqual({ done: 19, total: 19, share: 1 });
  });
});

describe('the fuel tank', () => {
  it('needs the thrust assembly and the second deuterium stage', () => {
    expect(canLoadFuel(withModules({ DRIVE_THRUST: 1 }))).toBe(false);
    expect(canLoadFuel(withModules({ DEUTERIUM_PLANT: 2 }))).toBe(false);
    expect(canLoadFuel(withModules({ DRIVE_THRUST: 1, DEUTERIUM_PLANT: 2 }))).toBe(true);
  });
});

const allRepaired = (): VesselModules => {
  const modules: VesselModules = {};
  for (const { module, stage } of REPAIR_LADDER) modules[module] = Math.max(modules[module] ?? 0, stage);
  return modules;
};

describe('the five systems, as the ship screen counts them', () => {
  const everything = (): VesselProgress => ({
    modules: allRepaired(),
    facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'],
    parts: STARTER.parts.needed,
    fuel: STARTER.fuelForJump,
  });

  it('adds up to the same total the repair bar shows', () => {
    const totals = VESSEL_SYSTEMS.map(system => systemProgress(openingProgress(), system).total);
    expect(totals.reduce((sum, total) => sum + total, 0)).toBe(repairProgress(openingProgress()).total);
  });

  it('adds up to the same done, at any point of the climb', () => {
    const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, SHIPYARD: 1 } };
    const done = VESSEL_SYSTEMS.map(system => systemProgress(progress, system).done);
    expect(done.reduce((sum, count) => sum + count, 0)).toBe(repairProgress(progress).done);
  });

  it('counts the refinery the prologue leaves running on the refinery system', () => {
    expect(systemProgress(openingProgress(), 'REFINERY').done).toBe(1);
    expect(systemProgress(openingProgress(), 'SURVEY').done).toBe(0);
  });

  it('counts the fuel on the drive, since no order buys it', () => {
    expect(systemProgress(openingProgress(), 'DRIVE').total).toBe(3);
    expect(systemProgress(everything(), 'DRIVE').done).toBe(3);
  });

  it('does not count an optional repair', () => {
    const progress: VesselProgress = { ...openingProgress(), modules: { SURVEY: 3 } };
    expect(systemProgress(progress, 'SURVEY')).toEqual({ done: 2, total: 2 });
  });

  it('counts the telescope and the radar on the defence, and leaves the shield to the player', () => {
    expect(systemProgress(openingProgress(), 'DEFENCE')).toEqual({ done: 0, total: 2 });
    expect(systemProgress({ ...openingProgress(), modules: { AEGIS: 1 } }, 'DEFENCE')).toEqual({ done: 0, total: 2 });
    expect(systemProgress({ ...openingProgress(), modules: { TELESCOPE: 1, RADAR: 1 } }, 'DEFENCE')).toEqual({ done: 2, total: 2 });
  });

  it('finishes every system on a finished ship', () => {
    for (const system of VESSEL_SYSTEMS) {
      const { done, total } = systemProgress(everything(), system);
      expect(done).toBe(total);
    }
  });
});

describe('the next required repair', () => {
  it('names the first orderable required step, in the order the ladder advises', () => {
    expect(nextRequiredStep(openingProgress(), [])).toMatchObject({ step: { module: 'REFINERY', stage: 2 }, missing: [] });
  });

  it('looks past what is already queued', () => {
    const first = REPAIR_LADDER[0]!;
    expect(nextRequiredStep(openingProgress(), [first])?.step).toMatchObject({ module: 'EXTRACTOR', stage: 1 });
  });

  it('reads the queue as finished when judging a step that stands on it', () => {
    const queued = REPAIR_LADDER.filter(s => (s.module === 'REFINERY' && s.stage === 2) || (s.module === 'EXTRACTOR' && s.stage === 1));
    expect(nextRequiredStep(openingProgress(), queued)).toMatchObject({ step: { module: 'SURVEY', stage: 1 }, missing: [] });
  });

  it('says what stands in the way when every step left is waiting on something', () => {
    const progress: VesselProgress = {
      ...openingProgress(),
      modules: { REFINERY: 3, EXTRACTOR: 3, SURVEY: 1, VAULT: 1, SHIPYARD: 1, TELESCOPE: 1, RADAR: 1, AEGIS: 1, DEUTERIUM_PLANT: 2 },
    };
    const next = nextRequiredStep({ ...progress, modules: { ...progress.modules, REFINERY: 4 } }, []);
    expect(next).toMatchObject({ step: { module: 'SURVEY', stage: 2 }, missing: [{ kind: 'FACT', fact: 'FIRST_PROBE_REPORT' }] });
  });

  it('is nothing once every required step is done', () => {
    expect(nextRequiredStep({ modules: allRepaired(), facts: [], parts: 0, fuel: 0 }, [])).toBeNull();
  });
});

describe('how a ship looks', () => {
  it('starts wrecked and ends renewed', () => {
    expect(vesselLook(openingProgress())).toBe('WRECKED');
    expect(vesselLook({ modules: allRepaired(), facts: [], parts: 0, fuel: STARTER.fuelForJump })).toBe('RENEWED');
  });

  it('is patched in between', () => {
    const mid: VesselProgress = { ...openingProgress(), modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 2, VAULT: 1, SHIPYARD: 1 } };
    expect(vesselLook(mid)).toBe('PATCHED');
  });

  it('gives a ship one hull for good, from its id alone', () => {
    expect(vesselHull('ship-a')).toBe(vesselHull('ship-a'));
    expect(VESSEL_HULLS).toContain(vesselHull('ship-a'));
  });

  it('uses all three hulls across a crowd, none of them rare', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 900; i++) {
      const hull = vesselHull(`4f1c7a2e-90ab-4cde-8f01-${String(i).padStart(12, '0')}`);
      counts.set(hull, (counts.get(hull) ?? 0) + 1);
    }
    expect(counts.size).toBe(3);
    for (const count of counts.values()) expect(count).toBeGreaterThan(220);
  });
});
