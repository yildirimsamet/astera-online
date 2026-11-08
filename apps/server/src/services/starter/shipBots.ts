import {
  HULLS, REPAIR_LADDER, STARTER, afterQueue, canLoadFuel, canOrderStep, dockBill, hangarLoad, isFeatureOpen, nextRequiredStep, openingProgress, partsVisible,
  RESEARCH_PROJECTS, seededFrom, shipBotTarget, starterOutcomeTable, combatValue,
  fleetEntries, hullBulk,
  type HullId, type RepairStep, type VesselProgress,
} from '@astera/rules';
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, notInArray, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import type { Clock } from '../../clock.js';
import type { Db, Queryable } from '../../db/client.js';
import { botProfiles, players, starterGalaxies, starterSites, vesselBotState, vesselMissions, vesselProbeReports, vesselUnits, vessels } from '../../db/schema.js';
import { botQuietAt } from '../bots/population.js';
import { GameError } from '../planet.js';
import { accountHasPlayHistory } from '../player.js';
import { dockFleet } from './dock.js';
import { enlistVessel } from './enlist.js';
import { launchVesselFleet } from './fleet.js';
import { loadFuel } from './migration.js';
import { launchVesselHarvest, launchVesselMining, starterMiningView } from './mining.js';
import { buildAtVessel, researchAtVessel } from './orders.js';
import { launchVesselProbe } from './probe.js';
import { markProgress } from './quiet.js';
import { collectAtVessel, openCrates, orderRepair } from './repair.js';
import { readVessel, withVesselLock, type VesselView } from './vessel.js';

/** A few at a time: a galaxy that fills in one tick looks like what it is. */
const BOT_SHIP_BATCH = 4;
const BOT_SHIP_INTERVAL_MS = 10 * 60_000;
/** A person arriving always finds a berth without opening another galaxy. */
const ROOM_KEPT_FOR_PEOPLE = 12;
const TURNS_PER_SWEEP = 8;
const NEW_NEIGHBOUR_MS = 24 * 3_600_000;
const ATTACK_GAP_MS = 24 * 3_600_000;
const ATTACK_ONE_IN = 8;
const READING_LIFE_MS = 6 * 3_600_000;
/** It has to be clearly stronger: the table says what an even fight costs, and that is not worth a day. */
const ATTACK_RATIO = starterOutcomeTable().find(row => row.ratio >= 2)?.ratio ?? 2;
const OPENING_STAGES = 9;
/** Owner 2026-11-08 (N3): the shield is a choice. Some crews take it and some do not, as people do. */
const SHIELD_SHARE = 0.6;
const WANT_DARTS = 6;
const band = z.object({ defence: z.object({ high: z.number() }) });

const PERSONAS = ['steady', 'hoarder', 'restless'] as const;
const PACE: Record<(typeof PERSONAS)[number], { sessionMinutes: [number, number]; restHours: [number, number]; gapMinutes: [number, number] }> = {
  steady: { sessionMinutes: [18, 32], restHours: [4, 8], gapMinutes: [3, 7] },
  hoarder: { sessionMinutes: [12, 20], restHours: [6, 11], gapMinutes: [4, 9] },
  restless: { sessionMinutes: [25, 45], restHours: [3, 6], gapMinutes: [2, 5] },
};
const between = (range: readonly [number, number], roll: number): number => range[0] + (range[1] - range[0]) * roll;
const personaOf = (name: string | undefined) => PERSONAS.find(persona => persona === name) ?? 'steady';

/** A crew's own choice of the shield, drawn once from its ship and never changed. */
export const crewTakesShield = (vesselId: string): boolean => seededFrom(vesselId, 'aegis')() < SHIELD_SHARE;

const progressOfView = (view: VesselView): VesselProgress => ({ modules: view.modules, facts: view.facts, parts: view.parts, fuel: view.fuel });
const repairsOf = (view: VesselView): RepairStep[] => view.queue.filter(order => order.queue === 'CONSTRUCTION')
  .flatMap(order => REPAIR_LADDER.find(step => step.module === order.subject && step.stage === order.stage) ?? []);
const queueIn = (view: VesselView, queue: VesselView['queue'][number]['queue']) => view.queue.filter(order => order.queue === queue).length;

