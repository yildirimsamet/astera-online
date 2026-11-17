import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { posedCraft } from '../../galaxy/model.js';
import { HULL_MODEL, MODEL_FACING } from '../../ui/assets.js';
import { labAge } from './clock.js';
import { LAB_FLARE } from './flipbook.js';
import { arriveShip, departShip, warpSecond, type WarpShip } from './warp.js';

/*
  PROTOTYPE (vfx lab, 2026-11-12) — a fleet leaving into the warp and one coming out of it. Engines
  spool, the formation gathers speed, a swirl (Unique AoE Magic spiral) opens ahead of each ship; the
  ship stretches into a line of light and is gone in a flash, one after another. Arriving is the same
  film backwards. The colony ship's jump between galaxies leaves through the same swirl, larger.
*/

const JET = '/assets/vfx/lab/sck-exhaust-jet.webp';
const HALO = '/assets/vfx/library/sck-exhaust-halo.webp';
const SPIRAL = '/assets/vfx/lab/spiral-4x4.webp';
const COLONY = '/assets/models/vessels/spine-renewed.glb';
const Z = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

export type WarpMode = 'depart' | 'arrive' | 'jump';

function Ship({ index, start, mode, origin, course, size, ringSize, unit, model, maps }: {
  index: number; start: number; mode: WarpMode; unit: number; origin: THREE.Vector3; course: THREE.Vector3; size: number; ringSize: number;
  model: THREE.Object3D; maps: { jet: THREE.Texture; halo: THREE.Texture; spiral: THREE.Texture; flare: THREE.Texture };
}) {
  const hull = useMemo(() => model.clone(true), [model]);
  const facing = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z, course), [course]);
  const spiral = useMemo(() => {
    const map = maps.spiral.clone(); map.repeat.set(0.25, 0.25); map.needsUpdate = true; return map;
  }, [maps.spiral]);
  useEffect(() => () => { spiral.dispose(); }, [spiral]);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const ship = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Sprite>(null);
  const streak = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  // One material per crossed pair, so both cards fade together.
  const additive = (map: THREE.Texture, color: string) => new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const jetMaterial = useMemo(() => additive(maps.jet, '#9fd0ff'), [maps.jet]);
  const streakMaterial = useMemo(() => additive(maps.jet, '#e6f4ff'), [maps.jet]);
  useEffect(() => () => { jetMaterial.dispose(); streakMaterial.dispose(); }, [jetMaterial, streakMaterial]);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const flareMaterial = useRef<THREE.SpriteMaterial>(null);
  const glowMaterial = useRef<THREE.SpriteMaterial>(null);

  useFrame(() => {
    const t = labAge(start);
    const s: WarpShip = mode === 'arrive' ? arriveShip(index, t) : departShip(index, t);
    if (!ship.current || !body.current || !flame.current || !halo.current || !streak.current || !flash.current || !ring.current) return;
    ship.current.visible = s.visible;
    ship.current.position.copy(origin).addScaledVector(course, s.travel * unit);
    body.current.scale.set(1 / Math.sqrt(s.stretch), 1 / Math.sqrt(s.stretch), s.stretch);
    flame.current.scale.set(0.6 + 0.9 * s.engine, 0.6 + 0.9 * s.engine, 0.6 + 0.9 * s.engine);
    jetMaterial.opacity = s.engine;
    halo.current.material.opacity = s.engine;
    // The gate: where the ship leaves the warp (arriving) or enters it (departing), a little ahead.
    const gate = mode === 'arrive' ? -1.2 : departShip(index, warpSecond('depart', index)).travel + 0.12;
    const at = scratch.copy(origin).addScaledVector(course, gate * unit);
    ring.current.position.copy(at);
    flash.current.position.copy(at);
    streak.current.position.copy(at);
    ringMaterial.current!.opacity = s.ring;
    const frame = Math.min(15, Math.floor(s.ringFrame));
    spiral.offset.set((frame % 4) * 0.25, 0.75 - Math.floor(frame / 4) * 0.25);
    ring.current.rotation.z = t * 2.2;
    flareMaterial.current!.opacity = s.flash;
    glowMaterial.current!.opacity = s.flash * 0.8;
    flash.current.scale.setScalar(0.4 + 0.6 * s.flash);
    streakMaterial.opacity = s.streak;
    streak.current.scale.set(1, 1, 0.3 + 0.7 * Math.min(1, s.streak * 1.6));
  });

  const streakSign = mode === 'arrive' ? -1 : 1;
  return (
    <group>
      <group ref={ship} quaternion={facing}>
        <group ref={body} scale={1}><primitive object={hull} scale={size} /></group>
        {/* Exhaust: two crossed cards of the kit's soft jet, behind the stern. */}
        <group ref={flame} position={[0, 0, -size * 0.42]}>
          <group rotation={[0, Math.PI / 2, 0]} scale={[size * 1.1, size * 0.42, 1]}>
            {[0, Math.PI / 2].map((roll) => (
              <mesh key={roll} rotation={[roll, 0, 0]} position={[0.5, 0, 0]} material={jetMaterial}>
                <planeGeometry args={[1, 1]} />
              </mesh>
            ))}
          </group>
          <sprite ref={halo} scale={[size * 0.9, size * 0.9, 1]}>
            <spriteMaterial map={maps.halo} color="#bfe2ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </group>
      </group>
      <mesh ref={ring} quaternion={facing} renderOrder={3}>
        <planeGeometry args={[ringSize, ringSize]} />
        <meshBasicMaterial ref={ringMaterial} map={spiral} color="#9fd8ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* The line of light where it went (or came from). */}
      <group ref={streak} quaternion={facing}>
        <group rotation={[0, streakSign > 0 ? -Math.PI / 2 : Math.PI / 2, 0]} scale={[ringSize * 9, size * 0.35, 1]}>
          {[0, Math.PI / 2].map((roll) => (
            <mesh key={roll} rotation={[roll, 0, 0]} position={[0.5, 0, 0]} renderOrder={4} material={streakMaterial}>
              <planeGeometry args={[1, 1]} />
            </mesh>
          ))}
        </group>
      </group>
      <group ref={flash}>
        <sprite scale={[ringSize * 1.3, ringSize * 1.3, 1]} renderOrder={5}>
          <spriteMaterial ref={flareMaterial} map={maps.flare} color="#ffffff" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <sprite scale={[ringSize * 0.9, ringSize * 0.9, 1]} renderOrder={5}>
          <spriteMaterial ref={glowMaterial} map={maps.halo} color="#a8d8ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
    </group>
  );
}

