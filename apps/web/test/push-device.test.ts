import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as PushModule from '../src/platform/push.js';

/** Bildirim Merkezi push (owner 2026-10-31): the phone's FCM address, kept on the server for paid alerts. */
type Listener = (event: { value: string }) => void;
const listeners = new Map<string, Listener[]>();
const plugin = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  createChannel: vi.fn(),
  register: vi.fn(),
  addListener: vi.fn(),
}));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: plugin }));
const caps = vi.hoisted(() => ({ nativePush: true }));
vi.mock('../src/platform/runtime.js', () => ({ capabilities: () => caps }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock('../src/platform/localNotifications.js', () => ({ refreshPhonePermission: refresh }));

/** The module keeps one token and one listener for the app's life: each test starts a fresh app. */
let connectPush: typeof PushModule.connectPush;
let disconnectPush: typeof PushModule.disconnectPush;

/** FCM answers `register()` with the phone's token. */
let fcmToken = 'token-1';
const api = { registerPushDevice: vi.fn(), forgetPushDevice: vi.fn() };
const connect = (ask = false, locale = 'tr') => connectPush(api, { locale, channelName: 'Saldırı uyarıları', ask });

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  ({ connectPush, disconnectPush } = await import('../src/platform/push.js'));
  listeners.clear();
  plugin.addListener.mockImplementation((event: string, listener: Listener) => {
    listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    return Promise.resolve({ remove: vi.fn() });
  });
  plugin.checkPermissions.mockResolvedValue({ receive: 'granted' });
  plugin.requestPermissions.mockResolvedValue({ receive: 'granted' });
  plugin.createChannel.mockResolvedValue(undefined);
  plugin.register.mockImplementation(() => {
    for (const listener of listeners.get('registration') ?? []) listener({ value: fcmToken });
    return Promise.resolve();
  });
  api.registerPushDevice.mockResolvedValue(null);
  api.forgetPushDevice.mockResolvedValue(null);
});
afterEach(() => {
  vi.clearAllMocks();
  caps.nativePush = true;
  fcmToken = 'token-1';
});

describe('connecting the phone', () => {
  it('does nothing where push does not exist', async () => {
    caps.nativePush = false;
    await expect(connect(true)).resolves.toBe('off');
    expect(plugin.checkPermissions).not.toHaveBeenCalled();
  });

  it('never prompts on its own: without the permission it waits', async () => {
    plugin.checkPermissions.mockResolvedValue({ receive: 'prompt' });
    await expect(connect()).resolves.toBe('off');
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
    expect(plugin.register).not.toHaveBeenCalled();
  });

  it('asks when the player asks, and stops at a refusal', async () => {
    plugin.checkPermissions.mockResolvedValue({ receive: 'prompt' });
    plugin.requestPermissions.mockResolvedValue({ receive: 'denied' });
    await expect(connect(true)).resolves.toBe('denied');
    expect(plugin.register).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('creates the raid channel before registering, then hands the token and language to the server', async () => {
    await expect(connect()).resolves.toBe('on');
    expect(plugin.createChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'alerts', name: 'Saldırı uyarıları', importance: 5 }));
    expect(plugin.createChannel.mock.invocationCallOrder[0]).toBeLessThan(plugin.register.mock.invocationCallOrder[0]!);
    expect(api.registerPushDevice).toHaveBeenCalledWith('token-1', 'tr');
  });

  it('listens once, however often it connects, and sends the new language and a refreshed token', async () => {
    await connect();
    await connect(false, 'en');
    fcmToken = 'token-2';
    await connect(false, 'en');
    expect(plugin.addListener).toHaveBeenCalledTimes(1);
    expect(api.registerPushDevice.mock.calls).toEqual([['token-1', 'tr'], ['token-1', 'en'], ['token-2', 'en']]);
  });

  it('never throws: a broken bridge or a server refusal leaves the game running', async () => {
    plugin.checkPermissions.mockRejectedValue(new Error('no bridge'));
    await expect(connect()).resolves.toBe('off');
    plugin.checkPermissions.mockResolvedValue({ receive: 'granted' });
    api.registerPushDevice.mockRejectedValue(new Error('offline'));
    await expect(connect()).resolves.toBe('on');
  });
});

describe('signing out', () => {
  it('takes this phone off the commander it alerted', async () => {
    await connect();
    await disconnectPush(api);
    expect(api.forgetPushDevice).toHaveBeenCalledWith('token-1');
  });

  it('remembers the token across app starts, so a later start can still take it off', async () => {
    await connect();
    vi.resetModules();
    ({ connectPush, disconnectPush } = await import('../src/platform/push.js'));
    await disconnectPush(api);
    expect(api.forgetPushDevice).toHaveBeenCalledWith('token-1');
    api.forgetPushDevice.mockClear();
    await disconnectPush(api);
    expect(api.forgetPushDevice).not.toHaveBeenCalled();
  });

  it('keeps the token to try again when the server could not be told', async () => {
    await connect();
    api.forgetPushDevice.mockRejectedValueOnce(new Error('offline'));
    await disconnectPush(api);
    await disconnectPush(api);
    expect(api.forgetPushDevice).toHaveBeenCalledTimes(2);
  });

  it('has nothing to forget on a phone that never connected, and never throws', async () => {
    await disconnectPush(api);
    expect(api.forgetPushDevice).not.toHaveBeenCalled();
    await connect();
    api.forgetPushDevice.mockRejectedValue(new Error('offline'));
    await expect(disconnectPush(api)).resolves.toBeUndefined();
  });
});
