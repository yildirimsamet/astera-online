import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { paintDiscCanvas } from './nebula.js';
import { DISC_RADIUS } from './scene.js';
import { METEOR_CLOCK, meteorStep, type MeteorClock } from './frames.js';
import {
  METEOR_HEAD_FRAGMENT,
  METEOR_HEAD_VERTEX,
  METEOR_RIBBON_FRAGMENT,
  METEOR_RIBBON_VERTEX,
  meteorTrail,
  type MeteorPath,
} from './meteor.js';
import { useRenderQuality } from '../lib/quality.js';
import {
  GALACTIC_ACROSS,
  GALACTIC_CENTRE,
  MILKY_WAY_POLE,
  SKY_BAKE_FRAGMENT,
  SKY_BAKE_SIZE,
  SKY_BAKE_VERTEX,
  SKY_FRAGMENT,
  SKY_GALAXY_CARDS,
  SKY_LUMINANCE_CEILING,
  SKY_RADIUS,
  SKY_SITES,
  SKY_DEEP_STAR_COUNT,
  SKY_STAR_COUNT,
  SKY_VERTEX,
  STAR_FRAGMENT,
  STAR_BACKDROP_CLIP,
  STAR_TWINKLE_DEPTH,
  STAR_VERTEX,
  DEEP_STAR_VERTEX,
  GALAXY_BAKE_FRAGMENT,
  GALAXY_BAKE_VERTEX,
  HERO_CARD_SPAN,
  galaxyCardSize,
  heroCardCorners,
  skyBakeStep,
  buildDeepStars,
  buildSkyStars,
  type SkyGalaxy,
  type SkySite,
} from './sky.js';

/**
 * The space the game happens in.
 *
 * Everything here is atmosphere and none of it is information — which is exactly
 * why it has to be cheap. The sky's gas is baked ONCE on the GPU into a cube map
 * (`sky.ts` has the whole argument) and drawn afterwards as one texture read a
 * pixel; its stars are point clouds in one draw call each; the disc's dust is a
 * painted plate. The whole environment is about ten draw calls.
 */

/* ── the sky ────────────────────────────────────────────────── */

/** Transparent sky draws after opaque worlds; read their depth so it stays behind them. */
export function skyBehindPlanets<T extends THREE.Material>(material: T): T {
  material.depthTest = true;
  material.depthWrite = false;
  return material;
}

const siteUniform = (site: SkySite): THREE.Vector4 =>
  new THREE.Vector4(
    site.direction[0],
    site.direction[1],
    site.direction[2],
    Math.cos((site.radius * Math.PI) / 180),
  );

const galaxySiteUniform = (galaxy: SkyGalaxy): THREE.Vector4 =>
  new THREE.Vector4(
    galaxy.direction[0],
    galaxy.direction[1],
    galaxy.direction[2],
    Math.tan((galaxy.radius * Math.PI) / 180),
  );

const galaxyShapeUniform = (galaxy: SkyGalaxy): THREE.Vector4 => {
  const turn = (galaxy.turn * Math.PI) / 180;
  return new THREE.Vector4(
    Math.cos(turn),
    Math.sin(turn),
    Math.cos((galaxy.tilt * Math.PI) / 180),
    galaxy.brightness,
  );
};

/**
 * A galaxy's own sharp card: a render target it is baked into once, the scene
 * that bakes it, and the quad on the sky that shows it. See `heroCardCorners`.
 */
function galaxyCard(galaxy: SkyGalaxy, index: number) {
  const size = galaxyCardSize(galaxy);
  const target = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const bakeMaterial = new THREE.ShaderMaterial({
    vertexShader: GALAXY_BAKE_VERTEX,
    fragmentShader: GALAXY_BAKE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    uniforms: {
      uShape: { value: galaxyShapeUniform(galaxy) },
      uSpan: { value: HERO_CARD_SPAN },
      uSeed: { value: 3 + index * 7 },
      uCore: { value: new THREE.Vector3(...galaxy.palette.core) },
      uArms: { value: new THREE.Vector3(...galaxy.palette.arms) },
      uKnots: { value: new THREE.Vector3(...galaxy.palette.knots) },
    },
  });
  const quad = new THREE.PlaneGeometry(2, 2);
  const quadMesh = new THREE.Mesh(quad, bakeMaterial);
  quadMesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quadMesh);
  const camera = new THREE.OrthographicCamera();

  const corners = heroCardCorners(galaxy, SKY_RADIUS * 0.92);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(corners.flat()), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  const material = skyBehindPlanets(new THREE.MeshBasicMaterial({
    map: target.texture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  }));
  return { target, bakeMaterial, quad, scene, camera, geometry, material };
}

