import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import { SchoolPresentationContext } from '../src/onboarding/flightSchool/presentation.js';
import { createSchool, schoolGalaxy, schoolPlanet, SCHOOL_TARGET } from '../src/onboarding/flightSchool/world.js';
import { schoolIntel } from '../src/onboarding/flightSchool/api.js';
import i18n from '../src/i18n/index.js';

describe('first-time telescope dossier', () => {
  it('keeps the real watch control without introducing strategic weapons and colonisation', () => {
    const w = createSchool(Date.now()); w.instruments.TELESCOPE = 1;
    const target = schoolGalaxy(w).planets.find(p => p.id === SCHOOL_TARGET)!;
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 404 })) });
    const view = render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider>
      <SchoolPresentationContext.Provider value={{ orderSeconds: 3, legSeconds: 6.5 }}>
        <PlanetFocus target={target} planet={schoolPlanet(w)} intel={schoolIntel(w)} reports={[]} now={Date.now()} onClose={vi.fn()} onAttack={vi.fn()} onInstallTelescope={vi.fn()} onLaunched={vi.fn()} open onToggle={vi.fn()} />
      </SchoolPresentationContext.Provider>
    </ToastProvider></ApiProvider></QueryClientProvider>);
    expect(screen.getByRole('button', { name: i18n.t('focus.planet.watchSlot', { slot: 1 }) })).toBeInTheDocument();
    expect(screen.queryByText(/EMP/)).not.toBeInTheDocument();
    view.unmount(); queries.clear();
  });
});
