import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { PROBE_DEFENCE, toWorld } from '@astera/rules';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { playSceneSound } from './audio.js';
import { FULL_RATE_FPS, HoldRate } from './frames.jsx';
import { NUKE_SMOKE } from './NukeBlast.js';
import { Exhaust, Hull, PROBE_ROUTE } from './Fleets.jsx';
import {
  craftProgress, freshShots, readShotSeen, rememberShotSeen, roundLandsAt, roundProgress, SHOT_ENDS, SHOT_IMPACT, SHOT_ROUNDS,
  shotFrame, shotStartSecond, type ProbeShot,
} from './probeShots.js';
import { screenFloorScale } from './publicMoments.js';
import { createRehearsal, type Rehearsal } from './rehearsal.js';
import type { PlanetNode } from './scene.js';
import { atlasBatch } from './StrategicBlast.jsx';

/*
  A PROBE SHOT DOWN ON ITS APPROACH (2026-11-24, plan §4; placed on the approach after the owner's
  playtest: "yanlış yeri vuruyor, biraz geriden vurmalı"). VFX brief:
  1. In the world: the probe — the same craft its flight drew — is still coming in along its leg,
     nose to the world, engine lit; the battery on the facing surface opens fire while it is a few
     radii out (owner playtest 2: "ateşin sondaya ulaşması lazım"), each round aimed where the
     craft will be when it lands; the last meets it at the point, it comes apart in sparks and
     tumbling panels, its engine goes out and smoke is torn along the line it flew.
  2. Library: the rounds are Unique Projectiles' `laserbeam02` streak (`tracer-laserbeam.webp`),
     the smoke the Space Combat Kit flipbook the strike already uses; sparks and panels are drawn.
  3. Why this event: the rule acts in orbit, so the scene is there, and pieces flying apart —
     not a glow — is what says the craft was destroyed.
  One shot at a time, a fixed set of draws, no real light; rehearsed unseen when the galaxy mounts.
*/

export const SHOT_TRACER = '/assets/vfx/library/tracer-laserbeam.webp';
const SPARKS = 120;
const PANELS = 11;
const PUFFS = 3;
/** The whole moment never reads smaller than this across, so a shot over a far world is still seen. */
const MIN_PIXELS = 64;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_X = new THREE.Vector3(1, 0, 0);
/** A second shot waits this long behind the first. */
const STAGGER = 0.6;
const TRACER_COLOUR = new THREE.Color(1.0, 0.72, 0.38).multiplyScalar(2.2);
const HOT = new THREE.Color(1.0, 0.55, 0.2).multiplyScalar(1.6);
const METAL = new THREE.Color('#8b95a3');

const SPARK_VERT = /* glsl */`
  attribute vec4 aSeed;
  uniform float uT; uniform float uReach; uniform float uPx; uniform vec3 uOrigin;
  varying float vAge;
  void main() {
    float life = 0.45 + 0.45 * aSeed.w;
    float age = clamp(uT / life, 0.0, 1.0);
    float z = aSeed.x * 2.0 - 1.0; float a = aSeed.y * 6.2831853;
    vec3 dir = vec3(sqrt(1.0 - z * z) * cos(a), z, sqrt(1.0 - z * z) * sin(a));
    float speed = uReach * (0.5 + aSeed.z);
    vec3 p = uOrigin + dir * speed * (1.0 - exp(-4.0 * age));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vAge = age;
    gl_PointSize = clamp(uPx * (0.3 + 0.7 * (1.0 - age)) / max(-mv.z, 0.001), 1.0, 9.0) * step(0.0001, uT) * step(age, 0.999);
    gl_Position = projectionMatrix * mv;
  }`;
const SPARK_FRAG = /* glsl */`
  varying float vAge;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d2 = dot(q, q) * 4.0;
    float a = (1.0 - smoothstep(0.0, 1.0, d2)) * (1.0 - vAge);
    vec3 c = mix(vec3(1.0, 0.82, 0.55), vec3(1.0, 0.38, 0.08), sqrt(vAge));
    gl_FragColor = vec4(c * a * 2.2, 1.0);
  }`;

