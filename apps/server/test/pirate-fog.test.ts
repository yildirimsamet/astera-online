import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  ENGAGEMENT_MS,
  ENGAGEMENT_STANDOFF,
  PIRATE,
  VIEW,
  TRAFFIC,
  distance,
  fleetCount,
  pirateActive,
  piratePosition,
  sensorSphere,
  type SensorEpoch,
  type Vec3,
} from '@astera/rules';
import { pirateRaids, pirateState, planets, seasons, units } from '../src/db/schema.js';
import {
  discoveredPirateIndexes,
  loadPirateSnapshot,
  pirateId,
  privatePirateField,
} from '../src/services/pirateField.js';
import {
  loadTrafficSnapshot,
  projectGalaxyTraffic,
  type Contact,
  type SensorPost,
} from '../src/services/traffic.js';
import { pendingThreads } from '../src/services/session.js';
import { launchPirateRaid } from '../src/services/pirateRaid.js';
import { giveUnits, grant, seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * WHAT A COMMANDER MAY SEE OF A PIRATE. D150 · D123.
 *
 * The three zones are the whole rule and `packages/rules/src/sight.ts` is their
 * only statement: NONE outside every circle, CONTACT inside a Radar one,
 * IDENTIFIED inside a Telescope one. A pirate is a CRAFT, so it answers to that
 * ladder exactly as a fleet does — and since D158 it is also REMEMBERED like a
 * rock: once a commander's sensor history has ever contained it, the mark stays on
 * the disc for the rest of its life.
 *
 * D160 RAISED THAT FLOOR TO IDENTIFIED. `sensor_epochs.reach` is the TELESCOPE
 * radius alone, so "discovered" means "was once inside an identifying circle" and
 * the manifest handed back is one the commander bought. The contact is marked
 * `remembered` whenever no live circle covers it, so the disc can draw the frozen
 * reading as frozen.
 *
 * The most expensive failure this file guards is publishing the ORBIT. Radius,
 * period, phase, inclination and ascending node are the route, and a route is what
 * every fog rule in this project refuses.
 */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const post = (at: Vec3, telescope: number, radar: number, planetId: string): SensorPost => ({
  ...sensorSphere(at, telescope, radar, planetId),
  planetId,
  telescope: telescope > 0,
  warn: 0,
  revealsSize: false,
  revealsKind: false,
});

const BLIND: SensorPost[] = [];

/** `real` columns are float4, so a stored rendezvous comes back slightly rounded. */
const near = (got: Vec3 | undefined, want: Vec3): void => {
  expect(got).toBeDefined();
  expect(got!.x).toBeCloseTo(want.x, 2);
  expect(got!.y).toBeCloseTo(want.y, 2);
  expect(got!.z).toBeCloseTo(want.z, 2);
};

describe('a pirate on the disc', () => {
  let f: Fixture;
  let mine: string;
  let key: string;
  let startsAt: Date;

  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
    mine = f.planetIds[0]!;
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    key = season!.asteroidKey;
    startsAt = season!.startsAt;
  });

  /** A pirate that is up at some minute, and the place it is standing. */
  const live = (): { index: number; at: Vec3; minute: number; level: number } => {
    const field = privatePirateField(key);
    for (const spec of field) {
      const minute = Math.ceil(spec.appearsAt) + 1;
      if (!pirateActive(spec, minute)) continue;
      return { index: spec.index, at: piratePosition(spec, minute), minute, level: spec.level };
    }
    throw new Error('empty lane');
  };

  const contactsFor = async (
    sensors: SensorPost[],
    now: Date,
    ownIds: string[] = [],
    /** Pirates D158's memory is holding open for this caller. Empty by default. */
    discovered: ReadonlySet<number> = new Set(),
  ): Promise<Contact[]> => {
    const [snapshot, pirates] = await Promise.all([
      loadTrafficSnapshot(f.db, f.seasonId, now),
      loadPirateSnapshot(f.db, f.seasonId, now),
    ]);
    return projectGalaxyTraffic(
      snapshot,
      ownIds[0] ?? null,
      now,
      ownIds.length > 0 ? f.playerIds[0]! : null,
      ownIds,
      sensors,
      new Set(),
      pirates,
      discovered,
    );
  };

  it('does not exist at all for a commander whose circles do not cover it', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    // A blind caller, and a caller with eyes on the far side of the disc.
    const far = post({ x: -1900, y: 0, z: 0 }, 0, 0, mine);
    expect((await contactsFor(BLIND, now)).some((c) => c.id === pirateId(key, target.index)))
      .toBe(false);
    if (distance(far.at, target.at) > far.identify) {
      expect((await contactsFor([far], now)).some((c) => c.id === pirateId(key, target.index)))
        .toBe(false);
    }
  });

  /**
   * D158 · D160, AND IT REVERSES THE TEST DIRECTLY ABOVE FOR ONE CASE ONLY.
   *
   * A commander who has had this pirate inside a post keeps it for the rest of its
   * life. Owner instruction: "korsan filolar, asteroid gibi" — an opportunity that
   * expires while the fleet is being packed is not a decision.
   *
   * AND WHAT MEMORY HANDS BACK IS THE READING THEY PAID FOR (D160): the crew and
   * the level, because the epoch that discovered it was a TELESCOPE circle. It is
   * flagged `remembered`, which is the payload saying "frozen, not live" — the one
   * thing a faded mark on the disc has to be able to prove.
   */
  it('keeps a pirate it has already found, blind and at any range', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const held = (await contactsFor(BLIND, now, [], new Set([target.index])))
      .find((c) => c.id === pirateId(key, target.index));

    expect(held).toBeDefined();
    expect(held!.kind).toBe('pirate');
    expect(held!.level).toBe(target.level);
    expect(held!.fleet).toBeDefined();
    expect(held!.remembered).toBe(true);
  });

  /** And memory of ONE pirate is not memory of the lane. */
  it('holds open only the pirates that were actually found', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const contacts = await contactsFor(BLIND, now, [], new Set([target.index]));
    const pirateIds = new Set(contacts.map((c) => c.id));
    const field = privatePirateField(key);
    for (const spec of field) {
      if (spec.index === target.index) continue;
      expect(pirateIds.has(pirateId(key, spec.index))).toBe(false);
    }
  });

  /**
   * A LIVE READING IS NOT MARKED FROZEN. Same pirate, same memory, but a circle
   * covers it right now — so `remembered` is absent and the disc draws it at full
   * strength. That flag is the entire difference between the two pictures.
   */
  it('does not flag a pirate a live circle is currently covering', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const eye = post(target.at, 5, 5, mine);
    const seen = (await contactsFor([eye], now, [], new Set([target.index])))
      .find((c) => c.id === pirateId(key, target.index));

    expect(seen?.kind).toBe('pirate');
    expect(seen?.level).toBe(target.level);
    expect(seen?.remembered).toBeUndefined();
  });

  /**
   * AND RADAR ALONE IS UNTOUCHED BY D160. A pirate no telescope has ever held is
   * the moving question mark it always was, whatever the radar can reach.
   */
  it('leaves a never-identified pirate a question mark inside a radar circle', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const eye = post(target.at, 0, 5, mine);
    const away = { x: target.at.x + eye.identify + 50, y: target.at.y, z: target.at.z };
    const radarOnly = post(away, 0, 5, mine);
    const contact = (await contactsFor([radarOnly], now))
      .find((c) => c.id === pirateId(key, target.index));

    expect(contact?.kind).toBe('unknown');
    expect(contact?.fleet).toBeUndefined();
    expect(contact?.level).toBeUndefined();
  });

  /**
   * AND THE MEMORY ITSELF IS COMPUTED, not asserted by the caller. D158.
   *
   * The two cases above hand the discovery set in, which is the right shape for a
   * fog test and proves nothing about where the set comes from. This is the other
   * half: `discoveredPirateIndexes` reading the same `sensor_epochs` rows the rock
   * lane reads, through the same analytic orbit/sphere solve.
   */
  it('works out for itself which pirates a sensor history has ever held', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const pirates = await loadPirateSnapshot(f.db, f.seasonId, now);

    // A post at the centre of the disc, wide enough to have swept every orbit.
    const everywhere: SensorEpoch = {
      at: { x: 0, y: 0, z: 0 },
      reach: 1e6,
      startsAt: 0,
      endsAt: null,
    };
    expect(discoveredPirateIndexes(pirates, [everywhere], now).has(target.index)).toBe(true);

    // A pinhole parked outside the galaxy sees nothing, ever.
    const nowhere: SensorEpoch = {
      at: { x: 1e6, y: 0, z: 0 },
      reach: 1,
      startsAt: 0,
      endsAt: null,
    };
    expect(discoveredPirateIndexes(pirates, [nowhere], now).size).toBe(0);
    expect(discoveredPirateIndexes(pirates, [], now).size).toBe(0);
  });

  it('is a moving question mark inside a Radar circle and nothing more', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    // Radar reach without telescope reach: identify 0 is impossible (the naked eye
    // has a floor), so the post is placed just outside `identify` and inside `detect`.
    const eye = post(target.at, 0, 5, mine);
    const away = { x: target.at.x + eye.identify + 50, y: target.at.y, z: target.at.z };
    const radarOnly = post(away, 0, 5, mine);
    expect(distance(radarOnly.at, target.at)).toBeGreaterThan(radarOnly.identify);
    expect(distance(radarOnly.at, target.at)).toBeLessThanOrEqual(radarOnly.detect);

    const contact = (await contactsFor([radarOnly], now))
      .find((c) => c.id === pirateId(key, target.index));
    expect(contact).toBeDefined();
    expect(contact!.kind).toBe('unknown');
    /*
      A RADAR RETURN IS A POSITION. Not a roster, not a level, not a price tag —
      those are what the Telescope is sold for, and a contact that carried them
      would be the ladder giving itself away for free.
    */
    expect(contact!.fleet).toBeUndefined();
    expect(contact!.level).toBeUndefined();
    // The upper rungs were not granted on this post, so no mass and no silhouette.
    expect(contact!.mass).toBeUndefined();
    expect(contact!.silhouette).toBeUndefined();
  });

  it('sells mass at Radar L4 and a silhouette at L5, still without a roster', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const base = post(target.at, 0, 5, mine);
    const away = { x: target.at.x + base.identify + 50, y: target.at.y, z: target.at.z };

    const l4: SensorPost = { ...post(away, 0, 5, mine), revealsSize: true };
    const seen4 = (await contactsFor([l4], now)).find((c) => c.id === pirateId(key, target.index));
    expect(seen4!.mass).toBeDefined();
    expect(seen4!.silhouette).toBeUndefined();
    expect(seen4!.fleet).toBeUndefined();

    const l5: SensorPost = { ...l4, revealsKind: true };
    const seen5 = (await contactsFor([l5], now)).find((c) => c.id === pirateId(key, target.index));
    expect(seen5!.silhouette).toBe('pirate');
    expect(seen5!.fleet).toBeUndefined();
    expect(seen5!.level).toBeUndefined();
  });

  it('resolves into the fleet itself, with its level, inside a Telescope circle', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const eye = post(target.at, 5, 5, mine);

    const contact = (await contactsFor([eye], now))
      .find((c) => c.id === pirateId(key, target.index));
    expect(contact!.kind).toBe('pirate');
    expect(fleetCount(contact!.fleet ?? {})).toBeGreaterThan(0);
    expect(contact!.level).toBe(target.level);
    expect(contact!.mass).toBeDefined();
  });

  it('publishes a point and a bearing, and never its orbit', async () => {
    /*
      THE ORBIT IS THE ROUTE. Radius, period, phase, inclination and ascending node
      would let any client re-derive where the pirate has been and will be for the
      rest of its life — which is precisely what `route` is refused for on a raid.
      Asserted over the SERIALISED payload so a field added later cannot slip
      through by not being named here.
    */
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const eye = post(target.at, 5, 5, mine);
    const contact = (await contactsFor([eye], now))
      .find((c) => c.id === pirateId(key, target.index));

    const wire = JSON.stringify(contact);
    for (const forbidden of ['radius', 'period', 'phase', 'inclination', 'ascendingNode', 'speed']) {
      expect(wire).not.toContain(forbidden);
    }
    expect(contact!.route).toBeUndefined();
    // Nor the raw lane index, under any name.
    expect(contact!.id).toBe(pirateId(key, target.index));
    expect(wire).not.toContain('"index"');
    expect(wire).not.toContain('pirateIndex');
  });

  it('keeps its window at least one refetch long, and far shorter than a straight leg', async () => {
    /*
      CLAUDE.md records the exact bug: a published window and the client's poll
      interval drifted apart and every craft in the game began publishing the world
      it was flying to. The pirate window is DERIVED from the poll interval — and
      it is deliberately much shorter than `TRAFFIC.bearingMinutes`, because four
      minutes of a six-minute orbit is most of a lap and the straight chord the
      client draws would cut visibly through the middle of the circle.
    */
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const eye = post(target.at, 5, 5, mine);
    const contact = (await contactsFor([eye], now))
      .find((c) => c.id === pirateId(key, target.index));

    const span = contact!.endAt.getTime() - contact!.startAt.getTime();
    expect(span).toBe(PIRATE.bearingMs);
    expect(span).toBeGreaterThanOrEqual(TRAFFIC.refreshMs);
    expect(span).toBeLessThan(TRAFFIC.bearingMinutes * 60_000);
    // And the arc it spans is small enough that a straight chord is honest.
    expect(distance(contact!.from, contact!.to)).toBeLessThan(200);
  });

  it('is gone from the disc once somebody wipes it out', async () => {
    const target = live();
    const now = new Date(startsAt.getTime() + target.minute * 60_000);
    const eye = post(target.at, 5, 5, mine);
    expect((await contactsFor([eye], now)).some((c) => c.id === pirateId(key, target.index)))
      .toBe(true);

    await f.db.insert(pirateState).values({
      seasonId: f.seasonId,
      index: target.index,
      losses: privatePirateField(key)[target.index]!.roster,
      destroyedAt: now,
      destroyedByPlayerId: f.playerIds[1]!,
      updatedAt: now,
    });

    expect((await contactsFor([eye], now)).some((c) => c.id === pirateId(key, target.index)))
      .toBe(false);
  });
});