/** How long the baked gas takes to arrive once it exists. */
const SKY_FADE_SECONDS = 1.1;

/**
 * THE SKY: baked gas and live stars, turning together. See `sky.ts` for why it is
 * split the way it is.
 *
 * ONE FACE A FRAME. The bake is the only expensive thing here and it runs once;
 * spreading its six faces over six frames keeps any single frame on a slow phone
 * from stalling behind it. It starts after first paint, and the gas fades in —
 * the galaxy opens on stars, and the Milky Way arrives a moment later.
 *
 * A LOST CONTEXT TAKES THE BAKE WITH IT. Textures are re-uploaded from memory
 * after a restore; a render target has no memory to come back from. So the sky
 * listens for the restore itself and bakes again — the landing page has no
 * `gpuContext` to tell it.
 *
 * CAMERA-CENTRED, AS A SKY MUST BE. Gas, stars and diffraction-spiked stars all
 * ride one shell that follows the eye and turns at the approved celestial rate,
 * so a star can never drift across the cloud it sits in.
 */
export function Sky() {
  const quality = useRenderQuality();
  const bakeSize = SKY_BAKE_SIZE[quality];
  const starCount = SKY_STAR_COUNT[quality];
  const deepCount = SKY_DEEP_STAR_COUNT[quality];
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const shell = useRef<THREE.Group>(null);
  /** The next bake step (`skyBakeStep`); −1 until first paint. */
  const step = useRef(-1);
  /** How far the baked gas and the hero card have faded in, 0–1. */
  const fade = useRef(0);

  const bake = useMemo(() => {
    const target = new THREE.WebGLCubeRenderTarget(bakeSize, {
      type: THREE.UnsignedByteType,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    // Stored sRGB-encoded by the hardware, so the near-black end — which is
    // nearly all of it — keeps its precision instead of banding.
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.ShaderMaterial({
      vertexShader: SKY_BAKE_VERTEX,
      fragmentShader: SKY_BAKE_FRAGMENT,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      uniforms: {
        uPole: { value: new THREE.Vector3(...MILKY_WAY_POLE) },
        uCentre: { value: new THREE.Vector3(...GALACTIC_CENTRE) },
        uAcross: { value: new THREE.Vector3(...GALACTIC_ACROSS) },
        uBulge: { value: 1 - Math.cos((SKY_SITES.bulge.radius * Math.PI) / 180) },
        uEmission: { value: SKY_SITES.emission.map(siteUniform) },
        uEmissionOxygen: { value: SKY_SITES.emission.map((cloud) => cloud.oxygen) },
        uEmissionShape: {
          value: SKY_SITES.emission.map(
            (cloud) =>
              new THREE.Vector4(
                Math.cos((cloud.turn * Math.PI) / 180),
                Math.sin((cloud.turn * Math.PI) / 180),
                cloud.stretch,
                Math.tan((cloud.radius * Math.PI) / 180),
              ),
          ),
        },
        uReflection: { value: SKY_SITES.reflection.map(siteUniform) },
        uDark: { value: siteUniform(SKY_SITES.dark) },
        uGalaxy: { value: SKY_SITES.galaxies.map(galaxySiteUniform) },
        uGalaxyShape: { value: SKY_SITES.galaxies.map(galaxyShapeUniform) },
        uGalaxyCore: { value: SKY_SITES.galaxies.map((g) => new THREE.Vector3(...g.palette.core)) },
        uGalaxyArms: { value: SKY_SITES.galaxies.map((g) => new THREE.Vector3(...g.palette.arms)) },
        uGalaxyKnots: { value: SKY_SITES.galaxies.map((g) => new THREE.Vector3(...g.palette.knots)) },
        uCeiling: { value: SKY_LUMINANCE_CEILING },
      },
    });
    const geometry = new THREE.SphereGeometry(1, 48, 24);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.CubeCamera(0.01, 10, target);
    return { target, material, geometry, scene, camera };
  }, [bakeSize]);

  const cards = useMemo(() => SKY_GALAXY_CARDS.map(galaxyCard), []);

  const gas = useMemo(
    () =>
      skyBehindPlanets(new THREE.ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: {
          uSky: { value: bake.target.texture },
          uOpacity: { value: 0 },
        },
      })),
    [bake],
  );

  const stars = useMemo(() => {
    const field = buildSkyStars(starCount, 0x5a17f13d);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(field.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(field.colours, 3));
    geometry.setAttribute('aFlux', new THREE.BufferAttribute(field.flux, 1));
    geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(field.twinkle, 2));
    const material = skyBehindPlanets(new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: {
        uSky: { value: bake.target.texture },
        uSkyReady: { value: 0 },
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        uTwinkleDepth: { value: STAR_TWINKLE_DEPTH },
      },
    }));
    return { geometry, material };
  }, [starCount, bake]);

  const deep = useMemo(() => {
    const field = buildDeepStars(deepCount, 0x2bd1e6a5);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(field.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(field.colours, 3));
    geometry.setAttribute('aFlux', new THREE.BufferAttribute(field.flux, 1));
    const material = skyBehindPlanets(new THREE.ShaderMaterial({
      vertexShader: DEEP_STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: { uPixelRatio: { value: 1 } },
    }));
    return { geometry, material };
  }, [deepCount]);

  // Start after first paint; restart after a lost context comes back.
  useEffect(() => {
    let cancelled = false;
    const begin = (): void => {
      if (cancelled) return;
      step.current = 0;
      fade.current = 0;
      gas.uniforms.uOpacity!.value = 0;
      for (const card of cards) card.material.opacity = 0;
      stars.material.uniforms.uSkyReady!.value = 0;
      invalidate();
    };
    const supportsIdle = 'requestIdleCallback' in window;
    const handle = supportsIdle
      ? window.requestIdleCallback(begin, { timeout: 900 })
      : window.setTimeout(begin, 60);
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextrestored', begin);
    return () => {
      cancelled = true;
      if (supportsIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      canvas.removeEventListener('webglcontextrestored', begin);
    };
  }, [gl, gas, cards, stars, invalidate]);

  useEffect(
    () => () => {
      bake.target.dispose();
      bake.material.dispose();
      bake.geometry.dispose();
    },
    [bake],
  );
  useEffect(() => () => { gas.dispose(); }, [gas]);
  useEffect(
    () => () => {
      for (const card of cards) {
        card.target.dispose();
        card.bakeMaterial.dispose();
        card.quad.dispose();
        card.geometry.dispose();
        card.material.dispose();
      }
    },
    [cards],
  );
  useEffect(
    () => () => {
      stars.geometry.dispose();
      stars.material.dispose();
    },
    [stars],
  );
  useEffect(
    () => () => {
      deep.geometry.dispose();
      deep.material.dispose();
    },
    [deep],
  );

  useFrame(({ camera, clock }, delta) => {
    if (shell.current) syncStarShell(shell.current, camera, delta);
    stars.material.uniforms.uPixelRatio!.value = gl.getPixelRatio();
    // The shimmer rides whatever frames the scene is already drawing; it never
    // asks for one of its own.
    stars.material.uniforms.uTime!.value = clock.elapsedTime;
    deep.material.uniforms.uPixelRatio!.value = gl.getPixelRatio();

    const work = skyBakeStep(step.current, bakeSize);
    if (work.kind === 'face' || work.kind === 'card') {
      const previous = gl.getRenderTarget();
      if (work.kind === 'face') {
        const cube = bake.camera;
        if (cube.coordinateSystem !== gl.coordinateSystem) {
          cube.coordinateSystem = gl.coordinateSystem;
          cube.updateCoordinateSystem();
        }
        // The render target carries its own scissor; three applies it on bind.
        bake.target.scissor.set(0, work.y, bakeSize, work.rows);
        bake.target.scissorTest = true;
        gl.setRenderTarget(bake.target, work.face);
        gl.render(bake.scene, cube.children[work.face] as THREE.Camera);
        bake.target.scissorTest = false;
      } else {
        const card = cards[work.index];
        if (card) {
          gl.setRenderTarget(card.target);
          gl.render(card.scene, card.camera);
        }
        stars.material.uniforms.uSkyReady!.value = 1;
      }
      gl.setRenderTarget(previous);
      step.current += 1;
      invalidate();
      return;
    }

    if (work.kind === 'done' && fade.current < 1) {
      fade.current = Math.min(1, fade.current + delta / SKY_FADE_SECONDS);
      gas.uniforms.uOpacity!.value = fade.current;
      for (const card of cards) card.material.opacity = fade.current;
      invalidate();
    }
  });

  return (
    <>
    <group ref={shell} name="sky">
      <mesh scale={SKY_RADIUS} renderOrder={-100} frustumCulled={false} material={gas}>
        <sphereGeometry args={[1, 48, 24]} />
      </mesh>
      {cards.map((card, index) => (
        <mesh
          key={index}
          name={index === 0 ? 'hero-galaxy' : `galaxy-card-${String(index)}`}
          geometry={card.geometry}
          material={card.material}
          renderOrder={-99.5}
          frustumCulled={false}
        />
      ))}
      <points
        name="background-starfield"
        geometry={stars.geometry}
        material={stars.material}
        scale={SKY_RADIUS * 0.9}
        renderOrder={-99}
        frustumCulled={false}
      />
    </group>
    {/* In the world, not on the shell: these are the ones that move against the sky. */}
    <points
      name="deep-starfield"
      geometry={deep.geometry}
      material={deep.material}
      renderOrder={-98}
      frustumCulled={false}
    />
    </>
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
 *   THE RADIAL ONE puts the peak just OUTSIDE the opaque silhouette. The old peak
 *   was hidden by the body's depth test. Its tail ends well before the selection
 *   marker, so it reads as edge light rather than a second marker.
 *
 *   THE LINEAR ONE puts more of it toward the upper left, because that is where
 *   every one of the sixteen planet renders is lit from and where the scene's key
 *   light is. A uniform ring reads as a decal; a limb that is bright on the lit
 *   side and faint on the dark one reads as light. It survives every camera angle
 *   for the same reason the art does: both are billboards, so "upper left" is a
 *   fixed direction on screen and the two can never disagree.
 */
let limb: THREE.Texture | null = null;

/** The brightest part sits just outside the opaque sphere, so it survives depth testing. */
export const LIMB_PEAK = 0.9;

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
     * The planet's edge sits at `1 / LIMB_SCALE` of this quad's half-width.
     * The glow is rendered behind the opaque sphere, so a peak inside that edge
     * was hidden by depth testing. Keep the bright band a few percent outside the
     * silhouette, with a short tail that stops well before the selection ring.
     */
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.84, 'rgba(255,255,255,0)');
    g.addColorStop(0.875, 'rgba(255,255,255,0.18)');
    g.addColorStop(LIMB_PEAK, 'rgba(255,255,255,0.72)');
    g.addColorStop(0.925, 'rgba(255,255,255,0.52)');
    g.addColorStop(0.965, 'rgba(255,255,255,0.09)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    /**
     * THE LIT SIDE LEADS, while a trace remains around the dark side.
     *
     * `destination-in` multiplies the alpha already in the canvas by this one, so
     * the band keeps its shape and only its brightness turns with the light.
     *
     * With the old 1 → 0.3 → 0.015 falloff the dark side vanished entirely.
     * A narrow, coloured trace on that side keeps the requested neon visible all
     * around the world without making it look like a selection marker.
     */
    ctx.globalCompositeOperation = 'destination-in';
    const lit = ctx.createLinearGradient(0, 0, size, size);
    lit.addColorStop(0, 'rgba(0,0,0,1)');
    lit.addColorStop(0.42, 'rgba(0,0,0,0.55)');
    lit.addColorStop(1, 'rgba(0,0,0,0.22)');
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
/** The core's colour stops, as they were painted: radius, RGB (0–255), alpha. */
const CORE_STOPS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 255, 242, 220, 0.55],
  [0.16, 255, 200, 138, 0.24],
  [0.42, 150, 122, 98, 0.07],
  [1, 0, 0, 0, 0],
];

