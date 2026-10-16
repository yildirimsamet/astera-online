import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { vacationCost, vacationDaysAvailable, vacationPayment, VACATION_DAY_MS, type VacationBlockReason } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { buildings, buildOrders, clanSupportWaves, clanWarContributions, clanWarOperations,
  intergalacticConvoyRuns, miningRuns, missions, monumentProbes, monumentWaves, pirateRaids,
  planetFaults, planets, players, radiationBombFlights, researchOrders, scheduledEvents,
  seasons, shards, strategicAssets, tradeRuns, vacations } from '../db/schema.js';
import { GameError, loadLocked, recomputePlayerWealth } from './planet.js';
import { publish, publishShard } from '../stream/bus.js';

/** These clocks belong to one commander; global events and flight clocks never move. */
export const VACATION_EVENT_KINDS = new Set<string>([
  'build_complete', 'research_complete', 'death_star_ready', 'occupation_end',
  'fault_spawn', 'fault_repair_complete', 'vault_leak_flush', 'colony_secession',
  'recovery_end', 'planet_radiation_boundary',
]);

function failure(code: string): never { throw new GameError(code, 'Vacation conditions changed. Review vacation mode.', 409); }

async function commander(tx: Tx, playerId: string) {
  const [player] = await tx.select().from(players).where(eq(players.id, playerId));
  if (!player) throw new GameError('PLAYER_NOT_FOUND', 'No commander', 404);
  return player;
}

