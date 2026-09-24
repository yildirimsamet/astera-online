import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChargeTally } from '../../src/v2/kit/ChargeTally.js';

const cells = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('[data-cell]')].map((cell) => cell.dataset.cell ?? '');

/**
 * CHARGES, CELL BY CELL. D3 (owner, round 2): a Death Star or an interception charge is
 * a slot that is loaded, loading or empty — drawn as a tally, not as "1 / 2".
 */
describe('the charge tally', () => {
  it('draws one cell per slot: loaded, then loading, then empty', () => {
    render(<ChargeTally ready={1} loading={1} total={3} label="1 of 3 loaded" />);
    expect(cells()).toEqual(['ready', 'loading', 'empty']);
  });

  it('lights a loaded cell in your colour, outlines a loading one, leaves an empty one dark', () => {
    render(<ChargeTally ready={1} loading={1} total={3} label="x" />);
    const [ready, loading, empty] = [...document.querySelectorAll<HTMLElement>('[data-cell]')];
    expect(ready).toHaveClass('bg-v2-self');
    expect(loading!.className).toMatch(/ring-v2-self/);
    expect(loading).not.toHaveClass('bg-v2-self');
    expect(empty).toHaveClass('bg-v2-line');
  });

  it('names itself as one picture', () => {
    render(<ChargeTally ready={0} loading={1} total={2} label="1 of 2 charges loading" />);
    const tally = screen.getByRole('img', { name: '1 of 2 charges loading' });
    expect(tally).toHaveAttribute('data-used', '1');
    expect(tally).toHaveAttribute('data-total', '2');
  });

  it('never draws more than it has slots for', () => {
    render(<ChargeTally ready={3} loading={2} total={2} label="x" />);
    expect(cells()).toEqual(['ready', 'ready']);
  });

  it('draws nothing where there are no slots', () => {
    const { container } = render(<ChargeTally ready={0} loading={0} total={0} label="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
