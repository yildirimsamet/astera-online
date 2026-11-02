import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { Capacitor } from '@capacitor/core';
import { createNativeAuthTransport, type NativeSessionPlugin } from '../src/platform/authTransport.js';
const observer = vi.hoisted(() => ({ observe: vi.fn<(name: string, properties: Record<string, unknown>, mode?: string) => void>(), analyticsRecording: () => true, syncAnalyticsIdentity: vi.fn(), analyticsHeaders: vi.fn(() => ({ 'x-analytics-visitor': 'v'.repeat(43) })) }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => observer);
beforeEach(() => { vi.clearAllMocks(); observer.analyticsHeaders.mockReturnValue({ 'x-analytics-visitor': 'v'.repeat(43) }); });
afterEach(() => { vi.unstubAllEnvs(); });
it('measures final request latency with a monotonic clock without recording the error message', async () => {
  let now = 10; vi.spyOn(performance, 'now').mockImplementation(() => now);
  const fetch = vi.fn<typeof globalThis.fetch>(() => { now = 150; return Promise.reject(new Error('secret network details')); });
  const api = new Api({ fetch, authTransport: null, observations: true });
  await expect(api.upgrade('CORE')).rejects.toThrow();
  expect(observer.observe).toHaveBeenCalledWith('command_result', expect.objectContaining({ durationMs: 140 }), 'live');
  expect(JSON.stringify(observer.observe.mock.calls)).not.toContain('secret network details');
});
it('observes command failure without a raw body or URL, and attaches only the visit capability', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.reject(new Error('offline')));
  const api = new Api({ fetch, authTransport: null, observations: true });
  await expect(api.upgrade('CORE')).rejects.toThrow();
  expect(observer.observe).toHaveBeenCalledWith('command_attempted', expect.objectContaining({ code: 'upgrade' }), 'live');
  expect(observer.observe).toHaveBeenCalledWith('command_result', expect.objectContaining({ code: 'network', subject: 'upgrade', phase: 'unknown' }), 'live');
  expect(observer.observe.mock.calls.some(([name]) => name === 'command_blocked')).toBe(false);
  expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ 'x-analytics-visitor': 'v'.repeat(43) });
  const attempt = observer.observe.mock.calls.find(([name]) => name === 'command_attempted');
  expect(fetch.mock.calls[0]?.[1]?.headers).toHaveProperty('x-analytics-attempt', attempt?.[1].attemptId);
  expect(JSON.stringify(observer.observe.mock.calls)).not.toContain('/api/');
});

it('does not append a late request result to the next account or visitor scope', async () => {
  let reject: ((error: Error) => void) | undefined;
  const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise((_resolve, refuse) => { reject = refuse; }));
  const api = new Api({ fetch, authTransport: null, observations: true });
  const pending = api.upgrade('CORE').catch(() => undefined);
  observer.analyticsHeaders.mockReturnValue({ 'x-analytics-visitor': 'next'.padEnd(43, 'x') });
  reject?.(new Error('late network failure')); await pending;
  expect(observer.observe.mock.calls.map(([name]) => name)).toEqual(['command_attempted']);
});
it('leaves the isolated training transport outside live request measurements', async () => {
  const api = new Api({ fetch: () => Promise.reject(new Error('training refusal')), authTransport: null, observations: false });
  await expect(api.upgrade('CORE')).rejects.toThrow();
  expect(observer.observe).not.toHaveBeenCalled(); expect(observer.analyticsHeaders).not.toHaveBeenCalled();
});
it('passes the consented visit through native sign-in without putting it in the credentials body', async () => {
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-staging');
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true); vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios');
  const native: NativeSessionPlugin = { request: vi.fn<NativeSessionPlugin['request']>().mockResolvedValue({ status: 200,
    body: { accountId: 'native-account', username: 'pilot', displayName: 'Pilot', country: 'TR', accessToken: 'short-native-access' } }), clear: vi.fn() };
  const api = new Api({ observations: true, authTransport: createNativeAuthTransport(native) });
  await api.login('pilot', 'private-password');
  expect(native.request).toHaveBeenCalledWith({ operation: 'login', body: { username: 'pilot', password: 'private-password' }, analyticsVisitor: 'v'.repeat(43) });
  expect(JSON.stringify(observer.observe.mock.calls)).not.toContain('private-password');
});
it('still submits gameplay when an optional observation identifier cannot be created', async () => {
  vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => { throw new Error('Observation identifier unavailable'); });
  const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.reject(new Error('actual network request')));
  const api = new Api({ observations: true, fetch, authTransport: null });
  await expect(api.upgrade('CORE')).rejects.toThrow('actual network request');
  expect(fetch).toHaveBeenCalledOnce();
});
