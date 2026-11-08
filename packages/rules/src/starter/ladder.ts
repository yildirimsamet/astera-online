import type { Fleet } from '../types.js';
import { STARTER } from './constants.js';

/**
 * THE COLONY SHIP'S REPAIR LADDER. Plan §3.4.
 *
 * Repairing is an ordinary order: it pays, joins a queue and finishes with time. A ship has no
 * "levels" a player reads, since Refinery 4 aboard and Refinery 2 on the first planet would look
 * like a punishment, so the screen says "Onarım 3/4". The stage still feeds the main rules.
 */
export const VESSEL_SYSTEMS = ['REFINERY', 'SURVEY', 'DEFENCE', 'CARGO', 'DRIVE'] as const;
export type VesselSystem = (typeof VESSEL_SYSTEMS)[number];

export const VESSEL_MODULES = [
  'REFINERY', 'EXTRACTOR', 'DEUTERIUM_PLANT', 'VAULT',
  'SURVEY',
  'SHIPYARD', 'HANGAR',
  'TELESCOPE', 'RADAR', 'AEGIS',
  'DRIVE_HULL', 'DRIVE_THRUST',
] as const;
export type VesselModule = (typeof VESSEL_MODULES)[number];

/** Things that happened, never things bought: the steps a player cannot simply wait for. */
export const VESSEL_FACTS = ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT', 'FIRST_OUTPOST_VICTORY'] as const;
export type VesselFact = (typeof VESSEL_FACTS)[number];

export type VesselModules = Partial<Record<VesselModule, number>>;

export interface VesselProgress {
  modules: VesselModules;
  facts: readonly VesselFact[];
  /** Thrust parts held. A ship keeps what it took and can hold no more than it needs. */
  parts: number;
  /** Deuterium already in the drive's tank, out of reach of a raid. */
  fuel: number;
}

export type StepRequirement =
  | { kind: 'MODULE'; module: VesselModule; stage: number }
  | { kind: 'FACT'; fact: VesselFact }
  | { kind: 'PARTS'; count: number };

export interface RepairStep {
  system: VesselSystem;
  module: VesselModule;
  stage: number;
  alloy: number;
  crystal: number;
  minutes: number;
  /** A step the jump cannot happen without. The rest are a player's choices. */
  required: boolean;
  /** Beyond the stage below, which every step needs. */
  requires: readonly StepRequirement[];
  /** Handed over when the repair finishes, because the system it opens would be dead without it. */
  grants?: { deuterium?: number; fleet?: Fleet };
}

const needs = (module: VesselModule, stage: number): StepRequirement => ({ kind: 'MODULE', module, stage });
const fact = (name: VesselFact): StepRequirement => ({ kind: 'FACT', fact: name });

const step = (
  system: VesselSystem, module: VesselModule, stage: number,
  alloy: number, crystal: number, minutes: number,
  required: boolean, requires: readonly StepRequirement[] = [], grants?: RepairStep['grants'],
): RepairStep => ({ system, module, stage, alloy, crystal, minutes, required, requires, ...(grants ? { grants } : {}) });

/**
 * IN THE ORDER A PLAYER IS BEST ADVISED TO TAKE THEM: the first orderable required row is what the
 * ship screen calls "next". `starter-pacing` plays exactly this order.
 *
 * The extractor stage on a costly step is not a whim. The works can only store so much crystal, so
 * a step asks for the stage that makes its price reachable, and the screen can say so; without it
 * the player would meet a price the store silently cannot hold (`starter-ladder`).
 */
/**
 * Seconds as the ladder's minutes: the guided first session (owner 2026-11-06) runs in seconds. After it
 * the timers ramp (90 s, 2, 3, 5 minutes in the guided session, owner 2026-11-07; then 20, 30, 40, 60)
 * instead of jumping from one minute to forty-five. The engine takes four hours a part (owner
 * 2026-11-08, N4): the fuel, not the engine, is what a ship waits on before the jump.
 */
const seconds = (count: number): number => count / 60;

