import { memo, useMemo } from 'react';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { HalfFloatType } from 'three';
import { guardBloomRef } from './finiteGuard.js';
import { FiniteSceneGuard } from './FiniteSceneGuard.js';

interface Props {
  live: boolean;
  epoch: number;
  dprCap: number;
  multisampling: number;
  prepared: boolean;
}

/** Keep the effect graph stable through UI updates and scene warmup. */
export const GalaxyPostprocessing = memo(function GalaxyPostprocessing({
  live, epoch, dprCap, multisampling, prepared,
}: Props) {
  const effects = useMemo(() => [
    <FiniteSceneGuard key="finite-scene" />,
    <Bloom ref={guardBloomRef} key="bloom" intensity={0.62} luminanceThreshold={0.78}
      luminanceSmoothing={0.22} mipmapBlur radius={0.72} levels={6} />,
    <Vignette key="vignette" eskil={false} offset={0.24} darkness={0.62} />,
  ], []);

  // Construction itself requires a live context. Resolution/context changes
  // rebuild targets; startup enablement must not rebuild the effect passes.
  return live ? (
    <EffectComposer key={`${String(dprCap)}-${String(epoch)}`} enabled={prepared}
      enableNormalPass={false} frameBufferType={HalfFloatType} multisampling={multisampling}>
      {effects}
    </EffectComposer>
  ) : null;
});
