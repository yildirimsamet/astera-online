import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  MOBILE_HULLS,
  MOON,
  distance,
  dockFree,
  fleetCount,
  fleetEntries,
  gateChargeMs,
  hangarLoad,
  honorFuelCost,
  jumpCapacity,
  jumpFuel,
  type Fleet,
  type HpDamageLot,
  type WorldBody,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { missions, moonMoves, moons, notifications, planets, units } from '../db/schema.js';
import { publish, publishMoonMove, publishShard } from '../stream/bus.js';
import { settlePlanetRadiationAt } from './planetRadiation.js';
import { schedule } from '../worker/queue.js';
import { arrivalPending, assertNoArrivalPending, readHomeHealth, selectHomeDispatch, writeHomeHealth } from './homeHealth.js';
import { assertMoonTarget, seasonHasMoons } from './moon.js';
import { lockWorlds, safeHomePlanet } from './ownership.js';
import { assertFuel } from './fuel.js';
import { readHonorBenefits } from './honorBenefits.js';
import { landingBlock } from './movement.js';
import { notify } from './notifications.js';
import { GameError, assertWorldOperational, loadLocked, lockSeason, saveResources, setUnits } from './planet.js';
import { MOON_LOCATION, bodyLocation, hopLocation } from './unitLocation.js';
import { markProgress } from './waitingRoom.js';
import { publishWatchChanges } from './watchEvents.js';

/**
 * PLANET ↔ MOON HOPS (ay entegrasyon planı §6.5, §6.6; S13, S37, V3).
 *
 * A hop never leaves its world: it is not a mission, nobody else sees it as traffic, and the Hangar does
 * not move. For 90 seconds its ships stand at `hop:<id>`, on neither body, so neither body's battle can
 * reach them.
 */
export type HopDirection = 'UP' | 'DOWN';
export type MoonMove = typeof moonMoves.$inferSelect;

const KIND = { UP: 'HOP_UP', DOWN: 'HOP_DOWN' } as const;
const ORIGIN: Record<HopDirection, WorldBody> = { UP: 'PLANET', DOWN: 'MOON' };
const DESTINATION: Record<MoonMove['kind'], WorldBody> = { HOP_UP: 'MOON', HOP_DOWN: 'PLANET', JUMP: 'MOON' };

export async function hopFleetTx(
  tx: Tx, playerId: string, planetId: string, direction: HopDirection, requested: Readonly<Record<string, number>>, clock: Clock,
): Promise<MoonMove> {
  await lockWorlds(tx, [planetId]);
  const world = await loadLocked(tx, planetId, clock);
  if (world.playerId !== playerId) throw new GameError('PLANET_NOT_OWNED', 'This world is not yours', 403);
  assertWorldOperational(world);
  if (!await seasonHasMoons(tx, world.seasonId)) throw new GameError('MOONS_DISABLED', 'This galaxy has no moons', 409);
  const [moon] = await tx.select().from(moons).where(eq(moons.planetId, planetId));
  if (!moon) throw new GameError('NO_MOON', 'This world has no moon', 409);

  const fleet = mobileFleet(requested);
  const kind = KIND[direction];
  const [pending] = await tx.select({ id: moonMoves.id }).from(moonMoves)
    .where(and(eq(moonMoves.fromPlanetId, planetId), eq(moonMoves.kind, kind), eq(moonMoves.status, 'PENDING'))).limit(1);
  if (pending) throw new GameError('HOP_PENDING', 'A hop this way is already under way', 409);

  const origin = ORIGIN[direction];
  // K12 holds only the body the attack reached (E3): a raid due on the moon keeps the moon's ships.
  await assertNoArrivalPending(tx, planetId, world.now, origin);
  if (direction === 'UP') {
    if (hangarLoad(fleet) > await moonDockRoom(tx, planetId)) throw new GameError('DOCK_FULL', 'The moon’s dock has no room for this fleet', 409);
  }

  const standing = await readHomeHealth(tx, planetId, origin);
  assertAvailable(origin === 'MOON' ? remainderOf(standing.fleet, await reservedOnMoon(tx, planetId)) : standing.fleet, fleet);
  const selected = selectHomeDispatch(standing.fleet, standing.damage, fleet);
  await setUnits(tx, planetId, subtract(standing.fleet, fleet), bodyLocation(origin), playerId);
  await writeHomeHealth(tx, planetId, selected.remaining, selected.remainingDamage, origin);

  const arriveAt = new Date(world.now.getTime() + MOON.hopSeconds * 1000);
  const [move] = await tx.insert(moonMoves).values({
    seasonId: world.seasonId, ownerPlayerId: playerId, kind, fromPlanetId: planetId, toPlanetId: planetId,
    fleet, damage: selected.selectedDamage, departAt: world.now, arriveAt,
  }).returning();
  await placeAt(tx, planetId, playerId, hopLocation(move!.id), fleet, selected.selectedDamage);
  await schedule(tx, { seasonId: world.seasonId, kind: 'moon_move_land', refId: move!.id, resolveAt: arriveAt });
  await markProgress(tx, playerId, world.now); // V55: every moon order restarts the Silent Space clock
  await publishWatchChanges(tx, [planetId]);
  return move!;
}

