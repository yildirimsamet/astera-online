/**
 * AWARDS DRAWN IN CODE: the season coin, the year pin, the emblem medals and the research
 * orrery. They stand in for models nobody has made yet and are cheap enough to keep: a few
 * hundred triangles, one 256 px canvas each, relief by bump map rather than geometry.
 */
import * as THREE from 'three';
import type { LegacyEmblem, LegacyFinish } from './presentation.js';
import { FINISH, RIM_GLSL } from './finish.js';

type Owned = Set<THREE.Material | THREE.BufferGeometry | THREE.Texture>;
const own = <T extends THREE.Material | THREE.BufferGeometry | THREE.Texture>(owned: Owned, item: T): T => { owned.add(item); return item; };

function metal(finish: LegacyFinish, owned: Owned, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const material = own(owned, new THREE.MeshStandardMaterial({ color: FINISH[finish].metal, metalness: 1, roughness: 0.32, ...extra }));
  const { glow, glowStrength } = FINISH[finish];
  if (glowStrength > 0) {
    const legacyGlow = { value: new THREE.Color(glow).multiplyScalar(glowStrength) };
    material.onBeforeCompile = shader => {
      shader.uniforms.legacyGlow = legacyGlow;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 legacyGlow;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${RIM_GLSL}`);
    };
    material.customProgramCacheKey = () => `legacy-rim-${finish}`;
  }
  return material;
}

/** A 256 px relief: light strokes on a mid-grey field, read as both colour and bump. */
function relief(owned: Owned, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  const field = ctx.createRadialGradient(128, 110, 10, 128, 128, 140);
  field.addColorStop(0, '#263747');
  field.addColorStop(1, '#101925');
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#f2f2f2';
  ctx.fillStyle = '#f2f2f2';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, 256);
  const texture = own(owned, new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function ring(ctx: CanvasRenderingContext2D, radius: number, width: number): void {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(128, 128, radius, 0, Math.PI * 2);
  ctx.stroke();
}

const EMBLEMS: Record<LegacyEmblem, (ctx: CanvasRenderingContext2D) => void> = {
  pirate: ctx => {
    // Two crossed sabres under a star: the fleets that hunt the hunters.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(128, 140);
      ctx.rotate(side * Math.PI / 4);
      ctx.fillRect(-7, -78, 14, 118);
      ctx.beginPath(); ctx.moveTo(-7, -78); ctx.lineTo(0, -98); ctx.lineTo(7, -78); ctx.fill();
      ctx.fillRect(-24, 38, 48, 10);
      ctx.fillRect(-6, 48, 12, 26);
      ctx.restore();
    }
    star(ctx, 128, 70, 22, 9);
  },
  missile: ctx => {
    ctx.beginPath(); ctx.moveTo(128, 34); ctx.lineTo(146, 70); ctx.lineTo(140, 170); ctx.lineTo(116, 170); ctx.lineTo(110, 70); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(116, 150); ctx.lineTo(92, 196); ctx.lineTo(116, 182); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(140, 150); ctx.lineTo(164, 196); ctx.lineTo(140, 182); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(128, 128, 84, -Math.PI * 0.15, Math.PI * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.arc(128, 128, 84, Math.PI * 0.85, Math.PI * 1.15); ctx.stroke();
  },
  clan: ctx => {
    ctx.lineWidth = 20;
    for (const y of [116, 160]) { ctx.beginPath(); ctx.moveTo(72, y + 26); ctx.lineTo(128, y - 22); ctx.lineTo(184, y + 26); ctx.stroke(); }
    star(ctx, 128, 64, 18, 7);
  },
  heart: ctx => {
    ctx.beginPath();
    ctx.moveTo(128, 196);
    ctx.bezierCurveTo(40, 136, 56, 52, 128, 92);
    ctx.bezierCurveTo(200, 52, 216, 136, 128, 196);
    ctx.fill();
  },
  bolt: ctx => {
    ctx.beginPath();
    ctx.moveTo(146, 30); ctx.lineTo(86, 138); ctx.lineTo(126, 138); ctx.lineTo(104, 226); ctx.lineTo(176, 108); ctx.lineTo(134, 108); ctx.lineTo(160, 30);
    ctx.closePath(); ctx.fill();
  },
  gem: ctx => {
    ctx.beginPath(); ctx.moveTo(84, 92); ctx.lineTo(172, 92); ctx.lineTo(200, 120); ctx.lineTo(128, 208); ctx.lineTo(56, 120); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a7a7a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(56, 120); ctx.lineTo(200, 120); ctx.moveTo(104, 92); ctx.lineTo(96, 120); ctx.lineTo(128, 208); ctx.lineTo(160, 120); ctx.lineTo(152, 92); ctx.stroke();
  },
};

/** A struck face: relief as colour and as bump, so light rakes across it. */
function faceMaterial(finish: LegacyFinish, owned: Owned, texture: THREE.CanvasTexture | null): THREE.MeshStandardMaterial {
  return metal(finish, owned, texture ? { color: '#edf4ff', map: texture, bumpMap: texture, bumpScale: 0.004,
    metalness: 0.35, roughness: 0.36, emissive: '#51687c', emissiveMap: texture, emissiveIntensity: 0.14 } : {});
}

/** A thick disc facing +Z with a raised rim. */
function disc(finish: LegacyFinish, owned: Owned, radius: number, depth: number, face: THREE.CanvasTexture | null): THREE.Group {
  const group = new THREE.Group();
  const body = own(owned, new THREE.CylinderGeometry(radius, radius, depth, 64, 1));
  body.rotateX(Math.PI / 2);
  // Cylinder cap UVs run 90 degrees around their face. Author both faces in upright XY.
  const positions = body.getAttribute('position'), normals = body.getAttribute('normal'), uv = body.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    const side = normals.getZ(i);
    if (Math.abs(side) < 0.9) continue;
    uv.setXY(i, 0.5 + Math.sign(side) * positions.getX(i) / (2 * radius), 0.5 + positions.getY(i) / (2 * radius));
  }
  const edge = metal(finish, owned, { roughness: 0.38 });
  const front = faceMaterial(finish, owned, face);
  // Cylinder groups: 0 side, 1 top (+Y → +Z after the turn), 2 bottom.
  group.add(new THREE.Mesh(body, [edge, front, front]));
  const rim = own(owned, new THREE.TorusGeometry(radius * 0.97, depth * 0.32, 12, 72));
  for (const z of [depth / 2, -depth / 2]) {
    const mesh = new THREE.Mesh(rim, edge);
    mesh.position.z = z;
    group.add(mesh);
  }
  return group;
}

function label(ctx: CanvasRenderingContext2D, text: string, y: number, size: number): void {
  ctx.font = `700 ${String(size)}px "Archivo Variable", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, y);
}

/** The season coin: a ring of stars, a central star and the season it remembers. */
export function buildCoin(finish: LegacyFinish, edition: string | null, owned: Owned): THREE.Group {
  const texture = relief(owned, ctx => {
    ring(ctx, 112, 6);
    ring(ctx, 92, 3);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      star(ctx, 128 + Math.cos(a) * 102, 128 + Math.sin(a) * 102, 6, 2.5);
    }
    star(ctx, 128, edition ? 104 : 128, 34, 14, 4);
    if (edition) label(ctx, edition, 168, 44);
  });
  const coin = disc(finish, owned, 0.5, 0.09, texture);
  coin.rotation.y = 0;
  return coin;
}

