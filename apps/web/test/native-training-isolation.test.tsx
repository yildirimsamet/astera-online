import { Capacitor } from '@capacitor/core';
import type * as CapacitorCore from '@capacitor/core';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { Academy } from '../src/onboarding/Academy.js';
import { Rehearsal } from '../src/onboarding/Rehearsal.js';
import { openAcademy } from '../src/onboarding/academyWorld.js';

const mocks = vi.hoisted(() => ({
  captured: vi.fn<(api: Api) => void>(),
  request: vi.fn(), clear: vi.fn(),
}));
vi.mock('@capacitor/core', async original => {
  const core = await original<typeof CapacitorCore>();
  return { ...core, registerPlugin: (name: string) => name === 'AsteraSession' ? { request: mocks.request, clear: mocks.clear } : core.registerPlugin(name) };
});
// Probe the API provided by the real training component; no WebGL or game UI stubs execute requests.
vi.mock('../src/api/context.js', () => ({ ApiProvider: ({ api }: { api: Api }) => { mocks.captured(api); return null; }, useApi: vi.fn() }));
const session = { accountId: 'real-account', username: 'pilot', displayName: 'Pilot', country: 'TR', accessToken: 'short-access' };
beforeEach(() => {
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-production');
  vi.stubEnv('VITE_ASTERA_API_URL', 'https://asteraonline.space');
  vi.stubGlobal('androidBridge', {});
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
  vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
  mocks.captured.mockClear(); mocks.request.mockReset().mockResolvedValue({ status: 200, body: session });
  mocks.clear.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); localStorage.clear(); });
const show = (kind: string): Api => {
  if (kind === 'legacy') render(<Rehearsal preview={openAcademy(Date.now()).preview} onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
  else render(<Academy replay={kind === 'replay'} onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
  const api = mocks.captured.mock.lastCall?.[0];
  if (!api) throw new Error('No training API');
  return api;
};
describe.each(['academy', 'replay', 'legacy'])('%s native training isolation', kind => {
  it('keeps ordinary reads local and refuses refresh without opening the live vault', async () => {
    const api = show(kind);
    expect(await api.planet()).toBeDefined();
    await expect(api.restore()).rejects.toMatchObject({ status: 404 });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(api.accessToken).toBeNull();
    expect(api.mediaNeedsBearer).toBe(false);
  });
  it('forgets an exercise without clearing the real native session', () => {
    show(kind).forget();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});
it('retains native authentication on the real shared API client', async () => {
  const api = new Api();
  expect(await api.restore()).toBe(true);
  expect(mocks.request).toHaveBeenCalledWith({ operation: 'refresh' });
});
