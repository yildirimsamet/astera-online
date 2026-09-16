import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import {
  keys,
  useHarvest,
  useMine,
  useMining,
  useCollect,
  useRecallMining,
} from '../src/api/queries.js';
import { miningLaunchSchema, miningRecallSchema } from '../src/api/schemas.js';
import type {
  MiningRun,
  MiningStatusView,
  PlanetView,
} from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * ONE TAP, ONE HTTP ROUND TRIP — and the POST must beat an older GET. D120.
 *
 * Both departures used to invalidate the whole `mining` prefix after success.
 * That forced `/api/mining/status` and `/api/planet` back over the network before
 * the new run could be drawn. It also let a status read issued before the tap land
 * later and replace the new run with the old empty list.
 *
 * The response now carries every private view it moved. These tests keep the old
 * status request deliberately unresolved across the launch, then complete it last:
 * the POST still wins and there is no post-launch status request.
 */

type Departure = 'mining' | 'salvage';

const run = (kind: Departure): MiningRun => ({
  id: kind === 'mining' ? 'mine-run' : 'salvage-run',
  planetId: '00000000-0000-4000-8000-000000000001',
  targetKind: kind === 'mining' ? 'asteroid' : 'debris',
  asteroidId: kind === 'mining' ? 'mJt7YvxMZEC5S7yYQ32SYw' : null,
  debrisFieldId: kind === 'salvage' ? 'field-1' : null,
  status: 'outbound',
  craft: 1,
  departAt: new Date('2026-08-26T08:00:00.000Z'),
  arriveAt: new Date('2026-08-26T08:05:00.000Z'),
  homeAt: null,
  intercept: { x: 400, y: 10, z: -80 },
  minedAlloy: 0,
  minedCrystal: 0,
  minedDeuterium: 0,
});

