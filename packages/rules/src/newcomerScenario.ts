import { orbitThrough } from './personalRocks.js';
import type { PirateLevel, PirateSpec } from './pirates.js';
import type { Fleet, Resources, Vec3 } from './types.js';

/**
 * İNİŞ SONRASI İLK SAAT GÖREVLERİ (plan 2026-11-20 §4, §5.3, Faz 4; playtest 2026-11-23).
 *
 * Authentic, player-driven onboarding in the main galaxy:
 *   LANDING → MINE → PIRATE → PROBE → WRAP_UP → DONE (or DISMISSED).
 *
 * Every action is performed by the player through the real game UI and real engines
 * (mining, pirate raiding with zero player losses on the personal pirate, planetary probing).
 */
export const NEWCOMER_SCENARIO_STEPS = [
  'LANDING',
  'MINE',
  'PIRATE',
  'PROBE',
  'WRAP_UP',
  'DONE',
] as const;

export type NewcomerScenarioStep = (typeof NEWCOMER_SCENARIO_STEPS)[number] | 'DISMISSED';

const PIRATE_LEVEL: PirateLevel = 1;
const PIRATE_ROSTER: Fleet = { DART: 2 };
const PIRATE_HOARD: Resources = { alloy: 300, crystal: 150, deuterium: 0 };

export const NEWCOMER_SCENARIO = {
  steps: NEWCOMER_SCENARIO_STEPS,
  /** Distance from capital in game units: visible right beside the capital, 30–42s real flight. */
  pirateDistance: 320,
  /** Bearing from capital-to-galaxy-centre, clear of personal rocks (0.75, -1.15). */
  pirateBearing: -0.35,
  /** Slow closed orbit so the pirate drifts beside the capital instead of crossing the disc. */
  pirateSpeed: 3,
  /** Weak level-1 pirate crew: easily beaten by starter 3 Darts + 1 Warden. */
  pirateLevel: PIRATE_LEVEL,
  pirateRoster: PIRATE_ROSTER,
  /** Fixed symbolic hoard, carried home by the raiding fleet via normal pirate loot rules. */
  pirateHoard: PIRATE_HOARD,
  /**
   * The crew waits for its commander until beaten (review 2026-11-23): the card asks for this pirate
   * for as long as the step lasts, so it outlives any season rather than leave the step with nothing to hit.
   */
  pirateLifeMinutes: 365 * 24 * 60,
  /** Short delay (minutes) before the first regular unknown signal after onboarding ends/dismisses. */
  postScenarioSignalGapMinutes: [1, 2],
} as const;

/**
 * Effective fleet speed (game units/min) when flying against the newbie personal pirate (`index < 0`),
 * so both outbound and return legs take ~30–42 seconds with the starter fleet (playtest 2026-11-23).
 */
export const personalPirateFleetSpeed = (baseSpeed: number): number =>
  Math.max(baseSpeed * 4, 580);

export const isScenarioActive = (step: NewcomerScenarioStep): boolean =>
  step !== 'DONE' && step !== 'DISMISSED';

export function canAdvanceScenario(current: NewcomerScenarioStep, next: NewcomerScenarioStep): boolean {
  if (!isScenarioActive(current)) return false;
  const steps: readonly NewcomerScenarioStep[] = NEWCOMER_SCENARIO_STEPS;
  const idx = steps.indexOf(current);
  return idx >= 0 && steps.indexOf(next) === idx + 1;
}

/**
 * A real game pirate placed on a slow closed orbit beside the player's capital, visible and
 * targetable only to that commander until defeated or expired.
 */
export function personalPirateSpec(capital: Vec3, spawnedMinutes: number): Omit<PirateSpec, 'index'> {
  const toCentre = Math.atan2(-capital.z, -capital.x);
  const bearing = toCentre + NEWCOMER_SCENARIO.pirateBearing;
  const at = {
    x: capital.x + NEWCOMER_SCENARIO.pirateDistance * Math.cos(bearing),
    y: capital.y,
    z: capital.z + NEWCOMER_SCENARIO.pirateDistance * Math.sin(bearing),
  };
  return {
    ...orbitThrough(at, spawnedMinutes, NEWCOMER_SCENARIO.pirateSpeed),
    level: NEWCOMER_SCENARIO.pirateLevel,
    roster: { ...NEWCOMER_SCENARIO.pirateRoster },
    hoard: { ...NEWCOMER_SCENARIO.pirateHoard },
    appearsAt: spawnedMinutes,
    expiresAt: spawnedMinutes + NEWCOMER_SCENARIO.pirateLifeMinutes,
  };
}
