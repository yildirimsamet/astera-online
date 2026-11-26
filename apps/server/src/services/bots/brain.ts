import { and, eq, gt, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import {
  BUILD,
  COMBAT_HULLS,
  HULLS,
  MULTI_WORLD,
  PROBE,
  INSTRUMENT_IDS,
  NOTIFICATION_CENTER,
  PROBE_DEFENCE,
  probeBatteryLevel,
  SATELLITE_IDS,
  SHIP_DAMAGE,
  shipHpRepairCost,
  honorRepairResources,
  type HpDamageLot,
  type BuildingId,
  type GroundHullId,
  type InstrumentId,
  type MobileHullId,
  type ResearchProjectId,
  type Resources,
  type SatelliteId,
  type TechLevels,
  alertPrice,
  buildingCost,
  distance,
  fleetValue,
  groundLoad,
  hangarCeiling,
  hangarLoad,
  hashSeed,
  hullBuildable,
  hullBulk,
  mulberry32,
  piratePosition,
  pirateStats,
  shieldHp,
  plantCeiling,
  satelliteSlots,
  withinTierBand,
  worthInvesting,
} from '@astera/rules';
import type { Db } from '../../db/client.js';
import { type Clock, minutesSince } from '../../clock.js';
import {
  battleReports, botProfiles, buildings, missions, notificationCenters, planets, players, probeReports, probeShots, probeWorldMemories, seasons,
} from '../../db/schema.js';
import { GameError } from '../planet.js';
import { buildNotificationCenter, commanderDeuteriumPerHour, fundNotificationCenter } from '../notificationCenter.js';
import { buildUnits, collectWorks, installSatellite, raiseInstrument, upgradeBuilding } from '../build.js';
import { completeResearch } from '../research.js';
import { startRepair } from '../repair.js';
import { maintenanceAction } from '../maintenance.js';
import { launchAttack } from '../mission.js';
import { launchProbe, rememberedWorlds } from '../intel.js';
import { installProbeBattery } from '../probeDefence.js';
import { launchHarvest, launchMining, loadMiningSnapshot, projectVisibleDebris } from '../mining.js';
import { launchPirateRaid } from '../pirateRaid.js';
import { asteroidId, discoveredAsteroidIndexes } from '../asteroidField.js';
import { loadPirateSnapshot, pirateId } from '../pirateField.js';
import { sensorHistoryForPlayer } from '../sensorHistory.js';
import { protectionFrom } from '../attackProtection.js';
import { peakCoreLevels } from '../player.js';
import { researchLevels, techOf } from '../researchState.js';
import { planetView, type PlanetView } from '../planetView.js';
import { launchSettlement } from '../movement.js';
import { startFaultRepair } from '../faultRepair.js';
import {
  BOTS, STRENGTH_CEILINGS, STRONG_RESEARCH, personaNamed, strengthNamed, type BotPersona, type BotStrength,
} from './personas.js';
import { developGuard } from './guard.js';
import {
  isBully, planPirateRaid, planWorldRaid, researchOf, type ForecastBudget, type WallReading,
} from './judgement.js';
import { tendBotMoon } from './moon.js';
import { fleetSave, raidWarning } from './defence.js';
import {
  COLONY_BUILD_ORDER, caretakerRaidInFlight, colonyReach, heldClaim, heldColonies, settlersOwned,
  nearestCaretaker, wantsColony, withoutSettlers,
} from './colonies.js';
import { raidCapsules, tendBotSynthesis } from './synthesis.js';

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
  // The profile row is the authority on strength, as it is on habit (F2). ELITE are the guards.
  const [profile] = await db.select({ strength: botProfiles.strength }).from(botProfiles)
    .where(eq(botProfiles.accountId, seat.accountId));
  const strength = strengthNamed(profile?.strength ?? 'NORMAL');
  const guard = strength === 'ELITE';
  const basePersona = personaNamed(seat.persona);
  const persona: BotPersona = strength === 'STRONG'
    ? { ...basePersona, research: [...basePersona.research, ...STRONG_RESEARCH] }
    : basePersona;
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

  view = await repairDocked(db, clock, seat, view, did, log);
  const age = await flightAge(db, seat, clock.now());
  // Seeded by the raid, not the turn: one decision for each raid, and none of the turn's other rolls shift.
  const answer = await answerWarnings(db, clock, seat, persona, strength, view, did, log,
    (raidId) => mulberry32(hashSeed('astera:bots:reflex', seat.playerId, raidId))(),
    openLanes(view, age).includes('pirate'));
  view = answer.view;
  view = await tendColonies(db, clock, seat, persona, strength, view, did, log);
  if (guard) {
    const development = await developGuard(db, clock, seat, view, did, log);
    view = development.view;
    if (development.complete) {
      view = await raiseOneBuilding(db, clock, seat, persona, view, did, log, strength);
      view = await buyShips(db, clock, seat, persona, view, did, log, rng, strength);
    }
    // Every currency committed to an earlier project is unavailable to optional flights.
    view = { ...view, planet: { ...view.planet,
      alloy: Math.max(0, view.planet.alloy - development.reserved.alloy),
      crystal: Math.max(0, view.planet.crystal - development.reserved.crystal),
      deuterium: Math.max(0, view.planet.deuterium - development.reserved.deuterium) } };
  } else {
    view = await buyGroundDefence(db, clock, seat, persona, view, did, log);
    view = await raiseOneBuilding(db, clock, seat, persona, view, did, log, strength);
    view = await buyOneInstrument(db, clock, seat, persona, view, did, log);
    view = await orderResearch(db, clock, seat, persona, view, did, log);
    view = await buyShips(db, clock, seat, persona, view, did, log, rng, strength);
  }
  view = await tendNotificationCenter(db, clock, seat, persona, view, did, log);
  view = await tendProbeBattery(db, clock, seat, persona, view, did, log);
  view = await tendBotMoon(db, clock, seat, persona, view, did, log, rng);
  // Its own seeded stream, so the laboratory never shifts the rolls the rest of the turn was tuned on.
  if (await tendBotSynthesis(db, clock, seat.playerId, persona.synthesis,
    mulberry32(hashSeed('astera:bots:lab', seat.playerId, clock.now().getTime())))) did.push('synthesis');
  // A fleet that already left to dodge a raid was this turn's one flight.
  if (!answer.flown) await commitOneFlight(db, clock, seat, persona, strength, view, did, log, rng, age, answer.hold);

  return { did };
}

