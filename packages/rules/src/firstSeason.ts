import type { BuildingId, Fleet, InstrumentId, Resources, SatelliteId } from './types.js';

/** A one-time account opening, independent of the local training exercise. */
export const FIRST_SEASON_START = {
  buildings: {
    CORE: 3, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1, HANGAR: 1, DEUTERIUM_PLANT: 0,
  } satisfies Record<BuildingId, number>,
  instruments: { TELESCOPE: 3, RADAR: 2, AEGIS: 1 } satisfies Partial<Record<InstrumentId, number>>,
  satellites: ['UPLINK'] satisfies SatelliteId[],
  fleet: { DART: 3, WARDEN: 1, PROSPECTOR: 1, COURIER: 1 } satisfies Fleet,
  resources: { alloy: 1500, crystal: 1000, deuterium: 50 } satisfies Resources,
  buffer: { alloy: 84, crystal: 36, deuterium: 0 } satisfies Resources,
  /**
   * Tiers already satisfied by the starting capital's initial building & instrument levels:
   * marked claimed on landing so a new commander starts with 0 pending milestone rewards and
   * earns rewards one by one as they complete tasks and upgrades in the main galaxy.
   */
  claimedRewards: ['CORE:2', 'CORE:3', 'SHIPYARD:1', 'REFINERY:2', 'EXTRACTOR:2', 'VAULT:1', 'AEGIS:1'] as const,
} as const;
