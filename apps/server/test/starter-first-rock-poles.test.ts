import { STARTER, orbitPosition, orbitSeedOf, rockSeedNear, starterAsteroidOrbit } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { starterGalaxies, starterSites, vessels } from '../src/db/schema.js';
import { ensureFirstRocks, insertRock } from '../src/services/starter/rocks.js';
import { aboard } from './starterShips.js';
import { starterWorld } from './starterFixture.js';
import { testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it('replaces a depleted nearby rock with a usable one at the visible time, including polar berths', async () => {
  const world = await starterWorld();
  try {
    const me = await aboard(world);
    const at = { x: 109, y: 420, z: -179 };
    await world.f.db.update(vessels).set(at).where(eq(vessels.id, me.vesselId));
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    const [galaxy] = await world.f.db.select().from(starterGalaxies).where(eq(starterGalaxies.id, ship!.starterGalaxyId));
    await world.f.db.delete(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxy!.id), eq(starterSites.kind, 'ASTEROID')));
    world.f.clock.advance(87);
    const now = world.f.clock.now();
    const minutes = (now.getTime() - galaxy!.epoch.getTime()) / 60_000;
    const candidates = Array.from({ length: 12000 }, (_, i) => `${(i * 2654435761 >>> 0).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`);
    const emptyId = rockSeedNear(at, minutes, candidates)!;
    await world.f.db.transaction(tx => insertRock(tx, galaxy!, emptyId, now));
    await world.f.db.update(starterSites).set({ alloy: 0, crystal: 0, deuterium: 0 }).where(eq(starterSites.id, emptyId));
    await world.f.db.transaction(tx => ensureFirstRocks(tx, { row: { ...ship!, ...at }, epoch: galaxy!.epoch, now }));
    const rocks = await world.f.db.select().from(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxy!.id), eq(starterSites.kind, 'ASTEROID')));
    const usable = rocks.filter(rock => rock.alloy + rock.crystal + rock.deuterium > 0);
    expect(usable).toHaveLength(STARTER.sites.rocksInSight[1]);
    const rock = usable[0]!;
    const position = orbitPosition(starterAsteroidOrbit(orbitSeedOf(rock.id)), minutes);
    expect(Math.hypot(position.x - at.x, position.y - at.y, position.z - at.z)).toBeLessThanOrEqual(300);
    expect(rock.createdAt).toEqual(now);
  } finally { await world.built.close(); }
});
it('bounds unlucky candidate selection and chooses the nearest fallback', async () => {
  const { firstRockId } = await import('../src/services/starter/rocks.js');
  let calls = 0;
  function* ids() { for (;;) { calls++; yield '00000000-0000-4000-8000-000000000000'; } }
  expect(firstRockId({ x: 5000, y: 0, z: 0 }, 0, ids())).toBe('00000000-0000-4000-8000-000000000000');
  expect(calls).toBe(50000);
});
it('does not wait for a sweeping galaxy row', async () => {
  const world = await starterWorld();
  try {
    const me = await aboard(world);
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    const [galaxy] = await world.f.db.select().from(starterGalaxies).where(eq(starterGalaxies.id, ship!.starterGalaxyId));
    let pending: Promise<void> | undefined;
    await world.f.db.transaction(async tx => {
      await tx.select().from(starterGalaxies).where(eq(starterGalaxies.id, galaxy!.id)).for('no key update');
      pending = world.f.db.transaction(other => ensureFirstRocks(other, { row: ship!, epoch: galaxy!.epoch, now: world.f.clock.now() }));
      const result = await Promise.race([pending.then(() => 'done'), new Promise<string>(resolve => { setTimeout(() => { resolve('blocked'); }, 1500); })]);
      expect(result).toBe('done');
    });
    await pending;
  } finally { await world.built.close(); }
});
