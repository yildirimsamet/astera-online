import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GALAXY, STARTER, generateGalaxy, mainOffsetOf, mulberry32, toWorld } from '@astera/rules';
import { useShipModels } from '../arena/hangar/shipModels.js';
import { BrightStars, Dust, Sky, softGlow } from '../galaxy/Environment.js';
import { GalaxyPostprocessing } from '../galaxy/GalaxyPostprocessing.js';
import { MainGalaxySky } from '../galaxy/MainGalaxySky.js';
import { mainSkyNodes } from '../galaxy/mainSky.js';
import { PlanetField } from '../galaxy/PlanetField.js';
import { ShipBody } from '../galaxy/ParkedShip.js';
import { SpaceLighting } from '../galaxy/SpaceLighting.js';

const FOV = 45;
const MAIN_POINTS = 1230;
const NEIGHBOURS = 24;
const SHIP = toWorld({ x: 480, y: 120, z: -900 });
const SHIP_LENGTH = 1.3;
const CAMERA_BACK = 4.2;
const CAMERA_LIFT = 2;
const NO_RIVALS: never[] = [];
const ignore = (): void => undefined;

/** `&distance=18000` tries the main galaxy further away, to judge the first shell by eye. */
const MAIN = (() => {
  const { x, y, z } = mainOffsetOf(1);
  const asked = Number(new URLSearchParams(location.search).get('distance'));
  const factor = asked > 0 ? asked / Math.hypot(x, y, z) : 1;
  return { x: x * factor, y: y * factor, z: z * factor };
})();

/** The opening frame: from behind the ship, along the line to the main galaxy. */
function openingCamera(): [number, number, number] {
  const main = toWorld(MAIN);
  const dx = main[0] - SHIP[0], dy = main[1] - SHIP[1], dz = main[2] - SHIP[2];
  const length = Math.hypot(dx, dy, dz);
  return [SHIP[0] - (dx / length) * CAMERA_BACK, SHIP[1] - (dy / length) * CAMERA_BACK + CAMERA_LIFT, SHIP[2] - (dz / length) * CAMERA_BACK];
}

/** Neighbours as points, until the real ships are drawn. */
function Neighbours() {
  const geometry = useMemo(() => {
    const random = mulberry32(3), positions = new Float32Array(NEIGHBOURS * 3);
    for (let i = 0; i < NEIGHBOURS; i++) {
      const r = STARTER.radius * Math.cbrt(random()), a = random() * Math.PI * 2, y = random() * 2 - 1, flat = Math.sqrt(1 - y * y);
      positions.set(toWorld({ x: r * flat * Math.cos(a), y: r * y, z: r * flat * Math.sin(a) }), i * 3);
    }
    const built = new THREE.BufferGeometry();
    built.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return built;
  }, []);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  return <points geometry={geometry}>
    <pointsMaterial map={softGlow()} color="#9fc8ff" size={0.9} sizeAttenuation transparent depthWrite={false}
      blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
  </points>;
}

function Ship() {
  const models = useShipModels(true, true);
  const model = models ? Object.values(models)[0] : undefined;
  if (!model) return null;
  return <group position={SHIP} scale={SHIP_LENGTH}><ShipBody model={model} lit={false} /></group>;
}

/** Frames per second as text, so a phone's reading can be taken from a screenshot. */
function FrameRate() {
  const text = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frames = 0, start = performance.now(), handle = requestAnimationFrame(function tick(now) {
      frames++;
      if (now - start >= 1000) {
        if (text.current) text.current.textContent = `${String(Math.round((frames * 1000) / (now - start)))} fps`;
        frames = 0; start = now;
      }
      handle = requestAnimationFrame(tick);
    });
    return () => { cancelAnimationFrame(handle); };
  }, []);
  return <div ref={text} data-testid="starter-preview-fps" style={{ position: 'absolute', left: 8, top: 8, color: '#8fa', font: '12px monospace' }} />;
}

/** `?starterPreview=1`: the two galaxies side by side, with no account and no server. */
export default function StarterPreview() {
  const mainWorlds = useMemo(() => mainSkyNodes(generateGalaxy(7, MAIN_POINTS).slots, MAIN), []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#04060c' }}>
      <Canvas
        frameloop="always"
        camera={{ position: openingCamera(), fov: FOV, near: 0.1, far: 800 }}
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      >
        <color attach="background" args={['#04060c']} />
        <SpaceLighting />
        <directionalLight position={[-40, 60, 30]} intensity={2.4} />
        <Sky />
        <BrightStars />
        <group scale={STARTER.radius / GALAXY.radius}><Dust /></group>
        <Suspense fallback={null}>
          <PlanetField nodes={mainWorlds} selectedId={null} rivals={NO_RIVALS} onSelect={ignore} />
          <MainGalaxySky offset={MAIN} />
        </Suspense>
        <Neighbours />
        <Suspense fallback={null}><Ship /></Suspense>
        <OrbitControls target={SHIP} enableDamping minDistance={1.5} maxDistance={120} />
        <GalaxyPostprocessing live epoch={0} dprCap={2} multisampling={0} prepared />
      </Canvas>
      <FrameRate />
    </div>
  );
}
