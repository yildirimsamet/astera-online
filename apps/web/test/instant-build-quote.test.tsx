import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimeCost } from '../src/ui/Action.js';
import { CardTime } from '../src/ui/UpgradeRow.js';

/** The five-minute rule where the time is shown (owner, 2026-11-20; plan §5.6): the rule says itself. */
describe('an instant upgrade on the card', () => {
  it.each([['card', CardTime], ['row', TimeCost]] as const)('says it is instant, and why, on the %s', (_, Time) => {
    render(<Time minutes={0} />);
    const time = screen.getByTestId('order-time');
    expect(time).toHaveTextContent('Instant · ≤5 min');
    expect(time).toHaveAttribute('aria-label', 'Instant: upgrades of 5 minutes or less take no time');
  });

  it('keeps the clock of a longer one', () => {
    render(<CardTime minutes={7} />);
    expect(screen.getByTestId('order-time')).toHaveTextContent('7m');
  });
});
