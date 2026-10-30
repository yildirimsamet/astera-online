import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  clanDefenseApplies,
  partitionCombatFleet,
  fleetCount,
  hangarCapacity,
  withinTierBand,
  type Fleet,
} from '@astera/rules';
import type { Db, Queryable } from '../db/client.js';
import {
  accounts,
  buildings,
  clanSupportWaves,
  planets,
  players,
  units,
  type ClanSupportReturnReason,
  type ClanSupportWaveStatus,
} from '../db/schema.js';
import { peakCoreLevels } from './player.js';
import { projectStationedSupport } from './clanSupportRadiation.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the read half: what a wave looks like to its sender and to
 * its host, and what the host's support bay holds. Its own module because the planet
 * view reads it and the write half (`clanSupport.ts`) renders the planet view.
 */

/* ── a wave, as the two people it concerns see it ───────────────── */

/** Statuses that hold room in the host's support bay. RETURNING has already let go. */
export const ROOM_HOLDING: readonly ClanSupportWaveStatus[] = ['OUTBOUND', 'STATIONED'];
/** Statuses of a wave that is still out — it holds a bay and blocks a commander transfer. */
export const LIVE_WAVE: readonly ClanSupportWaveStatus[] = ['OUTBOUND', 'STATIONED', 'RETURNING'];

export interface ClanSupportWaveView {
  id: string;
  status: ClanSupportWaveStatus;
  sender: { playerId: string; name: string };
  host: { playerId: string; name: string };
  originPlanetId: string;
  hostPlanetId: string;
  hostPlanetName: string;
  /** What stands in the wave now — the battle survivors once it has fought. */
  fleet: Fleet;
  bulk: number;
  /** Some of these ships carry damage from a flight or a fight. */
  damaged: boolean;
  sentAt: string;
  arriveAt: string;
  stationedAt: string | null;
  expiresAt: string | null;
  returnAt: string | null;
  returnReason: ClanSupportReturnReason | null;
  /**
   * The sender has drifted outside the host's ±1 tier band (owner K3). Such a wave
   * goes home untouched the instant a raid lands, so both pages say so.
   */
  outOfBand: boolean;
  battles: number;
}

export type WaveRow = typeof clanSupportWaves.$inferSelect;

/** Render waves for the pages, reading the ships as they stand and the band as it is. */
export async function viewWaves(db: Queryable, rows: readonly WaveRow[], at?: Date): Promise<ClanSupportWaveView[]> {
  if (rows.length === 0) return [];
  const people = [...new Set(rows.flatMap((row) => [row.senderPlayerId, row.hostPlayerId]))];
  const [names, worldNames, stock, peaks] = await Promise.all([
    db.select({ id: players.id, name: accounts.displayName })
      .from(players).innerJoin(accounts, eq(accounts.id, players.accountId))
      .where(inArray(players.id, people)),
    db.select({ id: planets.id, name: planets.name }).from(planets)
      .where(inArray(planets.id, [...new Set(rows.map((row) => row.hostPlanetId))])),
    db.select({ location: units.location, hull: units.hull, count: units.count }).from(units)
      .where(inArray(units.location, rows.map((row) => row.unitLocation))),
    peakCoreLevels(db as Db, people),
  ]);
  const nameOf = new Map(names.map((row) => [row.id, row.name]));
  const worldOf = new Map(worldNames.map((row) => [row.id, row.name]));
  const fleets = new Map<string, Fleet>();
  for (const row of stock) {
    if (row.count <= 0) continue;
    const fleet = fleets.get(row.location) ?? {};
    fleet[row.hull] = row.count;
    fleets.set(row.location, fleet);
  }
  const projected = at ? await projectStationedSupport(db, rows, at) : new Map<string, never>();
  return rows.map(original => {
    const projection = projected.get(original.id);
    const row: WaveRow = projection?.wave ?? original;
    return ({
    id: row.id,
    status: row.status,
    sender: { playerId: row.senderPlayerId, name: nameOf.get(row.senderPlayerId) ?? '' },
    host: { playerId: row.hostPlayerId, name: nameOf.get(row.hostPlayerId) ?? '' },
    originPlanetId: row.originPlanetId,
    hostPlanetId: row.hostPlanetId,
    hostPlanetName: worldOf.get(row.hostPlanetId) ?? '',
    fleet: projection?.fleet ?? fleets.get(row.unitLocation) ?? {},
    bulk: row.reservedBulk,
    damaged: (row.damage ?? []).some((lot) => lot.count > 0 && lot.damageBp + (lot.remainderBp ?? 0) > 0),
    sentAt: row.sentAt.toISOString(),
    arriveAt: row.arriveAt.toISOString(),
    stationedAt: row.stationedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    returnAt: row.returnAt?.toISOString() ?? null,
    returnReason: row.returnReason,
    outOfBand: !withinTierBand(peaks.get(row.senderPlayerId) ?? 1, peaks.get(row.hostPlayerId) ?? 1),
    battles: row.battles,
  }); });
}

export interface SupportRoom {
  /** Bulk standing at the world now. */
  used: number;
  /** Bulk on its way and already promised a place. */
  reserved: number;
  /** The host world's own Hangar room (owner K1). */
  total: number;
}

async function hangarLevelOf(db: Queryable, planetId: string): Promise<number> {
  const [row] = await db.select({ level: buildings.level }).from(buildings)
    .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'HANGAR')));
  return row?.level ?? 0;
}

