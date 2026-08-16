import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { radarLeadMinutes } from '@blindspace/rules';
import { missions, notifications, planets, players, satellites, scanEvents } from '../src/db/schema.js';
import { EventBus, publish } from '../src/stream/bus.js';
import {
  buildReturnPayload,
  currentUnlocks,
  listNotifications,
  markNotificationsSeen,
} from '../src/services/session.js';
import { assignWatch } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import {

  TEST_DATABASE_URL,
  giveSatellite,
  giveUnits,
  grant,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * A world that has been running a while.
 *
 * These used to advance past the newcomer grace period, which no longer exists
 * (D14). The advance stays because the assertions below are about a settled
 * world — accrued resources, telescope windows that have turned over — and
 * removing it would quietly change what they test.
 */
const SETTLED_MINUTES = 250;

const silent = pino({ level: 'silent' });

const worker = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

// The database pool is shared across this whole file, so it is torn down at FILE
// scope. An afterAll inside a describe would close it out from under any describe
// that follows.
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/** Run a raid to completion so its battle report exists. */
async function raid(f: Fixture, from: string, to: string, wasps = 20): Promise<void> {
  await giveUnits(f.db, from, { WASP: wasps });
  const launch = await launchAttack(f.db, from, to, { WASP: wasps }, f.clock);
  f.clock.set(launch.arriveAt);
  await worker(f).tick();
}

describe('the unlock cascade', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let myPlayer: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    myPlayer = f.playerIds[0]!;
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, theirs, 'CORE', 8);
    f.clock.advance(SETTLED_MINUTES);
  });

  it('a fresh commander has nothing unlocked but the fleet', async () => {
    expect(await currentUnlocks(f.db, myPlayer)).toEqual([]);
  });

  it('the telescope unlocks when your first fleet resolves — win or lose', async () => {
    await raid(f, mine, theirs, 20);
    expect(await currentUnlocks(f.db, myPlayer)).toContain('TELESCOPE');
  });

  /**
   * The design's deliberate choice: losing the first fleet and only THEN being
   * handed a telescope is the better lesson. A player who is wiped must not be
   * left in a dead end.
   */
  it('the telescope unlocks even when the fleet is annihilated', async () => {
    await giveUnits(f.db, theirs, { BASTION: 40 });
    await raid(f, mine, theirs, 8); // hopeless

    const [report] = await f.db.select().from(players).where(eq(players.id, myPlayer));
    expect(report).toBeDefined();
    expect(await currentUnlocks(f.db, myPlayer)).toContain('TELESCOPE');
  });

  it('radar unlocks when someone attacks you', async () => {
    await raid(f, theirs, mine, 20);
    expect(await currentUnlocks(f.db, myPlayer)).toContain('RADAR');
  });

  it('radar and the veil both unlock when someone scans you', async () => {
    await f.db.insert(scanEvents).values({
      targetPlanetId: mine,
      originPlanetId: theirs,
      detected: true,
      bearing: 'north',
    });
    const unlocked = await currentUnlocks(f.db, myPlayer);
    expect(unlocked).toContain('RADAR');
    expect(unlocked).toContain('VEIL');
  });

  it('an UNDETECTED scan unlocks nothing — you never learned about it', async () => {
    await f.db.insert(scanEvents).values({
      targetPlanetId: mine,
      originPlanetId: theirs,
      detected: false,
      bearing: 'north',
    });
    expect(await currentUnlocks(f.db, myPlayer)).toEqual([]);
  });

  it('the explorer unlocks once you have started watching someone', async () => {
    await f.db
      .insert(satellites)
      .values({ planetId: mine, slot: 0, type: 'TELESCOPE', level: 1 });
    await assignWatch(f.db, mine, theirs, 0, f.clock);
    expect(await currentUnlocks(f.db, myPlayer)).toContain('EXPLORER');
  });

  it('is derived, so it survives being asked repeatedly', async () => {
    await raid(f, mine, theirs, 20);
    const a = await currentUnlocks(f.db, myPlayer);
    const b = await currentUnlocks(f.db, myPlayer);
    expect(b).toEqual(a);
  });
});

