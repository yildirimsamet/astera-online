import { render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocalAlertSync } from '../src/shell/LocalAlertSync.js';

/** The shell keeps the phone's queue alerts equal to the queues, and clears them when switched off. */
const caps = { localNotifications: true };
vi.mock('../src/platform/runtime.js', () => ({ capabilities: () => caps }));
const settings = { enabled: true, prefs: { build: true, research: true, ships: true, fleet: true } };
const permission = { display: 'granted', exact: 'granted' };
const sync = vi.fn<(plan: readonly { key: string; at: number }[], lang: string) => Promise<void>>(() => Promise.resolve());
vi.mock('../src/platform/localNotifications.js', () => ({
  useLocalAlertSettings: () => settings,
  usePhonePermission: () => permission,
  syncLocalAlerts: (plan: readonly { key: string; at: number }[], _text: unknown, lang: string) => sync(plan, lang),
}));
const soon = new Date(Date.now() + 10 * 60_000);
vi.mock('../src/api/world.js', () => ({
  useWorld: () => ({ worlds: [{ planet: { id: 'home', name: 'Earth' }, queues: { CONSTRUCTION: [{ id: 'c1', kind: 'BUILDING', subject: 'RADAR', finishesAt: soon }], YARD: [] }, researchQueue: [] }] }),
}));
vi.mock('../src/api/queries.js', () => ({ usePending: () => ({ data: { pending: [] } }) }));
afterEach(() => { sync.mockClear(); caps.localNotifications = true; settings.enabled = true; permission.display = 'granted'; });

it('schedules the running orders on the phone', async () => {
  render(<LocalAlertSync />);
  await waitFor(() => { expect(sync).toHaveBeenCalled(); });
  expect(sync.mock.calls[0]?.[0].map(alert => alert.key)).toEqual(['build:c1']);
  expect(sync.mock.calls[0]?.[1]).toBe('en');
});

it('clears them when the phone settings take the permission away', async () => {
  permission.display = 'denied';
  render(<LocalAlertSync />);
  await waitFor(() => { expect(sync).toHaveBeenCalledWith([], 'en'); });
});

it('waits, rather than clearing, while the permission has not been read yet', () => {
  permission.display = 'unknown';
  render(<LocalAlertSync />);
  expect(sync).not.toHaveBeenCalled();
});

it('clears them once the player turns the alerts off', async () => {
  settings.enabled = false;
  render(<LocalAlertSync />);
  await waitFor(() => { expect(sync).toHaveBeenCalledWith([], 'en'); });
});

it('does nothing where the phone alerts do not exist', () => {
  caps.localNotifications = false;
  render(<LocalAlertSync />);
  expect(sync).not.toHaveBeenCalled();
});