/** A new neighbour stands somewhere along the ladder, with what those repairs would have given it. */
async function startPartWay(db: Db, vesselId: string, roll: () => number): Promise<void> {
  let progress: VesselProgress = openingProgress();
  const stages = Math.floor(roll() * OPENING_STAGES);
  const facts = new Set(progress.facts);
  for (let i = 0; i < stages; i++) {
    const next = nextRequiredStep(progress, []);
    if (!next) break;
    for (const need of next.missing) if (need.kind === 'FACT') facts.add(need.fact);
    const stuck = next.missing.some(need => need.kind !== 'FACT');
    if (stuck) break;
    progress = { ...progress, facts: [...facts], modules: { ...progress.modules, [next.step.module]: next.step.stage } };
  }
  await db.update(vessels).set({ modules: progress.modules, facts: [...progress.facts] }).where(eq(vessels.id, vesselId));
  // What those repairs would have handed over.
  const given = REPAIR_LADDER.filter(step => (progress.modules[step.module] ?? 0) >= step.stage).flatMap(step => fleetEntries(step.grants?.fleet ?? {}));
  for (const [hull, count] of given) {
    await db.insert(vesselUnits).values({ vesselId, hull, location: 'HOME', count }).onConflictDoNothing();
  }
}

/** Names nobody is using: never seated, no ship, never played. A name that has landed has had its ship. */
async function freeNames(q: Queryable) {
  const taken = q.select({ id: players.accountId }).from(players);
  const shipped = q.select({ id: vessels.accountId }).from(vessels);
  return q.select({ accountId: botProfiles.accountId, persona: botProfiles.persona }).from(botProfiles)
    .where(and(isNull(botProfiles.retiredAt), notInArray(botProfiles.accountId, taken), notInArray(botProfiles.accountId, shipped)))
    .orderBy(asc(botProfiles.ordinal));
}

const lastShort = new Map<string, number>();

/** Enough neighbours that one person is not alone, and never so many that a person has nowhere to stand. */
export async function crewGalaxies(db: Db, clock: Clock, log: FastifyBaseLogger): Promise<number> {
  const now = clock.now();
  const galaxies = await db.select().from(starterGalaxies).where(eq(starterGalaxies.status, 'OPEN')).orderBy(asc(starterGalaxies.ordinal));
  let added = 0;
  for (const galaxy of galaxies) {
    const aboard = await db.select({ id: vessels.id, bot: vesselBotState.vesselId, createdAt: vesselBotState.createdAt }).from(vessels)
      .leftJoin(vesselBotState, eq(vesselBotState.vesselId, vessels.id))
      .where(and(eq(vessels.starterGalaxyId, galaxy.id), inArray(vessels.status, ['ACTIVE', 'DEPARTING'])));
    const people = aboard.filter(ship => ship.bot === null).length;
    const here = aboard.length - people;
    const recent = aboard.filter(ship => ship.createdAt && ship.createdAt > new Date(now.getTime() - BOT_SHIP_INTERVAL_MS)).length;
    const need = Math.min(
      shipBotTarget(people) - here,
      galaxy.capacity - people - ROOM_KEPT_FOR_PEOPLE - here,
      BOT_SHIP_BATCH - recent,
    );
    if (need <= 0) continue;

    let left = need;
    // A sleeping one comes back with its own name and its own ship, as a person does.
    const sleeping = await db.select({ id: vessels.id, accountId: vessels.accountId }).from(vesselBotState)
      .innerJoin(vessels, eq(vessels.id, vesselBotState.vesselId)).where(and(eq(vessels.status, 'DORMANT'), eq(vessels.starterGalaxyId, galaxy.id))).limit(left);
    for (const ship of sleeping) {
      await withVesselLock(db, ship.accountId, clock, (tx, vessel) => markProgress(tx, vessel, clock));
      await db.update(vesselBotState).set({ createdAt: now, nextActionAt: now }).where(eq(vesselBotState.vesselId, ship.id));
      left--; added++;
    }
    if (left <= 0) continue;

    const names = await freeNames(db);
    if (names.length < left && lastShort.get(galaxy.id) !== names.length) {
      lastShort.set(galaxy.id, names.length);
      log.warn({ galaxy: galaxy.id, have: names.length, want: left }, 'the bot roster is short of names for ships; add more rather than inventing them');
    }
    for (const name of names) {
      if (left <= 0) break;
      if (await accountHasPlayHistory(db, name.accountId)) continue;
      const roll = seededFrom(name.accountId, now.getTime());
      const id = await enlistVessel(db, name.accountId, clock, new Set(), galaxy.id);
      await startPartWay(db, id, roll);
      const persona = PERSONAS[Math.floor(roll() * PERSONAS.length)] ?? 'steady';
      await db.insert(vesselBotState).values({
        vesselId: id, persona, createdAt: now,
        nextActionAt: new Date(now.getTime() + roll() * 15 * 60_000),
        sessionUntilAt: new Date(now.getTime() + between(PACE[persona].sessionMinutes, roll()) * 60_000),
      }).onConflictDoNothing();
      left--; added++;
    }
  }
  return added;
}

