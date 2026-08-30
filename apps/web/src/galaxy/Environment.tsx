import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { paintDiscCanvas, paintNebulaCanvas } from './nebula.js';
import { DISC_RADIUS } from './scene.js';

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

/**
 * THE LIGHT A WORLD SCATTERS AT ITS OWN EDGE. D53a.
 *
 * The planet renders are lit, shaded and finished, and they end at a hard alpha
 * cut — so a world sat on black as a cut-out. Every other object in this scene has
 * something happening at its boundary: a hull sheds a wake, a shield breathes, a
 * rock catches the key light. The worlds, which are what the game is ABOUT, were
 * the only things in the sky with nothing between them and space.
 *
 * What is missing physically is the limb: a thin shell of gas around a planet
 * scatters light forward and sideways, so a lit world is BRIGHTEST right at its
 * edge and that brightness bleeds a little way past the silhouette. It is the
 * single detail that separates a photographed planet from a sphere with a texture
 * on it, and it costs one quad.
 *
 * TWO GRADIENTS, AND BOTH ARE LOAD-BEARING.
 *
 *   THE RADIAL ONE puts the peak just INSIDE where the planet's own edge falls,
 *   not outside it. A ring drawn entirely in the space around a world is a halo —
 *   a marker, which this scene already uses for selection and must not be confused
 *   with. Straddling the silhouette makes it read as the world's own atmosphere
 *   catching the light.
 *
 *   THE LINEAR ONE puts more of it toward the upper left, because that is where
 *   every one of the sixteen planet renders is lit from and where the scene's key
 *   light is. A uniform ring reads as a decal; a limb that is bright on the lit
 *   side and faint on the dark one reads as light. It survives every camera angle
 *   for the same reason the art does: both are billboards, so "upper left" is a
 *   fixed direction on screen and the two can never disagree.
 */
let limb: THREE.Texture | null = null;

export function limbTexture(): THREE.Texture {
  if (limb) return limb;
  // 512 rather than 256: the band this draws is a tenth of the radius wide, and at
  // half this resolution its falloff banded visibly on a world filling the screen.
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size / 2;
    /**
     * A BAND, NOT A CLOUD, and this is the number that decides which.
     *
     * The planet's own edge sits at `1 / LIMB_SCALE` of this quad's half-width —
     * 0.909 at the scale this is drawn with. The peak goes a hair inside it, so the
     * brightest part lands ON the world's rim and only its tail reaches past the
     * silhouette. Photographed first at a peak of 0.71 against a scale of 1.34,
     * which put a grey cloud half a radius deep around every world and drowned the
     * selection ring — the same failure, and the same fix, as `BLAST_SIZE`.
     */
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.865, 'rgba(255,255,255,0.015)');
    g.addColorStop(0.895, 'rgba(255,255,255,0.34)');
    g.addColorStop(0.908, 'rgba(255,255,255,0.76)');
    g.addColorStop(0.928, 'rgba(255,255,255,0.28)');
    g.addColorStop(0.965, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    /**
     * AND THEN NEARLY ALL OF IT IS TAKEN OFF THE DARK SIDE.
     *
     * `destination-in` multiplies the alpha already in the canvas by this one, so
     * the band keeps its shape and only its brightness turns with the light.
     *
     * THE FALLOFF HAS TO BE BRUTAL, and the first two attempts were not. At
     * 1 → 0.62 → 0.24 the band survived the whole way round and read as a grey
     * gasket bolted to the planet, because a ring of even width is a manufactured
     * object and an atmosphere is not. A real limb is a bright crescent on the lit
     * side that fades to NOTHING before it reaches the terminator — so the dark
     * side keeps two per cent, which is under the threshold of being a ring at all.
     */
    ctx.globalCompositeOperation = 'destination-in';
    const lit = ctx.createLinearGradient(0, 0, size, size);
    lit.addColorStop(0, 'rgba(0,0,0,1)');
    lit.addColorStop(0.42, 'rgba(0,0,0,0.3)');
    lit.addColorStop(1, 'rgba(0,0,0,0.015)');
    ctx.fillStyle = lit;
    ctx.fillRect(0, 0, size, size);
  }
  limb = new THREE.CanvasTexture(canvas);
  return limb;
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

/** Stable scenery makes visual regression a comparison, not a new sky each run. */
function randomStream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

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
/** Twenty-five per cent above the approved twelve-minute celestial turn. */
export const STARFIELD_ROTATION_RADIANS_PER_SECOND = ((Math.PI * 2) / (12 * 60)) * 1.25;

