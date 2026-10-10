import { canEquipCosmetic, cosmeticById, shipCosmeticForHull } from '@astera/rules';
import type { QueryClient } from '@tanstack/react-query';
import { Api, ApiError } from '../../api/client.js';
import { keys } from '../../api/keys.js';
import { galaxySchema, leaderboardSchema, planetSchema, planetsSchema, polarPricingSchema, polarShopSchema, skinCollectionSchema } from '../../api/schemas.js';

/** Local preview state only. Unimplemented actions cannot reach a server or checkout. */
export function createStoreDiscoveryApi(client: QueryClient): Api {
  const api = new Api({ fetch: () => Promise.reject(new Error('This gallery has no server connection')) });
  const collection = () => skinCollectionSchema.parse(client.getQueryData(keys.skins));
  const galaxy = () => galaxySchema.parse(client.getQueryData(keys.galaxy));
  api.skins = () => Promise.resolve(collection());
  api.galaxy = () => Promise.resolve(galaxy());
  api.planets = () => Promise.resolve(planetsSchema.parse(client.getQueryData(keys.planets)));
  api.planet = id => Promise.resolve(planetSchema.parse(client.getQueryData(keys.planetById(id ?? 'trial-home'))));
  api.leaderboard = () => Promise.resolve(leaderboardSchema.parse(client.getQueryData(keys.leaderboard)));
  api.polarShop = () => Promise.resolve(polarShopSchema.parse(client.getQueryData(keys.polarShop)));
  api.polarPricing = () => Promise.resolve(polarPricingSchema.parse(client.getQueryData(keys.polarPricing)));
  api.equipSkin = (id, skinId) => {
    const current = collection();
    if (!current.planets.some(world => world.id === id)) return Promise.reject(new ApiError('PLANET_NOT_OWNED', 'You do not control that world', 403));
    if (skinId && !current.ownedSkinIds.includes(skinId)) return Promise.reject(new ApiError('SKIN_NOT_OWNED', 'You do not own this skin', 403));
    client.setQueryData(keys.skins, { ...current, planets: current.planets.map(world => world.id === id ? { ...world, skinId } : world) });
    const field = galaxy();
    client.setQueryData(keys.galaxy, { ...field, planets: field.planets.map(world => {
      if (world.id !== id) return world;
      const { skin: previous, ...plain } = world;
      return skinId ? { ...plain, skin: { id: skinId, status: previous?.status ?? 'NORMAL' } } : plain;
    }) });
    return Promise.resolve({ id, skinId });
  };
  api.equipCosmetic = (category, cosmeticId, hull) => {
    const current = collection();
    const targetHull = category === 'SHIP' ? hull ?? (cosmeticId ? cosmeticById(cosmeticId)?.hull : undefined) : undefined;
    if (category === 'PLANET' || (cosmeticId && cosmeticById(cosmeticId)?.category !== category)
      || (category === 'SHIP' ? !targetHull || (cosmeticId && !shipCosmeticForHull(targetHull, cosmeticId)) : hull)) {
      return Promise.reject(new ApiError('SKIN_SLOT_MISMATCH', 'This appearance does not fit that slot', 400));
    }
    if (category === 'FLAG' && !current.canEquipFlag) return Promise.reject(new ApiError('CLAN_LEADER_REQUIRED', 'Only the clan leader can equip a standard', 403));
    if (!canEquipCosmetic(cosmeticId, category, current.ownedCosmeticIds ?? current.ownedSkinIds)) return Promise.reject(new ApiError('SKIN_NOT_OWNED', 'You do not own this appearance', 403));
    const ships = Object.fromEntries(Object.entries(current.equipment?.SHIP ?? {}).filter(([slot]) => slot !== targetHull));
    const equipment = category === 'SHIP' && targetHull
      ? { ...current.equipment, SHIP: { ...ships, ...(cosmeticId ? { [targetHull]: cosmeticId } : {}) } }
      : { ...current.equipment, [category]: cosmeticId ?? undefined };
    client.setQueryData(keys.skins, skinCollectionSchema.parse({ ...current, equipment }));
    if (category === 'RING') {
      const field = galaxy();
      client.setQueryData(keys.galaxy, { ...field, planets: field.planets.map(world => {
        const { ringId: _previous, ...plain } = world;
        return cosmeticId ? { ...plain, ringId: cosmeticId } : plain;
      }) });
    }
    return Promise.resolve({ category, cosmeticId, ...(targetHull ? { hull: targetHull } : {}) });
  };
  return api;
}
