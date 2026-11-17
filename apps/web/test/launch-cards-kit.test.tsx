import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { forecastPirateProfit } from '@astera/rules';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { TempoNote } from '../src/starter/TempoNote.js';
import { HonorTargetCard } from '../src/ui/HonorTargetCard.js';
import { PirateProfitCard } from '../src/ui/PirateProfitCard.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * G4-e3 (2026-11-15): WHAT A LAUNCH EARNS, ON THE GAME KIT. "Is it worth it?" What Honor this
 * target pays, what a pirate leaves after expenses, and how a battle here differs, read in kit
 * wells and notes at the kit's type floor; when the Honor reading fails, the retry is a kit press.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-(control|chip|cell)|v2-legend|(^|\s)text-(micro|caption|body)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const input = { attacker: { CORSAIR: 12, ARGOSY: 1 }, crew: { DART: 2 }, level: 1 as const,
  tech: {}, rulesetVersion: 16, hoard: { alloy: 1000, crystal: 500, deuterium: 333 },
  damage: [{ hull: 'ARGOSY' as const, count: 1, damageBp: 1, remainderBp: 0.25 }],
  paid: { alloy: 0, crystal: 0, deuterium: 0 }, fuel: 80 };

describe('what a launch earns, on the kit', () => {
  it('reads the Honor a target pays in a kit well', () => {
    const { container } = render(<HonorTargetCard value={{ enabled: true, eligible: true, kind: 'WEAK', militaryReturn: 'NONE',
      related: false, repeated: true, retaliation: true, soloCredit: true }} />);
    const card = container.querySelector<HTMLElement>('[data-honor-target]')!;
    expect(card).toHaveClass('gk-well');
    expect(oldPaint(card)).toEqual([]);
  });

  it('reads a pirate’s return after expenses in a kit well, waiting or ready', () => {
    const { container, rerender } = render(<PirateProfitCard forecast={forecastPirateProfit(input)} state="ready" radiation />);
    const ready = screen.getByTestId('pirate-profit');
    expect(ready).toHaveClass('gk-well');
    expect(oldPaint(container)).toEqual([]);
    rerender(<PirateProfitCard forecast={null} state="pending" />);
    expect(screen.getByTestId('pirate-profit')).toHaveClass('gk-well');
    expect(oldPaint(container)).toEqual([]);
  });

  it('says how a battle here differs in kit notes', () => {
    const { container } = render(<TempoNote aboard beforeLaunch />);
    expect(container.querySelectorAll('.gk-sub')).toHaveLength(2);
    expect(oldPaint(container)).toEqual([]);
  });

  it('offers the Honor reading again on a kit press when it fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: () => Promise.resolve(new Response('{}', { status: 500 })) });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
    );
    const target: GalaxyPlanet = { id: 'p2', name: 'Tharsis', owner: 'Sable', position: { x: 120, y: 0, z: 80 }, coreTier: 2, coreLevel: 6,
      intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false };
    render(<LaunchSheet target={{ kind: 'world', world: target }} planet={planetView({ fleet: { DART: 6 } })}
      onClose={vi.fn()} onLaunched={vi.fn()} />, { wrapper });
    const retry = await screen.findByRole('button', { name: /try again|retry/i });
    expect(retry).toHaveClass('gk-btn');
    expect(retry).toHaveAttribute('data-own-sound');
  });
});
