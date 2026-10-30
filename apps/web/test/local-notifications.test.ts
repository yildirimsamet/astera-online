import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalAlert } from '../src/lib/localAlerts.js';

/** The device side of the free queue alerts: reconcile the phone against the plan. */
const pending: { id: number; schedule?: { at?: Date }; extra?: unknown }[] = [];
const plugin = vi.hoisted(() => ({
  getPending: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  createChannel: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  checkExactNotificationSetting: vi.fn(),
  changeExactNotificationSetting: vi.fn(),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));
const caps = vi.hoisted(() => ({ localNotifications: true }));
vi.mock('../src/platform/runtime.js', () => ({ capabilities: () => caps }));
const activity = vi.hoisted(() => ({ active: true, listeners: new Set<() => void>() }));
vi.mock('../src/platform/activity.js', () => ({
  isAppActive: () => activity.active,
  watchAppActivity: (listener: () => void) => { activity.listeners.add(listener); return () => { activity.listeners.delete(listener); }; },
}));

const {
  allowExactLocalAlerts, clearLocalAlerts, enableLocalAlerts, phonePermission, readLocalAlertSettings, refreshPhonePermission,
  syncLocalAlerts, writeLocalAlertSettings,
} = await import('../src/platform/localNotifications.js');

const alert = (key: string, at: number): LocalAlert => ({ id: key.length * 1000 + at % 1000, key, category: 'build', at, world: 'Earth' });
const text = (a: LocalAlert) => ({ title: `T ${a.key}`, body: 'B' });

beforeEach(() => {
  pending.length = 0;
  plugin.getPending.mockImplementation(() => Promise.resolve({ notifications: pending }));
  plugin.schedule.mockResolvedValue({ notifications: [] });
  plugin.cancel.mockResolvedValue(undefined);
  plugin.createChannel.mockResolvedValue(undefined);
  plugin.checkPermissions.mockResolvedValue({ display: 'granted' });
  plugin.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
  caps.localNotifications = true;
  globalThis.localStorage.clear();
});
afterEach(() => { vi.clearAllMocks(); });

describe('syncLocalAlerts', () => {
  it('schedules what the plan has and the phone does not', async () => {
    const a = alert('build:c1', 1_000_100);
    await syncLocalAlerts([a], text, 'en');
    expect(plugin.schedule).toHaveBeenCalledOnce();
    const [{ notifications }] = plugin.schedule.mock.calls[0] as [{ notifications: { id: number; title: string; schedule: { at: Date }; extra: unknown }[] }];
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ id: a.id, title: 'T build:c1', extra: { astera: 'queue', key: 'build:c1', lang: 'en' } });
    expect(notifications[0]?.schedule.at.getTime()).toBe(a.at);
  });

  it('asks for an on-time alarm only where the phone allows one, so the plugin never opens the settings itself', async () => {
    plugin.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'denied' });
    await syncLocalAlerts([alert('build:c1', 1_000_100)], text, 'en');
    const [{ notifications: late }] = plugin.schedule.mock.calls[0] as [{ notifications: { isExactNotification: boolean }[] }];
    expect(late[0]?.isExactNotification).toBe(false);
    plugin.checkExactNotificationSetting.mockRejectedValue(new Error('no bridge'));
    await syncLocalAlerts([alert('build:c22', 1_000_100)], text, 'en');
    const [{ notifications: unknown }] = plugin.schedule.mock.calls[1] as [{ notifications: { isExactNotification: boolean }[] }];
    expect(unknown[0]?.isExactNotification).toBe(false);
    plugin.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
    await syncLocalAlerts([alert('build:c333', 1_000_100)], text, 'en');
    const [{ notifications: onTime }] = plugin.schedule.mock.calls[2] as [{ notifications: { isExactNotification: boolean }[] }];
    expect(onTime[0]?.isExactNotification).toBe(true);
  });

  it('leaves an unchanged alert alone and cancels one the plan dropped or moved', async () => {
    const kept = alert('build:c1', 1_000_100);
    const moved = alert('ships:y1', 2_000_200);
    pending.push(
      { id: kept.id, schedule: { at: new Date(kept.at) }, extra: { astera: 'queue', key: kept.key, lang: 'en' } },
      { id: moved.id, schedule: { at: new Date(moved.at - 60_000) }, extra: { astera: 'queue', key: moved.key, lang: 'en' } },
      { id: 77, schedule: { at: new Date(5) }, extra: { astera: 'queue', key: 'build:gone' } },
      { id: 88, schedule: { at: new Date(5) }, extra: { other: true } },
    );
    await syncLocalAlerts([kept, moved], text, 'en');
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: moved.id }, { id: 77 }] });
    const [{ notifications }] = plugin.schedule.mock.calls[0] as [{ notifications: { id: number }[] }];
    expect(notifications.map(n => n.id)).toEqual([moved.id]);
  });

  it('clears every queue alert when the plan is empty and touches nothing else', async () => {
    pending.push({ id: 77, extra: { astera: 'queue', key: 'x' } }, { id: 88, extra: null });
    await syncLocalAlerts([], text, 'en');
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 77 }] });
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('does not throw when the plugin refuses', async () => {
    plugin.getPending.mockRejectedValue(new Error('no bridge'));
    await expect(syncLocalAlerts([alert('build:c1', 1)], text, 'en')).resolves.toBeUndefined();
  });

  it('rewords an alert when the game changes language', async () => {
    const a = alert('build:c1', 1_000_100);
    pending.push({ id: a.id, schedule: { at: new Date(a.at) }, extra: { astera: 'queue', key: a.key, lang: 'en' } });
    await syncLocalAlerts([a], text, 'tr');
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: a.id }] });
    expect(plugin.schedule).toHaveBeenCalledOnce();
  });

  it('never runs two syncs at once, and skips a plan already superseded', async () => {
    let inFlight = 0; let most = 0;
    plugin.getPending.mockImplementation(async () => {
      inFlight++; most = Math.max(most, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight--;
      return { notifications: [...pending] };
    });
    const a = alert('build:a', 1); const b = alert('build:bb', 2); const c = alert('build:ccc', 3);
    await Promise.all([syncLocalAlerts([a], text, 'en'), syncLocalAlerts([b], text, 'en'), syncLocalAlerts([c], text, 'en')]);
    expect(most).toBe(1);
    expect(plugin.getPending).toHaveBeenCalledTimes(2);
    const last = plugin.schedule.mock.calls.at(-1) as [{ notifications: { id: number }[] }];
    expect(last[0].notifications.map(n => n.id)).toEqual([c.id]);
  });

  it('clears every queue alert on sign-out, and nothing on the web', async () => {
    pending.push({ id: 77, extra: { astera: 'queue', key: 'x', lang: 'en' } });
    await clearLocalAlerts();
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 77 }] });
    plugin.cancel.mockClear(); plugin.getPending.mockClear();
    caps.localNotifications = false;
    await clearLocalAlerts();
    expect(plugin.getPending).not.toHaveBeenCalled();
  });
});

