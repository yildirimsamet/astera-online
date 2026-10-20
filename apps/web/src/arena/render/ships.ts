import * as THREE from 'three';
import type { PreparedModel } from '../assets/load.js';
import type { Effects } from './effects.js';
import { setUniform } from './materials.js';

export interface ShipPose {
  position: THREE.Vector3; quaternion: THREE.Quaternion; throttle: number; speed: number; turbo: boolean;
  omegaYaw: number; omegaPitch: number; landed: boolean; mining: boolean; shield: number; cloak: number;
  hull: number; hullMax: number; visible: boolean; hitAt: number; normal: THREE.Vector3;
}

const TRAIL = 48;
const TRAIL_AGE = 0.55;
const UP = new THREE.Vector3(0, 1, 0);
const CORE_CRUISE = new THREE.Color('#8fd2ff');

/**
 * Camera-facing ribbon through the last ~half second of positions. Sampled every frame
 * and faded by age (not by index), so it stays smooth at any frame rate and never ends
 * in a hard cut; it also melts away as it nears the chase camera.
 */
class Trail {
  readonly mesh: THREE.Mesh;
  private readonly points = new Float32Array(TRAIL * 3);
  private readonly ages = new Float32Array(TRAIL);
  private readonly geometry = new THREE.BufferGeometry();
  private count = 0;
  private last = -1;
  constructor(color: string, width: number) {
    const position = new Float32Array(TRAIL * 2 * 3);
    const side = new Float32Array(TRAIL * 2);
    const age = new Float32Array(TRAIL * 2);
    const next = new Float32Array(TRAIL * 2 * 3);
    for (let i = 0; i < TRAIL; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; }
    const index: number[] = [];
    for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geometry.setIndex(index);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('nextPoint', new THREE.BufferAttribute(next, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('side', new THREE.BufferAttribute(side, 1));
    this.geometry.setAttribute('age', new THREE.BufferAttribute(age, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color(color) }, width: { value: width }, strength: { value: 1 } },
      vertexShader: `attribute vec3 nextPoint; attribute float side; attribute float age; uniform float width;
        varying float vAge; varying float vSide; varying float vDepth;
        void main(){ vAge = age; vSide = side;
          vec4 a = modelViewMatrix * vec4(position, 1.0); vec4 b = modelViewMatrix * vec4(nextPoint, 1.0); vDepth = -a.z;
          vec2 dir = b.xy - a.xy; float len = length(dir); dir = len > 1e-4 ? dir / len : vec2(0.0, 1.0);
          vec2 normal = vec2(-dir.y, dir.x); float w = width * (0.35 + 0.65 * (1.0 - clamp(age, 0.0, 1.0)));
          a.xy += normal * side * w; gl_Position = projectionMatrix * a; }`,
      fragmentShader: `uniform vec3 color; uniform float strength; varying float vAge; varying float vSide; varying float vDepth;
        void main(){ float core = exp(-vSide * vSide * 3.5);
          float life = clamp(1.0 - vAge, 0.0, 1.0); float fade = life * life * (3.0 - 2.0 * life);
          float near = smoothstep(10.0, 46.0, vDepth);
          gl_FragColor = vec4(color * core * fade * near * strength, 1.0); }`,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
  }
  reset(): void { this.count = 0; this.last = -1; }
  push(point: THREE.Vector3, time: number, strength: number): void {
    const material = this.mesh.material;
    if (material instanceof THREE.ShaderMaterial) setUniform(material, 'strength', strength);
    if (this.last < 0 || time - this.last > 1 / 90) {
      this.points.copyWithin(3, 0, (TRAIL - 1) * 3); this.ages.copyWithin(1, 0, TRAIL - 1);
      this.count = Math.min(TRAIL, this.count + 1); this.last = time;
    }
    this.points[0] = point.x; this.points[1] = point.y; this.points[2] = point.z; this.ages[0] = time;
    const position = this.geometry.getAttribute('position'); const next = this.geometry.getAttribute('nextPoint');
    const age = this.geometry.getAttribute('age');
    for (let i = 0; i < TRAIL; i++) {
      const k = Math.min(i, this.count - 1); const n = Math.min(i + 1, this.count - 1);
      const x = this.points[k * 3] ?? 0; const y = this.points[k * 3 + 1] ?? 0; const z = this.points[k * 3 + 2] ?? 0;
      let nx = this.points[n * 3] ?? x; let ny = this.points[n * 3 + 1] ?? y; let nz = this.points[n * 3 + 2] ?? z;
      if (n === k) { const p = Math.max(0, k - 1); nx = x + (x - (this.points[p * 3] ?? x)); ny = y + (y - (this.points[p * 3 + 1] ?? y)); nz = z + (z - (this.points[p * 3 + 2] ?? z)); }
      const a = i < this.count ? (time - (this.ages[k] ?? time)) / TRAIL_AGE : 1;
      for (let s = 0; s < 2; s++) { position.setXYZ(i * 2 + s, x, y, z); next.setXYZ(i * 2 + s, nx, ny, nz); age.setX(i * 2 + s, a); }
    }
    position.needsUpdate = true; next.needsUpdate = true; age.needsUpdate = true;
  }
}

/**
 * Engine plume: a ribbon along the thrust axis that always turns its face to the camera
 * (so it has no hard geometric edge from any side), filled with Subdivision's own trail
 * streak scrolling backwards and bent by wavy noise. White-hot core at the nozzle, a
 * coloured body that swells and tapers, blue in cruise and amber-red in turbo, where
 * shock diamonds knot the core. Values above 1 feed the bloom.
 */
function flameMaterial(fx: Map<string, THREE.Texture>): THREE.ShaderMaterial {
  const trail = fx.get('engineTrail') ?? null; const noise = fx.get('noiseWavy') ?? null;
  for (const texture of [trail, noise]) {
    if (texture && texture.wrapT !== THREE.RepeatWrapping) { texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.needsUpdate = true; }
  }
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      trail: { value: trail }, noise: { value: noise }, hasTrail: { value: trail ? 1 : 0 }, hasNoise: { value: noise ? 1 : 0 },
      len: { value: 4 }, width: { value: 1 }, power: { value: 1 }, time: { value: 0 }, turbo: { value: 0 }, seed: { value: 0 },
      cIn: { value: new THREE.Color('#eafcff').multiplyScalar(2.4) }, cMid: { value: new THREE.Color('#58c6ff').multiplyScalar(1.5) },
      cOut: { value: new THREE.Color('#2149ff').multiplyScalar(0.9) },
      tIn: { value: new THREE.Color('#fff2cc').multiplyScalar(2.8) }, tMid: { value: new THREE.Color('#ff9a3a').multiplyScalar(1.7) },
      tOut: { value: new THREE.Color('#ff3214').multiplyScalar(1.0) },
    },
    vertexShader: `uniform float len; uniform float width; varying vec2 vQ;
      void main(){ vec4 a = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); vec4 b = modelViewMatrix * vec4(0.0, 0.0, -len, 1.0);
        vec3 dir = b.xyz - a.xyz; vec3 at = mix(a.xyz, b.xyz, position.y);
        vec3 cr = cross(dir, at); float cl = length(cr);
        vec3 side = cl > 1e-5 ? cr / cl : vec3(1.0, 0.0, 0.0);
        vQ = position.xy; gl_Position = projectionMatrix * vec4(at + side * position.x * width, 1.0); }`,
    fragmentShader: `uniform sampler2D trail; uniform sampler2D noise; uniform float hasTrail; uniform float hasNoise;
      uniform float power; uniform float time; uniform float turbo; uniform float seed;
      uniform vec3 cIn; uniform vec3 cMid; uniform vec3 cOut; uniform vec3 tIn; uniform vec3 tMid; uniform vec3 tOut;
      varying vec2 vQ;
      void main(){ float t = clamp(vQ.y, 0.0, 1.0); float x = clamp(vQ.x, -1.0, 1.0);
        // Turbulence grows downstream: the exhaust leaves the nozzle straight and frays.
        float n = hasNoise > 0.5 ? texture2D(noise, vec2(0.5 + x * 0.3 + seed, t * 1.3 - time * 2.6)).r : 0.5;
        float xr = x + (n - 0.5) * 0.5 * t;
        float radius = mix(0.38, 0.9, smoothstep(0.0, 0.22, t)) * mix(1.0, 0.16, smoothstep(0.22, 1.0, t));
        float d = xr / max(radius, 0.04);
        float body = exp(-d * d * 2.4);
        float streak = hasTrail > 0.5 ? texture2D(trail, vec2(0.5 + xr * 0.42, t * 0.9 - time * 3.4 + seed)).r : 0.6;
        float c = xr / max(radius * 0.3, 0.02);
        float core = exp(-c * c * 2.0) * (1.0 - smoothstep(0.0, 0.55, t));
        float knot = turbo * pow(max(0.0, cos(t * 40.0 - time * 4.0)), 10.0) * (1.0 - smoothstep(0.05, 0.6, t)) * exp(-c * c * 0.6);
        float fade = smoothstep(0.0, 0.035, t) * (1.0 - smoothstep(0.5, 1.0, t));
        vec3 inner = mix(cIn, tIn, turbo); vec3 mid = mix(cMid, tMid, turbo); vec3 outer = mix(cOut, tOut, turbo);
        vec3 col = mix(outer, mid, smoothstep(0.1, 0.75, body));
        col = mix(col, inner, clamp(core + knot, 0.0, 1.0));
        float glow = body * (0.3 + 0.7 * streak) * (0.8 + 0.4 * n) + core * 1.2 + knot * 1.6;
        gl_FragColor = vec4(col * glow * fade * power, 1.0); }`,
  });
}