describe('Prospector recall cache hand-off', () => {
  const capitalId = '00000000-0000-4000-8000-000000000001';
  const colonyId = '00000000-0000-4000-8000-000000000002';
  const runId = '00000000-0000-4000-8000-000000000003';
  const response = (originPlanetId = capitalId) => {
    const recalledAt = new Date('2026-08-26T08:01:00.000Z');
    const homeAt = new Date('2026-08-26T08:02:00.000Z');
    return miningRecallSchema.parse({
      runId, homeAt,
      mining: status([{
        ...run('mining'), id: runId, planetId: originPlanetId,
        status: 'returning', recalledAt, arriveAt: recalledAt, homeAt,
      }]),
      pending: [],
      planet: planetView({ flight: { used: 1, total: 3 } }, { id: originPlanetId }),
    });
  };

  const setup = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const recallMining = vi.fn().mockResolvedValue(response());
    const mine = vi.fn();
    const collect = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <ApiProvider api={{ recallMining, collect, mine } as unknown as Api}>{children}</ApiProvider>
      </QueryClientProvider>
    );
    return { client, recallMining, collect, mine, wrapper };
  };

  it('does not replace capital hardware or resources when recalling another colony’s craft', async () => {
    const { client, recallMining, wrapper } = setup();
    const capital = planetView({}, { id: capitalId, alloy: 900 });
    client.setQueryData(keys.planet, capital);
    client.setQueryData(keys.miningStatus, status());
    recallMining.mockResolvedValue(response(colonyId));
    const view = renderHook(() => useRecallMining(), { wrapper });
    await act(async () => {
      await view.result.current.mutateAsync({ runId, originPlanetId: colonyId });
    });
    expect(client.getQueryData(keys.planet)).toEqual(capital);
    expect(client.getQueryData<PlanetView>(keys.planetById(colonyId))?.planet.id).toBe(colonyId);
    expect(client.getQueryData<MiningStatusView>(keys.miningStatus)?.runs[0]?.status).toBe('returning');
    expect(client.getQueryData<MiningStatusView>(keys.miningStatusById(colonyId))?.runs[0]?.status)
      .toBe('returning');
  });

  it('waits for a same-origin resource mutation before sending recall and applying a whole planet', async () => {
    const { client, recallMining, collect, wrapper } = setup();
    client.setQueryData(keys.planet, planetView({}, { id: capitalId }));
    let finishCollect!: (value: { planet: PlanetView }) => void;
    collect.mockReturnValue(new Promise<{ planet: PlanetView }>((resolve) => { finishCollect = resolve; }));
    const view = renderHook(() => ({ collect: useCollect(), recall: useRecallMining() }), { wrapper });
    act(() => { view.result.current.collect.mutate(); });
    await waitFor(() => { expect(collect).toHaveBeenCalledTimes(1); });
    act(() => { view.result.current.recall.mutate({ runId, originPlanetId: capitalId }); });
    // Allow the second onMutate to reach the shared write lane.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
    expect(recallMining).not.toHaveBeenCalled();
    act(() => { finishCollect({ planet: planetView({}, { id: capitalId, alloy: 1000 }) }); });
    await waitFor(() => { expect(view.result.current.recall.isSuccess).toBe(true); });
    expect(recallMining).toHaveBeenCalledTimes(1);
  });

  it('orders mining and recall responses across different origins before replacing the commander-wide roster', async () => {
    const { client, recallMining, mine, wrapper } = setup();
    client.setQueryData(keys.planet, planetView({}, { id: capitalId }));
    const launched = miningLaunchSchema.parse({
      runId: runId, craft: 1, flightMinutes: 5,
      arriveAt: run('mining').arriveAt, intercept: run('mining').intercept, capacity: 400,
      mining: status([run('mining')]), pending: [], planet: planetView({}, { id: capitalId }),
    });
    let finishMining!: (value: typeof launched) => void;
    mine.mockReturnValue(new Promise<typeof launched>((resolve) => { finishMining = resolve; }));
    recallMining.mockResolvedValue(response(colonyId));
    const view = renderHook(() => ({ mine: useMine(), recall: useRecallMining() }), { wrapper });
    act(() => { view.result.current.mine.mutate({ asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw', craft: 1 }); });
    await waitFor(() => { expect(mine).toHaveBeenCalledTimes(1); });
    act(() => { view.result.current.recall.mutate({ runId, originPlanetId: colonyId }); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
    expect(recallMining).not.toHaveBeenCalled();
    act(() => { finishMining(launched); });
    await waitFor(() => { expect(view.result.current.recall.isSuccess).toBe(true); });
    expect(client.getQueryData<MiningStatusView>(keys.miningStatus)?.runs[0]?.status).toBe('returning');
  });
});

const status = (runs: MiningRun[] = []): MiningStatusView => ({
  derrick: false,
  craftSpeed: 330,
  craftHold: 400,
  craftReadyAt: null, derrickHold: 600,
  runs,
  isotopes: [],
});

describe.each<Departure>(['mining', 'salvage'])('%s launch cache hand-off', (kind) => {
  let client: QueryClient;
  let mine: ReturnType<typeof vi.fn>;
  let harvest: ReturnType<typeof vi.fn>;
  let miningStatus: ReturnType<typeof vi.fn>;
  let answerOldStatus: ((value: MiningStatusView) => void) | null;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    answerOldStatus = null;
    miningStatus = vi.fn(() => new Promise<MiningStatusView>((resolve) => {
      answerOldStatus = resolve;
    }));

    const launched = run(kind);
    const response = miningLaunchSchema.parse({
      runId: launched.id,
      ...(kind === 'mining' ? { asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw' } : {}),
      craft: 1,
      arriveAt: launched.arriveAt,
      flightMinutes: 5,
      intercept: launched.intercept,
      capacity: 400,
      mining: status([launched]),
      pending: [],
      planet: planetView(
        { fleet: { DART: 12, PROSPECTOR: 0 }, flight: { used: 1, total: 3 } },
      ),
    });
    mine = vi.fn().mockResolvedValue(response);
    harvest = vi.fn().mockResolvedValue(response);
  });

  const wrapper = ({ children }: { children: ReactNode }) => {
    const api = {
      miningField: vi.fn().mockResolvedValue({
        asteroids: [], debris: [], nextFieldChangeAt: null,
      }),
      miningStatus,
      mine,
      harvest,
    } as unknown as Api;
    return (
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>{children}</ApiProvider>
      </QueryClientProvider>
    );
  };

  it('writes the POST views directly and ignores a pre-tap status response', async () => {
    const otherWorldKey = keys.miningStatusById('00000000-0000-4000-8000-000000000002');
    client.setQueryData(otherWorldKey, status());
    const view = renderHook(() => ({
      mining: useMining(),
      mine: useMine(),
      harvest: useHarvest(),
    }), { wrapper });

    await waitFor(() => {
      expect(miningStatus).toHaveBeenCalledTimes(1);
    });

    act(() => {
      if (kind === 'mining') {
        view.result.current.mine.mutate({ asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw', craft: 1 });
      }
      else view.result.current.harvest.mutate({ fieldId: 'field-1', craft: 1 });
    });

    await waitFor(() => {
      expect(client.getQueryData<MiningStatusView>(keys.miningStatus)?.runs[0]?.id)
        .toBe(run(kind).id);
    });
    expect(client.getQueryData<MiningStatusView>(otherWorldKey)?.runs[0]?.id)
      .toBe(run(kind).id);

    // This GET began before the launch and says there were no runs. Cancellation
    // means its later completion cannot overwrite the transaction's POST answer.
    act(() => {
      answerOldStatus?.(status());
    });
    await waitFor(() => {
      expect(client.getQueryData<MiningStatusView>(keys.miningStatus)?.runs[0]?.id)
        .toBe(run(kind).id);
    });

    expect(miningStatus, 'launch triggered a second mining status RTT').toHaveBeenCalledTimes(1);
    expect(client.getQueryData<{ pending: unknown[] }>(keys.pending)?.pending).toEqual([]);
    expect(client.getQueryData<PlanetView>(keys.planet)?.flight.used).toBe(1);
    if (kind === 'mining') expect(mine).toHaveBeenCalledTimes(1);
    else expect(harvest).toHaveBeenCalledTimes(1);
  });
});
