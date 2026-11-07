import {
  asteroidTargetPerHour, openPartTarget, partsVisible, pickPartSite, seededFrom, starterSitePlan, starterSlots,
} from '@astera/rules';
import { and, eq, gt, inArray, isNotNull, lte } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Tx } from '../../db/client.js';
import { starterGalaxies, starterSites, vessels } from '../../db/schema.js';
import { publishShard } from '../../stream/bus.js';
import { progressOf } from './vessel.js';
import { insertRock } from './rocks.js';
import { randomUUID } from 'node:crypto';
import { launchPirates } from './npcRaids.js';

const HOUR_MS = 3_600_000;

type Galaxy = typeof starterGalaxies.$inferSelect;

/** The fixed places, once per galaxy, split from the stock as the main game splits a wreck. */
async function layOutOnce(tx: Tx, galaxy: Galaxy, now: Date): Promise<void> {
  const [any] = await tx.select({ id: starterSites.id }).from(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxy.id), inArray(starterSites.kind, ['WRECK', 'OUTPOST']))).limit(1);
  if (any) return;
  const plan = starterSitePlan(galaxy.seed, starterSlots(galaxy.seed));
  await tx.insert(starterSites).values(plan.map(site => ({
    starterGalaxyId: galaxy.id, kind: site.kind, x: site.x, y: site.y, z: site.z, level: site.level,
    alloy: site.stock * 0.6, crystal: site.stock * 0.4, deuterium: 0, stockFull: site.stock, guard: site.guard, guardFull: site.guard, createdAt: now,
  })));
}

/** What has waited long enough comes back, and what was only ever for a while goes. */
async function turnOver(tx: Tx, galaxy: Galaxy, now: Date): Promise<void> {
  await tx.delete(starterSites).where(and(
    eq(starterSites.starterGalaxyId, galaxy.id), inArray(starterSites.kind, ['ASTEROID', 'BATTLE_WRECK']), lte(starterSites.expiresAt, now), isNotNull(starterSites.expiresAt),
  ));
  const due = await tx.select().from(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxy.id), lte(starterSites.respawnAt, now)));
  for (const site of due) {
    await tx.update(starterSites).set({
      alloy: site.stockFull * 0.6, crystal: site.stockFull * 0.4, deuterium: 0, guard: site.guardFull, respawnAt: null,
    }).where(eq(starterSites.id, site.id));
  }
}

/** This hour's rocks: scarce on purpose, and tied to the ships here, not to how often this runs (§3.5). */
async function growRocks(tx: Tx, galaxy: Galaxy, active: number, now: Date): Promise<void> {
  if (active === 0) return;
  const hourStart = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const grown = await tx.select({ id: starterSites.id }).from(starterSites).where(and(
    eq(starterSites.starterGalaxyId, galaxy.id), eq(starterSites.kind, 'ASTEROID'), gt(starterSites.createdAt, new Date(hourStart.getTime() - 1)),
  ));
  const owed = asteroidTargetPerHour(active) - grown.length;
  if (owed <= 0) return;
  for (let i = 0; i < owed; i++) await insertRock(tx, galaxy, randomUUID(), now);
  await publishShard(tx, galaxy.id, 'mining');
}

/** Enough open parts for those hunting, so a thin galaxy cannot strand anyone (§3.5). */
async function keepPartsOpen(tx: Tx, galaxy: Galaxy, hunting: number, now: Date): Promise<void> {
  if (hunting === 0) return;
  const places = await tx.select().from(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxy.id), inArray(starterSites.kind, ['WRECK', 'OUTPOST'])));
  const open = places.filter(place => place.hasPart).length;
  const owed = openPartTarget(hunting) - open;
  const random = seededFrom(galaxy.id, now.getTime());
  const free = [...places];
  for (let i = 0; i < owed; i++) {
    const place = pickPartSite(free, random);
    if (!place) return;
    place.hasPart = true;
    await tx.update(starterSites).set({ hasPart: true }).where(eq(starterSites.id, place.id));
  }
}

/**
 * THE GALAXY'S OWN TIMETABLE, on the worker's sweep. Idempotent by construction: each step looks at
 * what is there and owes only the difference, so that a missed or a doubled sweep changes nothing.
 */
export async function sweepStarterWorld(db: Db, clock: Clock): Promise<void> {
  const now = clock.now();
  const galaxies = await db.select().from(starterGalaxies);
  for (const galaxy of galaxies) {
    await db.transaction(async (tx) => {
      // One sweep at a time per galaxy; a second worker has nothing to add. Not a key lock: a command
      // writing a row that names this galaxy neither waits for this nor makes it skip the galaxy.
      const [locked] = await tx.select({ id: starterGalaxies.id }).from(starterGalaxies).where(eq(starterGalaxies.id, galaxy.id)).for('no key update', { skipLocked: true });
      if (!locked) return;
      await layOutOnce(tx, galaxy, now);
      await turnOver(tx, galaxy, now);
      const ships = await tx.select().from(vessels).where(and(eq(vessels.starterGalaxyId, galaxy.id), eq(vessels.status, 'ACTIVE')));
      await growRocks(tx, galaxy, ships.length, now);
      await keepPartsOpen(tx, galaxy, ships.filter(ship => partsVisible(progressOf(ship))).length, now);
      await launchPirates(tx, galaxy, ships, now);
    });
  }
}

