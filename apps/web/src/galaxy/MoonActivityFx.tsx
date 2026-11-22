import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { moonOrbitPosition, moonRadiusFor } from './moonOrbit.js';
import type { MoonHostRef } from './MoonGateWarpFx.js';

/*
  VFX BRIEF — Moon Operational Activity (§9.3)
  1. 90s Planet <-> Moon Hop Shuttle Arc: glowing teal curved trajectory between parent planet
     and orbiting moon with 3 animated shuttle pulses moving UP (planet -> moon) or DOWN (moon -> planet).
  2. 8h Common Moon Construction Proto-Asteroid & Assembly Tether: rotating rocky proto-moon
     orbiting the parent planet linked by a pulsing amber construction beam while `MOON` is queued.
  Zero radial glow sprites; zero per-frame allocations.
*/

export interface MoonHopFxItem {
  readonly id: string;
  readonly planetId: string;
  readonly direction: 'UP' | 'DOWN';
  readonly arriveAtMs: number;
}

const ARC_SAMPLES = 24;
const SHUTTLE_COUNT = 3;

function HopArc({
  hop,
  moons,
  nodeById,
}: {
  readonly hop: MoonHopFxItem;
  readonly moons: GalaxyMoons | undefined;
  readonly nodeById: ReadonlyMap<string, MoonHostRef>;
}) {
  const invalidate = useThree((s) => s.invalidate);

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((ARC_SAMPLES + 1) * 3), 3));
    return geo;
  }, []);

  const shuttleGeo = useMemo(() => new THREE.OctahedronGeometry(0.14, 0), []);

  const materials = useMemo(() => ({
    arc: new THREE.LineBasicMaterial({
      color: hop.direction === 'UP' ? '#22d3ee' : '#a5b4fc',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    shuttle: new THREE.MeshBasicMaterial({
      color: hop.direction === 'UP' ? '#a5f3fc' : '#e0e7ff',
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  }), [hop.direction]);

  const lineObj = useMemo(() => {
    const line = new THREE.Line(lineGeo, materials.arc);
    line.frustumCulled = false;
    return line;
  }, [lineGeo, materials.arc]);

  useEffect(() => () => {
    lineGeo.dispose();
    shuttleGeo.dispose();
    materials.arc.dispose();
    materials.shuttle.dispose();
  }, [lineGeo, shuttleGeo, materials]);

  const shuttleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const scratch = useMemo(() => ({
    parent: { x: 0, y: 0, z: 0 },
    moonPos: { x: 0, y: 0, z: 0 },
    p0: new THREE.Vector3(),
    p1: new THREE.Vector3(),
    p2: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    pt: new THREE.Vector3(),
  }), []);

  useFrame(() => {
    const nowMs = serverNow();
    if (nowMs >= hop.arriveAtMs + 400) {
      lineObj.visible = false;
      for (const m of shuttleRefs.current) if (m) m.visible = false;
      return;
    }

    const node = nodeById.get(hop.planetId);
    const moon = moons?.list.find((m) => m.planetId === hop.planetId);
    if (!node || !moon) return;

    const timeSec = nowMs / 1_000;
    scratch.parent.x = node.position[0];
    scratch.parent.y = node.position[1];
    scratch.parent.z = node.position[2];
    moonOrbitPosition(scratch.parent, node.radius, moon.visualSeed, timeSec, scratch.moonPos);
    const moonR = moonRadiusFor(node.radius, moons?.rarity[hop.planetId]);

    scratch.p0.set(node.position[0], node.position[1], node.position[2]);
    scratch.p2.set(scratch.moonPos.x, scratch.moonPos.y, scratch.moonPos.z);
    scratch.dir.subVectors(scratch.p2, scratch.p0);
    const dist = scratch.dir.length();
    if (dist < 0.01) return;
    scratch.dir.divideScalar(dist);

    // Trim endpoints to planet surface & moon surface
    scratch.p0.addScaledVector(scratch.dir, node.radius * 1.12);
    scratch.p2.addScaledVector(scratch.dir, -moonR * 1.15);

    // Gentle orbital lift at midpoint
    scratch.p1.addVectors(scratch.p0, scratch.p2).multiplyScalar(0.5);
    scratch.p1.y += node.radius * 0.72;

    const posAttr = lineGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i <= ARC_SAMPLES; i++) {
      const u = i / ARC_SAMPLES;
      const inv = 1 - u;
      posAttr.setXYZ(
        i,
        inv * inv * scratch.p0.x + 2 * inv * u * scratch.p1.x + u * u * scratch.p2.x,
        inv * inv * scratch.p0.y + 2 * inv * u * scratch.p1.y + u * u * scratch.p2.y,
        inv * inv * scratch.p0.z + 2 * inv * u * scratch.p1.z + u * u * scratch.p2.z,
      );
    }
    posAttr.needsUpdate = true;
    lineObj.visible = true;

    const scale = Math.max(0.18, moonR * 0.42);
    for (let i = 0; i < SHUTTLE_COUNT; i++) {
      const m = shuttleRefs.current[i];
      if (!m) continue;
      const raw = (timeSec * 0.65 + i / SHUTTLE_COUNT) % 1;
      const u = hop.direction === 'UP' ? raw : 1 - raw;
      const inv = 1 - u;
      scratch.pt.set(
        inv * inv * scratch.p0.x + 2 * inv * u * scratch.p1.x + u * u * scratch.p2.x,
        inv * inv * scratch.p0.y + 2 * inv * u * scratch.p1.y + u * u * scratch.p2.y,
        inv * inv * scratch.p0.z + 2 * inv * u * scratch.p1.z + u * u * scratch.p2.z,
      );
      m.visible = true;
      m.position.copy(scratch.pt);
      m.rotation.set(timeSec * 3 + i, timeSec * 2, 0);
      m.scale.setScalar(scale * (0.7 + 0.3 * Math.sin(raw * Math.PI)));
    }

    invalidate();
  });

  return (
    <group name={`moon-hop-fx-${hop.id}`}>
      <primitive object={lineObj} raycast={() => null} />
      {[0, 1, 2].map((idx) => (
        <mesh
          key={idx}
          ref={(el) => { shuttleRefs.current[idx] = el; }}
          geometry={shuttleGeo}
          material={materials.shuttle}
          visible={false}
          renderOrder={5}
          raycast={() => null}
        />
      ))}
    </group>
  );
}

function MoonConstructionSite({
  planetId,
  nodeById,
}: {
  readonly planetId: string;
  readonly nodeById: ReadonlyMap<string, MoonHostRef>;
}) {
  const invalidate = useThree((s) => s.invalidate);

  const rockGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const tetherGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return geo;
  }, []);

  const materials = useMemo(() => ({
    rock: new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      emissive: '#f59e0b',
      emissiveIntensity: 0.25,
      roughness: 0.9,
      metalness: 0.15,
      wireframe: false,
    }),
    scaffold: new THREE.MeshBasicMaterial({
      color: '#fbbf24',
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    tether: new THREE.LineBasicMaterial({
      color: '#fbbf24',
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  }), []);

  const tetherLine = useMemo(() => {
    const line = new THREE.Line(tetherGeo, materials.tether);
    line.frustumCulled = false;
    return line;
  }, [tetherGeo, materials.tether]);

  useEffect(() => () => {
    rockGeo.dispose();
    tetherGeo.dispose();
    materials.rock.dispose();
    materials.scaffold.dispose();
    materials.tether.dispose();
  }, [rockGeo, tetherGeo, materials]);

  const groupRef = useRef<THREE.Group>(null);
  const scratch = useMemo(() => ({
    parent: { x: 0, y: 0, z: 0 },
    pos: { x: 0, y: 0, z: 0 },
  }), []);

  useFrame(() => {
    const node = nodeById.get(planetId);
    if (!node || !groupRef.current) return;
    const timeSec = serverNow() / 1_000;
    scratch.parent.x = node.position[0];
    scratch.parent.y = node.position[1];
    scratch.parent.z = node.position[2];
    moonOrbitPosition(scratch.parent, node.radius, 137, timeSec, scratch.pos);

    const r = moonRadiusFor(node.radius, 'COMMON') * 0.78;
    groupRef.current.position.set(scratch.pos.x, scratch.pos.y, scratch.pos.z);
    groupRef.current.rotation.set(timeSec * 0.35, timeSec * 0.55, 0);
    groupRef.current.scale.setScalar(r);

    const posAttr = tetherGeo.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, node.position[0], node.position[1], node.position[2]);
    posAttr.setXYZ(1, scratch.pos.x, scratch.pos.y, scratch.pos.z);
    posAttr.needsUpdate = true;
    materials.tether.opacity = 0.45 + 0.3 * Math.sin(timeSec * 4.0);
    materials.scaffold.opacity = 0.32 + 0.22 * Math.sin(timeSec * 3.0);

    invalidate();
  });

  return (
    <group name={`moon-construction-${planetId}`}>
      <group ref={groupRef}>
        <mesh geometry={rockGeo} material={materials.rock} raycast={() => null} />
        <mesh geometry={rockGeo} scale={1.18} material={materials.scaffold} raycast={() => null} />
      </group>
      <primitive object={tetherLine} raycast={() => null} />
    </group>
  );
}

export function MoonActivityFx({
  hops,
  buildingPlanetId,
  moons,
  nodes,
}: {
  readonly hops: readonly MoonHopFxItem[];
  readonly buildingPlanetId: string | null;
  readonly moons?: GalaxyMoons | undefined;
  readonly nodes: readonly MoonHostRef[];
}) {
  const nodeById = useMemo(() => {
    const map = new Map<string, MoonHostRef>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  if (hops.length === 0 && !buildingPlanetId) return null;

  return (
    <group name="moon-activity-fx">
      {hops.map((hop) => (
        <HopArc key={hop.id} hop={hop} moons={moons} nodeById={nodeById} />
      ))}
      {buildingPlanetId && (
        <MoonConstructionSite planetId={buildingPlanetId} nodeById={nodeById} />
      )}
    </group>
  );
}
