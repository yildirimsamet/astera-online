import { describe, expect, it } from 'vitest';
import { COMBAT, engagementEndsAt, isEngaging } from '@blindspace/rules';
import {
  BLAST_SECONDS,
  MISSILE_OF_SHIP,
  blastProgress,
  emberSpray,
  impactAt,
  impactPoint,
  shotProgress,
  volleyFor,
} from '../src/galaxy/volley.js';
import {
  clearOfWorlds,
  engagementHold,
  legEnd,
  legStandoff,
  legStart,
  NO_STANDOFF,
  orbitStandoff,
  planetNodes,
  targetNodeOf,
  threadPosition,
  toWorld,
} from '../src/galaxy/scene.js';
import { slotOffset } from '../src/galaxy/Squadrons.js';
import type { GalaxyPlanet, PendingThread } from '../src/api/schemas.js';

/**
 * THE TEN SECONDS A RAID TAKES TO LAND. D44.
 *
 * Every one of the owner's rules for the engagement is a property rather than a
 * matter of taste, so every one of them is asserted here rather than judged from a
 * screenshot: the whole formation fires, nobody fires twice at once, nobody aims at
 * the exact centre, and the last fire is out before the battle resolves.
 *
 * The last of those is the one that would fail silently. A volley that overran its
 * window by a fraction of a second would leave a burst on a world whose battle
 * report had already been written — and it would look completely fine.
 */

const RADIUS = 0.82;

