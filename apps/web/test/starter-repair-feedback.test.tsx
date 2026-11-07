import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useRepairVessel } from '../src/starter/queries.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { wireVessel } from './starterVesselFixture.js';
const state = vi.hoisted(() => ({ order: vi.fn(), sound: vi.fn(), haptic: vi.fn(), apply: vi.fn() }));
vi.mock('../src/api/context.js', () => ({ useApi: () => ({ orderVesselRepair: state.order }) }));
vi.mock('../src/api/queries.js', () => ({ useApplyPlanet: () => state.apply }));
vi.mock('../src/lib/sound.js', () => ({ playSound: state.sound }));
vi.mock('../src/lib/haptics.js', () => ({ haptic: state.haptic }));
/** Owner playtest 2026-11-07: the order's sound ran far too long. A repair order strikes a short arc. */
it('answers an accepted repair with a short arc, a tactile commit and the updated ship', async () => {
  state.order.mockResolvedValue({ vessel: vesselSchema.parse(wireVessel()) });
  const client = new QueryClient();
  const { result } = renderHook(() => useRepairVessel(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  act(() => { result.current.mutate({ module: 'REFINERY', stage: 2 }); });
  await waitFor(() => { expect(state.sound).toHaveBeenCalledWith('arc'); });
  expect(state.haptic).toHaveBeenCalledWith('commit');
  expect(state.apply).toHaveBeenCalled();
});
