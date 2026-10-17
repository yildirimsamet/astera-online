import { createHmac, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import {
  ECONOMY_ADJUSTMENT, GALAXY, UNKNOWN_SIGNAL, alloyRate, collectorCap, crystalRate, deuteriumRate,
  productionHours, productionMult, radarContactRange, coreTier, distance, fleetCount, fleetEntries, fleetSpeedMult,
  fleetTravelExact, hpRadiationApplies, missionFuel, placeUnknownSignal,
  rollUnknownSignalOutcome, seededFrom, validateUnknownSignalFleet,
  type Fleet, type Vec3, type UnknownSignalOutcome, type UnknownSignalTier,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import { addMinutes, minutesSince } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { buildings, cosmeticEntitlements, planets, players, satellites, scheduledEvents, seasons, shards, units, unknownSignals, unknownSignalState, vacations } from '../db/schema.js';
import { publish } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { assertFreeBay } from './flight.js';
import { assertFuel } from './fuel.js';
import { selectHomeDispatch, takeHomeHealth } from './homeHealth.js';
import { idempotentMutation } from './idempotency.js';
import { notify } from './notifications.js';
import { lockWorlds, safeHomePlanet } from './ownership.js';
import { isPerson } from './people.js';
import { GameError, assertSeasonOpenThrough, assertWorldOperational, loadLocked, lockSeason, recomputePlayerWealth, saveResources, setUnits } from './planet.js';
import { peakCoreLevels } from './player.js';
import { techOf } from './researchState.js';
import { dockNotice, landShips } from './shipDamage.js';
import { flightPrefix, flightSegment, settleSpecialFlightRadiation } from './specialFlightRadiation.js';
import { assertOutsideSilentSpace, markProgress } from './waitingRoom.js';
import { ensureUnknownSignalSchedule, queueUnknownSignalSpawn as queueSpawn, unknownSignalSpawnKey as spawnKey } from './unknownSignalSchedule.js';

type Signal = typeof unknownSignals.$inferSelect;
const location = (id: string) => `unknown-signal:${id}`;
const minutes = (seed: string, min: number, max: number) => min + seededFrom(seed)() * (max - min);

/** Bounded, restart-safe deployment backfill. No activity/last-seen filter: offline people participate. */
export async function backfillUnknownSignals(db: Db, clock: Clock): Promise<number> {
  const candidates = await db.select({ playerId: players.id, seasonId: players.seasonId })
    .from(players).innerJoin(seasons, eq(seasons.id, players.seasonId))
    .innerJoin(shards, eq(shards.id, seasons.shardId))
    .leftJoin(unknownSignalState, eq(unknownSignalState.playerId, players.id))
    .where(and(eq(seasons.status, 'live'), isPerson, isNull(unknownSignalState.playerId),
      sql`not exists (select 1 from ${planets} p join ${buildings} b on b.planet_id = p.id and b.type = 'CORE'
        where p.player_id = ${players.id} and b.level >= 10)`))
    .orderBy(players.id).limit(250);
  const peaks = await peakCoreLevels(db, candidates.map(p => p.playerId));
  return db.transaction(async tx => {
    let count = 0;
    for (const player of candidates) {
      if (coreTier(peaks.get(player.playerId) ?? 1) > 3) continue;
      if (await ensureUnknownSignalSchedule(tx, player.playerId, player.seasonId, clock.now(), true)) count++;
    }
    return count;
  });
}

async function lockOwner(tx: Tx, playerId: string, extraWorlds: readonly string[] = []) {
  const [initial] = await tx.select().from(players).where(eq(players.id, playerId));
  if (!initial) throw new GameError('UNKNOWN_SIGNAL_NOT_FOUND', 'That signal no longer exists', 404);
  const season = await lockSeason(tx, initial.seasonId, false);
  // Normal orders lock worlds before writing commander progress/wealth. Signal
  // workers use that same order, including a former origin that changed hands.
  const owned = await tx.select({ id: planets.id }).from(planets).where(eq(planets.controllerPlayerId, playerId));
  const ids = [...owned.map(world => world.id), ...extraWorlds];
  if (ids.length > 0) await lockWorlds(tx, ids, { requireLive: false });
  const [player] = await tx.select().from(players).where(eq(players.id, playerId)).for('update');
  if (!player) throw new GameError('UNKNOWN_SIGNAL_NOT_FOUND', 'That signal no longer exists', 404);
  return { player, season };
}

async function lockedSignal(tx: Tx, id: string, playerId: string): Promise<Signal> {
  const [signal] = await tx.select().from(unknownSignals)
    .where(and(eq(unknownSignals.id, id), eq(unknownSignals.playerId, playerId))).for('update');
  if (!signal) throw new GameError('UNKNOWN_SIGNAL_NOT_FOUND', 'That signal no longer exists', 404);
  return signal;
}

async function nextSpawn(tx: Tx, state: typeof unknownSignalState.$inferSelect, appearedAt: Date, stop: boolean) {
  const sequence = state.sequence + 1;
  const nextAt = stop ? null : addMinutes(appearedAt, minutes(`unknown-signal:gap:${state.seasonId}:${state.playerId}:${String(sequence)}`,
    UNKNOWN_SIGNAL.gapMinutes[0], UNKNOWN_SIGNAL.gapMinutes[1]));
  await tx.update(unknownSignalState).set({ sequence, nextAt }).where(eq(unknownSignalState.playerId, state.playerId));
  await queueSpawn(tx, { ...state, sequence, nextAt });
}

/** The due instant, not worker observation time, owns both expiry and the next discovery. */
export async function resolveUnknownSignalSpawn(tx: Tx, playerId: string, dueAt: Date, clock: Clock, skip = false): Promise<void> {
  const { season } = await lockOwner(tx, playerId);
  const [state] = await tx.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId)).for('update');
  if (state?.nextAt?.getTime() !== dueAt.getTime() || dueAt > clock.now()) return;
  const [person] = await tx.select({ id: players.id }).from(players).where(and(eq(players.id, playerId), isPerson));
  const tier = coreTier((await peakCoreLevels(tx, [playerId])).get(playerId) ?? 1);
  const stop = !person || tier > 3 || season.status !== 'live';
  await nextSpawn(tx, state, dueAt, stop);
  if (stop || skip) return;
  const [vacation] = await tx.select({ id: vacations.id }).from(vacations).where(and(
    eq(vacations.playerId, playerId), lte(vacations.startedAt, dueAt),
    sql`coalesce(${vacations.endedAt}, ${vacations.endsAt}) > ${dueAt.toISOString()}::timestamptz`,
  )).limit(1);
  if (vacation) return;
  const [shard] = await tx.select({ role: shards.role }).from(shards).where(eq(shards.id, season.shardId));
  if (shard?.role === 'WAITING') return;
  const expiresAt = addMinutes(dueAt, UNKNOWN_SIGNAL.lifetimeMinutes);
  if (expiresAt <= clock.now()) return;
  const worlds = await tx.select({ id: planets.id, kind: planets.kind, playerId: planets.controllerPlayerId,
    x: planets.x, y: planets.y, z: planets.z }).from(planets).where(eq(planets.seasonId, season.id));
  const capital = worlds.find(p => p.kind === 'CAPITAL' && p.playerId === playerId);
  if (!capital) return;
  const [radar] = await tx.select({ level: satellites.level }).from(satellites)
    .where(and(eq(satellites.planetId, capital.id), eq(satellites.type, 'RADAR')));
  // Public ids must not let a modified client predict the bet before dispatch.
  const seed = createHmac('sha256', season.asteroidKey).update(`unknown-signal:${season.id}:${playerId}:${String(state.sequence)}`).digest('hex');
  const at = placeUnknownSignal(seed, capital, worlds, radar?.level ?? 0, GALAXY.radius);
  if (!at) { console.warn('unknown_signal_placement_skipped', { seasonId: season.id, playerId }); return; }
  // An old open row can outlive its expire event after downtime, but never blocks a fresh discovery.
  await tx.update(unknownSignals).set({ status: 'expired' }).where(and(eq(unknownSignals.playerId, playerId),
    eq(unknownSignals.status, 'open'), lte(unknownSignals.expiresAt, dueAt)));
  const [signal] = await tx.insert(unknownSignals).values({ playerId, seasonId: season.id, seed, ...at, appearedAt: dueAt, expiresAt })
    .onConflictDoNothing().returning({ id: unknownSignals.id });
  if (!signal) return;
  await schedule(tx, { seasonId: season.id, kind: 'unknown_signal_expire', refId: signal.id, resolveAt: expiresAt,
    dedupeKey: `unknown-signal:expire:${signal.id}` });
  await publish(tx, playerId, 'private:unknown-signal-spawn');
}

