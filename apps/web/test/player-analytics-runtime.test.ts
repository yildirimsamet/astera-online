import { analyticsBatchSchema } from '../src/api/analyticsSchemas.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyticsChoice, chooseAnalytics, ANALYTICS_CHOICE_EVENT } from '../src/lib/playerAnalytics/preference.js';
import { startPlayerAnalytics, observe, syncAnalyticsIdentity, recordAnalyticsFrame } from '../src/lib/playerAnalytics/runtime.js';
import { watchAppActivity } from '../src/platform/activity.js';

const urlText = (url: RequestInfo | URL): string => typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
const bodyText = (body: BodyInit | null | undefined): string => typeof body === 'string' ? body : '';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_ASTERA_PLAYER_ANALYTICS', '1'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const delivery = () => vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ visitorId: crypto.randomUUID(),
  credential: 'a'.repeat(43), expiresAt: new Date(Date.now() + 86_400_000).toISOString() }), { status: 201 })));
describe('runtime consent and lifecycle', () => {
  it('starts without a permission dialog, keeps identifiers in memory and opens a separate scope on sign-in', async () => {
    sessionStorage.setItem('astera.player-analytics.v1', 'obsolete-queue');
    localStorage.setItem('astera.school-observation.v1', 'obsolete-training-identity');
    const fetch = delivery(); vi.stubGlobal('fetch', fetch); const stop = startPlayerAnalytics();
    try {
      await vi.waitFor(() => { expect(fetch).toHaveBeenCalledTimes(1); });
      expect(sessionStorage.getItem('astera.player-analytics.v1')).toBeNull();
      expect(localStorage.getItem('astera.school-observation.v1')).toBeNull();
      const firstBody = fetch.mock.calls[0]?.[1]?.body;
      expect(typeof firstBody === 'string' ? JSON.parse(firstBody) : null).toMatchObject({ scope: 'anonymous', policyVersion: 1 });
      syncAnalyticsIdentity('A', 'token-a');
      await vi.waitFor(() => { expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2); });
      expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST').at(-1)?.[1]?.headers).toMatchObject({ authorization: 'Bearer token-a' });
      expect(sessionStorage.getItem('astera.player-analytics.v1')).toBeNull();
    } finally { stop(); }
  });
  it('does not inherit Google permission and ignores malformed first-party choices', () => {
    localStorage.setItem('astera.consent', JSON.stringify({ decision: 'granted', version: 1 }));
    expect(analyticsChoice()).toBeNull();
    localStorage.setItem('astera.player-analytics.choice', JSON.stringify({ version: 0, decision: 'granted' }));
    expect(analyticsChoice()).toBeNull();
    const listener = vi.fn(); window.addEventListener(ANALYTICS_CHOICE_EVENT, listener);
    chooseAnalytics('denied'); expect(analyticsChoice()).toBe('denied'); expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(ANALYTICS_CHOICE_EVENT, listener);
  });
  it('starts only after an explicit choice and stops capture on withdrawal', async () => {
    chooseAnalytics('denied'); const fetch = delivery(); vi.stubGlobal('fetch', fetch);
    const stop = startPlayerAnalytics();
    observe('game_ready'); expect(fetch).not.toHaveBeenCalled();
    chooseAnalytics('granted'); await vi.waitFor(() => { expect(fetch).toHaveBeenCalledOnce(); });
    await new Promise(resolve => setTimeout(resolve, 0));
    syncAnalyticsIdentity('A', 'token'); observe('surface_visible', { surface: 'fleet' });
    await vi.waitFor(() => { expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2); });
    await new Promise(resolve => setTimeout(resolve, 0));
    chooseAnalytics('denied'); observe('surface_visible', { surface: 'base' });
    await vi.waitFor(() => { expect(fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true); });
    expect(sessionStorage.length).toBe(0); stop();
  });
  it('obeys the build kill switch even with a saved permission', () => {
    vi.stubEnv('VITE_ASTERA_PLAYER_ANALYTICS', '0'); chooseAnalytics('granted');
    const fetch = delivery(); vi.stubGlobal('fetch', fetch);
    const stop = startPlayerAnalytics(); observe('game_ready');
    expect(fetch).not.toHaveBeenCalled(); stop();
  });
});

it('does not enable observations in an unsupported native host', async () => {
  chooseAnalytics('granted');
  const { Capacitor } = await import('@capacitor/core');
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('other');
  const fetch = delivery(); vi.stubGlobal('fetch', fetch);
  const stop = startPlayerAnalytics();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetch).not.toHaveBeenCalled(); stop();
});

it('records install confirmation and WebGL loss as bounded codes, without a URL', async () => {
  chooseAnalytics('granted'); const fetch = delivery(); vi.stubGlobal('fetch', fetch);
  const stop = startPlayerAnalytics();
  await new Promise(resolve => setTimeout(resolve, 0));
  window.dispatchEvent(new Event('appinstalled'));
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  canvas.dispatchEvent(new Event('webglcontextlost'));
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pagehide'));
  await vi.waitFor(() => { expect(fetch.mock.calls.some(([url]) => urlText(url).endsWith('/events'))).toBe(true); });
  const delivered = bodyText(fetch.mock.calls.find(([url]) => urlText(url).endsWith('/events'))?.[1]?.body);
  expect(delivered).toContain('install_result'); expect(delivered).toContain('webgl_context_lost');
  canvas.remove(); stop();
});

