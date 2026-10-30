import { and, asc, eq, gt, inArray, lt, lte, or } from 'drizzle-orm';
import { HULLS, applyHpDose, dockLocation, firstHpLossAtMs, hpRadiationRateProfile, segmentsExposureHp,
  type Fleet, type HpDamageLot, type HpDamageLots, type HpRadiationSource, type TechLevels } from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { beforeCommit } from '../db/finalizers.js';
import { buildOrders, planets, radiationBombFlights, researchOrders, seasons, shipDamageLots, units } from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import { techOf } from './researchState.js';
import { hpSourcesForTarget, targetSourcesFrom, type planetAnchoredSources } from './radiationSources.js';
import { GameError, recomputePlayerWealth } from './planet.js';
import { publish } from '../stream/bus.js';
import { publishWatchChanges } from './watchEvents.js';
import { nextSupportRadiationLoss, settleStationedSupportRadiation } from './clanSupportRadiation.js';
import { nextStagedWarRadiationLoss, settleStagedWarRadiation } from './clanWarRadiation.js';
import { cancelRepairsForRadiation } from './buildQueue.js';
import { recordRadiationHonor } from './honorRadiation.js';
import { planetRadiationPath } from './planetAegis.js';

type Planet = typeof planets.$inferSelect;
type Season = typeof seasons.$inferSelect;
type Unit = typeof units.$inferSelect;

