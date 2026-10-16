import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { applyHpDose, firstHpLossAtMs, fleetCount, hangarLoad, hpWingLethalAtMs,
  segmentsExposureHp, type Fleet, type TechLevels } from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { clanSupportWaves, missions, planets, radiationBombFlights, seasons, units } from '../db/schema.js';
import { publishPrivate } from '../stream/bus.js';
import { hpSourcesForTarget } from './radiationSources.js';
import { planetRadiationPath } from './planetAegis.js';
import { noteRadiationInventoryChange } from './planetRadiation.js';
import { recordRadiationHonor } from './honorRadiation.js';

type Wave = typeof clanSupportWaves.$inferSelect;
type Planet = typeof planets.$inferSelect;
type Season = typeof seasons.$inferSelect;

/** One bulk inventory and technology read; no per-ship or per-wave database query. */
async function supportHealth(db: Queryable, rows: readonly Wave[]) {
  if (rows.length === 0) return [];
  const [stock, outward] = await Promise.all([
    db.select().from(units).where(inArray(units.location, rows.map(row => row.unitLocation))),
    db.select({ id: missions.id, tech: missions.tech }).from(missions).where(inArray(missions.id, rows.map(row => row.outboundMissionId))),
  ]);
  const technologies = new Map(outward.map(row => [row.id, row.tech ?? {}]));
  return rows.map(wave => {
    const fleet: Fleet = {};
    for (const row of stock) if (row.location === wave.unitLocation && row.count > 0) fleet[row.hull] = row.count;
    const tech: TechLevels = technologies.get(wave.outboundMissionId) ?? {};
    return { wave, fleet, tech, stock: stock.filter(row => row.location === wave.unitLocation) };
  });
}


/** Private reads show the same carried-tech health as a settlement, without row locks or writes. */
export async function projectStationedSupport(db: Queryable, rows: readonly Wave[], at: Date) {
  const stationed = rows.filter(row => row.status === 'STATIONED');
  const result = new Map<string, { wave: Wave; fleet: Fleet }>();
  if (stationed.length === 0) return result;
  const hostIds = [...new Set(stationed.map(row => row.hostPlanetId))];
  const [hosts, pending, health] = await Promise.all([
    db.select({ host: planets, season: seasons }).from(planets).innerJoin(seasons, eq(seasons.id, planets.seasonId))
      .where(inArray(planets.id, hostIds)),
    db.select({ hostId: radiationBombFlights.targetPlanetId, arriveAt: radiationBombFlights.arriveAt }).from(radiationBombFlights)
      .where(and(inArray(radiationBombFlights.targetPlanetId, hostIds), eq(radiationBombFlights.status, 'OUTBOUND'), lt(radiationBombFlights.arriveAt, at))),
    supportHealth(db, stationed),
  ]);
  for (const { host, season } of hosts) {
    const epoch = season.radiationBombStartsAt;
    if (!epoch) continue;
    const until = Math.min(at.getTime(), (season.closedAt ?? season.endsAt).getTime(),
      ...pending.filter(row => row.hostId === host.id).map(row => row.arriveAt.getTime()));
    const waves = health.filter(row => row.wave.hostPlanetId === host.id);
    const from = Math.min(...waves.map(({ wave }) => Math.max(epoch.getTime(),
      wave.stationedAt?.getTime() ?? wave.arriveAt.getTime(), wave.radiationSettledAt?.getTime() ?? 0)));
    if (until <= from) continue;
    const sources = await hpSourcesForTarget(db, season, { kind: 'PLANET', id: host.id }, new Date(from), new Date(until));
    for (const { wave, fleet, tech } of waves) {
      const begin = Math.max(epoch.getTime(), wave.stationedAt?.getTime() ?? wave.arriveAt.getTime(), wave.radiationSettledAt?.getTime() ?? 0);
      if (until <= begin) continue;
      const outcome = applyHpDose(fleet, wave.damage, segmentsExposureHp(await planetRadiationPath(db, host, begin, until), sources), tech);
      result.set(wave.id, { fleet: outcome.fleet, wave: { ...wave, damage: outcome.lots,
        reservedBulk: hangarLoad(outcome.fleet), ...(fleetCount(outcome.fleet) === 0 ? { status: 'LOST' as const } : {}) } });
    }
  }
  return result;
}

