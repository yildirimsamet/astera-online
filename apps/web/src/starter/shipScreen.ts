import {
  REPAIR_LADDER, VESSEL_MODULES, alloyRate, openFeatures, crystalRate, deuteriumRate, missingForStep, moduleStage, systemProgress,
  type RepairStep, type VesselHull, type VesselLook, type VesselModule, type VesselProgress, type VesselSystem,
} from '@astera/rules';
import { buildingArt, instrumentArt } from '../ui/assets.js';
import { RESEARCH_SCENES, cardScene } from '../ui/atmosphere.js';
import type { IconId } from '../v2/icons.js';

const ART = '/assets/images/starter';

export const heroArt = (hull: VesselHull, look: VesselLook): string =>
  `${ART}/hero-${hull.toLowerCase()}-${look.toLowerCase()}.webp`;

/** What no planet has wears the game's nearest scene, never a picture of its own. */
const BORROWED = {
  SURVEY: '/assets/images/atmosphere/uplink-v2.webp',
  DRIVE_HULL: RESEARCH_SCENES.STARSHIP_ENGINEERING.src,
  DRIVE_THRUST: RESEARCH_SCENES.SHIP_PROPULSION.src,
};

/**
 * A machine wears the scene its menu card shows at that level, so nothing is strange on the first
 * planet after the jump.
 */
export function moduleArt(module: VesselModule, stage: number): string {
  if (module === 'SURVEY' || module === 'DRIVE_HULL' || module === 'DRIVE_THRUST') return BORROWED[module];
  const raw = module === 'TELESCOPE' || module === 'RADAR' || module === 'AEGIS' ? instrumentArt(module, stage) : buildingArt(module, stage);
  return cardScene(raw)?.src ?? raw ?? BORROWED.SURVEY;
}

/** The module an order on the queue's wire is for. A subject there is any string. */
export const orderModule = (subject: string): VesselModule | undefined => VESSEL_MODULES.find(module => module === subject);

/** Each system wears the picture of the machine it is known by. */
export const SYSTEM_ICON: Record<VesselSystem, IconId> = {
  REFINERY: 'i-mine', SURVEY: 'i-radar', DEFENCE: 'i-shield', CARGO: 'i-transfer', DRIVE: 'i-fleet',
};

export const SYSTEM_ART: Record<VesselSystem, VesselModule> = {
  REFINERY: 'REFINERY', SURVEY: 'SURVEY', DEFENCE: 'AEGIS', CARGO: 'HANGAR', DRIVE: 'DRIVE_THRUST',
};

export const systemPercent = (progress: VesselProgress, system: VesselSystem): number => {
  const { done, total } = systemProgress(progress, system);
  return Math.round((done / total) * 100);
};

export type BayCondition = 'dead' | 'mending' | 'whole';

/** How one bay of the painting reads, from that system's repairs alone (plan F8). */
export const bayCondition = (percent: number): BayCondition => percent <= 0 ? 'dead' : percent >= 100 ? 'whole' : 'mending';

export type RepairTier = 'routine' | 'capability' | 'big';
export interface RepairMoment { system: VesselSystem; tier: RepairTier }
const TIER_WEIGHT: Record<RepairTier, number> = { routine: 0, capability: 1, big: 2 };

function tierOf(step: RepairStep, before: VesselProgress): RepairTier {
  if (step.module === 'DRIVE_THRUST') return 'big';
  const after = { ...before, modules: { ...before.modules, [step.module]: step.stage } };
  return openFeatures(after).size > openFeatures(before).size ? 'capability' : 'routine';
}

/** The answer a repair that has just come in deserves; the heaviest if several landed together. */
export function repairMoment(before: VesselProgress, after: VesselProgress): RepairMoment | null {
  let found: RepairMoment | null = null;
  for (const step of REPAIR_LADDER) {
    if (moduleStage(before, step.module) >= step.stage || moduleStage(after, step.module) < step.stage) continue;
    const tier = tierOf(step, before);
    if (!found || TIER_WEIGHT[tier] > TIER_WEIGHT[found.tier]) found = { system: step.system, tier };
  }
  return found;
}

