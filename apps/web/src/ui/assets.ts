import type { BuildingId, HullId, SatelliteId } from '@blindspace/rules';

/**
 * The art, mapped to the game.
 *
 * Two rules govern this file.
 *
 * ONE: installations come in tiers, and the tier is chosen by LEVEL — so raising a
 * Telescope visibly replaces the dish with a bigger one. A player should be able to
 * see their planet get stronger without reading a number, and should be able to see
 * what the NEXT level looks like before paying for it.
 *
 * TWO: nothing is ever borrowed. A render that means one thing must not be used to
 * stand for another, however convenient — a Bastion drawn as a ship would state the
 * one thing about it that is false.
 */

const BASE = '/assets/images';

/** L1–2 → tier 1, L3–4 → tier 2, L5+ → tier 3. */
export const tierOf = (level: number): 1 | 2 | 3 => (level >= 5 ? 3 : level >= 3 ? 2 : 1);

export const RESOURCE_ART = {
  alloy: `${BASE}/resources/alloy.png`,
  crystal: `${BASE}/resources/crystal.png`,
} as const;

/* ── planets ────────────────────────────────────────────────── */

const PLANET_COUNT = 16;

const hash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

/**
 * Which world a planet is, forever.
 *
 * Derived from the id, so a planet looks the same to its owner and to everyone
 * watching it — a planet whose appearance drifted between screens would be a
 * different planet as far as the player's memory is concerned, and this game is
 * built on remembering who is who.
 */
export const planetArt = (planetId: string): string =>
  `${BASE}/planets/planet_${String((hash(planetId) % PLANET_COUNT) + 1)}.png`;

/* ── hulls ──────────────────────────────────────────────────── */

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
 * Real geometry, where it exists.
 *
 * The 2D renders stay: they are what the shipyard and the panels use, and they are
 * better at panel size than a model would be. This is only for the galaxy, where a
 * craft is seen from every angle as the camera moves and a billboard starts to
 * give itself away.
 */
export const MODEL = {
  probe: '/assets/models/ships/explorer_ship.glb',
  wasp: '/assets/models/ships/ship_1.glb',
} as const;

/* ── satellites and buildings ───────────────────────────────── */

/**
 * Telescope, Radar and Aegis are ground installations with three tiers each.
 * Veil rides on a satellite body; the Drill and the Ring have their own art.
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
      return `${BASE}/general/drill.png`;
  }
}

/**
 * The art one level from now — or null when nothing visibly changes.
 *
 * This is the anticipation hook: "at L3 your telescope becomes THAT". A tech tree
 * that only ever shows what you already own is a list of receipts.
 */
export function nextSatelliteArt(type: SatelliteId, level: number): string | null {
  if (tierOf(level) === tierOf(level + 1)) return null;
  return satelliteArt(type, level + 1);
}

export const BUILDING_ART: Record<BuildingId, string | null> = {
  CORE: null,
  REFINERY: RESOURCE_ART.alloy,
  EXTRACTOR: RESOURCE_ART.crystal,
  VAULT: null,
  SHIPYARD: null,
  RING: `${BASE}/general/orbital_ring.png`,
};

/** Small orbital bodies drawn around the planet — one per installed satellite. */
export const ORBITAL_ART: Record<SatelliteId, string> = {
  TELESCOPE: `${BASE}/sattelites/sattelite_type_1.png`,
  RADAR: `${BASE}/sattelites/sattelite_type_3.png`,
  VEIL: `${BASE}/sattelites/sattelite_type_2.png`,
  DRILL: `${BASE}/general/drill.png`,
  AEGIS: `${BASE}/sattelites/sattelite_type_4.png`,
};
