import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MiningRun } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { playSceneSound } from './audio.js';
import { plumeTexture, sparkTexture } from './vfx.js';
import { toWorld, type PlanetNode } from './scene.js';
import { wreckBandRadius } from './Wrecks.js';

/** Brief cutting flash only after the server confirms a successful extraction. No invented mining state. */
export function MiningPulse({ run, nodes }: { run: MiningRun; nodes: readonly PlanetNode[] }) {
  const root = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null);
  const beam = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const heard = useRef(false);
  const startedAt = useRef<number | null>(null);
  const previous = useRef<{ id: string; status: MiningRun['status'] } | null>(null);
  const point = useMemo(() => {
    const position = new THREE.Vector3(...toWorld(run.intercept));
    if (run.targetKind !== 'debris') return position;
    // A planet field's server coordinate is its centre; the cutting flash belongs to its hollow band.
    const world = nodes.find((node) => position.distanceToSquared(new THREE.Vector3(...node.position)) < node.radius ** 2);
    if (world) position.copy(new THREE.Vector3(...world.position)).add(
      new THREE.Vector3(0.6, 0, 0.8).multiplyScalar(wreckBandRadius(world.radius)),
    );
    return position;
  }, [run.intercept, run.targetKind, nodes]);
  const plume = useMemo(plumeTexture, []);
  const spark = useMemo(sparkTexture, []);
  const positions = useMemo(() => new Float32Array(36), []);
  const success = run.status === 'returning' && !run.recalledAt
    && run.minedAlloy + run.minedCrystal + run.minedDeuterium > 0;
  useEffect(() => {
    const prior = previous.current;
    previous.current = { id: run.id, status: run.status };
    if (prior?.id !== run.id) { startedAt.current = null; heard.current = false; }
    if (!success || startedAt.current !== null || document.hidden) return;
    const now = serverNow();
    const arrivalAge = now - run.arriveAt.getTime();
    const confirmedTransition = prior?.id === run.id && prior.status === 'outbound';
    // Start on server confirmation: worker/refetch latency must not consume the flash.
    // A remounted view may show a just-completed arrival, but never replay an old return.
    if (arrivalAge >= 0 && arrivalAge <= (confirmedTransition ? 10_000 : 1_600)) startedAt.current = now;
  }, [run.id, run.status, run.arriveAt, success]);
  useFrame(({ camera }) => {
    const elapsed = startedAt.current === null ? -1 : (serverNow() - startedAt.current) / 1000;
    const visible = success && elapsed >= 0 && elapsed < 1.6;
    if (root.current) root.current.visible = visible;
    if (!visible) return;
    if (!heard.current) {
      heard.current = true;
      if (elapsed < 0.35) playSceneSound('mining', point, camera, 0.65, `mining:${run.id}`);
    }
    const t = elapsed / 1.6;
    if (beam.current) {
      beam.current.material.opacity = Math.max(0, 1 - t * 2) * 0.7;
      beam.current.quaternion.copy(camera.quaternion);
    }
    const particles = sparks.current;
    if (!particles) return;
    const positions = particles.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const angle = i * 2.39996;
      const reach = 0.015 + t * (0.08 + (i % 4) * 0.025);
      positions.setXYZ(i, Math.cos(angle) * reach, Math.sin(angle) * reach * 0.65, Math.sin(i * 3.3) * reach);
    }
    positions.needsUpdate = true;
    particles.material.opacity = (1 - t) ** 2 * 0.7;
  });
  return (
    <group ref={root} position={point} visible={false} name="mining-extraction-pulse">
      <mesh ref={beam} position={[0, 0.1, 0]} raycast={() => null}>
        <planeGeometry args={[0.055, 0.28]} />
        <meshBasicMaterial {...(plume ? { map: plume } : {})} color="#ffdca2" transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <points ref={sparks} raycast={() => null}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <pointsMaterial {...(spark ? { map: spark } : {})} color="#d8b678" size={0.035} transparent
          opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}
