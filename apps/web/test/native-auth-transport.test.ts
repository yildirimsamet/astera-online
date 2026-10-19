import type { CommunityPolicyConsent } from '../src/api/communityPolicySchemas.js';
import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { createNativeAuthTransport, type AuthTransport, type NativeSessionPlugin } from '../src/platform/authTransport.js';

const session = { accountId: 'native-account', username: 'pilot', displayName: 'Pilot', country: 'TR', accessToken: 'short-native-access' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('native auth without changing web fetch or buffering SSE', () => {
  function harness() {
    const request = vi.fn<AuthTransport['request']>().mockImplementation(() => Promise.resolve(json(session)));
    const clear = vi.fn<AuthTransport['clear']>().mockResolvedValue(undefined);
    const fetcher = vi.fn<typeof fetch>();
    const api = new Api({ fetch: fetcher, baseUrl: 'https://asteraonline.space', authTransport: { request, clear } });
    return { api, request, clear, fetcher };
  }

  it('sends login/register/refresh/logout to the explicit session transport', async () => {
    const { api, request, fetcher } = harness();
    await api.login('pilot', 'password-for-native');
    expect(request).toHaveBeenCalledWith('/api/auth/login', { username: 'pilot', password: 'password-for-native' });
    await api.register('pilot', 'password-for-native', 'TR', policyProof);
    expect(request).toHaveBeenCalledWith('/api/auth/register', { username: 'pilot', password: 'password-for-native', countryCode: 'TR', communityPolicyVersion: COMMUNITY_POLICY_VERSION, communityPolicyLocale: 'en' });
    expect(await api.restore()).toBe(true);
    expect(request).toHaveBeenCalledWith('/api/auth/refresh', undefined);
    request.mockResolvedValueOnce(json({ ok: true }));
    await api.logout();
    expect(request).toHaveBeenCalledWith('/api/auth/logout', undefined);
    expect(api.accessToken).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps normal API requests on bearer fetch with cookies omitted', async () => {
    const { api, fetcher } = harness();
    await api.login('pilot', 'password-for-native');
    fetcher.mockResolvedValueOnce(json({ servers: [], placement: null }));
    await api.servers();
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://asteraonline.space/api/servers');
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer short-native-access');
  });

  it('uses one native refresh for concurrent 401s and never sends a browser refresh cookie', async () => {
    const { api, request, fetcher } = harness();
    await api.login('pilot', 'password-for-native');
    fetcher.mockResolvedValueOnce(json({ error: 'UNAUTHENTICATED', message: 'Expired' }, 401))
      .mockResolvedValueOnce(json({ error: 'UNAUTHENTICATED', message: 'Expired' }, 401))
      .mockImplementation(() => Promise.resolve(json({ servers: [], placement: null })));
    request.mockClear();
    await Promise.all([api.servers(), api.servers()]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/api/auth/refresh', undefined);
    for (const [, init] of fetcher.mock.calls) expect(init?.credentials).toBe('omit');
  });

  it('drops a delayed native restore after logout without adopting its access token', async () => {
    const { api, request } = harness();
    let release: ((response: Response) => void) | undefined;
    request.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const restore = api.restore();
    request.mockResolvedValueOnce(json({ ok: true }));
    await api.logout();
    if (!release) throw new Error('Native restore did not start');
    release(json(session));
    expect(await restore).toBe(false);
    expect(api.accessToken).toBeNull();
  });

  it('keeps native credentials after a temporary outage and clears them on a terminal session end', async () => {
    const { api, request, clear } = harness();
    await api.login('pilot', 'password-for-native');
    request.mockResolvedValueOnce(json({ error: 'UNREACHABLE', message: 'Try again' }, 503));
    await expect(api.restore()).rejects.toMatchObject({ status: 503 });
    expect(api.accessToken).toBe(session.accessToken);
    expect(clear).not.toHaveBeenCalled();
    api.endSession('email');
    expect(clear).toHaveBeenCalledOnce();
    expect(api.accessToken).toBeNull();
  });

  it('keeps web cookie requests when no native auth transport was selected', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(session));
    const api = new Api({ fetch: fetcher, authTransport: null });
    await api.login('pilot', 'password-for-native');
    expect(fetcher).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ credentials: 'same-origin' }));
  });
});

describe('native plugin selection', () => {
  it('keeps live-reload on its same-origin web session transport', () => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', 'web');
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    expect(createNativeAuthTransport()).toBeNull();
  });

  it('fails closed when a native bundle has no native session plugin', async () => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-staging');
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const transport = createNativeAuthTransport();
    expect(transport).not.toBeNull();
    const response = await transport?.request('/api/auth/refresh');
    expect(response?.status).toBe(503);
  });

  it('fails closed when Android has no modern bridge object after removal of the legacy fallback', async () => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-local');
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
    const native: NativeSessionPlugin = { request: vi.fn().mockResolvedValue({ status: 200, body: session }), clear: vi.fn() };
    const response = await createNativeAuthTransport(native)?.request('/api/auth/refresh');
    expect(response?.status).toBe(503);
    expect(native.request).not.toHaveBeenCalled();
  });

  it('accepts only public session data and exposes the server clock', async () => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-staging');
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
    const native: NativeSessionPlugin = { request: vi.fn().mockResolvedValue({ status: 200, body: session, serverTime: '1234' }), clear: vi.fn() };
    const response = await createNativeAuthTransport(native)?.request('/api/auth/login', { username: 'pilot', password: 'private' });
    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-server-time')).toBe('1234');
    expect(await response?.json()).toEqual(session);
    expect(response?.headers.has('set-cookie')).toBe(false);
    vi.mocked(native.request).mockResolvedValueOnce({ status: 200, body: { ...session, refreshToken: 'must-never-cross-the-native-bridge' } });
    expect((await createNativeAuthTransport(native)?.request('/api/auth/refresh'))?.status).toBe(503);
  });

  it('bounds a silent bridge failure instead of leaving session restore pending forever', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-staging');
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios');
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
    const native: NativeSessionPlugin = { request: () => new Promise(() => undefined), clear: vi.fn() };
    const done = vi.fn();
    void createNativeAuthTransport(native)?.request('/api/auth/refresh').then(done);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));
  });
});

const policyProof: CommunityPolicyConsent = { version: COMMUNITY_POLICY_VERSION, locale: 'en' };
