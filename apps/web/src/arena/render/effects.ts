import * as THREE from 'three';
import { ARENA_TUNING as T, FIELD_GROUP_SIZE, type ArenaWorld, type Projectile } from '@astera/rules/arena';
import { FARM_RGB } from '../farmColors.js';

interface Particle {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; drag: number;
  age: number; life: number; size0: number; size1: number; rot: number; spin: number;
  r: number; g: number; b: number; a: number; fadeIn: number; frame0: number; frames: number;
}
export type SpawnOptions = Partial<Particle> & { x: number; y: number; z: number };

const QUAD = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
const UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);

/** Camera-facing quads with optional sprite-sheet animation, all in one draw call. */
class ParticlePool {
  readonly mesh: THREE.Mesh;
  private readonly particles: Particle[] = [];
  private readonly offset: THREE.InstancedBufferAttribute;
  private readonly velocity: THREE.InstancedBufferAttribute | null = null;
  private readonly look: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private cursor = 0;

  /**
   * `add`: light (additive). `alpha`: the texture's own alpha. `luma`: a white-on-black
   * sheet with no alpha channel (smoke), where brightness becomes coverage. `streak`: a
   * hot line drawn along the particle's own velocity (sparks), so it reads as motion at
   * any size instead of a square sprite.
   */
  constructor(texture: THREE.Texture | undefined, private readonly capacity: number, mode: 'add' | 'alpha' | 'luma' | 'streak', grid = 1) {
    const additive = mode === 'add' || mode === 'streak';
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(QUAD, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    this.offset = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('offset', this.offset);
    this.geometry.setAttribute('look', this.look); // size, rotation, frame
    this.geometry.setAttribute('tint', this.tint);
    this.geometry.instanceCount = 0;
    if (mode === 'streak') {
      this.velocity = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('vel', this.velocity);
    }
    const material = mode === 'streak' ? new THREE.ShaderMaterial({
      // Axial quads flip winding with direction: draw both sides.
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `attribute vec3 offset; attribute vec3 look; attribute vec4 tint; attribute vec3 vel;
        varying vec2 vUv; varying vec4 vTint; varying float vNear;
        void main(){ vec4 a = modelViewMatrix * vec4(offset, 1.0);
          float speed = length(vel); vec3 along = speed > 1e-3 ? vel / speed : vec3(0.0, 1.0, 0.0);
          vec4 b = modelViewMatrix * vec4(offset - along * (speed * 0.03 + look.x), 1.0);
          vec3 dir = b.xyz - a.xyz; vec3 cr = cross(dir, a.xyz); float cl = length(cr);
          vec3 side = (cl > 1e-6 ? cr / cl : vec3(1.0, 0.0, 0.0)) * look.x * 0.16;
          vec3 p = mix(a.xyz, b.xyz, position.y + 0.5) + side * position.x * 2.0;
          vNear = smoothstep(1.5, 6.0, -a.z); vUv = uv; vTint = tint;
          gl_Position = projectionMatrix * vec4(p, 1.0); }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vTint; varying float vNear;
        void main(){ float x = vUv.x - 0.5; float core = exp(-x * x * 30.0);
          float tail = clamp(1.0 - vUv.y, 0.0, 1.0);
          gl_FragColor = vec4(vTint.rgb * vTint.a * core * tail * (0.6 + 0.4 * exp(-x * x * 200.0)) * vNear * 1.6, 1.0); }`,
    }) : new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: texture ?? null }, grid: { value: grid }, hasMap: { value: texture ? 1 : 0 } },
      vertexShader: `attribute vec3 offset; attribute vec3 look; attribute vec4 tint; uniform float grid;
        varying vec2 vUv; varying vec4 vTint; varying float vNear;
        void main(){ vec4 mv = modelViewMatrix * vec4(offset, 1.0);
          // Anything about to touch the lens melts away instead of filling the screen.
          vNear = smoothstep(${additive ? '1.5, 6.0' : '5.0, 18.0'}, -mv.z);
          float c = cos(look.y); float s = sin(look.y);
          vec2 corner = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * look.x;
          mv.xy += corner;
          float frame = floor(look.z); float col = mod(frame, grid); float row = floor(frame / grid);
          vUv = (uv + vec2(col, grid - 1.0 - row)) / grid; vTint = tint;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform float hasMap; varying vec2 vUv; varying vec4 vTint; varying float vNear;
        void main(){ vec4 t = hasMap > 0.5 ? texture2D(map, vUv) : vec4(1.0 - smoothstep(0.0, 0.5, length(vUv - 0.5)));
          ${additive ? 'gl_FragColor = vec4(t.rgb * vTint.rgb * vTint.a * t.a * vNear, 1.0);'
            : mode === 'luma' ? 'float l = max(t.r, max(t.g, t.b)); gl_FragColor = vec4(vTint.rgb * (0.55 + 0.45 * l), l * vTint.a * vNear);'
              : 'gl_FragColor = vec4(t.rgb * vTint.rgb, t.a * vTint.a * vNear);'} }`,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 10;
  }

  clear(): void { this.particles.length = 0; this.cursor = 0; }

  private placed = 0;
  /**
   * Immediate mode, for things redrawn from game state every frame (bolt heads, smoke
   * screens, cargo): instances go straight into the buffers, with no particle objects
   * and so no garbage. Such a pool is never passed through `update`.
   */
  begin(): void { this.placed = 0; }
  put(x: number, y: number, z: number, size: number, rot: number, r: number, g: number, b: number, a = 1): void {
    if (this.placed >= this.capacity) return;
    const n = this.placed++;
    this.offset.setXYZ(n, x, y, z); this.look.setXYZ(n, size, rot, 0); this.tint.setXYZW(n, r, g, b, a);
  }
  end(): void {
    this.geometry.instanceCount = this.placed;
    this.offset.needsUpdate = true; this.look.needsUpdate = true; this.tint.needsUpdate = true;
  }

  spawn(o: SpawnOptions): void {
    const p: Particle = { vx: 0, vy: 0, vz: 0, drag: 0, age: 0, life: 0.5, size0: 1, size1: 1, rot: 0, spin: 0,
      r: 1, g: 1, b: 1, a: 1, fadeIn: 0, frame0: 0, frames: 1, ...o };
    if (this.particles.length < this.capacity) this.particles.push(p);
    else { this.particles[this.cursor] = p; this.cursor = (this.cursor + 1) % this.capacity; }
  }

  update(dt: number): void {
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.age += dt;
      if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt;
      const t = p.age / p.life;
      const fade = (p.fadeIn > 0 ? Math.min(1, p.age / p.fadeIn) : 1) * (1 - t * t);
      this.offset.setXYZ(n, p.x, p.y, p.z);
      this.look.setXYZ(n, p.size0 + (p.size1 - p.size0) * Math.sqrt(t), p.rot, p.frame0 + Math.min(p.frames - 1, Math.floor(t * p.frames)));
      this.tint.setXYZW(n, p.r, p.g, p.b, p.a * fade);
      this.velocity?.setXYZ(n, p.vx, p.vy, p.vz);
      n++;
    }
    this.geometry.instanceCount = n;
    this.offset.needsUpdate = true; this.look.needsUpdate = true; this.tint.needsUpdate = true;
    if (this.velocity) this.velocity.needsUpdate = true;
  }
}