export async function resolveUnknownSignalExpire(tx: Tx, id: string, clock: Clock): Promise<void> {
  const [expired] = await tx.update(unknownSignals).set({ status: 'expired' })
    .where(and(eq(unknownSignals.id, id), eq(unknownSignals.status, 'open'), lte(unknownSignals.expiresAt, clock.now())))
    .returning({ playerId: unknownSignals.playerId });
  if (expired) await publish(tx, expired.playerId, 'private:unknown-signal');
}

/** Repair only clocks whose authoritative row still requires the event. Retried events remain idempotent. */
export async function repairUnknownSignals(db: Db, clock: Clock): Promise<void> {
  await backfillUnknownSignals(db, clock);
  const [states, flights] = await Promise.all([
    db.select().from(unknownSignalState).where(and(isNotNull(unknownSignalState.nextAt),
      sql`not exists (select 1 from ${scheduledEvents} e where e.ref_id = ${unknownSignalState.playerId}
        and e.kind = 'unknown_signal_spawn' and e.resolve_at = ${unknownSignalState.nextAt}
        and e.status in ('pending','processing'))`)).orderBy(unknownSignalState.nextAt).limit(250),
    db.select().from(unknownSignals).where(or(
      and(eq(unknownSignals.status, 'outbound'), sql`not exists (select 1 from ${scheduledEvents} e
        where e.ref_id = ${unknownSignals.id} and e.kind = 'unknown_signal_arrival' and e.status in ('pending','processing'))`),
      and(inArray(unknownSignals.status, ['returning', 'recalled']), sql`not exists (select 1 from ${scheduledEvents} e
        where e.ref_id = ${unknownSignals.id} and e.kind = 'unknown_signal_return' and e.status in ('pending','processing'))`),
    )).limit(250),
  ]);
  await db.transaction(async tx => {
    for (const state of states) {
      await queueSpawn(tx, state);
      if (state.nextAt) await tx.update(scheduledEvents).set({ status: 'pending', attempts: 0, claimedAt: null })
        .where(and(eq(scheduledEvents.dedupeKey, spawnKey(state.playerId, state.nextAt)), inArray(scheduledEvents.status, ['done', 'failed'])));
    }
    for (const signal of flights) {
      const outbound = signal.status === 'outbound';
      const at = outbound ? signal.arriveAt : signal.returnAt;
      if (!at) continue;
      const key = `unknown-signal:${outbound ? 'arrival' : 'return'}:${signal.id}`;
      await schedule(tx, { seasonId: signal.seasonId, kind: outbound ? 'unknown_signal_arrival' : 'unknown_signal_return',
        refId: signal.id, resolveAt: at, dedupeKey: key });
      await tx.update(scheduledEvents).set({ status: 'pending', attempts: 0, claimedAt: null })
        .where(and(eq(scheduledEvents.dedupeKey, key), inArray(scheduledEvents.status, ['done', 'failed'])));
    }
    const expired = await tx.update(unknownSignals).set({ status: 'expired' })
      .where(and(eq(unknownSignals.status, 'open'), lte(unknownSignals.expiresAt, clock.now())))
      .returning({ playerId: unknownSignals.playerId });
    for (const id of new Set(expired.map(s => s.playerId))) await publish(tx, id, 'private:unknown-signal');
  });
}

