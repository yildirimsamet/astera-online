import { describe, expect, it } from 'vitest';
import {
  asteroidActive,
  distance,
  generateGalaxy,
  interceptAsteroid,
  prospectorSpeed,
  surfaceStandoff,
} from '@astera/rules';
import {
  asteroidWorldPosition,
  contactPosition,
  legStandoff,
  runPosition,
  threadPosition,
  toWorld,
  type PlanetNode,
} from '../src/galaxy/scene.js';
import type { Contact, MiningRun, PendingThread } from '../src/api/schemas.js';

/**
 * WHERE A CRAFT IS, AS ONE ANSWER RATHER THAN TWO.
 *
 * The camera now follows a focused squadron and a focused mining run the way it
 * already followed an asteroid (owner's note: tapping a fleet did not track it).
 * That only works because the rig and the renderer read the SAME function — the
 * previous arrangement had each of them interpolating separately, which is a pair
 * that stays correct exactly until one side is edited.
 *
 * These hold the properties a follow camera depends on: the position is a real
 * function of the clock, it is clamped at both ends of the leg, and the return leg
 * genuinely runs backwards along the outbound line rather than to the rock, which
 * has moved on by then.
 */

const at = (iso: string): Date => new Date(iso);
const DEPART = at('2026-04-01T12:00:00.000Z');
const ARRIVE = at('2026-04-01T12:40:00.000Z');

const path: NonNullable<PendingThread['path']> = {
  from: { x: 0, y: 0, z: 0 },
  to: { x: 400, y: 0, z: 0 },
  departAt: DEPART,
  arriveAt: ARRIVE,
};

describe('a fleet in transit', () => {
  it('is at its origin the moment it leaves', () => {
    expect(threadPosition(path, DEPART.getTime())).toEqual(toWorld(path.from));
  });

  it('is at its target the moment it lands', () => {
    expect(threadPosition(path, ARRIVE.getTime())).toEqual(toWorld(path.to));
  });

  it('is exactly halfway at the halfway point', () => {
    const half = threadPosition(path, (DEPART.getTime() + ARRIVE.getTime()) / 2);
    expect(half).toEqual(toWorld({ x: 200, y: 0, z: 0 }));
  });

  /**
   * A camera that reads past the ends of a leg would fly off the disc chasing a
   * craft that has already landed — which is what happens on a stale payload, and
   * a stale payload is normal in a game polled every few seconds.
   */
  it('never runs past either end of its own leg', () => {
    expect(threadPosition(path, DEPART.getTime() - 9_000_000)).toEqual(toWorld(path.from));
    expect(threadPosition(path, ARRIVE.getTime() + 9_000_000)).toEqual(toWorld(path.to));
  });

  it('moves monotonically toward its target', () => {
    const early = threadPosition(path, DEPART.getTime() + 60_000)[0];
    const later = threadPosition(path, DEPART.getTime() + 600_000)[0];
    expect(later).toBeGreaterThan(early);
  });
});

/**
 * THE REGRESSION THAT LOOKED LIKE SERVER LAG. D120.
 *
 * The old renderer interpolated from a world's centre and then projected every
 * frame inside its silhouette back to one surface coordinate. Different times
 * therefore produced the same position for several seconds. These assertions
 * sample the dangerous intervals themselves; a broad "early < later" assertion
 * can skip the entire plateau and stay green while the visible bug returns.
 */