/**
 * WHAT IT DOES WITH ITS OWN RADAR WARNING (F3.2, owner plan 2026-11-26). A raid it can meet:
 * the warships stay home. One that outmatches it: by strength (`BOTS.reflexChance`) it takes
 * the fleet out after a pirate and spends the store it would otherwise keep, so the raider
 * finds less. Otherwise it plays on, as plenty of people do. A guard's own route buys no guns,
 * so it fills its ground defence here (owner 2026-11-27); everyone else does on the ordinary turn.
 */
export async function answerWarnings(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona, strength: BotStrength,
  view: PlanetView, did: string[], log: FastifyBaseLogger,
  /** A number in [0, 1) for this raid, the same on every turn it is read. */
  roll: (raidId: string) => number,
  pirateOpen: boolean,
): Promise<{ view: PlanetView; flown: boolean; hold: boolean }> {
  const warning = await raidWarning(db, seat.playerId, seat.planetId, view);
  if (!warning.warned || warning.raidId === null) return { view, flown: false, hold: false };
  const guard = strength === 'ELITE';
  if (!warning.outmatched) {
    if (guard) view = await buyGroundDefence(db, clock, seat, persona, view, did, log);
    return { view, flown: false, hold: true };
  }
  if (roll(warning.raidId) >= BOTS.reflexChance[strength]) return { view, flown: false, hold: false };
  did.push('reflex');
  if (guard) view = await buyGroundDefence(db, clock, seat, persona, view, did, log);
  let flown = false;
  if (pirateOpen && warning.impactAt) {
    const after = await fleetSave(db, clock, seat, persona, view, warning.impactAt, did, log);
    if (after) {
      view = after;
      flown = true;
    }
  }
  view = await raiseOneBuilding(db, clock, seat, persona, view, did, log, strength, false);
  return { view, flown, hold: false };
}

/**
 * A COLONY, TAKEN THE WAY A PERSON TAKES ONE (F5, owner add-on 2026-11-26). Settle the claim its
 * own raid opened; otherwise look at the nearest caretaker world in reach and, on a fresh
 * reading, raid it with the settlers' two Couriers left home. 'flew' when the turn's one flight
 * went to it, 'wanting' when it still means to take one, 'content' when it holds what it wants.
 * Asleep, it takes no turn, so a claim can slip away as a person's does.
 */
export async function pursueColony(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona, strength: BotStrength,
  view: PlanetView, did: string[], log: FastifyBaseLogger, lanes: readonly Lane[],
): Promise<'flew' | 'wanting' | 'content'> {
  if (!(await wantsColony(db, seat.playerId, seat.ordinal, strength))) return 'content';
  const flew = async (label: string, run: () => Promise<unknown>) =>
    (await attempt(did, label, log, run)) ? 'flew' : 'wanting';
  const now = clock.now();

  const claim = await heldClaim(db, seat.playerId, now);
  if (claim) return flew('settle', () => launchSettlement(db, seat.playerId, seat.planetId, claim, clock));

  if (!lanes.includes('attack') || await caretakerRaidInFlight(db, seat.playerId)) return 'wanting';
  const target = await nearestCaretaker(db, seat.seasonId, view.planet.position, colonyReach(strength), now);
  if (!target) return 'wanting';
  const reading = (await readingsOf(db, seat.playerId, [target.planetId])).get(target.planetId);
  if (!reading || now.getTime() - reading.seenAt.getTime() > BOTS.readingFreshMinutes * 60_000) {
    if (!canAffordProbe(view) || (await probesInFlight(db, seat.playerId)).has(target.planetId)) return 'wanting';
    return flew('colony:probe', () => launchProbe(db, seat.planetId, target.planetId, clock, seat.playerId));
  }
  // The claim is the prize, not the haul: the wall must fall outright for the window to open.
  const plan = planWorldRaid({
    fleet: withoutSettlers(view.fleet),
    tech: await techOf(db, seat.playerId),
    nerve: { ...persona.nerve, need: 'CLEARS', lootOverFuel: 0 },
    distance: target.distance,
    deuterium: view.planet.deuterium,
    fuelPct: view.honorBenefits?.fuelPct ?? 0,
    reading,
  });
  if (!plan) return 'wanting';
  return flew('colony:attack', () => launchAttack(db, seat.planetId, target.planetId, plan.wing, clock, seat.playerId));
}