describe('the return payload', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let myPlayer: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    myPlayer = f.playerIds[0]!;
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, theirs, 'CORE', 8);
    f.clock.advance(SETTLED_MINUTES);
  });

  it('reports how long you were away', async () => {
    f.clock.advance(187);
    const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(payload.awayMinutes).toBeGreaterThanOrEqual(187);
  });

  it('tells you what was done to you while you slept', async () => {
    await grant(f.db, mine, 40_000, 4_000);
    await raid(f, theirs, mine, 40);

    const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(payload.entries.some((e) => e.kind === 'raided')).toBe(true);
  });

  it('tells you how your own raid went', async () => {
    await grant(f.db, theirs, 40_000, 4_000);
    await raid(f, mine, theirs, 60);

    const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
    const result = payload.entries.find((e) => e.kind === 'raid_result');
    expect(result).toBeDefined();
    expect(['DECISIVE', 'PARTIAL', 'REPELLED']).toContain(result!.title);
  });

  it('mentions that someone scanned you', async () => {
    await f.db.insert(scanEvents).values({
      targetPlanetId: mine,
      originPlanetId: theirs,
      detected: true,
      bearing: 'south-west',
    });
    const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(payload.entries.some((e) => e.kind === 'scan_detected')).toBe(true);
  });

  it('reports what accrued, once enough time has passed', async () => {
    f.clock.advance(300);
    const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(payload.entries.some((e) => e.kind === 'accrued')).toBe(true);
  });

  it('never shows more than five entries — this is a glance, not a log', async () => {
    await grant(f.db, mine, 60_000, 6_000);
    for (let i = 0; i < 3; i++) {
      await raid(f, theirs, mine, 20);
      f.clock.advance(1);
    }
    await f.db.insert(scanEvents).values({
      targetPlanetId: mine,
      originPlanetId: theirs,
      detected: true,
      bearing: 'north',
    });
    f.clock.advance(600);

    const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(payload.entries.length).toBeLessThanOrEqual(5);
  });

  /** Reading advances the window, so refreshing does not replay old news. */
  it('the second read in a row reports nothing new', async () => {
    await grant(f.db, mine, 40_000, 4_000);
    await raid(f, theirs, mine, 40);

    const first = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(first.entries.length).toBeGreaterThan(0);

    const second = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(second.awayMinutes).toBe(0);
    expect(second.entries.filter((e) => e.kind === 'raided')).toHaveLength(0);
  });

  it('announces each unlock exactly once', async () => {
    await raid(f, mine, theirs, 20);

    const first = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(first.newUnlocks).toContain('TELESCOPE');

    const second = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(second.newUnlocks).toEqual([]);
  });

  /**
   * DESIGN LAW #1: a player must never reach a state where nothing is pending.
   * The payload has to be able to say what is still in flight.
   */
  it('lists what is still in flight', async () => {
    await giveUnits(f.db, mine, { WASP: 30 });
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 30 }, f.clock);

    const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(payload.pending.length).toBeGreaterThan(0);
    expect(payload.pending[0]!.minutesRemaining).toBeGreaterThan(0);
    void launch;
  });

  /**
   * THE FOG APPLIES HERE TOO.
   *
   * This payload used to list every inbound attack unconditionally, with its exact
   * ETA — handing any player, at any radar level including none, the one thing
   * Radar L3 exists to sell, and reversing D9 in the process: a forty-minute
   * flight gave forty minutes of notice. The test that covered it asserted the
   * leak. All three cases below now pin the actual rule.
   */
  describe('an inbound fleet is only listed once radar has said so', () => {
    const sendAtThem = async (): Promise<void> => {
      await giveUnits(f.db, theirs, { WASP: 30 });
      await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);
    };

    it('says nothing at all without radar', async () => {
      await sendAtThem();
      const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
      expect(payload.pending.some((p) => p.kind === 'incoming')).toBe(false);
    });

    it('still says nothing with radar, while the fleet is far out', async () => {
      await giveSatellite(f.db, mine, 'RADAR', 3);
      await sendAtThem();

      const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
      expect(payload.pending.some((p) => p.kind === 'incoming')).toBe(false);
    });

    it('lists it inside the lead window radar bought', async () => {
      await giveSatellite(f.db, mine, 'RADAR', 3);
      await sendAtThem();

      const [inbound] = await f.db
        .select()
        .from(missions)
        .where(eq(missions.targetPlanetId, mine));
      // One minute inside the L3 fuse: warned, and not a moment earlier.
      f.clock.set(new Date(inbound!.arriveAt.getTime() - (radarLeadMinutes(3) - 1) * 60_000));

      const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
      const incoming = payload.pending.find((p) => p.kind === 'incoming');
      expect(incoming).toBeDefined();
      expect(incoming!.minutesRemaining).toBeLessThanOrEqual(radarLeadMinutes(3));
    });
  });

  /**
   * The path is the fog again, in a new field.
   *
   * Your own fleet may be watched flying; an inbound attack may not, because its
   * origin is precisely what Radar L5 is sold for and a heading gives away most of
   * what L2's bearing costs. Asserted on the payload, not on the rendering.
   */
  it('carries a flight path for your own fleets and none at all for an inbound one', async () => {
    await giveUnits(f.db, mine, { WASP: 20 });
    await launchAttack(f.db, mine, theirs, { WASP: 20 }, f.clock);

    const outbound = await buildReturnPayload(f.db, myPlayer, f.clock);
    const ours = outbound.pending.find((p) => p.kind === 'fleet');
    expect(ours?.path).toBeDefined();
    expect(ours?.path?.arriveAt.getTime()).toBeGreaterThan(ours!.path!.departAt.getTime());

    // Now let radar see something coming, inside its lead window.
    await giveSatellite(f.db, mine, 'RADAR', 3);
    await giveUnits(f.db, theirs, { WASP: 20 });
    await launchAttack(f.db, theirs, mine, { WASP: 20 }, f.clock);
    const [inbound] = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.targetPlanetId, mine), eq(missions.kind, 'attack')));
    f.clock.set(new Date(inbound!.arriveAt.getTime() - (radarLeadMinutes(3) - 1) * 60_000));

    const warned = await buildReturnPayload(f.db, myPlayer, f.clock);
    const threat = warned.pending.find((p) => p.kind === 'incoming');
    expect(threat).toBeDefined();
    expect(threat?.path).toBeUndefined();
    // Nothing in the object at all, not merely a null.
    expect(Object.keys(threat!)).not.toContain('path');
  });

  it('names the planet a returning fleet is coming back from', async () => {
    await giveUnits(f.db, mine, { WASP: 30 });
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 30 }, f.clock);

    const outbound = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(outbound.pending.find((p) => p.kind === 'fleet')?.leg).toBe('outbound');

    f.clock.set(launch.arriveAt);
    await worker(f).tick();

    const homeward = await buildReturnPayload(f.db, myPlayer, f.clock);
    const thread = homeward.pending.find((p) => p.kind === 'fleet');
    expect(thread?.leg).toBe('return');
    // Its own planet's name would be useless here — the thread is about where it
    // has been, not where it is going.
    const [target] = await f.db.select().from(planets).where(eq(planets.id, theirs));
    expect(thread?.targetName).toBe(target!.name);
  });

  it('404s for an account with no planet', async () => {
    await expect(
      buildReturnPayload(f.db, '00000000-0000-0000-0000-000000000000', f.clock),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('notifications', () => {
  let f: Fixture;
  let myPlayer: string;
  let otherPlayer: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    myPlayer = f.playerIds[0]!;
    otherPlayer = f.playerIds[1]!;
    await f.db.insert(notifications).values([
      { playerId: myPlayer, kind: 'raided', payload: { a: 1 } },
      { playerId: myPlayer, kind: 'scan_detected', payload: { a: 2 } },
      { playerId: otherPlayer, kind: 'raided', payload: { a: 3 } },
    ]);
  });

  it('returns only your own', async () => {
    const rows = await listNotifications(f.db, myPlayer);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.playerId === myPlayer)).toBe(true);
  });

  it('can filter to unseen only', async () => {
    await markNotificationsSeen(f.db, myPlayer, [
      (await listNotifications(f.db, myPlayer))[0]!.id,
    ]);
    expect(await listNotifications(f.db, myPlayer, { unseenOnly: true })).toHaveLength(1);
  });

  it('marks everything seen when given no ids', async () => {
    expect(await markNotificationsSeen(f.db, myPlayer)).toBe(2);
    expect(await listNotifications(f.db, myPlayer, { unseenOnly: true })).toHaveLength(0);
  });

  /** ids from a client are a FILTER, never an authorisation. */
  it('cannot mark another player\'s notifications seen', async () => {
    const theirs = await listNotifications(f.db, otherPlayer);
    const marked = await markNotificationsSeen(f.db, myPlayer, [theirs[0]!.id]);

    expect(marked).toBe(0);
    expect(await listNotifications(f.db, otherPlayer, { unseenOnly: true })).toHaveLength(1);
  });

  it('caps the page size however large a limit is asked for', async () => {
    const rows = await listNotifications(f.db, myPlayer, { limit: 9999 });
    expect(rows.length).toBeLessThanOrEqual(100);
  });
});

