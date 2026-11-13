import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { MiningRun } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { playSceneSound } from './audio.js';
import { DIG_SECONDS, digFrame, runDig, runLaden, settleRoll } from './miningDig.js';
import { NUKE_SMOKE } from './NukeBlast.js';
import { createRehearsal, type Rehearsal } from './rehearsal.js';
import { atlasBatch } from './StrategicBlast.jsx';

/*
  THE BITE, DRAWN AT THE LEAD DRILL'S NOSE (owner approved the lab dig, 2026-11-12). The run's craft
  hold on the target's near face (`runPosition`'s reach) facing it, so in this group's frame the nose
  is +Z and the face's outward normal is −Z. Sparks spray back off the cut, warm dust rolls out, the cut
  glows and its glow washes the face (drawn, never lit: no real light), and once the server answers
  with a full hold the glowing chunks fly into it and the hold stays lit as the drill eases away.
  Six draws, only for the seconds of the dig; each part draws once, unseen, when the run mounts.
*/

export const DIG_HALO = '/assets/vfx/library/sck-exhaust-halo.webp';
const SPARKS = 140;
const PUFFS = 6;
const CHUNKS = 7;
const BACK = new THREE.Vector3(0, 0, -1);
const SIDE = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

/** The drill's turn and shudder, which the run's craft read each frame. */
export interface DrillMotion { roll: number; shake: number }

const SPARK_VERT = /* glsl */`
  attribute vec4 aSeed;
  uniform float uT; uniform float uRate; uniform float uReach; uniform float uPx;
  uniform vec3 uOrigin; uniform vec3 uNormal; uniform vec3 uU; uniform vec3 uV;
  varying float vAge; varying float vOn;
  void main() {
    float life = 0.35 + 0.35 * aSeed.w;
    float age = mod(uT + aSeed.x * 3.0, life) / life;
    float a = aSeed.y * 6.2831853;
    float spread = 0.25 + 0.9 * aSeed.z;
    vec3 dir = normalize(uNormal + (cos(a) * uU + sin(a) * uV) * spread);
    float speed = uReach * (3.0 + 6.0 * aSeed.w);
    vec3 p = uOrigin + dir * speed * (1.0 - exp(-3.0 * age * life)) / 3.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vAge = age;
    vOn = step(aSeed.z, uRate);
    gl_PointSize = clamp(uPx * (0.35 + 0.65 * (1.0 - age)) / max(-mv.z, 0.001), 1.0, 14.0);
    gl_Position = projectionMatrix * mv;
  }`;
const SPARK_FRAG = /* glsl */`
  varying float vAge; varying float vOn;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.05, 0.5, d)) * (1.0 - vAge) * vOn;
    vec3 c = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.42, 0.1), vAge);
    gl_FragColor = vec4(c * a * 2.0, 1.0);
  }`;

const hash = (n: number): number => { const x = Math.sin(n * 78.233 + 12.9) * 43758.5453; return x - Math.floor(x); };