describe('continuous endpoint clearance', () => {
  const node = (
    id: string,
    position: { x: number; y: number; z: number },
    radius: number,
  ): PlanetNode => ({
    id,
    name: id,
    owner: 'commander',
    position: toWorld(position),
    radius,
    weight: radius > 1 ? 3 : 1,
    coreTier: radius > 1 ? 5 : 1,
    coreLevel: radius > 1 ? 15 : 3,
    satellites: [],
    shielded: false,
    stance: 'dark',
    state: { kind: 'NORMAL' },
    kind: 'CAPITAL',
    isOwned: id === 'home',
    isClanmate: false,
    isCapital: id === 'home',
  });

  const nodes = [
    node('home', path.from, 0.44),
    node('crossed-but-unrelated', { x: 200, y: 0, z: 0 }, 1.4),
    node('target', path.to, 0.82),
  ];
  const outbound: PendingThread = {
    id: 'flight',
    kind: 'fleet',
    targetName: 'target',
    minutesRemaining: 40,
    arriveAt: ARRIVE,
    leg: 'outbound',
    fleet: { WASP: 1 },
    path,
  };

  const assertStrictProgress = (
    positionAt: (time: number) => readonly [number, number, number],
    times: readonly number[],
    axis: 0 | 1 | 2,
    direction: 1 | -1,
  ) => {
    const values = times.map((time) => positionAt(time)[axis] * direction);
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index], `position did not advance at sample ${String(index)}`)
        .toBeGreaterThan(values[index - 1]!);
    }
  };

  it('advances on every sampled second immediately after a fleet spawns', () => {
    const standoff = legStandoff(outbound, nodes);
    const times = Array.from({ length: 11 }, (_, second) => DEPART.getTime() + second * 1_000);
    assertStrictProgress((time) => threadPosition(path, time, standoff), times, 0, 1);
    expect(threadPosition(path, DEPART.getTime(), standoff)[0])
      .toBeCloseTo(surfaceStandoff(0.44), 6);
  });

  it('does not pause or jump while crossing an unrelated world marker', () => {
    const standoff = legStandoff(outbound, nodes);
    const middle = (DEPART.getTime() + ARRIVE.getTime()) / 2;
    const times = Array.from({ length: 21 }, (_, second) => middle - 10_000 + second * 1_000);
    assertStrictProgress((time) => threadPosition(path, time, standoff), times, 0, 1);
  });

  it('advances immediately on both legs of a mining or salvage run', () => {
    const home = path.from;
    const mining: MiningRun = {
      id: 'drill',
      targetKind: 'debris',
      asteroidIndex: null,
      debrisFieldId: 'wreck',
      craft: 1,
      status: 'outbound',
      departAt: DEPART,
      arriveAt: ARRIVE,
      homeAt: at('2026-04-01T13:20:00.000Z'),
      intercept: { x: 0, y: 0, z: 600 },
      minedAlloy: 0,
      minedCrystal: 0,
      minedDeuterium: 0,
    };
    const firstSeconds = Array.from(
      { length: 11 },
      (_, second) => DEPART.getTime() + second * 1_000,
    );
    assertStrictProgress(
      (time) => runPosition(mining, home, time, nodes),
      firstSeconds,
      2,
      1,
    );

    const returning = { ...mining, status: 'returning' as const };
    const returnSeconds = Array.from(
      { length: 11 },
      (_, second) => ARRIVE.getTime() + second * 1_000,
    );
    assertStrictProgress(
      (time) => runPosition(returning, home, time, nodes),
      returnSeconds,
      2,
      -1,
    );
  });

  it('keeps an adjusted public bearing moving through a marker too', () => {
    const contact: Contact = {
      id: 'bearing',
      kind: 'fleet',
      from: { x: 180, y: 0, z: 0 },
      to: { x: 220, y: 0, z: 0 },
      startAt: DEPART,
      endAt: new Date(DEPART.getTime() + 20_000),
    };
    const times = Array.from({ length: 21 }, (_, second) => DEPART.getTime() + second * 1_000);
    assertStrictProgress((time) => contactPosition(contact, time, nodes), times, 0, 1);
  });
});