/**
 * THE COLONIES IT HOLDS ARE PLAYED, NOT PARKED (F5). Each turn, each colony: the tap, a crew on
 * every fault it can pay for, guns against what the store invites, one building. And while it
 * still means to take one, the settlers' Couriers are kept on hand. Returns the capital's view.
 */
export async function tendColonies(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona, strength: BotStrength,
  view: PlanetView, did: string[], log: FastifyBaseLogger,
): Promise<PlanetView> {
  const colonyHabit: BotPersona = { ...persona, buildOrder: [...COLONY_BUILD_ORDER] };
  for (const planetId of await heldColonies(db, seat.playerId)) {
    const here: BotSeat = { ...seat, planetId };
    const steps: string[] = [];
    let world: PlanetView;
    try {
      world = (await collectWorks(db, planetId, clock, seat.playerId)).planet;
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      continue;
    }
    for (const fault of world.faults) {
      if (fault.repair !== null || !affordable(world, fault.cost)) continue;
      if (await attempt(steps, 'repair', log, () => startFaultRepair(db, planetId, fault.id, clock, seat.playerId))) {
        world = await db.transaction((tx) => planetView(tx, planetId, clock));
      }
    }
    world = await buyGroundDefence(db, clock, here, persona, world, steps, log);
    await raiseOneBuilding(db, clock, here, colonyHabit, world, steps, log, strength);
    did.push(...steps.map((step) => `colony:${step}`));
  }

  if (!(await wantsColony(db, seat.playerId, seat.ordinal, strength))) return view;
  const short = MULTI_WORLD.settlement.transports - await settlersOwned(db, seat.planetId);
  if (short <= 0) return view;
  await attempt(did, 'settlers', log, async () => {
    view = (await buildUnits(db, seat.planetId, MULTI_WORLD.settlement.transportHull, short, clock, seat.playerId)).planet;
  });
  return view;
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

const canAffordProbe = (view: PlanetView): boolean =>
  affordable(view, { alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 });

/** The alloy a bot's buildings and instruments never spend. See `BOTS.stockReserveHours`. */
const storeReserve = (view: PlanetView): number => view.planet.alloyPerHour * BOTS.stockReserveHours;

/**
 * THE DOCK BEFORE ANYTHING ELSE. Kalıcı gemi hasarı (`plan.md` F7).
 *
 * A repair costs the damaged share of a new ship, so a hull in the Repair Station is
 * the cheapest hull there is — and while it waits it neither flies nor defends, so it
 * is the cheapest defence too. It goes first; later purchases use the state
 * returned by the preceding service, including this repair bill.
 *
 * Cheapest lots first, as many as the store pays for in full. A lot the store cannot
 * pay for waits for a richer turn; one job carries them all through the phone's door.
 */
async function repairDocked(
  db: Db, clock: Clock, seat: BotSeat,
  view: PlanetView, did: string[], log: FastifyBaseLogger,
): Promise<PlanetView> {
  if (view.workshopRadiation || view.queues.REPAIR.length >= BUILD.queueDepth) return view;
  const price = (cost: Resources): number => cost.alloy + cost.crystal + cost.deuterium;
  if (!view.dock.lots.some(lot => !lot.repairing)) {
    const groups: HpDamageLot[] = [];
    let quoted: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
    for (const lot of view.fleetDamage) {
      if (groups.length === SHIP_DAMAGE.repairLotsPerOrder) break;
      const cost = shipHpRepairCost([lot], view.dock.pct);
      const next = { alloy: quoted.alloy + cost.alloy, crystal: quoted.crystal + cost.crystal,
        deuterium: quoted.deuterium + cost.deuterium };
      if (!affordable(view, next)) continue;
      groups.push(lot);
      quoted = next;
    }
    if (groups.length > 0) await attempt(did, 'dock', log, async () => {
      const moved = await maintenanceAction(db, seat.playerId, seat.planetId, 'DOCK',
        { source: 'HOME', groups }, randomUUID(), clock);
      view = moved.planet;
    });
  }
  const waiting = view.dock.lots
    .filter((lot) => !lot.repairing)
    .sort((a, b) => price(a.cost) - price(b.cost));
  const chosen: string[] = [];
  let bill: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const lot of waiting) {
    const next = {
      alloy: bill.alloy + lot.cost.alloy,
      crystal: bill.crystal + lot.cost.crystal,
      deuterium: bill.deuterium + lot.cost.deuterium,
    };
    if (!affordable(view, view.honorBenefits ? honorRepairResources(next, view.honorBenefits) : next)) continue;
    chosen.push(lot.id);
    bill = next;
  }
  if (chosen.length === 0) return view;
  await attempt(did, 'repair', log, async () => {
    const repaired = await startRepair(db, seat.planetId, { lotIds: chosen,
      ...(view.honorBenefits ? { expectedHonorTier: view.honorBenefits.tier } : {}) }, clock, seat.playerId);
    view = repaired.planet;
  });
  return view;
}

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
): Promise<PlanetView> {
  const raidable = Math.max(0,
    (view.planet.alloy - view.planet.vaultProtected.alloy)
    + (view.planet.crystal - view.planet.vaultProtected.crystal));
  const shortfall = raidable * persona.defenceRatio - fleetValue(view.ground);
  if (shortfall <= 0) return view;
  if (view.queues.YARD.length >= BUILD.queueDepth) return view;

  const room = view.capacity.ground - view.capacity.groundUsed
    - view.queues.YARD.reduce((sum, order) => sum + groundLoad({ [order.subject]: order.count }), 0);
  if (room <= 0) return view;

  for (const [hull, share] of Object.entries(persona.groundMix) as [GroundHullId, number][]) {
    const spec = HULLS[hull];
    if (view.buildings.SHIPYARD < spec.minShipyard) continue;
    const price = spec.alloy + spec.crystal;
    const want = Math.floor((shortfall * share) / Math.max(1, price));
    // Never more than half the store on one batch: a world that spends everything
    // on guns stops growing, and a world that stops growing stops being worth raiding.
    const n = Math.min(
      want, Math.floor(room / hullBulk(hull)),
      Math.floor((view.planet.alloy * 0.5) / Math.max(1, spec.alloy)),
      spec.crystal > 0 ? Math.floor((view.planet.crystal * 0.5) / spec.crystal) : Number.MAX_SAFE_INTEGER,
    );
    if (n < 1) continue;
    if (await attempt(did, `ground:${hull}`, log, async () => {
      view = (await buildUnits(db, seat.planetId, hull, n, clock, seat.playerId)).planet;
    })) return view;
  }
  return view;
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
  view: PlanetView, did: string[], log: FastifyBaseLogger, strength: BotStrength,
  /** False when a raid it cannot meet is coming: the store is better spent than taken (F3.2). */
  keepReserve = true,
): Promise<PlanetView> {
  if (view.queues.CONSTRUCTION.length >= BUILD.queueDepth) return view;
  const guard = strength === 'ELITE';
  const levelOf = (type: BuildingId): number =>
    view.buildings[type] + queuedCount(view, 'CONSTRUCTION', type);
  const core = levelOf('CORE');
  const [season] = guard
    ? await db.select({ endsAt: seasons.endsAt }).from(seasons).where(eq(seasons.id, seat.seasonId)) : [];
  const hours = season ? (season.endsAt.getTime() - clock.now().getTime()) / 3_600_000 : 0;

  for (const type of persona.buildOrder) {
    const level = levelOf(type);
    /*
      WHERE THEY STOP. Owner decision: a middle ceiling.

      The Core is the ceiling over everything else, so capping it caps the world —
      no separate rule is needed for the Refinery, the Hangar or the orbit slots.
      Twelve tireless commanders with no ceiling would own the top of a ladder that
      exists for the people playing.
    */
    if (type === 'CORE' && level >= STRENGTH_CEILINGS[strength].core) continue;
    if (guard) {
      // Continue beyond the measured milestone only while economic investment can repay.
      if (type === 'CORE' && !worthInvesting('REFINERY', core, hours)) continue;
      if ((type === 'REFINERY' || type === 'EXTRACTOR' || type === 'DEUTERIUM_PLANT') && !worthInvesting(type, level, hours)) continue;
    }
    // The Hangar climbs its own ladder, free of the Core since plan 2B.6; everything else answers
    // to the Core.
    if (type === 'HANGAR' ? level >= hangarCeiling(core) : type !== 'CORE' && level >= core) continue;
    if (type === 'DEUTERIUM_PLANT') {
      const rungLevel = view.research
        .find((project) => project.id === 'DEUTERIUM_SYNTHESIS')?.level ?? 0;
      if (level >= plantCeiling(rungLevel)) continue;
    }
    const cost = buildingCost(type, level);
    // Keep a store back, so the world is never scraped to zero the instant before
    // somebody arrives — and is worth somebody arriving at. `BOTS.stockReserveHours`.
    if (!affordable(view, cost, guard || !keepReserve ? 0 : storeReserve(view))) continue;
    if (await attempt(did, `build:${type}`, log, async () => {
      view = (await upgradeBuilding(db, seat.planetId, type, clock, seat.playerId,
        type === 'CORE' && level === 9 ? { confirmedLevel: 10 } : {})).planet;
    })) return view;
  }
  return view;
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
): Promise<PlanetView> {
  if (view.queues.CONSTRUCTION.length >= BUILD.queueDepth) return view;
  const reserve = Math.max(view.planet.alloy * persona.militaryShare, storeReserve(view));

  for (const want of persona.wants) {
    if ((SATELLITE_IDS as readonly string[]).includes(want)) {
      const id = want as SatelliteId;
      if (view.orbit.includes(id)) continue;
      if (view.orbit.length >= satelliteSlots(view.buildings.CORE)) continue;
      const cost = (view.satelliteCosts as Partial<Record<SatelliteId, Resources>>)[id];
      if (!cost || !affordable(view, cost, reserve)) continue;
      if (await attempt(did, `satellite:${id}`, log, async () => {
        view = (await installSatellite(db, seat.planetId, id, clock, seat.playerId)).planet;
      })) return view;
      continue;
    }
    const id = want as InstrumentId;
    if (!(INSTRUMENT_IDS as readonly string[]).includes(id)) continue;
    const cost = (view.instrumentCosts as Partial<Record<InstrumentId, Resources>>)[id];
    if (!cost || !affordable(view, cost, reserve)) continue;
    if (await attempt(did, `instrument:${id}`, log, async () => {
      view = (await raiseInstrument(db, seat.planetId, id, clock, seat.playerId)).planet;
    })) return view;
  }
  return view;
}