/** What the support bay at this world holds, read under the caller's lock. */
export async function supportRoomOf(db: Queryable, planetId: string): Promise<SupportRoom> {
  const [held, level] = await Promise.all([
    db.select({
      status: clanSupportWaves.status,
      bulk: sql<number>`coalesce(sum(${clanSupportWaves.reservedBulk}), 0)::float8`,
    })
      .from(clanSupportWaves)
      .where(and(
        eq(clanSupportWaves.hostPlanetId, planetId),
        inArray(clanSupportWaves.status, [...ROOM_HOLDING]),
      ))
      .groupBy(clanSupportWaves.status),
    hangarLevelOf(db, planetId),
  ]);
  const of = (status: ClanSupportWaveStatus): number =>
    held.find((row) => row.status === status)?.bulk ?? 0;
  return { used: of('STATIONED'), reserved: of('OUTBOUND'), total: hangarCapacity(level) };
}

/**
 * THE HOST'S "KLAN DESTEĞİ" BAY, for the Hangar page, for several worlds, with each
 * one's Hangar level already read (scaling plan F1.4). Null in a season without the
 * rule. Waves that have already turned for home are gone from it.
 */
export async function clanSupportBayViews(
  db: Queryable,
  input: { hangarLevels: ReadonlyMap<string, number>; rulesetVersion: number; at?: Date },
): Promise<Map<string, { room: SupportRoom; waves: ClanSupportWaveView[] } | null>> {
  const planetIds = [...input.hangarLevels.keys()];
  if (!clanDefenseApplies(input.rulesetVersion)) return new Map(planetIds.map(id => [id, null]));
  const [held, rows] = await Promise.all([
    db.select({
      hostPlanetId: clanSupportWaves.hostPlanetId,
      status: clanSupportWaves.status,
      bulk: sql<number>`coalesce(sum(${clanSupportWaves.reservedBulk}), 0)::float8`,
    })
      .from(clanSupportWaves)
      .where(and(inArray(clanSupportWaves.hostPlanetId, planetIds), inArray(clanSupportWaves.status, [...ROOM_HOLDING])))
      .groupBy(clanSupportWaves.hostPlanetId, clanSupportWaves.status),
    db.select().from(clanSupportWaves)
      .where(and(inArray(clanSupportWaves.hostPlanetId, planetIds), inArray(clanSupportWaves.status, [...ROOM_HOLDING])))
      .orderBy(asc(clanSupportWaves.arriveAt), asc(clanSupportWaves.id)),
  ]);
  // `viewWaves` renders row by row, so one call serves every host and keeps each one's order.
  const views = await viewWaves(db, rows, input.at);
  return new Map(planetIds.map(planetId => {
    const of = (status: ClanSupportWaveStatus): number =>
      held.find((row) => row.hostPlanetId === planetId && row.status === status)?.bulk ?? 0;
    const room: SupportRoom = { used: of('STATIONED'), reserved: of('OUTBOUND'), total: hangarCapacity(input.hangarLevels.get(planetId) ?? 0) };
    const waves = views.filter((wave, i) => rows[i]!.hostPlanetId === planetId && ROOM_HOLDING.includes(wave.status));
    return [planetId, { room: input.at ? { ...room, used: waves.filter(wave => wave.status === 'STATIONED').reduce((sum, wave) => sum + wave.bulk, 0) } : room, waves }];
  }));
}

/** Every wave of mine still out — the Fleet page's "Klan desteği" group. */
export async function readMySupport(db: Queryable, playerId: string, at?: Date): Promise<{ waves: ClanSupportWaveView[] }> {
  const rows = await db.select().from(clanSupportWaves)
    .where(and(
      eq(clanSupportWaves.senderPlayerId, playerId),
      inArray(clanSupportWaves.status, [...LIVE_WAVE]),
    ))
    .orderBy(asc(clanSupportWaves.sentAt), asc(clanSupportWaves.id));
  return { waves: (await viewWaves(db, rows, at)).filter(wave => LIVE_WAVE.includes(wave.status)) };
}

/**
 * THE CLANMATES' SHIPS A RAID AT THIS WORLD WOULD ACTUALLY MEET — what a probe reads
 * (owner K9). Only waves standing there and inside the host's tier band: one that has
 * drifted out goes home before the first shot, so counting it would mislead the raider.
 */
export async function standingSupportAt(
  db: Queryable,
  input: { hostPlanetId: string; hostPlayerId: string },
): Promise<{ supporters: number; fleet: Fleet }> {
  const rows = await db.select().from(clanSupportWaves)
    .where(and(eq(clanSupportWaves.hostPlanetId, input.hostPlanetId), eq(clanSupportWaves.status, 'STATIONED')));
  if (rows.length === 0) return { supporters: 0, fleet: {} };
  const peaks = await peakCoreLevels(db, [input.hostPlayerId, ...rows.map((row) => row.senderPlayerId)]);
  const hostPeak = peaks.get(input.hostPlayerId) ?? 1;
  const inBand = rows.filter((row) => withinTierBand(peaks.get(row.senderPlayerId) ?? 1, hostPeak));
  if (inBand.length === 0) return { supporters: 0, fleet: {} };
  const stock = await db.select({ hull: units.hull, count: units.count, location: units.location }).from(units)
    .where(inArray(units.location, inBand.map((row) => row.unitLocation)));
  const fleet: Fleet = {};
  const supporters = new Set<string>();
  for (const wave of inBand) {
    const held: Fleet = {};
    for (const row of stock) if (row.location === wave.unitLocation && row.count > 0) held[row.hull] = row.count;
    const ready = partitionCombatFleet(held, wave.damage).eligible;
    if (fleetCount(ready) === 0) continue;
    supporters.add(wave.senderPlayerId);
    for (const row of stock) if (row.location === wave.unitLocation) fleet[row.hull] = (fleet[row.hull] ?? 0) + (ready[row.hull] ?? 0);
  }
  return { supporters: supporters.size, fleet };
}
