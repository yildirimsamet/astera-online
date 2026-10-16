import { wrapEffect } from '@react-three/postprocessing';
import { FiniteSceneEffect } from './finiteGuard.js';

/** Merges with bloom/vignette; no additional render target or fullscreen draw. */
export const FiniteSceneGuard = wrapEffect(FiniteSceneEffect);
