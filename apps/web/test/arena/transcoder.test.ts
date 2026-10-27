import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressedSupport, probeTranscoder, releaseKtx2, releaseRenderer, roomyRenderer, sharedKtx2, TRANSCODER_PROBE } from '../../src/arena/assets/memory.js';

type Parse = (buffer: ArrayBuffer, onLoad?: (texture: THREE.CompressedTexture) => void, onError?: (err: unknown) => void) => void;
const answers = (parse: Parse) => ({ parse });
const texture = () => new THREE.CompressedTexture([], 4, 4, THREE.RGBA_ASTC_4x4_Format);

/**
 * S22, 2026-10-26: every renderer opened its own KTX2 transcoder (a worker and a WebAssembly heap)
 * and none was ever closed. A hangar opened twice and the galaxy behind it left three behind, and
 * the Yarık's own load then died on "WebAssembly.instantiate(): Out of memory".
 */
describe('one KTX2 transcoder for the page', () => {
  it('hands every scene the same one until the Yarık releases it for its own load', () => {
    const first = sharedKtx2(compressedSupport(null));
    expect(sharedKtx2(compressedSupport(null))).toBe(first);
    releaseKtx2();
    const next = sharedKtx2(compressedSupport(null));
    expect(next).not.toBe(first);
    releaseKtx2(); releaseKtx2();
  });
});

describe('leaving the Yarık', () => {
  it('gives the GPU context back, not only the objects drawn in it', () => {
    const calls: string[] = [];
    releaseRenderer({ dispose: () => { calls.push('dispose'); }, forceContextLoss: () => { calls.push('lost'); } });
    expect(calls).toEqual(['dispose', 'lost']);
  });
});

/**
 * S22, 2026-10-26: its Chrome is a 32-bit build. With the galaxy up the renderer's largest free
 * block fell from 192 MB to 64 MB, then under the 16 MB the transcoder's heap asks for, and the
 * worker died on "Out of memory" without a word: every KTX2 behind it waited for good. The page
 * asks once, with a real 4×4 KTX2, and a renderer that cannot start it draws the webp pack.
 */
describe('whether the transcoder can start', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('is a real basis-compressed KTX2, so the answer comes from the worker and not the main thread', () => {
    const bytes = new Uint8Array(TRANSCODER_PROBE());
    expect(Array.from(bytes.slice(1, 7), code => String.fromCharCode(code)).join('')).toBe('KTX 20');
    // vkFormat 0 (VK_FORMAT_UNDEFINED): only the transcoder reads it.
    expect(new DataView(bytes.buffer).getUint32(12, true)).toBe(0);
  });

  it('answers yes when the probe transcodes, and no when it fails', async () => {
    expect(await probeTranscoder(answers((_, onLoad) => { onLoad?.(texture()); }), 1000)).toBe(true);
    expect(await probeTranscoder(answers((_, _onLoad, onError) => { onError?.(new Error('abort')); }), 1000)).toBe(false);
  });

  it('answers no when the worker never answers: an instance that would not fit hangs, it does not throw', async () => {
    vi.useFakeTimers();
    const answer = probeTranscoder(answers(() => undefined), 8000);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await answer).toBe(false);
  });

  it('remembers a no for the page, but asks again after a yes was let go', async () => {
    vi.resetModules();
    const memory = await import('../../src/arena/assets/memory.js');
    const failing = { parse: vi.fn<Parse>((_, _onLoad, onError) => { onError?.(new Error('Out of memory')); }) };
    expect(await memory.ktx2Ready(() => failing)).toBeNull();
    memory.releaseKtx2();
    const working = { parse: vi.fn<Parse>((_, onLoad) => { onLoad?.(texture()); }) };
    expect(await memory.ktx2Ready(() => working)).toBeNull();
    expect(working.parse).not.toHaveBeenCalled();

    vi.resetModules();
    const fresh = await import('../../src/arena/assets/memory.js');
    expect(await fresh.ktx2Ready(() => working)).toBe(working);
    expect(await fresh.ktx2Ready(() => failing)).toBe(working);
    fresh.releaseKtx2();
    expect(await fresh.ktx2Ready(() => failing)).toBeNull();
  });
});

/**
 * S22, 2026-10-26: a 32-bit renderer. A blank page had 192 MB of free address space in one
 * block; the galaxy left 64. Opening the 3D hangar beside it killed the tab ("Hay aksi!",
 * termination status OOM) on the second visit. A 64-bit renderer reserves 1 GB untouched
 * without a thought; a 32-bit one cannot, and that is how the page tells them apart.
 */
describe('a renderer with room', () => {
  // A fresh S22 tab still had 512 MB in one block: 256 MB let a 32-bit renderer pass for a 64-bit one.
  it('is one that can reserve 1 GB of address space in one block, and a 32-bit one cannot', () => {
    const asked: number[] = [];
    expect(roomyRenderer(bytes => { asked.push(bytes); })).toBe(true);
    expect(asked).toEqual([1024 * 1048576]);
    expect(roomyRenderer(() => { throw new RangeError('WebAssembly.Memory(): could not allocate memory'); })).toBe(false);
  });

  it('never starts the transcoder in a renderer without room: the webp pack needs no WebAssembly heap', async () => {
    vi.resetModules();
    const memory = await import('../../src/arena/assets/memory.js');
    const working = { parse: vi.fn<Parse>((_, onLoad) => { onLoad?.(texture()); }) };
    expect(await memory.ktx2Ready(() => working, () => false)).toBeNull();
    expect(working.parse).not.toHaveBeenCalled();
  });
});