/** Laser bolts: quads stretched along their own velocity, facing the camera. */
class BoltPool {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly head: THREE.InstancedBufferAttribute;
  private readonly axis: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  count = 0;
  constructor(texture: THREE.Texture | undefined, private readonly capacity: number) {
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(QUAD, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    this.head = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.axis = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('head', this.head); this.geometry.setAttribute('axis', this.axis); this.geometry.setAttribute('tint', this.tint);
    // DoubleSide is load-bearing: the quad is built along the bolt's velocity, so its
    // winding flips with direction and every bolt flying away from the camera was culled.
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { map: { value: texture ?? null }, hasMap: { value: texture ? 1 : 0 } },
      vertexShader: `attribute vec3 head; attribute vec4 axis; attribute vec4 tint; varying vec2 vUv; varying vec4 vTint;
        void main(){ vec4 a = modelViewMatrix * vec4(head, 1.0); vec4 b = modelViewMatrix * vec4(head - axis.xyz * axis.w, 1.0);
          vec3 dir = b.xyz - a.xyz; vec3 cr = cross(dir, a.xyz); float cl = length(cr);
          vec3 side = (cl > 1e-6 ? cr / cl : vec3(1.0, 0.0, 0.0)) * tint.w;
          vec3 p = mix(a.xyz, b.xyz, position.y + 0.5) + side * position.x * 2.0;
          vUv = uv; vTint = tint; gl_Position = projectionMatrix * vec4(p, 1.0); }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vTint;
        void main(){ float x = vUv.x - 0.5;
          // A hot white core inside a coloured glow; the texture's hairline vanished at range.
          float core = exp(-x * x * 160.0); float glow = exp(-x * x * 14.0);
          float tail = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.3);
          float head = smoothstep(0.0, 0.04, vUv.y);
          gl_FragColor = vec4((vTint.rgb * glow * 1.4 + vec3(1.0) * core * 1.2) * tail * head, 1.0); }`,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 30;
  }
  begin(): void { this.count = 0; }
  add(x: number, y: number, z: number, dx: number, dy: number, dz: number, length: number, width: number, r: number, g: number, b: number): void {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.head.setXYZ(i, x, y, z); this.axis.setXYZW(i, dx, dy, dz, length); this.tint.setXYZW(i, r, g, b, width);
  }
  end(): void {
    this.geometry.instanceCount = this.count;
    this.head.needsUpdate = true; this.axis.needsUpdate = true; this.tint.needsUpdate = true;
  }
}

const OWN = new THREE.Color('#5fe9ff');
const ENEMY = new THREE.Color('#ff5a3c');
const random = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

/** Every transient effect in the arena, driven from authoritative events and local fire. */
export class Effects {
  private readonly bolts: BoltPool;
  private readonly glow: ParticlePool;
  private readonly sparks: ParticlePool;
  private readonly impacts: ParticlePool;
  private readonly fire: ParticlePool;
  private readonly explosion: ParticlePool;
  private readonly rings: ParticlePool;
  private readonly smoke: ParticlePool;
  private readonly debris: ParticlePool;
  private readonly dust: ParticlePool;
  private readonly puffs: ParticlePool;
  private readonly cargo: ParticlePool;
  private readonly impactSeen = new Float64Array(64 * 4).fill(-1);
  private readonly smokeLayer: ParticlePool;
  private readonly heads: ParticlePool;
  private readonly flash: ParticlePool;

