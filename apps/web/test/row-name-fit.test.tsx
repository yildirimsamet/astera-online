import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UpgradeRow } from '../src/ui/UpgradeRow.js';
import i18n from '../src/i18n/index.js';

/**
 * A NAME THAT WOULD BE CUT IS CONDENSED INSTEAD. D200, and the rule it serves is
 * the owner's: a truncated label is worse than a small one.
 *
 * "GARBAGE COLLECTOR" is the first hull name that does not fit the Fleet row at
 * 350px — two pixels over, on a real phone, and it read "GARBAGE COLLECT…". The row
 * now narrows the display face along its own width axis (the condensation `.legend`
 * already uses) when, and only when, the name would otherwise be cut. jsdom has no
 * layout, so the two widths the decision is made from are stubbed here.
 */
const widths = { scroll: 0, client: 0 };
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
const clientDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

beforeEach(async () => {
  await i18n.changeLanguage('en');
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.matches('h3.name') ? widths.scroll : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.matches('h3.name') ? widths.client : 0;
    },
  });
});

afterEach(() => {
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollDescriptor);
  if (clientDescriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientDescriptor);
});

const row = (name: string) => render(
  <UpgradeRow
    name={name}
    role="Lifts wreck"
    cost={{ alloy: 10_000, crystal: 5_000, deuterium: 0 }}
    held={{ alloy: 90_000, crystal: 90_000, deuterium: 0 }}
    verb="build"
    onAct={() => undefined}
  />,
);

const nameOf = (view: ReturnType<typeof row>): HTMLElement => {
  const heading = view.container.querySelector<HTMLElement>('h3.name');
  if (!heading) throw new Error('the row drew no name');
  return heading;
};

describe('a row name that runs out of room', () => {
  it('condenses rather than being cut', () => {
    widths.scroll = 132;
    widths.client = 130;
    const view = row('Garbage Collector');
    expect(nameOf(view)).toHaveAttribute('data-fit', 'condensed');
  });

  it('is left exactly as drawn when it fits', () => {
    widths.scroll = 90;
    widths.client = 130;
    const view = row('Citadel');
    expect(nameOf(view)).not.toHaveAttribute('data-fit');
  });

  it('judges a new name afresh rather than keeping the last one’s verdict', () => {
    widths.scroll = 132;
    widths.client = 130;
    const view = row('Garbage Collector');
    expect(nameOf(view)).toHaveAttribute('data-fit', 'condensed');
    widths.scroll = 80;
    view.rerender(
      <UpgradeRow
        name="Dart"
        role="Lifts wreck"
        cost={{ alloy: 300, crystal: 60, deuterium: 0 }}
        held={{ alloy: 90_000, crystal: 90_000, deuterium: 0 }}
        verb="build"
        onAct={() => undefined}
      />,
    );
    expect(nameOf(view)).not.toHaveAttribute('data-fit');
  });
});
