import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { REVEAL_SECOND, SCENE_SECONDS, beatAt, endJump, revealJump, takeCues, type BeatId, type Jump } from '../starter/jump.js';
import { softGlow } from './Environment.js';
import { VESSEL_NOSE_TURN, vesselModelFile } from './mainSky.js';

/** The gap, in this scene's own units. The picture needs to read right, not to be to scale. */
const CENTRE = new THREE.Vector3(-150, 520, -3000);
const DISC_TILT = new THREE.Euler(0.8, 0, 0.2);
const GALAXY_SCALE = 0.1;
const DUST_RADIUS = 640;

const onDisc = (x: number, y: number, z: number, into: THREE.Vector3): THREE.Vector3 =>
  into.set(x, y, z).applyEuler(DISC_TILT).add(CENTRE);

const ADDRESS = onDisc(210, 0, 300, new THREE.Vector3());

const smooth = (from: number, to: number, value: number): number => {
  const k = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return k * k * (3 - 2 * k);
};

/** Where the ship stands at second `s`: barely moving, then the long fall across the gap. */
function shipAt(s: number, into: THREE.Vector3): THREE.Vector3 {
  const launch = smooth(4, 19, s);
  return into.copy(ADDRESS).multiplyScalar(launch * launch * (launch * 0.6 + 0.4));
}

const SHOT = new THREE.Vector3(), TARGET = new THREE.Vector3(), LOOK = new THREE.Vector3();
/** Out from the galaxy's heart through the new world, so the world stands with all of it behind. */
const OUTWARD = ADDRESS.clone().sub(CENTRE).normalize();

/**
 * The camera: at the hull while the drive lights, on the tail across the gap, then back from the new
 * world. A phone is tall, so the ship sits low and the galaxy fills the sky above it.
 */
function placeCamera(camera: THREE.Camera, s: number): void {
  shipAt(s, SHOT);
  const out = smooth(1, 6, s);
  const flight = smooth(6, 13, s);
  camera.position.set(
    SHOT.x + 0.85 - out * 0.1 - flight * 0.5,
    SHOT.y + 0.42 + out * 0.45 + flight * 0.8,
    SHOT.z + 3 + out * 1.6 + flight * 6.8,
  );
  LOOK.copy(SHOT);
  LOOK.y += 0.15 + out * 0.45 + flight * 0.9;
  LOOK.z -= 3 * out;
  if (s > 17) {
    const back = smooth(21, 25, s);
    const landed = smooth(17, 20.2, s);
    TARGET.copy(ADDRESS).addScaledVector(OUTWARD, 26 + back * 46);
    TARGET.y += 5 + back * 20;
    camera.position.lerp(TARGET, landed);
    TARGET.copy(ADDRESS);
    TARGET.y += 3.5 + back * 12;
    LOOK.lerp(TARGET, landed);
  }
  camera.lookAt(LOOK);
}

const POINT_VERTEX = /* glsl */`
  attribute float size; attribute vec3 tint; uniform float uFade; varying vec3 vTint;
  void main() {
    vTint = tint * uFade;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(size * 2400.0 / -view.z, 1.3, 9.0);
    gl_Position = projectionMatrix * view;
  }`;
const POINT_FRAGMENT = /* glsl */`
  varying vec3 vTint;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(vTint * a * a, a);
  }`;

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

interface Cloud { positions: Float32Array; tints: Float32Array; sizes: Float32Array }

/** Real worlds where the client holds them, and always the arms of dust around them. */
function galaxyCloud(sky: readonly number[]): Cloud {
  const random = seeded(48271);
  const worlds = Math.floor(sky.length / 3);
  const dust = 7000;
  const positions = new Float32Array((worlds + dust) * 3), tints = new Float32Array((worlds + dust) * 3), sizes = new Float32Array(worlds + dust);
  const warm = new THREE.Color('#ffd9a6'), cool = new THREE.Color('#7fb4ff'), white = new THREE.Color('#ffffff'), mix = new THREE.Color(), place = new THREE.Vector3();
  for (let i = 0; i < worlds; i++) {
    onDisc(sky[i * 3]! * GALAXY_SCALE, sky[i * 3 + 1]! * GALAXY_SCALE, sky[i * 3 + 2]! * GALAXY_SCALE, place).toArray(positions, i * 3);
    white.toArray(tints, i * 3);
    sizes[i] = 2.6;
  }
  for (let i = worlds; i < worlds + dust; i++) {
    const r = Math.pow(random(), 0.62) * DUST_RADIUS;
    const arm = Math.floor(random() * 3);
    const a = (arm * Math.PI * 2) / 3 + r * 0.0088 + (random() - 0.5) * (0.42 + 150 / (r + 50));
    onDisc(Math.cos(a) * r, (random() - 0.5) * (24 + 90 * Math.exp(-r / 110)), Math.sin(a) * r, place).toArray(positions, i * 3);
    mix.copy(warm).lerp(cool, Math.min(1, r / 420)).multiplyScalar(0.9 + random() * 1.1);
    mix.toArray(tints, i * 3);
    sizes[i] = 1 + random() * 3.2;
  }
  return { positions, tints, sizes };
}

