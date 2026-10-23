import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_STATS, SHIP_CLASSES } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { ClassPicker, classStatRows } from '../../src/arena/ClassPicker.js';
import { arenaCopy } from '../../src/arena/copy.js';

/**
 * Y4, owner 2026-10-23: the class is chosen before the flight. A pilot reads what each one is for
 * in one line, and every number beside the other two classes' on the same bar.
 */
let previous = 'en';
beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
afterEach(async () => { await i18n.changeLanguage(previous); });

describe('the class picker', () => {
  it('offers the three classes as one choice, the picked one checked', () => {
    let picked = '';
    const view = render(<ClassPicker c={arenaCopy()} value="akinci" onPick={ship => { picked = ship; }} />);
    const radios = [...view.container.querySelectorAll('[role="radio"]')];
    expect(radios.map(radio => radio.textContent)).toEqual(['Akıncı', 'Muhafız', 'Kılavuz']);
    expect(radios.map(radio => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    const muhafiz = radios[1]; if (!muhafiz) throw new Error('no radio');
    fireEvent.click(muhafiz);
    expect(picked).toBe('muhafiz');
  });

  it('says in one line what the picked class is for', () => {
    for (const ship of SHIP_CLASSES) {
      const view = render(<ClassPicker c={arenaCopy()} value={ship} onPick={() => undefined} />);
      expect(view.container.querySelector('.ap-class-line')?.textContent).toBe(`${arenaCopy().classes[ship].role} · ${arenaCopy().classes[ship].line}`);
      view.unmount();
    }
  });

  it('shows each number with its unit, filled against the best class, the other two marked on the same bar', () => {
    const view = render(<ClassPicker c={arenaCopy()} value="akinci" onPick={() => undefined} />);
    const rows = [...view.container.querySelectorAll<HTMLElement>('.ap-class-stats li')];
    expect(rows.map(row => row.querySelector('strong')?.textContent)).toEqual(['80 m/s', '82°/sn', '340', '117/sn', '70', '220']);
    // The Akıncı is the fastest: a full speed bar; its hull is 340 of the Muhafız's 600.
    expect(rows[0]?.style.getPropertyValue('--fill')).toBe('1');
    expect(Number(rows[2]?.style.getPropertyValue('--fill'))).toBeCloseTo(340 / 600, 3);
    for (const row of rows) expect(row.querySelectorAll('[data-other]')).toHaveLength(2);
  });

  it('measures fire as damage a second: shot damage times shots a second', () => {
    const fire = classStatRows(arenaCopy()).find(row => row.key === 'fire');
    expect(SHIP_CLASSES.map(ship => fire?.value(ship))).toEqual(SHIP_CLASSES.map(ship => CLASS_STATS[ship].damage * CLASS_STATS[ship].fireRate));
  });

  it('reads in English too', async () => {
    await i18n.changeLanguage('en');
    const view = render(<ClassPicker c={arenaCopy()} value="kilavuz" onPick={() => undefined} />);
    expect(view.container.querySelector('.ap-class-stats li strong')?.textContent).toBe('72 m/s');
    expect(view.container.textContent).toContain(arenaCopy().classes.kilavuz.line);
  });
});
