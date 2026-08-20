import { describe, expect, it, vi } from 'vitest';
import {
  HULLS,
  PROBE,
  START,
  START_BUILDINGS,
  generateGalaxy,
  upgradeCost,
} from '@astera/rules';
import { Api, ApiError } from '../src/api/client.js';
import {
  galaxySchema,
  intelSchema,
  launchSchema,
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
  launch,
  openWorld,
  planetOf,
  reachableTargets,
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
  it('starts on exactly the grant and exactly the starting buildings', () => {
    const w = openWorld(previewOf());
    expect(w.alloy).toBe(START.alloy);
    expect(w.crystal).toBe(START.crystal);
    expect(w.buildings).toEqual(START_BUILDINGS);
    expect(w.intents).toEqual([]);
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

  it('spends every last unit of the grant on three upgrades and two Wasps', () => {
    const three = opened();
    expect(three.crystal).toBe(0);
    expect(three.alloy).toBe(HULLS.WASP.alloy * 2);

    const armed = build(three, 'WASP', 2);
    expect(armed.alloy).toBe(0);
    expect(armed.crystal).toBe(0);
    expect(armed.fleet.WASP).toBe(2);
  });

  /**
   * THE SENTENCE THE BEAT SAYS OUT LOUD — "your crystal is gone, exactly, and that
   * is not a coincidence" — and the reason the first flight is a raid rather than
   * a probe. If a balance change ever makes a probe affordable at this point, the
   * beat is lying and this is where it is caught.
   */
  it('leaves nothing for a probe, which is why the fleet is the first flight', () => {
    const three = opened();
    expect(three.crystal).toBeLessThan(PROBE.crystal);
  });

  it('refuses a fourth upgrade on price rather than pretending', () => {
    const three = opened();
    expect(refusesUpgrade(three, 'CORE')).toBe('INSUFFICIENT_RESOURCES');
  });

  it('refuses a hull the Shipyard cannot build, and one that is not affordable', () => {
    const three = opened();
    // A Lance needs Shipyard 2; a fresh planet has none at all.
    expect(refusesBuild(three, 'LANCE', 1)).toBe('SHIPYARD_TOO_LOW');
    // Two Wasps is exactly the budget; three is not.
    expect(refusesBuild(three, 'WASP', 2)).toBeNull();
    expect(refusesBuild(three, 'WASP', 3)).toBe('INSUFFICIENT_RESOURCES');
  });

  it('records what was pressed, in order, and nothing else', () => {
    const armed = build(opened(), 'WASP', 2);
    expect(armed.intents).toEqual([
      { kind: 'upgrade', building: 'CORE' },
      { kind: 'upgrade', building: 'REFINERY' },
      { kind: 'upgrade', building: 'EXTRACTOR' },
      { kind: 'build', hull: 'WASP', count: 2 },
    ]);
  });

  it('changes nothing at all when a press is refused', () => {
    const w = openWorld(previewOf());
    expect(upgrade(w, 'REFINERY')).toBe(w);
    expect(build(w, 'LANCE', 1)).toBe(w);
    expect(w.intents).toEqual([]);
  });
});

/* ── the bet ────────────────────────────────────────────────── */

describe('committing the fleet', () => {
  const armed = () => build(opened(), 'WASP', 2);

  it('moves the hulls off the planet and remembers the intent', () => {
    const sent = launch(armed(), 'target', { WASP: 2 });
    expect(sent.fleet.WASP).toBe(0);
    expect(sent.away.WASP).toBe(2);
    expect(sent.launch).toEqual({ targetPlanetId: 'target', fleet: { WASP: 2 } });
    expect(sent.intents.at(-1)).toEqual({
      kind: 'launch',
      targetPlanetId: 'target',
      fleet: { WASP: 2 },
    });
  });

  /**
   * Principle 3: a launched fleet cannot be recalled. Letting the rehearsal take
   * it back would teach the opposite of the one rule the risk layer rests on.
   */
  it('refuses a second launch, because the first cannot be taken back', () => {
    const sent = launch(armed(), 'target', { WASP: 2 });
    expect(launch(sent, 'other', { WASP: 1 })).toBe(sent);
  });

  it('refuses an empty fleet and one that is bigger than what is home', () => {
    const w = armed();
    expect(launch(w, 'target', {})).toBe(w);
    expect(launch(w, 'target', { WASP: 0 })).toBe(w);
    expect(launch(w, 'target', { WASP: 3 })).toBe(w);
    expect(launch(w, 'target', { LANCE: 1 })).toBe(w);
  });

  it('leaves a partial fleet at home when only some of it is sent', () => {
    const sent = launch(armed(), 'target', { WASP: 1 });
    expect(sent.fleet.WASP).toBe(1);
    expect(sent.away.WASP).toBe(1);
  });
});

/* ── who may be hit ─────────────────────────────────────────── */

describe('the targets the disc lights up', () => {
  it('offers everyone inside the tier band, nearest first', () => {
    const w = openWorld(previewOf());
    const targets = reachableTargets(w, [
      ...previewOf().galaxy.planets,
      neighbour('far', 800),
      neighbour('near', 200),
    ]);
    expect(targets.map((t) => t.id)).toEqual(['near', 'far']);
  });

  /**
   * A fresh planet is tier 1, so tier 4 and up is out of reach — which is exactly
   * what stops a newcomer being handed a target the claim would refuse.
   */
  it('leaves out anything beyond ±2 tiers', () => {
    const w = openWorld(previewOf());
    const targets = reachableTargets(w, [
      neighbour('inband', 100, 3),
      neighbour('outofband', 120, 4),
    ]);
    expect(targets.map((t) => t.id)).toEqual(['inband']);
  });

  it('never offers the visitor their own world, or an empty slot', () => {
    const w = openWorld(previewOf());
    const targets = reachableTargets(w, [
      ...previewOf().galaxy.planets,
      { ...neighbour('unowned', 100), owner: '' },
    ]);
    expect(targets).toHaveLength(0);
  });

  /** Raising the Core moves the band with it, both ways. */
  it('follows the band as the Core rises', () => {
    let w = openWorld(previewOf());
    expect(reachableTargets(w, [neighbour('big', 100, 4)])).toHaveLength(0);
    // Core 4 is tier 2, which reaches tier 4.
    w = { ...w, buildings: { ...w.buildings, CORE: 4 } };
    expect(reachableTargets(w, [neighbour('big', 100, 4)])).toHaveLength(1);
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
    expect(() => planetSchema.parse(planetOf(build(opened(), 'WASP', 2)))).not.toThrow();
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

  it('counts a committed fleet as away and as a bay in use', () => {
    const sent = launch(build(opened(), 'WASP', 2), 'target', { WASP: 2 });
    const view = planetOf(sent);
    expect(view.fleetAway.WASP).toBe(2);
    expect(view.flight.used).toBe(1);
    expect(view.flight.total).toBeGreaterThan(0);
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

    expect(mining.asteroids.length).toBeGreaterThan(0);
    expect(mining.asteroids.length).toBeLessThan(whole.length);
    expect(mining.derrick).toBe(false);

    const minutes = (Date.now() - preview.season.startsAt.getTime()) / 60_000;
    for (const rock of mining.asteroids) {
      expect(rock.appearsAt).toBeLessThanOrEqual(minutes);
      expect(rock.expiresAt).toBeGreaterThan(minutes);
    }
  });

  it('applies an upgrade and answers with the whole planet', async () => {
    const { api, now } = harness();

    const result = upgradeSchema.parse(await api.upgrade('CORE'));
    expect(result.level).toBe(2);
    expect(result.planet.buildings.CORE).toBe(2);
    expect(now().buildings.CORE).toBe(2);
    expect(now().intents).toEqual([{ kind: 'upgrade', building: 'CORE' }]);
  });

  /** A refusal arrives as the server's own code, so one error map serves both. */
  it('refuses in the server’s vocabulary rather than inventing a message', async () => {
    const { api } = harness();
    await expect(api.upgrade('REFINERY')).rejects.toMatchObject({
      code: 'CORE_CEILING',
    });
  });

  it('launches, and answers with a pending thread the disc can draw', async () => {
    const { api } = harness();
    await api.upgrade('CORE');
    await api.upgrade('REFINERY');
    await api.upgrade('EXTRACTOR');
    await api.build('WASP', 2);

    const result = launchSchema.parse(await api.launch('target', { WASP: 2 }));
    expect(result.pending).toHaveLength(1);
    const [thread] = result.pending;
    expect(thread?.targetName).toBe('World-target');
    // The path is what the disc interpolates the leg from; both ends are public.
    expect(thread?.path?.from).toEqual({ x: 0, y: 0, z: 0 });
    expect(thread?.path?.to).toEqual({ x: 200, y: 0, z: 0 });
    expect(thread?.arriveAt.getTime()).toBeGreaterThan(thread?.path?.departAt.getTime() ?? 0);
  });

  /**
   * A LEG THAT RE-READS ITS OWN DEPARTURE PARKS ON THE PAD.
   *
   * Every leg is drawn by interpolating between `departAt` and `arriveAt` against
   * `serverNow()`. If the departure were recomputed as "now" on each read, the
   * fraction would stay at zero for the whole flight and the squadron would sit on
   * its own world — which is precisely the failure D50 and D52 were about.
   */
  it('freezes the departure instant, so the craft actually moves', async () => {
    const { api } = harness();
    await api.upgrade('CORE');
    await api.upgrade('REFINERY');
    await api.upgrade('EXTRACTOR');
    await api.build('WASP', 2);
    await api.launch('target', { WASP: 2 });

    const first = (await api.pending()).pending[0]?.path?.departAt.getTime();
    await new Promise((r) => setTimeout(r, 12));
    const second = (await api.pending()).pending[0]?.path?.departAt.getTime();

    expect(first).toBe(second);
  });

  it('refuses a second launch: there is no recall, and there is one bay', async () => {
    const { api } = harness();
    await api.upgrade('CORE');
    await api.upgrade('REFINERY');
    await api.upgrade('EXTRACTOR');
    await api.build('WASP', 2);
    await api.launch('target', { WASP: 1 });

    await expect(api.launch('target', { WASP: 1 })).rejects.toBeInstanceOf(ApiError);
  });

  /**
   * NOTHING MAY REACH THE NETWORK. A route nobody remembered to answer has to be a
   * refusal here, not a silent unauthenticated request to a live server.
   */
  it('refuses a route it does not model, rather than falling through', async () => {
    const { api } = harness();
    await expect(api.probe('target')).rejects.toMatchObject({ code: 'REHEARSAL_ONLY' });
    await expect(api.collect()).rejects.toMatchObject({ code: 'REHEARSAL_ONLY' });
    await expect(api.mine(1, 1)).rejects.toMatchObject({ code: 'REHEARSAL_ONLY' });
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
