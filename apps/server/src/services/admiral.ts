import { and, eq, isNull, sql } from 'drizzle-orm';
import { fleetValue, type Fleet, type Grade } from '@astera/rules';
import { admiralApplies, admiralBonuses, admiralDefeated, admiralOpen, admiralOutcome, gainXp, type AdmiralFlightKind, type AdmiralSnapshot } from '@astera/rules/arena';
import type { Queryable, Tx } from '../db/client.js';
import { arenaAdmirals, arenaAdmiralLegs, arenaShips, seasons, type ReportAdmiral } from '../db/schema.js';
import { GameError, type LockedPlanet } from './planet.js';
import { activeTeamFor } from './arenaTeamLedger.js';
import { researchCoreLevel } from './researchState.js';
import { queueShipReady } from './arenaReady.js';
import { publishShard } from '../stream/bus.js';

export interface AdmiralPlan { id: string; snapshot: AdmiralSnapshot; bonuses: ReturnType<typeof admiralBonuses> }

type Sender = Pick<LockedPlanet, 'playerId' | 'seasonId' | 'rulesetVersion' | 'now'>;

/** The ship that may escort now, or the refusal a launch would give. `lock` only on a real launch. */
async function readyShip(q: Queryable, origin: Sender, lock: boolean) {
  if (!admiralApplies(origin.rulesetVersion)) {
    const [season] = await q.select({ admiralStartsAt: seasons.admiralStartsAt }).from(seasons).where(eq(seasons.id, origin.seasonId));
    if (!admiralOpen({ rulesetVersion: origin.rulesetVersion, admiralStartsAt: season?.admiralStartsAt ?? null }, origin.now)) {
      throw new GameError('ADMIRAL_RULESET', 'Admirals arrive with a new season', 409);
    }
  }
  const query = q.select().from(arenaShips).where(eq(arenaShips.playerId, origin.playerId));
  const [ship] = lock ? await query.for('update', { skipLocked: true }) : await query;
  if (!ship) throw new GameError('SHIP_UNAVAILABLE', 'The commander ship is unavailable or another operation holds it', 409);
  if (ship.admiralId !== null) throw new GameError('ADMIRAL_AWAY', 'The commander already accompanies a fleet', 409);
  if (ship.sortieId !== null) throw new GameError('SHIP_FLYING', 'The commander ship is in the Yarık', 409);
  if (ship.readyAt && ship.readyAt > origin.now) throw new GameError('SHIP_NOT_READY', 'The commander ship is under repair or maintenance', 409);
  if (await activeTeamFor(q, origin.playerId)) throw new GameError('TEAM_LOBBY', 'Leave the team commitment first', 409);
  return ship;
}

/** A quote's escort: the same checks and bonuses as a launch, with nothing reserved. */
export async function previewAdmiral(q: Queryable, origin: Sender, selected: boolean): Promise<ReturnType<typeof admiralBonuses> | null> {
  if (!selected) return null;
  const ship = await readyShip(q, origin, false);
  return admiralBonuses(ship.ship, ship.level);
}

/** The caller holds its native planet locks. Never wait for a ship lock in the reverse arena order. */
export async function prepareAdmiral(tx: Tx, origin: Sender, selected: boolean): Promise<AdmiralPlan | null> {
  if (!selected) return null;
  const ship = await readyShip(tx, origin, true);
  const [task] = await tx.insert(arenaAdmirals).values({ playerId: origin.playerId, seasonId: origin.seasonId, ship: ship.ship, level: ship.level, createdAt: origin.now }).returning();
  if (!task) throw new Error('Admiral reservation missing');
  await tx.update(arenaShips).set({ admiralId: task.id, readyNoticeId: null }).where(eq(arenaShips.playerId, ship.playerId));
  return { id: task.id, snapshot: { ship: ship.ship, level: ship.level }, bonuses: admiralBonuses(ship.ship, ship.level) };
}

