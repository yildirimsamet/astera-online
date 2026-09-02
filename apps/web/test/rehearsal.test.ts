import { describe, expect, it, vi } from 'vitest';
import {
  HULLS,
  OPENING_BONUS,
  PLANET_START,
  hangarCapacity,
  PROBE,
  START,
  START_BUILDINGS,
  SENSOR,
  asteroidPosition,
  generateGalaxy,
  upgradeCost,
} from '@astera/rules';
import { Api } from '../src/api/client.js';
import {
  buildSchema,
  galaxySchema,
  intelSchema,
  miningSchema,
  pendingSchema,
  planetSchema,
  seasonSchema,
  trafficSchema,
  upgradeSchema,
  type Preview,
} from '../src/api/schemas.js';
import { rehearsalFetch } from '../src/onboarding/rehearsalFetch.js';
import {
  build,
  openWorld,
  planetOf,
  refusesBuild,
  refusesUpgrade,
  upgrade,
  type RehearsalWorld,
} from '../src/onboarding/world.js';

/**
 * THE REHEARSAL. D56.
 *
 * A visitor plays two minutes of the real game before there is an account, and the
 * one thing that must never happen is a rehearsal that promises something the
 * claim then refuses — the opening would visibly un-happen on the one screen the
 * game is played on. So every guard here is asserted against the same
 * `@astera/rules` the server validates with, and the payloads are asserted against
 * the production Zod schemas rather than against fixtures this file wrote.
 */

const world = (over: Partial<Preview['reserved']> = {}): Preview['reserved'] => ({
  id: 'reserved',
  name: 'Kestrel-12',
  slotIndex: 12,
  position: { x: 0, y: 0, z: 0 },
  ...over,
});

/**
 * A season that started an hour ago, relative to whatever "now" is.
 *
 * NOT A FIXED DATE. Asteroids have a lifetime measured in minutes from the season
 * start, so a literal in the past means every rock in the field has expired and
 * the disc is empty — a fixture that has quietly stopped testing what it claims
 * to, rather than a failure.
 */
const HOUR = 60 * 60_000;

const previewOf = (planets: Preview['galaxy']['planets'] = []): Preview => ({
  season: {
    seasonId: 'season-1',
    shard: 'EU-1',
    shardName: 'Vantage',
    seed: 4242,
    status: 'live',
    startsAt: new Date(Date.now() - HOUR),
    endsAt: new Date(Date.now() + 14 * 24 * HOUR),
    playerCap: 50,
    players: 38,
  },
  galaxy: {
    you: { planetId: 'reserved', playerId: 'reserved' },
    planets: [
      {
        id: 'reserved',
        name: 'Kestrel-12',
        owner: '',
        position: { x: 0, y: 0, z: 0 },
        coreTier: 1,
        coreLevel: 1,
        intel: 'RESOLVED' as const,
        state: { kind: 'NORMAL' as const },
        satellites: [],
        shielded: false,
        isSelf: true,
      },
      ...planets,
    ],
  },
  traffic: { contacts: [] },
  reserved: world(),
  shard: { code: 'EU-1', name: 'Vantage', planets: 38, capacity: 50, online: 6 },
});

const neighbour = (
  id: string,
  x: number,
  coreTier = 1,
): Preview['galaxy']['planets'][number] => ({
  id,
  name: `World-${id}`,
  owner: `Commander ${id}`,
  position: { x, y: 0, z: 0 },
  coreTier,
  // A level inside the tier it was given, so the pair stays self-consistent the
  // way the server's projection makes them: `coreTier` is `ceil(level / 3)`.
  coreLevel: coreTier * 3,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
});

/** The only opening the rules permit: Core first, then the two it was blocking. */
const opened = (): RehearsalWorld => {
  let w = openWorld(previewOf());
  w = upgrade(w, 'CORE');
  w = upgrade(w, 'REFINERY');
  w = upgrade(w, 'EXTRACTOR');
  return w;
};

/* ── the opening is arithmetic, not a script ────────────────── */

