import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { JourneyDashboard } from '../src/screens/JourneyDashboard.js';
import { journeyPlayer } from '../src/api/journeyModel.js';

const now = Date.UTC(2026, 10, 11, 12);
const base = { joinedAt: now - 86400000, enlistedAt: now - 86400000, lastSeenAt: now - 3600000,
  guideOffAt: null, galaxy: 'Starter 1', modules: {}, facts: [], departed: false, work: [], observations: [], truncated: false };
const players = [
  journeyPlayer({ ...base, accountId: '00000000-0000-4000-8000-000000000001', username: 'Nova', facts: ['FIRST_OUTPOST_VICTORY'] }, now, 30),
  journeyPlayer({ ...base, accountId: '00000000-0000-4000-8000-000000000002', username: 'Orbit' }, now, 30),
];
const report = { measuredAt: now, from: now - 86400000, to: now, absentMinutes: 30, totalAccounts: 2, truncated: false, players };
const api = { analyticsJourney: vi.fn(() => Promise.resolve(report)) };
vi.mock('../src/api/context.js', () => ({ useApi: () => api }));
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><JourneyDashboard /></QueryClientProvider>);

it('shows charts with denominators, missing coverage and selectable stage drilldown', async () => {
  mount();
  expect(await screen.findByRole('heading', { name: 'Oyuncu yolculuğu' })).toBeVisible();
  expect(await screen.findByRole('button', { name: /İlk zafer.*1\/2/ })).toBeVisible();
  expect(screen.getByText(/2 hesapta süre ölçümü yok/)).toBeVisible();
  expect(screen.queryByText('0 sn')).not.toBeInTheDocument();
  expect(screen.getByText(/Kesin bırakma nedeni/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /İlk zafer.*1\/2/ }));
  expect(screen.getByRole('button', { name: /Nova/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: /Orbit/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Nova/ }));
  expect(screen.getByText(/Son rehber adımı/)).toBeVisible();
  expect(screen.getByText(/Oynama süresi bilinmiyor/)).toBeVisible();
});

it('changes the registration window, and keeps an empty cohort empty rather than inventing retention', async () => {
  api.analyticsJourney.mockResolvedValueOnce({ ...report, totalAccounts: 0, players: [] });
  mount();
  expect(await screen.findByText('Bu kayıt aralığında oyuncu yok.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Son 4 saat' }));
  expect(api.analyticsJourney).toHaveBeenLastCalledWith(expect.objectContaining({ hours: 4, absentMinutes: 30 }));
});

it('clearly marks incomplete cohorts and supports retry after failures', async () => {
  api.analyticsJourney.mockRejectedValueOnce(new Error('offline'));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Yolculuk raporu alınamadı');
  api.analyticsJourney.mockResolvedValueOnce({ ...report, truncated: true });
  await userEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
  expect(await screen.findByText(/Veri sınırına ulaşıldı/)).toBeVisible();
});