const hash = (n: number): number => { const x = Math.sin(n * 78.233 + 12.9) * 43758.5453; return x - Math.floor(x); };
const seedOf = (id: string): number => {
  let seed = 7;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 100_003;
  return seed;
};

interface LiveShot { shot: ProbeShot; start: number; node: PlanetNode; heard: boolean; hit: boolean }

export function ProbeShots({ nodes, shots, selfId }: {
  nodes: readonly PlanetNode[];
  /** The shots the player's intel names (`shotsOf`); absent outside the galaxy screen. */
  shots: readonly ProbeShot[] | undefined;
  selfId: string | undefined;
}) {
  const [tracerMap, smokeMap] = useTexture([SHOT_TRACER, NUKE_SMOKE]);
  const parts = useMemo(() => {
    const tracerGeometry = new THREE.PlaneGeometry(1, 1);
    const tracers = new THREE.InstancedMesh(tracerGeometry, new THREE.MeshBasicMaterial({
      map: tracerMap!, color: TRACER_COLOUR, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
    }), SHOT_ROUNDS);

    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    sparkGeometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(SPARKS * 4).map((_, i) => hash(i + 3)), 4));
    const sparkMaterial = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uT: { value: 0 }, uReach: { value: 1 }, uPx: { value: 0 }, uOrigin: { value: new THREE.Vector3() } },
    });
    const sparks = new THREE.Points(sparkGeometry, sparkMaterial);

    // The craft's own panels, flat as a solar wing, so what flies apart is the probe.
    const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.12, 0.6), new THREE.MeshBasicMaterial({ toneMapped: false }), PANELS);
    panels.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PANELS * 3), 3);


    const smoke = atlasBatch(smokeMap!, PUFFS, false, 8, 8, true);
    const puffs = new THREE.InstancedMesh(smoke.geometry, smoke.material, PUFFS);
    for (const [order, object] of [[5, tracers], [7, sparks], [6, panels], [4, puffs]] as const) {
      object.frustumCulled = false;
      object.renderOrder = order;
    }
    return { tracers, sparks, sparkMaterial, panels, smoke, puffs };
  }, [tracerMap, smokeMap]);
  useEffect(() => () => {
    const { tracers, sparks, sparkMaterial, panels, puffs } = parts;
    for (const mesh of [tracers, panels, puffs]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    sparks.geometry.dispose();
    sparkMaterial.dispose();
  }, [parts]);

  // Which shots this device has not shown this commander yet; each plays once.
  const queued = useRef<ProbeShot[]>([]);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!selfId || !shots) return;
    const seen = readShotSeen(selfId);
    const fresh = freshShots(shots, seen, serverNow());
    rememberShotSeen(selfId, new Set([...(seen ?? []), ...shots.map((shot) => shot.id)].filter((id) => shots.some((shot) => shot.id === id))));
    if (fresh.length === 0) return;
    queued.current.push(...fresh);
    setPlaying(true);
  }, [shots, selfId]);
  const where = useRef(nodes);
  useEffect(() => { where.current = nodes; }, [nodes]);

  const root = useRef<THREE.Group>(null);
  // The probe itself, the model its flight drew, carried on from where the flight left it.
  const craft = useRef<THREE.Group>(null);
  const rehearsal = useRef<Rehearsal | null>(null);
  const live = useRef<LiveShot[]>([]);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const centre = useMemo(() => new THREE.Vector3(), []);
  const at = useMemo(() => new THREE.Vector3(), []);
  const from = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const muzzle = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);
  const head = useMemo(() => new THREE.Vector3(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const across = useMemo(() => new THREE.Vector3(), []);
  const toCamera = useMemo(() => new THREE.Vector3(), []);
  const facing = useMemo(() => new THREE.Vector3(), []);
  const basis = useMemo(() => new THREE.Matrix4(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const none = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);

  useFrame(({ camera, clock, size, gl }) => {
    const group = root.current;
    if (!group) return;
    rehearsal.current ??= createRehearsal(group);
    if (rehearsal.current.next()) return;
    const now = clock.elapsedTime;
    for (const shot of queued.current.splice(0)) {
      const node = where.current.find((item) => item.id === shot.planetId);
      if (!node) continue;
      const last = live.current.at(-1);
      // In step with the server's clock: the moment opens on the second this screen heard of it.
      const begin = now - shotStartSecond(shot, serverNow());
      live.current.push({ shot, node, start: Math.max(begin, last ? last.start + STAGGER : begin), heard: false, hit: false });
    }
    live.current = live.current.filter((item) => now - item.start < SHOT_ENDS);
    // One moment drawn at a time: the oldest that has started.
    const current = live.current.find((item) => now >= item.start);
    group.visible = current !== undefined;
    if (craft.current && !current) craft.current.visible = false;
    if (!current) {
      if (playing && live.current.length === 0) setPlaying(false);
      return;
    }
    const t = now - current.start;
    const f = shotFrame(t);
    const seed = seedOf(current.shot.id);
    const r = current.node.radius;
    centre.set(...current.node.position);
    // Where the battery hit it: the point on its own approach, the same one every screen drew
    // the craft passing. An older server sent none: the same distance out, on a side of its own.
    if (current.shot.point) {
      at.set(...toWorld(current.shot.point));
      up.copy(at).sub(centre).normalize();
    } else {
      const a = hash(seed) * Math.PI * 2;
      up.set(Math.cos(a) * 0.7, 1, Math.sin(a) * 0.7).normalize();
      at.copy(centre).addScaledVector(up, r * PROBE_DEFENCE.reachRadii);
    }
    side.crossVectors(up, Math.abs(up.y) > 0.95 ? WORLD_X : WORLD_UP).normalize();
    // Where the craft was when the battery opened fire; without it, a little farther out on its line.
    if (current.shot.from) from.set(...toWorld(current.shot.from));
    else from.copy(at).addScaledVector(up, r * 1.5);
    // The battery stands on the surface that faces the craft.
    muzzle.copy(up).addScaledVector(side, 0.25).normalize().multiplyScalar(r * 1.02).add(centre);
    const grow = screenFloorScale(r * 2.6, at, camera, size.height, MIN_PIXELS);
    const unit = r * 0.14 * grow;

    if (!current.heard && roundProgress(0, t) !== null) {
      current.heard = true;
      playSceneSound('weapon', at, camera, current.shot.witness ? 0.6 : 1, `probe-shot:${current.shot.id}`);
    }
    if (!current.hit && t >= SHOT_IMPACT) {
      current.hit = true;
      playSceneSound('impact', at, camera, current.shot.witness ? 0.6 : 1, `probe-hit:${current.shot.id}`);
      if (!current.shot.witness) haptic(current.shot.own ? 'tap' : 'warn');
    }

    // The craft flies on, nose to the world, until the last round reaches it at the point.
    const ship = craft.current;
    if (ship) {
      ship.visible = f.craft > 0;
      ship.position.copy(from).lerp(at, craftProgress(t));
      ship.lookAt(centre);
    }

    // Rounds: streaks along their climb, turned to face the camera about their own axis.
    toCamera.copy(camera.position).sub(at).normalize();
    for (let i = 0; i < SHOT_ROUNDS; i++) {
      const k = roundProgress(i, t);
      if (k === null) { parts.tracers.setMatrixAt(i, none); continue; }
      // Each round is aimed where the craft will be when it lands. The early ones miss a little;
      // the last one is the hit.
      aim.copy(from).lerp(at, craftProgress(roundLandsAt(i)));
      const miss = i === SHOT_ROUNDS - 1 ? 0 : (hash(seed + i * 7) - 0.5) * r * 0.5;
      head.copy(muzzle).lerp(aim, k).addScaledVector(side, miss * k);
      axis.copy(aim).addScaledVector(side, miss).sub(muzzle).normalize();
      across.crossVectors(axis, toCamera).normalize();
      facing.crossVectors(axis, across);
      basis.makeBasis(axis, across, facing);
      scratch.position.copy(head).addScaledVector(axis, -unit * 1.6);
      scratch.quaternion.setFromRotationMatrix(basis);
      scratch.scale.set(unit * 3.2, unit * 0.55, 1);
      scratch.updateMatrix();
      parts.tracers.setMatrixAt(i, scratch.matrix);
    }
    parts.tracers.instanceMatrix.needsUpdate = true;

    // Sparks off the hit.
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
    const sparkUniforms = parts.sparkMaterial.uniforms;
    sparkUniforms.uT!.value = Math.max(0, t - SHOT_IMPACT) * (f.burst > 0 ? 1 : 0);
    sparkUniforms.uReach!.value = unit * 12;
    sparkUniforms.uPx!.value = unit * 0.4 * (size.height * gl.getPixelRatio()) / (2 * Math.tan((fov * Math.PI) / 360));
    (sparkUniforms.uOrigin!.value as THREE.Vector3).copy(at);

    // The panels fly apart and tumble, hot at first and cooling to bare metal.
    const age = Math.max(0, t - SHOT_IMPACT);
    for (let i = 0; i < PANELS; i++) {
      if (f.debris <= 0) { parts.panels.setMatrixAt(i, none); continue; }
      const z = hash(seed + i * 13) * 2 - 1;
      const b = hash(seed + i * 17) * Math.PI * 2;
      head.set(Math.sqrt(1 - z * z) * Math.cos(b), z, Math.sqrt(1 - z * z) * Math.sin(b));
      scratch.position.copy(at).addScaledVector(head, unit * (4 + 6 * hash(i + 5)) * (1 - Math.exp(-2.2 * age)));
      scratch.rotation.set(age * (2 + 3 * hash(i)), age * (1 + 2 * hash(i + 9)), age * 1.3);
      scratch.scale.setScalar(unit * (0.5 + 0.55 * hash(i + 2)) * f.debris);
      scratch.updateMatrix();
      parts.panels.setMatrixAt(i, scratch.matrix);
      parts.panels.setColorAt(i, tint.copy(HOT).lerp(METAL, Math.min(1, age / 0.6)));
    }
    parts.panels.instanceMatrix.needsUpdate = true;
    if (parts.panels.instanceColor) parts.panels.instanceColor.needsUpdate = true;

    for (let i = 0; i < PUFFS; i++) {
      const k = Math.min(1, age / (SHOT_ENDS - SHOT_IMPACT));
      // Torn along the line the craft flew in on, not a ball where it stood.
      scratch.position.copy(at).addScaledVector(up, unit * (i - 1) * (1.5 + 2.5 * k)).addScaledVector(side, unit * 0.6 * k);
      scratch.quaternion.copy(camera.quaternion);
      scratch.scale.setScalar(unit * (2.2 + 3.2 * k) * (0.8 + 0.2 * i));
      scratch.updateMatrix();
      parts.puffs.setMatrixAt(i, scratch.matrix);
      parts.smoke.frames.setX(i, 8 + k * 40 + i * 3);
      parts.smoke.alpha.setX(i, 0.45 * f.smoke);
      parts.smoke.colours.setXYZ(i, 0.75, 0.72, 0.7);
    }
    parts.puffs.instanceMatrix.needsUpdate = true;
    parts.smoke.frames.needsUpdate = true; parts.smoke.alpha.needsUpdate = true; parts.smoke.colours.needsUpdate = true;
  });

  return (
    <>
      <group ref={root} visible={false}>
        <HoldRate fps={FULL_RATE_FPS} active={playing} />
        <primitive object={parts.puffs} />
        <primitive object={parts.panels} />
        <primitive object={parts.tracers} />
        <primitive object={parts.sparks} />
      </group>
      {/* Outside the rehearsal: the probe's model is the flights' own, already warm, and a
          hidden parent would keep the rehearsal waiting on a draw that never comes. */}
      <group ref={craft} visible={false}>
        <Hull url={PROBE_ROUTE.url} scale={PROBE_ROUTE.scale} glow={PROBE_ROUTE.neon} focused={false} />
        <Exhaust url={PROBE_ROUTE.url} colour={PROBE_ROUTE.flame} scale={PROBE_ROUTE.scale} />
      </group>
    </>
  );
}
