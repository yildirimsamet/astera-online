import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ABUSE, GALAXY, distance } from '@blindspace/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { planets } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { galaxyTraffic } from '../src/services/traffic.js';
import { giveUnits, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });

interface Contact {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  startAt: string;
  endAt: string;
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE 3D SURFACE MUST NOT BECOME A FREE TELESCOPE.
 *
 * Showing other players' fleets was a deliberate product decision, and it is one
 * keystroke away from deleting D1: if a contact can be traced to a departure, the
 * Telescope stops selling anything and the Veil hides nothing. Every assertion
 * below is a property that keeps motion visible and routes hidden — and they are
 * asserted against the raw payload, never the rendering.
 */
describe('galaxy traffic — motion without routes', () => {
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
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    f.clock.advance(ABUSE.graceMinutes + 10);

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

  /** A raid between two OTHER planets, which is what the caller may glimpse. */
  const strangersFight = async (): Promise<void> => {
    await giveUnits(f.db, a, { WASP: 30 });
    await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
  };

  const fetchContacts = async (): Promise<Contact[]> => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: auth });
    expect(res.statusCode).toBe(200);
    return res.json<{ contacts: Contact[] }>().contacts;
  };

  it('shows that something is moving out there', async () => {
    await strangersFight();
    f.clock.advance(10); // into the visible band

    const contacts = await fetchContacts();
    expect(contacts).toHaveLength(1);
  });

  /**
   * The payload is the attack surface. An id, an owner or a kind would each be
   * enough to rebuild the route in a modified client.
   */
  it('carries no id, owner, kind or destination — there is nothing to reveal', async () => {
    await strangersFight();
    f.clock.advance(10);

    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: auth });
    const raw = res.body;

    for (const leak of ['planetId', 'originPlanetId', 'targetPlanetId', 'missionId', 'owner', 'kind', 'fleet']) {
      expect(raw).not.toContain(leak);
    }
    expect(Object.keys((await fetchContacts())[0]!).sort()).toEqual([
      'endAt',
      'from',
      'startAt',
      'to',
    ]);
  });

  /**
   * THE LOAD-BEARING ONE. If a contact appeared on top of a planet, the fog would
   * be over: you would know whose fleet had just left.
   */
  it('never appears near the planet it left, or the one it is heading for', async () => {
    await strangersFight();
    f.clock.advance(10);

    const [contact] = await fetchContacts();
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, a));
    const [target] = await f.db.select().from(planets).where(eq(planets.id, b));

    for (const point of [contact!.from, contact!.to]) {
      expect(distance(point, origin!)).toBeGreaterThan(GALAXY.minSeparation);
      expect(distance(point, target!)).toBeGreaterThan(GALAXY.minSeparation);
    }
  });

  /**
   * Fresh randomness per request would let a player average many samples back to
   * the true path — the same mistake the telescope's windowed seeding prevents.
   */
  it('returns the same fuzzed path however many times it is asked', async () => {
    await strangersFight();
    f.clock.advance(10);

    const first = await fetchContacts();
    const second = await fetchContacts();
    const third = await fetchContacts();

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('says nothing at all before a fleet is well underway', async () => {
    await strangersFight();
    // Still inside the first quarter of the flight.
    expect(await fetchContacts()).toHaveLength(0);
  });

  it('has already faded before the fleet lands', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
    // One minute before impact — long past the visible band.
    f.clock.set(new Date(launch.arriveAt.getTime() - 60_000));

    expect(await fetchContacts()).toHaveLength(0);
  });

  /**
   * Your own fleet is drawn from your own data at full fidelity. A ghost of it
   * beside the real one would also hand you a free calibration sample for working
   * out the jitter, which is how you would then de-fuzz everyone else's.
   */
  it('excludes your own missions in both directions', async () => {
    await giveUnits(f.db, mine, { WASP: 30 });
    await launchAttack(f.db, mine, a, { WASP: 30 }, f.clock);
    await giveUnits(f.db, b, { WASP: 30 });
    await launchAttack(f.db, b, mine, { WASP: 30 }, f.clock);
    f.clock.advance(10);

    expect(await fetchContacts()).toHaveLength(0);
  });

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
