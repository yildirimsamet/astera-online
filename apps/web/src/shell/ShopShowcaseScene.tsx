import { Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { cosmeticById } from '@astera/rules';
import type { Group } from 'three';
import { CosmeticFlag, CosmeticRing } from '../galaxy/CosmeticEffects.js';
import { PlanetSkinModel, previewSkinNode } from '../galaxy/PlanetSkinModel.js';
import { CosmeticModel } from '../screens/CosmeticPreview.js';
import { ShipSkinDrive } from '../screens/ShipSkinDrive.js';
import { MODEL_FACING } from '../ui/assets.js';
import { ShopShowcasePoster } from './ShopShowcasePoster.js';

const WORLDS = [{ ...previewSkinNode('menu-showcase'), radius: .7 }];
const DRAGON = cosmeticById('ship-red-dragon');
const PROBE = cosmeticById('probe-ufo');
const RING = cosmeticById('ring-helios');
const CAMERA_POSITION: [number, number, number] = [0, 4.6, 7];
const CAMERA = { position: CAMERA_POSITION, zoom: 38, near: .1, far: 50 };

/** One small scene shares the game's actual models, cloth and ring shaders. */
export default function ShopShowcaseScene() {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => { setReady(true); }, []);
  return <>
    {!ready && <ShopShowcasePoster />}
    <Canvas orthographic camera={CAMERA}
      dpr={1} gl={{ alpha: true, antialias: true }} fallback={<ShopShowcasePoster />}>
      <ambientLight intensity={.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.9} />
      <directionalLight position={[-4, 2, -3]} intensity={.8} color={PROBE?.accent} />
      <Suspense fallback={null}>
        <ShowcaseCamera />
        <group position={[0, -.23, 0]}>
          <PlanetSkinModel skinId="planet-lava" status="NORMAL" nodes={WORLDS} />
          <group scale={.7}><CosmeticRing id="ring-helios" /></group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.82, 1.56, 1]}>
            <ringGeometry args={[.997, 1.002, 96]} />
            <meshBasicMaterial color={RING?.accent} transparent opacity={.17} depthWrite={false} />
          </mesh>
          <ShowcaseCraft />
          <SceneReady onReady={markReady} />
        </group>
      </Suspense>
    </Canvas>
  </>;
}

function ShowcaseCamera() {
  const camera = useThree(state => state.camera);
  const size = useThree(state => state.size);
  useLayoutEffect(() => {
    camera.zoom = Math.min(size.width / 5.4, size.height / 3.6);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function ShowcaseCraft() {
  const dragon = useRef<Group>(null);
  const hull = useRef<Group>(null);
  const probe = useRef<Group>(null);
  const phase = useRef(.6);
  const probePhase = useRef(3.65);
  useFrame((_, delta) => {
    const dt = Math.min(delta, .05);
    phase.current += dt * .24;
    probePhase.current -= dt * .39;
    const at = phase.current;
    const scout = probePhase.current;
    dragon.current?.position.set(Math.cos(at) * 1.82, .22, Math.sin(at) * 1.56);
    if (hull.current) hull.current.rotation.y = Math.atan2(-1.82 * Math.sin(at), 1.56 * Math.cos(at));
    probe.current?.position.set(Math.cos(scout) * 2.14, .32 + Math.sin(scout * 2) * .09, Math.sin(scout) * 1.74);
    if (probe.current) probe.current.rotation.y = -scout;
  });
  return <>
    <group ref={dragon} name="showcase-dragon-orbit">
      <group ref={hull} scale={.88}>
        {DRAGON?.model && <CosmeticModel url={DRAGON.model} facing={MODEL_FACING[DRAGON.model]} />}
        <group scale={1.7}><ShipSkinDrive id="ship-red-dragon" still={false} /></group>
      </group>
      <group position={[.13, .4, 0]} rotation={[-.58, 0, .04]} scale={.36}>
        <CosmeticFlag id="flag-phoenix" />
      </group>
    </group>
    <group ref={probe} name="showcase-probe-orbit" scale={.31}>
      {PROBE?.model && <CosmeticModel url={PROBE.model} />}
    </group>
  </>;
}

function SceneReady({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => { if (++frames.current === 3) onReady(); });
  return null;
}
