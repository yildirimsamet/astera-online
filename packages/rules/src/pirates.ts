import { PIRATE, SEASON } from './constants.js';
import { COMBAT_HULLS, HULLS, MOBILE_HULLS, fleetEntries, fleetValue } from './hulls.js';
import { orbitDiscoveredAt, orbitRadius } from './galaxy.js';
import { orbitPosition } from './galaxy.js';
import type { OrbitElements, SensorEpoch } from './galaxy.js';
import { sensorZone, type SensorSphere, type SensorZone } from './sight.js';
import type { Fleet, Grade, HullId, MobileHullId, Resources, Rng, Vec3 } from './types.js';

/**
 * KORSAN FİLOLARI — THE THIRD THING IN THE GALAXY WORTH FLYING AT. D150.
 *
 * The disc has known two kinds of target: another commander, and a neutral world
 * that never moves. Both are addresses. A pirate is neither — it is a fleet on a
 * closed orbit with a readable level, a known price and a deadline, and it is the
 * first target in the game whose whole value is that it will not be there later.
 *
 * WHAT IT ADDS THAT NOTHING ELSE DOES. A fleet has exactly one way to grow today:
 * wait for the economy and buy hulls. A DECISIVE win against a pirate can hand
 * over one of its own ships. That is a second door into the shipyard, and it is
 * the only place in the game where a risk pays in FLEET rather than in ore.
 *
 * A PIRATE IS A PURE FUNCTION OF THE SEASON KEY — its orbit, its roster, its
 * hoard and its life are all derived and none of them is stored. The database
 * holds only what cannot be derived: what has been shot off it, and whether it is
 * gone (`pirate_state`). Same philosophy as `asteroid_claims`, same reason (A5).
 *
 * AND LIKE A ROCK, IT IS REMEMBERED. D158 — owner instruction, reversing D150.
 *
 * This lane shipped with the opposite rule, written into three files as a refusal:
 * a pirate was a craft, so leaving your circles ended its existence for you, and
 * copying the rock lane's discovery memory was called the most likely way to punch
 * a hole in D123. The owner has decided the other way, and the reason is D124's:
 * an opportunity nobody can hold on to is not a decision. A raid takes minutes to
 * assemble and the target is on a closed orbit that carries it out of sight while
 * the commander is still choosing hulls — an offer withdrawn mid-sentence.
 *
 * AND SINCE D160 MEMORY BUYS THE MANIFEST TOO. D158 floored a discovered pirate at
 * `CONTACT` — the mark without the crew — and the owner has ruled the rest of the
 * way: a pirate you have identified stays identified, exactly as a rock you have
 * found stays a rock with a yield on it. It is safe because `sensor_epochs.reach`
 * is the TELESCOPE radius alone, so "discovered" already means "was inside an
 * identifying circle": the reading was paid for. "Radar detects, Telescope
 * identifies" is intact — a pirate no telescope ever held is still a question mark
 * at every range — and `remembered` says only that no circle covers it right now,
 * which is what the disc draws faded. The figures stay CURRENT, on the rock lane's
 * own terms: another commander wearing this pirate down is visible to everyone who
 * has found it, the same way a rock's remaining ore is.
 *
 * IT IS THE ROCK'S MECHANISM, NOT A SECOND ONE: the same `sensor_epochs` rows and
 * the same analytic orbit/sphere solve (`orbitDiscoveredAt`), so the two lanes
 * cannot drift apart.
 */

export type PirateLevel = 1 | 2 | 3 | 4;

export const PIRATE_LEVELS: readonly PirateLevel[] = [1, 2, 3, 4];

export interface PirateSpec extends OrbitElements {
  /** Stable position in the season's lane. SERVER-ONLY — never leaves an API. */
  index: number;
  level: PirateLevel;
  /** The ships it entered with. Living crew is this minus persisted losses. */
  roster: Fleet;
  /** What it is carrying, and therefore what a winner may load. */
  hoard: Resources;
  /** Minutes since season start. */
  appearsAt: number;
  /** Minutes since season start. It is gone after this. */
  expiresAt: number;
}

/** Everything that flies, at or below this level. Ground guns and drills cannot. */
function poolFor(level: PirateLevel): readonly MobileHullId[] {
  /*
    `?? Infinity` IS LOAD-BEARING. `Hull.tier` is null on BASTION, THORN and
    PROSPECTOR — the catalogue explicitly kept outside Fleet V2 progression. A
    bare `tier <= level` is a type error against null and would have been `true`
    at runtime, which is how a ground emplacement ends up in a fleet that flies.
  */
  return MOBILE_HULLS.filter((id) => (HULLS[id].tier ?? Infinity) <= level);
}