export function advanceStarfieldRotation(current: number, delta: number): number {
  if (!Number.isFinite(delta) || delta <= 0) return current;
  return current + delta * STARFIELD_ROTATION_RADIANS_PER_SECOND;
}

/** A sky, not scenery in the playfield: translate with the eye and only rotate around it. */
export function syncStarShell(shell: THREE.Object3D, camera: THREE.Camera, delta: number): void {
  shell.position.copy(camera.position);
  shell.rotation.y = advanceStarfieldRotation(shell.rotation.y, delta);
}

export function Starfield() {
  const ref = useRef<THREE.Points>(null);
  const { geometry, material } = useMemo(() => {
    const random = randomStream(0x5a17f13d);
    const count = 4200;
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const tint = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const theta = random() * Math.PI * 2;
      // Half the sky is in the band, half is scattered everywhere.
      const inBand = random() < 0.5;
      const phi = inBand
        ? Math.PI / 2 + (random() - 0.5) * 0.42
        : Math.acos(2 * random() - 1);
      const r = DISC_RADIUS * (2.8 + random() * 2.6);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Magnitude: cubed uniform, so most stars are faint and a few are not.
      const magnitude = Math.pow(random(), 3);
      // The floor matters more than the ceiling: a sky whose faint stars vanish
      // has empty patches, and empty patches read as a black screen rather than
      // as distance.
      sizes[i] = 0.058 + magnitude * 0.19;

      // 3000K to 11000K, roughly — orange through white to blue-white.
      const warmth = random();
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

  useFrame(({ camera, size, gl }, delta) => {
    if (ref.current) syncStarShell(ref.current, camera, delta);
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.degToRad(perspective.fov || 45);
    material.uniforms.uScale!.value =
      (size.height * gl.getPixelRatio()) / (2 * Math.tan(fov / 2));
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <points
      ref={ref}
      name="background-starfield"
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
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
  const ref = useRef<THREE.Points>(null);
  const { geometry, material } = useMemo(() => {
    const random = randomStream(0xb8194a2f);
    const count = 22;
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const r = DISC_RADIUS * (3.15 + random() * 1.05);
      positions.set(
        [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi) * 0.8,
          r * Math.sin(phi) * Math.sin(theta),
        ],
        i * 3,
      );
      sizes[i] = DISC_RADIUS * (0.035 + random() * 0.045);
      const temperature = random();
      tint.set(temperature < 0.2 ? '#ffd7a6' : temperature > 0.72 ? '#c9e2ff' : '#fff4dd');
      colours.set([tint.r, tint.g, tint.b], i * 3);
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    buffer.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const shader = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 700 } },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      vertexShader: `
        attribute float aSize;
        varying vec3 vColour;
        uniform float uScale;
        void main() {
          vColour = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale / max(0.01, -mv.z), 2.0, 72.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColour;
        void main() {
          vec2 p = gl_PointCoord - vec2(0.5);
          float radius = length(p) * 2.0;
          float halo = (1.0 - smoothstep(0.08, 1.0, radius)) * 0.2;
          float core = 1.0 - smoothstep(0.0, 0.13, radius);
          float horizontal = exp(-abs(p.y) * 92.0) * (1.0 - smoothstep(0.08, 0.5, abs(p.x)));
          float vertical = exp(-abs(p.x) * 92.0) * (1.0 - smoothstep(0.08, 0.5, abs(p.y)));
          float alpha = clamp(halo + core + (horizontal + vertical) * 0.34, 0.0, 1.0);
          gl_FragColor = vec4(vColour * (0.72 + core * 1.1), alpha * 0.66);
        }
      `,
    });
    return { geometry: buffer, material: shader };
  }, []);

  useFrame(({ camera, size, gl }, delta) => {
    if (ref.current) syncStarShell(ref.current, camera, delta);
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.degToRad(perspective.fov || 45);
    material.uniforms.uScale!.value =
      (size.height * gl.getPixelRatio()) / (2 * Math.tan(fov / 2));
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <points
      ref={ref}
      name="background-bright-stars"
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}

/* ── meteors ────────────────────────────────────────────────── */

/** How many can be in the sky at once. More than this and they stop being events. */
const METEOR_POOL = 3;
/** Seconds a streak is visible. */
const METEOR_LIFE = 1.15;
/** Seconds of empty sky between one and the next, per slot. */
export const METEOR_GAP = [3.5, 13] as const;

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
  return <MeteorField />;
}

