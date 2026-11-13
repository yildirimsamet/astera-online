import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { honorReceiptSchema, honorTargetSchema } from '../src/api/schemas.js';
import { leaderboard as en } from '../src/i18n/locales/en/shell.js';
import { leaderboard as tr } from '../src/i18n/locales/tr/shell.js';
import { HonorBattleSummary } from '../src/ui/HonorBattleSummary.js';
import { HonorTargetCard } from '../src/ui/HonorTargetCard.js';

// Owner 2026-11-12: the loss debit follows the return, a lower tier is weak only beyond
// 3:1, and coming back inside a day to a commander far below you is bullying. The player
// has to learn the rule before the launch, not from the receipt.
const target = { enabled: true, eligible: true, related: false, repeated: false, retaliation: false } as const;
const breakdown = { teamDelta: -2_600_000, rawTeamDelta: -2_600_000, participants: 1, contributionPpm: 1_000_000,
  militaryDamage: 10_000, permanentLoss: 1_000, weakTargetDebit: true };

describe('the 2026-11-12 Honor table on screen', () => {
  it('reads the repeat flag from the server and stays compatible with an older server', () => {
    expect(honorTargetSchema.parse({ ...target, kind: 'WEAK', militaryReturn: 'NONE', repeatRaid: true })).toMatchObject({ repeatRaid: true });
    expect(honorTargetSchema.parse({ ...target, kind: 'PEER', militaryReturn: 'NONE' })).not.toHaveProperty('repeatRaid');
    expect(honorReceiptSchema.parse({ delta: -2_600_000, reason: 'WEAK_TARGET', breakdown: { ...breakdown, repeatRaid: true } }))
      .toMatchObject({ breakdown: { repeatRaid: true } });
    expect(() => honorReceiptSchema.parse({ delta: 0, reason: 'WEAK_TARGET', breakdown: { ...breakdown, repeatRaid: 'yes' } })).toThrow();
  });

  it('tells a first raid on a far smaller navy that it neither earns nor costs, and what a second one costs', () => {
    render(<HonorTargetCard value={{ ...target, kind: 'PEER', militaryReturn: 'NONE', repeatRaid: false }} />);
    expect(screen.getByText('No military return')).toBeVisible();
    expect(screen.getByText(/your losses do not reduce Honor either/)).toBeVisible();
    expect(screen.getByText(/again within 24 hours.*bullying/)).toBeVisible();
  });

  it('names the return visit before launch instead of a generic weak-target warning', () => {
    render(<HonorTargetCard value={{ ...target, kind: 'WEAK', militaryReturn: 'NONE', repeatRaid: true }} />);
    expect(screen.getByText('Weaker target')).toBeVisible();
    expect(screen.getByText(/already attacked this commander.*24 hours/)).toBeVisible();
    expect(screen.queryByText(/Even a successful attack/)).not.toBeInTheDocument();
  });

  it('says the half return halves the loss deduction too', () => {
    render(<HonorTargetCard value={{ ...target, kind: 'PEER', militaryReturn: 'HALF' }} />);
    expect(screen.getByText(/Reduced military return.*losses.*halved/)).toBeVisible();
  });

  it('explains a repeat sanction on the receipt', () => {
    render(<HonorBattleSummary receipt={{ delta: -2_600_000, reason: 'WEAK_TARGET', breakdown: { ...breakdown, repeatRaid: true } }} />);
    expect(screen.getByText(/second attack on this commander within 24 hours/)).toBeVisible();
    expect(screen.queryByText(/Harm to a weaker commander reduced Honor/)).not.toBeInTheDocument();
  });

  it('keeps the plain weak-target reason for a first raid on a lower tier', () => {
    render(<HonorBattleSummary receipt={{ delta: -2_600_000, reason: 'WEAK_TARGET', breakdown }} />);
    expect(screen.queryByText(/second attack/)).not.toBeInTheDocument();
  });

  it.each([
    // Only fights between commanders are journalled; pirate and neutral losses stay for the day.
    ['en', en, /destroyed fighting another commander/, /less than a third of yours/, /24 hours/],
    ['tr', tr, /başka bir komutanla savaşta yok edilen/, /üçte birinden azsa/, /24 saat/],
  ] as const)('states the new thresholds in the %s rules', (_language, copy, peak, weak, repeat) => {
    expect(copy.honorRuleBands).toMatch(peak);
    expect(copy.honorRuleBands).toMatch(weak);
    expect(copy.honorRuleRepeat).toMatch(repeat);
  });
});
