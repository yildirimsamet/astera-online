import { MOBILE_HULLS, shipCosmeticForHull, type HullId, type ShipCosmeticEquipment } from '@astera/rules';
import { HULL_MODEL, HULL_LOD_MODEL } from '../ui/assets.js';
import { REFERENCE_SHIPS, referenceShipLod } from './referenceArt.js';

/** Per-hull replacement preserves the original fleet, size, formation and gameplay identity. */
export function shipHullModels(hull: HullId, equipment?: ShipCosmeticEquipment): { model: string; lodModel: string } {
  const mobileHull = MOBILE_HULLS.find(id => id === hull);
  const item = shipCosmeticForHull(hull, mobileHull ? equipment?.[mobileHull] : undefined);
  const reference = REFERENCE_SHIPS[hull];
  return item?.model && item.lodModel
    ? { model: item.model, lodModel: item.lodModel }
    : reference ? { model: reference, lodModel: referenceShipLod(reference) }
      : { model: HULL_MODEL[hull], lodModel: HULL_LOD_MODEL[hull] };
}
