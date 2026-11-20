import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { buildingCost } from '@astera/rules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys, useRaiseInstrument, useUpgrade } from '../src/api/queries.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';
import type * as Haptics from '../src/lib/haptics.js';
import type * as Sound from '../src/lib/sound.js';

const feedback = vi.hoisted(() => ({ playSound: vi.fn(), haptic: vi.fn() }));
vi.mock('../src/lib/sound.js', async original => ({ ...await original<typeof Sound>(), playSound: feedback.playSound }));
vi.mock('../src/lib/haptics.js', async original => ({ ...await original<typeof Haptics>(), haptic: feedback.haptic }));

/**
 * AN UPGRADE THAT IS DONE ON THE TAP ANSWERS ON THE TAP (owner, 2026-11-20; plan §5.6). The five-minute
 * rule finishes the order in the server's answer, so that answer is the moment the building rises: the
 * hand and the ear hear it, as they do when a research is completed. An order that joined the queue stays
 * quiet until its own completion.
 */
const world = (vault: number, veil = 0): PlanetView => planetView(
  { buildings: { CORE: 3, REFINERY: 2, EXTRACTOR: 2, VAULT: vault, SHIPYARD: 1 }, instruments: { VEIL: veil },
    nextCosts: { VAULT: buildingCost('VAULT', vault) } },
  { alloy: 500_000, crystal: 500_000, alloyCap: 999_999, crystalCap: 999_999 },
);

/** The world as the server answers it: no optimistic marker can be in it. */
const answer = (view: PlanetView) => ({ ...view, queues: { CONSTRUCTION: [], YARD: [] }, researchQueue: [] });

describe('the answer to an instant upgrade', () => {
  let client: QueryClient;
  let api: Api;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );

  beforeEach(() => {
    feedback.playSound.mockClear();
    feedback.haptic.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(keys.planet, world(1));
    api = new Api({ fetch: vi.fn<typeof globalThis.fetch>() });
  });

  it('rings and knocks when the building stands at its new level in the answer', async () => {
    vi.spyOn(api, 'upgrade').mockResolvedValue({ type: 'VAULT', level: 2, alloy: 0, crystal: 0, planet: answer(world(2)) });
    const { result } = renderHook(() => useUpgrade(), { wrapper });
    act(() => { result.current.mutate('VAULT'); });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(feedback.playSound).toHaveBeenCalledWith('confirm');
    expect(feedback.haptic).toHaveBeenCalledWith('commit');
  });

  it('stays quiet when the order only joined the queue', async () => {
    vi.spyOn(api, 'upgrade').mockResolvedValue({ type: 'VAULT', level: 2, alloy: 0, crystal: 0, planet: answer(world(1)) });
    const { result } = renderHook(() => useUpgrade(), { wrapper });
    act(() => { result.current.mutate('VAULT'); });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(feedback.playSound).not.toHaveBeenCalledWith('confirm');
    expect(feedback.haptic).not.toHaveBeenCalled();
  });

  it('answers an instrument raised at once the same way', async () => {
    vi.spyOn(api, 'raiseInstrument').mockResolvedValue({ type: 'VEIL', level: 1, planet: answer(world(1, 1)) });
    const { result } = renderHook(() => useRaiseInstrument(), { wrapper });
    act(() => { result.current.mutate('VEIL'); });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(feedback.playSound).toHaveBeenCalledWith('confirm');
    expect(feedback.haptic).toHaveBeenCalledWith('commit');
  });
});
