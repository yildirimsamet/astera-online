import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import type { PlanetSkinStatus } from '@astera/rules';
import { PlanetSkinModel, previewSkinNode } from '../galaxy/PlanetSkinModel.jsx';
import { SkinAssetBoundary } from '../galaxy/SkinAssetBoundary.jsx';

const NODE = [previewSkinNode('shop-preview')];
const START_ANGLES: Readonly<Record<string, number>> = {
  'planet-france': -0.65,
  'planet-spain': 1.5,
};

/**
 * THE LOOK ITSELF: the exact game asset and palette, turning slowly on its own and turned by
 * the player's thumb, pinched to zoom. Transparent, so the store's living backdrop — its
 * nebula, the look's aura, the orbit and the embers (`SkinShopContent`) — is what it floats in.
 */
export function SkinPreview({
  skinId,
  status,
  className = 'h-72',
  phaseOffset,
}: {
  skinId: string;
  status: PlanetSkinStatus;
  /** Stage height; a desk gives the live model the room a phone cannot. */
  className?: string;
  /** Only the shop and derived selection card set a merchandising start angle. */
  phaseOffset?: number;
}) {
  const { t } = useTranslation();
  return (
    <div data-skin-stage className={`relative w-full ${className}`} style={{ touchAction: 'pan-y' }}>
      {/*
        TRANSPARENT, AND NO BLOOM: a bloom pass draws the canvas opaque and boxed the look in a
        dark card over the store's nebula and aura (seen on the page). The glow is the page's.
        Set back a little, so the orbit and the aura read round the world, not behind it.
      */}
      <Canvas className="relative z-10" camera={{ position: [0, 0, 5.4], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.3} />
        <directionalLight position={[3, 4, 5]} intensity={3.2} color="#ffffff" />
        <directionalLight position={[-4, -2, -4]} intensity={1.2} color="#7caaff" />
        <SkinAssetBoundary key={`${skinId}:${status}`}
          fallback={<Html center><span className="whitespace-nowrap font-v2-ui text-micro uppercase tracking-wide text-v2-ink-2">{t('skins.modelUnavailable')}</span></Html>}>
          <Suspense fallback={<Html center><span className="font-v2-mono text-micro text-v2-ink-3">…</span></Html>}>
            <PlanetSkinModel skinId={skinId} status={status} nodes={NODE}
              previewPhaseOffset={phaseOffset ?? START_ANGLES[skinId] ?? 0} />
          </Suspense>
        </SkinAssetBoundary>
        {/* It turns by itself, so the look is alive before anyone touches it; a drag takes over. */}
        <OrbitControls enablePan={false} enableDamping autoRotate autoRotateSpeed={0.9} minDistance={2.5} maxDistance={7.5} />
      </Canvas>
    </div>
  );
}
