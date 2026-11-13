import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { VIEW, toWorld } from '@astera/rules';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { FULL_RATE_FPS, HoldRate } from './frames.jsx';
import { screenFloorScale } from './publicMoments.js';
import { createRehearsal, type Rehearsal } from './rehearsal.js';
import type { PlanetNode } from './scene.js';
import { sensorShellColour, type ReachRing } from './SensorRings.jsx';
import {
  freshlyKnown, knownIds, planScan, readSeen, rememberSeen, SCAN_ARRIVES, SCAN_ENDS, SCAN_LOCKS, scanFrame, waveFrame,
  type ScanPlan, type ScanTarget, type ScanWave,
} from './scanReveal.js';
import { atlasBatch } from './StrategicBlast.jsx';

/*
  THE TELESCOPE'S DISCOVERY, IN THE GALAXY (owner approved the lab scan, 2026-11-12). A wave of
  instrument light leaves the eyes across the plane; as it reaches each newly known world a band
  sweeps it top to bottom and leaves a grid behind, a reticle (Sci-Fi Pack circle outlines) closes
  and locks, and the world lights in its pin's colour before giving way to its own look. A probe's
  world is swept where the probe stands. Four batched draws however many worlds light, no real
  light, rehearsed unseen when the galaxy mounts; sixty frames a second only while it plays.
*/

export const SCAN_RETICLE = '/assets/vfx/library/circles-outlines-2x2.webp';
const MAX_TARGETS = 48;
const MAX_WAVES = 4;
/** The reticle never reads smaller than this across, so a lock is seen from the whole disc. */
const RETICLE_MIN_PIXELS = 34;
const INSTRUMENT = new THREE.Color(sensorShellColour(true));

const SHELL_VERT = /* glsl */`
  attribute vec4 aScan; attribute vec4 aTone;
  varying vec3 vDir; varying vec3 vNormal; varying vec3 vView; varying vec4 vScan; varying vec4 vTone;
  void main() {
    vDir = normalize(position); vScan = aScan; vTone = aTone;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
// aScan: sweep, band, grid, reveal. aTone: the holder's colour, and the lock's flash.
const SHELL_FRAG = /* glsl */`
  uniform vec3 uInstrument;
  varying vec3 vDir; varying vec3 vNormal; varying vec3 vView; varying vec4 vScan; varying vec4 vTone;
  void main() {
    float facing = max(0.0, dot(vNormal, vView));
    float rim = (1.0 - facing) * (1.0 - facing);
    float y = vDir.y; float s = vScan.x;
    float a = (y - s) / 0.03; float b = (y - s) / 0.12;
    float band = exp(-(a * a)) * 1.6 + exp(-(b * b)) * 0.35;
    float lat = asin(clamp(y, -1.0, 1.0)) * 18.0 / 3.14159265;
    float lon = atan(vDir.z, vDir.x) * 24.0 / 6.28318530;
    float lines = max(1.0 - smoothstep(0.0, 0.08, abs(fract(lat) - 0.5) - 0.42), 1.0 - smoothstep(0.0, 0.08, abs(fract(lon) - 0.5) - 0.42));
    float grid = lines * smoothstep(s - 0.02, s + 0.25, y) * vScan.z * (0.35 + 0.65 * rim);
    float edge = pow(max(1.0 - facing, 0.0), 2.6);
    vec3 c = uInstrument * (band * vScan.y + grid * 0.55 + rim * 0.15 * vScan.y) + vTone.rgb * (edge * 1.4 * vScan.w + vTone.a * (0.25 + edge));
    gl_FragColor = vec4(c, 1.0);
  }`;
const WAVE_VERT = /* glsl */`
  attribute float aAlpha; varying vec2 vP; varying float vAlpha;
  void main() { vP = position.xz; vAlpha = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
// Never thinner than a pixel and a half, so the ring holds from the whole disc.
const WAVE_FRAG = /* glsl */`
  uniform vec3 uColour; varying vec2 vP; varying float vAlpha;
  void main() {
    float d = length(vP);
    float w = max(0.006, fwidth(d) * 1.5);
    float x = (d - 0.985) / w; float y = (d - 0.96) / max(0.04, w * 3.0);
    float ring = exp(-(x * x)) + 0.35 * exp(-(y * y)) * step(d, 1.0);
    gl_FragColor = vec4(uColour * ring * vAlpha, 1.0);
  }`;

interface LiveTarget { target: ScanTarget; start: number; locked: boolean }
interface LiveWave { wave: ScanWave; start: number }

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, count: number, order: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  mesh.count = 1;
  mesh.raycast = () => undefined;
  return mesh;
}

