import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HonorBattleSummary } from '../src/ui/HonorBattleSummary.js';

describe('Honor battle explanation', () => {
  it('shows a credited success before Dominion and explains team contribution', () => {
    const { container } = render(<HonorBattleSummary receipt={{ delta: 1_234_567, reason: 'COMBAT' }} dominion={100} />);
    expect(screen.getByText('+1.234567')).toBeInTheDocument();
    expect(screen.getByText(/shared contribution/)).toBeInTheDocument();
    expect(container.textContent.indexOf('Honor')).toBeLessThan(container.textContent.indexOf('Dominion'));
  });
  it('explains a weak-target loss without confusing it with losing the battle', () => {
    render(<HonorBattleSummary receipt={{ delta: -250_000, reason: 'WEAK_TARGET' }} dominion={400} />);
    expect(screen.getByText('-0.25')).toBeInTheDocument();
    expect(screen.getByText(/weaker commander/)).toBeInTheDocument();
  });
  it('keeps a genuine zero visible but leaves historical absence empty', () => {
    const { rerender, container } = render(<HonorBattleSummary receipt={{ delta: 0, reason: 'NO_GAIN' }} dominion={0} />);
    expect(screen.getByText(/No eligible military gain/)).toBeInTheDocument();
    rerender(<HonorBattleSummary receipt={null} dominion={0} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows the common pool and contribution on demand, without suggesting last hits determine the share', async () => {
    render(<HonorBattleSummary receipt={{ delta: 250_000, reason: 'COMBAT', breakdown: {
      teamDelta: 1_000_000, rawTeamDelta: 1_100_000, participants: 2, contributionPpm: 250_000,
      militaryDamage: 1000, permanentLoss: 100,
    } }} dominion={100} />);
    await userEvent.setup().click(screen.getByText('Honor breakdown'));
    expect(screen.getByText('25%')).toBeVisible();
    expect(screen.getByText(/last hit/)).toBeVisible();
    expect(screen.getByText(/Shared Honor/)).toBeVisible();
    expect(screen.getByText(/before.*rival/i)).toBeVisible();
  });
  it('explains a penalty that reduced a net-positive shared result', async () => {
    render(<HonorBattleSummary receipt={{ delta: 250_000, reason: 'COMBAT', breakdown: {
      teamDelta: 1_000_000, rawTeamDelta: 1_100_000, participants: 2, contributionPpm: 250_000,
      militaryDamage: 1000, permanentLoss: 100, weakTargetDebit: true,
    } }} />);
    await userEvent.setup().click(screen.getByText('Honor breakdown'));
    expect(screen.getByText(/Weaker-target harm reduced the shared result/)).toBeVisible();
  });
});
it('explains tactical preparation without military casualty rows', async () => {
  render(<HonorBattleSummary receipt={{ delta: 995024, reason: 'TACTICAL', breakdown: {
    teamDelta:995024,rawTeamDelta:1000000,participants:1,contributionPpm:1000000,
    militaryDamage:0,permanentLoss:0,weakTargetDebit:false,tactical:true,
  } }} />);
  expect(screen.getByText(/tactical effect/i)).toBeVisible();
  await userEvent.setup().click(screen.getByText('Honor breakdown'));
  expect(screen.queryByText(/Permanent military damage/)).not.toBeInTheDocument();
});
