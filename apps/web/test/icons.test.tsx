import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as icons from '../src/ui/icons/index.js';
import type { IconProps } from '../src/ui/icons/index.js';

/**
 * THE ICON SET, HELD TO ITS OWN LAW.
 *
 * `icons/index.tsx` states it at the top and every glyph in the file depends on
 * it: **icons carry shape, the interface carries colour.** Hue means category and
 * luminance means certainty everywhere else in this UI, so an icon that ships its
 * own fill or its own stroke colour fights that system — and it does it quietly,
 * looking merely "a bit off" on one surface rather than failing anywhere.
 *
 * Two more properties are load-bearing and equally invisible when broken. A glyph
 * drawn on a grid other than 24 is a glyph that is the wrong size next to every
 * other one at the same `className`. And a glyph with no `aria-hidden` is a glyph
 * a screen reader reads out beside the label it is decorating.
 *
 * Written as a sweep over the module rather than a list, so a glyph added next
 * month is covered the moment it is exported and nobody has to remember this file.
 */

type IconComponent = (props: IconProps) => React.ReactElement;

const GLYPHS = Object.entries(icons).filter(
  (entry): entry is [string, IconComponent] =>
    typeof entry[1] === 'function' && entry[0].endsWith('Icon'),
);

describe('every icon', () => {
  it('there are some, and the sweep is actually finding them', () => {
    expect(GLYPHS.length).toBeGreaterThan(30);
  });

  it.each(GLYPHS)('%s is line art on currentColor, on the 24 grid', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg!.getAttribute('stroke')).toBe('currentColor');
    expect(svg!.getAttribute('fill')).toBe('none');
    // Decorative by default. `title` is what promotes one to an image.
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  it.each(GLYPHS)('%s becomes a labelled image when it is the only label', (_name, Icon) => {
    const { container } = render(<Icon title="Named" />);
    const svg = container.querySelector('svg');

    expect(svg!.getAttribute('role')).toBe('img');
    expect(svg!.getAttribute('aria-hidden')).toBeNull();
    expect(svg!.querySelector('title')?.textContent).toBe('Named');
  });

  /**
   * THE TWO GLYPHS THE OWNER ASKED FOR BY NAME, and the one place the set
   * deliberately contradicts itself.
   *
   * The file's own rule says `intel` is an aperture and NOT an eye, because an eye
   * reads as surveillance OF you and the Intel centre is your own instrument. A
   * PROBE is the opposite act — you are looking at somebody else's world, and that
   * world is told about it — so the probe control wears an eye and the intel
   * control does not. If these two ever became the same glyph, the interface would
   * have stopped distinguishing the silent half of the fog from the loud half.
   */
  it('draws the probe and the intel centre as different things', () => {
    const eye = render(<icons.EyeIcon />).container.innerHTML;
    const aperture = render(<icons.IntelIcon />).container.innerHTML;
    expect(eye).not.toBe(aperture);
  });
});