describe('a volley', () => {
  const models = 5;
  const shots = volleyFor('raid-1', models, RADIUS);

  it('is fired by every drawn model in the formation', () => {
    const firing = new Set(shots.map((s) => s.slot));
    expect(firing.size).toBe(models);
    for (let slot = 0; slot < models; slot++) expect(firing.has(slot)).toBe(true);
  });

  /**
   * EVERY MODEL FIRES, AND THE VOLLEY AS A WHOLE SITS IN ITS BAND. D52.
   *
   * It used to be one to three rounds each, full stop, and the owner's reason for
   * raising it is the shape of a TYPICAL raid rather than a big one: rounds are per
   * drawn model, a squadron of eight ships is one or two models, so the commonest
   * engagement in the game fired every second and a half into a silent sky.
   *
   * The band is now on the volley rather than on each model, because both ends
   * needed one: a floor so a small raid still reads as a bombardment, and a ceiling
   * so a twelve-model formation does not schedule ninety rounds into eight seconds
   * and arrive as a chord.
   */
  it('has every drawn model firing, several rounds each', () => {
    for (let slot = 0; slot < models; slot++) {
      expect(shots.filter((s) => s.slot === slot).length).toBeGreaterThanOrEqual(2);
    }
    // And the counts genuinely vary — a schedule that gave everyone the same
    // number would satisfy the range and miss the point.
    const counts = new Set(
      Array.from({ length: models }, (_, slot) => shots.filter((s) => s.slot === slot).length),
    );
    expect(counts.size).toBeGreaterThan(1);
  });

  it('keeps the whole volley inside its band, at any formation size', () => {
    for (const size of [1, 2, 3, 5, 8, 12]) {
      const volley = volleyFor(`band-${String(size)}`, size, RADIUS);
      expect(volley.length, `${String(size)} models`).toBeGreaterThanOrEqual(18);
      expect(volley.length, `${String(size)} models`).toBeLessThanOrEqual(40);
    }
  });

  /** A capped volley must still come from the whole formation, not from part of it. */
  it('takes a cap fairly from every model rather than emptying the last racks', () => {
    const volley = volleyFor('capped', 12, RADIUS);
    expect(new Set(volley.map((s) => s.slot)).size).toBe(12);
  });

  /**
   * NOT ALL AT ONCE — the owner's first rule, and the reason the window is sliced
   * rather than sampled. Independent random times over eight seconds clump: with a
   * dozen shots, two inside a tenth of a second of each other is the common case.
   */
  it('never fires two rounds at the same instant, at any formation size', () => {
    for (const size of [1, 2, 3, 5, 8, 12]) {
      const volley = volleyFor(`size-${String(size)}`, size, RADIUS);
      const times = volley.map((s) => s.launchAt).sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        const gap = times[i]! - times[i - 1]!;
        expect(gap, `${String(size)} models: two rounds ${gap.toFixed(3)}s apart`).toBeGreaterThan(
          0.05,
        );
      }
    }
  });

  /**
   * AND THE SKY IS ACTUALLY BUSY. The owner's ask, as a number rather than a look.
   *
   * "Not all at once" has a failure mode on the other side, and the volley was in
   * it: with a slice each and one-to-three rounds, a two-model squadron fired four
   * times across ten seconds. Every property below held perfectly and the raid the
   * player waited forty minutes for was four rounds of mostly empty sky.
   */
  it('keeps a small squadron firing rather than pecking', () => {
    const volley = volleyFor('small', 2, RADIUS);
    expect(volley.length).toBeGreaterThanOrEqual(6);
    const times = volley.map((s) => s.launchAt).sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, i) => t - times[i]!);
    const worst = Math.max(...gaps);
    // No two-and-a-half-second holes in a ten-second engagement.
    expect(worst, `longest silence ${worst.toFixed(2)}s`).toBeLessThan(1.6);
  });

  /** And the order is mixed across the formation, not one ship emptying its rack. */
  it('interleaves the formation rather than firing model by model', () => {
    const order = volleyFor('mixed', 6, RADIUS).map((s) => s.slot);
    const sorted = [...order].sort((a, b) => a - b);
    expect(order).not.toEqual(sorted);
  });

  /**
   * NOT THE CENTRE — the owner's second rule. Every round aims somewhere near the
   * middle of the world, and no two aim at the same place.
   */
  it('scatters the aim around the centre instead of converging on it', () => {
    const spreads = shots.map((s) => Math.hypot(s.aim[0], s.aim[1]));
    for (const spread of spreads) {
      expect(spread).toBeGreaterThan(0);
      expect(spread).toBeLessThan(RADIUS);
    }
    // A real spread rather than a jitter: the widest shot is well clear of the
    // tightest, and no two land on the same point.
    expect(Math.max(...spreads)).toBeGreaterThan(RADIUS * 0.25);
    const places = new Set(shots.map((s) => `${s.aim[0].toFixed(6)},${s.aim[1].toFixed(6)}`));
    expect(places.size).toBe(shots.length);
  });

  /**
   * THE WHOLE VOLLEY IS OVER BEFORE THE BATTLE IS. The one property that fails
   * invisibly: an overrun leaves fire on a world whose report is already filed.
   */
  it('lands and burns out inside the engagement window', () => {
    for (const size of [1, 4, 12]) {
      for (const shot of volleyFor(`fits-${String(size)}`, size, RADIUS)) {
        expect(shot.launchAt).toBeGreaterThanOrEqual(0);
        expect(impactAt(shot) + BLAST_SECONDS).toBeLessThanOrEqual(COMBAT.engagementSeconds);
      }
    }
  });

  /** Same raid, same volley — otherwise a round in flight jumps course on a poll. */
  it('is the same schedule every time it is asked for', () => {
    expect(volleyFor('raid-1', models, RADIUS)).toEqual(shots);
    expect(volleyFor('raid-2', models, RADIUS)).not.toEqual(shots);
  });

  it('is nothing at all for a formation with no models', () => {
    expect(volleyFor('empty', 0, RADIUS)).toEqual([]);
    expect(volleyFor('flat', 4, 0)).toEqual([]);
  });

  /** The owner's size band, held against the ship that fires it. */
  it('draws a round at a quarter to a half of a ship', () => {
    expect(MISSILE_OF_SHIP).toBeGreaterThanOrEqual(0.25);
    expect(MISSILE_OF_SHIP).toBeLessThanOrEqual(0.5);
  });
});

