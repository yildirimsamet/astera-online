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

  it('counts craft up even when none of them has a path to ring', () => {
    const { container } = render(
      <Dock active={null} badges={{ ...quiet, fleet: { airborne: 1, progress: null } }} onSelect={vi.fn()} />,
    );
    expect(container.querySelector('[data-ring]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fleet · In the air: 1' })).toBeInTheDocument();
  });
});
