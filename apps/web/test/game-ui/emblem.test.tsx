import type { HullClass } from '@astera/rules';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Glyph, type GlyphId } from '../../src/game-ui/icons.js';
import { Emblem } from '../../src/game-ui/readouts.js';
import { combatClassLabel } from '../../src/i18n/names.js';

/**
 * THE CLASS EMBLEM (owner 2026-11-12: "A · Evrim" shapes on "R1b" plates). Each class is a
 * shape you can remember and a plate colour of its own: Akıncı an arrowhead on pink, Mızrak a
 * spear on violet, Sur a walled shield on blue; Destek, which does not fight, a cross on steel.
 * An enemy's class keeps its colour and gets a red frame, so the class still reads.
 */

const CLASSES: readonly [HullClass, GlyphId, string | null][] = [
  ['SKIRMISHER', 'class_skirmisher', 'skirmisher'],
  ['LANCE', 'class_lance', 'lance'],
  ['BULWARK', 'class_bulwark', 'bulwark'],
  ['SUPPORT', 'class_support', null],
];

const css = readFileSync(join('src/game-ui', 'game-ui.css'), 'utf8');
const tokens = readFileSync(join('src/game-ui', 'tokens.css'), 'utf8');
const rule = (selector: string): string => new RegExp(`${selector.replace(/[.-]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('the class emblem', () => {
  it.each(CLASSES)('draws %s with its own kit glyph and names it for a screen reader', (cls, glyph) => {
    const own = render(<Glyph id={glyph} />).container.querySelector('path')?.getAttribute('d');
    const { container } = render(<Emblem cls={cls} />);
    expect(screen.getByRole('img', { name: combatClassLabel(cls) })).toBeVisible();
    expect(container.querySelector('path')?.getAttribute('d')).toBe(own);
  });

  it('gives the four classes four different shapes', () => {
    const shapes = CLASSES.map(([cls]) => render(<Emblem cls={cls} />).container.querySelector('path')?.getAttribute('d'));
    expect(new Set(shapes).size).toBe(4);
  });

  it.each(CLASSES)('puts %s on its own plate colour, Destek on steel', (cls, _glyph, tone) => {
    const plate = render(<Emblem cls={cls} />).container.querySelector('.gk-emblem');
    const tones = [...(plate?.classList ?? [])].filter((name) => /^gk-emblem--(skirmisher|lance|bulwark|support)$/.test(name));
    expect(tones).toEqual(tone === null ? [] : [`gk-emblem--${tone}`]);
    if (tone !== null) {
      expect(tokens).toMatch(new RegExp(`--gk-class-${tone}-hi:[^;]+;\\s*--gk-class-${tone}-lo:`));
      expect(rule(`.gk-emblem--${tone}`)).toMatch(new RegExp(`var\\(--gk-class-${tone}`));
    }
  });

  it('frames an enemy class in red and keeps its class colour, so the class still reads', () => {
    const plate = render(<Emblem cls="LANCE" hostile />).container.querySelector('.gk-emblem');
    expect(plate).toHaveClass('gk-emblem--hostile', 'gk-emblem--lance');
    const hostile = rule('.gk-emblem--hostile');
    expect(hostile).toMatch(/var\(--gk-hostile\)/);
    expect(hostile).not.toMatch(/background/);
  });
});