  constructor(scene: THREE.Scene, fx: Map<string, THREE.Texture>) {
    this.bolts = new BoltPool(fx.get('laserBlue'), 600);
    this.glow = new ParticlePool(fx.get('flare') ?? fx.get('glowDot'), 256, 'add');
    this.sparks = new ParticlePool(undefined, 512, 'streak');
    this.impacts = new ParticlePool(fx.get('impactBlue'), 128, 'add');
    this.fire = new ParticlePool(fx.get('fire'), 128, 'add');
    this.explosion = new ParticlePool(fx.get('explosionAtlas'), 48, 'add', 8);
    this.rings = new ParticlePool(fx.get('shockwave'), 32, 'add');
    this.smoke = new ParticlePool(fx.get('smoke') ?? fx.get('steam'), 160, 'luma');
    this.debris = new ParticlePool(fx.get('asteroidDebris'), 160, 'alpha', 8);
    this.dust = new ParticlePool(fx.get('dust'), 96, 'alpha');
    // Two quads per authoritative puff (64): every puff of a smoke screen must be drawn.
    this.puffs = new ParticlePool(fx.get('smoke') ?? fx.get('steam'), 128, 'luma');
    // Two quads a piece (halo + hot core) for every field and wreck slot.
    this.cargo = new ParticlePool(fx.get('glowDot') ?? fx.get('flare'), 2 * (T.fieldGroups * FIELD_GROUP_SIZE + T.wreckDrops), 'add');
    this.smokeLayer = this.puffs;
    this.heads = new ParticlePool(fx.get('glowDot') ?? fx.get('flare'), 600, 'add');
    this.flash = new ParticlePool(fx.get('muzzleBlue') ?? fx.get('flare'), 64, 'add');
    for (const pool of [this.smoke, this.debris, this.dust, this.puffs]) scene.add(pool.mesh);
    for (const pool of [this.glow, this.sparks, this.impacts, this.fire, this.explosion, this.rings, this.cargo, this.heads, this.flash]) scene.add(pool.mesh);
    scene.add(this.bolts.mesh);
  }