function starCloud(): Cloud {
  const random = seeded(16807);
  const count = 2600;
  const positions = new Float32Array(count * 3), tints = new Float32Array(count * 3), sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize().multiplyScalar(5200 + random() * 900);
    v.toArray(positions, i * 3);
    const shade = 0.4 + random() * 0.6;
    new THREE.Color(shade, shade, Math.min(1, shade * 1.14)).toArray(tints, i * 3);
    sizes[i] = 2 + random() * 5;
  }
  return { positions, tints, sizes };
}

function Points({ cloud, fade = 1 }: { cloud: Cloud; fade?: number }) {
  const geometry = useMemo(() => {
    const made = new THREE.BufferGeometry();
    made.setAttribute('position', new THREE.BufferAttribute(cloud.positions, 3));
    made.setAttribute('tint', new THREE.BufferAttribute(cloud.tints, 3));
    made.setAttribute('size', new THREE.BufferAttribute(cloud.sizes, 1));
    return made;
  }, [cloud]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: POINT_VERTEX, fragmentShader: POINT_FRAGMENT, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, uniforms: { uFade: { value: fade } },
  }), [fade]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/** Stars streaking past as the drive opens up: one draw call, and it is what sells the speed. */
function Streaks({ clock }: { clock: React.RefObject<number> }) {
  const count = 340;
  const seeds = useMemo(() => {
    const random = seeded(7);
    return Array.from({ length: count }, () => [(random() - 0.5) * 90, (random() - 0.5) * 60, random() * 260]);
  }, []);
  const geometry = useMemo(() => {
    const made = new THREE.BufferGeometry();
    made.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    return made;
  }, []);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#a8ccff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(() => {
    const s = clock.current;
    const power = smooth(7, 12, s) * (1 - smooth(16, 18.5, s));
    material.opacity = power * 0.5;
    if (power <= 0) return;
    const at = shipAt(s, SHOT);
    const attribute = geometry.getAttribute('position');
    if (!(attribute instanceof THREE.BufferAttribute)) return;
    const array = attribute.array;
    for (let i = 0; i < count; i++) {
      const [x, y, offset] = seeds[i]!;
      const z = ((offset! + s * 420) % 260) - 130;
      const length = 4 + power * 34;
      array[i * 6] = at.x + x!; array[i * 6 + 1] = at.y + y!; array[i * 6 + 2] = at.z - z;
      array[i * 6 + 3] = at.x + x!; array[i * 6 + 4] = at.y + y!; array[i * 6 + 5] = at.z - z - length;
    }
    attribute.needsUpdate = true;
  });
  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />;
}

function Hull({ file }: { file: string }) {
  const gltf = useLoader(GLTFLoader, file, loader => { loader.setMeshoptDecoder(MeshoptDecoder); });
  return <primitive object={gltf.scene} />;
}