/** A minted service-year badge: layered metal, enamel, raised star/orbit and cast laurel. */
export function buildPin(finish: LegacyFinish, edition: string | null, owned: Owned): THREE.Group {
  const pin = new THREE.Group();
  const steel = metal(finish, owned, { roughness: 0.27 });
  const trim = own(owned, new THREE.MeshStandardMaterial({ color: '#c6b47e', metalness: 1, roughness: 0.3 }));
  const body = disc(finish, owned, 0.43, 0.095, null);
  pin.add(body);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  let map: THREE.CanvasTexture | undefined;
  if (ctx) {
    ctx.scale(2, 2);
    const field = ctx.createRadialGradient(114, 90, 10, 128, 128, 126);
    field.addColorStop(0, '#233647'); field.addColorStop(1, '#080f19');
    ctx.fillStyle = field; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#8b9ba8'; ctx.lineWidth = 1.2;
    ring(ctx, 111, 1.2); ring(ctx, 105, 0.5);
    ctx.fillStyle = '#d6e2ed';
    label(ctx, 'ASTERA', 151, 15);
    ctx.fillStyle = '#f3e2ad';
    if (edition && /^\d{4}$/.test(edition)) label(ctx, edition, 190, 45);
    map = own(owned, new THREE.CanvasTexture(canvas));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }
  const enamel = own(owned, new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : '#142536',
    ...(map ? { map } : {}), metalness: 0.28, roughness: 0.3 }));
  const face = new THREE.Mesh(own(owned, new THREE.CircleGeometry(0.395, 80)), enamel);
  face.name = 'year-enamel'; face.position.z = 0.055; pin.add(face);
  for (const radius of [0.40, 0.445]) {
    const rim = new THREE.Mesh(own(owned, new THREE.TorusGeometry(radius, 0.012, 8, 80)), radius < 0.42 ? trim : steel);
    rim.position.z = 0.053; pin.add(rim);
  }
  // True raised metal catches the same light as the sculpted awards beside it.
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 === 0 ? 0.13 : 0.056;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starMesh = new THREE.Mesh(own(owned, new THREE.ExtrudeGeometry(starShape, {
    depth: 0.024, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.008, bevelThickness: 0.008,
  })), trim);
  starMesh.name = 'year-emblem'; starMesh.position.set(0, 0.14, 0.068); pin.add(starMesh);
  const orbit = new THREE.Mesh(own(owned, new THREE.TorusGeometry(0.16, 0.009, 8, 64)), steel);
  orbit.position.set(0, 0.14, 0.078); orbit.scale.y = 0.55; orbit.rotation.z = 0.35; pin.add(orbit);
  const laurel = new THREE.Group(); laurel.name = 'year-laurel';
  const leaf = new THREE.Shape(); leaf.moveTo(0, -0.06);
  leaf.quadraticCurveTo(0.052, 0, 0, 0.065); leaf.quadraticCurveTo(-0.035, 0, 0, -0.06);
  const leafGeometry = own(owned, new THREE.ExtrudeGeometry(leaf, {
    depth: 0.018, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 4,
  }));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const angle = -1.18 + i * 0.26;
      const mesh = new THREE.Mesh(leafGeometry, steel);
      mesh.position.set(side * Math.cos(angle) * 0.49, Math.sin(angle) * 0.49, 0.01);
      mesh.rotation.z = side * (-0.6 + i * 0.21); mesh.rotation.y = side * 0.18;
      laurel.add(mesh);
    }
  }
  pin.add(laurel);
  const bead = own(owned, new THREE.SphereGeometry(0.009, 8, 5));
  for (let i = 0; i < 28; i++) {
    const angle = i * Math.PI * 2 / 28;
    const rivet = new THREE.Mesh(bead, trim);
    rivet.position.set(Math.cos(angle) * 0.423, Math.sin(angle) * 0.423, 0.06); pin.add(rivet);
  }
  return pin;
}

