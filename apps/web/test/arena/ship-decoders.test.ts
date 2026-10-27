import { describe, expect, it, vi } from 'vitest';
import type { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { compressedSupport, releaseKtx2, sharedKtx2 } from '../../src/arena/assets/memory.js';
import { shipDecoders } from '../../src/arena/hangar/shipModels.js';

/**
 * Review 2026-10-27: a ship model kept the KTX2 loader it was found with. The Yarık's load lets
 * that loader go (three revokes its worker's source), and a ship file loaded after it, through
 * the old one, waited for a worker that could never start. The loader is the page's at load time.
 */
describe('a class ship\'s decoders', () => {
  it('take the page\'s transcoder as it is when the file loads, never one let go', () => {
    const set = vi.fn<(loader: KTX2Loader) => void>();
    const gltf = { setMeshoptDecoder: vi.fn(), setKTX2Loader: set };
    const before = sharedKtx2(compressedSupport(null));
    releaseKtx2();
    const now = sharedKtx2(compressedSupport(null));
    shipDecoders(gltf, { ktx2: true });
    expect(set).toHaveBeenCalledOnce();
    expect(set.mock.calls[0]?.[0]).not.toBe(before);
    expect(set.mock.calls[0]?.[0]).toBe(now);
    releaseKtx2();
  });

  it('leaves a webp ship without one', () => {
    const gltf = { setMeshoptDecoder: vi.fn(), setKTX2Loader: vi.fn() };
    shipDecoders(gltf, { ktx2: false });
    expect(gltf.setMeshoptDecoder).toHaveBeenCalledOnce();
    expect(gltf.setKTX2Loader).not.toHaveBeenCalled();
  });
});
