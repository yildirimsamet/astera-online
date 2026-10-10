import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  HULLS, applyMonumentHpDose, combatValue, distance, fleetCount, fleetPace, fleetSpeedMult, fleetTravelExact,
  hangarLoad, hpLethalAtMs, hpRadiationApplies, hullTech, interpolatePosition, monumentCargoCapacity,
  produceMonumentDeuterium, recallMonumentShips, segmentsExposureHp, settleMonumentHold,
  type Fleet, type HpRadiationSource, type MonumentShipLot, type Segment, type Vec3,
} from '@astera/rules';
import type { Tx } from '../db/client.js';
import { addMinutes } from '../clock.js';
import { accounts, clanMemberships, clans, monumentProbes, monuments, monumentShipLots, monumentWaves, planets, players } from '../db/schema.js';
import { lockMonuments, readMonumentRosters, projectMonumentHold, type LockedMonument } from './monument.js';
import { advanceLockedMonument, monumentEndpoints, monumentHomes } from './monumentArrival.js';
import { resolveMonumentReturn, settleMonumentFlight } from './monumentMovement.js';
import { readMonumentProbeReports, resolveMonumentProbe } from './monumentProbe.js';
import { hpSourcesForSeason } from './radiationSources.js';
import { GameError, lockSeason, orbitOf } from './planet.js';
import { lockWorlds, safeHomePlanet } from './ownership.js';
import { monumentRouteSchema } from './monumentBoundaries.js';

interface Reader { playerId: string; seasonId: string; at: Date; adminUsernames: readonly string[] }
const activeStatuses = ['OUTBOUND', 'HOLD', 'RETURNING'] as const;
const fleetOf = (lots: readonly MonumentShipLot[]): Fleet => {
  const fleet: Fleet = {};
  for (const lot of lots) fleet[lot.hull] = (fleet[lot.hull] ?? 0) + lot.count;
  return fleet;
};

/** Scope by the authenticated galaxy before any target/manifest can be read or changed. */
export async function assertMonumentAvailable(tx: Tx, seasonId: string, monumentId?: string, mutation = false, at?: Date) {
  const season = await lockSeason(tx, seasonId, false);
  if (!hpRadiationApplies(season.rulesetVersion)) {
    if (mutation) throw new GameError('MONUMENT_UNAVAILABLE', 'Monuments begin in a new galaxy', 409);
    if (monumentId) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
    return null;
  }
  if (mutation && (season.status !== 'live' || (at !== undefined && at >= season.endsAt))) throw new GameError('SEASON_FROZEN', 'This galaxy is closed', 409);
  if (monumentId) {
    const [target] = await tx.select({ id: monuments.id }).from(monuments).where(and(eq(monuments.id, monumentId), eq(monuments.seasonId, seasonId)));
    if (!target) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  }
  return season;
}

/** Reads and quotes reconcile overdue battles/probes before changing the target cursor. */
export async function reconcileMonumentViews(tx: Tx, input: Reader, monumentId?: string) {
  const season = await assertMonumentAvailable(tx, input.seasonId, monumentId);
  if (!season) return [];
  const rows = await tx.select({ id: monuments.id }).from(monuments).where(and(eq(monuments.seasonId, season.id),
    monumentId === undefined ? undefined : eq(monuments.id, monumentId)));
  return reconcileMonumentTargets(tx, input, rows.map((row) => row.id));
}

