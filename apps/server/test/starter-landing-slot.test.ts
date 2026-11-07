import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planets } from '../src/db/schema.js';
import { joinSeason } from '../src/services/player.js';
import { testDb, makeAccount } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { galaxyOf } from '../src/services/season.js';
import { seasons, shards } from '../src/db/schema.js';
import type { StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

describe('choosing where to land', () => {
  let world: StarterWorld;
  const freeSlots = async () => {
    const [season] = await world.f.db.select().from(seasons).where(eq(seasons.id, world.f.seasonId));
    const [shard] = await world.f.db.select().from(shards).where(eq(shards.id, season!.shardId));
    const taken = new Set((await world.f.db.select().from(planets).where(eq(planets.seasonId, season!.id))).map(row => row.slotIndex));
    return galaxyOf(season!.id, season!.seed, shard!.playerCap).slots.filter(slot => !taken.has(slot.index));
  };
  const join = async (name: string, slot?: number) => {
    const account = await makeAccount(world.f.db, name);
    return joinSeason(world.f.db, account.id, world.f.seasonId, world.f.clock, undefined, 'COMMANDER', new Set(), slot);
  };

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('takes the address asked for when it is free', async () => {
    const wanted = (await freeSlots()).at(-1)!.index;
    expect((await join('A', wanted)).slotIndex).toBe(wanted);
  });

  it('asks again when the address was taken a moment ago: it never swaps it for another', async () => {
    const wanted = (await freeSlots()).at(-1)!.index;
    await join('A', wanted);
    await expect(join('B', wanted)).rejects.toMatchObject({ code: 'LANDING_GONE' });
  });

  it('asks again for an address this galaxy does not have', async () => {
    await expect(join('A', 987_654)).rejects.toMatchObject({ code: 'LANDING_GONE' });
  });

  it('behaves as it always did when nothing is asked', async () => {
    const free = await freeSlots();
    const joined = await join('A');
    expect(free.map(slot => slot.index)).toContain(joined.slotIndex);
  });
});
