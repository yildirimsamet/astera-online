/** Original, deterministic Astera VFX, hard-surface wreck and short sound assets.
 * Offline only. Run `node tools/premium-assets.mjs [vfx|wreck|audio]`.
 * No extracted game assets or external network input.
 */
import { createRequire } from 'node:module';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const cliRequire = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`);
const webRequire = createRequire(resolve('apps/web/package.json'));
const sharp = cliRequire('sharp');
const THREE = webRequire('three');
const { Document, NodeIO } = cliRequire('@gltf-transform/core');
const source = 'assets/source/premium';
const publicRoot = 'apps/web/public/assets';
const target = process.argv[2];
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const smooth = (x) => x * x * (3 - 2 * x);
const mix = (a, b, t) => a + (b - a) * t;
function hash(x, y, z = 0) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const a = smooth(x - ix), b = smooth(y - iy), c = smooth(z - iz);
  const layer = (dz) => mix(mix(hash(ix, iy, iz + dz), hash(ix + 1, iy, iz + dz), a),
    mix(hash(ix, iy + 1, iz + dz), hash(ix + 1, iy + 1, iz + dz), a), b);
  return mix(layer(0), layer(1), c);
}
function fbm(x, y, z) {
  return noise(x, y, z) * 0.57 + noise(x * 2.1, y * 2.1, z * 1.7) * 0.28
    + noise(x * 4.3, y * 4.3, z * 2.3) * 0.15;
}

async function vfx() {
  mkdirSync(`${source}/vfx`, { recursive: true });
  mkdirSync(`${publicRoot}/vfx/premium`, { recursive: true });
  const tile = 128, grid = 4, size = tile * grid;
  const pixels = Buffer.alloc(size * size * 4);
  for (let frame = 0; frame < 16; frame++) {
    const t = frame / 15;
    for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
      const dx = (x + 0.5) / tile * 2 - 1, dy = (y + 0.5) / tile * 2 - 1;
      const r = Math.hypot(dx, dy);
      const billow = fbm(dx * 5 + 17, dy * 5 + 8 - t * 2.2, t * 2.4);
      const fine = noise(dx * 17 + 30, dy * 17 + 30, t * 4);
      const torn = r + (billow - 0.5) * 0.53 + (fine - 0.5) * 0.1;
      const edge = clamp((0.92 - torn) / 0.46);
      const core = clamp(1 - r * 1.65);
      const heat = clamp((edge * (0.68 + billow * 0.55) + core * 0.65) * (1 - t * 0.72));
      const alpha = edge ** 1.6 * (0.62 + billow * 0.38) * (1 - t ** 2.8);
      const brightness = 0.55 + heat * 0.7;
      const p = (((Math.floor(frame / grid) * tile + y) * size) + (frame % grid) * tile + x) * 4;
      pixels[p] = Math.round(clamp(brightness * heat * 2.1) * 255);
      pixels[p + 1] = Math.round(clamp(brightness * heat ** 2 * 1.4) * 255);
      pixels[p + 2] = Math.round(clamp(brightness * heat ** 5.3) * 255);
      pixels[p + 3] = Math.round(alpha * 255);
    }
  }
  await sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).png().toFile(`${source}/vfx/explosion-v1.png`);
  await sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).webp({ quality: 88 }).toFile(`${publicRoot}/vfx/premium/explosion-v1.webp`);
  console.log('VFX: 16 coherent explosion frames, 512×512 atlas.');
}

async function wreck() {
  // One merged mesh in the existing wreck ring's YZ plane. The centre stays hollow.
  const positions = [], normals = [], colours = [], indices = [];
  const add = (geometry, at, rotation, tint) => {
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    const start = positions.length / 3;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      colours.push(...tint);
    }
    if (geometry.index) for (const i of geometry.index.array) indices.push(i + start);
    else for (let i = 0; i < p.count; i++) indices.push(i + start);
    geometry.dispose();
  };
  const piece = (i, radius, geometry, tint, offset = 0) => {
    const a = i * 2.39996323 + offset;
    add(geometry, [(hash(i, 7) - 0.5) * 0.16, Math.cos(a) * radius, Math.sin(a) * radius],
      [a, hash(i, 8) * 2, hash(i, 9) * 3], tint);
  };
  const fracturedPanel = (width, height) => {
    const shape = new THREE.Shape();
    shape.moveTo(-width * 0.5, -height * 0.5);
    shape.lineTo(width * 0.3, -height * 0.5);
    shape.lineTo(width * 0.48, -height * 0.21);
    shape.lineTo(width * 0.32, -height * 0.1);
    shape.lineTo(width * 0.5, height * 0.17);
    shape.lineTo(width * 0.4, height * 0.5);
    shape.lineTo(-width * 0.5, height * 0.5);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.012, steps: 1, curveSegments: 1,
      bevelEnabled: true, bevelSegments: 1, bevelSize: 0.003, bevelThickness: 0.003 });
    geometry.center();
    return geometry;
  };
  for (let i = 0; i < 18; i++) {
    const radius = 0.83 + hash(i, 1) * 0.05;
    const shade = 0.09 + hash(i, 2) * 0.13;
    const tint = i % 4 === 0 ? [0.21, 0.105, 0.045] : [shade, shade * 1.04, shade * 1.1];
    if (i % 3 === 0) {
      piece(i, radius, new THREE.CylinderGeometry(0.055, 0.09, 0.16, 10, 1, true), tint);
      piece(i, radius, new THREE.TorusGeometry(0.062, 0.012, 4, 10), [0.34, 0.3, 0.25]);
    } else {
      piece(i, radius, fracturedPanel(0.11, 0.08 + hash(i, 3) * 0.09), tint);
      piece(i, radius, new THREE.BoxGeometry(0.034, 0.018, 0.14), [0.31, 0.34, 0.4], 0.016);
      piece(i, radius, new THREE.BoxGeometry(0.014, 0.075, 0.023), [0.055, 0.07, 0.1], -0.025);
    }
  }
  for (let i = 18; i < 70; i++) {
    const width = 0.012 + hash(i, 5) * 0.025;
    piece(i, 0.78 + hash(i, 6) * 0.16, new THREE.BoxGeometry(width, width * 0.5, width * 2.5),
      i % 7 === 0 ? [0.38, 0.12, 0.025] : [0.14, 0.18, 0.24]);
  }
  const document = new Document();
  const buffer = document.createBuffer();
  const accessor = (name, type, data) => document.createAccessor(name).setBuffer(buffer).setType(type).setArray(data);
  const material = document.createMaterial('fractured-titanium').setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0.74).setRoughnessFactor(0.4).setDoubleSided(true);
  const primitive = document.createPrimitive()
    .setAttribute('POSITION', accessor('position', 'VEC3', new Float32Array(positions)))
    .setAttribute('NORMAL', accessor('normal', 'VEC3', new Float32Array(normals)))
    .setAttribute('COLOR_0', accessor('colour', 'VEC3', new Float32Array(colours)))
    .setIndices(accessor('indices', 'SCALAR', new Uint16Array(indices))).setMaterial(material);
  document.createScene('metal-wreck-ring').addChild(document.createNode().setMesh(document.createMesh().addPrimitive(primitive)));
  mkdirSync('assets/source/models/debris', { recursive: true });
  await new NodeIO().write('assets/source/models/debris/metal-wreck-v1.glb', document);
  console.log(`Wreck: ${indices.length / 3} triangles, one material, 70 recognizable fragments.`);
}

const SAMPLE_RATE = 44100;
function wav(samples) {
  const out = Buffer.alloc(44 + samples.length * 2);
  out.write('RIFF', 0); out.writeUInt32LE(36 + samples.length * 2, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SAMPLE_RATE, 24); out.writeUInt32LE(SAMPLE_RATE * 2, 28);
  out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) out.writeInt16LE(Math.round(clamp(samples[i], -1, 1) * 32767), 44 + i * 2);
  return out;
}
async function audio() {
  mkdirSync(`${source}/audio`, { recursive: true });
  mkdirSync(`${publicRoot}/audio/premium`, { recursive: true });
  const specs = [
    ['tap', 0.09], ['confirm', 0.35], ['alert', 0.58], ['launch', 1.25],
    ['cargo', 0.48], ['weapon', 0.25], ['shield', 0.5], ['impact', 0.9], ['strategic', 2.1], ['mining', 0.72],
  ];
  for (const [id, duration] of specs) {
    const samples = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
    let low = 0, previousNoise = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / SAMPLE_RATE, u = t / duration;
      const raw = hash(i, id.length * 71) * 2 - 1;
      low += (raw - low) * 0.028;
      const high = raw - previousNoise;
      previousNoise = raw;
      const envelope = Math.min(1, t / 0.006) * (1 - u) ** 1.8;
      let value = 0;
      if (id === 'tap') value = (Math.sin(2 * Math.PI * 920 * t) * Math.exp(-t * 90) + high * Math.exp(-t * 180) * 0.35) * 0.18;
      if (id === 'confirm' || id === 'cargo') {
        const f = id === 'confirm' ? 640 : 430;
        value = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14)
          + (t > 0.065 ? Math.sin(2 * Math.PI * f * 1.5 * (t - 0.065)) * Math.exp(-(t - 0.065) * 16) : 0)) * 0.16;
      }
      if (id === 'alert') value = Math.sin(2 * Math.PI * 330 * t) * (0.5 + 0.5 * Math.cos(t * 25)) * 0.14;
      if (id === 'launch') value = low * 2.8 * Math.sin(Math.PI * u) + Math.sin(2 * Math.PI * (90 * t + 180 * t * t)) * 0.06;
      if (id === 'weapon') value = (low * 1.7 + Math.sin(2 * Math.PI * (170 * t + 220 * (1 - Math.exp(-t * 12)))) * 0.18) * Math.exp(-t * 9);
      if (id === 'shield') value = (Math.sin(2 * Math.PI * 180 * t) * 0.14 + Math.sin(2 * Math.PI * 730 * t) * 0.08 + low * 0.4) * Math.exp(-t * 5);
      if (id === 'impact' || id === 'strategic') value = low * 3.3 * Math.exp(-t * (id === 'strategic' ? 1.8 : 4.2))
        + Math.sin(2 * Math.PI * (42 * t + 12 * (1 - Math.exp(-t * 8)))) * 0.25 * Math.exp(-t * 7)
        + high * Math.exp(-t * 45) * 0.11;
      if (id === 'mining') value = low * 1.3 + Math.sin(2 * Math.PI * (140 * t + 8 * Math.sin(t * 7))) * 0.06 + high * Math.max(0, Math.sin(t * 47)) ** 16 * 0.02;
      samples[i] = Math.tanh(value * 1.5) * envelope * 0.72;
    }
    const path = `${source}/audio/${id}-v1.wav`;
    writeFileSync(path, wav(samples));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path, '-codec:a', 'libmp3lame', '-q:a', '4', `${publicRoot}/audio/premium/${id}-v1.mp3`]);
  }
  console.log('Audio: 10 original bounded one-shot cues, mono MP3 + lossless masters.');
}

if (!target || target === 'vfx') await vfx();
if (!target || target === 'wreck') await wreck();
if (!target || target === 'audio') await audio();
