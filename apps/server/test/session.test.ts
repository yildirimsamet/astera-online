import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { radarLead, radarRange } from '@astera/rules';
import { missions, notifications, planets, players, satellites, scanEvents, watches } from '../src/db/schema.js';
import { CHANNEL, EventBus, publish, publishGlobal, publishShard } from '../src/stream/bus.js';
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
  giveInstrument,
  giveSatellite,
  giveUnits,
  grant,
  levelWorld,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
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

/**
 * How much notice a radar of `level` gives against THIS mission. D49.
 *
 * A radar is a circle, so the lead is a property of the leg — the distance and
 * how fast the fleet flew it — rather than a figure a table can be asked for.
 * Read off the mission row, exactly as the server reads it.
 */
const leadFor = (
  mission: { distance: number; departAt: Date; arriveAt: Date },
  level: number,
): number =>
  radarLead(
    radarRange(level),
    mission.distance,
    (mission.arriveAt.getTime() - mission.departAt.getTime()) / 60_000,
  );

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
/**
 * A complete raid: out, resolved, and home again.
 *
 * The return leg is not decoration here. Only one fleet may be committed to a
 * given planet at a time, and a fleet still in the air on its way BACK is still
 * committed — so a helper that stopped at the arrival could only ever be used
 * once per pair, and the tests that raid repeatedly would fail on the second call
 * rather than on anything they were written to check.
 */
