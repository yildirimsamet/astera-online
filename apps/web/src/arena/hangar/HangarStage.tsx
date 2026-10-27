/**
 * THE HANGAR (owner 2026-10-23): the commander's ship standing in a hangar bay, turned by hand.
 *
 * One hangar model (`tools/models.mjs`, kind `hangar`) and one class ship from the Yarık's pack.
 * Everything that makes it look lit is cheap on purpose (perf-tricks-over-lights): the bay's light
 * strips glow from their own colour, the ship's contact shadow is a soft disc, the engines are two
 * sprites. A handful of plain lights and one baked room reflection carry the metal.
 *
 * The ship turns on its pad by hand (`turntable.ts`); the camera stays on the apron, looking in.
 * It draws at 30 frames a second while idle and 60 under a hand.
 */
import { Component, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type WheelEvent as ReactWheelEvent } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ShipClass } from '@astera/rules/arena';
import { Sky } from '../../galaxy/Environment.jsx';
import { guardBloomRef } from '../../galaxy/finiteGuard.js';
import { QUALITY_PRESETS, useRenderQuality } from '../../lib/quality.js';
import { radial, shipDecoders, useShipModels, type ShipModel } from './shipModels.js';
import { hangarPost } from './stageQuality.js';
import { TURN, createTurntable, dragTurntable, releaseTurntable, restHeight, stepTurntable, zoomTurntable, type Turntable } from './turntable.js';

export const HANGAR_MODEL = '/assets/models/hangar/space_hangar.glb';

/** Where the ship stands: inside the bay under the crane, its nose turned out to the apron (+X). */
const BAY = { x: 0.04, z: 0, yaw: Math.PI / 2 - 0.55 };
/** Each class's length on the pad, so the three read as three sizes of ship. */
const LENGTH: Record<ShipClass, number> = { akinci: 0.25, kilavuz: 0.28, muhafiz: 0.31 };
const IDLE_FPS = 30;
const HELD_FPS = 60;
/** The camera's bearing from the ship: out on the apron, a little to one side of the bay's axis. */
const AZIMUTH = Math.PI / 2 + 0.3;

/**
 * The bay's light strips are painted into its colour map, not modelled as lights. A texel that is
 * bright, blue-green and low in red is one of them, and gives off its own colour: with the bloom
 * the strips read as lit panels, at no cost past a few instructions.
 */
