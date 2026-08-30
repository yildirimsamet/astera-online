import { eq } from 'drizzle-orm';
import { SENSOR } from '@astera/rules';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  neutralPlanetState,
  planets,
  probeReports,
  probeWorldMemories,
  satellites,
  seasons,
} from '../src/db/schema.js';
import { TokenService } from '../src/auth/tokens.js';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  createClan,
  leaveClan,
} from '../src/services/clan.js';
import { launchProbe } from '../src/services/intel.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveInstrument,
  giveSatellite,
  grant,
  levelWorld,
  placeAt,
  seedWorld,
  setLevel,
  testDb,
  testEnv,
  type Fixture,
} from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE MAP IS EARNED, NOT GIVEN. D127.
 *
 * Nothing about a world is public any more except that it is there. A commander
 * sees a live world only inside their Telescope's reach; everything else is an
 * unmarked point until they send a probe, and what the probe brings home is FROZEN
 * at the instant it looked.
 *
 * This file holds the three states and the edges between them. The single most
 * important assertion in it is the leak test: an UNKNOWN world's payload must not
 * contain the target's name, owner, development or hardware in ANY form, because
 * the fog in this project is enforced by omission rather than by nulling — a
 * nulled field is one a modified client can look for.
 */
describe('the three intel states', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };
  /** The caller. */
  let mine: string;
  /** Close enough to sit inside the naked-eye reach. */
  let near: string;
  /** Far outside any reach this fixture can buy. */
  let far: string;

  const silent = pino({ level: 'silent' });
  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(4);
    [mine, near, far] = f.planetIds as [string, string, string];

    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, near, { x: SENSOR.baseRadius * 0.5 });
    await placeAt(f.db, far, { x: SENSOR.maxRadius * 1.4 });
    // The fourth world would otherwise sit at a generated address that drifts in
    // and out of reach between seeds and make every count here a lottery.
    await placeAt(f.db, f.planetIds[3]!, { x: SENSOR.maxRadius * 1.6 });

    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    await setLevel(f.db, mine, 'SHIPYARD', 3);
    await grant(f.db, mine, 40_000, 8_000);
    // `grant` raises a Core to hold what it grants; level the world back so the
    // fixture is about intel rather than about who may fight whom.
    await levelWorld(f.db, f.planetIds);

    /**
     * PROJECTION CACHES OFF, AND THE REASON IS THE FIXTURE RATHER THAN THE PRODUCT.
     *
     * `sensorsFor` and the probe memory are player-keyed caches. A real instrument
     * completion publishes the owner's private `build_complete` event and clears
     * their sensor entry before the waking client reads again.
     * This file installs instruments and moves worlds by writing to the database
     * directly, which publishes nothing, so the caches would serve the arrangement
     * from before the test set it up. Turning them off measures the RULE rather
     * than the cache, and D99 is explicit that a cache may only change speed:
     * every assertion here must hold with it either way.
     */
    const built = buildApp({
      env: testEnv({ PROJECTION_CACHE_ENABLED: 'false' }),
      logger: silent,
      db: f.db,
      clock: f.clock,
    });
    app = built.app;
    close = built.close;
    await built.bus.start();
    await app.ready();

    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });

  afterEach(async () => {
    await close();
  });

  interface World {
    id: string;
    intel?: string;
    seenAt?: string;
    name?: string;
    owner?: string;
    coreLevel?: number;
    coreTier?: number;
    satellites?: string[];
    shielded?: boolean;
    controller?: unknown;
    clan?: unknown;
    state?: { kind: string };
    neutral?: { claimUntil: string | null };
  }

  interface ClanPresence {
    clan: { id: string; name: string; tag: string };
    members: {
      playerId: string;
      username: string;
      worlds: { planetId: string; name: string; position: { x: number; y: number; z: number } }[];
    }[];
  }

  const rawGalaxy = async (headers = auth): Promise<{
    planets: World[];
    sensors: { planetId: string }[];
    clanPresence: ClanPresence | null;
  }> => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy', headers });
    expect(res.statusCode).toBe(200);
    return res.json();
  };

  const galaxy = async (): Promise<World[]> => {
    return (await rawGalaxy()).planets;
  };
  const raw = async (): Promise<string> =>
    (await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth })).body;
  const world = async (id: string): Promise<World> => (await galaxy()).find((p) => p.id === id)!;

  /** Fly a probe to `target` and let it come home with what it saw. */
  const probe = async (target: string): Promise<Date> => {
    const launch = await launchProbe(f.db, mine, target, f.clock);
    f.clock.set(launch.arriveAt);
    await worker().tick();
    // The snapshot is taken on arrival; the observer may not read it until the
    // craft is back, which is the whole of `deliveredAt`.
    f.clock.advance(launch.flightMinutes + 1);
    await worker().tick();
    return launch.arriveAt;
  };

  /* ── the happy path ────────────────────────────────────────── */

  it('resolves your own world completely', async () => {
    const own = await world(mine);
    expect(own.intel).toBe('RESOLVED');
    expect(own.name).toBeDefined();
    expect(own.coreLevel).toBeDefined();
  });

  it('resolves a world inside the naked-eye reach', async () => {
    expect((await world(near)).intel).toBe('RESOLVED');
  });

  it('leaves a world nobody has looked at as a point', async () => {
    expect((await world(far)).intel).toBe('UNKNOWN');
  });

  it('publishes current clanmate identity and locations without resolving their worlds', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, f.seasonId));
    const leader = await clanActor(f.db, f.accountIds[0]!);
    const founded = await f.db.transaction((tx) => createClan(tx, {
      actor: leader,
      name: 'Far Watch',
      tag: 'FAR',
      description: '',
      recruiting: true,
      clock: f.clock,
    }));
    const candidate = await clanActor(f.db, f.accountIds[2]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate,
      clanId: founded.clanId,
      now: f.clock.now(),
    }));
    await f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: false,
      now: f.clock.now(),
    }));

    const payload = await rawGalaxy();
    const clanmate = payload.clanPresence?.members.find(
      (member) => member.playerId === f.playerIds[2],
    );
    const [farRow] = await f.db.select({ name: planets.name }).from(planets).where(eq(planets.id, far));

    expect(payload.planets.find((planet) => planet.id === far)?.intel).toBe('UNKNOWN');
    expect(clanmate).toMatchObject({
      playerId: f.playerIds[2],
      username: candidate.displayName,
      worlds: [{ planetId: far, name: farRow!.name }],
    });
  });

  it('does not borrow a clanmate sensor sphere', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, f.seasonId));
    const leader = await clanActor(f.db, f.accountIds[0]!);
    const founded = await f.db.transaction((tx) => createClan(tx, {
      actor: leader,
      name: 'Separate Eyes',
      tag: 'EYE',
      description: '',
      recruiting: true,
      clock: f.clock,
    }));
    const candidate = await clanActor(f.db, f.accountIds[2]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate,
      clanId: founded.clanId,
      now: f.clock.now(),
    }));
    await f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: false,
      now: f.clock.now(),
    }));

    const clanmateAuth = {
      authorization: `Bearer ${await new TokenService(
        'test-secret-that-is-long-enough',
        15,
        30,
      ).issueAccess(f.accountIds[2]!)}`,
    };
    const thirdWorldId = f.planetIds[3]!;
    const minePayload = await rawGalaxy();
    const clanmatePayload = await rawGalaxy(clanmateAuth);

    expect(clanmatePayload.planets.find((planet) => planet.id === thirdWorldId)?.intel)
      .toBe('RESOLVED');
    expect(minePayload.planets.find((planet) => planet.id === thirdWorldId)?.intel)
      .toBe('UNKNOWN');
    expect(minePayload.sensors.map((sensor) => sensor.planetId)).toEqual([mine]);
  });

  it('removes live clan presence immediately when a member leaves', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, f.seasonId));
    const leader = await clanActor(f.db, f.accountIds[0]!);
    const founded = await f.db.transaction((tx) => createClan(tx, {
      actor: leader,
      name: 'Brief Watch',
      tag: 'NOW',
      description: '',
      recruiting: true,
      clock: f.clock,
    }));
    const candidate = await clanActor(f.db, f.accountIds[2]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate,
      clanId: founded.clanId,
      now: f.clock.now(),
    }));
    await f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: false,
      now: f.clock.now(),
    }));
    expect((await rawGalaxy()).clanPresence?.members.map((member) => member.playerId))
      .toContain(candidate.playerId);

    await f.db.transaction((tx) => leaveClan(tx, { actor: candidate, now: f.clock.now() }));

    expect((await rawGalaxy()).clanPresence?.members.map((member) => member.playerId))
      .not.toContain(candidate.playerId);
    expect((await world(far)).intel).toBe('UNKNOWN');
  });

  it('remembers a world a probe has been to, without resolving it', async () => {
    const before = (await world(near)).coreLevel!;
    const observedAt = await probe(far);

    const seen = await world(far);
    expect(seen.intel).toBe('REMEMBERED');
    expect(seen.owner).toBeDefined();
    // Read off a sibling rather than typed in: `grant` raises a Core to hold what
    // it grants and `levelWorld` lifts the rest to match, so the fixture's level
    // is arithmetic and a literal here would rot the first time either changed.
    expect(seen.coreLevel).toBe(before);
    expect(seen.seenAt).toBeDefined();
    expect(new Date(seen.seenAt!).getTime()).toBe(observedAt.getTime());
  });

  /* ── the leak, which is the assertion that matters ─────────── */

  /**
   * AN ALLOWLIST, NOT A DENYLIST. Anything new on an unknown world has to be
   * argued for here first — and the argument has to be that it is a PUBLIC MOMENT
   * rather than a reading, because that is the only category D127 leaves.
   */
  it('gives an unknown world an id, a position and two public moments — nothing else', async () => {
    const unknown = await world(far);
    expect(Object.keys(unknown).sort()).toEqual(
      ['id', 'intel', 'isOwned', 'isSelf', 'position', 'state'].sort(),
    );
  });

  it('never puts an unknown world’s name, owner or hardware on the wire in any form', async () => {
    await giveSatellite(f.db, far, 'FOUNDRY');
    await giveInstrument(f.db, far, 'AEGIS', 3);
    await setLevel(f.db, far, 'CORE', 17);

    const [target] = await f.db.select().from(planets).where(eq(planets.id, far));
    const body = await raw();

    expect(body).not.toContain(target!.name);
    expect(body).not.toContain('FOUNDRY');
    // The id and position are the two things an unknown world may carry.
    expect(body).toContain(far);
  });

  /* ── the snapshot is frozen, which is the feature ──────────── */

  it('goes on showing what the probe saw after the target has built more', async () => {
    await probe(far);
    const recorded = (await world(far)).coreLevel!;

    await setLevel(f.db, far, 'CORE', recorded + 9);
    await giveSatellite(f.db, far, 'FOUNDRY');

    const still = await world(far);
    expect(still.coreLevel, 'the record moved with its subject').toBe(recorded);
    expect(still.satellites).toEqual([]);
  });

  it('updates to the newer record when a second probe lands, and keeps the older one', async () => {
    await probe(far);
    const recorded = (await world(far)).coreLevel!;
    await setLevel(f.db, far, 'CORE', recorded + 9);
    await giveSatellite(f.db, far, 'FOUNDRY');
    await giveInstrument(f.db, far, 'AEGIS', 2);
    // One look per world per hour, counted from launch (D121).
    f.clock.advance(61);
    await grant(f.db, mine, 40_000, 8_000);
    await probe(far);

    const refreshed = await world(far);
    expect(refreshed.coreLevel).toBe(recorded + 9);
    expect(refreshed.satellites).toEqual(['FOUNDRY']);
    expect(refreshed.shielded).toBe(true);

    const kept = await f.db.select().from(probeReports).where(eq(probeReports.targetPlanetId, far));
    expect(kept, 'the Intel centre is a history and may not be pruned').toHaveLength(2);
    const current = await f.db
      .select()
      .from(probeWorldMemories)
      .where(eq(probeWorldMemories.targetPlanetId, far));
    expect(current, 'the galaxy read keeps one bounded pointer per target').toHaveLength(1);
    expect(current[0]!.reportId).toBe(kept.find((row) => row.silhouette?.coreLevel === recorded + 9)!.id);
  });

  /* ── the edges ─────────────────────────────────────────────── */

  /**
   * A PROBE IN THE AIR HAS RECORDED NOTHING YOU MAY READ. The snapshot is taken on
   * arrival, because that is the moment being measured and when the target's radar
   * has its chance — but intel that teleports home is not a journey anyone plans
   * around, so the world stays unknown until the craft is back.
   */
  it('does not remember a world whose probe is still in the air', async () => {
    const launch = await launchProbe(f.db, mine, far, f.clock);
    f.clock.set(launch.arriveAt);
    await worker().tick();

    expect((await world(far)).intel).toBe('UNKNOWN');
  });

  it('resolves a remembered world the moment a telescope reaches it', async () => {
    await probe(far);
    expect((await world(far)).intel).toBe('REMEMBERED');

    await giveSatellite(f.db, mine, 'UPLINK');
    await giveInstrument(f.db, mine, 'TELESCOPE', 5);
    await placeAt(f.db, far, { x: SENSOR.maxRadius * 0.5 });

    expect((await world(far)).intel).toBe('RESOLVED');
  });

  /**
   * AND FALLS BACK WHEN THE INSTRUMENT DOES. An Uplink is what gates the Telescope
   * (D25), so losing it is losing the reach — and the world must go back to being
   * a record rather than staying resolved on a reading nobody is taking.
   */
  it('falls back to remembered when the reach goes away', async () => {
    await giveSatellite(f.db, mine, 'UPLINK');
    await giveInstrument(f.db, mine, 'TELESCOPE', 5);
    await placeAt(f.db, far, { x: SENSOR.maxRadius * 0.5 });
    await probe(far);
    expect((await world(far)).intel).toBe('RESOLVED');

    await f.db.delete(satellites).where(eq(satellites.planetId, mine));

    expect((await world(far)).intel).toBe('REMEMBERED');
  });

  /**
   * TWO THINGS SURVIVE THE FOG BECAUSE THEY ARE PUBLIC MOMENTS, NOT READINGS.
   * D52's pillar: fog hides what is known BEFORE a decision, never a live event.
   */
  it('keeps a world’s recovery visible even when nothing else about it is', async () => {
    const until = new Date(f.clock.now().getTime() + 3_600_000);
    await f.db.update(planets).set({ recoveryUntil: until }).where(eq(planets.id, far));

    const struck = await world(far);
    expect(struck.intel).toBe('UNKNOWN');
    expect(struck.state?.kind, 'a strike is published to the whole galaxy').toBe('RECOVERY');
  });

  it('never reaches past the ceiling, however good the telescope', async () => {
    await giveSatellite(f.db, mine, 'UPLINK');
    await giveInstrument(f.db, mine, 'TELESCOPE', 5);

    // `far` sits beyond `SENSOR.maxRadius`; the top of the ladder still cannot see it.
    expect((await world(far)).intel).toBe('UNKNOWN');
  });
  /**
   * A WORLD THAT CHANGED HANDS SINCE YOU LOOKED STILL SHOWS THE OLD OWNER.
   *
   * Deliberate, and the sharpest edge in the feature: the record is what you went
   * and saw, not what is true. It is also the case most likely to be reported as a
   * bug, so it is asserted rather than assumed — a commander acting on a stale
   * owner is playing the game D127 describes, not hitting a fault.
   */
  it('remembers the owner the probe found, not the one who holds it now', async () => {
    await probe(far);
    const recorded = (await world(far)).owner;
    expect(recorded).toBeDefined();

    const [newOwner] = await f.db
      .select({ id: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, near));
    // A commander may hold only one CAPITAL, so the world changes hands the way it
    // would in play — as a colony (D97).
    await f.db
      .update(planets)
      .set({ controllerPlayerId: newOwner!.id, kind: 'COLONY' })
      .where(eq(planets.id, far));

    expect((await world(far)).owner, 'the record is what you saw').toBe(recorded);
  });

  /**
   * AND A WORLD THAT WAS STRUCK SINCE YOU LOOKED STILL SHOWS ITS OLD LEVELS, while
   * the crater itself is public. The two halves pull opposite ways on purpose: the
   * EVENT is a live public moment (D106) and the CONSEQUENCE is a reading you have
   * not taken since.
   */
  it('shows the old levels and the new crater together', async () => {
    await probe(far);
    const recorded = (await world(far)).coreLevel!;

    await setLevel(f.db, far, 'CORE', Math.max(1, recorded - 4));
    const until = new Date(f.clock.now().getTime() + 3_600_000);
    await f.db.update(planets).set({ recoveryUntil: until }).where(eq(planets.id, far));

    const struck = await world(far);
    expect(struck.coreLevel).toBe(recorded);
    expect(struck.state?.kind).toBe('RECOVERY');
  });

  /**
   * A CLAN TAG IS PUBLIC IDENTITY (D114) AND STILL HAS TO BE EARNED PER WORLD.
   * Knowing a clan exists is the leaderboard's business; knowing WHICH WORLDS it
   * holds is exactly the question D127 made you go and answer.
   */
  it('never names a clan on a world nobody has looked at', async () => {
    const unknown = await world(far);
    expect(unknown).not.toHaveProperty('clan');
    expect(unknown).not.toHaveProperty('controller');
    expect(unknown).not.toHaveProperty('dominionRank');
  });

  /* ── the claim window, which is the other public moment ────── */

  /**
   * A RACE ONLY THE PEOPLE WHO ALREADY PROBED THE ROCK CAN SEE IS NOT A RACE.
   * D112, through D127.
   *
   * THIS BLOCK EXISTS BECAUSE ITS ABSENCE SHIPPED A BLANK GALAXY. The first
   * version of the fog attached the whole `neutral` object to an unknown world,
   * which was three separate mistakes at once, and every one of them is asserted
   * here rather than described:
   *
   *   · IT SENT `tier`. Tier IS development, and hiding development is the whole
   *     of D127 — a partial leak through the one field that was meant to be the
   *     exception is how a fog rule dies quietly.
   *   · IT SENT EXPIRED WINDOWS. A closed race is not a public moment; it is a
   *     reading about a neutral world. D112 makes the window public WHILE IT IS
   *     OPEN, and that is all it says.
   *   · IT SENT A PARTIAL OBJECT the client could not parse, which turned a
   *     missing date into an Invalid Date and failed the ENTIRE payload. Every
   *     world vanished, including the caller's own.
   */
  const openClaimOn = async (planetId: string, minutes: number): Promise<void> => {
    await f.db
      .update(planets)
      .set({ kind: 'NEUTRAL', controllerPlayerId: null })
      .where(eq(planets.id, planetId));
    await f.db
      .insert(neutralPlanetState)
      .values({
        planetId,
        tier: 3,
        profileSeed: 7,
        economyAnchorAt: f.clock.now(),
        claimUntil: new Date(f.clock.now().getTime() + minutes * 60_000),
      })
      .onConflictDoUpdate({
        target: neutralPlanetState.planetId,
        set: { claimUntil: new Date(f.clock.now().getTime() + minutes * 60_000) },
      });
  };

  it('keeps a live claim window visible on a world nobody has looked at', async () => {
    await openClaimOn(far, 60);

    const racing = await world(far);
    expect(racing.intel).toBe('UNKNOWN');
    expect(racing.neutral?.claimUntil).toBeTypeOf('string');
  });

  /** And the clock is the only thing in it. Tier is development. */
  it('never sends a neutral world’s tier, threat or reserve through the fog', async () => {
    await openClaimOn(far, 60);

    const racing = await world(far);
    expect(Object.keys(racing.neutral ?? {})).toEqual(['claimUntil']);
    expect(JSON.stringify(racing)).not.toContain('threat');
    expect(JSON.stringify(racing)).not.toContain('reserve');
  });

  /** A closed race is a reading again, so it goes back behind the fog. */
  it('drops a claim window that has already run out', async () => {
    await openClaimOn(far, -60);

    const done = await world(far);
    expect(done.intel).toBe('UNKNOWN');
    expect(done).not.toHaveProperty('neutral');
  });

  /**
   * THE WHOLE PAYLOAD SURVIVES IT, which is the assertion the outage was really
   * about. A partial `neutral` parsed on the server perfectly well; it was the
   * client's schema that rejected it, and it rejected ALL 106 worlds at once.
   */
  it('never emits a neutral block missing the field its clock needs', async () => {
    await openClaimOn(far, 60);
    await openClaimOn(f.planetIds[3]!, -60);

    for (const w of await galaxy()) {
      if (!w.neutral) continue;
      expect(w.neutral.claimUntil, `claimUntil on ${w.id}`).not.toBeUndefined();
    }
  });

  /** Every world in the galaxy is in exactly one state, always. */
  it('labels every world with exactly one state', async () => {
    const all = await galaxy();
    expect(all.length).toBeGreaterThan(1);
    for (const w of all) {
      expect(['RESOLVED', 'REMEMBERED', 'UNKNOWN']).toContain(w.intel);
    }
  });
});
