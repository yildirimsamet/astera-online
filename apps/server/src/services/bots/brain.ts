import { and, eq, gt, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import {
  BUILD,
  COMBAT_HULLS,
  HULLS,
  INSTRUMENT_IDS,
  SATELLITE_IDS,
  type BuildingId,
  type Fleet,
  type GroundHullId,
  type HullId,
  type InstrumentId,
  type MobileHullId,
  type ResearchProjectId,
  type Resources,
  type SatelliteId,
  buildingCost,
  distance,
  fleetValue,
  hashSeed,
  hullBuildable,
  mulberry32,
  piratePosition,
  plantCeiling,
  satelliteSlots,
  withinTierBand,
} from '@astera/rules';
import type { Db } from '../../db/client.js';
import { type Clock, minutesSince } from '../../clock.js';
import { battleReports, buildings, planets, players } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { buildUnits, collectWorks, installSatellite, raiseInstrument, upgradeBuilding } from '../build.js';
import { completeResearch } from '../research.js';
import { launchAttack } from '../mission.js';
import { launchProbe, rememberedWorlds } from '../intel.js';
import { launchHarvest, launchMining, loadMiningSnapshot, projectVisibleDebris } from '../mining.js';
import { launchPirateRaid } from '../pirateRaid.js';
import { asteroidId, discoveredAsteroidIndexes } from '../asteroidField.js';
import { loadPirateSnapshot, pirateId } from '../pirateField.js';
import { sensorHistoryForPlayer } from '../sensorHistory.js';
import { peakCoreLevels } from '../player.js';
import { researchLevels, techOf } from '../researchState.js';
import type { PlanetView } from '../planetView.js';
import { BOTS, personaNamed, type BotPersona } from './personas.js';

/**
 * WHAT ONE OF THEM DOES WHEN IT PICKS UP THE PHONE. D159.
 *
 * A turn is a SESSION, not an action. The balance simulator models a login as one
 * decision and `docs/balance.md` already records why that model is wrong — "a bot
 * takes one action per session, so a probe replaces a raid outright… the model
 * prices scouting as a lost session and the game does not". Copying it here would
 * reproduce the same distortion in a live galaxy: a commander who scouts would
 * never also build, and the disc would go quiet every time somebody looked.
 *
 * So a turn walks the same list a person walks — collect, defend, build, equip,
 * research, buy ships — and then commits at most ONE flight. Every step is
 * optional and every step is allowed to be refused: a `GameError` is the game
 * saying no, which is the ordinary answer to half of what a player tries, and it
 * must never end the turn. Anything that is NOT a `GameError` is a bug and is
 * logged as one.
 *
 * NOTHING HERE REACHES PAST A SERVICE. Every act is the function the phone calls,
 * with `expectedPlayerId` supplied, so a bot cannot bypass a bay, a queue depth, a
 * fuel bill, the bash limit or a lock ordering. If one of them could, that would be
 * a hole in the service and not a convenience here.
 */

export interface BotSeat {
  readonly accountId: string;
  readonly playerId: string;
  readonly planetId: string;
  readonly seasonId: string;
  readonly seasonSeed: number;
  readonly ordinal: number;
  /** The stored habit. `bot_profiles.persona` is the authority, never the ordinal. */
  readonly persona: string;
}

export interface BotTurnResult {
  /** What the turn actually managed to do, for the log and for a test to read. */
  readonly did: string[];
}

/** A refusal is a normal answer; anything else is this system's own bug. */
async function attempt(
  did: string[],
  label: string,
  log: FastifyBaseLogger,
  run: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await run();
    did.push(label);
    return true;
  } catch (err) {
    if (err instanceof GameError) return false;
    log.error({ err, label }, 'bot turn step failed');
    return false;
  }
}

