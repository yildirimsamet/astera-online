import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StoreGauge } from '../../src/game-ui/index.js';

/**
 * A STORE ON A WORLD (stage 4.1, the base screen). What it holds against what it can
 * hold, the share a raid cannot take boxed in at the start, and what flows in each
 * hour. A full store is a gap the player can close: its figure turns to the warning
 * colour, never the red of something done to them.
 */

const gauge = (props: Partial<Parameters<typeof StoreGauge>[0]> = {}) =>
  render(<StoreGauge resource="alloy" held={12_400} cap={40_000} safe={2_000} rate={900} label="Alloy store" {...props} />);

const width = (element: Element | null): string => (element instanceof HTMLElement ? element.style.width : '');

describe('the store gauge', () => {
  it('names the store for a screen reader and prints held over cap and the hourly flow', () => {
    gauge();
    const group = screen.getByRole('group', { name: 'Alloy store' });
    expect(group).toHaveTextContent('12.4K');
    expect(group).toHaveTextContent('/40K');
    expect(group).toHaveTextContent('+900');
  });

  it('fills to the share held and boxes in the share a raid cannot take', () => {
    const { container } = gauge();
    expect(width(container.querySelector('.gk-bar__fill'))).toBe('31%');
    expect(width(container.querySelector('.gk-store__safe'))).toBe('5%');
  });

  it('marks a full store, and never draws past the end of the bar', () => {
    const { container } = gauge({ held: 41_000, safe: 50_000 });
    expect(container.querySelector('[data-full]')).toBeTruthy();
    expect(width(container.querySelector('.gk-bar__fill'))).toBe('100%');
    expect(width(container.querySelector('.gk-store__safe'))).toBe('100%');
  });

  it('reads a world that makes none yet as zero, with no plus sign', () => {
    gauge({ resource: 'deuterium', held: 0, cap: 300, safe: 0, rate: 0, label: 'Deuterium store' });
    const group = screen.getByRole('group', { name: 'Deuterium store' });
    expect(group).not.toHaveTextContent('+');
    expect(group.querySelector('[data-full]')).toBeNull();
  });
});
