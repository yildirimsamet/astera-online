import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { combatValue } from '@astera/rules';
import { ForceCompare } from '../src/ui/ForceCompare.js';
import { compact } from '../src/lib/format.js';
import { staleness } from '../src/lib/time.js';
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
 * no green tick, because the reading is stale and fuzzed and the roll is left out —
 * and because a screen that answers "will I win" ends the bet the game is made of.
 * D199's lines are the rule applied to the inputs; the judgement stays the player's.
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

  /** Seen on the phone: "Probe, 2m ago old" — the age already says "ago". D199. */
  it('says how old the reading is once, in either language', async () => {
    const { unmount } = render(<ForceCompare yours={8240} theirs={reading} />);
    expect(screen.getByTestId('compare-provenance').textContent).toBe(`Probe, ${staleness(41)}`);
    unmount();
    await i18n.changeLanguage('tr');
    render(<ForceCompare yours={8240} theirs={{ ...reading, source: 'Sonda' }} />);
    const stamp = screen.getByTestId('compare-provenance').textContent;
    expect(stamp).toBe(`Sonda, ${staleness(41)}`);
    expect(stamp.match(/önce/g)?.length).toBe(1);
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
  it('never names a winner, even with the lines drawn', () => {
    const view = render(
      <ForceCompare yours={8240} theirs={reading} lines={lines} loss={{ low: 0.35, high: 0.6 }} />,
    );
    expect(view.container.textContent).not.toMatch(/win|lose|likely|chance/i);
  });

  /**
   * THE RULE IS ONE TAP AWAY, NOT ON THE CARD. D199, owner question: *"ne işe
   * yarıyor, neye göre hesaplanıyor"*. Prose folds; the figures never do.
   */
  it('keeps what the figure means behind one tap', () => {
    render(<ForceCompare yours={8240} theirs={reading} lines={lines} />);
    const toggle = screen.getByRole('button', { name: /what is this/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('compare-rule')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('compare-rule')).toHaveTextContent(/hulls and guns that can fire/i);
    expect(screen.getByTestId('compare-rule')).toHaveTextContent(/battle/i);
  });
});

/**
 * HOW MUCH OF A WALL THE WING TAKES, ON THE ENEMY'S OWN AXIS. D199.
 *
 * Two bars in one currency still left the question the sheet exists for — is this
 * fight my size — to be answered by losing it. The lines come from the battle
 * engine (`forecastLines`), and they are drawn on the scale the enemy band already
 * sits on, so where that band ends relative to them is the expectation.
 */
const lines = { clears: { low: 9_000, high: 9_000 }, breaks: { low: 12_000, high: 12_000 } };

describe('the lines', () => {
  it('draws where the wing stops clearing and stops breaking, on the enemy axis', () => {
    const view = render(<ForceCompare yours={8240} theirs={reading} lines={lines} />);
    expect(widthOf(view, 'zone-clears')).toBeCloseTo((9_000 / 13_900) * 100, 4);
    expect(widthOf(view, 'zone-breaks')).toBeCloseTo(((12_000 - 9_000) / 13_900) * 100, 4);
  });

  it('states both lines in words', () => {
    render(<ForceCompare yours={8240} theirs={reading} lines={lines} />);
    const said = screen.getByTestId('compare-lines');
    expect(said).toHaveTextContent(`Clears below ${compact(9_000)}`);
    expect(said).toHaveTextContent(`breaks below ${compact(12_000)}`);
  });

  /** An unread wall moves a line; the part nobody has measured is drawn as doubt. */
  it('draws the part of a line the reading leaves open as its own part', () => {
    const open = { clears: { low: 6_000, high: 9_000 }, breaks: { low: 10_000, high: 12_000 } };
    const view = render(<ForceCompare yours={8240} theirs={reading} lines={open} />);
    expect(widthOf(view, 'zone-clears')).toBeCloseTo((6_000 / 13_900) * 100, 4);
    expect(widthOf(view, 'zone-clears-open')).toBeCloseTo(((9_000 - 6_000) / 13_900) * 100, 4);
    expect(screen.getByTestId('compare-lines')).toHaveTextContent(`Clears below ${compact(6_000)}–${compact(9_000)}`);
  });

  it('clips a line that runs past the axis rather than stretching it', () => {
    const far = { clears: { low: 30_000, high: 30_000 }, breaks: { low: 50_000, high: 50_000 } };
    const view = render(<ForceCompare yours={8240} theirs={reading} lines={far} />);
    expect(widthOf(view, 'zone-clears')).toBeCloseTo(100, 4);
    expect(widthOf(view, 'zone-breaks')).toBe(0);
  });

  /** Nothing known about them still tells the commander what this wing can take. */
  it('scales to the wing and its own lines when there is no reading', () => {
    const view = render(<ForceCompare yours={8240} theirs={null} lines={lines} />);
    expect(widthOf(view, 'zone-clears')).toBeCloseTo((9_000 / 12_000) * 100, 4);
    expect(screen.getByTestId('compare-lines')).toHaveTextContent(`Clears below ${compact(9_000)}`);
  });

  it('draws no lines for a wing with nothing selected', () => {
    const view = render(<ForceCompare yours={0} theirs={reading} lines={null} />);
    expect(view.container.querySelector('[data-part="zone-clears"]')).toBeNull();
    expect(screen.queryByTestId('compare-lines')).toBeNull();
  });

  it('says what the fight is expected to cost', () => {
    render(<ForceCompare yours={8240} theirs={reading} lines={lines} loss={{ low: 0.35, high: 0.6 }} />);
    expect(screen.getByTestId('compare-loss')).toHaveTextContent(/35–60%/);
  });

  it('prints one figure for a loss that is one figure', () => {
    render(<ForceCompare yours={8240} theirs={reading} lines={lines} loss={{ low: 0.2, high: 0.2 }} />);
    expect(screen.getByTestId('compare-loss')).toHaveTextContent(/20%/);
    expect(screen.getByTestId('compare-loss')).not.toHaveTextContent(/–/);
  });

  it('says what the lines could not see', () => {
    render(
      <ForceCompare yours={8240} theirs={reading} lines={lines} notes={['Shield unknown', 'Probe was seen']} />,
    );
    expect(screen.getByTestId('compare-notes')).toHaveTextContent('Shield unknown · Probe was seen');
  });
});


/**
 * WHAT THE BAR IS MEASURING, AND WHY IT IS NOT WHAT THE WING COST. D183.
 *
 * Owner report: *"Yük gemisi ekliyorum gücüm artıyor ama yük gemilerinin saldırısı
 * 0. Saçma değil mi?"* — and it was. `fleetValue` is resources sunk in, so an
 * Atlas added 3,050 to a bar labelled "what you are sending" without adding a shot
 * to what was being sent. `combatValue` counts hulls that can fire, on the same
 * resource scale, and the probe's defence band is now built the same way: two
 * numbers a commander can actually put beside each other.
 */
describe('the axis is force, not spend', () => {
  it('does not move when a transport joins the wing', () => {
    const wing = { DART: 12, VIPER: 3 } as const;
    expect(combatValue({ ...wing, ATLAS: 2 })).toBe(combatValue(wing));
  });

  it('names the axis Firepower, and says what it counts one tap deeper', () => {
    render(<ForceCompare yours={combatValue({ DART: 12 })} theirs={reading} />);
    expect(screen.getByText('Firepower')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /what is this/i }));
    expect(screen.getByTestId('compare-rule')).toHaveTextContent(/hulls and guns that can fire/i);
  });
});