export function ScanReveals({ nodes, selfId, sensors }: {
  nodes: readonly PlanetNode[];
  selfId: string | undefined;
  sensors: readonly ReachRing[] | undefined;
}) {
  const reticleMap = useTexture(SCAN_RETICLE);
  const parts = useMemo(() => {
    const shellGeometry = new THREE.SphereGeometry(1, 48, 32);
    const scan = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TARGETS * 4), 4);
    const tone = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TARGETS * 4), 4);
    shellGeometry.setAttribute('aScan', scan);
    shellGeometry.setAttribute('aTone', tone);
    const shell = instanced(shellGeometry, new THREE.ShaderMaterial({
      vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uInstrument: { value: INSTRUMENT } },
    }), MAX_TARGETS, 2);

    // The band's edge, a little proud of the world, so the sweep reads as a scanner's line.
    const collarGeometry = new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2);
    const collar = instanced(collarGeometry, new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
    }), MAX_TARGETS, 3);
    collar.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TARGETS * 3), 3);

    const reticle = atlasBatch(reticleMap, MAX_TARGETS * 2, true, 2, 2, true);
    const reticles = instanced(reticle.geometry, reticle.material, MAX_TARGETS * 2, 4);

    const waveGeometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    const waveAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX_WAVES), 1);
    waveGeometry.setAttribute('aAlpha', waveAlpha);
    const waves = instanced(waveGeometry, new THREE.ShaderMaterial({
      vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false, uniforms: { uColour: { value: INSTRUMENT } },
    }), MAX_WAVES, 1);
    return { shell, scan, tone, collar, reticles, reticle, waves, waveAlpha };
  }, [reticleMap]);
  useEffect(() => () => {
    for (const mesh of [parts.shell, parts.collar, parts.reticles, parts.waves]) {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
      mesh.dispose();
    }
  }, [parts]);

  // What the galaxy newly knows, compared with what this device has already shown this commander.
  const queued = useRef<ScanPlan[]>([]);
  const [playing, setPlaying] = useState(false);
  // Read when the worlds change, not on every new array of the same eyes.
  const eyes = useRef(sensors);
  useEffect(() => { eyes.current = sensors; }, [sensors]);
  useEffect(() => {
    if (!selfId) return;
    const seen = readSeen(selfId);
    const known = knownIds(nodes, seen);
    if (seen === null || known.size > seen.size) rememberSeen(selfId, known);
    const fresh = freshlyKnown(nodes, seen).slice(0, MAX_TARGETS);
    if (fresh.length === 0) return;
    const reach = (eyes.current ?? []).map((post) => ({ at: toWorld(post.at), reach: post.identify / VIEW.scale }));
    queued.current.push(planScan(fresh, nodes, reach));
    setPlaying(true);
  }, [nodes, selfId]);

  const root = useRef<THREE.Group>(null);
  const rehearsal = useRef<Rehearsal | null>(null);
  const targets = useRef<LiveTarget[]>([]);
  const waves = useRef<LiveWave[]>([]);
  const buzzed = useRef(-Infinity);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const centre = useMemo(() => new THREE.Vector3(), []);
  const toCamera = useMemo(() => new THREE.Vector3(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const tones = useMemo(() => new Map<string, THREE.Color>(), []);

  useFrame(({ camera, clock, size }) => {
    const group = root.current;
    if (!group) return;
    rehearsal.current ??= createRehearsal(group);
    if (rehearsal.current.next()) return;
    const now = clock.elapsedTime;
    // A plan starts on the first frame it is drawn, so one that arrived while the tab slept is not lost.
    for (const plan of queued.current.splice(0)) {
      for (const wave of plan.waves) waves.current.push({ wave, start: now });
      for (const target of plan.targets) targets.current.push({ target, start: now + target.start, locked: false });
      if (plan.waves.length > 0) playSound('charge', { gain: 0.6, key: 'scan:wave' });
    }
    targets.current = targets.current.filter((live) => now - live.start < SCAN_ENDS - SCAN_ARRIVES).slice(-MAX_TARGETS);
    waves.current = waves.current.filter((live) => (now - live.start) / live.wave.travel < 1.5).slice(-MAX_WAVES);
    const busy = targets.current.length + waves.current.length > 0;
    group.visible = busy;
    if (!busy) {
      if (playing) setPlaying(false);
      return;
    }

    const { shell, scan, tone, collar, reticles, reticle, waves: waveMesh, waveAlpha } = parts;
    for (const [i, live] of targets.current.entries()) {
      const { target } = live;
      const local = now - live.start + SCAN_ARRIVES;
      const f = scanFrame(local);
      if (!live.locked && local >= SCAN_LOCKS) {
        live.locked = true;
        playSound('tick', { gain: 0.8, key: `scan:${target.id}` });
        if (now - buzzed.current > 0.4) { buzzed.current = now; haptic('tap'); }
      }
      const colour = tones.get(target.tone) ?? new THREE.Color(target.tone);
      tones.set(target.tone, colour);
      const r = target.radius;
      centre.set(...target.at);

      scratch.position.copy(centre);
      scratch.quaternion.identity();
      scratch.scale.setScalar(r * 1.012);
      scratch.updateMatrix();
      shell.setMatrixAt(i, scratch.matrix);
      scan.setXYZW(i, f.sweep, f.band, f.grid, f.reveal);
      tone.setXYZW(i, colour.r, colour.g, colour.b, f.flash);

      const s = Math.max(-0.999, Math.min(0.999, f.sweep));
      scratch.position.set(centre.x, centre.y + s * r * 1.012, centre.z);
      scratch.scale.setScalar(Math.sqrt(1 - s * s) * r * 1.035);
      scratch.updateMatrix();
      collar.setMatrixAt(i, scratch.matrix);
      collar.setColorAt(i, tint.copy(INSTRUMENT).multiplyScalar(f.band));

      // In front of the world it rings, so a nearer world still hides it.
      const grow = screenFloorScale(r * 2 * f.reticleSize, centre, camera, size.height, RETICLE_MIN_PIXELS);
      toCamera.copy(camera.position).sub(centre).normalize().multiplyScalar(r * 1.05);
      tint.copy(INSTRUMENT).lerp(colour, f.reveal);
      for (const k of [0, 1] as const) {
        const j = i * 2 + k;
        scratch.position.copy(centre).add(toCamera);
        scratch.quaternion.copy(camera.quaternion);
        scratch.rotateZ((k === 0 ? 1 : -1.4) * local * 0.6);
        scratch.scale.setScalar(r * 2 * f.reticleSize * (k === 0 ? 1 : 1.18) * grow);
        scratch.updateMatrix();
        reticles.setMatrixAt(j, scratch.matrix);
        reticle.frames.setX(j, k === 0 ? 0 : 2);
        reticle.alpha.setX(j, f.reticle);
        reticle.colours.setXYZ(j, tint.r, tint.g, tint.b);
      }
    }
    shell.count = Math.max(1, targets.current.length);
    collar.count = shell.count;
    reticles.count = shell.count * 2;
    if (targets.current.length === 0) { scan.setXYZW(0, 1, 0, 0, 0); tone.setW(0, 0); collar.setColorAt(0, tint.setRGB(0, 0, 0)); reticle.alpha.setX(0, 0); reticle.alpha.setX(1, 0); }

    for (const [i, live] of waves.current.entries()) {
      const w = waveFrame((now - live.start) / live.wave.travel);
      scratch.position.set(...live.wave.at);
      scratch.quaternion.identity();
      scratch.scale.setScalar(Math.max(0.001, live.wave.reach * w.radius));
      scratch.updateMatrix();
      waveMesh.setMatrixAt(i, scratch.matrix);
      waveAlpha.setX(i, w.alpha);
    }
    waveMesh.count = Math.max(1, waves.current.length);
    if (waves.current.length === 0) waveAlpha.setX(0, 0);

    for (const mesh of [shell, collar, reticles, waveMesh]) mesh.instanceMatrix.needsUpdate = true;
    if (collar.instanceColor) collar.instanceColor.needsUpdate = true;
    scan.needsUpdate = true; tone.needsUpdate = true; waveAlpha.needsUpdate = true;
    reticle.frames.needsUpdate = true; reticle.alpha.needsUpdate = true; reticle.colours.needsUpdate = true;
  });

  return (
    <group ref={root}>
      <HoldRate fps={FULL_RATE_FPS} active={playing} />
      <primitive object={parts.waves} />
      <primitive object={parts.shell} />
      <primitive object={parts.collar} />
      <primitive object={parts.reticles} />
    </group>
  );
}