describe('the opening budget', () => {
  /**
   * THE REHEARSAL OPENS ON `START`, AND THE REAL PLANET ON `PLANET_START`. D58.
   *
   * Deliberately different, and this is the assertion that keeps the difference
   * exactly one thing: the cushion. `START` is the arithmetic the beats teach —
   * three mandatory upgrades that spend the crystal to the last unit and exactly
   * two Darts with the rest — and a rehearsal handed the cushion as well would
   * make a beat's sentence false and turn a lesson in scarcity into a shopping
   * trip. What the commander finds after claiming is `OPENING_BONUS`, untouched.
   */
  it('opens on the arithmetic it teaches, not on the welcome that follows it', () => {
    const w = openWorld(previewOf());
    expect(w.alloy).toBe(START.alloy);
    expect(w.crystal).toBe(START.crystal);
    expect(w.buildings).toEqual(START_BUILDINGS);
    expect(w.queues).toEqual({ CONSTRUCTION: [], YARD: [] });
    expect(w.intents).toEqual([]);

    // And the difference between the two is the cushion, whole.
    expect(PLANET_START.alloy - START.alloy).toBe(OPENING_BONUS.alloy);
    expect(PLANET_START.crystal - START.crystal).toBe(OPENING_BONUS.crystal);
  });

  /**
   * The Core and the Refinery both start at 1, so `1 >= 1` refuses the very first
   * upgrade a commander reaches for. The order is forced by the rules, and the
   * rehearsal teaches it rather than working around it.
   */
  it('refuses the Refinery until the Core has moved', () => {
    const w = openWorld(previewOf());
    expect(refusesUpgrade(w, 'REFINERY')).toBe('CORE_CEILING');
    expect(refusesUpgrade(w, 'EXTRACTOR')).toBe('CORE_CEILING');
    expect(refusesUpgrade(w, 'CORE')).toBeNull();

    const raised = upgrade(w, 'CORE');
    expect(refusesUpgrade(raised, 'REFINERY')).toBeNull();
  });

  it('spends every last unit of the grant on three upgrades and two Darts', () => {
    const three = opened();
    expect(three.crystal).toBe(0);
    expect(three.alloy).toBe(HULLS.DART.alloy * 2);

    const armed = build(three, 'DART', 2);
    expect(armed.alloy).toBe(0);
    expect(armed.crystal).toBe(0);
    expect(armed.queues.YARD).toMatchObject([
      { kind: 'HULL', subject: 'DART', count: 2, staged: true },
    ]);
  });

  /**
   * THE SENTENCE THE BEAT SAYS OUT LOUD — "your crystal is gone, exactly, and that
   * is not a coincidence" — and the reason the first flight is a raid rather than
   * a probe. If a balance change ever makes a probe affordable INSIDE THE
   * REHEARSAL, the beat is lying and this is where it is caught. The cushion (D58)
   * does not reach here: it is added to the real planet, not to this one.
   */
  it('leaves nothing for a probe after the three construction commitments', () => {
    const three = opened();
    expect(three.crystal).toBeLessThan(PROBE.crystal);
  });

  it('refuses a fourth construction order because the real queue is three deep', () => {
    const three = opened();
    expect(refusesUpgrade(three, 'CORE')).toBe('QUEUE_FULL');
  });

  it('refuses a hull the Shipyard cannot build, and one that is not affordable', () => {
    const three = opened();
    // A Viper needs Shipyard 2; a fresh planet has none at all.
    expect(refusesBuild(three, 'VIPER', 1)).toBe('SHIPYARD_TOO_LOW');
    // Two Darts is exactly the budget; three is not.
    expect(refusesBuild(three, 'DART', 2)).toBeNull();
    expect(refusesBuild(three, 'DART', 3)).toBe('INSUFFICIENT_RESOURCES');
  });

  it('refuses staged ships that would exceed the same opening Hangar', () => {
    const world = {
      ...opened(),
      alloy: 100_000_000,
      crystal: 100_000_000,
    };
    expect(refusesBuild(world, 'DART', hangarCapacity(0) + 1)).toBe('HANGAR_FULL');
  });

  it('records what was pressed, in order, and nothing else', () => {
    const armed = build(opened(), 'DART', 2);
    expect(armed.intents).toEqual([
      { kind: 'upgrade', building: 'CORE' },
      { kind: 'upgrade', building: 'REFINERY' },
      { kind: 'upgrade', building: 'EXTRACTOR' },
      { kind: 'build', hull: 'DART', count: 2 },
    ]);
  });

  it('changes nothing at all when a press is refused', () => {
    const w = openWorld(previewOf());
    expect(upgrade(w, 'REFINERY')).toBe(w);
    expect(build(w, 'PIKE', 1)).toBe(w);
    expect(w.intents).toEqual([]);
  });
});

/* ── staging, without inventing an outcome ──────────────────── */