export async function runBotTurn(
  db: Db,
  clock: Clock,
  seat: BotSeat,
  log: FastifyBaseLogger,
): Promise<BotTurnResult> {
  const persona = personaNamed(seat.persona);
  const did: string[] = [];
  const rng = mulberry32(hashSeed('astera:bots:turn', seat.playerId, clock.now().getTime()));

  // The tap. Also the cheapest complete picture of this world there is: every
  // mutation returns exactly what `GET /api/planet` would, built in-transaction.
  let view: PlanetView;
  try {
    const collected = await collectWorks(db, seat.planetId, clock, seat.playerId);
    const moved = collected.moved.alloy + collected.moved.crystal + collected.moved.deuterium;
    if (moved > 0) did.push('collect');
    view = collected.planet;
  } catch (err) {
    if (!(err instanceof GameError)) throw err;
    return { did };
  }

  await buyGroundDefence(db, clock, seat, persona, view, did, log);
  await raiseOneBuilding(db, clock, seat, persona, view, did, log);
  await buyOneInstrument(db, clock, seat, persona, view, did, log);
  await orderResearch(db, clock, seat, persona, view, did, log);
  await buyShips(db, clock, seat, persona, view, did, log, rng);
  await commitOneFlight(db, clock, seat, persona, view, did, log, rng);

  return { did };
}

/* ── the surface ────────────────────────────────────────────── */

/** Everything queued in one lane for one subject, so a gate reads the future too. */
const queuedCount = (view: PlanetView, queue: 'CONSTRUCTION' | 'YARD', subject: string): number =>
  view.queues[queue]
    .filter((order) => order.subject === subject)
    .reduce((sum, order) => sum + order.count, 0);

const affordable = (view: PlanetView, cost: { alloy: number; crystal: number; deuterium: number },
  reserve = 0): boolean =>
  view.planet.alloy - cost.alloy >= reserve
  && view.planet.crystal - cost.crystal >= 0
  && view.planet.deuterium - cost.deuterium >= 0;

/**
 * INSURANCE, BOUGHT FIRST AND NOT FROM WHAT IS LEFT OVER.
 *
 * Buildings compound and guns do not, so at the margin a building always looks
 * like the better purchase — which means defence bought last is defence never
 * bought. A galaxy of undefended worlds is not merely unrealistic here: it makes
 * every raid DECISIVE, and a raid whose outcome was never in doubt is the one
 * thing this feature must not fill the disc with.
 */
async function buyGroundDefence(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger,
): Promise<void> {
  const raidable = Math.max(0,
    (view.planet.alloy - view.planet.vaultProtected.alloy)
    + (view.planet.crystal - view.planet.vaultProtected.crystal));
  const shortfall = raidable * persona.defenceRatio - fleetValue(view.ground);
  if (shortfall <= 0) return;
  if (view.queues.YARD.length >= BUILD.queueDepth) return;

  const room = view.capacity.ground - view.capacity.groundUsed;
  if (room <= 0) return;

  for (const [hull, share] of Object.entries(persona.groundMix) as [GroundHullId, number][]) {
    const spec = HULLS[hull];
    if (view.buildings.SHIPYARD < spec.minShipyard) continue;
    const price = spec.alloy + spec.crystal;
    const want = Math.floor((shortfall * share) / Math.max(1, price));
    // Never more than half the store on one batch: a world that spends everything
    // on guns stops growing, and a world that stops growing stops being worth raiding.
    const n = Math.min(
      want, room,
      Math.floor((view.planet.alloy * 0.5) / Math.max(1, spec.alloy)),
      spec.crystal > 0 ? Math.floor((view.planet.crystal * 0.5) / spec.crystal) : Number.MAX_SAFE_INTEGER,
    );
    if (n < 1) continue;
    if (await attempt(did, `ground:${hull}`, log, () =>
      buildUnits(db, seat.planetId, hull, n, clock, seat.playerId))) return;
  }
}

/**
 * One building a turn, off the habit's own order, through every gate the screen has.
 *
 * The gates are read from the PROJECTED level rather than the built one, because a
 * queue is a commitment: a commander with a Core already ordered is a commander who
 * may order the Refinery that will sit under it.
 */
