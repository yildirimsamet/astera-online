import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import {
  RESEARCH_PROJECT_IDS,
  MOBILE_HULLS,
  distance,
  fleetCount,
  fleetEntries,
  fleetSpeedMult,
  fleetTravelExact,
  hangarLoad,
  missionFuel,
  hpLethalAtMs,
  produceMonumentDeuterium,
  applyHpDose,
  segmentsExposureHp,
  HULLS,
  hullTech,
  normalizeMonumentLots,
  normalizeHpDamage,
  settleMonumentHold,
  type HpRadiationSource,
  type HpDoseOutcome,
  type MonumentHoldSettlement,
  type MonumentShipLot,
  type Fleet,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Tx } from '../db/client.js';
import { clanMemberships, clans, monuments, monumentProbes, monumentShipLots, monumentWaves, planets, units, type seasons } from '../db/schema.js';
import { GameError, assertSeasonOpenThrough, assertWorldOperational, loadLocked, readPlanetState, lockSeason, recomputePlayerWealth, saveResources, setUnits } from './planet.js';
import { capitalPlanet, lockWorlds } from './ownership.js';
import { assertClanHostilityAllowed, lockClanPlayers } from './clanCombat.js';
import { assertFreeBay, baysOf } from './flight.js';
import { assertFuel } from './fuel.js';
import { techOf } from './researchState.js';
import { assertOwnShieldLoss, protectionsOf } from './attackProtection.js';
import { notify } from './notifications.js';
import { tellMonumentRadiationLoss } from './monumentRadiationLoss.js';
import { publish, publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { scheduleFlightBoundary, scheduleHoldBoundary } from './monumentBoundaries.js';
import { hpSourcesForSeason } from './radiationSources.js';
import { assertOutsideSilentSpace, markProgress } from './waitingRoom.js';
export { hpSourcesForSeason } from './radiationSources.js';

type MonumentRow = typeof monuments.$inferSelect;
type WaveRow = typeof monumentWaves.$inferSelect;
type UnitRow = typeof units.$inferSelect;
const activeStatuses = ['OUTBOUND', 'HOLD', 'RETURNING'] as const;
const identitySchema = z.string().uuid();
const techSchema = z.record(z.enum(RESEARCH_PROJECT_IDS), z.number().int().nonnegative().safe());
const mobileHullSchema = z.enum(['DART', ...MOBILE_HULLS]);
const garrisonFleetSchema = z.record(mobileHullSchema, z.number().int().nonnegative().max(2_147_483_647));
const garrisonSchema = z.object({
  garrison: garrisonFleetSchema, garrisonTemplate: garrisonFleetSchema, garrisonTech: techSchema,
  garrisonDamage: z.array(z.object({ hull: mobileHullSchema, count: z.number().int().positive().max(2_147_483_647),
    damageBp: z.number().int().nonnegative().max(9999), remainderBp: z.number().finite().nonnegative().lt(1).optional() })).max(10_000),
});

/**
 * season → optional sorted worlds → monument → sorted waves → clans → players.
 * All target mutations, including wave/manifest writes, acquire this target lock.
 * HOLD-only settlement never subsequently locks worlds or inserts units: it can
 * only reduce an existing parked stack. Dispatch/landing take their world locks
 * first. This also lets ownership cleanup take a world before its targets.
 */
export interface LockedMonument {
  monument: MonumentRow;
  season: typeof seasons.$inferSelect;
  waves: WaveRow[];
  lots: MonumentShipLot[];
  unitRows: UnitRow[];
  memberships: Map<string, string>;
}

/** Load the authoritative fleet and manifest together under the target lock. */
async function lockMonumentRoster(tx: Tx, monumentId: string, requireLive: boolean, mutate = true): Promise<LockedMonument> {
  if (!identitySchema.safeParse(monumentId).success) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  const [identity] = await tx.select({ seasonId: monuments.seasonId }).from(monuments).where(eq(monuments.id, monumentId));
  if (!identity) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  const season = await lockSeason(tx, identity.seasonId, requireLive);
  const targetQuery = tx.select().from(monuments).where(eq(monuments.id, monumentId));
  const [monument] = mutate ? await targetQuery.for('update') : await targetQuery;
  if (!monument) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  const garrison = garrisonSchema.safeParse(monument);
  if (!garrison.success) throw new GameError('MONUMENT_MANIFEST_INVALID', 'Invalid neutral garrison; refresh the target', 409);
  try { monument.garrisonDamage = normalizeHpDamage(garrison.data.garrison, garrison.data.garrisonDamage); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new GameError('MONUMENT_MANIFEST_INVALID', error.message, 409);
  }
  monument.garrison = garrison.data.garrison;
  monument.garrisonTemplate = garrison.data.garrisonTemplate;
  monument.garrisonTech = garrison.data.garrisonTech;
  const waveQuery = tx.select().from(monumentWaves)
    .where(and(eq(monumentWaves.monumentId, monument.id), inArray(monumentWaves.status, [...activeStatuses])))
    .orderBy(asc(monumentWaves.id));
  const waves = mutate ? await waveQuery.for('update') : await waveQuery;
  const waveIds = waves.map((wave) => wave.id);
  const stored = waveIds.length === 0 ? [] : await tx.select().from(monumentShipLots).where(inArray(monumentShipLots.waveId, waveIds));
  const unitQuery = tx.select().from(units)
    .where(inArray(units.location, waves.map((wave) => wave.unitLocation)))
    .orderBy(asc(units.planetId), asc(units.location), asc(units.hull));
  const unitRows = waveIds.length === 0 ? [] : mutate ? await unitQuery.for('update') : await unitQuery;
  const owners = new Map(waves.map((wave) => [wave.id, wave]));
  const lots: MonumentShipLot[] = [];
  for (const wave of waves) {
    const parsed = techSchema.safeParse(wave.tech);
    if (!parsed.success) throw new GameError('MONUMENT_MANIFEST_INVALID', 'Invalid carried research', 409);
    wave.tech = parsed.data;
  }
  for (const row of stored) {
    const wave = owners.get(row.waveId);
    if (!wave) throw new GameError('MONUMENT_MANIFEST_MISMATCH', 'Manifest lost its wave', 409);
    lots.push({ ...row, playerId: wave.playerId, tech: wave.tech });
  }
  let normalized: MonumentShipLot[];
  try { normalized = normalizeMonumentLots(lots); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new GameError('MONUMENT_MANIFEST_INVALID', error.message, 409);
  }
  for (const wave of waves) {
    const expected = new Map<string, number>();
    for (const lot of normalized) if (lot.waveId === wave.id) expected.set(lot.hull, (expected.get(lot.hull) ?? 0) + lot.count);
    for (const row of unitRows) {
      if (row.location !== wave.unitLocation || row.count === 0) continue;
      if (row.planetId !== wave.originPlanetId || row.ownerPlayerId !== wave.playerId || expected.get(row.hull) !== row.count) {
        throw new GameError('MONUMENT_MANIFEST_MISMATCH', 'Parked ships differ from their manifest', 409);
      }
      expected.delete(row.hull);
    }
    if (expected.size > 0 || !normalized.some((lot) => lot.waveId === wave.id)) {
      throw new GameError('MONUMENT_MANIFEST_MISMATCH', 'Wave has missing ships or an empty manifest', 409);
    }
    if (wave.status === 'HOLD' && (wave.heldAt === null
      || wave.heldAt > monument.settledAt || wave.radiationSettledAt.getTime() !== monument.settledAt.getTime())) {
      throw new GameError('MONUMENT_TIMELINE_INVALID', 'HOLD was not settled before its roster changed', 409);
    }
  }
  return { monument, season, waves, lots: normalized, unitRows, memberships: new Map() };
}

/** Private snapshots share manifest validation with mutations, but never acquire target/world/player locks. */
export async function readMonumentRosters(tx: Tx, ids: readonly string[], extraPlayerIds: readonly string[] = []): Promise<LockedMonument[]> {
  const targets: LockedMonument[] = [];
  for (const id of [...new Set(ids)].sort()) targets.push(await lockMonumentRoster(tx, id, false, false));
  const players = [...new Set([...extraPlayerIds, ...targets.flatMap((target) => target.waves.map((wave) => wave.playerId))])];
  const memberships = players.length === 0 ? [] : await tx.select({ playerId: clanMemberships.playerId, clanId: clanMemberships.clanId })
    .from(clanMemberships).innerJoin(clans, and(eq(clans.id, clanMemberships.clanId), isNull(clans.disbandedAt)))
    .where(and(inArray(clanMemberships.playerId, players), isNull(clanMemberships.leftAt)));
  for (const target of targets) target.memberships = new Map(memberships.map((row) => [row.playerId, row.clanId]));
  return targets;
}

/** Advance HOLD in memory. A casualty needs the authoritative event writer and its notices. */
export function projectMonumentHold(target: LockedMonument, at: Date, sources: readonly HpRadiationSource[]): boolean {
  if (target.season.status !== 'live') return false;
  const toMs = Math.max(target.monument.settledAt.getTime(), Math.min(at.getTime(), target.season.endsAt.getTime()));
  const holdIds = new Set(target.waves.filter((wave) => wave.status === 'HOLD').map((wave) => wave.id));
  const lots = target.lots.filter((lot) => holdIds.has(lot.waveId));
  const projection = settleMonumentHold(lots, { fromMs: target.monument.settledAt.getTime(), toMs,
    position: target.monument, productionPerMinute: target.monument.productionPerMinute, sources });
  if (projection.destroyed.length > 0) return true;
  target.lots = [...target.lots.filter((lot) => !holdIds.has(lot.waveId)), ...projection.lots];
  target.monument.settledAt = new Date(toMs);
  for (const wave of target.waves) if (holdIds.has(wave.id)) wave.radiationSettledAt = new Date(toMs);
  return false;
}

/** A membership change may touch several targets; none may wait for a clan while holding another clan. */
export async function lockMonumentRosters(tx: Tx, monumentIds: readonly string[], requireLive = true): Promise<LockedMonument[]> {
  const ids = [...new Set(monumentIds)].sort();
  if (ids.length === 0) return [];
  if (ids.some((id) => !identitySchema.safeParse(id).success)) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  const identities = await tx.select({ id: monuments.id, seasonId: monuments.seasonId }).from(monuments).where(inArray(monuments.id, ids));
  if (identities.length !== ids.length) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  if (new Set(identities.map((row) => row.seasonId)).size !== 1) throw new GameError('CROSS_SEASON', 'Those monuments are in different galaxies', 403);
  const locked: LockedMonument[] = [];
  for (const id of ids) locked.push(await lockMonumentRoster(tx, id, requireLive));
  return locked;
}

/** Participant locks follow every target/wave lock, including a batch of several targets. */
export async function lockMonuments(tx: Tx, monumentIds: readonly string[], options: {
  requireLive?: boolean; extraPlayerIds?: readonly string[]; extraClanIds?: readonly string[];
} = {}): Promise<LockedMonument[]> {
  const locked = await lockMonumentRosters(tx, monumentIds, options.requireLive ?? true);
  if (locked.length === 0) return [];
  const memberships = await lockMonumentParticipants(tx, { monuments: locked.map((row) => row.monument), waves: locked.flatMap((row) => row.waves) },
    options.extraPlayerIds ?? [], options.extraClanIds ?? []);
  for (const row of locked) row.memberships = memberships;
  return locked;
}

export async function lockMonument(tx: Tx, monumentId: string, requireLive = true, extraPlayerIds: readonly string[] = []): Promise<LockedMonument> {
  const [locked] = await lockMonuments(tx, [monumentId], { requireLive, extraPlayerIds });
  if (!locked) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  return locked;
}

export interface MonumentSettlement extends MonumentHoldSettlement {
  monument: MonumentRow;
  waves: WaveRow[];
  nextLossAt: Date | null;
}

/** Exact loss boundary for a stationary cohort; null means it survives the cutoff. */
function lossTime(lot: MonumentShipLot, monument: MonumentRow, sources: readonly HpRadiationSource[], fromMs: number, toMs: number): number | null {
  const position = { x: monument.x, y: monument.y, z: monument.z };
  return hpLethalAtMs([{ from: position, to: position, startMs: fromMs, endMs: toMs }], sources, lot);
}

/**
 * Production, physical cargo casualties, population and cursor are one commit.
 * This adapter is called by target mutations before changing the HOLD roster.
 * A delayed/replayed event observes the cursor after the prior writer commits.
 */
export async function settleLockedMonument(tx: Tx, locked: LockedMonument, at: Date): Promise<MonumentSettlement> {
  const { monument, season } = locked;
  const fromMs = monument.settledAt.getTime();
  const requestedMs = at.getTime();
  if (!Number.isSafeInteger(requestedMs)) throw new GameError('MONUMENT_TIMELINE_INVALID', 'Invalid settlement time', 400);
  const toMs = Math.max(fromMs, Math.min(requestedMs, season.endsAt.getTime()));
  if (fromMs > season.endsAt.getTime()) throw new GameError('MONUMENT_TIMELINE_INVALID', 'Settlement exceeds the season cutoff', 409);
  if (locked.waves.some((wave) => wave.status === 'OUTBOUND' && wave.arriveAt !== null && wave.arriveAt.getTime() < toMs)) {
    throw new GameError('MONUMENT_ARRIVAL_PENDING', 'An earlier arrival must resolve before advancing this monument', 409);
  }
  const [pendingProbe] = await tx.select({ id: monumentProbes.id }).from(monumentProbes).where(and(
    eq(monumentProbes.monumentId, monument.id), eq(monumentProbes.status, 'OUTBOUND'), lt(monumentProbes.arriveAt, new Date(toMs)),
  )).limit(1);
  if (pendingProbe) throw new GameError('MONUMENT_ARRIVAL_PENDING', 'An earlier probe must observe before advancing this monument', 409);
  const holdIds = new Set(locked.waves.filter((wave) => wave.status === 'HOLD').map((wave) => wave.id));
  const holdLots = locked.lots.filter((lot) => holdIds.has(lot.waveId));
  const sources = await hpSourcesForSeason(tx, season.id);
  const result = settleMonumentHold(holdLots, {
    fromMs, toMs, position: { x: monument.x, y: monument.y, z: monument.z },
    productionPerMinute: monument.productionPerMinute, sources,
  });
  if (toMs > fromMs) {
    const survivors = new Map(result.lots.map((lot) => [lot.id, lot]));
    for (const lot of holdLots) {
      const survivor = survivors.get(lot.id);
      if (survivor) await tx.update(monumentShipLots).set({ damageBp: survivor.damageBp, remainderBp: survivor.remainderBp, deuterium: survivor.deuterium })
        .where(eq(monumentShipLots.id, lot.id));
      else await tx.delete(monumentShipLots).where(eq(monumentShipLots.id, lot.id));
    }
    for (const wave of locked.waves) {
      if (!holdIds.has(wave.id)) continue;
      const remaining = result.lots.filter((lot) => lot.waveId === wave.id);
      for (const row of locked.unitRows) {
        if (row.location !== wave.unitLocation) continue;
        const count = remaining.filter((lot) => lot.hull === row.hull).reduce((n, lot) => n + lot.count, 0);
        if (count !== row.count) {
          const predicate = and(eq(units.planetId, row.planetId), eq(units.location, row.location), eq(units.hull, row.hull));
          if (count === 0) await tx.delete(units).where(predicate);
          else await tx.update(units).set({ count }).where(predicate);
        }
        row.count = count;
      }
      wave.radiationSettledAt = new Date(toMs);
      if (remaining.length === 0) {
        const death = Math.max(...holdLots.filter((lot) => lot.waveId === wave.id)
          .map((lot) => lossTime(lot, monument, sources, fromMs, toMs) ?? toMs));
        wave.status = 'LOST';
        wave.resolvedAt = new Date(death);
        wave.reservedBulk = 0;
        wave.generation += 1;
      }
      await tx.update(monumentWaves).set({
        radiationSettledAt: wave.radiationSettledAt, status: wave.status,
        resolvedAt: wave.resolvedAt, reservedBulk: wave.reservedBulk, generation: wave.generation,
      }).where(eq(monumentWaves.id, wave.id));
    }
  }
  if (result.lots.length === 0 && (monument.controllerPlayerId !== null || monument.controllerClanId !== null)) {
    const emptyAt = holdLots.length === 0 ? fromMs : Math.max(...holdLots.map((lot) => lossTime(lot, monument, sources, fromMs, toMs) ?? toMs));
    monument.controllerPlayerId = null;
    monument.controllerClanId = null;
    monument.emptySince = new Date(emptyAt);
    monument.generation += 1;
    await publishShard(tx, season.id, 'control');
  }
  monument.settledAt = new Date(toMs);
  await tx.update(monuments).set({
    settledAt: monument.settledAt, controllerPlayerId: monument.controllerPlayerId,
    controllerClanId: monument.controllerClanId, emptySince: monument.emptySince, generation: monument.generation,
  }).where(eq(monuments.id, monument.id));
  locked.lots = [...locked.lots.filter((lot) => !holdIds.has(lot.waveId)), ...result.lots];
  const changedOwners = new Set([
    ...result.shares.filter((share) => share.deuterium > 0).map((share) => share.playerId),
    ...result.destroyed.map((lot) => lot.playerId),
  ]);
  for (const playerId of [...changedOwners].sort()) await recomputePlayerWealth(tx, playerId);
  for (const wave of locked.waves) {
    const destroyed = result.destroyed.filter(lot => lot.waveId === wave.id);
    if (destroyed.length === 0) continue;
    const ids = new Set(destroyed.map(lot => lot.id));
    const death = Math.max(...holdLots.filter(lot => ids.has(lot.id)).map(lot => lossTime(lot, monument, sources, fromMs, toMs) ?? toMs));
    await tellMonumentRadiationLoss(tx, monument, wave, destroyed, result.lots.filter(lot => lot.waveId === wave.id), new Date(death));
  }
  let nextLoss: number | null = null;
  for (const lot of result.lots) {
    const death = lossTime(lot, monument, sources, toMs, season.endsAt.getTime());
    if (death !== null) nextLoss = Math.min(nextLoss ?? death, death);
  }
  const nextLossAt = nextLoss === null ? null : new Date(nextLoss);
  await scheduleHoldBoundary(tx, locked, nextLossAt);
  return { ...result, monument, waves: locked.waves, nextLossAt };
}

export async function settleMonument(tx: Tx, input: { monumentId: string; clock: Clock; requireLive?: boolean }): Promise<MonumentSettlement> {
  const locked = await lockMonument(tx, input.monumentId, input.requireLive ?? true);
  return settleLockedMonument(tx, locked, input.clock.now());
}

export interface MonumentSendInput {
  senderPlayerId: string;
  originPlanetId: string;
  monumentId: string;
  fleet: Fleet;
  purpose: 'ATTACK' | 'REINFORCE';
  acknowledgeShieldLoss?: boolean;
  acknowledgeRadiationLoss?: boolean;
  clock: Clock;
}

const mobileIds: ReadonlySet<string> = new Set(MOBILE_HULLS);
const newWaveIdentity = (): { id: string; unitLocation: string } => {
  const id = randomUUID();
  return { id, unitLocation: `monument:${id}` };
};
const sendSchema = z.object({
  senderPlayerId: z.string().uuid(), originPlanetId: z.string().uuid(), monumentId: z.string().uuid(),
  purpose: z.enum(['ATTACK', 'REINFORCE']),
  fleet: z.record(z.number().int().min(0).max(2_147_483_647)).refine(
    (fleet) => Object.keys(fleet).every((hull) => mobileIds.has(hull)) && Object.values(fleet).some((count) => count > 0),
    'Send a nonempty mobile fleet',
  ),
});

export interface MonumentQuote {
  fuel: number;
  arriveAt: string;
  travelMinutes: number;
  room: { used: number; reserved: number; total: number; after: number };
  bays: { used: number; total: number };
  shieldWouldDrop: boolean;
  /** Deterministic only for a friendly reinforcement; an attack's battle is unknown. */
  holdForecast?: { productionPerMinute: number; nextLossAt: string | null };
  outboundForecast: { doseHp: number; destroyed: number; fleet: Fleet;
    health: { hull: string; count: number; maxHp: number; remainingHp: number; damageBp: number; remainderBp: number }[] };
}

function friendlyHoldForecast(
  locked: LockedMonument,
  playerId: string,
  arrival: HpDoseOutcome,
  tech: MonumentShipLot['tech'],
  arriveAt: Date,
  sources: readonly HpRadiationSource[],
): NonNullable<MonumentQuote['holdForecast']> {
  const holdIds = new Set(locked.waves.filter((wave) => wave.status === 'HOLD').map((wave) => wave.id));
  const previewWaveId = `preview:${playerId}`;
  const previewLots: MonumentShipLot[] = MOBILE_HULLS.flatMap((hull) => {
    const damaged = arrival.lots.filter((lot) => lot.hull === hull);
    const healthy = (arrival.fleet[hull] ?? 0) - damaged.reduce((sum, lot) => sum + lot.count, 0);
    return [...damaged, ...(healthy > 0 ? [{ hull, count: healthy, damageBp: 0, remainderBp: 0 }] : [])]
      .map((lot) => ({ ...lot, hull, remainderBp: lot.remainderBp ?? 0,
        id: randomUUID(), playerId, waveId: previewWaveId, deuterium: 0, tech }));
  });
  const existing = settleMonumentHold(locked.lots.filter((lot) => holdIds.has(lot.waveId)), {
    fromMs: locked.monument.settledAt.getTime(), toMs: arriveAt.getTime(), position: locked.monument,
    productionPerMinute: locked.monument.productionPerMinute, sources,
  }).lots;
  const held = [...existing, ...previewLots];
  const production = produceMonumentDeuterium(held, locked.monument.productionPerMinute).shares
    .find((share) => share.playerId === playerId)?.deuterium ?? 0;
  const path = [{ from: locked.monument, to: locked.monument, startMs: arriveAt.getTime(), endMs: locked.season.endsAt.getTime() }];
  const lossTimes = previewLots.map((lot) => hpLethalAtMs(path, sources, lot)).filter((time): time is number => time !== null);
  // The forecast describes the new wave only. Existing HOLD losses remain on
  // their own live cards, so an arrival preview cannot imply a combat result.
  return { productionPerMinute: production, nextLossAt: lossTimes.length === 0 ? null : new Date(Math.min(...lossTimes)).toISOString() };
}

/** Clan/player locks serialize control affiliation with membership/hostility changes. */
async function lockMonumentParticipants(tx: Tx, locked: { monuments: MonumentRow[]; waves: WaveRow[] }, extraPlayerIds: readonly string[], extraClanIds: readonly string[]): Promise<Map<string, string>> {
  let ids = [...new Set([...extraPlayerIds, ...locked.waves.map((wave) => wave.playerId)])].sort();
  const before = ids.length === 0 ? [] : await tx.select({ clanId: clanMemberships.clanId }).from(clanMemberships)
    .where(and(inArray(clanMemberships.playerId, ids), isNull(clanMemberships.leftAt)));
  const clanIds = new Set([...extraClanIds, ...before.map((row) => row.clanId)]);
  for (const monument of locked.monuments) if (monument.controllerClanId !== null) clanIds.add(monument.controllerClanId);
  for (const id of [...clanIds].sort()) await tx.select({ id: clans.id }).from(clans).where(eq(clans.id, id)).for('update');
  if (extraClanIds.length > 0) {
    const peers = await tx.select({ playerId: clanMemberships.playerId }).from(clanMemberships)
      .where(and(inArray(clanMemberships.clanId, [...extraClanIds]), isNull(clanMemberships.leftAt)));
    ids = [...new Set([...ids, ...peers.map((row) => row.playerId)])].sort();
  }
  if (ids.length === 0) return new Map();
  await lockClanPlayers(tx, ids);
  const memberships = await tx.select({ playerId: clanMemberships.playerId, clanId: clanMemberships.clanId })
    .from(clanMemberships).innerJoin(clans, and(eq(clans.id, clanMemberships.clanId), isNull(clans.disbandedAt)))
    .where(and(inArray(clanMemberships.playerId, ids), isNull(clanMemberships.leftAt)));
  if (memberships.some((row) => !clanIds.has(row.clanId))) {
    throw new GameError('MEMBERSHIP_CHANGED', 'Your clan changed; refresh and try again', 409);
  }
  return new Map(memberships.map((row) => [row.playerId, row.clanId]));
}

/** One gatherer for preview and commit. No private enemy manifest escapes the quote. */
async function gatherMonumentSend(tx: Tx, input: MonumentSendInput, preview = false) {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) throw new GameError('BAD_FLEET', 'Choose a nonempty fleet of mobile ships', 400);
  const fleet: Fleet = Object.fromEntries(fleetEntries(parsed.data.fleet));
  const [target] = await tx.select({ seasonId: monuments.seasonId }).from(monuments).where(eq(monuments.id, input.monumentId));
  if (!target) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  const capital = await capitalPlanet(tx, input.senderPlayerId);
  if (capital.seasonId !== target.seasonId) throw new GameError('CROSS_SEASON', 'That monument is in another galaxy', 403);
  const own = await tx.select({ id: planets.id }).from(planets).where(eq(planets.controllerPlayerId, input.senderPlayerId));
  const worlds = preview ? null : await lockWorlds(tx, [...own.map((row) => row.id), input.originPlanetId]);
  const origin = await (preview ? readPlanetState : loadLocked)(tx, input.originPlanetId, input.clock, { expectedPlayerId: input.senderPlayerId });
  assertWorldOperational(origin);
  assertOutsideSilentSpace(origin);
  const locked = preview ? (await readMonumentRosters(tx, [input.monumentId], [input.senderPlayerId]))[0]!
    : await lockMonument(tx, input.monumentId, true, [input.senderPlayerId]);
  if (origin.seasonId !== locked.season.id) throw new GameError('CROSS_SEASON', 'That monument is in another galaxy', 403);
  if (input.clock.now() >= locked.season.endsAt) throw new GameError('SEASON_FROZEN', 'That season is over', 409);
  if (preview) {
    if (projectMonumentHold(locked, origin.now, await hpSourcesForSeason(tx, origin.seasonId))) {
      throw new GameError('MONUMENT_ARRIVAL_PENDING', 'A casualty must resolve before quoting this target', 409);
    }
  } else await settleLockedMonument(tx, locked, origin.now);
  const memberships = locked.memberships;
  // Protection expiry updates every owned world's boost. Never discover and lock
  // another world after the target: a concurrent ownership change requests retry.
  const currentWorlds = await tx.select({ id: planets.id }).from(planets).where(eq(planets.controllerPlayerId, input.senderPlayerId));
  if (worlds !== null && currentWorlds.some((world) => !worlds.has(world.id))) throw new GameError('PLACEMENT_CHANGED', 'Your worlds changed; refresh and try again', 409);
  for (const [hull, count] of fleetEntries(fleet)) {
    if ((origin.homeFleet[hull] ?? 0) < count) throw new GameError('NOT_ENOUGH_SHIPS', `Not enough ${hull} at home`, 400, { hull });
  }
  await assertFreeBay(tx, origin.planetId, origin.buildings.CORE, origin.faults);
  const friendly = locked.monument.controllerPlayerId === input.senderPlayerId
    || (locked.monument.controllerClanId !== null && memberships.get(input.senderPlayerId) === locked.monument.controllerClanId);
  if (input.purpose === 'REINFORCE' && !friendly) throw new GameError('MONUMENT_NOT_FRIENDLY', 'Reinforce a monument your side controls', 403);
  if (input.purpose === 'ATTACK' && friendly) throw new GameError('MONUMENT_FRIENDLY_FIRE', 'Your side already controls that monument', 403);
  const holdIds = new Set(locked.waves.filter((wave) => wave.status === 'HOLD').map((wave) => wave.id));
  const used = locked.lots.filter((lot) => holdIds.has(lot.waveId)).reduce((n, lot) => n + hangarLoad({ [lot.hull]: lot.count }), 0);
  const isFriend = (playerId: string): boolean => locked.monument.controllerPlayerId === playerId
    || (locked.monument.controllerClanId !== null && memberships.get(playerId) === locked.monument.controllerClanId);
  const reserved = locked.waves.filter((wave) => wave.status === 'OUTBOUND' && isFriend(wave.playerId))
    .reduce((n, wave) => n + wave.reservedBulk, 0);
  const bulk = hangarLoad(fleet);
  if (friendly && used + reserved + bulk > locked.monument.capacity) throw new GameError('MONUMENT_CAPACITY_FULL', 'That monument has no room for this reinforcement', 409, {
    used, reserved, needed: bulk, total: locked.monument.capacity,
  });
  const dist = distance(origin, locked.monument);
  const fuel = missionFuel(fleet, dist, 2);
  assertFuel(fuel, origin.deuterium);
  const tech = await techOf(tx, input.senderPlayerId);
  const travelMinutes = fleetTravelExact(dist, fleet, { boost: fleetSpeedMult(origin.orbit), tech });
  if (!Number.isFinite(travelMinutes) || fleetCount(fleet) === 0) throw new GameError('BAD_FLEET', 'That fleet cannot travel', 400);
  const arriveAt = addMinutes(origin.now, travelMinutes);
  // A native monument wave must reach the target while the season is still
  // open. Once it has arrived, the season-close adapter can transfer it home
  // at the cutoff without inventing a new return flight.
  assertSeasonOpenThrough(origin, arriveAt);
  const pvp = input.purpose === 'ATTACK' && holdIds.size > 0;
  if (pvp) {
    for (const playerId of new Set(locked.waves.filter((wave) => holdIds.has(wave.id)).map((wave) => wave.playerId))) {
      await assertClanHostilityAllowed(tx, input.senderPlayerId, playerId, origin.now);
    }
  }
  // Every native monument dispatch leaves the sender's newcomer/recovery
  // shield, including a neutral attack and a friendly reinforcement.  The
  // quote exposes the same decision that the commit will enforce.
  const protections = await protectionsOf(tx, [input.senderPlayerId], origin.now);
  const sources = await hpSourcesForSeason(tx, origin.seasonId);
  const doseHp = segmentsExposureHp([{ from: origin, to: locked.monument, startMs: origin.now.getTime(), endMs: arriveAt.getTime() }], sources);
  const arrival = applyHpDose(fleet, null, doseHp, tech);
  const health = fleetEntries(fleet).map(([hull, count]) => {
    const maxHp = HULLS[hull].hp * hullTech(tech, hull).hp;
    const damage = arrival.lots.find((lot) => lot.hull === hull);
    const damageBp = (arrival.fleet[hull] ?? 0) === 0 ? 10_000 : damage?.damageBp ?? 0;
    const remainderBp = damage?.remainderBp ?? 0;
    return { hull, count, maxHp, remainingHp: maxHp * (1 - (damageBp + remainderBp) / 10_000), damageBp, remainderBp };
  });
  const quote: MonumentQuote = {
    fuel, arriveAt: arriveAt.toISOString(), travelMinutes,
    room: { used, reserved: friendly ? reserved : 0, total: locked.monument.capacity, after: used + (friendly ? reserved + bulk : 0) },
    bays: await baysOf(tx, origin.planetId, origin.buildings.CORE),
    shieldWouldDrop: protections.get(input.senderPlayerId) != null,
    ...(friendly ? { holdForecast: friendlyHoldForecast(locked, input.senderPlayerId, arrival, tech, arriveAt, sources) } : {}),
    outboundForecast: { doseHp, destroyed: fleetCount(arrival.destroyed), fleet: arrival.fleet, health },
  };
  return { locked, origin, fleet, tech, bulk, fuel, arriveAt, pvp, quote };
}

