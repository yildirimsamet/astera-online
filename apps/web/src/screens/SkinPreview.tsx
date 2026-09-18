import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useTranslation } from 'react-i18next';
import { planetSkinById, type PlanetSkinStatus } from '@astera/rules';
import { PlanetSkinModel, previewSkinNode } from '../galaxy/PlanetSkinModel.jsx';
import { SkinAssetBoundary } from '../galaxy/SkinAssetBoundary.jsx';
import { PLANET_SKIN_CATALOG, SKIN_EDITION_TOTAL } from '../ui/skinCatalog.js';

const NODE = [previewSkinNode('shop-preview')];
const STARS = [
  [8, 15, 1], [17, 49, 2], [22, 76, 1], [31, 27, 1], [38, 87, 2], [46, 10, 1],
  [54, 73, 1], [63, 32, 2], [71, 13, 1], [78, 68, 1], [86, 39, 2], [93, 18, 1],
  [12, 88, 1], [27, 11, 1], [43, 53, 1], [57, 92, 1], [74, 86, 2], [91, 76, 1],
] as const;

/** The exact game asset and palette, with touch rotation and pinch zoom. */
export function SkinPreview({
  skinId,
  status,
  className = 'h-72',
}: {
  skinId: string;
  status: PlanetSkinStatus;
  /** Stage height; desktop gives the live model the room a phone cannot. */
  className?: string;
}) {
  const { t } = useTranslation();
  const known = planetSkinById(skinId);
  const look = known ? PLANET_SKIN_CATALOG[known.id] : null;
  return (
    <div data-skin-stage className={`relative w-full overflow-hidden ${className} rounded-plate border border-white/20 bg-[#060b13] shadow-[0_18px_48px_rgba(0,0,0,0.38)]`} style={{ touchAction: 'pan-y' }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/assets/images/skins/galaxy-nebula.webp')] bg-cover bg-center opacity-100" />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 53%, ${look?.glow ?? 'rgba(80,140,200,0.25)'} 0%, transparent 50%), linear-gradient(180deg, rgba(5,9,20,0.2), rgba(5,9,20,0.48))` }} />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STARS.map(([x, y, size], index) => (
          <span key={index} className="absolute rounded-pill bg-[#d8efff] shadow-[0_0_7px_rgba(170,220,255,0.8)]"
            style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, opacity: size === 2 ? 0.8 : 0.45 }} />
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[43%] w-[85%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-full border border-[#b3d9ff]/15" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[30%] w-[68%] -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-full border border-[#b3d9ff]/10" />
      <Canvas className="relative z-10" camera={{ position: [0, 0, 4.3], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.3} />
        <directionalLight position={[3, 4, 5]} intensity={3.2} color="#ffffff" />
        <directionalLight position={[-4, -2, -4]} intensity={1.2} color="#7caaff" />
        <SkinAssetBoundary key={`${skinId}:${status}`}
          fallback={<Html center><span className="legend whitespace-nowrap text-bone">{t('skins.modelUnavailable')}</span></Html>}>
          <Suspense fallback={<Html center><span className="legend text-bone">…</span></Html>}>
            <PlanetSkinModel skinId={skinId} status={status} nodes={NODE} />
          </Suspense>
        </SkinAssetBoundary>
        <OrbitControls enablePan={false} enableDamping minDistance={2.5} maxDistance={6.5} />
        <EffectComposer>
          <Bloom luminanceThreshold={1} intensity={0.55} mipmapBlur />
        </EffectComposer>
      </Canvas>
      <div data-skin-stage-label className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 font-display text-micro uppercase tracking-wide text-bone/75">
        <span className="size-1.5 rounded-pill bg-crystal shadow-[0_0_8px_rgba(132,223,235,0.8)]" />
        {t('skins.stageLabel')}
      </div>
      <p data-skin-stage-label className="pointer-events-none absolute bottom-3 left-3 z-20 font-display text-micro uppercase tracking-wide text-bone/60">{t('skins.stageGesture')}</p>
      <p data-skin-stage-label className="pointer-events-none absolute bottom-3 right-3 z-20 font-display text-micro uppercase tracking-wide text-bone/60">{look?.edition ?? '00'} / {SKIN_EDITION_TOTAL}</p>
    </div>
  );
}
