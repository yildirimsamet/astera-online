import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AsteroidSpec } from '@blindspace/rules';
import { DISC_RADIUS, asteroidPositions, type Vec3Tuple } from './scene.js';

/**
 * The space the game happens in.
 *
 * Everything here is atmosphere and none of it is information — which is exactly
 * why it has to be cheap. The nebula is painted once to an offscreen canvas and
 * mapped to a backdrop sphere, so it costs one texture and one draw call forever
 * rather than a full-screen procedural shader every frame. Dust and stars are
 * point clouds. The whole environment is under ten draw calls.
 */

/* ── nebula ─────────────────────────────────────────────────── */

/**
 * Painted once, at startup, on a 2D canvas.
 *
 * A procedural fbm shader would look marginally better and would run per-pixel,
 * every frame, on a phone. This runs once and then costs nothing, which is the
 * right trade for something the player is never meant to look at directly.
 */
function paintNebula(): THREE.Texture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = '#04060c';
  ctx.fillRect(0, 0, w, h);

  // Cold clouds low, a warm bloom near the core, and a band of dust across the
  // middle so the horizon reads as a galactic plane rather than a gradient.
  const clouds: [number, number, number, string][] = [
    [0.18, 0.42, 0.34, 'rgba(38, 68, 122, 0.16)'],
    [0.32, 0.62, 0.26, 'rgba(22, 44, 88, 0.14)'],
    [0.54, 0.38, 0.30, 'rgba(74, 48, 116, 0.12)'],
    [0.72, 0.55, 0.34, 'rgba(28, 58, 104, 0.13)'],
    [0.88, 0.34, 0.22, 'rgba(104, 60, 82, 0.09)'],
    [0.06, 0.70, 0.24, 'rgba(46, 32, 78, 0.11)'],
  ];

  ctx.globalCompositeOperation = 'lighter';
  for (const [cx, cy, r, colour] of clouds) {
    const gradient = ctx.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, r * w);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  // Grain, so the clouds have texture instead of reading as airbrush.
  const grain = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 7;
    grain.data[i] = Math.max(0, Math.min(255, (grain.data[i] ?? 0) + n));
    grain.data[i + 1] = Math.max(0, Math.min(255, (grain.data[i + 1] ?? 0) + n));
    grain.data[i + 2] = Math.max(0, Math.min(255, (grain.data[i + 2] ?? 0) + n));
  }
  ctx.putImageData(grain, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export function Nebula() {
  const texture = useMemo(paintNebula, []);
  return (
    <mesh scale={[-1, 1, 1]} renderOrder={-100}>
      <sphereGeometry args={[DISC_RADIUS * 6, 32, 20]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

/* ── the core ───────────────────────────────────────────────── */

/**
 * The galactic core: the scene's one light source and its only anchor.
 *
 * A disc with nothing at the middle reads as a scatter plot. A bright core gives
 * the camera something to be oriented by, and it is what makes the fog and the
 * dust look like they belong to a galaxy.
 */
export function Core() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255, 242, 220, 0.55)');
      g.addColorStop(0.16, 'rgba(255, 200, 138, 0.24)');
      g.addColorStop(0.42, 'rgba(140, 116, 190, 0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <sprite scale={[DISC_RADIUS * 0.45, DISC_RADIUS * 0.45, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
      />
    </sprite>
  );
}

/* ── stars and dust ─────────────────────────────────────────── */

/** Two shells, colour-varied. A field of identical white dots reads as noise. */
export function Starfield() {
  const { geometry, material } = useMemo(() => {
    const count = 2200;
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const tint = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = DISC_RADIUS * (2.6 + Math.random() * 2.4);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Mostly cold, occasionally warm — the variance is what sells it.
      const warm = Math.random() < 0.18;
      tint.setHSL(warm ? 0.08 : 0.58, warm ? 0.5 : 0.35, 0.6 + Math.random() * 0.35);
      colours.set([tint.r, tint.g, tint.b], i * 3);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    const m = new THREE.PointsMaterial({
      size: 0.055,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
    });
    return { geometry: g, material: m };
  }, []);

  return <points geometry={geometry} material={material} />;
}

/**
 * Dust in the disc plane.
 *
 * The thing that makes a camera move feel like it is moving *through* somewhere
 * rather than orbiting a diagram. Additive, close to the plane, and drifting.
 */
export function Dust() {
  const ref = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * DISC_RADIUS * 1.15;
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.9;
      positions[i * 3 + 2] = Math.sin(theta) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const m = new THREE.PointsMaterial({
      color: '#7fa6d8',
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);

  // One slow rotation of the whole field. Cheaper than moving 900 points, and at
  // this speed indistinguishable from it.
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.006;
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}

/* ── the disc ───────────────────────────────────────────────── */

/** Rings and spokes on the galactic plane, so the camera has something to orbit. */
export function Disc() {
  const geometry = useMemo(() => {
    const points: number[] = [];
    for (const fraction of [0.2, 0.4, 0.6, 0.8, 1]) {
      const radius = DISC_RADIUS * fraction;
      const segments = 128;
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const b = ((i + 1) / segments) * Math.PI * 2;
        points.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
        points.push(Math.cos(b) * radius, 0, Math.sin(b) * radius);
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      points.push(Math.cos(a) * DISC_RADIUS * 0.16, 0, Math.sin(a) * DISC_RADIUS * 0.16);
      points.push(Math.cos(a) * DISC_RADIUS, 0, Math.sin(a) * DISC_RADIUS);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#24344f" transparent opacity={0.34} depthWrite={false} />
    </lineSegments>
  );
}

/* ── asteroids ──────────────────────────────────────────────── */

/**
 * Positions are a pure function of the clock, so this is the cheapest life the
 * scene can have: real bodies on exact orbits for zero bytes and zero server work.
 * Public, deterministic, identical for everyone.
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
      dummy.rotation.set(p[0] * 2, p[2] * 2, 0);
      dummy.scale.setScalar(0.9 + ((i % 5) * 0.12));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, asteroids.length)]}>
      <icosahedronGeometry args={[0.07, 0]} />
      <meshBasicMaterial color="#8a94ab" />
    </instancedMesh>
  );
}
