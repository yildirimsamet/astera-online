import { and, eq } from 'drizzle-orm';
import { COMBAT, engagementEndsAt } from '@blindspace/rules';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { debrisFields, missions, planets } from '../src/db/schema.js';
import { TokenService } from '../src/auth/tokens.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import { launchHarvest, launchMining } from '../src/services/mining.js';
import { galaxyTraffic } from '../src/services/traffic.js';
import {
  grant,
  giveUnits,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  testEnv,
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

interface Contact {
  id: string;
  kind: 'fleet' | 'probe' | 'mining' | 'harvest';
  fleet?: Record<string, number>;
  craft?: number;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  startAt: string;
  endAt: string;
  route?: { from: unknown; to: unknown; departAt: string; arriveAt: string };
  minutesRemaining?: number;
  engagement?: { arriveAt: string; endsAt: string; target: { x: number; y: number; z: number } };
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * POSITION IS PUBLIC; INTENT IS NOT. D24.
 *
 * The rule this file guards was rewritten by owner decision. Other people's craft
 * used to be anonymous motes, offset past attribution and visible only through the
 * middle of a flight — which protected the fog completely and left a galaxy of two
 * hundred people looking deserted. They are real craft at real positions now, for
 * the whole flight, wearing the neon that says what kind they are.
 *
 * WHAT STAYED PRIVATE IS THE ROUTE. The payload carries a bearing window — where a
 * contact is and where it will be shortly — and never the world it left or the one
 * it is heading for. That is the line these tests hold, and they hold it against
 * the raw body rather than the rendering, because a modified client is the threat.
 *
 * Mining is the stated exception and gets its own section: a race for a rock
 * everybody can see is public in full, line and clock included.
 */
describe('galaxy traffic — motion in public, intent in private', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };
  let mine: string;
  let a: string;
  let b: string;

  beforeEach(async () => {
    f = await seedWorld(4);
    [mine, a, b] = f.planetIds as [string, string, string];

    // Opposite rims: a contact has to have a real distance to cross before its
    // window says anything, and a short hop is over before it means much.
    await placeAt(f.db, a, { x: -600 });
    await placeAt(f.db, b, { x: 600 });

    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    f.clock.advance(SETTLED_MINUTES);

    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();

    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });

  afterEach(async () => {
    await close();
  });

  /** Drains the queue, for the tests that need a raid to actually land. */
  const worker = (fixture: Fixture) =>
    new EventWorker(
      fixture.db,
      fixture.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5 },
      pino({ level: 'silent' }),
    );

  /** A raid between two OTHER planets, which is what the caller may see. */
  const strangersFight = async (): Promise<void> => {
    await giveUnits(f.db, a, { WASP: 30 });
    await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
  };

  const fetchContacts = async (): Promise<Contact[]> => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: auth });
    expect(res.statusCode).toBe(200);
    return res.json<{ contacts: Contact[] }>().contacts;
  };

  const raw = async (): Promise<string> => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: auth });
    return res.body;
  };

  /* ── what the galaxy may see ───────────────────────────────── */

  it('shows something moving out there', async () => {
    await strangersFight();
    f.clock.advance(10);
    expect(await fetchContacts()).toHaveLength(1);
  });

  /**
   * THE CHANGE D24 IS FOR. A craft used to be invisible for the first quarter and
   * the last fifteen percent of every flight, so the disc was busiest exactly when
   * nobody was looking. Departure and approach are both visible now.
   */
  it('is visible from the moment it leaves', async () => {
    await strangersFight();
    // One minute in — deep inside the old blackout.
    f.clock.advance(1);
    expect(await fetchContacts()).toHaveLength(1);
  });

  it('is still visible on final approach', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
    f.clock.set(new Date(launch.arriveAt.getTime() - 60_000));
    expect(await fetchContacts()).toHaveLength(1);
  });

  it('says what kind of craft it is, because the neon does', async () => {
    await strangersFight();
    f.clock.advance(10);
    expect((await fetchContacts())[0]?.kind).toBe('fleet');
  });

  /**
   * COMPOSITION IS PUBLIC. Owner decision, on top of D24's first half.
   *
   * Focusing somebody else's squadron says how many craft and which hulls. It is
   * a real concession by the Radar ladder — L4 sold a size estimate — and it is
   * what makes a contact an object worth tapping rather than a light going past.
   */
  it('says what is in it, down to the hull', async () => {
    await strangersFight();
    f.clock.advance(10);
    expect((await fetchContacts())[0]?.fleet).toEqual({ WASP: 30 });
  });

  /** And it is stable, or focus would drop the thing the player selected. */
  it('keeps the same id across requests, so focus survives a refetch', async () => {
    await strangersFight();
    f.clock.advance(10);

    const first = await fetchContacts();
    const second = await fetchContacts();
    expect(first[0]?.id).toBeTruthy();
    expect(second[0]?.id).toBe(first[0]?.id);
  });

  /**
   * A CONTACT IS ON A REAL PATH BETWEEN TWO REAL WORLDS. Nothing here is spawned.
   *
   * The owner looked at two craft on the disc, drew their headings back, found no
   * planet behind them and asked whether these were random. They are not — but the
   * question is a fair one to be unable to answer by eye, because the origin is
   * usually off-frame and a 3D line looks like it misses in a 2D projection. So the
   * property is asserted instead of argued: the published window must lie ON the
   * segment joining the two planets that produced it, to within a rounding error.
   *
   * If this ever fails, craft really are appearing out of nowhere.
   */
  it('lies exactly on the line between the two worlds that produced it', async () => {
    await strangersFight();
    f.clock.advance(10);

    const [contact] = await fetchContacts();
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, a));
    const [target] = await f.db.select().from(planets).where(eq(planets.id, b));

    /** Perpendicular distance from a point to the infinite line through two others. */
    const offLine = (p: { x: number; y: number; z: number }): number => {
      const d = { x: target!.x - origin!.x, y: target!.y - origin!.y, z: target!.z - origin!.z };
      const v = { x: p.x - origin!.x, y: p.y - origin!.y, z: p.z - origin!.z };
      const c = {
        x: v.y * d.z - v.z * d.y,
        y: v.z * d.x - v.x * d.z,
        z: v.x * d.y - v.y * d.x,
      };
      return Math.hypot(c.x, c.y, c.z) / Math.hypot(d.x, d.y, d.z);
    };

    expect(offLine(contact!.from)).toBeLessThan(0.001);
    expect(offLine(contact!.to)).toBeLessThan(0.001);

    // And it runs the right way: further along the leg at the end than at the start.
    const along = (p: { x: number; y: number; z: number }): number =>
      Math.hypot(p.x - origin!.x, p.y - origin!.y, p.z - origin!.z);
    expect(along(contact!.to)).toBeGreaterThan(along(contact!.from));
  });

  /* ── what it must never say ────────────────────────────────── */

  /**
   * The payload is the attack surface. An id, an owner or an endpoint would each
   * be enough to rebuild the route in a modified client.
   */
  it('names no world and no owner', async () => {
    await strangersFight();
    f.clock.advance(10);

    const body = await raw();
    for (const leak of ['planetId', 'originPlanetId', 'targetPlanetId', 'owner', 'Tester']) {
      expect(body).not.toContain(leak);
    }
  });

  /** A fleet's fields are exactly the window, its kind and what is in it. */
  it('gives a fleet a bearing window and no route at all', async () => {
    await strangersFight();
    f.clock.advance(10);

    const [contact] = await fetchContacts();
    expect(Object.keys(contact!).sort()).toEqual([
      'endAt',
      'fleet',
      'from',
      'id',
      'kind',
      'startAt',
      'to',
    ]);
    expect(contact?.route).toBeUndefined();
    expect(contact?.minutesRemaining).toBeUndefined();
  });

  /**
   * THE LOAD-BEARING ONE, IN ITS NEW FORM.
   *
   * The window is a heading, so it must never run past the flight that produced
   * it — a `to` beyond the arrival point would be the destination, stated outright
   * and ahead of time, which is the one thing this payload exists to withhold.
   */
  it('never publishes a point past the end of the flight', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
    f.clock.advance(10);

    const [contact] = await fetchContacts();
    expect(new Date(contact!.endAt).getTime()).toBeLessThan(launch.arriveAt.getTime());
    expect(new Date(contact!.startAt).getTime()).toBeLessThanOrEqual(
      new Date(contact!.endAt).getTime(),
    );
  });

  /**
   * THE BUG THE OWNER FOUND FROM TWO ACCOUNTS AT ONCE. D50.
   *
   * The window used to be clamped to four fifths of the LEG, and a window whose
   * end is already in the past collapses to a single point — `from` and `to` the
   * same coordinate. The client interpolates a contact along that window, so for
   * the whole final approach every craft in the galaxy was drawn STANDING STILL,
   * on the doorstep of the world it was flying at. The attacker watched their
   * fleet fly; the defender watched it park and waited for a countdown that had
   * nothing left to count.
   *
   * The clamp is now a fixed margin measured in minutes, so a window is a real
   * heading right up to the last few seconds.
   */
  it('is still MOVING on final approach, not parked on its target', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);

    // Nine tenths of the way there: deep inside the old blackout.
    const departAt = f.clock.now().getTime();
    const span = launch.arriveAt.getTime() - departAt;
    f.clock.set(new Date(departAt + span * 0.9));

    const [contact] = await fetchContacts();
    expect(contact).toBeDefined();
    const travelled = Math.hypot(
      contact!.to.x - contact!.from.x,
      contact!.to.y - contact!.from.y,
      contact!.to.z - contact!.from.z,
    );
    expect(travelled, 'the window has no direction — the craft is frozen').toBeGreaterThan(0);
    expect(new Date(contact!.endAt).getTime()).toBeGreaterThan(
      new Date(contact!.startAt).getTime(),
    );
  });

  /**
   * AND THE POSITION IT REPORTS IS THE TRUE ONE, AT EVERY POINT OF THE FLIGHT. D50.
   *
   * The near end of the window is the craft's real interpolated position — the same
   * figure the attacker's own pending payload produces from `path`, off the same two
   * timestamps.
   *
   * THIS TEST USED TO CLAIM MORE THAN IT CHECKS, and the gap was a real bug. It was
   * called "puts a craft where its owner sees it", which stopped being true when D44
   * gave an arriving squadron a standoff: the owner draws their raid on the line
   * `origin → target − standoff`, and this payload is on `origin → target`. The two
   * agree at departure and diverge to two planet radii by arrival, where the true
   * position is INSIDE the world — so a stranger watched the raid fly into the
   * planet while the attacker watched it hold off.
   *
   * The payload is the half that is right: the server's job is the truth, and a
   * drawn radius is not a server fact. The reconciliation is `clearOfWorlds` in the
   * client, which puts any craft that would be drawn inside a world onto its
   * surface. What this test guards is the input to that — that the figure published
   * here is the real one.
   */
  it('publishes the craft’s true position at every point of the flight', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
    const departAt = f.clock.now().getTime();
    const span = launch.arriveAt.getTime() - departAt;

    const [from] = await f.db.select().from(planets).where(eq(planets.id, a));
    const [to] = await f.db.select().from(planets).where(eq(planets.id, b));

    for (const fraction of [0.1, 0.5, 0.9, 0.99]) {
      f.clock.set(new Date(departAt + span * fraction));
      const [contact] = await fetchContacts();
      expect(contact, `nothing in the air at ${String(fraction)}`).toBeDefined();
      const expected = {
        x: from!.x + (to!.x - from!.x) * fraction,
        z: from!.z + (to!.z - from!.z) * fraction,
      };
      expect(contact!.from.x).toBeCloseTo(expected.x, 3);
      expect(contact!.from.z).toBeCloseTo(expected.z, 3);
    }
  });

  /**
   * Your own craft are drawn from your own payload at full fidelity, route and
   * all. A second anonymous copy beside the real one would be confusing and would
   * hand out a calibration sample for everyone else's.
   *
   * BOTH LEGS, and that is the whole reason `ownsLeg` exists: a return leg is
   * stored with origin and target SWAPPED (D28), so a fleet coming home has its
   * owner in `targetPlanetId`. Matching on origin alone would draw an anonymous
   * copy of your own squadron beside the real one all the way home.
   */
  it('excludes your own craft on the way out and on the way home', async () => {
    await giveUnits(f.db, mine, { WASP: 30 });
    const out = await launchAttack(f.db, mine, a, { WASP: 30 }, f.clock);
    f.clock.advance(10);
    expect(await fetchContacts()).toHaveLength(0);

    // Land it and let the survivors turn for home; the return leg is still mine.
    f.clock.set(settledAt(out.arriveAt));
    await worker(f).tick();
    const [back] = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.kind, 'return'), eq(missions.status, 'in_flight')));
    expect(back, 'the fixture raid left no survivors to fly home').toBeDefined();
    expect(back!.targetPlanetId).toBe(mine);

    f.clock.advance(1);
    expect(await fetchContacts()).toHaveLength(0);
  });

  /**
   * THE TARGET IS NOT THE OWNER. D47.
   *
   * A raid flying AT me is somebody else's craft, and D24 makes other people's
   * craft public. The exclusion used to match `origin === me || target === me`,
   * which caught it too — so every stranger in the galaxy saw the contact and the
   * one player it was aimed at saw nothing at all. That is strictly less than a
   * bystander knows about a fleet approaching my own world.
   *
   * It gives away no more than it gives a stranger: a bearing window, no endpoints,
   * no owner. Whether it is coming for ME, and how long I have, is still the
   * Radar's to sell (D9) — asserted below.
   */
  it('shows a fleet flying at you, exactly as it shows one flying at anybody else', async () => {
    await giveUnits(f.db, b, { WASP: 30 });
    await launchAttack(f.db, b, mine, { WASP: 30 }, f.clock);
    f.clock.advance(10);

    const seen = await fetchContacts();
    expect(seen).toHaveLength(1);
    expect(seen[0]!.kind).toBe('fleet');
    // And still anonymous: no endpoints, no owner, no name.
    expect(seen[0]).not.toHaveProperty('route');
    expect(Object.keys(seen[0]!)).not.toContain('originPlanetId');
  });

  /**
   * AND THE RADAR LADDER IS UNTOUCHED BY IT.
   *
   * The contact says "a craft is out there". It must not say "it is landing on you
   * in nine minutes" — that is the product D9 sells, and it lives in the pending
   * payload, which stays radar-gated.
   */
  it('still tells a defender with no radar nothing about their own arrival', async () => {
    await giveUnits(f.db, b, { WASP: 30 });
    const raid = await launchAttack(f.db, b, mine, { WASP: 30 }, f.clock);
    f.clock.set(new Date(raid.arriveAt.getTime() - 60_000));

    const threads = await pendingThreads(f.db, mine, f.clock.now());
    expect(threads.filter((t) => t.kind === 'incoming')).toHaveLength(0);
  });

  /** An inbound PROBE is visible for the same reason — and probing is loud anyway. */
  it('shows a probe flying at you', async () => {
    await grant(f.db, b, 5_000, 5_000);
    await launchProbe(f.db, b, mine, f.clock);
    f.clock.advance(1);

    const seen = await fetchContacts();
    expect(seen.map((c) => c.kind)).toEqual(['probe']);
  });

  /* ── the battle everybody watches ──────────────────────────── */

  /**
   * A RAID LANDING IS PUBLIC, AND IT IS THE BEST THING ON THE DISC. D52.
   *
   * D44 built the ten-second engagement for the attacker alone — a contact carries a
   * bearing and no destination, so a bystander's client had nothing to fire at and
   * the payload simply stopped at `arriveAt`. Every other player in the galaxy
   * watched a squadron reach a world and blink out.
   *
   * The owner's decision reverses it: the fleet keeps being published for the whole
   * engagement, with the world it is hitting named, so everybody sees the battle.
   * What that discloses is a planet's coordinates — public on `/api/galaxy` for
   * every world in the disc — for the ten seconds a fleet is standing on top of it.
   * No owner, no origin, no name; and the wreckage it leaves is public anyway (D32).
   */
  describe('a raid landing', () => {
    const landed = async (offsetSeconds: number): Promise<Contact[]> => {
      await giveUnits(f.db, a, { WASP: 30 });
      const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
      f.clock.set(new Date(launch.arriveAt.getTime() + offsetSeconds * 1000));
      return fetchContacts();
    };

    it('is still on the disc while the engagement is running', async () => {
      const [contact] = await landed(3);
      expect(contact, 'the raid vanished the moment it landed').toBeDefined();
      expect(contact?.engagement).toBeDefined();
    });

    it('names the world it is hitting, and only for those seconds', async () => {
      const [contact] = await landed(1);
      const [target] = await f.db.select().from(planets).where(eq(planets.id, b));
      expect(contact?.engagement?.target).toEqual({ x: target!.x, y: target!.y, z: target!.z });
    });

    it('carries the window both clients draw against', async () => {
      const [contact] = await landed(2);
      const arriveAt = new Date(contact!.engagement!.arriveAt).getTime();
      const endsAt = new Date(contact!.engagement!.endsAt).getTime();
      expect(endsAt).toBe(engagementEndsAt(arriveAt));
    });

    /**
     * The client interpolates a squadron along its window and CLAMPS, so a payload
     * that stopped short would hold it in mid-air. The approach segment exists only
     * to give the bearing it came in on.
     */
    it('gives the bearing it came in on, ending at the world itself', async () => {
      const [contact] = await landed(1);
      const [target] = await f.db.select().from(planets).where(eq(planets.id, b));
      expect(contact?.to).toEqual({ x: target!.x, y: target!.y, z: target!.z });
      const gap = Math.hypot(
        contact!.to.x - contact!.from.x,
        contact!.to.y - contact!.from.y,
        contact!.to.z - contact!.from.z,
      );
      expect(gap, 'no direction to hold the squadron off along').toBeGreaterThan(0);
    });

    it('says nothing about who sent it, even while it is firing', async () => {
      await landed(2);
      const body = await raw();
      for (const leak of ['originPlanetId', 'playerId', 'owner', 'departAt']) {
        expect(body).not.toContain(leak);
      }
    });

    /** A probe takes a photograph. There is no battle and there must be no window. */
    it('is an attack only — a probe arriving carries no engagement', async () => {
      await setLevel(f.db, a, 'SHIPYARD', 2);
      const probe = await launchProbe(f.db, a, b, f.clock);
      f.clock.set(new Date(probe.arriveAt.getTime() + 2000));
      for (const contact of await fetchContacts()) {
        expect(contact.engagement).toBeUndefined();
      }
    });

    /** And it stops when the battle is actually settled, not a moment later. */
    it('is gone once the engagement is over', async () => {
      const contacts = await landed(COMBAT.engagementSeconds + 1);
      expect(contacts.filter((c) => c.engagement !== undefined)).toHaveLength(0);
    });
  });

  /* ── the drill is the exception ────────────────────────────── */

  /**
   * D24's one carve-out, and it is the owner's: a mining run is a public race for
   * a rock everybody can already see, so its line and its clock belong to
   * everybody. Hiding where a Prospector was going would hide the contest.
   */
  describe('mining runs are public in full', () => {
    const strangerMines = async (): Promise<void> => {
      await giveUnits(f.db, a, { PROSPECTOR: 3 });
      await launchMining(f.db, a, 0, 2, f.clock);
    };

    /**
     * Somebody else flying at a wreck field.
     *
     * The field is inserted rather than fought for: this file is about what the
     * traffic payload says, and `debris.test.ts` already owns the question of what
     * a battle leaves behind.
     */
    const strangerSalvages = async (): Promise<void> => {
      const [field] = await f.db
        .insert(debrisFields)
        .values({
          seasonId: f.seasonId,
          planetId: b,
          alloy: 5_000,
          crystal: 1_200,
          createdAt: f.clock.now(),
        })
        .returning();
      await giveUnits(f.db, a, { PROSPECTOR: 3 });
      await launchHarvest(f.db, a, field!.id, 2, f.clock);
    };

    it('shows the whole leg and the time left on it', async () => {
      await strangerMines();
      f.clock.advance(2);

      const run = (await fetchContacts()).find((c) => c.kind === 'mining');
      expect(run).toBeDefined();
      expect(run?.route).toBeDefined();
      expect(run?.minutesRemaining).toBeGreaterThan(0);
      expect(run?.craft).toBe(2);
    });

    /**
     * CARGO IS THE OWNER'S, ALWAYS. The owner's exception opened the route and the
     * clock; it did not open the hold. What a Prospector is bringing back is on
     * `/api/mining`, which answers only to the commander who sent it.
     */
    it('never says what it is carrying', async () => {
      await strangerMines();
      f.clock.advance(2);

      const body = await raw();
      for (const leak of ['minedAlloy', 'minedCrystal', 'holdEach', 'loot', 'ore']) {
        expect(body).not.toContain(leak);
      }
    });

    it('still excludes your own, which are drawn at full fidelity elsewhere', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 3 });
      await launchMining(f.db, mine, 0, 2, f.clock);
      f.clock.advance(2);

      expect((await fetchContacts()).filter((c) => c.kind === 'mining')).toHaveLength(0);
    });

    /**
     * The carve-out has to stay a carve-out. A route on a fleet would give away a
     * raid, and this is the guard against `route` being set on the wrong branch.
     */
    it('is the only kind that ever carries a route', async () => {
      await strangersFight();
      await strangerMines();
      await strangerSalvages();
      f.clock.advance(2);

      for (const contact of await fetchContacts()) {
        if (contact.kind === 'mining' || contact.kind === 'harvest') {
          expect(contact.route).toBeDefined();
        } else expect(contact.route).toBeUndefined();
      }
    });

    /**
     * A SALVAGE RUN IS ITS OWN KIND, AND FOR A LONG TIME IT WAS NOT. D32.
     *
     * `harvest` has been in `ContactKind` since D32 and nothing ever set it: every
     * row in `mining_runs` went out as `mining`, so a craft flying to a wreck field
     * was drawn in the miner's amber and its panel described a rock. The client has
     * carried the paler amber, the "Salvage run" title and the schema branch the
     * whole time and could not reach any of them.
     *
     * It is published in full for the same reason a mining run is: a field is a
     * public prize at a public address on a public clock, and hiding the race would
     * hide the contest D32 exists to create.
     */
    it('publishes a salvage run as a salvage run, in full', async () => {
      await strangerSalvages();
      f.clock.advance(2);

      const contacts = await fetchContacts();
      const run = contacts.find((c) => c.kind === 'harvest');
      expect(run, 'a harvest was published as something else').toBeDefined();
      expect(contacts.some((c) => c.kind === 'mining')).toBe(false);
      expect(run?.route).toBeDefined();
      expect(run?.minutesRemaining).toBeGreaterThan(0);
      expect(run?.craft).toBe(2);
    });

    it('never says what a salvage run is bringing home either', async () => {
      await strangerSalvages();
      f.clock.advance(2);

      const body = await raw();
      for (const leak of ['minedAlloy', 'minedCrystal', 'holdEach', 'loot']) {
        expect(body).not.toContain(leak);
      }
    });
  });

  /* ── the endpoint itself ───────────────────────────────────── */

  it('is empty when the galaxy is quiet', async () => {
    expect(await fetchContacts()).toHaveLength(0);
  });

  it('refuses a caller with no planet', async () => {
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const stranger = { authorization: `Bearer ${await tokens.issueAccess(crypto.randomUUID())}` };
    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: stranger });
    expect(res.statusCode).toBe(404);
  });

  it('is reachable only with a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic' });
    expect(res.statusCode).toBe(401);
  });

  /** Used directly by the 3D surface; keep the service honest too. */
  it('produces the same result through the service as through the route', async () => {
    await strangersFight();
    f.clock.advance(10);

    const direct = await galaxyTraffic(f.db, f.seasonId, mine, f.clock.now());
    const overHttp = await fetchContacts();
    expect(overHttp).toHaveLength(direct.length);
  });
});
