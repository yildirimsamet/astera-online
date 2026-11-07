import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { openingProgress, type VesselProgress } from '@astera/rules';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { useLaunchPlan } from '../src/lib/useLaunchPlan.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { wireVessel } from './starterVesselFixture.js';

const target = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'post', name: 'OP-1', body: 'OUTPOST', position: { x: 800, y: 0, z: 0 }, coreTier: 1, coreLevel: 1, intel: 'RESOLVED',
  state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false, kind: 'NEUTRAL', ...over,
}) as GalaxyPlanet;

const ATTACKER: VesselProgress = {
  ...openingProgress(),
  modules: { REFINERY: 3, SHIPYARD: 1, SURVEY: 1, AEGIS: 1, HANGAR: 1 },
  facts: ['FIRST_BATTLE_REPORT'],
};

const plan = (progress: VesselProgress, deuterium: number) => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 404 })) });
  const planet = vesselToPlanetView(vesselSchema.parse(wireVessel({ progress, deuterium, fleet: { DART: 6 } })));
  return renderHook(() => useLaunchPlan({ target: { kind: 'world', world: target() }, planet, onLaunched: vi.fn() }), {
    wrapper: ({ children }) => <QueryClientProvider client={cache}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>,
  });
};

describe('sending a fleet from a ship', () => {
  it('offers full speed only: this galaxy has no slower rung to fly', () => {
    const { result } = plan(ATTACKER, 500);
    act(() => { result.current.set('DART', 6); });
    expect(result.current.paces).toEqual([1]);
    expect(result.current.pace).toBe(1);
  });

  it('offers no escort: the commander ship is not out here', () => {
    const { result } = plan(ATTACKER, 500);
    expect(result.current.escort).toBeNull();
  });

  it('asks no fuel while the plant is broken, as the server does', () => {
    const { result } = plan(ATTACKER, 0);
    act(() => { result.current.set('DART', 6); });
    expect(result.current.route?.fuel).toBe(0);
    expect(result.current.refusal).toBeNull();
  });

  it('asks it once the plant works', () => {
    const { result } = plan({ ...ATTACKER, modules: { ...ATTACKER.modules, DEUTERIUM_PLANT: 1 } }, 0);
    act(() => { result.current.set('DART', 6); });
    expect(result.current.route?.fuel).toBeGreaterThan(0);
    expect(result.current.refusal).not.toBeNull();
  });
});
