import { COMBAT, seededFrom } from '@blindspace/rules';

/**
 * WHO FIRES, WHEN, AND AT WHAT. D44.
 *
 * The ten seconds between a fleet arriving and its battle being settled are the
 * only moment in the game a player watches a decision they made forty minutes ago
 * actually land. This is the score for it: which drawn model fires, at what
 * second, along what line, and where on the world it lands.
 *
 * PURE, AND SEPARATE FROM THE DRAWING, for the reason every other piece of maths
 * in this codebase is: a schedule computed inside a render loop can only be
 * checked by looking at it, and "the volley looked a bit clumped" is not something
 * a screenshot proves either way. Every rule the owner asked for is a property
 * that can be asserted — nobody fires twice at once, nobody fires at the exact
 * centre, everything lands before the battle resolves — so all of them are.
 *
 * DETERMINISTIC, from the mission's own key. A schedule redrawn from `Math.random`
 * would re-roll on every React render and every poll, so a missile halfway to a
 * world would jump onto a different course. Seeded, the same raid produces the
 * same volley for as long as it is on screen — and produces it identically on a
 * reload, which is what makes it photographable.
 */

/** The window, in seconds. One number, shared with the server. */
const WINDOW = COMBAT.engagementSeconds;

/**
 * How long a missile is in the air.
 *
 * Short enough that the eye follows one shot from launch to impact without losing
 * it, long enough that the streak behind it reads as a trail rather than as a
 * flash. The spread is what stops a volley arriving as a chord.
 */
const FLIGHT_MIN = 0.7;
const FLIGHT_MAX = 1.05;

/**
 * How long the burst on the surface lasts, and fades.
 *
 * RAISED FROM 0.55 AFTER LOOKING AT IT. Half a second is long enough to see if you
 * already know where to look and nowhere near long enough to FIND — photographed
 * across a whole engagement, a burst was caught in about one frame in three, and
 * the volley read as rounds that flew at a world and quietly stopped existing. The
 * impact is the payoff of the whole ten seconds; it can afford to be seen.
 *
 * The launch window shortens to pay for it (`LAST_LAUNCH`), so the last fire is
 * still out before the battle resolves.
 */
export const BLAST_SECONDS = 0.9;

/**
 * The last second at which anything may be launched.
 *
 * Derived rather than chosen: every missile must have landed AND finished burning
 * before the battle resolves, or the cinematic outlives the state it is drawing
 * and the last thing on screen is an explosion on a world whose report has already
 * been filed.
 */
const LAST_LAUNCH = WINDOW - FLIGHT_MAX - BLAST_SECONDS;

/**
 * Rounds one drawn model fires.
 *
 * THREE TO SIX, RAISED FROM ONE TO THREE. Owner decision: "roketlerin sıklığı
 * artsın, biraz daha bombardıman görmek istiyorum". At one-to-three a two-model
 * squadron fired four rounds across ten seconds — one every two and a half
 * seconds, which is a world being pecked at rather than bombarded, and the ten
 * seconds a player waited forty minutes for read as mostly empty sky.
 *
 * The floor matters more than the ceiling. `SHOTS_MIN` is what a SMALL squadron
 * fires, and a small squadron is what most raids in this game actually are — a
 * minimum of one meant the commonest raid in the galaxy could fire twice in total.
 */
const SHOTS_MIN = 4;
const SHOTS_MAX = 8;

/**
 * The fewest rounds a raid fires, whatever size it is.
 *
 * WITHOUT A FLOOR THE SMALL RAID — which is most raids — GETS NO CINEMATIC. Rounds
 * are per drawn model, and a squadron of eight ships is one or two models, so a
 * per-model figure alone leaves the commonest engagement in the game firing every
 * second and a half into a silent sky. The floor is what makes "a raid is landing"
 * look the same whoever sent it.
 *
 * It is theatre and it is allowed to be: the PIPS above the hulls are what state
 * the real strength, and they are unchanged. Eighteen rounds over eight seconds is
 * a little over two a second, which for a warship is not a remarkable rate of fire.
 */
const MIN_ROUNDS = 18;

/**
 * And the most, however big the raid is.
 *
 * Past this the sky is saturated — nothing reads as denser, and the rounds start
 * launching close enough together to arrive as a chord rather than as fire, which
 * is the exact thing the slicing exists to prevent. A twelve-model formation would
 * otherwise schedule ninety-odd rounds into eight seconds.
 *
 * Applied as a SHARE PER MODEL rather than as a trim of the finished list, so a big
 * formation still has every ship in it firing. Trimming dropped whole models.
 */
const MAX_ROUNDS = 40;

