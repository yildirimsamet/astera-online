import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CostLine } from '../../src/game-ui/index.js';

/**
 * WHAT A THING COSTS (stage 4.1, the building card). Each resource it takes as its
 * picture and a short figure, in one line; what the store cannot yet pay is marked by
 * the warning colour AND a dotted underline, so colour is never the only sign. The
 * time an order takes rides at the end, in the same line, as the fourth currency.
 */

const parts = (container: HTMLElement) => [...container.querySelectorAll('.gk-cost__part')];

describe('the cost line', () => {
  it('prints each resource it takes, with its picture, in short figures', () => {
    const { container } = render(<CostLine cost={{ alloy: 1_400, crystal: 564, deuterium: 30 }} />);
    expect(parts(container).map((part) => part.textContent)).toEqual(['1.4K', '564', '30']);
    expect(container.querySelectorAll('.gk-cost__part img')).toHaveLength(3);
  });

  it('leaves out a resource it does not take', () => {
    const { container } = render(<CostLine cost={{ alloy: 706, crystal: 0 }} />);
    expect(parts(container).map((part) => part.textContent)).toEqual(['706']);
  });

  it('marks only what the store cannot pay yet', () => {
    const { container } = render(
      <CostLine cost={{ alloy: 1_400, crystal: 564, deuterium: 30 }} held={{ alloy: 12_400, crystal: 300, deuterium: 30 }} />,
    );
    expect(parts(container).map((part) => part.hasAttribute('data-short'))).toEqual([false, true, false]);
  });

  it('marks nothing when it does not know the store', () => {
    const { container } = render(<CostLine cost={{ alloy: 1_400, crystal: 564 }} />);
    expect(container.querySelector('[data-short]')).toBeNull();
  });

  it('carries the time an order takes at the end of the line', () => {
    const { container } = render(<CostLine cost={{ alloy: 30, crystal: 30 }} time={<span data-time="">3 dk</span>} />);
    expect(container.querySelector('.gk-cost')?.lastElementChild).toHaveAttribute('data-time');
  });
});
