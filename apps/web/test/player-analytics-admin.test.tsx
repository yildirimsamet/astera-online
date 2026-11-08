import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { AnalyticsAdminPanel } from '../src/screens/AnalyticsAdminPanel.js';
import type { AnalyticsAdminReport } from '../src/api/analyticsAdminSchemas.js';
import { summarizePlayerObservations } from '../src/api/analyticsReportModel.js';
const report: AnalyticsAdminReport = { measuredAt: new Date(), windowStart: new Date(), nextAfter: null,
  quality: { totalAccounts: 1, measuredAccounts: 0, visits: 0, untrusted: 0 },
  landing: { visibleVisits: 0, playVisits: 0, loginVisits: 0, loadFailedVisits: 0, trainingVisits: 0 },
  cohorts: [], cohortsTruncated: false, daily: [],
  signups: { accounts: 4, measured: 3, d1: { mature: 3, returned: 2, pending: 0 }, d3: { mature: 0, returned: 0, pending: 3 }, d7: { mature: 0, returned: 0, pending: 3 } },
  steps: Array.from({ length: 11 }, (_, index) => ({ step: index + 1, attempts: 0 })),
  players: [{ accountId: 'a', username: 'Nova', lastActiveAt: null, lastProgressAt: null, galaxy: null,
    coverage: 'unmeasured', truncated: false, summary: null, firstVisit: null, currentVisit: null }] };
const api = { analyticsAdmin: vi.fn(() => Promise.resolve(report)), analyticsTimeline: vi.fn(() => Promise.resolve({ events: [], nextBefore: null })) };
vi.mock('../src/api/context.js', () => ({ useApi: () => api }));
it('shows coverage as unknown rather than zero sessions or confirmed abandonment', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AnalyticsAdminPanel /></QueryClientProvider>);
  expect(await screen.findByText('Nova')).toBeVisible();
  expect(screen.getByText('Davranış ölçümü yok')).toBeVisible();
  expect(screen.getByText(/Kesin çıkış zamanı/)).toBeVisible();
  expect(screen.getByText(/Alt sahneler kayıtsız ziyaret zaman çizelgesinde görünür/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /Nova/ }));
  expect(await screen.findByText('Bu hesap için gözlenen olay yok.')).toBeVisible();
});
it('shows the last observed surface, confirmed command, blocker and outcome with their own times', async () => {
  const at = Date.now();
  const summary = summarizePlayerObservations([
    { name: 'surface_visible', at, mode: 'live', source: 'client_observation', timeTrusted: true, contextId: 'tab', sessionId: 'session', properties: { surface: 'development_item' } },
    { name: 'blocker_visible', at: at + 1000, mode: 'live', source: 'client_observation', timeTrusted: true, contextId: 'tab', sessionId: 'session', properties: { code: 'insufficient_resources' } },
    { name: 'command_accepted', at: at + 2000, mode: 'live', source: 'server_fact', timeTrusted: true, contextId: 'tab', sessionId: 'session', properties: { code: 'CORE' } },
  ], at + 3000);
  api.analyticsAdmin.mockResolvedValueOnce({ ...report, players: report.players.map(player => ({ ...player, coverage: 'observed' as const, summary })) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AnalyticsAdminPanel /></QueryClientProvider>);
  expect(await screen.findByText(/Son yüzey: development_item/)).toBeVisible();
  expect(screen.getByText(/Son kesin işlem: CORE/)).toBeVisible();
  expect(screen.getByText(/Son görünen engel: insufficient_resources/)).toBeVisible();
  expect(screen.getByText(/Son sonuç: Bilinmiyor/)).toBeVisible();
});

it('includes version/source filters in report and timeline requests and resets account pagination', async () => {
  api.analyticsAdmin.mockClear();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AnalyticsAdminPanel /></QueryClientProvider>);
  await screen.findByText('Nova');
  await userEvent.type(screen.getByLabelText('İstemci sürümü'), 'old-build');
  await userEvent.type(screen.getByLabelText('Kampanya kaynağı'), 'twitter');
  await userEvent.click(screen.getByRole('button', { name: 'Filtrele' }));
  expect(api.analyticsAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ build: 'old-build', source: 'twitter', inactiveHours: 24, after: undefined }));
  await userEvent.click(screen.getByRole('button', { name: '48 saattir görülmeyenler' }));
  expect(api.analyticsAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ inactiveHours: 48 }));
});

it('shows the separate starter funnel and its step dropoff', async () => {
  api.analyticsAdmin.mockResolvedValueOnce({ ...report, starter: { accounts: 2, sessions: 3, returnedAccounts: 1, steps: [{ scene: 'mine', accounts: 1, dropoff: 1 }], push: { asked: 1, granted: 1, denied: 0 }, crates: { accounts: 1, opened: 2 },
    chain: { accepted: 2, resolved: 2, viewed: 1, decided: 1 }, mining: { returned: 2, gained: 1, wasted: 1 } } });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AnalyticsAdminPanel /></QueryClientProvider>);
  expect(await screen.findByText('Starter journey')).toBeVisible();
  expect(screen.getByText(/2 accounts · 3 sessions · 1 returned/)).toBeVisible();
  expect(screen.getByText(/Crates: 2 opened by 1 accounts/)).toBeVisible();
  expect(screen.getByText('Order chain: 2 accounts gave an order → 2 got its result → 1 saw it → 1 ordered again')).toBeVisible();
  expect(screen.getByText('First mining return: 2 accounts · 1 with a net gain · 1 lost some to full works')).toBeVisible();
  await userEvent.click(screen.getByText('Steps and dropoff'));
  expect(screen.getByText('mine')).toBeVisible();
});

it('puts the sign-up cohort first, with what has not matured kept apart', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AnalyticsAdminPanel /></QueryClientProvider>);
  expect(await screen.findByText(/Pencerede açılan 4 hesabın 3 tanesinde ölçüm var/)).toBeVisible();
  expect(screen.getByText(/2\/3 değerlendirilebilir, 0 bekliyor · 0\/0 değerlendirilebilir, 3 bekliyor/)).toBeVisible();
});
