import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { UpgradeRow } from '../src/ui/UpgradeRow.js';
import i18n from '../src/i18n/index.js';

/**
 * THE TIME AN ORDER TAKES, ON THE ROW THAT SELLS IT.
 *
 * Owner report: *"hiç bir geliştirmede, geliştirme yapmadan önce: kaç saat, kaç
 * dakika sürecek bilgisi yok!"* — and it was exactly true. This row already carried
 * a time, `affordableIn`, and that time answers WHEN THE PRICE IS MET. A commander
 * who can already afford a Citadel got no clock at all, which is the case where the
 * question is loudest: the money is there, the only thing left to decide is whether
 * the wait fits the evening.
 *
 * SO TIME IS PRICED LIKE A RESOURCE, beside the alloy and the crystal, because in
 * this game it IS one — a hull that lands after the season's last raid cost more
 * than its alloy. The two clocks are therefore different things and both may show:
 * `takes` is a property of the item, `affordableIn` is a property of the wallet.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const row = (over: Partial<Parameters<typeof UpgradeRow>[0]> = {}) => render(
  <UpgradeRow
    name="Citadel"
    role="A capital Bulwark hull"
    cost={{ alloy: 5000, crystal: 2100, deuterium: 600 }}
    held={{ alloy: 90000, crystal: 90000, deuterium: 90000 }}
    verb="build"
    onAct={() => undefined}
    {...over}
  />,
);

describe('how long it takes', () => {
  it('is drawn on an affordable row, where no other clock would appear', () => {
    row({ takes: 138 });
    const tag = screen.getByTestId('order-time');
    expect(tag).toBeInTheDocument();
    expect(tag).toHaveTextContent('2h 18m');
  });

  it('names itself for a screen reader rather than being a bare numeral', () => {
    row({ takes: 138 });
    expect(screen.getByTestId('order-time')).toHaveAccessibleName(/2h 18m/);
  });

  /** A row that never received one must not invent a zero. */
  it('is absent when the caller has no time to quote', () => {
    row();
    expect(screen.queryByTestId('order-time')).toBeNull();
  });

  /**
   * A FINISHED THING HAS NO BUILD TIME LEFT TO QUOTE. Printing "takes 2h" under
   * a completed research rung would be advertising work already done.
   */
  it('is absent once the item is complete', () => {
    row({ takes: 138, completed: 'Researched' });
    expect(screen.queryByTestId('order-time')).toBeNull();
  });

  /** An order already in the queue has a real countdown elsewhere; this is an estimate. */
  it('is absent while the order is queued', () => {
    row({ takes: 138, queued: 'In the yard' });
    expect(screen.queryByTestId('order-time')).toBeNull();
  });

  /**
   * BOTH CLOCKS, WHEN BOTH ARE TRUE — and they must not be confused for each
   * other. "Affordable in 40m" and "takes 2h 18m" is a four-hour plan; showing
   * only one of them is how a player mis-budgets an evening.
   */
  it('coexists with the affordability clock, saying a different thing', () => {
    // `affordableIn` renders through <Trans>, so its sentence is split across
    // nodes; the row's own text is what the player actually reads.
    const view = row({
      takes: 138,
      cost: { alloy: 5000, crystal: 2100, deuterium: 0 },
      held: { alloy: 0, crystal: 0, deuterium: 0 },
      income: { alloyPerHour: 6000, crystalPerHour: 6000 },
    });
    expect(screen.getByTestId('order-time')).toHaveTextContent('2h 18m');
    expect(view.container.textContent).toMatch(/affordable in/i);
  });

  /**
   * AND IT SHOWS WHERE THE OTHER CLOCK REFUSES TO.
   *
   * `waitMinutes` returns null the moment the shortfall includes deuterium, because
   * `income` carries no deuterium rate and the row will not guess one. That is the
   * right call for an estimate — and it left the most expensive orders in the game,
   * the ones priced in fuel, with no time on them at all. `takes` is not an
   * estimate about the wallet, so it is unaffected.
   */
  it('still quotes the build time when the affordability estimate cannot', () => {
    const view = row({
      takes: 138,
      cost: { alloy: 5000, crystal: 2100, deuterium: 600 },
      held: { alloy: 0, crystal: 0, deuterium: 0 },
      income: { alloyPerHour: 6000, crystalPerHour: 6000 },
    });
    expect(view.container.textContent).not.toMatch(/affordable in/i);
    expect(screen.getByTestId('order-time')).toHaveTextContent('2h 18m');
  });
});
