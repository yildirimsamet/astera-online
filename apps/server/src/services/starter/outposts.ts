import { STARTER, firstOutpostPoint, firstOutpostSeed, firstOutpostsMissing, seededFrom, starterSlots } from '@astera/rules';
import { and, eq, inArray } from 'drizzle-orm';
import type { Tx } from '../../db/client.js';
import { starterGalaxies, starterSites } from '../../db/schema.js';

/**
 * THE FIRST HUNT'S TWO OUTPOSTS (owner 2026-11-08, N6–N7), given as the first rock is: when the Shipyard
 * is done. A Sur-held first-level outpost the two Darts it hands over can take, and an Akıncı- or
 * Mızrak-held second-level one that asks for a counter, both a Dart pair's three to five minutes away.
 * Only what is missing is added, an outpost that is down does not count, and a galaxy is given at most
 * `extraMax` beyond its own. Like the first rock, this does not wait on the sweep's galaxy lock: a rare
 * concurrent extra is harmless. They are ordinary outposts, kept by nobody.
 */
export async function ensureFirstOutposts(tx: Tx, ship: { id: string; starterGalaxyId: string; x: number; y: number; z: number }, now: Date): Promise<void> {
  const places = await tx.select().from(starterSites).where(and(eq(starterSites.starterGalaxyId, ship.starterGalaxyId), inArray(starterSites.kind, ['WRECK', 'OUTPOST'])));
  const outposts = places.filter(place => place.kind === 'OUTPOST');
  const missing = firstOutpostsMissing(ship, outposts.filter(post => post.respawnAt === null).map(post => ({ x: post.x, y: post.y, z: post.z, level: post.level, guard: post.guardFull })));
  const room = STARTER.sites.outposts.count + STARTER.firstOutposts.extraMax - outposts.length;
  if (missing.length === 0 || room <= 0) return;
  const [galaxy] = await tx.select({ seed: starterGalaxies.seed }).from(starterGalaxies).where(eq(starterGalaxies.id, ship.starterGalaxyId));
  if (!galaxy) return;
  const berths = starterSlots(galaxy.seed);
  const taken = places.map(place => ({ x: place.x, y: place.y, z: place.z }));
  const random = seededFrom(ship.id, 'first-outposts');
  for (const role of missing.slice(0, room)) {
    const at = firstOutpostPoint(ship, berths, taken, random);
    if (!at) return;
    const seed = firstOutpostSeed(role, at, random);
    await tx.insert(starterSites).values({
      starterGalaxyId: ship.starterGalaxyId, kind: 'OUTPOST', x: seed.x, y: seed.y, z: seed.z, level: seed.level,
      alloy: seed.stock * 0.6, crystal: seed.stock * 0.4, deuterium: 0, stockFull: seed.stock, guard: seed.guard, guardFull: seed.guard, createdAt: now,
    });
    taken.push(at);
  }
}
