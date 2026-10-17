import { UNKNOWN_SIGNAL } from './constants.js';
import { COSMETICS, type CosmeticId } from './cosmeticCatalog.js';
import { HULLS, MOBILE_HULLS } from './hulls.js';
import { radarContactRange } from './intel.js';
import { seededFrom } from './rng.js';
import { distance } from './travel.js';
import type { MobileHullId, Resources, Rng, Vec3 } from './types.js';

export type UnknownSignalTier = typeof UNKNOWN_SIGNAL.tiers[number];
export type UnknownSignalWarshipHull = typeof UNKNOWN_SIGNAL.warshipHulls[number];
export type UnknownSignalOutcome =
  | { kind: 'RESOURCES'; loot: Resources }
  | { kind: 'ENERGY'; hours: typeof UNKNOWN_SIGNAL.energyHours[number] }
  | { kind: 'DERELICT'; hull: MobileHullId; damageBp: number }
  | { kind: 'PIRATES' }
  | { kind: 'SKIN'; cosmeticId: CosmeticId };

const OUTCOMES = ['RESOURCES', 'ENERGY', 'DERELICT', 'PIRATES', 'SKIN'] as const;
const SKIN_CATEGORIES = ['FLAG', 'PLANET_ELEMENT', 'RING'] as const;
const SKIN_POOLS = {
  FLAG: COSMETICS.filter(item => item.category === 'FLAG' && !item.free).map(item => item.id),
  PLANET_ELEMENT: COSMETICS.filter(item => UNKNOWN_SIGNAL.planetElementSkins.some(id => id === item.id)).map(item => item.id),
  RING: COSMETICS.filter(item => item.category === 'RING').map(item => item.id),
};
const DERELICT_HULLS = MOBILE_HULLS.filter(id => {
  const hull = HULLS[id];
  return hull.tier !== null && hull.tier <= 3 && (hull.family === 'OFFENSIVE' || hull.family === 'DEFENSIVE');
});

function pick<T>(values: readonly T[], rng: Rng): T {
  const value = values[Math.floor(rng() * values.length)];
  if (value === undefined) throw new RangeError('Unknown signal reward pool is empty');
  return value;
}

function weighted<T>(entries: readonly (readonly [T, number])[], rng: Rng): T {
  let roll = rng() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  throw new RangeError('Unknown signal reward weights are invalid');
}

