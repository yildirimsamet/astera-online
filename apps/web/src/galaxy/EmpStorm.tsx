import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { atlasBatch } from './StrategicBlast.jsx';
import { EMP_ARC, EMP_BOLT, empBrownout, empSlot, empStormReach, empStormStrength } from './empSchedule.js';
import { screenPixels } from './publicMoments.js';
import { createRehearsal, type Rehearsal } from './rehearsal.js';
import type { Vec3Tuple } from './scene.js';
import { serverNow } from '../lib/clock.js';

/*
  A WORLD UNDER EMP, FOR ITS HOUR (owner approved the storm, 2026-11-12). On top of the red ember
  and fissures: arcs crawling over the face, bolts leaping off the limb, a charged rim that flickers,
  ions drifting close over the surface and the world's light stuttering like a failing grid. Five
  draws, only while the world is large enough on screen to read them (`empStormReach`); from afar the
  ember says it. It draws each part once, unseen, when it mounts (`createRehearsal`), so the first
  frame that shows it only draws.
*/

const ARCS = 4;
const BOLTS = 2;
const IONS = 80;
const ARC_SECONDS = 0.55;
const BOLT_SECONDS = 0.32;
/** The shaders' own clock wraps, so their noise keeps float precision through the whole hour. */
const SHADER_WRAP = 120;

