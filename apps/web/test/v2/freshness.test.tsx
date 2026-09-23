import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ClarityState } from '@astera/rules';
import { ageTier } from '../../src/lib/clarity.js';
import { AgeStamp, AgedThumb, ClarityMark } from '../../src/v2/kit/Freshness.js';

/**
 * CERTAINTY IS DRAWN, NOT WRITTEN. Spec B7 and decision K11 (docs/ui-v2/gozlemevi.md).
 *
 * Two axes, never mixed with colour (colour says whose a thing is):
 *   · CLARITY — a telescope reading's quality, telescope minus veil: five bars and a word.
 *   · AGE — how old a probe or report fact is: grain and fade on the picture, and
 *     "4h ago" beside it. A reader judges how far to trust a figure by looking.
 */

describe('the age of a reading', () => {
  it.each([
    [0, 'fresh'],
    [59, 'fresh'],
    [60, 'aging'],
    [359, 'aging'],
    [360, 'stale'],
    [1439, 'stale'],
    [1440, 'old'],
    [10_000, 'old'],
  ] as const)('reads %i minutes as %s', (minutes, tier) => {
    expect(ageTier(minutes)).toBe(tier);
  });

  it('says how old it is, and live when it is', () => {
    const { rerender, container } = render(<AgeStamp minutes={240} />);
    expect(container.textContent).toBe('4h 00m ago');
    expect(container.firstElementChild).toHaveAttribute('data-age', 'aging');
    rerender(<AgeStamp minutes={0} />);
    expect(container.textContent).toBe('live');
  });
});

describe('the clarity of a telescope reading', () => {
  it.each([
    ['FULL', 5],
    ['CLEAR', 4],
    ['INTERMITTENT', 3],
    ['DEGRADED', 2],
    ['BLIND', 1],
  ] as [ClarityState, number][])('lights %s as %i of five bars', (state, lit) => {
    const { container } = render(<ClarityMark state={state} />);
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-bar][data-lit]')).toHaveLength(lit);
  });

  it('writes the band beside the bars and names it once for a screen reader', () => {
    const { container } = render(<ClarityMark state="INTERMITTENT" />);
    expect(container.textContent).toBe('intermittent');
    expect(screen.getByRole('img', { name: 'Clarity intermittent' })).toBeInTheDocument();
  });

  it('dims the picture as the reading dims', () => {
    const lit = (state: ClarityState): string | null =>
      render(<AgedThumb src="p.png" alt="Kestrel" clarity={state} />).container.querySelector('img')?.className ?? null;
    expect(lit('FULL')).not.toMatch(/brightness/);
    expect(lit('DEGRADED')).toMatch(/brightness-50/);
  });
});

describe('a picture that ages', () => {
  it.each([
    [10, 'fresh'],
    [120, 'aging'],
    [600, 'stale'],
    [3000, 'old'],
  ] as const)('grains a %i-minute-old picture as %s', (minutes, tier) => {
    const { container } = render(<AgedThumb src="p.png" alt="Kestrel" ageMinutes={minutes} />);
    expect(container.firstElementChild).toHaveAttribute('data-age', tier);
  });

  it('draws nothing it has never seen', () => {
    const { container } = render(<AgedThumb src="p.png" alt="Hollow-88" clarity="BLIND" />);
    expect(container.firstElementChild).toHaveAttribute('data-blind');
    expect(container.firstElementChild).toHaveClass('border-dashed');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('?');
    expect(screen.getByRole('img', { name: 'Hollow-88' })).toBeInTheDocument();
  });

  it('fades a picture older than a day', () => {
    const img = render(<AgedThumb src="p.png" alt="Kestrel" ageMinutes={3000} />).container.querySelector('img');
    expect(img?.className).toMatch(/opacity-/);
  });

  it('keeps a fresh picture clean', () => {
    const { container } = render(<AgedThumb src="p.png" alt="Kestrel" ageMinutes={5} />);
    expect(container.firstElementChild).not.toHaveClass('v2-grain');
  });

  it('grains an old picture', () => {
    const { container } = render(<AgedThumb src="p.png" alt="Kestrel" ageMinutes={3000} />);
    expect(container.firstElementChild).toHaveClass('v2-grain');
  });
});
