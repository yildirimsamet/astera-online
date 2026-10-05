import { Hull } from './Fleets.jsx';
import type * as THREE from 'three';
import { orientedCraft } from './model.js';
import { TRADE_SHIP_SCALE } from './TradeShip.js';

/** Ordinals are stable public identities; these are the five supplied masters. */
export const MONUMENT_MODELS = [
  '/assets/models/monuments/monument_abandoned_space_wreckage.glb',
  '/assets/models/monuments/monument_abandoned_station.glb',
  '/assets/models/monuments/monument_ancient_observatory.glb',
  '/assets/models/monuments/monument_ancient_stargate.glb',
  '/assets/models/monuments/monument_shattered_world_ship.glb',
] as const;

/** Monument scale is a public landmark: exactly three trade-ship widths. */
export const MONUMENT_SCALE = 3 * TRADE_SHIP_SCALE;

/** Shared by the lightweight Hull silhouette rim and the map label accent. */
export const MONUMENT_GLOW = '#8be7ff';

/** Public landmarks stay legible at the whole-galaxy zoom instead of fading into scene fog. */
export const MONUMENT_FOG = false;

export function monumentModelUrl(ordinal: number): string {
  const url = MONUMENT_MODELS[ordinal - 1];
  if (!Number.isInteger(ordinal) || url === undefined) throw new Error('Invalid monument ordinal');
  return url;
}

/** Keep every node's quantization transform; scale the complete visible structure. */
export function monumentModel(scene: THREE.Object3D): THREE.Object3D {
  const model = orientedCraft(scene, '+z');
  model.scale.multiplyScalar(MONUMENT_SCALE);
  return model;
}

/** Reuse the fleet Hull rim: one back-side shader pass, no postprocessing bloom. */
export function MonumentModel({ ordinal, focused = false }: { ordinal: number; focused?: boolean }) {
  return <group name={`monument-model-${ordinal}`}>
    <Hull url={monumentModelUrl(ordinal)} scale={MONUMENT_SCALE} glow={MONUMENT_GLOW} focused={focused} fog={MONUMENT_FOG} foreground={false} />
  </group>;
}
