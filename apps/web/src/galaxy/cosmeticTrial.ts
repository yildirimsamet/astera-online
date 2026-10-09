import { cosmeticById, type PlanetSkinStatus } from '@astera/rules';
import type { GalaxyPlanet } from '../api/schemas.js';

export interface CosmeticTrial { planetId: string; cosmeticId: string; enabled: boolean }
export type TrialWorld = Pick<GalaxyPlanet, 'id' | 'skin' | 'ringId' | 'isOwned' | 'intel'>;

/** A render-only copy. Polls remain authoritative; ending a trial needs no rollback. */
export function applyCosmeticTrial<T extends TrialWorld>(worlds: readonly T[], trial: CosmeticTrial | null, fallbackStatus: PlanetSkinStatus = 'NORMAL'): readonly T[] {
  if (!trial?.enabled) return worlds;
  const item = cosmeticById(trial.cosmeticId);
  if (item?.category !== 'PLANET' && item?.category !== 'RING') return worlds;
  return worlds.map(world => {
    if (world.id !== trial.planetId || !world.isOwned || world.intel === 'UNKNOWN') return world;
    return item.category === 'RING' ? { ...world, ringId: item.id }
      : { ...world, skin: { id: item.id, status: world.skin?.status ?? fallbackStatus } };
  });
}
