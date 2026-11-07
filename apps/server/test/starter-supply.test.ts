import { asteroidTargetPerHour } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { starterSites } from '../src/db/schema.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

describe('how many rocks there are', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const rocks = () => world.f.db.select().from(starterSites).where(eq(starterSites.kind, 'ASTEROID'));
  const sweep = () => sweepStarterWorld(world.f.db, world.f.clock);

  it('grows with the ships aboard', async () => {
    await aboard(world, 'One');
    await aboard(world, 'Two');
    await sweep();
    expect(await rocks()).toHaveLength(asteroidTargetPerHour(2));
    for (const name of ['A', 'B', 'C', 'D']) await aboard(world, name);
    world.f.clock.advance(61);
    await sweep();
    expect((await rocks()).length).toBeGreaterThanOrEqual(asteroidTargetPerHour(6));
  });

  it('gives an hour its share however often the sweep runs', async () => {
    await aboard(world, 'One');
    await sweep();
    const first = (await rocks()).length;
    for (let i = 0; i < 5; i++) { world.f.clock.advance(5); await sweep(); }
    expect(await rocks()).toHaveLength(first);
  });

  it('lets old rocks drift off', async () => {
    await aboard(world, 'One');
    await sweep();
    world.f.clock.advance(60 * 24);
    await sweep();
    const left = await rocks();
    expect(left.every(rock => rock.expiresAt!.getTime() > world.f.clock.now().getTime())).toBe(true);
  });
});