export async function hopFleet(
  db: Db, playerId: string, planetId: string, direction: HopDirection, requested: Readonly<Record<string, number>>, clock: Clock,
): Promise<MoonMove> {
  return db.transaction((tx) => hopFleetTx(tx, playerId, planetId, direction, requested, clock));
}

/** The hop lands. Battles first (E2); a vanished moon lands on the planet; a lost world lands at the owner's safe home. */
export async function landMoonMove(tx: Tx, moveId: string, now: Date): Promise<void> {
  const [peek] = await tx.select({ from: moonMoves.fromPlanetId, to: moonMoves.toPlanetId }).from(moonMoves).where(eq(moonMoves.id, moveId));
  if (!peek) return;
  await lockWorlds(tx, [peek.from, peek.to], { requireLive: false });
  const [move] = await tx.select().from(moonMoves).where(eq(moonMoves.id, moveId)).for('update');
  if (move?.status !== 'PENDING') return;
  if (move.kind === 'JUMP') { await finishJump(tx, move, now); return; }
  const [world] = await tx.select().from(planets).where(eq(planets.id, move.toPlanetId));
  let destination = DESTINATION[move.kind];
  let status: MoonMove['status'] = 'LANDED';
  let landingPlanetId = move.toPlanetId;

  if (world?.controllerPlayerId !== move.ownerPlayerId) {
    // The world changed hands while the fleet hopped: it comes down at its owner's safe home (V36).
    landingPlanetId = await safeHomePlanet(tx, move.ownerPlayerId, move.fromPlanetId);
    if (landingPlanetId !== move.toPlanetId && landingPlanetId !== move.fromPlanetId) {
      await lockWorlds(tx, [landingPlanetId], { requireLive: false });
    }
    destination = 'PLANET';
    status = 'RETURNED';
  } else if (destination === 'MOON' && (await tx.select({ id: moons.planetId }).from(moons).where(eq(moons.planetId, move.toPlanetId))).length === 0) {
    destination = 'PLANET';
    status = 'RETURNED';
  }
  // E2: a battle due on the body it lands on is fought first; the hop comes down a second later.
  if (await arrivalPending(tx, landingPlanetId, now, destination)) {
    await schedule(tx, { seasonId: move.seasonId, kind: 'moon_move_land', refId: move.id, resolveAt: new Date(now.getTime() + 1_000) });
    return;
  }

  await tx.delete(units).where(and(eq(units.planetId, move.toPlanetId), eq(units.location, hopLocation(move.id))));
  // The world's dose is closed first, so ships just landing pay only from now (Ay S45).
  await settlePlanetRadiationAt(tx, landingPlanetId, now);
  await placeAt(tx, landingPlanetId, move.ownerPlayerId, bodyLocation(destination), move.fleet, move.damage);
  await tx.update(moonMoves).set({ status }).where(eq(moonMoves.id, move.id));
  await publishWatchChanges(tx, [...new Set([move.toPlanetId, landingPlanetId])]);
  await publishMoonMove(tx, move.ownerPlayerId);
}

/** The body a leg comes down on: its target, or the body it left when it was turned around (S34). */
export const landingBodyOf = (leg: { recalledAt: Date | null; originBody: WorldBody; targetBody: WorldBody }): WorldBody =>
  leg.recalledAt !== null ? leg.originBody : leg.targetBody;

/** Free dock on this moon, in hangar bulk, after what stands on it and what is hopping up to it (S12). */
export async function moonDockRoom(tx: Queryable, planetId: string): Promise<number> {
  const [moon] = await tx.select({ rarity: moons.rarity }).from(moons).where(eq(moons.planetId, planetId));
  if (!moon) return 0;
  return dockFree(moon.rarity, hangarLoad((await readHomeHealth(tx, planetId, 'MOON')).fleet), await inboundLoad(tx, planetId));
}

