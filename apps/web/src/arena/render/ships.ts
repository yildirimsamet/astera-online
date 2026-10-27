import * as THREE from 'three';
import type { PreparedModel } from '../assets/load.js';
import { CROWD_BAND, CROWD_RANGE, TRAIL_AGE, TRAIL_POINTS, TRAIL_WIDTH, type ShipCrowd, type TrailSamples } from './crowd.js';
import { ShipDetail, ditherMaterial } from './detail.js';
import type { Effects } from './effects.js';
import { ShipFlames } from './flames.js';
import { additiveFog, setUniform } from './materials.js';

export interface ShipPose {
  position: THREE.Vector3; quaternion: THREE.Quaternion; throttle: number; speed: number; turbo: boolean;
  omegaYaw: number; omegaPitch: number; landed: boolean; mining: boolean; shield: number; cloak: number;
  hull: number; hullMax: number; visible: boolean; hitAt: number; normal: THREE.Vector3;
  /** Y4c: the Muhafız's shield, the share of its hit points left (0: none); a repair running. */
  ward: number; mend: boolean;
  /** Y4d: our own illusion. Only its pilot sees it as one; everyone else sees a ship. */
  hologram: boolean;
}

/** The flame noise map (owned by the client) and the integration steps this device affords. */
export interface FlameSet { noise: THREE.Texture; quality: 'mobile' | 'standard' }
/** Flame radius against the hull's nozzle size, for a ship whose nozzle was not measured. */
const FLAME_RADIUS = 0.6;

const UP = new THREE.Vector3(0, 1, 0);
/**
 * Camera distances (m) past which a phone shows a part as a pixel or two at most: the nav lights,
 * then the flames and trails. The hull and engine glow carry a ship beyond them (S22, 50 ships).
 */
export const LIGHTS_RANGE = 700;
export const PLUME_RANGE = 1200;
/** A trail reaches about this far behind its ship (TRAIL_AGE at turbo speed): its cull sphere. */
const TRAIL_REACH = 130;
/** The shield bubble's radius against the ship's length: it clears every class's wingtips. */
const WARD_RADIUS = 0.62;
const SHIELD_BLUE = new THREE.Color('#5fb4ff');
const WARD_BLUE = new THREE.Color('#7fd7ff');
const MEND_GREEN = new THREE.Color('#7cf0a8');
let wardGeometry: THREE.BufferGeometry | null = null;
/**
 * The Muhafız's shield (Y4c): a bubble round the ship, its rim and a faint hex lattice in the
 * Muhafız's blue, one additive pass. A spent one dims; one nearly broken flickers.
 */
function wardMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { strength: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vO; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vO = normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float strength; uniform float time; varying vec3 vN; varying vec3 vV; varying vec3 vO;
      float hex(vec2 p){ const vec2 s = vec2(1.0, 1.7320508); vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
        vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s); vec2 q = abs(dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw);
        return smoothstep(0.43, 0.5, max(dot(q, s * 0.5), q.x)); }
      void main(){ float facing = abs(dot(normalize(vN), normalize(vV))); float rim = pow(1.0 - facing, 3.0);
        vec3 w = pow(abs(vO), vec3(4.0)); w /= w.x + w.y + w.z; vec3 o = vO * 3.2;
        float lattice = hex(o.yz) * w.x + hex(o.xz) * w.y + hex(o.xy) * w.z;
        float sweep = smoothstep(0.94, 1.0, sin(vO.y * 4.0 - time * 2.2) * 0.5 + 0.5);
        // Face-on the bubble is all but clear: the pilot looks through their own shield at the fight.
        float light = rim * 1.25 + lattice * (0.035 + rim * 0.75) + sweep * (0.04 + lattice * 0.3);
        gl_FragColor = vec4(vec3(0.5, 0.84, 1.0) * light * strength, 1.0); }`,
  });
}

/**
 * One engine's last ~half second of nozzle positions, newest first. Sampled at a fixed rate and
 * faded by age (not by index), so its ribbon (drawn by the crowd) stays smooth at any frame rate
 * and never ends in a hard cut. It keeps sampling while the ribbon is not drawn.
 */
class TrailRing implements TrailSamples {
  readonly points = new Float32Array(TRAIL_POINTS * 3);
  readonly ages = new Float32Array(TRAIL_POINTS);
  count = 0;
  private last = -1;
  reset(): void { this.count = 0; this.last = -1; }
  push(point: THREE.Vector3, time: number): void {
    if (this.last < 0 || time - this.last > TRAIL_AGE / TRAIL_POINTS) {
      this.points.copyWithin(3, 0, (TRAIL_POINTS - 1) * 3); this.ages.copyWithin(1, 0, TRAIL_POINTS - 1);
      this.count = Math.min(TRAIL_POINTS, this.count + 1); this.last = time;
    }
    this.points[0] = point.x; this.points[1] = point.y; this.points[2] = point.z; this.ages[0] = time;
  }
}

/**
 * One ship on screen: hull, bank, engines, trail and the states other pilots must read.
 * `group` follows the simulated pose; `tilt` adds the visual bank and nose motion and
 * carries everything bolted to the hull (engines, lights), so a plume never slides off
 * its nozzle in a turn; `body` scales the unit-length model to metres.
 */
const ownGlow = new WeakMap<THREE.MeshStandardMaterial, { color: THREE.Color; intensity: number }>();

/** A hit tints the hull warm; once it fades every part gets its own glow back. */
export function flashHull(material: THREE.MeshStandardMaterial, flash: number): void {
  let own = ownGlow.get(material);
  if (!own) { own = { color: material.emissive.clone(), intensity: material.emissiveIntensity }; ownGlow.set(material, own); }
  if (flash > 0) { material.emissive.setRGB(1, 0.75, 0.5); material.emissiveIntensity = flash * 1.4; }
  else { material.emissive.copy(own.color); material.emissiveIntensity = own.intensity; }
}

/**
 * Our own illusion (Y4d): the hull as cyan light, its rim bright, scan lines climbing it and a
 * band sweeping through, one additive pass. Its pilot tells it from the ship at a glance.
 */
function hologramMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'astera-hologram', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        vY = (modelMatrix * vec4(position, 1.0)).y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float time; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float rim = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
        float lines = 0.55 + 0.45 * step(0.5, fract(vY * 4.0 - time * 2.0));
        float band = 1.0 - smoothstep(0.0, 0.06, abs(fract(vY * 0.12 - time * 0.4) - 0.5));
        float flicker = 0.88 + 0.12 * sin(time * 53.0);
        gl_FragColor = vec4((vec3(0.28, 0.82, 1.0) * (0.12 + rim * 0.95) * lines + vec3(0.5, 1.0, 1.0) * band * 0.35) * flicker, 1.0); }`,
  });
}

export class ShipVisual {
  readonly group = new THREE.Group();
  private readonly tilt = new THREE.Group();
  private readonly body = new THREE.Group();
  /** Every hull mesh of every level with its own material (swapped out while cloaked). */
  private readonly hulls: { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial }[] = [];
  private readonly detail: ShipDetail | null;
  private readonly glows: THREE.Sprite[] = [];
  /** Engine nozzles in metres on the tilt group. */
  private readonly nozzles: THREE.Vector3[] = [];
  /** Its own flames; with a crowd, the crowd burns them in its one draw. */
  private readonly flames: ShipFlames | null;
  private readonly flameRadius: number;
  private readonly flameSeed = Math.floor(Math.random() * 4096);
  private readonly lights: THREE.Sprite[] = [];
  private readonly trails: TrailRing[] = [];
  /** This frame's trails are drawn: on screen, near enough, flying in plain sight. */
  private trailed = false;
  private readonly shield: THREE.Group;
  private readonly shieldMaterial: THREE.ShaderMaterial;
  private readonly ward: THREE.Mesh;
  private readonly wardMaterial = wardMaterial();
  private readonly ownWard: boolean;
  /** The hull coat's colour, the uniform's own object: the spawn shield's blue or a repair's green. */
  private readonly coatColor = SHIELD_BLUE.clone();
  private mendClock = 0;
  private readonly cloakMaterial: THREE.ShaderMaterial;
  /** Our own illusion's look, made the first time this ship is one. */
  private hologram: THREE.ShaderMaterial | null = null;
  private readonly beam: THREE.Mesh;
  private readonly size: THREE.Vector3;
  private sparkClock = 0;
  private smokeClock = 0;
  private emberClock = 0;
  private boosting = false;
  private readonly axis = new THREE.Vector3();
  private readonly tiltQuaternion = new THREE.Quaternion();
  private readonly engineColor: THREE.Color;
  private readonly turboColor = new THREE.Color('#ffb36b');
  private readonly nozzle: number;
  private turboMix = 0;
  private bank = 0;
  private pitch = 0;
  private hitFlash = 0;
  private lastHit = -1;
  /** From the last `view`: metres to the camera, and whether a trail's reach is on screen. */
  private distance = 0;
  private onScreen = true;
  /** Past CROWD_RANGE (held within CROWD_BAND): drawn with the crowd when nothing on it needs its own visual. */
  private far = false;
  private readonly glowColor = new THREE.Color();
  private readonly reach = new THREE.Sphere(new THREE.Vector3(), TRAIL_REACH);
  private readonly scratch = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  readonly length: number;
  readonly halfWidth: number;

