import * as THREE from 'three';
import { KTX2Loader, type KTX2LoaderWorkerConfig } from 'three/addons/loaders/KTX2Loader.js';
import type { ArenaAssets, PreparedModel } from './load.js';
import { roomyRenderer } from '../room.js';
import { bundledApp } from '../origin.js';

export { roomyRenderer };

/**
 * Where the web build serves three's basis transcoder: its wasm byte for byte, its glue with the
 * two wrappers it built from strings swapped for closures, so it runs under the page's CSP
 * (`tools/basis-no-eval.mjs`; both kept in step by a test). KTX2 maps are transcoded in workers.
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

/** The block formats this GPU decodes, asked once of a throwaway context. */
let support: KTX2LoaderWorkerConfig | null = null;
export function gpuSupport(): KTX2LoaderWorkerConfig {
  if (support) return support;
  if (typeof document === 'undefined') return (support = compressedSupport(null));
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  support = compressedSupport(gl);
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return support;
}

/**
 * ONE KTX2 TRANSCODER FOR THE PAGE (S22, 2026-10-26). A loader keeps its basis worker and that
 * worker's WebAssembly heap until it is disposed; one per renderer left one behind for every
 * hangar opened. The hangar, the galaxy's ships and the Yarık's load share this one, through
 * `ktx2Ready`; the Yarık lets it go once its pack is in.
 */
let shared: KTX2Loader | null = null;
export function sharedKtx2(config: KTX2LoaderWorkerConfig = gpuSupport()): KTX2Loader {
  if (!shared) { shared = new KTX2Loader().setTranscoderPath(TRANSCODER_PATH).setWorkerLimit(1); shared.workerConfig = config; }
  return shared;
}

/** A 4×4 UASTC KTX2 (vkFormat 0): only the transcoder's worker can read it. A fresh copy each call, as the worker takes it. */
const PROBE = 'q0tUWCAyMLsNChoKAAAAAAEAAAAEAAAABAAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAaAAAACwAAACUAAAAMAAAAAAAAAAAAAAAAAAAAAAAAADQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAsAAAAAAAAAAIAKACmAQIAAwMAABAAAAAAAAAAAAB/AAAAAAAAAAAA/////ywAAABLVFh3cml0ZXIAa3R4IGNyZWF0ZSB2NC40LjIgLyBsaWJrdHggdjQuNC4yAAAAAAAAAAAAAAAAABcQEvS/mPUCAAAAAAAAAAA=';
export const TRANSCODER_PROBE = (): ArrayBuffer => Uint8Array.from(atob(PROBE), char => char.charCodeAt(0)).buffer;
/** How long a worker that never answers is waited for: a fetch, a compile and one tiny transcode take a phone about a second. */
const PROBE_WAIT_MS = 8000;

type Probeable = Pick<KTX2Loader, 'parse'>;

/**
 * Whether this transcoder works here. One that cannot fit its heap does not fail: its worker
 * dies on "Out of memory" and every texture behind it waits for good, so silence counts as no.
 */
export function probeTranscoder(loader: Probeable, waitMs = PROBE_WAIT_MS): Promise<boolean> {
  return new Promise(resolve => {
    const timer = setTimeout(() => { resolve(false); }, waitMs);
    const settle = (ok: boolean): void => { clearTimeout(timer); resolve(ok); };
    loader.parse(TRANSCODER_PROBE(), () => { settle(true); }, () => { settle(false); });
  });
}

/**
 * THE PAGE'S TRANSCODER, OR NONE (S22, 2026-10-26). That phone's Chrome is a 32-bit build: with
 * the galaxy up its renderer's largest free block fell from 192 MB to 64 MB, and under the 16 MB
 * the transcoder's heap asks for once the hangar or the Yarık began to load. `null` sends every
 * scene to the lite webp pack, which needs no WebAssembly heap. A no stands for the page: nothing
 * has given that memory back. A yes is asked again once the transcoder is let go.
 */
let ready: Promise<Probeable | null> | null = null;
let refused = false;
/** How many times the transcoder has been let go. */
let released = 0;
export function ktx2Ready(): Promise<KTX2Loader | null>;
export function ktx2Ready<L extends Probeable>(make: () => L, room?: () => boolean): Promise<L | null>;
export function ktx2Ready(make: () => Probeable = sharedKtx2, room: () => boolean = roomyRenderer): Promise<Probeable | null> {
  if (ready) return ready;
  const asked = released;
  ready = (async () => {
    // No room: not even the attempt, which reserves a heap the galaxy may need next.
    // An app carries only the webp pack, so it never needs the transcoder (2026-10-30).
    if (bundledApp() || !room()) { refused = true; return null; }
    const loader = make();
    if (await probeTranscoder(loader)) return loader;
    // A probe whose transcoder was let go while it waited proves nothing.
    if (asked === released) { refused = true; releaseKtx2(); }
    return null;
  })();
  return ready;
}
export function releaseKtx2(): void {
  shared?.dispose(); shared = null; released++;
  if (!refused) ready = null;
}

/** A renderer let go: its objects, then the context itself, so the next scene starts with the GPU's memory back. */
export function releaseRenderer(renderer: { dispose(): void; forceContextLoss(): void }): void {
  renderer.dispose(); renderer.forceContextLoss();
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
