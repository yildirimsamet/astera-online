import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TRADE } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { IntergalacticConvoyFocus, TradeFocus } from '../src/galaxy/FocusPanel.js';
import type { IntergalacticConvoyEvent } from '../src/lib/intergalacticConvoy.js';
import type { TradeShipEvent } from '../src/lib/trade.js';
import { IntergalacticConvoySheet } from '../src/screens/IntergalacticConvoySheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * G4-i2 (2026-11-15): THE CONVOY'S RAID SHEET AND THE TWO FOCUS CARDS ON THE GAME KIT.
 * "Shall I strike the convoy, is the merchant worth a trip?" The convoy's rules lead in a well,
 * its wing on the kit's hull rows, what it brings home in a real table, the strike on the
 * kit's one-second hold in the raid's colour. On the rail: the merchant's rate as kit bars,
 * the figures in a kit well, and each card's one kit press.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|v2-legend|(^|\s)text-(micro|body|caption|label)(\s|$)|bg-(alloy|deuterium)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const NOW = Date.now();
const convoy: IntergalacticConvoyEvent = {
  id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11', kind: 'INTERGALACTIC_CONVOY',
  startsAt: new Date(NOW - 10 * 60_000), endsAt: new Date(NOW + 110 * 60_000), appearsAtMinute: 1140, expiresAtMinute: 1260,
  route: { from: { x: -2000, y: 0, z: 0 }, to: { x: 2000, y: 0, z: 0 }, velocity: { x: 100 / 3, y: 0, z: 0 }, speed: 100 / 3 },
  visual: { formationVersion: 1 },
  rewardPolicy: { resourceCapHours: 4, fullRewardForceRatio: 1, shipDropFullFirepower: 5780, shipDropChanceAtFullQuality: 0.15, maxAwardedShips: 3 },
};
const merchant: TradeShipEvent = {
  id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11', kind: 'TRADE_SHIP', startsAt: new Date(NOW - 30 * 60_000),
  endsAt: new Date(NOW + 150 * 60_000), rate: TRADE.rate, appearsAtMinute: 570, expiresAtMinute: 750,
  orbit: { radius: 1_100, period: (2 * Math.PI * 1_100) / TRADE.speed, phase: 0.7, inclination: 0.4, ascendingNode: 1.9, speed: TRADE.speed },
};
const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.galaxy, { radiationModel: 'PCT', radiation: [], hpRadiation: [] });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={new Api({ fetch: vi.fn<typeof globalThis.fetch>() })}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
};
const rail = () => document.querySelector<HTMLElement>('[data-focus-rail]')!;
const shell = { onClose: vi.fn(), open: true, onToggle: vi.fn() };

describe('the convoy’s raid sheet on the kit', () => {
  const sheet = () => render(
    <IntergalacticConvoySheet event={convoy} seasonStart={new Date(NOW - 1150 * 60_000)}
      planet={planetView({ fleet: { DART: 12 } })} onClose={vi.fn()} onLaunched={vi.fn()} />,
    { wrapper },
  );

  it('is a kit sheet in the raid’s colour with none of the old look', () => {
    sheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('gk-sheet');
    expect(oldPaint(dialog)).toEqual([]);
  });

  it('leads with the rules in a well and lists the wing on the kit’s hull rows', () => {
    sheet();
    expect(document.querySelector('[data-convoy-rules]')).toHaveClass('gk-well');
    expect(document.querySelector('[data-hull-row="DART"]')).toHaveClass('gk-lrow');
  });

  it('shows what comes home in a table whose columns are named', () => {
    sheet();
    fireEvent.click(screen.getByRole('button', { name: 'Send every Dart' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThanOrEqual(3);
    expect(within(table).getAllByRole('row').length).toBe(4);
  });

  it('strikes on the kit’s one-second hold', () => {
    sheet();
    expect(within(screen.getByTestId('convoy-commit')).getByRole('button')).toHaveClass('gk-hold');
  });
});

describe('the merchant and the convoy on the rail', () => {
  it('the merchant: the rate as kit bars, a kit well, the kit’s press', () => {
    const onTrade = vi.fn();
    render(<TradeFocus merchant={merchant} fleetAtHome={{ ATLAS: 2 }} fleetAway={{}} minutesLeft={150} reachMinutes={10}
      onTrade={onTrade} {...shell} />);
    expect(oldPaint(rail())).toEqual([]);
    expect(rail().querySelectorAll('[data-rate-row] .gk-par__bar')).toHaveLength(3);
    expect(rail().querySelector('.gk-well.gk-figures')).not.toBeNull();
    const open = screen.getByTestId('trade-open');
    expect(open).toHaveClass('gk-btn', 'gk-btn--action');
    fireEvent.click(open);
    expect(onTrade).toHaveBeenCalledOnce();
  });

  it('the convoy: a kit well, the kit’s press, its reason when spent', () => {
    render(<IntergalacticConvoyFocus convoy={convoy} minutesLeft={110} reachMinutes={14} hasCombatCraft launchLocked={false}
      occurrenceSpent onRaid={vi.fn()} {...shell} />);
    expect(oldPaint(rail())).toEqual([]);
    const open = screen.getByTestId('convoy-open');
    expect(open).toHaveClass('gk-btn');
    expect(open).toBeDisabled();
  });
});
