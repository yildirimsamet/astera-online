import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { VesselModule, VesselSystem } from '@astera/rules';
import { MODULE_ORE, bayReturnOf, flipbookFrame, globeDrawn, sparkAt, sparkColour, strobeOn, sweepTurn, type Ore } from './bayFx.js';
import { EMP_ARC } from './empSchedule.js';
import { NUKE_SMOKE } from './NukeBlast.js';
import { BURN_FIRE } from './VesselBurn.js';

/*
  THE SHIP'S OWN EFFECTS, DRAWN (briefs in `bayFx.ts`; owner 2026-11-18: no round glow). Model space,
  as `VesselBody`: nose along +X, about a unit long, up +Y. Each effect asks for frames only while it
  plays; the running lights ask for one at each change of a blink.
*/

type Vec = readonly [number, number, number];
/** Seconds a system's return plays: the director's shot of it, near enough. */
const RETURN_S = 2.8;
const SPARK_LIFE = 0.5;
const STREAK_S = 0.12;
/** A spark's hot head and the weld's molten point, in device pixels at a phone's ratio. */
const HEAD_PX = 3;

/** A flipbook's own copy of its sheet, so each sprite can show its own frame. */
function useSheet(file: string, cols: number, rows: number): THREE.Texture {
  const source = useTexture(file);
  const sheet = useMemo(() => {
    const copy = source.clone();
    copy.repeat.set(1 / cols, 1 / rows);
    copy.needsUpdate = true;
    return copy;
  }, [source, cols, rows]);
  useEffect(() => () => { sheet.dispose(); }, [sheet]);
  return sheet;
}

const showFrame = (sheet: THREE.Texture, frame: number, cols: number, rows: number): void => {
  sheet.offset.set((frame % cols) / cols, 1 - (Math.floor(frame / cols) + 1) / rows);
};

/**
 * Sparks thrown off the hull as straight streaks that slow and cool. `stream` throws them for as long
 * as it is drawn (a weld); otherwise one burst, `delay` seconds in.
 */
export function SparkStreaks({ at, count, stream = false, delay = 0, seed = 1, ore = 'alloy' }: { at: Vec; count: number; stream?: boolean; delay?: number; seed?: number; ore?: Ore }) {
  const start = useRef<number | null>(null);
  const { geometry, material, heads } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    // The streak is a line a pixel wide; its hot head is a hard square of a few, so a phone sees it.
    const h = new THREE.PointsMaterial({ size: HEAD_PX, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return { geometry: g, material: m, heads: h };
  }, [count]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); heads.dispose(); }, [geometry, material, heads]);
  const colour = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock, invalidate }) => {
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current - delay;
    const position = geometry.getAttribute('position');
    const tint = geometry.getAttribute('color');
    let live = false;
    for (let i = 0; i < count; i++) {
      // A stream gives each spark its own place in the cycle and a new way out each time round.
      const shifted = stream ? t + (i / count) * SPARK_LIFE : t;
      const age = stream ? ((shifted % SPARK_LIFE) + SPARK_LIFE) % SPARK_LIFE : t;
      const round = stream ? Math.floor(shifted / SPARK_LIFE) : 0;
      const s = seed * 31.7 + i * 13.1 + round * 7.7;
      const head = t >= 0 ? sparkAt(s, age, SPARK_LIFE) : null;
      const tail = head ? sparkAt(s, Math.max(0, age - STREAK_S), SPARK_LIFE) : null;
      if (!head || !tail) {
        position.setXYZ(i * 2, at[0], at[1], at[2]); position.setXYZ(i * 2 + 1, at[0], at[1], at[2]);
        tint.setXYZ(i * 2, 0, 0, 0); tint.setXYZ(i * 2 + 1, 0, 0, 0);
        continue;
      }
      live = true;
      position.setXYZ(i * 2, at[0] + head.at[0], at[1] + head.at[1], at[2] + head.at[2]);
      position.setXYZ(i * 2 + 1, at[0] + tail.at[0], at[1] + tail.at[1], at[2] + tail.at[2]);
      colour.setRGB(...sparkColour(head.heat, ore));
      tint.setXYZ(i * 2, colour.r, colour.g, colour.b);
      tint.setXYZ(i * 2 + 1, colour.r * 0.2, colour.g * 0.2, colour.b * 0.2);
    }
    position.needsUpdate = true;
    tint.needsUpdate = true;
    if (live || stream || t < 0) invalidate();
  });
  return (
    <>
      <lineSegments geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
      <points geometry={geometry} material={heads} frustumCulled={false} raycast={() => null} />
    </>
  );
}

