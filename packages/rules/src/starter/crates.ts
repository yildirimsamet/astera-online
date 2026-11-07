import type { VesselModule, VesselProgress } from './ladder.js';
import { moduleStage } from './ladder.js';

export interface StarterCrate {
  id: string;
  module: VesselModule;
  stage: number;
  reward: { alloy: number; crystal: number };
}

const crate = (module: VesselModule, stage: number, alloy: number, crystal: number): StarterCrate =>
  ({ id: `${module}:${String(stage)}`, module, stage, reward: { alloy, crystal } });

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
  crate('SURVEY', 1, 300, 150),
  crate('REFINERY', 3, 800, 300),
  crate('SHIPYARD', 1, 250, 200),
  crate('EXTRACTOR', 3, 100, 250),
  crate('SURVEY', 2, 150, 250),
];

/** Crates whose repair is done and that this ship has not opened yet, in bay order. */
export const readyCrates = (progress: VesselProgress, opened: readonly string[]): StarterCrate[] =>
  STARTER_CRATES.filter(c => moduleStage(progress, c.module) >= c.stage && !opened.includes(c.id));

export type CrateState = 'sealed' | 'ready' | 'opened';

export interface CrateView { id: string; module: VesselModule; stage: number; alloy: number; crystal: number; state: CrateState }

const stateOf = (c: StarterCrate, progress: VesselProgress, opened: readonly string[]): CrateState =>
  opened.includes(c.id) ? 'opened' : moduleStage(progress, c.module) >= c.stage ? 'ready' : 'sealed';

/** Every crate as the ship screen draws it: its bay, its purse, and whether it is still sealed. */
export const crateStates = (progress: VesselProgress, opened: readonly string[]): CrateView[] =>
  STARTER_CRATES.map(c => ({ id: c.id, module: c.module, stage: c.stage, alloy: c.reward.alloy, crystal: c.reward.crystal, state: stateOf(c, progress, opened) }));
