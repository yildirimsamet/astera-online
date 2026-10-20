import * as THREE from 'three';
import {
  ARENA_TUNING as T, alive, assistSteer, createFlightState, holdPoints, leadPoint, pilotVisible, stepSandboxWorld,
  type ArenaWorld, type FlightState, type Pilot, type SteeringSettings,
} from '@astera/rules/arena';
import type { QualityPreset } from '../lib/quality.js';
import type { ArenaAssets, PreparedModel } from './assets/load.js';
import type { ArenaAudio } from './audio.js';
import { createFrameDriver } from './driver.js';
import type { ArenaControls } from './input.js';
import type { ArenaNetwork } from './network.js';
import { ChaseCamera } from './render/camera.js';
import { createDust } from './render/dust.js';
import { Effects } from './render/effects.js';
import { createPost } from './render/post.js';
import { proceduralShip } from './render/procedural.js';
import { ShipVisual, type ShipPose } from './render/ships.js';
import { buildStage } from './render/stage.js';
import { applyCorrection, decayCorrection } from './smoothing.js';
import { describeGpu } from './diagnostics.js';
import { createLandingAssist, findLandingTarget } from './landing.js';
import type { HudStore } from './store.js';
import { arenaCopy } from './copy.js';
import { FARM_HEX } from './farmColors.js';

export const SHIP_LENGTH = 15;

export interface HudRefs {
  reticle: HTMLElement | null; lead: HTMLElement | null; hit: HTMLElement | null; kill: HTMLElement | null;
  enemies: HTMLElement[]; threats: HTMLElement[]; exit: HTMLElement | null; crystal: HTMLElement | null;
  damage: HTMLElement | null; rear: HTMLElement | null; radar: HTMLCanvasElement | null; landing: HTMLElement | null;
}

export interface ClientOptions {
  canvas: HTMLCanvasElement; assets: ArenaAssets; world: ArenaWorld; controls: ArenaControls; audio: ArenaAudio;
  settings: SteeringSettings; network: () => ArenaNetwork | null; store: HudStore; quality: QualityPreset;
  name: (pilot: Pilot) => string; onContextLost: () => void; log: (line: string) => void;
}

export type ClientPhase = 'preflight' | 'flight' | 'paused';

const scratch = new THREE.Vector3();
const forward = new THREE.Vector3();
const leadOut = { x: 0, y: 0, z: 0 };
/** Our ship as drawn this frame (interpolated), for HUD maths that must move with the camera. */
const shooterView = createFlightState();
const magnet = { x: 0, y: 0 };

function interpolate(out: { position: THREE.Vector3; quaternion: THREE.Quaternion }, previous: FlightState, current: FlightState, alpha: number): void {
  out.position.set(previous.p.x + (current.p.x - previous.p.x) * alpha, previous.p.y + (current.p.y - previous.p.y) * alpha,
    previous.p.z + (current.p.z - previous.p.z) * alpha);
  out.quaternion.set(previous.q.x, previous.q.y, previous.q.z, previous.q.w);
  scratchQ.set(current.q.x, current.q.y, current.q.z, current.q.w);
  out.quaternion.slerp(scratchQ, alpha);
}
const scratchQ = new THREE.Quaternion();
const velocityOf = (out: { x: number; y: number; z: number }, p: Pilot): void => {
  const q = p.q;
  out.x = 2 * (q.x * q.z + q.w * q.y) * p.s; out.y = 2 * (q.y * q.z - q.w * q.x) * p.s; out.z = (1 - 2 * (q.x * q.x + q.y * q.y)) * p.s;
};

