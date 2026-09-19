import { and, eq, gt, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import {
  BUILD,
  COMBAT_HULLS,
  HULLS,
  INSTRUMENT_IDS,
  SATELLITE_IDS,
  type BuildingId,
  type GroundHullId,
  type InstrumentId,
  type MobileHullId,
  type ResearchProjectId,
  type Resources,
  type SatelliteId,
  buildingCost,
  distance,
  fleetValue,
  hangarCeiling,
  hangarLoad,
  hashSeed,
  hullBuildable,
  hullBulk,
  mulberry32,
  piratePosition,
  pirateHoard,
  pirateStats,
  shieldHp,
  plantCeiling,
  satelliteSlots,
  withinTierBand,
} from '@astera/rules';
import type { Db } from '../../db/client.js';
import { type Clock, minutesSince } from '../../clock.js';
import {
  battleReports, buildings, missions, planets, players, probeReports, probeWorldMemories, seasons,
} from '../../db/schema.js';
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
import { protectionFrom } from '../attackProtection.js';
import { peakCoreLevels } from '../player.js';
import { researchLevels, techOf } from '../researchState.js';
import type { PlanetView } from '../planetView.js';
import { BOTS, personaNamed, type BotPersona } from './personas.js';
import {
  isBully, planPirateRaid, planWorldRaid, type ForecastBudget, type WallReading,
} from './judgement.js';

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

/** The alloy a bot's buildings and instruments never spend. See `BOTS.stockReserveHours`. */
const storeReserve = (view: PlanetView): number => view.planet.alloyPerHour * BOTS.stockReserveHours;

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
    // The Hangar has its own gate on the same Core: rungs open at tier changes.
    if (type === 'HANGAR' ? level >= hangarCeiling(core) : type !== 'CORE' && level >= core) continue;
    if (type === 'DEUTERIUM_PLANT') {
      const rungLevel = view.research
        .find((project) => project.id === 'DEUTERIUM_SYNTHESIS')?.level ?? 0;
      if (level >= plantCeiling(rungLevel)) continue;
    }
    const cost = buildingCost(type, level);
    // Keep a store back, so the world is never scraped to zero the instant before
    // somebody arrives — and is worth somebody arriving at. `BOTS.stockReserveHours`.
    if (!affordable(view, cost, storeReserve(view))) continue;
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
  const reserve = Math.max(view.planet.alloy * persona.militaryShare, storeReserve(view));

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
  // The Hangar is the brake a player feels, so the bot sizes its order to the room
  // left after what is already in the yard rather than meeting the refusal.
  // Summed batch by batch: two orders of one hull are two orders, not one record.
  const queuedLoad = view.queues.YARD.reduce(
    (sum, order) => sum + hangarLoad({ [order.subject]: order.count }),
    0,
  );
  let room = view.capacity.hangar - view.capacity.hangarUsed - queuedLoad;

  // A rock needs a craft, and this is the only thing that buys one.
  const prospectors = (view.fleet.PROSPECTOR ?? 0) + (view.fleetAway.PROSPECTOR ?? 0)
    + queuedCount(view, 'YARD', 'PROSPECTOR');
  if (prospectors < persona.prospectorTarget && view.buildings.SHIPYARD >= HULLS.PROSPECTOR.minShipyard
    && room >= hullBulk('PROSPECTOR')) {
    if (await attempt(did, 'ship:PROSPECTOR', log, () =>
      buildUnits(db, seat.planetId, 'PROSPECTOR', 1, clock, seat.playerId))) return;
  }
  /*
    A HOLD FOR THE HAUL. A warship carries thirty to fifty; a raid of ten Darts
    brings home three hundred, which is a flight for nothing. So a bot keeps a
    couple of cargo hulls on the pad, and `raidingWing` takes them along.
  */
  const couriers = (view.fleet.COURIER ?? 0) + (view.fleetAway.COURIER ?? 0)
    + queuedCount(view, 'YARD', 'COURIER');
  const courierWant = Math.min(BOTS.courierTarget - couriers, Math.floor(room / hullBulk('COURIER')));
  if (courierWant > 0 && view.buildings.SHIPYARD >= HULLS.COURIER.minShipyard) {
    if (await attempt(did, 'ship:COURIER', log, () =>
      buildUnits(db, seat.planetId, 'COURIER', courierWant, clock, seat.playerId))) return;
  }
  room = Math.max(0, room);

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
      spec.crystal > 0 ? Math.floor(view.planet.crystal / spec.crystal) : Number.MAX_SAFE_INTEGER,
      spec.deuterium > 0 ? Math.floor((view.planet.deuterium * 0.5) / spec.deuterium) : Number.MAX_SAFE_INTEGER,
      Math.floor(room / hullBulk(hull)),
    );
    if (n < 1) continue;
    if (await attempt(did, `ship:${hull}`, log, () =>
      buildUnits(db, seat.planetId, hull, n, clock, seat.playerId))) return;
  }
}

