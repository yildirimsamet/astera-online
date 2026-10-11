import { HULLS, type ShipCosmeticEquipment } from '@astera/rules';
import type { EngineUnit } from './EngineJets.js';
import type { Marker } from './Squadrons.js';
import type { Vec3Tuple } from './scene.js';
import { nativeEngineAnchors } from './engineAnchors.js';
import { shipHullModels } from './shipCosmetics.js';
import { referenceShipNozzles } from './referenceArt.js';
import { hullPoseLift } from '../ui/assets.js';
import { HULL_LIGHT, hullVisualScale } from './flightVisual.js';

/** Ordinary and equipped engines attach to the same drawn hull, in posed unit space. */
export function formationEngineUnits(
  markers: readonly Marker[], slots: readonly Vec3Tuple[], scale: number,
  shipSkins?: ShipCosmeticEquipment, intensity = 1,
): EngineUnit[] {
  return markers.map((marker, index) => {
    const url = shipHullModels(marker.hull, shipSkins).model;
    const native = nativeEngineAnchors(url);
    const reference = native ? undefined : referenceShipNozzles(url);
    const lift = hullPoseLift(marker.hull);
    const steps = (HULLS[marker.hull].tier ?? 1) - 1;
    return {
      at: slots[index] ?? [0, 0, 0], size: hullVisualScale(marker.hull, scale),
      nozzles: native ?? (reference ? reference.map(at => [at.x, at.y + lift, at.z]) : [[0, lift, -0.42]]),
      colour: HULL_LIGHT[marker.hull].flame, intensity,
      widthFactor: 1 + steps * .06, lengthFactor: 1 + steps * .08,
    };
  });
}
