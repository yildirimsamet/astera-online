/** Offline glTF surface treatment. Existing panel masks supply light; neutral armour stays metal. */
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { applyUvTransform } from './monument-textures.mjs';

export const SKIN_PALETTES = {
  'red-dragon': { cool: [111, 240, 250], warm: [255, 99, 66], coolLight: .24, warmLight: .1, redPaint: 1.16 },
  scorpion: { cool: [152, 114, 239], warm: [255, 171, 76], coolLight: .21, warmLight: .14 },
  shark: { cool: [69, 213, 250], warm: [222, 157, 74], coolLight: .25, warmLight: .05 },
  stingray: { cool: [61, 229, 203], warm: [99, 239, 208], coolLight: .23, warmLight: .09 },
  ufo: { cool: [101, 239, 255], warm: [255, 176, 76], coolLight: .26, warmLight: .06 },
};

/** Measured mesh intersections in the six-side viewer; normalized authored model space. */
const FEATURES = {
  'red-dragon': [-1, 1].map(sign => ({ center: [-.372, .0015, sign * .039], radius: [.024, .013, .014], color: [36, 190, 255] })),
  shark: [-1, 1].map(sign => ({ center: [-.398, -.024, sign * .035], radius: [.023, .021, .015], color: [68, 218, 255] })),
  stingray: [-1, 1].map(sign => ({ center: [sign * .049, -.006, .246], radius: [.016, .020, .025], color: [90, 255, 215] })),
  scorpion: [
    ...[-1, 1].map(sign => ({ center: [sign * .044, -.114, .267], radius: [.018, .023, .023], color: [210, 147, 255] })),
    { center: [0, .275, -.08], radius: [.039, .025, .12], color: [255, 142, 40] },
  ],
};

export function skinFeatureLight(name, point) {
  const color = [0, 0, 0];
  for (const feature of FEATURES[name] ?? []) {
    const distance = feature.center.reduce((sum, center, axis) => sum + ((point[axis] - center) / feature.radius[axis]) ** 2, 0);
    if (distance >= 1) continue;
    const edge = Math.min(1, Math.max(0, (distance - .4) / .6));
    const intensity = 1 - edge * edge * (3 - 2 * edge);
    for (let channel = 0; channel < 3; channel += 1) color[channel] = Math.max(color[channel], Math.round(feature.color[channel] * intensity));
  }
  return color;
}

/** Paint the chosen anatomy into its actual UV islands, so flight and preview share one material. */
function lightSurfaceFeatures(document, material, name, color, emissive, width, height) {
  const features = FEATURES[name];
  if (!features) return;
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    if (primitive.getMaterial() !== material) continue;
    const positions = primitive.getAttribute('POSITION');
    const uv = primitive.getAttribute('TEXCOORD_0');
    const indices = primitive.getIndices().getArray();
    const bounds = [positions.getMinNormalized([]), positions.getMaxNormalized([])];
    const centre = bounds[0].map((value, axis) => (value + bounds[1][axis]) / 2);
    const extent = Math.max(...bounds[0].map((value, axis) => bounds[1][axis] - value));
    const transform = material.getBaseColorTextureInfo().getExtension('KHR_texture_transform');
    const mapping = { scale: transform?.getScale() ?? [1, 1], offset: transform?.getOffset() ?? [0, 0], rotation: transform?.getRotation() ?? 0 };
    const vertices = [], coordinates = [];
    for (let vertex = 0; vertex < positions.getCount(); vertex += 1) {
      vertices.push(positions.getElement(vertex, []).map((value, axis) => (value - centre[axis]) / extent));
      const tex = uv.getElement(vertex, []);
      coordinates.push(applyUvTransform(tex[0], tex[1], mapping));
    }
    for (let face = 0; face < indices.length; face += 3) {
      const ids = [indices[face], indices[face + 1], indices[face + 2]];
      const points = ids.map(id => vertices[id]);
      if (!features.some(feature => feature.center.every((value, axis) =>
        Math.min(...points.map(point => point[axis])) <= value + feature.radius[axis]
          && Math.max(...points.map(point => point[axis])) >= value - feature.radius[axis]))) continue;
      const [a, b, c] = ids.map(id => coordinates[id]);
      const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(denominator) < 1e-15) continue;
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) * width));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0]) * width));
      const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) * height));
      const maxY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1]) * height));
      for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
        const u = (x + .5) / width, v = (y + .5) / height;
        const wa = ((b[1] - c[1]) * (u - c[0]) + (c[0] - b[0]) * (v - c[1])) / denominator;
        const wb = ((c[1] - a[1]) * (u - c[0]) + (a[0] - c[0]) * (v - c[1])) / denominator;
        const wc = 1 - wa - wb;
        if (Math.min(wa, wb, wc) < 0) continue;
        const point = points[0].map((value, axis) => value * wa + points[1][axis] * wb + points[2][axis] * wc);
        const light = skinFeatureLight(name, point);
        const pixel = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          emissive[pixel + channel] = Math.max(emissive[pixel + channel], light[channel]);
          if (light[channel] > 0) color[pixel + channel] = Math.round(color[pixel + channel] * .6 + light[channel] * .4);
        }
      }
    }
  }
}

