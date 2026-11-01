import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { GalaxyView } from '../src/screens/GalaxyView.js';
import type { GalaxyCanvas } from '../src/galaxy/GalaxyCanvas.js';
import { schoolFetch } from '../src/onboarding/flightSchool/api.js';
import { createSchool, SCHOOL_ROCK } from '../src/onboarding/flightSchool/world.js';
vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: (props: Parameters<typeof GalaxyCanvas>[0]) => <>
  <output data-testid="inspection">{props.inspectionPlanetId ?? 'none'}</output><output data-testid="focus">{props.focus?.kind ?? 'none'}</output>
  <button onClick={props.onReady}>Scene ready</button><button onClick={() => { props.onFocus(null); }}>Native launch closes rail</button>
  <button onClick={() => { props.onFocus({ kind: 'planet', id: 'school-target' }); }}>Choose Lyra</button>
</> }));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => false }));
it('applies a restored teaching target after the opening camera has mounted', async () => {
  const w = createSchool(Date.now()); w.instruments.TELESCOPE = 1;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: schoolFetch(() => w, vi.fn(), () => w.startedAt), authTransport: null });
  render(<QueryClientProvider client={client}><ApiProvider api={api}><ToastProvider>
    <GalaxyView panel={null} onPanel={vi.fn()} commander="Aurora" onSignOut={vi.fn()}
      showGuidance={false} coachFocus={{ focus: { kind: 'asteroid', id: SCHOOL_ROCK }, request: 1 }} />
  </ToastProvider></ApiProvider></QueryClientProvider>);
  expect(await screen.findByTestId('focus')).toHaveTextContent('none');
  fireEvent.click(screen.getByRole('button', { name: 'Scene ready' }));
  expect(screen.getByTestId('focus')).toHaveTextContent('asteroid');
  fireEvent.click(screen.getByRole('button', { name: 'Native launch closes rail' }));
  expect(screen.getByTestId('focus')).toHaveTextContent('asteroid');
  client.clear();
});

it('frames the visible rings and shield during a requested planet close-up', async () => {
  const w = createSchool(Date.now());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: schoolFetch(() => w, vi.fn(), () => w.startedAt), authTransport: null });
  render(<QueryClientProvider client={client}><ApiProvider api={api}><ToastProvider>
    <GalaxyView panel={null} onPanel={vi.fn()} commander="Aurora" onSignOut={vi.fn()}
      showGuidance={false} coachFocus={{ focus: { kind: 'planet', id: 'school-3' }, request: 2, inspect: true }} />
  </ToastProvider></ApiProvider></QueryClientProvider>);
  await screen.findByTestId('focus');
  fireEvent.click(screen.getByRole('button', { name: 'Scene ready' }));
  expect(screen.getByTestId('inspection')).toHaveTextContent('school-3');
  client.clear();
});

it('notifies the teaching flow when the native focus rail is closed', async () => {
  const w = createSchool(Date.now()); w.instruments.TELESCOPE = 1;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: schoolFetch(() => w, vi.fn(), () => w.startedAt), authTransport: null });
  const onFocused = vi.fn();
  render(<QueryClientProvider client={client}><ApiProvider api={api}><ToastProvider>
    <GalaxyView panel={null} onPanel={vi.fn()} commander="Aurora" onSignOut={vi.fn()} showGuidance={false} onFocused={onFocused} />
  </ToastProvider></ApiProvider></QueryClientProvider>);
  await screen.findByTestId('focus');
  fireEvent.click(screen.getByRole('button', { name: 'Scene ready' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose Lyra' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Clear selection' }));
  expect(onFocused).toHaveBeenLastCalledWith(null);
  client.clear();
});