/** The ribbon: x across (−1…1), y along the plume (0 at the nozzle, 1 at the tip). */
const PLUME = new THREE.PlaneGeometry(2, 1, 1, 12).translate(0, 0.5, 0);

/**
 * One ship on screen: hull, bank, engines, trail and the states other pilots must read.
 * `group` follows the simulated pose; `tilt` adds the visual bank and nose motion and
 * carries everything bolted to the hull (engines, lights), so a plume never slides off
 * its nozzle in a turn; `body` scales the unit-length model to metres.
 */
export class ShipVisual {
  readonly group = new THREE.Group();
  private readonly tilt = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private readonly glows: THREE.Sprite[] = [];
  private readonly plumes: THREE.Mesh[] = [];
  /** White-hot nozzle glows: they carry the flame when it points straight at the lens. */
  private readonly cores: THREE.Sprite[] = [];
  private readonly coreColor = new THREE.Color();
  private readonly lights: THREE.Sprite[] = [];
  private readonly trails: Trail[] = [];
  private readonly shield: THREE.Group;
  private readonly shieldMaterial: THREE.ShaderMaterial;
  private readonly cloakMaterial: THREE.ShaderMaterial;
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
  private readonly flames: THREE.ShaderMaterial[] = [];
  private readonly nozzle: number;
  private turboMix = 0;
  private bank = 0;
  private pitch = 0;
  private hitFlash = 0;
  private lastHit = -1;
  private readonly scratch = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  readonly length: number;
  readonly halfWidth: number;

