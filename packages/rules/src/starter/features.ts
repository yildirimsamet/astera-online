import { REPAIR_LADDER, isJumpReady, missingForStep, moduleStage, type VesselFact, type VesselModule, type VesselProgress } from './ladder.js';
import { STARTER } from './constants.js';
import { canTakePart } from './sites.js';

/**
 * WHAT A COMMANDER CAN USE ABOARD. Plan §3.7.
 *
 * A closed menu is closed because that system is broken, not because of an arbitrary level, and
 * two doors open on events: mine first and then see the wrecks, live through a battle and then be
 * able to start one. Derived from the ship on every read. The only thing stored is which openings
 * have been announced, which is the same split as the main game's `currentUnlocks` / `unlocksSeen`,
 * except that here the server really does refuse a closed system.
 *
 * In the order the screen shows them, which is roughly the order they open.
 */
export const STARTER_FEATURES = [
  'production', 'intel', 'fleet', 'chat', 'salvage', 'research', 'telescope',
  'radar', 'defence', 'attack', 'deuterium', 'drive', 'migration',
] as const;
export type StarterFeature = (typeof STARTER_FEATURES)[number];

/** Nothing aboard opens these. They arrive with the landing, one card at a time. */
export const MAIN_GALAXY_FEATURES = [
  'clan', 'dominion', 'honor', 'colony', 'monuments', 'deathStar', 'tactics',
  'convoy', 'radiation', 'rift', 'rankings', 'directMessages', 'store',
] as const;
export type MainGalaxyFeature = (typeof MAIN_GALAXY_FEATURES)[number];

const stage = (module: VesselModule, reached: number) => (p: VesselProgress) => moduleStage(p, module) >= reached;
const happened = (fact: VesselFact) => (p: VesselProgress) => p.facts.includes(fact);

const DRIVE_HULL_STEP = REPAIR_LADDER.find(s => s.module === 'DRIVE_HULL')!;

const OPENS: Record<StarterFeature, (progress: VesselProgress) => boolean> = {
  production: stage('REFINERY', 1),
  intel: stage('SURVEY', 1),
  fleet: stage('SHIPYARD', 1),
  chat: stage('SURVEY', 2),
  salvage: happened('FIRST_MINING_RETURN'),
  research: stage('HANGAR', 2),
  telescope: stage('TELESCOPE', 1),
  radar: stage('RADAR', 1),
  defence: stage('AEGIS', 1),
  attack: happened('FIRST_BATTLE_REPORT'),
  deuterium: stage('DEUTERIUM_PLANT', 1),
  // The panel opens when the hull can be ordered, so the two can never disagree.
  drive: p => missingForStep(p, DRIVE_HULL_STEP).length === 0,
  migration: isJumpReady,
};

export const isFeatureOpen = (progress: VesselProgress, feature: StarterFeature): boolean => OPENS[feature](progress);

export const openFeatures = (progress: VesselProgress): ReadonlySet<StarterFeature> =>
  new Set(STARTER_FEATURES.filter(feature => OPENS[feature](progress)));

/** Only the next lock is shown; anything further stays out of sight. */
export const nextLockedFeature = (progress: VesselProgress): StarterFeature | null =>
  STARTER_FEATURES.find(feature => !OPENS[feature](progress)) ?? null;

/** One moment at a time, even for a player who was away while several opened. */
export function nextUnlockToAnnounce(progress: VesselProgress, seen: readonly StarterFeature[]): StarterFeature | null {
  return STARTER_FEATURES.find(feature => OPENS[feature](progress) && !seen.includes(feature)) ?? null;
}

/** Thrust parts exist only for those hunting them: the panel open, and room left to carry one. */
export const partsVisible = (progress: VesselProgress): boolean =>
  OPENS.drive(progress) && canTakePart(progress.parts);

/** Neighbours for a galaxy with this many active people. Nobody there means nobody to live beside. */
export const shipBotTarget = (activePeople: number): number =>
  activePeople <= 0 ? 0 : Math.min(STARTER.bots.max, Math.max(STARTER.bots.min, STARTER.bots.base + STARTER.bots.perActive * activePeople));