/** A jagged electric arc that stutters at its place (`electric-line-4x4`), turned a new way each strike. */
export function ArcFlicker({ at, size, seed = 0, until = Infinity }: { at: Vec; size: number; seed?: number; until?: number }) {
  const sheet = useSheet(EMP_ARC, 4, 4);
  const sprite = useRef<THREE.Sprite>(null);
  const start = useRef<number | null>(null);
  const material = useMemo(() => new THREE.SpriteMaterial({ map: sheet, color: '#cfe8ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [sheet]);
  useEffect(() => () => { material.dispose(); }, [material]);
  useFrame(({ clock, invalidate }) => {
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    if (t > until) { material.opacity = 0; return; }
    const frame = flipbookFrame(t + seed, 30, 16);
    showFrame(sheet, frame, 4, 4);
    // Each pass through the sheet is a new strike: a new angle, and now and then a gap.
    const strike = Math.floor((t + seed) * 30 / 16);
    material.rotation = ((Math.sin(strike * 12.9898 + seed * 78.233) * 43758.5453) % 1) * Math.PI * 2;
    material.opacity = (strike + Math.floor(seed * 10)) % 5 === 4 ? 0 : 1;
    invalidate();
  });
  return <sprite ref={sprite} position={[at[0], at[1], at[2]]} scale={size} material={material} raycast={() => null} />;
}

/** The weld's molten point: a hard white-hot dot that flickers with the arc, never a halo; crystal burns cold-white. */
function MoltenPoint({ at, ore }: { at: Vec; ore: Ore }) {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([at[0], at[1], at[2]]), 3));
    const m = new THREE.PointsMaterial({ size: HEAD_PX * 1.6, sizeAttenuation: false, color: ore === 'crystal' ? '#e4f6ff' : '#fff2c8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return { geometry: g, material: m };
  }, [at, ore]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    material.opacity = 0.55 + 0.45 * Math.max(0, Math.sin(t * 41) * 0.6 + Math.sin(t * 27.3 + 1.1) * 0.5);
  });
  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}

/** A repair under way at its bay: the welder's arc, its molten point and its sparks, in what it repairs' colours. */
export function WeldFx({ at, module }: { at: Vec; module: VesselModule }) {
  const ore = MODULE_ORE[module] ?? 'alloy';
  return (
    <>
      <ArcFlicker at={at} size={0.22} />
      <ArcFlicker at={at} size={0.16} seed={0.53} />
      <MoltenPoint at={at} ore={ore} />
      <SparkStreaks at={at} count={26} stream ore={ore} />
    </>
  );
}

/**
 * The flame sheet's own orange, or its light turned to a tint (the crystal furnace burns blue): the sheet's
 * brightness kept, its colour replaced, white where it is hottest. One cheap line in the sprite's shader.
 */