/** Required steps before a player's choices, each group in ladder order. */
export const systemSteps = (system: VesselSystem): RepairStep[] =>
  REPAIR_LADDER.filter(step => step.system === system).sort((a, b) => Number(b.required) - Number(a.required));

const isDone = (progress: VesselProgress, step: RepairStep): boolean => moduleStage(progress, step.module) >= step.stage;

/**
 * THE REPAIR A SYSTEM SHOWS FIRST, judged against the ship as it will be once the queue has run: one
 * that can be ordered, the jump's before a choice, else the first still to come. Null when none is.
 */
export function pickStep(system: VesselSystem, ahead: VesselProgress): RepairStep | null {
  const left = systemSteps(system).filter(step => !isDone(ahead, step));
  return left.find(step => missingForStep(ahead, step).length === 0) ?? left[0] ?? null;
}

/** Locked means nothing can be done on it yet. A locked tab still opens, to say what it needs. */
export const systemOpen = (system: VesselSystem, progress: VesselProgress): boolean =>
  systemProgress(progress, system).done > 0
  || systemSteps(system).some(step => !isDone(progress, step) && missingForStep(progress, step).length === 0);

const RATES = { REFINERY: ['alloy', alloyRate], EXTRACTOR: ['crystal', crystalRate], DEUTERIUM_PLANT: ['deuterium', deuteriumRate] } as const;

export interface RateChange { resource: 'alloy' | 'crystal' | 'deuterium'; from: number; to: number }

/** What a production repair makes now and what it will make: the reward, read first. */
export function rateChange(step: RepairStep): RateChange | null {
  if (step.module !== 'REFINERY' && step.module !== 'EXTRACTOR' && step.module !== 'DEUTERIUM_PLANT') return null;
  const [resource, rate] = RATES[step.module];
  return { resource, from: Math.round(rate(step.stage - 1)), to: Math.round(rate(step.stage)) };
}

/**
 * A system's place on a hero, in percent of the painting: where its line touches the ship, where its
 * mark stands in open space, and which side of the mark its words go. Set against the art itself.
 */
export interface HeroBay { x: number; y: number; markX: number; markY: number; words: 'left' | 'right' }

export const HERO_BAYS: Record<VesselHull, Record<VesselSystem, HeroBay>> = {
  SPINE: {
    REFINERY: { x: 32, y: 62, markX: 5, markY: 33, words: 'right' },
    SURVEY: { x: 50, y: 30, markX: 25, markY: 12, words: 'right' },
    DEFENCE: { x: 63, y: 52, markX: 58, markY: 86, words: 'right' },
    CARGO: { x: 45, y: 62, markX: 28, markY: 86, words: 'right' },
    DRIVE: { x: 89, y: 37, markX: 79, markY: 57, words: 'right' },
  },
  WEDGE: {
    REFINERY: { x: 45, y: 58, markX: 5, markY: 27, words: 'right' },
    SURVEY: { x: 57, y: 27, markX: 25, markY: 10, words: 'right' },
    DEFENCE: { x: 66, y: 48, markX: 46, markY: 90, words: 'right' },
    CARGO: { x: 50, y: 71, markX: 17, markY: 90, words: 'right' },
    DRIVE: { x: 93, y: 64, markX: 74, markY: 90, words: 'right' },
  },
  SEED: {
    REFINERY: { x: 49, y: 54, markX: 3, markY: 14, words: 'right' },
    SURVEY: { x: 55, y: 22, markX: 26, markY: 9, words: 'right' },
    DEFENCE: { x: 63, y: 53, markX: 62, markY: 90, words: 'right' },
    CARGO: { x: 55, y: 73, markX: 30, markY: 90, words: 'right' },
    DRIVE: { x: 89, y: 38, markX: 79, markY: 57, words: 'right' },
  },
};
