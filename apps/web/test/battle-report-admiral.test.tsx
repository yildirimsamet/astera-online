import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Api } from '../src/api/client.js';
import type { BattleReport } from '../src/api/schemas.js';
import { ApiProvider } from '../src/api/context.js';
import { BattleReports } from '../src/screens/BattleReports.js';
import i18n from '../src/i18n/index.js';

const base: BattleReport = {
  id: 'b1',
  missionId: 'mission-b1',
  at: new Date('2026-08-26T12:00:00.000Z'),
  grade: 'PARTIAL',
  attacking: true,
  opponentName: 'Sable',
  opponentPlanet: 'Grimhold',
  opponentPlanetId: 'p2',
  neutral: false,
  yourPlanet: 'Vantage-3',
  rounds: [
    {
      round: 1,
      attackerDamage: 800,
      defenderDamage: 300,
      shieldAbsorbed: 100,
      shieldBreakerDamage: 0,
      attackerLosses: { DART: 2 },
      defenderLosses: { DART: 6 },
    },
  ],
  yourLosses: { DART: 2 },
  theirLosses: { DART: 6, BASTION: 1 },
  yourFleet: { DART: 12, COURIER: 3 },
  /** Defender-only: the force that arrived. Empty on an attacker’s report. D164. */
  theirFleet: {},
  lootAlloy: 300,
  lootCrystal: 80,
  lootDeuterium: 0,
  dominion: 120,
  shieldAbsorbed: 100,
  cargoLimited: false,
  defenceSalvage: {},
  yourDamage: [],
  disruptedMinutes: 0,
  wreckValue: 0,
};

const report = (over: Partial<BattleReport> = {}): BattleReport => ({ ...base, ...over });

async function openSheet(one: BattleReport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['reports'], { reports: [one] });
  const api = { reports: () => Promise.resolve({ reports: [one] }) } as unknown as Api;
  const view = render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <BattleReports />
      </ApiProvider>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: new RegExp(one.opponentName) }));
  return view;
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

/** Y9 (owner 2026-10-25): the commander ship that escorted a side is named on the report, to both sides. */
describe('the admiral on the report', () => {
  const kilavuz = [{ side: 'attack' as const, ship: 'kilavuz' as const, level: 4 }];

  it('tells the raider their own ship flew beside the fleet', async () => {
    const view = await openSheet(report({ admirals: kilavuz }));
    expect(view.container.querySelector('[data-effect="admiral"]')).toHaveTextContent(/your commander ship.*Kılavuz.*Lv 4/i);
  });

  it('tells the raider a lost battle sent the ship to repair', async () => {
    const view = await openSheet(report({ grade: 'REPELLED', admirals: kilavuz }));
    expect(view.container.querySelector('[data-effect="admiral"]')).toHaveTextContent(/repair.*60 min/i);
  });

  it('names the raider’s escort to the defender', async () => {
    const view = await openSheet(report({ attacking: false, admirals: kilavuz }));
    expect(view.container.querySelector('[data-effect="admiral"]')).toHaveTextContent(/attacker.*commander ship.*Kılavuz.*Lv 4/i);
  });

  it('says nothing when no ship escorted, and on a report that predates escorts', async () => {
    const view = await openSheet(report({ admirals: [] }));
    expect(view.container.querySelector('[data-effect="admiral"]')).toBeNull();
    view.unmount();
    const old = await openSheet(report());
    expect(old.container.querySelector('[data-effect="admiral"]')).toBeNull();
  });
});