describe('the event bus', () => {
  let f: Fixture;
  let bus: EventBus;

  beforeEach(async () => {
    f = await seedWorld(2);
    bus = new EventBus(TEST_DATABASE_URL, silent);
    await bus.start();
  });

  const waitFor = (playerId: string, ms = 3000): Promise<{ kind: string }> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('no event within timeout'));
      }, ms);
      const off = bus.subscribe(playerId, (event) => {
        clearTimeout(timer);
        off();
        resolve(event);
      });
    });

  it('delivers an event to the right subscriber', async () => {
    const arrived = waitFor(f.playerIds[0]!);
    await publish(f.db, f.playerIds[0]!, 'raided');
    await expect(arrived).resolves.toMatchObject({ kind: 'raided' });
    await bus.stop();
  });

  it('does not deliver one player\'s events to another', async () => {
    let leaked = false;
    const off = bus.subscribe(f.playerIds[1]!, () => {
      leaked = true;
    });

    const mine = waitFor(f.playerIds[0]!);
    await publish(f.db, f.playerIds[0]!, 'raided');
    await mine;

    expect(leaked).toBe(false);
    off();
    await bus.stop();
  });

  it('stops delivering after unsubscribe — no listener leak per reconnect', async () => {
    let hits = 0;
    const off = bus.subscribe(f.playerIds[0]!, () => {
      hits++;
    });
    expect(bus.subscriberCount(f.playerIds[0]!)).toBe(1);

    off();
    expect(bus.subscriberCount(f.playerIds[0]!)).toBe(0);

    await publish(f.db, f.playerIds[0]!, 'raided');
    await new Promise((r) => setTimeout(r, 300));
    expect(hits).toBe(0);
    await bus.stop();
  });

  /**
   * NOTIFY is transactional: it fires on COMMIT and is discarded on rollback. A
   * client must never be told about a battle that was subsequently undone.
   */
  it('discards events from a transaction that rolled back', async () => {
    let hits = 0;
    const off = bus.subscribe(f.playerIds[0]!, () => {
      hits++;
    });

    await f.db
      .transaction(async (tx) => {
        await publish(tx, f.playerIds[0]!, 'raided');
        throw new Error('deliberate rollback');
      })
      .catch(() => undefined);

    await new Promise((r) => setTimeout(r, 300));
    expect(hits).toBe(0);
    off();
    await bus.stop();
  });

  it('survives being stopped twice', async () => {
    await bus.stop();
    await expect(bus.stop()).resolves.toBeUndefined();
  });
});
