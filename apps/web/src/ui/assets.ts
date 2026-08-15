import type { BuildingId, HullId, SatelliteId } from '@blindspace/rules';

/**
 * The art, mapped to the game.
 *
 * Installations come in three tiers, and the tier is chosen by LEVEL — so raising
 * a Telescope visibly replaces the dish with a bigger one. That is the cheapest
 * progression feedback available: the player sees their planet change, rather than
 * reading that a number went up.
 */

const BASE = '/assets/images';

/** L1–2 → tier 1, L3–4 → tier 2, L5+ → tier 3. */
export const tierOf = (level: number): 1 | 2 | 3 => (level >= 5 ? 3 : level >= 3 ? 2 : 1);

export const RESOURCE_ART = {
  alloy: `${BASE}/resources/alloy.png`,
  crystal: `${BASE}/resources/crystal.png`,
} as const;

export const HULL_ART: Record<HullId, string | null> = {
  WASP: `${BASE}/ships/ship_1.png`,
  LANCE: `${BASE}/ships/ship_2.png`,
  BULWARK: `${BASE}/ships/ship_3.png`,
  HAULER: `${BASE}/ships/ship_4.png`,
  // No art yet — a ground turret is not a ship, and borrowing a hull render would
  // say the one thing about a Bastion that is false: that it can leave.
  BASTION: null,
};

export const PROBE_ART = `${BASE}/ships/explorer_ship.png`;

/**
 * Telescope, Radar and Aegis are ground installations and have tiered renders.
 * Veil and Drill are orbital hardware, so they use the satellite bodies.
 */
export function satelliteArt(type: SatelliteId, level: number): string {
  const tier = tierOf(level);
  switch (type) {
    case 'TELESCOPE':
      return `${BASE}/general/telescope_${String(tier)}.png`;
    case 'RADAR':
      return `${BASE}/general/radar_${String(tier)}.png`;
    case 'AEGIS':
      return `${BASE}/general/shield_${String(tier)}.png`;
    case 'VEIL':
      return `${BASE}/sattelites/sattelite_type_2.png`;
    case 'DRILL':
      return `${BASE}/sattelites/sattelite_type_4.png`;
  }
}

/** Small orbital bodies drawn around the planet — one per installed satellite. */
export const ORBITAL_ART: Record<SatelliteId, string> = {
  TELESCOPE: `${BASE}/sattelites/sattelite_type_1.png`,
  RADAR: `${BASE}/sattelites/sattelite_type_3.png`,
  VEIL: `${BASE}/sattelites/sattelite_type_2.png`,
  DRILL: `${BASE}/sattelites/sattelite_type_4.png`,
  AEGIS: `${BASE}/general/shield_1.png`,
};

/**
 * Buildings have no art of their own yet. Rather than borrow a render that means
 * something else, they are drawn as marks — see `BuildingMark`.
 */
export const BUILDING_ART: Record<BuildingId, string | null> = {
  CORE: null,
  REFINERY: RESOURCE_ART.alloy,
  EXTRACTOR: RESOURCE_ART.crystal,
  VAULT: null,
  SHIPYARD: null,
  RING: null,
};
