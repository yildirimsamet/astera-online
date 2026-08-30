import type { Resources } from './types.js';

/**
 * THE ECONOMY TEMPO, IN ONE PLACE.
 *
 * Astera used to describe an implicit x1.20 speed-up in several docblocks while
 * the actual levers lived as unrelated literals across production, prices and
 * queues. That made "slow the game down" a repository-wide treasure hunt and,
 * worse, made it easy to move one ratio without the constants derived from it.
 *
 * These are relative to the Economy v2 baseline, not arbitrary world-speed
 * multipliers. Different systems deliberately use different scales:
 *
 *   - upgrade prices start 5% dearer and use a 1.54 rung curve;
 *   - fixed metal purchases are 70% dearer;
 *   - passive Alloy/Crystal output is 30% lower;
 *   - ordinary hulls are 25% dearer and take 50% longer to craft;
 *   - construction has its own calibrated curve so both L11 -> L12 and
 *     L12 -> L13 take between one and two hours;
 *   - ground defence stays faster because a Radar warning must still buy time to
 *     arm, and probes stay cheap because looking is the opening action.
 *
 * `pnpm balance:economy` prints the full derivation, profile sweep, storage risk,
 * hull timings and deterministic progression scenarios behind these figures.
 */
export const ECONOMY_TEMPO = {
  passiveIncome: 0.70,
  upgradePrice: 1.05,
  upgradeGrowth: 1.54,
  hullPrice: 1.25,
  fixedPrice: 1.70,
  /** The Uplink is the information layer's entry door, not a passive multiplier. */
  gatewayPrice: 1.25,
  /** Keep contested-material sinks stable until the planned refinery is modelled. */
  deuteriumPrice: 1.30,

  /** Keeps stock raidable while a developed Vault can still fund every legal upgrade. */
  storageHours: 1.10,

  /** Price and throughput move together, preserving the approved L12 timer. */
  constructionBase: 40,
  constructionPerCore: 0.20,
  yardBase: 260,
  /** Panic defence is constrained by the first timed Radar warning. */
  defenceBase: 1320,
  /** Research has its own workload, so construction calibration cannot slow it accidentally. */
  researchWork: 0.62,
  buildCapMinutes: 8 * 60,
} as const;

export const scalePrice = (value: number, scale: number): number =>
  Math.round(value * scale);

export const scaleResources = (resources: Resources, scale: number): Resources => ({
  alloy: scalePrice(resources.alloy, scale),
  crystal: scalePrice(resources.crystal, scale),
  deuterium: scalePrice(resources.deuterium, scale),
});
