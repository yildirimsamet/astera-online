import { render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { PushDeviceSync } from '../src/shell/PushDeviceSync.js';

/** The signed-in shell keeps this phone's FCM address on the server, quietly, while the phone allows notifications. */
const permission = { display: 'granted', exact: 'granted' };
vi.mock('../src/platform/localNotifications.js', () => ({ usePhonePermission: () => permission }));
const connect = vi.fn((_api: unknown, _options: { locale: string; channelName: string; ask: boolean }) => Promise.resolve('on'));
const disconnect = vi.fn((_api: unknown) => Promise.resolve());
vi.mock('../src/platform/push.js', () => ({
  connectPush: (api: unknown, options: { locale: string; channelName: string; ask: boolean }) => connect(api, options),
  disconnectPush: (api: unknown) => disconnect(api),
}));
const api = { marker: 'api' };
vi.mock('../src/api/context.js', () => ({ useApi: () => api }));
afterEach(async () => { connect.mockClear(); disconnect.mockClear(); permission.display = 'granted'; await i18n.changeLanguage('en'); });

it('connects without asking, in the game language, naming the raid channel', async () => {
  render(<PushDeviceSync />);
  await waitFor(() => { expect(connect).toHaveBeenCalledWith(api, { locale: 'en', channelName: 'Raid alerts', ask: false }); });
});

it('waits while the phone does not allow notifications, and connects once it does', async () => {
  permission.display = 'prompt';
  const view = render(<PushDeviceSync />);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(connect).not.toHaveBeenCalled();
  permission.display = 'granted';
  view.rerender(<PushDeviceSync />);
  await waitFor(() => { expect(connect).toHaveBeenCalledTimes(1); });
});

it('sends the new language when the player changes it', async () => {
  render(<PushDeviceSync />);
  await waitFor(() => { expect(connect).toHaveBeenCalledTimes(1); });
  await i18n.changeLanguage('tr');
  await waitFor(() => { expect(connect).toHaveBeenLastCalledWith(api, { locale: 'tr', channelName: 'Saldırı uyarıları', ask: false }); });
});

it('takes the phone off the account once the phone settings refuse notifications, so no alert is paid for unseen', async () => {
  permission.display = 'denied';
  render(<PushDeviceSync />);
  await waitFor(() => { expect(disconnect).toHaveBeenCalledWith(api); });
  expect(connect).not.toHaveBeenCalled();
});