/** The hulls that both fight and belong to this exact level. */
function spineFor(level: PirateLevel): readonly MobileHullId[] {
  return COMBAT_HULLS.filter((id) => HULLS[id].tier === level);
}

const pick = <T,>(from: readonly T[], rng: Rng): T => from[Math.floor(rng() * from.length)]!;

/**
 * WHAT ONE PIRATE FLIES.
 *
 * ONE GUARANTEED COMBAT HULL AT ITS OWN LEVEL, and the feature dies without it.
 * Drawn freely from everything at or below the level, a roster can legally come
 * out as two Couriers — zero attack, zero counter-play — and "raiding a level 4
 * pirate" becomes a delivery rather than a fight. The spine is what makes a level
 * badge mean something a player can price before committing a fleet.
 *
 * THE REST IS FREE, INCLUDING TRANSPORTS. A Support hull in the roster is not
 * filler: it flies behind the line under `combat.ts`'s escort rule, so it is
 * still there to be captured when the guns are gone — and a captured Atlas is one
 * of the better things this feature can hand somebody.
 */
export function pirateRoster(level: PirateLevel, rng: Rng): Fleet {
  const pool = poolFor(level);
  const spine = spineFor(level);
  const size = PIRATE.sizeMin + Math.floor(rng() * (PIRATE.sizeMax - PIRATE.sizeMin + 1));

  const roster: Fleet = {};
  const add = (id: HullId): void => {
    roster[id] = (roster[id] ?? 0) + 1;
  };

  add(pick(spine, rng));
  for (let slot = 1; slot < size; slot++) add(pick(pool, rng));
  return roster;
}

/**
 * WHAT IT IS CARRYING. Priced off its own hulls, never off a player's stock.
 *
 * Pricing the prize against the escort is what makes the reward legible before
 * launch: the roster is what a Telescope identifies, so a commander who can SEE
 * the pirate can already estimate what beating it is worth. A hoard drawn from
 * some hidden table would be a number only the server knows, which is exactly the
 * kind of rule D124 refuses.
 *
 * DEUTERIUM IS THE SMALLEST SHARE ON PURPOSE. It is also fuel, so paying raids in
 * it would quietly make the next raid free, and the launch decision is supposed to
 * cost something every time.
 */
export function pirateHoard(roster: Fleet): Resources {
  const worth = fleetValue(roster) * PIRATE.hoardValueMult;
  return {
    alloy: Math.floor(worth * PIRATE.hoardShare.alloy),
    crystal: Math.floor(worth * PIRATE.hoardShare.crystal),
    deuterium: Math.floor(worth * PIRATE.hoardShare.deuterium),
  };
}

/**
 * THE ONE PLACE A PIRATE LEVEL BECOMES A COMBAT NUMBER.
 *
 * Returned as a side modifier rather than applied here, because the modifier's
 * whole safety argument is that it passes through `CombatSide` and is therefore
 * honoured in the damage pool and the casualty arithmetic by the same code path.
 */
export const pirateStats = (level: PirateLevel): { damageMult: number } => ({
  damageMult: PIRATE.damageMult[level],
});

/**
 * DOES A SHIP COME HOME WITH YOU?
 *
 * DECISIVE ONLY. Anything less means survivors flew away, and they took their
 * ships with them — there is nothing on the field to take. The odds run inverse
 * to the damage table, so the pirate that is cheapest to beat carries the ship
 * worth least, and the level 4 prize stays a story rather than a routine.
 *
 * DRAWN FROM THE CREW THIS RAID MET, weighted by how many of each were standing,
 * so a wing of four Darts around one Cataclysm usually yields a Dart. On a
 * DECISIVE win that crew is exactly what the attacker destroyed — the ship towed
 * home is one they shot down, and never one an earlier commander had already
 * taken off the board.
 */