const inventoryFinalizers = new WeakMap<Tx, { owners: Map<string, Date>; planets: Map<string, { season: Season; at: Date }> }>();
function radiationFinalizer(tx: Tx) {
  let state = inventoryFinalizers.get(tx);
  if (!state) {
    state = { owners: new Map(), planets: new Map() };
    inventoryFinalizers.set(tx, state);
    const pending = state;
    beforeCommit(tx, 'planet-radiation-inventory', async () => {
      for (const [planetId, entry] of [...pending.planets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const [planet] = await tx.select().from(planets).where(eq(planets.id, planetId));
        if (planet) await schedulePlanetRadiation(tx, planet, entry.season, entry.at);
      }
      for (const [playerId, observedAt] of [...pending.owners.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        await recomputePlayerWealth(tx, playerId, observedAt);
        await publish(tx, playerId, 'build_complete');
      }
    });
  }
  return state;
}

export function noteRadiationInventoryChange(tx: Tx, playerId: string, observedAt: Date): void {
  const pending = radiationFinalizer(tx);
  const previous = pending.owners.get(playerId);
  if (!previous || observedAt > previous) pending.owners.set(playerId, observedAt);
}


/** Read-only and mutation paths run exactly the same projection on physical home/dock rows. */
/**
 * The two reads every projection starts with, already made for a whole list of
 * worlds (scaling plan F1.4): the next bomb due and the sources anchored on it,
 * read up to the same `until` this function begins from.
 */
export interface PrefetchedRadiation {
  pendingImpact: { arriveAt: Date } | null;
  anchored: Awaited<ReturnType<typeof planetAnchoredSources>>;
}

/** `projectPlanetRadiation`'s pending-impact read, for every world in `planetIds`; earliest first. */
export async function pendingRadiationImpacts(tx: Queryable, planetIds: readonly string[], until: Date) {
  return tx.select({ targetPlanetId: radiationBombFlights.targetPlanetId, arriveAt: radiationBombFlights.arriveAt })
    .from(radiationBombFlights)
    .where(and(inArray(radiationBombFlights.targetPlanetId, [...planetIds]), eq(radiationBombFlights.status, 'OUTBOUND'),
      lt(radiationBombFlights.arriveAt, until))).orderBy(asc(radiationBombFlights.arriveAt));
}

export async function projectPlanetRadiation(tx: Queryable, planet: Planet, season: Season,
  inventory: readonly Unit[], at: Date, prefetched?: PrefetchedRadiation) {
  const epoch = season.radiationBombStartsAt;
  let until = new Date(Math.min(at.getTime(), (season.closedAt ?? season.endsAt).getTime()));
  const [pendingImpact] = !epoch ? [] : prefetched ? (prefetched.pendingImpact ? [prefetched.pendingImpact] : [])
    : await tx.select({ arriveAt: radiationBombFlights.arriveAt }).from(radiationBombFlights)
      .where(and(eq(radiationBombFlights.targetPlanetId, planet.id), eq(radiationBombFlights.status, 'OUTBOUND'),
        lt(radiationBombFlights.arriveAt, until))).orderBy(asc(radiationBombFlights.arriveAt)).limit(1);
  if (pendingImpact) until = pendingImpact.arriveAt;
  const from = new Date(Math.max(epoch?.getTime() ?? until.getTime(), planet.radiationSettledAt?.getTime() ?? epoch?.getTime() ?? until.getTime()));
  const noSources: HpRadiationSource[] = [];
  const noTech: TechLevels = {};
  const unchanged = { rows: [...inventory], from, until, sources: noSources, tech: noTech,
    dock: new Map<string, HpDamageLot>(), changed: false, lostHome: false,
    pendingImpact: pendingImpact !== undefined, pendingResearch: false, pendingSource: false };
  if (!epoch || until <= from) return unchanged;
  const sources = prefetched
    ? targetSourcesFrom(season, prefetched.anchored.filter(row => row.activeFrom < until
      && (row.activeUntil === null || row.activeUntil > from)))
    : await hpSourcesForTarget(tx, season, { kind: 'PLANET', id: planet.id }, from, until);
  if (sources.length === 0) return unchanged;
  const sourceBoundary = sources.some(source => source.origin === 'ENVIRONMENT'
    && [source.activeFromMs, source.activeUntilMs].some(at => at !== null && at >= from.getTime() && at < until.getTime()));
  const [repair] = sourceBoundary ? await tx.select({ id: buildOrders.id }).from(buildOrders).where(and(
    eq(buildOrders.planetId, planet.id), eq(buildOrders.kind, 'REPAIR'), eq(buildOrders.status, 'BUILDING'),
  )).limit(1) : [];
  const repairBoundary = repair ? hpRadiationRateProfile(await planetRadiationPath(tx, planet, from.getTime(), until.getTime()), sources)[0]?.startMs : undefined;
  if (repairBoundary !== undefined) return { ...unchanged, sources, until: new Date(repairBoundary), pendingSource: true };
  const [pendingResearch] = planet.controllerPlayerId ? await tx.select({ readyAt: researchOrders.readyAt }).from(researchOrders)
    .where(and(eq(researchOrders.playerId, planet.controllerPlayerId), eq(researchOrders.status, 'BUILDING'),
      inArray(researchOrders.projectId, ['SHIP_ARMOR', 'RADIATION_SHIELDING']), lt(researchOrders.readyAt, until)))
    .orderBy(asc(researchOrders.readyAt)).limit(1) : [];
  const [pendingHardware] = await tx.select({ readyAt: buildOrders.readyAt }).from(buildOrders)
    .where(and(eq(buildOrders.planetId, planet.id), eq(buildOrders.status, 'BUILDING'),
      or(and(eq(buildOrders.kind, 'BUILDING'), eq(buildOrders.subject, 'CORE')),
        and(eq(buildOrders.kind, 'INSTRUMENT'), eq(buildOrders.subject, 'AEGIS'))), lt(buildOrders.readyAt, until)))
    .orderBy(asc(buildOrders.readyAt)).limit(1);
  const pendingProtection = pendingResearch !== undefined || pendingHardware !== undefined;
  if (pendingResearch) until = pendingResearch.readyAt;
  if (pendingHardware && pendingHardware.readyAt < until) until = pendingHardware.readyAt;
  if (until <= from) return { ...unchanged, until, pendingResearch: pendingProtection };
  const dose = segmentsExposureHp(await planetRadiationPath(tx, planet, from.getTime(), until.getTime()), sources);
  const dockRows = inventory.filter(row => row.location.startsWith('dock:') && row.count > 0);
  const dockIds = dockRows.map(row => row.location.slice('dock:'.length));
  const [tech, lots] = await Promise.all([
    planet.controllerPlayerId ? techOf(tx, planet.controllerPlayerId) : Promise.resolve({}),
    dockIds.length > 0 ? tx.select().from(shipDamageLots).where(inArray(shipDamageLots.id, dockIds)) : Promise.resolve([]),
  ]);
  const byId = new Map(lots.map(lot => [lot.id, lot]));
  const dock = new Map<string, HpDamageLot>();
  let changed = false;
  let lostHome = false;
  const rows = inventory.map(row => {
    if (row.count <= 0 || HULLS[row.hull].ground || row.hull === 'PROSPECTOR') return row;
    const lot = row.location.startsWith('dock:') ? byId.get(row.location.slice('dock:'.length)) : undefined;
    if (row.location !== 'home' && !lot) return row;
    const damage = lot ? [{ hull: row.hull, count: row.count, damageBp: lot.damageBp, remainderBp: lot.remainderBp }] : row.damage;
    const outcome = applyHpDose({ [row.hull]: row.count }, damage, dose, tech);
    const count = outcome.fleet[row.hull] ?? 0;
    if (row.location === 'home' && count < row.count) lostHome = true;
    if (lot && outcome.lots[0]) dock.set(lot.id, outcome.lots[0]);
    const next = { ...row, count, damage: outcome.lots };
    changed ||= count !== row.count || JSON.stringify(next.damage) !== JSON.stringify(row.damage);
    return next;
  });
  return { rows, from, until, sources, tech, dock, changed, lostHome,
    pendingImpact: pendingImpact !== undefined, pendingResearch: pendingProtection, pendingSource: false };
}

/** Never called by GET; the caller holds the planet row lock. No free heal or per-death reports. */
export async function persistPlanetRadiation(tx: Tx, planet: Planet, season: Season,
  inventory: readonly Unit[], projection: Awaited<ReturnType<typeof projectPlanetRadiation>>, observedAt: Date): Promise<void> {
  if (projection.pendingImpact) throw new GameError('RADIATION_IMPACT_PENDING',
    'An earlier missile impact is resolving; refresh and try again', 409);
  if (projection.pendingResearch) throw new GameError('RADIATION_RESEARCH_PENDING',
    'An earlier protection upgrade is resolving; refresh and try again', 409);
  if (projection.pendingSource) throw new GameError('RADIATION_SOURCE_PENDING',
    'A radiation change is resolving; try again shortly', 409);
  if (!season.radiationBombStartsAt || projection.until < season.radiationBombStartsAt) return;
  const pending = radiationFinalizer(tx);
  pending.planets.set(planet.id, { season, at: new Date(Math.max(projection.until.getTime(), planet.radiationSettledAt?.getTime() ?? 0)) });
  await settleStationedSupportRadiation(tx, planet.id, projection.until, observedAt);
  await settleStagedWarRadiation(tx, planet, season, projection.until, observedAt);
  if (planet.radiationSettledAt !== null && projection.until <= planet.radiationSettledAt) return;
  const docks = inventory.filter(row => row.location.startsWith('dock:')).map(row => row.location.slice(5));
  const dockBefore = docks.length === 0 ? [] : await tx.select().from(shipDamageLots).where(inArray(shipDamageLots.id, docks));
  const docksById = new Map(dockBefore.map(lot => [lot.id, lot]));
  const owners = new Map<string, { fleet: Fleet; damage: HpDamageLot[] }>();
  for (const row of inventory) {
    if (row.count <= 0 || HULLS[row.hull].ground || row.hull === 'PROSPECTOR' || !row.ownerPlayerId) continue;
    const dock = row.location.startsWith('dock:') ? docksById.get(row.location.slice(5)) : undefined;
    if (row.location !== 'home' && !dock) continue;
    const health = owners.get(row.ownerPlayerId) ?? { fleet: {}, damage: [] };
    health.fleet[row.hull] = (health.fleet[row.hull] ?? 0) + row.count;
    health.damage.push(...(dock ? [{ hull: row.hull, count: row.count, damageBp: dock.damageBp, remainderBp: dock.remainderBp }] : row.damage));
    owners.set(row.ownerPlayerId, health);
  }
  // Home and dock share one cursor and technology. Aggregate their pre-dose
  // cohorts so injury group count does not multiply Honor queries or rounding.
  for (const [owner, health] of owners) {
    await recordRadiationHonor(tx, { seasonId: season.id, victim: owner,
      slice: `planet:${planet.id}`, until: projection.until, fleet: health.fleet, damage: health.damage,
      tech: projection.tech, segments: await planetRadiationPath(tx, planet, projection.from.getTime(), projection.until.getTime()), sources: projection.sources });
  }
  const originals = new Map(inventory.map(row => [`${row.location}:${row.hull}`, row]));
  let lostShips = false;
  for (const row of projection.rows) {
    const previous = originals.get(`${row.location}:${row.hull}`);
    if (!previous || (row.count === previous.count && JSON.stringify(row.damage) === JSON.stringify(previous.damage))) continue;
    lostShips ||= row.count < previous.count;
    const predicate = and(eq(units.planetId, row.planetId), eq(units.hull, row.hull), eq(units.location, row.location));
    if (row.count === 0) {
      await tx.delete(units).where(predicate);
      if (row.location.startsWith('dock:')) await tx.delete(shipDamageLots).where(eq(shipDamageLots.id, row.location.slice('dock:'.length)));
    } else {
      // Dock HP belongs to shipDamageLots. units carries only its physical count;
      // projection.rows may annotate HP for read-only views, never a second persisted copy.
      await tx.update(units).set({ count: row.count, damage: row.location.startsWith('dock:') ? [] : row.damage }).where(predicate);
      const dock = row.location.startsWith('dock:') ? projection.dock.get(row.location.slice('dock:'.length)) : undefined;
      if (dock) await tx.update(shipDamageLots).set({ damageBp: dock.damageBp, remainderBp: dock.remainderBp ?? 0 })
        .where(eq(shipDamageLots.id, row.location.slice('dock:'.length)));
    }
  }
  await tx.update(planets).set({ radiationSettledAt: projection.until }).where(eq(planets.id, planet.id));
  if (lostShips && planet.controllerPlayerId) {
    const previous = pending.owners.get(planet.controllerPlayerId);
    if (!previous || observedAt > previous) pending.owners.set(planet.controllerPlayerId, observedAt);
  }
  if (projection.lostHome) await publishWatchChanges(tx, [planet.id]);
}

/** Historical arrivals advance health independently from the economy's observation clock. */
export async function settlePlanetRadiationAt(tx: Tx, planetId: string, at: Date, observedAt = at) {
  const [planet] = await tx.select().from(planets).where(eq(planets.id, planetId));
  if (!planet) return;
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, planet.seasonId));
  if (!season?.radiationBombStartsAt) return;
  const inventory = await tx.select().from(units).where(eq(units.planetId, planetId));
  const projection = await projectPlanetRadiation(tx, planet, season, inventory, at);
  await persistPlanetRadiation(tx, planet, season, inventory, projection, observedAt);
  return { planet, season, settledAt: new Date(Math.max(projection.until.getTime(), planet.radiationSettledAt?.getTime() ?? 0)) };
}