/** All endpoints precede all target/clan/player locks, including multi-target reads and operator changes. */
export async function reconcileMonumentTargets(tx: Tx, input: Omit<Reader, 'playerId'> & { playerId?: string }, ids: readonly string[]) {
  const season = await assertMonumentAvailable(tx, input.seasonId);
  if (!season || ids.length === 0) return [];
  const endpoints = await monumentEndpoints(tx, ids);
  const owned = input.playerId === undefined ? [] : await tx.select({ id: planets.id }).from(planets).where(eq(planets.controllerPlayerId, input.playerId));
  const worldIds = [...endpoints.planetIds, ...owned.map((row) => row.id)];
  const worlds = worldIds.length === 0 ? new Map<string, typeof planets.$inferSelect>() : await lockWorlds(tx, worldIds, {
    requireLive: season.status === 'live',
  });
  const locked = await lockMonuments(tx, ids, { requireLive: season.status === 'live', extraPlayerIds: input.playerId === undefined ? [] : [input.playerId] });
  if (season.status !== 'live') return locked;
  for (const target of locked) {
    const homes = await monumentHomes(tx, target, endpoints.homeIds, worlds);
    await advanceLockedMonument(tx, target, homes, input.at, input.adminUsernames);
    for (const wave of target.waves.filter((row) => input.playerId === undefined || row.playerId === input.playerId)) {
      if (wave.status === 'RETURNING' && wave.arriveAt !== null && wave.arriveAt <= input.at && wave.arriveAt < season.endsAt) {
        const landed = await resolveMonumentReturn(tx, { waveId: wave.id, generation: wave.generation, at: input.at });
        if (landed) Object.assign(wave, landed.wave);
      } else if (wave.status === 'OUTBOUND' || wave.status === 'RETURNING') await settleMonumentFlight(tx, target, wave.id, input.at);
    }
  }
  const probes = await tx.select().from(monumentProbes).where(and(input.playerId === undefined ? undefined : eq(monumentProbes.playerId, input.playerId),
    inArray(monumentProbes.monumentId, [...ids]), eq(monumentProbes.status, 'RETURNING')));
  for (const probe of probes) if (probe.homeAt !== null && probe.homeAt <= input.at && probe.homeAt < season.endsAt) await resolveMonumentProbe(tx, {
    probeId: probe.id, leg: 'HOME', at: input.at, adminUsernames: input.adminUsernames });
  return locked;
}

