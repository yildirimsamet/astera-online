/** One live-game hull and its live-game engine, without selection rings or other actors. */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { cosmeticById, MOBILE_HULLS, SHIP_SKIN_IDS } from '@astera/rules';
import { HULL_MODEL, MODEL } from '../ui/assets.js';
import { Exhaust, FormationLightField, Hull } from './Fleets.jsx';
import { FormationCosmeticEngines } from './CosmeticEffects.js';
import { StrategicExhaust } from './StrategicExhaust.js';
import { Sky, BrightStars } from './Environment.jsx';
import { SpaceLighting } from './SpaceLighting.js';
import { SCENE_LIGHT } from './planetSurface.js';
import { useAmbientFrames, HoldRate, FLIGHT_FPS } from './frames.js';
import { hullVisualScale } from './flightVisual.js';
import { guardBloomRef } from './finiteGuard.js';
import { FiniteSceneGuard } from './FiniteSceneGuard.js';
import { QUALITY_PRESETS, useRenderQuality } from '../lib/quality.js';
import type { Marker } from './Squadrons.js';

export const INSPECTION_CRAFT = [
  { id: 'DART', label: 'Dart' },
  { id: 'TALON', label: 'Talon' },
  { id: 'SENTINEL', label: 'Sentinel' },
  { id: 'LEVIATHAN', label: 'Leviathan' },
  { id: 'COURIER', label: 'Courier' },
  { id: 'probe', label: 'Probe' },
  { id: 'PROSPECTOR', label: 'Kazıcı' },
  { id: 'death-star', label: 'Ölüm Yıldızı' },
  { id: 'trade-ship', label: 'Ticaret gemisi' },
  { id: 'VIPER', label: 'Viper · mevcut model' },
  { id: 'PIKE', label: 'Pike · mevcut model' },
  { id: 'WARDEN', label: 'Warden · mevcut model' },
  { id: 'BALLISTA', label: 'Ballista · mevcut model' },
  { id: 'RAMPART', label: 'Rampart · mevcut model' },
  { id: 'STRONGHOLD', label: 'Stronghold · mevcut model' },
  { id: 'WAYFARER', label: 'Wayfarer · mevcut model' },
  { id: 'TEMPEST', label: 'Tempest · mevcut model' },
  { id: 'PRAETORIAN', label: 'Praetorian · mevcut model' },
  { id: 'ATLAS', label: 'Atlas · mevcut model' },
  { id: 'CITADEL', label: 'Citadel · mevcut model' },
  { id: 'NULLIFIER', label: 'Nullifier · mevcut model' },
  { id: 'GARBAGE_COLLECTOR', label: 'Toplayıcı · mevcut model' },
  { id: 'CORSAIR', label: 'Corsair · mevcut model' },
  { id: 'PALADIN', label: 'Paladin · mevcut model' },
  { id: 'ARGOSY', label: 'Argosy · mevcut model' },
  { id: 'CATACLYSM', label: 'Cataclysm · mevcut model' },
  { id: 'ship-red-dragon', label: 'Ejder · Korsan görünümü' },
  { id: 'ship-shark', label: 'Balina · Kale görünümü' },
  { id: 'ship-scorpion', label: 'Akrep · Engerek görünümü' },
  { id: 'ship-stingray', label: 'Vatoz · Leviathan görünümü' },
  { id: 'probe-ufo', label: 'UFO · probe görünümü' },
] as const;
export type InspectionCraft = typeof INSPECTION_CRAFT[number]['id'];
export const INSPECTION_ANGLES = [
  { id: 'quarter', label: 'Üç çeyrek' }, { id: 'front', label: 'Ön' }, { id: 'back', label: 'Arka' },
  { id: 'side', label: 'Yan' }, { id: 'top', label: 'Üst' },
] as const;
export type InspectionAngle = typeof INSPECTION_ANGLES[number]['id'];
const DIRECTIONS: Record<InspectionAngle, [number, number, number]> = {
  quarter: [1, 0.55, -1.6], front: [0, 0.12, 1], back: [0, 0.12, -1], side: [1, 0.12, 0], top: [0, 1, 0.001],
};
const ORIGIN: [number, number, number][] = [[0, 0, 0]];