/**
 * A FLIGHT COMES DOWN ON THE MOON (S34, S50, V9) when the moon still stands and its dock has room for the
 * whole wing; otherwise it returns false and the caller lands it on the planet. A moon has no Repair
 * Station: the wounded keep their wounds up there.
 */
export async function landOnMoon(
  tx: Tx, input: { planetId: string; ownerPlayerId: string; fleet: Fleet; damage: readonly HpDamageLot[] | null; at: Date },
): Promise<boolean> {
  if (hangarLoad(input.fleet) > await moonDockRoom(tx, input.planetId)) return false;
  // The moon's dose is closed first, so the ships landing pay only from now (Ay S45).
  await settlePlanetRadiationAt(tx, input.planetId, input.at);
  await placeAt(tx, input.planetId, input.ownerPlayerId, MOON_LOCATION, input.fleet, input.damage ?? []);
  return true;
}

/** Bulk already on its way up to this moon: it holds dock room from the moment it leaves (§6.5). */
async function inboundLoad(tx: Queryable, planetId: string): Promise<number> {
  const rows = await tx.select({ fleet: moonMoves.fleet }).from(moonMoves)
    .where(and(eq(moonMoves.toPlanetId, planetId), inArray(moonMoves.kind, ['HOP_UP', 'JUMP']), eq(moonMoves.status, 'PENDING')));
  return rows.reduce((sum, row) => sum + hangarLoad(row.fleet), 0);
}

/** Add ships and their wounds to a location, merging into whatever already stands there. */
async function placeAt(
  tx: Tx, planetId: string, ownerPlayerId: string, location: string, fleet: Fleet, damage: readonly HpDamageLot[],
): Promise<void> {
  for (const [hull, count] of Object.entries(fleet) as [keyof Fleet, number][]) {
    if (count <= 0) continue;
    const wounds = damage.filter((lot) => lot.hull === hull);
    await tx.insert(units).values({ planetId, ownerPlayerId, hull, location, count, damage: wounds }).onConflictDoUpdate({
      target: [units.planetId, units.hull, units.location],
      set: { count: sql`${units.count} + excluded.count`, damage: sql`${units.damage} || excluded.damage` },
    });
  }
}

/** What stays of each hull that leaves; `setUnits` writes absolute counts. */
function subtract(from: Fleet, take: Fleet): Fleet {
  const out: Fleet = {};
  for (const [hull, n] of Object.entries(take) as [keyof Fleet, number][]) out[hull] = (from[hull] ?? 0) - n;
  return out;
}

/**
 * THE ATTACKER SWITCHES THE RAID BETWEEN PLANET AND MOON (S13, plan §6.8). Open until the arrival
 * instant — the battle begins there, and so does K12 (E1: the row is locked, a millisecond before is
 * accepted, the instant itself is not). Single raids only (V7); switches stand five seconds apart (V2).
 *
 * A defender whose radar already caught the raid is told at once: the strip and the timed warning read
 * the body from this row. One that has not been warned hears nothing (S24).
 */
export async function retargetAttackTx(
  tx: Tx, playerId: string, missionId: string, body: WorldBody, clock: Clock,
): Promise<{ id: string; targetBody: WorldBody; arriveAt: Date }> {
  const now = clock.now();
  const [mission] = await tx.select().from(missions).where(eq(missions.id, missionId)).for('update');
  if (!mission) throw new GameError('NOT_FOUND', 'That flight no longer exists', 404);
  if (mission.ownerPlayerId !== playerId) throw new GameError('PLANET_NOT_OWNED', 'That is not your flight', 403);
  await lockSeason(tx, mission.seasonId);
  if (mission.kind !== 'attack' || mission.status !== 'in_flight' || mission.recalledAt !== null || mission.parentMissionId !== null) {
    throw new GameError('NOT_RETARGETABLE', 'Only a raid on its way out can switch between planet and moon', 409);
  }
  if (now >= mission.arriveAt) throw new GameError('RETARGET_CLOSED', 'The battle has already begun', 409);
  const view = (targetBody: WorldBody) => ({ id: mission.id, targetBody, arriveAt: mission.arriveAt });
  if (body === mission.targetBody) return view(body);
  if (mission.retargetedAt && now.getTime() - mission.retargetedAt.getTime() < MOON.retargetSpacingSeconds * 1_000) {
    throw new GameError('RETARGET_TOO_SOON', 'Hold the course a moment before switching again', 409);
  }
  const [target] = await tx.select({ id: planets.id, seasonId: planets.seasonId, kind: planets.kind, controllerPlayerId: planets.controllerPlayerId })
    .from(planets).where(eq(planets.id, mission.targetPlanetId));
  if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
  if (body === 'MOON') await assertMoonTarget(tx, target);
  await tx.update(missions).set({ targetBody: body, retargetedAt: now }).where(eq(missions.id, mission.id));
  await markProgress(tx, playerId, now); // V55: every moon order restarts the Silent Space clock

  if (target.controllerPlayerId) {
    const [warned] = await tx.select({ id: notifications.id }).from(notifications).where(and(
      eq(notifications.playerId, target.controllerPlayerId),
      eq(notifications.kind, 'incoming_fleet'),
      eq(notifications.refId, mission.id),
    )).limit(1);
    if (warned) {
      await tx.update(notifications)
        .set({ payload: sql`jsonb_set(${notifications.payload}, '{targetBody}', to_jsonb(${body}::text), true)` })
        .where(eq(notifications.id, warned.id));
      await publish(tx, target.controllerPlayerId, 'retarget');
    }
  }
  return view(body);
}