async function raid(f: Fixture, from: string, to: string, wasps = 20): Promise<void> {
  await giveUnits(f.db, from, { DART: wasps });
  const launch = await launchAttack(f.db, from, to, { DART: wasps }, f.clock);
  f.clock.set(settledAt(launch.arriveAt));
  await worker(f).tick();
  // exposureMinutes is the full round trip, so this always clears the way home.
  f.clock.advance(launch.exposureMinutes);
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
    await giveSatellite(f.db, mine, 'UPLINK');
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
    await giveSatellite(f.db, mine, 'UPLINK');
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
    // This purse is big enough to lift the reader's Core a tier above its
    // neighbour's, which would refuse the raids below. D168; see `levelWorld`.
    await levelWorld(f.db, f.planetIds);
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

  /**
   * EXACTLY ONCE, ACROSS EVERY SURFACE THAT ANNOUNCES. D45.
   *
   * The battle itself now announces the Telescope, as a notification, at the
   * moment it resolves — which is what Design Law #2 asks for and what this
   * cascade never had. So by the time anything reads the return payload the news
   * has already been delivered, and the payload correctly reports nothing new.
   *
   * The assertion that matters is that it is announced ONCE IN TOTAL. Both
   * surfaces read and write the same `unlocksSeen`, so the failure this pins is
   * two of them each announcing it — or, worse, this endpoint (which no client
   * calls, D23) consuming the announcement before the player ever saw it.
   */
  it('announces each unlock exactly once, wherever it is announced from', async () => {
    await raid(f, mine, theirs, 20);

    const told = await f.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.playerId, myPlayer), eq(notifications.kind, 'unlock')));
    expect(told.map((n) => n.payload.unlock)).toEqual(['TELESCOPE']);

    // Already announced, so the return payload adds nothing — and adds nothing
    // twice.
    expect((await buildReturnPayload(f.db, myPlayer, f.clock)).newUnlocks).toEqual([]);
    expect((await buildReturnPayload(f.db, myPlayer, f.clock)).newUnlocks).toEqual([]);
  });

  /** And an unlock nothing has announced yet is still announced exactly once. */
  it('announces an unlock the live path has not reached, then never again', async () => {
    await f.db
      .insert(watches)
      .values({
        observerPlayerId: myPlayer,
        observerPlanetId: f.planetIds[0]!,
        slot: 0,
        targetPlanetId: theirs,
      });

    const first = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(first.newUnlocks).toContain('EXPLORER');

    const second = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(second.newUnlocks).toEqual([]);
  });

  /**
   * DESIGN LAW #1: a player must never reach a state where nothing is pending.
   * The payload has to be able to say what is still in flight.
   */
  it('lists what is still in flight', async () => {
    await giveUnits(f.db, mine, { DART: 30 });
    const launch = await launchAttack(f.db, mine, theirs, { DART: 30 }, f.clock);

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
      await giveUnits(f.db, theirs, { DART: 30 });
      await launchAttack(f.db, theirs, mine, { DART: 30 }, f.clock);
    };

    it('says nothing at all without radar', async () => {
      await sendAtThem();
      const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
      expect(payload.pending.some((p) => p.kind === 'incoming')).toBe(false);
    });

    it('still says nothing with radar, while the fleet is far out', async () => {
      await giveInstrument(f.db, mine, 'RADAR', 3);
      /**
       * OUT PAST THE CIRCLE, WHICH IS WHAT "FAR OUT" NOW MEANS. D49.
       *
       * The test planets are a 150-unit cluster and Radar L3 reaches 200, so
       * every neighbour in the fixture is inside the circle from the moment it
       * launches — correctly, and uselessly for this assertion. Moving the
       * attacker out is what makes the fleet actually far away.
       */
      await placeAt(f.db, theirs, { x: radarRange(3) + 100 });
      await sendAtThem();

      const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
      expect(payload.pending.some((p) => p.kind === 'incoming')).toBe(false);
    });

    it('lists it inside the window radar bought', async () => {
      await giveInstrument(f.db, mine, 'RADAR', 3);
      await sendAtThem();

      const [inbound] = await f.db
        .select()
        .from(missions)
        .where(eq(missions.targetPlanetId, mine));
      // One minute inside the L3 circle: warned, and not a moment earlier. D49 —
      // the lead is a property of the LEG, so it is read off the mission row.
      const lead = leadFor(inbound!, 3);
      f.clock.set(new Date(inbound!.arriveAt.getTime() - (lead - 1) * 60_000));

      const payload = await buildReturnPayload(f.db, myPlayer, f.clock);
      const incoming = payload.pending.find((p) => p.kind === 'incoming');
      expect(incoming).toBeDefined();
      expect(incoming!.minutesRemaining).toBeLessThanOrEqual(Math.ceil(lead));
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
    await giveUnits(f.db, mine, { DART: 20 });
    await launchAttack(f.db, mine, theirs, { DART: 20 }, f.clock);

    const outbound = await buildReturnPayload(f.db, myPlayer, f.clock);
    const ours = outbound.pending.find((p) => p.kind === 'fleet');
    expect(ours?.path).toBeDefined();
    expect(ours?.path?.arriveAt.getTime()).toBeGreaterThan(ours!.path!.departAt.getTime());

    // Now let radar see something coming, inside its lead window.
    await giveInstrument(f.db, mine, 'RADAR', 3);
    await giveUnits(f.db, theirs, { DART: 20 });
    await launchAttack(f.db, theirs, mine, { DART: 20 }, f.clock);
    const [inbound] = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.targetPlanetId, mine), eq(missions.kind, 'attack')));
    f.clock.set(new Date(inbound!.arriveAt.getTime() - (leadFor(inbound!, 3) - 1) * 60_000));

    const warned = await buildReturnPayload(f.db, myPlayer, f.clock);
    const threat = warned.pending.find((p) => p.kind === 'incoming');
    expect(threat).toBeDefined();
    expect(threat?.path).toBeUndefined();
    // Nothing in the object at all, not merely a null.
    expect(Object.keys(threat!)).not.toContain('path');
  });

  it('names the planet a returning fleet is coming back from', async () => {
    await giveUnits(f.db, mine, { DART: 30 });
    const launch = await launchAttack(f.db, mine, theirs, { DART: 30 }, f.clock);

    const outbound = await buildReturnPayload(f.db, myPlayer, f.clock);
    expect(outbound.pending.find((p) => p.kind === 'fleet')?.leg).toBe('outbound');

    f.clock.set(settledAt(launch.arriveAt));
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
   * A MALFORMED PAYLOAD MUST NOT TAKE THE SOCKET DOWN.
   *
   * LISTEN runs on ONE shared connection for the whole API process, and the
   * notification callback is not wrapped by anything. `dispatch` used to cast the
   * result of `JSON.parse` straight to `StreamEvent` with only the parse inside its
   * `try` — but `null`, `7` and `"hello"` are all valid JSON, so on any of them the
   * parse succeeded and reading `.playerId` threw on the next line, outside the
   * guard. That does not drop one message: it kills live updates for every player
   * on the server, silently, with nobody told.
   *
   * Each of these goes down the real channel, and then a REAL event is published.
   * The assertion is that the real one still arrives — which is the only way to say
   * "the bus survived" rather than "nothing crashed the test runner".
   */
  it('survives every shape of rubbish on the channel', async () => {
    const rubbish = [
      'null',
      '7',
      '"hello"',
      'true',
      '[]',
      'not json at all',
      '',
      '{}',
      '{"playerId":123,"kind":"raided"}',
      '{"kind":"raided"}',
      '{"playerId":"","kind":"raided"}',
      '{"playerId":"p","kind":null}',
    ];
    for (const bad of rubbish) {
      await f.db.execute(sql`select pg_notify(${CHANNEL}, ${bad})`);
    }
    // Give the listener a beat to process all of them before the good one.
    await new Promise((r) => setTimeout(r, 300));

    const arrived = waitFor(f.playerIds[0]!);
    await publish(f.db, f.playerIds[0]!, 'raided');
    await expect(arrived, 'the bus stopped delivering after a bad payload').resolves.toMatchObject({
      kind: 'raided',
    });
    await bus.stop();
  });

  /** And rubbish is never handed to a listener as if it were an event. */
  it('never delivers a payload that failed to parse', async () => {
    let hits = 0;
    const off = bus.subscribe(f.playerIds[0]!, () => {
      hits++;
    });
    for (const bad of ['null', '{"playerId":123}', `{"playerId":"${f.playerIds[0]!}"}`]) {
      await f.db.execute(sql`select pg_notify(${CHANNEL}, ${bad})`);
    }
    await new Promise((r) => setTimeout(r, 400));
    // The third one names a real player but has no `kind`, so it is still not an
    // event — a half-formed message must not reach a listener at all.
    expect(hits).toBe(0);
    off();
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

/**
 * THE GALAXY-WIDE CHANNEL. D53.
 *
 * The player stream only ever fired for what happened TO YOU, and most of what
 * makes a disc feel inhabited happens to somebody else. This is the topic that
 * carries the rest, and every property that keeps it from being a leak or a load
 * problem is asserted here rather than reasoned about.
 */
describe('the shard channel', () => {
  let f: Fixture;
  let bus: EventBus;

  beforeEach(async () => {
    f = await seedWorld(2);
    bus = new EventBus(TEST_DATABASE_URL, silent);
    await bus.start();
  });

  afterEach(async () => {
    await bus.stop();
  });

  const waitForShard = (shard: string, ms = 3000): Promise<{ kind: string }> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('no shard event within timeout'));
      }, ms);
      const off = bus.subscribeShard(shard, (event) => {
        clearTimeout(timer);
        off();
        resolve(event);
      });
    });

  it('delivers a global operator event independently of galaxy topics', async () => {
    const arrived = new Promise<{ kind: string }>((resolve) => {
      const off = bus.subscribeGlobal((event) => {
        off();
        resolve(event);
      });
    });
    expect(bus.globalSubscriberCount()).toBe(1);
    await publishGlobal(f.db, 'announcement');
    await expect(arrived).resolves.toMatchObject({ kind: 'global:announcement' });
    expect(bus.globalSubscriberCount()).toBe(0);
  });

  it('delivers a shard event to everybody subscribed to that galaxy', async () => {
    const arrived = waitForShard(f.seasonId);
    await publishShard(f.db, f.seasonId, 'launch');
    await expect(arrived).resolves.toMatchObject({ kind: 'shard:launch' });
  });

  /**
   * TWO GALAXIES ARE TWO GALAXIES.
   *
   * Ten shards run on one deployment (D21) and they share this one Postgres
   * channel. A launch in galaxy 3 reaching galaxy 7 would send three hundred clients to
   * refetch a payload that cannot have moved — and, worse, would be a timing
   * signal crossing a boundary the whole season structure exists to draw.
   */
  it('never delivers one galaxy\'s events to another', async () => {
    let leaked = false;
    const off = bus.subscribeShard(crypto.randomUUID(), () => {
      leaked = true;
    });

    const mine = waitForShard(f.seasonId);
    await publishShard(f.db, f.seasonId, 'launch');
    await mine;

    expect(leaked).toBe(false);
    off();
  });

  /**
   * A PLAYER ID AND A SHARD ID ARE BOTH UUIDS OUT OF THE SAME GENERATOR.
   *
   * Keyed on the bare id, one flat map would deliver a galaxy's traffic to a
   * commander who happened to share its uuid — and, far more likely in practice,
   * a test or a fixture that reuses an id would pass for the wrong reason. The
   * topics are namespaced; this proves it in both directions.
   */
  it('keeps the two topics apart even when the ids are identical', async () => {
    const shared = f.playerIds[0]!;
    let asPlayer = 0;
    let asShard = 0;
    const offPlayer = bus.subscribe(shared, () => {
      asPlayer += 1;
    });
    const offShard = bus.subscribeShard(shared, () => {
      asShard += 1;
    });

    await publishShard(f.db, shared, 'world');
    await new Promise((r) => setTimeout(r, 400));
    expect(asShard).toBe(1);
    expect(asPlayer).toBe(0);

    await publish(f.db, shared, 'raided');
    await new Promise((r) => setTimeout(r, 400));
    expect(asPlayer).toBe(1);
    expect(asShard).toBe(1);

    offPlayer();
    offShard();
  });

  /**
   * WHAT IS ON THE WIRE, stated as an assertion rather than as a promise.
   *
   * The whole case for this channel not being a leak is that there is nowhere in
   * the payload to put a leak: a shard id, and a kind. No planet, no player, no
   * position, no heading. If a field is ever added here, this fails.
   */
  it('carries a shard and a kind, and nothing else at all', async () => {
    const arrived = new Promise<Record<string, unknown>>((resolve) => {
      const off = bus.subscribeShard(f.seasonId, (event) => {
        off();
        resolve(event);
      });
    });
    await publishShard(f.db, f.seasonId, 'arrival');
    expect(Object.keys(await arrived).sort()).toEqual(['kind', 'shard']);
  });

  /**
   * The kinds are namespaced on the wire because the browser reads the SSE event
   * name, and that string space already holds every notification kind — which the
   * client turns into user-visible text. A collision would put a line in somebody's
   * Signals feed that nothing wrote.
   */
  it('namespaces every kind, so it can never be read as a notification', async () => {
    for (const kind of ['launch', 'arrival', 'mining', 'world'] as const) {
      const arrived = waitForShard(f.seasonId);
      await publishShard(f.db, f.seasonId, kind);
      await expect(arrived).resolves.toMatchObject({ kind: `shard:${kind}` });
    }
  });

  /** Same transactional rule as a player event, and the same reason. */
  it('discards a shard event from a transaction that rolled back', async () => {
    let hits = 0;
    const off = bus.subscribeShard(f.seasonId, () => {
      hits += 1;
    });

    await f.db
      .transaction(async (tx) => {
        await publishShard(tx, f.seasonId, 'launch');
        throw new Error('deliberate rollback');
      })
      .catch(() => undefined);

    await new Promise((r) => setTimeout(r, 300));
    expect(hits).toBe(0);
    off();
  });

  it('stops delivering after unsubscribe', async () => {
    let hits = 0;
    const off = bus.subscribeShard(f.seasonId, () => {
      hits += 1;
    });
    expect(bus.shardSubscriberCount(f.seasonId)).toBe(1);
    off();
    expect(bus.shardSubscriberCount(f.seasonId)).toBe(0);

    await publishShard(f.db, f.seasonId, 'launch');
    await new Promise((r) => setTimeout(r, 300));
    expect(hits).toBe(0);
  });

  /**
   * `/health` has to be able to say whether the live path is up. Now that the
   * client's polls are a sixty-second net rather than the mechanism, a bus that
   * has quietly stopped listening looks exactly like a quiet galaxy.
   */
  it('reports whether it is actually listening', async () => {
    expect(bus.status().listening).toBe(true);
    const before = bus.status().delivered;

    const arrived = waitForShard(f.seasonId);
    await publishShard(f.db, f.seasonId, 'launch');
    await arrived;
    expect(bus.status().delivered).toBeGreaterThan(before);

    await bus.stop();
    expect(bus.status().listening).toBe(false);
  });
});
