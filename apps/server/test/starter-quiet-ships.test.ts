import { STARTER } from '@astera/rules';
import { asc, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { starterGalaxies, vessels } from '../src/db/schema.js';
import { sweepQuietShips } from '../src/services/starter/quiet.js';
import { EventWorker } from '../src/worker/loop.js';
import { testDb } from './helpers.js';
import { bearer, freshAccount, starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

const IDLE_MINUTES = STARTER.idleMs / 60_000;

/** The same rule as the main game's 30 hours, longer here: a ship with no progress gives up its place. */
describe('a ship with no progress for 48 hours', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  const db = () => world.f.db;
  const clock = () => world.f.clock;
  const enlist = async (name: string) => {
    const person = await freshAccount(world.f, name);
    await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    return person;
  };
  const ship = async (accountId: string) => (await db().select().from(vessels).where(eq(vessels.accountId, accountId)))[0]!;
  const sweep = () => sweepQuietShips(db(), clock());
  const repair = (token: string) => world.app.inject({
    method: 'POST', url: '/api/starter/repair', headers: bearer(token), payload: { module: 'REFINERY', stage: 2 },
  });
  const rich = (accountId: string) => db().update(vessels).set({ alloy: 50_000, crystal: 50_000 }).where(eq(vessels.accountId, accountId));
  const galaxies = () => db().select().from(starterGalaxies).orderBy(asc(starterGalaxies.ordinal));

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('is 48 hours, against the main game\'s 30', () => {
    expect(STARTER.idleMs).toBe(48 * 60 * 60 * 1000);
  });

  describe('when it falls quiet', () => {
    it('keeps its place until the 48 hours are up', async () => {
      const person = await enlist('Quiet');
      clock().advance(IDLE_MINUTES - 1);
      expect(await sweep()).toBe(0);
      expect(await ship(person.id)).toMatchObject({ status: 'ACTIVE' });
    });

    it('gives up its place when they are', async () => {
      const person = await enlist('Quiet');
      clock().advance(IDLE_MINUTES);
      expect(await sweep()).toBe(1);
      expect(await ship(person.id)).toMatchObject({ status: 'DORMANT', slotIndex: null });
    });

    it('does not count a login or a collect as progress, as the main game does not', async () => {
      const person = await enlist('Quiet');
      clock().advance(IDLE_MINUTES - 1);
      await world.app.inject({ url: '/api/starter/vessel', headers: bearer(person.token) });
      await world.app.inject({ method: 'POST', url: '/api/starter/collect', headers: bearer(person.token) });
      clock().advance(1);
      expect(await sweep()).toBe(1);
    });

    it('is found by the worker, without anyone asking', async () => {
      const person = await enlist('Quiet');
      const worker = new EventWorker(db(), clock(), { pollMs: 50, batch: 50, staleMinutes: 5 }, pino({ level: 'silent' }));
      clock().advance(IDLE_MINUTES);
      await worker.tick();
      expect(await ship(person.id)).toMatchObject({ status: 'DORMANT' });
    });

    it('tells its owner when it will happen', async () => {
      const person = await enlist('Quiet');
      const body = (await world.app.inject({ url: '/api/starter/vessel', headers: bearer(person.token) })).json<{ vessel: { quietAt: string } }>();
      expect(new Date(body.vessel.quietAt).getTime()).toBe(clock().now().getTime() + STARTER.idleMs);
    });

    it('counts a repair as progress', async () => {
      const person = await enlist('Busy');
      await rich(person.id);
      clock().advance(IDLE_MINUTES - 1);
      expect((await repair(person.token)).statusCode).toBe(200);
      clock().advance(IDLE_MINUTES - 1);
      expect(await sweep()).toBe(0);
    });

    it('leaves a ship that has already left, or already sleeps, alone', async () => {
      const gone = await enlist('Gone');
      const asleep = await enlist('Asleep');
      await db().update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.accountId, gone.id));
      clock().advance(IDLE_MINUTES);
      expect(await sweep()).toBe(1);
      expect(await sweep()).toBe(0);
      expect(await ship(gone.id)).toMatchObject({ status: 'DEPARTED' });
      expect(await ship(asleep.id)).toMatchObject({ status: 'DORMANT' });
    });

    it('stops showing on the neighbours\' map and in the count', async () => {
      const quiet = await enlist('Quiet');
      const other = await enlist('Other');
      const quietShip = await ship(quiet.id);
      clock().advance(IDLE_MINUTES);
      await db().update(vessels).set({ modules: { REFINERY: 1, SURVEY: 1 }, lastProgressAt: clock().now() }).where(eq(vessels.accountId, other.id));
      await sweep();
      const map = (await world.app.inject({ url: '/api/starter/galaxy', headers: bearer(other.token) })).json<{ planets: { id: string }[] }>();
      expect(map.planets.map(planet => planet.id)).not.toContain(quietShip.id);
      const season = (await world.app.inject({ url: '/api/starter/season', headers: bearer(other.token) })).json<{ players: number }>();
      expect(season.players).toBe(1);
    });

    it('frees its place for a newcomer in a full galaxy', async () => {
      await enlist('Quiet');
      await db().update(starterGalaxies).set({ capacity: 1 });
      clock().advance(IDLE_MINUTES);
      await sweep();
      const next = await enlist('Next');
      const [only] = await galaxies();
      expect((await ship(next.id)).starterGalaxyId).toBe(only!.id);
      expect(await galaxies()).toHaveLength(1);
    });

    it('still lets its owner look at the ship and collect', async () => {
      const person = await enlist('Quiet');
      clock().advance(IDLE_MINUTES);
      await sweep();
      const read = await world.app.inject({ url: '/api/starter/vessel', headers: bearer(person.token) });
      expect(read.json<{ vessel: { status: string } }>().vessel.status).toBe('DORMANT');
      expect((await world.app.inject({ method: 'POST', url: '/api/starter/collect', headers: bearer(person.token) })).statusCode).toBe(200);
    });
  });

  describe('when its owner comes back with a repair', () => {
    const asleep = async () => {
      const person = await enlist('Back');
      await rich(person.id);
      clock().advance(IDLE_MINUTES);
      await sweep();
      return person;
    };

    it('wakes, takes a place and starts the clock again', async () => {
      const person = await asleep();
      expect((await repair(person.token)).statusCode).toBe(200);
      const row = await ship(person.id);
      expect(row).toMatchObject({ status: 'ACTIVE' });
      expect(row.slotIndex).not.toBeNull();
      expect(row.lastProgressAt.getTime()).toBe(clock().now().getTime());
    });

    it('goes back to its own galaxy while there is room', async () => {
      const person = await asleep();
      const before = (await ship(person.id)).starterGalaxyId;
      await repair(person.token);
      expect((await ship(person.id)).starterGalaxyId).toBe(before);
    });

    it('moves to a galaxy with room when its own has filled, and does not lose or gain resources by it', async () => {
      const person = await asleep();
      await db().update(starterGalaxies).set({ capacity: 1 });
      await enlist('Taker');
      const before = await world.app.inject({ url: '/api/starter/vessel', headers: bearer(person.token) });
      const heldBefore = before.json<{ vessel: { alloy: number; bufferAlloy: number } }>().vessel;
      const answer = await repair(person.token);
      expect(answer.statusCode).toBe(200);
      const [first, second] = await galaxies();
      const row = await ship(person.id);
      expect(row.starterGalaxyId).toBe(second!.id);
      expect(row.starterGalaxyId).not.toBe(first!.id);
      const after = (await world.app.inject({ url: '/api/starter/vessel', headers: bearer(person.token) })).json<{ vessel: { alloy: number; bufferAlloy: number; galaxy: { ordinal: number } } }>().vessel;
      expect(after.galaxy.ordinal).toBe(2);
      expect(after.bufferAlloy).toBeCloseTo(heldBefore.bufferAlloy, 0);
    });

    it('stays asleep if the repair is refused', async () => {
      const person = await asleep();
      await db().update(vessels).set({ alloy: 0, crystal: 0, bufferAlloy: 0, bufferCrystal: 0 }).where(eq(vessels.accountId, person.id));
      expect((await repair(person.token)).statusCode).toBe(409);
      expect(await ship(person.id)).toMatchObject({ status: 'DORMANT', slotIndex: null });
    });
  });
});
