import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useMemo, useRef, type ComponentRef } from 'react';
import * as THREE from 'three';
import type { VesselHull } from '@astera/rules';
import { Sky } from '../../galaxy/Environment.js';
import { NO_LIGHTS, damageSpots, vesselModelFile } from '../../galaxy/mainSky.js';
import { VesselBody, preloadVessel } from '../../galaxy/VesselBody.js';

const WRECK_DAMAGE = damageSpots(NO_LIGHTS);

/** How long the drop out of the jump takes, camera far to near. */
export const ARRIVE_MS = 2800;
/** The point the camera turns about: below the hull, so the ship stands above the text. */
const TARGET = new THREE.Vector3(0, -0.2, 0);

export const preloadShip = (hull: VesselHull): void => { preloadVessel(vesselModelFile(hull, 'WRECKED')); };

/** Fast out of the jump, then a long settle: the drop is seen, not skipped. */
const ease = (t: number): number => 1 - Math.pow(1 - t, 2.2);

/**
 * THE DROP OUT OF THE JUMP: the camera comes in fast from far ahead and settles beside the hull; only
 * then is it the player's to turn. The settling distance fits the hull to a narrow phone.
 */
function Arrival({ arrived }: { arrived: boolean }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height));
  const began = useRef<number | null>(null);
  const rest = useMemo(() => {
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 40;
    const halfWide = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect);
    const distance = Math.max(1.4, 0.37 / Math.tan(halfWide));
    return new THREE.Vector3(1.25, 0.42, 1.6).normalize().multiplyScalar(distance).add(TARGET);
  }, [camera, aspect]);
  const from = useMemo(() => new THREE.Vector3(-3, 1.6, 22), []);
  useFrame(({ clock }) => {
    const rig = controls.current;
    if (!rig) return;
    if (!arrived) {
      // Still in the jump: held far out, drawing, so the first frame after the white is already warm.
      rig.enabled = false;
      camera.position.copy(from);
      camera.lookAt(TARGET);
      return;
    }
    began.current ??= clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - began.current) / (ARRIVE_MS / 1000));
    if (t < 1) {
      rig.enabled = false;
      camera.position.lerpVectors(from, rest, ease(t));
      camera.lookAt(TARGET);
    } else if (!rig.enabled) {
      rig.enabled = true;
      rig.autoRotate = true;
    }
    rig.update();
  });
  return (
    <OrbitControls ref={controls} makeDefault target={TARGET} enablePan={false} enableDamping dampingFactor={0.08}
      minDistance={1.4} maxDistance={6} autoRotateSpeed={0.45} rotateSpeed={0.7} zoomSpeed={0.6}
      minPolarAngle={0.35} maxPolarAngle={Math.PI - 0.35} />
  );
}

/**
 * THE SHIP, SEEN FROM OUTSIDE FOR THE FIRST TIME (owner 2026-11-06: "3D, hareket ettirilebilir bir
 * ortamda olsun"). The model the galaxy will draw, wrecked, burning in places, under the game's own
 * sky. A finger turns it.
 */
export default function ShipScene({ hull, arrived }: { hull: VesselHull; arrived: boolean }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [-3, 1.6, 22], fov: 38, near: 0.05, far: 600 }} gl={{ antialias: true }}>
      <color attach="background" args={['#020409']} />
      {/* Owner 2026-11-06: the stretched nebula and the point galaxy looked cheap. This is the sky the
          galaxy itself is drawn under, so the ship is already where it will be found. */}
      <Sky />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#a8c8ff', '#1b0f06', 0.45]} />
      <directionalLight position={[4, 3, 5]} intensity={2.4} color="#ffe2b8" />
      <directionalLight position={[-5, 1.5, -4]} intensity={1.8} color="#6fb6ff" />
      <Suspense fallback={null}>
        <group rotation={[0.06, -0.5, 0.05]}>
          <VesselBody file={vesselModelFile(hull, 'WRECKED')} hull={hull} damage={WRECK_DAMAGE} rimOpacity={0.28} rimWidth={0.005} />
        </group>
      </Suspense>
      <Arrival arrived={arrived} />
    </Canvas>
  );
}
