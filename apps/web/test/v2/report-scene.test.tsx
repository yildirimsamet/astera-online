import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FAULT } from '@astera/rules';
import type { BattleReport } from '../../src/api/schemas.js';
import { combatClassLabel, hullLabel } from '../../src/i18n/names.js';
import { compact } from '../../src/lib/format.js';
import { ReportScene } from '../../src/v2/hud/ReportScene.js';

/**
 * THE REPORT SCENE. Spec B15 · E6 (docs/ui-v2/gozlemevi.md), the mock's "KISMİ ZAFER".
 *
 * The word, the world, the haul, both sides — yours sent → left; theirs only what was
 * destroyed, the rest hidden (rule 15) — one sentence of why from the class data, the
 * balance (loot, fuel, loss) and, on a colony, the loyalty rule. The defender reads the
 * force that flew at them.
 */

const base: BattleReport = {
  id: 'b1',
  missionId: 'm1',
  at: new Date('2026-09-24T21:40:00.000Z'),
  grade: 'PARTIAL',
  attacking: true,
  opponentName: 'VEX',
  opponentPlanet: 'Kestrel',
  opponentPlanetId: 'p2',
  neutral: false,
  yourPlanet: 'Bellwether',
  rounds: [
    { round: 1, attackerDamage: 800, defenderDamage: 300, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: { DART: 6 }, defenderLosses: { TALON: 10 } },
    { round: 2, attackerDamage: 640, defenderDamage: 120, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: { DART: 3 }, defenderLosses: { TALON: 8 } },
    { round: 3, attackerDamage: 100, defenderDamage: 90, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: { COURIER: 1 }, defenderLosses: {} },
  ],
  yourLosses: { DART: 9, COURIER: 1 },
  theirLosses: { TALON: 18 },
  yourFleet: { DART: 23, COURIER: 3 },
  theirFleet: {},
  lootAlloy: 3_100,
  lootCrystal: 1_000,
  lootDeuterium: 240,
  dominion: 120,
  dominionBreakdown: null,
  shieldAbsorbed: 0,
  cargoLimited: true,
  defenceSalvage: {},
  disruptedMinutes: 0,
  wreckValue: 0,
  fuelPaid: 320,
};

const report = (over: Partial<BattleReport> = {}): BattleReport => ({ ...base, ...over });

describe('the report scene', () => {
  it('leads with the word, the world, the time and the rounds', () => {
    render(<ReportScene report={report()} word="Partial victory" />);
    const scene = document.querySelector<HTMLElement>('[data-report-scene]')!;
    expect(within(scene).getByText('Partial victory')).toBeInTheDocument();
    expect(scene).toHaveTextContent('Battle report · Kestrel');
    expect(scene).toHaveTextContent('3 rounds');
  });

  it('shows the haul from the reader’s side, and says when the hold filled', () => {
    render(<ReportScene report={report()} word="Partial victory" />);
    const loot = document.querySelector<HTMLElement>('[data-report-loot]')!;
    expect(loot).toHaveTextContent(`+${compact(3_100)}`);
    expect(loot).toHaveTextContent(`+${compact(1_000)}`);
    expect(loot).toHaveTextContent(/hold full/i);
  });

  /** Rule 15: the attacker learns what they destroyed, never what the other side still has. */
  it('gives the attacker only what they destroyed, and says the rest is hidden', () => {
    render(<ReportScene report={report()} word="Partial victory" />);
    const theirs = document.querySelector<HTMLElement>('[data-side="theirs"]')!;
    expect(theirs).toHaveTextContent('18 destroyed');
    expect(theirs).toHaveTextContent(hullLabel('TALON'));
    expect(theirs).toHaveTextContent(/stays hidden/i);
    expect(theirs).not.toHaveTextContent('→');
  });

  it('gives the reader their own side as sent → left', () => {
    render(<ReportScene report={report()} word="Partial victory" />);
    const yours = document.querySelector<HTMLElement>('[data-side="yours"]')!;
    expect(yours).toHaveTextContent('26 → 16');
    expect(yours).toHaveTextContent(hullLabel('DART'));
  });

  /** And the defender reads the force that flew at them, as it arrived and as it left. */
  it('shows the defender the attacker’s whole force', () => {
    render(<ReportScene
      report={report({ attacking: false, theirFleet: { DART: 23, COURIER: 3 }, theirLosses: { DART: 9 }, yourFleet: { TALON: 30 }, yourLosses: { TALON: 18 }, fuelPaid: null })}
      word="Raided"
    />);
    const theirs = document.querySelector<HTMLElement>('[data-side="theirs"]')!;
    expect(theirs).toHaveTextContent('26 → 17');
    expect(theirs).not.toHaveTextContent(/stays hidden/i);
  });

  it('says why in one sentence off the class data', () => {
    render(<ReportScene report={report()} word="Partial victory" />);
    const why = document.querySelector<HTMLElement>('[data-report-why]')!;
    expect(why).toHaveTextContent(combatClassLabel('SKIRMISHER'));
  });

  it('balances loot, fuel and loss on one line', () => {
    render(<ReportScene report={report()} word="Partial victory" />);
    const balance = document.querySelector<HTMLElement>('[data-report-balance]')!;
    expect(balance).toHaveTextContent(`loot +${compact(4_340)}`);
    expect(balance).toHaveTextContent('fuel −320');
    expect(balance).toHaveTextContent(`9 ${hullLabel('DART')}`);
  });

  it('leaves the fuel out where the launch never recorded it', () => {
    render(<ReportScene report={report({ fuelPaid: null })} word="Partial victory" />);
    expect(document.querySelector('[data-report-balance]')).not.toHaveTextContent(/fuel/i);
  });

  it('states the colony loyalty rule on a colony, and nowhere else', () => {
    const { rerender } = render(<ReportScene report={report()} word="Partial victory" colonyTarget />);
    const rule = document.querySelector<HTMLElement>('[data-report-colony]')!;
    expect(rule).toHaveTextContent(String(FAULT.battleLoyaltyLoss.DECISIVE));
    expect(rule).toHaveTextContent(String(FAULT.battleLoyaltyLoss.PARTIAL));
    rerender(<ReportScene report={report()} word="Partial victory" />);
    expect(document.querySelector('[data-report-colony]')).toBeNull();
  });

  it('takes the attacker back to the target, and offers the defender no raid', async () => {
    const onAttackAgain = vi.fn();
    const { rerender } = render(<ReportScene report={report()} word="Partial victory" onAttackAgain={onAttackAgain} />);
    await userEvent.click(screen.getByRole('button', { name: 'Attack again' }));
    expect(onAttackAgain).toHaveBeenCalledTimes(1);
    rerender(<ReportScene report={report({ attacking: false })} word="Raided" onAttackAgain={onAttackAgain} />);
    expect(screen.queryByRole('button', { name: 'Attack again' })).toBeNull();
  });
});
