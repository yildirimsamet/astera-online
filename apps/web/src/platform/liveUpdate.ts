import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { z } from 'zod';
import { runtime } from './runtime.js';

/**
 * THE APP'S LIVE UPDATE (OTA F3, docs/canli-guncelleme-plani-2026-11-24.md).
 *
 * The server publishes the web bundle of every deploy (`deploy/publish-ota.sh`): `latest.json`
 * names the release, its manifest lists every file by content hash. The app downloads only the
 * files it lacks (`@capgo/capacitor-updater`, manual mode, our own server) and restarts into
 * them. A bundle that never reports ready is rolled back by the updater; this module remembers
 * it so the same release is not tried again.
 */
export interface Updater {
  download: (options: { version: string; url: string; manifest: ManifestEntry[] }) => Promise<{ id: string }>;
  set: (options: { id: string }) => Promise<void>;
  notifyAppReady: () => Promise<unknown>;
  getMissingBundleFiles: (options: { version: string; manifest: ManifestEntry[] }) => Promise<{ missing: { file_name: string | null }[] }>;
  addListener: (event: 'download', listener: (state: { percent: number }) => void) => Promise<{ remove: () => Promise<void> }>;
}
interface ManifestEntry { file_name: string; file_hash: string; download_url: string }

export const updater: Updater = {
  download: options => CapacitorUpdater.download(options),
  set: options => CapacitorUpdater.set(options),
  notifyAppReady: () => CapacitorUpdater.notifyAppReady(),
  getMissingBundleFiles: options => CapacitorUpdater.getMissingBundleFiles(options),
  addListener: (_event, listener) => CapacitorUpdater.addListener('updaterEvent', event => { if (event.type === 'download') listener(event.data); }),
};

const PENDING = 'astera.ota.pending';
const FAILED = 'astera.ota.failed';
const KEEP_FAILED = 5;
const CHECK_MS = 5000;

const commit = z.string().regex(/^[a-f0-9]{40}$/u);
const latestSchema = z.object({ version: commit, minShell: z.number().int().min(1), manifest: z.string().regex(/^\/ota\/[a-f0-9]{40}\/manifest\.json$/u) });
const fileSchema = z.object({ file_name: z.string().min(1), file_hash: z.string().regex(/^[a-f0-9]{64}$/u), download_url: z.string().url(), size: z.number().int().nonnegative() });
const manifestSchema = z.object({ version: commit, files: z.array(fileSchema).min(1) });

export interface Release {
  version: string;
  manifestUrl: string;
  files: z.infer<typeof fileSchema>[];
  /** What this phone still has to download: the files it does not hold already. */
  bytes: number;
}

/** Only a bundled Android app carries the updater; the web and live reload always run the newest code. */
export function liveUpdateEnabled(): boolean {
  return (import.meta.env.VITE_ASTERA_PLATFORM ?? 'web') !== 'web' && runtime() === 'android'
    && Boolean(import.meta.env.VITE_ASTERA_API_URL) && Capacitor.isPluginAvailable('CapacitorUpdater');
}

export function failedReleases(storage: Storage): string[] {
  try {
    const parsed = z.array(commit).safeParse(JSON.parse(storage.getItem(FAILED) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch { return []; }
}

/**
 * At start: did the release installed last time come up? The bundle running now is the answer.
 * Running something else means the updater rolled it back, so it is never offered again.
 */
export function settleLastUpdate(storage: Storage, running: string): 'updated' | 'failed' | null {
  const pending = storage.getItem(PENDING);
  if (pending === null) return null;
  storage.removeItem(PENDING);
  if (pending === running) return 'updated';
  storage.setItem(FAILED, JSON.stringify([...failedReleases(storage).filter(version => version !== pending), pending].slice(-KEEP_FAILED)));
  return 'failed';
}

async function readJson(fetcher: typeof fetch, url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetcher(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`OTA ${url} answered ${String(response.status)}`);
  return response.json();
}

const entry = ({ file_name, file_hash, download_url }: ManifestEntry): ManifestEntry => ({ file_name, file_hash, download_url });

/**
 * The published release when this phone runs another one, or null; never longer than the opening allows.
 * Any other release, older too: the one-step rollback (`publish-ota.sh --restore-previous`) works by it.
 */
export async function findRelease(at: {
  fetch: typeof fetch; apiUrl: string; release: string; shell: string | undefined; storage: Storage; updater: Updater;
}): Promise<Release | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, CHECK_MS);
  try {
    const latest = latestSchema.parse(await readJson(at.fetch, `${at.apiUrl}/ota/latest.json`, controller.signal));
    if (latest.version === at.release || failedReleases(at.storage).includes(latest.version)) return null;
    if (at.shell === undefined || Number(at.shell) < latest.minShell) return null;
    const manifestUrl = `${at.apiUrl}${latest.manifest}`;
    const manifest = manifestSchema.parse(await readJson(at.fetch, manifestUrl, controller.signal));
    if (manifest.version !== latest.version || manifest.files.some(file => !file.download_url.startsWith(`${at.apiUrl}/ota/files/`))) return null;
    const missing = await at.updater.getMissingBundleFiles({ version: latest.version, manifest: manifest.files.map(entry) })
      .then(result => new Set(result.missing.map(file => file.file_name)), () => null);
    const bytes = manifest.files.reduce((sum, file) => sum + (missing === null || missing.has(file.file_name) ? file.size : 0), 0);
    return { version: latest.version, manifestUrl, files: manifest.files, bytes };
  } catch {
    return null;
  } finally { clearTimeout(timer); }
}

/** Downloads a release beside the running bundle; nothing changes until `restartInto`. */
export async function installRelease(release: Release, at: { updater: Updater; storage: Storage; onProgress?: (fraction: number) => void }): Promise<string> {
  const listener = await at.updater.addListener('download', state => { at.onProgress?.(Math.min(1, Math.max(0, state.percent / 100))); });
  try {
    const bundle = await at.updater.download({ version: release.version, url: release.manifestUrl, manifest: release.files.map(entry) });
    return bundle.id;
  } finally { await listener.remove(); }
}

/** Restarts the app into a downloaded release, noting first what the next start should run as. */
export async function restartInto(version: string, id: string, at: { updater: Updater; storage: Storage }): Promise<void> {
  at.storage.setItem(PENDING, version);
  try {
    await at.updater.set({ id });
  } catch (error) {
    // Not switched: a release that never ran must not be remembered as one that failed.
    at.storage.removeItem(PENDING);
    throw error;
  }
}

export function formatMegabytes(bytes: number, language: string): string {
  return `${new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.max(0.1, bytes / 1e6))} MB`;
}