/** The arena's renderer and frame loop. React only mounts it and draws the HUD panels. */
export function createArenaClient(options: ClientOptions) {
  const { canvas, assets, world, controls, audio, settings, store } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
  // The arena scene is lighter per pixel than the galaxy, so it can afford a sharper frame:
  // up to 2× except on the lowest preset (owner: edges and sky must be crisp).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.quality.dprCap <= 1 ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  options.log(describeGpu(renderer.getContext()));
  options.log(`dpr ${String(renderer.getPixelRatio())} · samples ${String(options.quality.multisampling)} · refs ${String(assets.references)} · rocks ${String(assets.rocks.length)} · sounds ${String(assets.sounds.size)}`);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  for (const texture of assets.textures.values()) texture.anisotropy = anisotropy;

  const stage = buildStage(assets, world.layout, renderer);
  const scene = stage.scene;
  const chase = new ChaseCamera(SHIP_LENGTH, world.layout);
  const camera = chase.camera;
  const post = createPost(renderer, scene, camera, options.quality.multisampling);
  const effects = new Effects(scene, assets.fx);
  const dust = createDust();
  // Turbo only: a dense swarm right around the lens, the nearest and fastest reference there is.
  const rush = createDust({ count: 320, size: 64, width: 0.06, near: [6, 15], boostOnly: true, stretch: 0.4 });
  scene.add(dust.mesh, rush.mesh);

  const heroModel: PreparedModel = assets.hero ?? proceduralShip('#d6e4f2');
  const own = new ShipVisual(heroModel, assets.fx, SHIP_LENGTH, true, scene, effects);
  const others = new Map<number, ShipVisual>();
  const modelFor = (pilot: Pilot): PreparedModel => {
    const role = options.network()?.roles.get(pilot.id) ?? world.brains.get(pilot.id)?.role;
    const rivals = assets.rivals;
    if (rivals.length === 0) return proceduralShip(role ? '#c48a6a' : '#9fb0c2');
    const pick = role === 'miner' ? rivals.length - 1 : role === 'hunter' ? 0 : role === 'patrol' ? 1 % rivals.length : (pilot.id * 7) % rivals.length;
    return rivals[pick] ?? rivals[0] ?? proceduralShip();
  };

  // Rear view: a second camera into a small HDR target, composited into the HUD window.
  const rearCamera = new THREE.PerspectiveCamera(70, 2.6, 0.5, 20000);
  const rearTarget = new THREE.WebGLRenderTarget(320, 120, { type: THREE.HalfFloatType, samples: 2 });
  const rearScene = new THREE.Scene();
  const rearQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rearTarget.texture, depthTest: false, depthWrite: false, toneMapped: true }));
  const uv = rearQuad.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); // a mirror, like a real one
  rearScene.add(rearQuad);
  const rearOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let hud: HudRefs = { reticle: null, lead: null, hit: null, kill: null, enemies: [], threats: [], exit: null, crystal: null, damage: null, rear: null, radar: null, landing: null };
  const landing = createLandingAssist();
  const crystalLive = (index: number): boolean => {
    const slot = world.layout.deposits.indexOf(index);
    return slot >= 0 && !world.dry[slot] && (world.minerals[slot] ?? 0) > 4;
  };
  const autopilot = { x: 0, y: 0, throttle: 0 };
  let phase: ClientPhase = 'preflight';
  let width = 1; let height = 1;
  let lost = false;
  const ownPose: ShipPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), throttle: 0, speed: 0, turbo: false,
    omegaYaw: 0, omegaPitch: 0, landed: false, mining: false, shield: 0, cloak: 0, hull: T.hull, hullMax: T.hull, visible: true, hitAt: 0, normal: new THREE.Vector3() };
  const otherPose: ShipPose = { ...ownPose, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), normal: new THREE.Vector3() };
  const seen = { compassKind: -1, shots: 0, hits: 0, kills: 0, damage: -100000, landed: 0, phase: 'flying' as Pilot['phase'], hitAt: -10, killAt: -10,
    damageAt: -10, damageAngle: 0, extractedAt: -1, deadAt: -1, warpIn: true, drawn: 0, lastHud: 0, time: 0, lastDraw: 0, bump: 0, turbo: false,
    landTarget: null as ReturnType<typeof findLandingTarget> };
  const droneShots = new Map<number, number>();
  const droneHull = new Map<number, { hull: number; at: number }>();
  const landedOffset = { index: -1, offset: 0 };
  const focus = { id: -1, locked: false };
  const metrics = { fps: 0, frameMs: 0, calls: 0, triangles: 0 };
  const deathPoint = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const probeMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  probeMesh.matrixAutoUpdate = false;

  /** The visible enemy nearest the nose: it owns the lead marker and the magnet. */
  const selectFocus = (): Pilot | undefined => {
    const pilot = world.pilot;
    const q = pilot.q;
    const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    let best: Pilot | undefined; let bestCos = Math.cos(THREE.MathUtils.degToRad(24));
    for (const drone of world.drones) {
      if (!alive(drone) || !pilotVisible(world, pilot, drone)) continue;
      const dx = drone.p.x - pilot.p.x; const dy = drone.p.y - pilot.p.y; const dz = drone.p.z - pilot.p.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > 1600 || distance < 1) continue;
      const cos = (dx * fx + dy * fy + dz * fz) / distance;
      if (cos > bestCos) { bestCos = cos; best = drone; }
    }
    focus.id = best?.id ?? -1;
    return best;
  };

  const step = (): void => {
    if (phase !== 'flight') return;
    const pilot = world.pilot;
    const target = alive(pilot) ? selectFocus() : undefined;
    let friction = 1; magnet.x = 0; magnet.y = 0;
    if (target) {
      velocityOf(leadOut, target);
      assistSteer(magnet, pilot, target.p, leadOut, controls.stick.x, controls.stick.y, controls.firing);
      if (leadPoint(scratch, pilot, target.p, leadOut)) {
        const q = pilot.q;
        const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
        const length = scratch.length();
        if (length > 0 && (scratch.x * fx + scratch.y * fy + scratch.z * fz) / length > 0.9986) friction = 0.68;
      }
    }
    const locked = magnet.x !== 0 || magnet.y !== 0;
    // One tone when the magnet takes hold, not a metronome for as long as it holds.
    if (locked && !focus.locked) audio.lock();
    focus.locked = locked;
    // Landing assist flies the approach; a deliberate stick input, turbo, or the end of
    // powered flight hands control back.
    if (landing.phase === 'approach' && (pilot.phase !== 'flying' || controls.pressed('turbo') || pilot.turboActive)) landing.cancel();
    const stick = Math.hypot(controls.stick.x, controls.stick.y);
    const flying = landing.steer(pilot, stick, performance.now(), autopilot);
    if (flying) controls.setThrottle(autopilot.throttle);
    const intent = controls.sample(friction, magnet.x, magnet.y, flying ? autopilot : undefined);
    const network = options.network();
    if (network) network.step(intent);
    else stepSandboxWorld(world, intent, settings);
    // Touching down zeroes the lever, so the next push is always a deliberate take-off.
    if (world.pilot.landed && !seen.landed) controls.stop();
    seen.landed = world.pilot.landed;
  };

  const project = (x: number, y: number, z: number): { x: number; y: number; behind: boolean; depth: number } => {
    scratch.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    const depth = -scratch.z;
    scratch.applyMatrix4(camera.projectionMatrix);
    return { x: (scratch.x + 1) / 2 * width, y: (1 - scratch.y) / 2 * height, behind: depth <= 0, depth };
  };
  /** Lower edge of the free band: above the thumbs, and above our own ship's nose. */
  let bandBottom = 512;
  /** Clamps an off-screen point to an ellipse inside the free middle band (clear of HUD, thumbs and our ship). */
  const edge = (px: number, py: number, behind: boolean, margin: number): { x: number; y: number; angle: number } => {
    const top = 205; const bottom = bandBottom;
    const cx = width / 2; const cy = (top + bottom) / 2;
    let dx = px - cx; let dy = py - cy;
    if (behind) { dx = -dx; dy = -dy; if (Math.abs(dx) + Math.abs(dy) < 1) dy = 1; }
    const rx = width / 2 - margin - 18; const ry = (bottom - top) / 2;
    const k = 1 / Math.max(1e-6, Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)));
    return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx) };
  };

  const drawHud = (time: number): void => {
    const pilot = world.pilot;
    const flying = alive(pilot) && phase === 'flight';
    // Everything screen-space reads the INTERPOLATED pose the camera follows. The raw sim
    // state only changes on 30 Hz ticks: in a turn a reticle built from it sat in one place
    // on tick frames and another between ticks, and the eye saw two crosshairs.
    forward.set(0, 0, 1).applyQuaternion(ownPose.quaternion);
    shooterView.p.x = ownPose.position.x; shooterView.p.y = ownPose.position.y; shooterView.p.z = ownPose.position.z;
    shooterView.q.x = ownPose.quaternion.x; shooterView.q.y = ownPose.quaternion.y; shooterView.q.z = ownPose.quaternion.z;
    shooterView.q.w = ownPose.quaternion.w; shooterView.s = pilot.s;
    // Markers pushed to the bottom edge must not land on the hull that is drawn there.
    const hull = project(ownPose.position.x, ownPose.position.y, ownPose.position.z);
    bandBottom = Math.max(260, Math.min(height - 300, hull.behind ? height - 300 : hull.y - 70));
    // Reticle: where the two guns converge.
    if (hud.reticle) {
      const aim = project(ownPose.position.x + forward.x * T.convergeDist, ownPose.position.y + forward.y * T.convergeDist, ownPose.position.z + forward.z * T.convergeDist);
      hud.reticle.style.transform = `translate3d(${aim.x.toFixed(1)}px,${aim.y.toFixed(1)}px,0)`;
      hud.reticle.style.opacity = flying && !aim.behind ? '1' : '0';
      hud.reticle.toggleAttribute('data-locked', focus.locked);
      if (hud.hit) hud.hit.style.transform = hud.reticle.style.transform;
      if (hud.kill) hud.kill.style.transform = hud.reticle.style.transform;
    }
    if (hud.hit) hud.hit.style.opacity = time - seen.hitAt < 0.15 ? '1' : '0';
    if (hud.kill) { const k = Math.max(0, 1 - (time - seen.killAt) / 1.1); hud.kill.style.opacity = String(k); hud.kill.style.setProperty('--k', String(1 - k)); }
    // Enemies: bracket on screen, arrow on the edge when off screen and close.
    let slot = 0; let threat = 0;
    for (const drone of world.drones) {
      if (!alive(drone) || !pilotVisible(world, pilot, drone)) continue;
      const dx = drone.p.x - pilot.p.x; const dy = drone.p.y - pilot.p.y; const dz = drone.p.z - pilot.p.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // A landed pilot far away is quiet: no marker, unless the mining beam gives it away.
      if (drone.landed && !drone.mining && distance > 320) continue;
      if (distance > (drone.mining ? 2400 : 1600)) continue;
      const visual = others.get(drone.id);
      const at = visual ? visual.group.position : scratch.set(drone.p.x, drone.p.y, drone.p.z);
      const screen = project(at.x, at.y, at.z);
      const onScreen = !screen.behind && screen.x > 8 && screen.x < width - 8 && screen.y > 60 && screen.y < height - 120;
      if (onScreen && slot < hud.enemies.length) {
        const node = hud.enemies[slot++];
        if (!node) continue;
        node.style.display = 'block';
        node.style.transform = `translate3d(${screen.x.toFixed(1)}px,${screen.y.toFixed(1)}px,0)`;
        const size = Math.max(22, Math.min(90, SHIP_LENGTH * 1.3 * height / Math.max(1, screen.depth) / 1.6));
        node.style.setProperty('--size', `${size.toFixed(0)}px`);
        node.toggleAttribute('data-focus', drone.id === focus.id);
        node.toggleAttribute('data-mining', drone.mining);
        if (seen.drawn % 6 === 0) {
          const name = node.querySelector('[data-name]'); if (name) name.textContent = options.name(drone);
          const label = node.querySelector('[data-distance]'); if (label) label.textContent = `${String(Math.round(distance))} m`;
          // Width is a layout write: with the labels, not every frame.
          const bar = node.querySelector<HTMLElement>('[data-hull]'); if (bar) bar.style.width = `${String(drone.hull / T.hull * 100)}%`;
        }
      } else if (!onScreen && distance < 1100 && threat < hud.threats.length) {
        const node = hud.threats[threat++];
        if (!node) continue;
        const e = edge(screen.x, screen.y, screen.behind, 26);
        node.style.display = 'block';
        node.style.transform = `translate3d(${e.x.toFixed(1)}px,${e.y.toFixed(1)}px,0) rotate(${e.angle.toFixed(3)}rad)`;
        node.style.opacity = String(0.45 + 0.55 * (1 - distance / 1100));
      }
    }
    for (let i = slot; i < hud.enemies.length; i++) { const node = hud.enemies[i]; if (node) node.style.display = 'none'; }
    for (let i = threat; i < hud.threats.length; i++) { const node = hud.threats[i]; if (node) node.style.display = 'none'; }
    // Lead: where to shoot so the bolt meets the focused target (S73).
    const target = world.drones.find(drone => drone.id === focus.id);
    if (hud.lead) {
      if (target && flying) {
        velocityOf(leadOut, target);
        // The target as drawn (its interpolated hull), seen from our ship as drawn.
        const seenAt = others.get(target.id)?.group.position ?? target.p;
        if (leadPoint(scratch, shooterView, seenAt, leadOut)) {
          const p = project(ownPose.position.x + scratch.x, ownPose.position.y + scratch.y, ownPose.position.z + scratch.z);
          hud.lead.style.display = p.behind ? 'none' : 'block';
          hud.lead.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0)`;
        } else hud.lead.style.display = 'none';
      } else hud.lead.style.display = 'none';
    }
    // Nearest exit: always findable.
    if (hud.exit) {
      let best = world.layout.exits[0]; let bestDistance = Infinity;
      for (const exit of world.layout.exits) {
        const d = Math.hypot(exit.x - pilot.p.x, exit.y - pilot.p.y, exit.z - pilot.p.z);
        if (d < bestDistance) { bestDistance = d; best = exit; }
      }
      if (best && flying) {
        const p = project(best.x, best.y + 40, best.z);
        const inside = !p.behind && p.x > 30 && p.x < width - 60 && p.y > 205 && p.y < bandBottom;
        const e = inside ? { x: p.x, y: p.y, angle: 0 } : edge(p.x, p.y, p.behind, 30);
        hud.exit.style.display = 'block';
        hud.exit.toggleAttribute('data-edge', !inside);
        hud.exit.style.transform = `translate3d(${e.x.toFixed(1)}px,${e.y.toFixed(1)}px,0)`;
        hud.exit.style.setProperty('--angle', `${e.angle.toFixed(3)}rad`);
        if (seen.drawn % 6 === 0) {
          const label = hud.exit.querySelector('[data-distance]'); if (label) label.textContent = `${String(Math.round(bestDistance))} m`;
          // What is riding on reaching it: the hold's score, once there is one.
          const points = holdPoints(pilot.hold); const stake = hud.exit.querySelector('[data-points]');
          if (stake) stake.textContent = points > 0 ? ` · ${String(points)} ${arenaCopy().pointsShort}` : '';
        }
      } else hud.exit.style.display = 'none';
    }
    // Nearest live deposit while the hold has room: the farmer's compass, in the deposit's colour.
    if (hud.crystal) {
      let best = -1; let bestDistance = 760; let bestKind = 1;
      world.layout.deposits.forEach((index, slotIndex) => {
        const o = world.layout.obstacles[index];
        if (!o || world.dry[slotIndex] || (world.minerals[slotIndex] ?? 0) < 6) return;
        const d = Math.hypot(o.p.x - pilot.p.x, o.p.y - pilot.p.y, o.p.z - pilot.p.z) - o.radius;
        if (d < bestDistance) { bestDistance = d; best = index; bestKind = world.layout.depositKinds[slotIndex] ?? 1; }
      });
      if (seen.compassKind !== bestKind) {
        seen.compassKind = bestKind;
        hud.crystal.style.setProperty('--crystal', FARM_HEX[bestKind] ?? FARM_HEX[1]);
        const name = hud.crystal.querySelector('[data-kind]'); if (name) name.textContent = arenaCopy().kinds[bestKind] ?? '';
      }
      const o = world.layout.obstacles[best];
      if (o && flying && !pilot.landed && pilot.cargo < T.cargoCapacity) {
        const p = project(o.p.x, o.p.y, o.p.z);
        hud.crystal.style.display = p.behind ? 'none' : 'block';
        hud.crystal.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0)`;
        if (seen.drawn % 6 === 0) { const label = hud.crystal.querySelector('[data-distance]'); if (label) label.textContent = `${String(Math.round(Math.max(0, bestDistance)))} m`; }
      } else hud.crystal.style.display = 'none';
    }
    if (hud.damage) {
      const fade = Math.max(0, 1 - (time - seen.damageAt) / 1.3);
      hud.damage.style.opacity = String(fade);
      hud.damage.style.transform = `translate(-50%,-50%) rotate(${seen.damageAngle.toFixed(3)}rad)`;
    }
    if (hud.radar && seen.drawn % 3 === 0) drawRadar(hud.radar);
    // Touchdown marker: where the landing assist is taking you, or where a tap would.
    if (hud.landing) {
      const target = landing.target ?? (flying && !pilot.landed && pilot.s < 90 && seen.drawn % 6 === 0 ? findLandingTarget(world.layout, pilot, crystalLive) : seen.landTarget);
      if (seen.drawn % 6 === 0 && !landing.target) seen.landTarget = target;
      if (target && flying && !pilot.landed) {
        const p = project(target.point.x, target.point.y, target.point.z);
        hud.landing.style.display = p.behind ? 'none' : 'block';
        hud.landing.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0)`;
        hud.landing.toggleAttribute('data-active', landing.phase === 'approach');
      } else hud.landing.style.display = 'none';
    }
  };

  const drawRadar = (canvasElement: HTMLCanvasElement): void => {
    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;
    const size = canvasElement.width; const r = size / 2; const range = 1000;
    ctx.clearRect(0, 0, size, size);
    const pilot = world.pilot;
    // Heading and centre as drawn this frame, like the reticle (see drawHud).
    const q = shooterView.q; const me = shooterView.p;
    const fx = 2 * (q.x * q.z + q.w * q.y); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    const fl = Math.hypot(fx, fz) || 1; const hx = fx / fl; const hz = fz / fl;
    const place = (x: number, z: number): [number, number] => {
      const dx = x - me.x; const dz = z - me.z;
      // Heading up: forward is screen-up, right is screen-right (right = −X in local terms).
      const side = -(dx * hz - dz * hx); const ahead = dx * hx + dz * hz;
      return [r + side / range * r * 0.92, r - ahead / range * r * 0.92];
    };
    ctx.strokeStyle = 'rgba(46,230,200,0.18)'; ctx.lineWidth = 1;
    for (const ring of [0.33, 0.66, 0.92]) { ctx.beginPath(); ctx.arc(r, r, r * ring, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(r, r * 0.08); ctx.lineTo(r, r); ctx.stroke();
    world.layout.deposits.forEach((index, slotIndex) => {
      const o = world.layout.obstacles[index];
      if (!o || world.dry[slotIndex] || Math.hypot(o.p.x - me.x, o.p.z - me.z) > range) return;
      const [x, y] = place(o.p.x, o.p.z);
      ctx.fillStyle = FARM_HEX[world.layout.depositKinds[slotIndex] ?? 1] ?? FARM_HEX[1]; ctx.globalAlpha = 0.8; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    });
    // Loose ore and wreck pieces: small dots, so a scattered hold shows up as a little cloud.
    for (const drop of world.cargoDrops) {
      if (!drop.active || Math.hypot(drop.p.x - me.x, drop.p.z - me.z) > range) continue;
      const [x, y] = place(drop.p.x, drop.p.z);
      ctx.fillStyle = FARM_HEX[drop.kind] ?? FARM_HEX[0]; ctx.globalAlpha = 0.9; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    for (const exit of world.layout.exits) {
      const distance = Math.hypot(exit.x - me.x, exit.z - me.z);
      let [x, y] = place(exit.x, exit.z);
      if (distance > range) { const a = Math.atan2(y - r, x - r); x = r + Math.cos(a) * r * 0.92; y = r + Math.sin(a) * r * 0.92; }
      ctx.strokeStyle = '#2ee6c8'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 3, y - 3, 6, 6);
    }
    for (const drone of world.drones) {
      if (!alive(drone) || !pilotVisible(world, pilot, drone)) continue;
      const distance = Math.hypot(drone.p.x - me.x, drone.p.z - me.z);
      if (drone.landed && !drone.mining && distance > 320) continue;
      if (distance > range * (drone.mining ? 1.6 : 1)) continue;
      const [x, y] = place(drone.p.x, drone.p.z);
      const dy = drone.p.y - me.y;
      const cx = Math.min(size - 4, Math.max(4, x)); const cy = Math.min(size - 4, Math.max(4, y));
      ctx.strokeStyle = 'rgba(255,90,60,0.6)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - Math.max(-10, Math.min(10, dy / 40))); ctx.stroke();
      ctx.fillStyle = drone.mining ? '#ffd166' : '#ff5a3c';
      ctx.beginPath(); ctx.arc(cx, cy - Math.max(-10, Math.min(10, dy / 40)), drone.id === focus.id ? 3.4 : 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#e6fbff'; ctx.beginPath(); ctx.moveTo(r, r - 5); ctx.lineTo(r + 3.5, r + 4); ctx.lineTo(r - 3.5, r + 4); ctx.closePath(); ctx.fill();
  };

  const draw = (now: number, alpha: number): void => {
    if (lost) return;
    const time = now / 1000;
    const dt = Math.min(0.1, Math.max(0, time - (seen.lastDraw || time)));
    seen.lastDraw = time;
    const pilot = world.pilot;
    const blend = phase === 'flight' ? alpha : 1;
    // Own ship.
    interpolate(ownPose, world.previous, pilot, blend);
    const net = options.network();
    if (net) { decayCorrection(net.correction, dt); applyCorrection(net.correction, ownPose); }
    ownPose.throttle = pilot.throttle; ownPose.speed = pilot.s; ownPose.turbo = pilot.turboActive;
    ownPose.omegaYaw = pilot.omegaYaw; ownPose.omegaPitch = pilot.omegaPitch; ownPose.landed = pilot.landed > 0;
    ownPose.mining = pilot.mining; ownPose.shield = pilot.shield; ownPose.cloak = pilot.cloak; ownPose.hull = pilot.hull;
    ownPose.normal.set(pilot.nx, pilot.ny, pilot.nz);
    ownPose.visible = alive(pilot) || (pilot.phase === 'extracted' && time - seen.extractedAt < 1.1);
    if (pilot.lastDamage > seen.damage) {
      seen.damage = pilot.lastDamage; seen.damageAt = time; ownPose.hitAt = time;
      chase.kick(0.42); post.hurt(0.7);
      const attacker = world.drones.find(drone => drone.id === pilot.lastAttacker);
      if (attacker) {
        scratch.set(attacker.p.x, attacker.p.y, attacker.p.z).applyMatrix4(camera.matrixWorldInverse);
        seen.damageAngle = Math.atan2(scratch.x, scratch.y);
      }
    }
    // Landed: rest the hull on the rock's real surface, not on its round collider. `lift` is
    // how far along the normal the drawn ship moves from the simulated centre.
    if (pilot.landed) {
      if (landedOffset.index !== pilot.landed) {
        const half = heroModel.size.y * SHIP_LENGTH * 0.42;
        landedOffset.index = pilot.landed; landedOffset.offset = half - T.shipHitRadius;
        const rock = stage.rockInstances.get(pilot.landed - 1);
        if (rock) {
          const normal = ownPose.normal;
          probeMesh.geometry = rock.geometry; probeMesh.matrixWorld.copy(rock.matrix);
          raycaster.set(scratch.copy(ownPose.position).addScaledVector(normal, 40), forward.copy(normal).negate());
          raycaster.far = 120;
          const hit = raycaster.intersectObject(probeMesh, false)[0];
          if (hit) landedOffset.offset = 40 - hit.distance + half;
          landedOffset.offset = Math.max(-T.shipHitRadius * 1.6, Math.min(T.shipHitRadius, landedOffset.offset));
        }
      }
      ownPose.position.addScaledVector(ownPose.normal, landedOffset.offset);
    } else landedOffset.index = -1;
    if (pilot.phase === 'extracted') {
      if (seen.extractedAt < 0) { seen.extractedAt = time; effects.warp(ownPose.position.x, ownPose.position.y, ownPose.position.z, '#57ffe0'); }
      const t = time - seen.extractedAt;
      forward.set(0, 0, 1).applyQuaternion(ownPose.quaternion);
      ownPose.position.addScaledVector(forward, t * t * 260);
      ownPose.speed = 400; ownPose.turbo = true; ownPose.throttle = 1;
    } else seen.extractedAt = -1;
    // Turbo: the lens streaks the edges and the camera is kicked back as the ship surges.
    const boosting = alive(pilot) && pilot.turboActive && phase === 'flight';
    if (boosting && !seen.turbo) { post.speed(1, 0.6); chase.kick(0.3); }
    else post.speed(boosting ? 1 : 0);
    seen.turbo = boosting;
    if (pilot.phase === 'dead' && seen.deadAt < 0) { seen.deadAt = time; deathPoint.copy(ownPose.position); chase.kick(1); post.hurt(1); }
    if (pilot.phase !== 'dead') seen.deadAt = -1;
    own.update(ownPose, time, dt);
    if (pilot.bump > 0.12 && alive(pilot) && pilot.bump !== seen.bump) {
      // One burst per impact, at the side of the hull that hit.
      scratch.set(-pilot.kx, -pilot.ky, -pilot.kz);
      if (scratch.lengthSq() > 0) scratch.normalize().multiplyScalar(T.shipHitRadius);
      effects.scrape(ownPose.position.x + scratch.x, ownPose.position.y + scratch.y, ownPose.position.z + scratch.z, pilot.bump);
      chase.kick(pilot.bump * 0.6);
    }
    seen.bump = pilot.bump;
    if (pilot.mining && seen.drawn % 2 === 0) {
      effects.mining(ownPose.position.x - pilot.nx * 5, ownPose.position.y - pilot.ny * 5, ownPose.position.z - pilot.nz * 5, pilot.nx, pilot.ny, pilot.nz);
    }
    if (seen.warpIn && phase === 'flight') { seen.warpIn = false; effects.warp(ownPose.position.x, ownPose.position.y, ownPose.position.z, '#7fdcff'); }
    // Own fire: a flash at the gun that fired.
    if (world.shots > seen.shots) {
      const side = (pilot.gun % 2 === 0) ? 1 : -1;
      own.muzzle(scratch, side);
      forward.set(0, 0, 1).applyQuaternion(ownPose.quaternion);
      effects.muzzle(scratch, forward, true, pilot.s);
    }
    seen.shots = world.shots;
    if (pilot.hits > seen.hits) seen.hitAt = time;
    seen.hits = pilot.hits;
    if (pilot.kills > seen.kills) { seen.killAt = time; chase.kick(0.25); }
    seen.kills = pilot.kills;
    // Other pilots.
    const present = new Set<number>();
    world.drones.forEach((drone, i) => {
      const previous = world.dronePrevious[i];
      if (!previous) return;
      present.add(drone.id);
      let visual = others.get(drone.id);
      if (!visual) { visual = new ShipVisual(modelFor(drone), assets.fx, SHIP_LENGTH, false, scene, effects); others.set(drone.id, visual); }
      interpolate(otherPose, previous, drone, blend);
      otherPose.throttle = drone.throttle; otherPose.speed = drone.s; otherPose.turbo = drone.turboActive;
      otherPose.omegaYaw = drone.omegaYaw; otherPose.omegaPitch = drone.omegaPitch; otherPose.landed = drone.landed > 0;
      otherPose.mining = drone.mining; otherPose.shield = drone.shield; otherPose.cloak = drone.cloak; otherPose.hull = drone.hull;
      otherPose.visible = alive(drone) && drone.cloak === 0;
      const record = droneHull.get(drone.id);
      if (record && drone.hull < record.hull) record.at = time;
      if (!record) droneHull.set(drone.id, { hull: drone.hull, at: -10 }); else record.hull = drone.hull;
      otherPose.hitAt = droneHull.get(drone.id)?.at ?? -10;
      if (otherPose.landed) otherPose.position.addScaledVector(scratch.set(drone.nx, drone.ny, drone.nz), -(T.shipHitRadius - 2.4));
      visual.update(otherPose, time, dt);
      const shots = droneShots.get(drone.id);
      if (shots !== undefined && drone.shots > shots && otherPose.visible) {
        visual.muzzle(scratch, drone.gun % 2 === 0 ? 1 : -1);
        forward.set(0, 0, 1).applyQuaternion(otherPose.quaternion);
        effects.muzzle(scratch, forward, false, drone.s);
      }
      droneShots.set(drone.id, drone.shots);
      if (drone.mining && seen.drawn % 3 === 0) effects.mining(otherPose.position.x - drone.nx * 5, otherPose.position.y - drone.ny * 5, otherPose.position.z - drone.nz * 5, drone.nx, drone.ny, drone.nz);
    });
    for (const [id, visual] of others) {
      if (present.has(id)) continue;
      visual.dispose(scene); others.delete(id); droneShots.delete(id); droneHull.delete(id);
    }
    // Camera.
    const aspect = width / Math.max(1, height);
    if (pilot.phase === 'dead') {
      const t = time - seen.deadAt;
      camera.position.set(deathPoint.x + Math.sin(t * 0.35) * 70, deathPoint.y + 28, deathPoint.z + Math.cos(t * 0.35) * 70);
      camera.up.set(0, 1, 0); camera.lookAt(deathPoint); camera.updateMatrixWorld();
    } else if (phase === 'preflight') {
      const t = time * 0.12;
      chase.snap();
      camera.position.copy(ownPose.position).add(scratch.set(Math.sin(t) * 34, 9 + Math.sin(t * 0.7) * 3, Math.cos(t) * 34));
      camera.up.set(0, 1, 0); camera.lookAt(ownPose.position);
      camera.fov = aspect < 1 ? 58 : 45; camera.aspect = aspect; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    } else if (pilot.phase !== 'extracted' || time - seen.extractedAt < 0.2) {
      chase.update({ position: ownPose.position, quaternion: ownPose.quaternion, speed: ownPose.speed, speedMax: T.speedMax,
        accel: (pilot.s - world.previous.s) * T.tickRate, turbo: ownPose.turbo, landed: ownPose.landed, omegaYaw: pilot.omegaYaw, omegaPitch: pilot.omegaPitch }, dt, aspect);
    }
    // World effects.
    effects.watchImpacts(world, pilot.id, () => undefined, () => undefined);
    effects.drawBolts(world, blend, pilot.id, options.network() !== null);
    effects.drawSmoke(world, time);
    effects.update(dt);
    forward.set(0, 0, 1).applyQuaternion(ownPose.quaternion).multiplyScalar(ownPose.speed);
    dust.update(camera.position, forward, ownPose.turbo, alive(pilot) && phase === 'flight', dt);
    rush.update(camera.position, forward, ownPose.turbo, alive(pilot) && phase === 'flight', dt);
    stage.update(time, world, camera.position);
    post.haze(stage.haze.color, stage.haze.amount);
    scratch.set(1, 0, 0).applyQuaternion(camera.quaternion);
    audio.listen(camera.position.x, camera.position.y, camera.position.z, scratch.x, scratch.y, scratch.z);
    audio.update(world, phase !== 'paused');
    drawHud(time);
    if (time - seen.lastHud > 0.1) {
      seen.lastHud = time;
      store.publish(world, phase, focus.locked, canLand(), pilot.landed ? 'landed' : landing.phase === 'approach' ? 'approach' : 'idle',
        landing.distance(pilot));
    }
    // Frame.
    renderer.info.reset();
    renderer.setRenderTarget(null);
    stage.cull(camera, 3800, world);
    post.render(dt);
    renderRear();
    seen.drawn++;
    metrics.calls = renderer.info.render.calls; metrics.triangles = renderer.info.render.triangles;
    metrics.fps = metrics.fps === 0 ? 1 / Math.max(dt, 0.001) : metrics.fps * 0.92 + 0.08 / Math.max(dt, 0.001);
    metrics.frameMs = performance.now() - now;
    if (import.meta.env.DEV && seen.drawn % 180 === 1) {
      const gl = renderer.getContext();
      const error = gl.getError();
      if (error !== gl.NO_ERROR) options.log(`gl error 0x${error.toString(16)}`);
      options.log(`fps ${metrics.fps.toFixed(0)} · calls ${String(metrics.calls)} · tris ${String(metrics.triangles)} · ${phase}`);
    }
  };

  const canLand = (): boolean => {
    const pilot = world.pilot;
    if (!alive(pilot) || pilot.landed || pilot.s > 90) return false;
    return findLandingTarget(world.layout, pilot, crystalLive) !== null;
  };

  const renderRear = (): void => {
    const node = hud.rear;
    if (!node || phase !== 'flight' || !alive(world.pilot)) return;
    const box = node.getBoundingClientRect(); const frame = canvas.getBoundingClientRect();
    const w = Math.round(box.width); const h = Math.round(box.height);
    if (w < 10 || h < 10) return;
    const dpr = renderer.getPixelRatio();
    if (seen.drawn % 2 === 0) {
      const tw = Math.round(w * Math.min(dpr, 1.5)); const th = Math.round(h * Math.min(dpr, 1.5));
      if (rearTarget.width !== tw || rearTarget.height !== th) rearTarget.setSize(tw, th);
      rearCamera.aspect = w / h; rearCamera.updateProjectionMatrix();
      rearCamera.position.copy(ownPose.position).add(scratch.set(0, SHIP_LENGTH * 0.25, 0).applyQuaternion(ownPose.quaternion));
      rearCamera.up.set(0, 1, 0).applyQuaternion(ownPose.quaternion);
      rearCamera.lookAt(scratch.set(0, 0, -100).applyQuaternion(ownPose.quaternion).add(rearCamera.position));
      stage.cull(rearCamera, 1800, world);
      own.group.visible = false; own.setExhaustVisible(false);
      renderer.setRenderTarget(rearTarget); renderer.clear(); renderer.render(scene, rearCamera);
      renderer.setRenderTarget(null);
      own.group.visible = true; own.setExhaustVisible(true);
    }
    const x = box.left - frame.left; const y = frame.height - (box.top - frame.top) - h;
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.setScissorTest(true);
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.render(rearScene, rearOrtho);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height);
  };

  const driver = createFrameDriver(step, draw);
  let handle = 0;
  const loop = (at: number): void => { handle = requestAnimationFrame(loop); driver.advance(at, true); };

  const onLost = (event: Event): void => { event.preventDefault(); lost = true; options.log('webgl context lost'); options.onContextLost(); };
  canvas.addEventListener('webglcontextlost', onLost);

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width)); height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false); post.setSize(width, height);
    camera.aspect = width / height; camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize); observer.observe(canvas);

  return {
    metrics, renderer, scene, camera,
    get phase(): ClientPhase { return phase; },
    setPhase(next: ClientPhase): void {
      if (next === 'flight' && phase === 'preflight') seen.warpIn = true;
      phase = next;
    },
    setHud(refs: HudRefs): void { hud = refs; },
    /** One tap: pick a touchdown point ahead and fly onto it. */
    land(): boolean { return landing.begin(world.layout, world.pilot, performance.now(), crystalLive); },
    cancelLanding(): void { landing.cancel(); },
    /** Compiles every shader before the first flight frame (no hitch on first fire). */
    async warm(): Promise<void> {
      resize();
      const started = performance.now();
      try { await renderer.compileAsync(scene, camera); }
      catch (error) { options.log(`compile failed: ${error instanceof Error ? error.message : String(error)}`); }
      options.log(`shaders ${String(Math.round(performance.now() - started))} ms · ${String(width)}×${String(height)}`);
      draw(performance.now(), 1);
    },
    start(): void { if (!handle) handle = requestAnimationFrame(loop); },
    reset(): void {
      landing.reset();
      seen.warpIn = true; seen.deadAt = -1; seen.extractedAt = -1; seen.damage = world.pilot.lastDamage;
      seen.shots = world.shots; seen.hits = world.pilot.hits; seen.kills = world.pilot.kills; chase.snap();
    },
    dispose(): void {
      cancelAnimationFrame(handle); handle = 0;
      observer.disconnect(); canvas.removeEventListener('webglcontextlost', onLost);
      own.dispose(scene); for (const visual of others.values()) visual.dispose(scene);
      stage.dispose(); post.dispose(); rearTarget.dispose(); renderer.dispose();
    },
  };
}
export type ArenaClient = ReturnType<typeof createArenaClient>;