describe('a round in flight', () => {
  const [shot] = volleyFor('one', 1, RADIUS);

  it('does not exist before it is launched', () => {
    expect(shotProgress(shot!, shot!.launchAt - 0.01)).toBeNull();
    expect(shotProgress(shot!, 0)).toBeNull();
  });

  it('runs from nought to one across its own flight', () => {
    expect(shotProgress(shot!, shot!.launchAt)).toBe(0);
    expect(shotProgress(shot!, shot!.launchAt + shot!.flight / 2)).toBeCloseTo(0.5, 6);
  });

  /** Null rather than a clamp: a clamped round would sit on the surface for ever. */
  it('is gone the instant it lands', () => {
    expect(shotProgress(shot!, impactAt(shot!) + 1e-9)).toBeNull();
    expect(shotProgress(shot!, impactAt(shot!) + 5)).toBeNull();
  });

  /**
   * THE FAR END IS HELD WITH A HAIR OF SLACK, and that is about floats rather than
   * about the rule. `impactAt + BLAST_SECONDS` is a sum, and a sum minus one of its
   * own terms is not exactly the other one — so asking for the value AT the nominal
   * boundary is asking whether 0.9 round-trips, not whether the fire goes out.
   */
  it('burns only after it lands, and only for as long as the burst lasts', () => {
    expect(blastProgress(shot!, impactAt(shot!) - 0.01)).toBeNull();
    expect(blastProgress(shot!, impactAt(shot!))).toBe(0);
    expect(blastProgress(shot!, impactAt(shot!) + BLAST_SECONDS / 2)).toBeCloseTo(0.5, 6);

    const last = blastProgress(shot!, impactAt(shot!) + BLAST_SECONDS);
    expect(last === null || last > 0.999).toBe(true);
    expect(blastProgress(shot!, impactAt(shot!) + BLAST_SECONDS * 1.001)).toBeNull();
  });

  /**
   * LINEAR, AND THAT IS THE POINT. The flash, the fireball, the shock ring and the
   * embers each shape this differently; a progress that arrived pre-curved could
   * not be un-curved, and every layer would fade on the same one.
   */
  it('runs evenly through the burn so each layer can shape it', () => {
    const quarter = blastProgress(shot!, impactAt(shot!) + BLAST_SECONDS * 0.25)!;
    const half = blastProgress(shot!, impactAt(shot!) + BLAST_SECONDS * 0.5)!;
    const threeQuarters = blastProgress(shot!, impactAt(shot!) + BLAST_SECONDS * 0.75)!;
    expect(half - quarter).toBeCloseTo(threeQuarters - half, 6);
  });
});

/**
 * THE EMBERS AN IMPACT THROWS.
 *
 * Ten of them, spread evenly over a sphere rather than drawn independently: with
 * this few, one clump is most of the effect, and a spray that boils instead of
 * flying outward is the classic sign of a particle wired to the wrong clock.
 */
describe('an ember spray', () => {
  const [shot, other] = volleyFor('embers', 4, RADIUS);

  it('throws every ember in a different direction', () => {
    const spray = emberSpray(shot!);
    expect(spray.length).toBeGreaterThan(4);
    const bearings = new Set(spray.map((d) => d.map((n) => n.toFixed(4)).join(',')));
    expect(bearings.size).toBe(spray.length);
  });

  it('throws them all at the same speed, in every direction', () => {
    for (const [x, y, z] of emberSpray(shot!)) {
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
    }
    // Genuinely spherical: something goes up, something goes down.
    const ys = emberSpray(shot!).map((d) => d[1]);
    expect(Math.max(...ys)).toBeGreaterThan(0.5);
    expect(Math.min(...ys)).toBeLessThan(-0.5);
  });

  it('is the same spray every time, and a different one per round', () => {
    expect(emberSpray(shot!)).toEqual(emberSpray(shot!));
    expect(emberSpray(shot!)).not.toEqual(emberSpray(other!));
  });
});

/**
 * WHERE A ROUND ACTUALLY GOES OFF.
 *
 * It is aimed at a point NEAR the centre, which is a point INSIDE the world — so
 * without solving the crossing the burst would happen somewhere in the planet's
 * core, invisible from everywhere. This is the piece of geometry that puts the fire
 * on the surface.
 */
