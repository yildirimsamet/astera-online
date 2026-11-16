import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { labAge } from './clock.js';
import { EngineFlameBatch, ENGINE_FLAME_NOISE_URL, ENGINE_FLAME_VARIANTS } from '../../vfx/engineFlames.js';

/*
  PROTOTYPE (vfx lab, 2026-11-12) — three engine characters built from the library, to stand beside
  today's four (solar, cryo, vacuum, siege): a rocket's shock diamonds from the Space Combat Kit's
  exhaust masks, the kit's own short fighter jet and an ion drive's thin core with
  a long turbulent wake. Each is two crossed quads and a halo — three draws a nozzle, batchable.
*/

const NOISE = '/assets/vfx/lab/sck-exhauststream.webp';
const HALO = '/assets/vfx/library/sck-exhaust-halo.webp';
const WAKE = '/assets/vfx/lab/sck-exhaust-trail2.webp';
const JET = '/assets/vfx/lab/sck-exhaust-jet.webp';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = /* glsl */`
  uniform float uT; uniform int uKind; uniform sampler2D uNoise; uniform sampler2D uWake; uniform sampler2D uJet;
  varying vec2 vUv;
  const float TAU = 6.28318530718;
  void main() {
    float x = vUv.x;
    float y = (vUv.y - 0.5) * 2.0;
    vec3 colour = vec3(0.0);
    if (uKind == 0) {
      // Shock diamonds: a white-hot core, an orange sheath that flickers, bright nodes down the jet.
      float width = mix(0.42, 0.6, sqrt(x));
      float n = texture2D(uNoise, vec2(x * 1.4 - uT * 2.4, vUv.y * 0.9 + uT * 0.3)).r;
      float n2 = texture2D(uNoise, vec2(x * 3.1 - uT * 4.1, vUv.y * 2.2 - uT * 0.5)).r;
      float wob = (n2 - 0.5) * 0.25 * x;
      float core = exp(-(((y + wob) / (mix(0.3, 0.12, x))) * ((y + wob) / (mix(0.3, 0.12, x))))) * pow(max(1.0 - x, 0.0), 1.6);
      float sheath = exp(-(((y + wob) / width) * ((y + wob) / width))) * pow(max(1.0 - x, 0.0), 1.2) * (0.35 + 0.9 * n);
      float diamond = pow(max(0.5 + 0.5 * cos(x * TAU * 5.0 - 0.6), 0.0), 10.0) * (1.0 - smoothstep(0.0, 0.62, x));
      float nodes = diamond * exp(-((y / mix(0.26, 0.1, x)) * (y / mix(0.26, 0.1, x))));
      float flicker = 0.93 + 0.07 * sin(uT * 57.0);
      colour = (vec3(1.0, 0.95, 0.86) * core * 1.2 + vec3(1.0, 0.45, 0.14) * sheath * 1.0 + vec3(0.6, 0.75, 1.0) * nodes * 1.6) * flicker;
    } else if (uKind == 1) {
      // Fighter jet (Space Combat Kit): the kit's soft teardrop mask, a white core inside a violet
      // body, throbbing with the throttle — short, bright, readable from far away.
      float throb = 0.9 + 0.1 * sin(uT * 31.0) * sin(uT * 7.3);
      float body = texture2D(uJet, vec2(min(x * 0.75 * throb, 0.99), 0.5 + y * 0.42)).a;
      float inner = texture2D(uJet, vec2(min(x * 1.6 * throb, 0.99), 0.5 + y * 0.9)).a;
      float n = texture2D(uNoise, vec2(x * 2.0 - uT * 3.0, vUv.y)).r;
      colour = vec3(0.55, 0.35, 1.0) * body * (0.7 + 0.5 * n) + vec3(0.95, 0.92, 1.0) * inner * 1.3;
    } else {
      // Ion drive: a needle of blue-white light and a long, slow, turbulent wake.
      float core = exp(-((y / mix(0.2, 0.1, x)) * (y / mix(0.2, 0.1, x)))) * pow(max(1.0 - x, 0.0), 0.8);
      float wake = texture2D(uWake, vec2(fract(x * 0.9 - uT * 0.55), 0.5 + (vUv.y - 0.5) * 0.8)).r * exp(-((y / mix(0.45, 0.8, x)) * (y / mix(0.45, 0.8, x)))) * pow(max(1.0 - x, 0.0), 0.9);
      float pulse = 0.82 + 0.18 * sin(uT * 9.0 - x * 30.0);
      colour = vec3(0.78, 0.93, 1.0) * core * 1.5 * pulse + vec3(0.22, 0.55, 1.0) * wake * 1.1;
    }
    // Fade every edge of the card so its rectangle never shows.
    float frame = (1.0 - smoothstep(0.7, 1.0, abs(y))) * smoothstep(0.0, 0.03, x) * (1.0 - smoothstep(0.85, 1.0, x));
    gl_FragColor = vec4(colour * frame, 1.0);
  }`;

