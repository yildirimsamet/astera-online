import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminStarterSchema } from '../../web/src/api/adminSchemas.js';
import { accounts, vesselBotState, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { bearer, freshAccount, starterWorld } from './starterFixture.js';
import { aboard } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

describe('the operator\'s view of the starter galaxies', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld({ ADMIN_USERNAMES: 'operator' }); });
  afterEach(async () => { await world.built.close(); });

  const read = async () => {
    const person = await freshAccount(world.f, 'Op');
    await world.f.db.update(accounts).set({ username: 'operator' }).where(eq(accounts.id, person.id));
    const answer = await world.app.inject({ url: '/api/admin/starter', headers: bearer(person.token) });
    expect(answer.statusCode).toBe(200);
    return adminStarterSchema.parse(answer.json());
  };

  it('is closed to a commander', async () => {
    const me = await aboard(world, 'Me');
    const answer = await world.app.inject({ url: '/api/admin/starter', headers: me.headers });
    expect(answer.statusCode).toBe(403);
  });

  it('counts ships, people against the crew, the repair spread and the galaxies', async () => {
    const one = await aboard(world, 'One');
    await aboard(world, 'Two');
    const crew = await aboard(world, 'Crew');
    await world.f.db.insert(vesselBotState).values({ vesselId: crew.vesselId, persona: 'steady', nextActionAt: world.f.clock.now(), sessionUntilAt: world.f.clock.now(), createdAt: world.f.clock.now() });
    await world.f.db.update(vessels).set({ status: 'DORMANT' }).where(eq(vessels.id, one.vesselId));
    const view = await read();
    expect(view.ships).toMatchObject({ active: 2, dormant: 1, departed: 0 });
    expect(view.people).toBe(2);
    expect(view.crew).toBe(1);
    expect(view.spread.reduce((sum, band) => sum + band, 0)).toBe(3);
    expect(view.galaxies).toHaveLength(1);
    expect(view.galaxies[0]!.seated).toBe(3);
    expect(view.galaxies[0]!.capacity).toBe(30);
    expect(view.queue.failed).toBe(0);
  });
});
