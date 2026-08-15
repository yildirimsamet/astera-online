import type { BuildingId, HullId, SatelliteId } from '@blindspace/rules';

/**
 * Every name and one-line role the player reads, in one place.
 *
 * The rule for these lines: say what the thing *decides*, not what it is. "Level
 * ceiling for everything else" tells a player why they are about to spend; "the
 * main building" tells them nothing.
 */

export const BUILDING_ORDER: readonly BuildingId[] = [
  'CORE',
  'REFINERY',
  'EXTRACTOR',
  'VAULT',
  'SHIPYARD',
  'RING',
];

export const BUILDING_NAME: Record<BuildingId, string> = {
  CORE: 'Command Core',
  REFINERY: 'Alloy Refinery',
  EXTRACTOR: 'Crystal Extractor',
  VAULT: 'Vault',
  SHIPYARD: 'Shipyard',
  RING: 'Orbital Ring',
};

export const BUILDING_ROLE: Record<BuildingId, string> = {
  CORE: 'Level ceiling for everything else',
  REFINERY: 'Alloy per hour, and alloy storage',
  EXTRACTOR: 'Crystal per hour, and crystal storage',
  VAULT: 'Stock a raid can never reach',
  SHIPYARD: 'Unlocks hulls · sets probe accuracy and stealth',
  RING: 'One satellite slot per two levels',
};

export const SATELLITE_ORDER: readonly SatelliteId[] = [
  'TELESCOPE',
  'RADAR',
  'AEGIS',
  'VEIL',
  'DRILL',
];

export const SATELLITE_NAME: Record<SatelliteId, string> = {
  TELESCOPE: 'Telescope',
  RADAR: 'Radar',
  AEGIS: 'Aegis',
  VEIL: 'Veil',
  DRILL: 'Drill',
};

export const SATELLITE_ROLE: Record<SatelliteId, string> = {
  TELESCOPE: 'Watch one more planet per level. Silent — nobody is told.',
  RADAR: 'Catches probes. From L3, warns of an inbound fleet.',
  AEGIS: 'Shield HP, regenerating 5% an hour.',
  VEIL: "Degrades what anyone's telescope can read about you.",
  DRILL: 'Mines passing asteroids.',
};

/**
 * Asteroid impacts are generated but never scheduled, and no mining exists — so a
 * Drill would cost resources and do nothing. It is shown, disabled, with the
 * reason: hiding it would be a quieter lie than saying so.
 */
export const SATELLITE_UNAVAILABLE: Partial<Record<SatelliteId, string>> = {
  DRILL: 'Asteroid mining is not built yet — a Drill would do nothing.',
};

export const HULL_ORDER: readonly HullId[] = ['WASP', 'LANCE', 'BULWARK', 'HAULER', 'BASTION'];

export const HULL_ROLE: Record<HullId, string> = {
  WASP: 'Cheapest attack, fastest out and back',
  LANCE: 'Highest attack · strong into Wasps, weak into Bulwarks',
  BULWARK: 'The durability anchor · slow enough to double your exposure',
  HAULER: 'Carries the loot home · contributes nothing to the fight',
  BASTION: 'Ground defence · cannot ever leave the planet',
};

export const UNLOCK_NAME = {
  TELESCOPE: 'Telescope',
  RADAR: 'Radar',
  EXPLORER: 'Explorer',
  VEIL: 'Veil',
} as const;
