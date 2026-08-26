import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { distance } from '@astera/rules';
import { missions, planets } from '../src/db/schema.js';
import { launchProbe } from '../src/services/intel.js';
import { pendingThreads } from '../src/services/session.js';
import { galaxyTraffic } from '../src/services/traffic.js';
import { EventWorker } from '../src/worker/loop.js';
import { grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * A PROBE IS NOW SHORTER THAN THE MACHINERY THAT DRAWS IT. D121.
 *
 * Every constant in the movement layer is written in MINUTES — the published
 * bearing window is floored at one refetch, the polls are sixty seconds — and a
 * probe's whole leg is now about twenty seconds. D63 already recorded what happens
 * when a tempo change walks under a rule like that: "a rule measured in minutes
 * breaks when speeds change; a rule measured in ratios does not."
 *
 * The owner reported a craft that seemed to jump backwards and start again. It
 * did not — these assertions were written to find that and it is not there — but
 * the tempo they cover is new and nothing else in the suite reaches it. Every
 * threshold below is a SHARE of the leg, so the file survives the next speed change.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is re-derive the owner's renderer. Comparing
 * the owner's picture against a stranger's is `one-galaxy.test.ts`'s job and it
 * does it by calling the real client code; a second, hand-written copy of the
 * standoff model here would only ever test itself. This file stays on the two
 * payloads, which is where a tempo fault would actually live.
 */

const silent = pino({ level: 'silent' });

const worker = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('a probe on the disc', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let third: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs, third] = f.planetIds as [string, string, string];
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    await grant(f.db, mine, 50_000, 5_000);
    await setLevel(f.db, mine, 'SHIPYARD', 3);
  });

  const worldAt = async (id: string) => {
    const [row] = await f.db.select().from(planets).where(eq(planets.id, id));
    return { x: row!.x, y: row!.y, z: row!.z };
  };

  /** Where a STRANGER's client draws the craft, from the public contact. */
  const strangerAt = async (at: Date): Promise<{ x: number; y: number; z: number } | null> => {
    const contacts = await galaxyTraffic(f.db, f.seasonId, third, at);
    const probe = contacts.find((c) => c.kind === 'probe');
    if (!probe) return null;
    const span = probe.endAt.getTime() - probe.startAt.getTime();
    const t = span <= 0
      ? 1
      : Math.max(0, Math.min(1, (at.getTime() - probe.startAt.getTime()) / span));
    return {
      x: probe.from.x + (probe.to.x - probe.from.x) * t,
      y: probe.from.y + (probe.to.y - probe.from.y) * t,
      z: probe.from.z + (probe.to.z - probe.from.z) * t,
    };
  };

  /**
   * Where the OWNER's client draws it, along the raw leg its own payload carries.
   *
   * Standoff-free on purpose — see the note at the top. The question here is
   * whether the payload's leg advances with the clock, not where the renderer
   * finally puts the sprite.
   */
  const ownerAt = async (at: Date): Promise<{ x: number; y: number; z: number } | null> => {
    const threads = await pendingThreads(f.db, mine, at);
    const probe = threads.find((thread) => thread.kind === 'probe');
    if (!probe?.path) return null;
    const { from, to, departAt, arriveAt } = probe.path;
    const span = arriveAt.getTime() - departAt.getTime();
    const t = span <= 0 ? 1 : Math.max(0, Math.min(1, (at.getTime() - departAt.getTime()) / span));
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
    };
  };

  /**
   * THE FLIGHT IS SECONDS LONG, SO EVERY WINDOW AROUND IT HAS TO FIT INSIDE IT.
   *
   * `windowOf` floors a published window at one refetch so a craft never freezes
   * between reads. That floor is now longer than the entire probe flight, and the
   * arithmetic has to survive it: a window may not begin before the read that
   * asked for it, end after the craft lands, or run backwards.
   */
  it('publishes a window that fits inside the flight it describes', async () => {
    const launch = await launchProbe(f.db, mine, theirs, f.clock);
    expect(launch.flightMinutes).toBeLessThan(1);

    for (let step = 1; step < 20; step += 1) {
      const at = new Date(f.clock.now().getTime() + (launch.flightMinutes * 60_000 * step) / 20);
      const contacts = await galaxyTraffic(f.db, f.seasonId, third, at);
      const probe = contacts.find((c) => c.kind === 'probe');
      expect(probe, `no contact at step ${String(step)}`).toBeDefined();
      expect(probe!.endAt.getTime()).toBeGreaterThan(probe!.startAt.getTime());
      expect(probe!.startAt.getTime()).toBeGreaterThanOrEqual(f.clock.now().getTime());
      expect(probe!.endAt.getTime()).toBeLessThanOrEqual(launch.arriveAt.getTime());
      // A window this short is the craft's final approach by definition, and the
      // client must be told so or its coast flies the probe through the world.
      expect(probe!.landing).toBe(true);
    }
  });

  /**
   * THE SYMPTOM, AS AN ASSERTION. Sample both payloads every second of the leg and
   * require the distance from the world it left never to decrease.
   */
  it('never moves backwards along its leg, in either payload', async () => {
    const home = await worldAt(mine);
    const launch = await launchProbe(f.db, mine, theirs, f.clock);
    const departedAt = f.clock.now();

    let ownerLast = -1;
    let strangerLast = -1;
    for (let ms = 0; ms < launch.flightMinutes * 60_000; ms += 1000) {
      const at = new Date(departedAt.getTime() + ms);
      const owner = await ownerAt(at);
      const stranger = await strangerAt(at);
      expect(owner, `the owner lost the probe ${String(ms)}ms in`).not.toBeNull();
      expect(stranger, `the galaxy lost the probe ${String(ms)}ms in`).not.toBeNull();

      const ownerOut = distance(home, owner!);
      const strangerOut = distance(home, stranger!);
      expect(ownerOut, `the owner went backwards at ${String(ms)}ms`)
        .toBeGreaterThanOrEqual(ownerLast);
      expect(strangerOut, `a stranger went backwards at ${String(ms)}ms`)
        .toBeGreaterThanOrEqual(strangerLast);
      ownerLast = ownerOut;
      strangerLast = strangerOut;
    }
  });

  /**
   * THE TURN. A probe reaching its target becomes a second `probe` row flying the
   * other way, on the worker's next tick. What must not happen is the craft
   * reappearing at the world it left — which is what "it goes back to the
   * beginning and starts again" would look like.
   */
  it('turns round at the target rather than at the world it left', async () => {
    const home = await worldAt(mine);
    const away = await worldAt(theirs);
    const legLength = distance(home, away);

    const launch = await launchProbe(f.db, mine, theirs, f.clock);
    f.clock.set(launch.arriveAt);
    await worker(f).tick();

    // The homeward leg is a SECOND `probe` row carrying `parentMissionId`, not a
    // `return` mission — a probe is the same craft going the other way.
    const rows = await f.db.select().from(missions).where(eq(missions.kind, 'probe'));
    expect(rows).toHaveLength(2);
    const flying = rows.filter((row) => row.status === 'in_flight');
    expect(flying).toHaveLength(1);
    expect(flying[0]!.originPlanetId).toBe(theirs);
    expect(flying[0]!.targetPlanetId).toBe(mine);

    const back = await ownerAt(f.clock.now());
    expect(back, 'the owner lost the probe at the moment it turned').not.toBeNull();
    // It turned round AT the target, not a leg away from it.
    expect(distance(back!, away) / legLength).toBeLessThan(0.02);
  });

  /** And the homeward leg marches back, second by second, without a jump. */
  it('flies home without going backwards either', async () => {
    const home = await worldAt(mine);
    const launch = await launchProbe(f.db, mine, theirs, f.clock);
    f.clock.set(launch.arriveAt);
    await worker(f).tick();

    const turnedAt = f.clock.now();
    let closing = Number.POSITIVE_INFINITY;
    for (let ms = 0; ms < launch.flightMinutes * 60_000; ms += 1000) {
      const at = new Date(turnedAt.getTime() + ms);
      const owner = await ownerAt(at);
      if (!owner) break; // it docked; nothing left to draw
      const toHome = distance(home, owner);
      expect(toHome, `the probe backed away from home at ${String(ms)}ms`)
        .toBeLessThanOrEqual(closing);
      closing = toHome;
    }
  });
});