export async function dispatchUnknownSignal(db: Db, playerId: string, id: string, originId: string,
  requested: Readonly<Record<string, number>>, key: string, clock: Clock) {
  return idempotentMutation(db, { playerId, operation: 'unknown-signal:dispatch', key,
    body: { id, originId, fleet: requested }, now: clock.now() }, async tx => {
    await lockOwner(tx, playerId, [originId]);
    const signal = await lockedSignal(tx, id, playerId);
    if (signal.expiresAt <= clock.now() && (signal.status === 'open' || signal.status === 'expired')) {
      throw new GameError('UNKNOWN_SIGNAL_EXPIRED', 'That signal has faded; wait for another radar contact', 409);
    }
    if (signal.status !== 'open') throw new GameError('UNKNOWN_SIGNAL_TAKEN', 'A fleet has already been sent to this signal', 409);
    if (!validateUnknownSignalFleet(requested)) throw new GameError('UNKNOWN_SIGNAL_FLEET', 'Send exactly one T1 warship and one Courier', 400);
    const fleet: Fleet = { COURIER: 1 };
    const hull = UNKNOWN_SIGNAL.warshipHulls.find(value => requested[value] === 1);
    if (!hull) throw new GameError('UNKNOWN_SIGNAL_FLEET', 'Send exactly one T1 warship and one Courier', 400);
    fleet[hull] = 1;
    const origin = await loadLocked(tx, originId, clock, { expectedPlayerId: playerId });
    assertWorldOperational(origin);
    assertOutsideSilentSpace(origin);
    await assertFreeBay(tx, originId, origin.buildings.CORE, origin.faults);
    selectHomeDispatch(origin.homeFleet, origin.homeDamage, fleet);
    const fuel = missionFuel(fleet, distance(origin, signal), 2);
    assertFuel(fuel, origin.deuterium);
    const tech = await techOf(tx, playerId);
    const travelMinutes = fleetTravelExact(distance(origin, signal), fleet, { boost: fleetSpeedMult(origin.orbit), tech });
    const arriveAt = addMinutes(origin.now, travelMinutes);
    assertSeasonOpenThrough(origin, addMinutes(arriveAt, travelMinutes));
    const damage = await takeHomeHealth(tx, originId, fleet);
    const remaining = { ...origin.homeFleet };
    for (const [ship, count] of fleetEntries(fleet)) remaining[ship] = (remaining[ship] ?? 0) - count;
    await setUnits(tx, originId, remaining, 'home', playerId);
    await setUnits(tx, originId, fleet, location(id), playerId);
    const tier = Math.min(3, coreTier((await peakCoreLevels(tx, [playerId])).get(playerId) ?? 1));
    await tx.update(unknownSignals).set({ status: 'outbound', originPlanetId: originId,
      origin: { x: origin.x, y: origin.y, z: origin.z }, fleet, damage, tech, tierAtDispatch: tier,
      departAt: origin.now, arriveAt, radiationSettledAt: origin.now }).where(eq(unknownSignals.id, id));
    await saveResources(tx, originId, { alloy: origin.alloy, crystal: origin.crystal, deuterium: origin.deuterium - fuel });
    await markProgress(tx, playerId, origin.now);
    await schedule(tx, { seasonId: signal.seasonId, kind: 'unknown_signal_arrival', refId: id, resolveAt: arriveAt,
      dedupeKey: `unknown-signal:arrival:${id}` });
    await recomputePlayerWealth(tx, playerId, origin.now);
    await publish(tx, playerId, 'private:unknown-signal');
    return { signalId: id, arriveAt: arriveAt.toISOString(), fuel };
  });
}

