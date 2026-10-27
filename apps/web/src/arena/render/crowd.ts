import * as THREE from 'three';
import { EngineFlameBatch, type EngineFlameOptions } from '../../vfx/engineFlames.js';
import type { PreparedModel } from '../assets/load.js';
import { CRUISE_REACH, LIT, TURBO_REACH } from './flames.js';
import { fogToBlack, setUniform } from './materials.js';
import type { FlameSet } from './ships.js';

/**
 * Metres from the camera past which a ship is drawn with the crowd: by then it shows its
 * farthest hull level and the engine glow, and nothing else a phone can resolve. A ship keeps
 * its way of drawing within ± CROWD_BAND of the edge, so one hovering there does not switch.
 * S22, 36 ships in view: not drawing these ships at all was 38.6 → 43.4 fps
 * (docs/komutan-gemisi/18-kademeli-gorunurluk-plani.md).
 */
export const CROWD_RANGE = 800;
export const CROWD_BAND = 40;
/**
 * Samples in a trail and the seconds it lasts: a sample every ~1/45 s, each fading by its own age;
 * its half-width in nozzle radii. Owner 2026-10-27: 30 % longer and wider (0.55 s, 0.8) so a ship
 * 700–800 m out can be picked out.
 */
export const TRAIL_POINTS = 32;
export const TRAIL_AGE = 0.55 * 1.3;
export const TRAIL_WIDTH = 0.8 * 1.3;

/** One engine's recent nozzle positions, newest first, and when each was taken; kept by its ship. */
export interface TrailSamples { readonly points: Float32Array; readonly ages: Float32Array; readonly count: number }

interface Batch { meshes: THREE.InstancedMesh[]; count: number }

/**
 * What the other ships draw together each frame: the hulls of the far ones, one instanced draw
 * per part of each model given; every engine glow and nav light, one point draw; every trail,
 * one ribbon draw; every engine flame, one volume draw (additive, so the order is free). `begin` empties it, each ship adds itself while it updates, `end` hands the
 * counts and the written ranges to the GPU.
 */
export class ShipCrowd {
  private readonly batches = new Map<PreparedModel, Batch>();
  private readonly glows: THREE.Points;
  private readonly glowMaterial: THREE.ShaderMaterial;
  private readonly position: THREE.BufferAttribute;
  private readonly size: THREE.BufferAttribute;
  private readonly color: THREE.BufferAttribute;
  private readonly opacity: THREE.BufferAttribute;
  private engines = 0;
  private readonly trails: THREE.Mesh;
  private readonly trailMaterial: THREE.ShaderMaterial;
  private readonly ribbon: { position: THREE.BufferAttribute; next: THREE.BufferAttribute; age: THREE.BufferAttribute; strength: THREE.BufferAttribute; width: THREE.BufferAttribute };
  private readonly trailCapacity: number;
  private trailCount = 0;
  private readonly flames: EngineFlameBatch | null;
  private readonly flameSlot: EngineFlameOptions = { variant: 'cryo', matrix: new THREE.Matrix4(), length: 1, nozzleRadius: 1, throttle: 0, seed: 0 };
  private flameCount = 0;