export function pirateCapture(
  level: PirateLevel,
  /**
   * THE CREW THAT WAS STANDING WHEN THE SHOOTING STARTED — not the launch roster.
   *
   * A pirate can be worn down by several commanders before anyone finishes it, and
   * reading `spec.roster` let the raid that landed the last blow tow home a hull
   * that somebody else had destroyed hours earlier — weighted by its ORIGINAL
   * count, so the Cataclysm a level 4 pirate is hunted for could be won by whoever
   * happened to clean up its last Dart. You take what you shot down.
   */
  crew: Fleet,
  grade: Grade,
  rng: Rng,
): HullId | null {
  if (grade !== 'DECISIVE') return null;
  if (rng() >= PIRATE.captureChance[level]) return null;

  const entries = fleetEntries(crew);
  let total = 0;
  for (const [, count] of entries) total += count;
  if (total <= 0) return null;

  let ticket = rng() * total;
  for (const [id, count] of entries) {
    ticket -= count;
    if (ticket < 0) return id;
  }
  return entries[entries.length - 1]?.[0] ?? null;
}

/** Where this pirate is at this instant. The shared orbit trig, nothing added. */
export const piratePosition = (spec: PirateSpec, minutes: number): Vec3 =>
  orbitPosition(spec, minutes);

/** Is this pirate in the disc at this instant? */
/**
 * HAS THIS COMMANDER EVER HAD THIS PIRATE INSIDE ONE OF THEIR POSTS? D158.
 *
 * The rock lane's question, asked about a pirate, through the rock lane's own
 * solve — a pirate is an orbiting body with a life, which is the entire input
 * `orbitDiscoveredAt` needs. Discovery is a fact about the PAST: the orbit flying
 * on, the post being upgraded and the world being lost all leave it standing.
 */
export const pirateDiscoveredAt = (
  spec: PirateSpec,
  epochs: readonly SensorEpoch[],
  nowMinutes: number,
): number | null => orbitDiscoveredAt(spec, epochs, nowMinutes);

/**
 * HAS THIS COMMANDER FOUND THIS PIRATE — asked at the last instant it existed.
 *
 * `orbitDiscoveredAt` answers null once `nowMinutes` reaches `expiresAt`, which is
 * right for a rock nobody is flying at and wrong for a pirate somebody is: a raid
 * already in the air must not lose its target on the boundary. The clamp used to
 * live in `discoveredPirateIndexes` alone, so the disc and the launch gate could
 * disagree by one instant. One question, asked one way, by both.
 */
export const pirateDiscovered = (
  spec: PirateSpec,
  epochs: readonly SensorEpoch[],
  nowMinutes: number,
): boolean =>
  pirateDiscoveredAt(spec, epochs, Math.min(nowMinutes, spec.expiresAt - 1e-9)) !== null;

/**
 * THE MEMORY FLOOR ITSELF, STATED ONCE. D160.
 *
 * `sight.ts` is the only statement of the three zones and this never contradicts
 * it — it sits on top, raising an answer for a pirate this commander has already
 * identified. It is exported as a function of the two inputs rather than only
 * being reachable through `pirateZone` because `projectGalaxyTraffic` arrives with
 * the whole lane's discovery answer already computed as a set: re-solving per
 * pirate would be the same work twice, and writing `discovered ? … : live` inline
 * there would be a SECOND opinion about zones, which is exactly what this project
 * forbids.
 */
export const pirateSightZone = (live: SensorZone, discovered: boolean): SensorZone =>
  discovered ? 'IDENTIFIED' : live;

/**
 * WHAT A COMMANDER IS ENTITLED TO SEE OF ONE PIRATE, RIGHT NOW. D158 · D160.
 *
 * `sensorZone` is still the only statement of the three zones and is read first.
 * Discovery is a FLOOR under its answer, and only for a pirate:
 *
 *   · once discovered → `IDENTIFIED`, wherever it is now;
 *   · never discovered → exactly what the circles give, `NONE` included.
 *
 * THE FLOOR IS `IDENTIFIED` AND NOT `CONTACT`, WHICH IS D160. D158 shipped the
 * lower floor to protect "Radar detects, Telescope identifies", and the protection
 * was unnecessary: `sensor_epochs.reach` is the TELESCOPE radius alone
 * (`refreshSensorEpoch`), so a discovered pirate is by definition one this
 * commander has already had inside an identifying circle. The manifest was bought.
 * Handing it back is memory; withholding it was amnesia — and it cost the lane the
 * thing D124 asks for, a target a commander can still act on while they assemble
 * the fleet to act with. A rock behaves exactly this way and always has.
 *
 * A RADAR-ONLY PIRATE IS UNTOUCHED. No epoch ever contained it, so the floor is
 * absent and it stays the moving question mark at every range.
 *
 * WHAT THIS DOES NOT ANSWER IS WHETHER A CIRCLE IS COVERING IT. Callers publish
 * `sensorZone(spheres, at) === 'NONE'` alongside it as `remembered`, and the disc
 * draws such a craft faded. That mark means "you cannot see this", NOT "this is
 * stale": the orbit is a solved function of time and the crew is the lane's current
 * state, exactly as a discovered rock keeps serving its live `oreRemaining` to a
 * commander with no eyes on it (D143). The faintness is about sight, not about age.
 *
 * `at` IS PASSED RATHER THAN DERIVED because the published point is not always the
 * orbit's: a pirate under attack holds at the rendezvous for the length of the
 * engagement (G6), and the zone has to be answered about the point actually drawn.
 */