/** Start timers apply the same repair rule as a missile, before any late dose is taken. */
export async function beginPlanetRadiationBoundary(tx: Tx, planetId: string, at: Date) {
  const state = await settlePlanetRadiationAt(tx, planetId, at);
  // An old/retried timer must not cancel repairs bought after its source ended.
  if (!state || state.settledAt > at) return;
  const start = at.getTime();
  const sources = await hpSourcesForTarget(tx, state.season, { kind: 'PLANET', id: planetId }, at, new Date(start + 1));
  if (segmentsExposureHp(await planetRadiationPath(tx, state.planet, start, start + 1), sources) > 0) {
    return cancelRepairsForRadiation(tx, planetId, at);
  }
}

/** Late arrivals pay only THEIR parked interval; already-settled resident cohorts never pay twice. */
export async function projectLateHomeArrival(tx: Queryable,
  state: NonNullable<Awaited<ReturnType<typeof settlePlanetRadiationAt>>>,
  fleet: Fleet, damage: HpDamageLots | null | undefined, arrivedAt: Date) {
  const from = new Date(Math.max(arrivedAt.getTime(), state.season.radiationBombStartsAt?.getTime() ?? arrivedAt.getTime()));
  const until = state.settledAt;
  if (until <= from) return { fleet, lots: damage ?? [] };
  const sources = await hpSourcesForTarget(tx, state.season, { kind: 'PLANET', id: state.planet.id }, from, until);
  if (sources.length === 0) return { fleet, lots: damage ?? [] };
  const tech = state.planet.controllerPlayerId ? await techOf(tx, state.planet.controllerPlayerId) : {};
  const completed = state.planet.controllerPlayerId ? await tx.select().from(researchOrders).where(and(
    eq(researchOrders.playerId, state.planet.controllerPlayerId), eq(researchOrders.status, 'COMPLETED'),
    inArray(researchOrders.projectId, ['SHIP_ARMOR', 'RADIATION_SHIELDING']),
    gt(researchOrders.readyAt, from), lte(researchOrders.readyAt, until),
  )).orderBy(asc(researchOrders.readyAt), asc(researchOrders.id)) : [];
  const historicalTech: TechLevels = { ...tech };
  for (const order of completed) {
    if (order.projectId === 'SHIP_ARMOR' || order.projectId === 'RADIATION_SHIELDING') {
      historicalTech[order.projectId] = Math.min(historicalTech[order.projectId] ?? 0, order.level - 1);
    }
  }
  let cursor = from.getTime();
  let currentFleet = fleet;
  let currentDamage: HpDamageLots = damage ?? [];
  const applyUntil = async (end: number) => {
    const outcome = applyHpDose(currentFleet, currentDamage,
      segmentsExposureHp(await planetRadiationPath(tx, state.planet, cursor, end), sources), historicalTech);
    currentFleet = outcome.fleet;
    currentDamage = outcome.lots;
    cursor = end;
  };
  for (const order of completed) {
    await applyUntil(order.readyAt.getTime());
    if (order.projectId === 'SHIP_ARMOR' || order.projectId === 'RADIATION_SHIELDING') historicalTech[order.projectId] = order.level;
  }
  await applyUntil(until.getTime());
  return { fleet: currentFleet, lots: currentDamage };
}