function flameMaterial(map: THREE.Texture, tint: string | null): THREE.SpriteMaterial {
  const material = new THREE.SpriteMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  if (tint === null) return material;
  const colour = new THREE.Color(tint);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = { value: colour };
    shader.fragmentShader = `uniform vec3 uTint;\n${shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float luma = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = mix(uTint * luma * 1.7, vec3(luma), smoothstep(0.72, 1.0, luma));`)}`;
  };
  material.customProgramCacheKey = () => `flame-tint-${tint}`;
  return material;
}

/** What each ore's burner burns: the sheet's own flame for alloy, crystal blue for crystal. */
const FLAME_TINT: Record<Ore, string | null> = { alloy: null, crystal: '#5cc8ff' };

/** The refinery's burner catches: a jet of flame rises from the bay with a puff of smoke, then settles. */
function BurnerIgnite({ at, ore }: { at: Vec; ore: Ore }) {
  const flame = useSheet(BURN_FIRE, 6, 6);
  const smoke = useSheet(NUKE_SMOKE, 8, 8);
  const jet = useRef<THREE.Sprite>(null);
  const puff = useRef<THREE.Sprite>(null);
  const start = useRef<number | null>(null);
  const materials = useMemo(() => ({
    jet: flameMaterial(flame, FLAME_TINT[ore]),
    puff: new THREE.SpriteMaterial({ map: smoke, color: '#5c5852', transparent: true, depthWrite: false }),
  }), [flame, smoke, ore]);
  useEffect(() => () => { materials.jet.dispose(); materials.puff.dispose(); }, [materials]);
  useFrame(({ clock, invalidate }) => {
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const live = t < RETURN_S;
    if (live) invalidate();
    showFrame(flame, flipbookFrame(t, 30, 36), 6, 6);
    // A whoosh to full height, a roar, then down to a working flame and out as the shot ends.
    const rise = Math.min(1, t / 0.22);
    const height = !live ? 0 : t < 1.2 ? 0.4 * rise * (1 + 0.08 * Math.sin(t * 40)) : 0.4 - 0.22 * Math.min(1, (t - 1.2) / 0.6);
    const fade = live ? Math.min(1, (RETURN_S - t) / 0.4) : 0;
    jet.current?.scale.set(0.1 + 0.04 * rise, Math.max(0.0001, height), 1);
    materials.jet.opacity = fade;
    const smokeT = Math.min(1, t / 1.6);
    showFrame(smoke, Math.min(63, Math.floor(smokeT * 63)), 8, 8);
    materials.puff.opacity = live ? 0.75 * (1 - smokeT) : 0;
    puff.current?.position.set(at[0], at[1] + 0.08 + 0.35 * smokeT, at[2]);
    puff.current?.scale.setScalar(0.12 + 0.32 * smokeT);
  });
  return (
    <>
      <sprite ref={puff} position={[at[0], at[1], at[2]]} material={materials.puff} raycast={() => null} />
      <sprite ref={jet} position={[at[0], at[1], at[2]]} center={[0.5, 0.04]} material={materials.jet} raycast={() => null} />
    </>
  );
}

const SWEEP_VERT = /* glsl */`
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SWEEP_FRAG = /* glsl */`
  uniform vec3 uColour; uniform float uRadius; uniform float uWedge; uniform float uFade;
  varying vec2 vP;
  void main() {
    float r = length(vP) / uRadius;
    float a = clamp(atan(vP.y, vP.x) / uWedge, 0.0, 1.0);
    // The trail behind the leading edge, the edge itself hard, and the range rings it lights as it passes.
    float trail = pow(a, 4.0) * 0.55;
    float edge = step(0.965, a);
    float rings = step(0.9, fract(r * 3.0)) * pow(a, 2.0) * 0.6;
    float rim = step(0.94, r);
    float alpha = (max(trail, edge) + rings + rim * a * 0.5) * step(r, 1.0) * uFade;
    gl_FragColor = vec4(uColour * alpha, 1.0);
  }`;