  muzzle(at: THREE.Vector3, forward: THREE.Vector3, own: boolean, speed: number): void {
    const color = own ? OWN : ENEMY;
    const vx = forward.x * speed; const vy = forward.y * speed; const vz = forward.z * speed;
    this.flash.spawn({ x: at.x + forward.x * 1.5, y: at.y + forward.y * 1.5, z: at.z + forward.z * 1.5, vx, vy, vz,
      life: 0.08, size0: 11, size1: 6, r: color.r * 1.6, g: color.g * 1.6, b: color.b * 1.6, rot: Math.random() * 6 });
    this.glow.spawn({ x: at.x, y: at.y, z: at.z, vx, vy, vz, life: 0.06, size0: 6, size1: 2, r: 1.4, g: 1.4, b: 1.4 });
  }

  hit(x: number, y: number, z: number, kind: 'ship' | 'shield' | 'rock', own: boolean): void {
    if (kind === 'rock') {
      for (let i = 0; i < 7; i++) this.sparks.spawn({ x, y, z, vx: random(-40, 40), vy: random(-40, 40), vz: random(-40, 40), drag: 3,
        life: random(0.25, 0.5), size0: 1.6, size1: 0.4, r: 1, g: 0.7, b: 0.35 });
      this.dust.spawn({ x, y, z, life: 0.9, size0: 4, size1: 12, r: 0.55, g: 0.5, b: 0.45, a: 0.5, rot: Math.random() * 6 });
      this.debris.spawn({ x, y, z, vx: random(-12, 12), vy: random(-12, 12), vz: random(-12, 12), life: 1.2, size0: 1.6, size1: 1.2,
        frame0: Math.floor(Math.random() * 64), spin: random(-4, 4), r: 0.8, g: 0.75, b: 0.7 });
      return;
    }
    const color = kind === 'shield' ? new THREE.Color('#6fb7ff') : own ? new THREE.Color('#9ffcff') : new THREE.Color('#ff8a5c');
    this.impacts.spawn({ x, y, z, life: 0.22, size0: 7, size1: 13, r: color.r * 1.6, g: color.g * 1.6, b: color.b * 1.6, rot: Math.random() * 6 });
    this.glow.spawn({ x, y, z, life: 0.12, size0: 14, size1: 6, r: color.r, g: color.g, b: color.b });
    for (let i = 0; i < 10; i++) this.sparks.spawn({ x, y, z, vx: random(-70, 70), vy: random(-70, 70), vz: random(-70, 70), drag: 4,
      life: random(0.2, 0.45), size0: 1.4, size1: 0.3, r: color.r * 1.5, g: color.g * 1.5, b: color.b * 1.5 });
  }

