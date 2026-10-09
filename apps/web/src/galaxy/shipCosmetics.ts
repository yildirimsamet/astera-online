import { MOBILE_HULLS, shipCosmeticForHull, type HullId, type ShipCosmeticEquipment } from '@astera/rules';
import { HULL_MODEL, HULL_LOD_MODEL } from '../ui/assets.js';

/** Per-hull replacement preserves the original fleet, size, formation and gameplay identity. */
export function shipHullModels(hull: HullId, equipment?: ShipCosmeticEquipment): { model: string; lodModel: string } {
  const mobileHull = MOBILE_HULLS.find(id => id === hull);
  const item = shipCosmeticForHull(hull, mobileHull ? equipment?.[mobileHull] : undefined);
  return item?.model && item.lodModel
    ? { model: item.model, lodModel: item.lodModel }
    : { model: HULL_MODEL[hull], lodModel: HULL_LOD_MODEL[hull] };
}