function MeteorField() {
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
/** Three shared geometries render this many cloud-bound stars each (1,101 total). */
export const CLOUD_STAR_COUNT = 367;

export function Dust() {
  const ref = useRef<THREE.Group>(null);

  const { geometry, material } = useMemo(() => {
    const random = randomStream(0xd057b47a);
    const count = CLOUD_STAR_COUNT;
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const blue = new THREE.Color('#739ed5');
    const warm = new THREE.Color('#c7b38b');
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(random()) * DISC_RADIUS * 1.15;
      const theta = random() * Math.PI * 2;
      const layer = random();
      const halfDepth = DISC_RADIUS * (layer < 0.62 ? 0.1 : layer < 0.9 ? 0.24 : 0.48);
      // A bell-shaped offset rather than a uniform slab: most stars remain close
      // to the cloud's middle, while a sparse tail gives it a readable volume.
      const depth = ((random() + random() + random()) / 3 - 0.5) * halfDepth * 2;
      // Built in the same native XY plane as the painted cloud. The shared
      // orientation table then places one copy in each cloud plane without a
      // second, subtly different coordinate conversion.
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.sin(theta) * r;
      positions[i * 3 + 2] = depth;
      const tint = blue.clone().lerp(warm, random() * 0.22);
      colours.set([tint.r, tint.g, tint.b], i * 3);
      sizes[i] = 0.018 + random() ** 3 * 0.05;
      alphas[i] = 0.12 + random() * 0.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 700 } },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColour;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vColour = color;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale / max(0.01, -mv.z), 1.0, 7.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColour;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
          float alpha = (1.0 - smoothstep(0.18, 1.0, d)) * vAlpha;
          gl_FragColor = vec4(vColour, alpha);
        }
      `,
    });
    return { geometry: g, material: m };
  }, []);

  // The exact same clock, axis and speed as the cloud group. Accumulating delta
  // independently would eventually let two visually coupled groups drift apart.
  useFrame(({ camera, size, gl, clock }) => {
    ref.current?.quaternion.setFromAxisAngle(
      CLOUD_GROUP_ROTATION_AXIS,
      clock.elapsedTime * CLOUD_GROUP_ROTATION_RADIANS_PER_SECOND,
    );
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.degToRad(perspective.fov || 45);
    material.uniforms.uScale!.value =
      (size.height * gl.getPixelRatio()) / (2 * Math.tan(fov / 2));
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <group ref={ref} name="galactic-cloud-stars">
      {CLOUD_LAYER_ROTATIONS.map((rotation, index) => (
        <points
          key={index}
          geometry={geometry}
          material={material}
          rotation={rotation}
          renderOrder={-70 + index}
        />
      ))}
    </group>
  );
}

/* ── the disc ───────────────────────────────────────────────── */

/**
 * THE GALACTIC PLANE. D53b.
 *
 * A disc with nothing in it reads as a scatter plot, so the camera needs something
 * to orbit and the eye needs to know which way is up.
 *
 * This was five rings and sixteen spokes, and then the same rings with their
 * brightness modulated around the circumference. Modulating them was treating the
 * symptom: the graph-paper quality does not come from the lines being even, it
 * comes from them being LINES. Photographed from overhead it still read as a
 * targeting reticle — thin hard strokes at constant width are vector graphics, and
 * there are none of those in a telescope image.
 *
 * TEMPORARY SHALLOW-DEPTH EXPERIMENT. The painted spiral stays untouched as the
 * dominant surface. Two very faint copies sit immediately behind and ahead of it,
 * so an oblique camera sees a soft edge without paying for a ray-marched volume or
 * smearing the source painting into particles.
 */
export function Disc() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const group = useRef<THREE.Group>(null);
  const materials = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    let map: THREE.CanvasTexture | null = null;
    const build = (): void => {
      if (cancelled) return;
      map = new THREE.CanvasTexture(paintDiscCanvas());
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
      map.center.set(0.5, 0.5);
      setTexture(map);
    };
    const supportsIdle = 'requestIdleCallback' in window;
    const handle = supportsIdle
      ? window.requestIdleCallback(build, { timeout: 1200 })
      : window.setTimeout(build, 90);
    return () => {
      cancelled = true;
      if (supportsIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      map?.dispose();
    };
  }, []);

  useFrame(({ clock }, delta) => {
    if (!texture) return;
    materials.current.forEach((material, index) => {
      if (!material) return;
      const layer = CLOUD_DEPTH_LAYERS[index % CLOUD_DEPTH_LAYERS.length];
      if (!layer) return;
      material.opacity = Math.min(layer.opacity, material.opacity + delta * 0.5);
    });
    group.current?.quaternion.setFromAxisAngle(
      CLOUD_GROUP_ROTATION_AXIS,
      clock.elapsedTime * CLOUD_GROUP_ROTATION_RADIANS_PER_SECOND,
    );
  });

  if (!texture) return null;

  return (
    <group ref={group} name="galactic-cloud-group">
      {CLOUD_LAYER_ROTATIONS.map((rotation, index) => (
        <group
          key={index}
          rotation={rotation}
          scale={CLOUD_SPREAD_SCALE}
          name={`galactic-dust-cloud-${String(index + 1)}`}
        >
          {CLOUD_DEPTH_LAYERS.map((layer, layerIndex) => {
            const materialIndex = index * CLOUD_DEPTH_LAYERS.length + layerIndex;
            return (
              <mesh
                key={layer.offset}
                position={[0, 0, layer.offset]}
                scale={layer.scale}
                renderOrder={-86 + materialIndex}
              >
                <planeGeometry args={[DISC_RADIUS * 2.1, DISC_RADIUS * 2.1]} />
                <meshBasicMaterial
                  ref={(node) => { materials.current[materialIndex] = node; }}
                  map={texture}
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  fog={false}
                  toneMapped={false}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/**
 * Three genuinely different volumes through one sun.
 *
 * Rotating three already-horizontal planes around their own Z axis only turns the
 * painting inside the SAME plane, which made all copies stack into one cloud.
 * These are the XY, XZ and YZ orientations, so all three silhouettes remain
 * distinct as their parent group turns. A plane starts in XY; these rotations
 * deliberately move its normal onto each of the three axes.
 */
const CLOUD_LAYER_ROTATIONS: readonly [number, number, number][] = [
  [0, 0, 0],
  [-Math.PI / 2, 0, 0],
  [0, Math.PI / 2, 0],
];

/** Shared verbatim by the cloud painting and its embedded star fields. */
const CLOUD_GROUP_ROTATION_AXIS = new THREE.Vector3(0.38, 1, 0.24).normalize();

/**
 * The centre keeps the exact painted cloud. The two skins only reveal depth at
 * an angle; together they restore the same 0.18 brightness as the original plate.
 */
const CLOUD_DEPTH_LAYERS = [
  { offset: -DISC_RADIUS * 0.012, opacity: 0.0125, scale: 0.995 },
  { offset: 0, opacity: 0.065, scale: 1 },
  { offset: DISC_RADIUS * 0.012, opacity: 0.0125, scale: 1.005 },
] as const;

/** Slightly broader than the original painted plate, without changing its shape. */
export const CLOUD_SPREAD_SCALE = 1.12;

/** Back at the original pace: one quiet 3D revolution every two minutes. */
export const CLOUD_GROUP_ROTATION_RADIANS_PER_SECOND = (Math.PI * 2) / (2 * 60);

/**
 * How bright the plane is allowed to get. Owner decision.
 *
 * IT IS SCENERY, AND SCENERY IS NOT ALLOWED TO BE THE SUBJECT. The first ceiling
 * here was "dimmer than the dimmest thing that has to read against it" — a world
 * the fog has taken down to `STANCE_LIGHT.dark` — and that is a legibility test,
 * not an attention one. It passed 0.38, which the owner looked at and rejected:
 * the arms held the eye, and what a player is meant to be looking at is the
 * worlds.
 *
 * So the rule is stronger than legibility. The plate has to be clearly
 * SUBORDINATE, not merely darker — comfortably under half the dimmest world it
 * sits behind — and the test says so in those terms rather than in this number,
 * because the number is a taste and the relationship is the decision.
 */
export const DISC_OPACITY = 0.18;

/** One turn every two minutes: smooth, visible life in the galactic plane. */
export const DISC_ROTATION_RADIANS_PER_SECOND = (Math.PI * 2) / (2 * 60);

/** Pure so bad frame deltas are held outside the WebGL loop. */
export function advanceDiscRotation(current: number, delta: number): number {
  if (!Number.isFinite(delta) || delta <= 0) return current;
  return current + delta * DISC_ROTATION_RADIANS_PER_SECOND;
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
