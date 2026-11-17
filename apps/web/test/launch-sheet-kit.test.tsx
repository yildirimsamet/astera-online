import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * G4-e1 (2026-11-15): THE LAUNCH ON THE GAME KIT. "Pack the wing, read the price, send it."
 * The sheet is the kit's, in the enemy's colour; each hull is a kit row with the kit's
 * counter; the flight reads in kit figures; and the send is the kit's hold, weighed as a
 * spend — one second, never a tap.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-(control|chip|cell)|v2-legend|(^|\s)text-(micro|caption|body)(\s|$)|(^|\s)truncate(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const target: GalaxyPlanet = {
  id: 'p2', name: 'Tharsis', owner: 'Sable', position: { x: 120, y: 0, z: 80 }, coreTier: 2, coreLevel: 6,
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false,
};

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: () => new Promise<Response>(() => undefined) });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
};

const open = () => render(
  <LaunchSheet target={{ kind: 'world', world: target }} planet={planetView({ fleet: { DART: 6, COURIER: 2 } }, { deuterium: 50_000 })}
    onClose={vi.fn()} onLaunched={vi.fn()} />, { wrapper },
);

describe('the launch on the kit', () => {
  it('is a kit sheet in the enemy’s colour, the owner on a kit chip', () => {
    open();
    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveClass('gk-sheet');
    expect(sheet.querySelector('[data-launch-owner]')).toHaveClass('gk-chip');
  });

  it('lists each hull as a kit ship card, none of the old look (owner, 2026-11-16)', () => {
    open();
    const fleet = document.querySelector<HTMLElement>('[data-launch-fleet]')!;
    expect(oldPaint(fleet)).toEqual([]);
    const dart = fleet.querySelector<HTMLElement>('[data-hull-row="DART"]')!;
    expect(dart).toHaveClass('gk-unit');
    expect(dart.querySelector('.gk-unit__ship')).not.toBeNull();
  });

  it('reads the flight in kit figures', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /max dart/i }));
    const figures = document.querySelector<HTMLElement>('[data-launch-figures]')!;
    expect(oldPaint(figures)).toEqual([]);
    expect(figures.querySelectorAll('.gk-figure')).toHaveLength(5);
  });

  it('sends on the kit’s hold, weighed as a spend; refused, it says why', () => {
    open();
    const commit = document.querySelector<HTMLElement>('[data-launch-commit]')!;
    expect(within(commit).getByRole('button')).toHaveAttribute('data-hold-refused');
    fireEvent.click(screen.getByRole('button', { name: /max dart/i }));
    const send = within(commit).getByRole('button', { name: /^launch 6 ships/i });
    expect(send).toHaveClass('gk-hold');
    expect(send.style.getPropertyValue('--gk-hold-ms')).toBe('1000ms');
    expect(oldPaint(commit)).toEqual([]);
  });
});