describe('the staged queues', () => {
  it('projects the Core gate while durable levels remain unchanged', () => {
    const initial = openWorld(previewOf());
    const core = upgrade(initial, 'CORE');

    expect(core.buildings).toEqual(START_BUILDINGS);
    expect(refusesUpgrade(core, 'REFINERY')).toBeNull();
    expect(core.queues.CONSTRUCTION[0]).toMatchObject({
      kind: 'BUILDING', subject: 'CORE', slot: 0, staged: true,
    });
  });

  it('stages exactly three Construction orders and one two-Dart Yard order', () => {
    const staged = build(opened(), 'DART', 2);
    expect(staged.queues.CONSTRUCTION.map((order) => order.subject))
      .toEqual(['CORE', 'REFINERY', 'EXTRACTOR']);
    expect(staged.queues.YARD).toMatchObject([
      { kind: 'HULL', subject: 'DART', count: 2, slot: 0, staged: true },
    ]);
    expect(staged.queues.CONSTRUCTION.every((order) => order.finishesAt === undefined)).toBe(true);
    expect(staged.queues.YARD.every((order) => order.finishesAt === undefined)).toBe(true);
  });
});

/* ── the payload the real screens read ──────────────────────── */

describe('the planet it renders', () => {
  /**
   * The strongest assertion in this file: the rehearsal hands its planet to the
   * very same `PlanetScreen` the game uses, so it has to satisfy the very same
   * parser. A rehearsal that drifts from the contract fails here rather than as a
   * blank screen in front of a stranger.
   */
  it('parses as a real planet payload', () => {
    expect(() => planetSchema.parse(planetOf(openWorld(previewOf())))).not.toThrow();
    expect(() => planetSchema.parse(planetOf(build(opened(), 'DART', 2)))).not.toThrow();
  });

  it('prices the next upgrade the way the server does', () => {
    const view = planetOf(openWorld(previewOf()));
    expect(view.nextCosts.CORE).toEqual(upgradeCost(START_BUILDINGS.CORE));
    expect(view.planet.vaultFloor).toBeGreaterThanOrEqual(0);
  });

  it('shows the works empty, because nothing accrues in a rehearsal', () => {
    const view = planetOf(opened());
    expect(view.planet.bufferAlloy).toBe(0);
    expect(view.planet.bufferCrystal).toBe(0);
    expect(view.planet.bufferAlloyCap).toBeGreaterThan(0);
  });

  it('shows staged work without granting a level, a hull or a fake flight', () => {
    const before = planetOf(openWorld(previewOf()));
    const view = planetOf(build(opened(), 'DART', 2));
    expect(view.buildings).toEqual(START_BUILDINGS);
    expect(view.fleet.DART ?? 0).toBe(0);
    expect(view.fleetAway.DART ?? 0).toBe(0);
    expect(view.flight.used).toBe(0);
    expect(view.flight.total).toBeGreaterThan(0);
    expect(view.queues?.CONSTRUCTION).toHaveLength(3);
    expect(view.queues?.YARD).toHaveLength(1);
    // Committed resources remain Wealth, just as they do on the server.
    expect(view.score.wealth).toBe(before.score.wealth);
  });
});

/* ── the seam ───────────────────────────────────────────────── */

