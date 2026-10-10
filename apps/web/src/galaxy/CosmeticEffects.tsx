import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createPlumeGeometry } from './cosmeticPlume.js';
import { cosmeticById, type CosmeticStyle } from '@astera/rules';
import type { Marker } from './Squadrons.js';
import { hullVisualScale, formationAimDirection } from './flightVisual.js';
import { hullPoseLift } from '../ui/assets.js';
import type { PlanetNode, Vec3Tuple } from './scene.js';
import { cosmeticEffectRecipe, effectProgram, fleetFlagPose } from './cosmeticEffects.js';
import { prismShardTransforms, RING_SPANS, saturnRingProfile } from './cosmeticRings.js';
import { shardFragment, shardVertex } from './cosmeticShaders.js';

let saturnProfile: THREE.DataTexture | null = null;
/** One small radial profile shared by every Saturn ring on the map. */
function saturnProfileTexture(): THREE.DataTexture {
  if (!saturnProfile) {
    saturnProfile = new THREE.DataTexture(saturnRingProfile(256), 256, 1, THREE.RGBAFormat);
    saturnProfile.magFilter = THREE.LinearFilter;
    saturnProfile.minFilter = THREE.LinearFilter;
    saturnProfile.needsUpdate = true;
  }
  return saturnProfile;
}

/** How far each second-wave belt undulates out of its plane (world radii). */
const RING_LIFT: Partial<Record<CosmeticStyle, number>> = { inferno: .1, nebula: .05, prism: .03 };

export function EffectSurface({ style, kind, still = false, banner, colour, secondary }: { style: CosmeticStyle; kind: number; still?: boolean; banner?: THREE.Texture; colour?: string; secondary?: string }) {
  const recipe = cosmeticEffectRecipe(style);
  const program = effectProgram(style, kind);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 2.7 }, uKind: { value: kind }, uStyle: { value: recipe.motion },
    uBanner: { value: banner ?? null }, uHasBanner: { value: banner ? 1 : 0 }, uColour: { value: new THREE.Color(colour ?? recipe.colour) }, uSecondary: { value: new THREE.Color(secondary ?? recipe.secondary) },
    uSheen: { value: recipe.sheen ? 1 : 0 }, uProfile: { value: style === 'saturn' && kind < .5 ? saturnProfileTexture() : null },
    uLift: { value: kind < .5 ? RING_LIFT[style] ?? 0 : 0 } }), [style, kind, banner, colour, secondary]);
  useFrame(({ clock }) => {
    if (!still && material.current) material.current.uniforms.uTime!.value = clock.elapsedTime;
  });
  // Saturn's ice is lit material, not light: it blends over (and partly hides) the world behind.
  const solid = kind > 1.5 || (kind < .5 && style === 'saturn');
  return <shaderMaterial ref={material} uniforms={uniforms} vertexShader={program.vertexShader} fragmentShader={program.fragmentShader}
    transparent side={THREE.DoubleSide} depthWrite={kind > 1.5} depthTest toneMapped={false}
    forceSinglePass={kind < 1.5}
    blending={solid ? THREE.NormalBlending : THREE.AdditiveBlending} />;
}

function OrbitalDust({ style, still }: { style: CosmeticStyle; still: boolean }) {
  const recipe = cosmeticEffectRecipe(style);
  const group = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(recipe.particles * 3);
    for (let i = 0; i < recipe.particles; i++) {
      const angle = i * 2.399963;
      const radius = recipe.radius * (.83 + .16 * Math.sin(i * 13.37));
      values.set([Math.cos(angle) * radius, Math.sin(i * 4.7) * .025, Math.sin(angle) * radius], i * 3);
    }
    return values;
  }, [style]);
  useFrame((_, dt) => { if (group.current && !still) group.current.rotation.y += Math.min(dt, .1) * .055; });
  return <points ref={group}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial color={recipe.secondary} size={.012} transparent opacity={.8} depthWrite={false} depthTest blending={THREE.AdditiveBlending} />
  </points>;
}