describe('an impact', () => {
  const DISTANCE = 2.1;
  const from: [number, number, number] = [0.1, -0.05, 0];

  it('lands exactly on the surface, wherever it was aimed', () => {
    for (const shot of volleyFor('impacts', 6, RADIUS)) {
      const at = impactPoint(from, shot.aim, DISTANCE, RADIUS);
      const centre = Math.hypot(at[0], at[1], at[2] - DISTANCE);
      expect(centre).toBeCloseTo(RADIUS, 6);
    }
  });

  /** On the face the squadron can see — a burst behind the world lights nothing. */
  it('lands on the near side, never round the back', () => {
    for (const shot of volleyFor('near-side', 6, RADIUS)) {
      const at = impactPoint(from, shot.aim, DISTANCE, RADIUS);
      expect(at[2]).toBeLessThan(DISTANCE);
      // And short of the centre by a real margin, not by a rounding error.
      expect(DISTANCE - at[2]).toBeGreaterThan(RADIUS * 0.2);
    }
  });

  it('is a different place for every round in the volley', () => {
    const places = volleyFor('spread', 8, RADIUS).map((shot) =>
      impactPoint(from, shot.aim, DISTANCE, RADIUS).map((n) => n.toFixed(5)).join(','),
    );
    expect(new Set(places).size).toBe(places.length);
  });

  /** A degenerate solve must give a real point rather than a NaN in a buffer. */
  it('returns a finite point even when the geometry collapses', () => {
    expect(impactPoint([0, 0, 1], [0, 0], 1, 0.5).every(Number.isFinite)).toBe(true);
    expect(impactPoint([0, 0, 0], [0, 0], 0, 1).every(Number.isFinite)).toBe(true);
    expect(impactPoint([0, 0, 0], [5, 5], 2, 0.1).every(Number.isFinite)).toBe(true);
  });
});

/**
 * A CRAFT ARRIVES IN ORBIT, NOT AT THE MIDDLE OF A WORLD. D44.
 *
 * The endpoint of a leg is the target planet's own coordinates — its centre — so an
 * arriving squadron was drawn inside the thing it had come to attack. Invisible
 * while an arrival lasted zero seconds; a ten-second engagement makes it the shot.
 */