/**
 * HOW MANY ATTACK ALERTS A BOT KEEPS IN ITS WALLET: a seeded mark per commander, so a probe
 * reads some of them as a few alerts and some as plenty, the way people's wallets differ.
 */
export const BOT_CENTER_ALERTS = { min: 1, max: 6 } as const;

/**
 * THE BİLDİRİM MERKEZİ, KEPT LIKE A PERSON KEEPS ONE. Owner 2026-10-30, decision 10 (LOCKED):
 * bots build it and fund it; a probe reads them as it reads people; no push goes to a bot.
 *
 * Built once the world has a Radar, since the centre only speaks for what the radar sees, and
 * from the same alloy reserve instruments respect. The wallet is topped up to the bot's mark in
 * a whole alert or more, from at most half the deuterium store so fuel is never spent on it.
 */
export async function tendNotificationCenter(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger,
): Promise<PlanetView> {
  if ((view.instruments.RADAR ?? 0) < 1) return view;
  const [center] = await db.select({ wallet: notificationCenters.wallet }).from(notificationCenters)
    .where(eq(notificationCenters.playerId, seat.playerId));
  if (!center) {
    const cost = NOTIFICATION_CENTER.buildCost;
    if (!affordable(view, cost, Math.max(view.planet.alloy * persona.militaryShare, storeReserve(view)))) return view;
    if (!(await attempt(did, 'notification-center:build', log, () =>
      buildNotificationCenter(db, seat.playerId, seat.planetId, clock)))) return view;
    return { ...view, planet: { ...view.planet,
      alloy: view.planet.alloy - cost.alloy, crystal: view.planet.crystal - cost.crystal, deuterium: view.planet.deuterium - cost.deuterium } };
  }
  const price = alertPrice('incoming_attack', 'T5', await commanderDeuteriumPerHour(db, seat.playerId));
  const span = BOT_CENTER_ALERTS.max - BOT_CENTER_ALERTS.min + 1;
  const mark = (BOT_CENTER_ALERTS.min + (hashSeed('astera:bots:center', seat.playerId) % span)) * price;
  const amount = Math.min(mark - center.wallet, Math.floor(view.planet.deuterium / 2));
  if (amount < price) return view;
  if (!(await attempt(did, 'notification-center:fund', log, () =>
    fundNotificationCenter(db, seat.playerId, seat.planetId, amount, true, clock)))) return view;
  return { ...view, planet: { ...view.planet, deuterium: view.planet.deuterium - amount } };
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
): Promise<PlanetView> {
  if (view.researchQueue.length >= BUILD.queueDepth) return view;
  const held = await researchLevels(db, seat.playerId);
  const queued = new Map<ResearchProjectId, number>();
  for (const order of view.researchQueue) {
    queued.set(order.projectId, Math.max(queued.get(order.projectId) ?? 0, order.level));
  }

  for (const want of persona.research) {
    const level = Math.max(held.get(want.project) ?? 0, queued.get(want.project) ?? 0);
    if (level >= want.level) continue;
    if (await attempt(did, `research:${want.project}`, log, async () => {
      view = (await completeResearch(db, seat.planetId, want.project, clock, seat.playerId)).planet;
    })) return view;
  }
  return view;
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
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number, strength: BotStrength,
): Promise<PlanetView> {
  if (view.queues.YARD.length >= BUILD.queueDepth) return view;

  // A ship in the Repair Station is still this commander's: it comes back repaired.
  const owned = fleetValue(view.fleet) + fleetValue(view.fleetAway) + fleetValue(view.fleetDocked);
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
    + (view.fleetDocked.PROSPECTOR ?? 0) + queuedCount(view, 'YARD', 'PROSPECTOR');
  if (prospectors < persona.prospectorTarget && view.buildings.SHIPYARD >= HULLS.PROSPECTOR.minShipyard
    && room >= hullBulk('PROSPECTOR')) {
    if (await attempt(did, 'ship:PROSPECTOR', log, async () => {
      view = (await buildUnits(db, seat.planetId, 'PROSPECTOR', 1, clock, seat.playerId)).planet;
    })) return view;
  }
  /*
    A HOLD FOR THE HAUL. A warship carries thirty to fifty; a raid of ten Darts
    brings home three hundred, which is a flight for nothing. So a bot keeps a
    couple of cargo hulls on the pad, and `raidingWing` takes them along.
    While it means to take a colony the settlers' pair stays home (F5), so the
    hold is bought on top of them.
  */
  const couriers = (view.fleet.COURIER ?? 0) + (view.fleetAway.COURIER ?? 0)
    + (view.fleetDocked.COURIER ?? 0) + queuedCount(view, 'YARD', 'COURIER');
  const settlers = await wantsColony(db, seat.playerId, seat.ordinal, strength) ? MULTI_WORLD.settlement.transports : 0;
  const courierWant = Math.min(BOTS.courierTarget + settlers - couriers, Math.floor(room / hullBulk('COURIER')));
  if (courierWant > 0 && view.buildings.SHIPYARD >= HULLS.COURIER.minShipyard) {
    if (await attempt(did, 'ship:COURIER', log, async () => {
      view = (await buildUnits(db, seat.planetId, 'COURIER', courierWant, clock, seat.playerId)).planet;
    })) return view;
  }
  room = Math.max(0, room);

  if (owned >= STRENGTH_CEILINGS[strength].fleetValue) return view;

  const budget = view.planet.alloy * persona.militaryShare;
  const tech = await techOf(db, seat.playerId);
  // A STRONG or ELITE commander flies its habit's lines at the best tier it can build (F2).
  const composition: Partial<Record<MobileHullId, number>> = {};
  for (const [hull, share] of Object.entries(persona.composition) as [MobileHullId, number][]) {
    const flown = strength === 'NORMAL' ? hull : bestOfLine(hull, view.buildings.SHIPYARD, tech);
    composition[flown] = (composition[flown] ?? 0) + share;
  }
  const open = (Object.entries(composition) as [MobileHullId, number][])
    .filter(([hull, share]) => share > 0 && hullBuildable(hull, view.buildings.SHIPYARD, tech));
  const total = open.reduce((sum, [, share]) => sum + share, 0);
  if (total <= 0) return view;
  // Compare value already owned/ordered against the intended shares; repeatedly walking
  // descending weights bought only the first hull, even when every other class was missing.
  const heldValue = (hull: MobileHullId): number => fleetValue({ [hull]: (view.fleet[hull] ?? 0)
    + (view.fleetAway[hull] ?? 0) + (view.fleetDocked[hull] ?? 0) + queuedCount(view, 'YARD', hull) });
  open.sort(([a, aShare], [b, bShare]) => heldValue(a) / aShare - heldValue(b) / bShare);

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
    if (await attempt(did, `ship:${hull}`, log, async () => {
      view = (await buildUnits(db, seat.planetId, hull, n, clock, seat.playerId)).planet;
    })) return view;
  }
  return view;
}