/** Annuli for the second wave: only the belt is rasterised, never a square of discarded pixels. */
const RING_BELT: Partial<Record<CosmeticStyle, readonly [number, number]>> = RING_SPANS;

const RING_LEAN: Partial<Record<CosmeticStyle, number>> = { saturn: .3, inferno: .22 };

/** One shared asset for the shop, inventory and world. Radius is relative to the world. */
export function CosmeticRing({ id, still = false }: { id: string; still?: boolean }) {
  const item = cosmeticById(id);
  if (item?.category !== 'RING' || !item.style) return null;
  const recipe = cosmeticEffectRecipe(item.style);
  const belt = RING_BELT[item.style];
  return <group name={id} rotation={[.16, 0, .28]}>
    {/* Saturn keeps its flat ice but takes Saturn's own ~26° obliquity; Inferno leans too. Both open to more views. */}
    <mesh rotation={[-Math.PI / 2 + (RING_LEAN[item.style] ?? 0), 0, 0]}>
      {belt ? <ringGeometry args={[belt[0], belt[1], 160, 1]} />
        : item.style === 'aurora' ? <ringGeometry args={[1.0, recipe.radius * 1.25, 128, 8]} /> : <planeGeometry args={[recipe.radius * 2.5, recipe.radius * 2.5]} />}
      <EffectSurface style={item.style} kind={0} still={still} />
    </mesh>
    {item.style === 'singularity' && <mesh rotation={[-Math.PI / 2 + .28, .3, 0]}>
      <planeGeometry args={[3.7, 3.7]} /><EffectSurface style={item.style} kind={0} still={still} />
    </mesh>}
    {item.style === 'helios' && <HeliosStations />}
    {item.style === 'prism' && <PrismShards still={still} />}
    {recipe.particles > 0 && <OrbitalDust style={item.style} still={still} />}
  </group>;
}

/** Shared by every effect mesh that owns its material: one program, time through a uniform. */
function useEffectMaterial(vertexShader: string, fragmentShader: string, still: boolean, options: THREE.ShaderMaterialParameters) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 2.7 } }, vertexShader, fragmentShader, toneMapped: false, ...options,
  }), [vertexShader, fragmentShader]);
  useEffect(() => () => { material.dispose(); }, [material]);
  useFrame(({ clock }) => { if (!still) material.uniforms.uTime!.value = clock.elapsedTime; });
  return material;
}