it('clears optional training identity on withdrawal even outside the academy', () => {
  localStorage.setItem('astera.school-observation.v1', 'optional-observation');
  localStorage.setItem('astera.flight-school.v1', 'game-recovery');
  chooseAnalytics('denied');
  expect(localStorage.getItem('astera.school-observation.v1')).toBeNull();
  expect(localStorage.getItem('astera.flight-school.v1')).toBe('game-recovery');
});

it('announces a fresh scope and resumes foreground capture after account switching without waiting for visibility change', async () => {
  chooseAnalytics('granted'); const fetch = delivery(); vi.stubGlobal('fetch', fetch);
  const announced = vi.fn(); window.addEventListener('astera:analytics-ready', announced);
  const stop = startPlayerAnalytics();
  try {
    await vi.waitFor(() => { expect(announced).toHaveBeenCalledTimes(1); });
    syncAnalyticsIdentity('A', 'token-a'); syncAnalyticsIdentity('B', 'token-b');
    await vi.waitFor(() => { expect(announced).toHaveBeenCalledTimes(2); });
    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => { expect(fetch.mock.calls.some(([url]) => urlText(url).endsWith('/events'))).toBe(true); });
    const delivered = fetch.mock.calls.find(([url]) => urlText(url).endsWith('/events'));
    expect(delivered?.[1]?.headers).toMatchObject({ authorization: 'Bearer token-b' });
    expect(bodyText(delivered?.[1]?.body)).toContain('foreground_started');
  } finally { stop(); window.removeEventListener('astera:analytics-ready', announced); }
});
it('keeps an optional observation failure out of the rendered game', async () => {
  chooseAnalytics('granted'); vi.stubGlobal('fetch', delivery()); const stop = startPlayerAnalytics();
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => { throw new Error('Observation identifier unavailable'); });
    expect(() => { observe('surface_visible', { surface: 'base' }); }).not.toThrow();
  } finally { stop(); }
});

it('keeps game lifecycle subscribers running when foreground observation fails', async () => {
  vi.stubGlobal('fetch', delivery());
  const stop = startPlayerAnalytics();
  let stopGame: (() => void) | undefined;
  const visibility = vi.spyOn(document, 'visibilityState', 'get');
  const preventExpectedError = (event: ErrorEvent) => { event.preventDefault(); };
  window.addEventListener('error', preventExpectedError);
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const gameActivity = vi.fn(); stopGame = watchAppActivity(gameActivity);
    vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => { throw new Error('Observation identifier unavailable'); });
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(gameActivity).toHaveBeenCalledTimes(1);
  } finally {
    visibility.mockRestore(); stopGame?.(); stop(); window.removeEventListener('error', preventExpectedError);
  }
});

it('limits repeated error detail and reports suppressed counts instead of flooding the queue', async () => {
  vi.useFakeTimers(); chooseAnalytics('granted'); const fetch = delivery(); vi.stubGlobal('fetch', fetch);
  const stop = startPlayerAnalytics();
  try {
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 12; i++) observe('client_error', { code: 'react_render' });
    await vi.advanceTimersByTimeAsync(60000);
    const body = fetch.mock.calls.find(([url]) => urlText(url).endsWith('/events'))?.[1]?.body;
    expect((bodyText(body).match(/"name":"client_error"/g) ?? []).length).toBe(5);
    const batch = analyticsBatchSchema.parse(JSON.parse(bodyText(body)));
    expect(batch.events.find(event => event.name === 'performance_summary' && event.properties.phase === 'errors_suppressed'))
      .toMatchObject({ properties: { code: 'react_render', phase: 'errors_suppressed', count: 7 } });
  } finally { stop(); }
});
it('starts a separate frame sample when the product mode changes', async () => {
  vi.useFakeTimers(); chooseAnalytics('granted'); const fetch = delivery(); vi.stubGlobal('fetch', fetch);
  const stop = startPlayerAnalytics();
  try {
    await vi.advanceTimersByTimeAsync(0);
    observe('load_phase', { phase: 'rehearsing' }, 'training'); recordAnalyticsFrame(0); recordAnalyticsFrame(16);
    observe('load_phase', { phase: 'ready' }, 'live'); recordAnalyticsFrame(100); recordAnalyticsFrame(200);
    await vi.advanceTimersByTimeAsync(60000);
    const body = fetch.mock.calls.find(([url]) => urlText(url).endsWith('/events'))?.[1]?.body;
    const batch = analyticsBatchSchema.parse(JSON.parse(bodyText(body)));
    expect(batch.events.find(event => event.name === 'performance_summary' && event.properties.phase === 'galaxy_frame_p95_ms'))
      .toMatchObject({ mode: 'live', properties: { phase: 'galaxy_frame_p95_ms', count: 1, value: 104 } });
  } finally { stop(); }
});