describe('a mining run', () => {
  const home = { x: 0, y: 0, z: 0 };
  const run = (over: Partial<MiningRun> = {}): MiningRun => ({
    id: 'r1',
    targetKind: 'asteroid',
    asteroidIndex: 3,
    debrisFieldId: null,
    craft: 2,
    status: 'outbound',
    departAt: DEPART,
    arriveAt: ARRIVE,
    homeAt: at('2026-04-01T13:20:00.000Z'),
    intercept: { x: 0, y: 0, z: 600 },
    minedAlloy: 0,
    minedCrystal: 0,
    minedDeuterium: 0,
    ...over,
  });

  it('flies the planet to the interception point on the way out', () => {
    const r = run();
    expect(runPosition(r, home, DEPART.getTime())).toEqual(toWorld(home));
    expect(runPosition(r, home, ARRIVE.getTime())).toEqual(toWorld(r.intercept));
  });

  /**
   * THE RETURN LEG RUNS BACKWARDS ALONG THE SAME LINE, and specifically NOT to the
   * rock: by the time the craft turns for home the asteroid has carried on round
   * its orbit, so aiming at it would send the camera somewhere the craft is not.
   */
  it('flies the interception point back to the planet on the way home', () => {
    const r = run({ status: 'returning' });
    expect(runPosition(r, home, ARRIVE.getTime())).toEqual(toWorld(r.intercept));
    expect(runPosition(r, home, r.homeAt!.getTime())).toEqual(toWorld(home));
  });

  /** A run whose landing time never arrived must still resolve to a real point. */
  it('does not fall apart when the homeward time is missing', () => {
    const r = run({ status: 'returning', homeAt: null });
    const where = runPosition(r, home, ARRIVE.getTime() + 60_000);
    expect(where.every(Number.isFinite)).toBe(true);
  });
});

/**
 * THE MEETING, IN THE COORDINATES THE PLAYER ACTUALLY SEES. D43.
 *
 * `invariants.test.ts` proves the solver is exact in GAME units. That is not the
 * same claim as "the drill and the rock are drawn in the same place", and the gap
 * between them is where this could fail silently: the disc is rendered with the
 * height axis exaggerated 3.5x (`scene.ts`), so a craft and a rock that agree
 * perfectly in game coordinates would still be drawn apart if either side skipped
 * `toWorld` or applied it differently.
 *
 * So this runs the REAL solver over a REAL generated field, builds the run row the
 * server would have written from it, and compares the two things the renderer
 * puts on screen at the instant they meet. A world unit is fifty game units and a
 * drill is drawn at 0.26 across, so the tolerance here is a tenth of a craft.
 */
