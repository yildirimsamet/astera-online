/**
 * AY (MOON). Owner design 2026-11-18/19, `docs/ay-plani-2026-11-18.md` (S1–S56);
 * build plan `docs/ay-entegrasyon-plani-2026-11-19.md` §5.
 *
 * Pure rules only: the server, the simulator and the client read the same tables, so a
 * rarity, a crack or a birth roll can never mean one thing on a phone and another on
 * the worker.
 */
import { missionFuel } from './fuel.js';
import { hashSeed, mulberry32 } from './rng.js';
import type { NeutralSlot } from './strategic.js';
import type { Fleet } from './types.js';

export type MoonRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
/** A world is two bodies once it has a moon; every fleet stands on exactly one of them. */
export type WorldBody = 'PLANET' | 'MOON';
export type FleetSizeClass = 'LIGHT' | 'MEDIUM' | 'HEAVY';

/** Ascending: a later entry is always rarer (S8b). */
export const MOON_RARITIES: readonly MoonRarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const HOUR_MS = 3_600_000;

export const MOON = {
  /** Moons arrive with a season boundary, never inside one. */
  rulesetVersion: 20,
  /** Planet ↔ moon hop: airborne, counted nowhere, free (S13, S37, S49). */
  hopSeconds: 90,
  /** An attacker's planet ↔ moon switches stand this far apart (V2); the last one closes at arrival (S13). */
  retargetSpacingSeconds: 5,
  /** The gate opening: ships still stand on the departure moon until it ends (§3.4). */
  gateOpenSeconds: 10,
  /** How long a gate's flash stays on the map after the instant it happened (S16, S32). */
  flashSeconds: 60,
  scanCost: { deuterium: 30 },
  /** Lunar Capture, a Core 9 permission at an owner-set price and time (V28, 2026-11-19). */
  capture: { cost: { alloy: 20_000, crystal: 10_000, deuterium: 500 }, minutes: 240, requiredCore: 9 },
  /** A Common moon built on a world, at an owner-set price and time (V29, 2026-11-19). */
  build: { cost: { alloy: 25_000, crystal: 15_000, deuterium: 0 }, minutes: 480 },
  /** A technical guard between two scans from the same moon (§6.12). */
  scanSpacingSeconds: 3,
  /** A Death Star hit shuts gate and Gözcü (S19). */
  strikeCloseHours: 3,
  /** Cracks close this long after the LAST hit (S19). */
  crackHealHours: 24,
  /** Dock = one jump of fleet, in hangar bulk; the Hangar rungs 3/5/7/10 (S12, §4). */
  gateCapacity: { COMMON: 470, RARE: 1_550, EPIC: 3_250, LEGENDARY: 7_270 },
  gateChargeHours: { COMMON: 6, RARE: 4, EPIC: 3, LEGENDARY: 2 },
  scanRange: { COMMON: 1_500, RARE: 2_250, EPIC: 3_000, LEGENDARY: 4_000 },
  crackLimit: { COMMON: 3, RARE: 5, EPIC: 7, LEGENDARY: 9 },
  birth: {
    /** No roll under this much wreck (§3.2, measured on EU-1 2026-11-18). */
    minWreck: 10_000,
    /** 1 % per this much wreck. */
    wreckPerPercent: 5_000,
    maxChance: 0.20,
    /** Common / Rare / Epic / Legendary weights at the lowest and highest chance. */
    weightsAtMin: [60, 30, 9, 1],
    weightsAtMax: [30, 35, 25, 10],
  },
  /**
   * Seeded moons per neutral tier (S22): T1 Common/Rare, T2 Rare/Epic, T3 Epic plus one or
   * two Legendary. Listed rarest first, so a galaxy short of slots keeps its prizes.
   */
  seed: {
    1: ['RARE', 'RARE', 'RARE', 'COMMON', 'COMMON', 'COMMON', 'COMMON', 'COMMON'],
    2: ['EPIC', 'EPIC', 'EPIC', 'RARE', 'RARE', 'RARE', 'RARE'],
    3: ['EPIC', 'EPIC', 'EPIC', 'EPIC'],
    legendary: { min: 1, max: 2 },
  },
  /** Gözcü size classes, read against the player's own Common and Epic docks (V14). */
  sizeClass: { lightMax: 470, mediumMax: 3_250 },
} as const satisfies {
  gateCapacity: Record<MoonRarity, number>;
  gateChargeHours: Record<MoonRarity, number>;
  scanRange: Record<MoonRarity, number>;
  crackLimit: Record<MoonRarity, number>;
  seed: Record<1 | 2 | 3, readonly MoonRarity[]> & { legendary: { min: number; max: number } };
  [key: string]: unknown;
};

const rank = (rarity: MoonRarity): number => MOON_RARITIES.indexOf(rarity);

export const gateCapacity = (rarity: MoonRarity): number => MOON.gateCapacity[rarity];
export const gateChargeMs = (rarity: MoonRarity): number => MOON.gateChargeHours[rarity] * HOUR_MS;
export const scanRange = (rarity: MoonRarity): number => MOON.scanRange[rarity];
/** Only a Legendary Gözcü sees flights that leave or land on a moon (S20). */
export const scanPierces = (rarity: MoonRarity): boolean => rarity === 'LEGENDARY';
export const crackLimit = (rarity: MoonRarity): number => MOON.crackLimit[rarity];

/**
 * A MAIN galaxy has moons when its season was dealt ruleset 20+, or when a live season dealt before it
 * opened them from one instant (`season activate-moons`, owner 2026-11-24).
 */
export function moonsEnabled(
  season: { rulesetVersion: number; moonsStartsAt?: Date | null },
  shard: { role: 'MAIN' | 'WAITING' },
): boolean {
  return (season.rulesetVersion >= MOON.rulesetVersion || (season.moonsStartsAt ?? null) !== null) && shard.role === 'MAIN';
}

