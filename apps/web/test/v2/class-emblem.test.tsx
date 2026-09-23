import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HullClass } from '@astera/rules';
import { ClassEmblem, classEmblemId } from '../../src/v2/kit/ClassEmblem.js';
import { Icon } from '../../src/v2/icons.js';

/**
 * ONE SHAPE PER CLASS, EVERYWHERE. Spec B8 (docs/ui-v2/gozlemevi.md).
 *
 * ▲ Skirmisher beats ⬢ Bulwark beats ◆ Lance beats ▲ Skirmisher; ● Support fights
 * nothing. The counter cycle decides every battle, so the same four shapes stand
 * on the shipyard card, the launch row, the probe reading and the report — a rule
 * learned once is recognised everywhere.
 */

const CLASSES: readonly [HullClass, string][] = [
  ['SKIRMISHER', 'Skirmisher'],
  ['BULWARK', 'Bulwark'],
  ['LANCE', 'Lance'],
  ['SUPPORT', 'Support'],
];

describe('the class emblem', () => {
  it.each(CLASSES)('names %s for a screen reader', (cls, name) => {
    render(<ClassEmblem cls={cls} />);
    expect(screen.getByRole('img', { name })).toBeInTheDocument();
  });

  it('draws four different shapes', () => {
    const drawn = CLASSES.map(([cls]) => renderToStaticMarkup(<ClassEmblem cls={cls} decorative />));
    expect(new Set(drawn).size).toBe(4);
  });

  it('draws each class with its emblem from the icon set', () => {
    for (const [cls] of CLASSES) {
      expect(renderToStaticMarkup(<ClassEmblem cls={cls} decorative />))
        .toBe(renderToStaticMarkup(<Icon id={classEmblemId(cls)} className="size-3" />));
    }
  });

  it('maps the counter cycle to the triangle, hexagon, diamond and circle', () => {
    expect(CLASSES.map(([cls]) => classEmblemId(cls))).toEqual(['c-sk', 'c-bw', 'c-ln', 'c-sp']);
  });

  it('stays silent when the class is already written beside it', () => {
    const { container } = render(<ClassEmblem cls="LANCE" decorative />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
