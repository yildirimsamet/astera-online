import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Rungs } from '../src/ui/Rungs.js';
import i18n from '../src/i18n/index.js';

/**
 * A LADDER IS A PICTURE, NOT A FRACTION. Owner instruction.
 *
 * `L2 / 5` makes a player read a fraction and convert it into the thing they were
 * actually asking, which is how much is left. Five marks with two lit is that fact
 * arriving without being read.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const rungs = (view: ReturnType<typeof render>, state: string): number =>
  view.container.querySelectorAll(`[data-rung="${state}"]`).length;

describe('rungs', () => {
  it('draws one mark per rung the ladder has', () => {
    const view = render(<Rungs level={2} max={5} />);
    expect(view.container.querySelectorAll('[data-rung]')).toHaveLength(5);
  });

  it('lights the ones that are held', () => {
    const view = render(<Rungs level={2} max={5} />);
    expect(rungs(view, 'held')).toBe(2);
    expect(rungs(view, 'open')).toBe(3);
  });

  it('marks the one on offer as its own state', () => {
    const view = render(<Rungs level={2} max={5} next />);
    expect(rungs(view, 'held')).toBe(2);
    expect(rungs(view, 'next')).toBe(1);
    expect(rungs(view, 'open')).toBe(2);
  });

  it('offers nothing on a finished ladder', () => {
    const view = render(<Rungs level={5} max={5} next />);
    expect(rungs(view, 'held')).toBe(5);
    expect(rungs(view, 'next')).toBe(0);
  });

  it('holds nothing on an untouched one', () => {
    const view = render(<Rungs level={0} max={5} next />);
    expect(rungs(view, 'held')).toBe(0);
    expect(rungs(view, 'next')).toBe(1);
  });

  it('never draws more held than the ladder has', () => {
    const view = render(<Rungs level={9} max={5} />);
    expect(rungs(view, 'held')).toBe(5);
    expect(view.container.querySelectorAll('[data-rung]')).toHaveLength(5);
  });

  /** The picture replaced a fraction, so the fraction has to survive for a reader. */
  it('says the fraction out loud for a screen reader', () => {
    const view = render(<Rungs level={2} max={5} />);
    expect(view.container.querySelector('[role="img"]')).toHaveAttribute('aria-label', 'L2 / 5');
  });

  it('paints no words', () => {
    expect(render(<Rungs level={2} max={5} />).container.textContent).toBe('');
  });
});
