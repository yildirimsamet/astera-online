import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { forecastPirateProfit } from '@astera/rules';
import { PirateProfitCard } from '../src/ui/PirateProfitCard.js';

const input = { attacker: { CORSAIR: 12, ARGOSY: 1 }, crew: { DART: 2 }, level: 1 as const,
  tech: {}, rulesetVersion: 16, hoard: { alloy: 1000, crystal: 500, deuterium: 333 },
  paid: { alloy: 0, crystal: 0, deuterium: 0 }, fuel: 80 };

describe('pirate profit decision card', () => {
  it('shows all three net resources, paid expenses and uncertainty before a profitable commitment', () => {
    render(<PirateProfitCard forecast={forecastPirateProfit(input)} state="ready" />);
    const card = screen.getByTestId('pirate-profit');
    expect(within(card).getByText(/likely profitable/i)).toBeVisible();
    for (const name of ['Alloy', 'Crystal', 'Deuterium']) expect(within(card).getByText(name, { exact: true })).toBeVisible();
    expect(within(card).getByText(/round-trip fuel/i)).toBeVisible();
    expect(within(card).getByText(/paid repairs/i)).toBeVisible();
    expect(within(card).getByText(/lost ships/i)).toBeVisible();
    expect(within(card).getByText(/not guaranteed/i)).toBeVisible();
    expect(within(card).getByText(/captured ships.*excluded/i)).toBeVisible();
    expect(card.querySelector('[data-profit-net="deuterium"]')).toHaveTextContent('+119');
  });

  it('warns of a loss and keeps negative deuterium visible when the selected fleet costs too much fuel', () => {
    render(<PirateProfitCard forecast={forecastPirateProfit({ ...input, fuel: 10000 })} state="ready" />);
    expect(screen.getByText(/likely to lose resources/i)).toBeVisible();
    expect(document.querySelector('[data-profit-net="deuterium"]')).toHaveTextContent('−9,801');
  });

  it('rounds fractional expenses symmetrically without showing a negative half-unit as positive income', () => {
    const forecast = { ...forecastPirateProfit(input), net: { alloy: -0.5, crystal: 0.5, deuterium: -0.4 } };
    render(<PirateProfitCard forecast={forecast} state="ready" />);
    expect(document.querySelector('[data-profit-net="alloy"]')).toHaveTextContent('−1');
    expect(document.querySelector('[data-profit-net="crystal"]')).toHaveTextContent('+1');
    expect(document.querySelector('[data-profit-net="deuterium"]')).toHaveTextContent(/^0$/);
  });

  it('does not turn absent reward data into a zero or show an old recommendation while recalculating', () => {
    const { rerender } = render(<PirateProfitCard forecast={null} state="unavailable" />);
    expect(screen.getByText(/reward information is unavailable/i)).toBeVisible();
    expect(document.querySelector('[data-profit-net]')).toBeNull();
    rerender(<PirateProfitCard forecast={forecastPirateProfit(input)} state="pending" />);
    expect(screen.getByText(/updating.*estimate/i)).toBeVisible();
    expect(screen.queryByText(/likely profitable/i)).toBeNull();
    rerender(<PirateProfitCard forecast={null} state="empty" />);
    expect(screen.getByText(/choose ships.*estimate/i)).toBeVisible();
  });
});
