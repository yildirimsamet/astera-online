import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AsteroidSpec } from '@blindspace/rules';
import { paintNebulaCanvas } from './nebula.js';
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
 * The backdrop.
 *
 * Generated rather than painted — see `nebula.ts` for why filaments and dust
 * matter. It is a few hundred milliseconds of CPU, so it is computed AFTER first
 * paint and faded in: the galaxy opens instantly on black and stars, and the gas
 * arrives a moment later. Blocking the first frame on scenery would be the wrong
 * trade in a game people open for four minutes.
 */
export function Nebula() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    let cancelled = false;
    const build = (): void => {
      if (cancelled) return;
      const map = new THREE.CanvasTexture(paintNebulaCanvas());
      map.colorSpace = THREE.SRGBColorSpace;
      map.mapping = THREE.EquirectangularReflectionMapping;
      // Seamless the whole way round; the generator samples on a cylinder.
      map.wrapS = THREE.RepeatWrapping;
      setTexture(map);
    };

    // Yield to the browser so the first frame is already on screen. Safari still
    // has no requestIdleCallback, hence the timeout path.
    const supportsIdle = 'requestIdleCallback' in window;
    const handle = supportsIdle
      ? window.requestIdleCallback(build, { timeout: 900 })
      : window.setTimeout(build, 60);

    return () => {
      cancelled = true;
      if (supportsIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  // Fade in, so the gas arrives rather than appearing.
  useFrame((_, delta) => {
    const m = material.current;
    if (!m || !texture) return;
    if (m.opacity < 1) m.opacity = Math.min(1, m.opacity + delta * 0.9);
  });

  if (!texture) return null;

  return (
    <mesh scale={[-1, 1, 1]} renderOrder={-100}>
      <sphereGeometry args={[DISC_RADIUS * 6, 48, 32]} />
      <meshBasicMaterial
        ref={material}
        map={texture}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        transparent
        opacity={0}
      />
    </mesh>
  );
}

/**
 * A soft radial falloff, built once and shared.
 *
 * `circleGeometry` with additive blending gives a disc with a HARD edge — which is
 * what made the marker behind the player's planet read as a grey plate rather than
 * as light. A glow needs a gradient, and a gradient needs a texture.
 */
let glowTexture: THREE.Texture | null = null;

export function softGlow(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.32, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

/* ── the core ───────────────────────────────────────────────── */

/**
 * The galactic core.
 *
 * A disc with nothing in the middle reads as a scatter plot; this gives the camera
 * something to be oriented by. It is deliberately NOT a sun — the design has no
 * star and planets do not orbit it. The first version was big and bright enough
 * that worlds appeared to be sitting inside it, which invented a piece of fiction
 * the game does not have. Now it is a distant brightening, well inside the radius
 * where any planet is placed.
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
    <sprite scale={[DISC_RADIUS * 0.16, DISC_RADIUS * 0.16, 1]}>
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

/**
 * The starfield.
 *
 * Three things separate a photographed sky from a scatter of white dots, and all
 * three are here:
 *
 *   A POWER LAW. Real skies are overwhelmingly faint stars with a handful of
 *   bright ones. Uniform brightness is the single biggest tell of a fake sky.
 *
 *   TEMPERATURE. Stars run blue-white through yellow to orange. Not a rainbow —
 *   a narrow, physical range.
 *
 *   A GALACTIC BAND. Half the stars are concentrated toward the disc plane, which
 *   is what you see from inside a galaxy, and it ties the sky to the playfield
 *   instead of floating unrelated behind it.
 */
export function Starfield() {
  const { geometry, material } = useMemo(() => {
    const count = 4200;
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const tint = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      // Half the sky is in the band, half is scattered everywhere.
      const inBand = Math.random() < 0.5;
      const phi = inBand
        ? Math.PI / 2 + (Math.random() - 0.5) * 0.42
        : Math.acos(2 * Math.random() - 1);
      const r = DISC_RADIUS * (2.8 + Math.random() * 2.6);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Magnitude: cubed uniform, so most stars are faint and a few are not.
      const magnitude = Math.pow(Math.random(), 3);
      // The floor matters more than the ceiling: a sky whose faint stars vanish
      // has empty patches, and empty patches read as a black screen rather than
      // as distance.
      sizes[i] = 0.058 + magnitude * 0.19;

      // 3000K to 11000K, roughly — orange through white to blue-white.
      const warmth = Math.random();
      const hue = warmth < 0.22 ? 0.07 : warmth < 0.55 ? 0.13 : 0.58;
      const saturation = warmth < 0.55 ? 0.45 : 0.28;
      tint.setHSL(hue, saturation, 0.66 + magnitude * 0.34);
      colours.set([tint.r, tint.g, tint.b], i * 3);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    /**
     * A tiny shader, for one reason: per-star size.
     *
     * `PointsMaterial` has a single size for the whole cloud, which forces every
     * star to the same brightness and throws away the power law above. Eleven
     * lines of GLSL buy the entire effect.
     */
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: { uScale: { value: 700 } },
      vertexShader: `
        attribute float size;
        varying vec3 vColour;
        uniform float uScale;
        void main() {
          vColour = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColour;
        void main() {
          // Round, with a soft falloff — a square star is a dead giveaway.
          float d = length(gl_PointCoord - vec2(0.5));
          float alpha = smoothstep(0.5, 0.06, d);
          gl_FragColor = vec4(vColour, alpha);
        }
      `,
      vertexColors: true,
    });

    return { geometry: g, material: m };
  }, []);

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/**
 * The brightest stars, with diffraction spikes.
 *
 * The four-point cross is the visual signature of a telescope photograph — it
 * comes from the vanes holding the secondary mirror, and it is the single detail
 * that makes an image read as Hubble rather than as a wallpaper. Twenty sprites,
 * so it costs nothing.
 */
export function BrightStars() {
  const texture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const c = size / 2;
    const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
    halo.addColorStop(0, 'rgba(255,255,255,0.9)');
    halo.addColorStop(0.1, 'rgba(220,235,255,0.32)');
    halo.addColorStop(0.36, 'rgba(180,210,255,0.06)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);

    // The spikes themselves: two tapered bars, drawn as gradients so they fade.
    ctx.globalCompositeOperation = 'lighter';
    for (const vertical of [false, true]) {
      const g = vertical
        ? ctx.createLinearGradient(0, 0, 0, size)
        : ctx.createLinearGradient(0, 0, size, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.44, 'rgba(255,255,255,0.16)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.56, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      if (vertical) ctx.fillRect(c - 1, 0, 2, size);
      else ctx.fillRect(0, c - 1, size, 2);
    }

    return new THREE.CanvasTexture(canvas);
  }, []);

  const stars = useMemo(
    () =>
      Array.from({ length: 22 }, () => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = DISC_RADIUS * 3.6;
        return {
          position: [
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi) * 0.8,
            r * Math.sin(phi) * Math.sin(theta),
          ] as [number, number, number],
          // Halved. At the old size a foreground star was wider than a planet and
          // read as a lens flare stuck to the screen rather than as something far
          // away — the giveaway that a backdrop is painted rather than deep.
          scale: DISC_RADIUS * (0.05 + Math.random() * 0.055),
        };
      }),
    [],
  );

  return (
    <>
      {stars.map((star, i) => (
        <sprite key={i} position={star.position} scale={[star.scale, star.scale, 1]}>
          <spriteMaterial
            map={texture}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={false}
            opacity={0.42}
          />
        </sprite>
      ))}
    </>
  );
}

