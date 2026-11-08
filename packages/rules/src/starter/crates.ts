import type { VesselFact, VesselModule, VesselProgress } from './ladder.js';
import { moduleStage } from './ladder.js';

export interface StarterCrate {
  id: string;
  /** The bay it stands in, sealed until this repair is done. */
  module: VesselModule;
  stage: number;
  /** An act's crate waits for the act as well; a repair's crate asks for nothing more. */
  fact: VesselFact | null;
  reward: { alloy: number; crystal: number };
}

const crate = (module: VesselModule, stage: number, alloy: number, crystal: number): StarterCrate =>
  ({ id: `${module}:${String(stage)}`, module, stage, fact: null, reward: { alloy, crystal } });

/**
 * KURTARMA KASALARI (docs/ilk-deneyim-elde-tutma-plani §6.2). A sealed crate in a system's bay opens
 * when that system's repair is done. The amounts pay the guided road's shortfall and no more: the first
 * session reaches the Shipyard and the third extractor without waiting on the store, and the first day
 * reaches the telescope (`starter-first-session`). The first day's crates are crystal, the resource the
 * Extractor cannot keep up with. They pay for an act, never for waiting, and what is left of them is
 * still held to the jump's hold (`STARTER.carry`).
 *
 * The main galaxy's reward panel claims these, so a commander learns that panel aboard.
 */
export const STARTER_CRATES: readonly StarterCrate[] = [
  crate('REFINERY', 2, 150, 40),
  // The sensors' road is paid here (owner 2026-11-08, N11): the third refinery's 800/300, split so that
  // the store does not run dry on the road's far side. The sum is unchanged.
  crate('TELESCOPE', 1, 650, 200),
  crate('RADAR', 1, 150, 100),
  crate('SURVEY', 1, 300, 150),
  crate('SHIPYARD', 1, 250, 200),
  /**
   * THE FIRST VICTORY'S (owner 2026-11-08, N9). An outpost gives what the surviving holds carry, so a
   * first hunt costs more ships than it brings home; this pays them back on the dearest of its roads
   * (`starter-victory-crate`). It stands in the yard's bay, the yard that built the fleet.
   */
  { id: 'FIRST_OUTPOST_VICTORY', module: 'SHIPYARD', stage: 1, fact: 'FIRST_OUTPOST_VICTORY', reward: { alloy: 450, crystal: 200 } },
  /** The first fight not won (owner 2026-11-09): one more Dart to try again with, and the hunt goes on. */
  { id: 'FIRST_OUTPOST_DEFEAT', module: 'SHIPYARD', stage: 1, fact: 'FIRST_OUTPOST_DEFEAT', reward: { alloy: 310, crystal: 125 } },
  crate('EXTRACTOR', 3, 100, 250),
  crate('SURVEY', 2, 150, 250),
];

const unsealed = (c: StarterCrate, progress: VesselProgress): boolean =>
  moduleStage(progress, c.module) >= c.stage && (c.fact === null || progress.facts.includes(c.fact));

/** Crates whose repair (and act) is done and that this ship has not opened yet, in bay order. */
export const readyCrates = (progress: VesselProgress, opened: readonly string[]): StarterCrate[] =>
  STARTER_CRATES.filter(c => unsealed(c, progress) && !opened.includes(c.id));

export type CrateState = 'sealed' | 'ready' | 'opened';

export interface CrateView { id: string; module: VesselModule; stage: number; fact: VesselFact | null; alloy: number; crystal: number; state: CrateState }

const stateOf = (c: StarterCrate, progress: VesselProgress, opened: readonly string[]): CrateState =>
  opened.includes(c.id) ? 'opened' : unsealed(c, progress) ? 'ready' : 'sealed';

/** Every crate as the ship screen draws it: its bay, its purse, and whether it is still sealed. */
export const crateStates = (progress: VesselProgress, opened: readonly string[]): CrateView[] =>
  STARTER_CRATES.map(c => ({ id: c.id, module: c.module, stage: c.stage, fact: c.fact, alloy: c.reward.alloy, crystal: c.reward.crystal, state: stateOf(c, progress, opened) }));