export async function retargetAttack(
  db: Db, playerId: string, missionId: string, body: WorldBody, clock: Clock,
): Promise<{ id: string; targetBody: WorldBody; arriveAt: Date }> {
  return db.transaction((tx) => retargetAttackTx(tx, playerId, missionId, body, clock));
}

/** Mobile hulls only, positive counts only; anything else is refused (S37). */
function mobileFleet(requested: Readonly<Record<string, number>>): Fleet {
  const fleet: Fleet = {};
  for (const [hull, n] of Object.entries(requested)) {
    if (n <= 0) continue;
    const mobile = MOBILE_HULLS.find((id) => id === hull);
    if (!mobile) throw new GameError('HULL_CANNOT_HOP', 'Emplacements and Prospectors stay on the planet', 400);
    fleet[mobile] = n;
  }
  if (fleetCount(fleet) === 0) throw new GameError('EMPTY_FLEET', 'Send at least one ship', 400);
  return fleet;
}

/** A raid or transfer leaving the moon may not take ships a pending jump holds (§4.1). */
export async function assertMoonShipsFree(tx: Queryable, planetId: string, standing: Fleet, fleet: Fleet): Promise<void> {
  assertAvailable(remainderOf(standing, await reservedOnMoon(tx, planetId)), fleet);
}

/** Everything in `from` with `take` removed (unlike `subtract`, which answers only for the hulls taken). */
function remainderOf(from: Fleet, take: Fleet): Fleet {
  const out: Fleet = { ...from };
  for (const [hull, n] of fleetEntries(take)) out[hull] = (out[hull] ?? 0) - n;
  return out;
}

function assertAvailable(available: Fleet, fleet: Fleet): void {
  for (const [hull, n] of fleetEntries(fleet)) {
    if ((available[hull] ?? 0) < n) throw new GameError('NOT_ENOUGH_SHIPS', `Not enough ${hull} here`, 400, { hull });
  }
}

/**
 * SHIPS THE GATE HAS TAKEN (§4.1). During its ten-second opening a jump's ships still stand on the departure
 * moon — they fight there (E4) — but nothing else may leave with them.
 */
export async function reservedOnMoon(tx: Queryable, planetId: string): Promise<Fleet> {
  const rows = await tx.select({ fleet: moonMoves.fleet }).from(moonMoves)
    .where(and(eq(moonMoves.fromPlanetId, planetId), eq(moonMoves.kind, 'JUMP'), eq(moonMoves.status, 'PENDING')));
  const reserved: Fleet = {};
  for (const row of rows) for (const [hull, n] of fleetEntries(row.fleet)) reserved[hull] = (reserved[hull] ?? 0) + n;
  return reserved;
}

/**
 * THE MOON GATE (S3, S12, S17, S18, S46, S49; plan §6.11). Between two of the commander's own moons: both
 * gates open and uncharged, the smaller moon is the bottleneck, the far world's Hangar has room, and the
 * departure planet pays the route's one-leg transfer fuel. Both gates start charging at once; the ships
 * cross when the ten-second opening ends.
 */