  constructor(private readonly scene: THREE.Scene, glowTexture: THREE.Texture | undefined, models: readonly PreparedModel[], capacity: number,
    flames: FlameSet | null = null) {
    for (const model of new Set(models)) {
      const level = model.lods?.at(-1) ?? model;
      const meshes = level.parts.map(part => {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material.clone(), capacity);
        mesh.count = 0; mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(mesh);
        return mesh;
      });
      this.batches.set(model, { meshes, count: 0 });
    }
    // Every engine of every ship and its three nav lights (ships.ts).
    const engines = capacity * (Math.max(1, ...models.map(model => model.engines.length)) + 3);
    const geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(new Float32Array(engines * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.size = new THREE.BufferAttribute(new Float32Array(engines), 1).setUsage(THREE.DynamicDrawUsage);
    this.color = new THREE.BufferAttribute(new Float32Array(engines * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.opacity = new THREE.BufferAttribute(new Float32Array(engines), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.position); geometry.setAttribute('glowSize', this.size);
    geometry.setAttribute('glowColor', this.color); geometry.setAttribute('glowOpacity', this.opacity);
    geometry.setDrawRange(0, 0);
    // The ship's own glow is an additive sprite `glowSize` metres wide; a point the same size on screen.
    this.glowMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, pixels: { value: 1 } }]),
      vertexShader: `attribute float glowSize; attribute vec3 glowColor; attribute float glowOpacity; uniform float pixels; varying vec4 vColor;
        #include <fog_pars_vertex>
        void main(){ vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = glowSize * pixels / max(1.0, -mvPosition.z); vColor = vec4(glowColor, glowOpacity);
          #include <fog_vertex>
        }`,
      fragmentShader: fogToBlack(`uniform sampler2D map; varying vec4 vColor;
        #include <fog_pars_fragment>
        void main(){ gl_FragColor = vColor * texture2D(map, gl_PointCoord);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`),
    });
    const map = this.glowMaterial.uniforms.map; if (map) map.value = glowTexture ?? null;
    this.glows = new THREE.Points(geometry, this.glowMaterial);
    this.glows.frustumCulled = false;
    scene.add(this.glows);
    // Trails: a camera-facing ribbon per engine through its samples, faded by age, melting near the camera.
    this.trailCapacity = capacity * Math.max(1, ...models.map(model => model.engines.length));
    const vertices = this.trailCapacity * TRAIL_POINTS * 2;
    const dynamic = (size: number): THREE.BufferAttribute => new THREE.BufferAttribute(new Float32Array(vertices * size), size).setUsage(THREE.DynamicDrawUsage);
    this.ribbon = { position: dynamic(3), next: dynamic(3), age: dynamic(1), strength: dynamic(1), width: dynamic(1) };
    const side = new Float32Array(vertices);
    for (let i = 0; i < vertices; i += 2) { side[i] = -1; side[i + 1] = 1; }
    const index: number[] = [];
    for (let trail = 0; trail < this.trailCapacity; trail++) {
      for (let i = 0; i < TRAIL_POINTS - 1; i++) { const a = (trail * TRAIL_POINTS + i) * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const ribbons = new THREE.BufferGeometry();
    ribbons.setIndex(index);
    ribbons.setAttribute('position', this.ribbon.position); ribbons.setAttribute('nextPoint', this.ribbon.next);
    ribbons.setAttribute('side', new THREE.BufferAttribute(side, 1)); ribbons.setAttribute('age', this.ribbon.age);
    ribbons.setAttribute('strength', this.ribbon.strength); ribbons.setAttribute('width', this.ribbon.width);
    ribbons.setDrawRange(0, 0);
    this.trailMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color('#7fb4ff') } },
      vertexShader: `attribute vec3 nextPoint; attribute float side; attribute float age; attribute float strength; attribute float width;
        varying float vAge; varying float vSide; varying float vDepth; varying float vStrength;
        void main(){ vAge = age; vSide = side; vStrength = strength;
          vec4 a = modelViewMatrix * vec4(position, 1.0); vec4 b = modelViewMatrix * vec4(nextPoint, 1.0); vDepth = -a.z;
          vec2 dir = b.xy - a.xy; float len = length(dir); dir = len > 1e-4 ? dir / len : vec2(0.0, 1.0);
          vec2 normal = vec2(-dir.y, dir.x); float w = width * (0.35 + 0.65 * (1.0 - clamp(age, 0.0, 1.0)));
          a.xy += normal * side * w; gl_Position = projectionMatrix * a; }`,
      fragmentShader: `uniform vec3 color; varying float vAge; varying float vSide; varying float vDepth; varying float vStrength;
        void main(){ float core = exp(-vSide * vSide * 3.5);
          float life = clamp(1.0 - vAge, 0.0, 1.0); float fade = life * life * (3.0 - 2.0 * life);
          float near = smoothstep(10.0, 46.0, vDepth);
          gl_FragColor = vec4(color * core * fade * near * vStrength, 1.0); }`,
    });
    this.trails = new THREE.Mesh(ribbons, this.trailMaterial);
    this.trails.name = 'astera-ship-trails'; this.trails.frustumCulled = false;
    scene.add(this.trails);
    // A Cryo and a Solar flame per engine, as each ship's own ShipFlames burns them.
    this.flames = flames ? new EngineFlameBatch(flames.noise, { capacity: this.trailCapacity * 2, quality: flames.quality }) : null;
    if (this.flames) { this.flames.mesh.renderOrder = 22; scene.add(this.flames.mesh); }
  }

  /** True when ships of this model can be drawn here. */
  takes(model: PreparedModel): boolean { return this.batches.has(model); }

  begin(): void {
    for (const batch of this.batches.values()) batch.count = 0;
    this.engines = 0; this.trailCount = 0; this.flameCount = 0;
  }

  /** One far ship: its body's world matrix (unit hull to metres), and its engines' glows. */
  addHull(model: PreparedModel, body: THREE.Matrix4): void {
    const batch = this.batches.get(model);
    if (!batch || batch.count >= (batch.meshes[0]?.instanceMatrix.count ?? 0)) return;
    for (const mesh of batch.meshes) mesh.setMatrixAt(batch.count, body);
    batch.count++;
  }

  addGlow(at: THREE.Vector3, size: number, color: THREE.Color, opacity: number): void {
    const i = this.engines;
    if (i >= this.size.count) return;
    this.position.setXYZ(i, at.x, at.y, at.z); this.size.setX(i, size);
    this.color.setXYZ(i, color.r, color.g, color.b); this.opacity.setX(i, opacity);
    this.engines++;
  }

  /** One engine's trail at `time`: `strength` scales its light, `width` its half-width in metres. */
  addTrail(samples: TrailSamples, time: number, strength: number, width: number): void {
    if (this.trailCount >= this.trailCapacity || samples.count === 0) return;
    const { position, next, age } = this.ribbon;
    const base = this.trailCount * TRAIL_POINTS * 2; const { points, ages, count } = samples;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const k = Math.min(i, count - 1); const n = Math.min(i + 1, count - 1);
      const x = points[k * 3] ?? 0; const y = points[k * 3 + 1] ?? 0; const z = points[k * 3 + 2] ?? 0;
      let nx = points[n * 3] ?? x; let ny = points[n * 3 + 1] ?? y; let nz = points[n * 3 + 2] ?? z;
      if (n === k) { const p = Math.max(0, k - 1); nx = x + (x - (points[p * 3] ?? x)); ny = y + (y - (points[p * 3 + 1] ?? y)); nz = z + (z - (points[p * 3 + 2] ?? z)); }
      const a = i < count ? (time - (ages[k] ?? time)) / TRAIL_AGE : 1;
      for (let s = 0; s < 2; s++) { const v = base + i * 2 + s; position.setXYZ(v, x, y, z); next.setXYZ(v, nx, ny, nz); age.setX(v, a); }
    }
    this.ribbon.strength.array.fill(strength, base, base + TRAIL_POINTS * 2);
    this.ribbon.width.array.fill(width, base, base + TRAIL_POINTS * 2);
    this.trailCount++;
  }

  /**
   * One ship's flames: `tilt` its tilt group's world matrix, `nozzles` in metres on it. `lever` 0…1 is
   * the cruise burn; `turbo` 0…1 hands it to the Solar flames at full burn (see ShipFlames).
   */
  addFlames(tilt: THREE.Matrix4, nozzles: readonly THREE.Vector3[], nozzleRadius: number, shipLength: number, lever: number, turbo: number, seed: number): void {
    const batch = this.flames;
    if (!batch) return;
    const slot = this.flameSlot; slot.nozzleRadius = nozzleRadius;
    nozzles.forEach((nozzle, i) => {
      slot.matrix.makeTranslation(nozzle.x, nozzle.y, nozzle.z).premultiply(tilt);
      for (const [variant, throttle, reach, k] of [['cryo', lever * (1 - turbo), CRUISE_REACH, 0], ['solar', turbo, TURBO_REACH, 1]] as const) {
        if (variant === 'solar' && turbo <= LIT) continue;
        if (this.flameCount >= batch.mesh.instanceMatrix.count) return;
        slot.variant = variant; slot.throttle = throttle; slot.length = shipLength * reach; slot.seed = seed + (k * nozzles.length + i) * 17;
        batch.set(this.flameCount++, slot);
      }
    });
  }

  /** `pixelsHigh`: the drawing buffer's height, for the glow's size on screen. */
  end(camera: THREE.PerspectiveCamera, pixelsHigh: number, time = 0): void {
    if (this.flames) { this.flames.mesh.count = this.flameCount; this.flames.update(time); }
    for (const batch of this.batches.values()) {
      for (const mesh of batch.meshes) {
        mesh.count = batch.count;
        if (batch.count > 0) mesh.instanceMatrix.needsUpdate = true;
      }
    }
    this.glows.geometry.setDrawRange(0, this.engines);
    if (this.engines > 0) {
      for (const attribute of [this.position, this.size, this.color, this.opacity]) attribute.needsUpdate = true;
      setUniform(this.glowMaterial, 'pixels', pixelsHigh / 2 * camera.projectionMatrix.elements[5]);
    }
    this.trails.geometry.setDrawRange(0, this.trailCount * (TRAIL_POINTS - 1) * 6);
    if (this.trailCount > 0) {
      // Only the ribbons written this frame go up.
      for (const attribute of Object.values(this.ribbon)) {
        attribute.clearUpdateRanges(); attribute.addUpdateRange(0, this.trailCount * TRAIL_POINTS * 2 * attribute.itemSize);
        attribute.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    for (const batch of this.batches.values()) {
      for (const mesh of batch.meshes) {
        this.scene.remove(mesh); mesh.dispose();
        const material: unknown = mesh.material;
        if (material instanceof THREE.Material) material.dispose();
      }
    }
    this.scene.remove(this.glows); this.glows.geometry.dispose(); this.glowMaterial.dispose();
    this.scene.remove(this.trails); this.trails.geometry.dispose(); this.trailMaterial.dispose();
    if (this.flames) { this.scene.remove(this.flames.mesh); this.flames.dispose(); }
  }
}
