import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, strategicAssets, units } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { planetView } from '../src/services/planetView.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp,
  giveResearch,
  giveUnits,
  grant,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * TWO FLEETS IN THE AIR AT ONCE, POINTED AT EACH OTHER. Owner report.
 *
 * The report was that a commander's own outbound wing "came home the instant the
 * battle ended": it left the disc, the shipyard read as though the ships were
 * back, and the launch sheet then refused with "no ships at home". Two of those
 * three are the same fact seen from different surfaces — the GARRISON died and
 * the wing is still away — so what this file pins is the half that must never
 * move: a raid landing on a world may not touch anything that world has in the
 * air, and every payload the client draws from must keep saying so.
 */
describe('a raid lands while my own fleet is still outbound', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  /** A world far enough away that a strike at it is still flying after a raid lands. */
  let far: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  const homeStack = async (planetId: string) =>
    (await f.db.select().from(units).where(eq(units.planetId, planetId)))
      .filter((row) => row.location === 'home' && row.count > 0)
      .map((row) => `${row.hull}:${String(row.count)}`);

  const parked = async (planetId: string, location: string) =>
    (await f.db.select().from(units).where(eq(units.planetId, planetId)))
      .filter((row) => row.location === location)
      .map((row) => `${row.hull}:${String(row.count)}`);

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs, far] = f.planetIds as [string, string, string];
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, theirs, { x: 400 });
    await placeAt(f.db, far, { x: 9_000 });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'HANGAR', 8);
      await fuelUp(f.db, id);
      await grant(f.db, id, 80_000, 20_000);
    }
    f.clock.advance(250);
  });

  /** Their fast wing lands before my slow one arrives; nothing of mine is home. */
  const crossfire = async (theirFleet: Record<string, number>) => {
    await giveUnits(f.db, mine, { DART: 8, RAMPART: 10 });
    await giveUnits(f.db, theirs, theirFleet);
    const incoming = await launchAttack(f.db, theirs, mine, theirFleet, f.clock);
    const outgoing = await launchAttack(f.db, mine, theirs, { RAMPART: 10 }, f.clock);
    expect(outgoing.arriveAt.getTime()).toBeGreaterThan(incoming.arriveAt.getTime());
    f.clock.set(settledAt(incoming.arriveAt));
    await worker().tick();
    return outgoing;
  };

  it('leaves the outbound wing in the air when the garrison survives', async () => {
    const outgoing = await crossfire({ DART: 12 });

    const [mission] = await f.db.select().from(missions).where(eq(missions.id, outgoing.missionId));
    expect(mission?.status).toBe('in_flight');
    expect(await parked(mine, outgoing.missionId)).toEqual(['RAMPART:10']);
  });

  /**
   * THE REPORTED CASE. Everything standing at home dies; the wing does not.
   *
   * `fleet` is what the launch sheet offers and `fleetAway` is what it explains
   * the shortfall with, so the two together are the only honest reading of a world
   * that has just been emptied — and the sheet says "no ships at home" because
   * that is precisely what is true.
   */
  it('keeps the outbound wing when the garrison is wiped out', async () => {
    const outgoing = await crossfire({ DART: 120 });

    expect(await homeStack(mine)).toEqual([]);
    expect(await parked(mine, outgoing.missionId)).toEqual(['RAMPART:10']);

    const view = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    expect(view.fleet).toEqual({});
    expect(view.fleetAway).toEqual({ RAMPART: 10 });
    // The bay is still held, because the craft is still out.
    expect(view.flight.used).toBe(1);

    const [mission] = await f.db.select().from(missions).where(eq(missions.id, outgoing.missionId));
    expect(mission?.status).toBe('in_flight');
  });

  /** And the disc keeps drawing it: the thread is what the client flies. */
  it('still publishes the outbound thread, with its path, after the battle', async () => {
    const outgoing = await crossfire({ DART: 120 });

    const pending = await pendingThreads(f.db, mine, f.clock.now());
    const ours = pending.find((thread) => thread.id === outgoing.missionId);
    expect(ours).toBeDefined();
    expect(ours?.leg).toBe('outbound');
    expect(ours?.path).toBeDefined();
    expect(ours?.fleet).toEqual({ RAMPART: 10 });
  });

  /** The same, for the one craft that carries no units of its own. */
  it('keeps a Death Star in flight when its own world is raided', async () => {
    await giveUnits(f.db, mine, { DART: 8 });
    await giveUnits(f.db, theirs, { DART: 120 });
    await giveResearch(f.db, mine, 'DEATH_STAR_PROTOCOL');
    await f.db.insert(strategicAssets).values({
      planetId: mine,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    const strike = await launchDeathStar(f.db, mine, far, f.clock);
    const incoming = await launchAttack(f.db, theirs, mine, { DART: 120 }, f.clock);
    expect(strike.arriveAt.getTime()).toBeGreaterThan(incoming.arriveAt.getTime());

    f.clock.set(settledAt(incoming.arriveAt));
    await worker().tick();

    expect(await homeStack(mine)).toEqual([]);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, strike.missionId));
    expect(mission?.status).toBe('in_flight');
    const [asset] = await f.db.select().from(strategicAssets).where(eq(strategicAssets.planetId, mine));
    expect(asset?.status).toBe('LAUNCHED');

    const pending = await pendingThreads(f.db, mine, f.clock.now());
    expect(pending.find((thread) => thread.id === strike.missionId)?.kind).toBe('death_star');
  });

  /**
   * AND THE OTHER HALF OF THE REPORT: the wing that actually does come home.
   *
   * A returning raid lands its survivors in the garrison, and `fleet` — the only
   * list the launch sheet offers ships from — has to carry them on the same read
   * that says the flight is over.
   */
  it('lands the returning wing back into the launchable garrison', async () => {
    await giveUnits(f.db, mine, { DART: 20 });
    const outgoing = await launchAttack(f.db, mine, theirs, { DART: 20 }, f.clock);
    f.clock.set(settledAt(outgoing.arriveAt));
    await worker().tick();

    const [ret] = await f.db.select().from(missions).where(eq(missions.kind, 'return'));
    expect(ret).toBeDefined();
    f.clock.set(ret!.arriveAt);
    await worker().tick();

    const view = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    expect(view.fleetAway).toEqual({});
    expect(view.fleet.DART ?? 0).toBeGreaterThan(0);
    expect(view.flight.used).toBe(0);
    expect(await pendingThreads(f.db, mine, f.clock.now())).toEqual([]);
  });
});
