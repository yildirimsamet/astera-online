import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { useLaunchPlan } from '../src/lib/useLaunchPlan.js';
import { SchoolPresentationContext } from '../src/onboarding/flightSchool/presentation.js';
import { createSchool, schoolGalaxy, schoolPlanet, SCHOOL_RAID, SCHOOL_TARGET } from '../src/onboarding/flightSchool/world.js';

describe('training launch quotes', () => {
  it('offers exactly the taught fleet and quotes the same flight that will be drawn', () => {
    const w = createSchool(Date.now());
    w.instruments.TELESCOPE = 1; w.fleet = { DART: 35, COURIER: 3 };
    w.buildings.SHIPYARD = 1; w.buildings.HANGAR = 2;
    const target = schoolGalaxy(w).planets.find(p => p.id === SCHOOL_TARGET)!;
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 404 })) });
    const { result, unmount } = renderHook(() => useLaunchPlan({ target: { kind: 'world', world: target }, planet: schoolPlanet(w), onLaunched: vi.fn() }), {
      wrapper: ({ children }) => <QueryClientProvider client={cache}><ApiProvider api={api}><ToastProvider>
        <SchoolPresentationContext.Provider value={{ orderSeconds: 3, legSeconds: 6.5, fleet: SCHOOL_RAID }}>{children}</SchoolPresentationContext.Provider>
      </ToastProvider></ApiProvider></QueryClientProvider>,
    });
    expect(result.current.roomFor('DART')).toBe(30);
    expect(result.current.roomFor('COURIER')).toBe(2);
    act(() => { result.current.set('DART', 30); });
    expect(result.current.refusal).not.toBeNull();
    act(() => { result.current.set('COURIER', 2); });
    expect(result.current.refusal).toBeNull();
    expect(result.current.route?.oneWayMinutes).toBe(6.5 / 60);
    unmount(); cache.clear();
  });
});
