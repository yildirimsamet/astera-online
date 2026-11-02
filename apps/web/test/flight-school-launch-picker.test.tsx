import { fireEvent, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { SchoolPresentationContext } from '../src/onboarding/flightSchool/presentation.js';
import { schoolFetch, schoolIntel } from '../src/onboarding/flightSchool/api.js';
import { createSchool, schoolGalaxy, schoolPlanet, SCHOOL_RAID, SCHOOL_TARGET } from '../src/onboarding/flightSchool/world.js';
it('keeps the picker clear until both 30 Darts and 2 Couriers have been chosen', () => {
  const w = createSchool(Date.now()); w.fleet = SCHOOL_RAID; w.instruments.TELESCOPE = 1; w.buildings.SHIPYARD = 1;
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: schoolFetch(() => w, vi.fn(), () => w.startedAt), authTransport: null });
  const target = schoolGalaxy(w).planets.find(p => p.id === SCHOOL_TARGET)!;
  const view = render(<QueryClientProvider client={cache}><ApiProvider api={api}><ToastProvider>
    <SchoolPresentationContext.Provider value={{ orderSeconds: 3, legSeconds: 6.5, fleet: SCHOOL_RAID }}>
      <LaunchSheet target={{ kind: 'world', world: target }} planet={schoolPlanet(w)} intel={schoolIntel(w)} onClose={vi.fn()} onLaunched={vi.fn()} />
    </SchoolPresentationContext.Provider>
  </ToastProvider></ApiProvider></QueryClientProvider>);
  const dart = document.querySelector<HTMLButtonElement>('[data-hull-row=DART] [data-count-max] button')!;
  const courier = document.querySelector<HTMLButtonElement>('[data-hull-row=COURIER] [data-count-max] button')!;
  fireEvent.click(dart);
  expect(courier).toBeEnabled();
  expect(document.querySelector('[data-launch-warning]')).not.toBeInTheDocument();
  expect(document.querySelector('[data-launch-commit] button')).toBeDisabled();
  fireEvent.click(courier);
  expect(document.querySelector('[data-launch-warning]')).toBeInTheDocument();
  expect(document.querySelector('[data-launch-commit] button')).toBeEnabled();
  view.unmount(); cache.clear();
});
