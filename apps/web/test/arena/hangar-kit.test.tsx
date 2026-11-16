import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_STATS, type ShipClass } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';
import type { Hangar } from '../../src/arena/hangarDesk.js';

vi.mock('../../src/arena/hangar/HangarStage.js', () => ({
  default: ({ ship }: { ship: ShipClass }) => <div data-testid="stage" data-ship={ship} />,
}));
const { HangarPanel } = await import('../../src/arena/hangar/HangarPanel.js');
await import('../../src/arena/TeamPanel.js');

/**
 * G12-d1 (2026-11-16): THE HANGAR'S SHELL ON THE GAME KIT. "My ship: how is it, and what next?"
 * The ship's name and level on the bay in the kit's type, its state as a kit chip, the desk's
 * three parts as kit tabs that count the points waiting, the class as a kit door, and the way into
 * the Yarık as the one lit press, steel when only practice is open. A season's class is the
 * kit's final hold: it cannot be taken back.
 */

const OLD = /(^|\s)(text|bg|border|font|divide)-v2-|rounded-control|(^|\s)text-(micro|body|caption|label)(\s|$)|(^|\s)hp-(plate|go|facts|lead|loading|card)\b/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => OLD.test(name));

let c = arenaCopy();
let previous = 'en';
beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); c = arenaCopy(); });
afterEach(async () => { await i18n.changeLanguage(previous); vi.unstubAllGlobals(); });

const hangar = (ship: Partial<NonNullable<Hangar['ship']>> | null = {}): Hangar => ({
  core: 11, minCore: 9,
  ship: ship === null ? null : { class: 'muhafiz', changeUntil: null, fuel: CLASS_STATS.muhafiz.fuelTank, ammo: CLASS_STATS.muhafiz.ammoCapacity,
    hold: [0, 0, 0], readyAt: null, readyReason: null, flying: false, away: null, homeAt: null,
    level: 3, xp: 50, xpNext: 150, levelCap: 11, abilities: {}, upgrade: { alloy: 450, crystal: 225, deuterium: 0 }, plan: { fuel: 100, ammo: 100 }, ...ship },
  refill: { fuel: 20, ammo: 3, total: 23 }, deuterium: 140, alloy: 5000, crystal: 2000,
  cap: { alloy: 5664, crystal: 2832, deuterium: 76 }, sent: { alloy: 664, crystal: 0, deuterium: 80 },
  resetsAt: '2099-10-24T00:00:00.000Z', entryClosesAt: '2099-11-01T00:00:00.000Z',
});
const serve = (body: Hangar) => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/arena/hangar' ? body
    : { playerId: '00000000-0000-4000-8000-000000000001', clanId: null, canCreate: false, capacity: 5, claims: [], team: null }), { status: 200 }))));
};
const open = () => render(<HangarPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
const part = (selector: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`no ${selector}`);
  return node;
};

describe('the hangar’s shell on the kit', () => {
  it('names the ship on the bay in the kit’s type, its level and state as kit chips', async () => {
    serve(hangar()); open();
    await screen.findByRole('tablist', { name: c.deskTabs });
    const plate = part('[data-part="ship-plate"]');
    expect(plate.querySelector('.gk-display')).toHaveTextContent('Muhafız');
    expect(plate.querySelector('.gk-chip')).toHaveTextContent(c.level(3));
    expect(part('[data-status]').closest('.gk-chip')).not.toBeNull();
    expect(oldPaint(plate)).toEqual([]);
  });

  it('lays the desk’s three parts on kit tabs, counting the points that wait', async () => {
    serve(hangar({ level: 4 })); open();
    const tabs = await screen.findByRole('tablist', { name: c.deskTabs });
    expect(tabs).toHaveClass('gk-tabs');
    expect(screen.getByRole('tab', { name: new RegExp(c.pointsReady(3)) })).toBeInTheDocument();
  });

  it('opens the classes from a kit door', async () => {
    serve(hangar()); open();
    expect(await screen.findByRole('button', { name: new RegExp(c.compareClasses) })).toHaveClass('gk-door');
  });

  it('lights the way into the Yarık when the ship may fly, and keeps practice open in steel when it cannot', async () => {
    serve(hangar()); const view = open();
    await screen.findByRole('tablist', { name: c.deskTabs });
    expect(part('[data-testid="hangar-enter"]')).toHaveClass('gk-btn--action');
    expect(oldPaint(part('.hp-dock'))).toEqual([]);
    view.unmount();
    serve(hangar({ readyAt: new Date(Date.now() + 600_000).toISOString(), readyReason: 'repair' })); open();
    await screen.findByRole('tablist', { name: c.deskTabs });
    const enter = part('[data-testid="hangar-enter"]');
    expect(enter).not.toHaveClass('gk-btn--action');
    expect(enter).toBeEnabled();
    expect(enter).toHaveTextContent(c.practiceOnly);
  });

  it('takes a season’s class on the kit’s final hold', async () => {
    serve(hangar(null)); open();
    await waitFor(() => { expect(part('[data-hp-choose]')).toHaveClass('gk-hold'); });
    expect(part('[data-hp-choose]').style.getPropertyValue('--gk-hold-ms')).toBe('1500ms');
  });
});
