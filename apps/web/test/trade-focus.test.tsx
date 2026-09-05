import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRADE, type Fleet } from '@astera/rules';
import { TradeFocus } from '../src/galaxy/FocusPanel.js';
import type { TradeShipEvent } from '../src/lib/trade.js';
import i18n from '../src/i18n/index.js';

/**
 * THE MERCHANT'S RAIL. D156.
 *
 * Shaped like `AsteroidFocus`, deliberately, and for the reason `PirateFocus`
 * already gives: to a player these are one decision wearing three costumes —
 * something is passing through, it is worth something, it will not be there later,
 * and the only question is whether what you can send arrives in time.
 *
 * WHAT IS DIFFERENT IS THE RATE, and it is the whole reason to fly at this one. A
 * rule the player cannot see is not a usable rule (D124), and a rate that exists
 * only in a constants file and a docblock is exactly that — so the table is DRAWN
 * here (D142), on the rail, before any sheet is opened.
 */

const NOW = Date.now();

const merchant = (over: Partial<TradeShipEvent> = {}): TradeShipEvent => ({
  id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11',
  kind: 'TRADE_SHIP',
  startsAt: new Date(NOW - 30 * 60_000),
  endsAt: new Date(NOW + 150 * 60_000),
  rate: TRADE.rate,
  appearsAtMinute: 570,
  expiresAtMinute: 750,
  orbit: {
    radius: 1_100,
    period: (2 * Math.PI * 1_100) / TRADE.speed,
    phase: 0.7,
    inclination: 0.4,
    ascendingNode: 1.9,
    speed: TRADE.speed,
  },
  ...over,
});

const rail = (
  over: {
    event?: TradeShipEvent;
    fleetAtHome?: Fleet;
    fleetAway?: Fleet;
    minutesLeft?: number;
    reachMinutes?: number | null;
    onTrade?: () => void;
  } = {},
) => {
  const onTrade = over.onTrade ?? vi.fn();
  const result = render(
    <TradeFocus
      merchant={over.event ?? merchant()}
      fleetAtHome={over.fleetAtHome ?? { ATLAS: 4 }}
      fleetAway={over.fleetAway ?? {}}
      minutesLeft={over.minutesLeft ?? 150}
      reachMinutes={over.reachMinutes === undefined ? 14 : over.reachMinutes}
      onClose={vi.fn()}
      onTrade={onTrade}
      open
      onToggle={vi.fn()}
    />,
  );
  return { ...result, onTrade };
};

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('the merchant rail', () => {
  it('draws the rate rather than only writing it', () => {
    rail();
    const table = screen.getByTestId('trade-rate');
    // Three rows, one per resource, each a drawn quantity rather than a sentence.
    expect(table.querySelectorAll('[data-rate-row]')).toHaveLength(3);
    // 90 alloy = 30 crystal = 1 deuterium, off the published rate and nowhere else.
    expect(table).toHaveTextContent('90');
    expect(table).toHaveTextContent('30');
  });

  it('states how long the window has left', () => {
    rail({ minutesLeft: 42 });
    expect(screen.getAllByText(/42m/).length).toBeGreaterThan(0);
  });

  it('quotes the soonest this world could reach it', () => {
    rail({ reachMinutes: 14 });
    expect(screen.getAllByText(/14m/).length).toBeGreaterThan(0);
  });

  it('opens the commitment sheet', async () => {
    const { onTrade } = rail();
    // By test id, not by name: the rail's own header button repeats the eyebrow,
    // the title and the summary, so a name query would match two controls.
    await userEvent.setup().click(screen.getByTestId('trade-open'));
    expect(onTrade).toHaveBeenCalledTimes(1);
  });

  /**
   * A REFUSED CONTROL STAYS VISIBLE WITH ITS REASON ON IT. `interface.md`.
   * `AsteroidFocus` does exactly this and the line must not simply disappear.
   */
  it('refuses with a reason when nothing here could reach it in time', () => {
    rail({ reachMinutes: null });
    const button = screen.getByTestId('trade-open');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/reach|late|gone/i);
  });

  it('refuses with a reason when this world has no craft at all', () => {
    rail({ fleetAtHome: {} });
    const button = screen.getByTestId('trade-open');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/craft|ship/i);
  });

  /**
   * "YOU HAVE NONE" AND "YOURS ARE OUT" ARE DIFFERENT SENTENCES. Owner report: a
   * commander who had just sent their only Atlas at this merchant read *"Burada
   * Kurye, Seyyah veya Atlas yok"* while watching that convoy fly. One is fixed by
   * building a transport, the other by waiting for one to land — and telling a
   * player to buy what they already own is worse than saying nothing.
   */
  it('says the carriers are away when they are away, not that there are none', () => {
    rail({ fleetAtHome: { DART: 6 }, fleetAway: { ATLAS: 1 } });
    expect(screen.getByTestId('trade-open')).toHaveTextContent(/carriers are away/i);
  });

  it('refuses with a reason when nothing here can carry cargo', () => {
    rail({ fleetAtHome: { DART: 6 } });
    const button = screen.getByTestId('trade-open');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/carrier|courier|cargo/i);
  });

  it('reads naturally in Turkish', async () => {
    await i18n.changeLanguage('tr');
    rail();
    expect(screen.getByTestId('trade-rate')).toBeInTheDocument();
    expect(screen.getByTestId('trade-open')).toHaveTextContent(/konvoy|takas|ticaret/i);
  });
});