/**
 * THE SAME LINE, AS FAR UP AS THIS YARD AND THIS RESEARCH REACH. A Dart habit becomes Vipers,
 * Tempests and Corsairs as each opens; a hull with nothing buildable above it stays itself.
 */
export function bestOfLine(hull: MobileHullId, shipyard: number, tech: TechLevels): MobileHullId {
  const profile = HULLS[hull].profile;
  let best = hull;
  for (const candidate of COMBAT_HULLS) {
    const spec = HULLS[candidate];
    if (spec.profile !== profile || !hullBuildable(candidate, shipyard, tech)) continue;
    if ((spec.tier ?? 0) > (HULLS[best].tier ?? 0)) best = candidate;
  }
  return best;
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
    /*
      NOTHING IS ATTACKED IN THE FIRST DAY, NOT EVEN A PIRATE. D170 — see
      `BOTS.ceasefireMinutes` for the reasoning (owner, 2026-10-28).

      The default is INFINITY rather than zero, so a caller that has no season age
      to hand gets the behaviour this function always had. A ceasefire that
      switched itself on for want of an argument would silently stop every bot in
      an already-running galaxy from ever raiding again.
    */
    if (seasonAgeMinutes >= BOTS.ceasefireMinutes) open.push('pirate', 'attack');
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

/**
 * How old the galaxy is for this commander's flights, in minutes: zero while its own first-day
 * shield stands, so the raid lanes stay shut through it.
 */
async function flightAge(db: Db, seat: BotSeat, now: Date): Promise<number> {
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
  return shielded ? 0 : ageMinutes;
}

async function commitOneFlight(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona, strength: BotStrength,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
  age: number,
  /** A raid it can beat is on its way: the warships stay home to meet it (F3.2). */
  hold: boolean,
): Promise<void> {
  if (view.flight.used >= view.flight.total) return;
  const now = clock.now();
  const lanes = openLanes(view, age).filter((lane) => !hold || (lane !== 'attack' && lane !== 'pirate'));
  // A claim it opened closes within the hour: settling it comes before anything else (F5).
  const colony = await pursueColony(db, clock, seat, persona, strength, view, did, log, lanes);
  if (colony === 'flew') return;
  // While a colony is wanted the settlers' Couriers fly nowhere else: a claim waits for no raid.
  if (colony === 'wanting') view = { ...view, fleet: withoutSettlers(view.fleet) };
  /*
    A FRESH, FAVOURABLE READING IS ACTED ON BEFORE ANYTHING IS DRAWN (F3.1). The probe went
    out for this; a person who reads a good report raids on it rather than going mining.
  */
  if (lanes.includes('attack') && await sendRaid(db, clock, seat, persona, view, did, log, rng, true)) return;
  const lane = drawLane(persona, lanes, rng);
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
async function neighbourhood(
  db: Db, seat: BotSeat, view: PlanetView, limit = 24,
  /** Commanders kept however far away they are: a grudge is answered across the galaxy (F3.3). */
  always: ReadonlySet<string> = new Set(),
) {
  const rows = await db
    .select({
      id: planets.id,
      x: planets.x, y: planets.y, z: planets.z,
      playerId: planets.controllerPlayerId,
      joinedAt: players.joinedAt,
      /** The commander's first day here, which no launch may cross. D183. */
      shieldUntil: players.newcomerShieldUntil,
      /** …and the eight hours a heavy defeat buys them, on the same terms. */
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
    .filter((row, rank) => rank < limit || (row.playerId !== null && always.has(row.playerId)));
}

/**
 * WHO BEAT THIS COMMANDER AND HAS NOT BEEN ANSWERED. F3.3, owner plan 2026-11-26 (option B).
 * A DECISIVE or PARTIAL raid on it inside `BOTS.grudgeHours`, with no attack of its own on that
 * commander launched since. Read from the reports and launches every player can see.
 */
async function openGrudges(db: Db, seat: BotSeat, now: Date): Promise<Set<string>> {
  const since = new Date(now.getTime() - BOTS.grudgeHours * 3_600_000);
  const struck = await db
    .select({ attacker: battleReports.attackerPlayerId, at: sql<string>`max(${battleReports.createdAt})` })
    .from(battleReports)
    .where(and(
      eq(battleReports.defenderPlayerId, seat.playerId),
      eq(battleReports.targetKind, 'PLAYER'),
      inArray(battleReports.grade, ['DECISIVE', 'PARTIAL']),
      gt(battleReports.createdAt, since),
    ))
    .groupBy(battleReports.attackerPlayerId);
  if (struck.length === 0) return new Set();
  const answered = await db
    .select({ target: planets.controllerPlayerId, at: sql<string>`max(${missions.departAt})` })
    .from(missions)
    .innerJoin(planets, eq(planets.id, missions.targetPlanetId))
    .where(and(
      eq(missions.ownerPlayerId, seat.playerId),
      eq(missions.kind, 'attack'),
      ne(missions.status, 'cancelled'),
      inArray(planets.controllerPlayerId, struck.map((row) => row.attacker)),
      gt(missions.departAt, since),
    ))
    .groupBy(planets.controllerPlayerId);
  const lastAnswer = new Map(answered.map((row) => [row.target, new Date(row.at).getTime()]));
  return new Set(struck
    .filter((row) => (lastAnswer.get(row.attacker) ?? Number.NEGATIVE_INFINITY) < new Date(row.at).getTime())
    .map((row) => row.attacker));
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
  const looking = await probesInFlight(db, seat.playerId);
  /*
    FIRST, A WORLD IT COULD ACTUALLY HIT (F3.1, owner plan 2026-11-26). Live the roster flew 76
    probes for every raid: a look at somebody out of band, or struck already today, is a look
    nothing can follow. Its weights are the raid's own, so a bully still comes first.
  */
  const raidable = await raidCandidates(db, now, seat, view, false);
  const readings = await readingsOf(db, seat.playerId, raidable.map((world) => world.planetId));
  const freshCut = now.getTime() - BOTS.readingFreshMinutes * 60_000;
  const worthALook = raidable.filter((world) => !looking.has(world.planetId)
    && (readings.get(world.planetId)?.seenAt.getTime() ?? 0) < freshCut);
  if (worthALook.length > 0) return worthALook.map((world) => ({ planetId: world.planetId, weight: world.weight }));

  // Nothing in reach to raid: it still looks around, so the galaxy keeps moving (D159).
  const known = await rememberedWorlds(db, seat.playerId);
  const cutoff = now.getTime() - BOTS.recordFreshMinutes * 60_000;
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
  if (!canAffordProbe(view)) return;
  const retreat = new Set(await probeRetreatTargets(db, seat.playerId, clock.now()));
  const candidates = (await probeCandidates(db, clock.now(), seat, view)).filter((world) => !retreat.has(world.planetId));
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
  /** False asks which worlds it MAY raid once it has looked: where its next probe should go (F3.1). */
  requireRecord = true,
): Promise<RaidCandidate[]> {
  const known = await rememberedWorlds(db, seat.playerId);
  const cutoff = now.getTime() - BOTS.recordFreshMinutes * 60_000;
  const botPlayers = await botPlayerIds(db, seat.seasonId);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);

  const grudges = await openGrudges(db, seat, now);
  const near = await neighbourhood(db, seat, view, 24, grudges);
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
  /** Of `raidsOn`, the answers: launched by a bot this person had beaten within a day (F3.3). */
  const answersOn = new Map<string, number>();
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
          answers: sql<number>`count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM battle_reports br
             WHERE br.attacker_player_id = ${planets.controllerPlayerId}
               AND br.defender_player_id = ${missions.ownerPlayerId}
               AND br.target_kind = 'PLAYER'
               AND br.grade IN ('DECISIVE', 'PARTIAL')
               AND br.created_at <= ${missions.departAt}
               AND br.created_at > ${missions.departAt} - make_interval(hours => ${BOTS.grudgeHours})
               -- Only its first launch at them since the beating answers it; the next is ordinary.
               AND NOT EXISTS (
                 SELECT 1 FROM missions earlier
                   JOIN planets ep ON ep.id = earlier.target_planet_id
                  WHERE earlier.owner_player_id = ${missions.ownerPlayerId}
                    AND earlier.kind = 'attack'
                    AND earlier.status <> 'cancelled'
                    AND ep.player_id = ${planets.controllerPlayerId}
                    AND earlier.depart_at > br.created_at
                    AND earlier.depart_at < ${missions.departAt})))::int`,
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
      if (row.defenderPlayerId === null) continue;
      raidsOn.set(row.defenderPlayerId, row.n);
      answersOn.set(row.defenderPlayerId, row.answers);
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
    if (requireRecord && (known.get(world.id)?.seenAt.getTime() ?? 0) < cutoff) continue;
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
    const grudge = world.playerId !== null && grudges.has(world.playerId);
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
      // They chose the fight, so the floor does not shield them from its answer (F3.3).
      if (!grudge && (coreOf.get(world.id) ?? 1) < view.buildings.CORE - BOTS.playerCoreFloorGap) continue;
      /*
        TWO BUDGETS, OWNER OPTION B (2026-11-26). Answers sit outside the one-a-day quota, and a
        person takes at most `revengePerPersonPerDay` of them from the whole roster.
      */
      const raids = raidsOn.get(world.playerId!) ?? 0;
      const answers = answersOn.get(world.playerId!) ?? 0;
      if (grudge ? answers >= BOTS.revengePerPersonPerDay : raids - answers >= BOTS.botRaidsPerPersonPerDay) continue;
    }
    candidates.push({
      planetId: world.id,
      distance: world.d,
      weight: grudge
        ? BOTS.grudgeTargetBias
        : isBot
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
      classReading: probeReports.classReading,
      support: probeReports.support,
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
      classReading: row.classReading,
      research: researchOf(row.silhouette),
      domeCeiling: row.silhouette.shielded ? shieldHp(row.silhouette.coreLevel) : 0,
      // The clanmates' research is never read: anything the ladders allow.
      support: row.support ? { value: row.support.defence, shape: row.support.classReading } : null,
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

/** How long a bot leaves a world alone after its battery has shot down a battery's worth of probes. */
export const BOT_PROBE_RETREAT_MINUTES = 30;

/**
 * WORLDS A BOT HAS STOPPED FEEDING PROBES TO (2026-11-24). A stale reading sends a probe every
 * turn; against a probe battery that would be one lost probe a turn for ever — a resource drain
 * and a pattern no person keeps up. After a level-1 battery's worth of losses at one world inside
 * the window, the bot leaves it until the losses age out, as a person gives up and comes back.
 */
export async function probeRetreatTargets(db: Db, playerId: string, now: Date): Promise<string[]> {
  const rows = await db
    .select({ target: probeShots.targetPlanetId, n: sql<number>`count(*)::int` })
    .from(probeShots)
    .where(and(
      eq(probeShots.attackerPlayerId, playerId),
      gt(probeShots.shotAt, new Date(now.getTime() - BOT_PROBE_RETREAT_MINUTES * 60_000)),
    ))
    .groupBy(probeShots.targetPlanetId);
  return rows.filter((row) => row.n >= PROBE_DEFENCE.levels[0].capacity).map((row) => row.target);
}

/**
 * THE PROBE BATTERY, KEPT BY HABIT (owner K5, 2026-11-24). Only habits that keep one build it,
 * once, on the effective Radar rung, from the same reserve the Bildirim Merkezi respects.
 */
export async function tendProbeBattery(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger,
): Promise<PlanetView> {
  if (!persona.keepsProbeBattery) return view;
  // One order at a time, then the next level, as a person keeping one would (owner, 2026-11-24).
  const battery = view.probeBattery;
  if (battery && (battery.readyAt > clock.now() || battery.upgradeLevel !== null)) return view;
  const next = battery ? battery.level + 1 : 1;
  if (next > PROBE_DEFENCE.levels.length) return view;
  const spec = probeBatteryLevel(next);
  if ((view.effectiveInstruments.RADAR ?? 0) < spec.requiredRadar) return view;
  if (!affordable(view, spec.cost, Math.max(view.planet.alloy * persona.militaryShare, storeReserve(view)))) return view;
  await attempt(did, 'probe-battery:build', log, async () => {
    view = (await installProbeBattery(db, seat.planetId, clock, seat.playerId)).planet;
  });
  return view;
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

/** How many candidates one turn will read the power ruler for. */
const RAID_LOOKS = 4;

/**
 * THE RAID: weighted by the manners, judged by the forecast. Returns whether a
 * fleet left, so a turn that found nothing worth hitting can spend its flight on
 * looking instead.
 */
async function sendRaid(
  db: Db, clock: Clock, seat: BotSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
  /** Only worlds whose reading is fresh and saw the fleet home: the strike a probe was for (F3.1). */
  freshOnly = false,
): Promise<boolean> {
  let candidates = await raidCandidates(db, clock.now(), seat, view);
  if (freshOnly) {
    const fresh = await readingsOf(db, seat.playerId, candidates.map((world) => world.planetId));
    const cut = clock.now().getTime() - BOTS.readingFreshMinutes * 60_000;
    candidates = candidates.filter((world) => {
      const reading = fresh.get(world.planetId);
      return reading !== undefined && reading.fleetHome && reading.seenAt.getTime() >= cut;
    });
  }

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
  const retreat = new Set(await probeRetreatTargets(db, seat.playerId, now));
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
      if (retreat.has(pick.planetId)) continue;
      if (!canAffordProbe(view) || (await probesInFlight(db, seat.playerId)).has(pick.planetId)) continue;
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
      fuelPct: view.honorBenefits?.fuelPct ?? 0,
      reading,
    }, budget);
    if (!plan) continue;
      // Never acknowledging a shield drop: a bot waits its first day out (2026-09-19).
    const capsules = await raidCapsules(db, seat.playerId, plan.wing, persona.synthesis,
      mulberry32(hashSeed('astera:bots:capsule', seat.playerId, now.getTime())));
    return attempt(did, 'attack', log, () =>
      launchAttack(db, seat.planetId, pick.planetId, plan.wing, clock, seat.playerId,
        false, undefined, false, undefined, false, 'PLANET', 'PLANET', capsules));
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
 * refuses unobserved targets and Radar-only contacts off `pirateZone`, which is the
 * one statement of that rule. Position is used only to order the attempts — asking about the
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
      fuelPct: view.honorBenefits?.fuelPct ?? 0,
      crew,
      damageMult: pirateStats(spec.level).damageMult,
      hoard: snapshot.remainingLootOf(spec.index),
    }, budget);
    if (!plan) continue;
    if (await attempt(did, 'pirate', log, () =>
      launchPirateRaid(db, seat.planetId, pirateId(snapshot.key, spec.index), plan.wing, clock, seat.playerId))) {
      return;
    }
  }
}
