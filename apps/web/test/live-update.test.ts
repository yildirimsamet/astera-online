// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { failedReleases, findRelease, formatMegabytes, installRelease, restartInto, settleLastUpdate, type Updater } from '../src/platform/liveUpdate.js';

const RUNNING = 'a'.repeat(40);
const NEXT = 'b'.repeat(40);
const API = 'https://asteraonline.space';
const hash = (n: number) => String(n).repeat(64).slice(0, 64);
const files = [
  { file_name: 'index.html', file_hash: hash(1), download_url: `${API}/ota/files/${hash(1)}.html`, size: 1_000 },
  { file_name: 'assets/index-2.js', file_hash: hash(2), download_url: `${API}/ota/files/${hash(2)}.js`, size: 2_400_000 },
  { file_name: '__ref/dist/v2/ship.webp', file_hash: hash(3), download_url: `${API}/ota/files/${hash(3)}.webp`, size: 9_000_000 },
];
const latest = (over: Record<string, unknown> = {}) => ({ version: NEXT, minShell: 16, manifest: `/ota/${NEXT}/manifest.json`, ...over });

function memory(): Storage {
  const map = new Map<string, string>();
  return { get length() { return map.size; }, clear: () => { map.clear(); }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
}

function server(answers: Record<string, unknown>): typeof fetch {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(API, '');
    if (!(path in answers)) return Promise.resolve(new Response('missing', { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(answers[path]), { status: 200 }));
  });
}

function plugin(over: Partial<Updater> = {}): Updater {
  return {
    download: vi.fn(() => Promise.resolve({ id: 'bundle-1' })),
    set: vi.fn(() => Promise.resolve()),
    notifyAppReady: vi.fn(() => Promise.resolve({})),
    getMissingBundleFiles: vi.fn(() => Promise.resolve({ missing: files.slice(0, 2) })),
    addListener: vi.fn(() => Promise.resolve({ remove: () => Promise.resolve() })),
    ...over,
  };
}

const answers = { '/ota/latest.json': latest(), [`/ota/${NEXT}/manifest.json`]: { version: NEXT, files } };
const base = (over: Partial<Parameters<typeof findRelease>[0]> = {}) => ({
  fetch: server(answers), apiUrl: API, release: RUNNING, shell: '16', storage: memory(), updater: plugin(), ...over,
});

afterEach(() => { vi.useRealTimers(); });

/** OTA F3: the app asks for the release the server publishes, and downloads only what it lacks. */
describe('finding a release', () => {
  it('offers a newer release with the bytes this phone still has to download', async () => {
    const at = base();
    const found = await findRelease(at);
    expect(found).toMatchObject({ version: NEXT, manifestUrl: `${API}/ota/${NEXT}/manifest.json`, bytes: 2_401_000 });
    expect(found?.files).toHaveLength(3);
    expect(at.updater.getMissingBundleFiles).toHaveBeenCalledWith({ version: NEXT,
      manifest: files.map(({ file_name, file_hash, download_url }) => ({ file_name, file_hash, download_url })) });
  });

  it('counts every byte when the phone cannot say what it already has', async () => {
    const found = await findRelease(base({ updater: plugin({ getMissingBundleFiles: vi.fn(() => Promise.reject(new Error('old plugin'))) }) }));
    expect(found?.bytes).toBe(11_401_000);
  });

  it.each([
    ['the phone already runs it', { release: NEXT }],
    ['the shell is older than the release needs', { shell: '15' }],
    ['the shell is unknown', { shell: undefined }],
  ])('offers nothing when %s', async (_case, over) => {
    expect(await findRelease(base(over))).toBeNull();
  });

  it('never offers again a release that failed to start on this phone', async () => {
    const storage = memory();
    storage.setItem('astera.ota.pending', NEXT);
    expect(settleLastUpdate(storage, RUNNING)).toBe('failed');
    expect(failedReleases(storage)).toEqual([NEXT]);
    expect(await findRelease(base({ storage }))).toBeNull();
  });

  it.each([
    ['latest is unreachable', { '/ota/latest.json': undefined }],
    ['latest is malformed', { '/ota/latest.json': { version: 'main' } }],
    ['the manifest names another release', { [`/ota/${NEXT}/manifest.json`]: { version: RUNNING, files } }],
    ['the manifest points outside the update origin', { [`/ota/${NEXT}/manifest.json`]: { version: NEXT,
      files: [{ ...files[0], download_url: 'https://evil.example/x.html' }] } }],
  ])('offers nothing when %s', async (_case, change) => {
    const merged = Object.fromEntries(Object.entries({ ...answers, ...change }).filter(([, value]) => value !== undefined));
    expect(await findRelease(base({ fetch: server(merged) }))).toBeNull();
  });

  it('gives up after the time the opening allows and lets the game start', async () => {
    vi.useFakeTimers();
    const hanging = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(new DOMException('aborted', 'AbortError')); });
    })) as typeof fetch;
    const result = findRelease(base({ fetch: hanging }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toBeNull();
  });
});