async function raiseOneBuilding(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger,
): Promise<void> {
  if (view.queues.CONSTRUCTION.length >= BUILD.queueDepth) return;
  const levelOf = (type: BuildingId): number =>
    view.buildings[type] + queuedCount(view, 'CONSTRUCTION', type);
  const core = levelOf('CORE');

  for (const type of persona.buildOrder) {
    const level = levelOf(type);
    /*
      WHERE THEY STOP. Owner decision: a middle ceiling.

      The Core is the ceiling over everything else, so capping it caps the world —
      no separate rule is needed for the Refinery, the Hangar or the orbit slots.
      Twelve tireless commanders with no ceiling would own the top of a ladder that
      exists for the people playing.
    */
    if (type === 'CORE' && level >= BOTS.coreCeiling) continue;
    if (type !== 'CORE' && level >= core) continue;
    if (type === 'DEUTERIUM_PLANT') {
      const rungLevel = view.research
        .find((project) => project.id === 'DEUTERIUM_SYNTHESIS')?.level ?? 0;
      if (level >= plantCeiling(rungLevel)) continue;
    }
    const cost = buildingCost(type, level);
    // Keep half an hour of alloy production back, so the world is never scraped
    // to zero the instant before somebody arrives.
    if (!affordable(view, cost, view.planet.alloyPerHour * 0.5)) continue;
    if (await attempt(did, `build:${type}`, log, () =>
      upgradeBuilding(db, seat.planetId, type, clock, seat.playerId))) return;
  }
}

/**
 * ONE WISHLIST ACROSS BOTH KINDS OF HARDWARE, walked until something lands.
 *
 * Walked rather than "first affordable, then give up", because the list is full of
 * GATES — the Uplink opens the Telescope and the Radar, the Core opens orbit slots
 * — and a habit that stopped at the first refusal would sit forever behind the one
 * it cannot pass while the money for the next one was in the bank.
 */
async function buyOneInstrument(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger,
): Promise<void> {
  if (view.queues.CONSTRUCTION.length >= BUILD.queueDepth) return;
  const reserve = view.planet.alloy * persona.militaryShare;

  for (const want of persona.wants) {
    if ((SATELLITE_IDS as readonly string[]).includes(want)) {
      const id = want as SatelliteId;
      if (view.orbit.includes(id)) continue;
      if (view.orbit.length >= satelliteSlots(view.buildings.CORE)) continue;
      const cost = (view.satelliteCosts as Partial<Record<SatelliteId, Resources>>)[id];
      if (!cost || !affordable(view, cost, reserve)) continue;
      if (await attempt(did, `satellite:${id}`, log, () =>
        installSatellite(db, seat.planetId, id, clock, seat.playerId))) return;
      continue;
    }
    const id = want as InstrumentId;
    if (!(INSTRUMENT_IDS as readonly string[]).includes(id)) continue;
    const cost = (view.instrumentCosts as Partial<Record<InstrumentId, Resources>>)[id];
    if (!cost || !affordable(view, cost, reserve)) continue;
    if (await attempt(did, `instrument:${id}`, log, () =>
      raiseInstrument(db, seat.planetId, id, clock, seat.playerId))) return;
  }
}

/**
 * The commander lane, and it is not optional decoration.
 *
 * Deuterium Synthesis is what lifts the Refinery ceiling, and the Refinery is the
 * fuel floor — a commander who never researches simply stops being able to launch
 * anything, which is the one failure mode this whole feature cannot have.
 */
async function orderResearch(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger,
): Promise<void> {
  if (view.researchQueue.length >= BUILD.queueDepth) return;
  const held = await researchLevels(db, seat.playerId);
  const queued = new Map<ResearchProjectId, number>();
  for (const order of view.researchQueue) {
    queued.set(order.projectId, Math.max(queued.get(order.projectId) ?? 0, order.level));
  }

  for (const want of persona.research) {
    const level = Math.max(held.get(want.project) ?? 0, queued.get(want.project) ?? 0);
    if (level >= want.level) continue;
    if (await attempt(did, `research:${want.project}`, log, () =>
      completeResearch(db, seat.planetId, want.project, clock, seat.playerId))) return;
  }
}