/** The antenna wakes and sweeps the space round it twice: a radar wedge with a hard leading edge. */
function AntennaSweep({ at, colour }: { at: Vec; colour: string }) {
  const turn = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const radius = 0.42;
  const wedge = 1.1;
  const { geometry, material } = useMemo(() => ({
    geometry: new THREE.CircleGeometry(radius, 40, 0, wedge),
    material: new THREE.ShaderMaterial({
      vertexShader: SWEEP_VERT, fragmentShader: SWEEP_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, forceSinglePass: true, toneMapped: false,
      uniforms: { uColour: { value: new THREE.Color(colour) }, uRadius: { value: radius }, uWedge: { value: wedge }, uFade: { value: 0 } },
    }),
  }), [colour]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(({ clock, invalidate }) => {
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const live = t < RETURN_S;
    if (live) invalidate();
    if (turn.current) turn.current.rotation.y = -sweepTurn(t, RETURN_S - 0.4);
    const fade = material.uniforms.uFade;
    if (fade) fade.value = live ? Math.min(1, t / 0.2, (RETURN_S - t) / 0.4) : 0;
  });
  return (
    <group position={[at[0], at[1], at[2]]}>
      <group ref={turn}>
        <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} />
      </group>
    </group>
  );
}

/** Power comes back to the yard and the hold: arcs crawl over the bay and throw sparks. */
function PowerArcs({ at }: { at: Vec }) {
  const spots = useMemo<Vec[]>(() => [[at[0], at[1], at[2]], [at[0] - 0.05, at[1] + 0.02, at[2] + 0.03], [at[0] + 0.04, at[1] + 0.01, at[2] - 0.04]], [at]);
  return (
    <>
      {spots.map((spot, i) => <ArcFlicker key={i} at={spot} size={0.2} seed={i * 0.37} until={RETURN_S - 0.6} />)}
      <SparkStreaks at={at} count={22} seed={5} />
      <SparkStreaks at={at} count={16} seed={9} delay={0.7} />
    </>
  );
}

