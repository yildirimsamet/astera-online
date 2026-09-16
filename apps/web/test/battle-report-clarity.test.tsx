import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { reportsSchema, type BattleReport } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { BattleReportDoor } from '../src/screens/BattleReports.js';

// Illustrative casualty distribution, NOT a replay of CaptainZovi's individual hull losses.
const wing = { DART: 95, COURIER: 9 };
const casualties = { DART: 16, PIKE: 6 };
const rounds = [
  { round: 1, attackerDamage: 3262, defenderDamage: 3966, shieldAbsorbed: 203,
    shieldBefore: 203, shieldAfter: 0, attackerHullDamage: 3059, shieldBreakerDamage: 0,
    attackerRoll: 1.02, defenderRoll: 1.03,
    attackerLosses: { DART: 64 }, defenderLosses: { DART: 16 } },
  { round: 2, attackerDamage: 1026, defenderDamage: 2495, shieldAbsorbed: 0,
    shieldBefore: 0, shieldAfter: 0, attackerHullDamage: 1026, shieldBreakerDamage: 0,
    attackerRoll: 0.99, defenderRoll: 1.03,
    attackerLosses: { DART: 31 }, defenderLosses: { PIKE: 6 } },
  { round: 3, attackerDamage: 0, defenderDamage: 3257, shieldAbsorbed: 0,
    shieldBefore: 0, shieldAfter: 0, attackerHullDamage: 0, shieldBreakerDamage: 0,
    attackerRoll: 1, defenderRoll: 1,
    attackerLosses: { COURIER: 9 }, defenderLosses: {} },
];