export function pirateZone(
  spheres: readonly SensorSphere[],
  spec: PirateSpec,
  at: Vec3,
  epochs: readonly SensorEpoch[],
  nowMinutes: number,
): SensorZone {
  return pirateSightZone(
    sensorZone(spheres, at),
    pirateDiscovered(spec, epochs, nowMinutes),
  );
}

export const pirateActive = (spec: PirateSpec, minutes: number): boolean =>
  minutes >= spec.appearsAt && minutes < spec.expiresAt;

/** Every pirate riding the disc right now, in stable index order. */
export const activePirates = (
  pirates: readonly PirateSpec[],
  minutes: number,
): PirateSpec[] => pirates.filter((spec) => pirateActive(spec, minutes));

function rollLevel(roll: number): PirateLevel {
  let acc = 0;
  for (const level of PIRATE_LEVELS) {
    acc += PIRATE.levelWeights[level] ?? 0;
    if (roll < acc) return level;
  }
  return 1;
}

/**
 * THE SEASON'S WHOLE PIRATE LANE, generated once from the season key.
 *
 * ADDITIVE-LANE DISCIPLINE APPLIES HERE THE DAY THE RATE MOVES, and the reason is
 * written out over `generateAsteroidSchedule`: raising density by squeezing the
 * interval moves EVERY live target and makes a player's chosen quarry jump or
 * vanish between two reads. A pirate is worse than a rock in that respect,
 * because a fleet may already be in the air toward the point it used to be at.
 * A future rate change appends a second seed-shifted lane with fresh indices, or
 * it waits for `MULTI_WORLD.pirateRulesetVersion` and a season boundary.
 *
 * THE ROLL ORDER IS PART OF THE CONTRACT. Every draw below is taken in a fixed
 * sequence from one generator, so inserting a new property in the middle re-rolls
 * every pirate after it. Append.
 */
export function generatePirateSchedule(
  rng: Rng,
  span: number = SEASON.days * 24 * 60,
  indexOffset = 0,
  appearsAtOffset = 0,
): PirateSpec[] {
  const count = Math.round((PIRATE.spawnPerHour * span) / 60);
  const pirates: PirateSpec[] = [];
  if (count <= 0) return pirates;

  const interval = span / count;
  for (let laneIndex = 0; laneIndex < count; laneIndex++) {
    const radius = orbitRadius(rng(), PIRATE.orbitMin, PIRATE.orbitMax);
    const speed = PIRATE.speedMin + rng() * (PIRATE.speedMax - PIRATE.speedMin);
    const level = rollLevel(rng());
    const appearsAt = appearsAtOffset + laneIndex * interval + rng() * interval;
    const life =
      (PIRATE.lifeHoursMin + rng() * (PIRATE.lifeHoursMax - PIRATE.lifeHoursMin)) * 60;
    const phase = rng() * Math.PI * 2;
    // Uniform cos(inclination) keeps the orbit normals isotropic; choosing the
    // angle itself uniformly would crowd every orbital plane around the poles.
    const inclination = Math.acos(rng() * 2 - 1);
    const ascendingNode = rng() * Math.PI * 2;
    const roster = pirateRoster(level, rng);

    pirates.push({
      index: indexOffset + laneIndex,
      level,
      roster,
      hoard: pirateHoard(roster),
      radius,
      period: (2 * Math.PI * radius) / speed,
      phase,
      inclination,
      ascendingNode,
      speed,
      appearsAt,
      expiresAt: appearsAt + life,
    });
  }

  return pirates;
}