/** Season-exclusive admission serializes every worker/world write, in the established lock order. */
async function lockCommander(tx: Tx, playerId: string) {
  const initial = await commander(tx, playerId);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`vacation:${initial.seasonId}`}, 0))`);
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, initial.seasonId)).for('update');
  if (season?.status !== 'live') failure('SEASON_FROZEN');
  const player = await commander(tx, playerId);
  if (player.seasonId !== initial.seasonId) failure('PLACEMENT_CHANGED');
  return { player, season };
}

async function holdings(tx: Tx, playerId: string) {
  return tx.select({ id: planets.id, name: planets.name, kind: planets.kind, coreLevel: buildings.level })
    .from(planets).innerJoin(buildings, and(eq(buildings.planetId, planets.id), eq(buildings.type, 'CORE')))
    .where(eq(planets.controllerPlayerId, playerId)).orderBy(asc(planets.id));
}

/** No enemy identities or hidden arrival times escape through this eligibility answer. */
async function flightBlockers(tx: Tx, playerId: string, ids: string[], now: Date): Promise<VacationBlockReason[]> {
  const checks: [VacationBlockReason, SQL][] = [
    ['VACATION_FLEET', sql`exists(select 1 from ${missions} where ${missions.status} = 'in_flight'
      and ${missions.ownerPlayerId} = ${playerId} and ${missions.kind} not in ('probe','clan_support','clan_war'))`],
    ['VACATION_PROBES', sql`exists(select 1 from ${missions} where ${missions.status} = 'in_flight'
      and ${missions.ownerPlayerId} = ${playerId} and ${missions.kind} = 'probe')`],
    ['VACATION_SUPPORT_SENT', sql`exists(select 1 from ${missions} where ${missions.status} = 'in_flight'
      and ${missions.ownerPlayerId} = ${playerId} and ${missions.kind} = 'clan_support')`],
    ['VACATION_CLAN_FLEET', sql`exists(select 1 from ${missions} where ${missions.status} = 'in_flight'
      and ${missions.ownerPlayerId} = ${playerId} and ${missions.kind} = 'clan_war')`],
    ['VACATION_FLIGHTS', sql`exists(select 1 from ${missions} where ${missions.status} = 'in_flight'
      and ${missions.ownerPlayerId} <> ${playerId}
      and (${inArray(missions.originPlanetId, ids)} or ${inArray(missions.targetPlanetId, ids)}))`],
    ['VACATION_MINING', sql`exists(select 1 from ${miningRuns} where ${inArray(miningRuns.planetId, ids)} and ${miningRuns.status} <> 'done')`],
    ['VACATION_PIRATES', sql`exists(select 1 from ${pirateRaids} where ${pirateRaids.ownerPlayerId} = ${playerId} and ${pirateRaids.status} <> 'done')`],
    ['VACATION_TRADE', sql`exists(select 1 from ${tradeRuns} where ${tradeRuns.ownerPlayerId} = ${playerId} and ${tradeRuns.status} <> 'done')`],
    ['VACATION_CONVOY', sql`exists(select 1 from ${intergalacticConvoyRuns} where ${intergalacticConvoyRuns.ownerPlayerId} = ${playerId} and ${intergalacticConvoyRuns.status} <> 'done')`],
    ['VACATION_SUPPORT_SENT', sql`exists(select 1 from ${clanSupportWaves} where ${clanSupportWaves.status} in ('OUTBOUND','STATIONED','RETURNING')
      and ${clanSupportWaves.senderPlayerId} = ${playerId})`],
    ['VACATION_SUPPORT_HOSTED', sql`exists(select 1 from ${clanSupportWaves} where ${clanSupportWaves.status} in ('OUTBOUND','STATIONED','RETURNING')
      and ${clanSupportWaves.hostPlayerId} = ${playerId})`],
    ['VACATION_CLAN_FLEET', sql`exists(select 1 from ${clanWarContributions} where ${clanWarContributions.playerId} = ${playerId}
      and ${clanWarContributions.status} in ('OUTBOUND','STAGED','RECALL_ORDERED','IN_BATTLE','RETURNING'))`],
    ['VACATION_CLAN_OPERATION', sql`exists(select 1 from ${clanWarOperations} where ${clanWarOperations.status} <> 'COMPLETED'
      and ${clanWarOperations.leaderPlayerId} = ${playerId})`],
    ['VACATION_FLIGHTS', sql`exists(select 1 from ${clanWarOperations} where ${clanWarOperations.status} <> 'COMPLETED'
      and ${clanWarOperations.targetPlayerId} = ${playerId})`],
    ['VACATION_MONUMENT_FLEET', sql`exists(select 1 from ${monumentWaves} where ${monumentWaves.playerId} = ${playerId}
      and ${monumentWaves.status} not in ('HOME','LOST','CANCELLED'))`],
    ['VACATION_MONUMENT_PROBES', sql`exists(select 1 from ${monumentProbes} where ${monumentProbes.playerId} = ${playerId}
      and ${monumentProbes.status} in ('OUTBOUND','RETURNING'))`],
    ['VACATION_STRATEGIC', sql`exists(select 1 from ${radiationBombFlights} where ${radiationBombFlights.ownerPlayerId} = ${playerId}
      and (${radiationBombFlights.status} = 'OUTBOUND' or (${radiationBombFlights.status} = 'INTERCEPTED'
        and (${radiationBombFlights.interception}->>'impactAt')::timestamptz > ${now.toISOString()}::timestamptz)))`],
    ['VACATION_FLIGHTS', sql`exists(select 1 from ${radiationBombFlights} where ${radiationBombFlights.ownerPlayerId} <> ${playerId}
      and ${inArray(radiationBombFlights.targetPlanetId, ids)}
      and (${radiationBombFlights.status} = 'OUTBOUND' or (${radiationBombFlights.status} = 'INTERCEPTED'
        and (${radiationBombFlights.interception}->>'impactAt')::timestamptz > ${now.toISOString()}::timestamptz)))`],
  ];
  // One statement, one snapshot. The same predicates explain status and enforce admission.
  const rows = await tx.execute<{ reason: VacationBlockReason }>(sql.join(
    checks.map(([reason, check]) => sql`select ${reason}::text as reason where ${check}`), sql` union all `));
  const found = new Set(rows.map(row => row.reason));
  return [...new Set(checks.map(([reason]) => reason))].filter(reason => found.has(reason));
}

async function ownedEvents(tx: Tx, playerId: string, ids: string[]) {
  const [orders, research, faults, assets] = await Promise.all([
    tx.select({ id: buildOrders.id }).from(buildOrders).where(and(inArray(buildOrders.planetId, ids), eq(buildOrders.status, 'BUILDING'))),
    tx.select({ id: researchOrders.id }).from(researchOrders).where(and(eq(researchOrders.playerId, playerId), eq(researchOrders.status, 'BUILDING'))),
    tx.select({ id: planetFaults.id }).from(planetFaults).where(inArray(planetFaults.planetId, ids)),
    tx.select({ id: strategicAssets.id }).from(strategicAssets).where(and(inArray(strategicAssets.planetId, ids), inArray(strategicAssets.status, ['BUILDING', 'PAUSED']))),
  ]);
  const refs = [...ids, ...orders.map(r => r.id), ...research.map(r => r.id), ...faults.map(r => r.id), ...assets.map(r => r.id)];
  return tx.select().from(scheduledEvents).where(and(inArray(scheduledEvents.refId, refs), inArray(scheduledEvents.status, ['pending', 'processing'])))
    .then(rows => rows.filter(row => VACATION_EVENT_KINDS.has(row.kind)));
}

async function statusIn(tx: Tx, playerId: string, clock: Clock, days: number) {
  const player = await commander(tx, playerId);
  const [[season], worlds, [record]] = await Promise.all([
    tx.select().from(seasons).where(eq(seasons.id, player.seasonId)), holdings(tx, playerId),
    tx.select().from(vacations).where(and(eq(vacations.playerId, playerId), isNull(vacations.endedAt))),
  ]);
  if (!season) failure('SEASON_NOT_FOUND');
  const [shard] = await tx.select().from(shards).where(eq(shards.id, season.shardId));
  const now = clock.now();
  const active = record && record.endsAt > now ? { id: record.id, startedAt: record.startedAt, endsAt: record.endsAt, days: record.days, cost: record.cost } : null;
  const ids = worlds.map(w => w.id);
  const events = ids.length ? await ownedEvents(tx, playerId, ids) : [];
  const latest = Math.max(now.getTime(), ...events.filter(e => ['build_complete', 'research_complete', 'death_star_ready', 'fault_repair_complete'].includes(e.kind)).map(e => e.resolveAt.getTime()));
  const maxDays = vacationDaysAvailable(now.getTime(), season.endsAt.getTime(), latest);
  const price = worlds.some(w => w.kind === 'CAPITAL') ? vacationCost(days, worlds.map(w => ({ id: w.id, capital: w.kind === 'CAPITAL', coreLevel: w.coreLevel }))) : null;
  const capital = worlds.find(w => w.kind === 'CAPITAL');
  const state = capital ? await loadLocked(tx, capital.id, clock) : null;
  const store = state?.deuterium ?? 0;
  const buffer = state?.bufferDeuterium ?? 0;
  const flights = active ? [] : await flightBlockers(tx, playerId, ids, now);
  const settling = events.some(e => e.resolveAt <= now);
  const funds = !price || !vacationPayment(price.total, store, buffer);
  const reasons: VacationBlockReason[] = [];
  if (active) reasons.push('VACATION_ACTIVE');
  else {
    if (season.status !== 'live' || now >= season.endsAt) reasons.push('SEASON_FROZEN');
    if (shard?.role !== 'MAIN') reasons.push('VACATION_MAIN_ONLY');
    if (maxDays < days) reasons.push('VACATION_DURATION');
    reasons.push(...flights);
    if (settling) reasons.push('VACATION_SETTLING');
    if (funds) reasons.push('VACATION_FUNDS');
  }
  // Keep the existing admission error codes and their priority for callers.
  let blocker: string | null = null;
  if (active) blocker = 'VACATION_ACTIVE';
  else if (season.status !== 'live' || now >= season.endsAt) blocker = 'SEASON_FROZEN';
  else if (shard?.role !== 'MAIN') blocker = 'VACATION_MAIN_ONLY';
  else if (maxDays < days) blocker = 'VACATION_DURATION';
  else if (flights.length) blocker = 'VACATION_FLIGHTS';
  else if (settling) blocker = 'VACATION_SETTLING';
  else if (funds) blocker = 'VACATION_FUNDS';
  const fingerprint = createHash('sha256').update(JSON.stringify({ days, worlds, price, seasonId: season.id, seasonEnd: season.endsAt })).digest('hex');
  return { active, days, maxDays, seasonEndsAt: season.endsAt, worlds, price, store, buffer, blocker, reasons, fingerprint };
}

export async function vacationStatus(db: Db, playerId: string, clock: Clock, days = 1) {
  return db.transaction(tx => statusIn(tx, playerId, clock, days));
}

/** Shift absolute personal deadlines once. Early return applies the inverse for unused time. */
async function shiftClocks(tx: Tx, playerId: string, ids: string[], delta: number, boundary: Date) {
  const interval = sql`${delta} * interval '1 millisecond'`;
  const future = (column: SQL) => sql`case when ${column} > ${boundary.toISOString()}::timestamptz then ${column} + ${interval} else ${column} end`;
  await tx.update(planets).set({
    disruptedUntil: future(sql`${planets.disruptedUntil}`), recoveryUntil: future(sql`${planets.recoveryUntil}`),
    empUntil: future(sql`${planets.empUntil}`), protectedUntil: future(sql`${planets.protectedUntil}`),
    shieldRegenAt: future(sql`${planets.shieldRegenAt}`),
    faultProtectedUntil: future(sql`${planets.faultProtectedUntil}`),
    recoveryBoostUntil: future(sql`${planets.recoveryBoostUntil}`), transferReadyAt: future(sql`${planets.transferReadyAt}`),
  }).where(inArray(planets.id, ids));
  await tx.update(buildOrders).set({ startedAt: sql`${buildOrders.startedAt} + ${interval}`, readyAt: sql`${buildOrders.readyAt} + ${interval}` })
    .where(and(inArray(buildOrders.planetId, ids), eq(buildOrders.status, 'BUILDING')));
  await tx.update(researchOrders).set({ startedAt: sql`${researchOrders.startedAt} + ${interval}`, readyAt: sql`${researchOrders.readyAt} + ${interval}` })
    .where(and(eq(researchOrders.playerId, playerId), eq(researchOrders.status, 'BUILDING')));
  await tx.update(strategicAssets).set({ startedAt: sql`${strategicAssets.startedAt} + ${interval}`, readyAt: sql`${strategicAssets.readyAt} + ${interval}` })
    .where(and(inArray(strategicAssets.planetId, ids), inArray(strategicAssets.status, ['BUILDING', 'PAUSED'])));
  await tx.update(planetFaults).set({ repairStartedAt: sql`${planetFaults.repairStartedAt} + ${interval}`, repairReadyAt: sql`${planetFaults.repairReadyAt} + ${interval}` })
    .where(inArray(planetFaults.planetId, ids));
  await tx.update(players).set({ newcomerShieldUntil: future(sql`${players.newcomerShieldUntil}`), recoveryShieldUntil: future(sql`${players.recoveryShieldUntil}`) })
    .where(eq(players.id, playerId));
  for (const event of await ownedEvents(tx, playerId, ids)) {
    const payload = { ...event.payload };
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string' && /^expected(ReadyAt|At|Until)$/.test(key) && Number.isFinite(Date.parse(value))) {
        payload[key] = new Date(Date.parse(value) + delta).toISOString();
      }
    }
    await tx.update(scheduledEvents).set({ resolveAt: new Date(event.resolveAt.getTime() + delta), payload, status: 'pending', claimedAt: null })
      .where(eq(scheduledEvents.id, event.id));
  }
}

/** Automatic expiry needs no world write: clocks were already moved to the purchased end. */
async function closeExpired(tx: Tx, playerId: string, now: Date) {
  await tx.update(vacations).set({ endedAt: sql`${vacations.endsAt}` })
    .where(and(eq(vacations.playerId, playerId), isNull(vacations.endedAt), lte(vacations.endsAt, now)));
}

export async function startVacation(db: Db, playerId: string, days: number, fingerprint: string, requestId: string, clock: Clock) {
  return db.transaction(async tx => {
    const { season } = await lockCommander(tx, playerId);
    const now = clock.now();
    const transactionClock: Clock = { now: () => now };
    const [retry] = await tx.select().from(vacations).where(and(eq(vacations.playerId, playerId), eq(vacations.requestId, requestId)));
    if (retry) return statusIn(tx, playerId, transactionClock, days);
    await closeExpired(tx, playerId, now);
    const quote = await statusIn(tx, playerId, transactionClock, days);
    if (quote.maxDays < days) failure('VACATION_DURATION');
    if (quote.fingerprint !== fingerprint) failure('VACATION_QUOTE_CHANGED');
    if (quote.blocker) failure(quote.blocker);
    const payment = quote.price && vacationPayment(quote.price.total, quote.store, quote.buffer);
    if (!payment || !quote.price) failure('VACATION_FUNDS');
    const ids = quote.worlds.map(w => w.id);
    const end = new Date(now.getTime() + days * VACATION_DAY_MS);
    // Every holding is settled and checked before any of them is frozen.
    for (const id of ids) {
      const world = await loadLocked(tx, id, transactionClock, { expectedPlayerId: playerId });
      if (world.kind === 'COLONY' && world.loyalty <= 0) failure('VACATION_SETTLING');
    }
    const capital = quote.worlds.find(w => w.kind === 'CAPITAL')!;
    await tx.update(planets).set({ deuterium: quote.store - payment.store, bufferDeuterium: quote.buffer - payment.buffer }).where(eq(planets.id, capital.id));
    await shiftClocks(tx, playerId, ids, end.getTime() - now.getTime(), now);
    await tx.update(planets).set({ vacationStartedAt: now, vacationUntil: end, lastTickAt: end, radiationSettledAt: end }).where(inArray(planets.id, ids));
    await tx.update(players).set({ vacationUntil: end, silentSpaceResetAt: end }).where(eq(players.id, playerId));
    await tx.insert(vacations).values({ playerId, seasonId: season.id, requestId, startedAt: now, endsAt: end, days, cost: quote.price.total,
      paidStore: payment.store, paidBuffer: payment.buffer, quote: quote.price });
    await recomputePlayerWealth(tx, playerId, now);
    await publish(tx, playerId, 'build_complete');
    await publishShard(tx, season.id, 'world');
    return statusIn(tx, playerId, transactionClock, days);
  });
}

export async function endVacation(db: Db, playerId: string, vacationId: string, clock: Clock) {
  return db.transaction(async tx => {
    const { season } = await lockCommander(tx, playerId);
    const now = clock.now();
    const transactionClock: Clock = { now: () => now };
    const [record] = await tx.select().from(vacations).where(and(eq(vacations.id, vacationId), eq(vacations.playerId, playerId)));
    if (!record) failure('VACATION_NOT_FOUND');
    if (record.endedAt || record.endsAt <= now) {
      await closeExpired(tx, playerId, now);
      return statusIn(tx, playerId, transactionClock, 1);
    }
    const ids = (await holdings(tx, playerId)).map(w => w.id);
    await shiftClocks(tx, playerId, ids, now.getTime() - record.endsAt.getTime(), record.startedAt);
    await tx.update(planets).set({ vacationUntil: null, vacationStartedAt: null, lastTickAt: now, radiationSettledAt: now }).where(inArray(planets.id, ids));
    await tx.update(players).set({ vacationUntil: null, silentSpaceResetAt: now }).where(eq(players.id, playerId));
    await tx.update(vacations).set({ endedAt: now }).where(eq(vacations.id, record.id));
    // Reconcile each world's radiation schedule and shield epoch at the actual
    // early-return instant, including colonies the player is not viewing.
    for (const id of ids) await loadLocked(tx, id, transactionClock, { expectedPlayerId: playerId });
    await publish(tx, playerId, 'build_complete');
    await publishShard(tx, season.id, 'world');
    return statusIn(tx, playerId, transactionClock, 1);
  });
}

export async function assertCommanderNotVacationing(tx: Tx, playerId: string, now: Date) {
  const [player] = await tx.select({ until: players.vacationUntil }).from(players).where(eq(players.id, playerId));
  if (player?.until && player.until > now) failure('VACATION_ACTIVE');
}
