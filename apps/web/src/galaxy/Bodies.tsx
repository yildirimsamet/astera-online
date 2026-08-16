import { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { AsteroidSpec } from '@blindspace/rules';
import { planetArt } from '../ui/assets.js';
import {
  DISC_RADIUS,
  STANCE_COLOUR,
  STANCE_LIGHT,
  asteroidPositions,
  type PlanetNode,
  type Vec3Tuple,
} from './scene.js';

/**
 * Everything you can see in the disc.
 *
 * The planets are camera-facing sprites, not textured spheres — a deliberate
 * choice forced by the art we actually have. The sixteen planet renders are
 * *renders*, lit and shaded already; wrapping one onto a sphere would fight its
 * baked lighting and look worse than a flat colour. Billboarded, they keep every
 * bit of the quality they were drawn with, cost one quad each, and give the whole
 * scene a consistent 2.5D language: if the worlds are billboards, the structures
 * standing on them can be too.
 */

export function PlanetBody({
  node,
  selected,
  onSelect,
}: {
  node: PlanetNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const texture = useLoader(THREE.TextureLoader, planetArt(node.id));
  const light = STANCE_LIGHT[node.stance];
  const tint = useMemo(() => new THREE.Color(light, light, light), [light]);

  return (
    <Billboard position={node.position}>
      {/* A generous invisible disc so a fingertip can hit a small world. */}
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
      >
        <circleGeometry args={[Math.max(node.radius * 1.9, 0.34), 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {node.stance !== 'dark' && (
        <mesh>
          <circleGeometry args={[node.radius * 2.1, 32]} />
          <meshBasicMaterial
            color={STANCE_COLOUR[node.stance]}
            transparent
            opacity={node.stance === 'window' ? 0.16 : 0.07}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      <mesh>
        <planeGeometry args={[node.radius * 2, node.radius * 2]} />
        <meshBasicMaterial map={texture} transparent color={tint} depthWrite={false} />
      </mesh>

      {(selected || node.stance === 'self' || node.stance === 'window') && (
        <SelectionRing radius={node.radius * 1.5} colour={STANCE_COLOUR[node.stance]} spin={selected} />
      )}
    </Billboard>
  );
}

function SelectionRing({
  radius,
  colour,
  spin,
}: {
  radius: number;
  colour: string;
  spin: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (spin && ref.current) ref.current.rotation.z += delta * 0.6;
  });
  return (
    <mesh ref={ref}>
      <ringGeometry args={[radius, radius * 1.06, 48]} />
      <meshBasicMaterial color={colour} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * The disc, drawn so it is a place rather than empty space.
 *
 * Concentric rings and radial spokes on the galactic plane. This is what gives the
 * camera something to orbit *around* — without it, planets float in a void and the
 * tilt reads as random.
 */
export function Disc() {
  const geometry = useMemo(() => {
    const points: number[] = [];
    for (const r of [0.25, 0.5, 0.75, 1]) {
      const radius = DISC_RADIUS * r;
      const segments = 96;
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const b = ((i + 1) / segments) * Math.PI * 2;
        points.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
        points.push(Math.cos(b) * radius, 0, Math.sin(b) * radius);
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      points.push(0, 0, 0);
      points.push(Math.cos(a) * DISC_RADIUS, 0, Math.sin(a) * DISC_RADIUS);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#1f2a3d" transparent opacity={0.5} />
    </lineSegments>
  );
}

/** Depth. Two shells of points so panning produces real parallax. */
export function Starfield() {
  const geometry = useMemo(() => {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Rejection-free shell scatter, well outside the playfield.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = DISC_RADIUS * (2.4 + Math.random() * 2.2);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.55;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#cfe0f5" size={0.035} sizeAttenuation transparent opacity={0.7} />
    </points>
  );
}

/**
 * Asteroids, moving.
 *
 * Positions are a pure function of the clock, so this is the cheapest life the
 * scene can have — a dozen bodies on exact orbits for zero bytes and zero server
 * work. They are public: everyone sees the same rocks in the same places.
 */
export function Asteroids({
  asteroids,
  seasonStart,
}: {
  asteroids: readonly AsteroidSpec[];
  seasonStart: Date;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const positions: Vec3Tuple[] = asteroidPositions(asteroids, seasonStart, Date.now());
    positions.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.set(p[0], p[2], 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, asteroids.length)]}>
      <icosahedronGeometry args={[0.055, 0]} />
      <meshBasicMaterial color="#6b7488" />
    </instancedMesh>
  );
}