/* ── the one flight ─────────────────────────────────────────── */

/** Bots never opt into public galaxy-event economies or convoy strikes. */
export const BOT_AUTONOMOUS_LANES = ['probe', 'mine', 'harvest', 'pirate', 'attack'] as const;
export type Lane = (typeof BOT_AUTONOMOUS_LANES)[number];

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
export function openLanes(view: PlanetView, seasonAgeMinutes = Number.POSITIVE_INFINITY): Lane[] {
  const open: Lane[] = ['probe'];
  if ((view.fleet.PROSPECTOR ?? 0) > 0) open.push('mine', 'harvest');
  if (COMBAT_HULLS.some((hull) => (view.fleet[hull] ?? 0) > 0)) {
    open.push('pirate');
    /*
      NOBODY IS ATTACKED IN THE FIRST TWELVE HOURS. D170 — see `BOTS.ceasefireMinutes`
      for the reasoning. The pirate lane above is deliberately outside it: a pirate
      is not a player, so a bot fighting one is alive rather than hostile.

      The default is INFINITY rather than zero, so a caller that has no season age
      to hand gets the behaviour this function always had. A ceasefire that
      switched itself on for want of an argument would silently stop every bot in
      an already-running galaxy from ever raiding again.
    */
    if (seasonAgeMinutes >= BOTS.ceasefireMinutes) open.push('attack');
  }
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
  /*
    HOW OLD IS THIS GALAXY? D170's ceasefire is measured from the season's own
    start, read here rather than passed down: the turn already holds the seat's
    `seasonId`, and one indexed row per turn is cheaper than threading a figure
    through six call sites that have no other use for it. A season that cannot be
    read leaves the ceasefire OFF — the default — so a missing row can never
    silently disarm every bot in a running galaxy.
  */
  const [[season], [self]] = await Promise.all([
    db.select({ startsAt: seasons.startsAt }).from(seasons).where(eq(seasons.id, seat.seasonId)),
    db.select({ shieldUntil: players.newcomerShieldUntil }).from(players).where(eq(players.id, seat.playerId)),
  ]);
  const ageMinutes = season
    ? (now.getTime() - season.startsAt.getTime()) / 60_000
    : Number.POSITIVE_INFINITY;
  /*
    ITS OWN FIRST DAY IS WAITED OUT, NEVER SPENT. Owner instruction, 2026-09-19. A
    person may fire early and lose the shield; a bot does not — the raid lane stays
    shut until the day is over, and nothing it does can end it sooner.
  */
  const shielded = self?.shieldUntil != null && self.shieldUntil > now;

  const lane = drawLane(persona, openLanes(view, shielded ? 0 : ageMinutes), rng);
  if (!lane) return;

  switch (lane) {
    case 'probe': await sendProbe(db, clock, seat, view, did, log, rng); return;
    case 'mine': await sendMiner(db, clock, seat, view, now, did, log, rng); return;
    case 'harvest': await sendSalvage(db, clock, seat, view, now, did, log, rng); return;
    case 'pirate': await raidPirate(db, clock, seat, persona, view, now, did, log); return;
    case 'attack':
      /*
        NOTHING WORTH HITTING IS A REASON TO LOOK, NOT TO SIT. A person who opens
        the raid sheet and finds every wall too tall sends a probe to find one that
        is not; the turn's flight goes there instead of nowhere.
      */
      if (!(await sendRaid(db, clock, seat, persona, view, did, log, rng))) {
        await sendProbe(db, clock, seat, view, did, log, rng);
      }
      return;
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
      /** The commander's first day here, which no launch may cross. D183. */
      shieldUntil: players.newcomerShieldUntil,
      /** …and the six hours a heavy defeat buys them, on the same terms. */
      recoveryShieldUntil: players.recoveryShieldUntil,
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

export interface ProbeCandidate {
  readonly planetId: string;
  readonly weight: number;
}

/** How many of the nearest unlooked-at worlds an ordinary probe chooses among. */
const PROBE_NEAREST = 8;

/**
 * WHERE THE NEXT PROBE GOES: near, but not always the nearest — twelve commanders
 * all probing their closest neighbour every evening is a pattern somebody would
 * notice. A BULLY anywhere in the neighbourhood is looked at first (owner decision,
 * 2026-09-19): the raid weights prefer them, and a raid needs a reading.
 */
export async function probeCandidates(
  db: Db, now: Date, seat: BotSeat, view: PlanetView,
): Promise<ProbeCandidate[]> {
  const known = await rememberedWorlds(db, seat.playerId);
  const cutoff = now.getTime() - BOTS.recordFreshMinutes * 60_000;
  const looking = await probesInFlight(db, seat.playerId);
  const stale = (await neighbourhood(db, seat, view))
    .filter((world) => (known.get(world.id)?.seenAt.getTime() ?? 0) < cutoff)
    .filter((world) => !looking.has(world.id));
  const botPlayers = await botPlayerIds(db, seat.seasonId);
  const people = [...new Set(stale
    .map((world) => world.playerId)
    .filter((id): id is string => id !== null && !botPlayers.has(id)))];
  const bullies = await bulliesAmong(db, people, botPlayers, new Date(now.getTime() - 24 * 60 * 60_000));

  return stale.flatMap((world, rank): ProbeCandidate[] => {
    if (world.playerId !== null && bullies.has(world.playerId)) {
      return [{ planetId: world.id, weight: BOTS.bullyTargetBias }];
    }
    return rank < PROBE_NEAREST ? [{ planetId: world.id, weight: 1 }] : [];
  });
}

/**
 * SCOUTING, AND IT IS THE LANE THAT MAKES THE REST HONEST.
 *
 * A raid needs a reading (see `sendRaid`), and a reading is what a probe brings
 * home. So the commander that has not looked at its neighbourhood spends its flight
 * looking — which is both the rule the fog imposes and, not by coincidence, exactly
 * the traffic an empty-looking disc was missing.
 */
async function sendProbe(
  db: Db, clock: Clock, seat: BotSeat, view: PlanetView,
  did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  const candidates = await probeCandidates(db, clock.now(), seat, view);
  const total = candidates.reduce((sum, world) => sum + world.weight, 0);
  if (total <= 0) return;
  let roll = rng() * total;
  const pick = candidates.find((world) => (roll -= world.weight) <= 0) ?? candidates[0];
  if (!pick) return;
  await attempt(did, 'probe', log, () =>
    launchProbe(db, seat.planetId, pick.planetId, clock, seat.playerId));
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
 * WHICH OF THESE PEOPLE HAVE BEEN STRIKING PEOPLE. Raids on anybody the server is
 * not playing, over the last day; a raid on a bot is the outlet and is left out of
 * the count on purpose. See `isBully`.
 */
async function bulliesAmong(
  db: Db, people: readonly string[], roster: ReadonlySet<string>, since: Date,
): Promise<Set<string>> {
  if (people.length === 0) return new Set();
  const bots = [...roster];
  const rows = await db
    .select({
      attackerPlayerId: battleReports.attackerPlayerId,
      n: sql<number>`count(*)::int`,
    })
    .from(battleReports)
    .where(and(
      inArray(battleReports.attackerPlayerId, [...people]),
      eq(battleReports.targetKind, 'PLAYER'),
      isNotNull(battleReports.defenderPlayerId),
      bots.length > 0
        ? sql`${battleReports.defenderPlayerId} NOT IN (${sql.join(bots.map((id) => sql`${id}`), sql`, `)})`
        : sql`true`,
      gt(battleReports.createdAt, since),
    ))
    .groupBy(battleReports.attackerPlayerId);
  return new Set(rows.filter((row) => isBully(row.n)).map((row) => row.attackerPlayerId));
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
   * A FEW TABLE READS FOR THE WHOLE NEIGHBOURHOOD, NOT A FEW PER WORLD. D166.
   *
   * The Core level and the day's raid count used to be fetched inside the loop, so
   * a bot with twenty-four neighbours in reach spent up to forty-eight sequential
   * round trips choosing one target — on the worker that also has to land every
   * raid in the galaxy on time, once per bot, several bots per sweep.
   *
   * Each is one question asked of a known id list, which is one query each.
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
  const bullies = new Set<string>();
  if (peopleWorlds.length > 0) {
    const people = [...new Set(peopleWorlds.map((world) => world.playerId!))];
    const roster = [...botPlayers];
    const [cores, hits, struck] = await Promise.all([
      db
        .select({ planetId: buildings.planetId, level: buildings.level })
        .from(buildings)
        .where(and(
          inArray(buildings.planetId, peopleWorlds.map((world) => world.id)),
          eq(buildings.type, 'CORE'),
        )),
      /*
        EVERY BOT'S RAIDS, NOT THIS ONE'S. Owner instruction, 2026-09-19: one bot
        raid a day on any one person, from the whole roster together.

        COUNTED BY LAUNCH, NOT BY REPORT. A report is written when the fleet lands,
        so counting reports let a second bot — or this one's next turn — launch at
        the same person while the first raid was still in the air.
      */
      db
        .select({
          defenderPlayerId: planets.controllerPlayerId,
          n: sql<number>`count(*)::int`,
        })
        .from(missions)
        .innerJoin(planets, eq(planets.id, missions.targetPlanetId))
        .where(and(
          eq(missions.kind, 'attack'),
          ne(missions.status, 'cancelled'),
          inArray(missions.ownerPlayerId, roster),
          inArray(planets.controllerPlayerId, people),
          gt(missions.departAt, dayAgo),
        ))
        .groupBy(planets.controllerPlayerId),
      bulliesAmong(db, people, botPlayers, dayAgo),
    ]);
    for (const row of cores) coreOf.set(row.planetId, row.level);
    for (const row of hits) {
      if (row.defenderPlayerId !== null) raidsOn.set(row.defenderPlayerId, row.n);
    }
    for (const id of struck) bullies.add(id);
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
    /*
      BOTH ATTACK SHIELDS BIND THE SERVER'S OWN COMMANDERS TOO. D183 · 2026-09-14.

      `startAttack` would refuse the launch anyway; skipping here is what stops a
      bot spending its turn on a target it cannot have — and what keeps a protected
      commander's window quiet rather than merely un-hit. Read through the same
      composition the gate enforces, so the two can never disagree about who is
      reachable.
    */
    if (protectionFrom(world.shieldUntil, world.recoveryShieldUntil, now)) continue;
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
      if ((raidsOn.get(world.playerId!) ?? 0) >= BOTS.botRaidsPerPersonPerDay) continue;
    }
    candidates.push({
      planetId: world.id,
      distance: world.d,
      weight: isBot
        ? BOTS.botTargetBias
        : world.playerId !== null && bullies.has(world.playerId) ? BOTS.bullyTargetBias : 1,
    });
  }
  return candidates;
}

/**
 * WHAT THIS COMMANDER'S PROBES BROUGHT HOME, one reading per world, as the launch
 * sheet reads them. A record a BATTLE left has no bands, so it is no reading: a
 * person who only saw the outside of a world sends a probe before a fleet.
 */
async function readingsOf(
  db: Db, observerPlayerId: string, planetIds: readonly string[],
): Promise<Map<string, Reading>> {
  const out = new Map<string, Reading>();
  if (planetIds.length === 0) return out;
  const rows = await db
    .select({
      planetId: probeWorldMemories.targetPlanetId,
      silhouette: probeWorldMemories.silhouette,
      defence: probeReports.defence,
      stock: probeReports.stock,
      shield: probeReports.shield,
      unarmed: probeReports.unarmed,
      classReading: probeReports.classReading,
      fleetHome: probeReports.fleetHome,
      seenAt: probeWorldMemories.seenAt,
    })
    .from(probeWorldMemories)
    .innerJoin(probeReports, eq(probeReports.id, probeWorldMemories.reportId))
    .where(and(
      eq(probeWorldMemories.observerPlayerId, observerPlayerId),
      isNull(probeWorldMemories.invalidatedAt),
      inArray(probeWorldMemories.targetPlanetId, [...planetIds]),
    ));
  for (const row of rows) {
    out.set(row.planetId, {
      seenAt: row.seenAt,
      fleetHome: row.fleetHome,
      defence: row.defence,
      stock: row.stock,
      shield: row.shield,
      unarmed: row.unarmed,
      classReading: row.classReading,
      doctrines: row.silhouette.doctrines ?? {},
      domeCeiling: row.silhouette.shielded ? shieldHp(row.silhouette.coreLevel) : 0,
    });
  }
  return out;
}

/** A reading, and the two facts about it that decide whether to trust it at all. */
interface Reading extends WallReading {
  readonly seenAt: Date;
  /** False when the probe found the fleet out: the wall it saw comes home. */
  readonly fleetHome: boolean;
}

/** Worlds this commander has a probe in the air toward; one look at a time. */
async function probesInFlight(db: Db, playerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ target: missions.targetPlanetId })
    .from(missions)
    .where(and(
      eq(missions.ownerPlayerId, playerId),
      eq(missions.kind, 'probe'),
      eq(missions.status, 'in_flight'),
    ));
  return new Set(rows.map((row) => row.target));
}