/* ── meteors ────────────────────────────────────────────────── */

/** How many can be in the sky at once. More than this and they stop being events. */
const METEOR_POOL = 3;
/** Seconds a streak is visible. */
const METEOR_LIFE = 1.15;
/** Seconds of empty sky between one and the next, per slot. */
const METEOR_GAP = [7, 26] as const;

interface Meteor {
  from: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  length: number;
  /** Seconds until it appears; negative means it is already flying. */
  wait: number;
  age: number;
}

const spawn = (): Meteor => {
  // Somewhere in the shell around the disc rather than out on the backdrop: a
  // streak on the far sphere is a pixel and reads as a dead one.
  const theta = Math.random() * Math.PI * 2;
  const radius = DISC_RADIUS * (0.7 + Math.random() * 1.1);
  const height = (Math.random() - 0.5) * DISC_RADIUS * 0.9;
  const from = new THREE.Vector3(radius * Math.cos(theta), height, radius * Math.sin(theta));

  // Mostly across the view rather than toward or away from it, which is what makes
  // the motion legible — a meteor flying at the camera is a dot that grows.
  const direction = new THREE.Vector3(
    Math.random() - 0.5,
    (Math.random() - 0.5) * 0.35,
    Math.random() - 0.5,
  ).normalize();

  return {
    from,
    direction,
    speed: DISC_RADIUS * (0.5 + Math.random() * 0.55),
    length: DISC_RADIUS * (0.05 + Math.random() * 0.06),
    wait: Math.random() * METEOR_GAP[1],
    age: 0,
  };
};

