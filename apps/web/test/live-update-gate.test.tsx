import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/i18n/index.js';
import type * as LiveUpdateModule from '../src/platform/liveUpdate.js';
import type * as UpdateGateModule from '../src/platform/updateGate.js';

const NEXT = 'b'.repeat(40);
const API = 'https://asteraonline.space';
const files = [{ file_name: 'assets/index-2.js', file_hash: '2'.repeat(64), download_url: `${API}/ota/files/${'2'.repeat(64)}.js`, size: 2_400_000 }];

const updater = vi.hoisted(() => ({
  download: vi.fn(), set: vi.fn(), notifyAppReady: vi.fn(), getMissingBundleFiles: vi.fn(), addListener: vi.fn(),
  list: vi.fn(), delete: vi.fn(),
}));
const enabled = vi.hoisted(() => ({ value: true }));
const activity = vi.hoisted(() => ({ listener: null as (() => void) | null, active: true }));
const haptic = vi.hoisted(() => vi.fn());
vi.mock('../src/platform/liveUpdate.js', async importOriginal => ({
  ...await importOriginal<typeof LiveUpdateModule>(), updater, liveUpdateEnabled: () => enabled.value,
}));
vi.mock('../src/platform/updateGate.js', async importOriginal => ({
  ...await importOriginal<typeof UpdateGateModule>(), shellBuild: () => '16',
}));
vi.mock('../src/platform/activity.js', () => ({
  isAppActive: () => activity.active,
  watchAppActivity: (listener: () => void) => { activity.listener = listener; return () => { activity.listener = null; }; },
}));
vi.mock('../src/lib/haptics.js', () => ({ haptic }));
vi.mock('../src/brand/OpeningScene.js', () => ({ OpeningScene: () => <div /> }));

const { LiveUpdateGate, UpdateReadyCard } = await import('../src/shell/LiveUpdate.js');

function serve(latest: unknown): void {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === `${API}/ota/latest.json`) return Promise.resolve(new Response(JSON.stringify(latest)));
    if (url === `${API}/ota/${NEXT}/manifest.json`) return Promise.resolve(new Response(JSON.stringify({ version: NEXT, files })));
    return Promise.resolve(new Response('', { status: 404 }));
  }));
}
const newer = { version: NEXT, minShell: 16, manifest: `/ota/${NEXT}/manifest.json` };

