import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type * as SoundModule from '../src/lib/sound.js';
import type * as LiveUpdateModule from '../src/platform/liveUpdate.js';
import type * as UpdateGateModule from '../src/platform/updateGate.js';
import { reportUpdateRequired } from '../src/platform/updateGate.js';

const RUNNING = 'a'.repeat(40);
const NEXT = 'b'.repeat(40);
const API = 'https://asteraonline.space';
const files = [{ file_name: 'assets/index-2.js', file_hash: '2'.repeat(64), download_url: `${API}/ota/files/${'2'.repeat(64)}.js`, size: 2_400_000 }];

const updater = vi.hoisted(() => ({
  download: vi.fn(), set: vi.fn(), notifyAppReady: vi.fn(), getMissingBundleFiles: vi.fn(), addListener: vi.fn(),
}));
vi.mock('../src/platform/liveUpdate.js', async importOriginal => ({
  ...await importOriginal<typeof LiveUpdateModule>(), updater, liveUpdateEnabled: () => true,
}));
vi.mock('../src/platform/updateGate.js', async importOriginal => ({
  ...await importOriginal<typeof UpdateGateModule>(), shellBuild: () => '16',
}));
vi.mock('../src/lib/music.js', () => ({ useAmbientMusic: () => undefined }));
vi.mock('../src/lib/sound.js', async (importOriginal) => ({ ...await importOriginal<typeof SoundModule>(), useSoundEffects: () => undefined }));
vi.mock('../src/session/useEventStream.js', () => ({ useEventStream: () => undefined }));
vi.mock('../src/session/useLiveAlerts.js', () => ({ useLiveAlerts: () => undefined }));
vi.mock('../src/brand/OpeningScene.js', () => ({ OpeningScene: () => <div /> }));

let published = RUNNING;
beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-production');
  vi.stubEnv('VITE_ASTERA_API_URL', API);
  vi.stubEnv('VITE_ASTERA_RELEASE', RUNNING);
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === `${API}/ota/latest.json`) return Promise.resolve(new Response(JSON.stringify({ version: published, minShell: 1, manifest: `/ota/${published}/manifest.json` })));
    if (url === `${API}/ota/${NEXT}/manifest.json`) return Promise.resolve(new Response(JSON.stringify({ version: NEXT, files })));
    return Promise.resolve(new Response('', { status: 404 }));
  }));
  updater.download.mockResolvedValue({ id: 'bundle-9' });
  updater.set.mockResolvedValue(undefined);
  updater.notifyAppReady.mockResolvedValue({});
  updater.getMissingBundleFiles.mockResolvedValue({ missing: files });
  updater.addListener.mockResolvedValue({ remove: () => Promise.resolve() });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

/**
 * OTA F3, found on the phone: the game and the 426 screen both sat under an update gate at the
 * root, so React kept the gate that had already opened and the rules change went straight to the
 * store link. A refusal after a release is published must look for that release first.
 */
it('answers a rules change in the open game with the published release, not the store', async () => {
  const offline = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response(JSON.stringify({ error: 'UNREACHABLE', message: 'x' }), { status: 503 })));
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={new Api({ fetch: offline, authTransport: null })}><App /></ApiProvider></QueryClientProvider>);
  await act(async () => { await new Promise(resolve => { setTimeout(resolve, 50); }); });
  expect(updater.notifyAppReady).toHaveBeenCalled();
  published = NEXT;
  await act(async () => { reportUpdateRequired(); await new Promise(resolve => { setTimeout(resolve, 50); }); });
  expect(await screen.findByText('Downloading update · 2.4 MB')).toBeTruthy();
  await act(async () => { await Promise.resolve(); });
  expect(updater.set).toHaveBeenCalledWith({ id: 'bundle-9' });
});