  boom(x: number, y: number, z: number, scale: number): void {
    for (let i = 0; i < 3; i++) this.explosion.spawn({ x: x + random(-2, 2) * scale, y: y + random(-2, 2) * scale, z: z + random(-2, 2) * scale,
      life: 1.25 + i * 0.15, size0: 26 * scale, size1: 46 * scale, frames: 64, rot: Math.random() * 6, r: 1.3, g: 1.15, b: 1.05 });
    this.glow.spawn({ x, y, z, life: 0.4, size0: 70 * scale, size1: 24 * scale, r: 1.4, g: 1.1, b: 0.8 });
    this.rings.spawn({ x, y, z, life: 0.9, size0: 10 * scale, size1: 150 * scale, r: 1.2, g: 0.85, b: 0.55, rot: Math.random() * 6 });
    for (let i = 0; i < 40; i++) {
      const s = random(60, 190);
      const vx = random(-1, 1); const vy = random(-1, 1); const vz = random(-1, 1);
      const length = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      this.sparks.spawn({ x, y, z, vx: vx / length * s, vy: vy / length * s, vz: vz / length * s, drag: 1.8,
        life: random(0.5, 1.3), size0: random(1.2, 2.6), size1: 0.3, r: 1.5, g: 0.95, b: 0.5 });
    }
    for (let i = 0; i < 14; i++) this.debris.spawn({ x, y, z, vx: random(-50, 50), vy: random(-50, 50), vz: random(-50, 50), drag: 0.6,
      life: random(2, 3.5), size0: random(1.5, 3.5) * scale, size1: random(1.5, 3.5) * scale, frame0: Math.floor(Math.random() * 64),
      spin: random(-5, 5), r: 0.55, g: 0.5, b: 0.48 });
    for (let i = 0; i < 6; i++) this.fire.spawn({ x, y, z, vx: random(-15, 15), vy: random(-15, 15), vz: random(-15, 15), drag: 1.5,
      life: random(0.5, 0.9), size0: 14 * scale, size1: 30 * scale, rot: Math.random() * 6, spin: random(-1, 1), r: 1.2, g: 0.8, b: 0.6 });
    for (let i = 0; i < 5; i++) this.smoke.spawn({ x: x + random(-4, 4), y: y + random(-4, 4), z: z + random(-4, 4), vx: random(-10, 10), vy: random(-10, 10),
      vz: random(-10, 10), drag: 0.6, life: random(1.8, 2.8), fadeIn: 0.3, size0: 12 * scale, size1: 34 * scale, rot: Math.random() * 6,
      spin: random(-0.4, 0.4), r: 0.2, g: 0.19, b: 0.2, a: 0.32 });
  }

  warp(x: number, y: number, z: number, color: string): void {
    const c = new THREE.Color(color);
    this.rings.spawn({ x, y, z, life: 0.8, size0: 6, size1: 90, r: c.r * 1.5, g: c.g * 1.5, b: c.b * 1.5 });
    this.glow.spawn({ x, y, z, life: 0.6, size0: 80, size1: 10, r: c.r * 1.6, g: c.g * 1.6, b: c.b * 1.6 });
    for (let i = 0; i < 24; i++) this.sparks.spawn({ x, y, z, vx: random(-90, 90), vy: random(-90, 90), vz: random(-90, 90), drag: 2.5,
      life: random(0.3, 0.7), size0: 2, size1: 0.3, r: c.r * 1.5, g: c.g * 1.5, b: c.b * 1.5 });
  }

  scrape(x: number, y: number, z: number, strength: number): void {
    for (let i = 0; i < 4 + strength * 14; i++) this.sparks.spawn({ x, y, z, vx: random(-50, 50), vy: random(-50, 50), vz: random(-50, 50), drag: 3,
      life: random(0.2, 0.5), size0: 1.6, size1: 0.3, r: 1.6, g: 1.0, b: 0.5 });
    this.dust.spawn({ x, y, z, life: 1.2, size0: 6, size1: 18 + strength * 20, r: 0.5, g: 0.46, b: 0.42, a: 0.5 });
  }

  /** A crackle off a damaged hull: a few small sparks that keep most of the ship's speed. */
  damageSparks(at: THREE.Vector3, velocity: THREE.Vector3, damage: number): void {
    const count = 3 + Math.floor(damage * 5);
    for (let i = 0; i < count; i++) this.sparks.spawn({ x: at.x, y: at.y, z: at.z,
      vx: velocity.x * 0.9 + random(-22, 22), vy: velocity.y * 0.9 + random(-22, 22), vz: velocity.z * 0.9 + random(-22, 22), drag: 3.5,
      life: random(0.18, 0.4), size0: random(0.7, 1.3), size1: 0.2, r: 1.9, g: 1.15, b: 0.6 });
    this.glow.spawn({ x: at.x, y: at.y, z: at.z, vx: velocity.x, vy: velocity.y, vz: velocity.z, life: 0.07, size0: 2.6, size1: 1, r: 1.3, g: 0.8, b: 0.45 });
  }