/** Ordinary views/quotes project elapsed income and health. Only a due physical transition invokes the writer. */
export async function projectMonumentTargets(tx: Tx, input: Reader, ids: readonly string[]) {
  const targets = await readMonumentRosters(tx, ids, [input.playerId]);
  if (targets.length === 0) return targets;
  const sources = await hpSourcesForSeason(tx, input.seasonId);
  const probes = await tx.select().from(monumentProbes).where(and(
    inArray(monumentProbes.monumentId, [...ids]),
    inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING'])));
  // Probe windows are inexpensive to read; their actual observe/delivery boundary
  // has to remain chronological with any battle that changed the target.
  let due = probes.some((probe) => {
    const season = targets.find((target) => target.monument.id === probe.monumentId)?.season;
    if (season?.status !== 'live') return false;
    const boundary = probe.status === 'OUTBOUND' ? probe.arriveAt : probe.playerId === input.playerId ? probe.homeAt : null;
    return boundary !== null && boundary <= input.at && boundary < season.endsAt;
  });
  for (const target of targets) {
    if (target.season.status !== 'live') continue;
    const at = new Date(Math.min(input.at.getTime(), target.season.endsAt.getTime()));
    due ||= target.waves.some((wave) => (wave.status === 'OUTBOUND' || (wave.status === 'RETURNING' && wave.playerId === input.playerId))
      && wave.arriveAt !== null && wave.arriveAt <= at && wave.arriveAt < target.season.endsAt);
    due ||= target.monument.emptySince !== null && fleetCount(target.monument.garrison) === 0
      && target.monument.emptySince.getTime() + 86_400_000 <= at.getTime() && at < target.season.endsAt;
    due ||= projectMonumentHold(target, at, sources);
    if (due) break;
    for (const wave of target.waves.filter((wave) => wave.playerId === input.playerId && (wave.status === 'OUTBOUND' || wave.status === 'RETURNING'))) {
      const toMs = Math.max(wave.radiationSettledAt.getTime(), Math.min(at.getTime(), wave.arriveAt?.getTime() ?? at.getTime()));
      const windows = sources.flatMap((source) => {
        const activeFromMs = Math.max(source.activeFromMs, wave.radiationSettledAt.getTime());
        const activeUntilMs = Math.min(source.activeUntilMs ?? toMs, toMs);
        return activeFromMs < activeUntilMs ? [{ ...source, activeFromMs, activeUntilMs }] : [];
      });
      const projected = applyMonumentHpDose(target.lots.filter((lot) => lot.waveId === wave.id),
        segmentsExposureHp(monumentRouteSchema.parse(wave.route), windows));
      if (projected.destroyed.length > 0) { due = true; break; }
      target.lots = [...target.lots.filter((lot) => lot.waveId !== wave.id), ...projected.lots];
      wave.radiationSettledAt = new Date(toMs);
    }
  }
  return due ? reconcileMonumentTargets(tx, input, ids) : targets;
}

type PublicMonumentTarget = Pick<LockedMonument, 'monument' | 'season' | 'waves' | 'memberships'> & {
  // Public projections only need the physical occupancy fields.  The private
  // lot shape also carries owner/research data which must never be required by
  // (or accidentally exposed through) the galaxy reader.
  lots: Pick<MonumentShipLot, 'waveId' | 'hull' | 'count'>[];
};

export async function publicMonumentFacts(tx: Tx, targets: readonly PublicMonumentTarget[], at: Date) {
  const sourcesBySeason = new Map<string, HpRadiationSource[]>();
  for (const seasonId of new Set(targets.map(({ monument }) => monument.seasonId))) {
    sourcesBySeason.set(seasonId, await hpSourcesForSeason(tx, seasonId));
  }
  const playerIds = targets.flatMap(({ monument }) => monument.controllerPlayerId ? [monument.controllerPlayerId] : []);
  const clanIds = targets.flatMap(({ monument }) => monument.controllerClanId ? [monument.controllerClanId] : []);
  const names = playerIds.length === 0 ? [] : await tx.select({ id: players.id, name: accounts.displayName }).from(players)
    .innerJoin(accounts, eq(accounts.id, players.accountId)).where(inArray(players.id, playerIds));
  const clanNames = clanIds.length === 0 ? [] : await tx.select({ id: clans.id, name: clans.name, tag: clans.tag }).from(clans).where(inArray(clans.id, clanIds));
  return targets.map(({ monument: m, season, waves, lots, memberships }) => {
    const held = new Set(waves.filter((wave) => wave.status === 'HOLD').map((wave) => wave.id));
    const controller = m.controllerPlayerId !== null ? { kind: 'PLAYER' as const, playerId: m.controllerPlayerId, name: names.find((row) => row.id === m.controllerPlayerId)?.name ?? '' }
      : m.controllerClanId !== null ? { kind: 'CLAN' as const, clanId: m.controllerClanId, name: clanNames.find((row) => row.id === m.controllerClanId)?.name ?? '',
        tag: clanNames.find((row) => row.id === m.controllerClanId)?.tag ?? '' } : { kind: 'NEUTRAL' as const };
    const reserved = waves.filter((wave) => wave.status === 'OUTBOUND' && wave.purpose === 'REINFORCE'
      && (wave.playerId === m.controllerPlayerId || (m.controllerClanId !== null && memberships.get(wave.playerId) === m.controllerClanId)))
      .reduce((sum, wave) => sum + wave.reservedBulk, 0);
    return { id: m.id, ordinal: m.ordinal, position: { x: m.x, y: m.y, z: m.z }, controller,
      capacity: m.capacity, used: lots.filter((lot) => held.has(lot.waveId)).reduce((sum, lot) => sum + hangarLoad({ [lot.hull]: lot.count }), 0),
      reserved, productionPerMinute: m.productionPerMinute,
      // Persisted windows have millisecond precision. This instantaneous sample
      // shares the exact sphere/shelter rules used to settle a ship's actual dose.
      radiationHpPerMinute: segmentsExposureHp([{ from: m, to: m, startMs: at.getTime(), endMs: at.getTime() + 1 }],
        sourcesBySeason.get(m.seasonId) ?? []) * 60_000,
      emptySince: m.emptySince?.toISOString() ?? null,
      respawnAt: m.emptySince !== null && m.controllerPlayerId === null && m.controllerClanId === null
        && m.emptySince.getTime() + 86_400_000 < season.endsAt.getTime()
        ? new Date(m.emptySince.getTime() + 86_400_000).toISOString() : null };
  });
}

/**
 * Read the public monument projection without taking a target or roster lock.
 *
 * The galaxy is polled by every commander.  A malformed private manifest or a
 * delayed arrival must not turn that public read into a write transaction (or
 * make an unrelated player inherit its repair error).  Mutating reads still use
 * `reconcileMonumentViews`; this helper deliberately only reads the public rows.
 */
export async function readPublicMonumentFacts(tx: Tx, seasonId: string, at: Date, monumentId?: string) {
  const season = await assertMonumentAvailable(tx, seasonId, monumentId);
  if (!season) return [];
  const rows = await tx.select().from(monuments).where(and(eq(monuments.seasonId, season.id),
    monumentId === undefined ? undefined : eq(monuments.id, monumentId)));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];
  const waves = await tx.select().from(monumentWaves)
    .where(and(inArray(monumentWaves.monumentId, ids), inArray(monumentWaves.status, [...activeStatuses])));
  const waveIds = waves.map((wave) => wave.id);
  const lots = waveIds.length === 0 ? [] : await tx.select().from(monumentShipLots).where(inArray(monumentShipLots.waveId, waveIds));
  const playerIds = [...new Set(waves.map((wave) => wave.playerId))];
  const memberships = new Map<string, string>();
  if (playerIds.length > 0) {
    const memberRows = await tx.select({ playerId: clanMemberships.playerId, clanId: clanMemberships.clanId })
      .from(clanMemberships).where(and(inArray(clanMemberships.playerId, playerIds), isNull(clanMemberships.leftAt)));
    for (const row of memberRows) memberships.set(row.playerId, row.clanId);
  }
  const facts = await publicMonumentFacts(tx, rows.map((monument) => ({ monument, season,
    waves: waves.filter((wave) => wave.monumentId === monument.id),
    lots: lots.filter((lot) => waves.some((wave) => wave.id === lot.waveId && wave.monumentId === monument.id)),
    memberships })), at);
  // Future friendly reservations are private capacity state, not a public
  // monument fact.  The private monument endpoint adds the caller's own value.
  return facts.map(({ reserved: _reserved, ...fact }) => fact);
}

export function monumentWavePosition(wave: typeof monumentWaves.$inferSelect, target: Vec3, at: Date): Vec3 {
  if (wave.status === 'HOLD') return { x: target.x, y: target.y, z: target.z };
  const route = monumentRouteSchema.parse(wave.route);
  const leg = route.find((row) => row.endMs >= at.getTime()) ?? route[route.length - 1]!;
  return interpolatePosition(leg.from, leg.to, leg.startMs, leg.endMs, at.getTime());
}

const lotHealth = (lot: MonumentShipLot) => {
  const maxHp = HULLS[lot.hull].hp * hullTech(lot.tech, lot.hull).hp;
  return { id: lot.id, hull: lot.hull, count: lot.count, damageBp: lot.damageBp, remainderBp: lot.remainderBp,
    maxHp, remainingHp: maxHp * (1 - (lot.damageBp + lot.remainderBp) / 10_000),
    deuterium: lot.deuterium, cargoCapacity: monumentCargoCapacity(lot) };
};

async function returnForecast(tx: Tx, target: LockedMonument, wave: typeof monumentWaves.$inferSelect, lots: MonumentShipLot[], at: Date) {
  const homeId = await safeHomePlanet(tx, wave.playerId, wave.originPlanetId);
  const [home] = await tx.select().from(planets).where(eq(planets.id, homeId));
  if (!home) throw new GameError('PLANET_NOT_OWNED', 'Your return world changed', 409);
  const fleet = fleetOf(lots);
  const homePosition = { x: home.x, y: home.y, z: home.z };
  if (at >= target.season.endsAt) return { homePlanetId: homeId, homePosition, speed: 0, arriveAt: target.season.endsAt.toISOString(), minutes: 0,
    doseHp: 0, destroyed: 0, deuterium: lots.reduce((sum, lot) => sum + lot.deuterium, 0), lots: lots.map(lotHealth), lostDeuterium: 0 };
  const position = monumentWavePosition(wave, target.monument, at);
  const modifiers = { boost: fleetSpeedMult(await orbitOf(tx, homeId)), tech: wave.tech };
  const minutes = fleetTravelExact(distance(position, home), fleet, modifiers);
  const arriveAt = wave.status === 'RETURNING' && wave.arriveAt !== null ? wave.arriveAt : addMinutes(at, minutes);
  const route: Segment[] = wave.status === 'RETURNING' ? monumentRouteSchema.parse(wave.route)
    : [{ from: position, to: { x: home.x, y: home.y, z: home.z }, startMs: at.getTime(), endMs: arriveAt.getTime() }];
  const sources = (await hpSourcesForSeason(tx, target.season.id)).map((source) => ({ ...source, activeFromMs: Math.max(at.getTime(), source.activeFromMs),
    activeUntilMs: Math.min(source.activeUntilMs ?? target.season.endsAt.getTime(), target.season.endsAt.getTime()) }));
  const doseHp = segmentsExposureHp(route, sources);
  const forecast = applyMonumentHpDose(lots, doseHp);
  return { homePlanetId: homeId, homePosition, speed: fleetPace(fleet, modifiers), arriveAt: arriveAt.toISOString(), minutes: Math.max(0, (arriveAt.getTime() - at.getTime()) / 60_000),
    doseHp, destroyed: forecast.destroyed.reduce((sum, lot) => sum + lot.count, 0),
    deuterium: forecast.lots.reduce((sum, lot) => sum + lot.deuterium, 0), lots: forecast.lots.map(lotHealth), lostDeuterium: forecast.lostDeuterium };
}

async function ownWaves(tx: Tx, targets: readonly LockedMonument[], input: Reader) {
  const result = [];
  for (const target of targets) {
    const at = new Date(Math.min(input.at.getTime(), target.season.endsAt.getTime()));
    const sources = await hpSourcesForSeason(tx, input.seasonId);
    const held = new Set(target.waves.filter((row) => row.status === 'HOLD').map((row) => row.id));
    const allHeld = target.lots.filter((lot) => held.has(lot.waveId));
    const flowing = produceMonumentDeuterium(allHeld, target.monument.productionPerMinute);
    for (const wave of target.waves.filter((row) => row.playerId === input.playerId && (row.status === 'OUTBOUND' || row.status === 'HOLD' || row.status === 'RETURNING'))) {
      const lots = target.lots.filter((lot) => lot.waveId === wave.id);
      const rate = flowing.lots.filter((lot) => lot.waveId === wave.id)
        .reduce((sum, lot) => sum + lot.deuterium - (lots.find((before) => before.id === lot.id)?.deuterium ?? 0), 0);
      const segment: Segment[] = [{ from: target.monument, to: target.monument, startMs: at.getTime(), endMs: target.season.endsAt.getTime() }];
      const forecastSources = sources.map(source => ({ ...source, activeFromMs: Math.max(at.getTime(), source.activeFromMs),
        activeUntilMs: Math.min(source.activeUntilMs ?? target.season.endsAt.getTime(), target.season.endsAt.getTime()) }))
        .filter(source => source.activeUntilMs >= source.activeFromMs);
      const remainingPath = wave.status === 'HOLD' ? segment : monumentRouteSchema.parse(wave.route);
      const lossTimes = lots.map(lot => hpLethalAtMs(remainingPath, forecastSources, lot));
      const nextLoss = lossTimes.filter((time): time is number => time !== null);
      const fadeAt = wave.status !== 'HOLD' && lots.length > 0 && nextLoss.length === lots.length ? Math.max(...nextLoss) : null;
      const ownerLots = allHeld.filter((lot) => lot.waveId === wave.id);
      const room = ownerLots.reduce((sum, lot) => sum + monumentCargoCapacity(lot) - lot.deuterium, 0);
      let fillsAt: number | null = null;
      // A forecast assumes the current fleet. Search only while all its current cargo remains alive.
      const cargoDeaths = ownerLots.filter((lot) => monumentCargoCapacity(lot) > 0).map((lot) => hpLethalAtMs(segment, sources, lot)).filter((time): time is number => time !== null);
      const until = Math.min(target.season.endsAt.getTime(), ...cargoDeaths.map((death) => death - 1));
      if (room === 0 && ownerLots.some((lot) => monumentCargoCapacity(lot) > 0) && at < target.season.endsAt) fillsAt = at.getTime();
      else if (wave.status === 'HOLD' && ownerLots.some((lot) => monumentCargoCapacity(lot) > 0)
        && until > at.getTime() && combatValue(fleetOf(ownerLots)) > 0) {
        const fullAt = (toMs: number): boolean => {
          const preview = settleMonumentHold(allHeld, { fromMs: at.getTime(), toMs, position: target.monument,
            productionPerMinute: target.monument.productionPerMinute, sources });
          return preview.lots.filter((lot) => lot.waveId === wave.id).every((lot) => monumentCargoCapacity(lot) - lot.deuterium < 1e-7);
        };
        if (fullAt(until)) {
          let low = at.getTime(), high = until;
          while (high - low > 1) { const middle = Math.floor((low + high) / 2); if (fullAt(middle)) high = middle; else low = middle; }
          fillsAt = high;
        }
      }
      result.push({ id: wave.id, monumentId: wave.monumentId, playerId: wave.playerId, originPlanetId: wave.originPlanetId,
        rootWaveId: wave.rootWaveId, jointOperationId: wave.jointOperationId, status: wave.status, purpose: wave.purpose,
        heldAt: wave.heldAt?.toISOString() ?? null, sentAt: wave.sentAt.toISOString(), arriveAt: wave.arriveAt?.toISOString() ?? null,
        position: monumentWavePosition(wave, target.monument, at), route: wave.route, tech: wave.tech,
        fleet: fleetOf(lots), lots: lots.map(lotHealth), deuterium: lots.reduce((sum, lot) => sum + lot.deuterium, 0),
        productionPerMinute: wave.status === 'HOLD' && at < target.season.endsAt ? rate : 0, fillsAt: fillsAt === null ? null : new Date(fillsAt).toISOString(),
        nextLossAt: nextLoss.length === 0 ? null : new Date(Math.min(...nextLoss)).toISOString(),
        fadeAt: fadeAt === null ? null : new Date(fadeAt).toISOString(),
        returnReason: wave.returnReason,
        returnForecast: await returnForecast(tx, target, wave, lots, at) });
    }
  }
  return result;
}

export async function readMonuments(tx: Tx, input: Reader, monumentId?: string) {
  const publicFacts = await readPublicMonumentFacts(tx, input.seasonId, input.at, monumentId);
  const ids = publicFacts.map((target) => target.id);
  const ownWaveRows = ids.length === 0 ? [] : await tx.select({ monumentId: monumentWaves.monumentId }).from(monumentWaves)
    .where(and(eq(monumentWaves.playerId, input.playerId), inArray(monumentWaves.monumentId, ids),
      inArray(monumentWaves.status, [...activeStatuses])));
  const ownProbeRows = ids.length === 0 ? [] : await tx.select({ monumentId: monumentProbes.monumentId }).from(monumentProbes)
    .where(and(eq(monumentProbes.playerId, input.playerId), inArray(monumentProbes.monumentId, ids),
      inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING'])));
  const targets = await projectMonumentTargets(tx, input, [...new Set([...ownWaveRows, ...ownProbeRows].map((row) => row.monumentId))]);
  const privateFacts = targets.length > 0 ? await publicMonumentFacts(tx, targets, input.at) : [];
  const factsById = new Map([...publicFacts, ...privateFacts].map((target) => [target.id, target]));
  const ownReservations = ids.length === 0 ? [] : await tx.select({ monumentId: monumentWaves.monumentId, reservedBulk: monumentWaves.reservedBulk })
    .from(monumentWaves).where(and(eq(monumentWaves.playerId, input.playerId), inArray(monumentWaves.monumentId, ids),
      eq(monumentWaves.status, 'OUTBOUND'), eq(monumentWaves.purpose, 'REINFORCE')));
  const reservedByMonument = new Map<string, number>();
  for (const row of ownReservations) reservedByMonument.set(row.monumentId, (reservedByMonument.get(row.monumentId) ?? 0) + row.reservedBulk);
  const probes = ids.length === 0 ? [] : await tx.select().from(monumentProbes).where(and(eq(monumentProbes.playerId, input.playerId),
    inArray(monumentProbes.monumentId, ids), inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING'])));
  const reports = await readMonumentProbeReports(tx, input.playerId);
  return { serverNow: input.at.toISOString(), monuments: ids.map((id) => {
    const fact = factsById.get(id);
    return fact ? { ...fact, reserved: reservedByMonument.get(id) ?? 0 } : null;
  }).filter((fact): fact is NonNullable<typeof fact> => fact !== null), waves: await ownWaves(tx, targets, input),
    probes: probes.map((probe) => ({ id: probe.id, monumentId: probe.monumentId, originPlanetId: probe.originPlanetId,
      status: probe.status, departAt: probe.departAt.toISOString(), arriveAt: probe.arriveAt.toISOString(), homeAt: probe.homeAt?.toISOString() ?? null,
      route: probe.status === 'OUTBOUND' ? probe.outboundRoute : probe.returnRoute })),
    probeReports: reports.filter((report) => ids.includes(report.monumentId)) };
}

export async function quoteMonumentRecall(tx: Tx, input: Reader & { waveId: string; selections: readonly { lotId: string; count: number }[] }) {
  const [identity] = await tx.select().from(monumentWaves).where(and(eq(monumentWaves.id, input.waveId), eq(monumentWaves.seasonId, input.seasonId)));
  if (!identity) throw new GameError('MONUMENT_WAVE_NOT_FOUND', 'No such wave', 404);
  if (identity.playerId !== input.playerId) throw new GameError('MONUMENT_WAVE_NOT_OWNED', 'That wave belongs to another commander', 403);
  await assertMonumentAvailable(tx, input.seasonId, identity.monumentId, true, input.at);
  const [target] = await projectMonumentTargets(tx, input, [identity.monumentId]);
  if (!target) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  const wave = target.waves.find((row) => row.id === identity.id);
  if (!wave || (wave.status !== 'HOLD' && wave.status !== 'OUTBOUND')) throw new GameError('MONUMENT_NOT_RECALLABLE', 'That wave cannot be recalled', 409);
  let selected: MonumentShipLot[];
  try { selected = recallMonumentShips(target.lots.filter((lot) => lot.waveId === wave.id), input.playerId,
    input.selections.map((selection) => ({ ...selection, returnLotId: randomUUID() }))).recalled; }
  catch (error) { if (!(error instanceof RangeError)) throw error; throw new GameError('BAD_MONUMENT_RECALL', error.message, 400); }
  if (selected.length === 0) throw new GameError('BAD_MONUMENT_RECALL', 'Choose at least one ship', 400);
  const forecast = await returnForecast(tx, target, wave, selected, input.at);
  return { fleet: fleetOf(selected), deuterium: selected.reduce((sum, lot) => sum + lot.deuterium, 0), arriveAt: forecast.arriveAt,
    minutes: forecast.minutes, doseHp: forecast.doseHp, destroyed: forecast.destroyed, arrivalDeuterium: forecast.deuterium,
    lots: selected.map(lotHealth), arrivalLots: forecast.lots };
}
