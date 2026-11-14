import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleReport } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { HonorBattleSummary } from '../src/ui/HonorBattleSummary.js';
import { ReportScene } from '../src/v2/hud/ReportScene.js';

/**
 * THE REPORT'S SCENE ON THE KIT (G5 #3, C16a). The first screen of a report: the world, the
 * word, the haul, both sides at a glance, the why and the balance, and the doors. Drawn with
 * kit parts and stated tones, so the word's colour is a fact a test can read, not a class.
 */

const base: BattleReport = {
  id: 'b1', missionId: 'm1', at: new Date(Date.now() - 20 * 60_000), grade: 'PARTIAL', attacking: true,
  opponentName: 'VEX', opponentPlanet: 'Kestrel', opponentPlanetId: 'p2', neutral: false, yourPlanet: 'Bellwether',
  rounds: [
    { round: 1, attackerDamage: 800, defenderDamage: 300, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: { DART: 6 }, defenderLosses: { TALON: 10 } },
  ],
  yourLosses: { DART: 9, COURIER: 1 }, theirLosses: { TALON: 18 }, yourFleet: { DART: 23, COURIER: 3 }, theirFleet: { TALON: 30 },
  enemyFleetVisibility: 'FULL', lootAlloy: 3_100, lootCrystal: 1_000, lootDeuterium: 240, dominion: 120, dominionBreakdown: null,
  shieldAbsorbed: 0, cargoLimited: true, defenceSalvage: {}, disruptedMinutes: 0, wreckValue: 0, fuelPaid: 320,
  yourDamage: [{ hull: 'DART', count: 2, damageBp: 900 }],
  honor: {
    delta: 38_000_000, reason: 'COMBAT',
    breakdown: { teamDelta: 38_000_000, rawTeamDelta: 41_000_000, participants: 1, contributionPpm: 1_000_000, militaryDamage: 9_200, permanentLoss: 4_100 },
  },
};
const report = (over: Partial<BattleReport> = {}): BattleReport => ({ ...base, ...over });

/** What a kit surface must not carry: the v1/v2 type scale, frames and colours. */
const STRAY = [
  '.text-micro', '.text-caption', '.text-figure', '.text-label', '.text-title', '.text-dim', '.text-bone', '.socket',
  '.v2-legend', '.truncate', '.rounded-control', '.rounded-cell', '.rounded-chip', '.font-v2-mono', '[class*="v2-"]',
  '[class*="border-"]', '[class*="bg-"]',
].join(', ');
/** The ranking readout is shared with the leaderboard and moves with it (G9), not here. */
const strays = (root: Element) => [...root.querySelectorAll(STRAY)]
  .filter((el) => !el.closest('[data-ranking-scores], [data-honor-shared-policy]'))
  .map((el) => `${el.tagName}.${typeof el.className === 'string' ? el.className : ''}`);

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('the report scene on the kit', () => {
  it('draws the scene with kit parts only, raiding and raided', () => {
    const { rerender } = render(<ReportScene report={report()} word="Partial victory" onWatch={vi.fn()} onShare={vi.fn()} onAttackAgain={vi.fn()} />);
    const scene = document.querySelector('[data-report-scene]')!;
    expect(scene).toHaveClass('gk-debrief');
    expect(strays(scene)).toEqual([]);
    rerender(<ReportScene report={report({ attacking: false, enemyFleetVisibility: undefined })} word="Held" />);
    expect(strays(document.querySelector('[data-report-scene]')!)).toEqual([]);
  });

  it('states the word’s colour as its outcome', () => {
    const { rerender } = render(<ReportScene report={report()} word="Partial victory" />);
    expect(document.querySelector('[data-report-word]')).toHaveAttribute('data-tone', 'partial');
    rerender(<ReportScene report={report({ yourLosses: { DART: 23, COURIER: 3 } })} word="Fleet lost" />);
    expect(document.querySelector('[data-report-word]')).toHaveAttribute('data-tone', 'threat');
    rerender(<ReportScene report={report({ grade: 'DECISIVE', yourLosses: {} })} word="Decisive victory" />);
    expect(document.querySelector('[data-report-word]')).toHaveAttribute('data-tone', 'good');
  });

  /*
    THE WORLD IS NAMED HERE AND ENTERED BELOW. The sheet's route (C15a) holds both worlds as
    44 px doors a few lines down; a second, 12 px underlined door to one of them in the hero
    was the same press twice, the smaller one first.
  */
  it('names the far world in the hero and leaves its door to the route', () => {
    render(<ReportScene report={report()} word="Partial victory" />);
    const hero = document.querySelector<HTMLElement>('[data-report-hero]')!;
    expect(within(hero).getByText('Kestrel')).toHaveClass('gk-debrief__planet');
    expect(within(hero).queryByRole('button')).toBeNull();
  });

  it('opens its doors with kit buttons, the raid again as the one action', async () => {
    const onWatch = vi.fn();
    const onAttackAgain = vi.fn();
    render(<ReportScene report={report()} word="Partial victory" onWatch={onWatch} onShare={vi.fn()} onAttackAgain={onAttackAgain} />);
    for (const name of [/watch/i, /to clan/i, /attack again/i]) expect(screen.getByRole('button', { name })).toHaveClass('gk-btn');
    expect(screen.getByRole('button', { name: /attack again/i })).toHaveClass('gk-btn--action');
    await userEvent.click(screen.getByRole('button', { name: /watch/i }));
    expect(onWatch).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /attack again/i }));
    expect(onAttackAgain).toHaveBeenCalledTimes(1);
  });

  it('reads both sides off the kit’s survivor bar', () => {
    render(<ReportScene report={report()} word="Partial victory" />);
    for (const side of ['yours', 'theirs']) {
      expect(document.querySelector(`[data-side="${side}"] .gk-survivor`), side).not.toBeNull();
    }
  });

  /*
    A PIRATE IS NAMED FROM THE LOCALE FILES (D150), on the scene as on the list. The server's
    `opponentName` is its English fallback ("Pirate L2-Rook"); a neutral world has none at all.
  */
  it('names a pirate and a neutral holder from the locale, as the list does', () => {
    const { rerender } = render(<ReportScene report={report({
      opponentName: 'Pirate L2-Rook', opponentPlanet: '', opponentPlanetId: null,
      pirate: { level: 2, callsign: 'Rook', damageMult: 0.7, capturedHull: null },
    })} word="Victory" />);
    const name = i18n.t('pirate.name', { level: 2, callsign: 'Rook' });
    expect(document.querySelector('[data-report-opponent]')).toHaveTextContent(name);
    expect(document.querySelector('[data-side="theirs"]')).toHaveTextContent(name);
    rerender(<ReportScene report={report({ opponentName: '', neutral: true })} word="Victory" />);
    expect(document.querySelector('[data-report-opponent]')).toHaveTextContent(i18n.t('reportScene.neutralSide'));
  });

  it('states a ship-raid lesson’s tone as data', () => {
    render(<ReportScene report={report()} word="Partial victory" told={[{ key: 'beaten', tone: 'warn', text: 'Beaten by Vex' }]} />);
    expect(document.querySelector('[data-told="beaten"]')).toHaveAttribute('data-tone', 'warn');
  });
});

describe('the Honor receipt on the kit', () => {
  it('sits in a kit well, its arithmetic one kit rules row away', () => {
    render(<HonorBattleSummary receipt={base.honor} dominion={120} />);
    const receipt = document.querySelector('[data-honor-result]')!;
    expect(receipt).toHaveClass('gk-well');
    expect(receipt.querySelector('details')).toHaveClass('gk-rules');
    expect(strays(receipt)).toEqual([]);
  });
});