/** A medal: the struck emblem disc hanging from a ribbon in Astera's navy and teal. */
export function buildMedal(finish: LegacyFinish, emblem: LegacyEmblem, owned: Owned): THREE.Group {
  const texture = relief(owned, ctx => { ring(ctx, 114, 7); if (emblem !== 'heart') EMBLEMS[emblem](ctx); });
  const medal = new THREE.Group();
  const face = disc(finish, owned, 0.34, 0.06, texture);
  face.position.y = 0.34;
  medal.add(face);
  if (emblem === 'heart') {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.17);
    shape.bezierCurveTo(-0.26, -0.01, -0.22, 0.22, 0, 0.10);
    shape.bezierCurveTo(0.22, 0.22, 0.26, -0.01, 0, -0.17);
    const geometry = own(owned, new THREE.ExtrudeGeometry(shape, { depth: 0.028, bevelEnabled: true,
      bevelSize: 0.015, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 20 }));
    const enamel = own(owned, new THREE.MeshStandardMaterial({ color: '#38bfd0', metalness: 0.35,
      roughness: 0.24, emissive: '#0b4658', emissiveIntensity: 0.15 }));
    const heart = new THREE.Mesh(geometry, enamel);
    heart.name = 'supporter-heart'; heart.position.set(0, 0.35, 0.04); medal.add(heart);
  }
  const loop = own(owned, new THREE.TorusGeometry(0.05, 0.016, 8, 24));
  const loopMesh = new THREE.Mesh(loop, metal(finish, owned));
  loopMesh.position.y = 0.7;
  medal.add(loopMesh);
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 8;
  const ctx = canvas.getContext('2d');
  let cloth: THREE.Material;
  if (ctx) {
    const stripes = ['#13203d', '#13203d', '#2ab9a5', '#e9c46a', '#2ab9a5', '#13203d', '#13203d'];
    stripes.forEach((colour, i) => { ctx.fillStyle = colour; ctx.fillRect((i * 64) / stripes.length, 0, 64 / stripes.length + 1, 8); });
    const texture = own(owned, new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    cloth = own(owned, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.62, metalness: 0.05 }));
  } else {
    cloth = own(owned, new THREE.MeshStandardMaterial({ color: '#13203d', roughness: 0.62 }));
  }
  // The ribbon: a slight V of two folds meeting at the loop. The folds overlap in the middle,
  // so one lies a hair behind the other — at one depth they fought for the same pixels and
  // the stripes flickered as the medal turned.
  const ribbon = own(owned, new THREE.BoxGeometry(0.3, 0.42, 0.02));
  for (const side of [-1, 1]) {
    const fold = new THREE.Mesh(ribbon, cloth);
    fold.position.set(side * 0.075, 0.92, side < 0 ? -0.012 : -0.036);
    fold.rotation.z = side * 0.16;
    medal.add(fold);
  }
  const bar = own(owned, new THREE.BoxGeometry(0.46, 0.05, 0.05));
  const barMesh = new THREE.Mesh(bar, metal(finish, owned));
  barMesh.position.y = 1.13;
  medal.add(barMesh);
  medal.rotation.y = 0;
  return medal;
}