describe('a raid at a pirate, seen from outside', () => {
  let f: Fixture;
  let mine: string;
  let key: string;
  let startsAt: Date;

  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
    mine = f.planetIds[0]!;
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    key = season!.asteroidKey;
    startsAt = season!.startsAt;
  });

  const launch = async () => {
    const field = privatePirateField(key);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const eye = sensorSphere({ x: world!.x, y: world!.y, z: world!.z }, 0, 0, mine);
    for (const spec of field) {
      for (let minute = Math.ceil(spec.appearsAt) + 1; minute < spec.expiresAt; minute += 1) {
        const at = piratePosition(spec, minute);
        if (distance(eye.at, at) > eye.identify) continue;
        f.clock.set(new Date(startsAt.getTime() + minute * 60_000));
        await grant(f.db, mine, 200_000, 40_000);
        await giveUnits(f.db, mine, { DART: 40 });
        return {
          spec,
          launch: await launchPirateRaid(f.db, mine, pirateId(key, spec.index), { DART: 40 }, f.clock),
        };
      }
    }
    throw new Error('no visible pirate this season');
  };

  const contactsFor = async (
    sensors: SensorPost[],
    now: Date,
    ownIds: string[],
    playerIndex: number,
    discovered: ReadonlySet<number> = new Set(),
  ): Promise<Contact[]> => {
    const [snapshot, pirates] = await Promise.all([
      loadTrafficSnapshot(f.db, f.seasonId, now),
      loadPirateSnapshot(f.db, f.seasonId, now),
    ]);
    return projectGalaxyTraffic(
      snapshot,
      ownIds[0] ?? null,
      now,
      f.playerIds[playerIndex] ?? null,
      ownIds,
      sensors,
      new Set(),
      pirates,
      discovered,
    );
  };

  it('is a craft like any other to a stranger, and absent from its own owner\'s list', async () => {
    /*
      G1 · G2. The owner's craft is deliberately removed from the public contact
      list so a decorated copy never sits beside the anonymous one — which makes
      `pendingThreads` the ONLY place a launched raid is drawn for the player who
      launched it. Without both halves the player watches their fleet leave and
      then vanish.
    */
    const { launch: sent } = await launch();
    const now = new Date(f.clock.now().getTime() + 30_000);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const stranger = post({ x: world!.x, y: world!.y, z: world!.z }, 5, 5, f.planetIds[1]!);
    const seen = (await contactsFor([stranger], now, [f.planetIds[1]!], 1))
      .find((c) => c.id === sent.raidId);
    expect(seen).toBeDefined();
    expect(seen!.kind).toBe('fleet');
    expect(seen!.fleet).toEqual({ DART: 40 });
    // A craft, not a route: no line to the pirate and no clock on it.
    expect(seen!.route).toBeUndefined();
    expect(seen!.minutesRemaining).toBeUndefined();

    const mineSeen = (await contactsFor([stranger], now, [mine], 0))
      .find((c) => c.id === sent.raidId);
    expect(mineSeen).toBeUndefined();

    const threads = await pendingThreads(f.db, mine, now);
    const own = threads.find((t) => t.id === sent.raidId);
    expect(own).toBeDefined();
    expect(own!.kind).toBe('pirate');
    expect(own!.leg).toBe('outbound');
    expect(own!.fleet).toEqual({ DART: 40 });
    expect(own!.pirate?.callsign).toHaveLength(4);
    near(own!.path?.to, sent.intercept);
    // There is no world on the far end, so there is no world id to hand over.
    expect(own!.targetPlanetId).toBeUndefined();
  });

  it('holds the pirate at the meeting point for the ten seconds of the fight', async () => {
    /*
      G6. The battle happens at the rendezvous, not wherever the orbit has carried
      the pirate to by then. Publishing the orbit through the engagement would draw
      two fleets shooting at each other while drifting apart.
    */
    const { spec, launch: sent } = await launch();
    const during = new Date(sent.arriveAt.getTime() + ENGAGEMENT_MS / 2);
    const eye = post(sent.intercept, 5, 5, f.planetIds[1]!);

    const contact = (await contactsFor([eye], during, [f.planetIds[1]!], 1))
      .find((c) => c.id === pirateId(key, spec.index));
    expect(contact).toBeDefined();
    near(contact!.from, sent.intercept);
    near(contact!.to, sent.intercept);
    /*
      AND IT AIMS AT WHAT IS SHOOTING AT IT, NOT AT ITSELF. D150.

      The target used to be the pirate's own held point, which left the aim vector
      zero-length: the client skipped its `lookAt` and the crew sat through the
      fight facing wherever the orbit had left them, with no gap for a round to
      cross — so no bombardment was drawn at all. It now names the attacker's hold
      point, one `ENGAGEMENT_STANDOFF` short of the rendezvous along the line the
      raid flew in on, which is what makes the two face each other and fire.
    */
    expect(contact!.engagement).toBeDefined();
    const foe = contact!.engagement!.target;
    const gap = distance(foe, sent.intercept);
    expect(gap).toBeGreaterThan(0);
    // World units, converted back to the game scale the payload is in.
    expect(gap).toBeCloseTo(ENGAGEMENT_STANDOFF * VIEW.scale, 1);

    // The attacking wing holds at that same point, so both sides read one battle.
    const wing = (await contactsFor([eye], during, [f.planetIds[1]!], 1))
      .find((c) => c.id === sent.raidId);
    expect(wing).toBeDefined();
    near(wing!.from, foe);
    near(wing!.engagement!.target, sent.intercept);

    // Neither side is `effectOnly` for an observer who can actually see them: a
    // sensed craft is a craft, and the flash comes with it.
    expect(contact!.effectOnly).toBeUndefined();
    expect(wing!.effectOnly).toBeUndefined();
  });

  /**
   * THE FLASH IS PUBLIC AT ANY RANGE; THE CRAFT IS NOT. D52 · D123 — OWNER
   * INSTRUCTION.
   *
   * A world battle has published its bombardment to the whole galaxy since D52 —
   * out of range you get the volley over a public planet centre and nothing else.
   * A pirate battle published nothing at all, on the reasoning that empty space has
   * no public address to hang it on.
   *
   * THAT REASONING DID NOT SURVIVE ITS OWN CONSEQUENCE. The fight leaves a
   * `debris_fields` row at that exact point, and wreckage is public to everybody at
   * any range (D32) — it is drawn on the disc and counted in the readout. So the
   * coordinate was already being handed to the entire galaxy, durably, for the
   * whole decay window; withholding the ten-second flash that preceded it hid
   * nothing and cost the disc one of the few genuinely public moments it has.
   *
   * SO THE RULE IS THE WORLD'S RULE: the moment is public, the squadron answers to
   * the horizon. What goes out is a point and an instant — no craft, no bearing, no
   * mass, no silhouette, no roster — and the renderer invents its own firing
   * direction from the event id so not even the approach can be read off it.
   */
  it('publishes the flash of a pirate battle to a commander who cannot see either side', async () => {
    const { spec, launch: sent } = await launch();
    const during = new Date(sent.arriveAt.getTime() + ENGAGEMENT_MS / 2);

    const blind = await contactsFor(BLIND, during, [f.planetIds[1]!], 1);
    const crew = blind.find((c) => c.id === pirateId(key, spec.index));
    const wing = blind.find((c) => c.id === sent.raidId);

    // Both sides are firing, so both sides' fire is drawn.
    expect(crew).toBeDefined();
    expect(wing).toBeDefined();

    for (const side of [crew!, wing!]) {
      expect(side.effectOnly).toBe(true);
      expect(side.kind).toBe('unknown');
      expect(side.engagement).toBeDefined();
      // No craft was sensed, so nothing about a craft goes out.
      expect(side.mass).toBeUndefined();
      expect(side.silhouette).toBeUndefined();
      expect(side).not.toHaveProperty('fleet');
      expect(side).not.toHaveProperty('level');
      expect(side).not.toHaveProperty('route');
      /*
        AND NOT ONE END OF A BEARING. A window with two different points is a
        heading; both ends are the rendezvous, so there is nothing to extrapolate.
      */
      expect(side.from).toEqual(side.to);
      near(side.from, sent.intercept);
      near(side.engagement!.target, sent.intercept);
    }
  });

  /**
   * AND THE ATTACKER'S HOLD IS NEVER THE POINT THAT IS PUBLISHED.
   *
   * It sits one `ENGAGEMENT_STANDOFF` back along the line the raid flew in on, so
   * publishing it to somebody who cannot see the craft hands them the APPROACH —
   * which is the direction of the raider's world. The world case refuses the orbit
   * point for exactly this reason and publishes the planet's centre instead; the
   * rendezvous is this lane's equivalent, and it carries no bearing at all.
   */
  it('never leaks the approach through the public flash', async () => {
    const { launch: sent } = await launch();
    const during = new Date(sent.arriveAt.getTime() + ENGAGEMENT_MS / 2);
    const [home] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const wing = (await contactsFor(BLIND, during, [f.planetIds[1]!], 1))
      .find((c) => c.id === sent.raidId);
    expect(wing).toBeDefined();
    // The published point is the rendezvous, which is FURTHER from the raider's
    // world than the hold it is actually standing at.
    const published = distance(wing!.from, { x: home!.x, y: home!.y, z: home!.z });
    const held = distance(sent.intercept, { x: home!.x, y: home!.y, z: home!.z })
      - ENGAGEMENT_STANDOFF * VIEW.scale;
    expect(published).toBeGreaterThan(held);
  });

  /**
   * SEEING ONE SIDE IS NOT SEEING THE FIGHT.
   *
   * The two sides are zoned independently — they stand `ENGAGEMENT_STANDOFF` apart
   * and a circle's edge can fall between them. A commander in that position gets
   * the craft they can actually see, and the other side's fire as a flash only.
   * That is the honest picture and it is a good one: something is shooting back at
   * a thing you can see, and you cannot say what.
   */
  it('gives a craft for the side in reach and a flash for the side that is not', async () => {
    const { spec, launch: sent } = await launch();
    const during = new Date(sent.arriveAt.getTime() + ENGAGEMENT_MS / 2);
    // An eye tight enough to hold the rendezvous and nothing much beyond it.
    const eye = post(sent.intercept, 5, 5, f.planetIds[1]!);
    const seen = await contactsFor([eye], during, [f.planetIds[1]!], 1);

    const crew = seen.find((c) => c.id === pirateId(key, spec.index));
    expect(crew?.effectOnly).toBeUndefined();
    expect(crew?.fleet).toBeDefined();

    // Now blind that eye to the wing alone by shrinking it to the pirate's point.
    const pinhole = post(sent.intercept, 0, 0, f.planetIds[1]!);
    const narrowed = { ...pinhole, detect: 1, identify: 1 };
    const partial = await contactsFor([narrowed], during, [f.planetIds[1]!], 1);
    const crewOnly = partial.find((c) => c.id === pirateId(key, spec.index));
    const wingOnly = partial.find((c) => c.id === sent.raidId);
    expect(crewOnly?.effectOnly).toBeUndefined();
    expect(wingOnly?.effectOnly).toBe(true);
  });

  it('draws a returning raid as what survived, never as what launched', async () => {
    /*
      THE FOG HIDES AND NEVER LIES.

      A raid limping home has already taken its casualties. `pirate_raids.fleet` is
      the immutable LAUNCH roster, so publishing it on the return leg would show a
      watching commander forty Darts that no longer exist — and "how weakened is
      that neighbour" is exactly the fact a Telescope is bought to answer. The
      parked `units` rows are the live answer; `pendingThreads` already reads them.
    */
    const { launch: sent } = await launch();
    const homeAt = new Date(sent.arriveAt.getTime() + 30 * 60_000);
    await f.db
      .update(pirateRaids)
      .set({ status: 'returning', homeAt })
      .where(eq(pirateRaids.id, sent.raidId));
    // Thirty-one of forty died at the rendezvous.
    await f.db
      .update(units)
      .set({ count: 9 })
      .where(eq(units.location, `pirate:${sent.raidId}`));

    const now = new Date(sent.arriveAt.getTime() + 60_000);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const stranger = post({ x: world!.x, y: world!.y, z: world!.z }, 5, 5, f.planetIds[1]!);
    const seen = (await contactsFor([stranger], now, [f.planetIds[1]!], 1))
      .find((c) => c.id === sent.raidId);

    expect(seen).toBeDefined();
    expect(seen!.fleet).toEqual({ DART: 9 });
  });

  it('draws no return leg for a raid that lost everything', async () => {
    const { launch: sent } = await launch();
    await f.db
      .update(pirateRaids)
      .set({ status: 'returning', homeAt: null })
      .where(eq(pirateRaids.id, sent.raidId));
    const now = new Date(sent.arriveAt.getTime() + 60_000);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const stranger = post({ x: world!.x, y: world!.y, z: world!.z }, 5, 5, f.planetIds[1]!);

    expect((await contactsFor([stranger], now, [f.planetIds[1]!], 1))
      .some((c) => c.id === sent.raidId)).toBe(false);
    expect((await pendingThreads(f.db, mine, now)).some((t) => t.id === sent.raidId)).toBe(false);
  });
});