  constructor(model: PreparedModel, fx: Map<string, THREE.Texture>, length: number, own: boolean, scene: THREE.Scene,
    private readonly effects: Effects) {
    this.length = length;
    this.halfWidth = model.size.x * length / 2;
    this.size = model.size.clone();
    for (const part of model.parts) {
      const material = part.material.clone();
      this.materials.push(material);
      this.body.add(new THREE.Mesh(part.geometry, material));
    }
    this.body.scale.setScalar(length);
    this.tilt.add(this.body);
    this.group.add(this.tilt);
    const glowTexture = fx.get('glowDot') ?? fx.get('flare');
    this.engineColor = new THREE.Color('#7fd6ff');
    // Nozzle size from the hull: big twin nacelles get a fat plume, slim jets a thin one.
    this.nozzle = Math.max(0.035, Math.min(0.075, model.size.y * 0.2)) * length;
    for (const [x, y, z] of model.engines) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture ?? null, color: this.engineColor, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      glow.position.set(x * length, y * length, z * length);
      this.tilt.add(glow); this.glows.push(glow);
      const flame = flameMaterial(fx);
      setUniform(flame, 'seed', Math.random());
      this.flames.push(flame);
      const plume = new THREE.Mesh(PLUME, flame);
      plume.position.copy(glow.position); plume.frustumCulled = false; plume.renderOrder = 22;
      this.tilt.add(plume); this.plumes.push(plume);
      for (let k = 0; k < 2; k++) {
        const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture ?? null, color: this.engineColor, transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        core.position.copy(glow.position); this.tilt.add(core); this.cores.push(core);
      }
      // Contrails only on other ships: seen from the side they read well; behind your own
      // ship they would stream straight into the chase camera.
      if (!own) { const trail = new Trail('#7fb4ff', this.nozzle * 0.8); scene.add(trail.mesh); this.trails.push(trail); }
    }
    // Wingtip navigation lights: red port, green starboard, white tail strobe (metres, on the tilt).
    const dot = fx.get('glowDot') ?? glowTexture;
    const half = this.halfWidth * 0.92;
    for (const [x, color] of [[half, '#ff3b3b'], [-half, '#3bff7a'], [0, '#ffffff']] as const) {
      const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot ?? null, color, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false }));
      light.position.set(x, x === 0 ? model.size.y * length * 0.5 : 0, x === 0 ? -length * 0.45 : -length * 0.1);
      light.scale.setScalar(length * 0.08);
      this.tilt.add(light); this.lights.push(light);
    }
    // Spawn shield: an energy coat hugging the hull, not a bubble over the view.
    const shieldMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color('#5fb4ff') }, strength: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec3 p = position + normal * 0.035;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; uniform float strength; uniform float time; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ float rim = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
          float sweep = smoothstep(0.9, 1.0, sin(vP.z * 9.0 - time * 5.0) * 0.5 + 0.5);
          gl_FragColor = vec4(color * (rim * 1.1 + sweep * 0.5) * strength, 1.0); }`,
    });
    this.shield = new THREE.Group();
    for (const part of model.parts) this.shield.add(new THREE.Mesh(part.geometry, shieldMaterial));
    this.shieldMaterial = shieldMaterial;
    this.body.add(this.shield);
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

  /** Muzzle point in world space for the gun on `side` (−1 left, +1 right). */
  muzzle(out: THREE.Vector3, side: number): THREE.Vector3 {
    out.set(-side * this.halfWidth * 0.45, -this.length * 0.04, this.length * 0.5);
    return this.body.localToWorld(out.divideScalar(this.length));
  }

  update(pose: ShipPose, time: number, dt: number): void {
    this.group.visible = pose.visible;
    for (const trail of this.trails) trail.mesh.visible = pose.visible && !pose.landed && pose.cloak === 0;
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
    this.glows.forEach((glow, i) => {
      const flicker = 0.93 + 0.07 * Math.sin(time * 37 + i * 2.1);
      glow.scale.setScalar(this.nozzle * (2.6 + burn * 2.2) * flicker);
      glow.material.opacity = pose.cloak > 0 ? 0 : 0.55 + burn * 0.35;
      glow.material.color.copy(this.engineColor).lerp(this.turboColor, this.turboMix);
    });
    // Plume: grows with the lever, roughly doubles and widens on turbo, breathes a little.
    const breathe = 0.95 + 0.05 * Math.sin(time * 23) * Math.sin(time * 37 + 1.3);
    const plumeLength = this.length * (0.14 + thrust * 0.42 + this.turboMix * 0.85) * breathe;
    for (const plume of this.plumes) plume.visible = pose.cloak === 0 && !pose.landed;
    for (const flame of this.flames) {
      setUniform(flame, 'len', plumeLength); setUniform(flame, 'width', this.nozzle * (1.7 + this.turboMix * 0.6));
      setUniform(flame, 'time', time); setUniform(flame, 'turbo', this.turboMix);
      setUniform(flame, 'power', 0.55 + thrust * 0.6 + this.turboMix * 0.45);
    }
    this.coreColor.copy(CORE_CRUISE).lerp(this.turboColor, this.turboMix);
    this.cores.forEach((core, i) => {
      const k = i % 2; const glow = this.glows[Math.floor(i / 2)];
      if (!glow) return;
      // k 0: the white-hot throat right at the nozzle; k 1: the coloured bloom just behind it.
      core.position.set(glow.position.x, glow.position.y, glow.position.z - plumeLength * (k === 0 ? 0.04 : 0.16));
      core.scale.setScalar(this.nozzle * (k === 0 ? 1.25 : 2.3) * (1 + this.turboMix * 0.5) * (0.95 + 0.05 * Math.sin(time * 41 + i)));
      if (k === 0) core.material.color.setRGB(2.2, 2.2, 2.2).lerp(this.coreColor, 0.25);
      else core.material.color.copy(this.coreColor);
      core.material.opacity = pose.cloak > 0 || pose.landed ? 0 : (k === 0 ? 0.9 : 0.55) * (0.45 + thrust * 0.45 + this.turboMix * 0.5);
    });
    this.trails.forEach((trail, i) => {
      const glow = this.glows[i];
      if (glow) trail.push(glow.getWorldPosition(this.scratch), time, Math.min(0.55, pose.speed / 220) * (1 + this.turboMix * 0.6));
    });
    // Navigation lights blink; the tail strobe double-flashes.
    this.lights.forEach((light, i) => {
      const on = i < 2 ? 0.55 + 0.45 * Math.max(0, Math.sin(time * 3.2)) : (time % 1.4 < 0.06 || (time % 1.4 > 0.16 && time % 1.4 < 0.22) ? 1 : 0);
      light.material.opacity = pose.cloak > 0 ? 0 : on;
    });
    // A confirmed hit flashes the hull: the shooter sees the round land.
    if (pose.hitAt !== this.lastHit) { this.lastHit = pose.hitAt; if (pose.hitAt > 0) this.hitFlash = 1; }
    this.hitFlash = Math.max(0, this.hitFlash - dt * 7);
    const cloaked = pose.cloak > 0;
    this.body.children.forEach((child, i) => {
      if (!(child instanceof THREE.Mesh) || child.material === this.shieldMaterial) return;
      const original = this.materials[i];
      if (!original) return;
      child.material = cloaked ? this.cloakMaterial : original;
      original.emissiveIntensity = (original.userData.baseEmissive as number | undefined) ?? original.emissiveIntensity;
      if (original.userData.baseEmissive === undefined) original.userData.baseEmissive = original.emissiveIntensity;
      if (this.hitFlash > 0) { original.emissive.setRGB(1, 0.75, 0.5); original.emissiveIntensity = this.hitFlash * 1.4; }
      else if (original.userData.baseEmissive === 0) original.emissive.setRGB(0, 0, 0);
    });
    setUniform(this.cloakMaterial, 'time', time);
    setUniform(this.shieldMaterial, 'time', time);
    setUniform(this.shieldMaterial, 'strength', pose.shield > 0 ? 0.75 + 0.25 * Math.sin(time * 3) : 0);
    this.shield.visible = pose.shield > 0 && pose.cloak === 0;
    // Mining shows from far away: a pulsing column along the surface normal.
    this.beam.visible = pose.mining;
    if (pose.mining) {
      this.beam.position.copy(pose.position);
      this.beam.quaternion.setFromUnitVectors(UP, pose.normal);
      const beam = this.beam.material;
      if (beam instanceof THREE.ShaderMaterial) setUniform(beam, 'time', time);
    }
    // Matrices now, not at render: muzzle flashes and trails read them this same frame.
    this.group.updateMatrixWorld(true);
    this.exhaust(pose, dt);
    this.damage(pose, dt);
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
      for (const glow of this.glows) this.effects.ignite(glow.getWorldPosition(this.scratch), this.axis, this.nozzle);
    }
    this.emberClock -= dt;
    while (this.emberClock <= 0) {
      this.emberClock += 1 / 70;
      const glow = this.glows[Math.floor(Math.random() * this.glows.length)];
      if (glow) this.effects.ember(glow.getWorldPosition(this.scratch), this.axis, this.velocity);
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

  /** A random point on the hull's skin, biased fore (+) or aft (−) along the ship. */
  private hullPoint(out: THREE.Vector3, bias: number): THREE.Vector3 {
    out.set((Math.random() - 0.5) * this.size.x * 0.7, (Math.random() - 0.3) * this.size.y * 0.5,
      (Math.random() - 0.5) * 0.6 + bias * 0.4);
    return this.body.localToWorld(out);
  }

  /** Hides own exhaust for a camera that sits in it (the rear view). */
  setExhaustVisible(visible: boolean): void {
    for (const trail of this.trails) trail.mesh.visible = visible && trail.mesh.visible;
    for (const plume of this.plumes) plume.visible = visible && plume.visible;
    for (const glow of this.glows) glow.visible = visible;
    for (const core of this.cores) core.visible = visible;
  }

  /**
   * Frees everything this ship made for itself. Online, ships leave and re-enter view all
   * the time, so anything missed here piles up on the GPU. Model geometry and the plume
   * ribbon are shared and stay; textures belong to the asset set.
   */
  dispose(scene: THREE.Scene): void {
    scene.remove(this.group); scene.remove(this.beam);
    for (const trail of this.trails) {
      scene.remove(trail.mesh); trail.mesh.geometry.dispose();
      const material: unknown = trail.mesh.material;
      if (material instanceof THREE.Material) material.dispose();
    }
    for (const material of this.materials) material.dispose();
    for (const flame of this.flames) flame.dispose();
    for (const sprite of [...this.glows, ...this.cores, ...this.lights]) sprite.material.dispose();
    this.shieldMaterial.dispose(); this.cloakMaterial.dispose();
    this.beam.geometry.dispose();
    const beam: unknown = this.beam.material;
    if (beam instanceof THREE.Material) beam.dispose();
  }
}
