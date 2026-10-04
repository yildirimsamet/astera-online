import { and, eq, inArray } from 'drizzle-orm';
import { applyHpDose, hpRadiationApplies, segmentsExposureHp,
  type Fleet, type HpDamageLots, type HpRadiationSource, type Segment, type TechLevels } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { monumentProbes, monumentShipLots, monumentWaves, seasons, units } from '../db/schema.js';
import { monumentRouteSchema } from './monumentBoundaries.js';
import { hpSourcesForSeason } from './radiationSources.js';
import { flightPrefix } from './specialFlightRadiation.js';

interface NativeTrafficFlight {
  id: string;
  ownerPlayerId: string;
  originPlanetId: string;
  kind: 'fleet' | 'probe';
  route: Segment[];
  fleet: Fleet;
  damage: HpDamageLots;
  tech: TechLevels;
  radiationSettledAt: number;
}
export interface NativeMonumentTraffic {
  flights: NativeTrafficFlight[];
  sources: HpRadiationSource[];
  endsAt: number;
}

/** Transit only. HOLD and delivered probe observations never enter a public snapshot. */
export async function loadMonumentTraffic(db: Queryable, seasonId: string): Promise<NativeMonumentTraffic | undefined> {
  const [season] = await db.select({ rulesetVersion: seasons.rulesetVersion, endsAt: seasons.endsAt }).from(seasons).where(eq(seasons.id, seasonId));
  if (!season || !hpRadiationApplies(season.rulesetVersion)) return undefined;
  const [waves, probes, sources] = await Promise.all([
    db.select().from(monumentWaves).where(and(eq(monumentWaves.seasonId, seasonId), inArray(monumentWaves.status, ['OUTBOUND', 'RETURNING']))),
    db.select().from(monumentProbes).where(and(eq(monumentProbes.seasonId, seasonId), inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING']))),
    hpSourcesForSeason(db, seasonId),
  ]);
  const [lots, parked] = waves.length === 0 ? [[], []] : await Promise.all([
    db.select().from(monumentShipLots).where(inArray(monumentShipLots.waveId, waves.map(wave => wave.id))),
    db.select({ location: units.location, hull: units.hull, count: units.count }).from(units)
      .where(inArray(units.location, waves.map(wave => wave.unitLocation))),
  ]);
  const fleets = new Map<string, Fleet>();
  for (const row of parked) {
    const fleet = fleets.get(row.location) ?? {};
    fleet[row.hull] = (fleet[row.hull] ?? 0) + row.count;
    fleets.set(row.location, fleet);
  }
  const flights: NativeTrafficFlight[] = waves.map(wave => ({ id: wave.id, ownerPlayerId: wave.playerId,
    originPlanetId: wave.originPlanetId, kind: 'fleet', route: monumentRouteSchema.parse(wave.route),
    fleet: fleets.get(wave.unitLocation) ?? {}, tech: wave.tech, radiationSettledAt: wave.radiationSettledAt.getTime(),
    damage: lots.filter(lot => lot.waveId === wave.id).map(lot => ({ hull: lot.hull, count: lot.count, damageBp: lot.damageBp, remainderBp: lot.remainderBp })) }));
  for (const probe of probes) flights.push({ id: probe.id, ownerPlayerId: probe.playerId, originPlanetId: probe.originPlanetId,
    kind: 'probe', route: monumentRouteSchema.parse(probe.status === 'OUTBOUND' ? probe.outboundRoute : probe.returnRoute),
    fleet: {}, tech: {}, damage: [], radiationSettledAt: probe.departAt.getTime() });
  return { flights, sources, endsAt: season.endsAt.getTime() };
}

/** Read-only forecast of the physical roster at this instant; no launch snapshot fallback. */
export function monumentTrafficFleet(snapshot: NativeMonumentTraffic, flight: NativeTrafficFlight, now: Date): Fleet {
  const sources = snapshot.sources.map(source => ({ ...source, activeFromMs: Math.max(source.activeFromMs, flight.radiationSettledAt),
    activeUntilMs: Math.min(source.activeUntilMs ?? snapshot.endsAt, snapshot.endsAt) }))
    .filter(source => source.activeUntilMs > source.activeFromMs);
  return applyHpDose(flight.fleet, flight.damage, segmentsExposureHp(flightPrefix(flight.route, now), sources), flight.tech).fleet;
}