describe('a leg that ends at a world', () => {
  const planet = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet =>
    ({
      id: 'p2',
      name: 'Tharsis',
      owner: 'someone',
      position: { x: 600, y: 0, z: 0 },
      coreTier: 4,
      satellites: [],
      shielded: false,
      isSelf: false,
      fleet: null,
      ...over,
    }) as GalaxyPlanet;

  const nodes = planetNodes([
    planet({ id: 'p1', position: { x: 0, y: 0, z: 0 }, isSelf: true, coreTier: 1 }),
    planet(),
  ]);

  const thread = (over: Partial<PendingThread> = {}): PendingThread => ({
    kind: 'fleet',
    targetName: 'Tharsis',
    minutesRemaining: 4,
    arriveAt: new Date('2026-04-01T12:40:00.000Z'),
    leg: 'outbound',
    fleet: { WASP: 20 },
    path: {
      from: { x: 0, y: 0, z: 0 },
      to: { x: 600, y: 0, z: 0 },
      departAt: new Date('2026-04-01T12:00:00.000Z'),
      arriveAt: new Date('2026-04-01T12:40:00.000Z'),
    },
    ...over,
  });

  /**
   * The same round trip, on its way back.
   *
   * A return leg is the outbound row with its two ends SWAPPED (D28), which is why
   * the raided world is `from` here and the fixture cannot simply flip `leg`.
   */
  const homeward = (): PendingThread =>
    thread({
      leg: 'return',
      path: {
        from: { x: 600, y: 0, z: 0 },
        to: { x: 0, y: 0, z: 0 },
        departAt: new Date('2026-04-01T12:40:00.000Z'),
        arriveAt: new Date('2026-04-01T13:20:00.000Z'),
      },
    });

  it('finds the world it is aimed at, from coordinates alone', () => {
    const found = targetNodeOf(nodes, { x: 600, y: 0, z: 0 });
    expect(found?.id).toBe('p2');
    expect(targetNodeOf(nodes, { x: 123, y: 45, z: 6 })).toBeUndefined();
  });

  it('stops clear of the world rather than inside it', () => {
    const end = legEnd(thread().path!, legStandoff(thread(), nodes).end);
    const centre = toWorld({ x: 600, y: 0, z: 0 });
    const gap = Math.hypot(end[0] - centre[0], end[1] - centre[1], end[2] - centre[2]);
    // A heavyweight world is drawn at 1.4 across; the squadron must be outside it.
    expect(gap).toBeGreaterThan(1.4);
    expect(gap).toBeCloseTo(orbitStandoff(1.4), 6);
  });

  /** A fleet coming home LANDS. Holding it in orbit would park it over its own world. */
  it('does not stand off at the world it is landing on', () => {
    expect(legStandoff(homeward(), nodes).end).toBe(0);
  });

  /**
   * THE SEAM BETWEEN THE TWO LEGS. The whole reason `legStandoff` has two ends.
   *
   * A return mission is stored with its origin and target swapped, so its `from` is
   * the world that was raided. Offsetting only the far end left the return leg
   * starting at that world's CENTRE — a standoff further on than the outbound leg
   * had stopped — so the instant the mission flipped, the craft jumped forward into
   * the planet and reversed out of it.
   */
  it('sets off home from exactly where the outbound leg stopped', () => {
    const out = thread();
    const back = homeward();
    const stopped = legEnd(out.path!, legStandoff(out, nodes).end);
    const started = legStart(back.path!, legStandoff(back, nodes).start);
    expect(started[0]).toBeCloseTo(stopped[0], 6);
    expect(started[1]).toBeCloseTo(stopped[1], 6);
    expect(started[2]).toBeCloseTo(stopped[2], 6);
  });

  it('does not teleport into the world at the moment the leg turns round', () => {
    const back = homeward();
    const path = back.path!;
    const at = threadPosition(path, path.departAt.getTime(), legStandoff(back, nodes));
    const centre = toWorld(path.from);
    const gap = Math.hypot(at[0] - centre[0], at[1] - centre[1], at[2] - centre[2]);
    // Outside the heavyweight's 1.4 silhouette, not sitting in the middle of it.
    expect(gap).toBeCloseTo(orbitStandoff(1.4), 6);
  });

  /** A leg pointed at nothing the disc is drawing must not invent a standoff. */
  it('does not stand off from a world that is not on the map', () => {
    const stray = thread();
    stray.path!.to = { x: -999, y: 30, z: 12 };
    expect(legStandoff(stray, nodes)).toEqual({ start: 0, end: 0 });

    const strayHome = homeward();
    strayHome.path!.from = { x: -999, y: 30, z: 12 };
    expect(legStandoff(strayHome, nodes)).toEqual({ start: 0, end: 0 });
  });

  it('leaves the craft at its own planet the moment it departs', () => {
    const path = thread().path!;
    const standoff = legStandoff(thread(), nodes);
    expect(threadPosition(path, path.departAt.getTime(), standoff)).toEqual(toWorld(path.from));
  });

  it('holds the craft at the standoff point once it has arrived', () => {
    const path = thread().path!;
    const standoff = legStandoff(thread(), nodes);
    const at = threadPosition(path, path.arriveAt.getTime(), standoff);
    expect(at).toEqual(legEnd(path, standoff.end));
    // And it stays there for the whole engagement rather than sliding on in.
    const later = threadPosition(path, engagementEndsAt(path.arriveAt.getTime()), standoff);
    expect(later).toEqual(at);
  });

  /**
   * A raid on a very near neighbour must not end BEHIND where it started, which
   * would draw a fleet reversing out of its own planet.
   */
  it('never pulls the endpoint back past the halfway mark of a short leg', () => {
    const short = thread();
    short.path!.to = { x: 12, y: 0, z: 0 };
    const end = legEnd(short.path!, 40);
    expect(end[0]).toBeGreaterThan(0);
    expect(end[0]).toBeCloseTo(toWorld({ x: 6, y: 0, z: 0 })[0], 6);
  });

  /** With no standoff asked for, the leg is exactly what it always was. */
  it('is unchanged when nothing stands off', () => {
    const path = thread().path!;
    const half = (path.departAt.getTime() + path.arriveAt.getTime()) / 2;
    expect(threadPosition(path, half, NO_STANDOFF)).toEqual(threadPosition(path, half));
    expect(legEnd(path, 0)).toEqual(toWorld(path.to));
    expect(legStart(path, 0)).toEqual(toWorld(path.from));
  });
});

/**
 * NOBODY'S CRAFT IS DRAWN INSIDE A WORLD — not just your own.
 *
 * D44 stopped YOUR squadron being drawn in the middle of the world it attacks, by
 * stopping its leg short. A contact has no leg to stop short of: the server sends a
 * bearing window and no destination, and the near end of that window is the craft's
 * true position — which on final approach is the target's centre. So the attacker
 * watched their raid hold in orbit while every other player in the galaxy watched
 * the same raid fly into the planet and vanish.
 *
 * The correction is geometric, needs no destination, and therefore discloses
 * nothing: a craft that would be drawn inside a world is put on its surface.
 */