/**
 * How far off centre a shot may land, as a share of the world's radius.
 *
 * NOT THE CENTRE, and not the rim either. Every missile converging on one point
 * reads as a targeting laser rather than as a bombardment — that is the owner's
 * second rule — but a scatter that reached the silhouette's edge would put half
 * the impacts on the horizon where the burst is edge-on and barely visible. Two
 * thirds keeps every hit on the face the squadron is looking at.
 */
const SCATTER = 0.66;

/**
 * Missile size, as a SHARE OF THE SHIP THAT FIRED IT. The owner's band is a
 * quarter to a half.
 *
 * A share rather than a world size, because that is what the instruction actually
 * says and because the two numbers would otherwise drift apart silently: a missile
 * written as an absolute 0.44 next to a hull drawn at 0.225 is a warhead twice the
 * length of the ship carrying it, and it typechecks perfectly.
 *
 * Sat at the top of the band rather than the bottom. At a quarter of a hull a
 * round is a couple of pixels at the distance the disc is normally read from,
 * which is a moving speck rather than a missile.
 */
export const MISSILE_OF_SHIP = 0.46;

export interface Shot {
  /** Which drawn model in the formation fires it. */
  slot: number;
  /** Seconds after the fleet arrives. */
  launchAt: number;
  /** Seconds it spends in the air. */
  flight: number;
  /**
   * Where it is aimed, across the line to the world, in world units.
   *
   * A point NEAR the centre rather than on the surface: the impact itself is
   * where the shot's own path crosses the world, which is what puts the burst on
   * the face rather than on a flat disc through the middle.
   */
  aim: readonly [number, number];
}

/** When this shot goes off, and when the fire is out. */
export const impactAt = (shot: Shot): number => shot.launchAt + shot.flight;

/**
 * The whole volley, in firing order.
 *
 * EVERY SHOT GETS ITS OWN SLICE OF THE WINDOW, which is what makes "not all at
 * once" a guarantee rather than a hope. Random times drawn independently clump —
 * with a dozen shots over eight seconds, two landing inside a tenth of a second of
 * each other is the common case, not the rare one, and a volley that arrives in
 * two clumps reads as a stutter. Slicing the window and jittering INSIDE each
 * slice keeps the spacing while keeping the irregularity.
 *
 * The slices are then dealt out at random, so the firing order is mixed across the
 * formation rather than running model by model — otherwise the first ship empties
 * its rack before the second one starts, which reads as a queue.
 */
export function volleyFor(key: string, models: number, planetRadius: number): Shot[] {
  if (models <= 0 || planetRadius <= 0) return [];
  const rng = seededFrom('volley', key);

  /**
   * The ceiling, shared out. Never below one, so EVERY drawn model fires.
   *
   * Capping the finished list instead would have been simpler and drops a model
   * altogether at large formation sizes — a twelve-model raid where one ship sits
   * there doing nothing while the other eleven fire.
   */
  const perModel = Math.max(1, Math.floor(MAX_ROUNDS / models));

  /** Every shot the formation will fire, before any of them has a time. */
  const pending: { slot: number; aim: readonly [number, number]; flight: number }[] = [];
  for (let slot = 0; slot < models; slot++) {
    const shots = Math.min(
      perModel,
      SHOTS_MIN + Math.floor(rng() * (SHOTS_MAX - SHOTS_MIN + 1)),
    );
    for (let k = 0; k < shots; k++) {
      // Uniform over the DISC, not over the radius: `sqrt` is what stops every
      // shot bunching toward the middle, which is the thing being avoided.
      const spread = Math.sqrt(rng()) * planetRadius * SCATTER;
      const angle = rng() * Math.PI * 2;
      pending.push({
        slot,
        aim: [Math.cos(angle) * spread, Math.sin(angle) * spread],
        flight: FLIGHT_MIN + rng() * (FLIGHT_MAX - FLIGHT_MIN),
      });
    }
  }

  /**
   * Top up to the floor, dealt round-robin across the formation.
   *
   * Round-robin rather than piled onto one model: the extra rounds are there to
   * fill the sky, and a single ship firing all of them reads as one gun rather than
   * as a bombardment. Each borrows the aim and flight of the round it follows,
   * re-rolled, so nothing here needs a second copy of the scatter rule.
   */
  for (let i = 0; pending.length < MIN_ROUNDS; i++) {
    const spread = Math.sqrt(rng()) * planetRadius * SCATTER;
    const angle = rng() * Math.PI * 2;
    pending.push({
      slot: i % models,
      aim: [Math.cos(angle) * spread, Math.sin(angle) * spread],
      flight: FLIGHT_MIN + rng() * (FLIGHT_MAX - FLIGHT_MIN),
    });
  }

  // One slice each, dealt out at random — a Fisher-Yates over the slice indices.
  const slices = pending.map((_, i) => i);
  for (let i = slices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slices[i], slices[j]] = [slices[j]!, slices[i]!];
  }

  /**
   * THE WINDOW IS UNCHANGED; WHAT FILLS IT IS NOT. D52.
   *
   * The slicing stays exactly as it was, because it is what stops a volley
   * arriving in lumps: independent random times CLUMP — a dozen draws over eight
   * seconds puts two inside a tenth of a second of each other more often than not.
   * What changed is `SHOTS_MIN`/`SHOTS_MAX`, so there are three times as many
   * slices in the same window and the gaps close by arithmetic rather than by a
   * second scheduling rule.
   */
  const slice = LAST_LAUNCH / pending.length;
  return pending
    .map((shot, i) => ({
      ...shot,
      // Jittered inside its own slice, and never into the next one — which is what
      // holds the minimum separation the test asserts.
      launchAt: (slices[i]! + rng() * 0.72) * slice,
    }))
    .sort((a, b) => a.launchAt - b.launchAt);
}