/** The ones this ship could act on, read through what any ship would read. */
const neighbours = (q: Queryable, view: VesselView) => q.select({
  id: vessels.id, enlistedAt: vessels.enlistedAt, bot: vesselBotState.vesselId,
}).from(vessels).leftJoin(vesselBotState, eq(vesselBotState.vesselId, vessels.id))
  .where(and(eq(vessels.starterGalaxyId, view.galaxy.id), eq(vessels.status, 'ACTIVE'), ne(vessels.id, view.id)));

async function newNeighbourToRead(db: Db, view: VesselView, now: Date): Promise<string | null> {
  const around = await neighbours(db, view);
  if (around.length === 0) return null;
  const read = await db.select({ id: vesselProbeReports.targetVesselId }).from(vesselProbeReports).where(eq(vesselProbeReports.observerVesselId, view.id));
  const known = new Set(read.map(report => report.id));
  const fresh = around.find(ship => ship.bot === null && !known.has(ship.id) && now.getTime() - ship.enlistedAt.getTime() < NEW_NEIGHBOUR_MS);
  if (fresh) return fresh.id;
  return view.facts.includes('FIRST_PROBE_REPORT') ? null : (around[0]?.id ?? null);
}

/** A real person who has not been hit today, whose last reading says this fleet is clearly the stronger. */
async function personWorthAttacking(db: Db, view: VesselView, armed: number, now: Date): Promise<string | null> {
  const people = (await neighbours(db, view)).filter(ship => ship.bot === null);
  if (people.length === 0) return null;
  const since = new Date(now.getTime() - ATTACK_GAP_MS);
  const recent = await db.select({ target: vesselMissions.targetVesselId }).from(vesselMissions).where(and(
    eq(vesselMissions.kind, 'ATTACK'), gt(vesselMissions.departAt, since), inArray(vesselMissions.targetVesselId, people.map(ship => ship.id)),
    // Any of the server's ships counts: a person is not hit twice a day because two of them felt like it.
    inArray(vesselMissions.ownerVesselId, db.select({ id: vesselBotState.vesselId }).from(vesselBotState)),
  ));
  const hit = new Set(recent.map(row => row.target));
  const reports = await db.select().from(vesselProbeReports).where(and(eq(vesselProbeReports.observerVesselId, view.id), isNotNull(vesselProbeReports.deliveredAt), gt(vesselProbeReports.at, new Date(now.getTime() - READING_LIFE_MS))))
    .orderBy(desc(vesselProbeReports.at));
  for (const person of people) {
    if (hit.has(person.id)) continue;
    const reading = reports.find(report => report.targetVesselId === person.id);
    const read = band.safeParse(reading?.snapshot);
    if (read.success && armed >= Math.max(1, read.data.defence.high) * ATTACK_RATIO) return person.id;
  }
  return null;
}

export interface TurnOptions {
  /** Pinned by tests: under one in `ATTACK_ONE_IN` is a go. */
  attackRoll?: number;
}

/**
 * ONE MOMENT AT THE CONTROLS. The first thing worth doing, through the same services a person's press
 * reaches, so a refusal here is a refusal there: nothing this does can be something no player could.
 */
