import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveGalaxyEvent } from '../src/screens/ActiveGalaxyEvent.js';
import i18n from '../src/i18n/index.js';

/**
 * WHAT THE MERCHANT'S CHIP DOES WHEN IT IS PRESSED. D170, owner request.
 *
 * The chip announced a live public moment and then refused to be touched — the
 * one craft in the game that every commander can see, with no way to look at it.
 * Pressing it now frames the ship, which is what pressing anything else on the
 * disc already does.
 */

const events = {
  events: [
    {
      id: 'occ-1',
      kind: 'TRADE_SHIP' as const,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60 * 60_000),
      rate: { alloy: 90, crystal: 30, deuterium: 1 },
    },
  ],
};

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return { ...actual, useGalaxyEvents: () => ({ data: events }) };
});

describe('the live event chip', () => {
  it('frames the merchant when the trade chip is pressed', async () => {
    const onFocusTrade = vi.fn();
    render(<ActiveGalaxyEvent onFocusTrade={onFocusTrade} />);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('trade.chip')) }));
    expect(onFocusTrade).toHaveBeenCalledWith('occ-1');
  });

  /** A shower has nowhere to fly to, so its chip stays a status line. */
  it('leaves a chip with no handler unpressable', () => {
    render(<ActiveGalaxyEvent />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