describe('the rehearsal fetch', () => {
  const harness = (planets: Preview['galaxy']['planets'] = [neighbour('target', 200)]) => {
    const preview = previewOf(planets);
    let current = openWorld(preview);
    const real = vi.fn();
    const api = new Api({
      fetch: rehearsalFetch(
        () => ({ preview, world: current }),
        (next) => {
          current = next;
        },
      ),
    });
    return { api, real, preview, now: () => current };
  };

  it('answers every read the game makes, in the production shapes', async () => {
    const { api } = harness();

    seasonSchema.parse(await api.season());
    galaxySchema.parse(await api.galaxy());
    trafficSchema.parse(await api.traffic());
    planetSchema.parse(await api.planet());
    pendingSchema.parse(await api.pending());
    miningSchema.parse(await api.mining());
    intelSchema.parse(await api.intel());
  });

  /**
   * A ROCK HAS A LIFETIME, AND THE GENERATED FIELD SPANS THE WHOLE SEASON.
   *
   * The first draft handed the disc every rock the seed produces, and the picture
   * is what caught it: nine hundred asteroids over a galaxy that has a few dozen,
   * burying the very worlds the beats ask the player to find. This is the same
   * filter `visibleAsteroids` runs on the server.
   */
  it('carries only the rocks that exist right now, not the whole season', async () => {
    const { api, preview } = harness();
    const mining = await api.mining();
    const whole = generateGalaxy(preview.season.seed, preview.season.playerCap).asteroids;

    expect(mining.asteroids.length).toBeLessThan(whole.length);
    expect(mining.derrick).toBe(false);

    const minutes = (Date.now() - preview.season.startsAt.getTime()) / 60_000;
    for (const rock of mining.asteroids) {
      expect(rock.appearsAt).toBeLessThanOrEqual(minutes);
      expect(rock.expiresAt).toBeGreaterThan(minutes);
      const position = asteroidPosition(
        { ...rock, index: 0, deuteriumShare: rock.deuteriumShare ?? 0 },
        minutes,
      );
      expect(Math.hypot(
        position.x - preview.reserved.position.x,
        position.y - preview.reserved.position.y,
        position.z - preview.reserved.position.z,
      )).toBeLessThanOrEqual(SENSOR.baseRadius);
    }
  });

  it('applies an upgrade and answers with the whole planet', async () => {
    const { api, now } = harness();

    const result = upgradeSchema.parse(await api.upgrade('CORE'));
    expect(result.level).toBe(2);
    expect(result.planet.buildings.CORE).toBe(1);
    expect(result.planet.queues?.CONSTRUCTION).toHaveLength(1);
    expect(now().buildings.CORE).toBe(1);
    expect(now().intents).toEqual([{ kind: 'upgrade', building: 'CORE' }]);
  });

  /** A refusal arrives as the server's own code, so one error map serves both. */
  it('refuses in the server’s vocabulary rather than inventing a message', async () => {
    const { api } = harness();
    await expect(api.upgrade('REFINERY')).rejects.toMatchObject({
      code: 'CORE_CEILING',
    });
  });

  it('returns the four staged orders in production shapes, with no invented pending flight', async () => {
    const { api, now } = harness();
    await api.upgrade('CORE');
    await api.upgrade('REFINERY');
    await api.upgrade('EXTRACTOR');
    const built = buildSchema.parse(await api.build('DART', 2));

    expect(built.planet.queues?.CONSTRUCTION).toHaveLength(3);
    expect(built.planet.queues?.YARD).toHaveLength(1);
    expect(now().intents).toHaveLength(4);
    expect((await api.pending()).pending).toEqual([]);
    expect(built.planet.fleet.DART ?? 0).toBe(0);
  });

  /**
   * NOTHING MAY REACH THE NETWORK. A route nobody remembered to answer has to be a
   * refusal here, not a silent unauthenticated request to a live server.
   */
  it('refuses a route it does not model, rather than falling through', async () => {
    const { api } = harness();
    await expect(api.probe('target')).rejects.toMatchObject({ code: 'REHEARSAL_ONLY' });
    await expect(api.collect()).rejects.toMatchObject({ code: 'REHEARSAL_ONLY' });
    await expect(api.mine('mJt7YvxMZEC5S7yYQ32SYw', 1)).rejects.toMatchObject({
      code: 'REHEARSAL_ONLY',
    });
    await expect(api.launch('target', { DART: 2 })).rejects.toMatchObject({
      code: 'REHEARSAL_ONLY',
    });
    await expect(api.installSatellite('FOUNDRY')).rejects.toMatchObject({
      code: 'REHEARSAL_ONLY',
    });
  });

  /**
   * THE CLAIM IS NOT THE REHEARSAL'S TO MAKE, and this is the assertion that keeps
   * it that way.
   *
   * It shipped wired to this client once. The rehearsal's `fetch` never leaves the
   * device, so the one call that has to reach the server answered `REHEARSAL_ONLY`
   * — and had it gone through, the access token would have landed on a client the
   * game discards a frame later, leaving the first screen of a player's first
   * session to 401 and refresh its way in. It goes through the session's own `Api`.
   */
  it('refuses the claim, because that call belongs to the real client', async () => {
    const { api } = harness();
    await expect(api.claim('kaptan', 'correct-horse-battery', [])).rejects.toMatchObject({
      code: 'REHEARSAL_ONLY',
    });
  });

  it('never calls the real fetch', async () => {
    const real = vi.spyOn(globalThis, 'fetch');
    const { api } = harness();
    await api.planet();
    await api.upgrade('CORE');
    expect(real).not.toHaveBeenCalled();
  });
});