describe('craft and the worlds they pass', () => {
  const planet = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet =>
    ({
      id: 'p1',
      name: 'Tharsis',
      owner: 'Vale',
      position: { x: 600, y: 0, z: 0 },
      coreTier: 5,
      satellites: [],
      shielded: false,
      isSelf: false,
      fleet: null,
      ...over,
    }) as GalaxyPlanet;

  const nodes = planetNodes([planet()]);
  const centre = toWorld({ x: 600, y: 0, z: 0 });
  const radius = nodes[0]!.radius;
  const from = (p: readonly [number, number, number]) =>
    Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]);

  it('leaves a craft in open space exactly where it is', () => {
    const out: [number, number, number] = [0, 0, 0];
    expect(clearOfWorlds(nodes, out)).toEqual(out);
  });

  it('puts a craft drawn inside a world back on its surface', () => {
    const inside: [number, number, number] = [centre[0] + radius * 0.2, centre[1], centre[2]];
    const fixed = clearOfWorlds(nodes, inside);
    expect(from(fixed)).toBeGreaterThan(radius);
    // On the surface, not held off it — a standoff is two radii and this is not one.
    expect(from(fixed)).toBeLessThan(radius * 1.3);
  });

  it('pushes straight out, so the craft keeps its bearing', () => {
    const inside: [number, number, number] = [centre[0], centre[1], centre[2] + radius * 0.1];
    const fixed = clearOfWorlds(nodes, inside);
    expect(fixed[0]).toBeCloseTo(centre[0], 6);
    expect(fixed[1]).toBeCloseTo(centre[1], 6);
    expect(fixed[2]).toBeGreaterThan(centre[2]);
  });

  /** A craft dead on the centre has no direction to be pushed along. */
  it('never divides by a zero distance', () => {
    const fixed = clearOfWorlds(nodes, [...centre] as [number, number, number]);
    expect(Number.isFinite(fixed[0] + fixed[1] + fixed[2])).toBe(true);
    expect(from(fixed)).toBeGreaterThan(radius);
  });

  /**
   * The clearance is tight on purpose. At a raid's standoff — two radii — every
   * craft passing an unrelated world would visibly swerve around it.
   */
  it('does not deflect a craft passing a world it is not going to', () => {
    const by: [number, number, number] = [centre[0], centre[1], centre[2] + radius * 1.4];
    expect(clearOfWorlds(nodes, by)).toEqual(by);
  });

  it('leaves a squadron at its own standoff alone', () => {
    const thread = {
      from: { x: 0, y: 0, z: 0 },
      to: { x: 600, y: 0, z: 0 },
      departAt: new Date('2026-04-01T12:00:00.000Z'),
      arriveAt: new Date('2026-04-01T12:40:00.000Z'),
    };
    const held = legEnd(thread, orbitStandoff(radius));
    expect(clearOfWorlds(nodes, held)).toEqual(held);
  });
});

/**
 * THE BATTLE EVERYBODY WATCHES. D52.
 *
 * The attacker's client holds its squadron off the target with `legStandoff`, which
 * reads the leg it owns. A bystander has no leg — a contact is a bearing and no
 * destination — so for the ten seconds the raid is landing the payload names the
 * world, and `engagementHold` solves the SAME standoff from the same drawn radius.
 *
 * The two have to land in the same place, because they are the same squadron.
 */
