import { and, eq, sql } from 'drizzle-orm';
import {
  MOBILE_HULLS,
  MOON,
  dockFree,
  fleetCount,
  hangarLoad,
  type Fleet,
  type HpDamageLot,
  type WorldBody,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { missions, moonMoves, moons, notifications, planets, units } from '../db/schema.js';
import { publish } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { arrivalPending, assertNoArrivalPending, readHomeHealth, selectHomeDispatch, writeHomeHealth } from './homeHealth.js';
import { assertMoonTarget, seasonHasMoons } from './moon.js';
import { lockWorlds, safeHomePlanet } from './ownership.js';
import { GameError, assertWorldOperational, loadLocked, setUnits } from './planet.js';
import { MOON_LOCATION, bodyLocation, hopLocation } from './unitLocation.js';
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
const DESTINATION: Record<MoonMove['kind'], WorldBody> = { HOP_UP: 'MOON', HOP_DOWN: 'PLANET' };

export async function hopFleet(
  db: Db, playerId: string, planetId: string, direction: HopDirection, requested: Readonly<Record<string, number>>, clock: Clock,
): Promise<MoonMove> {
  return db.transaction(async (tx) => {
    await lockWorlds(tx, [planetId]);
    const world = await loadLocked(tx, planetId, clock);
    if (world.playerId !== playerId) throw new GameError('PLANET_NOT_OWNED', 'This world is not yours', 403);
    assertWorldOperational(world);
    if (!await seasonHasMoons(tx, world.seasonId)) throw new GameError('MOONS_DISABLED', 'This galaxy has no moons', 409);
    const [moon] = await tx.select().from(moons).where(eq(moons.planetId, planetId));
    if (!moon) throw new GameError('NO_MOON', 'This world has no moon', 409);

    const fleet: Fleet = {};
    for (const [hull, n] of Object.entries(requested)) {
      if (n <= 0) continue;
      const mobile = MOBILE_HULLS.find((id) => id === hull);
      if (!mobile) throw new GameError('HULL_CANNOT_HOP', 'Emplacements and Prospectors stay on the planet', 400);
      fleet[mobile] = n;
    }
    if (fleetCount(fleet) === 0) throw new GameError('EMPTY_FLEET', 'Send at least one ship', 400);
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
    await publishWatchChanges(tx, [planetId]);
    return move!;
  });
}

/** The hop lands. Battles first (E2); a vanished moon lands on the planet; a lost world lands at the owner's safe home. */
export async function landMoonMove(tx: Tx, moveId: string, now: Date): Promise<void> {
  const [peek] = await tx.select({ planetId: moonMoves.toPlanetId }).from(moonMoves).where(eq(moonMoves.id, moveId));
  if (!peek) return;
  await lockWorlds(tx, [peek.planetId], { requireLive: false });
  const [move] = await tx.select().from(moonMoves).where(eq(moonMoves.id, moveId)).for('update');
  if (move?.status !== 'PENDING') return;
  const [world] = await tx.select().from(planets).where(eq(planets.id, move.toPlanetId));
  let destination = DESTINATION[move.kind];
  let status: MoonMove['status'] = 'LANDED';
  let landingPlanetId = move.toPlanetId;

  if (world?.controllerPlayerId !== move.ownerPlayerId) {
    // The world changed hands while the fleet hopped: it comes down at its owner's safe home (V36).
    landingPlanetId = await safeHomePlanet(tx, move.ownerPlayerId, move.fromPlanetId);
    destination = 'PLANET';
    status = 'RETURNED';
  } else {
    if (destination === 'MOON' && (await tx.select({ id: moons.planetId }).from(moons).where(eq(moons.planetId, move.toPlanetId))).length === 0) {
      destination = 'PLANET';
      status = 'RETURNED';
    }
    // E2: a battle due on the body it lands on is fought first; the hop comes down a second later.
    if (await arrivalPending(tx, move.toPlanetId, now, destination)) {
      await schedule(tx, { seasonId: move.seasonId, kind: 'moon_move_land', refId: move.id, resolveAt: new Date(now.getTime() + 1_000) });
      return;
    }
  }

  await tx.delete(units).where(and(eq(units.planetId, move.toPlanetId), eq(units.location, hopLocation(move.id))));
  await placeAt(tx, landingPlanetId, move.ownerPlayerId, bodyLocation(destination), move.fleet, move.damage);
  await tx.update(moonMoves).set({ status }).where(eq(moonMoves.id, move.id));
  await publishWatchChanges(tx, [...new Set([move.toPlanetId, landingPlanetId])]);
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
  tx: Tx, input: { planetId: string; ownerPlayerId: string; fleet: Fleet; damage: readonly HpDamageLot[] | null },
): Promise<boolean> {
  if (hangarLoad(input.fleet) > await moonDockRoom(tx, input.planetId)) return false;
  await placeAt(tx, input.planetId, input.ownerPlayerId, MOON_LOCATION, input.fleet, input.damage ?? []);
  return true;
}

/** Bulk already on its way up to this moon: it holds dock room from the moment it leaves (§6.5). */
async function inboundLoad(tx: Queryable, planetId: string): Promise<number> {
  const rows = await tx.select({ fleet: moonMoves.fleet }).from(moonMoves)
    .where(and(eq(moonMoves.toPlanetId, planetId), eq(moonMoves.kind, 'HOP_UP'), eq(moonMoves.status, 'PENDING')));
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
export async function retargetAttack(
  db: Db, playerId: string, missionId: string, body: WorldBody, clock: Clock,
): Promise<{ id: string; targetBody: WorldBody; arriveAt: Date }> {
  return db.transaction(async (tx) => {
    const now = clock.now();
    const [mission] = await tx.select().from(missions).where(eq(missions.id, missionId)).for('update');
    if (!mission) throw new GameError('NOT_FOUND', 'That flight no longer exists', 404);
    if (mission.ownerPlayerId !== playerId) throw new GameError('PLANET_NOT_OWNED', 'That is not your flight', 403);
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

    if (target.controllerPlayerId) {
      const [warned] = await tx.select({ id: notifications.id }).from(notifications).where(and(
        eq(notifications.playerId, target.controllerPlayerId),
        eq(notifications.kind, 'incoming_fleet'),
        eq(notifications.refId, mission.id),
      )).limit(1);
      if (warned) await publish(tx, target.controllerPlayerId, 'retarget');
    }
    return view(body);
  });
}
