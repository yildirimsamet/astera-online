import { render, screen } from '@testing-library/react';
import { SEASON } from '@astera/rules';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GameActions, SeasonLockProvider } from '../src/session/seasonLock.js';
import { NextSeason } from '../src/ui/NextSeason.js';
import { PIN_COLOUR, markerScale, pinColour } from '../src/galaxy/PlanetField.js';
import '../src/i18n/index.js';

/**
 * WHAT A FROZEN SEASON HAS TO DO ON SCREEN.
 *
 * The server already refuses every mutation once a season freezes, so none of this
 * is a safety mechanism. It is an honesty one: without it the final galaxy looks
 * playable, and pressing anything produces an error toast for a decision the
 * player was invited to make.
 */
describe('a frozen season stops taking input', () => {
  const Surface = ({ locked }: { locked: boolean }) => (
    <SeasonLockProvider locked={locked}>
      <GameActions>
        <button type="button">Launch</button>
        <button type="button">Raise</button>
      </GameActions>
      <button type="button">Menu</button>
    </SeasonLockProvider>
  );

  it('leaves every game control live while the season is running', () => {
    render(<Surface locked={false} />);
    expect(screen.getByRole('button', { name: 'Launch' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Raise' })).toBeEnabled();
  });

  /**
   * ONE `fieldset` IS THE WHOLE MECHANISM. No button knows the season ended, which
   * is the point: a per-button check is a rule forty rows have to remember, and the
   * one that forgets is the one a player finds.
   */
  it('disables every game control at once when it freezes', () => {
    render(<Surface locked />);
    expect(screen.getByRole('button', { name: 'Launch' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Raise' })).toBeDisabled();
  });

  /** The way out is not a game action. Menu, language and sign-out stay live. */
  it('leaves anything outside the wrapper alone', () => {
    render(<Surface locked />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeEnabled();
  });

  it('defaults to live, so a surface with no provider above it still works', () => {
    render(
      <GameActions>
        <button type="button">Launch</button>
      </GameActions>,
    );
    expect(screen.getByRole('button', { name: 'Launch' })).toBeEnabled();
  });
});

/**
 * The five minutes between two seasons used to be silent: the game stopped
 * answering and nothing said whether that was deliberate.
 */
describe('the wait before the next galaxy', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-03-15T00:02:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const froze = new Date('2026-03-15T00:00:00.000Z');

  it('counts down to the rollover and says what the wait is for', () => {
    render(<NextSeason endsAt={froze} />);
    // Three of the five minutes are left.
    expect(screen.getByRole('status')).toHaveTextContent(/\b3m\b/);
    expect(screen.getByRole('status')).toHaveTextContent(/frozen/i);
  });

  /** Derived from the rules constant, so it cannot disagree with the worker. */
  it('is over exactly one afterglow after the freeze', () => {
    vi.setSystemTime(new Date(froze.getTime() + SEASON.afterglowMinutes * 60_000 + 1_000));
    render(<NextSeason endsAt={froze} />);
    expect(screen.getByRole('status')).toHaveTextContent(/opening now/i);
  });

  it('says nothing at all when there is no season to wait on', () => {
    const { container } = render(<NextSeason endsAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * The pin layer. `kind` already decides the silhouette the disc draws, so putting
 * it in a colour publishes nothing that was not already public.
 */
describe('what a world wears when it is not yours', () => {
  it('marks a neutral world grey and a commander orange', () => {
    expect(pinColour('NEUTRAL')).toBe(PIN_COLOUR.neutral);
    expect(pinColour('CAPITAL')).toBe(PIN_COLOUR.rival);
    expect(pinColour('COLONY')).toBe(PIN_COLOUR.rival);
  });

  it('keeps the two apart, so the map never reads one as the other', () => {
    expect(PIN_COLOUR.neutral).not.toBe(PIN_COLOUR.rival);
  });

  /**
   * THE THING THAT WOULD MAKE THREE HUNDRED PINS UNUSABLE. A pin drawn at a fixed
   * size on screen fills the disc the moment anyone zooms out. These are sized in
   * WORLD units — `node.radius x markerScale` — so they shrink with the galaxy,
   * and `markerScale`'s own ceiling is what stops a distant one growing without
   * bound. `planet-visuals.test.ts` pins that ceiling; this records that the pins
   * are on the same leash as the marker on your own world.
   */
  it('is bounded by the same scale the owned marker uses', () => {
    const far = markerScale(100_000, 0.01, 844, 50);
    const near = markerScale(10, 1, 844, 50);
    expect(near).toBe(1);
    expect(far).toBeLessThanOrEqual(4);
    expect(far).toBeGreaterThanOrEqual(near);
  });
});
