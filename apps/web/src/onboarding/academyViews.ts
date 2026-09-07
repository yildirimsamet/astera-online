import { ACADEMY_STEPS, ACADEMY_FLIGHT_DISTANCE, ACADEMY_LEG_SECONDS, PROSPECTOR, academyMinedOre, engagementEndsAt, fleetEntries, academyPirateHomecoming } from '@astera/rules';
import type { MiningView, PendingThread } from '../api/schemas.js';
import type { AcademyWorld } from './academyWorld.js';

/** Authored local targets appear only when their lesson starts. */
/**
 * THE WORLD THE RAID LESSON ATTACKS.
 *
 * Named rather than typed in four places, and the name matters for one reason
 * nobody would guess: planet art is `hash(id) % 16`, so the id IS the picture.
 * `academy-target` and `academy-home` both hashed onto `planet_8`, which had the
 * final lesson sending a fleet at a pixel-perfect copy of the commander's own
 * world — the one target a raid lesson cannot have.
 *
 * `academy-foe` lands on `planet_11`, which is the render the owner picked for
 * this world. `academy-world.test.ts` asserts it differs from home and
 * `academy-api.test.ts` pins the render itself, so a later rename fails loudly
 * instead of quietly restoring the twin or swapping the picture.
 */
export const ACADEMY_TARGET_ID = 'academy-foe';

export const ACADEMY_ROCK = 'academy_asteroid_00001';
export const academyTarget = (w: AcademyWorld) => ({ ...w.preview.reserved.position, x: w.preview.reserved.position.x + ACADEMY_FLIGHT_DISTANCE });
/**
 * THE WORLD THE SIGHT LESSON PUTS INSIDE THE SPHERE. Owner instruction.
 *
 * The Telescope beat draws the sphere and names it, which states a radius without
 * giving anybody a reason to care about one. A second after it opens, a world
 * appears inside it and the beat becomes the sentence it was reaching for: this is
 * what sight is FOR — inside here, you can see who is there.
 *
 * SCENERY, AND ONLY SCENERY. It is never a target: the gate withholds the canvas
 * for the whole of this beat, so it cannot be tapped, and it is published only
 * while the beat is running so nothing later can point at a world that was a
 * demonstration.
 *
 * PLACED OPPOSITE THE RAID TARGET. `academyTarget` sits at +x; this goes the other
 * way, so the two lessons do not teach the same corner of the disc. The distance is
 * comfortably inside `SENSOR.baseRadius` — a world the sphere does NOT cover would
 * demonstrate the exact opposite of the point.
 */
export const ACADEMY_SIGHT_IDS = ['academy-sight-1', 'academy-sight-2', 'academy-sight-3'] as const;

/**
 * WHERE THE THREE SIT, AND WHY THEY ARE NOT IN A ROW.
 *
 * Three rather than one, on owner instruction: a single world inside the sphere
 * reads as a coincidence, three read as "this is the part of the galaxy you can
 * see", which is the sentence the beat is trying to say. They are spread in z as
 * well as x so they arrive as a neighbourhood instead of a line pointing away
 * from home.
 *
 * Every offset stays comfortably inside `SENSOR.baseRadius` — a world the sphere
 * does NOT cover demonstrates the exact opposite of the point — and all of them
 * go to -x, opposite the raid target, so the two lessons do not teach the same
 * corner of the disc.
 */
const ACADEMY_SIGHT_SPOTS = [
  { x: -430, z: -150 },
  { x: -330, z: 190 },
  { x: -500, z: 60 },
] as const;

/**
 * BIG ENOUGH TO READ AT THAT RANGE. Owner instruction.
 *
 * A world's drawn size is a geometric ramp over its EXACT Core level (D166), so
 * the only honest dial for "make them bigger" is the level itself. At Core 1 —
 * where these started — a world four hundred units out is a dot, which is a poor
 * advertisement for the instrument that just found it.
 */
const ACADEMY_SIGHT_CORE = 9;

export const academySightWorlds = (w: AcademyWorld) => ACADEMY_SIGHT_IDS.map((id, i) => ({
  id,
  position: {
    ...w.preview.reserved.position,
    x: w.preview.reserved.position.x + ACADEMY_SIGHT_SPOTS[i]!.x,
    z: w.preview.reserved.position.z + ACADEMY_SIGHT_SPOTS[i]!.z,
  },
  coreLevel: ACADEMY_SIGHT_CORE,
}));

export const atLesson = (w: AcademyWorld, id: string) => ACADEMY_STEPS[w.step]?.id === id;

