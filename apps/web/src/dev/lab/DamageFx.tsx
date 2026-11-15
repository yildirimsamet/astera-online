import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { posedCraft } from '../../galaxy/model.js';
import { hullDeck, loopLayers, pickVents, puffState, SMOKE_PUFFS as PUFFS } from './damage.js';
import { empSlot } from '../../galaxy/empSchedule.js';
import { labAge } from './clock.js';
import { flipbookBatch, LAB_SMOKE } from './flipbook.js';

/*
  PROTOTYPE (vfx lab, 2026-11-12) — damage read from the hull itself (owner: smoke, and small flames
  on the burns): three vents on the wrecked colony ship's upper deck, each with a rising smoke plume
  (Space Combat Kit smoke), a small flame (Realistic Fire loop), an ember glow and now and then a
  burst of sparks. Repair puts them out one by one.
*/

const WRECK = '/assets/models/vessels/spine-wrecked.glb';
const FIRE = '/assets/vfx/library/flame-3-6x6.webp';
const HALO = '/assets/vfx/library/sck-exhaust-halo.webp';
const VENTS = 3;
const FLAMES = 2;
/** Each flame is two cross-fading copies of the loop, so its seam never shows. */
const LAYERS = 2;
const SPARKS = 48;

const SPARK_VERT = /* glsl */`
  attribute vec4 aSeed; uniform float uPhase; uniform float uRef; uniform float uReach;
  varying float vFade;
  void main() {
    float a = aSeed.x * 6.2831853; float up = 0.3 + 0.7 * aSeed.y;
    vec3 dir = normalize(vec3(cos(a) * (1.0 - up), up, sin(a) * (1.0 - up)));
    float k = clamp(uPhase, 0.0, 1.0);
    vec3 p = position + dir * uReach * (0.4 + 0.6 * aSeed.z) * (1.0 - exp(-4.0 * k)) - vec3(0.0, uReach * 0.25 * k * k, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = uPhase < 0.0 ? 0.0 : (1.0 - k) * step(aSeed.w, 0.85);
    gl_PointSize = (2.0 + 4.0 * (1.0 - k)) * uRef / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const SPARK_FRAG = /* glsl */`
  varying float vFade;
  void main() { float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.05, 0.5, d)) * vFade;
    gl_FragColor = vec4(mix(vec3(1.0, 0.5, 0.15), vec3(1.0, 0.95, 0.75), vFade) * a * 2.0, 1.0); }`;

export function DamageFx({ start, radius, burning }: { start: number; radius: number; burning: boolean }) {
  const R = radius;
  const { scene } = useGLTF(WRECK, false);
  const { body, vents } = useMemo(() => {
    const craft = posedCraft(scene.clone(true), '+x');
    const group = new THREE.Group(); group.add(craft); group.scale.setScalar(R * 2);
    const candidates = hullDeck(group);
    const picked = pickVents(candidates, VENTS).map(([z, y, x]) => new THREE.Vector3(x, y, z));
    return { body: group, vents: picked };
  }, [scene, R]);
  const [smokeMap, fireMap, haloMap] = useTexture([LAB_SMOKE, FIRE, HALO]);
  const smoke = useMemo(() => flipbookBatch(smokeMap!, VENTS * PUFFS, [8, 8], THREE.NormalBlending), [smokeMap]);
  const fire = useMemo(() => flipbookBatch(fireMap!, VENTS * FLAMES * LAYERS, [6, 6], THREE.AdditiveBlending), [fireMap]);
  const sparks = useMemo(() => vents.map((at) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3).map((_, i) => [at.x, at.y, at.z][i % 3]!), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(SPARKS * 4).map((_, i) => { const x = Math.sin(i * 91.3 + at.x * 7) * 43758.5453; return x - Math.floor(x); }), 4));
    const material = new THREE.ShaderMaterial({ vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uPhase: { value: -1 }, uRef: { value: R * 5 }, uReach: { value: R * 0.35 } } });
    return { geometry, material };
  }), [vents, R]);
  useEffect(() => () => {
    for (const b of [smoke, fire]) { b.geometry.dispose(); b.material.dispose(); }
    for (const s of sparks) { s.geometry.dispose(); s.material.dispose(); }
  }, [smoke, fire, sparks]);

  const puffs = useRef<THREE.InstancedMesh>(null);
  const flames = useRef<THREE.InstancedMesh>(null);
  const embers = useRef<THREE.Group>(null);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ camera }) => {
    const t = Math.max(0, labAge(start));
    const puffMesh = puffs.current, flameMesh = flames.current, emberGroup = embers.current;
    if (!puffMesh || !flameMesh || !emberGroup) return;
    const on = burning ? 1 : 0;
    vents.forEach((at, v) => {
      for (let k = 0; k < PUFFS; k++) {
        const i = v * PUFFS + k;
        const puff = puffState(v, k, t);
        const age = puff.age;
        scratch.position.copy(at).add({ x: R * 0.2 * age * puff.drift, y: R * (0.05 + 0.7 * age), z: R * 0.12 * age * (puff.size - 1.05) * 4 });
        scratch.quaternion.copy(camera.quaternion); scratch.rotateZ(puff.drift * 0.6 + age * puff.drift);
        scratch.scale.setScalar(R * (0.1 + 0.42 * age) * puff.size); scratch.updateMatrix();
        puffMesh.setMatrixAt(i, scratch.matrix);
        smoke.frames.setX(i, Math.min(63, puff.frame + age * 34));
        smoke.alpha.setX(i, on * 0.6 * puff.alpha);
        smoke.tint.setXYZ(i, 0.3, 0.29, 0.28);
      }
      for (let k = 0; k < FLAMES; k++) {
        // Each flame breathes on its own: its own speed, and a slow swell that never lines up with the others.
        const swell = 0.88 + 0.24 * (0.5 + 0.5 * Math.sin(t * (1.3 + 0.4 * v) + k * 2.1) * Math.sin(t * (0.53 + 0.17 * k) + v));
        const size = R * (k === 0 ? 0.3 : 0.2) * swell;
        const layers = loopLayers(t, 21 + 3 * v + 2 * k, 36, v * 0.37 + k * 0.61);
        layers.forEach((layer, j) => {
          const i = (v * FLAMES + k) * LAYERS + j;
          scratch.position.copy(at).add({ x: k * R * 0.05, y: size * 0.42, z: -k * R * 0.04 });
          scratch.quaternion.copy(camera.quaternion); scratch.scale.setScalar(size); scratch.updateMatrix();
          flameMesh.setMatrixAt(i, scratch.matrix);
          fire.frames.setX(i, layer.frame);
          fire.alpha.setX(i, on * layer.weight * (0.85 + 0.15 * Math.sin(t * 23 + v)));
          fire.tint.setXYZ(i, 1.5, 1.0, 0.7);
        });
      }
      const burst = empSlot(20 + v, t, 0.6);
      sparks[v]!.material.uniforms.uPhase!.value = burning && burst.active ? burst.phase : -1;
      const ember = emberGroup.children[v];
      if (ember instanceof THREE.Sprite) {
        ember.position.copy(at);
        ember.material.opacity = on * (0.55 + 0.25 * Math.sin(t * 11 + v * 2) * Math.sin(t * 3.7));
      }
    });
    puffMesh.instanceMatrix.needsUpdate = true; flameMesh.instanceMatrix.needsUpdate = true;
    for (const b of [smoke, fire]) { b.frames.needsUpdate = true; b.alpha.needsUpdate = true; b.tint.needsUpdate = true; }
  });

  return (
    <group>
      {/* Lab fill: the wreck is dark by design, and the lab has no sun of its own here. */}
      <ambientLight intensity={0.7} />
      <primitive object={body} />
      <group ref={embers}>
        {vents.map((_, v) => (
          <sprite key={v} scale={[R * 0.32, R * 0.32, 1]} renderOrder={2}>
            <spriteMaterial map={haloMap} color="#ff7a2a" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        ))}
      </group>
      <instancedMesh ref={flames} args={[fire.geometry, fire.material, VENTS * FLAMES * LAYERS]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={puffs} args={[smoke.geometry, smoke.material, VENTS * PUFFS]} frustumCulled={false} renderOrder={4} />
      {sparks.map((s, v) => <points key={v} geometry={s.geometry} material={s.material} frustumCulled={false} renderOrder={5} />)}
    </group>
  );
}
