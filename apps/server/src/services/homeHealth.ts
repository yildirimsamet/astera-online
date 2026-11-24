import { bodyLocation } from './unitLocation.js';
import { and, eq, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { normalizeHpDamage, splitHealthFleet, type Fleet, type HpDamageLot, type HpDamageLots, type WorldBody } from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { clanWarMissions, missions, planets, units } from '../db/schema.js';
import { GameError } from './planet.js';

/** units remains the population authority; damage annotates a subset of each standing row. */
export async function readHomeHealth(
  tx: Queryable, planetId: string, body: WorldBody = 'PLANET',
): Promise<{ fleet: Fleet; damage: HpDamageLot[] }> {
  const rows = await tx.select().from(units).where(and(eq(units.planetId, planetId), eq(units.location, bodyLocation(body))));
  const fleet: Fleet = {};
  for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
  return { fleet, damage: normalizeHpDamage(fleet, rows.flatMap((row) => row.damage)) };
}

/** Caller owns the planet lock and updates physical counts in the same transaction. */
export async function writeHomeHealth(
  tx: Tx, planetId: string, fleet: Fleet, damage: HpDamageLots, body: WorldBody = 'PLANET',
): Promise<void> {
  const normalized = normalizeHpDamage(fleet, damage);
  const byHull: Record<string, HpDamageLot[]> = {};
  for (const lot of normalized) (byHull[lot.hull] ??= []).push({ hull: lot.hull, count: lot.count,
    damageBp: lot.damageBp, remainderBp: lot.remainderBp ?? 0 });
  const next = sql`coalesce(${JSON.stringify(byHull)}::jsonb -> ${units.hull}::text, '[]'::jsonb)`;
  await tx.update(units).set({ damage: next }).where(and(eq(units.planetId, planetId), eq(units.location, bodyLocation(body)),
    sql`${units.damage} is distinct from ${next}`));
}

/**
 * ONCE AN ATTACK HAS REACHED A WORLD, ITS SHIPS AND CARGO STAY. Owner decision K12, 2026-10-28.
 *
 * The battle is computed when the worker reaches it, so an owner could fly everything
 * out after the attack arrived and leave nothing to fight; the attacker's recall closes
 * at arrival for the same reason. Own and clanmates' flights are not hostile.
 */
export async function assertNoArrivalPending(tx: Queryable, planetId: string, now: Date, body: WorldBody = 'PLANET'): Promise<void> {
  if (await arrivalPending(tx, planetId, now, body)) {
    throw new GameError('ARRIVAL_PENDING', 'A battle has begun at this world; its fleet can leave once it ends', 409);
  }
}

/**
 * K12's reading, answered rather than thrown: a hop landing waits behind it (E2). By body (Ay §6.1): a raid
 * due on the moon holds the moon's ships, never the planet's, and the other way round.
 */
export async function arrivalPending(tx: Queryable, planetId: string, now: Date, body: WorldBody = 'PLANET'): Promise<boolean> {
  const [due] = await tx.select({ id: missions.id }).from(missions)
    .innerJoin(planets, eq(planets.id, missions.targetPlanetId))
    .leftJoin(clanWarMissions, eq(clanWarMissions.missionId, missions.id))
    .where(and(
      eq(missions.targetPlanetId, planetId),
      eq(missions.targetBody, body),
      eq(missions.status, 'in_flight'),
      lte(missions.arriveAt, now),
      ne(missions.ownerPlayerId, planets.controllerPlayerId),
      or(inArray(missions.kind, ['attack', 'death_star']), eq(clanWarMissions.leg, 'COMBINED_ATTACK')),
    )).limit(1);
  return due !== undefined;
}

/**
 * Reserve injury metadata alongside an existing dispatch's physical count mutation. Every
 * fleet leaving a world passes here, which is why K12 is enforced here: a new kind of
 * launch cannot forget it, as `now` is required.
 */
export async function takeHomeHealth(
  tx: Tx, planetId: string, fleet: Fleet, now: Date, combatOnly = false, body: WorldBody = 'PLANET',
): Promise<HpDamageLot[]> {
  await assertNoArrivalPending(tx, planetId, now, body);
  const home = await readHomeHealth(tx, planetId, body);
  const selected = selectHomeDispatch(home.fleet, home.damage, fleet, combatOnly);
  await writeHomeHealth(tx, planetId, selected.remaining, selected.remainingDamage, body);
  return selected.selectedDamage;
}

/** Quotes and commits share the same eligibility and exact wound selection. */
export function selectHomeDispatch(home: Fleet, damage: HpDamageLots, requested: Fleet, combatOnly = false) {
  try { return splitHealthFleet(home, damage, requested, combatOnly); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new GameError(combatOnly ? 'NOT_ENOUGH_COMBAT_READY_SHIPS' : 'NOT_ENOUGH_SHIPS',
      combatOnly ? 'Ships at 5% HP or below cannot join a combat mission' : 'Not enough ships at home', 409);
  }
}