async function aboard(tx: Queryable, signal: Signal): Promise<Fleet> {
  const rows = await tx.select({ hull: units.hull, count: units.count }).from(units)
    .where(and(eq(units.ownerPlayerId, signal.playerId), eq(units.location, location(signal.id))));
  const fleet: Fleet = {};
  for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
  return fleet;
}

async function clear(tx: Tx, id: string): Promise<void> { await tx.delete(units).where(eq(units.location, location(id))); }

async function getForResolution(tx: Tx, id: string) {
  const [initial] = await tx.select().from(unknownSignals).where(eq(unknownSignals.id, id));
  if (!initial) return null;
  const owner = await lockOwner(tx, initial.playerId, initial.originPlanetId ? [initial.originPlanetId] : []);
  return { ...owner, signal: await lockedSignal(tx, id, initial.playerId) };
}

async function dose(tx: Tx, signal: Signal, rulesetVersion: number, leg: 'OUT' | 'HOME', until: Date, home?: Vec3) {
  if (!signal.originPlanetId || !signal.origin || !signal.departAt || !signal.arriveAt) throw new Error('Signal flight is missing its origin');
  const path = leg === 'OUT'
    ? flightPrefix([flightSegment(signal.origin, signal, signal.departAt, signal.arriveAt)], until)
    : [flightSegment(signal, home ?? signal.origin, signal.returnDepartAt ?? signal.arriveAt, signal.returnAt ?? until)];
  const result = await settleSpecialFlightRadiation(tx, { id: signal.id, leg, seasonId: signal.seasonId, rulesetVersion,
    planetId: signal.originPlanetId, playerId: signal.playerId, location: location(signal.id), path,
    damage: signal.damage, tech: signal.tech ?? {}, radiationSettledAt: signal.radiationSettledAt, observedAt: until });
  const fleet = hpRadiationApplies(rulesetVersion) ? result.fleet : await aboard(tx, signal);
  const damage = hpRadiationApplies(rulesetVersion) ? [...result.damage] : signal.damage;
  await tx.update(unknownSignals).set({ damage, radiationSettledAt: result.radiationSettledAt }).where(eq(unknownSignals.id, signal.id));
  return { fleet, damage, radiationSettledAt: result.radiationSettledAt };
}