  /** Turbo lights: a white-hot flash at the nozzle that the bloom spreads, then the long flame. */
  ignite(at: THREE.Vector3, axis: THREE.Vector3, nozzle: number): void {
    this.glow.spawn({ x: at.x + axis.x * nozzle, y: at.y + axis.y * nozzle, z: at.z + axis.z * nozzle,
      life: 0.26, size0: nozzle * 7, size1: nozzle * 2.5, r: 2.6, g: 1.9, b: 1.2 });
  }

  /** One ember torn out of a burning nozzle: it keeps half the ship's speed and is flung back. */
  ember(at: THREE.Vector3, axis: THREE.Vector3, velocity: THREE.Vector3): void {
    const back = random(40, 90);
    this.sparks.spawn({ x: at.x, y: at.y, z: at.z,
      vx: velocity.x * 0.5 + axis.x * back + random(-9, 9), vy: velocity.y * 0.5 + axis.y * back + random(-9, 9),
      vz: velocity.z * 0.5 + axis.z * back + random(-9, 9), drag: 2.2, life: random(0.18, 0.42),
      size0: random(0.35, 0.75), size1: 0.1, r: 2, g: random(0.9, 1.4), b: 0.45 });
  }

  /** One thin puff of a critical hull's smoke trail; it is left behind, not carried along. */
  damageSmoke(at: THREE.Vector3, velocity: THREE.Vector3, damage: number): void {
    // Most of the ship's speed is kept at first and bled off by drag, so the trail stays
    // readable behind the hull for a moment before it streams past the camera.
    this.smoke.spawn({ x: at.x, y: at.y, z: at.z, vx: velocity.x * 0.6 + random(-2, 2), vy: velocity.y * 0.6 + random(-1, 3),
      vz: velocity.z * 0.6 + random(-2, 2), drag: 1.4, life: random(1, 1.4), fadeIn: 0.06, size0: 1.6, size1: random(6, 9),
      rot: Math.random() * 6, spin: random(-0.8, 0.8), r: 0.2, g: 0.19, b: 0.19, a: 0.3 + damage * 0.25 });
  }

  mining(x: number, y: number, z: number, nx: number, ny: number, nz: number): void {
    this.sparks.spawn({ x, y, z, vx: nx * 30 + random(-25, 25), vy: ny * 30 + random(-25, 25), vz: nz * 30 + random(-25, 25), drag: 2,
      life: random(0.3, 0.6), size0: 1.4, size1: 0.3, r: 0.5, g: 1.5, b: 1.6 });
    if (Math.random() < 0.25) this.glow.spawn({ x, y, z, life: 0.2, size0: 10, size1: 4, r: 0.4, g: 1.3, b: 1.5 });
  }

  /** Authoritative bolts (and predicted own ones) drawn every frame at their interpolated spot. */
  drawBolts(world: ArenaWorld, alpha: number, ownId: number, ghosts: boolean): void {
    this.bolts.begin();
    this.heads.begin();
    const add = (bullet: Projectile, own: boolean): void => {
      if (bullet.life <= 0) return;
      const x = bullet.previous.x + (bullet.p.x - bullet.previous.x) * alpha;
      const y = bullet.previous.y + (bullet.p.y - bullet.previous.y) * alpha;
      const z = bullet.previous.z + (bullet.p.z - bullet.previous.z) * alpha;
      const speed = Math.sqrt(bullet.v.x * bullet.v.x + bullet.v.y * bullet.v.y + bullet.v.z * bullet.v.z) || 1;
      // Age at the drawn (interpolated) moment, not at the last tick.
      const age = Math.max(0, T.projectileLife - bullet.life - (1 - alpha) / T.tickRate);
      // The tail may reach back only as far as the bolt has pulled ahead of its gun: it
      // inherits the ship's speed, so measured against the ship it has flown muzzleSpeed·age.
      // Anything longer would poke out behind the ship that fired it.
      const flown = age * T.muzzleSpeed;
      // Own bolts fly straight away from the chase camera, so they need a long tail and a
      // bright head to read as fire at all; enemy bolts cross the view and stay tighter.
      const length = Math.min(own ? 180 : 46, flown);
      if (length < 0.5) return;
      const color = own ? OWN : ENEMY;
      this.bolts.add(x, y, z, bullet.v.x / speed, bullet.v.y / speed, bullet.v.z / speed, length, own ? 1.3 : 1.5, color.r, color.g, color.b);
      this.heads.put(x, y, z, own ? 6 : 6.5, 0, color.r * 1.6, color.g * 1.6, color.b * 1.6);
    };
    for (const bullet of world.projectiles) if (!(ghosts && bullet.owner === ownId)) add(bullet, bullet.owner === ownId);
    if (ghosts) for (const bullet of world.ghosts) add(bullet, true);
    this.bolts.end();
    this.heads.end();
  }

