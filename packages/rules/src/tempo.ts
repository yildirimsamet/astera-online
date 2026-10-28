import type { Resources, ShipTier } from './types.js';

/** Next-season source defaults. Deploy only after the old worlds are sealed; see
 * docs/season-60-tempo-transition-plan.md. Hull pricing retains the 30% experiment. */
export const ECONOMY_ADJUSTMENT = {
  hullMetalPrice: 1.30,
  /** 60-day season: 15% below the current 0.56 hourly output at every level. */
  producerOutput: 0.56 * 0.85,
  /** Preserve resource capacities; also restores the frozen 0.70 pre-cutover income. */
  producerCapacityTime: 1.25 / 0.85,
  /** Colony repair duration rises 15%, matching ordinary queue work. */
  workRate: 0.8 / 1.15,
  /**
   * Owner instruction, 2026-09-13: a temporary lift on the early Alloy ladder.
   *
   * IT TAPERS RATHER THAN STOPPING, AND THAT IS THE WHOLE OF IT. The lift shipped
   * as two flat bands with an edge — 1.25x through L6, 1.15x through L9, nothing
   * from L10 — and the edge was steeper than the curve underneath it:
   * `9^1.3 x 1.15 > 10^1.3`, so Refinery 9 -> 10 sold LESS alloy an hour than the
   * commander already had, and shrank the store with it, at the dearest price on
   * the ladder so far. Owner report, 2026-09-15: *"hem saatlik üretim miktarı
   * artmıyor hem de depo düşüyor"*.
   *
   * So the lift is flat to `earlyAlloyMaxLevel` and then decays linearly to 1.00 at
   * `alloyLiftEndLevel`, paying itself back over rungs whose own step (12-16%) is
   * large enough to swallow it. L10 onward is untouched profile income, which is
   * the property worth keeping: this is a shape on the OPENING, not a change to the
   * economy the rest of the game is measured against.
   *
   * `invariants.test.ts` holds the rule this broke — no rung may pay less than the
   * one below it — on the composition rather than on these figures, so a later
   * retune cannot reintroduce the edge.
   */
  earlyAlloyOutputMultiplier: 1.25,
  earlyAlloyMaxLevel: 6,
  /** The first rung with no lift left on it. Between the two, the lift decays. */
  alloyLiftEndLevel: 10,
  /**
   * Shared work timer: the 60-day season adds 15% to the current 1.21875 dial.
   * Buildings, instruments, satellites, research, hulls, ground defence and ship
   * repairs inherit it. Existing capped work rises from 585 to 672.75 minutes.
   * Flight, event, recovery and cooldown clocks are separate from production work.
   */
  buildTime: 1.21875 * 1.15,
  /** Death Star and Radiation Bomb manufacturing retain their existing timers. */
  strategicBuildTime: 1.21875,
} as const;

/** Shift a live hull invoice toward crystal without changing its 1:2 economic value. */
const HULL_CRYSTAL_MULTIPLIER: Record<ShipTier, number> = {
  1: 1.55,
  2: 1.40,
  3: 1.30,
  4: 1.25,
};

export function rebalanceHullPrice(alloy: number, crystal: number, tier: ShipTier | null) {
  const multiplier = tier === null ? 1.25 : HULL_CRYSTAL_MULTIPLIER[tier];
  const shiftedCrystal = Math.round(crystal * multiplier);
  return { alloy: alloy - 2 * (shiftedCrystal - crystal), crystal: shiftedCrystal };
}

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
 *   - passive output is 30% lower, with Alloy lifted 25% through L1–6 and the lift
 *     decaying back to nothing by L10;
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
  /** Crystal-bearing hulls pay an additional 15%; zero-Crystal hulls stay zero. */
  hullCrystalPrice: 1.25 * 1.15,
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