const KINDS = [
  { kind: 0, length: 3.6, width: 1.3, halo: '#ffd2a0', label: 'mach' },
  { kind: 1, length: 2.6, width: 1.1, halo: '#c9b4ff', label: 'jet' },
  { kind: 2, length: 3.6, width: 1.3, halo: '#a8d4ff', label: 'ion' },
] as const;

function Nozzle() {
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2e3946', metalness: 0.72, roughness: 0.36 }), []);
  const lip = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a1a9ad', metalness: 0.78, roughness: 0.3 }), []);
  useEffect(() => () => { metal.dispose(); lip.dispose(); }, [metal, lip]);
  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh material={metal} position={[0, -0.35, 0]}><cylinderGeometry args={[0.22, 0.13, 0.7, 24, 1, true]} /></mesh>
      {([[0, 0.22], [-0.12, 0.205], [-0.62, 0.145]] as const).map(([y, r]) => (
        <mesh key={y} material={lip} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r, 0.018, 6, 24]} /></mesh>
      ))}
    </group>
  );
}

function Thruster({ start, kind, length, width, halo, maps }: { start: number; kind: number; length: number; width: number; halo: string; maps: THREE.Texture[] }) {
  const [noise, wake, jet, haloMap] = maps;
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uT: { value: 0 }, uKind: { value: kind }, uNoise: { value: noise }, uWake: { value: wake }, uJet: { value: jet } },
  }), [kind, noise, wake, jet]);
  useEffect(() => () => { material.dispose(); }, [material]);
  const glow = useRef<THREE.Sprite>(null);
  useFrame(() => {
    const t = labAge(start);
    material.uniforms.uT!.value = t;
    if (glow.current) glow.current.material.opacity = 0.75 + 0.25 * Math.sin(t * 23 + kind);
  });
  return (
    <group>
      <group scale={1.27}><Nozzle /></group>
      <group position={[length / 2, 0, 0]}>
        <mesh material={material} scale={[length, width, 1]}><planeGeometry args={[1, 1]} /></mesh>
        <mesh material={material} scale={[length, width, 1]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[1, 1]} /></mesh>
      </group>
      <sprite ref={glow} position={[0.05, 0, 0]} scale={[1.1, 1.1, 1]}>
        <spriteMaterial map={haloMap} color={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}

/** Today's four characters, through the game's own batch, framed like the prototypes. */
function TodayEngines({ start }: { start: number }) {
  const noise = useTexture(ENGINE_FLAME_NOISE_URL);
  const batch = useMemo(() => {
    noise.wrapS = noise.wrapT = THREE.RepeatWrapping; noise.colorSpace = THREE.NoColorSpace; noise.needsUpdate = true;
    const flames = new EngineFlameBatch(noise, { capacity: 4 });
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
    ENGINE_FLAME_VARIANTS.forEach((variant, i) => {
      flames.set(i, { variant, matrix: new THREE.Matrix4().compose(new THREE.Vector3(0, 1.8 - i * 1.2, 0), turn, new THREE.Vector3(1, 1, 1)),
        length: 3.6, nozzleRadius: i === 2 ? 0.22 : 0.28, throttle: 1, seed: i * 17.13 });
    });
    return flames;
  }, [noise]);
  useEffect(() => () => { batch.dispose(); }, [batch]);
  useFrame(() => { batch.update(Math.max(0, labAge(start))); });
  return (
    <group>
      {ENGINE_FLAME_VARIANTS.map((variant, i) => <group key={variant} position={[0, 1.8 - i * 1.2, 0]} scale={1.27}><Nozzle /></group>)}
      <primitive object={batch.mesh} />
    </group>
  );
}

export function EngineLab({ start, variant }: { start: number; variant: 'now' | 'lab' }) {
  return (
    <group position={[-1.0, 0, 0]}>
      <ambientLight intensity={1.4} />
      {variant === 'now' ? <TodayEngines start={start} /> : <ThrusterLab start={start} />}
    </group>
  );
}

function ThrusterLab({ start }: { start: number }) {
  const maps = useTexture([NOISE, WAKE, JET, HALO]);
  useMemo(() => {
    for (const map of maps) { map.wrapS = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.generateMipmaps = false; map.minFilter = THREE.LinearFilter; map.needsUpdate = true; }
  }, [maps]);
  return (
    <group>
      {KINDS.map((k, i) => (
        <group key={k.label} position={[0, 1.4 - i * 1.4, 0]}>
          <Thruster start={start} kind={k.kind} length={k.length} width={k.width} halo={k.halo} maps={maps} />
        </group>
      ))}
    </group>
  );
}