/**
 * Shooting stars.
 *
 * The same idea as the asteroids — a body moving on a path — and every parameter
 * is the opposite: small, quick, over in a second, and gone. They exist because a
 * galaxy that only moves at asteroid speed reads as a diagram that drifts; a thing
 * that flashes past and is missed if you blink is what makes it feel observed
 * rather than drawn.
 *
 * Purely local. Nothing here is seeded from the season and nothing is fetched:
 * this carries no information, so two players seeing different meteors costs the
 * game nothing and costs the server nothing.
 *
 * ONE DRAW CALL. Every streak lives in a single line buffer, head bright and tail
 * transparent through vertex colours, so the whole effect is two vertices per
 * meteor and no per-object overhead.
 */
export function Meteors() {
  const ref = useRef<THREE.LineSegments>(null);
  const meteors = useMemo(() => Array.from({ length: METEOR_POOL }, spawn), []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(METEOR_POOL * 6), 3));
    const colours = new Float32Array(METEOR_POOL * 6);
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return g;
  }, []);

  useFrame((state, delta) => {
    const node = ref.current;
    if (!node) return;
    const position = node.geometry.getAttribute('position');
    const colour = node.geometry.getAttribute('color');

    meteors.forEach((meteor, i) => {
      if (meteor.wait > 0) {
        meteor.wait -= delta;
        // Parked at the origin with black vertices: invisible under additive
        // blending, and no branch needed in the draw.
        position.setXYZ(i * 2, 0, 0, 0);
        position.setXYZ(i * 2 + 1, 0, 0, 0);
        colour.setXYZ(i * 2, 0, 0, 0);
        colour.setXYZ(i * 2 + 1, 0, 0, 0);
        return;
      }

      meteor.age += delta;
      if (meteor.age > METEOR_LIFE) {
        const next = spawn();
        next.wait = METEOR_GAP[0] + Math.random() * (METEOR_GAP[1] - METEOR_GAP[0]);
        meteors[i] = next;
        return;
      }

      const t = meteor.age / METEOR_LIFE;
      // In and out: a streak that pops on and cuts off reads as a rendering fault.
      const brightness = Math.sin(Math.PI * t) ** 0.7;
      const travelled = meteor.speed * meteor.age;

      const head = meteor.direction.clone().multiplyScalar(travelled).add(meteor.from);
      const tail = meteor.direction.clone().multiplyScalar(-meteor.length).add(head);

      position.setXYZ(i * 2, head.x, head.y, head.z);
      position.setXYZ(i * 2 + 1, tail.x, tail.y, tail.z);
      colour.setXYZ(i * 2, brightness, brightness * 0.97, brightness * 0.9);
      colour.setXYZ(i * 2 + 1, 0, 0, 0);
    });

    position.needsUpdate = true;
    colour.needsUpdate = true;

    // The scene renders on demand at twelve frames a second, which is plenty for a
    // rock on a forty-minute orbit and useless for something crossing the sky in
    // one second. While anything is in flight, ask for the next frame.
    if (meteors.some((m) => m.wait <= 0)) state.invalidate();
  });

  return (
    <lineSegments ref={ref} geometry={geometry} frustumCulled={false} renderOrder={-50}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
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
 * Asteroids.
 *
 * Positions are a pure function of the clock — real bodies on exact orbits for
 * zero bytes and zero server work, identical for everyone.
 *
 * They used to render as pale flat hexagons and read as rendering artefacts
 * rather than rocks: no shading, no scale cue, brighter than the worlds they were
 * next to. Now they are small, dark, lit from the same direction as everything
 * else, and each one tumbles on its own axis so they are legibly OBJECTS.
 */
/** How far back along the orbit the tail reaches, in minutes of travel. */
const TAIL_MINUTES = 0.5;

/**
 * A rock, generated rather than modelled.
 *
 * An icosahedron with every vertex pushed in or out by a hash of its own position:
 * lumpy, faceted, and different for every seed. This is one of the few places
 * where procedural geometry genuinely beats an asset — real asteroids are
 * irregular lumps, which is exactly what noise produces, and three variants at
 * thirty lines cost nothing to load.
 */
function rockGeometry(seed: number): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(0.075, 1);
  const position = geometry.getAttribute('position');
  const v = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    // Hash the direction, so shared vertices displace identically and the surface
    // stays closed rather than splitting at the seams.
    const h = Math.sin(v.x * 91.7 + v.y * 47.3 + v.z * 133.1 + seed * 12.9) * 43758.5453;
    const jitter = 0.72 + (h - Math.floor(h)) * 0.62;
    v.multiplyScalar(jitter);
    position.setXYZ(i, v.x, v.y, v.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function Asteroids({
  asteroids,
  seasonStart,
}: {
  asteroids: readonly AsteroidSpec[];
  seasonStart: Date;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const trails = useRef<THREE.LineSegments>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rock = useMemo(() => rockGeometry(7), []);

  /**
   * The tails.
   *
   * Two vertices per rock — where it is, and where it was half a minute ago — in
   * one buffer, so every trail in the galaxy is a single draw call. The head is
   * lit and the tail is transparent, which is what makes the direction readable at
   * a glance: without it these are just rocks sitting in space.
   */
  const trailGeometry = useMemo(() => {
    const count = Math.max(1, asteroids.length);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));

    const colours = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      colours.set([0.62, 0.68, 0.82], i * 6); // head
      colours.set([0, 0, 0], i * 6 + 3); // tail, faded to nothing
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return g;
  }, [asteroids.length]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const now = Date.now();
    const positions: Vec3Tuple[] = asteroidPositions(asteroids, seasonStart, now);
    const behind: Vec3Tuple[] = asteroidPositions(
      asteroids,
      seasonStart,
      now - TAIL_MINUTES * 60_000,
    );

    const line = trails.current;
    if (line) {
      const attribute = line.geometry.getAttribute('position');
      positions.forEach((p, i) => {
        const was = behind[i] ?? p;
        attribute.setXYZ(i * 2, p[0], p[1], p[2]);
        attribute.setXYZ(i * 2 + 1, was[0], was[1], was[2]);
      });
      attribute.needsUpdate = true;
    }

    positions.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      // Tumbling, keyed off position so it is deterministic and drifts as it orbits.
      dummy.rotation.set(p[0] * 3, p[2] * 3, p[0] * p[2]);
      dummy.scale.setScalar(0.7 + ((i % 5) * 0.22));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <lineSegments ref={trails} geometry={trailGeometry} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <instancedMesh
        ref={ref}
        args={[rock, undefined, Math.max(1, asteroids.length)]}
        frustumCulled={false}
      >
        {/* Lambert, not basic: a flat fill is what made these read as bugs. */}
        <meshLambertMaterial color="#5a5f6d" emissive="#0d1119" flatShading />
      </instancedMesh>
    </>
  );
}
