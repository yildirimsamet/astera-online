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
import { cosmeticEffectRecipe, effectFragment, effectVertex } from './cosmeticEffects.js';

export function EffectSurface({ style, kind, still = false, banner, colour, secondary }: { style: CosmeticStyle; kind: number; still?: boolean; banner?: THREE.Texture; colour?: string; secondary?: string }) {
  const recipe = cosmeticEffectRecipe(style);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 2.7 }, uKind: { value: kind }, uStyle: { value: recipe.motion },
    uBanner: { value: banner ?? null }, uHasBanner: { value: banner ? 1 : 0 }, uColour: { value: new THREE.Color(colour ?? recipe.colour) }, uSecondary: { value: new THREE.Color(secondary ?? recipe.secondary) } }), [style, kind, banner, colour, secondary]);
  useFrame(({ clock }) => {
    if (!still && material.current) material.current.uniforms.uTime!.value = clock.elapsedTime;
  });
  return <shaderMaterial ref={material} uniforms={uniforms} vertexShader={effectVertex} fragmentShader={effectFragment}
    transparent side={THREE.DoubleSide} depthWrite={kind > 1.5} depthTest toneMapped={false}
    forceSinglePass={kind < 1.5}
    blending={kind > 1.5 ? THREE.NormalBlending : THREE.AdditiveBlending} />;
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

/** One shared asset for the shop, inventory and world. Radius is relative to the world. */
export function CosmeticRing({ id, still = false }: { id: string; still?: boolean }) {
  const item = cosmeticById(id);
  if (item?.category !== 'RING' || !item.style) return null;
  const recipe = cosmeticEffectRecipe(item.style);
  return <group name={id} rotation={[.16, 0, .28]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      {item.style === 'aurora' ? <ringGeometry args={[1.0, recipe.radius * 1.25, 128, 8]} /> : <planeGeometry args={[recipe.radius * 2.5, recipe.radius * 2.5]} />}
      <EffectSurface style={item.style} kind={0} still={still} />
    </mesh>
    {item.style === 'singularity' && <mesh rotation={[-Math.PI / 2 + .28, .3, 0]}>
      <planeGeometry args={[3.7, 3.7]} /><EffectSurface style={item.style} kind={0} still={still} />
    </mesh>}
    {item.style === 'helios' && <HeliosStations />}
    <OrbitalDust style={item.style} still={still} />
  </group>;
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
