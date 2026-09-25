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
  /**
   * THE MOCK'S HERO (M4): the report is headed by the reader's own world, then the word,
   * large, then when, how long, and against whom — their name as a chip, their world.
   */
  it('leads with your world, the word, the time, the rounds and whom', () => {
    render(<ReportScene report={report()} word="Partial victory" />);
    const hero = document.querySelector<HTMLElement>('[data-report-hero]')!;
    expect(within(hero).getByRole('heading', { name: 'Partial victory' })).toBeInTheDocument();
    expect(hero).toHaveTextContent('Battle report · Bellwether');
    expect(hero).toHaveTextContent('3 rounds');
    expect(hero.querySelector('[data-report-opponent]')).toHaveTextContent('VEX');
    expect(hero).toHaveTextContent('Kestrel');
  });

  /** A win that cost the whole fleet is a loss to the reader (the sheet's verdict says so too). */
  it('reddens the word when the attacker lost every ship, whatever the grade', () => {
    const { rerender } = render(<ReportScene report={report()} word="Partial victory" />);
    expect(document.querySelector('[data-report-word]')).toHaveClass('text-v2-self');
    rerender(<ReportScene report={report({ yourLosses: { DART: 23, COURIER: 3 } })} word="Fleet lost" />);
    expect(document.querySelector('[data-report-word]')).toHaveClass('text-v2-hostile');
  });

  it('wears the rival’s mark on their name when they are marked', () => {
    const { rerender } = render(<ReportScene report={report()} word="Partial victory" />);
    expect(document.querySelector('[data-report-opponent]')).not.toHaveAttribute('data-rival');
    rerender(<ReportScene report={report()} word="Partial victory" rivalSlot={1} />);
    expect(document.querySelector('[data-report-opponent]')).toHaveAttribute('data-rival', '1');
  });

  /** A walkover had no rounds; "0 rounds" reads as a bug, so the count is left out. */
  it('counts no rounds where nobody fought', () => {
    render(<ReportScene report={report({ rounds: [] })} word="Decisive victory" />);
    expect(document.querySelector('[data-report-scene]')).not.toHaveTextContent(/0 rounds/);
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

  /** The mock's "Neden kısmi?": the question is the word's, not a generic "Why?". */
  it('asks the question the word raises', () => {
    const { rerender } = render(<ReportScene report={report()} word="Partial victory" />);
    expect(document.querySelector('[data-report-why]')).toHaveTextContent(/^Why partial\?/);
    rerender(<ReportScene report={report({ grade: 'REPELLED' })} word="Repelled" />);
    expect(document.querySelector('[data-report-why]')).toHaveTextContent(/^Why repelled\?/);
    rerender(<ReportScene report={report({ grade: 'DECISIVE' })} word="Decisive victory" />);
    expect(document.querySelector('[data-report-why]')).toHaveTextContent(/^Where the losses came from/);
  });

  /**
   * A REPORT IS NEW INTEL (the core loop): what the fight put on the dossier, dated, and
   * on a colony what it took off the loyalty — the rule applied, never their value.
   */
  it('says what the fight added to the dossier, and what it took off a colony', () => {
    const { rerender } = render(<ReportScene report={report()} word="Partial victory" colonyTarget />);
    const intel = document.querySelector<HTMLElement>('[data-report-intel]')!;
    expect(intel).toHaveTextContent(/Kestrel’s defence is on its dossier as of/);
    expect(intel).toHaveTextContent(`colony loyalty −${String(FAULT.battleLoyaltyLoss.PARTIAL)}`);
    rerender(<ReportScene report={report()} word="Partial victory" />);
    expect(document.querySelector('[data-report-intel]')).not.toHaveTextContent(/loyalty/);
  });

  it('claims no new intel where nothing of theirs was met, or for the defender', () => {
    const { rerender } = render(<ReportScene report={report({ theirLosses: {} })} word="Decisive victory" />);
    expect(document.querySelector('[data-report-intel]')).toBeNull();
    rerender(<ReportScene report={report({ attacking: false, theirFleet: { DART: 26 } })} word="Raided" />);
    expect(document.querySelector('[data-report-intel]')).toBeNull();
  });

  /** The mock's three doors: watch the rounds, tell the clan, raid again. */
  it('offers to watch the rounds and to tell the clan', async () => {
    const onWatch = vi.fn();
    const onShare = vi.fn();
    render(<ReportScene report={report()} word="Partial victory" onWatch={onWatch} onShare={onShare} />);
    await userEvent.click(screen.getByRole('button', { name: /watch/i }));
    expect(onWatch).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /to clan/i }));
    expect(onShare).toHaveBeenCalledWith(expect.stringMatching(/Partial victory.*Kestrel/));
  });

  it('offers no rounds to watch where nobody fought, and no doors it was not given', () => {
    const { rerender } = render(<ReportScene report={report({ rounds: [] })} word="Decisive victory" onWatch={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /watch/i })).toBeNull();
    rerender(<ReportScene report={report()} word="Partial victory" />);
    expect(screen.queryByRole('button', { name: /watch|to clan/i })).toBeNull();
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


  it('takes the attacker back to the target, and offers the defender no raid', async () => {
    const onAttackAgain = vi.fn();
    const { rerender } = render(<ReportScene report={report()} word="Partial victory" onAttackAgain={onAttackAgain} />);
    await userEvent.click(screen.getByRole('button', { name: 'Attack again' }));
    expect(onAttackAgain).toHaveBeenCalledTimes(1);
    rerender(<ReportScene report={report({ attacking: false })} word="Raided" onAttackAgain={onAttackAgain} />);
    expect(screen.queryByRole('button', { name: 'Attack again' })).toBeNull();
  });
});
