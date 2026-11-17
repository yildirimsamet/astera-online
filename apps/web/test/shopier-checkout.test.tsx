import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { ShopierPayButton, ShopierProgress } from '../src/screens/ShopierCheckout.js';

const { heard, buzz } = vi.hoisted(() => ({ heard: vi.fn(), buzz: vi.fn() }));
vi.mock('../src/lib/sound.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), playSound: heard }));
vi.mock('../src/lib/haptics.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), haptic: buzz }));

beforeEach(async () => { heard.mockClear(); buzz.mockClear(); await i18n.changeLanguage('en'); });

const oldLook = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].flatMap((node) => (node.getAttribute('class') ?? '').split(/\s+/))
    .filter((name) => /(^|-)v2(-|$)/.test(name) || ['text-micro', 'text-label', 'text-caption', 'text-body', 'text-title', 'text-readout'].includes(name));

/**
 * C38 (2026-11-15): THE SHOPIER STEP ON THE KIT. The press is the kit's main button; while the
 * page is made it waits and says so; once made it steps back and the gold plate holds the way on.
 * What the server is asked and where the link goes are unchanged.
 */
describe('the Shopier step on the kit', () => {
  it('presses on the kit, waits while the page is made and steps back once it is ready', () => {
    const { rerender } = render(<ShopierPayButton amount={9900} state={null} onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: i18n.t('skins.shopierBuy', { price: '₺99' }) })).toHaveClass('gk-btn', 'gk-btn--action');
    rerender(<ShopierPayButton amount={9900} state={{ itemId: 'planet-toxic', status: 'loading' }} onPress={() => undefined} />);
    const waiting = screen.getByRole('button', { name: i18n.t('skins.shopierPreparing') });
    expect(waiting).toBeDisabled();
    expect(waiting).toHaveAttribute('aria-busy', 'true');
    rerender(<ShopierPayButton amount={9900} state={{ itemId: 'planet-toxic', status: 'ready', url: 'https://www.shopier.com/1' }} onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: i18n.t('skins.shopierReady') })).toBeDisabled();
  });

  it('holds the way on in a gold plate with the kit link, and a refusal in a warning banner', () => {
    const { rerender } = render(<ShopierProgress state={{ itemId: 'planet-toxic', status: 'ready', url: 'https://www.shopier.com/1' }} />);
    const panel = screen.getByRole('region', { name: i18n.t('skins.shopierPanelTitle') });
    expect(panel).toHaveClass('gk-cut', 'gk-shopier');
    expect(within(panel).getByRole('link', { name: i18n.t('skins.shopierGo') })).toHaveClass('gk-btn', 'gk-btn--action');
    expect(oldLook(panel)).toEqual([]);
    rerender(<ShopierProgress state={{ itemId: 'planet-toxic', status: 'error', message: 'No page' }} />);
    expect(screen.getByRole('alert')).toHaveClass('gk-banner', 'gk-banner--warn');
  });

  /** Spending money is one weight on every road (owner 2026-11-16): Shopier's press is heavy like Polar's. */
  it('answers the press with weight and asks once, and the way on lands with weight in a new tab', () => {
    const press = vi.fn();
    render(<ShopierPayButton amount={9900} state={null} onPress={press} wide />);
    const buy = screen.getByRole('button', { name: i18n.t('skins.shopierBuy', { price: '₺99' }) });
    expect(buy).toHaveClass('gk-btn--wide');
    fireEvent.click(buy);
    expect(press).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith('confirm');
    expect(buzz).toHaveBeenCalledWith('commit');
    heard.mockClear(); buzz.mockClear();
    render(<ShopierProgress state={{ itemId: 'planet-toxic', status: 'ready', url: 'https://www.shopier.com/1' }} />);
    const go = screen.getByRole('link', { name: i18n.t('skins.shopierGo') });
    expect(go).toHaveAttribute('href', 'https://www.shopier.com/1');
    expect(go).toHaveAttribute('target', '_blank');
    expect(go).toHaveAttribute('rel', 'noreferrer noopener');
    fireEvent.click(go);
    expect(heard).toHaveBeenCalledWith('confirm');
    expect(buzz).toHaveBeenCalledWith('commit');
  });
});
