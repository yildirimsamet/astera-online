import { and, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import {
  BUILD,
  MOBILE_HULLS,
  MOON,
  distance,
  effectiveCracks,
  fleetCount,
  hullBulk,
  jumpCapacity,
  scanRange,
  type Fleet,
  type MoonRarity,
} from '@astera/rules';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import {
  missions, moons, planets, probeWorldMemories, strategicAssets, units,
} from '../../db/schema.js';
import { rememberedWorlds } from '../intel.js';
import { holdsLunarCapture, seasonHasMoons } from '../moon.js';
import { orderMoon } from '../moonBuild.js';
import { hopFleet, jumpFleet, moonDockRoom, retargetAttack } from '../moonMovement.js';
import { scanFromMoon } from '../moonScan.js';
import { GameError } from '../planet.js';
import { planetView, type PlanetView } from '../planetView.js';
import { completeResearch } from '../research.js';
import { launchDeathStar } from '../strategic.js';
import { MOON_LOCATION } from '../unitLocation.js';
import { BOTS, type BotPersona } from './personas.js';
import { raidWarning } from './defence.js';

/**
 * BOT MOON HABITS (Ay F8, plan §10.1; S53, S54).
 *
 * Locked rule: bots must use moons through the exact same services and information horizon as people.
 * Never peeking at unwarned incoming raids, hidden moon rarities, or hidden fleets standing on moons.
 */

export interface BotMoonSeat {
  readonly playerId: string;
  readonly planetId: string;
  readonly seasonId: string;
}

const RARITY_STRIKE_BONUS: Record<MoonRarity, number> = {
  COMMON: 0,
  RARE: 150,
  EPIC: 350,
  LEGENDARY: 700,
};

/**
 * Target priority for a Death Star moon strike, computed strictly from what a human can see:
 * public distance, public effective cracks (S53), and rarity ONLY when already discovered via
 * probe / battle / Gözcü memory. An undiscovered Legendary scores identically to an undiscovered Common.
 */
export function scoreMoonStrikeTarget(input: {
  readonly distance: number;
  readonly cracks: number;
  readonly knownRarity: MoonRarity | undefined;
}): number {
  const rarityBonus = input.knownRarity ? RARITY_STRIKE_BONUS[input.knownRarity] : 0;
  return 1_000 - input.distance * 0.25 + input.cracks * 120 + rarityBonus;
}

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
    log.error({ err, label }, 'bot moon step failed');
    return false;
  }
}

const storeReserve = (view: PlanetView): number => view.planet.alloyPerHour * BOTS.stockReserveHours;

const canAfford = (
  view: PlanetView,
  cost: { alloy: number; crystal: number; deuterium: number },
  reserve = 0,
): boolean =>
  view.planet.alloy - cost.alloy >= reserve
  && view.planet.crystal - cost.crystal >= 0
  && view.planet.deuterium - cost.deuterium >= 0;

/** Trim a mobile fleet to fit within `maxBulk` hangar load. Prospectors and ground guns never hop. */
function fitMobileBulk(fleet: Fleet, maxBulk: number): Fleet {
  if (maxBulk <= 0) return {};
  const out: Fleet = {};
  let remaining = maxBulk;
  for (const hull of MOBILE_HULLS) {
    const held = fleet[hull] ?? 0;
    if (held <= 0) continue;
    const bulk = hullBulk(hull);
    const take = Math.min(held, Math.floor(remaining / bulk));
    if (take <= 0) continue;
    out[hull] = take;
    remaining -= take * bulk;
  }
  return out;
}

/**
 * Research `LUNAR_CAPTURE` at Core 9+ and then queue a Common moon on the bot's capital.
 * Staggered by `persona.moon.captureChance` so bots do not all queue on the same tick.
 */
