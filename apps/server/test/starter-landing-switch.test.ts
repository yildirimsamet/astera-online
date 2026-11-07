import { STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vessels } from '../src/db/schema.js';
import { joinSeason } from '../src/services/player.js';
import { bootstrapServers, resolveJoinTarget } from '../src/services/servers.js';
import { makeAccount, testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, get, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

const THRUST = { DRIVE_HULL: 1, DRIVE_THRUST: 1, DEUTERIUM_PLANT: 2 };

describe('Vantage is full', () => {
  let world: StarterWorld;
  const ready = async () => {
    const person = await aboard(world, 'Pilot', THRUST);
    await world.f.db.update(vessels).set({ fuel: STARTER.fuelForJump }).where(eq(vessels.id, person.vesselId));
    return person;
  };
  const fillFirst = async () => {
    const target = await resolveJoinTarget(world.f.db, 'EU-1', world.f.clock);
    const neighbour = await makeAccount(world.f.db, 'Neighbour');
    await joinSeason(world.f.db, neighbour.id, target.seasonId, world.f.clock);
  };

  beforeEach(async () => {
    world = await starterWorld();
    await bootstrapServers(world.f.db, world.f.clock, { count: 2, capacity: 1, seedBase: 1000 });
  });
  afterEach(async () => { await world.built.close(); });

  it('names the open galaxy on the panel, so the player sees where they are going before they go', async () => {
    const person = await ready();
    await fillFirst();
    const view = await get<{ target: { shard: string } }>(world, '/api/starter/migration', person.headers);
    expect(view.target.shard).toBe('EU-2');
  });

  it('lands in the open one and says which', async () => {
    const person = await ready();
    await fillFirst();
    const landed = await post(world, '/api/starter/migrate', person.headers);
    expect(landed.statusCode).toBe(200);
    expect(landed.json<{ placement: { shard: string } }>().placement.shard).toBe('EU-2');
  });

  it('offers the next galaxy\'s addresses if the first fills between the panel and the press', async () => {
    const person = await ready();
    const view = await get<{ target: { shard: string } }>(world, '/api/starter/migration', person.headers);
    expect(view.target.shard).toBe('EU-1');
    await fillFirst();
    const next = await get<{ target: { shard: string }; choices: { index: number }[] }>(world, '/api/starter/migration', person.headers);
    expect(next.target.shard).toBe('EU-2');
    const landed = await post(world, '/api/starter/migrate', person.headers, { slot: next.choices[0]!.index });
    expect(landed.json<{ placement: { shard: string } }>().placement.shard).toBe('EU-2');
  });
});
