import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { arenaCopy } from '../src/arena/copy.js';
import { ShipTag } from '../src/galaxy/ParkedShip.js';

/**
 * F16 (S22 2026-10-26): at the galaxy's usual distance the parked ship is a speck and its touch
 * sphere a few pixels; the tag under it read like a button and was not one. It is one now.
 */
describe('the parked ship\'s tag', () => {
  let previous = 'en';
  beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
  afterEach(async () => { await i18n.changeLanguage(previous); });

  it('opens the hangar on a tap', () => {
    const select = vi.fn();
    const c = arenaCopy();
    render(<ShipTag park={{ planetId: 'p', ship: 'kilavuz', level: 1, docked: false, reason: null, until: null }} onSelect={select} />);
    const tag = screen.getByRole('button', { name: `${c.classes.kilavuz.name} · ${c.level(1)}` });
    fireEvent.click(tag);
    expect(select).toHaveBeenCalledOnce();
  });
});
