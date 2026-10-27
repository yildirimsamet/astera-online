import * as THREE from 'three';
import {
  ARENA_TUNING as T, RING_DISTANCE, aimCone, alive, sameSide, circleAim, createFlightState, holdPoints, leadPoint, lockShare, MAX_REMOTE_PILOTS, mirrorPose, pilotInSight, pilotVisible, scanTargets, shipTuning, spreadAt, statsOf, stepSandboxWorld,
  type AimCone, type ArenaWorld, type FlightState, type Pilot, type ShipClass, type SteeringSettings, type Vec3,
} from '@astera/rules/arena';
import type { ArenaAssets, PreparedModel } from './assets/load.js';
import { releaseRenderer } from './assets/memory.js';
import type { ArenaAudio } from './audio.js';
import { shipModelFor } from './classes.js';
import { nearestDeposit } from './compass.js';
import { createFrameDriver } from './driver.js';
import type { ArenaControls } from './input.js';
import type { ArenaNetwork } from './network.js';
import { altitudeShare, selfTransform } from './map.js';
import { MARK_RANGE, edgePoint, enemyMarked, friendTarget, sighting, type EdgeMark, type Sighting } from './marks.js';
import { ChaseCamera } from './render/camera.js';
import { createDust, RUSH_DUST } from './render/dust.js';
import { Effects } from './render/effects.js';
import { createPost } from './render/post.js';
import { proceduralShip } from './render/procedural.js';
import { ShipCrowd } from './render/crowd.js';
import { ShipVisual, type FlameSet, type ShipPose } from './render/ships.js';
import { ENGINE_FLAME_NOISE_URL } from '../vfx/engineFlames.js';
import { buildStage } from './render/stage.js';
import { createColliderView } from './render/colliders.js';
import { createOre } from './render/ore.js';
import { applyCorrection, decayCorrection } from './smoothing.js';
import { createResolution, stepResolution } from './resolution.js';
import { graphicsFor, type ArenaGraphicsChoice } from './graphics.js';
import { declutter, landmarkSight, placePriority, placesOf } from './landmarks.js';
import { createPings, PING_LIFE, pingTarget, type PingKind } from './pings.js';
import { describeGpu } from './diagnostics.js';
import { createLandingAssist, findLandingTarget, landingOffered } from './landing.js';
import { scrapePoint } from './surface.js';
import type { HudStore } from './store.js';
import { arenaCopy } from './copy.js';
import { FARM_HEX } from './farmColors.js';

export const SHIP_LENGTH = 15;

export interface HudRefs {
  reticle: HTMLElement | null; lead: HTMLElement | null; hit: HTMLElement | null; kill: HTMLElement | null;
  enemies: HTMLElement[]; threats: HTMLElement[]; exit: HTMLElement | null; crystal: HTMLElement | null;
  /** One per named place, in `placesOf(layout)` order. */
  places: HTMLElement[];
  /** Slots for the live pings, newest first. */
  pings: HTMLElement[];
  damage: HTMLElement | null; radar: HTMLCanvasElement | null; landing: HTMLElement | null;
  circle: HTMLElement | null;
  /** Whatever aims at the pilot: on it while it is on screen, on the edge towards it while it is not (Y4c). */
  incoming: HTMLElement | null;
  /** The map sheet's own arrow and altitude marker; null while the map is closed. */
  map: { self: SVGGElement | null; altitude: HTMLElement | null };
}

export interface ClientOptions {
  canvas: HTMLCanvasElement; assets: ArenaAssets; world: ArenaWorld; controls: ArenaControls; audio: ArenaAudio;
  settings: SteeringSettings; network: () => ArenaNetwork | null; store: HudStore; graphics: ArenaGraphicsChoice;
  name: (pilot: Pilot) => string; onContextLost: () => void; log: (line: string) => void;
}

export type ClientPhase = 'preflight' | 'flight' | 'paused';