export function PremiumShipInspector({ craft, angle, engines, engineId, reset, onReady }: {
  craft: InspectionCraft;
  angle: InspectionAngle;
  engines: boolean;
  engineId?: string;
  reset: number;
  onReady: () => void;
}) {
  const quality = useRenderQuality();
  const preset = QUALITY_PRESETS[quality];
  return <Canvas frameloop="demand" camera={{ position: [1.3, 0.75, -2.15], fov: 40, near: 0.01, far: 600 }}
    dpr={[1, preset.dprCap]} gl={{ antialias: false, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMappingExposure = 1; }}
    style={{ position: 'absolute', inset: 0, touchAction: 'none' }}>
    <color attach="background" args={['#04060c']} />
    <ambientLight intensity={SCENE_LIGHT.ambient} />
    <directionalLight position={[-8, 12, 9]} intensity={SCENE_LIGHT.key} />
    <directionalLight position={[10, -3, -12]} intensity={0.48} color="#91b5de" />
    <SpaceLighting />
    <Sky />
    <BrightStars />
    <InspectorCamera angle={angle} reset={reset} />
    <InspectionFrames engines={engines} />
    <Suspense fallback={null}>
      <InspectionModel craft={craft} engines={engines} engineId={engineId} onReady={onReady} />
    </Suspense>
    <EffectComposer enableNormalPass={false} multisampling={preset.multisampling}>
      <FiniteSceneGuard />
      <Bloom ref={guardBloomRef} intensity={0.62} luminanceThreshold={0.78} luminanceSmoothing={0.22} mipmapBlur radius={0.72} levels={6} />
      <Vignette eskil={false} offset={0.24} darkness={0.62} />
    </EffectComposer>
  </Canvas>;
}

function InspectorCamera({ angle, reset }: { angle: InspectionAngle; reset: number }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree(state => state.camera);
  const size = useThree(state => state.size);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    const distance = 1.85 / Math.min(1, size.width / Math.max(1, size.height));
    camera.position.set(...DIRECTIONS[angle]).normalize().multiplyScalar(distance);
    controls.current?.target.set(0, 0, -0.18);
    camera.lookAt(0, 0, -0.18);
    controls.current?.update();
    invalidate();
  }, [angle, reset, camera, size.width, size.height, invalidate]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.09} minDistance={0.6} maxDistance={12}
    minPolarAngle={0.015} maxPolarAngle={Math.PI - 0.015} />;
}

function InspectionFrames({ engines }: { engines: boolean }) {
  useAmbientFrames();
  return <HoldRate fps={FLIGHT_FPS} active={engines} />;
}

function InspectionModel({ craft, engines, engineId, onReady }: { craft: InspectionCraft; engines: boolean; engineId?: string; onReady: () => void }) {
  const skinId = SHIP_SKIN_IDS.find(id => id === craft);
  const skin = cosmeticById(craft);
  const hull = skin?.category === 'SHIP' ? skin.hull : MOBILE_HULLS.find(id => id === craft);
  const url = skin?.model ?? (craft === 'probe' ? MODEL.probe : craft === 'death-star' ? MODEL.deathStar : craft === 'trade-ship' ? MODEL.tradeShip : hull ? HULL_MODEL[hull] : undefined);
  if (!url) throw new Error(`Missing inspection model: ${craft}`);
  const { scene } = useGLTF(url, false);
  const aimDistance = useRef(1000);
  const markers = useMemo<Marker[]>(() => hull ? [{ hull, filled: 1, ordinal: 0 }] : [], [hull]);
  const shipSkins = useMemo(() => skinId && hull ? { [hull]: skinId } : undefined, [skinId, hull]);
  const equippedEngine = engineId && cosmeticById(engineId)?.category === 'ENGINE' ? engineId : undefined;

  useEffect(() => { onReady(); }, [scene, onReady]);
  return <group name="premium-single-craft-inspection">
    <Hull url={url} scale={1} glow="#18212b" focused={false} fog={false} />
    {engines && (craft === 'death-star' ? <StrategicExhaust scale={1} /> : hull
      ? <>
        <FormationLightField markers={markers} slots={ORIGIN} scale={1 / hullVisualScale(hull, 1)}
          aimDistance={aimDistance} focused={false} showPips={false} shipSkins={shipSkins} customEngine={Boolean(equippedEngine)} />
        {equippedEngine && <FormationCosmeticEngines id={equippedEngine} markers={markers} slots={ORIGIN} scale={1 / hullVisualScale(hull, 1)}
          aimDistance={aimDistance} shipSkins={shipSkins} />}
      </>
      : <Exhaust url={url} scale={1} colour={craft === 'trade-ship' ? '#ffe9b8' : '#9dffc4'} />)}
  </group>;
}
