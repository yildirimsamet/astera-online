import { Hull } from './Fleets.jsx';
import type * as THREE from 'three';
import { orientedCraft } from './model.js';
import { TRADE_SHIP_SCALE } from './TradeShip.js';
import type { MonumentDifficulty } from '@astera/rules';

/** Stable public identities: four Hard models, followed by four Easy models. */
export const MONUMENT_MODELS = [
  '/assets/models/monuments/monument_abandoned_space_wreckage.glb',
  '/assets/models/monuments/monument_abandoned_station.glb',
  '/assets/models/monuments/monument_ancient_observatory.glb',
  '/assets/models/monuments/monument_ancient_stargate.glb',
  '/assets/models/monuments/monument_shattered_world_ship.glb',
  '/assets/models/monuments/monument_fragmented_dyson_sphere.glb',
  '/assets/models/monuments/monument_sleeping_guard.glb',
  '/assets/models/monuments/monument_ancient_war_cemetery.glb',
] as const;

/** Legacy landmarks keep their size until the guarded layout adoption. */
export const MONUMENT_SCALE = 3 * TRADE_SHIP_SCALE;

/** Shared by the lightweight Hull silhouette rim and the map label accent. */
export const MONUMENT_GLOW = '#8be7ff';

/** Difficulty has the same visible meaning on every landmark, focused or not. */
export const monumentScale = (difficulty: MonumentDifficulty): number =>
  difficulty === 'HARD' ? 5 * TRADE_SHIP_SCALE : difficulty === 'EASY' ? 3 * TRADE_SHIP_SCALE : MONUMENT_SCALE;
export const monumentGlow = (difficulty: MonumentDifficulty): string =>
  difficulty === 'HARD' ? '#ff4b4b' : difficulty === 'EASY' ? '#58f4b3' : MONUMENT_GLOW;

/** Keep the former framing ratio when the landmark's visible bounds grow. */
export const monumentFocusDistance = (difficulty: MonumentDifficulty): number =>
  20 * monumentScale(difficulty) / MONUMENT_SCALE;

/** Public landmarks stay legible at the whole-galaxy zoom instead of fading into scene fog. */
export const MONUMENT_FOG = false;

export function monumentModelUrl(ordinal: number): string {
  const url = MONUMENT_MODELS[ordinal - 1];
  if (!Number.isInteger(ordinal) || url === undefined) throw new Error('Invalid monument ordinal');
  return url;
}

/** Keep every node's quantization transform; scale the complete visible structure. */
export function monumentModel(scene: THREE.Object3D, difficulty: MonumentDifficulty = 'LEGACY'): THREE.Object3D {
  const model = orientedCraft(scene, '+z');
  model.scale.multiplyScalar(monumentScale(difficulty));
  return model;
}

/** Reuse the fleet Hull rim: one back-side shader pass, no postprocessing bloom. */
export function MonumentModel({ ordinal, difficulty = 'LEGACY', focused = false }: { ordinal: number; difficulty?: MonumentDifficulty; focused?: boolean }) {
  return <group name={`monument-model-${ordinal}`}>
    <Hull url={monumentModelUrl(ordinal)} scale={monumentScale(difficulty)} glow={monumentGlow(difficulty)} focused={focused} fog={MONUMENT_FOG} foreground={false} />
  </group>;
}
