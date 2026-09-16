import type { Resources } from './types.js';

/** Owner's post-147deca 30% experiment: replaces 25%, not compounded on top of it. */
export const ECONOMY_ADJUSTMENT = {
  hullMetalPrice: 1.30,
  producerOutput: 0.70,
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
   * THE ONE DIAL EVERY TIMER IN THE GAME IS MULTIPLIED BY.
   *
   * `1.30 x 0.75 = 0.975`. Owner instruction, 2026-09-14: *"Üretilen veya
   * araştırılan her şeyin yapım süresini %25 azalt."* Both halves are still live
   * decisions — the 30% slow-down is the standing tempo and the quarter is the
   * reduction on top of it — but the DERIVATION belongs in this sentence rather
   * than in the expression: `1.30 * 0.75` evaluates to 0.9750000000000001 in
   * binary floating point, and a dial every timer in the game multiplies by is the
   * last place to leave a trailing bit for a later equality check to trip over.
   *
   * IT REACHES SEVEN QUOTES AND NO MORE: `buildMinutes`, `satelliteMinutes`,
   * `buildingMinutes`, `shipMinutes`, `defenceMinutes`, `researchMinutes` and
   * `DEATH_STAR.buildMinutes`. Flight time, event windows, mining turnaround,
   * Telescope repoint, disruption and recovery are deliberately outside it: they
   * are not WORK, and shortening them would be a different decision wearing this
   * one's clothes.
   *
   * THE CEILING MOVES WITH IT, AND THAT IS THE PROPERTY THAT MAKES THE CHANGE ONE
   * LINE. `BUILD.capMinutes` is itself `ECONOMY_TEMPO.buildCapMinutes x buildTime`,
   * so every quote reduces to `buildTime x min(480, work)` whether it clamps before
   * the multiplication (`buildingMinutes`, off authored minutes) or after it
   * (`buildMinutes`, `shipMinutes`, `defenceMinutes`, `researchMinutes`, off price).
   * A capped order therefore shortens by the same quarter as an uncapped one: the
   * effective eight-hour ceiling falls from 624 to 468 minutes before AI Robots.
   */
  buildTime: 0.975,
} as const;

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