/** Replan only this planet, at a real casualty or source expiry, never a global timer. */
export async function schedulePlanetRadiation(tx: Tx, planet: Planet, season: Season, at: Date): Promise<void> {
  if (!season.radiationBombStartsAt || season.closedAt || at >= season.endsAt) return;
  const sources = await hpSourcesForTarget(tx, season, { kind: 'PLANET', id: planet.id }, at, season.endsAt);
  if (sources.length === 0) return;
  const rows = await tx.select().from(units).where(eq(units.planetId, planet.id));
  const tech = planet.controllerPlayerId ? await techOf(tx, planet.controllerPlayerId) : {};
  const dockRows = await tx.select().from(shipDamageLots).where(eq(shipDamageLots.planetId, planet.id));
  const docks = new Map(dockRows.map(lot => [dockLocation(lot.id), lot]));
  const fleet: Fleet = {};
  const damage: HpDamageLot[] = [];
  for (const row of rows) {
    if (row.count <= 0 || HULLS[row.hull].ground || (row.location !== 'home' && !docks.has(row.location))) continue;
    fleet[row.hull] = (fleet[row.hull] ?? 0) + row.count;
    const lot = docks.get(row.location);
    damage.push(...(lot ? [{ hull: row.hull, count: row.count, damageBp: lot.damageBp, remainderBp: lot.remainderBp }] : row.damage));
  }
  const nextLoss = firstHpLossAtMs(await planetRadiationPath(tx, planet, at.getTime(), season.endsAt.getTime()), sources, fleet, damage, tech);
  const boundaries = sources.flatMap(source => [source.activeFromMs, source.activeUntilMs]
    .filter((boundary): boundary is number => boundary !== null && boundary > at.getTime()));
  if (nextLoss !== null) boundaries.push(nextLoss);
  const supportLoss = await nextSupportRadiationLoss(tx, planet, season, at);
  if (supportLoss !== null) boundaries.push(supportLoss);
  const stagingLoss = await nextStagedWarRadiationLoss(tx, planet, season, at, sources);
  if (stagingLoss !== null) boundaries.push(stagingLoss);
  const next = Math.min(...boundaries);
  if (!Number.isFinite(next)) return;
  await schedule(tx, { seasonId: season.id, kind: 'planet_radiation_boundary', refId: planet.id,
    dedupeKey: `planet-radiation:${planet.id}:${String(next)}`, resolveAt: new Date(next) });
}