describe('the phone permission', () => {
  it('reads both the notification and the on-time alarm permission', async () => {
    plugin.checkPermissions.mockResolvedValue({ display: 'prompt-with-rationale' });
    plugin.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'denied' });
    expect(await refreshPhonePermission()).toEqual({ display: 'prompt', exact: 'denied' });
    expect(phonePermission()).toEqual({ display: 'prompt', exact: 'denied' });
  });

  it('is read again when the app comes back to the front, e.g. after the phone settings', async () => {
    await refreshPhonePermission();
    expect(phonePermission().display).toBe('granted');
    plugin.checkPermissions.mockResolvedValue({ display: 'denied' });
    for (const listener of activity.listeners) listener();
    await vi.waitFor(() => { expect(phonePermission().display).toBe('denied'); });
  });

  it('survives a bridge that cannot answer', async () => {
    plugin.checkPermissions.mockRejectedValue(new Error('no bridge'));
    plugin.checkExactNotificationSetting.mockRejectedValue(new Error('no bridge'));
    expect(await refreshPhonePermission()).toEqual({ display: 'unknown', exact: 'unknown' });
  });

  it('opens the on-time alarm setting and reads it back', async () => {
    plugin.changeExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
    await allowExactLocalAlerts();
    expect(plugin.changeExactNotificationSetting).toHaveBeenCalledOnce();
    expect(phonePermission().exact).toBe('granted');
  });
});

describe('local alert settings', () => {
  it('start off, with every category ready', () => {
    expect(readLocalAlertSettings()).toEqual({ enabled: false, prefs: { build: true, research: true, ships: true, fleet: true } });
  });

  it('survive a reload and ignore a corrupt store', () => {
    writeLocalAlertSettings({ enabled: true, prefs: { build: true, research: false, ships: true, fleet: false } });
    expect(readLocalAlertSettings()).toMatchObject({ enabled: true, prefs: { research: false, fleet: false } });
    globalThis.localStorage.setItem('astera:local-alerts:v1', '{bad');
    expect(readLocalAlertSettings().enabled).toBe(false);
  });

  it('turn on only once the phone grants the permission', async () => {
    plugin.checkPermissions.mockResolvedValue({ display: 'prompt' });
    plugin.requestPermissions.mockResolvedValueOnce({ display: 'denied' });
    expect(await enableLocalAlerts()).toBe(false);
    expect(readLocalAlertSettings().enabled).toBe(false);
    expect(phonePermission().display).toBe('denied');
    plugin.requestPermissions.mockResolvedValueOnce({ display: 'granted' });
    expect(await enableLocalAlerts()).toBe(true);
    expect(readLocalAlertSettings().enabled).toBe(true);
    expect(phonePermission().display).toBe('granted');
  });

  it('does not ask again when the phone already allows it', async () => {
    plugin.checkPermissions.mockResolvedValue({ display: 'granted' });
    expect(await enableLocalAlerts()).toBe(true);
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
  });

  it('turns off even if the bridge refuses the request', async () => {
    plugin.checkPermissions.mockRejectedValue(new Error('no bridge'));
    plugin.requestPermissions.mockRejectedValue(new Error('no bridge'));
    expect(await enableLocalAlerts()).toBe(false);
    expect(readLocalAlertSettings().enabled).toBe(false);
  });
});
