import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFrame } from '@react-three/fiber';
import { Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { worldRadius } from '@astera/rules';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import {
  beginGrowth, drawnRadius, landsAfter, levelFrame, levelLength, nextLevelUp, owedLevelUps, pruneGrowth, readCoreSeen,
  rememberCoreSeen, seenLevels, type CoreClock, type LevelUp,
} from './coreLevelUp.js';
import { FULL_RATE_FPS, HoldRate } from './frames.jsx';
import { screenFloorScale } from './publicMoments.js';
import { createRehearsal, type Rehearsal } from './rehearsal.js';
import type { PlanetNode } from './scene.js';

/*
  THE CORE'S STEP, ON THE MAP (owner approved the lab look, 2026-11-13). Gold motes spiral in and gather
  onto the world, it flashes against a shock ring behind its silhouette, two thin rings run out across
  its plane and the world takes its step bigger with a little spring (`drawnRadius`, read by every body
  of the world). A tier jump gathers longer from further out with twice the motes, a second slower shock
  swells after the first, a third ring runs out on a tilted plane and "Kademe N" rises over the world.
  No real light. Two slots, mounted and rehearsed unseen when the galaxy mounts; sixty frames a second
  only while one plays. See `coreLevelUp.ts` for when.
*/

const HALO = '/assets/vfx/library/sck-exhaust-halo.webp';
const GOLD = new THREE.Color('#ffcf6b');
/** A tier jump draws all of them; an ordinary level the first half. */
const MOTES = 520;
const SLOTS = 2;
/** The effect is never smaller than this across, so a step is seen from the whole disc. */
const MIN_PIXELS = 26;
/** Owed steps on one open play one after another, this far apart. */
const OWED_GAP_S = 0.3;

const MOTE_VERT = /* glsl */`
  attribute vec4 aSeed;
  uniform float uGather; uniform float uR; uniform float uPx; uniform float uSpread;
  varying float vFade;
  void main() {
    // Each mote leaves a little later than the last and spirals in.
    float delay = aSeed.w * 0.45;
    float k = clamp((uGather - delay) / (1.0 - delay), 0.0, 1.0);
    float z = aSeed.x * 2.0 - 1.0; float a = aSeed.y * 6.2831853 + (1.0 - k) * 1.8;
    vec3 dir = vec3(sqrt(1.0 - z * z) * cos(a), z * 0.6, sqrt(1.0 - z * z) * sin(a));
    vec3 p = normalize(dir) * uR * (1.02 + (0.6 + 1.1 * aSeed.z) * uSpread * (1.0 - k));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.92, 1.0, k)) * step(0.001, uGather);
    gl_PointSize = clamp(uPx * (0.7 + 0.9 * k) / max(-mv.z, 0.001), 1.5, 12.0);
    gl_Position = projectionMatrix * mv;
  }`;
const MOTE_FRAG = /* glsl */`
  uniform vec3 uColour; varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.05, 0.5, d)) * vFade;
    gl_FragColor = vec4(mix(uColour, vec3(1.0), 0.45) * a * 1.8, 1.0);
  }`;
const RIM_VERT = /* glsl */`
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const RIM_FRAG = /* glsl */`
  uniform vec3 uColour; uniform float uGlow; uniform float uFlash;
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    float edge = pow(max(1.0 - max(0.0, dot(vNormal, vView)), 0.0), 2.4);
    gl_FragColor = vec4(uColour * (edge * 1.6 * uGlow + uFlash * (0.15 + 1.2 * edge)), 1.0);
  }`;
// A shock ring on a camera-facing card: no texture, so no card edge; it leaves the silhouette and fades.
const DISC_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const DISC_FRAG = /* glsl */`
  uniform float uRadius; uniform float uAlpha; uniform vec3 uColour; varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float x = (d - uRadius) / 0.03; float y = (d - uRadius * 0.86) / 0.16;
    float ring = exp(-(x * x)) + 0.4 * exp(-(y * y)) * step(d, uRadius);
    gl_FragColor = vec4(mix(uColour, vec3(1.0), 0.5) * ring * 1.5 * uAlpha, 1.0);
  }`;

const hash = (n: number): number => { const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };

/** A slot's step and what has already sounded. */
interface Live {
  up: LevelUp;
  boomed: boolean;
}

export function CoreLevelUps({ nodes, cores, selfId }: {
  nodes: readonly PlanetNode[];
  /** The player's own worlds' Core clocks; none outside the galaxy screen. */
  cores: readonly CoreClock[] | undefined;
  selfId: string | undefined;
}) {
  const [playing, setPlaying] = useState(false);
  const queued = useRef<LevelUp[]>([]);
  /** The highest level each world has played this visit, so a live step is not owed again when the queue reads in. */
  const played = useRef(new Map<string, number>());
  const where = useRef(nodes);
  useEffect(() => { where.current = nodes; }, [nodes]);

  // Own worlds on the map only: a rival's world just grows (owner, 2026-11-13).
  const own = useMemo(() => {
    const mine = new Set(nodes.filter((node) => node.isOwned).map((node) => node.id));
    return (cores ?? []).filter((core) => mine.has(core.id));
  }, [cores, nodes]);

  const latest = useRef({ own, selfId });
  useEffect(() => { latest.current = { own, selfId }; }, [own, selfId]);

  const queue = useCallback((up: LevelUp) => {
    if ((played.current.get(up.id) ?? -Infinity) >= up.to) return;
    played.current.set(up.id, up.to);
    // Remembered at once: a live step starts before its queue has run out.
    const { own: cores, selfId: self } = latest.current;
    if (self) rememberCoreSeen(self, seenLevels(cores, serverNow(), played.current));
    const base = where.current.find((node) => node.id === up.id)?.coreLevel ?? up.from;
    beginGrowth(up.id, { from: up.from, to: up.to, at: up.start + landsAfter(up.kind) * 1000, base });
    queued.current.push(up);
    setPlaying(true);
  }, []);

  // Levels reached while the player was elsewhere, one after another from now.
  useEffect(() => {
    const now = serverNow();
    pruneGrowth(nodes, now);
    if (!selfId) return;
    let start = now;
    for (const up of owedLevelUps(own, readCoreSeen(selfId), now)) {
      queue({ ...up, start });
      start += (levelLength(up.kind) + OWED_GAP_S) * 1000;
    }
    rememberCoreSeen(selfId, seenLevels(own, now, played.current));
  }, [own, nodes, selfId, queue]);

  // The next queued upgrade, live: its light starts gathering so the world steps as the queue ends.
  useEffect(() => {
    if (!selfId) return;
    const now = serverNow();
    const next = nextLevelUp(own, now);
    if (!next) return;
    const timer = window.setTimeout(() => { queue(next); }, Math.max(0, next.start - now));
    return () => { window.clearTimeout(timer); };
  }, [own, selfId, queue]);

  const root = useRef<THREE.Group>(null);
  const rehearsal = useRef<Rehearsal | null>(null);
  const cells = useMemo(() => Array.from({ length: SLOTS }, (): { live: Live | null } => ({ live: null })), []);

  useFrame(() => {
    const group = root.current;
    if (!group) return;
    rehearsal.current ??= createRehearsal(group);
    if (rehearsal.current.next()) return;
    const now = serverNow();
    // A step takes a free slot once its start has come; a third waits for one.
    queued.current = queued.current.filter((up) => {
      if (up.start > now) return true;
      const cell = cells.find((candidate) => candidate.live === null);
      if (!cell) return true;
      cell.live = { up, boomed: false };
      if ((now - up.start) / 1000 < 0.3) playSound('charge', { gain: 0.5, key: `core:${up.id}` });
      return false;
    });
    for (const cell of cells) {
      if (cell.live && (now - cell.live.up.start) / 1000 > levelLength(cell.live.up.kind)) cell.live = null;
    }
    const busy = queued.current.length > 0 || cells.some((cell) => cell.live !== null);
    group.visible = busy;
    if (!busy && playing) setPlaying(false);
  });

  return (
    <>
      <HoldRate fps={FULL_RATE_FPS} active={playing} />
      <group ref={root} visible={false}>
        {cells.map((cell, i) => <LevelUpSlot key={i} cell={cell} where={where} />)}
      </group>
    </>
  );
}

function LevelUpSlot({ cell, where }: { cell: { live: Live | null }; where: { current: readonly PlanetNode[] } }) {
  const { t } = useTranslation();
  const haloMap = useTexture(HALO);
  const motes = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(MOTES * 4).map((_, i) => hash(i + 1)), 4));
    const material = new THREE.ShaderMaterial({
      vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uGather: { value: 0 }, uR: { value: 1 }, uPx: { value: 0 }, uSpread: { value: 1 }, uColour: { value: GOLD } },
    });
    return { geometry, material };
  }, []);
  const rim = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RIM_VERT, fragmentShader: RIM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uColour: { value: GOLD }, uGlow: { value: 0 }, uFlash: { value: 0 } },
  }), []);
  const discs = useMemo(() => [0, 1].map(() => new THREE.ShaderMaterial({
    vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uRadius: { value: 0 }, uAlpha: { value: 0 }, uColour: { value: GOLD } },
  })), []);
  const rings = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({
    color: GOLD, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
  })), []);
  const halo = useMemo(() => new THREE.SpriteMaterial({
    map: haloMap, color: GOLD, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }), [haloMap]);
  useEffect(() => () => {
    motes.geometry.dispose(); motes.material.dispose(); rim.dispose(); halo.dispose();
    for (const material of [...discs, ...rings]) material.dispose();
  }, [motes, rim, discs, rings, halo]);

  const at = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const shocks = useRef<THREE.Group>(null);
  const flat = useRef<THREE.Group>(null);
  const tilted = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Sprite>(null);
  const wordAnchor = useRef<THREE.Group>(null);
  const word = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<number | null>(null);
  const shown = useRef<LevelUp | null>(null);
  const toCamera = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);

  const quiet = (): void => {
    motes.material.uniforms.uGather!.value = 0;
    rim.uniforms.uGlow!.value = 0; rim.uniforms.uFlash!.value = 0;
    for (const disc of discs) disc.uniforms.uAlpha!.value = 0;
    for (const ring of rings) ring.opacity = 0;
    halo.opacity = 0;
  };

  useFrame(({ camera, size, gl }) => {
    const live = cell.live;
    if (live?.up !== shown.current) {
      shown.current = live?.up ?? null;
      setTier(live?.up.kind === 'tier' ? live.up.tier : null);
    }
    const node = live ? where.current.find((candidate) => candidate.id === live.up.id) : undefined;
    const group = at.current;
    if (!live || !node || !group) { quiet(); return; }
    const now = serverNow();
    const { up: step } = live;
    const f = levelFrame((now - step.start) / 1000, step.kind);
    const big = step.kind === 'tier';
    if (!live.boomed && f.flash > 0) {
      live.boomed = true;
      playSound('rankup', { gain: big ? 1 : 0.75, key: `core:${step.id}:step` });
      haptic(big ? 'rumble' : 'commit');
    }

    group.position.set(...node.position);
    const centre = group.position;
    // Sized to the world it lands on, never smaller than a mark seen from the whole disc.
    const R0 = node.radius / worldRadius(node.coreLevel) * worldRadius(step.to);
    const R = R0 * screenFloorScale(R0 * 2, centre, camera, size.height, MIN_PIXELS);
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;

    shell.current?.scale.setScalar(drawnRadius(node, now) * 1.03);
    rim.uniforms.uGlow!.value = f.glow;
    rim.uniforms.uFlash!.value = f.flash;
    const m = motes.material.uniforms;
    m.uGather!.value = f.gather < 1 ? f.gather : 0;
    m.uR!.value = R;
    m.uSpread!.value = big ? 1.35 : 1;
    motes.geometry.setDrawRange(0, big ? MOTES : MOTES / 2);
    m.uPx!.value = R * 0.08 * (size.height * gl.getPixelRatio()) / (2 * Math.tan((fov * Math.PI) / 360));

    // Behind the world, so its silhouette stands against the detonation.
    toCamera.copy(camera.position).sub(centre).normalize();
    if (flash.current) {
      flash.current.position.copy(toCamera).multiplyScalar(-R * 1.1);
      flash.current.scale.setScalar(R * (big ? 1.4 : 1) * (5 + 2 * (1 - f.flash)));
      halo.opacity = f.flash;
    }
    shocks.current?.children.forEach((shock, i) => {
      // The second, a tier jump's, is wider and slower: the ground swell after the crack.
      const p = i === 0 ? f.disc : f.disc2;
      const material = discs[i]!;
      shock.position.copy(toCamera).multiplyScalar(-R * 1.1);
      shock.quaternion.copy(camera.quaternion);
      shock.scale.setScalar(R * (i === 0 ? 3 : 4.4));
      material.uniforms.uRadius!.value = (i === 0 ? 0.36 : 0.26) + (i === 0 ? 0.6 : 0.7) * (1 - (1 - p) ** 2);
      material.uniforms.uAlpha!.value = p > 0 && p < 1 ? (i === 0 ? 1 : 0.7) * (1 - p) ** 1.4 : 0;
    });
    const reach = big ? 5.6 : 4.2;
    flat.current?.children.forEach((ring, i) => {
      const k = Math.max(0, Math.min(1, f.ring * 1.15 - i * 0.15));
      ring.scale.setScalar(R * (1.08 + reach * k));
      rings[i]!.opacity = k > 0 ? (1 - k) ** 1.6 : 0;
    });
    if (tilted.current) {
      const k = Math.max(0, Math.min(1, f.ring * 1.15 - 0.08));
      tilted.current.scale.setScalar(R * (1.08 + reach * 0.8 * k));
      rings[2]!.opacity = big && k > 0 ? 0.8 * (1 - k) ** 1.6 : 0;
    }
    if (wordAnchor.current && word.current) {
      // Above the world as the camera sees it, from wherever it looks.
      wordAnchor.current.position.copy(up.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(R * 2.05));
      word.current.style.opacity = String(f.label);
      word.current.style.transform = `translateY(${String((1 - f.label) * 10)}px) scale(${String(0.92 + 0.08 * f.label)})`;
    }
  });

  return (
    <group ref={at}>
      <mesh ref={shell} material={rim} renderOrder={2} frustumCulled={false}><sphereGeometry args={[1, 48, 32]} /></mesh>
      <points geometry={motes.geometry} material={motes.material} frustumCulled={false} renderOrder={3} />
      <group ref={shocks}>
        {discs.map((material, i) => <mesh key={i} material={material} renderOrder={1} frustumCulled={false}><planeGeometry args={[2, 2]} /></mesh>)}
      </group>
      <group ref={flat} rotation={[-Math.PI / 2, 0, 0]}>
        {rings.slice(0, 2).map((material, i) => <mesh key={i} material={material} renderOrder={1} frustumCulled={false}><ringGeometry args={[0.985, 1, 128]} /></mesh>)}
      </group>
      <mesh ref={tilted} material={rings[2]} rotation={[-Math.PI / 2 + 1.05, 0.35, 0]} renderOrder={1} frustumCulled={false}><ringGeometry args={[0.985, 1, 128]} /></mesh>
      <sprite ref={flash} material={halo} renderOrder={4} frustumCulled={false} />
      {tier !== null && (
        <group ref={wordAnchor}>
          <Html center zIndexRange={[9, 9]} style={{ pointerEvents: 'none' }}>
            <div ref={word} className="whitespace-nowrap text-center" style={{ opacity: 0 }}>
              <p className="font-v2-ui text-readout font-bold uppercase tracking-wide text-v2-premium" style={{ textShadow: '0 0 14px rgb(255 207 107 / 0.55)' }}>
                {t('galaxy.coreTierUp', { tier })}
              </p>
              <p className="mt-1 font-v2-ui text-label text-v2-ink-2" style={{ textShadow: '0 1px 6px rgb(0 0 0 / 0.95)' }}>
                {t('galaxy.coreTierUpLine')}
              </p>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
