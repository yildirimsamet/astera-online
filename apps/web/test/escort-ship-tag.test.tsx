import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { arenaCopy } from '../src/arena/copy.js';
import { EscortTag } from '../src/galaxy/EscortShip.js';

/** F26: at the rear of a fleet the commander ship was an unlabelled model, the player's own ship lost in the wing. */
describe('the escort at the rear of a fleet', () => {
  let previous = 'en';
  beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
  afterEach(async () => { await i18n.changeLanguage(previous); });

  it('wears the same tag as the parked ship: its class and level', () => {
    const c = arenaCopy();
    const view = render(<EscortTag escort={{ ship: 'muhafiz', level: 2 }} />);
    const tag = view.container.querySelector('[data-part="escort-ship-tag"]');
    expect(tag?.textContent).toBe(`${c.classes.muhafiz.name} · ${c.level(2)}`);
    expect(tag?.classList.contains('galaxy-ship-tag')).toBe(true);
  });
});
