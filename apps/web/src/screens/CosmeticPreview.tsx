import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bounds, Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { cosmeticById, SHIP_SKIN_IDS } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { CosmeticEngine, CosmeticFlag, CosmeticRing } from '../galaxy/CosmeticEffects.jsx';
import { SkinAssetBoundary } from '../galaxy/SkinAssetBoundary.jsx';
import { HULL_MODEL, MODEL_FACING, planetModel } from '../ui/assets.js';
import type { Facing } from '../galaxy/model.js';
import { normalizedCosmeticModel } from '../galaxy/cosmeticModel.js';
import { ShipSkinDrive } from './ShipSkinDrive.jsx';

export function CosmeticModel({ url, facing }: { url: string; facing?: Facing }) {
  const { scene } = useGLTF(url, false);
  const model = useMemo(() => normalizedCosmeticModel(scene, facing), [scene, facing]);
  return <primitive object={model} />;
}

function PreviewReady({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => { frames.current++; if (frames.current === 3) onReady(); });
  return null;
}

export function CosmeticPreview({ id, still = false, inspectionView, productCard = false }: { id: string; still?: boolean; inspectionView?: 'top' | 'side' | 'right' | 'rear'; productCard?: boolean }) {
  const { t } = useTranslation();
  const item = cosmeticById(id);
  const shipId = SHIP_SKIN_IDS.find(skinId => skinId === id);
  const [readyId, setReadyId] = useState<string | null>(null);
  const markReady = useCallback(() => { setReadyId(id); }, [id]);
  if (!item) return null;
  return <div data-cosmetic-stage={id} data-cosmetic-ready={String(readyId === id)} className="relative h-[260px] w-full [&_*]:touch-pan-y! sm:h-[340px]" style={{ touchAction: 'pan-y' }}>
    <Canvas camera={{ position: inspectionView === 'top' ? [0, 7, .001] : inspectionView === 'side' ? [7, 0, 0] : inspectionView === 'right' ? [-7, 0, 0] : inspectionView === 'rear' ? [0, 0, -7] : item.category === 'RING' ? [0, 2.2, 4.6] : shipId ? [0, 3.8, 4] : [0, 1.2, 4.8], fov: 40 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 4, 5]} intensity={3.5} color="#e2eaff" />
      <directionalLight position={[-3, 1, -2]} intensity={2} color={item.accent} />
      <SkinAssetBoundary key={id} fallback={<Html center>{t('skins.modelUnavailable')}</Html>}>
        <Suspense fallback={<Html center>…</Html>}>
          <PreviewReady key={id} onReady={markReady} />
          <Bounds fit={Boolean(item.model) || item.category === 'ENGINE'} observe clip margin={inspectionView ? 1.3 : productCard ? .8 : 1} maxDuration={0}>
          {item.category === 'RING' ? <group>
            <CosmeticModel url={planetModel('cosmetic-preview', 'full')} />
            <mesh scale={1.017}><sphereGeometry args={[.87, 48, 32]} /><meshBasicMaterial color="#497ba2" transparent opacity={.075} side={THREE.BackSide} depthWrite={false} /></mesh>
            <CosmeticRing id={id} still={still} />
          </group> : item.category === 'ENGINE' ? <group rotation={inspectionView ? [0, 0, 0] : [0, -1.15, .08]} position={[0, 0, .75]} scale={1.1}>
            <group scale={.72}><CosmeticModel url={HULL_MODEL.PIKE} facing={MODEL_FACING[HULL_MODEL.PIKE]} /></group>
            <CosmeticEngine id={id} still={still} />
          </group> : item.category === 'FLAG' ? <group scale={1.55}><CosmeticFlag id={id} still={still} /></group>
            : item.model ? <group scale={1.45} rotation={[0, shipId && !inspectionView ? -.75 : 0, 0]}>
              <CosmeticModel url={item.previewModel ?? item.model} facing={shipId ? MODEL_FACING[item.model] : undefined} />
              {shipId && <group scale={1.7}><ShipSkinDrive id={shipId} still={still} /></group>}
            </group> : null}
          </Bounds>
        </Suspense>
      </SkinAssetBoundary>
      <OrbitControls makeDefault enablePan={false} enableDamping autoRotate={!still && item.category !== 'ENGINE'} autoRotateSpeed={.4} minDistance={shipId ? 1.5 : 3.5} maxDistance={inspectionView ? 14 : 8} />
    </Canvas>
  </div>;
}