/** 120 iridescent crystal shards in one instanced draw; the belt turns, the facets shimmer. */
function PrismShards({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const shards = useMemo(() => prismShardTransforms(), []);
  const geometry = useMemo(() => {
    const crystal = new THREE.OctahedronGeometry(1, 0);
    crystal.scale(.42, 1.9, .42);
    crystal.setAttribute('aHue', new THREE.InstancedBufferAttribute(new Float32Array(shards.map(shard => shard.hue)), 1));
    return crystal;
  }, [shards]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  const material = useEffectMaterial(shardVertex, shardFragment, still, {});
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new THREE.Object3D();
    shards.forEach((shard, i) => {
      transform.position.set(...shard.position);
      transform.rotation.set(...shard.rotation);
      transform.scale.setScalar(shard.scale);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(i, transform.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [shards]);
  useFrame((_, dt) => { if (group.current && !still) group.current.rotation.y += Math.min(dt, .1) * .045; });
  return <group ref={group}><instancedMesh ref={mesh} args={[geometry, material, shards.length]} /></group>;
}

/** The local +Z axis is the nose; exhaust always travels down -Z. */
export function CosmeticEngine({ id, still = false }: { id: string; still?: boolean }) {
  const item = cosmeticById(id);
  if (item?.category !== 'ENGINE' || !item.style) return null;
  return <group name={id}><PlumeMesh style={item.style} still={still} /></group>;
}

function PlumeMesh({ style, still }: { style: CosmeticStyle; still: boolean }) {
  const geometry = useMemo(() => createPlumeGeometry(style), [style]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  return <mesh geometry={geometry}><EffectSurface style={style} kind={1} still={still} /></mesh>;
}

export function CosmeticFlag({ id, still = false }: { id: string; still?: boolean }) {
  const item = cosmeticById(id);
  if (item?.category !== 'FLAG' || !item.style) return null;
  const style = item.style;
  return <group name={id}>
    <mesh position={[-.83, 0, 0]}><cylinderGeometry args={[.018, .027, 1.9, 12]} />
      <meshStandardMaterial color="#748497" metalness={.92} roughness={.25} />
    </mesh>
    <mesh position={[-.83, .98, 0]}><octahedronGeometry args={[.06]} /><meshBasicMaterial color={item.accent} /></mesh>
    <mesh position={[0, .25, 0]}>
      <planeGeometry args={[1.6, 1.03, 32, 16]} />
      <FlagFabric id={id} style={style} still={still} />
    </mesh>
  </group>;
}

/** Shares the fleet's heading, with a centred mast on its nose and cloth trailing behind. */
export function FleetCosmeticFlag({ id, scale }: { id: string; scale: number }) {
  return <group name="fleet-clan-flag" {...fleetFlagPose(scale)}><CosmeticFlag id={id} /></group>;
}

function FlagFabric({ id, style, still }: { id: string; style: CosmeticStyle; still: boolean }) {
  const banner = useTexture(`/assets/images/cosmetics/standards/${id}.svg`);
  return <EffectSurface style={style} kind={2} still={still} banner={banner} />;
}

/** One volumetric envelope per craft, instanced in a single draw per formation. */
export function FormationCosmeticEngines({ id, markers, slots, scale, aimDistance }: {
  id: string; markers: readonly Marker[]; slots: readonly Vec3Tuple[]; scale: number; aimDistance: RefObject<number>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const item = cosmeticById(id);
  const work = useMemo(() => ({ root: new THREE.Object3D(), direction: [0, 0, 1] as Vec3Tuple, target: new THREE.Vector3() }), []);
  const count = markers.length;
  const geometry = useMemo(() => createPlumeGeometry(item?.style), [item?.style]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useFrame(() => {
    if (!mesh.current) return;
    markers.forEach((marker, i) => {
      const slot = slots[i] ?? [0, 0, 0];
      const size = hullVisualScale(marker.hull, scale);
      const direction = formationAimDirection(slot, aimDistance.current, work.direction);
      work.root.position.set(slot[0], slot[1] + hullPoseLift(marker.hull) * size, slot[2]);
      work.target.set(work.root.position.x + direction[0], work.root.position.y + direction[1], work.root.position.z + direction[2]);
      work.root.lookAt(work.target);
      work.root.scale.setScalar(size);
      work.root.updateMatrix();
      mesh.current!.setMatrixAt(i, work.root.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  if (item?.category !== 'ENGINE' || !item.style || count === 0) return null;
  return <instancedMesh name="formation-cosmetic-exhaust" ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
    <EffectSurface style={item.style} kind={1} />
  </instancedMesh>;
}

function HeliosStations() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      transform.position.set(Math.cos(angle) * 1.42, 0, Math.sin(angle) * 1.42);
      transform.rotation.set(0, -angle, .12);
      transform.updateMatrix();
      mesh.current.setMatrixAt(i, transform.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={mesh} args={[undefined, undefined, 12]}>
    <boxGeometry args={[.1, .055, .2]} /><meshStandardMaterial color="#77614a" metalness={.88} roughness={.24} emissive="#b86218" emissiveIntensity={.5} />
  </instancedMesh>;
}

/** Sub-pixel details disappear with distance; never draw a ring on a hidden world. */
export function WorldCosmeticRing({ node }: { node: PlanetNode }) {
  const group = useRef<THREE.Group>(null);
  const at = useMemo(() => new THREE.Vector3(...node.position), [node.position]);
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = node.radius / Math.max(.01, camera.position.distanceTo(at)) > 1 / 90;
  });
  if (!node.ringId || node.intel === 'UNKNOWN') return null;
  return <group ref={group} position={node.position} scale={node.radius}><CosmeticRing id={node.ringId} /></group>;
}