export async function quoteMonument(tx: Tx, input: MonumentSendInput): Promise<MonumentQuote> {
  return (await gatherMonumentSend(tx, input, true)).quote;
}

/** A physical dispatch, fuel, warning and native event are committed together. */
export async function sendMonument(tx: Tx, input: MonumentSendInput): Promise<{ wave: WaveRow; quote: MonumentQuote }> {
  const context = await gatherMonumentSend(tx, input);
  const { origin, fleet, locked } = context;
  if (context.quote.outboundForecast.destroyed > 0 && !input.acknowledgeRadiationLoss) {
    throw new GameError('RADIATION_LETHAL', 'Radiation on this route would destroy ships', 409, { count: context.quote.outboundForecast.destroyed });
  }
  await assertOwnShieldLoss(tx, { attackerPlayerId: input.senderPlayerId, now: origin.now, acknowledgeShieldLoss: input.acknowledgeShieldLoss ?? false });
  const [wave] = await tx.insert(monumentWaves).values({
    seasonId: origin.seasonId, monumentId: locked.monument.id, playerId: input.senderPlayerId, originPlanetId: origin.planetId,
    // The UUID is allocated before the insert so the physical location is explicit.
    ...newWaveIdentity(), purpose: input.purpose, sentFleet: fleet, tech: context.tech,
    route: [{ from: { x: origin.x, y: origin.y, z: origin.z }, to: { x: locked.monument.x, y: locked.monument.y, z: locked.monument.z }, startMs: origin.now.getTime(), endMs: context.arriveAt.getTime() }],
    reservedBulk: input.purpose === 'REINFORCE' ? context.bulk : 0, fuelPaid: context.fuel,
    sentAt: origin.now, arriveAt: context.arriveAt, radiationSettledAt: origin.now,
  }).returning();
  if (!wave) throw new Error('monument dispatch insert returned no row');
  await markProgress(tx, input.senderPlayerId, origin.now); // D212
  const remaining: Fleet = { ...origin.homeFleet };
  for (const [hull, count] of fleetEntries(fleet)) remaining[hull] = (remaining[hull] ?? 0) - count;
  await setUnits(tx, origin.planetId, remaining, 'home', input.senderPlayerId);
  await setUnits(tx, origin.planetId, fleet, wave.unitLocation, input.senderPlayerId);
  const manifest = await tx.insert(monumentShipLots).values(MOBILE_HULLS.flatMap((hull) => (fleet[hull] ?? 0) > 0 ? [{
    waveId: wave.id, hull, count: fleet[hull]!, damageBp: 0, remainderBp: 0, deuterium: 0,
  }] : [])).returning();
  await saveResources(tx, origin.planetId, { alloy: origin.alloy, crystal: origin.crystal, deuterium: origin.deuterium - context.fuel });
  await recomputePlayerWealth(tx, input.senderPlayerId);
  await schedule(tx, { seasonId: origin.seasonId, kind: 'monument_arrival', refId: wave.id,
    dedupeKey: `monument-arrival:${wave.id}:0`, payload: { generation: 0 }, resolveAt: context.arriveAt });
  await scheduleFlightBoundary(tx, wave, manifest.map((lot) => ({ ...lot, playerId: wave.playerId, tech: wave.tech })),
    await hpSourcesForSeason(tx, wave.seasonId), locked.season.endsAt);
  if (context.pvp) {
    const holders = new Set(locked.waves.filter((row) => row.status === 'HOLD').map((row) => row.playerId));
    for (const playerId of holders) await notify(tx, { playerId, kind: 'monument_inbound', at: origin.now, refId: wave.id,
      payload: { targetKind: 'MONUMENT', monumentId: locked.monument.id, monumentOrdinal: locked.monument.ordinal, waveId: wave.id, arriveAt: context.arriveAt.toISOString() } });
  }
  await publish(tx, input.senderPlayerId, 'private:monument');
  await publishShard(tx, origin.seasonId, 'launch');
  return { wave, quote: context.quote };
}
