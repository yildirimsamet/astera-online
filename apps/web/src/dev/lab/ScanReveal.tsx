import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { labAge } from './clock.js';
import { scanFrame, SCAN_LOCKS } from './scan.js';

/*
  PROTOTYPE (vfx lab, 2026-11-12) — the moment the telescope finds out who holds a hidden world. A
  wave leaves home across the plane, a band of instrument light sweeps the world top to bottom and
  leaves a grid behind, a reticle (Sci-Fi Pack circle outlines) closes and locks, and the world lights
  in its holder's colour. Owned worlds are hidden until found: this is the payoff of curiosity.
*/

const RETICLE = '/assets/vfx/library/circles-outlines-2x2.webp';
const INSTRUMENT = new THREE.Color('#8fd0ff');
const RIVAL = new THREE.Color('#ff7a45');

const SHELL_VERT = /* glsl */`
  varying vec3 vDir; varying vec3 vNormal; varying vec3 vView;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const SWEEP_FRAG = /* glsl */`
  uniform float uSweep; uniform float uBand; uniform float uGrid; uniform vec3 uColour;
  varying vec3 vDir; varying vec3 vNormal; varying vec3 vView;
  void main() {
    float rim = ((1.0 - max(0.0, dot(vNormal, vView))) * (1.0 - max(0.0, dot(vNormal, vView))));
    float y = vDir.y;
    float band = exp(-(((y - uSweep) / 0.03) * ((y - uSweep) / 0.03))) * 1.6 + exp(-(((y - uSweep) / 0.12) * ((y - uSweep) / 0.12))) * 0.35;
    float lat = asin(clamp(y, -1.0, 1.0)) * 18.0 / 3.14159265;
    float lon = atan(vDir.z, vDir.x) * 24.0 / 6.28318530;
    float lines = max((1.0 - smoothstep(0.0, 0.08, abs(fract(lat) - 0.5) - 0.42)), (1.0 - smoothstep(0.0, 0.08, abs(fract(lon) - 0.5) - 0.42)));
    float behind = smoothstep(uSweep - 0.02, uSweep + 0.25, y);
    float grid = lines * behind * uGrid * (0.35 + 0.65 * rim);
    gl_FragColor = vec4(uColour * (band * uBand + grid * 0.55 + rim * 0.15 * uBand), 1.0);
  }`;
const REVEAL_FRAG = /* glsl */`
  uniform float uReveal; uniform float uFlash; uniform vec3 uColour;
  varying vec3 vDir; varying vec3 vNormal; varying vec3 vView;
  void main() {
    float rim = pow(max(1.0 - max(0.0, dot(vNormal, vView)), 0.0), 2.6);
    gl_FragColor = vec4(uColour * (rim * 1.4 * uReveal + uFlash * (0.25 + rim)), 1.0);
  }`;
const WAVE_VERT = 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const WAVE_FRAG = /* glsl */`
  uniform float uAlpha; uniform vec3 uColour; varying vec2 vP;
  void main() {
    float d = length(vP);
    float ring = exp(-(((d - 0.985) / 0.006) * ((d - 0.985) / 0.006))) + 0.35 * exp(-(((d - 0.96) / 0.04) * ((d - 0.96) / 0.04))) * step(d, 1.0);
    gl_FragColor = vec4(uColour * ring * uAlpha, 1.0);
  }`;

export function ScanReveal({ start, radius }: { start: number; radius: number }) {
  const R = radius;
  const home = useMemo(() => new THREE.Vector3(-7 * R, -0.25 * R, -3 * R), [R]);
  const reach = home.length();
  const reticleMap = useTexture(RETICLE);
  const maps = useMemo(() => [0, 2].map((cell) => {
    const map = reticleMap.clone(); map.colorSpace = THREE.SRGBColorSpace; map.repeat.set(0.5, 0.5);
    map.offset.set((cell % 2) * 0.5, cell < 2 ? 0.5 : 0); map.needsUpdate = true; return map;
  }), [reticleMap]);
  const shell = useMemo(() => new THREE.SphereGeometry(1, 64, 48), []);
  const sweep = useMemo(() => new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: SWEEP_FRAG, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uSweep: { value: 1 }, uBand: { value: 0 }, uGrid: { value: 0 }, uColour: { value: INSTRUMENT } } }), []);
  const reveal = useMemo(() => new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: REVEAL_FRAG, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uReveal: { value: 0 }, uFlash: { value: 0 }, uColour: { value: RIVAL } } }), []);
  const wave = useMemo(() => new THREE.ShaderMaterial({ vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, uniforms: { uAlpha: { value: 0 }, uColour: { value: INSTRUMENT } } }), []);
  const reticleMaterials = useMemo(() => maps.map((map) => new THREE.MeshBasicMaterial({ map, color: INSTRUMENT, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false })), [maps]);
  useEffect(() => () => {
    shell.dispose(); sweep.dispose(); reveal.dispose(); wave.dispose();
    for (const m of reticleMaterials) m.dispose();
    for (const map of maps) map.dispose();
  }, [shell, sweep, reveal, wave, reticleMaterials, maps]);

  const waveMesh = useRef<THREE.Mesh>(null);
  const collar = useRef<THREE.Mesh>(null);
  const reticles = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    const t = labAge(start);
    const f = scanFrame(t);
    sweep.uniforms.uSweep!.value = f.sweep;
    sweep.uniforms.uBand!.value = f.band;
    sweep.uniforms.uGrid!.value = f.grid;
    reveal.uniforms.uReveal!.value = f.reveal;
    reveal.uniforms.uFlash!.value = t >= SCAN_LOCKS ? Math.max(0, 1 - (t - SCAN_LOCKS) / 0.35) ** 2 : 0;
    if (waveMesh.current) {
      waveMesh.current.scale.setScalar(Math.max(0.001, reach * f.wave));
      wave.uniforms.uAlpha!.value = f.wave > 0 ? Math.min(1, f.wave * 4) * Math.max(0, 1 - Math.max(0, f.wave - 1) / 0.5) : 0;
    }
    if (collar.current) {
      // The band's edge, a little proud of the world, so the sweep reads as a scanner's line.
      const s = Math.max(-0.999, Math.min(0.999, f.sweep));
      collar.current.position.y = s * R * 1.012;
      collar.current.scale.setScalar(Math.sqrt(1 - s * s) * R * 1.035);
      (collar.current.material as THREE.MeshBasicMaterial).opacity = f.band;
    }
    if (reticles.current) {
      reticles.current.quaternion.copy(camera.quaternion);
      reticles.current.children.forEach((child, i) => {
        child.rotation.z = (i === 0 ? 1 : -1.4) * t * 0.6;
        child.scale.setScalar(R * 2 * f.reticleSize * (i === 0 ? 1 : 1.18));
      });
      for (const m of reticleMaterials) m.opacity = f.reticle;
    }
  });

  return (
    <group>
      <mesh ref={waveMesh} position={home} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} material={wave}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <mesh geometry={shell} material={sweep} scale={R * 1.012} renderOrder={2} />
      <mesh geometry={shell} material={reveal} scale={R * 1.03} renderOrder={2} />
      <mesh ref={collar} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.985, 1, 96]} />
        <meshBasicMaterial color={INSTRUMENT} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <group ref={reticles} renderOrder={4}>
        {reticleMaterials.map((m, i) => <mesh key={i} material={m}><planeGeometry args={[1, 1]} /></mesh>)}
      </group>
    </group>
  );
}