export async function takeShipBotTurn(db: Db, accountId: string, clock: Clock, log: FastifyBaseLogger, options: TurnOptions = {}): Promise<string | null> {
  const now = clock.now();
  const attempt = async (name: string, act: () => Promise<unknown>): Promise<string | null> => {
    try {
      await act();
      return name;
    } catch (err) {
      if (err instanceof GameError) return null;
      log.error({ err, accountId, action: name }, 'a ship turn failed');
      return null;
    }
  };
  let view = await readVessel(db, accountId, clock);
  if (view.status !== 'ACTIVE') return null;
  const progress = progressOfView(view);
  if (isFeatureOpen(progress, 'production') && view.bufferAlloy + view.bufferCrystal + view.bufferDeuterium > 0) {
    await attempt('collect', () => collectAtVessel(db, accountId, clock));
    view = await readVessel(db, accountId, clock);
  }
  // The salvage crates: a person opens them the moment they are ready, and so does this ship.
  if (view.crates.some(crate => crate.state === 'ready')) {
    await attempt('crates', () => openCrates(db, accountId, undefined, clock));
    view = await readVessel(db, accountId, clock);
  }

  const shield = REPAIR_LADDER.find(step => step.module === 'AEGIS' && step.stage === 1);
  if (shield && crewTakesShield(view.id) && queueIn(view, 'CONSTRUCTION') < STARTER.queues.construction
    && canOrderStep(afterQueue(progress, repairsOf(view)), 'AEGIS', 1).ok && view.alloy >= shield.alloy && view.crystal >= shield.crystal) {
    const done = await attempt('shield', () => orderRepair(db, accountId, 'AEGIS', 1, clock));
    if (done) return done;
  }

  const next = nextRequiredStep(progress, repairsOf(view));
  if (next?.missing.length === 0 && queueIn(view, 'CONSTRUCTION') < STARTER.queues.construction
    && view.alloy >= next.step.alloy && view.crystal >= next.step.crystal) {
    const done = await attempt('repair', () => orderRepair(db, accountId, next.step.module, next.step.stage, clock));
    if (done) return done;
  }

  // The station mends for the shipyard alone (N2), so it does for this ship too.
  if (isFeatureOpen(progress, 'fleet') && queueIn(view, 'DOCK') === 0) {
    const bill = dockBill(view.damage);
    if (bill.minutes > 0 && view.alloy >= bill.cost.alloy && view.crystal >= bill.cost.crystal && view.deuterium >= bill.cost.deuterium) {
      const done = await attempt('dock', () => dockFleet(db, accountId, clock));
      if (done) return done;
    }
  }

  if (canLoadFuel(afterQueue(progress, [])) && view.fuel < STARTER.fuelForJump && view.deuterium >= 1) {
    const amount = Math.floor(Math.min(view.deuterium, STARTER.fuelForJump - view.fuel));
    if (amount > 0) {
      const done = await attempt('fuel', () => loadFuel(db, accountId, amount, clock));
      if (done) return done;
    }
  }

  if (isFeatureOpen(progress, 'intel')) {
    const target = await newNeighbourToRead(db, view, now);
    if (target) {
      const done = await attempt('probe', () => launchVesselProbe(db, accountId, target, clock));
      if (done) return done;
    }
  }

  if (!isFeatureOpen(progress, 'fleet')) return null;

  const home = (hull: HullId): number => view.fleet[hull] ?? 0;
  const armed = combatValue(view.fleet);

  if (queueIn(view, 'YARD') === 0) {
    const room = STARTER.hangarRoom[Math.min(view.modules.HANGAR ?? 1, STARTER.hangarRoom.length) - 1] ?? 0;
    const load = hangarLoad(view.fleet);
    const hull: HullId | null = home('PROSPECTOR') === 0 && view.flying === 0 ? 'PROSPECTOR' : home('DART') < WANT_DARTS ? 'DART' : null;
    if (hull && load + hullBulk(hull) <= room && view.alloy >= HULLS[hull].alloy * 3 && view.crystal >= HULLS[hull].crystal * 3) {
      const done = await attempt('build', () => buildAtVessel(db, accountId, hull, 1, clock));
      if (done) return done;
    }
  }

  if (home('PROSPECTOR') > 0) {
    const mining = await starterMiningView(db, accountId, clock);
    const rock = mining.asteroids[0];
    const field = mining.debris[0];
    if (field && partsVisible(progress)) {
      const done = await attempt('harvest', () => launchVesselHarvest(db, accountId, field.id, home('PROSPECTOR'), clock));
      if (done) return done;
    }
    if (rock) {
      const done = await attempt('mine', () => launchVesselMining(db, accountId, rock.id, home('PROSPECTOR'), clock));
      if (done) return done;
    }
    if (field) {
      const done = await attempt('harvest', () => launchVesselHarvest(db, accountId, field.id, home('PROSPECTOR'), clock));
      if (done) return done;
    }
  }

  if (isFeatureOpen(progress, 'attack') && home('DART') >= 1 && view.flying === 0) {
    const roll = options.attackRoll ?? seededFrom(view.id, now.getTime())();
    if (roll < 1 / ATTACK_ONE_IN) {
      const target = await personWorthAttacking(db, view, armed, now);
      if (target) {
        const done = await attempt('attack', () => launchVesselFleet(db, accountId, { targetPlanetId: target, fleet: { DART: home('DART') }, acknowledgeShieldLoss: true }, undefined, clock));
        if (done) return done;
      }
    }
  }

  // An outpost is the shipyard's first fight (N2): it needs no battle behind it and no shield.
  if (home('DART') >= 4 && view.flying === 0) {
    const [post] = await db.select({ id: starterSites.id }).from(starterSites).where(and(
      eq(starterSites.starterGalaxyId, view.galaxy.id), eq(starterSites.kind, 'OUTPOST'), lte(starterSites.level, 1), gt(sql`${starterSites.alloy} + ${starterSites.crystal}`, 0),
    )).limit(1);
    if (post) {
      const done = await attempt('raid', () => launchVesselFleet(db, accountId, { targetPlanetId: post.id, fleet: { DART: home('DART') } }, undefined, clock));
      if (done) return done;
    }
  }

  if (isFeatureOpen(progress, 'research') && queueIn(view, 'RESEARCH') === 0) {
    const project = STARTER.research.projects.find(id => (view.research[id] ?? 0) < STARTER.research.maxLevel);
    if (project) {
      const cost = RESEARCH_PROJECTS[project].costAt((view.research[project] ?? 0) + 1);
      if (view.alloy >= cost.alloy * 2 && view.crystal >= cost.crystal * 2) {
        const done = await attempt('research', () => researchAtVessel(db, accountId, project, clock));
        if (done) return done;
      }
    }
  }
  return null;
}

