import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForceCompare } from '../src/ui/ForceCompare.js';
import i18n from '../src/i18n/index.js';

/**
 * THE NUMBER THAT WAS NEVER COMPARABLE TO ANYTHING. Owner report.
 *
 * *"Savunma gücü yazıyor ama bunun neye karşılık geldiğini bilmiyorum."*
 *
 * The complaint was exact, and the cause was in the payload rather than the prose.
 * A probe's `defence` band is `fleetValue(homeFleet)` — resources sunk into
 * whatever was standing there — and the dossier printed it as `11,400 – 13,900`
 * under the label "Defence value", correctly sourced and correctly aged, with
 * NOTHING anywhere in the game expressing the player's own fleet on that scale.
 * A figure with no second figure beside it is not information; it is trivia.
 *
 * SO THIS COMPONENT'S WHOLE JOB IS THE SHARED AXIS, and that is precisely the
 * thing `RangeBand`'s docblock forbids — "two bands on one card share no scale,
 * and must not". The prohibition is right and this is its one legitimate
 * exception: that rule protects against comparing STOCK against SHIP COUNT, two
 * quantities in different units whose only comparable property is band width.
 * Here both sides are the same quantity in the same units, and the comparison is
 * the entire point. Sharing a scale is what makes it honest rather than what makes
 * it a lie.
 *
 * WHAT IT MUST NOT DO is resolve the fight. There is no verdict, no percentage and
 * no green tick, because the reading is stale and fuzzed and the counter cycle is
 * not in it — and because a screen that answers "will I win" ends the bet the game
 * is made of.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const widthOf = (view: ReturnType<typeof render>, part: string): number => {
  const el = view.container.querySelector<HTMLElement>(`[data-part="${part}"]`);
  expect(el, `no ${part}`).not.toBeNull();
  return Number.parseFloat(el!.style.width);
};

const reading = { low: 11_400, high: 13_900, source: 'Probe', ageMinutes: 41 };

describe('the shared axis', () => {
  it('measures both sides against the same ceiling', () => {
    const view = render(<ForceCompare yours={8240} theirs={reading} />);
    // Their high is the ceiling, so their band ends at 100 and yours is a share.
    expect(widthOf(view, 'yours')).toBeCloseTo((8240 / 13_900) * 100, 4);
    expect(widthOf(view, 'theirs')).toBeCloseTo((11_400 / 13_900) * 100, 4);
  });

  it('re-scales when the player is the larger side', () => {
    const view = render(<ForceCompare yours={40_000} theirs={reading} />);
    expect(widthOf(view, 'yours')).toBeCloseTo(100, 4);
    expect(widthOf(view, 'theirs')).toBeCloseTo((11_400 / 40_000) * 100, 4);
  });

  /**
   * THE BAND'S WIDTH IS THE DOUBT, and it has to survive the shared scale. A probe
   * that came home vague must still look vague beside a fleet the player counted
   * exactly.
   */
  it('draws the unmeasured remainder as its own part', () => {
    const view = render(<ForceCompare yours={8240} theirs={reading} />);
    expect(widthOf(view, 'doubt')).toBeCloseTo(((13_900 - 11_400) / 13_900) * 100, 4);
  });

  it('gives a precise reading almost no doubt to draw', () => {
    const view = render(
      <ForceCompare yours={8240} theirs={{ ...reading, low: 13_800, high: 13_900 }} />,
    );
    expect(widthOf(view, 'doubt')).toBeLessThan(2);
  });
});

describe('what it says about the reading', () => {
  it('stamps the enemy side with where it came from and how old it is', () => {
    render(<ForceCompare yours={8240} theirs={reading} />);
    expect(screen.getByTestId('compare-provenance')).toHaveTextContent(/probe/i);
    expect(screen.getByTestId('compare-provenance')).toHaveTextContent(/41m/);
  });

  /**
   * A LIVE READING HAS A SOURCE BUT NO AGE. A pirate inside a Telescope circle is
   * being LOOKED AT; a world's defence band is a memory. "0m old" over the first
   * would demote current sight to a very fresh record.
   */
  it('says a live reading is live rather than nought minutes old', () => {
    render(
      <ForceCompare
        yours={8240}
        theirs={{ low: 9000, high: 9000, source: 'Sight', ageMinutes: null }}
      />,
    );
    const stamp = screen.getByTestId('compare-provenance');
    expect(stamp).toHaveTextContent(/sight/i);
    expect(stamp).not.toHaveTextContent(/0m/);
  });

  /** An exact reading has no doubt to draw at all. */
  it('draws no doubt for a reading with no band', () => {
    const view = render(
      <ForceCompare
        yours={8240}
        theirs={{ low: 9000, high: 9000, source: 'Sight', ageMinutes: null }}
      />,
    );
    expect(widthOf(view, 'doubt')).toBe(0);
  });

  /**
   * NEVER LOOKED IS NOT ZERO. Drawing an empty enemy bar would say the world is
   * undefended — the single most expensive lie an intel surface can tell, on the
   * screen where the fleet stops being recallable.
   */
  it('refuses to draw an enemy bar it has no reading for', () => {
    const view = render(<ForceCompare yours={8240} theirs={null} />);
    expect(view.container.querySelector('[data-part="theirs"]')).toBeNull();
    expect(view.container.querySelector('[data-part="doubt"]')).toBeNull();
    expect(screen.getByTestId('compare-unknown')).toBeInTheDocument();
  });

  it('still draws the player their own side when nothing is known', () => {
    const view = render(<ForceCompare yours={8240} theirs={null} />);
    expect(widthOf(view, 'yours')).toBeCloseTo(100, 4);
  });

  /** An empty selection is a real state on this sheet: nothing picked yet. */
  it('survives an empty fleet without dividing by zero', () => {
    const view = render(<ForceCompare yours={0} theirs={null} />);
    expect(widthOf(view, 'yours')).toBe(0);
  });

  /**
   * IT NEVER NAMES A WINNER. The bars are the comparison; the judgement is the
   * player's, and the reading is too stale and too fuzzed to support anything else.
   */
  it('states what the axis is and what it leaves out', () => {
    const view = render(<ForceCompare yours={8240} theirs={reading} />);
    expect(view.container.textContent).toMatch(/counter cycle/i);
    expect(view.container.textContent).not.toMatch(/win|lose|likely/i);
  });
});
