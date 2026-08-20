import { describe, expect, it } from 'vitest';
import {
  asteroidActive,
  distance,
  generateGalaxy,
  interceptAsteroid,
  prospectorSpeed,
} from '@astera/rules';
import {
  asteroidWorldPosition,
  contactPosition,
  runPosition,
  threadPosition,
  toWorld,
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