describe('a raid landing, from both sides', () => {
  const planet = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet =>
    ({
      id: 'p2',
      name: 'Tharsis',
      owner: 'Vale',
      position: { x: 600, y: 0, z: 0 },
      coreTier: 3,
      satellites: [],
      shielded: false,
      isSelf: false,
      fleet: null,
      ...over,
    }) as GalaxyPlanet;

  const nodes = planetNodes([
    planet({ id: 'p1', position: { x: 0, y: 0, z: 0 }, isSelf: true, coreTier: 1 }),
    planet(),
  ]);

  const home = { x: 0, y: 0, z: 0 };
  const target = { x: 600, y: 0, z: 0 };

  /** The attacker's own leg, drawn from `path`. */
  const attackerSees = (): [number, number, number] => {
    const thread: PendingThread = {
      kind: 'fleet',
      targetName: 'Tharsis',
      minutesRemaining: 0,
      arriveAt: new Date('2026-04-01T12:40:00.000Z'),
      leg: 'outbound',
      fleet: { WASP: 12 },
      path: {
        from: home,
        to: target,
        departAt: new Date('2026-04-01T12:00:00.000Z'),
        arriveAt: new Date('2026-04-01T12:40:00.000Z'),
      },
    };
    return legEnd(thread.path!, legStandoff(thread, nodes).end);
  };

  /** What everybody else is sent: the world, and a minute of the approach. */
  const bystanderSees = (): [number, number, number] => {
    const approach = { x: 600 - 25, y: 0, z: 0 };
    return engagementHold(target, approach, nodes);
  };

  it('puts the squadron in the same place for the attacker and for a stranger', () => {
    const mine = attackerSees();
    const theirs = bystanderSees();
    expect(theirs[0]).toBeCloseTo(mine[0], 6);
    expect(theirs[1]).toBeCloseTo(mine[1], 6);
    expect(theirs[2]).toBeCloseTo(mine[2], 6);
  });

  it('holds it clear of the world rather than inside it', () => {
    const at = bystanderSees();
    const centre = toWorld(target);
    const gap = Math.hypot(at[0] - centre[0], at[1] - centre[1], at[2] - centre[2]);
    const radius = nodes.find((n) => n.id === 'p2')!.radius;
    expect(gap).toBeCloseTo(orbitStandoff(radius), 6);
    expect(clearOfWorlds(nodes, at)).toEqual(at);
  });

  it('holds it on the side the fleet came in on', () => {
    // Approaching from −x, so the squadron sits on the −x face.
    expect(bystanderSees()[0]).toBeLessThan(toWorld(target)[0]);
    // And from the other side, on the other face.
    const other = engagementHold(target, { x: 600 + 25, y: 0, z: 0 }, nodes);
    expect(other[0]).toBeGreaterThan(toWorld(target)[0]);
  });

  /** A world the disc is not drawing leaves nothing to stand off from. */
  it('falls back to the world itself when there is no node for it', () => {
    const stray = { x: -999, y: 30, z: 12 };
    expect(engagementHold(stray, home, nodes)).toEqual(toWorld(stray));
  });

  /** A NaN in a position buffer takes the whole scene down. */
  it('survives an approach that is on top of the target', () => {
    const at = engagementHold(target, target, nodes);
    expect(at.every((n) => Number.isFinite(n))).toBe(true);
  });
});

/**
 * WHEN THE VOLLEY IS ON SCREEN.
 *
 * The window comes from the rules package, so the client cannot drift out of step
 * with the server that schedules against it.
 */
describe('the engagement window', () => {
  const arriveAt = Date.parse('2026-04-01T12:40:00.000Z');

  it('opens the moment the fleet is over the world and closes when it resolves', () => {
    expect(isEngaging(arriveAt, arriveAt - 1)).toBe(false);
    expect(isEngaging(arriveAt, arriveAt)).toBe(true);
    expect(isEngaging(arriveAt, engagementEndsAt(arriveAt) - 1)).toBe(true);
    expect(isEngaging(arriveAt, engagementEndsAt(arriveAt))).toBe(false);
  });

  it('is exactly the window the server schedules against', () => {
    expect(engagementEndsAt(arriveAt) - arriveAt).toBe(COMBAT.engagementSeconds * 1000);
  });

  /**
   * EVERY MODEL FIRES FROM ITS OWN PLACE IN THE FORMATION, and none of them fires
   * from inside the world. The slot offsets run backwards from the squadron's nose,
   * so a round launched from the rearmost craft still has further to fly, never
   * less.
   */
  it('launches every round from outside the world it is hitting', () => {
    const slots = Array.from({ length: 8 }, (_, i) => slotOffset(i, 0.225 * 1.5));
    const distance = orbitStandoff(RADIUS);
    for (const shot of volleyFor('outside', slots.length, RADIUS)) {
      const from = slots[shot.slot]!;
      const toCentre = Math.hypot(from[0], from[1], from[2] - distance);
      expect(toCentre).toBeGreaterThan(RADIUS);
    }
  });
});