/**
 * The fleet, bought to the habit's shape rather than to the dearest thing affordable.
 *
 * The shares are a HABIT and are deliberately imperfect. A galaxy where every
 * commander fields the theoretically correct composition is exactly as wrong as one
 * where nobody does: if the answer is always the same, scouting buys nothing, and
 * the information layer is the game.
 */
async function buyShips(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  if (view.queues.YARD.length >= BUILD.queueDepth) return;

  const owned = fleetValue(view.fleet) + fleetValue(view.fleetAway);
  const room = view.capacity.hangar - view.capacity.hangarUsed;
  if (room <= 0) return;

  // A rock needs a craft, and this is the only thing that buys one.
  const prospectors = (view.fleet.PROSPECTOR ?? 0) + (view.fleetAway.PROSPECTOR ?? 0)
    + queuedCount(view, 'YARD', 'PROSPECTOR');
  if (prospectors < persona.prospectorTarget && view.buildings.SHIPYARD >= HULLS.PROSPECTOR.minShipyard) {
    if (await attempt(did, 'ship:PROSPECTOR', log, () =>
      buildUnits(db, seat.planetId, 'PROSPECTOR', 1, clock, seat.playerId))) return;
  }

  if (owned >= BOTS.fleetValueCeiling) return;

  const budget = view.planet.alloy * persona.militaryShare;
  const tech = await techOf(db, seat.playerId);
  const open = (Object.entries(persona.composition) as [MobileHullId, number][])
    .filter(([hull]) => hullBuildable(hull, view.buildings.SHIPYARD, tech))
    .sort((a, b) => b[1] - a[1]);
  const total = open.reduce((sum, [, share]) => sum + share, 0);
  if (total <= 0) return;

  // A little wobble, so twelve commanders with the same habit do not place twelve
  // identical orders in the same minute.
  const wobble = 0.75 + rng() * 0.5;
  for (const [hull, share] of open) {
    const spec = HULLS[hull];
    const spend = (budget * share * wobble) / total;
    const n = Math.min(
      Math.floor(spend / Math.max(1, spec.alloy)),
      room,
      spec.crystal > 0 ? Math.floor(view.planet.crystal / spec.crystal) : Number.MAX_SAFE_INTEGER,
      spec.deuterium > 0 ? Math.floor((view.planet.deuterium * 0.5) / spec.deuterium) : Number.MAX_SAFE_INTEGER,
    );
    if (n < 1) continue;
    if (await attempt(did, `ship:${hull}`, log, () =>
      buildUnits(db, seat.planetId, hull, n, clock, seat.playerId))) return;
  }
}

/* ── the one flight ─────────────────────────────────────────── */

export type Lane = 'probe' | 'mine' | 'harvest' | 'pirate' | 'attack';

/**
 * WHICH LANES THIS WORLD COULD ACTUALLY FLY THIS MINUTE.
 *
 * A turn commits at most one flight, so a lane that cannot possibly succeed must
 * not be in the draw — it does not fail loudly, it silently spends the turn's only
 * flight on nothing. `fleetValue > 0` was the first version of this test and it is
 * wrong in exactly the place it matters most: a young world owns a Prospector and
 * no warships, the miner carries value, so the raid and pirate lanes opened,
 * `raidingWing` returned an empty manifest, and the commanders whose worlds most
 * needed to look busy were the ones standing still.
 *
 * The question a raid asks is the one `launchAttack` asks — is there a COMBAT hull
 * on the pad — so it is asked with the same list.
 */
export function openLanes(view: PlanetView): Lane[] {
  const open: Lane[] = ['probe'];
  if ((view.fleet.PROSPECTOR ?? 0) > 0) open.push('mine', 'harvest');
  if (COMBAT_HULLS.some((hull) => (view.fleet[hull] ?? 0) > 0)) open.push('pirate', 'attack');
  return open;
}