describe('a drill and its rock, at the instant they meet', () => {
  const SEASON_START = at('2026-01-01T00:00:00.000Z');
  const spec = generateGalaxy(4242, 60);
  /** A world well off the disc plane, so the vertical exaggeration is in play. */
  const planet = { x: 180, y: 95, z: -260 };

  const meetings = () => {
    const found: { rock: (typeof spec.asteroids)[number]; run: MiningRun }[] = [];
    for (let nowMinutes = 30; nowMinutes < 60 * 30 && found.length < 25; nowMinutes += 17) {
      for (const rock of spec.asteroids) {
        if (!asteroidActive(rock, nowMinutes)) continue;
        const hit = interceptAsteroid(planet, prospectorSpeed([]), rock, nowMinutes);
        if (!hit) continue;
        found.push({
          rock,
          run: {
            id: `r${String(rock.index)}`,
            targetKind: 'asteroid',
            asteroidIndex: rock.index,
            debrisFieldId: null,
            craft: 1,
            status: 'outbound',
            departAt: new Date(SEASON_START.getTime() + nowMinutes * 60_000),
            arriveAt: new Date(SEASON_START.getTime() + hit.meetsAtMinutes * 60_000),
            homeAt: null,
            intercept: hit.at,
            minedAlloy: 0,
            minedCrystal: 0,
            minedDeuterium: 0,
          },
        });
        break;
      }
    }
    return found;
  };

  it('draws them at the same point, over a whole field of rocks', () => {
    const all = meetings();
    expect(all.length).toBeGreaterThan(15);

    for (const { rock, run } of all) {
      const craft = runPosition(run, planet, run.arriveAt.getTime());
      const stone = asteroidWorldPosition(rock, SEASON_START, run.arriveAt.getTime());
      const gap = Math.hypot(craft[0] - stone[0], craft[1] - stone[1], craft[2] - stone[2]);
      expect(gap, `rock ${String(rock.index)} is ${gap.toFixed(4)} world units away`).toBeLessThan(
        0.026,
      );
    }
  });

  /**
   * AND IT IS A MEETING RATHER THAN A COINCIDENCE: the gap has to be CLOSING.
   *
   * A craft aimed at the wrong point can still pass through the right one for an
   * instant. Sampling either side of the landing proves the two are converging on
   * it and not merely crossing.
   */
  it('closes on the rock rather than crossing it', () => {
    for (const { rock, run } of meetings().slice(0, 10)) {
      const gapAt = (msBefore: number): number => {
        const t = run.arriveAt.getTime() - msBefore;
        const craft = runPosition(run, planet, t);
        const stone = asteroidWorldPosition(rock, SEASON_START, t);
        return Math.hypot(craft[0] - stone[0], craft[1] - stone[1], craft[2] - stone[2]);
      };
      expect(gapAt(60_000)).toBeGreaterThan(gapAt(15_000));
      expect(gapAt(15_000)).toBeGreaterThan(gapAt(0));
    }
  });

  /**
   * THE LEAD ANGLE, AS DRAWN. D43, and the whole reason the drill got faster.
   *
   * The aim point is always AHEAD of the rock — that is D19 working, and it is not
   * a bug. What made it read as one was how far ahead: at the old speed the median
   * meeting was more than a full revolution away, so a squadron set off across the
   * disc apparently at nothing. Held here to under half a lap and, in the picture,
   * to a lead the eye can join up.
   */
  it('sets off toward a point on the rock it can see, not a lap away', () => {
    const laps: number[] = [];
    for (const { rock, run } of meetings()) {
      const flight = (run.arriveAt.getTime() - run.departAt.getTime()) / 60_000;
      laps.push(flight / rock.period);
      // And the aim point is genuinely on the rock's own orbit, never off it.
      expect(Math.hypot(run.intercept.x, run.intercept.z)).toBeCloseTo(rock.radius, 3);
      expect(distance(run.intercept, { x: 0, y: 0, z: 0 })).toBeGreaterThan(0);
    }
    const worst = Math.max(...laps);
    expect(worst, `worst lead was ${worst.toFixed(2)} revolutions`).toBeLessThan(0.5);
  });
});

/**
 * SOMEBODY ELSE'S CRAFT, MOVING. D24.
 *
 * A contact carries a bearing window rather than a route, so the disc animates it
 * across that window and coasts a little past it. Two properties matter: it never
 * stands still the instant a poll is late, and it does not sail on for ever if the
 * polls never come back.
 */