export async function jumpFleetTx(
  tx: Tx, playerId: string, fromPlanetId: string, toPlanetId: string, requested: Readonly<Record<string, number>>, clock: Clock,
): Promise<MoonMove> {
  if (fromPlanetId === toPlanetId) throw new GameError('SAME_MOON', 'Choose another of your moons', 400);
  const fleet = mobileFleet(requested);
  await lockWorlds(tx, [fromPlanetId, toPlanetId]);
  const origin = await loadLocked(tx, fromPlanetId, clock);
  if (origin.playerId !== playerId) throw new GameError('PLANET_NOT_OWNED', 'This world is not yours', 403);
  assertWorldOperational(origin);
  const target = await loadLocked(tx, toPlanetId, clock);
  if (target.playerId !== playerId) throw new GameError('PLANET_NOT_OWNED', 'That world is not yours', 403);
  assertWorldOperational(target);
  if (target.seasonId !== origin.seasonId) throw new GameError('CROSS_SEASON', 'Another galaxy', 403);
  if (!await seasonHasMoons(tx, origin.seasonId)) throw new GameError('MOONS_DISABLED', 'This galaxy has no moons', 409);
  const pair = await tx.select().from(moons).where(inArray(moons.planetId, [fromPlanetId, toPlanetId]));
  const here = pair.find((moon) => moon.planetId === fromPlanetId);
  const there = pair.find((moon) => moon.planetId === toPlanetId);
  if (!here || !there) throw new GameError('NO_MOON', 'Both worlds need a moon', 409);
  const now = origin.now;
  for (const gate of [here, there]) {
    if (gate.closedUntil && gate.closedUntil > now) throw new GameError('GATE_CLOSED', 'A struck moon’s gate is shut', 409);
    if (gate.gateReadyAt && gate.gateReadyAt > now) throw new GameError('GATE_CHARGING', 'A gate is still charging', 409);
  }
  await assertNoArrivalPending(tx, fromPlanetId, now, 'MOON');
  const standing = await readHomeHealth(tx, fromPlanetId, 'MOON');
  assertAvailable(remainderOf(standing.fleet, await reservedOnMoon(tx, fromPlanetId)), fleet);
  if (hangarLoad(fleet) > jumpCapacity(here.rarity, await moonDockRoom(tx, toPlanetId))) {
    throw new GameError('GATE_CAPACITY', 'The smaller moon cannot take this fleet in one jump', 409);
  }
  const blocked = await landingBlock(tx, toPlanetId, fleet);
  if (blocked) throw new GameError(blocked.code, blocked.message, 409, blocked.params);
  const benefits = await readHonorBenefits(tx, origin.seasonId, playerId);
  const fuel = honorFuelCost(jumpFuel(fleet, distance(origin, target)), benefits);
  assertFuel(fuel, origin.deuterium, 0);
  await saveResources(tx, fromPlanetId, { alloy: origin.alloy, crystal: origin.crystal, deuterium: origin.deuterium - fuel });

  const arriveAt = new Date(now.getTime() + MOON.gateOpenSeconds * 1_000);
  const [move] = await tx.insert(moonMoves).values({
    seasonId: origin.seasonId, ownerPlayerId: playerId, kind: 'JUMP', fromPlanetId, toPlanetId,
    fleet, fuelPaid: fuel, departAt: now, arriveAt,
  }).returning();
  await schedule(tx, { seasonId: origin.seasonId, kind: 'moon_move_land', refId: move!.id, resolveAt: arriveAt });
  for (const gate of [here, there]) {
    const readyAt = new Date(now.getTime() + gateChargeMs(gate.rarity));
    await tx.update(moons).set({ gateReadyAt: readyAt }).where(eq(moons.planetId, gate.planetId));
    await schedule(tx, { seasonId: origin.seasonId, kind: 'moon_gate_ready', refId: gate.planetId, resolveAt: readyAt });
  }
  await markProgress(tx, playerId, now); // V55: every moon order restarts the Silent Space clock
  await publishWatchChanges(tx, [fromPlanetId, toPlanetId]);
  // The departure flash (S16); who may see it is decided when the map is read.
  await publishShard(tx, origin.seasonId, 'moons');
  return move!;
}

export async function jumpFleet(
  db: Db, playerId: string, fromPlanetId: string, toPlanetId: string, requested: Readonly<Record<string, number>>, clock: Clock,
): Promise<MoonMove> {
  return db.transaction((tx) => jumpFleetTx(tx, playerId, fromPlanetId, toPlanetId, requested, clock));
}