/** Entitlement uniqueness resolves a racing purchase by re-reading ownership and applying D18 again. */
async function reward(tx: Tx, signal: Signal, accountId: string): Promise<UnknownSignalOutcome> {
  const tier: UnknownSignalTier = signal.tierAtDispatch === 1 ? 1 : signal.tierAtDispatch === 2 ? 2 : 3;
  for (let attempt = 0; attempt <= 100; attempt++) {
    const owned = await tx.select({ id: cosmeticEntitlements.cosmeticId }).from(cosmeticEntitlements)
      .where(and(eq(cosmeticEntitlements.accountId, accountId), isNull(cosmeticEntitlements.revokedAt)));
    const outcome = rollUnknownSignalOutcome(signal.seed, tier, owned.map(item => item.id));
    if (outcome.kind !== 'SKIN') return outcome;
    const [inserted] = await tx.insert(cosmeticEntitlements).values({ accountId, cosmeticId: outcome.cosmeticId,
      source: 'UNKNOWN_SIGNAL', orderRef: signal.id, grantedAt: signal.arriveAt ?? signal.appearedAt })
      .onConflictDoNothing().returning({ id: cosmeticEntitlements.id });
    if (inserted) return outcome;
  }
  throw new Error('Unknown signal cosmetic ownership failed to converge');
}