function lightStrips(material: THREE.MeshStandardMaterial, glow: number): void {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 tone = diffuseColor.rgb;
        float strip = smoothstep(0.42, 0.8, tone.b) * smoothstep(0.32, 0.7, tone.g) * (1.0 - smoothstep(0.5, 0.78, tone.r / max(tone.b, 0.001)));
        totalEmissiveRadiance += tone * strip * ${glow.toFixed(1)};
      }`);
  };
  material.customProgramCacheKey = () => `strips:${glow.toFixed(1)}`;
  material.envMapIntensity = 0.7;
  material.needsUpdate = true;
}

function Hangar({ onFloor, post }: { onFloor: (y: number) => void; post: boolean }) {
  const { scene } = useGLTF(HANGAR_MODEL);
  useEffect(() => {
    scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials: unknown = node.material;
      const list: readonly unknown[] = Array.isArray(materials) ? materials : [materials];
      // Without the bloom pass the strips carry their own glow a little further.
      for (const material of list) if (material instanceof THREE.MeshStandardMaterial) lightStrips(material, post ? 4 : 6);
    });
    // The deck under the ship, wherever the model puts it.
    const ray = new THREE.Raycaster(new THREE.Vector3(BAY.x, 1, BAY.z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(scene, true)[0];
    onFloor(hit ? hit.point.y : -0.19);
  }, [scene, onFloor, post]);
  return <primitive object={scene} />;
}

const easeOut = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function Ship({ model, ship, floor, turn }: { model: ShipModel; ship: ShipClass; floor: number; turn: RefObject<Turntable> }) {
  const gltf = useLoader(GLTFLoader, model.url, loader => { shipDecoders(loader, model); });
  const root = useRef<THREE.Group>(null);
  const glow = useMemo(() => radial([[0, 'rgba(210,250,255,1)'], [0.25, 'rgba(110,220,255,.55)'], [1, 'rgba(40,120,255,0)']]), []);
  const born = useRef(-1);
  // The hull's lowest point in the model's own space, over the detail drawn.
  const minY = useMemo(() => {
    gltf.scene.traverse(node => { if (/^lod[1-9]/.test(node.name)) node.visible = false; });
    gltf.scene.updateMatrixWorld(true);
    const local = new THREE.Matrix4().copy(gltf.scene.matrixWorld).invert();
    const box = new THREE.Box3(); const part = new THREE.Box3();
    gltf.scene.traverseVisible(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const geometry: unknown = node.geometry;
      if (!(geometry instanceof THREE.BufferGeometry)) return;
      geometry.computeBoundingBox();
      if (!geometry.boundingBox) return;
      box.union(part.copy(geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(local, node.matrixWorld)));
    });
    return box.isEmpty() ? -0.25 : box.min.y;
  }, [gltf]);
  useEffect(() => { born.current = -1; }, [gltf]);
  useEffect(() => () => { glow.dispose(); }, [glow]);
  const length = LENGTH[ship];
  useFrame(({ clock }) => {
    const group = root.current; if (!group) return;
    const t = clock.elapsedTime;
    if (born.current < 0) born.current = t;
    // A new ship settles onto the pad: it drops in a little and grows to its size.
    const settle = easeOut((t - born.current) / 0.55);
    group.scale.setScalar(length * (0.82 + 0.18 * settle));
    group.position.y = restHeight(floor, minY, length) + (1 - settle) * 0.05 + Math.sin(t * 1.3) * length * TURN.breath;
    group.rotation.set(0, BAY.yaw + turn.current.yaw, Math.sin(t * 0.9) * 0.012);
  });
  return <group ref={root} position={[BAY.x, floor, BAY.z]}>
    <primitive object={gltf.scene} />
    {model.engines.map((at, i) => <sprite key={i} position={at} scale={model.nozzle * 7}>
      <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
    </sprite>)}
  </group>;
}

/** The ship's shadow on the deck and the pad's ring of light, with its burst when a level is bought. */
function Pad({ floor, ship, pulse, turn }: { floor: number; ship: ShipClass; pulse: number; turn: RefObject<Turntable> }) {
  const shadow = useMemo(() => radial([[0, 'rgba(0,0,0,.85)'], [0.55, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']]), []);
  const ring = useRef<THREE.Mesh>(null);
  const shade = useRef<THREE.Mesh>(null);
  const burst = useRef<THREE.Mesh>(null);
  const burstAt = useRef(-10);
  const seen = useRef(pulse);
  useEffect(() => () => { shadow.dispose(); }, [shadow]);
  const length = LENGTH[ship];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pulse !== seen.current) { seen.current = pulse; burstAt.current = t; }
    shade.current?.rotation.set(0, 0, BAY.yaw + turn.current.yaw);
    const halo = ring.current?.material;
    if (halo instanceof THREE.MeshBasicMaterial) halo.opacity = 0.1 + Math.sin(t * 1.2) * 0.025;
    const wave = burst.current; const k = (t - burstAt.current) / 1.1;
    if (wave && wave.material instanceof THREE.MeshBasicMaterial) {
      wave.visible = k >= 0 && k < 1;
      wave.scale.setScalar(1 + easeOut(k) * 1.8);
      wave.material.opacity = (1 - k) * 0.9;
    }
  });
  return <group position={[BAY.x, floor + 0.002, BAY.z]} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh ref={shade} scale={[length * 0.7, length * 1.05, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={shadow} transparent depthWrite={false} />
    </mesh>
    <mesh ref={ring} position={[0, 0, 0.001]}>
      <ringGeometry args={[length * 0.62, length * 0.635, 96]} />
      {/* A pad marking, not a glow: the bay's own light, faint. The teal wave is kept for a level bought. */}
      <meshBasicMaterial color="#b8c8e6" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
    <mesh ref={burst} position={[0, 0, 0.002]} visible={false}>
      <ringGeometry args={[length * 0.6, length * 0.68, 96]} />
      <meshBasicMaterial color="#9ffff0" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  </group>;
}

class ShipBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  override render(): ReactNode { return this.state.failed ? null : this.props.children; }
}

/** One room, baked once, for the metal to reflect. */
function Reflections() {
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    scene.environment = target.texture; scene.environmentIntensity = 0.55;
    return () => { scene.environment = null; target.dispose(); };
  }, [gl, scene]);
  return null;
}

/** Frames at a steady rate, faster under a hand, none while the page is hidden. */
function Frames({ turn }: { turn: RefObject<Turntable> }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    let id = 0; let last = 0;
    const tick = (at: number): void => {
      id = requestAnimationFrame(tick);
      if (document.hidden || at - last < 1000 / (turn.current.held ? HELD_FPS : IDLE_FPS) - 2) return;
      last = at; invalidate();
    };
    id = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(id); };
  }, [invalidate, turn]);
  return null;
}

/** The camera on the apron, at the turntable's tilt and distance, breathing a little sideways. */
function Rig({ target, turn }: { target: THREE.Vector3; turn: RefObject<Turntable> }) {
  const at = useMemo(() => new THREE.Spherical(), []);
  useFrame(({ camera, clock }, delta) => {
    const t = turn.current;
    stepTurntable(t, Math.min(delta, 0.1));
    at.set(t.distance, TURN.polar, AZIMUTH + Math.sin(clock.elapsedTime * 0.12) * 0.06);
    camera.position.setFromSpherical(at).add(target);
    camera.lookAt(target);
  });
  return null;
}

/**
 * `onLost`: the GPU took the bay's context back (a phone short of memory). The panel puts the ship
 * up flat instead; drawing on would only throw (EffectComposer on a lost context, S22 B2).
 */
export default function HangarStage({ ship, pulse, refs, onLost }: { ship: ShipClass; pulse: number; refs: boolean; onLost: () => void }) {
  const quality = useRenderQuality();
  const preset = QUALITY_PRESETS[quality];
  const [post] = useState(() => hangarPost(quality, matchMedia('(pointer: coarse)').matches));
  const turn = useRef<Turntable>(createTurntable());
  const hands = useRef(new Map<number, { x: number; y: number; at: number }>());
  const down = (event: ReactPointerEvent): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    hands.current.set(event.pointerId, { x: event.clientX, y: event.clientY, at: event.timeStamp });
    dragTurntable(turn.current, 0, 0);
  };
  const move = (event: ReactPointerEvent): void => {
    const hand = hands.current.get(event.pointerId); if (!hand) return;
    const others = [...hands.current.entries()].filter(([id]) => id !== event.pointerId);
    const other = others[0]?.[1];
    if (other) {
      // Two fingers: their spread is the zoom.
      const before = Math.hypot(hand.x - other.x, hand.y - other.y); const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before > 0 && after > 0) zoomTurntable(turn.current, before / after);
    } else {
      // Only the sideways part turns the ship; a finger's vertical move scrolls the sheet.
      dragTurntable(turn.current, event.clientX - hand.x, (event.timeStamp - hand.at) / 1000);
    }
    hands.current.set(event.pointerId, { x: event.clientX, y: event.clientY, at: event.timeStamp });
  };
  const up = (event: ReactPointerEvent): void => {
    hands.current.delete(event.pointerId);
    if (hands.current.size === 0) releaseTurntable(turn.current);
  };
  const wheel = (event: ReactWheelEvent): void => { zoomTurntable(turn.current, Math.exp(event.deltaY * 0.001)); };
  const models = useShipModels(refs);
  const [floor, setFloor] = useState<number | null>(null);
  const target = useMemo(() => new THREE.Vector3(BAY.x, (floor ?? -0.19) + LENGTH[ship] * 0.2, BAY.z), [floor, ship]);
  const model = models?.[ship];
  return <div className="hp-turn" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
  <Canvas frameloop="demand" camera={{ fov: 38, near: 0.005, far: 600 }} dpr={[1, preset.dprCap]}
    gl={{ antialias: !post, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => {
      gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05;
      gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); onLost(); }, { once: true });
    }}
    style={{ position: 'absolute', inset: 0 }}>
    <color attach="background" args={['#03060c']} />
    <ambientLight intensity={0.28} color="#b9d4ff" />
    <directionalLight position={[2.4, 2.6, 1.6]} intensity={2.3} color="#eef4ff" />
    <directionalLight position={[-1.5, 1.2, -2]} intensity={0.9} color="#7fb2ff" />
    <pointLight position={[-0.16, 0.06, 0]} intensity={0.5} distance={1.1} decay={2} color="#ffb36b" />
    <Sky />
    <Reflections />
    <Frames turn={turn} />
    <Rig target={target} turn={turn} />
    <Suspense fallback={null}>
      <Hangar onFloor={setFloor} post={post} />
      {floor !== null && <Pad floor={floor} ship={ship} pulse={pulse} turn={turn} />}
    </Suspense>
    {/* Its own boundary: a ship that cannot load leaves the bay standing (S22 B2). */}
    {floor !== null && model && <ShipBoundary key={ship}><Suspense fallback={null}>
      <Ship model={model} ship={ship} floor={floor} turn={turn} />
    </Suspense></ShipBoundary>}
    {post && <EffectComposer enableNormalPass={false} multisampling={preset.multisampling}>
      <Bloom ref={guardBloomRef} intensity={0.75} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur radius={0.7} levels={6} />
      <Vignette eskil={false} offset={0.26} darkness={0.7} />
    </EffectComposer>}
  </Canvas>
  {/* The vignette, drawn by the page when the pass is off: free. */}
  {!post && <i aria-hidden className="hp-vignette" />}
  </div>;
}
