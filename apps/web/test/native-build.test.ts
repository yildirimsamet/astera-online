// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../vite.config.js';

afterEach(() => { vi.unstubAllEnvs(); });

function resolveConfig() {
  if (typeof config !== 'function') throw new Error('Expected environment-dependent Vite config');
  return config({ command: 'build', mode: 'production', isSsrBuild: false, isPreview: false });
}

describe('the build-time platform boundary', () => {
  it('keeps web ads, wiki and the web output on a normal build', () => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', 'web');
    const result = resolveConfig();
    expect(result.plugins?.flat().filter(Boolean)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'astera:adsense' }),
      expect.objectContaining({ name: 'astera-public-wiki' }),
    ]));
    expect(result.build?.outDir ?? 'dist').toBe('dist');
    expect(result.html?.cspNonce).toBe('__CSP_NONCE__');
  });

  it.each(['native-local', 'native-staging', 'native-production'])('never injects web ads into %s', target => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', target);
    vi.stubEnv('VITE_ASTERA_API_URL', target === 'native-local' ? 'http://localhost:3100' : 'https://api.example.test');
    const result = resolveConfig();
    expect(result.plugins?.flat().filter(Boolean)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'astera:adsense' }),
    ]));
    expect(result.define?.['import.meta.env.VITE_ASTERA_PLATFORM']).toBe(JSON.stringify(target));
    expect(result.define?.['import.meta.env.VITE_VISUAL_TEST']).toBe(JSON.stringify('0'));
    expect(result.build?.outDir).toBe(`mobile-dist/${target}`);
    expect(result.publicDir).toBe(false);
    expect(result.html?.cspNonce).toBeUndefined();
    expect(result.plugins?.flat().filter(Boolean)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'astera-public-wiki' }),
    ]));
    expect(result.plugins?.flat().filter(Boolean)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'astera-native-bundle' }),
    ]));
  });

  it('rejects misspelled targets rather than silently producing a web ad build', () => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', 'andriod');
    expect(resolveConfig).toThrow(/platform|target/i);
  });
});
