import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { ChronicleScreen } from '../src/screens/ChronicleScreen.js';
import type { GalaxyEvent } from '../src/api/schemas.js';

const at = new Date('2026-08-22T08:00:00.000Z');

const initialEvents: GalaxyEvent[] = [
  {
    id: 'raid', kind: 'bombardment', subjectPlanetId: 'target', occurredAt: at,
    payload: { planetName: 'Kestrel-4', commanderName: 'İzci' },
  },
  {
    id: 'core', kind: 'core_tier', subjectPlanetId: 'builder', occurredAt: at,
    payload: { planetName: 'Vantage-7', commanderName: 'Mimar', tier: 3 },
  },
];

function show(
  onFocusPlanet = vi.fn(),
  events: GalaxyEvent[] = initialEvents,
) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.chronicle, {
    pages: [{
      events,
      nextBefore: null,
    }],
    pageParams: [null],
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  render(
    <Wrapper>
      <ChronicleScreen onFocusPlanet={onFocusPlanet} />
    </Wrapper>,
  );
  return { onFocusPlanet };
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Galaxy Chronicle surface', () => {
  it('shows public target stories without attacker, fleet, loot or route fields', () => {
    show();
    expect(screen.getByText('Bombardment reached Kestrel-4')).toBeInTheDocument();
    expect(screen.getByText('İzci’s world came under fire.')).toBeInTheDocument();
    expect(screen.getByText('Vantage-7 reached Core tier 3')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/attacker|fleet|loot|route/i);
  });

  it('routes a remembered public moment back to its world', async () => {
    const { onFocusPlanet } = show();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bombardment reached Kestrel-4' }));
    expect(onFocusPlanet).toHaveBeenCalledWith('target');
  });

  it('groups repeated bombardments of one world inside eight minutes', () => {
    show(vi.fn(), [
      initialEvents[0]!,
      {
        id: 'wreck-between', kind: 'wreck_formed', subjectPlanetId: 'target',
        occurredAt: new Date(at.getTime() - 3 * 60_000),
        payload: { planetName: 'Kestrel-4', commanderName: 'İzci' },
      },
      { ...initialEvents[0]!, id: 'raid-2', occurredAt: new Date(at.getTime() - 7 * 60_000) },
      { ...initialEvents[0]!, id: 'raid-3', occurredAt: new Date(at.getTime() - 20 * 60_000) },
    ]);
    expect(screen.getByText('2 bombardments reached Kestrel-4')).toBeInTheDocument();
    expect(screen.getByText('Bombardment reached Kestrel-4')).toBeInTheDocument();
  });

  it('reads naturally in Turkish', async () => {
    await i18n.changeLanguage('tr');
    show();
    expect(screen.getByRole('log', { name: 'Bu galaksideki herkese açık olaylar' })).toBeInTheDocument();
    expect(screen.getByText('Kestrel-4 bombardımana uğradı')).toBeInTheDocument();
  });

  it('renders the public-only expansion without offering a dead link to an exhausted rock', () => {
    const events: GalaxyEvent[] = [
      {
        id: 'isotope', kind: 'isotope_exhausted', subjectPlanetId: null, occurredAt: at,
        payload: { asteroidIndex: 6 },
      },
      {
        id: 'wreck', kind: 'wreck_formed', subjectPlanetId: 'target', occurredAt: at,
        payload: { planetName: 'Kestrel-4', commanderName: 'İzci' },
      },
      {
        id: 'leader', kind: 'dominion_leader', subjectPlanetId: 'builder', occurredAt: at,
        payload: { planetName: 'Vantage-7', commanderName: 'Mimar' },
      },
      {
        id: 'act', kind: 'season_act', subjectPlanetId: null, occurredAt: at,
        payload: { act: 'sunset' },
      },
    ];
    show(vi.fn(), events);

    expect(screen.getByText('Isotope anomaly #6 was exhausted')).toBeInTheDocument();
    expect(screen.getByText('Wreckage formed at Kestrel-4')).toBeInTheDocument();
    expect(screen.getByText('Mimar took the Dominion lead')).toBeInTheDocument();
    expect(screen.getByText('The Sunset has begun')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/who claimed|attacker|fleet|loot|route/i);

    expect(screen.queryByRole('button', { name: 'Isotope anomaly #6 was exhausted' })).not.toBeInTheDocument();
  });

  it('does not promise control transfer after a capital strike', () => {
    show(vi.fn(), [{
      id: 'capital-impact',
      kind: 'death_star_impact',
      subjectPlanetId: 'capital',
      occurredAt: at,
      payload: {
        planetName: 'Lodestar',
        outcome: 'FIRST_STRIKE',
        capturable: false,
      },
    }]);
    expect(screen.getByText(/capital was devastated/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/may transfer control/i);
  });
});
