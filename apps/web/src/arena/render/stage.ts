import * as THREE from 'three';
import { mulberry32 } from '@astera/rules';
import { ARENA_TUNING as T, type ArenaLayout, type ArenaObstacle, type ArenaWorld, type BoxObstacle } from '@astera/rules/arena';
import { FARM_HEX } from '../farmColors.js';
import type { ArenaAssets, PreparedModel } from '../assets/load.js';
import { hullMaterial, setUniform, tickHull } from './materials.js';
import { proceduralRock } from './procedural.js';

/** Where an obstacle is drawn, so a landed ship can be set onto its true surface. */
export interface RockInstance { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }

interface BatchMember { id: number; matrix: THREE.Matrix4; x: number; y: number; z: number; radius: number; slot: number; tint: THREE.Color | null }
const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();
const bounds = new THREE.Sphere();
const eyePoint = new THREE.Vector3();
const glowColor = new THREE.Color();

/**
 * Every rock of one model in one draw. Each frame only the instances inside the camera's
 * view and reach are written to the front of the buffer, so a narrow portrait view pays
 * for the quarter of the field it actually sees.
 */
class RockBatch {
  readonly meshes: THREE.InstancedMesh[];
  constructor(model: PreparedModel, private readonly members: BatchMember[]) {
    this.meshes = model.parts.map(part => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, members.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (part.glow) { mesh.userData.glow = true; mesh.setColorAt(0, glowColor.set('#ffffff')); mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage); }
      else if (members.some(m => m.tint !== null)) {
        // Ore-veined rock: the whole rock leans to its farm's colour; plain rock stays white.
        mesh.userData.tinted = true; mesh.setColorAt(0, glowColor.set('#ffffff')); mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
      }
      mesh.frustumCulled = false; mesh.name = 'arena-rock'; mesh.count = 0;
      return mesh;
    });
  }
  cull(eye: THREE.Vector3, reach: number, world: ArenaWorld): void {
    let n = 0;
    for (const m of this.members) {
      const dx = m.x - eye.x; const dy = m.y - eye.y; const dz = m.z - eye.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) - m.radius > reach) continue;
      bounds.center.set(m.x, m.y, m.z); bounds.radius = m.radius;
      if (!frustum.intersectsSphere(bounds)) continue;
      for (const mesh of this.meshes) {
        mesh.setMatrixAt(n, m.matrix);
        if (mesh.userData.glow === true && m.slot >= 0) {
          // A crystal's glow follows its reserve: a dry one is dark and easy to tell apart.
          const reserve = (world.minerals[m.slot] ?? T.crystalReserve) / T.crystalReserve;
          const v = (0.2 + reserve * 0.8) * (world.dry[m.slot] ? 0.25 : 1);
          mesh.setColorAt(n, glowColor.setRGB(v, v, v));
        } else if (mesh.userData.tinted === true) {
          if (m.tint && m.slot >= 0 && !world.dry[m.slot]) mesh.setColorAt(n, m.tint); else mesh.setColorAt(n, glowColor.setRGB(1, 1, 1));
        }
      }
      n++;
    }
    for (const mesh of this.meshes) {
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}

export interface Stage {
  scene: THREE.Scene;
  rockInstances: Map<number, RockInstance>;
  sunDirection: THREE.Vector3;
  /** How deep the camera sits in a belt's haze, and its colour (for the post veil). */
  haze: { color: THREE.Color; amount: number };
  update(time: number, world: ArenaWorld, eye: THREE.Vector3): void;
  /** Keeps only the rock this camera can see within `reach` metres. Call before each render. */
  cull(camera: THREE.Camera, reach: number, world: ArenaWorld): void;
  dispose(): void;
}

// The sky's brightest light is the black hole's accretion glow on the +Z face.
const SUN = new THREE.Vector3(0.12, 0.32, 1).normalize();
const RED_STAR = new THREE.Vector3(1, 0.18, -0.25).normalize();

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const hash = (id: number, salt: number): number => {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

function instanced(model: PreparedModel, count: number): THREE.InstancedMesh[] {
  return model.parts.map(part => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, count);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    if (part.glow) mesh.userData.glow = true;
    return mesh;
  });
}