/** Its name has been called to the main galaxy: the ship leaves the map and nobody plays it again. */
export async function sleepPlayedShip(db: Db, vesselId: string): Promise<void> {
  await db.update(vessels).set({ status: 'DORMANT', slotIndex: null }).where(eq(vessels.id, vesselId));
  await db.delete(vesselBotState).where(eq(vesselBotState.vesselId, vesselId));
}

/** Whoever is due, claimed by moving the clock forward first, so that two workers never share one. */
export async function runShipBotTurns(db: Db, clock: Clock, log: FastifyBaseLogger): Promise<number> {
  const now = clock.now();
  const due = await db.select({ state: vesselBotState, accountId: vessels.accountId }).from(vesselBotState)
    .innerJoin(vessels, eq(vessels.id, vesselBotState.vesselId))
    .where(and(lte(vesselBotState.nextActionAt, now), eq(vessels.status, 'ACTIVE')))
    .orderBy(asc(vesselBotState.nextActionAt)).limit(TURNS_PER_SWEEP);
  let taken = 0;
  for (const { state, accountId } of due) {
    const pace = PACE[personaOf(state.persona)];
    const roll = seededFrom(state.vesselId, now.getTime());
    const inSession = state.sessionUntilAt > now;
    const quiet = botQuietAt(now);
    const rest = new Date(now.getTime() + between(pace.restHours, roll()) * 3_600_000);
    const nextActionAt = quiet ? new Date(now.getTime() + 30 * 60_000) : inSession ? new Date(now.getTime() + between(pace.gapMinutes, roll()) * 60_000) : rest;
    const sessionUntilAt = quiet || inSession ? state.sessionUntilAt : new Date(rest.getTime() + between(pace.sessionMinutes, roll()) * 60_000);
    const claimed = await db.update(vesselBotState).set({ nextActionAt, sessionUntilAt })
      .where(and(eq(vesselBotState.vesselId, state.vesselId), eq(vesselBotState.nextActionAt, state.nextActionAt))).returning({ id: vesselBotState.vesselId });
    if (claimed.length === 0 || quiet || !inSession) continue;
    await takeShipBotTurn(db, accountId, clock, log);
    taken++;
  }
  return taken;
}

export async function sweepShipBots(db: Db, clock: Clock, log: FastifyBaseLogger): Promise<void> {
  await crewGalaxies(db, clock, log);
  await runShipBotTurns(db, clock, log);
}