export async function attachAdmiral(tx: Tx, admiralId: string | null | undefined, kind: AdmiralFlightKind, refId: string): Promise<void> {
  if (!admiralId) return;
  await tx.insert(arenaAdmiralLegs).values({ admiralId, kind, refId });
}

export async function admiralForFlight(q: Queryable, kind: AdmiralFlightKind, refId: string): Promise<({ id: string } & AdmiralSnapshot) | null> {
  const [row] = await q.select({ id: arenaAdmirals.id, ship: arenaAdmirals.ship, level: arenaAdmirals.level }).from(arenaAdmiralLegs)
    .innerJoin(arenaAdmirals, eq(arenaAdmirals.id, arenaAdmiralLegs.admiralId))
    .where(and(eq(arenaAdmiralLegs.kind, kind), eq(arenaAdmiralLegs.refId, refId), isNull(arenaAdmiralLegs.finishedAt), eq(arenaAdmirals.status, 'active')));
  return row ?? null;
}

/** Native outbound/return/split legs inherit the one task; they never clone its commander. */
export async function replaceAdmiralLeg(tx: Tx, kind: AdmiralFlightKind, refId: string, nextKind: AdmiralFlightKind, nextRefs: readonly string[], at: Date): Promise<void> {
  if (nextRefs.length === 1 && nextKind === kind && nextRefs[0] === refId) return;
  if (nextRefs.length === 0) throw new Error('An admiral leg replacement must have a continuation');
  const [leg] = await tx.select().from(arenaAdmiralLegs).where(and(eq(arenaAdmiralLegs.kind, kind), eq(arenaAdmiralLegs.refId, refId), isNull(arenaAdmiralLegs.finishedAt))).for('update');
  if (!leg) return;
  await tx.insert(arenaAdmiralLegs).values([...new Set(nextRefs)].map(id => ({ admiralId: leg.admiralId, kind: nextKind, refId: id })));
  // A replaced leg is closed, not a homecoming; it awards no XP or repair.
  await tx.update(arenaAdmiralLegs).set({ finishedAt: at }).where(eq(arenaAdmiralLegs.id, leg.id));
}

/** What a battle meant to its escort, from the attacker-graded result. */
export const escortedBattle = (side: 'attack' | 'defence', result: { grade: Grade; attackerLosses: Fleet; defenderLosses: Fleet }) =>
  ({ lost: admiralDefeated(side, result.grade), lostValue: Math.round(fleetValue(result.attackerLosses) + fleetValue(result.defenderLosses)) });

/** The report's line for an escort: who flew beside which side. */
export const reportAdmirals = (side: 'attack' | 'defence', admiral: AdmiralSnapshot | null): ReportAdmiral[] =>
  admiral ? [{ side, ship: admiral.ship, level: admiral.level }] : [];

/** One battle the escorted fleet fought: `lost` from `admiralDefeated`, `lostValue` both sides' ship value lost. */
export async function recordAdmiralBattle(tx: Tx, kind: AdmiralFlightKind, refId: string, battle: { lost: boolean; lostValue: number }): Promise<void> {
  if (!Number.isSafeInteger(battle.lostValue) || battle.lostValue < 0) throw new Error('Invalid admiral battle value');
  const admiral = await admiralForFlight(tx, kind, refId);
  if (!admiral) return;
  await tx.update(arenaAdmirals).set({ fought: true, lost: sql`${arenaAdmirals.lost} OR ${battle.lost}`,
    lostValue: sql`${arenaAdmirals.lostValue} + ${battle.lostValue}` }).where(eq(arenaAdmirals.id, admiral.id));
}

/** The escort's travel multiplier on this flight (a Kılavuz shortens every leg); 1 without one. */
export async function admiralTime(q: Queryable, kind: AdmiralFlightKind, refId: string): Promise<number> {
  const admiral = await admiralForFlight(q, kind, refId);
  return admiral ? admiralBonuses(admiral.ship, admiral.level).time : 1;
}

