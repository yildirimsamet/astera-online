import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { arenaCopy } from '../../src/arena/copy.js';
import { LoopLine } from '../../src/arena/LoopLine.js';

/**
 * Owner 2026-10-22: the launch screen hid the ship behind a big card. The loop is one line of
 * three steps now; one tap opens how each step is done.
 */
describe('the launch screen loop line', () => {
  const c = arenaCopy();

  it('names the three steps on one line, rules folded away', () => {
    const view = render(<LoopLine c={c} />);
    const button = view.getByRole('button');
    for (const [title] of c.goals) expect(button.textContent).toContain(title);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    for (const [, detail] of c.goals) expect(view.container.textContent).not.toContain(detail);
  });

  it('opens how each step is done with one tap, and folds it again', () => {
    const view = render(<LoopLine c={c} />);
    fireEvent.click(view.getByRole('button'));
    for (const [, detail] of c.goals) expect(view.container.textContent).toContain(detail);
    fireEvent.click(view.getByRole('button'));
    expect(view.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });
});
