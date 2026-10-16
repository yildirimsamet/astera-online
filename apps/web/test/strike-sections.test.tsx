import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { planetView } from './fixtures.js';
import { RadiationBombLaunchPanel } from '../src/screens/RadiationBombControls.js';

/**
 * THE TWO STRIKE SECTIONS FOLD. Owner, 2026-10-16: *"İkisi de açılıp kapanabilir accordion
 * olsun. Hem ölüm yıldızı section hem radyasyon bombası section."* On the focus panel the
 * radiation strike is an accordion like the Death Star's; folded, its header still says how
 * many bombs are ready. Elsewhere (a monument's sheet) it stays an open section.
 */

const origin = () => planetView({ radiationBombsAvailable: true,
  radiationBombs: [
    { id: 'l1', level: 1, status: 'READY', readyAt: null, remainingSeconds: 0 },
    { id: 'l2', level: 2, status: 'LAUNCHED', readyAt: null, remainingSeconds: 0 },
    { id: 'l3', level: 3, status: 'READY', readyAt: null, remainingSeconds: 0 },
  ], buildings: { CORE: 13, SHIPYARD: 5 } });

const panel = (collapsible?: boolean) => render(<RadiationBombLaunchPanel origin={origin()}
  target={{ kind: 'PLANET', id: 'target' }} targetName="Grimhold" flightMs={60000} pending={false}
  onLaunch={vi.fn()} {...(collapsible === undefined ? {} : { collapsible })} />);

it('folds on the focus panel, its header naming the strike and the ready bombs', () => {
  panel(true);
  const section = screen.getByTestId('radiation-launch');
  expect(section.tagName).toBe('DETAILS');
  expect(section).not.toHaveAttribute('open');
  const header = section.querySelector<HTMLElement>('summary')!;
  expect(header).toHaveTextContent(/Radiation strike/);
  expect(header).toHaveTextContent(/2 ready/);
  fireEvent.click(header);
  expect(section).toHaveAttribute('open');
});

it('stays an open section where it is not asked to fold', () => {
  panel();
  expect(screen.getByTestId('radiation-launch').tagName).toBe('SECTION');
});

/**
 * THE RADIATION STRIKE STATES ITS HONOR IN THE SAME BOX THE DEATH STAR DOES. Owner,
 * 2026-10-16: *"radyasyon bombası section'da honor ile ilgili bir bölüm yok ama ölüm
 * yıldızına eklemişsin."* The rule was there as the last plain paragraph; it now wears the
 * Honor title and mark, and still follows the season's tactical policy.
 */
it('gives the radiation strike the Death Star’s Honor box, with the season’s rule in it', () => {
  render(<RadiationBombLaunchPanel origin={{ ...origin(), honorTacticalCredit: true }}
    target={{ kind: 'PLANET', id: 'target' }} targetName="Grimhold" flightMs={60000} pending={false} onLaunch={vi.fn()} />);
  const box = screen.getByTestId('radiation-launch').querySelector<HTMLElement>('[data-honor-weapon-rule]')!;
  expect(box.tagName).toBe('SECTION');
  expect(box).toHaveTextContent(/^Honor/);
  expect(box).toHaveTextContent(/at most 2.5 Honor per bomb/);
});

it('keeps the Honor box honest in a season without the tactical policy', () => {
  panel();
  const box = screen.getByTestId('radiation-launch').querySelector<HTMLElement>('[data-honor-weapon-rule]')!;
  expect(box.tagName).toBe('SECTION');
  expect(box).toHaveTextContent('Special weapons do not change Honor in this season.');
});
