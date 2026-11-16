import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { posedCraft } from '../../galaxy/model.js';
import { MODEL, MODEL_FACING } from '../../ui/assets.js';
import { DIG_END, DIG_START, mineFrame } from './mine.js';
import { labAge } from './clock.js';
import { flipbookBatch, LAB_SMOKE } from './flipbook.js';

/*
  PROTOTYPE (vfx lab, 2026-11-12) — the moment a prospector reaches its rock, which today is not drawn
  at all (the run turns home on arrival). The drill slows in, bites and spins; sparks spray off the
  cut, warm dust rolls out, the cut glows, glowing chunks fly into the hold, and it backs off with the
  hold lit amber. About two seconds, only at the arrival: the rules and the times stay as they are.
*/

const ROCK = '/assets/models/asteroids/stone-premium-v2.glb';
const HALO = '/assets/vfx/library/sck-exhaust-halo.webp';
const SPARKS = 160;
const PUFFS = 6;
const CHUNKS = 7;
const NORMAL = new THREE.Vector3(1, 0.3, 0.45).normalize();
const Z = new THREE.Vector3(0, 0, 1);

const SPARK_VERT = /* glsl */`
  attribute vec4 aSeed; uniform float uT; uniform float uRate; uniform float uSize; uniform float uRef;
  uniform vec3 uOrigin; uniform vec3 uNormal; uniform vec3 uU; uniform vec3 uV;
  varying float vAge; varying float vOn;
  void main() {
    float life = 0.35 + 0.35 * aSeed.w;
    float age = mod(uT + aSeed.x * 3.0, life) / life;
    float a = aSeed.y * 6.2831853; float spread = 0.25 + 0.9 * aSeed.z;
    vec3 dir = normalize(uNormal + (cos(a) * uU + sin(a) * uV) * spread);
    float speed = uSize * (3.0 + 6.0 * aSeed.w);
    vec3 p = uOrigin + dir * speed * (1.0 - exp(-3.0 * age * life)) / 3.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vAge = age; vOn = step(aSeed.z, uRate);
    gl_PointSize = (3.0 + 6.0 * (1.0 - age)) * uRef / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const SPARK_FRAG = /* glsl */`
  varying float vAge; varying float vOn;
  void main() {
    float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.05, 0.5, d)) * (1.0 - vAge) * vOn;
    vec3 c = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.42, 0.1), vAge);
    gl_FragColor = vec4(c * a * 2.0, 1.0);
  }`;

const hash = (n: number): number => { const x = Math.sin(n * 78.233 + 12.9) * 43758.5453; return x - Math.floor(x); };

export function MiningDig({ start, radius, dig }: { start: number; radius: number; dig: boolean }) {
  const rr = radius * 0.5;
  const length = rr * 0.9;
  const rock = useGLTF(ROCK, false).scene;
  const drill = useGLTF(MODEL.drill, false).scene;
  const rockBody = useMemo(() => {
    const clone = rock.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    clone.position.sub(box.getCenter(new THREE.Vector3()));
    const group = new THREE.Group(); group.add(clone); group.scale.setScalar(rr * 2 / Math.max(size.x, size.y, size.z));
    return group;
  }, [rock, rr]);
  const drillBody = useMemo(() => posedCraft(drill.clone(true), MODEL_FACING[MODEL.drill] ?? '+z'), [drill]);
  const [smokeMap, haloMap] = useTexture([LAB_SMOKE, HALO]);
  const dust = useMemo(() => flipbookBatch(smokeMap!, PUFFS, [8, 8], THREE.NormalBlending), [smokeMap]);
  const contact = useMemo(() => NORMAL.clone().multiplyScalar(rr * 0.9), [rr]);
  const basis = useMemo(() => {
    const u = new THREE.Vector3().crossVectors(NORMAL, new THREE.Vector3(0, 1, 0)).normalize();
    return { u, v: new THREE.Vector3().crossVectors(NORMAL, u).normalize() };
  }, []);
  const sparks = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(SPARKS * 4).map((_, i) => hash(i + 1)), 4));
    const material = new THREE.ShaderMaterial({ vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uRate: { value: 0 }, uSize: { value: rr * 0.5 }, uRef: { value: rr * 6 },
        uOrigin: { value: contact }, uNormal: { value: NORMAL }, uU: { value: basis.u }, uV: { value: basis.v } } });
    return { geometry, material };
  }, [rr, contact, basis]);
  const chunkGeometry = useMemo(() => new THREE.IcosahedronGeometry(rr * 0.06, 0), [rr]);
  const chunkMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3430', roughness: 0.9, emissive: '#ff8a2a', emissiveIntensity: 1.4 }), []);
  useEffect(() => () => {
    dust.geometry.dispose(); dust.material.dispose(); sparks.geometry.dispose(); sparks.material.dispose(); chunkGeometry.dispose(); chunkMaterial.dispose();
  }, [dust, sparks, chunkGeometry, chunkMaterial]);

  const rockGroup = useRef<THREE.Group>(null);
  const drillGroup = useRef<THREE.Group>(null);
  const puffs = useRef<THREE.InstancedMesh>(null);
  const chunks = useRef<THREE.InstancedMesh>(null);
  const hot = useRef<THREE.Sprite>(null);
  const hold = useRef<THREE.Sprite>(null);
  const stern = useRef<THREE.Sprite>(null);
  const roll = useRef(0);
  const cut = useRef<THREE.PointLight>(null);
  const facing = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z, NORMAL.clone().negate()), []);
  const twist = useMemo(() => new THREE.Quaternion(), []);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const at = useMemo(() => new THREE.Vector3(), []);
  const belly = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, delta) => {
    const raw = labAge(start);
    // Today: the run turns home the moment it arrives — no dig between.
    const t = dig || raw < DIG_START ? raw : raw + (DIG_END - DIG_START);
    const f = dig ? mineFrame(t) : { ...mineFrame(t), sparks: 0, heat: 0, spin: 0, cargo: 0 };
    if (!rockGroup.current || !drillGroup.current || !puffs.current || !chunks.current || !hot.current || !hold.current || !stern.current) return;
    rockGroup.current.position.set((hash(Math.floor(raw * 40)) - 0.5) * rr * 0.012 * f.heat, (hash(Math.floor(raw * 40) + 7) - 0.5) * rr * 0.012 * f.heat, 0);
    rockGroup.current.rotation.y = raw * 0.05;
    roll.current += delta * f.spin * 9;
    belly.copy(NORMAL).multiplyScalar(rr * 0.9 + length * (0.42 + f.gap));
    drillGroup.current.position.copy(belly);
    drillGroup.current.quaternion.copy(facing).multiply(twist.setFromAxisAngle(Z, roll.current));
    stern.current.position.copy(NORMAL).multiplyScalar(rr * 0.9 + length * (0.95 + f.gap));
    stern.current.material.opacity = 0.35 + 0.65 * Math.min(1, Math.abs(f.gap - mineFrame(t - 0.05).gap) * 30);
    sparks.material.uniforms.uT!.value = raw;
    sparks.material.uniforms.uRate!.value = f.sparks;
    hot.current.material.opacity = f.heat * (0.85 + 0.15 * Math.sin(raw * 37));
    hot.current.scale.setScalar(rr * (0.5 + 0.4 * f.heat));
    if (cut.current) cut.current.intensity = f.heat * rr * rr * 6 * (0.85 + 0.15 * Math.sin(raw * 37));
    hold.current.position.copy(belly);
    hold.current.material.opacity = f.cargo * (0.45 + 0.2 * Math.sin(raw * 4)) * (raw > DIG_START ? 1 : 0);
    for (let i = 0; i < PUFFS; i++) {
      const age = ((raw - DIG_START) / 0.9 + i / PUFFS) % 1;
      at.copy(contact).addScaledVector(NORMAL, rr * (0.05 + 0.45 * age)).addScaledVector(basis.u, rr * 0.25 * (hash(i) - 0.5) * age);
      scratch.position.copy(at); scratch.quaternion.copy(camera.quaternion); scratch.scale.setScalar(rr * (0.25 + 0.55 * age)); scratch.updateMatrix();
      puffs.current.setMatrixAt(i, scratch.matrix);
      dust.frames.setX(i, 10 + age * 40);
      dust.alpha.setX(i, raw > DIG_START && raw < DIG_END + 0.6 ? 0.8 * Math.sin(Math.PI * age) * (dig ? 1 : 0) * (1 - Math.max(0, (raw - DIG_END) / 0.6)) : 0);
      dust.tint.setXYZ(i, 1.15, 0.9, 0.7);
    }
    puffs.current.instanceMatrix.needsUpdate = true; dust.frames.needsUpdate = true; dust.alpha.needsUpdate = true; dust.tint.needsUpdate = true;
    for (let i = 0; i < CHUNKS; i++) {
      const born = DIG_START + 0.25 + i * 0.24;
      const k = (raw - born) / 0.7;
      const flying = dig && k >= 0 && k < 1;
      at.copy(contact).lerp(belly, k * k * (3 - 2 * k)).addScaledVector(basis.v, rr * 0.18 * Math.sin(Math.PI * k) * (hash(i * 3) - 0.3));
      scratch.position.copy(at); scratch.rotation.set(raw * 3 + i, raw * 2, 0); scratch.scale.setScalar(flying ? 1 - 0.6 * k : 0); scratch.updateMatrix();
      chunks.current.setMatrixAt(i, scratch.matrix);
    }
    chunks.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <group ref={rockGroup}><primitive object={rockBody} /></group>
      <group ref={drillGroup}><primitive object={drillBody} scale={length} /></group>
      <sprite ref={stern} scale={[rr * 0.35, rr * 0.35, 1]}>
        <spriteMaterial map={haloMap} color="#ffc070" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* Lab light from the contact side, and the cut's own light on the rock and the drill. */}
      <directionalLight position={NORMAL.clone().multiplyScalar(rr * 10).add(new THREE.Vector3(0, rr * 4, 0))} intensity={1.4} color="#ffe8d2" />
      <pointLight ref={cut} position={contact.clone().addScaledVector(NORMAL, rr * 0.15)} color="#ff8a30" intensity={0} distance={rr * 1.1} decay={2} />
      <sprite ref={hot} position={contact.clone().addScaledVector(NORMAL, rr * 0.02)} renderOrder={6}>
        <spriteMaterial map={haloMap} color="#ff9a3a" transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={hold} scale={[length * 0.9, length * 0.9, 1]} renderOrder={2}>
        <spriteMaterial map={haloMap} color="#ffb24a" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <instancedMesh ref={puffs} args={[dust.geometry, dust.material, PUFFS]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={chunks} args={[chunkGeometry, chunkMaterial, CHUNKS]} frustumCulled={false} />
      <points geometry={sparks.geometry} material={sparks.material} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