/** The host row is held before any support wave row, matching recall and battle order. */
export async function settleStationedSupportRadiation(tx: Tx, hostId: string, at: Date, observedAt = at): Promise<void> {
  const [host] = await tx.select().from(planets).where(eq(planets.id, hostId));
  if (!host) return;
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, host.seasonId));
  const epoch = season?.radiationBombStartsAt;
  if (!epoch || at < epoch) return;
  const rows = await tx.select().from(clanSupportWaves).where(and(eq(clanSupportWaves.hostPlanetId, hostId),
    eq(clanSupportWaves.status, 'STATIONED'))).orderBy(asc(clanSupportWaves.id)).for('update');
  if (rows.length === 0) return;
  const until = Math.min(at.getTime(), (season.closedAt ?? season.endsAt).getTime());
  const from = Math.min(...rows.map(wave => Math.max(epoch.getTime(), wave.stationedAt?.getTime() ?? wave.arriveAt.getTime(), wave.radiationSettledAt?.getTime() ?? 0)));
  if (from >= until) return;
  const sources = await hpSourcesForTarget(tx, season, { kind: 'PLANET', id: hostId }, new Date(from), new Date(until));
  for (const { wave, fleet, tech, stock } of await supportHealth(tx, rows)) {
    const begin = Math.max(epoch.getTime(), wave.stationedAt?.getTime() ?? wave.arriveAt.getTime(), wave.radiationSettledAt?.getTime() ?? 0);
    if (begin >= until) continue;
    const path = await planetRadiationPath(tx, host, begin, until);
    const outcome = applyHpDose(fleet, wave.damage, segmentsExposureHp(path, sources), tech);
    await recordRadiationHonor(tx, { seasonId: season.id, victim: wave.senderPlayerId, slice: `support:${wave.id}`,
      until: new Date(until), fleet, damage: wave.damage, tech, segments: path, sources });
    const lost = fleetCount(outcome.fleet) === 0;
    const lostAt = lost ? hpWingLethalAtMs(path, sources, fleet, wave.damage, tech) : null;
    for (const row of stock) {
      const count = outcome.fleet[row.hull] ?? 0;
      if (count === row.count) continue;
      const predicate = and(eq(units.planetId, row.planetId), eq(units.location, row.location), eq(units.hull, row.hull));
      if (count === 0) await tx.delete(units).where(predicate);
      else await tx.update(units).set({ count }).where(predicate);
    }
    await tx.update(clanSupportWaves).set({ damage: outcome.lots.length > 0 ? outcome.lots : null,
      radiationSettledAt: new Date(until), reservedBulk: hangarLoad(outcome.fleet),
      ...(lost ? { status: 'LOST' as const, resolvedAt: new Date(lostAt ?? until) } : {}) })
      .where(eq(clanSupportWaves.id, wave.id));
    if (fleetCount(outcome.destroyed) > 0) {
      noteRadiationInventoryChange(tx, wave.senderPlayerId, observedAt);
      await publishPrivate(tx, wave.senderPlayerId, 'support');
      await publishPrivate(tx, wave.hostPlayerId, 'support');
    }
  }
}

/** Same carried technology and target profile as settlement, including a mixed host/support fleet. */
export async function nextSupportRadiationLoss(db: Queryable, host: Planet, season: Season, at: Date): Promise<number | null> {
  if (!season.radiationBombStartsAt) return null;
  const rows = await db.select().from(clanSupportWaves).where(and(eq(clanSupportWaves.hostPlanetId, host.id), eq(clanSupportWaves.status, 'STATIONED')));
  if (rows.length === 0) return null;
  const sources = await hpSourcesForTarget(db, season, { kind: 'PLANET', id: host.id }, at, season.endsAt);
  let first: number | null = null;
  for (const { wave, fleet, tech } of await supportHealth(db, rows)) {
    const loss = firstHpLossAtMs(await planetRadiationPath(db, host, at.getTime(), season.endsAt.getTime()), sources, fleet, wave.damage, tech);
    if (loss !== null) first = Math.min(first ?? loss, loss);
  }
  return first;
}
