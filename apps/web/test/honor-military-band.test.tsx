import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { honorReceiptSchema } from '../src/api/schemas.js';
import { HonorBattleSummary } from '../src/ui/HonorBattleSummary.js';
import { HonorTargetCard } from '../src/ui/HonorTargetCard.js';

// A genuine kill against a much smaller navy pays no Honor. The player has to read
// that from the screen, not conclude the game forgot their battle (2026-10-30).
const breakdown = { teamDelta: 0, rawTeamDelta: 0, participants: 1, contributionPpm: 1_000_000,
  militaryDamage: 1800, permanentLoss: 0, weakTargetDebit: false };

describe('the military band behind an Honor result', () => {
  it('accepts receipts with and without the band', () => {
    expect(honorReceiptSchema.parse({ delta: 0, reason: 'NO_GAIN', breakdown: { ...breakdown, militaryReturn: 'NONE' } }))
      .toMatchObject({ breakdown: { militaryReturn: 'NONE' } });
    expect(honorReceiptSchema.parse({ delta: 0, reason: 'NO_GAIN', breakdown })).not.toHaveProperty('breakdown.militaryReturn');
    expect(() => honorReceiptSchema.parse({ delta: 0, reason: 'NO_GAIN', breakdown: { ...breakdown, militaryReturn: 'SOME' } })).toThrow();
  });

  it('says a destroyed defence paid nothing because the rival navy was under half of yours', () => {
    render(<HonorBattleSummary receipt={{ delta: 0, reason: 'NO_GAIN', breakdown: { ...breakdown, militaryReturn: 'NONE' } }} dominion={4548} />);
    expect(screen.getByText(/under half of yours/)).toBeVisible();
    expect(screen.queryByText(/No eligible military gain/)).not.toBeInTheDocument();
  });

  it('keeps the plain zero explanation when nothing armed was destroyed', () => {
    render(<HonorBattleSummary receipt={{ delta: 0, reason: 'NO_GAIN', breakdown: { ...breakdown, militaryDamage: 0 } }} />);
    expect(screen.getByText(/No eligible military gain/)).toBeVisible();
  });

  it('names a halved return beside a positive result', async () => {
    render(<HonorBattleSummary receipt={{ delta: 900_000, reason: 'COMBAT', breakdown: { ...breakdown, teamDelta: 900_000,
      rawTeamDelta: 900_000, militaryReturn: 'HALF' } }} />);
    await userEvent.setup().click(screen.getByText('Honor breakdown'));
    expect(screen.getByText(/half to three quarters of yours.*halved/)).toBeVisible();
  });

  it('heads the dispatch card with the missing return instead of a comparable label', () => {
    render(<HonorTargetCard value={{ enabled: true, eligible: true, kind: 'PEER', militaryReturn: 'NONE',
      related: false, repeated: false, retaliation: false }} />);
    expect(screen.getByText('No military return')).toBeVisible();
    expect(screen.queryByText('Comparable target')).not.toBeInTheDocument();
    expect(screen.queryByText(/Permanent military damage can earn Honor/)).not.toBeInTheDocument();
    expect(screen.getByText(/No positive military return/)).toBeVisible();
  });

  it.each(['UPPER', 'WEAK'] as const)('keeps the %s heading', kind => {
    render(<HonorTargetCard value={{ enabled: true, eligible: true, kind, militaryReturn: 'NONE',
      related: false, repeated: false, retaliation: false }} />);
    expect(screen.queryByText('No military return')).not.toBeInTheDocument();
  });
});
