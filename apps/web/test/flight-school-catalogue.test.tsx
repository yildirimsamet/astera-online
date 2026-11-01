import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { SchoolPresentationContext } from '../src/onboarding/flightSchool/presentation.js';
import { schoolFetch } from '../src/onboarding/flightSchool/api.js';
import { sceneById } from '../src/onboarding/flightSchool/scenes.js';
import { createSchool, schoolPlanet } from '../src/onboarding/flightSchool/world.js';
it('opens the cargo family for the guided Courier order without changing saved catalogue choices', async () => {
  localStorage.clear();
  const w = createSchool(Date.now()); w.buildings.SHIPYARD = 1;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.planet, schoolPlanet(w));
  const api = new Api({ fetch: schoolFetch(() => w, vi.fn(), () => w.startedAt), authTransport: null });
  render(<QueryClientProvider client={client}><ApiProvider api={api}><ToastProvider>
    <SchoolPresentationContext.Provider value={{ orderSeconds: 3, legSeconds: 6.5, order: { subject: 'COURIER', count: 2 } }}>
      <PlanetScreen focusGroup="reach" />
    </SchoolPresentationContext.Provider>
  </ToastProvider></ApiProvider></QueryClientProvider>);
  expect(await screen.findByText('Courier')).toBeInTheDocument();
  expect(document.querySelector('#row-COURIER [data-open-item]')).toBeInTheDocument();
  client.clear();
});

it('shows the Aegis installation in the native defence section for its lesson', async () => {
  const w = createSchool(Date.now());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.planet, schoolPlanet(w));
  const api = new Api({ fetch: schoolFetch(() => w, vi.fn(), () => w.startedAt), authTransport: null });
  render(<QueryClientProvider client={client}><ApiProvider api={api}><ToastProvider>
    <SchoolPresentationContext.Provider value={{ orderSeconds: 3, legSeconds: 6.5, order: { subject: 'AEGIS', count: 1 } }}>
      <PlanetScreen focusGroup={sceneById('aegis').group} />
    </SchoolPresentationContext.Provider>
  </ToastProvider></ApiProvider></QueryClientProvider>);
  expect(await screen.findByText('Aegis')).toBeInTheDocument();
  client.clear();
});