/**
 * The escort leaves the battle with its fleet's way home; with no fleet left it flies home alone,
 * the length of the leg it came out on, and lands for repair (owner 2026-10-25). A fleet that
 * stays (a held monument) also sends it home alone: `stayed` ships count as a fleet that lived.
 */
export async function admiralHomeward(tx: Tx, kind: AdmiralFlightKind, flight: { id: string; departAt: Date; arriveAt: Date }, returnId: string | null, at: Date, stayed = 0): Promise<void> {
  if (returnId) { await replaceAdmiralLeg(tx, kind, flight.id, kind, [returnId], at); return; }
  const [leg] = await tx.select({ admiralId: arenaAdmiralLegs.admiralId }).from(arenaAdmiralLegs)
    .where(and(eq(arenaAdmiralLegs.kind, kind), eq(arenaAdmiralLegs.refId, flight.id), isNull(arenaAdmiralLegs.finishedAt)));
  await finishAdmiralLeg(tx, new Date(at.getTime() + flight.arriveAt.getTime() - flight.departAt.getTime()), kind, flight.id, stayed);
  // The galaxy draws the lone flight from here (`admiralHomewardPath`); only a released ship flies it.
  if (leg) await tx.update(arenaAdmirals).set({ homeDepartAt: at }).where(and(eq(arenaAdmirals.id, leg.admiralId), eq(arenaAdmirals.status, 'returned')));
}

/** The last native homecoming alone releases the ship, awards its XP and arms the ready notice. */
export async function finishAdmiralLeg(tx: Tx, at: Date, kind: AdmiralFlightKind, refId: string, landedShips: number): Promise<void> {
  if (!Number.isSafeInteger(landedShips) || landedShips < 0) throw new Error('Invalid admiral survivor count');
  const [leg] = await tx.update(arenaAdmiralLegs).set({ finishedAt: at })
    .where(and(eq(arenaAdmiralLegs.kind, kind), eq(arenaAdmiralLegs.refId, refId), isNull(arenaAdmiralLegs.finishedAt))).returning();
  if (!leg) return;
  const [task] = await tx.select().from(arenaAdmirals).where(eq(arenaAdmirals.id, leg.admiralId)).for('update');
  if (task?.status !== 'active') return;
  const total = task.landedShips + landedShips;
  const [pending] = await tx.select({ id: arenaAdmiralLegs.id }).from(arenaAdmiralLegs).where(and(eq(arenaAdmiralLegs.admiralId, task.id), isNull(arenaAdmiralLegs.finishedAt))).limit(1);
  if (pending) { await tx.update(arenaAdmirals).set({ landedShips: total }).where(eq(arenaAdmirals.id, task.id)); return; }
  const [ship] = await tx.select().from(arenaShips).where(and(eq(arenaShips.playerId, task.playerId), eq(arenaShips.admiralId, task.id))).for('update', { noWait: true });
  if (!ship) throw new Error('The returning admiral no longer owns its ship reservation');
  const outcome = admiralOutcome({ fought: task.fought, lost: task.lost, landedShips: total, lostValue: task.lostValue });
  const bar = gainXp({ level: ship.level, xp: ship.xp, core: await researchCoreLevel(tx, task.playerId) }, outcome.xp);
  const readyAt = new Date(at.getTime() + outcome.minutes * 60_000);
  await tx.update(arenaShips).set({ admiralId: null, readyAt, readyReason: outcome.readyReason, readyNoticeId: task.id, xp: bar.xp }).where(eq(arenaShips.playerId, task.playerId));
  await tx.update(arenaAdmirals).set({ status: 'returned', finishedAt: at, landedShips: total, xp: bar.banked }).where(eq(arenaAdmirals.id, task.id));
  await queueShipReady(tx, task.seasonId, task.playerId, task.id, readyAt);
  await publishShard(tx, task.seasonId, 'world');
}
