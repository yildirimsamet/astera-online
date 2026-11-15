import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorldsPanel } from '../src/screens/WorldsPanel.js';
import { planetView } from './fixtures.js';

/**
 * G2-j (2026-11-15): THE WORLDS PANEL ON THE GAME KIT. "Which of my worlds has what, and
 * move some of it." Each world is a kit card that goes there, its three stores the Base's
 * own gauges; a transfer is one route line — from ⇄ to — whose ends drop a kit list of the
 * worlds, never a browser's `<select>`, and one press that opens the transfer.
 */

const capital = planetView(
  { fleet: { DART: 4, COURIER: 1 }, ground: { THORN: 2 }, flight: { used: 1, total: 3 } },
  { id: 'capital-1', name: 'Kestrel-12', alloy: 9_400, crystal: 2_100, deuterium: 60 },
);
const haven = planetView(
  { fleet: { DART: 2 }, ground: {}, flight: { used: 0, total: 3 } },
  { id: 'colony-1', name: 'Haven', alloy: 300, crystal: 80, deuterium: 0 },
);
const orlo = planetView(
  { fleet: {}, ground: {}, flight: { used: 2, total: 3 } },
  { id: 'colony-2', name: 'Orlo', alloy: 12, crystal: 4, deuterium: 0 },
);

const panel = (over: Partial<Parameters<typeof WorldsPanel>[0]> = {}) => (
  <WorldsPanel
    worlds={[capital, haven, orlo]}
    activePlanetId="capital-1"
    capitalPlanetId="capital-1"
    onSelect={vi.fn()}
    onTransfer={vi.fn()}
    onClose={vi.fn()}
    {...over}
  />
);

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|rounded-chip|(^|\s)(plate|legend|slab|field|name|num)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

describe('the worlds panel on the kit', () => {
  it('is a kit sheet with no browser select and none of the old look', () => {
    render(panel());
    const sheet = screen.getByRole('dialog', { name: 'Worlds' });
    expect(sheet).toHaveClass('gk-sheet');
    expect(sheet.querySelector('select')).toBeNull();
    expect(oldPaint(sheet)).toEqual([]);
  });

  it('makes each world a kit card that goes there, its stores the Base’s gauges', () => {
    render(panel());
    const list = screen.getByRole('list', { name: /your worlds/i });
    const card = within(list).getByRole('button', { name: /^Kestrel-12/ });
    expect(card).toHaveClass('gk-wcard');
    expect(card).toHaveAttribute('data-own-sound');
    expect(card.querySelectorAll('.gk-store')).toHaveLength(3);
    expect(within(card).getByRole('img', { name: /1 of 3 flight bays/i })).toBeInTheDocument();
  });

  it('drops a kit list of worlds from each end of the route, and picks on a press', async () => {
    const user = userEvent.setup();
    const onTransfer = vi.fn();
    render(panel({ onTransfer }));
    const from = screen.getByRole('button', { name: /^From/ });
    expect(from).toHaveAttribute('aria-haspopup', 'listbox');
    expect(from).toHaveTextContent('Kestrel-12');
    await user.click(from);
    expect(from).toHaveAttribute('aria-expanded', 'true');
    const picks = screen.getByRole('listbox', { name: 'From' });
    expect(within(picks).getByRole('option', { name: /Kestrel-12/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(picks).getByRole('option', { name: /Haven/ }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(from).toHaveTextContent('Haven');
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));
    expect(onTransfer).toHaveBeenCalledWith('colony-1', 'capital-1');
  });

  it('turns the route around from the middle', async () => {
    const user = userEvent.setup();
    const onTransfer = vi.fn();
    render(panel({ onTransfer }));
    await user.click(screen.getByRole('button', { name: /swap/i }));
    expect(screen.getByRole('button', { name: /^From/ })).toHaveTextContent('Haven');
    expect(screen.getByRole('button', { name: /^To/ })).toHaveTextContent('Kestrel-12');
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));
    expect(onTransfer).toHaveBeenCalledWith('colony-1', 'capital-1');
  });

  it('opens the transfer with the kit’s main press', () => {
    render(panel());
    expect(screen.getByRole('button', { name: /^transfer$/i })).toHaveClass('gk-btn', 'gk-btn--action');
  });
});
