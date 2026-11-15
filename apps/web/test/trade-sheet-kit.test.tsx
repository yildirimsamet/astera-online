import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRADE } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import type { PlanetView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { offerStep, type TradeShipEvent } from '../src/lib/trade.js';
import { TradeSheet } from '../src/screens/TradeSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * G4-i1 (2026-11-15): THE MERCHANT'S SHEET ON THE GAME KIT. "Shall I trade, and what for?"
 * The convoy on the kit's hull rows; what leaves on the kit's plates and a kit slider that moves
 * in the merchant's lots; what comes home on one kit slider between the two goods; the legs and
 * the flight in kit wells; what the world keeps on the transfer's garrison bar; the send on the
 * kit's one-second hold.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|(^|\s)slider(\s|-)|(^|\s)text-(micro|body|caption|label)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const NOW = Date.now();
const merchant: TradeShipEvent = {
  id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11', kind: 'TRADE_SHIP', startsAt: new Date(NOW - 30 * 60_000),
  endsAt: new Date(NOW + 150 * 60_000), rate: TRADE.rate, appearsAtMinute: 570, expiresAtMinute: 750,
  orbit: { radius: 1_100, period: (2 * Math.PI * 1_100) / TRADE.speed, phase: 0.7, inclination: 0.4, ascendingNode: 1.9, speed: TRADE.speed },
};
const planet: PlanetView = planetView({ fleet: { ATLAS: 12, DART: 4 } }, { alloy: 5_000, crystal: 5_000, deuterium: 5_000 });

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.galaxy, { radiationModel: 'PCT', radiation: [], hpRadiation: [] });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={new Api({ fetch: vi.fn<typeof globalThis.fetch>() })}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
};
const sheet = () => render(
  <TradeSheet merchant={merchant} seasonStart={new Date(NOW - 600 * 60_000)} planet={planet} onClose={vi.fn()} onLaunched={vi.fn()} />,
  { wrapper },
);

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('the merchant’s sheet on the kit', () => {
  it('is a kit sheet in my colour with no browser range and none of the old look', () => {
    sheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('gk-sheet');
    expect(dialog.querySelector('input[type="range"]')).toBeNull();
    expect(oldPaint(dialog)).toEqual([]);
  });

  it('lists the carriers on the kit’s hull rows', () => {
    sheet();
    expect(document.querySelector('[data-hull-row="ATLAS"]')).toHaveClass('gk-lrow');
  });

  it('picks what leaves on the kit’s plates and sets it on a kit slider that moves in the merchant’s lots', async () => {
    const user = userEvent.setup();
    sheet();
    await user.click(screen.getByRole('button', { name: /max atlas/i }));
    const pick = screen.getByRole('radiogroup', { name: /what you give/i });
    expect(within(pick).getByRole('radio', { name: 'Alloy' })).toHaveAttribute('aria-checked', 'true');
    const offer = screen.getByRole('slider', { name: /alloy to give/i });
    const before = Number(offer.getAttribute('aria-valuenow'));
    fireEvent.keyDown(offer, { key: 'ArrowLeft' });
    const after = Number(screen.getByRole('slider', { name: /alloy to give/i }).getAttribute('aria-valuenow'));
    expect(before - after).toBe(offerStep('alloy', TRADE.rate));
    expect(screen.getByRole('slider', { name: /what you take/i })).toHaveClass('gk-slider__track');
  });

  it('keeps the legs and the flight in kit wells and what stays home on the garrison bar', async () => {
    const user = userEvent.setup();
    sheet();
    await user.click(screen.getByRole('button', { name: /max atlas/i }));
    expect(screen.getByTestId('trade-legs')).toHaveClass('gk-well');
    expect(document.querySelector('[data-origin-defence]')).toHaveClass('gk-keeps__bar');
  });

  it('sends on the kit’s one-second hold', () => {
    sheet();
    const hold = within(screen.getByTestId('trade-commit')).getByRole('button');
    expect(hold).toHaveClass('gk-hold');
  });
});