const GLOBE_VERT = /* glsl */`
  uniform float uRadius; varying float vY;
  void main() { vY = position.y / uRadius; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GLOBE_FRAG = /* glsl */`
  uniform vec3 uColour; uniform float uCut; uniform float uFade;
  varying float vY;
  void main() {
    if (vY < uCut) discard;
    // The line being drawn runs bright; the sphere behind it holds at a steady line.
    float lead = 1.0 - smoothstep(0.0, 0.14, vY - uCut);
    gl_FragColor = vec4(uColour * (0.5 + 0.9 * lead) * uFade, 1.0);
  }`;

/** Meridians and parallels of a sphere, as line segments. */
function sphereLines(radius: number): THREE.BufferGeometry {
  const points: number[] = [];
  const steps = 48;
  for (const latitude of [-60, -30, 0, 30, 60]) {
    const y = Math.sin(latitude * Math.PI / 180) * radius;
    const ring = Math.cos(latitude * Math.PI / 180) * radius;
    for (let i = 0; i < steps; i += 1) {
      const a = (i / steps) * Math.PI * 2, b = ((i + 1) / steps) * Math.PI * 2;
      points.push(ring * Math.cos(a), y, ring * Math.sin(a), ring * Math.cos(b), y, ring * Math.sin(b));
    }
  }
  for (let m = 0; m < 8; m += 1) {
    const around = (m / 8) * Math.PI * 2;
    for (let j = 0; j < steps / 2; j += 1) {
      const a = -Math.PI / 2 + (j / (steps / 2)) * Math.PI, b = -Math.PI / 2 + ((j + 1) / (steps / 2)) * Math.PI;
      points.push(Math.cos(a) * Math.cos(around) * radius, Math.sin(a) * radius, Math.cos(a) * Math.sin(around) * radius,
        Math.cos(b) * Math.cos(around) * radius, Math.sin(b) * radius, Math.cos(b) * Math.sin(around) * radius);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

/** The telescope wakes: the sphere of sky it sees draws itself round its bay, pole to pole, turns and goes. */
function GlobeScan({ at, colour }: { at: Vec; colour: string }) {
  const spin = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const radius = 0.3;
  const { geometry, material } = useMemo(() => ({
    geometry: sphereLines(radius),
    material: new THREE.ShaderMaterial({
      vertexShader: GLOBE_VERT, fragmentShader: GLOBE_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uColour: { value: new THREE.Color(colour) }, uRadius: { value: radius }, uCut: { value: 1 }, uFade: { value: 0 } },
    }),
  }), [colour]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(({ clock, invalidate }) => {
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const live = t < RETURN_S;
    if (live) invalidate();
    if (spin.current) spin.current.rotation.y = t * 0.7;
    const cut = material.uniforms.uCut;
    if (cut) cut.value = 1.02 - 2.04 * globeDrawn(t, RETURN_S);
    const fade = material.uniforms.uFade;
    if (fade) fade.value = live ? Math.min(1, t / 0.15, (RETURN_S - t) / 0.5) : 0;
  });
  return (
    <group position={[at[0], at[1], at[2]]}>
      <group ref={spin}>
        <lineSegments geometry={geometry} material={material} raycast={() => null} />
      </group>
    </group>
  );
}

/** A system back on the hull, doing its own work where it sits: its module's where it has one (`bayReturnOf`). */
export function BayReturnFx({ system, module, at, colour }: { system: VesselSystem; module?: VesselModule | undefined; at: Vec; colour: string }) {
  const work = bayReturnOf(system, module);
  if (work === 'burner') return <BurnerIgnite at={at} ore={(module ? MODULE_ORE[module] : undefined) ?? 'alloy'} />;
  if (work === 'sweep') return <AntennaSweep at={at} colour={colour} />;
  if (work === 'globe') return <GlobeScan at={at} colour={colour} />;
  return <PowerArcs at={at} />;
}

const LIGHT_VERT = /* glsl */`
  attribute vec3 aColour; attribute float aOn; uniform float uPx;
  varying vec3 vColour; varying float vOn;
  void main() { vColour = aColour; vOn = aOn; gl_PointSize = uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LIGHT_FRAG = /* glsl */`
  varying vec3 vColour; varying float vOn;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vOn < 0.5) discard;
    gl_FragColor = vec4(vColour * (1.0 - smoothstep(0.36, 0.5, d)), 1.0);
  }`;

/**
 * A mended bay's running light: a hard dot that blinks twice and rests, each bay off the others' beat.
 * The galaxy draws on demand: a light asks for a frame only when a blink starts or ends.
 */
export function RunningLights({ lights }: { lights: readonly { at: Vec; colour: string; offset: number }[] }) {
  const { gl, invalidate } = useThree();
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lights.flatMap(light => [...light.at])), 3));
    g.setAttribute('aColour', new THREE.BufferAttribute(new Float32Array(lights.flatMap(light => new THREE.Color(light.colour).toArray())), 3));
    g.setAttribute('aOn', new THREE.BufferAttribute(new Float32Array(lights.length), 1));
    const m = new THREE.ShaderMaterial({ vertexShader: LIGHT_VERT, fragmentShader: LIGHT_FRAG, transparent: true, depthWrite: false, toneMapped: false, uniforms: { uPx: { value: 4 } } });
    return { geometry: g, material: m };
  }, [lights]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const px = material.uniforms.uPx;
  if (px) px.value = 4 * gl.getPixelRatio();
  useEffect(() => {
    const on = geometry.getAttribute('aOn');
    const born = performance.now();
    const tick = window.setInterval(() => {
      const t = (performance.now() - born) / 1000;
      let changed = false;
      for (const [i, light] of lights.entries()) {
        const lit = strobeOn(t, light.offset) ? 1 : 0;
        if (on.getX(i) !== lit) { on.setX(i, lit); changed = true; }
      }
      if (changed) { on.needsUpdate = true; invalidate(); }
    }, 40);
    return () => { window.clearInterval(tick); };
  }, [geometry, lights, invalidate]);
  if (lights.length === 0) return null;
  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}