beforeEach(() => {
  vi.stubEnv('VITE_ASTERA_API_URL', API);
  vi.stubEnv('VITE_ASTERA_RELEASE', 'a'.repeat(40));
  enabled.value = true;
  localStorage.clear();
  updater.download.mockResolvedValue({ id: 'bundle-9' });
  updater.set.mockResolvedValue(undefined);
  updater.notifyAppReady.mockResolvedValue({});
  updater.getMissingBundleFiles.mockResolvedValue({ missing: files });
  updater.list.mockResolvedValue({ bundles: [] });
  updater.delete.mockResolvedValue(undefined);
  updater.addListener.mockImplementation((_event: string, listener: (state: { percent: number }) => void) => {
    listener({ percent: 50 });
    return Promise.resolve({ remove: () => Promise.resolve() });
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });

/** OTA F3: the opening asks for the newest release; a newer one downloads on the same scene and the game restarts into it. */
describe('the opening update check', () => {
  it('opens the game at once where there is no live update (the web, live reload)', () => {
    enabled.value = false;
    serve(newer);
    render(<LiveUpdateGate><p>game</p></LiveUpdateGate>);
    expect(screen.getByText('game')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opens the game when the phone already runs the newest release, and tells the updater the bundle works', async () => {
    serve({ ...newer, version: 'a'.repeat(40) });
    render(<LiveUpdateGate><p>game</p></LiveUpdateGate>);
    expect(await screen.findByText('game')).toBeTruthy();
    expect(updater.notifyAppReady).toHaveBeenCalledOnce();
  });

  it('downloads a newer release on the opening scene, with its size and progress, then restarts into it', async () => {
    serve(newer);
    render(<LiveUpdateGate><p>game</p></LiveUpdateGate>);
    expect(await screen.findByText('Downloading update · 2.4 MB')).toBeTruthy();
    await act(async () => { await Promise.resolve(); });
    expect(updater.set).toHaveBeenCalledWith({ id: 'bundle-9' });
    expect(haptic).toHaveBeenCalledWith('commit');
    expect(localStorage.getItem('astera.ota.pending')).toBe(NEXT);
    expect(screen.queryByText('game')).toBeNull();
  });

  it('says it applies the update, not a size, when the phone already holds every file', async () => {
    serve(newer);
    updater.getMissingBundleFiles.mockResolvedValue({ missing: [] });
    render(<LiveUpdateGate><p>game</p></LiveUpdateGate>);
    expect(await screen.findByText('Applying update')).toBeTruthy();
    expect(screen.queryByText(/MB/u)).toBeNull();
  });

  it('opens the game when the download stops moving, and does not restart it when the download lands later', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    serve(newer);
    let land: (value: { id: string }) => void = () => undefined;
    updater.download.mockReturnValue(new Promise(resolve => { land = resolve; }));
    render(<LiveUpdateGate><p>game</p></LiveUpdateGate>);
    expect(await screen.findByText('Downloading update · 2.4 MB')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(21_000); await Promise.resolve(); });
    expect(await screen.findByText('game')).toBeTruthy();
    await act(async () => { land({ id: 'bundle-9' }); await new Promise(resolve => { setTimeout(resolve, 0); }); });
    expect(updater.set).not.toHaveBeenCalled();
    expect(screen.getByText('game')).toBeTruthy();
  });

  it('opens the game with the bundle it has when the download fails', async () => {
    serve(newer);
    updater.download.mockRejectedValue(new Error('offline'));
    render(<LiveUpdateGate><p>game</p></LiveUpdateGate>);
    expect(await screen.findByText('game')).toBeTruthy();
    expect(updater.set).not.toHaveBeenCalled();
  });
});

describe('a rules change before its release is published', () => {
  it('keeps looking while the store screen shows, and takes the release once the deploy publishes it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    serve({ ...newer, version: 'a'.repeat(40) });
    render(<LiveUpdateGate retryMs={30_000}><p>store screen</p></LiveUpdateGate>);
    expect(await screen.findByText('store screen')).toBeTruthy();
    serve(newer);
    await act(async () => { vi.advanceTimersByTime(30_000); await new Promise(resolve => { setTimeout(resolve, 0); }); });
    expect(await screen.findByText('Downloading update · 2.4 MB')).toBeTruthy();
    await act(async () => { await Promise.resolve(); });
    expect(updater.set).toHaveBeenCalledWith({ id: 'bundle-9' });
  });

  it('does not keep looking from the open game', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    serve({ ...newer, version: 'a'.repeat(40) });
    render(<LiveUpdateGate><p>game</p></LiveUpdateGate>);
    expect(await screen.findByText('game')).toBeTruthy();
    const asked = vi.mocked(fetch).mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(120_000); await Promise.resolve(); });
    expect(vi.mocked(fetch).mock.calls.length).toBe(asked);
  });
});

describe('a release published while the game is open, when the switch is refused', () => {
  it('takes the card away instead of failing unseen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    serve(newer);
    updater.set.mockRejectedValue(new Error('id does not exist'));
    render(<UpdateReadyCard />);
    vi.setSystemTime(Date.now() + 31 * 60_000);
    await act(async () => { activity.listener?.(); await new Promise(resolve => { setTimeout(resolve, 0); }); });
    fireEvent.click(await screen.findByRole('button', { name: 'Restart' }));
    await act(async () => { await new Promise(resolve => { setTimeout(resolve, 0); }); });
    expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
    expect(localStorage.getItem('astera.ota.pending')).toBeNull();
  });
});

describe('a release published while the game is open', () => {
  it('waits in the background and lets the player choose the restart', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    serve(newer);
    render(<UpdateReadyCard />);
    await act(async () => { activity.listener?.(); await Promise.resolve(); });
    expect(fetch).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + 31 * 60_000);
    await act(async () => { activity.listener?.(); await new Promise(resolve => { setTimeout(resolve, 0); }); });
    const restart = await screen.findByRole('button', { name: 'Restart' });
    expect(screen.getByText('Update ready')).toBeTruthy();
    expect(updater.set).not.toHaveBeenCalled();
    fireEvent.click(restart);
    await act(async () => { await Promise.resolve(); });
    expect(updater.set).toHaveBeenCalledWith({ id: 'bundle-9' });
  });
});