const scratch = new THREE.Vector3();
const forward = new THREE.Vector3();
const leadOut = { x: 0, y: 0, z: 0 };
const focusCone: AimCone = { ex: 0, ey: 0, ez: 0, ax: 0, ay: 0, az: 0, cos: 1 };
/** Our ship as drawn this frame (interpolated), for HUD maths that must move with the camera. */
const shooterView = createFlightState();
/** Where the guns point this frame (unit, world): the aim circle's answer, or the nose. */
const gunAim = { x: 0, y: 0, z: 0 };
/** The focused target moved forward by the aim horizon: where a shot fired now will meet it. */
const ahead = { x: 0, y: 0, z: 0 };
const cameraUp = new THREE.Vector3();
const viewDirection = new THREE.Vector3();
const TAN_CIRCLE = Math.tan(Math.acos(T.aimCircleCos));
/** Metres from the centre to the radar's rim. */
const RADAR_RANGE = 1000;
/** No sweep running: no marks. */
const NO_SCAN: readonly number[] = [];
const moveAhead = (out: { x: number; y: number; z: number }, p: { x: number; y: number; z: number },
  v: { x: number; y: number; z: number }, horizon: number): void => {
  out.x = p.x + v.x * horizon; out.y = p.y + v.y * horizon; out.z = p.z + v.z * horizon;
};

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
  // The player's graphics choice (graphics.ts): a fixed sharpness, or Otomatik.
  let graphics = graphicsFor(options.graphics, window.devicePixelRatio);
  renderer.setPixelRatio(graphics.ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  options.log(describeGpu(renderer.getContext()));
  options.log(`dpr ${String(renderer.getPixelRatio())} · samples ${String(graphics.samples)} · ${options.graphics} · refs ${String(assets.references)} · rocks ${String(assets.colliders.size)} · sounds ${String(assets.sounds.size)}`);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  for (const texture of assets.textures.values()) texture.anisotropy = anisotropy;

  const stage = buildStage(assets, world.layout, renderer);
  const scene = stage.scene;
  const chase = new ChaseCamera(SHIP_LENGTH, world.layout);
  const camera = chase.camera;
  const post = createPost(renderer, scene, camera, graphics.samples);
  const effects = new Effects(scene, assets.fx);
  // The engine flames' flow noise: a public 41 KB map, loaded while the pilot reads the preflight.
  const flameNoise = new THREE.TextureLoader().load(ENGINE_FLAME_NOISE_URL);
  flameNoise.wrapS = THREE.RepeatWrapping; flameNoise.wrapT = THREE.RepeatWrapping; flameNoise.colorSpace = THREE.NoColorSpace;
  const flames: FlameSet = { noise: flameNoise, quality: graphics.light || navigator.maxTouchPoints > 0 ? 'mobile' : 'standard' };
  const ore = createOre(scene, world.layout, world.cargoDrops.length);
  const colliderView = createColliderView(scene, world.layout);
  const drawnHulls: { pose: THREE.Object3D; ship: ShipClass }[] = [];
  const dust = createDust();
  const rush = createDust(RUSH_DUST);
  scene.add(dust.mesh, rush.mesh);

  // Until the hangar picks a class (Y4), the pilot flies the Akıncı.
  // Made once each: a model is compared by identity to tell a ship whose class changed.
  let heroFallback: PreparedModel | null = null; let rivalFallback: PreparedModel | null = null; let pilotFallback: PreparedModel | null = null;
  /** Our ship: the class we fly (Y4), else the pack's hero, else a procedural hull. */
  const ownModel = (pilot: Pilot): PreparedModel => assets.classes.get(pilot.ship) ?? assets.hero ?? (heroFallback ??= proceduralShip('#d6e4f2'));
  let own = new ShipVisual(ownModel(world.pilot), assets.fx, SHIP_LENGTH, true, scene, effects, flames);
  const others = new Map<number, ShipVisual>();
  // Ships past CROWD_RANGE are drawn together, by model (docs/komutan-gemisi/18-kademeli-gorunurluk-plani.md).
  const crowd = new ShipCrowd(scene, assets.fx.get('glowDot') ?? assets.fx.get('flare'), [...assets.classes.values(), ...assets.rivals], MAX_REMOTE_PILOTS, flames);
  const bufferSize = new THREE.Vector2();
  const viewFrustum = new THREE.Frustum(); const viewMatrix = new THREE.Matrix4();
  const modelFor = (pilot: Pilot): PreparedModel => {
    const role = options.network()?.roles.get(pilot.id) ?? world.brains.get(pilot.id)?.role;
    return shipModelFor(assets, pilot.ship, role, pilot.id)
      ?? (role ? rivalFallback ??= proceduralShip('#c48a6a') : pilotFallback ??= proceduralShip('#9fb0c2'));
  };

  let hud: HudRefs = { reticle: null, lead: null, hit: null, kill: null, enemies: [], threats: [], places: [], pings: [], exit: null, crystal: null, damage: null, radar: null, landing: null, circle: null, incoming: null, map: { self: null, altitude: null } };
  const places = placesOf(world.layout);
  const pings = createPings();
  const landing = createLandingAssist();
  const crystalLive = (index: number): boolean => {
    const slot = world.layout.deposits.indexOf(index);
    return slot >= 0 && !world.dry[slot] && (world.minerals[slot] ?? 0) > 4;
  };
  const autopilot = { x: 0, y: 0, throttle: 0 };
  let phase: ClientPhase = 'preflight';
  let spectator: number | null = null;
  let width = 1; let height = 1;
  let lost = false;
  const ownPose: ShipPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), throttle: 0, speed: 0, turbo: false,
    omegaYaw: 0, omegaPitch: 0, landed: false, mining: false, shield: 0, cloak: 0, hull: T.hull, hullMax: T.hull, visible: true, hitAt: 0, normal: new THREE.Vector3(),
    ward: 0, mend: false, hologram: false };
  const otherPose: ShipPose = { ...ownPose, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), normal: new THREE.Vector3() };
  const seen = { compassKind: -1, shots: 0, hits: 0, kills: 0, damage: -100000, landed: 0, phase: 'flying' as Pilot['phase'], hitAt: -10, killAt: -10,
    damageAt: -10, damageAngle: 0, extractedAt: -1, deadAt: -1, warpIn: true, drawn: 0, lastHud: 0, time: 0, lastDraw: 0, bump: 0, turbo: false, circle: 0, ring: 0, reticleAt: 0,
    landTarget: null as ReturnType<typeof findLandingTarget> };
  const droneShots = new Map<number, number>();
  const droneHull = new Map<number, { hull: number; at: number }>();
  /** `tracked`: its hull or lead mark is inside the aim circle, so the guns follow it. */
  const focus = { id: -1, tracked: false };
  /** Where each enemy was last seen: rock cuts the marks, not the position (see marks.ts). */
  const sightings = new Map<number, Sighting>();
  /** The reticle eases to where the guns point instead of jumping there (screen px offset). */
  const reticleOffset = { x: 0, y: 0 };
  const metrics = { fps: 0, frameMs: 0, calls: 0, triangles: 0 };
  let resolution = createResolution(renderer.getPixelRatio());
  const boltMuzzle = new THREE.Vector3(); const boltForward = new THREE.Vector3();
  const deathPoint = new THREE.Vector3();

  /**
   * The visible enemy nearest the middle of the aim circle as the pilot sees it (from the
   * camera's eye, like the circle rule): it owns the lead marker and the aim circle.
   */
  /** The ships our own radar sweep marks right now (Y4d): the sandbox's sweep, or the room's word for it. */
  const sweptBy = (pilot: Pilot): readonly number[] => world.scans.length > 0 ? scanTargets(world, pilot.id) : NO_SCAN;
  const selectFocus = (): Pilot | undefined => {
    const pilot = world.pilot;
    const q = pilot.q;
    const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    aimCone(focusCone, pilot);
    let best: Pilot | undefined; let bestCos = Math.cos(THREE.MathUtils.degToRad(24));
    for (const drone of world.drones) {
      if (!alive(drone) || drone.id === pilot.decoy || sameSide(pilot, drone)) continue;
      const dx = drone.p.x - pilot.p.x; const dy = drone.p.y - pilot.p.y; const dz = drone.p.z - pilot.p.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > MARK_RANGE || distance < 1 || dx * fx + dy * fy + dz * fz <= 0) continue;
      const ex = drone.p.x - focusCone.ex; const ey = drone.p.y - focusCone.ey; const ez = drone.p.z - focusCone.ez;
      const cos = (ex * focusCone.ax + ey * focusCone.ay + ez * focusCone.az) / Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (cos > bestCos && pilotInSight(world, pilot, drone)) { bestCos = cos; best = drone; }
    }
    focus.id = best?.id ?? -1;
    return best;
  };

  const step = (): void => {
    if (phase !== 'flight') return;
    const pilot = world.pilot;
    const target = alive(pilot) ? selectFocus() : undefined;
    let tracked = false;
    if (target) {
      velocityOf(leadOut, target);
      moveAhead(ahead, target.p, leadOut, world.aimHorizon);
      tracked = circleAim(gunAim, pilot, ahead, leadOut) !== 0;
    }
    // One tone when the guns take hold, not a metronome for as long as they hold.
    if (tracked && !focus.tracked) audio.lock();
    focus.tracked = tracked;
    // Landing assist flies the approach; a deliberate stick input, turbo, or the end of
    // powered flight hands control back.
    if (landing.phase === 'approach' && (pilot.phase !== 'flying' || controls.pressed('turbo') || pilot.turboActive)) landing.cancel();
    const stick = Math.hypot(controls.stick.x, controls.stick.y);
    const flying = landing.steer(pilot, stick, performance.now(), autopilot);
    if (flying) controls.setThrottle(autopilot.throttle);
    const intent = controls.sample(flying ? autopilot : undefined);
    // Only a LAND approach may touch down on rock or a building; a deposit takes any slow ship.
    intent.land = flying;
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
  const edge = (px: number, py: number, behind: boolean, margin: number, sideways = false): EdgeMark =>
    edgePoint(px, py, behind, margin, { width, top: 205, bottom: bandBottom }, sideways);

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
    // Aim circle round the nose (where the two guns converge), drawn at the convergence
    // distance so its size on screen follows the speed-widened field of view.
    const aim = project(ownPose.position.x + forward.x * T.convergeDist, ownPose.position.y + forward.y * T.convergeDist, ownPose.position.z + forward.z * T.convergeDist);
    cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const reach = T.convergeDist * TAN_CIRCLE;
    const rim = project(ownPose.position.x + forward.x * T.convergeDist + cameraUp.x * reach,
      ownPose.position.y + forward.y * T.convergeDist + cameraUp.y * reach, ownPose.position.z + forward.z * T.convergeDist + cameraUp.z * reach);
    const radius = Math.hypot(rim.x - aim.x, rim.y - aim.y);
    // Lead (S73) and guns. The target as drawn, moved forward by the aim horizon: the server
    // flies our shot against where it is then, not where it is drawn (KG-T16).
    const target = world.drones.find(drone => drone.id === focus.id);
    let leadMark: ReturnType<typeof project> | null = null;
    let mode: 0 | 1 | 2 = 0; let tx = 0; let ty = 0;
    if (target && flying) {
      velocityOf(leadOut, target);
      moveAhead(ahead, others.get(target.id)?.group.position ?? target.p, leadOut, world.aimHorizon);
      // On the rim the guns point at the lead's depth: drawn there, the reticle sits on the circle up close too.
      let depth: number = T.convergeDist;
      if (leadPoint(scratch, shooterView, ahead, leadOut)) {
        depth = scratch.length();
        leadMark = project(ownPose.position.x + scratch.x, ownPose.position.y + scratch.y, ownPose.position.z + scratch.z);
      }
      mode = circleAim(gunAim, shooterView, ahead, leadOut);
      if (mode !== 0) {
        const p = mode === 1 && leadMark ? leadMark : project(ownPose.position.x + gunAim.x * depth,
          ownPose.position.y + gunAim.y * depth, ownPose.position.z + gunAim.z * depth);
        if (!p.behind) { tx = p.x - aim.x; ty = p.y - aim.y; }
        const r = Math.hypot(tx, ty);
        if (r > radius) { tx *= radius / r; ty *= radius / r; }
      }
    }
    // Reticle: where the guns point. Inside the circle it slides onto the lead and stops at the
    // rim; the heading never moves (owner 2026-10-21). It eases over ~60 ms: guns slew, not jump.
    const ease = 1 - Math.exp(-Math.max(0, time - seen.reticleAt) / 0.06); seen.reticleAt = time;
    reticleOffset.x += (tx - reticleOffset.x) * ease; reticleOffset.y += (ty - reticleOffset.y) * ease;
    const tracking = mode !== 0;
    if (hud.reticle) {
      hud.reticle.style.transform = `translate3d(${(aim.x + reticleOffset.x).toFixed(1)}px,${(aim.y + reticleOffset.y).toFixed(1)}px,0)`;
      hud.reticle.style.opacity = flying && !aim.behind ? '1' : '0';
      hud.reticle.toggleAttribute('data-locked', tracking);
      // The ring is the spread at 500 m (owner 2026-10-24), through the chase camera: true out there.
      const far = project(ownPose.position.x + forward.x * RING_DISTANCE, ownPose.position.y + forward.y * RING_DISTANCE, ownPose.position.z + forward.z * RING_DISTANCE);
      const wide = spreadAt(statsOf(pilot).spreadBase, RING_DISTANCE);
      const edge = project(ownPose.position.x + forward.x * RING_DISTANCE + cameraUp.x * wide,
        ownPose.position.y + forward.y * RING_DISTANCE + cameraUp.y * wide, ownPose.position.z + forward.z * RING_DISTANCE + cameraUp.z * wide);
      const ring = far.behind ? 0 : Math.hypot(edge.x - far.x, edge.y - far.y);
      if (Math.abs(ring - seen.ring) > 0.25) { seen.ring = ring; hud.reticle.style.setProperty('--s', `${ring.toFixed(1)}px`); }
      if (hud.hit) hud.hit.style.transform = hud.reticle.style.transform;
      if (hud.kill) hud.kill.style.transform = hud.reticle.style.transform;
    }
    if (hud.circle) {
      // A custom property restyles the subtree: only when it moved by more than half a pixel.
      if (Math.abs(radius - seen.circle) > 0.5) { seen.circle = radius; hud.circle.style.setProperty('--r', `${radius.toFixed(1)}px`); }
      hud.circle.style.transform = `translate3d(${aim.x.toFixed(1)}px,${aim.y.toFixed(1)}px,0)`;
      hud.circle.style.opacity = flying && !aim.behind ? '1' : '0';
      hud.circle.toggleAttribute('data-track', tracking);
      hud.circle.toggleAttribute('data-assist', tracking && controls.firing);
    }
    if (hud.hit) hud.hit.style.opacity = time - seen.hitAt < 0.15 ? '1' : '0';
    if (hud.kill) { const k = Math.max(0, 1 - (time - seen.killAt) / 1.1); hud.kill.style.opacity = String(k); hud.kill.style.setProperty('--k', String(1 - k)); }
    // Enemies within MARK_RANGE: bracket on screen, arrow on the edge when off screen.
    // Our sweep's marks (Y4d) are marked wherever they are; our own copy is no enemy.
    let slot = 0; let threat = 0; const swept = sweptBy(pilot);
    for (const drone of world.drones) {
      if (drone.id === pilot.decoy) { sightings.delete(drone.id); continue; }
      const visual = others.get(drone.id);
      const at = visual ? visual.group.position : scratch.set(drone.p.x, drone.p.y, drone.p.z);
      const scanned = swept.includes(drone.id);
      const friendly = sameSide(pilot, drone);
      // The radar reaches miners at 1.6 km: past that no mark needs the sight ray.
      const near = Math.hypot(drone.p.x - pilot.p.x, drone.p.y - pilot.p.y, drone.p.z - pilot.p.z) < RADAR_RANGE * 1.6;
      const mark = alive(drone) && (friendly || scanned || (near && pilotVisible(world, pilot, drone)))
        ? sighting(sightings, drone.id, friendly || scanned || pilotInSight(world, pilot, drone), at, time) : undefined;
      if (!mark) { sightings.delete(drone.id); continue; }
      const dx = mark.x - pilot.p.x; const dy = mark.y - pilot.p.y; const dz = mark.z - pilot.p.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!friendly && !enemyMarked(drone, distance, scanned)) continue;
      const lost = mark.level < 1;
      const screen = project(mark.x, mark.y, mark.z);
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
        node.toggleAttribute('data-lost', lost);
        node.toggleAttribute('data-scan', scanned);
        node.toggleAttribute('data-friend', friendly);
        const lock = drone.id === pilot.lockTarget ? lockShare(pilot) : 0;
        node.toggleAttribute('data-lock', lock > 0);
        node.toggleAttribute('data-locked', lock >= 1);
        if (lock > 0) node.style.setProperty('--lock', lock.toFixed(2));
        node.style.opacity = lost ? (mark.level * 0.75).toFixed(2) : '';
        if (seen.drawn % 6 === 0) {
          const name = node.querySelector('[data-name]'); if (name) name.textContent = options.name(drone);
          const label = node.querySelector('[data-distance]'); if (label) label.textContent = `${String(Math.round(distance))} m`;
          // Width is a layout write: with the labels, not every frame.
          const bar = node.querySelector<HTMLElement>('[data-hull]'); if (bar) bar.style.width = `${String(drone.hull / statsOf(drone).hull * 100)}%`;
        }
      } else if (!onScreen && threat < hud.threats.length) {
        const node = hud.threats[threat++];
        if (!node) continue;
        const e = edge(screen.x, screen.y, screen.behind, 26);
        node.style.display = 'block';
        node.style.transform = `translate3d(${e.x.toFixed(1)}px,${e.y.toFixed(1)}px,0) rotate(${e.angle.toFixed(3)}rad)`;
        node.toggleAttribute('data-scan', scanned);
        node.toggleAttribute('data-friend', friendly);
        node.style.opacity = friendly || scanned ? '0.9' : String((0.45 + 0.55 * (1 - distance / MARK_RANGE)) * (lost ? mark.level * 0.6 : 1));
      }
    }
    for (let i = slot; i < hud.enemies.length; i++) { const node = hud.enemies[i]; if (node) node.style.display = 'none'; }
    for (let i = threat; i < hud.threats.length; i++) { const node = hud.threats[i]; if (node) node.style.display = 'none'; }
    // A lock or a missile on the pilot points at its source: on it in view, on the edge towards it when not.
    if (hud.incoming) {
      const level = flying ? pilot.threat : 0;
      if (level > 0) {
        const p = project(pilot.threatX, pilot.threatY, pilot.threatZ);
        const inside = !p.behind && p.x > 24 && p.x < width - 24 && p.y > 60 && p.y < height - 120;
        const e = inside ? { x: p.x, y: p.y, angle: 0 } : edge(p.x, p.y, p.behind, 30);
        hud.incoming.style.display = 'block';
        hud.incoming.dataset.threat = String(level);
        hud.incoming.toggleAttribute('data-edge', !inside);
        hud.incoming.style.transform = `translate3d(${e.x.toFixed(1)}px,${e.y.toFixed(1)}px,0)`;
        hud.incoming.style.setProperty('--angle', `${e.angle.toFixed(3)}rad`);
      } else hud.incoming.style.display = 'none';
    }
    if (hud.lead) {
      hud.lead.style.display = leadMark && !leadMark.behind ? 'block' : 'none';
      if (leadMark) hud.lead.style.transform = `translate3d(${leadMark.x.toFixed(1)}px,${leadMark.y.toFixed(1)}px,0)`;
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
        const e = inside ? { x: p.x, y: p.y, angle: 0, side: 'right' } : edge(p.x, p.y, p.behind, 30, true);
        hud.exit.style.display = 'block';
        hud.exit.toggleAttribute('data-edge', !inside);
        hud.exit.dataset.side = e.side;
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
    // Named places: small, and only while the view points their way (landmarks.ts).
    camera.getWorldDirection(viewDirection);
    const marks = places.map(place => {
      const level = flying ? landmarkSight(camera.position, viewDirection, place.p, place.radius) : 0;
      const p = level > 0.01 ? project(place.p.x, place.p.y, place.p.z) : null;
      const onScreen = p !== null && !p.behind && p.x > 30 && p.x < width - 30 && p.y > 205 && p.y < bandBottom;
      return { level, x: p?.x ?? 0, y: p?.y ?? 0, distance: onScreen ? Math.hypot(place.p.x - pilot.p.x, place.p.y - pilot.p.y, place.p.z - pilot.p.z) : Infinity };
    });
    const shown = declutter(marks.map((m, i) => ({ x: m.x, y: m.y, distance: placePriority(places[i]?.kind ?? 'outpost', m.distance) })), 96, 24);
    marks.forEach((mark, i) => {
      const node = hud.places[i];
      if (!node) return;
      if (!shown[i] || mark.distance === Infinity) { node.style.display = 'none'; return; }
      node.style.display = 'block'; node.style.opacity = mark.level.toFixed(2);
      node.style.transform = `translate3d(${mark.x.toFixed(1)}px,${mark.y.toFixed(1)}px,0)`;
      if (seen.drawn % 6 === i % 6) {
        const label = node.querySelector('[data-distance]');
        if (label) label.textContent = `${(mark.distance / 1000).toFixed(1)} km`;
      }
    });
    // Pings: a point in the world, drawn from here; off screen, an arrow on the band's edge.
    const live = pings.live(performance.now() / 1000);
    hud.pings.forEach((node, i) => {
      const mark = live[i];
      if (!mark || !flying) { node.style.display = 'none'; return; }
      const p = project(mark.p.x, mark.p.y, mark.p.z);
      const inside = !p.behind && p.x > 30 && p.x < width - 30 && p.y > 205 && p.y < bandBottom;
      const e = inside ? { x: p.x, y: p.y, angle: 0 } : edge(p.x, p.y, p.behind, 30);
      node.style.display = 'block';
      node.dataset.kind = mark.kind;
      node.toggleAttribute('data-edge', !inside);
      node.style.transform = `translate3d(${e.x.toFixed(1)}px,${e.y.toFixed(1)}px,0)`;
      node.style.setProperty('--angle', `${e.angle.toFixed(3)}rad`);
      node.style.setProperty('--life', (1 - (performance.now() / 1000 - mark.at) / PING_LIFE).toFixed(3));
      const label = node.querySelector('[data-distance]');
      if (label) label.textContent = `${String(Math.round(Math.hypot(mark.p.x - pilot.p.x, mark.p.y - pilot.p.y, mark.p.z - pilot.p.z)))} m`;
      const name = node.querySelector('[data-kind]');
      if (name) name.textContent = arenaCopy().pings[mark.kind];
    });
    // Nearest live deposit while the hold has room: the farmer's compass, in the deposit's colour.
    if (hud.crystal) {
      const deposit = nearestDeposit(world, pilot.p);
      const best = deposit?.index ?? -1; const bestKind = deposit?.kind ?? 1;
      if (seen.compassKind !== bestKind) {
        seen.compassKind = bestKind;
        hud.crystal.style.setProperty('--crystal', FARM_HEX[bestKind] ?? FARM_HEX[1]);
        const name = hud.crystal.querySelector('[data-kind]'); if (name) name.textContent = arenaCopy().kinds[bestKind] ?? '';
      }
      const o = world.layout.obstacles[best];
      if (o && flying && !pilot.landed && pilot.cargo < statsOf(pilot).cargoCapacity) {
        const p = project(o.p.x, o.p.y, o.p.z);
        hud.crystal.style.display = p.behind ? 'none' : 'block';
        hud.crystal.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0)`;
        if (seen.drawn % 6 === 0) { const label = hud.crystal.querySelector('[data-distance]'); if (label) label.textContent = `${String(Math.round(deposit?.distance ?? 0))} m`; }
      } else hud.crystal.style.display = 'none';
    }
    if (hud.damage) {
      const fade = Math.max(0, 1 - (time - seen.damageAt) / 1.3);
      hud.damage.style.opacity = String(fade);
      hud.damage.style.transform = `translate(-50%,-50%) rotate(${seen.damageAngle.toFixed(3)}rad)`;
    }
    if (hud.radar && seen.drawn % 3 === 0) drawRadar(hud.radar);
    if (hud.map.self && seen.drawn % 3 === 0) {
      hud.map.self.setAttribute('transform', selfTransform(ownPose.position.x, ownPose.position.z, forward.x, forward.z));
      if (hud.map.altitude) hud.map.altitude.style.bottom = `${(altitudeShare(ownPose.position.y, world.layout.halfHeight) * 100).toFixed(1)}%`;
    }
    // Touchdown marker: where the landing assist is taking you, or where a tap would.
    if (hud.landing) {
      const target = landing.target ?? (!flying || !landingOffered(pilot) ? null
        : seen.drawn % 6 === 0 ? findLandingTarget(world.layout, pilot, crystalLive) : seen.landTarget);
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
    const size = canvasElement.width; const r = size / 2; const range = RADAR_RANGE;
    ctx.clearRect(0, 0, size, size);
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
    const swept = sweptBy(world.pilot);
    for (const drone of world.drones) {
      // Behind rock: the faded point it was last seen at (drawHud keeps the sightings). An illusion
      // is no dot: the radar shows the truth (plan 14 §4).
      const mark = sightings.get(drone.id);
      if (!mark || drone.decoyOf >= 0) continue;
      const distance = Math.hypot(mark.x - me.x, mark.z - me.z);
      // A ship our sweep marks shows wherever it is: past the radar's reach, on its rim towards it, ringed.
      const scanned = swept.includes(drone.id);
      const friendly = sameSide(world.pilot, drone);
      if (!friendly && !scanned && drone.landed && !drone.mining && distance > 320) continue;
      if (!friendly && !scanned && distance > range * (drone.mining ? 1.6 : 1)) continue;
      let [x, y] = place(mark.x, mark.z);
      if ((friendly || scanned) && Math.hypot(x - r, y - r) > r * 0.92) { const a = Math.atan2(y - r, x - r); x = r + Math.cos(a) * r * 0.92; y = r + Math.sin(a) * r * 0.92; }
      const dy = mark.y - me.y;
      ctx.globalAlpha = mark.level < 1 ? mark.level * 0.6 : 1;
      const cx = Math.min(size - 4, Math.max(4, x)); const cy = Math.min(size - 4, Math.max(4, y));
      ctx.strokeStyle = friendly ? 'rgba(75,213,255,0.6)' : 'rgba(255,90,60,0.6)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - Math.max(-10, Math.min(10, dy / 40))); ctx.stroke();
      ctx.fillStyle = friendly ? '#4bd5ff' : drone.mining ? '#ffd166' : '#ff5a3c';
      ctx.beginPath(); ctx.arc(cx, cy - Math.max(-10, Math.min(10, dy / 40)), drone.id === focus.id ? 3.4 : 2.6, 0, Math.PI * 2); ctx.fill();
      if (scanned) { ctx.strokeStyle = 'rgba(46,230,200,0.85)'; ctx.beginPath(); ctx.arc(cx, cy - Math.max(-10, Math.min(10, dy / 40)), 5, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e6fbff'; ctx.beginPath(); ctx.moveTo(r, r - 5); ctx.lineTo(r + 3.5, r + 4); ctx.lineTo(r - 3.5, r + 4); ctx.closePath(); ctx.fill();
  };

  const draw = (now: number, alpha: number): void => {
    if (lost) return;
    const time = now / 1000;
    const frame = Math.max(0, time - (seen.lastDraw || time));
    const dt = Math.min(0.1, frame);
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
    ownPose.ward = pilot.ward > 0 && pilot.shieldMax > 0 ? pilot.shieldHp / pilot.shieldMax : 0; ownPose.mend = pilot.mend > 0;
    ownPose.hullMax = statsOf(pilot).hull;
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
    // A new class (picked in the hangar, or a new flight) is a new ship.
    if (own.model !== ownModel(pilot)) { own.dispose(scene); own = new ShipVisual(ownModel(pilot), assets.fx, SHIP_LENGTH, true, scene, effects, flames); }
    own.update(ownPose, time, dt);
    if (pilot.bump > 0.12 && alive(pilot) && pilot.bump !== seen.bump) {
      // One burst per impact, on the rock face the hull met.
      if (!scrapePoint(world.layout, ownPose.position, shipTuning(pilot.ship, pilot.level), scratch)) scratch.copy(ownPose.position);
      effects.scrape(scratch.x, scratch.y, scratch.z, pilot.bump);
      chase.kick(pilot.bump * 0.6);
    }
    seen.bump = pilot.bump;
    if (pilot.mining && seen.drawn % 2 === 0) {
      // Sparks where the belly meets the rock: the hull rests a body radius off the surface.
      effects.mining(ownPose.position.x - pilot.nx * T.bodyRadius, ownPose.position.y - pilot.ny * T.bodyRadius, ownPose.position.z - pilot.nz * T.bodyRadius, pilot.nx, pilot.ny, pilot.nz);
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
    crowd.begin();
    world.drones.forEach((drone, i) => {
      const previous = world.dronePrevious[i];
      if (!previous) return;
      present.add(drone.id);
      let visual = others.get(drone.id);
      // The roster can name a ship's class after its first row: it is redrawn as that class.
      if (visual && visual.model !== modelFor(drone)) { visual.dispose(scene); others.delete(drone.id); visual = undefined; }
      if (!visual) { visual = new ShipVisual(modelFor(drone), assets.fx, SHIP_LENGTH, false, scene, effects, flames, crowd); others.set(drone.id, visual); }
      interpolate(otherPose, previous, drone, blend);
      otherPose.throttle = drone.throttle; otherPose.speed = drone.s; otherPose.turbo = drone.turboActive;
      otherPose.omegaYaw = drone.omegaYaw; otherPose.omegaPitch = drone.omegaPitch; otherPose.landed = drone.landed > 0;
      // Our own illusion is drawn off our own ship, not from the room's late rows: it turns as we turn (owner 2026-10-24).
      const line = drone.decoyAlong;
      if (drone.id === pilot.decoy && (line.x !== 0 || line.y !== 0 || line.z !== 0)) {
        mirrorPose(drone.decoyFrom, line, ownPose.position, ownPose.quaternion, otherPose.position, otherPose.quaternion);
        otherPose.throttle = pilot.throttle; otherPose.speed = pilot.s; otherPose.turbo = pilot.turboActive;
        otherPose.omegaYaw = -pilot.omegaYaw; otherPose.omegaPitch = -pilot.omegaPitch;
      }
      otherPose.mining = drone.mining; otherPose.shield = drone.shield; otherPose.cloak = sameSide(pilot, drone) ? 0 : drone.cloak; otherPose.hull = drone.hull;
      // Others' rows carry only that a shield is up, not how much of it is left.
      otherPose.ward = drone.ward > 0 ? (drone.shieldMax > 0 ? drone.shieldHp / drone.shieldMax : 1) : 0; otherPose.mend = drone.mend > 0;
      otherPose.hullMax = statsOf(drone).hull; otherPose.hologram = drone.id === pilot.decoy;
      otherPose.visible = alive(drone) && (sameSide(pilot, drone) || drone.cloak === 0);
      const record = droneHull.get(drone.id);
      if (record && drone.hull < record.hull) record.at = time;
      if (!record) droneHull.set(drone.id, { hull: drone.hull, at: -10 }); else record.hull = drone.hull;
      otherPose.hitAt = droneHull.get(drone.id)?.at ?? -10;
      visual.update(otherPose, time, dt);
      const shots = droneShots.get(drone.id);
      if (shots !== undefined && drone.shots > shots && otherPose.visible) {
        visual.muzzle(scratch, drone.gun % 2 === 0 ? 1 : -1);
        forward.set(0, 0, 1).applyQuaternion(otherPose.quaternion);
        effects.muzzle(scratch, forward, false, drone.s);
      }
      droneShots.set(drone.id, drone.shots);
      if (drone.mining && seen.drawn % 3 === 0) effects.mining(otherPose.position.x - drone.nx * T.bodyRadius, otherPose.position.y - drone.ny * T.bodyRadius, otherPose.position.z - drone.nz * T.bodyRadius, drone.nx, drone.ny, drone.nz);
    });
    crowd.end(camera, renderer.getDrawingBufferSize(bufferSize).y, time);
    for (const [id, visual] of others) {
      if (present.has(id)) continue;
      visual.dispose(scene); others.delete(id); droneShots.delete(id); droneHull.delete(id);
    }
    if (colliderView.visible) {
      drawnHulls.length = 0;
      if (own.group.visible) drawnHulls.push({ pose: own.group, ship: pilot.ship });
      for (const drone of world.drones) {
        const visual = others.get(drone.id);
        if (visual?.group.visible) drawnHulls.push({ pose: visual.group, ship: drone.ship });
      }
      colliderView.ships(drawnHulls);
    }
    // Camera.
    const aspect = width / Math.max(1, height);
    const watched = spectator === null ? undefined : world.drones.find(d => d.id === spectator && alive(d));
    const watchedVisual = watched ? others.get(watched.id) : undefined;
    if (watched && watchedVisual) {
      chase.update({ position: watchedVisual.group.position, quaternion: watchedVisual.group.quaternion, speed: watched.s,
        speedMax: shipTuning(watched.ship, watched.level).speedMax, accel: 0, turbo: watched.turboActive, landed: watched.landed > 0,
        omegaYaw: watched.omegaYaw, omegaPitch: watched.omegaPitch }, dt, aspect);
    } else if (pilot.phase === 'dead') {
      const t = time - seen.deadAt;
      camera.position.set(deathPoint.x + Math.sin(t * 0.35) * 70, deathPoint.y + 28, deathPoint.z + Math.cos(t * 0.35) * 70);
      camera.up.set(0, 1, 0); camera.lookAt(deathPoint); camera.updateMatrixWorld();
    } else if (phase === 'preflight') {
      const t = time * 0.12;
      chase.snap();
      camera.position.copy(ownPose.position).add(scratch.set(Math.sin(t) * 34, 9 + Math.sin(t * 0.7) * 3, Math.cos(t) * 34));
      // Aimed a little below the ship, so it rides above the launch dock instead of behind it.
      camera.up.set(0, 1, 0); camera.lookAt(ownPose.position.x, ownPose.position.y - 7, ownPose.position.z);
      camera.fov = aspect < 1 ? 58 : 45; camera.aspect = aspect; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    } else if (pilot.phase !== 'extracted' || time - seen.extractedAt < 0.2) {
      chase.update({ position: ownPose.position, quaternion: ownPose.quaternion, speed: ownPose.speed, speedMax: T.speedMax,
        accel: (pilot.s - world.previous.s) * T.tickRate, turbo: ownPose.turbo, landed: ownPose.landed, omegaYaw: pilot.omegaYaw, omegaPitch: pilot.omegaPitch }, dt, aspect);
    }
    // World effects.
    effects.watchImpacts(world, pilot.id, () => undefined, () => undefined);
    boltForward.set(0, 0, 1).applyQuaternion(ownPose.quaternion);
    boltMuzzle.copy(ownPose.position).addScaledVector(boltForward, 4);
    effects.drawBolts(world, blend, pilot.id, options.network() !== null, boltMuzzle, boltForward, dt);
    effects.drawSmoke(world, time);
    effects.update(dt);
    forward.set(0, 0, 1).applyQuaternion(ownPose.quaternion).multiplyScalar(ownPose.speed);
    dust.update(camera.position, forward, ownPose.turbo, alive(pilot) && phase === 'flight', dt);
    rush.update(camera.position, forward, ownPose.turbo, alive(pilot) && phase === 'flight', dt);
    stage.update(time, world, camera.position);
    viewFrustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const visual of others.values()) visual.view(camera.position, viewFrustum, dt);
    ore.update(world, time);
    post.haze(stage.haze.color, stage.haze.amount);
    scratch.set(1, 0, 0).applyQuaternion(camera.quaternion);
    audio.listen(camera.position.x, camera.position.y, camera.position.z, scratch.x, scratch.y, scratch.z);
    audio.update(world, phase !== 'paused');
    drawHud(time);
    if (time - seen.lastHud > 0.1) {
      seen.lastHud = time;
      store.publish(world, phase, focus.tracked, canLand(), pilot.landed ? 'landed' : landing.phase === 'approach' ? 'approach' : 'idle',
        landing.distance(pilot));
    }
    // Frame.
    renderer.info.reset();
    renderer.setRenderTarget(null);
    stage.cull(camera, 3800, world);
    post.render(dt);
    seen.drawn++;
    metrics.calls = renderer.info.render.calls; metrics.triangles = renderer.info.render.triangles;
    metrics.fps = metrics.fps === 0 ? 1 / Math.max(dt, 0.001) : metrics.fps * 0.92 + 0.08 / Math.max(dt, 0.001);
    metrics.frameMs = performance.now() - now;
    const ratio = graphics.adaptive ? stepResolution(resolution, frame) : null;
    if (ratio !== null) { renderer.setPixelRatio(ratio); resize(); options.log(`dpr ${String(ratio)} · holding the frame rate`); }
    if (import.meta.env.DEV && seen.drawn % 180 === 1) {
      const gl = renderer.getContext();
      const error = gl.getError();
      if (error !== gl.NO_ERROR) options.log(`gl error 0x${error.toString(16)}`);
      options.log(`fps ${metrics.fps.toFixed(0)} · calls ${String(metrics.calls)} · tris ${String(metrics.triangles)} · ${phase}`);
    }
  };

  const canLand = (): boolean => {
    const pilot = world.pilot;
    if (!alive(pilot) || !landingOffered(pilot)) return false;
    return findLandingTarget(world.layout, pilot, crystalLive) !== null;
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
    setSpectator(id: number | null): void { if (spectator !== id) { spectator = id; chase.snap(); } },
    friendAt(clientX: number, clientY: number): number | null {
      const rect = canvas.getBoundingClientRect();
      return friendTarget(world.pilot, world.drones.map(pilot => {
        const at = others.get(pilot.id)?.group.position ?? pilot.p;
        return { pilot, ...project(at.x, at.y, at.z) };
      }), clientX - rect.left, clientY - rect.top);
    },
    /** Applies a new graphics choice at once: sharpness, samples, and whether Otomatik may adapt. */
    setGraphics(choice: ArenaGraphicsChoice): void {
      graphics = graphicsFor(choice, window.devicePixelRatio);
      renderer.setPixelRatio(graphics.ratio);
      resolution = createResolution(graphics.ratio);
      post.setSamples(graphics.samples);
      resize();
      options.log(`graphics ${choice} · dpr ${String(graphics.ratio)} · samples ${String(graphics.samples)}`);
    },
    /** One tap: pick a touchdown point ahead and fly onto it. */
    land(): boolean { return landing.begin(world.layout, world.pilot, performance.now(), crystalLive); },
    /** The world spot under a screen point (client px), fixed when the ping wheel opens (pings.ts). */
    aim(clientX: number, clientY: number): Vec3 {
      const rect = canvas.getBoundingClientRect();
      scratch.set((clientX - rect.left) / Math.max(1, rect.width) * 2 - 1, -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1, 0.5)
        .unproject(camera).sub(camera.position).normalize();
      return pingTarget(world.layout, camera.position, scratch);
    },
    /** Marks a spot for five seconds, drawn from every viewer's own angle. */
    ping(kind: PingKind, target: Vec3): void { pings.add(kind, target, performance.now() / 1000); },
    cancelLanding(): void { landing.cancel(); },
    /** Developer view (plan §8.4): collider wireframes over the drawn world. */
    toggleColliders(): void { colliderView.visible = !colliderView.visible; },
    /** Compiles every shader before the first flight frame (no hitch on first fire). */
    async warm(): Promise<void> {
      resize();
      const started = performance.now();
      try { await post.compile(); }
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
      own.dispose(scene); for (const visual of others.values()) visual.dispose(scene); crowd.dispose(); flameNoise.dispose();
      // The context goes too: the galaxy mounts next and needs the phone's GPU memory back (B1).
      ore.dispose(); colliderView.dispose(); stage.dispose(); post.dispose(); releaseRenderer(renderer);
    },
  };
}
export type ArenaClient = ReturnType<typeof createArenaClient>;