function Ship({ jump, clock }: { jump: Jump; clock: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Sprite>(null);
  const ember = useRef<THREE.Sprite>(null);
  const file = vesselModelFile(jump.hull, jump.look);
  useFrame(() => {
    const s = clock.current;
    const ship = group.current;
    if (!ship) return;
    shipAt(s, ship.position);
    ship.lookAt(ADDRESS);
    // Spent on the way in: it burns up where the new world forms.
    const spent = smooth(20, 21.2, s);
    ship.visible = spent < 1;
    ship.scale.setScalar(1.6 * (1 - spent * 0.7));
    const thrust = smooth(0.5, 4.5, s) * 0.8 + smooth(5, 10, s) * 1.2;
    const pulse = 1 + Math.sin(s * 37) * 0.06;
    if (glow.current) {
      glow.current.scale.setScalar((0.1 + thrust * 0.26) * pulse);
      glow.current.material.opacity = Math.min(1, thrust * 1.2);
    }
    if (ember.current) {
      ember.current.scale.setScalar((0.04 + thrust * 0.09) * pulse);
      ember.current.material.opacity = Math.min(1, thrust * 1.4);
    }
  });
  return (
    <group ref={group}>
      <group rotation={[0, VESSEL_NOSE_TURN, 0]}><Suspense fallback={null}><Hull file={file} /></Suspense></group>
      <sprite ref={glow} position={[0, 0, -0.74]}>
        <spriteMaterial map={softGlow()} color="#6db4ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </sprite>
      <sprite ref={ember} position={[0, 0, -0.66]}>
        <spriteMaterial map={softGlow()} color="#e8f6ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </sprite>
    </group>
  );
}

const TRAIL_POINTS = 90;

/** The ship's own wake: its last positions, fading. It lets the eye feel how far it has come. */
function Trail({ clock }: { clock: React.RefObject<number> }) {
  const geometry = useMemo(() => {
    const made = new THREE.BufferGeometry();
    made.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
    const colours = new Float32Array(TRAIL_POINTS * 3);
    const blue = new THREE.Color('#6db4ff');
    for (let i = 0; i < TRAIL_POINTS; i++) blue.clone().multiplyScalar(Math.pow(1 - i / TRAIL_POINTS, 2)).toArray(colours, i * 3);
    made.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return made;
  }, []);
  const material = useMemo(() => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(() => {
    const s = clock.current;
    const attribute = geometry.getAttribute('position');
    if (!(attribute instanceof THREE.BufferAttribute)) return;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      shipAt(Math.max(0, s - i * 0.045), SHOT);
      SHOT.toArray(attribute.array, i * 3);
    }
    attribute.needsUpdate = true;
    line.visible = s > 4.5 && s < 21;
  });
  return <primitive object={line} frustumCulled={false} />;
}

const WORLD_VERTEX = /* glsl */`
  varying vec3 vNormal; varying vec3 vWorld; varying vec3 vObject;
  void main() {
    vObject = normalize(position);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const WORLD_FRAGMENT = /* glsl */`
  uniform float uForm; varying vec3 vNormal; varying vec3 vWorld; varying vec3 vObject;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    float land = noise(vObject * 3.0) * 0.6 + noise(vObject * 7.0) * 0.3 + noise(vObject * 17.0) * 0.1;
    vec3 ground = mix(vec3(0.06, 0.2, 0.42), mix(vec3(0.28, 0.42, 0.2), vec3(0.7, 0.62, 0.45), land), smoothstep(0.46, 0.56, land));
    vec3 light = normalize(vec3(0.5, 0.5, 0.7));
    float sun = max(dot(vNormal, light), 0.0);
    vec3 eye = normalize(cameraPosition - vWorld);
    float rim = pow(1.0 - max(dot(vNormal, eye), 0.0), 3.0);
    // It forms from fire: molten first, its ground showing through as it cools.
    float cool = smoothstep(0.35, 1.0, uForm);
    vec3 molten = mix(vec3(1.0, 0.75, 0.35), vec3(1.0, 0.3, 0.08), land) * (1.4 - land * 0.5);
    vec3 surface = mix(molten, ground * (0.08 + sun * 1.2), cool);
    gl_FragColor = vec4(surface + rim * vec3(0.35, 0.65, 1.0) * (0.3 + cool), 1.0);
  }`;

/** The new world, out of the flash. Its address is real; the picture is only for this moment. */
function NewWorld({ clock }: { clock: React.RefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);
  const material = useMemo(() => new THREE.ShaderMaterial({ vertexShader: WORLD_VERTEX, fragmentShader: WORLD_FRAGMENT, uniforms: { uForm: { value: 0 } } }), []);
  useEffect(() => () => { material.dispose(); }, [material]);
  useFrame(() => {
    const s = clock.current;
    const form = smooth(20.6, 24, s);
    const uForm = material.uniforms.uForm;
    if (uForm) uForm.value = form;
    if (mesh.current) {
      mesh.current.visible = form > 0;
      mesh.current.scale.setScalar(0.1 + 4.6 * smooth(20.6, 22.4, s));
      mesh.current.rotation.y = s * 0.06;
    }
    if (halo.current) {
      halo.current.visible = form > 0;
      halo.current.scale.setScalar(13 + 8 * form);
      halo.current.material.opacity = 0.45 + (1 - form) * 0.5;
    }
  });
  return (
    <group position={ADDRESS.toArray()}>
      <sprite ref={halo}><spriteMaterial map={softGlow()} color="#7fb4ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <mesh ref={mesh} material={material}><sphereGeometry args={[1, 48, 32]} /></mesh>
    </group>
  );
}

function Stage({ jump, clock }: { jump: Jump; clock: React.RefObject<number> }) {
  const { camera } = useThree();
  const galaxy = useMemo(() => galaxyCloud(jump.sky), [jump.sky]);
  const stars = useMemo(starCloud, []);
  const core = useRef<THREE.SpriteMaterial>(null);
  const haze = useRef<THREE.SpriteMaterial>(null);
  useFrame(() => {
    const s = clock.current;
    placeCamera(camera, s);
    // A glow that reads as a galaxy from across the gap would be fog from inside it.
    const inside = 1 - smooth(11, 17, s) * 0.92;
    if (core.current) core.current.opacity = 0.75 * inside;
    if (haze.current) haze.current.opacity = 0.16 * inside;
  });
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 6]} intensity={2.1} color="#fff1df" />
      <directionalLight position={[-4, -1, -6]} intensity={0.8} color="#7fb4ff" />
      <Points cloud={stars} />
      <Points cloud={galaxy} />
      <sprite position={CENTRE.toArray()} scale={360}>
        <spriteMaterial ref={core} map={softGlow()} color="#ffd7a8" opacity={0.75} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={CENTRE.toArray()} scale={1450}>
        <spriteMaterial ref={haze} map={softGlow()} color="#3a68c8" opacity={0.16} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <Streaks clock={clock} />
      <Trail clock={clock} />
      <Ship jump={jump} clock={clock} />
      <NewWorld clock={clock} />
    </>
  );
}

/**
 * THE MOMENT THE WHOLE GALAXY WAS FOR. Plan §3.8. The result is already on the server: this only
 * shows it, and the session moves to the planet underneath before the last beat, so the fade lands
 * on the real, live galaxy.
 */
export function MigrationSequence({ jump }: { jump: Jump }) {
  const { t } = useTranslation();
  const clock = useRef(jump.start);
  const flash = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const [beat, setBeat] = useState<BeatId>(beatAt(jump.start).id);
  useEffect(() => {
    let frame = 0;
    const run = (at: number): void => {
      const s = (at - jump.origin) / 1000;
      clock.current = s;
      setBeat(beatAt(s).id);
      for (const cue of takeCues(s)) {
        playSound(cue.sound, cue.seconds === undefined ? {} : { seconds: cue.seconds });
        haptic(cue.haptic);
      }
      // The ship gives itself up in one burst of light.
      if (flash.current) flash.current.style.opacity = String(smooth(20, 20.9, s) * (1 - smooth(20.9, 22.4, s)));
      if (veil.current) veil.current.style.opacity = String(Math.max(1 - smooth(jump.start, jump.start + 0.8, s), smooth(SCENE_SECONDS - 0.7, SCENE_SECONDS, s)));
      if (s >= REVEAL_SECOND) revealJump();
      if (s >= SCENE_SECONDS) { endJump(); return; }
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => { cancelAnimationFrame(frame); };
  }, [jump.origin, jump.start]);
  // Above the loading cover (z 1000): the planet loads under the scene's last beats, and its cover showed
  // instead of the flash and the new world (playtest 2026-11-09). Still loading at the end, it shows then.
  return (
    <div data-testid="migration-sequence" className="fixed inset-0 z-[1001] overflow-hidden bg-[#02040a] font-v2-ui">
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 42, near: 0.1, far: 12000, position: [3, 1, 4] }}>
        <Stage jump={jump} clock={clock} />
      </Canvas>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,.55))]" />
      <div ref={flash} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#fff6e6] opacity-0" />
      <div ref={veil} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#02040a]" />
      <style>{'@keyframes jump-caption{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'}</style>
      <p key={beat} role="status" style={{ animation: 'jump-caption .9s ease-out' }} className="pointer-events-none absolute inset-x-6 bottom-[14%] text-center text-title font-medium tracking-wide text-white [text-shadow:0_2px_12px_#000]">
        {t(`starter.jump.scene.${beat}`, { name: jump.shardName })}
      </p>
      {jump.replay && (
        <button type="button" onClick={endJump} className="absolute right-3 top-[calc(env(safe-area-inset-top)+12px)] min-h-9 rounded-control border border-white/30 bg-black/40 px-3 text-caption text-white">
          {t('starter.jump.skip')}
        </button>
      )}
    </div>
  );
}
