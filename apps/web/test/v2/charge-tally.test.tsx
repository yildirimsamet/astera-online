import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChargeTally } from '../../src/v2/kit/ChargeTally.js';

const cells = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('[data-cell]')].map((cell) => cell.dataset.cell ?? '');

/**
 * CHARGES, CELL BY CELL. D3 (owner, round 2): a Death Star or an interception charge is
 * a slot that is loaded, loading or empty. A labelled numeric counter accompanies
 * the tally on tactical cards; weapon levels use their own symbols.
 */
describe('the charge tally', () => {
  it('keeps paused and flying stock occupied without calling it ready or loading', () => {
    render(<ChargeTally ready={1} loading={1} paused={1} inFlight={1} total={5} label="Stock 4/5" />);
    expect(cells()).toEqual(['ready', 'loading', 'paused', 'flight', 'empty']);
    expect(screen.getByRole('img', { name: 'Stock 4/5' })).toHaveAttribute('data-used', '4');
  });

  it('bounds reserved cells to the slots remaining after ready and loading stock', () => {
    render(<ChargeTally ready={1} loading={0} paused={3} inFlight={4} total={2} label="Stock 2/2" />);
    expect(cells()).toEqual(['ready', 'paused']);
    expect(screen.getByRole('img')).toHaveAttribute('data-used', '2');
  });
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
