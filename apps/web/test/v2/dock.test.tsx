import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DockBadges } from '../../src/lib/dock.js';
import { Dock } from '../../src/v2/hud/Dock.js';

/**
 * THE DOCK. Spec B4 (docs/ui-v2/gozlemevi.md), decision K1.
 *
 * Five labelled tabs in one order — a place with no name cannot be reached — and
 * each one says what is waiting behind it without being opened.
 */

const quiet: DockBadges = { base: false, fleet: { airborne: 0, progress: null }, intel: 0, clan: 0 };

describe('the dock', () => {
  /** Owner, 2026-09-24: fully transparent while closed; the gradient only under an open page. */
  it('lets the galaxy through while no page is open, and backs itself when one is', () => {
    const { rerender } = render(<Dock active="galaxy" badges={quiet} onSelect={vi.fn()} />);
    const nav = screen.getByRole('navigation');
    expect(nav).not.toHaveClass('bg-gradient-to-t');
    expect(nav).not.toHaveClass('border-t');
    rerender(<Dock active="base" badges={quiet} onSelect={vi.fn()} over />);
    expect(screen.getByRole('navigation')).toHaveClass('bg-gradient-to-t');
  });

  it('names its five tabs in the one order', () => {
    render(<Dock active="galaxy" badges={quiet} onSelect={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('button').map((tab) => tab.textContent))
      .toEqual(['Galaxy', 'Base', 'Fleet', 'Intel', 'Clan']);
  });

  it('marks the tab you are on', () => {
    render(<Dock active="intel" badges={quiet} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Intel/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Galaxy/ })).not.toHaveAttribute('aria-current');
  });

  it('hands the pressed tab to its host, the active one included', async () => {
    const onSelect = vi.fn();
    render(<Dock active="galaxy" badges={quiet} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Galaxy/ }));
    await userEvent.click(screen.getByRole('button', { name: /Clan/ }));
    expect(onSelect.mock.calls.map(([tab]) => tab as string)).toEqual(['galaxy', 'clan']);
  });

  it('says nothing when nothing is waiting', () => {
    const { container } = render(<Dock active={null} badges={quiet} onSelect={vi.fn()} />);
    expect(container.querySelector('[data-badge]')).toBeNull();
    expect(container.querySelector('[data-ring]')).toBeNull();
  });

  it('dots the base and counts intel and clan', () => {
    render(<Dock active={null} badges={{ ...quiet, base: true, intel: 3, clan: 12 }} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Base · Something to collect or repair' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intel · New reports: 3' })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Clan · Waiting for you: 12' })).toHaveTextContent('9+');
  });

  it('rings the fleet toward its next landing and counts what is up', () => {
    const { container } = render(
      <Dock active={null} badges={{ ...quiet, fleet: { airborne: 2, progress: 0.4 } }} onSelect={vi.fn()} />,
    );
    expect(container.querySelector('[data-ring]')).toHaveAttribute('data-progress', '0.4');
    expect(screen.getByRole('button', { name: 'Fleet · In the air: 2' })).toHaveTextContent('2');
  });

  /** A season with no clan layer: the tab keeps its place (the order never moves) and does nothing. */
  it('keeps an unavailable tab in its place, inert', async () => {
    const onSelect = vi.fn();
    render(<Dock active="galaxy" badges={quiet} onSelect={onSelect} disabled={['clan']} />);
    const clan = screen.getByRole('button', { name: /Clan/ });
    expect(clan).toBeDisabled();
    await userEvent.click(clan);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('counts craft up even when none of them has a path to ring', () => {
    const { container } = render(
      <Dock active={null} badges={{ ...quiet, fleet: { airborne: 1, progress: null } }} onSelect={vi.fn()} />,
    );
    expect(container.querySelector('[data-ring]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fleet · In the air: 1' })).toBeInTheDocument();
  });
});

/** E11 · K10: on a desk the dock is a tab bar in the top bar, and says which key opens each tab. */
describe('the dock as the desk tab bar', () => {
  it('keeps the five names in the one order, each with its key', () => {
    render(<Dock active="galaxy" badges={quiet} onSelect={vi.fn()} bar />);
    const tabs = within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('button');
    expect(tabs.map((tab) => tab.getAttribute('aria-keyshortcuts'))).toEqual(['1', '2', '3', '4', '5']);
    expect(tabs.map((tab) => tab.querySelector('kbd')?.textContent)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('is never the see-through phone dock: it sits in the top bar, which has its own ground', () => {
    render(<Dock active="base" badges={quiet} onSelect={vi.fn()} bar over />);
    const nav = screen.getByRole('navigation');
    expect(nav).not.toHaveClass('bg-gradient-to-t');
    expect(nav).toHaveAttribute('data-bar');
  });

  it('carries the same badges and the same routing', async () => {
    const onSelect = vi.fn();
    render(<Dock active="galaxy" badges={{ ...quiet, intel: 3 }} onSelect={onSelect} bar />);
    await userEvent.click(screen.getByRole('button', { name: 'Intel · New reports: 3' }));
    expect(onSelect).toHaveBeenCalledWith('intel');
  });
});
