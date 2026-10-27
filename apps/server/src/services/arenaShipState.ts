import { and, eq } from 'drizzle-orm';
import { alloyRate, crystalRate, deuteriumRate, productionMult } from '@astera/rules';
import { admiralOpen, dailyCap, settleHold, type ArenaResources, type ShipClass } from '@astera/rules/arena';
import type { Queryable, Tx } from '../db/client.js';
import { arenaShips, players, planets, seasons } from '../db/schema.js';
import { admiralHomewardPath, type HomewardPath } from './admiralPath.js';
import { capitalPlanet } from './ownership.js';
import { GameError, recomputePlayerWealth, saveResources, type LockedPlanet } from './planet.js';
export type ShipRow = typeof arenaShips.$inferSelect;

export const ZERO: ArenaResources = { alloy: 0, crystal: 0, deuterium: 0 };
export const dayOf = (at: Date): string => at.toISOString().slice(0, 10);
export const nextMidnight = (at: Date): Date => { const next = new Date(at); next.setUTCHours(24, 0, 0, 0); return next; };
export const sentToday = (row: ShipRow, now: Date): ArenaResources => row.transferDay === dayOf(now)
  ? { alloy: row.sentAlloy, crystal: row.sentCrystal, deuterium: row.sentDeuterium } : { ...ZERO };
export const holdOf = (row: ShipRow): number[] => [row.holdAlloy, row.holdCrystal, row.holdDeuterium];
/** The capital's own hourly production: the rate its works and orbit give, as the planet view shows it. */
export const perHour = (planet: LockedPlanet): ArenaResources => {
  const boost = productionMult(planet.orbit);
  return { alloy: alloyRate(planet.buildings.REFINERY) * boost, crystal: crystalRate(planet.buildings.EXTRACTOR) * boost,
    deuterium: deuteriumRate(planet.buildings.DEUTERIUM_PLANT) * boost };
};
export const shipFor = (q: Queryable, playerId: string) => q.select().from(arenaShips).where(eq(arenaShips.playerId, playerId));

export async function commander(q: Queryable, accountId: string): Promise<{ playerId: string; seasonId: string; capitalId: string }> {
  const [row] = await q.select({ id: players.id, seasonId: players.seasonId }).from(players).where(eq(players.accountId, accountId));
  if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  return { playerId: row.id, seasonId: row.seasonId, capitalId: (await capitalPlanet(q, row.id)).id };
}


/** Caller holds season → ship → capital. Solo exits and team claims share the same daily transfer counter. */
export async function landArenaCargo(tx: Tx, row: ShipRow, planet: LockedPlanet, hold: readonly number[], now: Date) {
  const sent = sentToday(row, now); const cap = dailyCap(perHour(planet));
  const answer = settleHold(hold, { alloy: cap.alloy - sent.alloy, crystal: cap.crystal - sent.crystal, deuterium: cap.deuterium - sent.deuterium });
  const { deposit } = answer;
  if (deposit.alloy + deposit.crystal + deposit.deuterium > 0) {
    await saveResources(tx, planet.planetId, { alloy: planet.alloy + deposit.alloy, crystal: planet.crystal + deposit.crystal, deuterium: planet.deuterium + deposit.deuterium });
    await recomputePlayerWealth(tx, row.playerId, now);
  }
  await tx.update(arenaShips).set({ transferDay: dayOf(now), sentAlloy: sent.alloy + deposit.alloy,
    sentCrystal: sent.crystal + deposit.crystal, sentDeuterium: sent.deuterium + deposit.deuterium }).where(eq(arenaShips.playerId, row.playerId));
  return answer;
}

/** Owner-only physical state. It neither grants arena admission nor advances a timer. */
export async function readCommanderShip(q: Queryable, accountId: string, clock: { now(): Date }): Promise<{
  capitalPlanetId: string; rulesetVersion: number;
  /** Escorts are open in this season now (`admiralOpen`): dealt with it, or switched on live. */
  admiral: boolean;
  ship: { class: ShipClass; level: number; status: 'ready' | 'repair' | 'service' | 'admiral' | 'yarik'; readyAt: string | null } | null;
  /** Flying home alone after its fleet: out in space, so it is drawn on this way rather than docked. */
  homeward: HomewardPath | null;
}> {
  const [row] = await q.select({ playerId: players.id, capitalPlanetId: planets.id, rulesetVersion: seasons.rulesetVersion, admiralStartsAt: seasons.admiralStartsAt,
    ship: arenaShips.ship, level: arenaShips.level, sortieId: arenaShips.sortieId, admiralId: arenaShips.admiralId,
    readyAt: arenaShips.readyAt, readyReason: arenaShips.readyReason }).from(players)
    .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
    .innerJoin(seasons, eq(seasons.id, players.seasonId)).leftJoin(arenaShips, eq(arenaShips.playerId, players.id))
    .where(eq(players.accountId, accountId));
  if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  const now = clock.now();
  const home = { capitalPlanetId: row.capitalPlanetId, rulesetVersion: row.rulesetVersion, admiral: admiralOpen(row, now) };
  if (!row.ship || row.level === null) return { ...home, ship: null, homeward: null };
  const pending = row.readyAt !== null && row.readyAt > now;
  const homeward = pending ? await admiralHomewardPath(q, row.playerId, now) : null;
  const status = row.admiralId !== null || homeward ? 'admiral' : row.sortieId !== null ? 'yarik'
    : pending && row.readyReason ? row.readyReason : 'ready';
  return { ...home, ship: { class: row.ship, level: row.level, status, readyAt: pending ? row.readyAt?.toISOString() ?? null : null }, homeward };
}