function integer(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Independent stream so exhausting the skin pool awards exactly this seed's resource roll. */
export function rollUnknownSignalResources(seed: string | number): Resources {
  const rng = seededFrom('unknown-signal:resources:v1', seed);
  const limits = UNKNOWN_SIGNAL.resources;
  const subset = integer(1, 7, rng);
  const alloy = (subset & 1) !== 0 ? limits.alloyMin : 0;
  const crystal = (subset & 2) !== 0 ? limits.crystalMin : 0;
  const deuterium = (subset & 4) !== 0 ? limits.deuteriumMin : 0;
  const minSum = alloy + crystal + deuterium;
  const max = alloy + crystal === 0 ? limits.deuteriumMax : limits.totalMax;
  const extra = integer(minSum, max, rng) - minSum;
  const weightA = alloy > 0 ? 1 - rng() : 0;
  const weightC = crystal > 0 ? 1 - rng() : 0;
  const weightD = deuterium > 0 ? 1 - rng() : 0;
  const totalWeight = weightA + weightC + weightD;
  const extraD = alloy + crystal === 0 ? extra
    : Math.min(limits.deuteriumMax - deuterium, Math.floor(extra * weightD / totalWeight));
  const remaining = extra - extraD;
  // Capping deuterium before splitting the remainder sends all overflow to the other resources.
  const extraA = alloy === 0 ? 0 : crystal === 0 ? remaining
    : Math.floor(remaining * weightA / (weightA + weightC));
  const extraC = crystal > 0 ? remaining - extraA : 0;
  return {
    alloy: Math.floor((alloy + extraA) / 10) * 10,
    crystal: Math.floor((crystal + extraC) / 10) * 10,
    deuterium: deuterium + extraD,
  };
}

/** Server-only seed and arrival-time account ownership; the client never rolls a reward. */
export function rollUnknownSignalOutcome(
  seed: string | number,
  tierAtDispatch: UnknownSignalTier,
  ownedSkinIds: readonly string[],
): UnknownSignalOutcome {
  const rng = seededFrom('unknown-signal:outcome:v1', seed);
  const kind = weighted(OUTCOMES.map(value => [value, UNKNOWN_SIGNAL.outcomeWeights[value]] as const), rng);
  switch (kind) {
    case 'RESOURCES': return { kind, loot: rollUnknownSignalResources(seed) };
    case 'ENERGY': return { kind, hours: pick(UNKNOWN_SIGNAL.energyHours, rng) };
    case 'PIRATES': return { kind };
    case 'DERELICT': {
      const tier = Number(weighted(Object.entries(UNKNOWN_SIGNAL.derelictTierWeights[tierAtDispatch]), rng));
      const hull = pick(DERELICT_HULLS.filter(id => HULLS[id].tier === tier), rng);
      const [min, max] = UNKNOWN_SIGNAL.derelictDamagePct;
      return { kind, hull, damageBp: integer(min * 100, max * 100, rng) };
    }
    case 'SKIN': {
      const category = weighted(SKIN_CATEGORIES.map(value => [value, UNKNOWN_SIGNAL.skinCategoryWeights[value]] as const), rng);
      const owned = new Set(ownedSkinIds);
      const unowned = (value: typeof category) => SKIN_POOLS[value].filter(id => !owned.has(id));
      const preferred = unowned(category);
      if (preferred.length > 0) return { kind, cosmeticId: pick(preferred, rng) };
      for (const fallback of SKIN_CATEGORIES) {
        const pool = unowned(fallback);
        if (pool.length > 0) return { kind, cosmeticId: pick(pool, rng) };
      }
      return { kind: 'RESOURCES', loot: rollUnknownSignalResources(seed) };
    }
  }
}

/** Exact manifest, including refusing extra zero-count entries rather than silently discarding them. */
export function validateUnknownSignalFleet(fleet: Readonly<Record<string, number | undefined>>): boolean {
  const entries = Object.entries(fleet);
  return entries.length === 2
    && entries.every(([, count]) => count === 1)
    && Object.hasOwn(fleet, UNKNOWN_SIGNAL.cargoHull)
    && UNKNOWN_SIGNAL.warshipHulls.some(hull => Object.hasOwn(fleet, hull));
}

/** Uniform volume around the capital, matching generateGalaxy's spherical game coordinates. */
export function placeUnknownSignal(
  seed: string | number,
  capital: Vec3,
  planets: readonly Vec3[],
  radarLevel: number,
  galaxyRadius: number,
): Vec3 | null {
  const rng = seededFrom('unknown-signal:placement:v1', seed);
  const range = radarContactRange(Math.max(UNKNOWN_SIGNAL.noRadarRangeLevel, radarLevel));
  const inner = UNKNOWN_SIGNAL.minFromCapital ** 3;
  for (let attempt = 0; attempt < UNKNOWN_SIGNAL.placementAttempts; attempt++) {
    const radius = Math.cbrt(inner + rng() * (range ** 3 - inner));
    const angle = rng() * Math.PI * 2;
    const vertical = rng() * 2 - 1;
    const planar = Math.sqrt(1 - vertical ** 2);
    const at = {
      x: capital.x + radius * planar * Math.cos(angle),
      y: capital.y + radius * vertical,
      z: capital.z + radius * planar * Math.sin(angle),
    };
    const fromCapital = distance(capital, at);
    if (!(fromCapital >= UNKNOWN_SIGNAL.minFromCapital && fromCapital <= range)) continue;
    if (!(Math.hypot(at.x, at.y, at.z) <= galaxyRadius)) continue;
    if (planets.some(planet => distance(at, planet) < UNKNOWN_SIGNAL.minFromAnyPlanet)) continue;
    return at;
  }
  return null;
}