describe('a contact in the galaxy', () => {
  const START = at('2026-04-01T12:00:00.000Z');
  const END = at('2026-04-01T12:04:00.000Z');

  const contact = (over: Partial<Contact> = {}): Contact => ({
    id: 'c1',
    kind: 'fleet',
    from: { x: 0, y: 0, z: 0 },
    to: { x: 400, y: 0, z: 0 },
    startAt: START,
    endAt: END,
    ...over,
  });

  it('is at the start of its window when the window opens', () => {
    expect(contactPosition(contact(), START.getTime())).toEqual(toWorld({ x: 0, y: 0, z: 0 }));
  });

  it('is at the end of its window when the window closes', () => {
    expect(contactPosition(contact(), END.getTime())).toEqual(toWorld({ x: 400, y: 0, z: 0 }));
  });

  it('is halfway across at the halfway point', () => {
    const half = contactPosition(contact(), (START.getTime() + END.getTime()) / 2);
    expect(half).toEqual(toWorld({ x: 200, y: 0, z: 0 }));
  });

  /**
   * A craft that stops dead in open space because a request was slow reads as a
   * broken game. Coasting on the last known bearing is both smoother and honest —
   * the heading is already public.
   */
  it('coasts past its window rather than stopping dead on a late poll', () => {
    const later = contactPosition(contact(), END.getTime() + 60_000);
    expect(later[0]).toBeGreaterThan(toWorld({ x: 400, y: 0, z: 0 })[0]);
  });

  /**
   * AND IT DOES NOT COAST AT ALL WHEN THE WINDOW ENDS WHERE THE CRAFT DOES.
   *
   * `landing` is set only in the last minute of a leg, and only then does the
   * window's far point stop being a heading and become the destination. Coasting
   * half as much again past a destination draws the craft straight through the
   * world it is arriving at and out the other side — which is what a late refetch
   * looked like from every other player's disc.
   */
  it('holds at the end of a landing window instead of flying through the world', () => {
    const landing = contact({ landing: true });
    const end = toWorld({ x: 400, y: 0, z: 0 });
    expect(contactPosition(landing, END.getTime())).toEqual(end);
    expect(contactPosition(landing, END.getTime() + 30_000)).toEqual(end);
    expect(contactPosition(landing, END.getTime() + 10 * 60_000)).toEqual(end);
  });

  /**
   * THE WINDOW ALREADY ENDS WHERE THE CRAFT STOPS, AND THE DISC DOES NOT SECOND-GUESS IT. D106.
   *
   * A published window's far end is a point on the SAME standoff-adjusted line the
   * owner's own client flies (`visualLeg` in `@astera/rules`), so the renderer's
   * only job is to interpolate it. It used to end at the world's centre while the
   * owner stopped in orbit, and a correction here tried to make up the difference
   * for the final window alone — which left the whole approach before it drawn a
   * planet's width ahead of where the owner saw it. The fix belongs where the
   * numbers are published, not where they are drawn.
   */
  it('lands exactly on the point its window names, and holds there', () => {
    const target: PlanetNode = {
      id: 'target',
      name: 'Target',
      owner: 'Defender',
      position: toWorld({ x: 400, y: 0, z: 0 }),
      radius: 1,
      weight: 2,
      coreTier: 2,
      coreLevel: 6,
      satellites: [],
      shielded: false,
      stance: 'dark',
      state: { kind: 'NORMAL' },
      kind: 'CAPITAL',
      isOwned: false,
      isClanmate: false,
      isCapital: true,
    };
    // As the server publishes it: the far end is the orbit the craft holds at,
    // two world units short of a world drawn at radius 1.
    const landing = contact({ landing: true, to: { x: 300, y: 0, z: 0 } });
    const early = contactPosition(landing, START.getTime(), [target]);
    const late = contactPosition(landing, END.getTime() - 1, [target]);
    const arrived = contactPosition(landing, END.getTime(), [target]);

    expect(late[0]).toBeGreaterThan(early[0]);
    expect(arrived[0]).toBeGreaterThan(late[0]);
    expect(arrived).toEqual([6, 0, 0]);
    // And it stays there rather than coasting into the world it just reached.
    expect(contactPosition(landing, END.getTime() + 60_000, [target])).toEqual([6, 0, 0]);
  });

  it('still coasts when the window is only a heading', () => {
    const heading = contactPosition(contact(), END.getTime() + 30_000);
    const held = contactPosition(contact({ landing: true }), END.getTime() + 30_000);
    expect(heading[0]).toBeGreaterThan(held[0]);
  });

  /** But not for ever, or it would sail out past the rim of the disc. */
  it('stops eventually rather than leaving the galaxy', () => {
    const far = contactPosition(contact(), END.getTime() + 60 * 60_000);
    const further = contactPosition(contact(), END.getTime() + 120 * 60_000);
    expect(far).toEqual(further);
    expect(far[0]).toBeLessThan(toWorld({ x: 700, y: 0, z: 0 })[0]);
  });

  it('never runs backwards before its window opens', () => {
    expect(contactPosition(contact(), START.getTime() - 600_000)).toEqual(
      toWorld({ x: 0, y: 0, z: 0 }),
    );
  });

  /** A window with no length at all — a craft in the last fifth of its flight. */
  it('holds position when the window has no length', () => {
    const still = contact({ endAt: START, to: { x: 0, y: 0, z: 0 } });
    expect(contactPosition(still, START.getTime() + 60_000)).toEqual(toWorld({ x: 0, y: 0, z: 0 }));
  });
});