async function open(over: Partial<BattleReport> = {}) {
  const data = reportsSchema.parse({ rivals: [], reports: [{
    id: 'clarity', missionId: 'clarity-mission', at: '2026-09-15T01:23:00Z',
    grade: 'REPELLED', attacking: true, opponentName: 'Example', opponentPlanet: 'Example-91',
    opponentPlanetId: 'target', neutral: false, yourPlanet: 'Home-237',
    yourFleet: wing, yourLosses: wing, theirFleet: {}, theirLosses: casualties, rounds,
    shieldBefore: 203, shieldAfter: 0, shieldAbsorbed: 203,
    lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: -38680,
    ...over,
  }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['reports'], data);
  const api = new Api({ fetch: vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))) });
  api.reports = vi.fn().mockResolvedValue(data);
  render(<QueryClientProvider client={client}><ApiProvider api={api}>
    <BattleReportDoor missionId="clarity-mission" onClose={vi.fn()} onUnavailable={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  return screen.findByRole('dialog');
}

describe.each(['tr', 'en'])('battle clarity in %s', language => {
  it('states the end result before enemy losses or calculations', async () => {
    await i18n.changeLanguage(language);
    const dialog = await open();
    const verdict = dialog.querySelector('[data-battle-verdict]');
    expect(verdict).toHaveTextContent('104');
    expect(verdict).toHaveTextContent(i18n.t('reports.verdict.noneReturned'));
    expect(verdict).not.toHaveTextContent(i18n.t('reports.verdict.someReturned', { count: 9 }));
    expect(dialog.querySelector('[data-verdict-payoff]')).toHaveTextContent(i18n.t('reports.dominion'));
    expect(dialog.querySelector('[data-verdict-payoff]')).toHaveTextContent('38');
    expect(dialog.querySelector('[data-combat-turning-point]')).toHaveTextContent(
      i18n.t('reports.turningPointSupport', { round: 2, support: '9' }),
    );
  });

  it('distinguishes a reported zero shield from eliminating all defending units', async () => {
    await i18n.changeLanguage(language);
    const dialog = await open();
    expect(dialog).toHaveTextContent(i18n.t('reports.aegis.brokenUnitsRemain'));
    expect(dialog.querySelector('[data-aegis-status="roundedZero"]')).toHaveClass('chip-alloy');
    expect(dialog.querySelector('[data-aegis-status="roundedZero"]')).not.toHaveClass('chip-opportunity');
    expect(dialog.querySelector('[data-their-board="floor"]')).toHaveTextContent(i18n.t('reports.theirBoardFloorNote'));
    expect(dialog.querySelector('[data-no-ground]')).toBeNull();
    expect(dialog.querySelector('[data-enemy-round-standing]')).toBeNull();
    expect(dialog.querySelector('[data-battle-reason]')).toHaveTextContent('42');
  });

  it('separates remaining firing units from support after every round', async () => {
    await i18n.changeLanguage(language);
    const dialog = await open();
    for (const [round, combat, support] of [[1, 31, 9], [2, 0, 9], [3, 0, 0]]) {
      const standing = dialog.querySelector(`[data-round-standing="${String(round)}"]`);
      expect(standing).toHaveTextContent(i18n.t('reports.roundStanding.summary', { combat, support }));
      expect(standing?.closest('details')).toBeNull();
    }
    expect(dialog.querySelector('[data-round-standing="2"]')).toHaveTextContent(i18n.t('reports.roundStanding.supportExposed'));
    expect(dialog.querySelector('[data-round-standing="3"]')).toHaveTextContent(i18n.t('reports.roundStanding.noneLeft'));
    const last = dialog.querySelector('[data-combat-round="3"]');
    expect(last?.querySelector('[data-round-losses]')).toHaveTextContent(i18n.t('reports.roundNoCasualties'));
  });

  it('does not infer surviving units from PARTIAL and a rounded zero shield', async () => {
    await i18n.changeLanguage(language);
    const dialog = await open({ grade: 'PARTIAL' });
    expect(dialog).not.toHaveTextContent(i18n.t('reports.aegis.brokenUnitsRemain'));
    expect(dialog).not.toHaveTextContent(i18n.t('reports.verdict.enemySurvivedNote'));
    expect(dialog).toHaveTextContent(i18n.t('reports.aegis.brokenMeaning'));
    expect(dialog).toHaveTextContent(i18n.t('reports.verdict.enemyUnknownNote'));
  });

  it('shows a fleet wipe as a loss even if the defence was breached', async () => {
    await i18n.changeLanguage(language);
    const dialog = await open({ grade: 'DECISIVE' });
    expect(dialog).toHaveAttribute('aria-label', i18n.t('reports.verdict.title.attacking.DECISIVE_WIPED'));
    expect(dialog.querySelector('[data-battle-verdict]')).toHaveClass('plate-threat');
    expect(dialog.querySelector('[data-verdict-payoff]')).toHaveTextContent('0');
    expect(dialog).toHaveTextContent(i18n.t('reports.verdict.noneReturned'));
    expect(dialog.querySelector('[data-battle-reason]')).toHaveTextContent(
      i18n.t('reports.why.attacking.DECISIVE_WIPED'),
    );
  });

  it('does not frame a partial fleet wipe as a green success', async () => {
    await i18n.changeLanguage(language);
    const dialog = await open({ grade: 'PARTIAL' });
    expect(dialog).toHaveAttribute('aria-label', i18n.t('reports.verdict.title.attacking.PARTIAL_WIPED'));
    expect(dialog.querySelector('[data-battle-verdict]')).toHaveClass('plate-threat');
    expect(dialog.querySelector('[data-battle-reason]')).toHaveTextContent(
      i18n.t('reports.why.attacking.PARTIAL_WIPED'),
    );
  });
});

describe('bounded and historical report information', () => {
  it('adds rebuilt guns only after battle, never to a round’s firing force', async () => {
    const dialog = await open({ attacking: false, grade: 'DECISIVE',
      yourFleet: { BASTION: 10 }, yourLosses: { BASTION: 10 }, defenceSalvage: { BASTION: 6 },
      theirFleet: { PIKE: 100 }, theirLosses: {}, rounds: [{ ...rounds[0]!,
        attackerLosses: {}, defenderLosses: { BASTION: 10 } }] });
    const verdict = within(dialog.querySelector<HTMLElement>('[data-battle-verdict]')!);
    const standing = verdict.getByText(i18n.t('reports.verdict.standing')).parentElement;
    expect(standing).toHaveTextContent('6');
    expect(dialog.querySelector('[data-round-standing="1"]')).toHaveTextContent(
      i18n.t('reports.roundStanding.summary', { combat: 0, support: 0 }),
    );
    expect(dialog).toHaveTextContent(i18n.t('reports.force.rebuiltNote', { count: '6' }));
  });

  it('never displays a defender roster to an attacker, even if an unexpected field arrives', async () => {
    const dialog = await open({ theirFleet: { CITADEL: 999, COURIER: 999 } });
    expect(dialog.querySelector('[data-their-board="arrived"]')).toBeNull();
    expect(dialog).not.toHaveTextContent('999');
  });

  it('shows incoming survivors to a defender and uses the correct side’s round losses', async () => {
    const dialog = await open({ attacking: false, yourFleet: { ...casualties, RAMPART: 30 },
      yourLosses: casualties, theirFleet: wing, theirLosses: wing });
    const second = dialog.querySelector('[data-round-standing="2"]');
    expect(second).toHaveTextContent(i18n.t('reports.roundStanding.summary', { combat: 30, support: 0 }));
    expect(second?.querySelector('[data-enemy-round-standing]')).toHaveTextContent(
      i18n.t('reports.roundStanding.summary', { combat: 0, support: 9 }),
    );
  });

  it('does not invent zeros when a starting roster was not recorded', async () => {
    const dialog = await open({ attacking: false, grade: 'DECISIVE', yourFleet: {}, theirFleet: {} });
    expect(dialog.querySelector('[data-own-roster-unknown]')).toBeVisible();
    expect(dialog.querySelector('[data-their-board="complete"]')).toBeNull();
    expect(dialog.querySelector('[data-their-board="floor"]')).toHaveTextContent(i18n.t('reports.theirBoardMissingRosterNote'));
    const verdict = within(dialog.querySelector<HTMLElement>('[data-battle-verdict]')!);
    expect(verdict.queryByText(i18n.t('reports.verdict.standing'))).toBeNull();
  });

  it('still shows known incoming counts when the defender’s own old roster is missing', async () => {
    const dialog = await open({ attacking: false, yourFleet: {}, theirFleet: wing, theirLosses: wing });
    const second = dialog.querySelector('[data-round-standing="2"]');
    expect(second).toHaveTextContent(i18n.t('reports.roundStanding.unknownOwn'));
    expect(second?.querySelector('[data-enemy-round-standing]')).toHaveTextContent(
      i18n.t('reports.roundStanding.summary', { combat: 0, support: 9 }),
    );
  });

  it('keeps casualties visible while calculations open only on request', async () => {
    const dialog = await open();
    const first = dialog.querySelector<HTMLElement>('[data-combat-round="1"]')!;
    expect(first.querySelector('[data-round-losses]')?.closest('details')).toBeNull();
    expect(first.querySelector('details')).not.toHaveAttribute('open');
    await userEvent.click(within(first).getByText(i18n.t('reports.roundCalculationToggle')));
    expect(first.querySelector('details')).toHaveAttribute('open');
    expect(within(first).getByText(i18n.t('reports.calculation.yourShot'))).toBeVisible();
  });
});
