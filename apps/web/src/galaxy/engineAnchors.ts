import type { Vec3Tuple } from './scene.js';
import { cosmeticById, SHIP_SKIN_IDS } from '@astera/rules';
import { SHIP_SKIN_DRIVES } from './shipSkinDrive.js';

/** Rear/top/side review: posed unit space INCLUDING each model's own height.
 * Cosmetic hulls use their own reviewed ports, shared with the shop inspection.
 * Do not add hullPoseLift again. Evidence: out/premium-assets/engine-calibration.
 */
const ANCHORS: Readonly<Record<string, readonly Vec3Tuple[]>> = {
  '/assets/models/ships/dart.glb': [[0.1435, 0.2618, -0.495], [-0.1246, 0.2618, -0.49]],
  '/assets/models/ships/pike.glb': [[0.1029, 0.1621, -0.5], [-0.1029, 0.1621, -0.5]],
  '/assets/models/ships/rampart.glb': [[0, 0.1281, -0.363]],
  '/assets/models/ships/warden.glb': [[0.1138, 0.0397, -0.394], [-0.1165, 0.0397, -0.392]],
  '/assets/models/ships/courier.glb': [[0.214, 0.1958, -0.486], [-0.214, 0.1958, -0.486]],
  '/assets/models/ships/viper.glb': [[0.214, 0.1065, -0.468], [0.149, 0.1065, -0.452], [-0.1463, 0.1065, -0.452], [-0.2113, 0.1065, -0.468]],
  '/assets/models/ships/talon.glb': [[0.1029, 0.1071, -0.443], [-0.1002, 0.1071, -0.443], [0.1029, 0.034, -0.443], [-0.1029, 0.034, -0.443]],
  '/assets/models/ships/stronghold.glb': [[0.0894, 0.1099, -0.47], [-0.084, 0.1099, -0.47]],
  '/assets/models/ships/sentinel.glb': [[0.1246, 0.2235, -0.49], [-0.1246, 0.2235, -0.49]],
  '/assets/models/ships/wayfarer.glb': [[0.1408, 0.1312, -0.493], [-0.1435, 0.1312, -0.493]],
  '/assets/models/ships/tempest.glb': [[0.1435, 0.0675, -0.48], [-0.1435, 0.0675, -0.48]],
  '/assets/models/ships/ballista.glb': [[0.1327, 0.1331, -0.515], [-0.1327, 0.1331, -0.515]],
  '/assets/models/ships/leviathan.glb': [[0.1219, 0.0594, -0.5], [-0.1246, 0.0594, -0.5]],
  '/assets/models/ships/praetorian.glb': [[0.3683, -0.0029, -0.42], [-0.3656, -0.0029, -0.42]],
  '/assets/models/ships/atlas.glb': [[0.3223, 0.1512, -0.515], [-0.3223, 0.1512, -0.515]],
  '/assets/models/ships/nullifier.glb': [[0.1138, 0.0542, -0.5], [-0.1138, 0.0542, -0.5]],
  '/assets/models/ships/garbage-collector.glb': [[0, 0.0676, -0.302]],
  '/assets/models/ships/cataclysm.glb': [[0.0027, 0.1192, -0.494]],
  '/assets/models/ships/corsair.glb': [[0.0948, 0.0383, -0.473], [-0.0948, 0.0383, -0.473]],
  '/assets/models/ships/citadel.glb': [[0.13, 0.1111, -0.415], [-0.1273, 0.1111, -0.415]],
  '/assets/models/ships/paladin.glb': [[0.0813, 0.0581, -0.493], [-0.0813, 0.0581, -0.493]],
  '/assets/models/ships/argosy.glb': [[0.0894, 0.0419, -0.48], [-0.0894, 0.0419, -0.48]],
  '/assets/models/drills/drill.glb': [[-0.005, -0.003, -0.5]],
  '/assets/models/ships/explorer_ship.glb': [[0, 0.0027, -0.31]],
  '/assets/models/ships/death_star.glb': [[0.0081, 0.0163, -0.4]],
  '/assets/models/ships/trade_ship.glb': [[0.0785, 0.0325, -0.5], [-0.0758, 0.0325, -0.5], [0.1138, -0.0813, -0.5], [-0.1138, -0.0813, -0.5]],
  ...Object.fromEntries(SHIP_SKIN_IDS.flatMap(id => {
    const item = cosmeticById(id);
    const ports = SHIP_SKIN_DRIVES[id].slots.map(slot => slot.position);
    return [item?.model, item?.lodModel, item?.previewModel]
      .filter((url): url is string => Boolean(url)).map(url => [url, ports]);
  })),
  // This product has a downward emitter and beam, not an aft-facing motor mouth.
  '/assets/models/probes/probe_ufo.glb': [],
  '/assets/models/probes/probe_ufo_preview.glb': [],
};

export const nativeEngineAnchors = (url: string): readonly Vec3Tuple[] | undefined => ANCHORS[url];
