import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { FlightBar } from '../src/ui/FlightBar.js';
import { Tally } from '../src/ui/Tally.js';
import i18n from '../src/i18n/index.js';

/**
 * WHERE A FLIGHT HAS GOT TO, AND WHICH WAY IT IS POINTING. Owner instruction.
 *
 * The roster was a title, a grey line and a countdown — and "12m" is the same
 * string whether a fleet is two minutes from a target or two minutes from home
 * with the loot. Those are opposite situations, so the leg is drawn: home is the
 * solid end, the far world is the ring, and the marker moves between them.
 *
 * AN INBOUND ATTACK GETS A DIFFERENT PICTURE, AND THAT DIFFERENCE IS THE FOG
 * (D123, D124). The server sends no departure time for somebody else's fleet, so
 * there is no honest position to draw — the track goes dashed and nothing claims
 * to know where the craft is.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const markLeft = (view: ReturnType<typeof render>): number => {
  const mark = view.container.querySelector<HTMLElement>('[data-flight-mark]');
  expect(mark, 'no marker').not.toBeNull();
  return Number.parseFloat(mark!.style.left);
};

describe('the flight bar', () => {
  it('moves an outbound craft away from home as it flies', () => {
    const early = markLeft(render(<FlightBar progress={0.2} direction="out" />));
    const late = markLeft(render(<FlightBar progress={0.8} direction="out" />));
    expect(late).toBeGreaterThan(early);
  });

  /**
   * A RETURNING CRAFT IS MEASURED FROM HOME LIKE EVERY OTHER, and only the arrow
   * turns. Drawing it left to right would put a fleet carrying loot further from
   * home the closer it got.
   */
  it('brings a returning craft back toward home as it flies', () => {
    const early = markLeft(render(<FlightBar progress={0.2} direction="back" />));
    const late = markLeft(render(<FlightBar progress={0.8} direction="back" />));
    expect(late).toBeLessThan(early);
  });

  it('clamps a stale reading inside its own leg', () => {
    expect(markLeft(render(<FlightBar progress={1.4} direction="out" />))).toBe(100);
    expect(markLeft(render(<FlightBar progress={-0.3} direction="out" />))).toBe(0);
  });

  describe('a craft whose position is not knowable', () => {
    it('says so rather than inventing one', () => {
      const view = render(<FlightBar progress={null} direction="incoming" />);
      expect(view.container.querySelector('[data-flight-bar]'))
        .toHaveAttribute('data-known', 'false');
    });

    /** No travelled portion, because none of it has been earned. */
    it('draws no progress behind the marker', () => {
      const view = render(<FlightBar progress={null} direction="incoming" />);
      expect(view.container.querySelector('.bg-threat\\/60')).toBeNull();
    });
  });

  it('names its direction for anyone who cannot see the leg', () => {
    expect(render(<FlightBar progress={0.5} direction="back" />)
      .container.querySelector('[role="img"]'))
      .toHaveAttribute('aria-label', expect.stringContaining('Returning'));
  });
});

/**
 * A RACK: a fixed number of identical places, some of them taken.
 *
 * `Rungs` is a LADDER — steps bought one at a time, where the next one is a
 * decision. This is the other shape, and the game was stating it six different
 * ways: flight bays, orbit sockets, telescope slots, clan seats, queue slots and
 * a world's Prospector berths were five hand-rolled rows of pips plus one plain
 * fraction. `interface.md` I6b: a rack shows its room.
 */
describe('the tally', () => {
  it('draws every place, taken or not', () => {
    const view = render(<Tally used={2} total={5} label="2 of 5" />);
    expect(view.container.querySelectorAll('[data-cell]')).toHaveLength(5);
    expect(view.container.querySelectorAll('[data-cell="used"]')).toHaveLength(2);
    expect(view.container.querySelectorAll('[data-cell="free"]')).toHaveLength(3);
  });

  /** A count past the ceiling is a payload seam, never a sixth cell in a rack of five. */
  it('never draws more places than exist', () => {
    const view = render(<Tally used={9} total={3} label="full" />);
    expect(view.container.querySelectorAll('[data-cell]')).toHaveLength(3);
    expect(view.container.querySelectorAll('[data-cell="free"]')).toHaveLength(0);
  });

  it('renders nothing where there is no rack to show', () => {
    expect(render(<Tally used={0} total={0} label="none" />).container).toBeEmptyDOMElement();
  });

  it('says the count out loud for anyone who cannot see the pips', () => {
    const view = render(<Tally used={3} total={4} label="3 of 4 flight bays in use" />);
    expect(view.container.querySelector('[role="img"]'))
      .toHaveAttribute('aria-label', '3 of 4 flight bays in use');
  });
});
