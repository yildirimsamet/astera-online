import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { reportsSchema } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { hullLabel } from '../src/i18n/names.js';
import { BattleReportDoor } from '../src/screens/BattleReports.js';

const base = {
  id: 'intel-report', missionId: 'intel-report', at: '2026-11-10T11:03:41Z',
  grade: 'REPELLED', attacking: true, opponentName: 'Opponent', opponentPlanet: 'Target', opponentPlanetId: 'target',
  yourPlanet: 'Home', neutral: false, rounds: [], yourFleet: { DART: 2 }, yourLosses: { DART: 2 },
  theirFleet: { CORSAIR: 4, ARGOSY: 1 }, theirLosses: {},
  lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: 0,
};

async function open(monument: boolean, visibility: string, attacking = true, over: Record<string, unknown> = {}) {
  const data = reportsSchema.parse({ rivals: [], reports: [{ ...base,
    ...(monument ? { kind: 'MONUMENT', monument: { id: 'm', ordinal: 1, position: { x: 1, y: 0, z: 0 } },
      control: 'DEFENDER', roundCount: 1, yourSurvivors: {}, yourDamage: [] } : {}),
    enemyFleetVisibility: visibility, attacking,
    theirFleet: visibility === 'FULL' ? base.theirFleet : {}, ...over,
  }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['reports'], data);
  const api = new Api();
  api.reports = vi.fn().mockResolvedValue(data);
  render(<QueryClientProvider client={client}><ApiProvider api={api}>
    <BattleReportDoor missionId="intel-report" onClose={vi.fn()} onUnavailable={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  return screen.findByRole('dialog');
}

describe.each(['tr', 'en', 'de', 'fr', 'es', 'ja'])('battle intelligence in %s', language => {
  it.each([false, true])('shows an eligible attacker the entire starting force even after a defeat (monument=%s)', async monument => {
    await i18n.changeLanguage(language);
    const dialog = await open(monument, 'FULL');
    const fleet = dialog.querySelector('[data-their-board="full"]');
    expect(fleet).toHaveTextContent(i18n.t('reports.enemyFleetAtBattle'));
    expect(fleet?.querySelector('[data-enemy-hull="CORSAIR"]')).toHaveTextContent('4');
    expect(fleet?.querySelector('[data-enemy-hull="ARGOSY"]')).toHaveTextContent('1');
    expect(fleet).toHaveTextContent(i18n.t('reports.enemyFleetSnapshot'));
    expect(dialog).not.toHaveTextContent(i18n.t('reports.verdict.enemySurvivedNote'));
    expect(dialog).not.toHaveTextContent(i18n.t('reports.verdict.enemyUnknownNote'));
    if (!monument) {
      const scene = dialog.querySelector('[data-side="theirs"]');
      expect(scene).toHaveTextContent(hullLabel('ARGOSY'));
      expect(scene).toHaveTextContent('5 → 5');
      expect(scene).not.toHaveTextContent(i18n.t('reportScene.hidden'));
    }
  });

  it.each([false, true])('explains insufficient force without pretending the missing roster is empty (monument=%s)', async monument => {
    await i18n.changeLanguage(language);
    const dialog = await open(monument, 'INSUFFICIENT_FORCE');
    expect(dialog).toHaveTextContent(i18n.t('reports.enemyFleetInsufficient'));
    expect(dialog.querySelector('[data-their-board="full"]')).toBeNull();
    expect(dialog.querySelector('[data-enemy-hull]')).toBeNull();
  });

  it.each([false, true])('distinguishes unknown historical permission from insufficient force (monument=%s)', async monument => {
    await i18n.changeLanguage(language);
    const dialog = await open(monument, 'UNKNOWN');
    expect(dialog).toHaveTextContent(i18n.t('reports.enemyFleetUnknown'));
    expect(within(dialog).queryByText(i18n.t('reports.enemyFleetInsufficient'))).toBeNull();
  });
});

it.each([false, true])('distinguishes a known empty enemy force from an unknown roster (monument=%s)', async monument => {
  const dialog = await open(monument, 'FULL', true, { theirFleet: {} });
  expect(dialog).toHaveTextContent(i18n.t('reports.enemyFleetEmpty'));
  expect(dialog.querySelector('[data-enemy-intel]')).toBeNull();
});
it.each([false, true])('shows the whole incoming force to defenders (monument=%s)', async monument => {
  const dialog = await open(monument, 'FULL', false);
  expect(dialog.querySelector('[data-their-board="arrived"]')).toHaveTextContent(i18n.t('reports.theirBoardArrived'));
  expect(dialog.querySelectorAll('[data-enemy-hull]')).toHaveLength(2);
});

it.each([false, true])('does not infer full intelligence from a decisive grade below the power threshold (monument=%s)', async monument => {
  const dialog = await open(monument, 'INSUFFICIENT_FORCE', true, { grade: 'DECISIVE' });
  expect(dialog).toHaveTextContent(i18n.t('reports.enemyFleetInsufficient'));
  expect(dialog.querySelector('[data-their-board="complete"]')).toBeNull();
  expect(dialog.querySelector('[data-their-board="full"]')).toBeNull();
});

it('shows the known opposing force after a round to eligible attackers', async () => {
  const dialog = await open(false, 'FULL', true, { rounds: [{ round: 1,
    attackerDamage: 100, defenderDamage: 200, shieldAbsorbed: 0, shieldBreakerDamage: 0,
    attackerLosses: { DART: 2 }, defenderLosses: { CORSAIR: 1 } }] });
  expect(dialog.querySelector('[data-enemy-round-standing]')).toHaveTextContent(
    i18n.t('reports.roundStanding.summary', { combat: '3', support: '1' }));
});