/** Draw one lane from the habit's weights, over the lanes that are actually open. */
export function drawLane(persona: BotPersona, open: readonly Lane[], rng: () => number): Lane | null {
  const weighted: [Lane | null, number][] = [
    ...open.map((lane): [Lane, number] => [lane, persona.flight[lane]]),
    [null, persona.flight.idle],
  ];
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const [lane, weight] of weighted) {
    /*
      A WEIGHT OF ZERO MEANS NEVER, AND THE COMPARISON HAS TO SAY SO. D166.

      This walked the table as `roll -= weight; if (roll <= 0)`. `mulberry32` can
      return exactly 0, which makes `roll` 0 — and the FIRST entry then satisfies
      `0 <= 0` whatever its weight is, so a persona configured never to raid could
      still launch one. Skipping the empty entries is clearer than tightening the
      comparison: an entry that can never be drawn does not belong in the walk.
    */
    if (weight <= 0) continue;
    roll -= weight;
    if (roll <= 0) return lane;
  }
  return null;
}

async function commitOneFlight(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  if (view.flight.used >= view.flight.total) return;

  const now = clock.now();
  const lane = drawLane(persona, openLanes(view), rng);
  if (!lane) return;

  switch (lane) {
    case 'probe': await sendProbe(db, clock, seat, view, did, log, rng); return;
    case 'mine': await sendMiner(db, clock, seat, view, now, did, log, rng); return;
    case 'harvest': await sendSalvage(db, clock, seat, view, now, did, log, rng); return;
    case 'pirate': await raidPirate(db, clock, seat, view, now, did, log); return;
    case 'attack': await sendRaid(db, clock, seat, view, did, log, rng); return;
  }
}