/**
 * IS THE LESSON'S TARGET STILL THERE TO BE DRAWN? Owner instruction.
 *
 * A target belongs to its lesson but stops existing before the lesson does, and
 * both were published all the way to the end of the beat: a commander watched
 * their surviving Dart fly home past a pirate it had already wiped out, and their
 * miner leave a rock that still looked like a rock.
 *
 * THE TWO ENDINGS ARE NOT THE SAME MOMENT, and treating them as one is a bug I
 * shipped once already. Arrival is when the ROCK is empty — the run flips to
 * `returning` on the same tick, there is nothing further to watch. Arrival is when
 * the pirate fight BEGINS: `ENGAGEMENT_MS` of it is drawn, both directions of it,
 * and cutting the pirate at `arriveAt` deleted the target of the battle animation
 * while the battle animation was playing. The pirate goes when the shooting does.
 *
 * Nothing else goes with either of them. Both return legs are drawn from
 * `intercept` and home and never ask for the target — `runPosition` says so in as
 * many words, and `academyPending` builds its own path — so the craft still flies
 * home from exactly where it was.
 */
const targetGoneAt = (id: string, arriveAt: number): number =>
  id === 'pirate' ? engagementEndsAt(arriveAt) : arriveAt;

export const targetStanding = (w: AcademyWorld, id: string, now: number): boolean =>
  atLesson(w, id) && !(w.flight !== null && now >= targetGoneAt(id, w.flight.arriveAt));

export function academyPending(w: AcademyWorld, now: number): PendingThread[] {
  const f = w.flight;
  if (!f || f.kind === 'mine') return [];
  const returning = now >= f.returnAt;
  const end = returning ? f.homeAt : f.arriveAt;
  return [{
    id: returning ? `${f.id}-return` : f.id, kind: f.kind === 'pirate' ? 'pirate' : 'fleet',
    targetName: f.kind === 'pirate' ? 'AC-01' : 'Academy II',
    ...(f.kind === 'pirate' ? { pirate: { level: 1, callsign: 'AC-01' } } : { targetPlanetId: ACADEMY_TARGET_ID }),
    arriveAt: new Date(end), minutesRemaining: Math.max(0, (end - now) / 60_000), leg: returning ? 'return' : 'outbound',
    // The prize flies back with them: survivors plus the hull they took, from the
    // same statement the hangar is filled from. Owner instruction.
    fleet: returning && f.kind === 'pirate' ? academyPirateHomecoming() : f.fleet,
    path: { from: returning ? academyTarget(w) : w.preview.reserved.position,
      to: returning ? w.preview.reserved.position : academyTarget(w),
      departAt: new Date(returning ? f.returnAt : f.departAt), arriveAt: new Date(end) },
  }];
}

export function academyMining(w: AcademyWorld, now: number): MiningView & { isotopes: [] } {
  // Gone the moment it is emptied, rather than at the end of the beat: see
  // `targetStanding`. The RUNS outlive it — the miner still has to get home.
  const standing = targetStanding(w, 'mine', now);
  const mined = academyMinedOre();
  const runs = [...w.journeys, ...(w.flight ? [w.flight] : [])].filter((f) => f.kind === 'mine');
  return {
    derrick: false, craftSpeed: PROSPECTOR.speed, craftHold: PROSPECTOR.hold,
    derrickHold: PROSPECTOR.hold, isotopes: [], debris: [], nextFieldChangeAt: null,
    asteroids: standing ? [{
      id: ACADEMY_ROCK, level: 1, ore: 120, oreRemaining: 120,
      crystalShare: 0.3, radius: academyTarget(w).x, period: 1e9, phase: 0, inclination: 0,
      ascendingNode: 0, speed: 0, appearsAt: 0, expiresAt: 1e9,
      active: true, isotopeRich: false, deuteriumShare: null,
    }] : [],
    runs: runs.map((f) => ({
      id: f.id, targetKind: 'asteroid', asteroidId: ACADEMY_ROCK, debrisFieldId: null,
      status: now >= f.homeAt ? 'done' : now >= f.arriveAt ? 'returning' : 'outbound', craft: 1,
      departAt: new Date(f.departAt), arriveAt: new Date(f.arriveAt), homeAt: new Date(f.homeAt), intercept: academyTarget(w),
      minedAlloy: now >= f.arriveAt ? mined.alloy : 0, minedCrystal: now >= f.arriveAt ? mined.crystal : 0, minedDeuterium: 0,
    })),
  };
}

export function academyPirates(w: AcademyWorld) {
  return { originPlanetId: w.preview.reserved.id, pirates: atLesson(w, 'pirate') && !w.flight ? [{
    id: 'academy-pirate', callsign: 'AC-01', zone: 'IDENTIFIED', at: academyTarget(w),
    expiresInMinutes: 60, reachMinutes: ACADEMY_LEG_SECONDS / 60, level: 1, fleet: { WARDEN: 1 }, damageMult: 1,
    reach: fleetEntries(w.checkpoint.fleet).map(([hull]) => ({ hull, minutes: ACADEMY_LEG_SECONDS / 60, distance: ACADEMY_FLIGHT_DISTANCE, at: academyTarget(w) })),
  }] : [] };
}
