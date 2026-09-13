import type { HullId, Resources } from './types.js';

/**
 * Pre-D208 component prices used ONLY to admit pirates to their deterministic lane.
 * A price reduction must not re-index targets or move orbits in an active season.
 * These conservative liabilities cover the current, cheaper recipes. Raising a
 * recipe past this table requires a separately versioned pirate distribution.
 * Rewards and actual wreckage continue to use the live catalogue.
 */
export const PIRATE_ADMISSION_PRICES: Readonly<Record<HullId, Readonly<Resources>>> = {
  DART: { alloy: 300, crystal: 60, deuterium: 0 },
  PIKE: { alloy: 300, crystal: 60, deuterium: 0 },
  RAMPART: { alloy: 375, crystal: 75, deuterium: 0 },
  WARDEN: { alloy: 300, crystal: 60, deuterium: 0 },
  COURIER: { alloy: 600, crystal: 150, deuterium: 0 },
  VIPER: { alloy: 750, crystal: 180, deuterium: 8 },
  TALON: { alloy: 750, crystal: 180, deuterium: 8 },
  STRONGHOLD: { alloy: 938, crystal: 225, deuterium: 10 },
  SENTINEL: { alloy: 750, crystal: 180, deuterium: 8 },
  WAYFARER: { alloy: 1500, crystal: 400, deuterium: 12 },
  TEMPEST: { alloy: 1800, crystal: 450, deuterium: 24 },
  BALLISTA: { alloy: 1800, crystal: 450, deuterium: 24 },
  LEVIATHAN: { alloy: 2250, crystal: 563, deuterium: 30 },
  PRAETORIAN: { alloy: 1800, crystal: 450, deuterium: 24 },
  ATLAS: { alloy: 3600, crystal: 1000, deuterium: 48 },
  NULLIFIER: { alloy: 2070, crystal: 518, deuterium: 28 },
  GARBAGE_COLLECTOR: { alloy: 10000, crystal: 5000, deuterium: 0 },
  CATACLYSM: { alloy: 4500, crystal: 1200, deuterium: 80 },
  CORSAIR: { alloy: 4500, crystal: 1200, deuterium: 80 },
  CITADEL: { alloy: 5625, crystal: 1500, deuterium: 100 },
  PALADIN: { alloy: 4500, crystal: 1200, deuterium: 80 },
  ARGOSY: { alloy: 9000, crystal: 2600, deuterium: 130 },
  BASTION: { alloy: 2400, crystal: 600, deuterium: 0 },
  THORN: { alloy: 600, crystal: 150, deuterium: 0 },
  PROSPECTOR: { alloy: 600, crystal: 180, deuterium: 0 },
};
