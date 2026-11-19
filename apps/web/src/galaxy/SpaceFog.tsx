import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { wrapEffect } from '@react-three/postprocessing';
import type { SensorSphere } from '@astera/rules';
import { SpaceFogEffect, fogSource } from './spaceFogEffect.js';

/** Merges with bloom and vignette; reads the composer's depth, adds no target and no draw. */
export const SpaceFog = wrapEffect(SpaceFogEffect);

/**
 * Hands the commander's own sensors to the fog. Nothing here reads or decides what a player may see;
 * it only tells the picture where the open volumes are. Redraws when they change, because the scene
 * only renders on demand. `undefined` means the sensors have not arrived: no fog, not a blank map.
 */
export function SpaceFogSource({ sensors }: { sensors: readonly Pick<SensorSphere, 'at' | 'identify'>[] | undefined }) {
  const invalidate = useThree(state => state.invalidate);
  const camera = useThree(state => state.camera);
  useEffect(() => {
    fogSource.set(camera, sensors ?? null);
    invalidate();
    return () => { fogSource.set(camera, null); };
  }, [sensors, camera, invalidate]);
  return null;
}
