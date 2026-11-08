import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { wireVessel } from './starterVesselFixture.js';
import { useStarterTutorial } from '../src/starter/tutorial/useStarterTutorial.js';

const empty = { alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0 };
const state = vi.hoisted(() => ({
  ship: 'memory-1',
  runs: [] as { departAt: Date; arriveAt: Date; homeAt: Date | null }[],
  held: { alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0 },
}));
vi.mock('../src/api/queries.js', () => ({
  usePlanet: () => ({ data: { vessel: vesselSchema.parse(wireVessel({ id: state.ship })) }, dataUpdatedAt: Date.now() }),
  usePending: () => ({ data: { pending: [] } }),
  useMining: () => ({ data: { runs: state.runs } }),
  useGalaxy: () => ({ data: undefined }),
}));
vi.mock('../src/lib/projection.js', () => ({ useProjected: () => state.held }));
afterEach(() => { localStorage.clear(); state.held = empty; state.ship = 'memory-1'; });

describe('tutorial acknowledgement memory', () => {
  it('reads once per ship, updates on acknowledgement and keeps ships separate', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const { result, rerender } = renderHook(() => useStarterTutorial('galaxy'));
    rerender(); rerender();
    expect(get.mock.calls.filter(([key]) => key === 'astera.starter.tutorial.memory-1')).toHaveLength(1);
    expect(result.current?.answer).toMatchObject({ id: 'orderRefinery' });
    act(() => { result.current?.ack('orderRefinery'); });
    expect(localStorage.getItem('astera.starter.tutorial.memory-1')).toContain('orderRefinery');
    expect(result.current?.answer).toMatchObject({ id: 'waitFirst' });
    state.ship = 'memory-2'; rerender();
    expect(result.current?.answer).toMatchObject({ id: 'orderRefinery' });
    state.ship = 'memory-1'; rerender();
    expect(result.current?.answer).toMatchObject({ id: 'waitFirst' });
    get.mockRestore();
  });
});

/** Plan F3 (N1): the hook hands the shell the advisor's offers and what the player picked from them. */
describe('the advisor in the tutorial', () => {
  it('offers what the ship can do, best first, and says where the player stands', () => {
    state.held = { ...empty, alloy: 10_000, crystal: 10_000 };
    const { result } = renderHook(() => useStarterTutorial('ship'));
    expect(result.current?.offers[0]).toMatchObject({ kind: 'repair', step: { module: 'REFINERY', stage: 2 } });
    expect(result.current?.pick).toBeUndefined();
    expect(result.current?.view).toBe('ship');
  });

  it('follows the pick stored for this ship while it is still on offer', () => {
    state.held = { ...empty, alloy: 10_000, crystal: 10_000, bufferAlloy: 50 };
    localStorage.setItem('astera.starter.advice.memory-1', JSON.stringify({ pick: 'collect', shown: true }));
    const { result, rerender } = renderHook(() => useStarterTutorial('galaxy'));
    expect(result.current?.pick).toEqual({ kind: 'collect' });
    state.held = { ...state.held, bufferAlloy: 0 };
    rerender();
    expect(result.current?.pick).toBeUndefined();
  });
});

it('names the mining round trip before arrival and the confirmed home time on return', () => {
  state.runs = [{ departAt: new Date('2026-11-06T12:00:00Z'), arriveAt: new Date('2026-11-06T12:01:00Z'), homeAt: null }];
  const { result, rerender } = renderHook(() => useStarterTutorial('galaxy'));
  expect(result.current?.homeAt?.toISOString()).toBe('2026-11-06T12:02:00.000Z');
  state.runs = [{ ...state.runs[0]!, homeAt: new Date('2026-11-06T12:05:00Z') }];
  rerender();
  expect(result.current?.homeAt?.toISOString()).toBe('2026-11-06T12:05:00.000Z');
  state.runs = [];
});
