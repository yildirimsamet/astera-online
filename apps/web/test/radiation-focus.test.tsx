import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import type { GalaxyPlanet, IntelView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * THE CLOUD A WORLD STANDS IN, ON ITS FOCUS SHEET. Plan F10 · the four questions.
 *
 * The world a route would be planned to says what its sky does to ships and the one rule
 * that makes the figure a decision — past twenty percent a ship waits for the Repair
 * Station — before a fleet is picked, not after it has landed.
 */

const NOW = new Date('2026-09-30T12:00:00.000Z');
const target: GalaxyPlanet = {
  id: 'rival-planet', name: 'Orrery-8', owner: 'Sable', position: { x: 100, y: 0, z: 0 },
  coreTier: 2, coreLevel: 6, satellites: [], shielded: false, isSelf: false,
  intel: 'RESOLVED', state: { kind: 'NORMAL' },
};
const intel: IntelView = {
  watching: [], radarLog: [], probeCooldowns: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 }, probeReports: [],
};
const cloud = (over: object = {}) => ({
  id: 'storm', mode: 'EMIT', center: { x: 100, y: 0, z: 0 }, radius: 50, intensityPctPerMinute: 1.5,
  activeFrom: new Date(0), activeUntil: null, ...over,
});

function show(radiation: object[]) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.season, { rivals: [] });
  client.setQueryData(keys.galaxy, { you: { planetId: 'me', playerId: 'me' }, planets: [], radiation });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
  render(
    <Wrapper>
      <PlanetFocus
        target={target} planet={planetView()} intel={intel} reports={[]}
        now={NOW.getTime()} onClose={vi.fn()} onAttack={vi.fn()} onInstallTelescope={vi.fn()}
        onLaunched={vi.fn()} open onToggle={vi.fn()}
      />
    </Wrapper>,
  );
}

const line = () => document.querySelector('[data-radiation-here]');

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('radiation on a world\'s focus sheet', () => {
  it('says nothing under a clear sky', () => {
    show([]);
    expect(line()).toBeNull();
  });

  it('states the dose a minute and the Repair Station\'s line', () => {
    show([cloud()]);
    expect(line()).toHaveTextContent(/radiation/i);
    expect(line()).toHaveTextContent(/1\.5%/);
    expect(line()).toHaveTextContent(/20%/);
  });

  it('writes the figure the way the player\'s language does', async () => {
    await i18n.changeLanguage('tr');
    show([cloud()]);
    expect(line()).toHaveTextContent(/%1,5/);
  });

  it('says a whole figure without a trailing decimal', () => {
    show([cloud({ intensityPctPerMinute: 2 })]);
    expect(line()).toHaveTextContent(/loses 2% of/);
  });

  it('says a shelter covers it', () => {
    show([cloud(), cloud({ id: 'haven', mode: 'SHELTER', intensityPctPerMinute: 0, radius: 10 })]);
    expect(line()).toHaveTextContent(/shelter/i);
  });
});