/**
 * Where a shot is along its own flight, 0 to 1, or null when it is not in the air.
 *
 * Null rather than a clamp, deliberately: the caller has three states to draw and
 * "before" and "after" are not the same picture. A clamped number would leave a
 * missile parked on the surface for the rest of the engagement.
 */
export function shotProgress(shot: Shot, seconds: number): number | null {
  if (seconds < shot.launchAt) return null;
  const t = (seconds - shot.launchAt) / shot.flight;
  return t >= 1 ? null : t;
}

/**
 * How far through its burn a burst is, 0 to 1 — and null once it is out.
 *
 * LINEAR, AND SHAPED BY THE CALLER. It used to return a brightness with the
 * falloff already baked in, which was fine while a burst was two sprites fading
 * together. It is not two sprites any more: the flash, the fireball, the shock
 * ring and the sparks all run on different curves off this one clock, and a
 * pre-shaped number cannot be un-shaped. One clock, four curves.
 */
export function blastProgress(shot: Shot, seconds: number): number | null {
  const since = seconds - impactAt(shot);
  if (since < 0 || since >= BLAST_SECONDS) return null;
  return since / BLAST_SECONDS;
}

/** How many embers an impact throws. Ten reads as a spray; forty reads as fog. */
const EMBERS = 10;

/**
 * The directions an impact throws its embers, as unit vectors.
 *
 * FIXED PER ROUND, from the shot's own numbers. Re-rolled each frame the spray
 * would boil rather than fly outward, which is the classic tell of a particle
 * effect wired to the wrong clock.
 *
 * Spread over a sphere by the golden angle rather than by more random draws: it is
 * the same trick `slotOffset` uses for a formation, and for the same reason — a
 * handful of independent random directions clumps, and ten embers is few enough
 * that one clump is most of the effect.
 */
export function emberSpray(shot: Shot): [number, number, number][] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const lean = shot.launchAt * 7.3 + shot.flight * 11.7;
  const out: [number, number, number][] = [];
  for (let i = 0; i < EMBERS; i++) {
    // An even spiral over the sphere, tilted per shot so no two look alike.
    const y = 1 - (2 * (i + 0.5)) / EMBERS;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = i * golden + lean;
    out.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
  }
  return out;
}

/**
 * Where a shot actually lands: the point its own path crosses the world.
 *
 * The aim is a point NEAR the centre and therefore INSIDE the sphere, so the
 * missile would fly into the world and detonate somewhere in its core. The burst
 * belongs on the surface, so this solves the ray against the sphere and returns
 * the near crossing.
 *
 * Everything here is in the squadron's own frame: the craft is at `from`, the
 * world's centre is `distance` straight ahead down +Z, and `aim` is the offset
 * across that line. Falls back to the aim point if the geometry degenerates —
 * which it cannot while the aim is inside the sphere, but a NaN in a position
 * buffer takes the whole scene with it.
 */
export function impactPoint(
  from: readonly [number, number, number],
  aim: readonly [number, number],
  distance: number,
  radius: number,
): [number, number, number] {
  const target: [number, number, number] = [aim[0], aim[1], distance];
  const dir: [number, number, number] = [
    target[0] - from[0],
    target[1] - from[1],
    target[2] - from[2],
  ];
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len <= 0) return target;
  const unit = [dir[0] / len, dir[1] / len, dir[2] / len] as const;

  // Centre relative to the launch point.
  const oc = [from[0], from[1], from[2] - distance] as const;
  const b = oc[0] * unit[0] + oc[1] * unit[1] + oc[2] * unit[2];
  const c = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - radius * radius;
  const disc = b * b - c;
  if (disc <= 0) return target;

  const hit = -b - Math.sqrt(disc);
  if (!Number.isFinite(hit) || hit <= 0) return target;
  return [from[0] + unit[0] * hit, from[1] + unit[1] * hit, from[2] + unit[2] * hit];
}