/** How many candidates one turn will read the lines for. Each is a few dozen fights. */
const RAID_LOOKS = 4;

/**
 * THE RAID: weighted by the manners, judged by the forecast. Returns whether a
 * fleet left, so a turn that found nothing worth hitting can spend its flight on
 * looking instead.
 */
async function sendRaid(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<boolean> {
  const candidates = await raidCandidates(db, clock.now(), seat, view);

  /*
    THE SAME WALK, AND THE SAME ZERO RULE. D166 — see `drawLane`. A candidate worth
    nothing is not a candidate, so it is filtered before the draw rather than being
    reachable on an `rng()` of exactly 0. Drawn WITHOUT replacement, so a wall too
    tall for this wing hands the turn to the next world rather than ending it.
  */
  const pool = candidates.filter((world) => world.weight > 0);
  const order: RaidCandidate[] = [];
  while (pool.length > 0 && order.length < RAID_LOOKS) {
    const total = pool.reduce((sum, world) => sum + world.weight, 0);
    let roll = rng() * total;
    const at = Math.max(0, pool.findIndex((world) => (roll -= world.weight) <= 0));
    order.push(...pool.splice(at, 1));
  }
  if (order.length === 0) return false;

  const [readings, tech] = await Promise.all([
    readingsOf(db, seat.playerId, order.map((world) => world.planetId)),
    techOf(db, seat.playerId),
  ]);
  const budget: ForecastBudget = { left: BOTS.forecastsPerTurn };
  const now = clock.now();
  for (const pick of order) {
    const reading = readings.get(pick.planetId);
    if (!reading) continue;
    /*
      A READING HOURS OLD IS LOOKED AT AGAIN BEFORE A FLEET GOES. The record still
      makes this world a candidate — it is worth looking at — but no person raids
      tonight on this morning's probe. The turn's flight is the fresh look, once:
      a probe already in the air is the look, and the next turn waits for it.
    */
    if (now.getTime() - reading.seenAt.getTime() > BOTS.readingFreshMinutes * 60_000) {
      if ((await probesInFlight(db, seat.playerId)).has(pick.planetId)) continue;
      return attempt(did, 'probe', log, () =>
        launchProbe(db, seat.planetId, pick.planetId, clock, seat.playerId));
    }
    // The probe found the fleet out: the wall it measured is the part that stayed.
    if (!reading.fleetHome) continue;
    const plan = planWorldRaid({
      fleet: view.fleet,
      tech,
      nerve: persona.nerve,
      distance: pick.distance,
      deuterium: view.planet.deuterium,
      reading,
    }, budget);
    if (!plan) continue;
      // Never acknowledging a shield drop: a bot waits its first day out (2026-09-19).
    return attempt(did, 'attack', log, () =>
      launchAttack(db, seat.planetId, pick.planetId, plan.wing, clock, seat.playerId));
  }
  return false;
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
  const epochs = await sensorHistoryForPlayer(db, seat.playerId, seat.seasonId);
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
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona, view: PlanetView, now: Date,
  did: string[], log: FastifyBaseLogger,
): Promise<void> {
  const snapshot = await loadPirateSnapshot(db, seat.seasonId, now);
  const standing = snapshot.standing(now);
  if (standing.length === 0) return;
  const nowMinutes = minutesSince(snapshot.startsAt, now);
  const tech = await techOf(db, seat.playerId);
  const budget: ForecastBudget = { left: BOTS.forecastsPerTurn };

  const nearest = standing
    .map((spec) => ({ spec, d: distance(view.planet.position, piratePosition(spec, nowMinutes)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);

  for (const { spec, d } of nearest) {
    /*
      THE CREW IS WHAT IS LEFT OF IT, and the level's handicap is the one the raid
      will be fought under. A level-four crew at a pad of three Darts is a loss a
      person can see coming, and so can this.
    */
    const crew = snapshot.livingRosterOf(spec.index);
    const plan = planPirateRaid({
      fleet: view.fleet,
      tech,
      nerve: persona.nerve,
      distance: d,
      deuterium: view.planet.deuterium,
      crew,
      damageMult: pirateStats(spec.level).damageMult,
      hoard: pirateHoard(crew),
    }, budget);
    if (!plan) continue;
    if (await attempt(did, 'pirate', log, () =>
      launchPirateRaid(db, seat.planetId, pirateId(snapshot.key, spec.index), plan.wing, clock, seat.playerId))) {
      return;
    }
  }
}
