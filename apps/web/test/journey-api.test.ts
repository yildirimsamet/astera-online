import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';

it('encodes a registration cohort and validates the response at the API boundary', async () => {
  const now = Date.now();
  const report = { measuredAt: now, from: now - 86400000, to: now, absentMinutes: 60, totalAccounts: 0, truncated: false, players: [] };
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify(report), { status: 200 }));
  const api = new Api({ fetch, authTransport: null });
  const from = '2026-11-10T15:26:00.000Z';
  expect(await api.analyticsJourney({ from, absentMinutes: 60 })).toEqual(report);
  const input = fetch.mock.calls[0]?.[0];
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
  const url = new URL(href ?? '', 'http://localhost');
  expect(url.pathname).toBe('/api/admin/analytics/journey');
  expect(url.searchParams.get('from')).toBe(from);
  expect(url.searchParams.get('absentMinutes')).toBe('60');
});

it('does not accept a malformed report as an empty cohort', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
  await expect(new Api({ fetch, authTransport: null }).analyticsJourney()).rejects.toThrow();
});