  constructor(readonly model: PreparedModel, fx: Map<string, THREE.Texture>, length: number, own: boolean, scene: THREE.Scene,
    private readonly effects: Effects, flames: FlameSet, private readonly crowd: ShipCrowd | null = null) {
    this.length = length;
    this.halfWidth = model.size.x * length / 2;
    this.size = model.size.clone();
    // Levels of detail, full hull first; with more than one, the hull dissolves between them.
    const models = [model, ...(model.lods ?? [])];
    const levels = models.map(level => {
      const group = new THREE.Group();
      const materials = level.parts.map(part => {
        const material = models.length > 1 ? ditherMaterial(part.material.clone()) : part.material.clone();
        const mesh = new THREE.Mesh(part.geometry, material);
        this.hulls.push({ mesh, material });
        group.add(mesh);
        return material;
      });
      this.body.add(group);
      return { group, materials };
    });
    this.detail = models.length > 1 ? new ShipDetail(levels) : null;
    this.body.scale.setScalar(length);
    this.tilt.add(this.body);
    this.group.add(this.tilt);
    const glowTexture = fx.get('glowDot') ?? fx.get('flare');
    this.engineColor = new THREE.Color('#7fd6ff');
    // Nozzle size from the hull: big twin nacelles get a fat plume, slim jets a thin one.
    this.nozzle = Math.max(0.035, Math.min(0.075, model.size.y * 0.2)) * length;
    for (const [x, y, z] of model.engines) {
      const glow = new THREE.Sprite(additiveFog(new THREE.SpriteMaterial({ map: glowTexture ?? null, color: this.engineColor, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
      glow.position.set(x * length, y * length, z * length);
      this.nozzles.push(glow.position);
      // With a crowd, the sprite only marks the nozzle: the crowd's point draw shows it (one draw for every ship).
      if (!crowd) this.tilt.add(glow);
      this.glows.push(glow);
      // Contrails only on other ships: seen from the side they read well; behind your own
      // ship they would stream straight into the chase camera.
      if (!own) this.trails.push(new TrailRing());
    }
    // The flame leaves at the nozzle's measured size; an unmeasured ship gets one from its hull.
    this.flameRadius = model.nozzle ? model.nozzle * length : this.nozzle * FLAME_RADIUS;
    this.flames = crowd ? null : new ShipFlames(flames.noise, this.glows.map(glow => glow.position), this.flameRadius, length, flames.quality, this.flameSeed);
    if (this.flames) { this.flames.mesh.renderOrder = 22; this.tilt.add(this.flames.mesh); }
    // Wingtip navigation lights: red port, green starboard, white tail strobe (metres, on the tilt).
    const dot = fx.get('glowDot') ?? glowTexture;
    const half = this.halfWidth * 0.92;
    for (const [x, color] of [[half, '#ff3b3b'], [-half, '#3bff7a'], [0, '#ffffff']] as const) {
      const light = new THREE.Sprite(additiveFog(new THREE.SpriteMaterial({ map: dot ?? null, color, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false })));
      light.position.set(x, x === 0 ? model.size.y * length * 0.5 : 0, x === 0 ? -length * 0.45 : -length * 0.1);
      light.scale.setScalar(length * 0.08);
      if (!crowd) this.tilt.add(light);
      this.lights.push(light);
    }
    // Spawn shield: an energy coat hugging the hull, not a bubble over the view.
    const shieldMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { color: { value: this.coatColor }, strength: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec3 p = position + normal * 0.012;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; uniform float strength; uniform float time; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ float rim = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 4.0);
          float sweep = smoothstep(0.97, 1.0, sin(vP.z * 6.0 - time * 4.0) * 0.5 + 0.5);
          gl_FragColor = vec4(color * (rim * 1.4 + sweep * 0.6) * strength, 1.0); }`,
    });
    this.shield = new THREE.Group();
    for (const part of model.parts) this.shield.add(new THREE.Mesh(part.geometry, shieldMaterial));
    this.shieldMaterial = shieldMaterial;
    this.body.add(this.shield);
    // Our own shield is a coat on the hull, not a bubble: round the chase camera it filled the lower view.
    this.ownWard = own;
    this.ward = new THREE.Mesh(wardGeometry ??= new THREE.IcosahedronGeometry(1, 4), this.wardMaterial);
    this.ward.scale.setScalar(length * WARD_RADIUS); this.ward.renderOrder = 24; this.ward.visible = false;
    this.group.add(this.ward);
    this.cloakMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float time; varying vec3 vN; varying vec3 vV;
        void main(){ float rim = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 3.0); float wave = 0.6 + 0.4 * sin(time * 9.0 + gl_FragCoord.y * 0.05);
          gl_FragColor = vec4(vec3(0.35, 0.85, 1.0) * rim * wave * 0.8, 1.0); }`,
    });
    this.beam = new THREE.Mesh(new THREE.PlaneGeometry(14, 420).translate(0, 210, 0), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying float vNear; void main(){ vUv = uv; vec4 base = modelViewMatrix * vec4(0.0, position.y, 0.0, 1.0);
        vNear = smoothstep(70.0, 260.0, length((modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz));
        base.x += position.x; gl_Position = projectionMatrix * base; }`,
      fragmentShader: `uniform float time; varying vec2 vUv; varying float vNear;
        void main(){ float edge = pow(clamp(1.0 - abs(vUv.x * 2.0 - 1.0), 0.0, 1.0), 2.2);
          float fade = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.3) * smoothstep(0.0, 0.03, vUv.y);
          float pulse = 0.6 + 0.4 * sin(time * 6.0 - vUv.y * 40.0);
          // Seen by others from afar; nearly invisible to the miner's own chase camera.
          gl_FragColor = vec4(vec3(0.35, 0.95, 1.0) * edge * fade * pulse * 1.4 * (0.08 + 0.92 * vNear), 1.0); }`,
    }));
    this.beam.visible = false; this.beam.frustumCulled = false;
    scene.add(this.beam);
    scene.add(this.group);
  }

  /** Picks the level of detail and the parts worth drawing for the camera at `camera` (world space), seeing `frustum`. */
  view(camera: THREE.Vector3, frustum: THREE.Frustum, dt: number): void {
    this.distance = this.group.position.distanceTo(camera);
    this.reach.center.copy(this.group.position);
    this.onScreen = frustum.intersectsSphere(this.reach);
    this.far = this.distance > CROWD_RANGE + (this.far ? -CROWD_BAND : CROWD_BAND);
    this.detail?.update(this.distance / this.length, dt);
  }

  /** Muzzle point in world space for the gun on `side` (−1 left, +1 right). */
  muzzle(out: THREE.Vector3, side: number): THREE.Vector3 {
    out.set(-side * this.halfWidth * 0.45, -this.length * 0.04, this.length * 0.5);
    return this.body.localToWorld(out.divideScalar(this.length));
  }

  update(pose: ShipPose, time: number, dt: number): void {
    this.group.visible = pose.visible;
    const plume = this.distance <= PLUME_RANGE;
    this.trailed = pose.visible && !pose.landed && pose.cloak === 0 && plume && this.onScreen;
    if (!pose.visible) { for (const trail of this.trails) trail.reset(); return; }
    this.group.position.copy(pose.position);
    this.group.quaternion.copy(pose.quaternion);
    // Bank into the turn and a little nose motion: the hull shows what the stick does.
    const step = 1 - Math.exp(-dt * 6);
    this.bank += (Math.max(-0.95, Math.min(0.95, -pose.omegaYaw * 0.62)) - this.bank) * step;
    this.pitch += (Math.max(-0.3, Math.min(0.3, pose.omegaPitch * 0.12)) - this.pitch) * step;
    const idle = pose.landed ? 0 : Math.sin(time * 1.3) * 0.012;
    this.tilt.rotation.set(this.pitch, 0, this.bank + idle);
    const thrust = pose.landed ? 0.06 : Math.max(0.1, pose.throttle);
    this.turboMix += ((pose.turbo ? 1 : 0) - this.turboMix) * (1 - Math.exp(-dt * 8));
    const burn = thrust + this.turboMix * 0.9;
    const glowSize = (i: number): number => this.nozzle * (2.6 + burn * 2.2) * (0.93 + 0.07 * Math.sin(time * 37 + i * 2.1));
    this.glowColor.copy(this.engineColor).lerp(this.turboColor, this.turboMix);
    // A confirmed hit flashes the hull: the shooter sees the round land.
    if (pose.hitAt !== this.lastHit) { this.lastHit = pose.hitAt; if (pose.hitAt > 0) this.hitFlash = 1; }
    this.hitFlash = Math.max(0, this.hitFlash - dt * 7);
    if (this.far && this.crowd?.takes(this.model) && pose.cloak === 0 && pose.shield <= 0 && pose.ward <= 0 && !pose.mend && !pose.hologram && this.hitFlash === 0) {
      this.drawInCrowd(this.crowd, pose, time, dt, burn, glowSize, plume ? thrust : -1);
      return;
    }
    // Matrices now, not at render: glows, trails, muzzle flashes and effects read them this same frame.
    this.group.updateMatrixWorld(true);
    const glowing = pose.cloak > 0 ? 0 : 0.55 + burn * 0.35;
    this.glows.forEach((glow, i) => {
      if (this.crowd) { if (glowing > 0) this.crowd.addGlow(this.nozzleAt(i), glowSize(i), this.glowColor, glowing); return; }
      glow.scale.setScalar(glowSize(i));
      glow.material.opacity = glowing;
      glow.material.color.copy(this.glowColor);
    });
    // Flames: Cryo grows with the lever; turbo hands the burn to the longer Solar flame.
    const flaming = pose.cloak === 0 && !pose.landed && plume;
    if (this.flames) { this.flames.mesh.visible = flaming; if (flaming) this.flames.update(thrust, this.turboMix, time); }
    else if (flaming) this.crowd?.addFlames(this.tilt.matrixWorld, this.nozzles, this.flameRadius, this.length, thrust, this.turboMix, this.flameSeed);
    this.sampleTrails(pose, time);
    // Navigation lights blink; the tail strobe double-flashes.
    const lit = this.distance <= LIGHTS_RANGE;
    this.lights.forEach((light, i) => {
      const on = i < 2 ? 0.55 + 0.45 * Math.max(0, Math.sin(time * 3.2)) : (time % 1.4 < 0.06 || (time % 1.4 > 0.16 && time % 1.4 < 0.22) ? 1 : 0);
      if (this.crowd) {
        if (lit && pose.cloak === 0 && on > 0) this.crowd.addGlow(this.scratch.copy(light.position).applyMatrix4(this.tilt.matrixWorld), light.scale.x, light.material.color, on);
        return;
      }
      light.visible = lit;
      light.material.opacity = pose.cloak > 0 ? 0 : on;
    });
    const cloaked = pose.cloak > 0;
    const hologram = pose.hologram && !cloaked ? this.hologram ??= hologramMaterial() : null;
    for (const { mesh, material } of this.hulls) {
      mesh.material = cloaked ? this.cloakMaterial : hologram ?? material;
      flashHull(material, this.hitFlash);
    }
    setUniform(this.cloakMaterial, 'time', time);
    if (hologram) setUniform(hologram, 'time', time);
    setUniform(this.shieldMaterial, 'time', time);
    // The hull coat: blue for the spawn shield, our own Muhafız shield in its lighter blue, a
    // repair's green breathing slower. Others' Muhafız shields are the bubble.
    const warded = pose.ward > 0 && pose.cloak === 0;
    const flicker = pose.ward < 0.3 ? 0.55 + 0.45 * Math.round(0.5 + 0.5 * Math.sin(time * 41)) : 1;
    const ownWard = warded && this.ownWard && pose.shield <= 0;
    const mending = pose.mend && pose.shield <= 0 && !ownWard;
    this.coatColor.copy(ownWard ? WARD_BLUE : mending ? MEND_GREEN : SHIELD_BLUE);
    setUniform(this.shieldMaterial, 'strength', pose.shield > 0 ? 0.75 + 0.25 * Math.sin(time * 3)
      : ownWard ? (0.6 + 0.5 * pose.ward) * flicker : mending ? 0.9 + 0.35 * Math.sin(time * 4.5) : 0);
    this.shield.visible = (pose.shield > 0 || ownWard || mending) && pose.cloak === 0;
    this.ward.visible = warded && !this.ownWard;
    if (this.ward.visible) {
      setUniform(this.wardMaterial, 'time', time);
      setUniform(this.wardMaterial, 'strength', (0.45 + 0.55 * pose.ward) * flicker);
    }
    this.mend(pose, dt);
    this.mining(pose, time);
    this.exhaust(pose, dt);
    this.damage(pose, dt);
  }

  /** Far and plain: the hull and engine glow go to the crowd's batches; the trail, beam and effects stay this ship's. */
  private drawInCrowd(crowd: ShipCrowd, pose: ShipPose, time: number, dt: number, burn: number, glowSize: (i: number) => number, lever: number): void {
    this.group.visible = false;
    this.body.updateWorldMatrix(true, false);
    crowd.addHull(this.model, this.body.matrixWorld);
    if (lever >= 0 && !pose.landed) crowd.addFlames(this.tilt.matrixWorld, this.nozzles, this.flameRadius, this.length, lever, this.turboMix, this.flameSeed);
    this.glows.forEach((_, i) => { crowd.addGlow(this.nozzleAt(i), glowSize(i), this.glowColor, 0.55 + burn * 0.35); });
    this.sampleTrails(pose, time);
    this.mining(pose, time);
    this.exhaust(pose, dt);
    this.damage(pose, dt);
  }

  /** Every engine's trail takes this frame's nozzle position; the drawn ones go to the crowd. */
  private sampleTrails(pose: ShipPose, time: number): void {
    const strength = Math.min(0.55, pose.speed / 220) * (1 + this.turboMix * 0.6);
    this.trails.forEach((trail, i) => {
      trail.push(this.nozzleAt(i), time);
      if (this.trailed) this.crowd?.addTrail(trail, time, strength, this.nozzle * TRAIL_WIDTH);
    });
  }

  /** Engine `i`'s nozzle in world space, in `scratch`; the tilt's matrix must be current. */
  private nozzleAt(i: number): THREE.Vector3 {
    const glow = this.glows[i];
    return glow ? this.scratch.copy(glow.position).applyMatrix4(this.tilt.matrixWorld) : this.scratch.copy(this.group.position);
  }

  /** Mining shows from far away: a pulsing column along the surface normal. */
  private mining(pose: ShipPose, time: number): void {
    this.beam.visible = pose.mining;
    if (!pose.mining) return;
    this.beam.position.copy(pose.position);
    this.beam.quaternion.setFromUnitVectors(UP, pose.normal);
    const beam = this.beam.material;
    if (beam instanceof THREE.ShaderMaterial) setUniform(beam, 'time', time);
  }

  /**
   * Turbo is felt at the engines too: a flash and a shock ring when it lights, then
   * embers torn out of the nozzles and flung back, while it burns.
   */
  private exhaust(pose: ShipPose, dt: number): void {
    const lit = pose.turbo && pose.cloak === 0 && !pose.landed;
    if (!lit) { this.boosting = false; return; }
    this.tilt.getWorldQuaternion(this.tiltQuaternion);
    this.axis.set(0, 0, -1).applyQuaternion(this.tiltQuaternion);
    this.velocity.set(0, 0, pose.speed).applyQuaternion(pose.quaternion);
    if (!this.boosting) {
      this.boosting = true;
      this.glows.forEach((_, i) => { this.effects.ignite(this.nozzleAt(i), this.axis, this.nozzle); });
    }
    this.emberClock -= dt;
    while (this.emberClock <= 0) {
      this.emberClock += 1 / 70;
      if (this.glows.length > 0) this.effects.ember(this.nozzleAt(Math.floor(Math.random() * this.glows.length)), this.axis, this.velocity);
    }
  }

  /**
   * Heavy damage shows on the hull: short crackles of sparks from random panels, then a
   * thin smoke trail once the hull is critical. Small, brief and left behind in the
   * world, so the ship reads as hurt without anything flashing in front of the view.
   */
  private damage(pose: ShipPose, dt: number): void {
    const damage = 1 - pose.hull / pose.hullMax;
    if (damage < 0.5 || pose.cloak > 0) { this.sparkClock = 0; this.smokeClock = 0; return; }
    this.velocity.set(0, 0, pose.speed).applyQuaternion(pose.quaternion);
    this.sparkClock -= dt;
    if (this.sparkClock <= 0) {
      this.sparkClock = (0.25 + Math.random() * 0.8) * (1.5 - damage);
      this.hullPoint(this.scratch, 0.3);
      this.effects.damageSparks(this.scratch, this.velocity, damage);
    }
    if (damage < 0.7 || pose.landed) return;
    this.smokeClock -= dt;
    if (this.smokeClock <= 0) {
      this.smokeClock = 0.07 + Math.random() * 0.06;
      this.hullPoint(this.scratch, -0.25);
      this.effects.damageSmoke(this.scratch, this.velocity, damage);
    }
  }

  /** A repair running: green motes rise off the hull and are left behind, a dozen a second. */
  private mend(pose: ShipPose, dt: number): void {
    if (!pose.mend || pose.cloak > 0) { this.mendClock = 0; return; }
    this.mendClock -= dt;
    if (this.mendClock > 0) return;
    this.mendClock = 0.03 + Math.random() * 0.03;
    this.velocity.set(0, 0, pose.speed).applyQuaternion(pose.quaternion);
    this.effects.mendMote(this.hullPoint(this.scratch, 0), this.velocity);
  }

  /** A random point on the hull's skin, biased fore (+) or aft (−) along the ship. */
  private hullPoint(out: THREE.Vector3, bias: number): THREE.Vector3 {
    out.set((Math.random() - 0.5) * this.size.x * 0.7, (Math.random() - 0.3) * this.size.y * 0.5,
      (Math.random() - 0.5) * 0.6 + bias * 0.4);
    return this.body.localToWorld(out);
  }

  /**
   * Frees everything this ship made for itself. Online, ships leave and re-enter view all
   * the time, so anything missed here piles up on the GPU. Model geometry is shared and
   * stays; textures, the flame noise among them, belong to their owners.
   */
  dispose(scene: THREE.Scene): void {
    scene.remove(this.group); scene.remove(this.beam);
    for (const { material } of this.hulls) material.dispose();
    this.flames?.dispose();
    for (const sprite of [...this.glows, ...this.lights]) sprite.material.dispose();
    this.shieldMaterial.dispose(); this.cloakMaterial.dispose(); this.wardMaterial.dispose(); this.hologram?.dispose();
    this.beam.geometry.dispose();
    const beam: unknown = this.beam.material;
    if (beam instanceof THREE.Material) beam.dispose();
  }
}
