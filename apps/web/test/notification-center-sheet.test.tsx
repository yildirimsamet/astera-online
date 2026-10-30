import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NotificationCenterSheet } from '../src/screens/NotificationCenterSheet.js';
import type { NotificationCenter } from '../src/api/notificationCenterSchemas.js';

/** Bildirim Merkezi, docs/bildirim-merkezi-plani-2026-10-30.md. */
const caps = { notificationCenter: true, localNotifications: true };
vi.mock('../src/platform/runtime.js', () => ({ capabilities: () => caps }));

const world = { id: 'home', name: 'Earth', alloy: 5000, crystal: 5000, deuterium: 400 };
vi.mock('../src/api/queries.js', () => ({ usePlanet: () => ({ data: { planet: { id: world.id, name: world.name } }, dataUpdatedAt: 0 }) }));
vi.mock('../src/lib/projection.js', () => ({ useProjected: () => ({ alloy: world.alloy, crystal: world.crystal, deuterium: world.deuterium }) }));

const prices = { T3: 20, T5: 30, T15: 60, RADAR: 100 };
const fresh = (): NotificationCenter => ({
  built: true, wallet: 95, timing: 'T5', muted: [], buildCost: { alloy: 1510, crystal: 1133, deuterium: 0 },
  deuteriumPerHour: 12.5, prices: { incoming_attack: prices, incoming_strategic: { T3: 30, T5: 45, T15: 90, RADAR: 150 }, probe_detected: 20 },
  unfunded: 0, recent: [],
});
let view: NotificationCenter | undefined = fresh();
const build = vi.fn(); const fund = vi.fn(); const settings = vi.fn(); let queried: boolean[] = [];
vi.mock('../src/api/notificationCenter.js', () => ({
  useNotificationCenter: (enabled: boolean) => { queried.push(enabled); return { data: enabled ? view : undefined, isPending: false, isError: false, refetch: vi.fn() }; },
  useBuildNotificationCenter: () => ({ mutate: build, isPending: false, error: null }),
  useFundNotificationCenter: () => ({ mutate: fund, isPending: false, error: null }),
  useNotificationCenterSettings: () => ({ mutate: settings, isPending: false, error: null }),
}));
const phone = { enabled: false, prefs: { build: true, research: true, ships: true, fleet: true } };
const enable = vi.fn(() => Promise.resolve(false)); const disable = vi.fn(); const setPrefs = vi.fn(); const allowExact = vi.fn();
const permission = { display: 'prompt', exact: 'granted' };
vi.mock('../src/platform/localNotifications.js', () => ({
  useLocalAlertSettings: () => phone,
  usePhonePermission: () => permission,
  allowExactLocalAlerts: () => { allowExact(); return Promise.resolve(); },
  enableLocalAlerts: () => enable(),
  disableLocalAlerts: () => { disable(); },
  setLocalAlertPrefs: (prefs: unknown) => { setPrefs(prefs); },
}));
afterEach(() => {
  phone.enabled = false; permission.display = 'prompt'; permission.exact = 'granted'; allowExact.mockClear(); enable.mockClear(); disable.mockClear(); setPrefs.mockClear(); caps.localNotifications = true;
  view = fresh(); caps.notificationCenter = true; queried = []; world.deuterium = 400; world.alloy = 5000;
  build.mockClear(); fund.mockClear(); settings.mockClear();
});

