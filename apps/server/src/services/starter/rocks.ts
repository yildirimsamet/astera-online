import { STARTER, orbitPosition, orbitSeedOf, seededFrom, starterAsteroidOrbit } from '@astera/rules';
import { randomUUID } from 'node:crypto';
import { and, eq, gt, or, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../../db/client.js';
import { starterSites } from '../../db/schema.js';
import { publishShard } from '../../stream/bus.js';

const HOUR_MS = 3_600_000;
const ROCK_LIFETIME_MS = 6 * HOUR_MS;
const DEUTERIUM_CHANCE = 1 / 8;
const DEUTERIUM_SHARE = 0.1;
const CRYSTAL_SHARE = 0.35;
const MAX_FIRST_ROCK_CANDIDATES = 50_000;

/** Normal supply and the first flight draw from the same ore and orbit rules. */
export async function insertRock(tx: Tx, galaxy: { id: string; epoch: Date }, id: string, now: Date): Promise<void> {
  const [low, high] = STARTER.sites.asteroidOre;
  const random = seededFrom(id);
  const ore = low + Math.floor(random() * (high - low + 1));
  const deuterium = random() < DEUTERIUM_CHANCE ? ore * DEUTERIUM_SHARE : 0;
  const crystal = (ore - deuterium) * CRYSTAL_SHARE;
  const minutes = (now.getTime() - galaxy.epoch.getTime()) / 60_000;
  const at = orbitPosition(starterAsteroidOrbit(orbitSeedOf(id)), minutes);
  await tx.insert(starterSites).values({
    id, starterGalaxyId: galaxy.id, kind: 'ASTEROID', x: at.x, y: at.y, z: at.z, level: 1,
    alloy: ore - deuterium - crystal, crystal, deuterium, stockFull: ore, createdAt: now,
    expiresAt: new Date(now.getTime() + ROCK_LIFETIME_MS),
  });
}

function* candidates(): Generator<string> {
  for (let i = 0; i < MAX_FIRST_ROCK_CANDIDATES; i++) yield randomUUID();
}

/** Bounded even for an unlucky generator; use its nearest orbit when the distance band is missed. */
export function firstRockId(ship: { x: number; y: number; z: number }, minutes: number, ids: Iterable<string>): string | null {
  let best: { id: string; distance: number } | null = null;
  const iterator = ids[Symbol.iterator]();
  for (let i = 0; i < MAX_FIRST_ROCK_CANDIDATES; i++) {
    const next = iterator.next();
    if (next.done) break;
    const at = orbitPosition(starterAsteroidOrbit(orbitSeedOf(next.value)), minutes);
    const distance = Math.hypot(at.x - ship.x, at.y - ship.y, at.z - ship.z);
    if (distance >= STARTER.firstRock.near && distance <= STARTER.firstRock.far) return next.value;
    if (!best || distance < best.distance) best = { id: next.value, distance };
  }
  return best?.id ?? null;
}

/** The rocks the first telescope opens on (owner 2026-11-08), measured when it comes in. */
export async function ensureFirstRocks(tx: Tx, vessel: { row: { starterGalaxyId: string; x: number; y: number; z: number }; epoch: Date; now: Date }): Promise<void> {
  const galaxyId = vessel.row.starterGalaxyId;
  // Do not wait on the sweep's galaxy lock. Rare concurrent extra supply is harmless and
  // still counts towards this hour through createdAt.
  const rocks = await tx.select({ id: starterSites.id }).from(starterSites).where(and(
    eq(starterSites.starterGalaxyId, galaxyId), eq(starterSites.kind, 'ASTEROID'), sql`${starterSites.alloy} + ${starterSites.crystal} + ${starterSites.deuterium} > 0`,
    or(isNull(starterSites.expiresAt), gt(starterSites.expiresAt, vessel.now)),
  ));
  const minutes = (vessel.now.getTime() - vessel.epoch.getTime()) / 60_000;
  const close = rocks.filter(rock => {
    const at = orbitPosition(starterAsteroidOrbit(orbitSeedOf(rock.id)), minutes);
    return Math.hypot(at.x - vessel.row.x, at.y - vessel.row.y, at.z - vessel.row.z) <= STARTER.firstRock.far;
  }).length;
  const owed = STARTER.sites.rocksInSight[1] - close;
  if (owed <= 0) return;
  for (let i = 0; i < owed; i++) {
    const id = firstRockId(vessel.row, minutes, candidates()) ?? randomUUID();
    await insertRock(tx, { id: galaxyId, epoch: vessel.epoch }, id, vessel.now);
  }
  await publishShard(tx, galaxyId, 'mining');
}
