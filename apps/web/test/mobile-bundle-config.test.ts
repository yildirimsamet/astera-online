// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mobileBuild } from '../mobileBuild.js';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('bundled mobile configuration', () => {
  it('keeps the ordinary web build independent of native API configuration', () => {
    expect(mobileBuild({})).toEqual({ target: 'web' });
  });
  it.each(['native-staging', 'native-production'])('pins an HTTPS API origin for %s', target => {
    expect(mobileBuild({ VITE_ASTERA_PLATFORM: target, VITE_ASTERA_API_URL: 'https://api.example.test/' }))
      .toMatchObject({ target, apiUrl: 'https://api.example.test', webDir: `mobile-dist/${target}` });
  });
  it('names the bundled build for the update gate: versionCode, or 1 for a debug package', () => {
    const production = { VITE_ASTERA_PLATFORM: 'native-production', VITE_ASTERA_API_URL: 'https://api.example.test/' };
    expect(mobileBuild(production)).toMatchObject({ nativeBuild: '1' });
    expect(mobileBuild({ ...production, VITE_ASTERA_NATIVE_BUILD: '12' })).toMatchObject({ nativeBuild: '12' });
    for (const bad of ['0', 'abc', '1.2', '01', '99999999999']) {
      expect(() => mobileBuild({ ...production, VITE_ASTERA_NATIVE_BUILD: bad })).toThrow(/build/i);
    }
  });
  it('isolates the bundled local package from the live-reload package', () => {
    expect(mobileBuild({ VITE_ASTERA_PLATFORM: 'native-local', VITE_ASTERA_API_URL: 'http://localhost:3100' }))
      .toMatchObject({ appId: 'space.asteraonline.app.local', androidScheme: 'http', cleartext: true });
  });
  it.each(['', 'http://api.example.test', 'https://user:secret@api.example.test', 'https://api.example.test/v1',
    'https://api.example.test?secret=1', 'https://api.example.test/#x', 'file:///tmp/api', 'https://localhost', 'https://127.0.0.1'])(
  'rejects a missing, insecure or ambiguous remote API: %s', apiUrl => {
    expect(() => mobileBuild({ VITE_ASTERA_PLATFORM: 'native-production', VITE_ASTERA_API_URL: apiUrl })).toThrow(/API/i);
  });
  it.each(['http://192.168.1.5:3100', 'http://localhost.evil.test:3100', 'http://127.0.0.1:3100'])('keeps the HTTP exception narrow: %s', apiUrl => {
    expect(() => mobileBuild({ VITE_ASTERA_PLATFORM: 'native-local', VITE_ASTERA_API_URL: apiUrl })).toThrow(/API/i);
  });
  it('configures a bundled host without a remote document or general HTTP patch', async () => {
    vi.stubEnv('ASTERA_MOBILE_DEBUG', '');
    vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-staging');
    vi.stubEnv('VITE_ASTERA_API_URL', 'https://api.example.test');
    const { default: config } = await import('../capacitor.config.js');
    expect(config.server?.url).toBeUndefined();
    expect(config.server?.cleartext).toBe(false);
    expect(config.server?.errorPath).toBe('assets/native-startup.html');
    expect(config.server?.allowNavigation ?? []).toEqual([]);
    expect(config.webDir).toBe('mobile-dist/native-staging');
    expect(config.plugins?.CapacitorHttp).toEqual({ enabled: false });
    expect(config.plugins?.AsteraSession).toMatchObject({ apiUrl: 'https://api.example.test', target: 'native-staging' });
    expect(config.android?.loggingBehavior).toBe('none');
    expect(config.plugins?.App).toMatchObject({ disableBackButtonHandler: true });
    expect(config.plugins?.SystemBars).toMatchObject({ hidden: true, style: 'DARK', insetsHandling: 'css' });
  });
});
