import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGalaxyShipModels } from '../../src/arena/hangar/shipModels.js';
import { ShipAssetBoundary } from '../../src/galaxy/ParkedShip.js';

const model = { url: '/arena/galaxy-ships/akinci.glb?v=1', engines: [], nozzle: .03, ktx2: false };
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../src/api/context.js', () => ({ useApi: () => ({ galaxyShipModels: load }) }));
beforeEach(() => { load.mockReset(); load.mockResolvedValue({ models: { akinci: model } }); });
afterEach(() => { vi.useRealTimers(); });
function Ship({ enabled = true }: { enabled?: boolean }) {
  const models = useGalaxyShipModels(enabled);
  return <span>{models?.akinci?.url ?? 'waiting'}</span>;
}
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
it('shares one model catalogue across several visible ships and later mounts', async () => {
  const query = client();
  const view = render(<QueryClientProvider client={query}><Ship /><Ship /><Ship /></QueryClientProvider>);
  await waitFor(() => { expect(screen.getAllByText(model.url)).toHaveLength(3); });
  view.rerender(<QueryClientProvider client={query}><Ship /></QueryClientProvider>);
  expect(load).toHaveBeenCalledOnce();
  query.clear();
});
it('does not request any model catalogue while every ship is outside camera range', () => {
  const query = client();
  render(<QueryClientProvider client={query}><Ship enabled={false} /></QueryClientProvider>);
  expect(screen.getByText('waiting')).toBeInTheDocument();
  expect(load).not.toHaveBeenCalled();
  query.clear();
});
it('keeps the galaxy mounted if a model fails to download or decode', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  function Broken(): never { throw new Error('model download failed'); }
  render(<><span>galaxy remains usable</span><ShipAssetBoundary fallback={<span>ship silhouette</span>}><Broken /></ShipAssetBoundary></>);
  expect(screen.getByText('galaxy remains usable')).toBeInTheDocument();
  expect(screen.getByText('ship silhouette')).toBeInTheDocument();
});

it('renews an expired model session before exposing URLs to a newly visible ship', async () => {
  const query = client();
  query.setQueryData(['galaxy-ship-models'], { akinci: model }, { updatedAt: Date.now() - 6 * 3600_000 });
  let finish: (value: { models: { akinci: typeof model } }) => void = () => undefined;
  load.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<QueryClientProvider client={query}><Ship /></QueryClientProvider>);
  expect(screen.getByText('waiting')).toBeInTheDocument();
  finish({ models: { akinci: model } });
  await screen.findByText(model.url);
  expect(load).toHaveBeenCalledOnce();
  query.clear();
});

it('recovers a temporarily unavailable catalogue without waiting five hours or reloading the game', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const query = client();
  load.mockResolvedValueOnce({ models: null }).mockResolvedValue({ models: { akinci: model } });
  render(<QueryClientProvider client={query}><Ship /></QueryClientProvider>);
  await waitFor(() => { expect(load).toHaveBeenCalledOnce(); });
  expect(screen.getByText('waiting')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
  await screen.findByText(model.url);
  expect(load).toHaveBeenCalledTimes(2);
  query.clear();
});

it('recovers a failed ship download after the connection returns without replacing the galaxy', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let broken = true;
  function Download() { if (broken) throw new Error('offline'); return <span>download recovered</span>; }
  render(<><span>galaxy stays mounted</span><ShipAssetBoundary fallback={<span>ship silhouette</span>}><Download /></ShipAssetBoundary></>);
  expect(screen.getByText('ship silhouette')).toBeInTheDocument();
  broken = false;
  act(() => { window.dispatchEvent(new Event('online')); });
  expect(await screen.findByText('download recovered')).toBeInTheDocument();
  expect(screen.getByText('galaxy stays mounted')).toBeInTheDocument();
});

it('retries once when the network returns before the failed download reaches its boundary', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let broken = true;
  function Download() { if (broken) throw new Error('interrupted'); return <span>late failure recovered</span>; }
  render(<ShipAssetBoundary fallback={<span>ship silhouette</span>}><Download /></ShipAssetBoundary>);
  broken = false;
  await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
  expect(screen.getByText('late failure recovered')).toBeInTheDocument();
});

it('bounds automatic retries while a model remains unavailable', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const failed = vi.fn();
  function Broken(): never { throw new Error('still offline'); }
  render(<ShipAssetBoundary onError={failed} fallback={<span>ship silhouette</span>}><Broken /></ShipAssetBoundary>);
  await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
  const attempts = failed.mock.calls.length;
  expect(attempts).toBeGreaterThan(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(failed).toHaveBeenCalledTimes(attempts);
  expect(screen.getByText('ship silhouette')).toBeInTheDocument();
});