export async function resolveUnknownSignalArrival(tx: Tx, id: string, clock: Clock): Promise<void> {
  const state = await getForResolution(tx, id);
  if (state?.signal.status !== 'outbound' || !state.signal.arriveAt || state.signal.arriveAt > clock.now()) return;
  const { signal, season, player } = state;
  const settled = await dose(tx, signal, season.rulesetVersion, 'OUT', signal.arriveAt!);
  if (fleetCount(settled.fleet) === 0) {
    await clear(tx, id);
    await tx.update(unknownSignals).set({ status: 'lost', fleet: {}, damage: settled.damage }).where(eq(unknownSignals.id, id));
    await recomputePlayerWealth(tx, player.id, clock.now());
    await publish(tx, player.id, 'private:unknown-signal');
    return;
  }
  const outcome = await reward(tx, signal, player.accountId);
  if (outcome.kind === 'ENERGY') {
    const [capital] = await tx.select({ id: planets.id }).from(planets).where(and(eq(planets.controllerPlayerId, player.id), eq(planets.kind, 'CAPITAL')));
    if (!capital) throw new Error('Unknown signal energy has no capital');
    const home = await loadLocked(tx, capital.id, { now: () => signal.arriveAt! }, { requireLive: false });
    const until = addMinutes(signal.arriveAt!, outcome.hours * 60);
    const [current] = await tx.select().from(planets).where(eq(planets.id, capital.id));
    // A normal action may have ticked the capital while the worker was delayed.
    // Pay only the newly earned productive span; never rewind stores or the tick.
    const from = Math.max(signal.arriveAt!.getTime(), home.signalBoostUntil?.getTime() ?? 0, home.recoveryUntil?.getTime() ?? 0);
    const to = Math.min(until.getTime(), current!.lastTickAt.getTime(), season.endsAt.getTime());
    if (to > from) {
      const start = minutesSince(season.startsAt, new Date(from));
      const end = minutesSince(season.startsAt, new Date(to));
      const disruption = home.disruptedUntil ? minutesSince(season.startsAt, home.disruptedUntil) : 0;
      const cutover = season.tempoStartsAt ? minutesSince(season.startsAt, season.tempoStartsAt) : Infinity;
      const hours = productionHours(start, Math.min(end, cutover), disruption, null)
        * ECONOMY_ADJUSTMENT.producerCapacityTime
        + productionHours(Math.max(start, cutover), end, disruption, null);
      const mult = productionMult(home.orbit);
      const bonus = (held: number, rate: number) => Math.min(collectorCap(rate * mult), held + rate * mult * hours);
      const bufferAlloy = bonus(home.bufferAlloy, alloyRate(home.buildings.REFINERY));
      const bufferCrystal = bonus(home.bufferCrystal, crystalRate(home.buildings.EXTRACTOR));
      const bufferDeuterium = bonus(home.bufferDeuterium, deuteriumRate(home.buildings.DEUTERIUM_PLANT));
      await saveResources(tx, capital.id, { alloy: home.alloy, crystal: home.crystal, deuterium: home.deuterium,
        bufferAlloy, bufferCrystal, bufferDeuterium });
      await tx.update(planets).set({ seasonTelemetry: { ...home.seasonTelemetry, produced: {
        alloy: home.seasonTelemetry.produced.alloy + Math.max(0, bufferAlloy - home.bufferAlloy),
        crystal: home.seasonTelemetry.produced.crystal + Math.max(0, bufferCrystal - home.bufferCrystal),
        deuterium: home.seasonTelemetry.produced.deuterium + Math.max(0, bufferDeuterium - home.bufferDeuterium),
      } } }).where(eq(planets.id, capital.id));
    }
    await tx.update(planets).set({ signalBoostUntil: home.signalBoostUntil && home.signalBoostUntil > until ? home.signalBoostUntil : until })
      .where(eq(planets.id, capital.id));
  }
  const fleet = { ...settled.fleet };
  const damage = settled.damage ?? [];
  if (outcome.kind === 'DERELICT') {
    fleet[outcome.hull] = (fleet[outcome.hull] ?? 0) + 1;
    damage.push({ hull: outcome.hull, count: 1, damageBp: outcome.damageBp });
  }
  await clear(tx, id);
  const lost = outcome.kind === 'PIRATES';
  let returnAt: Date | null = null;
  if (!lost && signal.origin && signal.originPlanetId) {
    const destinationId = await safeHomePlanet(tx, signal.playerId, signal.originPlanetId);
    const home = await loadLocked(tx, destinationId, { now: () => signal.arriveAt! }, { requireLive: false });
    returnAt = addMinutes(signal.arriveAt!, fleetTravelExact(distance(signal, home), fleet, { boost: fleetSpeedMult(home.orbit), tech: signal.tech ?? {} }));
    await setUnits(tx, signal.originPlanetId, fleet, location(id), player.id);
    await schedule(tx, { seasonId: signal.seasonId, kind: 'unknown_signal_return', refId: id, resolveAt: returnAt,
      dedupeKey: `unknown-signal:return:${id}` });
  }
  await tx.update(unknownSignals).set({ outcome, status: lost ? 'lost' : 'returning', damage, fleet: lost ? {} : fleet,
    returnDepartAt: signal.arriveAt, returnAt }).where(eq(unknownSignals.id, id));
  await notify(tx, { playerId: player.id, kind: 'unknown_signal_result', refId: id, at: signal.arriveAt!,
    payload: { signalId: id, outcome, fleet: signal.fleet, returnAt: returnAt?.toISOString() ?? null } });
  await recomputePlayerWealth(tx, player.id, clock.now());
  await publish(tx, player.id, 'private:unknown-signal');
}

