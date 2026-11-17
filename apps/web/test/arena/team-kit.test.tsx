import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamView } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { TacticPicker } from '../../src/arena/ClassPicker.js';
import { arenaCopy } from '../../src/arena/copy.js';
import TeamPanel from '../../src/arena/TeamPanel.js';

/**
 * G12-a (2026-11-16): THE YARIK TEAM ON THE GAME KIT. "Who flies with me, and can we go?" The crew
 * in the kit's crew list with each pilot's state as a chip, every press a kit press that says why
 * it cannot be pressed, the two tactic slots as kit plates that mark which option each holds, and
 * the rules one press away. The panel sits in the clan page, the hangar and the flight desk alike,
 * so it carries its own look instead of borrowing the flight desk's stylesheet.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font|divide)-v2-|rounded-control|(^|\s)text-(micro|body|caption|label)(\s|$)|ap-tactic/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const self = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const teamId = '00000000-0000-4000-8000-000000000003';
const lobby = (ready = false): TeamView => ({ playerId: self, clanId: '00000000-0000-4000-8000-000000000004', canCreate: false, capacity: 5, claims: [],
  team: { id: teamId, state: 'forming', leaderId: self, joined: true,
    members: [self, other].map((playerId, i) => ({ playerId, name: i ? 'Bora' : 'Ada', ready: i ? true : ready, tactic: 'smoke', outcome: null, blocked: null,
      ship: { class: i ? 'muhafiz' : 'kilavuz', level: 3, fuel: 200, fuelMax: 250, readyAt: null } })) } });
const answer = (view: TeamView | null) => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(view ?? { error: 'TEAM_UNAVAILABLE' }),
    { status: view ? 200 : 503, headers: { 'content-type': 'application/json' } }))));
};
const panel = () => document.querySelector<HTMLElement>('[data-part="arena-team"]')!;

let previous = 'en';
beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage(previous); });

describe('the Yarık team on the kit', () => {
  it('is a kit section with none of the old look, the crew in the kit’s crew list', async () => {
    answer(lobby()); render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    await screen.findByText('Bora');
    expect(panel()).toHaveClass('gk');
    expect(oldPaint(panel())).toEqual([]);
    const rows = panel().querySelectorAll('.gk-crewlist__row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector('.gk-chip[data-tone="self"]')).toHaveTextContent('Sen');
    expect(rows[1]?.querySelector('[data-state]')).toHaveAttribute('data-tone', 'self');
  });

  it('removes a pilot with a short kit press that names whom for a reader', async () => {
    answer(lobby()); render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    const remove = await screen.findByRole('button', { name: 'Bora · takımdan çıkar' });
    expect(remove).toHaveClass('gk-btn');
    expect(remove).toHaveTextContent('Çıkar');
  });

  it('says why the launch waits, on the kit’s action press', async () => {
    answer(lobby()); render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    const start = await screen.findByRole('button', { name: /Herkes hazır olunca/ });
    expect(start).toBeDisabled();
    expect(start).toHaveClass('gk-btn--action');
  });

  it('says on the ready press why a ship under repair cannot be ready', async () => {
    const view = lobby(); const me = view.team?.members[0]; if (!me) throw new Error('no self');
    me.blocked = 'SHIP_NOT_READY';
    answer(view); render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Tamir veya bakım bitmedi/ })).toBeDisabled();
  });

  it('keeps the loot rules one press away', async () => {
    answer(lobby()); render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    await screen.findByText('Bora');
    const rules = panel().querySelector('details.gk-rules');
    expect(rules).toHaveTextContent('Ganimet kuralları');
    expect(rules?.hasAttribute('open')).toBe(false);
  });

  it('says a lost connection in a warning note with a kit press to reconnect', async () => {
    answer(null); render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    const note = await screen.findByRole('status');
    expect(note).toHaveClass('gk-inote');
    expect(screen.getByRole('button', { name: 'Yeniden bağlan' })).toHaveClass('gk-btn');
  });
});

describe('the tactic slots on the kit', () => {
  it('draws the slots and the options as kit plates, and marks which slot holds each option', () => {
    const view = render(<TacticPicker c={arenaCopy()} value="smoke" value2="cloak" onPick={vi.fn()} />);
    const root = view.container.querySelector('section')!;
    expect(root).toHaveClass('gk-tactics');
    expect(oldPaint(root)).toEqual([]);
    expect(view.container.querySelector('[data-tactic="smoke"]')).toHaveAttribute('data-key', 'E');
    expect(view.container.querySelector('[data-tactic="cloak"]')).toHaveAttribute('data-key', 'C');
    expect(view.container.querySelector('[data-tactic="radar"]')).not.toHaveAttribute('data-key');
    fireEvent.click(view.container.querySelector('[data-slot="2"]')!);
    expect(view.container.querySelector('[data-tactic="cloak"]')).toHaveAttribute('aria-checked', 'true');
  });
});
