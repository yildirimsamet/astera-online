import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { describe, expect, it } from 'vitest';
import { loadArenaAssets, memoryTight, packsFor } from '../../src/arena/assets/load.js';

const transcoder = Promise.resolve(new KTX2Loader());

/**
 * Owner 2026-10-21: an iPhone 12 mini tab died ("A problem repeatedly occurred") loading
 * the arena, in Safari and Chrome alike — every iOS browser is WebKit. The full pack
 * decodes to ~580 MB of textures; memory-tight browsers load the halved lite pack.
 */
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 16; SM-S901E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';

describe('memory-tight browsers', () => {
  it('include every iPhone browser and an iPad asking for the desktop site', () => {
    expect(memoryTight({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })).toBe(true);
    expect(memoryTight({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 })).toBe(true);
    expect(memoryTight({ userAgent: IPAD_DESKTOP, maxTouchPoints: 5 })).toBe(true);
  });

  it('include an Android phone with 4 GB or less, and leave a roomy one and a Mac alone', () => {
    expect(memoryTight({ userAgent: ANDROID, maxTouchPoints: 5, deviceMemory: 4 })).toBe(true);
    expect(memoryTight({ userAgent: ANDROID, maxTouchPoints: 5, deviceMemory: 8 })).toBe(false);
    expect(memoryTight({ userAgent: IPAD_DESKTOP, maxTouchPoints: 0 })).toBe(false);
  });
});

describe('the lite reference pack', () => {
  const fetcher = (answers: Record<string, number>, asked: string[]): typeof fetch => input => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    asked.push(url);
    return Promise.resolve(new Response('{}', { status: answers[url] ?? 404 }));
  };

  it('asks a memory-tight browser for the lite manifest first and falls back to the full one, KTX2 before webp', async () => {
    const asked: string[] = [];
    await loadArenaAssets(true, 1, () => undefined, fetcher({}, asked), true, transcoder);
    expect(asked).toEqual(['/__ref/dist/v2/manifest-lite-ktx2.json', '/__ref/dist/v2/manifest-lite.json',
      '/__ref/dist/v2/manifest-ktx2.json', '/__ref/dist/v2/manifest.json']);
  });

  it('gives every other browser the full pack only, KTX2 before webp', async () => {
    const asked: string[] = [];
    await loadArenaAssets(true, 1, () => undefined, fetcher({}, asked), false, transcoder);
    expect(asked).toEqual(['/__ref/dist/v2/manifest-ktx2.json', '/__ref/dist/v2/manifest.json']);
  });

  /** S22 2026-10-26: a 32-bit Chrome cannot start the transcoder once the galaxy is up. */
  it('gives a renderer that cannot start the transcoder the lite webp pack alone, whatever its memory', async () => {
    const asked: string[] = [];
    await loadArenaAssets(true, 1, () => undefined, fetcher({}, asked), false, Promise.resolve(null));
    expect(asked).toEqual(['/__ref/dist/v2/manifest-lite.json']);
    expect(packsFor(false, false)).toEqual(['/__ref/dist/v2/manifest-lite.json']);
    expect(packsFor(true, true)).toEqual(['/__ref/dist/v2/manifest-lite-ktx2.json', '/__ref/dist/v2/manifest-lite.json']);
  });
});
