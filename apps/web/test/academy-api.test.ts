import { describe, expect, it, vi } from 'vitest';
import { ACADEMY_STEPS, academyLessonFleet, academyPirateHomecoming, engagementEndsAt, SENSOR } from '@astera/rules';
import { ACADEMY_SIGHT_IDS, ACADEMY_TARGET_ID } from '../src/onboarding/academyViews.js';
import { planetArt } from '../src/ui/assets.js';
import { Api } from '../src/api/client.js';
import { academyFetch } from '../src/onboarding/academyFetch.js';
import { openAcademy, beginAcademyFlight, advanceAcademy } from '../src/onboarding/academyWorld.js';

function fixture(action: string) {
  let now = 1_800_000_000_000;
  let world = openAcademy(now, ACADEMY_STEPS.findIndex((step) => step.id === action));
  const fetch = academyFetch(() => world, (next) => { world = next; }, () => now);
  return { api: new Api({ fetch }), fetch, read: () => world, tick: () => { now += 60_000; } };
}

describe('Academy uses the production API locally', () => {
  it('shows the world-raid signal, not the earlier pirate signal, in the final report lesson', async () => {
    const now = 1_800_000_000_000;
    const pirate = advanceAcademy(beginAcademyFlight(openAcademy(now, ACADEMY_STEPS.findIndex((s) => s.id === 'pirate')), 'pirate', now), now + 60_000);
    const raid = advanceAcademy(beginAcademyFlight(openAcademy(now, ACADEMY_STEPS.findIndex((s) => s.id === 'raid')), 'raid', now + 60_000), now + 120_000);
    const world = { ...raid, reports: [...pirate.reports, ...raid.reports] };
    const api = new Api({ fetch: academyFetch(() => world, vi.fn(), () => now + 120_000) });
    const notifications = (await api.notifications()).notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.refId).toBe('academy-raid');
    expect((await api.reports()).reports).toHaveLength(2);
  });
  it('publishes the home sensor radius that the Telescope switch actually draws', async () => {
    const f = fixture('telescope');
    const galaxy = await f.api.galaxy();
    expect(galaxy.sensors).toHaveLength(1);
    expect(galaxy.sensors?.[0]?.identify).toBeGreaterThan(0);
    expect(galaxy.sensors?.[0]?.detect).toBe(0);
  });
  it('marks only the requested battle signals seen, without touching a live account', async () => {
    const f = fixture('pirate');
    await f.api.raidPirate('academy-pirate', academyLessonFleet('pirate'));
    f.tick();
    const notification = (await f.api.notifications()).notifications[0]!;
    expect(notification.seen).toBe(false);
    expect(notification.payload).toMatchObject({ shipsHome: 2 });
    expect(await f.api.markSeen(['unknown'])).toEqual({ marked: 0 });
    expect(await f.api.markSeen([notification.id])).toEqual({ marked: 1 });
    expect((await f.api.notifications()).notifications[0]?.seen).toBe(true);
    expect(await f.api.markSeen([notification.id])).toEqual({ marked: 0 });
  });
  it('launches the authored pirate raid and exposes the battle report on return', async () => {
    const f = fixture('pirate');
    const pirates = await f.api.pirates();
    expect(pirates.pirates).toHaveLength(1);
    expect((await f.api.traffic()).contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: pirates.pirates[0]!.id, kind: 'pirate', fleet: { WARDEN: 1 } }),
    ]));
    const launched = await f.api.raidPirate(pirates.pirates[0]!.id, academyLessonFleet('pirate'));
    expect(launched.pending).toHaveLength(1);
    expect(launched.planet.fleet.DART ?? 0).toBe(0);
    f.tick();
    const reports = await f.api.reports();
    expect(reports.reports).toHaveLength(1);
    expect(reports.reports[0]).toMatchObject({ grade: 'DECISIVE', yourLosses: { DART: 1 } });
  });
  it('launches a miner and then the cargo-supported raid through ordinary routes', async () => {
    const f = fixture('mine');
    const field = await f.api.mining();
    expect(field.asteroids).toHaveLength(1);
    const res = await f.fetch('/api/mining/launch', { method: 'POST', body: JSON.stringify({ asteroidId: field.asteroids[0]!.id, craft: 1 }) });
    expect(res.status).toBe(200);
    f.tick();
    expect((await f.api.planet()).planet.bufferAlloy).toBeGreaterThan(0);
    const raid = fixture('raid');
    const target = (await raid.api.galaxy()).planets.find((planet) => !planet.isSelf)!;
    expect(target).toBeDefined();
    // The lesson's own statement of what it sends, so this test cannot drift
    // from the picker again — it once hard-coded two Darts while three stood.
    await raid.api.launch(target.id, academyLessonFleet('raid'));
    raid.tick();
    expect((await raid.api.reports()).reports[0]).toMatchObject({ grade: 'DECISIVE' });
  });
  it('sends only the completed step at the real claim boundary', async () => {
    const bodies: unknown[] = [];
    const fetch: typeof globalThis.fetch = (_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body');
      bodies.push(JSON.parse(init.body));
      return Promise.resolve(new Response(JSON.stringify({ error: 'NO_FRONTIER', message: 'NO_FRONTIER' }), { status: 409 }));
    };
    const api = new Api({ fetch });
    await expect(api.claim('Pilot', 'a-long-password', 40)).rejects.toMatchObject({ code: 'NO_FRONTIER' });
    expect(bodies).toEqual([{ username: 'Pilot', password: 'a-long-password', step: 40 }]);
  });
  it('pays an upgrade once, publishes its clock, then exposes its reward', async () => {
    const f = fixture('core');
    const before = await f.api.planet();
    const result = await f.api.upgrade('CORE');
    expect(result.planet.buildings.CORE).toBe(1);
    expect(result.planet.planet.alloy).toBeLessThan(before.planet.alloy);
    expect(result.planet.queues?.CONSTRUCTION).toHaveLength(1);
    await expect(f.api.upgrade('CORE')).rejects.toMatchObject({ code: 'ACADEMY_ACTION_REFUSED' });
    f.tick();
    expect((await f.api.planet()).buildings.CORE).toBe(2);
    const reward = (await f.api.rewards()).chains.flatMap((chain) => chain.tiers).find((tier) => tier.id === 'CORE:2');
    expect(reward?.state).toBe('claimable');
    const claimed = await f.api.claimReward('CORE:2');
    expect(claimed.granted.alloy).toBeGreaterThan(0);
    expect(f.read().step).toBe(4);
    await expect(f.api.claimReward('CORE:2')).rejects.toMatchObject({ code: 'ACADEMY_ACTION_REFUSED' });
  });
  it('handles world-specific build and instrument routes with the same clocks', async () => {
    const f = fixture('darts');
    const built = await f.api.build(f.read().preview.reserved.id, 'DART', 2);
    expect(built.planet.queues?.YARD).toHaveLength(1);
    f.tick();
    expect((await f.api.planet()).fleet.DART).toBe(2);
    const a = fixture('aegis');
    await a.api.raiseInstrument(a.read().preview.reserved.id, 'AEGIS');
    a.tick();
    expect((await a.api.planet()).instruments.AEGIS).toBe(1);
  });
  it('rejects a different planet, hull count, malformed body and unsupported route without network access', async () => {
    const network = vi.spyOn(globalThis, 'fetch');
    try {
      const f = fixture('darts');
      await expect(f.api.build('another-world', 'DART', 2)).rejects.toMatchObject({ code: 'ACADEMY_ACTION_REFUSED' });
      await expect(f.api.build('DART', 200)).rejects.toMatchObject({ code: 'ACADEMY_ACTION_REFUSED' });
      expect((await f.fetch('/api/planet/build', { method: 'POST', body: '{' })).status).toBe(400);
      expect((await f.fetch('/api/auth/logout', { method: 'POST' })).status).toBe(404);
      expect(f.read().pending).toBeNull();
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it('parses the read-only surfaces used by the real game', async () => {
    const { api } = fixture('welcome');
    await Promise.all([api.planet(), api.season(), api.galaxy(), api.reports(), api.rewards(), api.intel(), api.mining()]);
  });
});

/**
 * WHAT THE SIGHT LESSON IS ACTUALLY FOR. Owner instruction.
 *
 * The Telescope beat draws the sphere and says "this is your sight range", which
 * is a fact about a radius and not yet a reason to care. A second after the sphere
 * opens, one world appears inside it — off to the left, unreachable, uninvolved —
 * and the lesson becomes the sentence it was trying to be: *this is what your
 * sight is for; inside here, you can see who is there.*
 *
 * IT IS SCENERY, NOT A TARGET. It cannot be tapped (the gate withholds the canvas
 * for the whole of this beat) and it is gone by the next lesson, so nothing later
 * in the tutorial can point at a world that was only ever a demonstration.
 */
describe('the worlds the sight lesson shows', () => {
  const shown = async (world: ReturnType<typeof openAcademy>) => {
    const api = new Api({ fetch: academyFetch(() => world, vi.fn(), () => 1_800_000_000_000) });
    const planets = (await api.galaxy()).planets;
    return ACADEMY_SIGHT_IDS.map((id) => planets.find((p) => p.id === id));
  };

  it('stays away until the sphere has actually opened', async () => {
    const f = fixture('telescope');
    expect((await shown(f.read())).filter(Boolean)).toHaveLength(0);
  });

  it('shows THREE worlds, not one: a sphere with a neighbourhood in it', async () => {
    /*
      Owner instruction. One world inside the sphere reads as a coincidence; three
      read as "this is the part of the galaxy you can see", which is the sentence
      the beat exists to say.
    */
    const f = fixture('telescope');
    const world = { ...f.read(), sightDemo: true };
    const found = await shown(world);
    expect(found.filter(Boolean)).toHaveLength(3);

    const home = world.preview.reserved.position;
    for (const w of found) {
      expect(w, 'a sight world is missing').toBeDefined();
      const away = Math.hypot(
        w!.position.x - home.x, w!.position.y - home.y, w!.position.z - home.z,
      );
      // Inside what the sphere draws, or the beat demonstrates the opposite point.
      expect(away).toBeLessThan(SENSOR.baseRadius);
      // Far enough to read as somewhere else rather than as our own orbit.
      expect(away).toBeGreaterThan(200);
      // The raid target sits at +x; these go the other way, so the two beats do
      // not teach the same corner of the disc.
      expect(w!.position.x).toBeLessThan(home.x);
      expect(w!.isSelf).toBe(false);
      // BIGGER THAN THE ENTRY SIZE. A world's drawn size is a ramp over its exact
      // Core level (D166), so this is the only dial that makes them read at range.
      expect(w!.coreLevel).toBeGreaterThan(4);
    }

    // Three distinct places, not three copies stacked on one point.
    const spots = new Set(found.map((w) => `${w!.position.x}:${w!.position.z}`));
    expect(spots.size).toBe(3);
  });

  it('wears neither the commander’s own render nor the raid target’s', () => {
    const f = fixture('telescope');
    const world = { ...f.read(), sightDemo: true };
    const taken = [planetArt(world.preview.reserved.id), planetArt(ACADEMY_TARGET_ID)];
    const arts = ACADEMY_SIGHT_IDS.map(planetArt);
    for (const art of arts) expect(taken).not.toContain(art);
    expect(new Set(arts).size, 'two sight worlds share a render').toBe(3);
  });

  it('is gone by the next lesson, even if the flag was left set', async () => {
    const f = fixture('radar');
    expect((await shown({ ...f.read(), sightDemo: true })).filter(Boolean)).toHaveLength(0);
  });
});

describe('the world the raid lesson attacks', () => {
  it('wears planet_11, which the owner picked', () => {
    expect(planetArt(ACADEMY_TARGET_ID)).toBe('/assets/images/planets/planet_11.png');
  });
});

/**
 * WHAT A FIGHT AND A DIG LEAVE BEHIND: NOTHING. Owner instruction.
 *
 * Both lessons published their target for the whole beat, which is one moment too
 * long. The pirate is destroyed the instant the fleet reaches it — the Academy's
 * own battle kills its entire crew — and the rock is empty the instant the
 * Prospector arrives. But both kept being drawn until the craft got HOME, so a
 * commander watched their surviving Dart fly back past a pirate it had just wiped
 * out, and their miner leave a rock that still looked like a rock.
 *
 * The cut is at `arriveAt`, not at the end of the lesson. Nothing else moves: the
 * return leg is drawn from `intercept` and `home` and never asks for either of
 * them (`runPosition`, and `academyPending`'s own path), so removing the target
 * takes nothing with it.
 */
describe('what the mission lessons leave on the disc', () => {
  const inFlight = (kind: 'pirate' | 'mine') => {
    const now = 1_800_000_000_000;
    const world = beginAcademyFlight(
      openAcademy(now, ACADEMY_STEPS.findIndex((s) => s.id === kind)), kind, now,
    );
    return {
      world,
      at: (time: number) => new Api({ fetch: academyFetch(() => world, vi.fn(), () => time) }),
    };
  };

  /**
   * THE PIRATE OUTLIVES ITS OWN ARRIVAL BY THE LENGTH OF THE FIGHT.
   *
   * Cutting it at `arriveAt` was wrong and wrong in a way that showed: the ten
   * second engagement STARTS there. The battle animation — including the rounds
   * the pirate fires back — needs something to be fired at and something to be
   * fired from, so removing it on arrival deleted the fight while the fight was
   * being drawn. It goes when the shooting stops.
   */
  it('keeps the pirate through its own battle, then takes it off the disc', async () => {
    const { world, at } = inFlight('pirate');
    const arriveAt = world.flight!.arriveAt;
    const over = engagementEndsAt(arriveAt);
    expect(over).toBeLessThanOrEqual(world.flight!.homeAt);

    // Before it lands.
    expect((await at(arriveAt - 1).traffic()).contacts).toHaveLength(1);
    // Mid-battle: still there, still being shot at.
    expect((await at(arriveAt + 1).traffic()).contacts, 'the pirate vanished mid-fight').toHaveLength(1);
    expect((await at(over - 1).traffic()).contacts).toHaveLength(1);
    // The shooting stops and so does the pirate.
    expect((await at(over).traffic()).contacts, 'the wreck is still flying its orbit').toHaveLength(0);
    expect((await at(over).pirates()).pirates).toHaveLength(0);
  });

  /**
   * A ROCK HAS NO FIGHT TO SIT THROUGH, so its cut really is arrival: the run goes
   * straight to `returning` the moment the Prospector gets there.
   */
  it('takes the rock away the moment it is emptied', async () => {
    const { world, at } = inFlight('mine');
    const arriveAt = world.flight!.arriveAt;

    expect((await at(arriveAt - 1).mining()).asteroids).toHaveLength(1);

    const field = await at(arriveAt + 1).mining();
    expect(field.asteroids, 'an emptied rock is still drawn').toHaveLength(0);
    // The run itself survives it: the miner still has to get home.
    expect(field.runs).toHaveLength(1);
    expect(field.runs[0]?.status).toBe('returning');
  });
});

describe('the squadron that flies home from the pirate', () => {
  /**
   * IT BRINGS THE PRIZE WITH IT. Owner instruction: *"korsan savaşında gemimiz eve
   * dönerken warden ile birlikte dönmeli. çünkü savaşta kazandık onu."*
   *
   * The return leg was drawn from `attackerSurvivors` — one Dart — so the captured
   * Warden appeared in the hangar afterwards with nothing on screen connecting it
   * to the fight it was won in. The tow is the payoff of the whole lesson and it
   * was invisible.
   */
  it('carries the captured Warden on the return leg', async () => {
    const now = 1_800_000_000_000;
    const world = beginAcademyFlight(
      openAcademy(now, ACADEMY_STEPS.findIndex((s) => s.id === 'pirate')), 'pirate', now,
    );
    const flight = world.flight!;
    const api = (t: number) => new Api({ fetch: academyFetch(() => world, vi.fn(), () => t) });

    // Outbound: what was committed, and no prize yet.
    const out = (await api(flight.departAt + 1).pending()).pending[0];
    expect(out?.leg).toBe('outbound');
    expect(out!.fleet?.WARDEN ?? 0).toBe(0);

    // Homebound: the survivors and the hull they took, exactly as the hangar gets.
    const back = (await api(flight.returnAt + 1).pending()).pending[0];
    expect(back?.leg).toBe('return');
    expect(back!.fleet).toEqual(academyPirateHomecoming());
    expect(back!.fleet?.WARDEN).toBe(1);
  });
});
