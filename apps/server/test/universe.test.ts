import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { players, starterGalaxies, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { TOKENS, bearer, freshAccount, starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

interface Universe { galaxies: { ordinal: number; ships: number }[]; mine: number | null }

/** The picture of the whole server: how many ships stand where, for anyone on it, and nothing else. */
describe('the universe', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  const read = async (token: string) => (await world.app.inject({ url: '/api/universe', headers: bearer(token) })).json<Universe>();
  const enlist = async (name = 'Pilot') => {
    const person = await freshAccount(world.f, name);
    await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    return person;
  };
  const commander = async () => {
    const [row] = await world.f.db.select({ accountId: players.accountId }).from(players).where(eq(players.id, world.f.playerIds[0]!));
    return TOKENS.issueAccess(row!.accountId);
  };

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('tells a ship which galaxy it is in, and how many ships stand in each', async () => {
    const person = await enlist();
    await enlist('Second');
    expect(await read(person.token)).toEqual({ galaxies: [{ ordinal: 1, ships: 2 }], mine: 1 });
  });

  it('shows a commander in the main galaxy the same picture, belonging to none of it', async () => {
    await enlist();
    expect(await read(await commander())).toEqual({ galaxies: [{ ordinal: 1, ships: 1 }], mine: null });
  });

  it('is empty for a server with no starter galaxies, so that no view is offered', async () => {
    expect(await read(await commander())).toEqual({ galaxies: [], mine: null });
  });

  it('is empty for someone who is nowhere yet', async () => {
    await enlist();
    expect(await read((await freshAccount(world.f, 'Nowhere')).token)).toEqual({ galaxies: [], mine: null });
  });

  it('counts the ships that hold a place, and leaves out a galaxy with none', async () => {
    const gone = await enlist('Gone');
    const asleep = await enlist('Asleep');
    const here = await enlist('Here');
    await world.f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.accountId, gone.id));
    await world.f.db.update(vessels).set({ status: 'DORMANT', slotIndex: null }).where(eq(vessels.accountId, asleep.id));
    expect((await read(here.token)).galaxies).toEqual([{ ordinal: 1, ships: 1 }]);
    await world.f.db.update(vessels).set({ status: 'DORMANT', slotIndex: null }).where(eq(vessels.accountId, here.id));
    world.f.clock.advance(2);
    expect((await read(await commander())).galaxies).toEqual([]);
  });

  it('still tells a sleeping ship which galaxy it belongs to', async () => {
    const person = await enlist();
    await world.f.db.update(vessels).set({ status: 'DORMANT', slotIndex: null }).where(eq(vessels.accountId, person.id));
    expect((await read(person.token)).mine).toBe(1);
  });

  it('lists every galaxy in order', async () => {
    const first = await enlist();
    await world.f.db.update(starterGalaxies).set({ capacity: 1 });
    await enlist('Second');
    expect((await read(first.token)).galaxies.map(galaxy => galaxy.ordinal)).toEqual([1, 2]);
  });

  it('sends no id, name or position of anyone', async () => {
    const person = await enlist('Secretname');
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.accountId, person.id));
    const body = await world.app.inject({ url: '/api/universe', headers: bearer(person.token) });
    expect(body.body).not.toContain(ship!.id);
    expect(body.body).not.toContain(ship!.starterGalaxyId);
    expect(body.body).not.toContain('Secretname');
    expect(Object.keys(body.json<Universe>().galaxies[0]!).sort()).toEqual(['ordinal', 'ships']);
  });

  it('counts from the database once a minute, however many ask', async () => {
    const person = await enlist();
    await read(person.token);
    await enlist('Late');
    expect((await read(person.token)).galaxies[0]!.ships).toBe(1);
    world.f.clock.advance(2);
    expect((await read(person.token)).galaxies[0]!.ships).toBe(2);
  });

  it('refuses a stranger', async () => {
    expect((await world.app.inject({ url: '/api/universe' })).statusCode).toBe(401);
  });
});
