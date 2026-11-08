import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { openingProgress, type VesselProgress } from '@astera/rules';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { PlanetView } from '../src/api/schemas.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import i18n from '../src/i18n/index.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { YardDeck } from '../src/starter/YardDeck.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { wireVessel } from './starterVesselFixture.js';

let current: PlanetView | undefined;
vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return { ...actual, usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false }) };
});

afterEach(() => { cleanup(); current = undefined; });

const NOW = new Date('2026-11-08T12:00:00.000Z').getTime();
const shipWith = (progress: Partial<VesselProgress>) => vesselSchema.parse(wireVessel({ fleet: { DART: 2 }, progress: { ...openingProgress(), ...progress } }));
/** A Shipyard and nothing behind it: no battle, no Aegis. */
const YARD = { modules: { ...openingProgress().modules, REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, SHIPYARD: 1 } };

const wrap = ({ children }: { children: ReactNode }) => {
  const api = new Api({ fetch: (() => Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))) as unknown as typeof fetch });
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>;
};

/**
 * THE SHIPYARD'S OWN DOORS (owner 2026-11-08, N2). An outpost is the shipyard's first fight, so what
 * that fight needs opens with the yard: the Repair Station that mends its ships and the simulator that
 * rehearses it. Neither waits on a battle or the Aegis.
 */
describe('what the shipyard opens', () => {
  it('stands the Repair Station in the yard with no battle and no shield behind it', () => {
    const vessel = shipWith(YARD);
    render(<YardDeck vessel={vessel} view={vesselToPlanetView(vessel)} fetchedAt={NOW} />, { wrapper: wrap });
    expect(screen.getByTestId('ship-dock')).toBeInTheDocument();
  });

  it('keeps the Repair Station out of a yard that is not repaired', () => {
    const vessel = shipWith({});
    render(<YardDeck vessel={vessel} view={vesselToPlanetView(vessel)} fetchedAt={NOW} />, { wrapper: wrap });
    expect(screen.queryByTestId('ship-dock')).toBeNull();
  });

  const simulator = () => screen.queryByRole('button', { name: `${i18n.t('simulator.title')}. ${i18n.t('menu.simulatorHint')}` });
  const menu = () => render(<MenuPanel page="academy" galaxy="Vantage" shard="EU-1" endsAt={null} onOpen={vi.fn()} onSignOut={vi.fn()} />, { wrapper: wrap });

  it('offers the battle simulator aboard once the shipyard is up', () => {
    current = vesselToPlanetView(shipWith(YARD));
    menu();
    expect(simulator()).not.toBeNull();
  });

  it('keeps the battle simulator away before the shipyard', () => {
    current = vesselToPlanetView(shipWith({}));
    menu();
    expect(simulator()).toBeNull();
  });

  // The first battle is the outpost now: the pirates only come to a ship that took the Aegis.
  it('says a raid on an outpost is a first battle too', () => {
    expect(i18n.getFixedT('en')('starter.factHow.FIRST_BATTLE_REPORT')).toBe('Raid an outpost, or meet the pirates once the Aegis is up. That battle\'s report counts.');
    expect(i18n.getFixedT('tr')('starter.factHow.FIRST_BATTLE_REPORT')).toBe('Bir karakola baskın yap ya da Aegis açıkken korsanları karşıla. O savaşın raporu sayılır.');
  });
});