export async function resolveUnknownSignalReturn(tx: Tx, id: string, clock: Clock): Promise<void> {
  const state = await getForResolution(tx, id);
  if (!state || !['returning', 'recalled'].includes(state.signal.status) || !state.signal.returnAt || state.signal.returnAt > clock.now()) return;
  const { signal, season } = state;
  if (!signal.originPlanetId) throw new Error('Unknown signal return is missing its home');
  const destinationId = await safeHomePlanet(tx, signal.playerId, signal.originPlanetId);
  const home = await loadLocked(tx, destinationId, clock, { requireLive: false });
  const settled = await dose(tx, signal, season.rulesetVersion, 'HOME', signal.returnAt!, home);
  await clear(tx, id);
  const report = await landShips(tx, { planetId: destinationId, ownerPlayerId: signal.playerId,
    fleet: settled.fleet, damage: settled.damage, at: home.now, radiationAt: signal.returnAt! });
  const loot = signal.outcome?.kind === 'RESOURCES' && (settled.fleet.COURIER ?? 0) > 0
    ? signal.outcome.loot : { alloy: 0, crystal: 0, deuterium: 0 };
  await saveResources(tx, destinationId, { alloy: home.alloy + loot.alloy, crystal: home.crystal + loot.crystal, deuterium: home.deuterium + loot.deuterium });
  await tx.update(unknownSignals).set({ status: 'done', deliveredAt: signal.returnAt,
    fleet: settled.fleet, damage: settled.damage }).where(eq(unknownSignals.id, id));
  await recomputePlayerWealth(tx, signal.playerId, clock.now());
  await notify(tx, { playerId: signal.playerId, kind: 'fleet_returned', refId: id, at: signal.returnAt!,
    payload: { trip: 'unknown_signal', ships: fleetCount(settled.fleet), ...(signal.recalledAt ? { recalled: true } : {}),
      lootAlloy: loot.alloy, lootCrystal: loot.crystal, lootDeuterium: loot.deuterium, ...dockNotice(report) } });
  await publish(tx, signal.playerId, 'private:unknown-signal');
}

export async function recallUnknownSignal(db: Db, playerId: string, id: string, key: string, clock: Clock) {
  return idempotentMutation(db, { playerId, operation: 'unknown-signal:recall', key, body: { id }, now: clock.now() }, async tx => {
    const { season } = await lockOwner(tx, playerId);
    const signal = await lockedSignal(tx, id, playerId);
    const now = clock.now();
    if (signal.status !== 'outbound' || !signal.arriveAt || !signal.departAt || !signal.origin || signal.arriveAt <= now) {
      throw new GameError('NOT_RECALLABLE', 'That flight cannot be called back', 409);
    }
    const settled = await dose(tx, signal, season.rulesetVersion, 'OUT', now);
    const progress = Math.max(0, Math.min(1, (now.getTime() - signal.departAt.getTime()) / (signal.arriveAt.getTime() - signal.departAt.getTime())));
    const turn = { x: signal.origin.x + (signal.x - signal.origin.x) * progress,
      y: signal.origin.y + (signal.y - signal.origin.y) * progress, z: signal.origin.z + (signal.z - signal.origin.z) * progress };
    const destinationId = await safeHomePlanet(tx, playerId, signal.originPlanetId!);
    const home = await loadLocked(tx, destinationId, clock, { requireLive: false });
    const returnAt = addMinutes(now, fleetTravelExact(distance(turn, home), settled.fleet,
      { boost: fleetSpeedMult(home.orbit), tech: signal.tech ?? {} }));
    const lost = fleetCount(settled.fleet) === 0;
    await tx.update(unknownSignals).set({ status: lost ? 'lost' : 'recalled', recalledAt: now, returnDepartAt: now, returnAt: lost ? null : returnAt, fleet: settled.fleet,
      ...turn }).where(eq(unknownSignals.id, id));
    if (lost) await clear(tx, id);
    else await schedule(tx, { seasonId: signal.seasonId, kind: 'unknown_signal_return', refId: id, resolveAt: returnAt,
      dedupeKey: `unknown-signal:return:${id}` });
    await recomputePlayerWealth(tx, playerId, now);
    await publish(tx, playerId, 'private:unknown-signal');
    return { signalId: id, returnAt: lost ? null : returnAt.toISOString() };
  });
}

