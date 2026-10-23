import * as THREE from 'three';
import type { KTX2LoaderWorkerConfig } from 'three/addons/loaders/KTX2Loader.js';
import type { ArenaAssets, PreparedModel } from './load.js';

/**
 * Where the web build serves three's basis transcoder (a byte-for-byte copy of
 * three/examples/jsm/libs/basis, kept in step by a test). KTX2 maps are transcoded in workers.
 */
export const TRANSCODER_PATH = '/basis/';

/** The block formats this GPU decodes, for the KTX2 transcoder's choice. No GPU: plain RGBA. */
export function compressedSupport(gl: { getExtension(name: string): unknown } | null): KTX2LoaderWorkerConfig {
  const has = (name: string): boolean => gl?.getExtension(name) != null;
  return {
    astcSupported: has('WEBGL_compressed_texture_astc'),
    astcHDRSupported: false,
    etc1Supported: has('WEBGL_compressed_texture_etc1'),
    etc2Supported: has('WEBGL_compressed_texture_etc'),
    dxtSupported: has('WEBGL_compressed_texture_s3tc'),
    bptcSupported: has('EXT_texture_compression_bptc'),
    pvrtcSupported: has('WEBGL_compressed_texture_pvrtc') || has('WEBKIT_WEBGL_compressed_texture_pvrtc'),
  };
}

const size = (image: unknown): number => {
  if (typeof image !== 'object' || image === null || !('width' in image) || !('height' in image)) return 0;
  const { width, height } = image;
  return typeof width === 'number' && typeof height === 'number' ? width * height : 0;
};

/**
 * Bytes a texture holds on the GPU. A compressed one: its levels as uploaded. An image: RGBA,
 * a third more with a mip chain, six faces for a cube.
 */
const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value);

/** The bytes of the levels a compressed image carries as `mipmaps` of `{ data }`. */
const levelBytes = (holder: unknown): number => {
  if (typeof holder !== 'object' || holder === null || !('mipmaps' in holder) || !isList(holder.mipmaps)) return 0;
  let bytes = 0;
  for (const level of holder.mipmaps) {
    if (typeof level === 'object' && level !== null && 'data' in level && ArrayBuffer.isView(level.data)) bytes += level.data.byteLength;
  }
  return bytes;
};

export function textureBytes(texture: THREE.Texture): number {
  if (texture instanceof THREE.CompressedTexture) {
    // A compressed cube keeps each face's levels on its image; a flat one keeps them on itself.
    const faces: readonly unknown[] = texture instanceof THREE.CompressedCubeTexture ? texture.image : [texture];
    return faces.reduce<number>((sum, face) => sum + levelBytes(face), 0);
  }
  const image: unknown = texture.image;
  const texels = Array.isArray(image) ? image.reduce((sum: number, face: unknown) => sum + size(face), 0) : size(image);
  const mipped = texture.generateMipmaps && texture.minFilter !== THREE.LinearFilter && texture.minFilter !== THREE.NearestFilter;
  return Math.round(texels * 4 * (mipped ? 4 / 3 : 1));
}

const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const;

/** Every texture the arena holds, each counted once however many materials share it (plan §17, Y3 gate). */
export function assetTextureBytes(assets: ArenaAssets): number {
  const seen = new Set<THREE.Texture>();
  const add = (texture: THREE.Texture | null | undefined): void => { if (texture) seen.add(texture); };
  const visit = (model: PreparedModel | null): void => {
    if (!model) return;
    for (const part of model.parts) for (const key of MAPS) add(part.material[key]);
    for (const level of model.lods ?? []) visit(level);
  };
  for (const model of [assets.hero, ...assets.rivals, ...assets.classes.values(), ...assets.colliders.values(), ...assets.structures.values(),
    ...assets.debris, assets.cargo]) visit(model);
  for (const texture of [...assets.fx.values(), ...assets.textures.values(), assets.sky, assets.env]) add(texture);
  let bytes = 0;
  for (const texture of seen) bytes += textureBytes(texture);
  return bytes;
}
