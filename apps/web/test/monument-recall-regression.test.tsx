import type { ReactNode } from 'react';
import { MULTI_WORLD, travelExact } from '@astera/rules';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { monumentsSchema } from '../src/api/schemas.js';
import { resetClock } from '../src/lib/clock.js';
import { flightRecallInput } from '../src/lib/flights.js';
import { monumentPendingThreads } from '../src/lib/monumentFlights.js';
import { FlightList, useAirborne } from '../src/shell/PendingStrip.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { FlightRow } from '../src/v2/hud/FleetPage.js';

const id = '00000000-0000-4000-8000-000000000001';
const start = Date.parse('2026-10-10T12:00:00Z');
const observedAt = start + 60_000;
const home = { x: 0, y: 0, z: 0 };
const speed = 100;
const distancePerMinute = 60 / travelExact(60, speed);
const lots = [{ id: '00000000-0000-4000-8000-000000000002', hull: 'COURIER', count: 2, damageBp: 0, remainderBp: 0,
  deuterium: 0, maxHp: 90, remainingHp: 90, cargoCapacity: 1400 }];
const raw = { serverNow: observedAt, monuments: [{ id, ordinal: 1, position: { x: distancePerMinute * 10, y: 0, z: 0 },
  controller: { kind: 'NEUTRAL' }, capacity: 7270, used: 0, reserved: 0, productionPerMinute: 60, emptySince: null }],
  waves: [{ id, monumentId: id, playerId: id, originPlanetId: id, rootWaveId: null, jointOperationId: null,
    status: 'OUTBOUND', purpose: 'ATTACK', sentAt: start, heldAt: null, arriveAt: start + 600_000,
    position: { x: distancePerMinute, y: 0, z: 0 },
    route: [{ from: home, to: { x: distancePerMinute * 10, y: 0, z: 0 }, startMs: start, endMs: start + 600_000 }],
    tech: {}, fleet: { COURIER: 2 }, lots, deuterium: 0, productionPerMinute: 0, fillsAt: null, nextLossAt: null,
    returnForecast: { homePlanetId: id, homePosition: home, speed, arriveAt: observedAt + 60_000, minutes: 1,
      doseHp: 0, destroyed: 0, deuterium: 0, lostDeuterium: 0, lots } }], probes: [], probeReports: [] };
const view = monumentsSchema.parse(raw);

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return { ...actual,
    usePending: () => ({ data: { pending: [] } }),
    useMining: () => ({ data: { runs: [] } }),
    useTraffic: () => ({ data: { contacts: [] } }),
    usePlanet: () => ({ data: { rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion } }),
    useMonuments: () => ({ data: view }),
    useRecallMining: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); resetClock(); });

describe('monument flight recall regressions', () => {
  it.each([{}, undefined])('renders an outbound flight without UUID support (%j)', crypto => {
    vi.spyOn(Date, 'now').mockReturnValue(observedAt);
    vi.stubGlobal('crypto', crypto);
    const { result } = renderHook(() => useAirborne());
    expect(result.current.items[0]?.recallMission).toEqual({ missionId: id, monument: true });
  });

  it('keeps the recall identity through a clock tick, a lost response and a remounted list', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(observedAt);
    const requests: { key: string | null; body: unknown; url: string }[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>((input, init) => {
      const key = new Headers(init?.headers).get('idempotency-key');
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      requests.push({ key, body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : null, url });
      if (requests.length === 1) return Promise.reject(new TypeError('Failed to fetch'));
      const replay = key === requests[0]?.key;
      return Promise.resolve(new Response(JSON.stringify(replay
        ? { wave: { id, monumentId: id, status: 'RETURNING' } }
        : { error: 'MONUMENT_NOT_RECALLABLE', message: 'Already returning' }), { status: replay ? 200 : 409 }));
    });
    const client = new QueryClient();
    const api = new Api({ fetch });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>;
    const first = render(<FlightList onFocus={vi.fn()} onDone={vi.fn()} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'Recall fleet' }));
    await waitFor(() => { expect(fetch).toHaveBeenCalledTimes(1); });
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Recall fleet' })).not.toBeDisabled(); });
    vi.mocked(Date.now).mockReturnValue(observedAt + 1000);
    first.rerender(<FlightList onFocus={vi.fn()} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recall fleet' }));
    await waitFor(() => { expect(fetch).toHaveBeenCalledTimes(2); });
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Recall fleet' })).not.toBeDisabled(); });
    first.unmount();
    const second = render(<FlightList onFocus={vi.fn()} onDone={vi.fn()} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'Recall fleet' }));
    await waitFor(() => { expect(fetch).toHaveBeenCalledTimes(3); });
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Recall fleet' })).not.toBeDisabled(); });
    second.unmount();
    client.clear();
    expect(new Set(requests.map(request => request.key)).size).toBe(1);
    for (const request of requests) {
      expect(request.key?.length).toBeGreaterThanOrEqual(8);
      expect(request.body).toEqual({ all: true });
      expect(request.url).toBe(`/api/monuments/waves/${id}/recall`);
    }
  });

  it('uses the server return speed and home while the flight clock advances without a refetch', () => {
    vi.useFakeTimers(); vi.setSystemTime(observedAt);
    function Row() {
      const { items, now } = useAirborne();
      return <FlightRow item={items[0]!} now={now} recalling={false} onFocus={vi.fn()} onRecall={vi.fn()} />;
    }
    render(<Row />);
    expect(screen.getByRole('button', { name: /^Recall/ })).toHaveAccessibleName('Recall · If recalled, home in 1m 00s');
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByRole('button', { name: /^Recall/ })).toHaveAccessibleName('Recall · If recalled, home in 1m 30s');
  });

  it('predicts away from a different safe home with the surviving wing speed', () => {
    const otherHome = { x: -distancePerMinute, y: 0, z: 0 };
    const moved = monumentsSchema.parse({ ...raw, waves: [{ ...raw.waves[0],
      returnForecast: { ...raw.waves[0]!.returnForecast, homePlanetId: 'capital', homePosition: otherHome, speed: speed * 2, minutes: 1 } }] });
    expect(monumentPendingThreads(moved, observedAt + 30_000)[0]?.monumentRecall?.minutes).toBeCloseTo(1.25);
  });

  it('predicts correctly when the cached return distance was zero at dispatch', () => {
    const dispatched = monumentsSchema.parse({ ...raw, serverNow: start, waves: [{ ...raw.waves[0], position: home,
      returnForecast: { ...raw.waves[0]!.returnForecast, arriveAt: start, minutes: 0 } }] });
    expect(monumentPendingThreads(dispatched, start + 30_000)[0]?.monumentRecall?.minutes).toBeCloseTo(0.5);
  });

  it('keeps the last native forecast compatible with older server responses', () => {
    const legacy = monumentsSchema.parse({ ...raw, waves: [{ ...raw.waves[0],
      returnForecast: { homePlanetId: id, arriveAt: observedAt + 60_000, minutes: 1, doseHp: 0, destroyed: 0, deuterium: 0, lostDeuterium: 0, lots } }] });
    expect(monumentPendingThreads(legacy, observedAt + 30_000)[0]?.monumentRecall?.minutes).toBe(1);
  });

  it('has a repeatable whole-flight intent without a cached physical selection', () => {
    const input = flightRecallInput(monumentPendingThreads(view)[0]!, observedAt);
    expect(input).toEqual({ missionId: id, monument: true });
  });
});