export const REPAIR_LADDER: readonly RepairStep[] = [
  // THE FIRST SESSION'S ROAD (owner 2026-11-08, N10–N13), one repair at a time and for everyone: free
  // spending left the antenna hours away. What makes, then what sees, then what reaches, then what builds.
  step('REFINERY', 'REFINERY', 2, 154, 20, seconds(10), true),
  step('REFINERY', 'EXTRACTOR', 1, 44, 33, seconds(10), true, [needs('REFINERY', 2)]),
  step('DEFENCE', 'TELESCOPE', 1, 250, 150, 1.5, true, [needs('EXTRACTOR', 1)], { fleet: { PROSPECTOR: 1 } }),
  step('DEFENCE', 'RADAR', 1, 200, 120, 1.5, true, [needs('TELESCOPE', 1)]),
  step('SURVEY', 'SURVEY', 1, 250, 120, seconds(30), true, [needs('RADAR', 1)]),
  step('CARGO', 'SHIPYARD', 1, 800, 300, 3, true, [needs('SURVEY', 1)], { fleet: { DART: 2 } }),

  // The rest of the ship opens with the yard.
  step('REFINERY', 'EXTRACTOR', 2, 77, 58, seconds(60), true, [needs('SHIPYARD', 1)]),
  step('REFINERY', 'REFINERY', 3, 548, 69, seconds(90), true, [needs('SHIPYARD', 1)]),
  step('REFINERY', 'VAULT', 1, 300, 150, 2, true, [needs('SHIPYARD', 1)]),
  step('REFINERY', 'EXTRACTOR', 3, 274, 206, 5, true),
  step('SURVEY', 'SURVEY', 2, 600, 350, 20, true, [needs('SHIPYARD', 1), fact('FIRST_PROBE_REPORT')]),
  step('CARGO', 'HANGAR', 2, 1000, 350, 30, true, [needs('SHIPYARD', 1), fact('FIRST_MINING_RETURN')]),
  step('REFINERY', 'REFINERY', 4, 886, 111, 60, true),
  // Its price is the whole opening crystal, which nothing makes before the first Extractor: bought
  // first, it would leave a ship that can never pay another repair (plan F3, `starter-ladder`).
  step('REFINERY', 'DEUTERIUM_PLANT', 1, 400, 300, 60, true, [needs('SHIPYARD', 1)], { deuterium: STARTER.deuteriumGrant }),
  step('REFINERY', 'DEUTERIUM_PLANT', 2, 800, 600, 120, true, [needs('EXTRACTOR', 2)]),
  // The ship leaves seeing what is around it (owner 2026-11-08, N3); no battle is asked of anyone.
  step('DRIVE', 'DRIVE_HULL', 1, 2200, 1100, 240, true, [
    needs('REFINERY', 4), needs('EXTRACTOR', 3), needs('SURVEY', 2), needs('HANGAR', 2), needs('RADAR', 1),
  ]),
  step('DRIVE', 'DRIVE_THRUST', 1, 1800, 1200, 240, true, [needs('DRIVE_HULL', 1), { kind: 'PARTS', count: STARTER.parts.needed }]),

  // The shield is a choice (owner 2026-11-08, N3): it brings the pirates and opens other ships, both ways.
  step('DEFENCE', 'AEGIS', 1, 315, 237, 45, false, [needs('SHIPYARD', 1)]),
  step('REFINERY', 'REFINERY', 5, 1433, 180, 180, false),
  step('REFINERY', 'EXTRACTOR', 4, 444, 334, 120, false),
  step('REFINERY', 'VAULT', 2, 600, 300, 90, false),
  step('SURVEY', 'SURVEY', 3, 1200, 700, 150, false, [needs('EXTRACTOR', 2)]),
  step('CARGO', 'HANGAR', 3, 2000, 700, 180, false, [needs('EXTRACTOR', 2)]),
  step('DEFENCE', 'TELESCOPE', 2, 1500, 1100, 120, false, [needs('EXTRACTOR', 2)]),
  step('DEFENCE', 'TELESCOPE', 3, 2600, 1900, 240, false, [needs('EXTRACTOR', 3)]),
  step('DEFENCE', 'RADAR', 2, 1000, 760, 120, false, [needs('EXTRACTOR', 2)]),
  step('DEFENCE', 'RADAR', 3, 1800, 1300, 180, false, [needs('EXTRACTOR', 2)]),
  step('DEFENCE', 'AEGIS', 2, 504, 379, 90, false),
];

const REQUIRED_STEPS = REPAIR_LADDER.filter(s => s.required);
/** The refinery the prologue leaves running, and the fuel, which no order buys. */
const STEPS_OUTSIDE_THE_LADDER = 2;

export const openingProgress = (): VesselProgress => ({
  modules: { ...STARTER.opening.modules }, facts: [], parts: 0, fuel: 0,
});

const findStep = (module: VesselModule, stage: number): RepairStep | undefined =>
  REPAIR_LADDER.find(s => s.module === module && s.stage === stage);

/** A shipyard comes with its first hangar: the room is what lets it hold the ships it gives. */
export function moduleStage(progress: VesselProgress, module: VesselModule): number {
  const own = progress.modules[module] ?? 0;
  return module === 'HANGAR' ? Math.max(own, Math.min(1, progress.modules.SHIPYARD ?? 0)) : own;
}

const requirementMet = (progress: VesselProgress, need: StepRequirement): boolean => {
  switch (need.kind) {
    case 'MODULE': return moduleStage(progress, need.module) >= need.stage;
    case 'FACT': return progress.facts.includes(need.fact);
    case 'PARTS': return progress.parts >= need.count;
  }
};

/** What still stands between this ship and this step, for the screen to name. */
export function missingForStep(progress: VesselProgress, target: RepairStep): StepRequirement[] {
  const below = target.stage > 1 && findStep(target.module, target.stage - 1)
    ? [needs(target.module, target.stage - 1)]
    : [];
  return [...below, ...target.requires].filter(need => !requirementMet(progress, need));
}