const RIM_VERT = /* glsl */`
  varying vec3 vNormal; varying vec3 vView; varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const RIM_FRAG = /* glsl */`
  uniform float uT; uniform float uFlick;
  varying vec3 vNormal; varying vec3 vView; varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    float rim = pow(max(1.0 - max(0.0, dot(vNormal, vView)), 0.0), 2.6);
    float crawl = noise(vDir * 7.0 + vec3(uT * 0.9, uT * 1.7, -uT * 0.6));
    float filament = smoothstep(0.62, 0.9, crawl) * (0.6 + 0.4 * noise(vDir * 31.0 + uT * 4.0));
    gl_FragColor = vec4(vec3(0.42, 0.74, 1.0) * rim * (0.32 + 1.5 * filament) * uFlick, 1.0);
  }`;
const DIM_FRAG = /* glsl */`uniform float uDim; void main() { gl_FragColor = vec4(0.0, 0.0, 0.02, uDim); }`;
const PLAIN_VERT = /* glsl */`void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ION_VERT = /* glsl */`
  attribute vec4 aSeed; uniform float uT; uniform float uPx; uniform float uRef;
  varying float vGlow;
  void main() {
    float spin = uT * (0.05 + 0.12 * aSeed.w) * (aSeed.z > 0.5 ? 1.0 : -1.0);
    vec3 p = position; float c = cos(spin), s = sin(spin);
    p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vGlow = pow(max(0.5 + 0.5 * sin(uT * (6.0 + 9.0 * aSeed.x) + aSeed.y * 40.0), 0.0), 16.0);
    gl_PointSize = uPx * (0.6 + 0.8 * aSeed.z) * uRef / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const ION_FRAG = /* glsl */`
  uniform float uOn; varying float vGlow;
  void main() { float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)); gl_FragColor = vec4(vec3(0.62, 0.86, 1.0) * a * vGlow * 1.6 * uOn, 1.0); }`;

/**
 * A storm that never shows: it draws itself once, unseen, while a strike is in flight, so the GPU has
 * its art and programs before the storm takes over from the crater. The first storm of a session
 * froze 84 ms as it took over without it (S22, 2026-11-13).
 */
export function EmpStormWarmup({ position, radius }: { position: Vec3Tuple; radius: number }) {
  return <EmpStorm position={position} radius={radius} since={0} until={0} />;
}

/** `radius` is the world as drawn; `since`/`until` bound its storm in server milliseconds. */
export function EmpStorm({ position, radius, since, until }: { position: Vec3Tuple; radius: number; since: number; until: number }) {
  const [arcMap, boltMap] = useTexture([EMP_ARC, EMP_BOLT]);
  const arcs = useMemo(() => atlasBatch(arcMap!, ARCS, true, 4, 4, true), [arcMap]);
  const bolts = useMemo(() => atlasBatch(boltMap!, BOLTS, true, 5, 5, true), [boltMap]);
  const shell = useMemo(() => new THREE.SphereGeometry(1, 64, 48), []);
  // Every part starts at zero, so its rehearsal draws nothing.
  const rim = useMemo(() => new THREE.ShaderMaterial({ vertexShader: RIM_VERT, fragmentShader: RIM_FRAG,
    uniforms: { uT: { value: 0 }, uFlick: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const dim = useMemo(() => new THREE.ShaderMaterial({ vertexShader: PLAIN_VERT, fragmentShader: DIM_FRAG,
    uniforms: { uDim: { value: 0 } }, transparent: true, depthWrite: false }), []);
  const ions = useMemo(() => {
    let seed = 99;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const points = new Float32Array(IONS * 3);
    const seeds = new Float32Array(IONS * 4).map(() => random());
    for (let i = 0; i < IONS; i++) {
      const z = random() * 2 - 1, a = random() * Math.PI * 2, s = Math.sqrt(1 - z * z), r = radius * (1.03 + 0.14 * random());
      points.set([Math.cos(a) * s * r, z * r, Math.sin(a) * s * r], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const material = new THREE.ShaderMaterial({ vertexShader: ION_VERT, fragmentShader: ION_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uOn: { value: 0 }, uPx: { value: 3.2 }, uRef: { value: radius * 6.3 } } });
    return { geometry, material };
  }, [radius]);
  useEffect(() => () => {
    for (const batch of [arcs, bolts]) { batch.geometry.dispose(); batch.material.dispose(); }
    shell.dispose(); rim.dispose(); dim.dispose(); ions.geometry.dispose(); ions.material.dispose();
  }, [arcs, bolts, shell, rim, dim, ions]);

  const root = useRef<THREE.Group>(null);
  const rehearsal = useRef<Rehearsal | null>(null);
  const arcMesh = useRef<THREE.InstancedMesh>(null);
  const boltMesh = useRef<THREE.InstancedMesh>(null);
  const centre = useMemo(() => new THREE.Vector3(...position), [position]);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const view = useMemo(() => new THREE.Vector3(), []);
  const d = useMemo(() => new THREE.Vector3(), []);
  const screen = useMemo(() => new THREE.Vector3(), []);
  const inverse = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ camera, size }) => {
    const group = root.current;
    if (!group) return;
    rehearsal.current ??= createRehearsal(group);
    if (rehearsal.current.next()) return;
    const now = serverNow();
    const strength = empStormStrength(now, since, until);
    const on = strength > 0 ? strength * empStormReach(screenPixels(radius, centre, camera, size.height)) : 0;
    group.visible = on > 0.001;
    if (!group.visible) return;
    const t = (now - since) / 1000;
    const R = radius;
    view.copy(camera.position).sub(centre).normalize();
    inverse.copy(camera.quaternion).invert();
    let leaping = 0;

    if (arcMesh.current) {
      for (let i = 0; i < ARCS; i++) {
        const s = empSlot(i, t, ARC_SECONDS);
        d.set(...s.at);
        // Keep each arc on the face the camera sees, never edge-on at the limb.
        const facing = d.dot(view);
        if (facing < 0) d.addScaledVector(view, -2 * facing);
        if (d.dot(view) < 0.3) d.addScaledVector(view, 0.3 - d.dot(view)).normalize();
        scratch.position.copy(d).multiplyScalar(R * 1.01).addScaledVector(view, R * 0.05);
        scratch.quaternion.copy(camera.quaternion);
        scratch.rotateZ(s.spin);
        scratch.scale.setScalar(R * (0.85 + 0.35 * ((s.spawn % 7) / 7)));
        scratch.updateMatrix();
        arcMesh.current.setMatrixAt(i, scratch.matrix);
        arcs.frames.setX(i, s.phase * 15);
        arcs.alpha.setX(i, s.active ? on * Math.sin(Math.PI * s.phase) ** 0.4 : 0);
        arcs.colours.setXYZ(i, 0.62, 1.15, 2.6);
      }
      arcMesh.current.instanceMatrix.needsUpdate = true;
      arcs.frames.needsUpdate = true; arcs.alpha.needsUpdate = true; arcs.colours.needsUpdate = true;
    }

    if (boltMesh.current) {
      for (let j = 0; j < BOLTS; j++) {
        const s = empSlot(10 + j, t, BOLT_SECONDS);
        if (s.active) leaping = Math.max(leaping, 1 - s.phase);
        // A bolt leaps off the silhouette, its long axis pointing out from the world.
        d.set(...s.at).addScaledVector(view, -d.dot(view));
        if (d.lengthSq() < 1e-4) d.set(1, 0, 0);
        d.normalize();
        scratch.position.copy(d).multiplyScalar(R * 1.32);
        screen.copy(d).applyQuaternion(inverse);
        scratch.quaternion.copy(camera.quaternion);
        scratch.rotateZ(Math.atan2(screen.y, screen.x) - Math.PI / 2);
        scratch.scale.set(R * 0.5, R * 0.75, 1);
        scratch.updateMatrix();
        boltMesh.current.setMatrixAt(j, scratch.matrix);
        bolts.frames.setX(j, s.phase * 24);
        bolts.alpha.setX(j, s.active ? on * (1 - s.phase * 0.7) : 0);
        bolts.colours.setXYZ(j, 0.8, 1.3, 2.6);
      }
      boltMesh.current.instanceMatrix.needsUpdate = true;
      bolts.frames.needsUpdate = true; bolts.alpha.needsUpdate = true; bolts.colours.needsUpdate = true;
    }

    const wrapped = t % SHADER_WRAP;
    rim.uniforms.uT!.value = wrapped;
    rim.uniforms.uFlick!.value = on * (0.75 + 0.25 * Math.sin(t * 13.0) * Math.sin(t * 3.1) + 0.9 * leaping);
    dim.uniforms.uDim!.value = on * empBrownout(t);
    ions.material.uniforms.uT!.value = wrapped;
    ions.material.uniforms.uOn!.value = on;
  });

  // Never culled: a part must draw to rehearse. Hidden whole while the world is too small to read it.
  return (
    <group ref={root} position={position} visible={false} name="emp-storm">
      <mesh geometry={shell} material={dim} scale={radius * 1.003} frustumCulled={false} renderOrder={1290} raycast={() => null} />
      <mesh geometry={shell} material={rim} scale={radius * 1.035} frustumCulled={false} renderOrder={1291} raycast={() => null} />
      <points geometry={ions.geometry} material={ions.material} frustumCulled={false} renderOrder={1292} raycast={() => null} />
      <instancedMesh ref={arcMesh} args={[arcs.geometry, arcs.material, ARCS]} frustumCulled={false} renderOrder={1293} raycast={() => null} />
      <instancedMesh ref={boltMesh} args={[bolts.geometry, bolts.material, BOLTS]} frustumCulled={false} renderOrder={1294} raycast={() => null} />
    </group>
  );
}