  /** Spawns visuals for impacts the simulation reported since the last frame. */
  watchImpacts(world: ArenaWorld, ownId: number, onExplosion: (x: number, y: number, z: number) => void,
    onHit: (kind: 'ship' | 'shield' | 'rock', x: number, y: number, z: number) => void): void {
    world.impacts.forEach((hit, i) => {
      if (!hit.active) return;
      const k = i * 4;
      const fresh = this.impactSeen[k] !== hit.p.x || this.impactSeen[k + 1] !== hit.p.y || this.impactSeen[k + 2] !== hit.p.z
        || hit.age + 0.05 < (this.impactSeen[k + 3] ?? 0);
      this.impactSeen[k] = hit.p.x; this.impactSeen[k + 1] = hit.p.y; this.impactSeen[k + 2] = hit.p.z; this.impactSeen[k + 3] = hit.age;
      if (!fresh || hit.age > 0.25) return;
      if (hit.kind === 'explosion') { this.boom(hit.p.x, hit.p.y, hit.p.z, 1); onExplosion(hit.p.x, hit.p.y, hit.p.z); return; }
      this.hit(hit.p.x, hit.p.y, hit.p.z, hit.kind, ownId >= 0);
      onHit(hit.kind, hit.p.x, hit.p.y, hit.p.z);
    });
  }

  /** Smoke screens are gameplay (they block sight), so they are drawn at their true size. */
  drawSmoke(world: ArenaWorld, time: number): void {
    // Rebuilt every frame from the authoritative puffs.
    const pool = this.smokeLayer;
    pool.begin();
    world.smoke.forEach((puff, i) => {
      if (!puff.active) return;
      const grow = Math.min(1, puff.age / T.smokeGrow);
      const fade = Math.max(0, Math.min(1, (T.smokeLife - puff.age) / 1.2));
      for (let k = 0; k < 2; k++) {
        pool.put(puff.p.x + Math.sin(i * 3.1 + k) * 6, puff.p.y + Math.cos(i * 1.7 + k) * 5, puff.p.z,
          T.smokeRadius * 2.6 * (0.4 + 0.6 * grow) * (k === 0 ? 1 : 0.8), i * 1.3 + k + time * 0.05 * (k === 0 ? 1 : -1),
          0.42, 0.47, 0.55, 0.72 * fade);
      }
    });
    pool.end();
    this.cargo.begin();
    // Farm pieces in their kind's colour; a bigger piece glows bigger, so value reads at a glance.
    world.cargoDrops.forEach((drop, i) => {
      if (!drop.active) return;
      const [r, g, b] = FARM_RGB[drop.kind] ?? FARM_RGB[0] ?? [1, 1, 1];
      const size = 9 + Math.min(drop.amount, T.dropChunk) * 1.3;
      const bob = Math.sin(time * 1.6 + i * 1.7) * 1.2;
      this.cargo.put(drop.p.x, drop.p.y + bob, drop.p.z, size * (1 + Math.sin(time * 3 + i) * 0.12), time * 0.4 + i, r * 0.55, g * 0.55, b * 0.55, 0.85);
      this.cargo.put(drop.p.x, drop.p.y + bob, drop.p.z, size * 0.32, 0, 1.2 + r * 0.3, 1.2 + g * 0.3, 1.2 + b * 0.3, 1);
    });
    this.cargo.end();
  }

  update(dt: number): void {
    // Simulated pools only; the immediate ones (heads, smoke screens, cargo) are rebuilt in draw.
    for (const pool of [this.glow, this.sparks, this.impacts, this.fire, this.explosion, this.rings, this.smoke, this.debris, this.dust, this.flash]) pool.update(dt);
  }
}
