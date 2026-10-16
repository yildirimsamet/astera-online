import { and, eq, inArray, or } from 'drizzle-orm';
import { HONOR_CANDIDATE_VERSION, HONOR_LAUNCH_VERSION, honorFleetValue, honorNumber, honorStrategicValue } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { honorSeasons, missions, planets, radiationBombFlights, strategicAssets, units } from '../db/schema.js';

/** Call under the battle's player locks, before its first inventory mutation. */
export async function honorDefenceNavy(db: Queryable, seasonId: string, owners: readonly string[]): Promise<Map<string, number>> {
  const [config] = await db.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
  const result = new Map<string, number>();
  if (config?.version !== HONOR_LAUNCH_VERSION) return result;
  for (const id of [...new Set(owners)].sort()) result.set(id, await ownedHonorNavy(db, id, config));
  return result;
}

/** Real owned inventory only; historical high-water selection happens separately. */
export async function ownedHonorNavy(db: Queryable, playerId: string, config: Pick<typeof honorSeasons.$inferSelect,
  'seasonId' | 'version' | 'catalogue' | 'strategicCatalogue'>): Promise<number> {
  const hulls = await db.select({ hull: units.hull, count: units.count }).from(units).where(eq(units.ownerPlayerId, playerId));
  let total = hulls.reduce((sum, row) => sum + BigInt(honorFleetValue(config.catalogue, { [row.hull]: row.count }, true)), 0n);
  if (config.version !== HONOR_CANDIDATE_VERSION && config.version !== HONOR_LAUNCH_VERSION) return honorNumber(total);
  if (!config.strategicCatalogue) throw new Error('Missing frozen Honor strategic catalogue');
  const stocks = await db.select({ type: strategicAssets.type }).from(strategicAssets)
    .innerJoin(planets, eq(planets.id, strategicAssets.planetId))
    .leftJoin(missions, eq(missions.id, strategicAssets.missionId))
    .leftJoin(radiationBombFlights, eq(radiationBombFlights.assetId, strategicAssets.id))
    .where(and(eq(planets.seasonId, config.seasonId), inArray(strategicAssets.type, config.version === HONOR_LAUNCH_VERSION
      ? ['DEATH_STAR', 'INTERCEPTOR', 'RADIATION_BOMB_L1', 'RADIATION_BOMB_L2', 'RADIATION_BOMB_L3'] : ['DEATH_STAR', 'INTERCEPTOR']),
      inArray(strategicAssets.status, ['READY', 'LAUNCHED']), or(
      and(eq(strategicAssets.status, 'READY'), eq(planets.controllerPlayerId, playerId)),
      and(eq(strategicAssets.status, 'LAUNCHED'), eq(missions.ownerPlayerId, playerId),
        eq(missions.seasonId, config.seasonId), eq(missions.kind, 'death_star'), eq(missions.status, 'in_flight')),
      and(eq(strategicAssets.status, 'LAUNCHED'), eq(radiationBombFlights.ownerPlayerId, playerId),
        eq(radiationBombFlights.seasonId, config.seasonId), eq(radiationBombFlights.status, 'OUTBOUND')),
    )));
  for (const stock of stocks) total += BigInt(honorStrategicValue(config.strategicCatalogue, stock.type));
  return honorNumber(total);
}
