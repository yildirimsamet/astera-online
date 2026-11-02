import { beforeEach, expect, it, vi } from 'vitest';
const observe = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/playerAnalytics/runtime.js', () => ({ observe }));
const plugin = vi.hoisted(() => ({ addListener: vi.fn(), checkPermissions: vi.fn(), createChannel: vi.fn(), register: vi.fn() }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: plugin }));
vi.mock('../src/platform/runtime.js', () => ({ capabilities: () => ({ nativePush: true }) }));
vi.mock('../src/platform/localNotifications.js', () => ({ refreshPhonePermission: vi.fn() }));
beforeEach(() => { observe.mockClear(); });
it('observes a notification open without sending the push token or its contents', async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  plugin.addListener.mockImplementation((name: string, listener: (event: unknown) => void) => {
    listeners.set(name, listener); return Promise.resolve({ remove: vi.fn() });
  });
  plugin.checkPermissions.mockResolvedValue({ receive: 'granted' });
  plugin.createChannel.mockResolvedValue(undefined); plugin.register.mockResolvedValue(undefined);
  const { connectPush } = await import('../src/platform/push.js');
  await connectPush({ registerPushDevice: () => Promise.resolve(), forgetPushDevice: () => Promise.resolve() }, { locale: 'tr', channelName: 'Alerts', ask: false });
  listeners.get('pushNotificationActionPerformed')?.({ notification: { title: 'Private title', body: 'Private body', data: { refId: '0bb258b3-c801-4675-a7a4-a30793c1a8ab', kind: 'raid' } } });
  expect(observe).toHaveBeenCalledWith('alert_opened', { refId: '0bb258b3-c801-4675-a7a4-a30793c1a8ab', code: 'push' }, 'live');
  expect(JSON.stringify(observe.mock.calls)).not.toContain('Private');
});
