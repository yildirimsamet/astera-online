import { PlayerAnalytics } from './client.js';
import { analyticsAvailable, analyticsChoice, ANALYTICS_CHOICE_EVENT } from './preference.js';
import { analyticsCampaignSchema, type AnalyticsEvent, type AnalyticsName, type AnalyticsProperties } from '../../api/analyticsSchemas.js';
import { isAppActive, watchAppActivity } from '../../platform/activity.js';
import { runtime } from '../../platform/runtime.js';
import i18n from '../../i18n/index.js';
import { FrameObservations } from './performance.js';

let client: PlayerAnalytics | null = null;
let identity: { accountId: string | null; token: string | null } = { accountId: null, token: null };
let running = false;
let frames = new FrameObservations();
let frameScope = '';
const errors = new Map<string, { details: number; suppressed: number }>();
export function recordAnalyticsFrame(at: number): void { if (analyticsRecording()) frames.frame(at, isAppActive()); }
export const ANALYTICS_READY_EVENT = 'astera:analytics-ready';
let readToken: (() => string | null) | undefined;
export const analyticsRecording = (): boolean => client?.recording === true;
export const analyticsHeaders = (): Record<string, string> => client?.headers() ?? {};
export function observe(name: AnalyticsName, properties: AnalyticsProperties = {}, mode?: AnalyticsEvent['mode']): void {
  try {
    if (readToken) client?.identity(identity.accountId, readToken());
    if (name === 'load_phase') {
      const scope = `${mode ?? 'live'}:${properties.phase ?? ''}`;
      if (scope !== frameScope) { frameScope = scope; frames = new FrameObservations(); }
    }
    if (name === 'client_error' && analyticsRecording()) {
      const code = properties.code ?? 'unknown';
      const key = errors.has(code) || errors.size < 16 ? code : 'other';
      const count = errors.get(key) ?? { details: 0, suppressed: 0 };
      errors.set(key, count);
      if (count.details >= 5) { count.suppressed = Math.min(10000, count.suppressed + 1); return; }
      count.details++;
    }
    client?.record(name, properties, mode);
  } catch { /* Optional observation must never become a gameplay or render failure. */ }
}
export function syncAnalyticsIdentity(accountId: string | null, token: string | null | (() => string | null)): void {
  readToken = typeof token === 'function' ? token : undefined;
  identity = { accountId, token: typeof token === 'function' ? token() : token }; client?.identity(accountId, identity.token);
}
/** Single app owner; training uses its own API, but observes through this same recording boundary. */
export function startPlayerAnalytics(): () => void {
  if (running || !analyticsAvailable() || runtime() === 'unsupported-native') return () => undefined;
  try { sessionStorage.removeItem('astera.player-analytics.v1'); localStorage.removeItem('astera.school-observation.v1'); }
  catch { /* Remove obsolete optional identities without touching game recovery or requiring storage. */ }
  running = true;
  let active = true;
  let permitted = analyticsChoice() !== 'denied';
  const canRecord = () => active && permitted;
  let stopActivity: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const activity = () => {
    try { client?.foreground(isAppActive()); }
    catch { /* Shared lifecycle publication must continue to gameplay subscribers. */ }
  };
  const interact = (event: Event) => { if (event.isTrusted) client?.interact(); };
  const suspend = () => { client?.foreground(false); };
  const online = () => { observe('network_recovered'); void client?.flush(); };
  const error = () => { observe('client_error', { code: 'unhandled_error' }); };
  const rejection = () => { observe('client_error', { code: 'unhandled_rejection' }); };
  const installed = () => { observe('install_result', { code: 'installed' }); };
  const installOffered = () => { observe('install_offer', { code: 'browser_prompt' }); };
  const contextLost = () => { observe('client_error', { code: 'webgl_context_lost' }); };
  const detach = () => {
    stopActivity?.(); stopActivity = undefined; clearInterval(timer);
    window.removeEventListener('pointerdown', interact); window.removeEventListener('keydown', interact);
    window.removeEventListener('pagehide', suspend); window.removeEventListener('pageshow', activity);
    window.removeEventListener('online', online); window.removeEventListener('error', error);
    window.removeEventListener('unhandledrejection', rejection);
    window.removeEventListener('appinstalled', installed); window.removeEventListener('beforeinstallprompt', installOffered);
    document.removeEventListener('webglcontextlost', contextLost, true);
  };
  const apply = async () => {
    if (!permitted) { detach(); frames = new FrameObservations(); const previous = client; client = null; await previous?.disable(); return; }
    client ??= new PlayerAnalytics({ fetch: globalThis.fetch.bind(globalThis), now: Date.now,
        // Measurement identifiers and unsent observations live only in this page's memory.
        monotonic: () => performance.now(), baseUrl: import.meta.env.VITE_ASTERA_API_URL ?? '',
        onReady: owner => {
          if (!canRecord() || client !== owner) return;
          frames = new FrameObservations(); frameScope = ''; errors.clear(); owner.foreground(isAppActive());
          window.dispatchEvent(new Event(ANALYTICS_READY_EVENT));
        }, resume: false });
    const own = client;
    own.identity(identity.accountId, identity.token);
    // Capture only the campaign allowlist, never a full URL, query or referrer.
    const params = new URLSearchParams(location.search);
    const campaign = analyticsCampaignSchema.safeParse(Object.fromEntries(
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .flatMap(key => params.has(key) ? [[key, params.get(key)]] : [])));
    const platform = runtime();
    if (platform === 'unsupported-native') return;
    await own.enable({ platform, locale: i18n.resolvedLanguage ?? 'en',
      build: import.meta.env.VITE_ASTERA_REVISION ?? 'development', campaign: campaign.success ? campaign.data : {} });
    if (!canRecord() || client !== own) return;
    detach(); stopActivity = watchAppActivity(activity); activity();
    window.addEventListener('pointerdown', interact, { passive: true }); window.addEventListener('keydown', interact);
    window.addEventListener('pagehide', suspend); window.addEventListener('pageshow', activity);
    window.addEventListener('online', online); window.addEventListener('error', error);
    window.addEventListener('unhandledrejection', rejection);
    window.addEventListener('appinstalled', installed); window.addEventListener('beforeinstallprompt', installOffered);
    document.addEventListener('webglcontextlost', contextLost, true);
    timer = setInterval(() => {
      if (!own.recording) { void apply(); return; }
      const performance = frames.take();
      if (performance) observe('performance_summary', { ...performance, phase: 'galaxy_frame_p95_ms' });
      for (const [code, count] of errors) if (count.suppressed) {
        observe('performance_summary', { code, count: count.suppressed, phase: 'errors_suppressed' }); count.suppressed = 0;
      }
      own.identity(identity.accountId, readToken ? readToken() : identity.token); own.heartbeat(); void own.flush();
    }, 60_000);
  };
  const changed = (event: Event) => {
    permitted = event instanceof CustomEvent ? event.detail !== 'denied' : analyticsChoice() !== 'denied';
    void apply();
  };
  const stored = (event: StorageEvent) => { if (event.key === 'astera.player-analytics.choice' || event.key === null) changed(event); };
  window.addEventListener(ANALYTICS_CHOICE_EVENT, changed); window.addEventListener('storage', stored);
  void apply();
  return () => {
    active = false; running = false; detach();
    window.removeEventListener(ANALYTICS_CHOICE_EVENT, changed); window.removeEventListener('storage', stored);
    void client?.disable(false); client = null; readToken = undefined; identity = { accountId: null, token: null };
  };
}
