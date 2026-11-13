import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { VESSEL_SYSTEMS, type VesselHull, type VesselSystem } from '@astera/rules';
import { empSlot } from './empSchedule.js';
import { VESSEL_BAYS, type DamageSpot } from './mainSky.js';
import { NUKE_SMOKE } from './NukeBlast.js';
import { atlasBatch } from './StrategicBlast.jsx';
import { burnOut, burnTargets, easeBurn, loopLayers, puffState, SMOKE_PUFFS, type BurnLook } from './vesselBurn.js';

/*
  THE WRECKED SHIP'S FIRES (owner approved the lab's smoke and flames, 2026-11-12). Over every bay
  that is still wrecked: a column of smoke (Space Combat Kit), a flame that loops without a seam
  (Realistic Fire), a glow on the hull and now and then a burst of sparks. Wiring sparks over a thin
  wisp; a machine under repair smoulders; a mended one goes out over a moment (`easeBurn`). No light:
  three batched draws and a glow per bay, and nothing at all once the ship is whole. Model space, as
  `VesselBody`: nose along +X, about a unit long, up is +Y.
*/

export const BURN_FIRE = '/assets/vfx/library/flame-3-6x6.webp';
const HALO = '/assets/vfx/library/sck-exhaust-halo.webp';
/** The lab's measure: half the hull. */
const R = 0.5;
const BAYS = VESSEL_SYSTEMS.length;
const FLAMES = 2;
/** Each flame is two cross-fading copies of its loop (`loopLayers`). */
const LAYERS = 2;
const SPARKS = 48;
const SMOKE_TINT = [0.3, 0.29, 0.28] as const;

const SPARK_VERT = /* glsl */`
  attribute vec4 aSeed; attribute float aBay;
  uniform float uPhase[${String(BAYS)}]; uniform float uOn[${String(BAYS)}]; uniform float uReach; uniform float uPx;
  varying float vFade;
  void main() {
    int bay = int(aBay + 0.5);
    float phase = -1.0; float on = 0.0;
    for (int i = 0; i < ${String(BAYS)}; i++) { if (i == bay) { phase = uPhase[i]; on = uOn[i]; } }
    float a = aSeed.x * 6.2831853; float up = 0.3 + 0.7 * aSeed.y;
    vec3 dir = normalize(vec3(cos(a) * (1.0 - up), up, sin(a) * (1.0 - up)));
    float k = clamp(phase, 0.0, 1.0);
    vec3 p = position + dir * uReach * (0.4 + 0.6 * aSeed.z) * (1.0 - exp(-4.0 * k)) - vec3(0.0, uReach * 0.25 * k * k, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = phase < 0.0 ? 0.0 : (1.0 - k) * step(aSeed.w, 0.85) * on;
    gl_PointSize = clamp(uPx * (0.35 + 0.65 * (1.0 - k)) / max(-mv.z, 0.001), 1.0, 12.0);
    gl_Position = projectionMatrix * mv;
  }`;
const SPARK_FRAG = /* glsl */`
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.05, 0.5, d)) * vFade;
    gl_FragColor = vec4(mix(vec3(1.0, 0.5, 0.15), vec3(1.0, 0.95, 0.75), vFade) * a * 2.0, 1.0);
  }`;

const seed = (n: number): number => { const x = Math.sin(n * 91.3 + 7.1) * 43758.5453; return x - Math.floor(x); };
const copyLooks = (looks: Record<VesselSystem, BurnLook>): Record<VesselSystem, BurnLook> => ({
  REFINERY: { ...looks.REFINERY }, SURVEY: { ...looks.SURVEY }, DEFENCE: { ...looks.DEFENCE }, CARGO: { ...looks.CARGO }, DRIVE: { ...looks.DRIVE },
});