/**
 * The core's falloff at a radius (0 centre, 1 edge): RGB 0–1 and alpha. Eased
 * between stops rather than linear, so no stop shows as a ring.
 */
export function coreProfile(r: number): [number, number, number, number] {
  if (!(r >= 0)) r = 0;
  if (r >= 1) return [0, 0, 0, 0];
  let i = 0;
  while (i < CORE_STOPS.length - 2 && r > CORE_STOPS[i + 1]![0]) i += 1;
  const a = CORE_STOPS[i]!;
  const b = CORE_STOPS[i + 1]!;
  const t = (r - a[0]) / (b[0] - a[0]);
  const eased = t * t * (3 - 2 * t);
  const mixAt = (k: number): number => a[k]! + (b[k]! - a[k]!) * eased;
  return [mixAt(1) / 255, mixAt(2) / 255, mixAt(3) / 255, mixAt(4)];
}

/**
 * THE CORE'S TEXTURE IS COMPUTED, and in half float. It used to be a canvas radial
 * gradient, which Chrome paints with an ordered 4×4 dither; this sprite magnifies
 * it enough that the dither showed as a grid of coloured dots across the middle of
 * the galaxy. Half float also keeps the faint tail from banding into rings.
 */
function coreTexture(): THREE.DataTexture {
  const size = 128;
  const data = new Uint16Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      const texel = coreProfile(r);
      const p = (y * size + x) * 4;
      for (let c = 0; c < 4; c++) data[p + c] = THREE.DataUtils.toHalfFloat(texel[c]!);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function Core() {
  const texture = useMemo(coreTexture, []);
  useEffect(() => () => { texture.dispose(); }, [texture]);

  return (
    // The central glow is 30% of its former diameter, per the owner's 70% reduction.
    <sprite scale={[DISC_RADIUS * 0.048, DISC_RADIUS * 0.048, 1]}>
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
 * THE CELESTIAL TURN. The whole sky shell — gas, stars, galaxies — turns about the
 * vertical at one rate, so no star ever drifts across the cloud it sits in. The
 * starfield itself lives in `Sky` now; `sky.ts` has why it is built the way it is.
 */
/**
 * One turn every 19.2 minutes. It was twenty-five per cent above the approved
 * twelve-minute turn (9.6 minutes); owner, 2026-09-25: *"çok hızlı dönüyor: %50
 * oranında daha yavaş dönsün"* — a galaxy on the sky was carried out of the frame
 * in about twenty seconds.
 */
export const STARFIELD_ROTATION_RADIANS_PER_SECOND = ((Math.PI * 2) / (12 * 60)) * 1.25 * 0.5;

export function advanceStarfieldRotation(current: number, delta: number): number {
  if (!Number.isFinite(delta) || delta <= 0) return current;
  return current + delta * STARFIELD_ROTATION_RADIANS_PER_SECOND;
}

/** A sky, not scenery in the playfield: translate with the eye and only rotate around it. */
export function syncStarShell(shell: THREE.Object3D, camera: THREE.Camera, delta: number): void {
  shell.position.copy(camera.position);
  shell.rotation.y = advanceStarfieldRotation(shell.rotation.y, delta);
}

/**
 * The brightest stars, with diffraction spikes.
 *
 * The four-point cross is the visual signature of a telescope photograph — it
 * comes from the vanes holding the secondary mirror, and it is the single detail
 * that makes an image read as Hubble rather than as a wallpaper. Twenty sprites,
 * so it costs nothing.
 */
export const BRIGHT_STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  varying vec3 vColour;
  uniform float uScale;
  void main() {
    vColour = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / max(0.01, -mv.z), 2.0, 72.0);
    gl_Position = projectionMatrix * mv;
    ${STAR_BACKDROP_CLIP}
  }
`;

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
      vertexShader: BRIGHT_STAR_VERTEX,
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
export const METEOR_POOL = 3;

/**
 * HOW MUCH BUSIER THE SKY GETS DURING AN ASTEROID SHOWER. Owner instruction.
 *
 * D149's shower is the one public moment the whole galaxy shares, and it was
 * announced by a line of text in a corner. Three times the shooting stars for
 * exactly as long as it runs makes the SKY the announcement — somebody who never
 * reads the caption still looks up and sees that something is happening, which is
 * the entire point of a public event.
 *
 * IT COSTS NOTHING AND MEANS NOTHING. Meteors are local decoration: nothing here
 * is seeded from the season and nothing is fetched, so this carries no information
 * and two players seeing different streaks costs the game nothing. It is the sky
 * reacting, not a reading — the rock field is where the event actually happens.
 */
export const METEOR_SHOWER_MULTIPLIER = 3;

/** How many streaks the sky carries right now. Back to normal when the event ends. */
export const meteorPool = (shower: boolean): number =>
  shower ? METEOR_POOL * METEOR_SHOWER_MULTIPLIER : METEOR_POOL;
/** Seconds of empty sky between one and the next, per slot. */
export const METEOR_GAP = [3.5, 13] as const;

interface Meteor extends MeteorPath {
  /** Seconds until it appears. */
  wait: number;
  age: number;
}

const spawn = (): Meteor => {
  // Somewhere in the shell around the disc rather than out on the backdrop: a
  // streak on the far sphere is a pixel and reads as a dead one.
  const theta = Math.random() * Math.PI * 2;
  const radius = DISC_RADIUS * (0.7 + Math.random() * 1.1);
  const height = (Math.random() - 0.5) * DISC_RADIUS * 0.9;

  // Mostly across the view rather than toward or away from it, which is what makes
  // the motion legible — a meteor flying at the camera is a dot that grows.
  const x = Math.random() - 0.5;
  const y = (Math.random() - 0.5) * 0.35;
  const z = Math.random() - 0.5;
  const norm = Math.hypot(x, y, z) || 1;

  return {
    from: [radius * Math.cos(theta), height, radius * Math.sin(theta)],
    direction: [x / norm, y / norm, z / norm],
    speed: DISC_RADIUS * (0.5 + Math.random() * 0.55),
    length: DISC_RADIUS * (0.14 + Math.random() * 0.16),
    // At full brightness; it then fades over `METEOR_FADE`, still flying, so the
    // whole streak is on screen for about one and a half seconds.
    life: 0.35 + Math.random() * 0.4,
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
 * A HEAD AND A FADING TRAIL. Owner, 2026-09-25: *"Laglı gibi kayıyorlar. Daha güzel
 * olsun arkasında sönen ışık bırakıyor gibi olsun."* `meteor.ts` has the path —
 * a burning head that never stops, fading as it flies — and this only writes it
 * into two buffers: one ribbon draw for every trail, one point draw for
 * every head. It moves on every frame the disc draws and asks for none of its own.
 */
export function Meteors({ shower = false }: { shower?: boolean }) {
  /*
    KEYED ON THE POOL, so the whole field is rebuilt when a shower starts or ends.

    The buffer's length IS the pool, and both the geometry and the live meteor
    array are memos over it — remounting is one allocation at each edge of an event
    that lasts an hour, and it is the only way the two cannot disagree about how
    many streaks there are.
  */
  const pool = meteorPool(shower);
  return <MeteorField key={pool} pool={pool} />;
}

function MeteorField({ pool }: { pool: number }) {
  const meteors = useMemo(() => Array.from({ length: pool }, spawn), [pool]);

  const { ribbon, heads } = useMemo(() => {
    const vertices = pool * 4;
    const trail = new THREE.BufferGeometry();
    trail.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
    trail.setAttribute('aOther', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
    trail.setAttribute('aLight', new THREE.BufferAttribute(new Float32Array(vertices * 2), 2));
    const along = new Float32Array(vertices);
    const side = new Float32Array(vertices);
    const index: number[] = [];
    for (let i = 0; i < pool; i++) {
      // Tail left, tail right, head left, head right.
      along.set([0, 0, 1, 1], i * 4);
      side.set([-1, 1, -1, 1], i * 4);
      const o = i * 4;
      index.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
    }
    trail.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    trail.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    trail.setIndex(index);
    const resolution = new THREE.Vector2(1, 1);
    const trailMaterial = new THREE.ShaderMaterial({
      vertexShader: METEOR_RIBBON_VERTEX,
      fragmentShader: METEOR_RIBBON_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      uniforms: { uResolution: { value: resolution }, uPixelRatio: { value: 1 } },
    });

    const head = new THREE.BufferGeometry();
    head.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pool * 3), 3));
    head.setAttribute('aLight', new THREE.BufferAttribute(new Float32Array(pool), 1));
    const headMaterial = new THREE.ShaderMaterial({
      vertexShader: METEOR_HEAD_VERTEX,
      fragmentShader: METEOR_HEAD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: { uPixelRatio: { value: 1 } },
    });
    return {
      ribbon: { geometry: trail, material: trailMaterial, resolution },
      heads: { geometry: head, material: headMaterial },
    };
  }, [pool]);

  // The buffers are rebuilt at each edge of an Asteroid Shower, so the old ones
  // have to go back explicitly.
  useEffect(
    () => () => {
      ribbon.geometry.dispose();
      ribbon.material.dispose();
      heads.geometry.dispose();
      heads.material.dispose();
    },
    [ribbon, heads],
  );

  const stepClock = useRef<MeteorClock>(METEOR_CLOCK);
  useFrame(({ gl, size }, frameDelta) => {
    const ratio = gl.getPixelRatio();
    ribbon.resolution.set(size.width * ratio, size.height * ratio);
    ribbon.material.uniforms.uPixelRatio!.value = ratio;
    heads.material.uniforms.uPixelRatio!.value = ratio;

    const step = meteorStep(stepClock.current, frameDelta);
    stepClock.current = step.clock;
    const delta = step.advance;
    if (delta <= 0) return;

    const position = ribbon.geometry.getAttribute('position');
    const other = ribbon.geometry.getAttribute('aOther');
    const light = ribbon.geometry.getAttribute('aLight');
    const headPosition = heads.geometry.getAttribute('position');
    const headLight = heads.geometry.getAttribute('aLight');

    meteors.forEach((meteor, i) => {
      let trail = null;
      if (meteor.wait > 0) {
        meteor.wait -= delta;
      } else {
        meteor.age += delta;
        trail = meteorTrail(meteor, meteor.age);
        if (!trail) {
          const next = spawn();
          next.wait = METEOR_GAP[0] + Math.random() * (METEOR_GAP[1] - METEOR_GAP[0]);
          meteors[i] = next;
        }
      }
      if (!trail) {
        // Dark under additive blending, so an idle slot needs no branch in the draw.
        for (let v = 0; v < 4; v++) light.setXY(i * 4 + v, 0, 0);
        headLight.setX(i, 0);
        return;
      }
      const { head, tail } = trail;
      position.setXYZ(i * 4, ...tail);
      position.setXYZ(i * 4 + 1, ...tail);
      position.setXYZ(i * 4 + 2, ...head);
      position.setXYZ(i * 4 + 3, ...head);
      other.setXYZ(i * 4, ...head);
      other.setXYZ(i * 4 + 1, ...head);
      other.setXYZ(i * 4 + 2, ...tail);
      other.setXYZ(i * 4 + 3, ...tail);
      for (let v = 0; v < 4; v++) light.setXY(i * 4 + v, trail.headLight, trail.trailLight);
      headPosition.setXYZ(i, ...head);
      headLight.setX(i, trail.headLight);
    });

    position.needsUpdate = true;
    other.needsUpdate = true;
    light.needsUpdate = true;
    headPosition.needsUpdate = true;
    headLight.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={ribbon.geometry} material={ribbon.material} frustumCulled={false} renderOrder={-50} />
      <points geometry={heads.geometry} material={heads.material} frustumCulled={false} renderOrder={-49} />
    </>
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

export const CLOUD_STAR_VERTEX = /* glsl */ `
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
    ${STAR_BACKDROP_CLIP}
  }
`;

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
      vertexShader: CLOUD_STAR_VERTEX,
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
                  onBeforeCompile={fadeEdgeOn}
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
 * A PLANE SEEN EDGE-ON IS A LINE, and a line is the one thing a photograph of gas
 * never has. The three cloud plates crossed the frame as hard diagonal strokes —
 * an X through the core from overhead — whenever the camera stood in one of their
 * planes. Each plate fades out as it turns edge-on, so what is left is only ever
 * seen as the soft sheet it was painted as.
 */
function fadeEdgeOn(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vFacing;')
    .replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvFacing = abs(dot(normalize(normalMatrix * vec3(0.0, 0.0, 1.0)), normalize(-mvPosition.xyz)));',
    );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vFacing;')
    .replace(
      '#include <opaque_fragment>',
      'diffuseColor.a *= smoothstep(0.08, 0.45, vFacing);\n#include <opaque_fragment>',
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
 * The centre keeps the painted cloud; the two skins reveal depth at an angle.
 * All three layers use 75% of their previous opacity.
 */
const CLOUD_DEPTH_LAYERS = [
  { offset: -DISC_RADIUS * 0.012, opacity: 0.009375, scale: 0.995 },
  { offset: 0, opacity: 0.04875, scale: 1 },
  { offset: DISC_RADIUS * 0.012, opacity: 0.009375, scale: 1.005 },
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
