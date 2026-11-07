import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { wireVessel } from './starterVesselFixture.js';
import { useStarterTutorial } from '../src/starter/tutorial/useStarterTutorial.js';

const state = vi.hoisted((): { ship: string; runs: { departAt: Date; arriveAt: Date; homeAt: Date | null }[] } => ({ ship: 'memory-1', runs: [] }));
vi.mock('../src/api/queries.js', () => ({
  usePlanet: () => ({ data: { vessel: vesselSchema.parse(wireVessel({ id: state.ship })) }, dataUpdatedAt: Date.now() }),
  usePending: () => ({ data: { pending: [] } }),
  useMining: () => ({ data: { runs: state.runs } }),
  useGalaxy: () => ({ data: undefined }),
}));
vi.mock('../src/lib/projection.js', () => ({ useProjected: () => ({ alloy: 0, crystal: 0, bufferAlloy: 0, bufferCrystal: 0 }) }));

describe('tutorial acknowledgement memory', () => {
  it('reads once per ship, updates on acknowledgement and keeps ships separate', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const { result, rerender } = renderHook(() => useStarterTutorial('galaxy'));
    rerender(); rerender();
    expect(get.mock.calls.filter(([key]) => key === 'astera.starter.tutorial.memory-1')).toHaveLength(1);
    act(() => { result.current?.ack('welcome'); });
    expect(localStorage.getItem('astera.starter.tutorial.memory-1')).toContain('welcome');
    state.ship = 'memory-2'; rerender();
    expect(result.current?.answer).toMatchObject({ id: 'lookAround' });
    state.ship = 'memory-1'; rerender();
    expect(result.current?.answer).not.toMatchObject({ id: 'lookAround' });
    get.mockRestore();
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
