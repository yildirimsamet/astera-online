import type { IconId } from '../v2/icons.js';
import {
  HULLS, STARTER, alloyRate, crystalRate, deuteriumRate, moduleStage, openFeatures, storageCap, vesselAegisHp,
  type Fleet, type RepairStep, type StarterFeature, type VesselProgress,
} from '@astera/rules';

export type StepEffect =
  | { kind: 'feature'; feature: StarterFeature }
  | { kind: 'rate'; resource: 'alloy' | 'crystal' | 'deuterium'; perHour: number }
  | { kind: 'ships'; fleet: Fleet }
  | { kind: 'deuterium'; amount: number }
  | { kind: 'room'; room: number }
  | { kind: 'storeCeiling'; from: number; to: number }
  | { kind: 'reach'; sensor: 'telescope' | 'radar'; distance: number }
  | { kind: 'aegis'; hp: number }
  | { kind: 'note'; note: 'surveyBand' | 'driveHull' | 'driveThrust' };

const gain = (rate: (level: number) => number, stage: number): number => Math.round(rate(stage) - rate(stage - 1));

function ownEffect(step: RepairStep, progress: VesselProgress): StepEffect | null {
  const { module, stage } = step;
  switch (module) {
    case 'REFINERY': return { kind: 'rate', resource: 'alloy', perHour: gain(alloyRate, stage) };
    case 'EXTRACTOR': return { kind: 'rate', resource: 'crystal', perHour: gain(crystalRate, stage) };
    case 'DEUTERIUM_PLANT': return { kind: 'rate', resource: 'deuterium', perHour: gain(deuteriumRate, stage) };
    case 'VAULT': {
      const rate = alloyRate(moduleStage(progress, 'REFINERY'));
      return { kind: 'storeCeiling', from: storageCap(rate, stage - 1), to: storageCap(rate, stage) };
    }
    case 'HANGAR': return { kind: 'room', room: STARTER.hangarRoom[stage - 1] ?? 0 };
    case 'TELESCOPE': return { kind: 'reach', sensor: 'telescope', distance: STARTER.telescope[stage] ?? 0 };
    case 'RADAR': return { kind: 'reach', sensor: 'radar', distance: STARTER.radar[stage] ?? 0 };
    case 'AEGIS': return { kind: 'aegis', hp: vesselAegisHp(stage) };
    case 'SURVEY': return stage > 1 ? { kind: 'note', note: 'surveyBand' } : null;
    case 'DRIVE_HULL': return { kind: 'note', note: 'driveHull' };
    case 'DRIVE_THRUST': return { kind: 'note', note: 'driveThrust' };
    case 'SHIPYARD': return null;
  }
}

/**
 * WHAT THE SHIP GAINS, IN FACTS: "bana ne kazandırır" answered beside the price, before it is paid.
 * What a repair opens is worked out by opening it, so this cannot disagree with the gate.
 */
export function stepEffects(step: RepairStep, progress: VesselProgress): StepEffect[] {
  const before = openFeatures(progress);
  const after = openFeatures({ ...progress, modules: { ...progress.modules, [step.module]: step.stage } });
  const own = ownEffect(step, progress);
  return [
    ...[...after].filter(feature => !before.has(feature)).map((feature): StepEffect => ({ kind: 'feature', feature })),
    ...(own ? [own] : []),
    ...(step.grants?.fleet ? [{ kind: 'ships' as const, fleet: step.grants.fleet }] : []),
    ...(step.grants?.deuterium ? [{ kind: 'deuterium' as const, amount: step.grants.deuterium }] : []),
  ];
}

interface Held { alloy: number; crystal: number; bufferAlloy?: number; bufferCrystal?: number }
interface Income { alloyPerHour: number; crystalPerHour: number }

/**
 * MINUTES UNTIL THE STORE AND THE WORKS TOGETHER CAN PAY. Null when something it needs is not being
 * made at all, because a time that would never arrive is worse than none. An estimate: the works
 * can fill and the player has to collect, and the screen says "about".
 */
export function timeToAfford(cost: { alloy: number; crystal: number }, held: Held, income: Income): number | null {
  const wait = (price: number, have: number, perHour: number): number | null => {
    if (have >= price) return 0;
    return perHour > 0 ? ((price - have) / perHour) * 60 : null;
  };
  const alloy = wait(cost.alloy, held.alloy + (held.bufferAlloy ?? 0), income.alloyPerHour);
  const crystal = wait(cost.crystal, held.crystal + (held.bufferCrystal ?? 0), income.crystalPerHour);
  return alloy === null || crystal === null ? null : Math.max(alloy, crystal);
}

/** What the yard's button takes: the store alone, the works must be collected first. */
export function canPayDart(held: { alloy: number; crystal: number; deuterium: number }): boolean {
  const { alloy, crystal, deuterium } = HULLS.DART;
  return held.alloy >= alloy && held.crystal >= crystal && held.deuterium >= deuterium;
}

/** The capability earned by a repair, shown before spending. */
export function repairGainIcon(step: RepairStep): IconId {
  switch (step.module) {
    case 'SURVEY': return 'i-probe';
    case 'TELESCOPE': return 'i-telescope';
    case 'RADAR': return 'i-radar';
    case 'SHIPYARD': case 'DRIVE_HULL': case 'DRIVE_THRUST': return 'i-fleet';
    case 'AEGIS': return 'i-shield';
    case 'VAULT': case 'HANGAR': return 'i-transfer';
    case 'DEUTERIUM_PLANT': return 'm-recover';
    default: return 'i-mine';
  }
}