export type StepAnswer =
  | { ok: true; step: RepairStep }
  | { ok: false; code: 'UNKNOWN_STEP' }
  | { ok: false; code: 'ALREADY_REPAIRED' }
  | { ok: false; code: 'REPAIR_REQUIREMENT'; missing: StepRequirement[] };

export function canOrderStep(progress: VesselProgress, module: VesselModule, stage: number): StepAnswer {
  const target = findStep(module, stage);
  if (!target) return { ok: false, code: 'UNKNOWN_STEP' };
  if (moduleStage(progress, module) >= stage) return { ok: false, code: 'ALREADY_REPAIRED' };
  const missing = missingForStep(progress, target);
  return missing.length > 0 ? { ok: false, code: 'REPAIR_REQUIREMENT', missing } : { ok: true, step: target };
}

/** Everything orderable now. Required steps first, each group in the ladder's own order. */
export function nextSteps(progress: VesselProgress): RepairStep[] {
  const open = REPAIR_LADDER.filter(s => canOrderStep(progress, s.module, s.stage).ok);
  return [...open.filter(s => s.required), ...open.filter(s => !s.required)];
}

/**
 * THE SHIP AS IT WILL BE ONCE THE QUEUE HAS RUN, which is what a new order is judged against: the
 * queue runs in order, so anything already in it finishes first. Facts and parts are not queued.
 */
export function afterQueue(progress: VesselProgress, queued: readonly RepairStep[]): VesselProgress {
  const modules: VesselModules = { ...progress.modules };
  for (const { module, stage } of queued) modules[module] = Math.max(modules[module] ?? 0, stage);
  return { ...progress, modules };
}

/**
 * WOULD TAKING `earlier` OUT OF THE QUEUE LEAVE `later` STANDING ON NOTHING? A cancellation refuses
 * then, exactly as the main queue does: a stage that survived the one below it would be a free stage.
 */
export function stepDependsOn(later: RepairStep, earlier: RepairStep): boolean {
  if (later.module === earlier.module) return later.stage > earlier.stage;
  return later.requires.some(need => need.kind === 'MODULE' && need.module === earlier.module && need.stage >= earlier.stage);
}

export interface NextRequired { step: RepairStep; missing: StepRequirement[] }

/**
 * WHAT THE SHIP SCREEN CALLS "NEXT", judged as if the queue had already run. The first required step
 * that can be ordered; if none can, the first one left, with what it waits on, because a player with
 * nothing to press still has to be told what to go and do.
 */
export function nextRequiredStep(progress: VesselProgress, queued: readonly RepairStep[]): NextRequired | null {
  const ship = afterQueue(progress, queued);
  const left = REQUIRED_STEPS.filter(s => moduleStage(ship, s.module) < s.stage);
  const ready = left.find(s => missingForStep(ship, s).length === 0);
  if (ready) return { step: ready, missing: [] };
  const first = left[0];
  return first ? { step: first, missing: missingForStep(ship, first) } : null;
}

export const isJumpReady = (progress: VesselProgress): boolean => progress.fuel >= STARTER.fuelForJump;

export const canLoadFuel = (progress: VesselProgress): boolean =>
  moduleStage(progress, 'DRIVE_THRUST') >= 1 && moduleStage(progress, 'DEUTERIUM_PLANT') >= 2;

export interface SystemProgress { done: number; total: number }

/** One system's share of `repairProgress`, so the five rows always add up to the bar above them. */
export function systemProgress(progress: VesselProgress, system: VesselSystem): SystemProgress {
  const steps = REQUIRED_STEPS.filter(s => s.system === system);
  const repaired = steps.filter(s => moduleStage(progress, s.module) >= s.stage).length;
  if (system === 'REFINERY') return { done: repaired + (moduleStage(progress, 'REFINERY') >= 1 ? 1 : 0), total: steps.length + 1 };
  if (system === 'DRIVE') return { done: repaired + (isJumpReady(progress) ? 1 : 0), total: steps.length + 1 };
  return { done: repaired, total: steps.length };
}

export interface RepairProgress { done: number; total: number; share: number }

/** The ship screen's "Onarım %43". Optional repairs are a player's own business, so they do not move it. */
export function repairProgress(progress: VesselProgress): RepairProgress {
  const total = REQUIRED_STEPS.length + STEPS_OUTSIDE_THE_LADDER;
  const repaired = REQUIRED_STEPS.filter(s => moduleStage(progress, s.module) >= s.stage).length;
  const done = repaired + (moduleStage(progress, 'REFINERY') >= 1 ? 1 : 0) + (isJumpReady(progress) ? 1 : 0);
  return { done, total, share: done / total };
}

/**
 * EVERY MACHINE ABOARD, the jump's or not (plan 2026-11-08 F7). "Ready to leave" and "the whole ship"
 * are two answers: a ship ready with its shield still dead has left a choice, not a repair, undone.
 */
export function wholeShipProgress(progress: VesselProgress): SystemProgress {
  const repaired = REPAIR_LADDER.filter(s => moduleStage(progress, s.module) >= s.stage).length;
  return { done: repaired + (moduleStage(progress, 'REFINERY') >= 1 ? 1 : 0), total: REPAIR_LADDER.length + 1 };
}