describe('installing a release', () => {
  it('reports progress and leaves the running bundle alone until the switch', async () => {
    const storage = memory();
    const progress = vi.fn();
    const updater = plugin({ addListener: vi.fn((_event: 'download', listener: (state: { percent: number }) => void) => {
      listener({ percent: 40 });
      return Promise.resolve({ remove: () => Promise.resolve() });
    }) });
    const found = await findRelease(base({ storage, updater }));
    if (!found) throw new Error('expected a release');
    const id = await installRelease(found, { updater, storage, onProgress: progress });
    expect(id).toBe('bundle-1');
    expect(progress).toHaveBeenCalledWith(0.4);
    expect(updater.download).toHaveBeenCalledWith({ version: NEXT, url: `${API}/ota/${NEXT}/manifest.json`,
      manifest: files.map(({ file_name, file_hash, download_url }) => ({ file_name, file_hash, download_url })) });
    // Downloaded in the background and never switched to: the next start must not call it failed.
    expect(storage.getItem('astera.ota.pending')).toBeNull();
    expect(updater.set).not.toHaveBeenCalled();
  });

  it('remembers what the next start should run as, then switches to it', async () => {
    const storage = memory();
    const updater = plugin({ set: vi.fn(() => { expect(storage.getItem('astera.ota.pending')).toBe(NEXT); return Promise.resolve(); }) });
    await restartInto(NEXT, 'bundle-1', { updater, storage });
    expect(updater.set).toHaveBeenCalledWith({ id: 'bundle-1' });
  });

  it('forgets the switch when the updater refuses it, so a release that never ran is not blamed', async () => {
    const storage = memory();
    const updater = plugin({ set: vi.fn(() => Promise.reject(new Error('id does not exist'))) });
    await expect(restartInto(NEXT, 'bundle-1', { updater, storage })).rejects.toThrow('id does not exist');
    expect(storage.getItem('astera.ota.pending')).toBeNull();
    expect(settleLastUpdate(storage, RUNNING)).toBeNull();
    expect(failedReleases(storage)).toEqual([]);
  });

  it('confirms a release that started as expected, once', () => {
    const storage = memory();
    storage.setItem('astera.ota.pending', NEXT);
    expect(settleLastUpdate(storage, NEXT)).toBe('updated');
    expect(settleLastUpdate(storage, NEXT)).toBeNull();
    expect(failedReleases(storage)).toEqual([]);
  });

  it('keeps only the latest few failed releases', () => {
    const storage = memory();
    for (let n = 0; n < 8; n += 1) {
      storage.setItem('astera.ota.pending', String(n).repeat(40));
      settleLastUpdate(storage, RUNNING);
    }
    expect(failedReleases(storage)).toHaveLength(5);
    expect(failedReleases(storage)[4]).toBe('7'.repeat(40));
  });
});

describe('the download size', () => {
  it('reads as megabytes in the player language', () => {
    expect(formatMegabytes(2_401_000, 'tr')).toBe('2,4 MB');
    expect(formatMegabytes(2_401_000, 'en')).toBe('2.4 MB');
    expect(formatMegabytes(40_000, 'en')).toBe('0.1 MB');
  });
});
