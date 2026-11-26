import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import {
  MULTI_WORLD, distance, hashSeed, mulberry32, type BuildingId, type Fleet, type Vec3,
} from '@astera/rules';
import type { Queryable } from '../../db/client.js';
import { buildOrders, missions, neutralPlanetState, planets, units } from '../../db/schema.js';
import { colonyStanding } from '../ownership.js';
import type { BotStrength } from './personas.js';

/**
 * COLONIES, THE WAY A PERSON HOLDS THEM. Owner add-on to the bot plan, 2026-11-26 (F5,
 * docs/bot-plani-2026-11-26.md): "no colony = bot" must not be a tell. The decisions live here;
 * the turn (`brain.ts`) carries them out through the services a phone uses.
 */

/**
 * HOW MANY COLONIES THIS COMMANDER MEANS TO HOLD: 0, 1 or 2, fixed by its ordinal so the habit
 * survives every season, as persona does. An ELITE holds at least one. The Core still decides
 * how many slots are open (`colonyStanding`).
 */
export function colonyTarget(ordinal: number, strength: BotStrength): number {
  const habit = Math.min(2, Math.floor(mulberry32(hashSeed('astera:bots:colonies', ordinal))() * 3));
  return strength === 'ELITE' ? Math.max(1, habit) : habit;
}

/** Whether it still means to take a colony its Core has a slot for. */
export async function wantsColony(
  db: Queryable, playerId: string, ordinal: number, strength: BotStrength,
): Promise<boolean> {
  const standing = await colonyStanding(db, playerId);
  return standing.colonies + standing.reservations < Math.min(colonyTarget(ordinal, strength), standing.capacity);
}

/** The highest caretaker tier this commander reaches for. */
export const colonyReach = (strength: BotStrength): number => (strength === 'ELITE' ? 2 : 1);

/** What a colony is raised by, in order: production first, then the Core, then the store. */
export const COLONY_BUILD_ORDER: readonly BuildingId[] = ['REFINERY', 'EXTRACTOR', 'DEUTERIUM_PLANT', 'CORE', 'VAULT'];

/** The fleet with the settlers' Couriers left out: they stay home for the claim. */
export function withoutSettlers(fleet: Fleet): Fleet {
  const hull = MULTI_WORLD.settlement.transportHull;
  const left = Math.max(0, (fleet[hull] ?? 0) - MULTI_WORLD.settlement.transports);
  const { [hull]: _settlers, ...rest } = fleet;
  return left > 0 ? { ...rest, [hull]: left } : rest;
}

/** The colonies this commander holds. */
export async function heldColonies(db: Queryable, playerId: string): Promise<string[]> {
  const rows = await db.select({ id: planets.id }).from(planets)
    .where(and(eq(planets.controllerPlayerId, playerId), eq(planets.kind, 'COLONY')));
  return rows.map((row) => row.id);
}

/** A caretaker world whose open claim this commander's own raid reserved, if any. */
export async function heldClaim(db: Queryable, playerId: string, now: Date): Promise<string | null> {
  const [row] = await db.select({ id: neutralPlanetState.planetId }).from(neutralPlanetState)
    .innerJoin(planets, eq(planets.id, neutralPlanetState.planetId))
    .where(and(
      eq(planets.kind, 'NEUTRAL'),
      eq(neutralPlanetState.claimPriorityPlayerId, playerId),
      gt(neutralPlanetState.claimUntil, now),
    ))
    .limit(1);
  return row?.id ?? null;
}

/** Whether a raid of its own on a caretaker world is still in the air. */
export async function caretakerRaidInFlight(db: Queryable, playerId: string): Promise<boolean> {
  const [row] = await db.select({ id: missions.id }).from(missions)
    .innerJoin(planets, eq(planets.id, missions.targetPlanetId))
    .where(and(
      eq(missions.ownerPlayerId, playerId),
      eq(missions.kind, 'attack'),
      eq(missions.status, 'in_flight'),
      eq(planets.kind, 'NEUTRAL'),
    ))
    .limit(1);
  return row !== undefined;
}

export interface CaretakerWorld {
  readonly planetId: string;
  readonly distance: number;
}

/**
 * THE NEAREST CARETAKER WORLD IN REACH with no claim open on it. Tier and position are public
 * on the galaxy, so choosing by them reads nothing a person could not.
 */
export async function nearestCaretaker(
  db: Queryable, seasonId: string, from: Vec3, maxTier: number, now: Date,
): Promise<CaretakerWorld | null> {
  const rows = await db.select({ id: planets.id, x: planets.x, y: planets.y, z: planets.z }).from(planets)
    .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
    .where(and(
      eq(planets.seasonId, seasonId),
      eq(planets.kind, 'NEUTRAL'),
      lte(neutralPlanetState.tier, maxTier),
      or(isNull(neutralPlanetState.claimUntil), lte(neutralPlanetState.claimUntil, now)),
    ));
  return rows
    .map((row) => ({ planetId: row.id, distance: distance(from, row) }))
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

/** Couriers this capital owns, wherever they are, plus those on order. */
export async function settlersOwned(db: Queryable, planetId: string): Promise<number> {
  const hull = MULTI_WORLD.settlement.transportHull;
  const [owned] = await db.select({ n: sql<number>`coalesce(sum(${units.count}), 0)::int` }).from(units)
    .where(and(eq(units.planetId, planetId), eq(units.hull, hull)));
  const [ordered] = await db.select({ n: sql<number>`coalesce(sum(${buildOrders.count}), 0)::int` }).from(buildOrders)
    .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.subject, hull)));
  return (owned?.n ?? 0) + (ordered?.n ?? 0);
}