/** The research orrery: a lit core inside three tilted rings, on a turned pedestal. */
export function buildOrrery(finish: LegacyFinish, owned: Owned): THREE.Group {
  const orrery = new THREE.Group();
  const brass = metal(finish, owned);
  const pedestal = own(owned, new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.3, 0.05), new THREE.Vector2(0.2, 0.09),
    new THREE.Vector2(0.06, 0.14), new THREE.Vector2(0.045, 0.42), new THREE.Vector2(0, 0.42),
  ], 48));
  orrery.add(new THREE.Mesh(pedestal, brass));
  const core = own(owned, new THREE.SphereGeometry(0.11, 32, 16));
  const glow = own(owned, new THREE.MeshStandardMaterial({ color: '#bff7ee', emissive: '#46e8d2', emissiveIntensity: 1.4, roughness: 0.2 }));
  const coreMesh = new THREE.Mesh(core, glow);
  coreMesh.position.y = 0.72;
  orrery.add(coreMesh);
  const ringGeometry = own(owned, new THREE.TorusGeometry(0.3, 0.012, 8, 96));
  const moon = own(owned, new THREE.SphereGeometry(0.035, 16, 8));
  [[0.4, 0], [-0.5, 0.9], [1.2, 2.1]].forEach(([tilt, spin], i) => {
    const holder = new THREE.Group();
    holder.position.y = 0.72;
    holder.rotation.set(Math.PI / 2 + (tilt ?? 0), spin ?? 0, 0);
    holder.add(new THREE.Mesh(ringGeometry, brass));
    const satellite = new THREE.Mesh(moon, brass);
    satellite.position.x = 0.3 * Math.cos(i * 2.1);
    satellite.position.y = 0.3 * Math.sin(i * 2.1);
    holder.add(satellite);
    orrery.add(holder);
  });
  return orrery;
}

/**
 * A world as a trophy: a turned pedestal, a cradle ring in the tier's metal tilted around the
 * globe, and a thin meridian arc that holds it — so a planet reads as an award, not a ball.
 * The globe itself is placed by the caller into `socket` (centre at the socket's origin).
 */
export function buildGlobeStand(finish: LegacyFinish, owned: Owned): { stand: THREE.Group; socket: THREE.Group } {
  const stand = new THREE.Group();
  const brass = metal(finish, owned);
  const dark = own(owned, new THREE.MeshStandardMaterial({ color: '#0b0e14', metalness: 0.35, roughness: 0.25 }));
  const base = own(owned, new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.28, 0), new THREE.Vector2(0.28, 0.06), new THREE.Vector2(0.22, 0.09),
    new THREE.Vector2(0.07, 0.13), new THREE.Vector2(0.05, 0.2), new THREE.Vector2(0, 0.2),
  ], 48));
  stand.add(new THREE.Mesh(base, dark));
  const trim = own(owned, new THREE.TorusGeometry(0.25, 0.012, 8, 64));
  const trimMesh = new THREE.Mesh(trim, brass);
  trimMesh.rotation.x = Math.PI / 2;
  trimMesh.position.y = 0.075;
  stand.add(trimMesh);
  const socket = new THREE.Group();
  socket.position.y = 0.5;
  stand.add(socket);
  // The meridian: a half ring from the stem over the top, around which the world turns.
  const meridian = own(owned, new THREE.TorusGeometry(0.3, 0.014, 8, 64, Math.PI * 1.25));
  const meridianMesh = new THREE.Mesh(meridian, brass);
  meridianMesh.rotation.z = -Math.PI * 0.625 + Math.PI / 2;
  socket.add(meridianMesh);
  const ring = own(owned, new THREE.TorusGeometry(0.34, 0.01, 8, 96));
  const ringMesh = new THREE.Mesh(ring, brass);
  ringMesh.rotation.set(Math.PI / 2 - 0.42, 0, 0.18);
  socket.add(ringMesh);
  return { stand, socket };
}
