import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('the local Android wrapper configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('ASTERA_MOBILE_DEBUG', '1');
    vi.stubEnv('ASTERA_MOBILE_DEV_URL', '');
  });

  afterEach(() => { vi.unstubAllEnvs(); });

  it('opens the current working tree through the USB-reversed Vite server', async () => {
    const { default: config } = await import('../capacitor.config.js');
    expect(config.server?.url).toBe('http://localhost:5173');
    expect(config.server?.cleartext).toBe(true);
    expect(config.appId).toBe('space.asteraonline.app.debug');
    expect(config.plugins?.App).toMatchObject({ disableBackButtonHandler: true });
    expect(config.plugins?.SystemBars).toMatchObject({ hidden: true, style: 'DARK', insetsHandling: 'css' });
  });

  it('refuses to configure a remote-URL app without an explicit debug opt-in', async () => {
    vi.stubEnv('ASTERA_MOBILE_DEBUG', '');
    await expect(import('../capacitor.config.js')).rejects.toThrow(/debug/i);
  });

  it('can reach a local computer over Wi-Fi when USB is unavailable', async () => {
    vi.stubEnv('ASTERA_MOBILE_DEV_URL', 'http://192.168.1.24:5173');
    const { default: config } = await import('../capacitor.config.js');
    expect(config.server?.url).toBe('http://192.168.1.24:5173');
  });

  it.each([
    'http://127.0.0.1:5173',
    'http://10.0.0.8:5173',
    'http://172.16.0.8:5173',
    'http://172.31.255.8:5173',
    'http://[::1]:5173',
  ])('accepts a loopback or private network development URL: %s', async (url) => {
    vi.stubEnv('ASTERA_MOBILE_DEV_URL', url);
    const { default: config } = await import('../capacitor.config.js');
    expect(config.server?.url).toBe(url);
  });

  it.each([
    'https://asteraonline.space',
    'http://192.168.1.24.evil.example:5173',
    'http://172.32.0.1:5173',
    'http://user:password@localhost:5173',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://localhost:5173/api',
    'http://localhost:5173/?token=secret',
    'http://localhost:5173/#secret',
    'not-a-url',
  ])('rejects a non-local or ambiguous development URL: %s', async (url) => {
    vi.stubEnv('ASTERA_MOBILE_DEV_URL', url);
    await expect(import('../capacitor.config.js')).rejects.toThrow(/local development URL/i);
  });
});
