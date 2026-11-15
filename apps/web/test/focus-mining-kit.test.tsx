import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AsteroidFocus, DebrisFocus } from '../src/galaxy/FocusPanel.js';
import type { HaulHome } from '../src/lib/collect.js';

/**
 * G4-h1 (2026-11-15): THE MINING CARDS ON THE GAME KIT. "Shall I mine it, shall I take it?"
 * A rock or a wreck passing through: how many craft go is the kit's plates; whether they catch
 * it is a note beside the send; the figures stand in a kit well; a haul that will not fit home
 * says so in warning with the fix as a kit press; the send is the card's one kit move.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|v2-legend|(^|\s)text-(micro|body|caption|label)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const NOW = Date.now();
const ROCK = {
  id: 'rock-7', level: 3, ore: 40_000, oreRemaining: 31_500, crystalShare: 0.35, radius: 400, period: 30, phase: 0.2,
  inclination: 1, ascendingNode: 0.8, speed: 9.2, appearsAt: 0, expiresAt: 999, active: true, isotopeRich: true, deuteriumShare: 0.2,
};
const fits = (): HaulHome => ({ room: 12_000, lost: { alloy: 0, crystal: 0, deuterium: 0 } });
const spills = (): HaulHome => ({ room: 420, lost: { alloy: 0, crystal: 63, deuterium: 0 } });
const run = {
  id: 'run-1', targetKind: 'asteroid' as const, asteroidId: 'rock-7', debrisFieldId: null, status: 'outbound' as const, craft: 1,
  departAt: new Date(NOW - 60_000), arriveAt: new Date(NOW + 300_000), homeAt: null, intercept: { x: 0, y: 0, z: 0 },
  minedAlloy: 0, minedCrystal: 0, minedDeuterium: 0,
};

const rock = (over: Partial<Parameters<typeof AsteroidFocus>[0]> = {}) => {
  const onSend = vi.fn();
  render(
    <AsteroidFocus rock={ROCK} isotopeAccess craftAvailable={3} craftHold={300} derrick={false} derrickHold={780}
      minutesLeft={140} reachMinutes={12} atHome={fits} run={undefined} craftReadyAt={null}
      onClose={vi.fn()} onSend={onSend} busy={false} open onToggle={vi.fn()} {...over} />,
  );
  return onSend;
};
const wreck = (atHome: () => HaulHome = spills, onCollect: (() => void) | undefined = vi.fn()) => {
  render(
    <DebrisFocus field={{ id: 'wreck-2', alloy: 9_000, crystal: 3_400, deuterium: 600, minutesLeft: 24 }} planetName="Grimhold"
      craftAvailable={2} craftHold={300} reachMinutes={9} atHome={atHome} onCollect={onCollect} run={undefined}
      craftReadyAt={null} onSend={vi.fn()} onClose={vi.fn()} busy={false} open onToggle={vi.fn()} />,
  );
  return onCollect;
};
const rail = () => document.querySelector<HTMLElement>('[data-focus-rail]')!;

describe('the mining cards on the kit', () => {
  it('draw the rock and the wreck with none of the old look', () => {
    rock({ run, craftCooldowns: [{ runId: 'r', craft: 1, readyAt: new Date(NOW + 420_000) }] });
    expect(oldPaint(rail())).toEqual([]);
    document.body.innerHTML = '';
    wreck();
    expect(oldPaint(rail())).toEqual([]);
  });

  it('choose how many craft go on the kit’s plates, and the send says the count', async () => {
    const user = userEvent.setup();
    const onSend = rock();
    const plates = screen.getByRole('radiogroup', { name: /how many to send/i });
    expect(within(plates).getAllByRole('radio')).toHaveLength(3);
    await user.click(within(plates).getByRole('radio', { name: '1' }));
    expect(within(plates).getByRole('radio', { name: '1' })).toHaveAttribute('aria-checked', 'true');
    const send = screen.getByRole('button', { name: /^send 1/i });
    expect(send).toHaveClass('gk-btn', 'gk-btn--action');
    expect(send).toHaveAttribute('data-primary');
    expect(send).toHaveAttribute('data-guide', 'mine');
    await user.click(send);
    expect(onSend).toHaveBeenCalledWith(1);
  });

  it('says whether the craft catch the rock as a note, and what is out and resting as notes', () => {
    rock({ run, craftCooldowns: [{ runId: 'r', craft: 1, readyAt: new Date(NOW + 420_000) }] });
    const notes = [...rail().querySelectorAll('.gk-inote')].map((note) => note.textContent);
    expect(notes.some((text) => /would meet it in 12m/i.test(text))).toBe(true);
    expect(notes.some((text) => /resting/i.test(text))).toBe(true);
    expect(notes.some((text) => /1 craft already working this rock/i.test(text))).toBe(true);
  });

  it('stands the rock’s figures in a kit well', () => {
    rock();
    expect(rail().querySelector('.gk-well.gk-figures')).not.toBeNull();
  });

  it('warns that a haul will not fit home, with collecting first as a kit press', async () => {
    const user = userEvent.setup();
    const onCollect = wreck();
    const line = screen.getByTestId('haul-home');
    expect(line).toHaveClass('gk-inote');
    expect(line).toHaveAttribute('data-tone', 'warn');
    const collect = within(line).getByRole('button', { name: /collect first/i });
    expect(collect).toHaveClass('gk-btn');
    await user.click(collect);
    expect(onCollect).toHaveBeenCalledOnce();
  });

  it('says quietly when the whole haul fits', () => {
    wreck(fits, undefined);
    expect(screen.getByTestId('haul-home')).not.toHaveAttribute('data-tone');
  });
});