export function MiningDig({ run, length, motion }: { run: MiningRun; length: number; motion: RefObject<DrillMotion> }) {
  const [smokeMap, haloMap] = useTexture([NUKE_SMOKE, DIG_HALO]);
  // The lab's rock was sized against the drill; its measures keep their proportions here.
  const rr = length * 1.1;
  const nose = length / 2;
  const contact = useMemo(() => new THREE.Vector3(0, 0, nose), [nose]);
  const dust = useMemo(() => atlasBatch(smokeMap!, PUFFS, false, 8, 8, true), [smokeMap]);
  const sparks = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(SPARKS * 4).map((_, i) => hash(i + 1)), 4));
    const material = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: {
        uT: { value: 0 }, uRate: { value: 0 }, uReach: { value: rr * 0.5 }, uPx: { value: 0 },
        uOrigin: { value: contact }, uNormal: { value: BACK }, uU: { value: SIDE }, uV: { value: UP },
      },
    });
    return { geometry, material };
  }, [rr, contact]);
  const chunkGeometry = useMemo(() => new THREE.IcosahedronGeometry(rr * 0.06, 0), [rr]);
  const chunkMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff9440', toneMapped: false }), []);
  useEffect(() => () => {
    dust.geometry.dispose(); dust.material.dispose(); sparks.geometry.dispose(); sparks.material.dispose();
    chunkGeometry.dispose(); chunkMaterial.dispose();
  }, [dust, sparks, chunkGeometry, chunkMaterial]);

  const root = useRef<THREE.Group>(null);
  const puffs = useRef<THREE.InstancedMesh>(null);
  const chunks = useRef<THREE.InstancedMesh>(null);
  const hot = useRef<THREE.Sprite>(null);
  const wash = useRef<THREE.Sprite>(null);
  const hold = useRef<THREE.Sprite>(null);
  const rehearsal = useRef<Rehearsal | null>(null);
  // A chunk is drawn at its full size until the frame places it; it waits unseen, at none.
  useLayoutEffect(() => {
    const mesh = chunks.current;
    if (!mesh) return;
    const none = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < CHUNKS; i++) mesh.setMatrixAt(i, none);
    mesh.instanceMatrix.needsUpdate = true;
  }, [chunkGeometry, chunkMaterial]);
  const filled = useRef(0);
  const heard = useRef(false);
  // Torn down mid-bite (a recall the server took just before contact): the drill stops turning and shaking.
  useEffect(() => {
    const drill = motion.current;
    return () => { drill.roll = 0; drill.shake = 0; };
  }, [motion]);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const facing = useMemo(() => new THREE.Quaternion(), []);
  const where = useMemo(() => new THREE.Vector3(), []);
  const grown = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size, gl }, delta) => {
    const group = root.current;
    const drill = motion.current;
    if (!group || !puffs.current || !chunks.current || !hot.current || !wash.current || !hold.current) return;
    rehearsal.current ??= createRehearsal(group);
    if (rehearsal.current.next()) return;
    const t = runDig(run, serverNow());
    group.visible = t !== null;
    if (t === null) {
      drill.roll = 0; drill.shake = 0; filled.current = 0;
      return;
    }
    const f = digFrame(t);
    // Chunks and the lit hold wait for the server's word that there was ore to take.
    filled.current = runLaden(run) ? Math.min(1, filled.current + delta / 0.15) : 0;
    const cargo = filled.current;
    drill.roll = t > DIG_SECONDS ? settleRoll(drill.roll + delta * f.spin * 9, delta) : drill.roll + delta * f.spin * 9;
    drill.shake = f.sparks;

    if (!heard.current && t < 0.25) {
      heard.current = true;
      playSceneSound('mining', group.localToWorld(where.copy(contact)), camera, 1, `mining:${run.id}`);
    }

    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
    group.getWorldScale(grown);
    sparks.material.uniforms.uPx!.value = length * 0.09 * grown.x * (size.height * gl.getPixelRatio()) / (2 * Math.tan((fov * Math.PI) / 360));
    sparks.material.uniforms.uT!.value = t;
    sparks.material.uniforms.uRate!.value = f.sparks;

    const flicker = 0.85 + 0.15 * Math.sin(t * 37);
    hot.current.material.opacity = f.heat * flicker;
    hot.current.scale.setScalar(rr * (0.45 + 0.35 * f.heat));
    wash.current.material.opacity = f.heat * 0.32 * flicker;
    hold.current.material.opacity = cargo * f.cargo * (0.45 + 0.2 * Math.sin(t * 4));

    // Camera-facing in this group's own turned frame.
    group.getWorldQuaternion(facing).invert().multiply(camera.quaternion);
    for (let i = 0; i < PUFFS; i++) {
      const age = ((t / 0.9) + i / PUFFS) % 1;
      scratch.position.copy(contact).addScaledVector(BACK, rr * (0.05 + 0.45 * age)).addScaledVector(SIDE, rr * 0.25 * (hash(i) - 0.5) * age);
      scratch.quaternion.copy(facing);
      scratch.scale.setScalar(rr * (0.25 + 0.55 * age));
      scratch.updateMatrix();
      puffs.current.setMatrixAt(i, scratch.matrix);
      dust.frames.setX(i, 10 + age * 40);
      dust.alpha.setX(i, t < DIG_SECONDS + 0.6 ? 0.8 * Math.sin(Math.PI * age) * (1 - Math.max(0, (t - DIG_SECONDS) / 0.6)) : 0);
      dust.colours.setXYZ(i, 1.15, 0.9, 0.7);
    }
    puffs.current.instanceMatrix.needsUpdate = true;
    dust.frames.needsUpdate = true; dust.alpha.needsUpdate = true; dust.colours.needsUpdate = true;

    for (let i = 0; i < CHUNKS; i++) {
      const k = (t - (0.25 + i * 0.24)) / 0.7;
      const flying = k >= 0 && k < 1;
      const s = k * k * (3 - 2 * k);
      scratch.position.copy(contact).multiplyScalar(1 - s).addScaledVector(UP, rr * 0.18 * Math.sin(Math.PI * k) * (hash(i * 3) - 0.3));
      scratch.rotation.set(t * 3 + i, t * 2, 0);
      scratch.scale.setScalar(flying ? (1 - 0.6 * k) * cargo : 0);
      scratch.updateMatrix();
      chunks.current.setMatrixAt(i, scratch.matrix);
    }
    chunks.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={root} visible={false}>
      <sprite ref={wash} position={[0, 0, nose * 0.95]} scale={[rr * 1.4, rr * 1.4, 1]} frustumCulled={false}>
        <spriteMaterial map={haloMap} color="#ff8a30" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={hot} position={[0, 0, nose * 0.9]} frustumCulled={false} renderOrder={6}>
        <spriteMaterial map={haloMap} color="#ff9a3a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={hold} scale={[length * 0.9, length * 0.9, 1]} frustumCulled={false} renderOrder={2}>
        <spriteMaterial map={haloMap} color="#ffb24a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <instancedMesh ref={puffs} args={[dust.geometry, dust.material, PUFFS]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={chunks} args={[chunkGeometry, chunkMaterial, CHUNKS]} frustumCulled={false} />
      <points geometry={sparks.geometry} material={sparks.material} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
