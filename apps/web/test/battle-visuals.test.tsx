import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { BattleReport } from '../src/api/schemas.js';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { BattleReports } from '../src/screens/BattleReports.js';

const report: BattleReport = {
  id: 'battle-1',
  at: new Date('2026-08-20T12:00:00.000Z'),
  grade: 'PARTIAL',
  attacking: true,
  opponentName: 'Sable',
  opponentPlanet: 'Grimhold',
  opponentPlanetId: 'p2',
  rounds: [
    {
      round: 1,
      attackerDamage: 800,
      defenderDamage: 300,
      shieldAbsorbed: 100,
      breacherShieldDamage: 0,
      attackerLosses: { WASP: 2 },
      defenderLosses: { WASP: 6, LANCE: 1 },
    },
  ],
  neutral: false,
  yourPlanet: 'Vantage-3',
  yourLosses: { WASP: 2 },
  theirLosses: { WASP: 6, LANCE: 1 },
  yourFleet: { WASP: 12, HAULER: 2 },
  lootAlloy: 300,
  lootCrystal: 80,
  lootDeuterium: 0,
  dominion: 120,
  shieldAbsorbed: 100,
  cargoLimited: false,
  defenceSalvage: {},
  disruptedMinutes: 60,
  wreckValue: 900,
};

describe('the battle payoff', () => {
  it('opens on a labelled force equation and labelled round balance before prose detail', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['reports'], { reports: [report] });
    const api = { reports: () => Promise.resolve({ reports: [report] }) } as unknown as Api;
    const view = render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <BattleReports />
        </ApiProvider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /you raided sable/i }));
    const verdict = view.container.querySelector<HTMLElement>('[data-battle-verdict="PARTIAL"]');
    expect(verdict).not.toBeNull();
    const opening = within(verdict!);
    expect(opening.getByText('Sent')).toBeVisible();
    expect(opening.getByText('Lost')).toBeVisible();
    expect(opening.getByText('Returned')).toBeVisible();
    expect(opening.getByText('You destroyed')).toBeVisible();
    expect(screen.getByText('You dealt')).toBeVisible();
    expect(screen.getByText('You took')).toBeVisible();
    expect(screen.getAllByText('800').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('300').length).toBeGreaterThanOrEqual(1);
  });
});