/**
 * THE FIXTURE CONTRACT, AND WHY IT IS ASSERTED IN THIS FILE.
 *
 * A pirate has no discovery gate — that is the whole of D150's fog choice — and
 * `seasons.asteroidKey` is `defaultRandom()`, so every seeded season used to grow
 * a DIFFERENT pirate lane. Any test that asserted on the whole contact list was
 * therefore rolling dice against it: `sensor-horizon.test.ts` failed on two runs
 * in eight, always on a pirate that was legitimately inside the naked eye and had
 * nothing to do with the craft under test.
 *
 * So the lane is OFF in the shared fixture and a pirate test asks for it. That is
 * the same shape as the rocks, which stay invisible until a test grants discovery
 * — content a test did not ask for may not appear in its assertions.
 */
describe('the shared test fixture', () => {
  /** Eyes that would resolve anything anywhere, so an empty answer means empty. */
  const omniscient = (planetId: string): SensorPost => ({
    planetId,
    at: { x: 0, y: 0, z: 0 },
    identify: 1e6,
    detect: 1e6,
    telescope: true,
    warn: 0,
    revealsSize: true,
    revealsKind: true,
  });

  const piratesOver = async (f: Fixture, hours: number): Promise<number> => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    let seen = 0;
    for (let minute = 0; minute < hours * 60; minute += 5) {
      const now = new Date(season!.startsAt.getTime() + minute * 60_000);
      const [snapshot, pirates] = await Promise.all([
        loadTrafficSnapshot(f.db, f.seasonId, now),
        loadPirateSnapshot(f.db, f.seasonId, now),
      ]);
      seen += projectGalaxyTraffic(
        snapshot, null, now, null, [], [omniscient(f.planetIds[0]!)], new Set(), pirates, new Set(),
      ).filter((c) => c.kind === 'pirate' || c.silhouette === 'pirate').length;
    }
    return seen;
  };

  it('puts no pirate in front of a test that never asked for one', async () => {
    const f = await seedWorld(2);
    expect(await piratesOver(f, 12)).toBe(0);
  });

  it('hands the lane back to a test that opts in', async () => {
    const f = await seedWorld(2, 4242, { pirates: true });
    expect(await piratesOver(f, 12)).toBeGreaterThan(0);
  });
});
