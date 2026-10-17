import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HonorTargetCard } from '../src/ui/HonorTargetCard.js';

describe('Honor rules before a player commits a raid', () => {
  it.each([20, 40] as const)('explains the 24-hour budget with the season’s %s%% loot weight', retaliationLootPercent => {
    render(<HonorTargetCard value={{ enabled: true, eligible: true, kind: 'WEAK', militaryReturn: 'NONE',
      related: false, repeated: false, retaliation: true, retaliationLootPercent }} />);
    expect(screen.getByText(new RegExp(`24 hours.*${String(retaliationLootPercent)}%`))).toBeVisible();
    expect(screen.getByText(/Own attack losses still reduce Honor/)).toBeVisible();
  });
  it('warns clearly when a weaker target can cost Honor, even in a victory', () => {
    render(<HonorTargetCard value={{ enabled: true, eligible: true, kind: 'WEAK', militaryReturn: 'NONE', related: false, repeated: false, retaliation: false }} />);
    expect(screen.getByText(/Weaker target/)).toBeVisible();
    expect(screen.getByText(/Even a successful attack/)).toBeVisible();
  });
  it('keeps upper-target eligibility separate from the military return and repeated-rival limit', () => {
    render(<HonorTargetCard value={{ enabled: true, eligible: true, kind: 'UPPER', militaryReturn: 'HALF', related: false, repeated: true, retaliation: false }} />);
    expect(screen.getByText('Stronger target')).toBeVisible();
    expect(screen.getByText(/Reduced military return/)).toBeVisible();
    expect(screen.getByText(/same commander/)).toBeVisible();
    expect(screen.getByText(/No fixed points/)).toBeVisible();
  });
  it('does not show legacy guidance or promise positive credit for an excluded relationship', () => {
    const { rerender, container } = render(<HonorTargetCard value={{ enabled: false }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<HonorTargetCard value={{ enabled: true, eligible: true, kind: 'PEER', militaryReturn: 'FULL', related: true, repeated: false, retaliation: false }} />);
    expect(screen.getByText(/This relationship cannot/)).toBeVisible();
    expect(screen.queryByText(/Permanent military damage can earn Honor/)).not.toBeInTheDocument();
  });
});