/** Worlds in this galaxy that are not this commander's, nearest first. Position is public. */
async function neighbourhood(db: Db, seat: BotSeat, view: PlanetView, limit = 24) {
  const rows = await db
    .select({
      id: planets.id,
      x: planets.x, y: planets.y, z: planets.z,
      playerId: planets.controllerPlayerId,
      joinedAt: players.joinedAt,
      protectedUntil: planets.protectedUntil,
      recoveryUntil: planets.recoveryUntil,
    })
    .from(planets)
    .innerJoin(players, eq(players.id, planets.controllerPlayerId))
    .where(and(
      eq(planets.seasonId, seat.seasonId),
      isNotNull(planets.controllerPlayerId),
      ne(planets.controllerPlayerId, seat.playerId),
    ));
  return rows
    .map((row) => ({ ...row, d: distance(view.planet.position, row) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);
}

/**
 * SCOUTING, AND IT IS THE LANE THAT MAKES THE REST HONEST.
 *
 * A raid needs a record (see `sendRaid`), and a record is what a probe brings home.
 * So the commander that has not looked at its neighbourhood spends its flight
 * looking — which is both the rule the fog imposes and, not by coincidence, exactly
 * the traffic an empty-looking disc was missing.
 */
async function sendProbe(
  db: Db, clock: Clock, seat: BotSeat, view: PlanetView,
  did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  const known = await rememberedWorlds(db, seat.playerId);
  const cutoff = clock.now().getTime() - BOTS.recordFreshMinutes * 60_000;
  const candidates = (await neighbourhood(db, seat, view))
    .filter((world) => (known.get(world.id)?.seenAt.getTime() ?? 0) < cutoff);
  if (candidates.length === 0) return;

  // Near, but not always the nearest: twelve commanders all probing their closest
  // neighbour every evening is a pattern somebody would notice.
  const pick = candidates[Math.floor(rng() * Math.min(candidates.length, 8))];
  if (!pick) return;
  await attempt(did, 'probe', log, () =>
    launchProbe(db, seat.planetId, pick.id, clock, seat.playerId));
}

/**
 * THE RAID, AND EVERY BRAKE ON IT LIVES HERE RATHER THAN IN THE RULES.
 *
 * D127 removed the invisible development band and left `bashLimit` alone, which is
 * the right rule for people: a player who punches down can be scouted, answered and
 * out-thought. It is the wrong behaviour for a commander nobody can argue with, so
 * the band comes back as MANNERS — a bot's own restraint, changing no rule and
 * applying to nobody else.
 *
 * And the fog applies to them too. These commanders read the database, so nothing
 * in the schema stops one picking the richest undefended world in the galaxy every
 * evening. This does: a raid needs a world record, no older than
 * `BOTS.recordFreshMinutes`, exactly as D151 defines one. No record, no raid.
 */
export interface RaidCandidate {
  readonly planetId: string;
  readonly distance: number;
  /** How much more this world is worth as a target than a stranger's. */
  readonly weight: number;
}

/**
 * WHICH WORLDS THIS COMMANDER MAY RAID — the whole of the restraint, in one place.
 *
 * Exported because it is the rule, not an implementation detail: what a bot is
 * allowed to attack is the part of this feature a person could be hurt by, and a
 * rule that matters is a rule with a test pointed straight at it.
 */
export async function raidCandidates(
  db: Db, now: Date, seat: BotSeat, view: PlanetView,
): Promise<RaidCandidate[]> {
  const known = await rememberedWorlds(db, seat.playerId);
  const cutoff = now.getTime() - BOTS.recordFreshMinutes * 60_000;
  const botPlayers = await botPlayerIds(db, seat.seasonId);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);

  const near = await neighbourhood(db, seat, view);
  /**
   * TWO TABLE READS FOR THE WHOLE NEIGHBOURHOOD, NOT TWO PER WORLD. D166.
   *
   * The Core level and the day's raid count used to be fetched inside the loop, so
   * a bot with twenty-four neighbours in reach spent up to forty-eight sequential
   * round trips choosing one target — on the worker that also has to land every
   * raid in the galaxy on time, once per bot, several bots per sweep.
   *
   * Both are the same question asked of a known id list, which is one query each.
   * The loop below reads maps and the restraint rules are untouched.
   */
  const peopleWorlds = near.filter((world) => !(world.playerId !== null && botPlayers.has(world.playerId)));
  /*
    THE BAND APPLIES TO THEM TOO, AND IT IS A RULE RATHER THAN MANNERS. D168.

    Every launch is gated on `withinTierBand` over the two COMMANDERS' peak Core,
    so a candidate outside it is not a raid a bot gets away with — it is a turn
    spent on a refusal, once per sweep, by the commanders whose entire purpose is
    to put traffic on the disc. It is asked of every neighbour including other
    bots, because the gate does not care which of the two is a person.

    One query for the whole neighbourhood, the same shape as the two below it.
  */
  const peaks = await peakCoreLevels(db, [
    seat.playerId,
    ...new Set(near.map((world) => world.playerId).filter((id): id is string => id !== null)),
  ]);
  const myPeak = peaks.get(seat.playerId) ?? 1;
  const coreOf = new Map<string, number>();
  const raidsOn = new Map<string, number>();
  if (peopleWorlds.length > 0) {
    const [cores, hits] = await Promise.all([
      db
        .select({ planetId: buildings.planetId, level: buildings.level })
        .from(buildings)
        .where(and(
          inArray(buildings.planetId, peopleWorlds.map((world) => world.id)),
          eq(buildings.type, 'CORE'),
        )),
      db
        .select({
          defenderPlayerId: battleReports.defenderPlayerId,
          n: sql<number>`count(*)::int`,
        })
        .from(battleReports)
        .where(and(
          eq(battleReports.attackerPlayerId, seat.playerId),
          gt(battleReports.createdAt, dayAgo),
        ))
        .groupBy(battleReports.defenderPlayerId),
    ]);
    for (const row of cores) coreOf.set(row.planetId, row.level);
    for (const row of hits) {
      if (row.defenderPlayerId !== null) raidsOn.set(row.defenderPlayerId, row.n);
    }
  }

  const candidates: RaidCandidate[] = [];
  for (const world of near) {
    /*
      A RAID NEEDS A RECORD, AND THAT IS THE FOG APPLYING TO THE SERVER'S OWN
      COMMANDERS.

      These read the database, so nothing in the schema stops one picking the
      richest undefended world in the galaxy every evening. This does: the world has
      to be one this commander has actually had eyes on (D151), no older than
      `BOTS.recordFreshMinutes`. With no record the turn spends itself on a PROBE
      instead — which is the honest rule and, not by coincidence, exactly the
      traffic an empty-looking disc was missing.
    */
    if ((known.get(world.id)?.seenAt.getTime() ?? 0) < cutoff) continue;
    if (world.protectedUntil && world.protectedUntil > now) continue;
    if (world.recoveryUntil && world.recoveryUntil > now) continue;
    if (world.playerId !== null && !withinTierBand(myPeak, peaks.get(world.playerId) ?? 1)) continue;

    const isBot = world.playerId !== null && botPlayers.has(world.playerId);
    if (!isBot) {
      /*
        MANNERS TOWARDS PEOPLE, HELD HERE RATHER THAN IN THE RULES.

        D127 removed the invisible development band and left `bashLimit` alone,
        which is the right rule for players: somebody who punches down can be
        scouted, answered and out-thought. It is the wrong behaviour for a commander
        nobody can argue with — so the band comes back as a bot's own restraint,
        changing no rule and applying to nobody else.
      */
      if (now.getTime() - world.joinedAt.getTime() < BOTS.newPlayerGraceHours * 60 * 60_000) continue;
      // A world with no CORE row has never been built on: treat it as level 1, the
      // same answer the per-world query gave.
      if ((coreOf.get(world.id) ?? 1) < view.buildings.CORE - BOTS.playerCoreFloorGap) continue;
      if ((raidsOn.get(world.playerId!) ?? 0) >= BOTS.playerRaidsPerDay) continue;
    }
    candidates.push({
      planetId: world.id,
      distance: world.d,
      weight: isBot ? BOTS.botTargetBias : 1,
    });
  }
  return candidates;
}

/** Commit most of the line and keep a garrison; a world stripped bare is worth nothing. */
export function raidingWing(fleet: Fleet, share: number): Fleet {
  const send: Fleet = {};
  for (const [hull, count] of Object.entries(fleet) as [HullId, number][]) {
    if (count <= 0 || HULLS[hull].ground || hull === 'PROSPECTOR') continue;
    const n = Math.floor(count * share);
    if (n > 0) send[hull] = n;
  }
  return send;
}

async function sendRaid(
  db: Db, clock: Clock, seat: BotSeat,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  const candidates = await raidCandidates(db, clock.now(), seat, view);
  if (candidates.length === 0) return;

  /*
    THE SAME WALK, AND THE SAME ZERO RULE. D166 — see `drawLane`. A candidate worth
    nothing is not a candidate, so it is filtered before the draw rather than being
    reachable on an `rng()` of exactly 0.
  */
  const drawable = candidates.filter((world) => world.weight > 0);
  if (drawable.length === 0) return;
  const total = drawable.reduce((sum, world) => sum + world.weight, 0);
  let roll = rng() * total;
  const pick = drawable.find((world) => (roll -= world.weight) <= 0) ?? drawable[0];
  if (!pick) return;

  const send = raidingWing(view.fleet, 0.6 + rng() * 0.3);
  if (Object.keys(send).length === 0) return;
  await attempt(did, 'attack', log, () =>
    launchAttack(db, seat.planetId, pick.planetId, send, clock, seat.playerId));
}

/** Every commander in this galaxy the server is playing. */
async function botPlayerIds(db: Db, seasonId: string): Promise<Set<string>> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT p.id FROM players p
      JOIN bot_profiles b ON b.account_id = p.account_id
     WHERE p.season_id = ${seasonId}
  `);
  return new Set([...rows].map((row) => row.id));
}

/**
 * A ROCK, AND ONLY ONE THIS COMMANDER HAS ACTUALLY FOUND.
 *
 * `launchMining` takes the raw lane index or the opaque public id, and the two are
 * not equivalent: the index path skips the discovery gate and exists for trusted
 * tooling. The id path is the one a phone uses, so it is the one used here.
 */
async function sendMiner(
  db: Db, clock: Clock, seat: BotSeat, view: PlanetView, now: Date,
  did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  const snapshot = await loadMiningSnapshot(db, seat.seasonId, now);
  const epochs = await sensorHistoryForPlayer(db, seat.playerId);
  const discovered = discoveredAsteroidIndexes(snapshot, epochs, now);
  if (discovered.size === 0) return;

  const nowMinutes = minutesSince(snapshot.startsAt, now);
  const rocks = snapshot.asteroids
    .filter((rock) => discovered.has(rock.index))
    .filter((rock) => rock.appearsAt <= nowMinutes && rock.expiresAt > nowMinutes)
    .filter((rock) => rock.ore - (snapshot.oreTaken.get(rock.index) ?? 0) > 0);
  if (rocks.length === 0) return;

  const pick = rocks[Math.floor(rng() * rocks.length)];
  if (!pick) return;
  const craft = Math.min(view.fleet.PROSPECTOR ?? 0, 2);
  if (craft < 1) return;
  await attempt(did, 'mine', log, () =>
    launchMining(db, seat.planetId, asteroidId(snapshot.asteroidKey, pick.index), craft, clock, seat.playerId));
}

/** Wreckage is public at any range, so this lane needs no sight of its own. */
async function sendSalvage(
  db: Db, clock: Clock, seat: BotSeat, view: PlanetView, now: Date,
  did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  const fields = projectVisibleDebris(await loadMiningSnapshot(db, seat.seasonId, now), now)
    .map((field) => ({ ...field, d: distance(view.planet.position, field) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  if (fields.length === 0) return;

  const pick = fields[Math.floor(rng() * fields.length)];
  if (!pick) return;
  const craft = Math.min(view.fleet.PROSPECTOR ?? 0, 2);
  if (craft < 1) return;
  await attempt(did, 'harvest', log, () =>
    launchHarvest(db, seat.planetId, pick.id, craft, clock, seat.playerId));
}

/**
 * A PIRATE, OFFERED TO THE SERVICE AND JUDGED BY IT.
 *
 * Nothing here decides whether this commander can SEE the target: `launchPirateRaid`
 * refuses `PIRATE_OUT_OF_SIGHT` off `pirateZone`, which is the one statement of that
 * rule (D150/D158). Position is used only to order the attempts — asking about the
 * nearest three rather than a random three — and ordering an attempt reveals nothing
 * a refusal would not.
 */
async function raidPirate(
  db: Db, clock: Clock, seat: BotSeat, view: PlanetView, now: Date,
  did: string[], log: FastifyBaseLogger,
): Promise<void> {
  const snapshot = await loadPirateSnapshot(db, seat.seasonId, now);
  const standing = snapshot.standing(now);
  if (standing.length === 0) return;
  const nowMinutes = minutesSince(snapshot.startsAt, now);

  const send: Fleet = {};
  for (const [hull, count] of Object.entries(view.fleet) as [HullId, number][]) {
    if (count <= 0 || HULLS[hull].ground || hull === 'PROSPECTOR') continue;
    const n = Math.floor(count * 0.7);
    if (n > 0) send[hull] = n;
  }
  if (Object.keys(send).length === 0) return;

  const nearest = standing
    .map((spec) => ({ spec, d: distance(view.planet.position, piratePosition(spec, nowMinutes)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);

  for (const { spec } of nearest) {
    if (await attempt(did, 'pirate', log, () =>
      launchPirateRaid(db, seat.planetId, pirateId(snapshot.key, spec.index), send, clock, seat.playerId))) {
      return;
    }
  }
}
