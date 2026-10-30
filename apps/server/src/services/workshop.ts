import { segmentsExposureHp } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { planets, type seasons } from '../db/schema.js';
import { aegisEpochsOver, planetRadiationPath, type Hardware } from './planetAegis.js';
import { activeHpSources, activeHpSourcesForSeason } from './radiationSources.js';
import { GameError, type LockedPlanet } from './planet.js';

/** Match the damage profile, including target identity, source windows and shelters. */
export async function workshopRadiation(tx: Queryable, planet: Pick<LockedPlanet, 'planetId' | 'seasonId' | 'now' | 'x' | 'y' | 'z'>): Promise<boolean> {
  const sources = await activeHpSourcesForSeason(tx, planet.seasonId, planet.now);
  const at = planet.now.getTime();
  const [world] = await tx.select().from(planets).where(eq(planets.id, planet.planetId));
  return world ? segmentsExposureHp(await planetRadiationPath(tx, world, at, at + 1), sources) > 0 : false;
}

/**
 * `workshopRadiation` for several worlds of one galaxy at one instant, from rows the
 * caller already read. Scaling plan F1.4. No source live in the galaxy: no exposure.
 */
export async function workshopRadiationFor(tx: Queryable, season: typeof seasons.$inferSelect, now: Date,
  worlds: readonly { row: typeof planets.$inferSelect; hardware: Hardware }[]): Promise<Map<string, boolean>> {
  const sources = await activeHpSources(tx, season, now);
  if (sources.length === 0) return new Map(worlds.map(world => [world.row.id, false]));
  const at = now.getTime();
  const epochs = await aegisEpochsOver(tx, worlds.map(world => world.row.id), at, at + 1);
  return new Map(await Promise.all(worlds.map(async ({ row, hardware }): Promise<[string, boolean]> => [row.id,
    segmentsExposureHp(await planetRadiationPath(tx, row, at, at + 1,
      { epochs: epochs.filter(epoch => epoch.planetId === row.id), hardware }), sources) > 0])));
}

/** Returning ships stays available; only entry, repair and scrapping close. */
export async function assertWorkshopOpen(tx: Queryable, planet: LockedPlanet): Promise<void> {
  if (await workshopRadiation(tx, planet)) throw new GameError('WORKSHOP_RADIATION',
    'Radiation closes the workshop; ships may still be returned to the hangar', 409);
}