it('offers the one-time build from the selected world and says what is short', () => {
  view = { ...fresh(), built: false };
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  expect(screen.getByText(/Paid from Earth/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Build the center' }));
  expect(build).toHaveBeenCalledWith('home', expect.anything());
});

it('cannot build while the selected world is short', () => {
  view = { ...fresh(), built: false }; world.alloy = 100;
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Build the center' })).toBeDisabled();
});

it('says how many attack alerts the wallet pays for at the chosen timing', () => {
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  // 95 at 30 a piece.
  expect(screen.getByText('Pays for 3 attack alerts at this timing')).toBeInTheDocument();
});

it('warns when the wallet cannot pay for the next alert and counts what was missed', () => {
  view = { ...fresh(), wallet: 10, unfunded: 2 };
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  expect(screen.getByText(/cannot pay for the next attack alert/)).toBeInTheDocument();
  expect(screen.getByText(/2 alerts were not sent in the last 24 hours/)).toBeInTheDocument();
});

it('prices every timing and saves the one chosen', () => {
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  const group = screen.getByRole('radiogroup', { name: 'When to alert' });
  expect(within(group).getByRole('radio', { checked: true })).toHaveTextContent('5 min');
  expect(within(group).getByRole('radio', { name: /On radar/ })).toHaveTextContent('100');
  fireEvent.click(within(group).getByRole('radio', { name: /15 min/ }));
  expect(settings).toHaveBeenCalledWith({ timing: 'T15' });
});

it('turns a paid kind off and on', () => {
  view = { ...fresh(), muted: ['incoming_strategic'] };
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  expect(screen.getByRole('checkbox', { name: /Strategic weapon/ })).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(screen.getByRole('checkbox', { name: /Probe detected/ }));
  expect(settings).toHaveBeenCalledWith({ muted: ['incoming_strategic', 'probe_detected'] });
  fireEvent.click(screen.getByRole('checkbox', { name: /Strategic weapon/ }));
  expect(settings).toHaveBeenLastCalledWith({ muted: [] });
});

it('transfers only after the player confirms it cannot be taken back', () => {
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Deuterium to transfer' }), { target: { value: '150' } });
  fireEvent.click(screen.getByRole('button', { name: 'Transfer' }));
  expect(fund).not.toHaveBeenCalled();
  expect(screen.getByText(/cannot be moved back/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Transfer 150' }));
  expect(fund).toHaveBeenCalledWith({ planetId: 'home', amount: 150 }, expect.anything());
});

it('refuses a transfer the selected world cannot cover or that is not a whole positive number', () => {
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  const amount = screen.getByRole('spinbutton', { name: 'Deuterium to transfer' });
  for (const value of ['401', '0', '-5', '2.5', '']) {
    fireEvent.change(amount, { target: { value } });
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeDisabled();
  }
});

it('fills the amount from the quick picks, capped by the store', () => {
  world.deuterium = 70;
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(screen.getByRole('spinbutton', { name: 'Deuterium to transfer' })).toHaveValue(70);
});

it('lists recent alerts with what each one cost', () => {
  view = { ...fresh(), recent: [
    { kind: 'incoming_attack', status: 'SENT', price: 30, sendAt: new Date('2026-10-30T10:00:00Z'), payload: { targetPlanetName: 'Earth' } },
    { kind: 'probe_detected', status: 'UNFUNDED', price: 20, sendAt: new Date('2026-10-30T09:00:00Z'), payload: { targetPlanetName: 'Mars' } },
    { kind: 'incoming_attack', status: 'CANCELLED', price: null, sendAt: new Date('2026-10-30T08:00:00Z'), payload: {} },
  ] };
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  const ledger = screen.getByRole('list', { name: 'Recent alerts' });
  const rows = within(ledger).getAllByRole('listitem');
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent('Sent');
  expect(rows[0]).toHaveTextContent('−30');
  expect(rows[1]).toHaveTextContent('Wallet short');
  expect(rows[2]).toHaveTextContent('Nothing taken');
});

it('offers the free phone alerts in the app, asking the phone only when switched on', async () => {
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  const master = screen.getByRole('checkbox', { name: 'Alert me when orders finish' });
  expect(master).toHaveAttribute('aria-checked', 'false');
  expect(screen.queryByRole('checkbox', { name: 'Research' })).not.toBeInTheDocument();
  enable.mockImplementationOnce(() => { permission.display = 'denied'; return Promise.resolve(false); });
  fireEvent.click(master);
  expect(enable).toHaveBeenCalledOnce();
  expect(await screen.findByText(/did not allow notifications/)).toBeInTheDocument();
});

it('says when the phone settings have blocked alerts the player had on', () => {
  phone.enabled = true; permission.display = 'denied';
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  expect(screen.getByText(/turned off in the phone settings/)).toBeInTheDocument();
});

it('offers on-time alerts when the phone would deliver them late', () => {
  phone.enabled = true; permission.display = 'granted'; permission.exact = 'denied';
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  expect(screen.getByText(/up to an hour/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Allow on-time alerts' }));
  expect(allowExact).toHaveBeenCalledOnce();
});

it('says nothing about permissions while all is well', () => {
  phone.enabled = true; permission.display = 'granted';
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  expect(screen.queryByText(/phone settings/)).not.toBeInTheDocument();
  expect(screen.queryByText(/minutes late/)).not.toBeInTheDocument();
});

it('turns a free category off and the whole thing off', () => {
  phone.enabled = true; permission.display = 'granted';
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Research' }));
  expect(setPrefs).toHaveBeenCalledWith({ build: true, research: false, ships: true, fleet: true });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alert me when orders finish' }));
  expect(disable).toHaveBeenCalledOnce();
});

it('shows the free phone alerts before the center is built', () => {
  view = { ...fresh(), built: false };
  render(<NotificationCenterSheet onClose={vi.fn()} />);
  expect(screen.getByRole('checkbox', { name: 'Alert me when orders finish' })).toBeInTheDocument();
});