function placeModel(model: PreparedModel, scale: number): THREE.Group {
  const group = new THREE.Group();
  for (const part of model.parts) group.add(new THREE.Mesh(part.geometry, part.material));
  group.scale.setScalar(scale);
  return group;
}

function boxMesh(o: BoxObstacle, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2, o.hy * 2, o.hz * 2), material);
  mesh.position.set(o.p.x, o.p.y, o.p.z);
  // Local +X is (ux, 0, uz): a turn of atan2(-uz, ux) about +Y.
  mesh.rotation.y = Math.atan2(-o.uz, o.ux);
  return mesh;
}

/** A tall soft column of light that marks a place from across the arena. */
function beacon(texture: THREE.Texture | undefined, color: string, height: number, width: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
  geometry.translate(0, height / 2, 0);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 }, map: { value: texture ?? null }, strength: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying float vNear; void main(){ vUv = uv;
      vec4 mv = modelViewMatrix * vec4(0.0, position.y, 0.0, 1.0); mv.x += position.x;
      vNear = smoothstep(60.0, 220.0, length((modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz));
      gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float time; uniform float strength; varying vec2 vUv; varying float vNear;
      void main(){ float edge = pow(clamp(1.0 - abs(vUv.x * 2.0 - 1.0), 0.0, 1.0), 2.4);
        float fade = smoothstep(0.0, 0.06, vUv.y) * pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.6);
        float pulse = 0.75 + 0.25 * sin(time * 2.0 - vUv.y * 9.0);
        gl_FragColor = vec4(color * edge * fade * pulse * strength * (0.25 + 0.75 * vNear), 1.0); }`,
  });
  return new THREE.Mesh(geometry, material);
}

export function buildStage(assets: ArenaAssets, layout: ArenaLayout, renderer: THREE.WebGLRenderer): Stage {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const hulls: THREE.Material[] = [];
  const random = mulberry32(7331);

  // Sky and image-based light. The background is the 2048² cube; lighting uses a small one.
  if (assets.sky) {
    scene.background = assets.sky; scene.backgroundIntensity = 0.95; scene.backgroundBlurriness = 0;
  } else scene.background = new THREE.Color('#03070d');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSource = assets.env ?? assets.sky;
  if (envSource) {
    const env = pmrem.fromCubemap(envSource).texture;
    scene.environment = env; scene.environmentIntensity = 0.75; disposables.push(env);
  }
  pmrem.dispose();
  scene.fog = new THREE.FogExp2('#06111c', 0.00009);

  const sun = new THREE.DirectionalLight('#e2ecff', 2.7);
  sun.position.copy(SUN).multiplyScalar(4000);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#ffb08a', 0.75);
  rim.position.copy(RED_STAR).multiplyScalar(4000);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight('#7fa6d6', '#4a4038', 0.85));

  // The sky's light source gets a soft halo far out; the bloom does the rest.
  const flare = assets.fx.get('flare');
  if (flare) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: flare, color: '#cfeaff', transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    halo.position.copy(SUN).multiplyScalar(18000); halo.scale.setScalar(5200); scene.add(halo);
  }

  // --- Rock and crystal: one instanced draw per model part, culled per instance on the CPU.
  const rockInstances = new Map<number, RockInstance>();
  const allRocks = assets.rocks.length > 0 ? assets.rocks : [proceduralRock(0), proceduralRock(1), proceduralRock(2)];
  const triangles = (model: PreparedModel): number => model.parts.reduce((sum, part) =>
    sum + (part.geometry.index ? part.geometry.index.count : part.geometry.getAttribute('position').count) / 3, 0);
  // Small rocks are many and far: they get the light meshes; detail goes to big rock.
  const lightRocks = allRocks.filter(model => triangles(model) <= 900);
  const rockModels = lightRocks.length > 0 ? lightRocks : allRocks;
  const heavyRocks = allRocks.filter(model => triangles(model) > 900);
  const giantModels = assets.giants.length > 0 ? assets.giants : rockModels;
  const crystalModels = assets.crystals.length > 0 ? assets.crystals : [proceduralRock(3, true)];
  const groups = new Map<PreparedModel, ArenaObstacle[]>();
  const crystalSlots = new Map<number, number>();
  layout.deposits.forEach((index, slot) => crystalSlots.set(index, slot));
  for (const o of layout.obstacles) {
    if (o.shape !== 'sphere' || o.kind === 'structure') continue;
    const list = o.kind === 'crystal' ? crystalModels : o.radius > 100 ? giantModels
      : o.radius > 34 && heavyRocks.length > 0 ? heavyRocks : rockModels;
    const model = list[Math.floor(hash(o.id, 1) * list.length)] ?? list[0];
    if (!model) continue;
    const members = groups.get(model) ?? [];
    members.push(o); groups.set(model, members);
  }
  const veinTint = (o: ArenaObstacle): THREE.Color | null => {
    const slot = crystalSlots.get(o.id);
    if (slot === undefined || o.kind === 'crystal') return null;
    return new THREE.Color('#ffffff').lerp(new THREE.Color(FARM_HEX[layout.depositKinds[slot] ?? 0] ?? FARM_HEX[0]), 0.55);
  };
  const pose = new THREE.Object3D();
  const batches: RockBatch[] = [];
  for (const [model, obstacles] of groups) {
    const members = obstacles.map(o => {
      pose.position.set(o.p.x, o.p.y, o.p.z);
      pose.rotation.set(hash(o.id, 2) * 6.283, hash(o.id, 3) * 6.283, hash(o.id, 4) * 6.283);
      // Mean surface on the round collider: dents and bumps average out.
      const scale = o.radius / Math.max(0.2, model.mean) * 1.02;
      pose.scale.setScalar(scale); pose.updateMatrix();
      const member = { id: o.id, matrix: pose.matrix.clone(), x: o.p.x, y: o.p.y, z: o.p.z,
        radius: model.radius * scale, slot: crystalSlots.get(o.id) ?? -1, tint: veinTint(o) };
      const first = model.parts[0];
      if (first) rockInstances.set(o.id, { geometry: first.geometry, matrix: member.matrix });
      return member;
    });
    const batch = new RockBatch(model, members);
    for (const mesh of batch.meshes) scene.add(mesh);
    batches.push(batch);
  }

  // Deposit halos in their farm's colour: what a miner is looking for from far away.
  // Veined rock gets a tighter halo than a crystal so the rock still reads as rock.
  const halo = assets.fx.get('glowDot') ?? assets.fx.get('flare');
  const crystalHalos: THREE.Sprite[] = [];
  layout.deposits.forEach((index, slot) => {
    const o = layout.obstacles[index];
    if (!o) return;
    const kind = layout.depositKinds[slot] ?? 1;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo ?? null, color: FARM_HEX[kind] ?? FARM_HEX[1], transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5, toneMapped: false }));
    sprite.position.set(o.p.x, o.p.y, o.p.z); sprite.scale.setScalar(o.radius * (o.kind === 'crystal' ? 5.5 : 3.4));
    scene.add(sprite); crystalHalos.push(sprite);
  });

  // --- Structures: the colliders are the hull; models dress them.
  const detailKey = Array.from(assets.textures.keys()).find(key => key.endsWith('/tex/mining-d.webp'));
  const detail = detailKey ? assets.textures.get(detailKey) : undefined;
  const wall = hullMaterial({ detail: detail ?? null, color: '#5f6b78', strip: '#2ee6c8' });
  const deckMaterial = hullMaterial({ detail: detail ?? null, color: '#66727e', strip: '#2ee6c8', deck: true });
  const warm = hullMaterial({ detail: detail ?? null, color: '#5c5852', strip: '#ffb15c' });
  hulls.push(wall, deckMaterial, warm);
  const beacons: THREE.Mesh[] = [];
  const portals: THREE.Sprite[] = [];
  // The portal energy is an 8×8 flip-book: one frame shown at a time, shared by every gate.
  const portalEnergy = assets.fx.get('portalEnergy')?.clone();
  if (portalEnergy) { portalEnergy.repeat.set(1 / 8, 1 / 8); portalEnergy.needsUpdate = true; }
  for (const s of layout.structures) {
    const yaw = Math.atan2(-s.uz, s.ux);
    for (const index of s.colliders) {
      const o = layout.obstacles[index];
      if (o?.shape !== 'box') continue;
      if (s.kind === 'wreck' && assets.wrecks.length > 0) continue;
      scene.add(boxMesh(o, s.decks.includes(index) ? deckMaterial : s.kind === 'outpost' ? warm : wall));
    }
    if (s.kind === 'hub' && assets.hub) {
      const model = placeModel(assets.hub, 170);
      model.position.set(s.p.x, s.p.y + 70, s.p.z); scene.add(model);
    }
    if (s.kind === 'gate') {
      const deck = layout.obstacles[s.decks[0] ?? -1];
      const top = deck?.shape === 'box' ? deck.p.y + deck.hy : s.p.y;
      if (assets.gate) {
        const model = placeModel(assets.gate, 70);
        model.position.set(s.p.x, top + 62, s.p.z); model.rotation.y = yaw; scene.add(model);
      }
      const energy = new THREE.Sprite(new THREE.SpriteMaterial({ map: portalEnergy ?? halo ?? null, color: '#57ffe0',
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85, toneMapped: false }));
      energy.position.set(s.p.x, top + 62, s.p.z); energy.scale.setScalar(96);
      scene.add(energy); portals.push(energy);
      const column = beacon(undefined, '#2ee6c8', 900, 46);
      column.position.set(s.p.x, top, s.p.z); scene.add(column); beacons.push(column);
    }
    if (s.kind === 'outpost') {
      const dressing = assets.outposts[s.id % Math.max(1, assets.outposts.length)];
      if (dressing) {
        const model = placeModel(dressing, 95);
        const back = new THREE.Vector3(-s.uz, 0, s.ux).multiplyScalar(130);
        model.position.set(s.p.x + back.x, s.p.y + 40, s.p.z + back.z); model.rotation.y = yaw; scene.add(model);
      }
      if (assets.generator) {
        const model = placeModel(assets.generator, 18);
        model.position.set(s.p.x + s.ux * 40, s.p.y + 60 + 18, s.p.z + s.uz * 40); scene.add(model);
      }
      const column = beacon(undefined, '#ffb15c', 420, 30);
      column.position.set(s.p.x, s.p.y + 60, s.p.z); scene.add(column); beacons.push(column);
    }
    if (s.kind === 'wreck') {
      const [bowModel, sternModel] = [assets.wrecks[0], assets.wrecks[1] ?? assets.wrecks[0]];
      const parts: [PreparedModel | undefined, number][] = [[bowModel, s.colliders[0] ?? -1], [sternModel, s.colliders[1] ?? -1]];
      for (const [model, index] of parts) {
        const o = layout.obstacles[index];
        if (!model || o?.shape !== 'box') continue;
        const group = placeModel(model, o.hx * 2.15);
        group.position.set(o.p.x, o.p.y, o.p.z); group.rotation.y = yaw + Math.PI / 2; scene.add(group);
      }
    }
    if (s.kind === 'relay' && assets.relay) {
      const o = layout.obstacles[s.colliders[0] ?? -1];
      const model = placeModel(assets.relay, (o?.radius ?? 16) * 1.6);
      model.position.set(s.p.x, s.p.y, s.p.z); model.rotation.y = hash(s.id, 9) * 6.28; scene.add(model);
    }
  }

  // --- Dense belts carry their own haze. From outside it reads as coloured cloud; each
  // cloud fades out before the camera enters it, because a sprite wrapped around the lens
  // is a full screen of blended fill for nothing. Inside, the post veil and the scene fog
  // take over (one pass, no overdraw).
  const nebula = [assets.fx.get('nebulaBlue'), assets.fx.get('nebulaPink')];
  const palettes = [['#3d78c9', '#5a6fe0'], ['#8a5ac9', '#4f6ad8'], ['#3a8fc4', '#7a5cd0']] as const;
  const hazes: { sprite: THREE.Sprite; base: number; reach: number }[] = [];
  const belts: { field: (typeof layout.fields)[number]; tint: THREE.Color }[] = [];
  let beltIndex = 0;
  for (const field of layout.fields) {
    if (!field.dense) continue;
    const palette = palettes[beltIndex++ % palettes.length] ?? palettes[0];
    belts.push({ field, tint: new THREE.Color(palette[0]).lerp(new THREE.Color(palette[1]), 0.4) });
    for (let i = 0; i < 6; i++) {
      const map = nebula[i % 2];
      const base = 0.2 + random() * 0.06;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: map ?? null, color: palette[i % 2],
        transparent: true, opacity: base, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sprite.position.set(field.p.x + (random() * 2 - 1) * field.radius * 0.85, field.p.y + (random() * 2 - 1) * field.height * 0.7,
        field.p.z + (random() * 2 - 1) * field.radius * 0.85);
      const size = field.radius * (1.5 + random() * 1.0);
      sprite.scale.setScalar(size);
      sprite.material.rotation = random() * 6.28;
      scene.add(sprite); hazes.push({ sprite, base, reach: size / 2 });
    }
  }
  const haze = { color: new THREE.Color('#2a4f86'), amount: 0 };
  const clearFog = new THREE.Color('#06111c');
  const fogTint = new THREE.Color();
  // Inside a belt: one nebula shell around the lens stands in for the clouds that faded
  // out. A single layer of fill, and rock nearer than its radius stays crisp in front of it.
  const shellMap = nebula[0]?.clone();
  if (shellMap) { shellMap.wrapS = THREE.MirroredRepeatWrapping; shellMap.wrapT = THREE.MirroredRepeatWrapping; shellMap.needsUpdate = true; }
  const shellMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
    uniforms: { map: { value: shellMap ?? null }, color: { value: new THREE.Color('#3d78c9') }, strength: { value: 0 }, drift: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vDir; void main(){ vUv = uv; vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float strength; uniform float drift; varying vec2 vUv; varying vec3 vDir;
      void main(){ vec2 uv = vUv * vec2(3.0, 1.6) + vec2(drift, 0.0);
        float a = texture2D(map, uv).r; float b = texture2D(map, uv * 1.7 + vec2(0.31, 0.57)).r;
        float cloud = clamp(a * 0.65 + b * 0.5, 0.0, 1.0);
        float band = 0.55 + 0.45 * (1.0 - abs(vDir.y));
        gl_FragColor = vec4(color * (0.25 + cloud * 1.1) * band * strength, 1.0); }`,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), shellMaterial);
  shell.frustumCulled = false; shell.renderOrder = 4; shell.visible = false;
  scene.add(shell);

  // --- Far parallax: big dark rock beyond the boundary gives the void a scale.
  const far = rockModels[0];
  if (far) {
    const ringMeshes = instanced(far, 90);
    for (let i = 0; i < 90; i++) {
      const angle = random() * Math.PI * 2; const distance = 4200 + random() * 5200;
      pose.position.set(Math.cos(angle) * distance, (random() * 2 - 1) * 1600, Math.sin(angle) * distance);
      pose.rotation.set(random() * 6, random() * 6, random() * 6); pose.scale.setScalar(80 + random() * 380); pose.updateMatrix();
      for (const mesh of ringMeshes) mesh.setMatrixAt(i, pose.matrix);
    }
    for (const mesh of ringMeshes) { mesh.computeBoundingSphere(); scene.add(mesh); }
  }

  // --- The boundary: a faint grid that only shows when you are close to it.
  const boundary = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { eye: { value: new THREE.Vector3() }, color: { value: new THREE.Color('#2ee6c8') } },
    vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 eye; uniform vec3 color; varying vec3 vP;
      void main(){ float d = distance(vP, eye); float near = 1.0 - smoothstep(60.0, ${String(T.boundaryWarn + 160)}.0, d);
        vec2 g = abs(fract(vec2(atan(vP.z, vP.x) * ${layout.radius.toFixed(1)}, vP.y) / 40.0) - 0.5);
        float line = 1.0 - smoothstep(0.0, 0.06, min(g.x, g.y));
        gl_FragColor = vec4(color * (line * 0.9 + 0.08) * near, 1.0); }`,
  });
  const wallMesh = new THREE.Mesh(new THREE.CylinderGeometry(layout.radius, layout.radius, layout.halfHeight * 2, 128, 1, true), boundary);
  scene.add(wallMesh);

  return {
    scene, rockInstances, sunDirection: SUN.clone(), haze,
    update(time, world, eye) {
      for (const material of hulls) tickHull(material, time);
      setUniform(boundary, 'eye', eye);
      for (const column of beacons) {
        const material = column.material;
        if (material instanceof THREE.ShaderMaterial) setUniform(material, 'time', time);
      }
      if (portalEnergy) {
        const frame = Math.floor(time * 18) % 64;
        portalEnergy.offset.set((frame % 8) / 8, 1 - (Math.floor(frame / 8) + 1) / 8);
      }
      portals.forEach((sprite, i) => {
        // Fade the energy out as the camera flies through it, so the deck stays readable.
        const near = Math.min(1, Math.max(0, (sprite.position.distanceTo(eye) - 50) / 120));
        sprite.material.opacity = (0.75 + 0.15 * Math.sin(time * 1.7 + i)) * near;
      });
      for (const { sprite, base, reach } of hazes) {
        sprite.material.rotation += 0.00025;
        const near = smooth(reach * 0.55, reach * 1.1, sprite.position.distanceTo(eye));
        sprite.material.opacity = base * near;
        sprite.visible = near > 0.01;
      }
      crystalHalos.forEach((sprite, slot) => {
        const reserve = (world.minerals[slot] ?? T.crystalReserve) / T.crystalReserve;
        const near = smooth(sprite.scale.x * 0.12, sprite.scale.x * 0.4, sprite.position.distanceTo(eye));
        sprite.material.opacity = (world.dry[slot] ? 0.05 : 0.18 + reserve * 0.42 + 0.06 * Math.sin(time * 2 + slot)) * near;
      });
      // Inside a dense belt (and a little before its edge) the haze thickens; in the open, space is clear.
      let inside = 0;
      for (const { field, tint } of belts) {
        const dx = (eye.x - field.p.x) / (field.radius * 1.2); const dy = (eye.y - field.p.y) / (field.height * 1.3);
        const dz = (eye.z - field.p.z) / (field.radius * 1.2);
        const depth = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
        if (depth > inside) { inside = depth; haze.color.copy(tint); }
      }
      const thick = Math.min(1, inside * 1.8);
      haze.amount = thick * 0.06;
      scene.backgroundIntensity = 0.95 - thick * 0.25;
      shell.visible = thick > 0.01;
      if (shell.visible) {
        shell.position.copy(eye);
        setUniform(shellMaterial, 'strength', thick * 0.34); setUniform(shellMaterial, 'drift', time * 0.004);
        setUniform(shellMaterial, 'color', haze.color);
      }
      // Fogged rock fades towards the dark of space: a bright fog colour turned distant
      // rock into flat pale cut-outs against the darker sky.
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = 0.00009 + thick * 0.0013;
        scene.fog.color.copy(clearFog).lerp(fogTint.copy(haze.color).multiplyScalar(0.08), thick);
      }
    },
    cull(camera, reach, world) {
      // Rock past the point where the fog is ~99 % opaque cannot be seen: do not draw it.
      if (scene.fog instanceof THREE.FogExp2) reach = Math.min(reach, 2.15 / scene.fog.density);
      camera.updateMatrixWorld();
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      const eye = camera.getWorldPosition(eyePoint);
      for (const batch of batches) batch.cull(eye, reach, world);
    },
    dispose() {
      const released = new Set<unknown>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          const geometry: unknown = object.geometry;
          if (geometry instanceof THREE.BufferGeometry && !released.has(geometry)) { released.add(geometry); geometry.dispose(); }
          const materials: unknown[] = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) if (material instanceof THREE.Material && !released.has(material)) { released.add(material); material.dispose(); }
        }
      });
      for (const item of disposables) item.dispose();
    },
  };
}