/** Read-time healing: no event or cron ever clears a crack (plan §3 ilke 4). */
/** Times are epoch milliseconds: rules never construct a clock. */
export function effectiveCracks(moon: { cracks: number; lastHitAtMs: number | null }, nowMs: number): number {
  if (moon.lastHitAtMs === null || moon.cracks <= 0) return 0;
  return nowMs - moon.lastHitAtMs >= MOON.crackHealHours * HOUR_MS ? 0 : moon.cracks;
}

export interface MoonStrike {
  cracks: number;
  lastHitAtMs: number;
  closedUntilMs: number;
  explodes: boolean;
}

export function strikeMoon(
  moon: { rarity: MoonRarity; cracks: number; lastHitAtMs: number | null },
  nowMs: number,
): MoonStrike {
  const cracks = effectiveCracks(moon, nowMs) + 1;
  return {
    cracks,
    lastHitAtMs: nowMs,
    closedUntilMs: nowMs + MOON.strikeCloseHours * HOUR_MS,
    explodes: cracks >= crackLimit(moon.rarity),
  };
}

/** `wreck` is the alloy + crystal + deuterium of the wreck BEFORE any collector takes a share (S44). */
export function moonBirthChance(wreck: number): number {
  const { minWreck, wreckPerPercent, maxChance } = MOON.birth;
  if (!Number.isFinite(wreck) || wreck < minWreck) return 0;
  return Math.min(maxChance, (wreck / wreckPerPercent) * 0.01);
}

export function birthRarityWeights(chance: number): [number, number, number, number] {
  const { weightsAtMin: lo, weightsAtMax: hi, minWreck, wreckPerPercent, maxChance } = MOON.birth;
  const minChance = (minWreck / wreckPerPercent) * 0.01;
  if (chance >= maxChance) return [...hi];
  if (chance <= minChance) return [...lo];
  const t = (chance - minChance) / (maxChance - minChance);
  return [0, 1, 2, 3].map((i) => lo[i]! + (hi[i]! - lo[i]!) * t) as [number, number, number, number];
}

/** Seeded: the same battle always rolls the same moon (`hashSeed('moon-birth', missionId)`). */
export function rollMoonBirth(seed: number, wreck: number): MoonRarity | null {
  const chance = moonBirthChance(wreck);
  if (chance === 0) return null;
  const rng = mulberry32(seed);
  if (rng() >= chance) return null;
  const weights = birthRarityWeights(chance);
  let pick = rng() * weights.reduce((sum, w) => sum + w, 0);
  for (const [i, weight] of weights.entries()) {
    pick -= weight;
    if (pick < 0) return MOON_RARITIES[i]!;
  }
  return 'LEGENDARY';
}

/** A battle moon takes the world only when it is rarer (S11). */
export function replaces(current: MoonRarity | null, born: MoonRarity): boolean {
  return current === null || rank(born) > rank(current);
}

/** Entry only is limited: ships already standing on a moon are never removed (§3.3). */
export function dockFree(rarity: MoonRarity, standingBulk: number, inboundBulk: number): number {
  return Math.max(0, gateCapacity(rarity) - standingBulk - inboundBulk);
}

/** The smallest moon on the route is the bottleneck (S12). */
export function jumpCapacity(originRarity: MoonRarity, destinationFreeDock: number): number {
  return Math.min(gateCapacity(originRarity), Math.max(0, destinationFreeDock));
}

/** The gate saves time, not fuel: the same route's homeward one-leg transfer price (S49). */
export function jumpFuel(fleet: Fleet, distance: number): number {
  return missionFuel(fleet, distance, 1, 'HOMEWARD');
}

/** Flights that leave or land on any moon are cloaked from Gözcü unless it pierces (S15, S50). */
export function gozcuSees(
  flight: { readonly originBody: WorldBody; readonly targetBody: WorldBody },
  pierces: boolean,
): boolean {
  return pierces || (flight.originBody === 'PLANET' && flight.targetBody === 'PLANET');
}

export function fleetSizeClass(bulk: number): FleetSizeClass {
  if (bulk <= MOON.sizeClass.lightMax) return 'LIGHT';
  if (bulk <= MOON.sizeClass.mediumMax) return 'MEDIUM';
  return 'HEAVY';
}

/**
 * WHICH NEUTRAL SLOTS CARRY A SEEDED MOON, keyed by slot index.
 *
 * Computed from the season seed and the WHOLE neutral selection, never from the worlds
 * open so far, so a slot the census opens on day nine gets the same moon it would have
 * had on day one. Each tier's slots are ordered by their own hash, not by position.
 */
export function seedMoonPlan(seed: number, neutrals: readonly NeutralSlot[]): Map<number, MoonRarity> {
  const plan = new Map<number, MoonRarity>();
  const legendary = MOON.seed.legendary.min
    + (hashSeed(seed, 'moon-legendary') % (MOON.seed.legendary.max - MOON.seed.legendary.min + 1));
  for (const tier of [1, 2, 3] as const) {
    const rarities: MoonRarity[] = [
      ...(tier === 3 ? Array.from({ length: legendary }, () => 'LEGENDARY' as const) : []),
      ...MOON.seed[tier],
    ];
    const ordered = neutrals
      .filter((neutral) => neutral.tier === tier)
      .map((neutral) => ({ index: neutral.slot.index, key: hashSeed(seed, 'moon-seed', neutral.slot.index) }))
      .sort((a, b) => a.key - b.key || a.index - b.index);
    for (const [i, entry] of ordered.slice(0, rarities.length).entries()) plan.set(entry.index, rarities[i]!);
  }
  return plan;
}
