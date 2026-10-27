import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_STATS, SHIP_CLASSES, hitShare } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { ClassPicker, TacticPicker, classStatRows } from '../../src/arena/ClassPicker.js';
import { arenaCopy } from '../../src/arena/copy.js';

/**
 * Y4, owner 2026-10-23: the class is chosen before the flight. A pilot reads what each one is for
 * in one line, and every number beside the other two classes' on the same bar.
 */
let previous = 'en';
beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
afterEach(async () => { await i18n.changeLanguage(previous); });

describe('the class picker', () => {
  it('shows each tactic\'s own earned rank before launch, including free class affinity', () => {
    const view = render(<TacticPicker c={arenaCopy()} value="smoke" ship="kilavuz" points={{ smoke: 4 }} onPick={() => undefined} />).container;
    expect(view.querySelector('[data-tactic="smoke"]')?.textContent).toContain('2,1 sn');
    expect(view.querySelector('[data-tactic="smoke"]')?.textContent).toContain('14,4 sn');
    expect(view.querySelector('[data-tactic="radar"]')?.textContent).toContain('3,3 sn');
    expect(view.querySelector('[data-tactic="radar"]')?.textContent).toContain('28,5 sn');
  });
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

  it('shows each number with its unit, filled against the best class, a star where this one is best', () => {
    const view = render(<ClassPicker c={arenaCopy()} value="akinci" onPick={() => undefined} />);
    const rows = [...view.container.querySelectorAll<HTMLElement>('.ap-class-stats li')];
    // Owner 2026-10-24: shot damage and accuracy are on the card too, accuracy as the share of shots on a ship.
    expect(rows.map(row => row.querySelector('strong')?.textContent)).toEqual(['80 m/s', '82°/sn', '340', '13', '117/sn', '%56', '300', '220']);
    // The Akıncı is the fastest: a full speed bar; its hull is 340 of the Muhafız's 600.
    expect(rows[0]?.style.getPropertyValue('--fill')).toBe('1');
    expect(Number(rows[2]?.style.getPropertyValue('--fill'))).toBeCloseTo(340 / 600, 3);
    // The most accurate class fills its bar; the Muhafız's wide cone does not.
    expect(rows[5]?.style.getPropertyValue('--fill')).toBe('1');
    // Owner 2026-10-27: the marks for the other two classes meant nothing to players; a star says "best here".
    for (const row of rows) expect(row.querySelector('[data-other]')).toBeNull();
    expect(rows.map(row => row.querySelector('[data-best]') !== null)).toEqual(rows.map(row => row.style.getPropertyValue('--fill') === '1'));
    expect(view.container.querySelector('.ap-class-key')?.textContent).toBe(arenaCopy().classKey);
    expect(arenaCopy().classKey).toContain('★');
  });

  it('measures fire as damage a second: shot damage times shots a second', () => {
    const fire = classStatRows(arenaCopy()).find(row => row.key === 'fire');
    expect(SHIP_CLASSES.map(ship => fire?.value(ship))).toEqual(SHIP_CLASSES.map(ship => CLASS_STATS[ship].damage * CLASS_STATS[ship].fireRate));
  });

  it('reads accuracy from the cone the guns fire, so a level that narrows it raises the figure', () => {
    const accuracy = (level: number) => classStatRows(arenaCopy(), level).find(row => row.key === 'accuracy');
    expect(accuracy(1)?.value('kilavuz')).toBeCloseTo(hitShare(CLASS_STATS.kilavuz.spreadBase) * 100, 6);
    expect(accuracy(20)?.value('kilavuz') ?? 0).toBeGreaterThan(accuracy(1)?.value('kilavuz') ?? 0);
  });

  it('reads in English too', async () => {
    await i18n.changeLanguage('en');
    const view = render(<ClassPicker c={arenaCopy()} value="kilavuz" onPick={() => undefined} />);
    expect(view.container.querySelector('.ap-class-stats li strong')?.textContent).toBe('72 m/s');
    expect(view.container.textContent).toContain('45%');
    expect(view.container.textContent).toContain(arenaCopy().classes.kilavuz.line);
  });
});
