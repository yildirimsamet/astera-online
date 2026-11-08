import type { PlanetSlot } from '../galaxy.js';
import { fleetEntries } from '../hulls.js';
import { mulberry32 } from '../rng.js';
import { distance } from '../travel.js';
import type { Fleet, HullId, Rng, Vec3 } from '../types.js';
import { STARTER } from './constants.js';
import { FLATTENING, starterPoint } from './placement.js';

export interface StarterSiteSeed extends Vec3 {
  kind: 'WRECK' | 'OUTPOST';
  /** An outpost's 1–3. A wreck has one kind of danger: somebody getting there first. */
  level: number;
  stock: number;
  /** Who holds an outpost. Each has one class, and a probe report names it. */
  guard: Fleet | null;
}

const MOST_ATTEMPTS = 50_000;
const CLEAR_OF_BERTHS = 100;
const CLEAR_OF_SITES = 200;
const GUARD_CLASSES: readonly HullId[] = ['DART', 'PIKE', 'WARDEN'];
/** Keeps the seed apart from `starterSlots`, which draws from the same number. */
const SITE_SEED_SALT = 0x5175;

/**
 * THE SHARED PLACES, FIXED FOR THE GALAXY'S LIFE. Plan §3.5. Asteroids are not here: they come and
 * go with the number of active ships (`asteroidTargetPerHour`).
 */
export function starterSitePlan(seed: number, slots: readonly PlanetSlot[]): StarterSiteSeed[] {
  const { wrecks, outposts } = STARTER.sites;
  const random = mulberry32(seed ^ SITE_SEED_SALT);
  const taken: Vec3[] = [];
  const place = (): Vec3 => {
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
      const point = starterPoint(random);
      if (slots.every(slot => distance(slot, point) >= CLEAR_OF_BERTHS)
        && taken.every(site => distance(site, point) >= CLEAR_OF_SITES)) {
        taken.push(point);
        return point;
      }
    }
    throw new RangeError('no room left for a shared site');
  };

  const plan: StarterSiteSeed[] = [];
  const [low, high] = wrecks.stock;
  for (let i = 0; i < wrecks.count; i++) {
    plan.push({ kind: 'WRECK', ...place(), level: 1, stock: low + Math.floor(random() * (high - low + 1)), guard: null });
  }
  for (let i = 0; i < outposts.count; i++) {
    const level = (i % outposts.guards.length) + 1;
    // Moved along one more every full round of levels, so that no level is always the same class.
    const hull = GUARD_CLASSES[(i + Math.floor(i / outposts.guards.length)) % GUARD_CLASSES.length]!;
    plan.push({
      kind: 'OUTPOST', ...place(), level,
      stock: outposts.stock[level - 1]!,
      guard: { [hull]: outposts.guards[level - 1]! },
    });
  }
  return plan;
}

/**
 * THE FIRST HUNT'S TWO OUTPOSTS (owner 2026-11-08, N6–N7). `wall`: Sur-held, first level, which the
 * shipyard's two Darts beat. `counter`: Akıncı- or Mızrak-held, second level, which asks for the right
 * ship first. The roles read the layout every outpost already has; nothing new is invented for them.
 */
export type FirstOutpostRole = 'wall' | 'counter';

const LEVEL_OF: Readonly<Record<FirstOutpostRole, number>> = { wall: 1, counter: 2 };
const HELD_BY: Readonly<Record<FirstOutpostRole, readonly HullId[]>> = { wall: ['WARDEN'], counter: ['DART', 'PIKE'] };

function roleOf(site: { level: number; guard: Fleet | null }): FirstOutpostRole | null {
  const held = fleetEntries(site.guard ?? {}).filter(([, count]) => count > 0);
  if (held.length !== 1) return null;
  const hull = held[0]![0];
  return (['wall', 'counter'] as const).find(role => LEVEL_OF[role] === site.level && HELD_BY[role].includes(hull)) ?? null;
}

const inBand = (ship: Vec3, point: Vec3): boolean => {
  const span = distance(ship, point);
  return span >= STARTER.firstOutposts.near && span <= STARTER.firstOutposts.far;
};

/** The roles no standing outpost in the band plays for this ship yet, wall first. */
export function firstOutpostsMissing(ship: Vec3, outposts: readonly (Vec3 & { level: number; guard: Fleet | null })[]): FirstOutpostRole[] {
  const played = new Set(outposts.filter(site => inBand(ship, site)).map(roleOf));
  return (['wall', 'counter'] as const).filter(role => !played.has(role));
}

/** A free point in the band, on the map and clear of every berth and fixed site; null when there is none. */
export function firstOutpostPoint(ship: Vec3, berths: readonly Vec3[], sites: readonly Vec3[], random: Rng): Vec3 | null {
  const { near, far } = STARTER.firstOutposts;
  for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt++) {
    // A direction uniform on the sphere, flattened as the galaxy is, at a span inside the band.
    const height = random() * 2 - 1;
    const angle = random() * 2 * Math.PI;
    const flat = Math.sqrt(1 - height * height);
    const span = near + random() * (far - near);
    const point = { x: ship.x + span * flat * Math.cos(angle), y: ship.y + span * height * FLATTENING, z: ship.z + span * flat * Math.sin(angle) };
    if (!inBand(ship, point) || Math.hypot(point.x, point.y, point.z) > STARTER.radius) continue;
    if (berths.every(berth => distance(berth, point) >= CLEAR_OF_BERTHS) && sites.every(site => distance(site, point) >= CLEAR_OF_SITES)) return point;
  }
  return null;
}

/** The outpost a role is, laid out as `starterSitePlan` lays out the galaxy's own. */
export function firstOutpostSeed(role: FirstOutpostRole, at: Vec3, random: Rng): StarterSiteSeed {
  const level = LEVEL_OF[role];
  const classes = HELD_BY[role];
  const hull = classes[Math.floor(random() * classes.length)]!;
  const { guards, stock } = STARTER.sites.outposts;
  return { kind: 'OUTPOST', x: at.x, y: at.y, z: at.z, level, stock: stock[level - 1]!, guard: { [hull]: guards[level - 1]! } };
}

/** Half of those hunting, and never fewer than two, so that a thin galaxy cannot strand anyone. */
export const openPartTarget = (shipsHunting: number): number =>
  Math.max(STARTER.parts.minOpen, Math.ceil(shipsHunting / 2));

/** A ship holds what it needs and no more, or it could take parts just to keep them from others. */
export const canTakePart = (held: number): boolean => held < STARTER.parts.needed;

export function pickPartSite<T extends { hasPart: boolean }>(sites: readonly T[], random: Rng): T | null {
  const free = sites.filter(site => !site.hasPart);
  return free[Math.floor(random() * free.length)] ?? null;
}

/**
 * ROCKS PER HOUR. `planAsteroidHour` fixes the main game's own rate per player, so it cannot be
 * asked for this one: mining is deliberately scarce here or it would outrun production.
 */
export const asteroidTargetPerHour = (activeShips: number): number =>
  Math.ceil(activeShips * STARTER.sites.asteroidsPerActivePerHour);