export async function tendMoonCaptureAndBuild(
  db: Db, clock: Clock, seat: BotMoonSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<PlanetView> {
  if (!await seasonHasMoons(db, seat.seasonId)) return view;
  if (view.buildings.CORE < MOON.capture.requiredCore) return view;

  const hasCapture = await holdsLunarCapture(db, seat.playerId);
  if (!hasCapture) {
    if (view.researchQueue.length >= BUILD.queueDepth) return view;
    if (view.researchQueue.some((order) => order.projectId === 'LUNAR_CAPTURE')) return view;
    if (!canAfford(view, MOON.capture.cost, storeReserve(view))) return view;
    if (rng() >= persona.moon.captureChance) return view;
    await attempt(did, 'research:LUNAR_CAPTURE', log, async () => {
      view = (await completeResearch(db, seat.planetId, 'LUNAR_CAPTURE', clock, seat.playerId)).planet;
    });
    return view;
  }

  if (view.queues.CONSTRUCTION.length >= BUILD.queueDepth) return view;
  if (view.queues.CONSTRUCTION.some((order) => order.kind === 'MOON')) return view;
  const [existing] = await db.select({ planetId: moons.planetId }).from(moons)
    .where(eq(moons.planetId, seat.planetId));
  if (existing) return view;
  if (!canAfford(view, { ...MOON.build.cost, deuterium: 0 }, storeReserve(view))) return view;
  if (rng() >= persona.moon.captureChance) return view;

  await attempt(did, 'moon:build', log, async () => {
    view = (await orderMoon(db, seat.planetId, clock, seat.playerId)).planet;
  });
  return view;
}

/**
 * Check ONLY the commander's own `incoming_fleet` radar warnings (information parity).
 * If a warned raid is headed for the planet and outmatches or threatens the garrison, hop mobile
 * ships up to the moon. When the sky is clear and ships sit on the moon, bring them back down.
 */
export async function maybeEscapeToMoon(
  db: Db, clock: Clock, seat: BotMoonSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<PlanetView> {
  if (!await seasonHasMoons(db, seat.seasonId)) return view;
  const [moon] = await db.select({ planetId: moons.planetId }).from(moons)
    .where(eq(moons.planetId, seat.planetId));
  if (!moon) return view;

  // Its own radar warnings only (information parity); the same reading the turn's defence uses.
  const { warned: threatOnPlanet, outmatched } = await raidWarning(db, seat.playerId, seat.planetId, view);

  if (threatOnPlanet) {
    if (!outmatched || rng() >= persona.moon.escapeChance) return view;
    const room = await moonDockRoom(db, seat.planetId);
    const wing = fitMobileBulk(view.fleet, room);
    if (fleetCount(wing) === 0) return view;
    if (await attempt(did, 'moon:hop-up', log, () =>
      hopFleet(db, seat.playerId, seat.planetId, 'UP', wing, clock))) {
      return db.transaction((tx) => planetView(tx, seat.planetId, clock));
    }
    return view;
  }

  // No warned threat on the planet: bring any mobile ships sitting on the moon back down.
  const moonRows = await db.select({ hull: units.hull, count: units.count }).from(units)
    .where(and(eq(units.planetId, seat.planetId), eq(units.location, MOON_LOCATION), gt(units.count, 0)));
  const onMoon: Fleet = {};
  for (const row of moonRows) {
    if (MOBILE_HULLS.some((h) => h === row.hull)) onMoon[row.hull] = row.count;
  }
  if (fleetCount(onMoon) === 0) return view;
  await attempt(did, 'moon:hop-down', log, () =>
    hopFleet(db, seat.playerId, seat.planetId, 'DOWN', onMoon, clock));
  return view;
}

/**
 * If this commander owns ≥2 open, charged moons and one holds mobile ships, jump reinforcements
 * to the capital moon via the Moon Gate.
 */
export async function maybeReinforceByGate(
  db: Db, clock: Clock, seat: BotMoonSeat, persona: BotPersona,
  did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  if (!await seasonHasMoons(db, seat.seasonId)) return;
  if (rng() >= persona.moon.reinforceChance) return;

  const now = clock.now();
  const ownedMoons = await db.select({
    planetId: moons.planetId,
    rarity: moons.rarity,
    gateReadyAt: moons.gateReadyAt,
    closedUntil: moons.closedUntil,
  })
    .from(moons)
    .innerJoin(planets, eq(planets.id, moons.planetId))
    .where(eq(planets.controllerPlayerId, seat.playerId));

  const ready = ownedMoons.filter((m) =>
    (!m.closedUntil || m.closedUntil <= now) && (!m.gateReadyAt || m.gateReadyAt <= now));
  const dest = ready.find((m) => m.planetId === seat.planetId);
  if (!dest || ready.length < 2) return;

  const destRoom = await moonDockRoom(db, dest.planetId);
  if (destRoom <= 0) return;

  for (const src of ready) {
    if (src.planetId === dest.planetId) continue;
    const rows = await db.select({ hull: units.hull, count: units.count }).from(units)
      .where(and(eq(units.planetId, src.planetId), eq(units.location, MOON_LOCATION), gt(units.count, 0)));
    const standing: Fleet = {};
    for (const row of rows) standing[row.hull] = row.count;
    const cap = jumpCapacity(src.rarity, destRoom);
    const wing = fitMobileBulk(standing, cap);
    if (fleetCount(wing) === 0) continue;
    if (await attempt(did, 'moon:jump', log, () =>
      jumpFleet(db, seat.playerId, src.planetId, dest.planetId, wing, clock))) {
      return;
    }
  }
}

/**
 * Run a Gözcü scan from this commander's moon on a remembered world within `scanRange`.
 * Reads only the commander's own moon and remembered worlds (information parity).
 */
export async function maybeScanFromMoon(
  db: Db, clock: Clock, seat: BotMoonSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  if (!await seasonHasMoons(db, seat.seasonId)) return;
  if (view.planet.deuterium < MOON.scanCost.deuterium * 2) return;
  if (rng() >= persona.moon.scanChance) return;

  const now = clock.now();
  const [moon] = await db.select({ rarity: moons.rarity, closedUntil: moons.closedUntil })
    .from(moons).where(eq(moons.planetId, seat.planetId));
  if (!moon || (moon.closedUntil && moon.closedUntil > now)) return;

  const known = await rememberedWorlds(db, seat.playerId);
  const knownIds = [...known.keys()];
  if (knownIds.length === 0) return;

  const range = scanRange(moon.rarity);
  const worlds = await db.select({
    id: planets.id, x: planets.x, y: planets.y, z: planets.z, controllerPlayerId: planets.controllerPlayerId,
  }).from(planets).where(and(
    eq(planets.seasonId, seat.seasonId),
    inArray(planets.id, knownIds),
    ne(planets.id, seat.planetId),
  ));

  const inRange = worlds
    .filter((w) => w.controllerPlayerId !== seat.playerId && w.controllerPlayerId !== null)
    .map((w) => ({ id: w.id, d: distance(view.planet.position, w) }))
    .filter((w) => w.d <= range)
    .sort((a, b) => a.d - b.d);

  const pick = inRange[0];
  if (!pick) return;
  await attempt(did, 'moon:scan', log, () =>
    scanFromMoon(db, seat.playerId, seat.planetId, pick.id, clock));
}

/**
 * Rarely retarget an in-flight single raid from `PLANET` to `MOON` when the target has a public moon.
 * Reads only public moon existence (S53), never hidden moon fleets or hidden rarities.
 */
export async function maybeRetargetToMoon(
  db: Db, clock: Clock, seat: BotMoonSeat, persona: BotPersona,
  did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  if (!await seasonHasMoons(db, seat.seasonId)) return;
  if (rng() >= persona.moon.retargetChance) return;

  const now = clock.now();
  const raids = await db.select({
    id: missions.id, targetPlanetId: missions.targetPlanetId, arriveAt: missions.arriveAt,
  }).from(missions).where(and(
    eq(missions.ownerPlayerId, seat.playerId),
    eq(missions.kind, 'attack'),
    eq(missions.status, 'in_flight'),
    eq(missions.targetBody, 'PLANET'),
    isNull(missions.recalledAt),
    isNull(missions.parentMissionId),
    gt(missions.arriveAt, now),
  ));
  if (raids.length === 0) return;

  const targetIds = [...new Set(raids.map((r) => r.targetPlanetId))];
  const targetMoons = await db.select({ planetId: moons.planetId }).from(moons)
    .where(inArray(moons.planetId, targetIds));
  const withMoon = new Set(targetMoons.map((m) => m.planetId));

  const candidate = raids.find((r) => withMoon.has(r.targetPlanetId));
  if (!candidate) return;
  await attempt(did, 'moon:retarget', log, () =>
    retargetAttack(db, seat.playerId, candidate.id, 'MOON', clock));
}

/**
 * Aggressive personas holding a READY Death Star may strike a public moon (including neutral seeded
 * moons, S54). Target scoring uses ONLY public distance/cracks and rarity remembered in
 * `probeWorldMemories` — never reading `moons.rarity` directly (S53 information parity).
 */
export async function maybeStrikeMoon(
  db: Db, clock: Clock, seat: BotMoonSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<void> {
  if (!await seasonHasMoons(db, seat.seasonId)) return;
  if (persona.moon.strikeMoonChance <= 0 || rng() >= persona.moon.strikeMoonChance) return;

  const [readyDs] = await db.select({ id: strategicAssets.id }).from(strategicAssets).where(and(
    eq(strategicAssets.planetId, seat.planetId),
    eq(strategicAssets.type, 'DEATH_STAR'),
    eq(strategicAssets.status, 'READY'),
  )).limit(1);
  if (!readyDs) return;

  const now = clock.now();
  // Select ONLY public moon fields (existence, cracks, lastHitAt) — never `moons.rarity`.
  const publicMoons = await db.select({
    planetId: moons.planetId,
    cracks: moons.cracks,
    lastHitAt: moons.lastHitAt,
    x: planets.x,
    y: planets.y,
    z: planets.z,
    controllerPlayerId: planets.controllerPlayerId,
  })
    .from(moons)
    .innerJoin(planets, eq(planets.id, moons.planetId))
    .where(and(eq(planets.seasonId, seat.seasonId), ne(planets.id, seat.planetId)));

  const eligible = publicMoons.filter((m) => m.controllerPlayerId !== seat.playerId);
  if (eligible.length === 0) return;

  const memories = await db.select({
    planetId: probeWorldMemories.targetPlanetId,
    silhouette: probeWorldMemories.silhouette,
  }).from(probeWorldMemories).where(and(
    eq(probeWorldMemories.observerPlayerId, seat.playerId),
    isNull(probeWorldMemories.invalidatedAt),
    inArray(probeWorldMemories.targetPlanetId, eligible.map((m) => m.planetId)),
  ));
  const knownRarityByWorld = new Map<string, MoonRarity>();
  for (const mem of memories) {
    if (mem.silhouette.moonRarity) knownRarityByWorld.set(mem.planetId, mem.silhouette.moonRarity);
  }

  const ranked = eligible
    .map((m) => ({
      planetId: m.planetId,
      score: scoreMoonStrikeTarget({
        distance: distance(view.planet.position, m),
        cracks: effectiveCracks({ cracks: m.cracks, lastHitAtMs: m.lastHitAt?.getTime() ?? null }, now.getTime()),
        knownRarity: knownRarityByWorld.get(m.planetId),
      }),
    }))
    .sort((a, b) => b.score - a.score);

  for (const pick of ranked.slice(0, 3)) {
    if (await attempt(did, 'moon:death-star', log, () =>
      launchDeathStar(db, seat.planetId, pick.planetId, clock, seat.playerId, false, new Set(), 'MOON'))) {
      return;
    }
  }
}

/** Run all moon-related steps for a bot turn, gated cleanly on `seasonHasMoons`. */
export async function tendBotMoon(
  db: Db, clock: Clock, seat: BotMoonSeat, persona: BotPersona,
  view: PlanetView, did: string[], log: FastifyBaseLogger, rng: () => number,
): Promise<PlanetView> {
  if (!await seasonHasMoons(db, seat.seasonId)) return view;
  view = await maybeEscapeToMoon(db, clock, seat, persona, view, did, log, rng);
  await maybeReinforceByGate(db, clock, seat, persona, did, log, rng);
  view = await tendMoonCaptureAndBuild(db, clock, seat, persona, view, did, log, rng);
  await maybeRetargetToMoon(db, clock, seat, persona, did, log, rng);
  await maybeScanFromMoon(db, clock, seat, persona, view, did, log, rng);
  await maybeStrikeMoon(db, clock, seat, persona, view, did, log, rng);
  return view;
}