/**
 * THE OPENING ENDS (§6.11, E4, E6, V8). Both worlds are locked. A far moon or world that is gone or no longer
 * the commander's cancels it: the ships stay, the fuel stays spent. A raid due on either moon is fought
 * first. Then whoever of the taken ships still stands crosses, with their own wounds.
 */
async function finishJump(tx: Tx, move: MoonMove, now: Date): Promise<void> {
  const worlds = await tx.select({ id: planets.id, controller: planets.controllerPlayerId }).from(planets)
    .where(inArray(planets.id, [move.fromPlanetId, move.toPlanetId]));
  const pair = await tx.select({ planetId: moons.planetId }).from(moons).where(inArray(moons.planetId, [move.fromPlanetId, move.toPlanetId]));
  const holds = (id: string) => worlds.find((world) => world.id === id)?.controller === move.ownerPlayerId;
  const hasMoon = (id: string) => pair.some((moon) => moon.planetId === id);
  const settle = async (status: MoonMove['status'], damage: readonly HpDamageLot[] = []) => {
    await tx.update(moonMoves).set({ status, damage: [...damage] }).where(eq(moonMoves.id, move.id));
    await publishWatchChanges(tx, [move.fromPlanetId, move.toPlanetId]);
    await publishMoonMove(tx, move.ownerPlayerId);
  };
  if (!hasMoon(move.fromPlanetId) || !holds(move.fromPlanetId)) { await settle('LOST'); return; }
  if (!hasMoon(move.toPlanetId) || !holds(move.toPlanetId)) { await settle('CANCELLED'); return; }
  if (await arrivalPending(tx, move.fromPlanetId, now, 'MOON') || await arrivalPending(tx, move.toPlanetId, now, 'MOON')) {
    await schedule(tx, { seasonId: move.seasonId, kind: 'moon_move_land', refId: move.id, resolveAt: new Date(now.getTime() + 1_000) });
    return;
  }
  // Close departure moon's radiation dose before ships leave (Ay S45).
  await settlePlanetRadiationAt(tx, move.fromPlanetId, now);
  const standing = await readHomeHealth(tx, move.fromPlanetId, 'MOON');
  const moved: Fleet = {};
  for (const [hull, n] of fleetEntries(move.fleet)) {
    const left = Math.min(n, standing.fleet[hull] ?? 0);
    if (left > 0) moved[hull] = left;
  }
  if (fleetCount(moved) === 0) { await settle('LOST'); return; }
  const selected = selectHomeDispatch(standing.fleet, standing.damage, moved);
  await setUnits(tx, move.fromPlanetId, subtract(standing.fleet, moved), MOON_LOCATION, move.ownerPlayerId);
  await writeHomeHealth(tx, move.fromPlanetId, selected.remaining, selected.remainingDamage, 'MOON');
  await settlePlanetRadiationAt(tx, move.toPlanetId, now);
  await placeAt(tx, move.toPlanetId, move.ownerPlayerId, MOON_LOCATION, moved, selected.selectedDamage);
  await settle('LANDED', selected.selectedDamage);
  // The arrival flash, for everybody (S32).
  await publishShard(tx, move.seasonId, 'moons');
}

/** A gate has charged (§6.11). Only if nothing re-armed it since, the moon is open, and only to whoever holds the moon now. */
export async function announceGateReady(tx: Tx, planetId: string, at: Date, eventId?: string): Promise<void> {
  const [row] = await tx.select({
    readyAt: moons.gateReadyAt, closedUntil: moons.closedUntil, holder: planets.controllerPlayerId, name: planets.name,
    seasonId: planets.seasonId,
  }).from(moons).innerJoin(planets, eq(planets.id, moons.planetId)).where(eq(moons.planetId, planetId));
  // A newer charge (or none) outlives this event: that charge announces itself.
  if (!row?.holder || !row.readyAt || row.readyAt.getTime() > at.getTime()) return;
  if (row.closedUntil && row.closedUntil > at) {
    // B6: charged while a Death Star hit has the moon shut — say so when it reopens, not never.
    await schedule(tx, {
      seasonId: row.seasonId, kind: 'moon_gate_ready', refId: planetId, resolveAt: row.closedUntil,
      dedupeKey: `moon_gate_reopen:${planetId}:${row.closedUntil.getTime()}`,
    });
    return;
  }
  await notify(tx, { playerId: row.holder, kind: 'moon_gate_ready', payload: { planetId, planetName: row.name }, at, refId: eventId ?? null });
}