export function VesselBurn({ hull, damage }: { hull: VesselHull; damage: readonly DamageSpot[] }) {
  const [smokeMap, fireMap, haloMap] = useTexture([NUKE_SMOKE, BURN_FIRE, HALO]);
  const smoke = useMemo(() => atlasBatch(smokeMap!, BAYS * SMOKE_PUFFS, false, 8, 8, true), [smokeMap]);
  const fire = useMemo(() => atlasBatch(fireMap!, BAYS * FLAMES * LAYERS, true, 6, 6, true), [fireMap]);
  const bays = useMemo(() => VESSEL_SYSTEMS.map((system) => new THREE.Vector3(...VESSEL_BAYS[hull][system])), [hull]);
  const sparks = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const at = new Float32Array(BAYS * SPARKS * 3);
    const bay = new Float32Array(BAYS * SPARKS);
    bays.forEach((point, b) => {
      for (let i = 0; i < SPARKS; i++) { at.set([point.x, point.y, point.z], (b * SPARKS + i) * 3); bay[b * SPARKS + i] = b; }
    });
    geometry.setAttribute('position', new THREE.BufferAttribute(at, 3));
    geometry.setAttribute('aBay', new THREE.BufferAttribute(bay, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(BAYS * SPARKS * 4).map((_, i) => seed(i + 1)), 4));
    // Written in place each frame; the program reads them through its uniforms.
    const phase = new Array<number>(BAYS).fill(-1);
    const on = new Array<number>(BAYS).fill(0);
    const material = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uPhase: { value: phase }, uOn: { value: on }, uReach: { value: R * 0.35 }, uPx: { value: 0 } },
    });
    return { geometry, material, phase, on };
  }, [bays]);
  // Each frees only its own: a new hull rebuilds the sparks while the smoke and flames stay in use.
  useEffect(() => () => { smoke.geometry.dispose(); smoke.material.dispose(); }, [smoke]);
  useEffect(() => () => { fire.geometry.dispose(); fire.material.dispose(); }, [fire]);
  useEffect(() => () => { sparks.geometry.dispose(); sparks.material.dispose(); }, [sparks]);

  const targets = useMemo(() => burnTargets(damage), [damage]);
  const shown = useRef<Record<VesselSystem, BurnLook> | null>(null);
  const root = useRef<THREE.Group>(null);
  const puffs = useRef<THREE.InstancedMesh>(null);
  const flames = useRef<THREE.InstancedMesh>(null);
  const glows = useRef<THREE.Group>(null);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const none = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);
  const facing = useMemo(() => new THREE.Quaternion(), []);
  const grown = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock, size, gl }, delta) => {
    const group = root.current, puffMesh = puffs.current, flameMesh = flames.current, glowGroup = glows.current;
    if (!group || !puffMesh || !flameMesh || !glowGroup) return;
    // A ship first seen burning is already burning; only a change of repairs fades.
    shown.current ??= copyLooks(targets);
    const now = shown.current;
    if (VESSEL_SYSTEMS.every((system) => burnOut(now[system]) && burnOut(targets[system]))) {
      group.visible = false;
      return;
    }
    const t = clock.elapsedTime;
    let burning = false;
    // Camera-facing in the hull's own turned frame.
    group.getWorldQuaternion(facing).invert().multiply(camera.quaternion);

    for (const [b, system] of VESSEL_SYSTEMS.entries()) {
      const look = now[system];
      easeBurn(look, targets[system], delta);
      const at = bays[b]!;
      const glow = glowGroup.children[b];
      if (burnOut(look)) {
        // Out while others burn: its quads would still be drawn, see-through, over the hull.
        for (let k = 0; k < SMOKE_PUFFS; k++) puffMesh.setMatrixAt(b * SMOKE_PUFFS + k, none);
        for (let i = b * FLAMES * LAYERS; i < (b + 1) * FLAMES * LAYERS; i++) flameMesh.setMatrixAt(i, none);
        sparks.phase[b] = -1;
        sparks.on[b] = 0;
        if (glow instanceof THREE.Sprite) glow.material.opacity = 0;
        continue;
      }
      burning = true;
      for (let k = 0; k < SMOKE_PUFFS; k++) {
        const i = b * SMOKE_PUFFS + k;
        const puff = puffState(b, k, t);
        const age = puff.age;
        scratch.position.copy(at).add({ x: R * 0.2 * age * puff.drift, y: R * (0.05 + 0.7 * age), z: R * 0.12 * age * (puff.size - 1.05) * 4 });
        scratch.quaternion.copy(facing);
        scratch.rotateZ(puff.drift * 0.6 + age * puff.drift);
        scratch.scale.setScalar(R * (0.1 + 0.42 * age) * puff.size * (0.6 + 0.4 * look.smoke));
        scratch.updateMatrix();
        puffMesh.setMatrixAt(i, scratch.matrix);
        smoke.frames.setX(i, Math.min(63, puff.frame + age * 34));
        smoke.alpha.setX(i, 0.6 * puff.alpha * look.smoke);
        smoke.colours.setXYZ(i, ...SMOKE_TINT);
      }
      for (let k = 0; k < FLAMES; k++) {
        // Each flame breathes on its own: its own speed, and a slow swell that never lines up with the others.
        const swell = 0.88 + 0.24 * (0.5 + 0.5 * Math.sin(t * (1.3 + 0.4 * b) + k * 2.1) * Math.sin(t * (0.53 + 0.17 * k) + b));
        const flameSize = R * (k === 0 ? 0.3 : 0.2) * swell * (0.6 + 0.4 * look.flame);
        loopLayers(t, 21 + 3 * b + 2 * k, 36, b * 0.37 + k * 0.61).forEach((layer, j) => {
          const i = (b * FLAMES + k) * LAYERS + j;
          scratch.position.copy(at).add({ x: k * R * 0.05, y: flameSize * 0.42, z: -k * R * 0.04 });
          scratch.quaternion.copy(facing);
          scratch.scale.setScalar(flameSize);
          scratch.updateMatrix();
          flameMesh.setMatrixAt(i, scratch.matrix);
          fire.frames.setX(i, layer.frame);
          fire.alpha.setX(i, layer.weight * (0.85 + 0.15 * Math.sin(t * 23 + b)) * look.flame);
          fire.colours.setXYZ(i, 1.5, 1.0, 0.7);
        });
      }
      const burst = empSlot(20 + b, t, 0.6);
      sparks.phase[b] = look.sparks > 0 && burst.active ? burst.phase : -1;
      sparks.on[b] = look.sparks;
      if (glow instanceof THREE.Sprite) {
        glow.position.copy(at);
        glow.material.opacity = look.glow * (0.55 + 0.25 * Math.sin(t * 11 + b * 2) * Math.sin(t * 3.7));
      }
    }
    group.visible = burning;
    if (!burning) return;
    puffMesh.instanceMatrix.needsUpdate = true;
    flameMesh.instanceMatrix.needsUpdate = true;
    for (const batch of [smoke, fire]) { batch.frames.needsUpdate = true; batch.alpha.needsUpdate = true; batch.colours.needsUpdate = true; }
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
    group.getWorldScale(grown);
    sparks.material.uniforms.uPx!.value = R * 0.014 * grown.x * (size.height * gl.getPixelRatio()) / (2 * Math.tan((fov * Math.PI) / 360));
  });

  return (
    <group ref={root}>
      <group ref={glows}>
        {VESSEL_SYSTEMS.map((system) => (
          <sprite key={system} scale={[R * 0.32, R * 0.32, 1]} renderOrder={2} raycast={() => null}>
            <spriteMaterial map={haloMap} color="#ff7a2a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        ))}
      </group>
      <instancedMesh ref={flames} args={[fire.geometry, fire.material, BAYS * FLAMES * LAYERS]} frustumCulled={false} renderOrder={3} raycast={() => null} />
      <instancedMesh ref={puffs} args={[smoke.geometry, smoke.material, BAYS * SMOKE_PUFFS]} frustumCulled={false} renderOrder={4} raycast={() => null} />
      <points geometry={sparks.geometry} material={sparks.material} frustumCulled={false} renderOrder={5} raycast={() => null} />
    </group>
  );
}