export async function unknownSignalsForPlayer(db: Queryable, playerId: string, clock: Clock, id?: string) {
  const signals = await db.select().from(unknownSignals).where(and(eq(unknownSignals.playerId, playerId),
    id ? eq(unknownSignals.id, id) : or(and(eq(unknownSignals.status, 'open'), gt(unknownSignals.expiresAt, clock.now())),
      inArray(unknownSignals.status, ['outbound', 'returning', 'recalled', 'done', 'lost']))))
    .orderBy(sql`case when ${unknownSignals.status} in ('open','outbound','returning','recalled') then 0 else 1 end`, desc(unknownSignals.appearedAt)).limit(40);
  const homes = signals.some(signal => signal.status === 'returning' || signal.status === 'recalled')
    ? await db.select({ id: planets.id, kind: planets.kind, x: planets.x, y: planets.y, z: planets.z })
      .from(planets).where(eq(planets.controllerPlayerId, playerId)) : [];
  return { signals: signals.map(signal => {
    const home = homes.find(world => world.id === signal.originPlanetId) ?? homes.find(world => world.kind === 'CAPITAL');
    return { id: signal.id, at: { x: signal.x, y: signal.y, z: signal.z },
    status: signal.status, appearedAt: signal.appearedAt, expiresAt: signal.expiresAt, originPlanetId: signal.originPlanetId,
    origin: home && (signal.status === 'returning' || signal.status === 'recalled') ? { x: home.x, y: home.y, z: home.z } : signal.origin,
    fleet: signal.fleet, damage: signal.damage, departAt: signal.departAt, arriveAt: signal.arriveAt,
    returnDepartAt: signal.returnDepartAt, returnAt: signal.returnAt, recalledAt: signal.recalledAt,
    outcome: signal.outcome, deliveredAt: signal.deliveredAt };
  }) };
}

export async function unknownSignalContext(db: Queryable, playerId: string) {
  const [capital] = await db.select({ id: planets.id, x: planets.x, y: planets.y, z: planets.z, level: satellites.level })
    .from(planets).leftJoin(satellites, and(eq(satellites.planetId, planets.id), eq(satellites.type, 'RADAR')))
    .where(and(eq(planets.controllerPlayerId, playerId), eq(planets.kind, 'CAPITAL')));
  const peak = (await peakCoreLevels(db, [playerId])).get(playerId) ?? 1;
  return { tier: Math.min(3, coreTier(peak)), radar: capital ? {
    capitalPlanetId: capital.id, at: { x: capital.x, y: capital.y, z: capital.z }, level: capital.level ?? 0,
    range: radarContactRange(Math.max(1, capital.level ?? 0)),
  } : null };
}

/** Dev-only deterministic scenario setup. Guard is checked before touching the database. */
export async function devUnknownSignal(db: Db, playerId: string, kind: UnknownSignalOutcome['kind'], clock: Clock, environment: string) {
  if (environment === 'production') throw new GameError('NOT_FOUND', 'Not found', 404);
  return db.transaction(async tx => {
    const { season } = await lockOwner(tx, playerId);
    const [capital] = await tx.select().from(planets).where(and(eq(planets.controllerPlayerId, playerId), eq(planets.kind, 'CAPITAL')));
    if (!capital) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    const [radar] = await tx.select({ level: satellites.level }).from(satellites).where(and(eq(satellites.planetId, capital.id), eq(satellites.type, 'RADAR')));
    const worlds = await tx.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets).where(eq(planets.seasonId, season.id));
    const at = placeUnknownSignal(randomUUID(), capital, worlds, radar?.level ?? 0, GALAXY.radius);
    if (!at) throw new GameError('NO_SPACE', 'No free signal position', 409);
    let seed: string | undefined;
    for (let i = 0; i < 100_000; i++) {
      const candidate = `unknown-signal:dev:${kind}:${String(i)}`;
      if (rollUnknownSignalOutcome(candidate, 1, []).kind === kind) { seed = candidate; break; }
    }
    if (seed === undefined) throw new Error('Cannot find dev scenario seed');
    await tx.update(unknownSignals).set({ status: 'expired' }).where(and(eq(unknownSignals.playerId, playerId), eq(unknownSignals.status, 'open')));
    const [signal] = await tx.insert(unknownSignals).values({ playerId, seasonId: season.id, seed, ...at,
      appearedAt: clock.now(), expiresAt: addMinutes(clock.now(), UNKNOWN_SIGNAL.lifetimeMinutes) }).returning();
    if (!signal) throw new Error('Signal insert failed');
    await schedule(tx, { seasonId: season.id, kind: 'unknown_signal_expire', refId: signal.id, resolveAt: signal.expiresAt });
    await publish(tx, playerId, 'private:unknown-signal-spawn');
    return { id: signal.id };
  });
}