export function FleetWarp({ start, radius, mode }: { start: number; radius: number; mode: WarpMode }) {
  const R = radius;
  const url = mode === 'jump' ? COLONY : HULL_MODEL.DART;
  const { scene } = useGLTF(url, false);
  const model = useMemo(() => posedCraft(scene.clone(true), mode === 'jump' ? '+x' : MODEL_FACING[url] ?? '+z'), [scene, url, mode]);
  const [jet, halo, spiral, flare] = useTexture([JET, HALO, SPIRAL, LAB_FLARE]);
  const maps = useMemo(() => {
    for (const map of [jet!, halo!, spiral!, flare!]) { map.colorSpace = THREE.SRGBColorSpace; map.generateMipmaps = false; map.minFilter = THREE.LinearFilter; map.needsUpdate = true; }
    return { jet: jet!, halo: halo!, spiral: spiral!, flare: flare! };
  }, [jet, halo, spiral, flare]);
  const course = useMemo(() => new THREE.Vector3(1, 0.08, 0.25).normalize(), []);
  const side = useMemo(() => course.clone().cross(UP).normalize(), [course]);
  // Arriving ships stop further on, so the gate they burst out of stands clear of the world.
  const lead = useMemo(() => new THREE.Vector3(R * 2.0, R * 0.35, R * 1.3).addScaledVector(course, mode === 'arrive' ? R * 1.4 : 0), [R, course, mode]);
  const ships = mode === 'jump'
    ? [{ origin: lead.clone().addScaledVector(course, -R * 0.2), size: R * 0.5, ring: R * 1.3 }]
    : [0, 1, 2, 3, 4].map((i) => {
      const row = Math.ceil(i / 2), wing = i === 0 ? 0 : i % 2 === 1 ? -1 : 1;
      return { origin: lead.clone().addScaledVector(course, -row * R * 0.24).addScaledVector(side, wing * row * R * 0.22).addScaledVector(UP, -row * R * 0.03), size: R * 0.26, ring: R * 0.62 };
    });
  return (
    <group>
      {ships.map((s, i) => (
        <Ship key={i} index={i} start={start} mode={mode} origin={s.origin} course={course} size={s.size} ringSize={s.ring} unit={R} model={model} maps={maps} />
      ))}
    </group>
  );
}