export function polishSkinPixels(source, palette) {
  if (source.length % 4 !== 0) throw new Error('Expected complete RGBA pixels');
  const color = new Uint8Array(source);
  const emissive = new Uint8Array(source.length);
  for (let index = 0; index < source.length; index += 4) {
    const [r, g, b] = source.subarray(index, index + 3);
    const cool = b > r * 1.35 && g > r * 1.2 && b > 65 && b > r + 35;
    const warm = r > g * 1.3 && g > b * 1.6 && r > 90 && g > 35;
    const accent = cool ? palette.cool : warm ? palette.warm : null;
    emissive[index + 3] = 255;
    if (accent && source[index + 3] > 0) {
      const brightness = Math.max(r, g, b) / 255;
      const light = cool ? palette.coolLight : palette.warmLight;
      for (let channel = 0; channel < 3; channel += 1) {
        // Keep authored highlights and wear. Hue arrives only in the coloured insets.
        color[index + channel] = Math.round(source[index + channel] * .3 + accent[channel] * brightness * .7);
        emissive[index + channel] = Math.round(accent[channel] * brightness * light);
      }
    } else if (palette.redPaint && r > g * 1.8 && r > b * 1.8 && r > 65) {
      color[index] = Math.min(255, Math.round(r * palette.redPaint));
    }
  }
  return { color, emissive };
}

export async function polishCosmeticMaterial(document, name) {
  const palette = SKIN_PALETTES[name];
  if (!palette) throw new Error(`No approved cosmetic palette: ${name}`);
  const fromCli = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`);
  const sharp = fromCli('sharp');
  const { KHRMaterialsEmissiveStrength } = fromCli('@gltf-transform/extensions');
  for (const material of document.getRoot().listMaterials()) {
    const base = material.getBaseColorTexture();
    if (!base) throw new Error(`${name}: a cosmetic needs its authored surface map`);
    const { data, info } = await sharp(base.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { color, emissive } = polishSkinPixels(data, palette);
    lightSurfaceFeatures(document, material, name, color, emissive, info.width, info.height);
    const raw = { width: info.width, height: info.height, channels: 4 };
    base.setImage(await sharp(color, { raw }).webp({ quality: 90 }).toBuffer()).setMimeType('image/webp');
    const texture = document.createTexture(`${name}-panel-light`)
      .setImage(await sharp(emissive, { raw }).webp({ quality: 90 }).toBuffer()).setMimeType('image/webp');
    material.setEmissiveTexture(texture).setEmissiveFactor([1, 1, 1]);
    material.setExtension('KHR_materials_emissive_strength', document.createExtension(KHRMaterialsEmissiveStrength)
      .createEmissiveStrength().setEmissiveStrength(3));
    for (const map of [material.getNormalTexture(), material.getMetallicRoughnessTexture()]) {
      if (map) map.setImage(await sharp(map.getImage()).webp({ quality: name === 'scorpion' && info.width > 512 ? 75 : 87 }).toBuffer()).setMimeType('image/webp');
    }
    const baseInfo = material.getBaseColorTextureInfo();
    const lightInfo = material.getEmissiveTextureInfo();
    lightInfo.setTexCoord(baseInfo.getTexCoord()).setWrapS(baseInfo.getWrapS()).setWrapT(baseInfo.getWrapT());
    const transform = baseInfo.getExtension('KHR_texture_transform');
    if (transform) lightInfo.setExtension('KHR_texture_transform', transform.clone());
  }
}

export async function polishCosmeticFile(path, name) {
  const fromCli = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`);
  const { NodeIO } = fromCli('@gltf-transform/core');
  const { ALL_EXTENSIONS } = fromCli('@gltf-transform/extensions');
  const { MeshoptDecoder, MeshoptEncoder } = fromCli('meshoptimizer');
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
  });
  const document = await io.read(path);
  await polishCosmeticMaterial(document, name);
  await io.write(path, document);
}
