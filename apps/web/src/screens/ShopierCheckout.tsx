import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CosmeticId } from '@astera/rules';
import { ApiError } from '../api/client.js';
import { describeError } from '../i18n/errors.js';
import { Banner, GameButton, Glyph } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';

type ItemId = CosmeticId | 'bundle';
export interface ShopierPage { url: string }
export interface ShopierOffer {
  /** Kuruş, and only for items that have a Shopier price. */
  prices: Readonly<Partial<Record<string, number>>>;
  requestCheckout: (itemId: ItemId) => Promise<ShopierPage>;
}
type ShopierState = { itemId: ItemId; status: 'loading' }
  | ({ itemId: ItemId; status: 'ready' } & ShopierPage)
  | { itemId: ItemId; status: 'error'; message: string };

/**
 * SHOPIER CANNOT KNOW THE COMMANDER (owner 2026-10-29). The press asks the server to open this
 * commander's own hidden Shopier product; paying on it is what names the buyer, so there is
 * nothing to copy or write. One state for the whole store: the press and its panel may sit apart.
 */
export function useShopierCheckout(offer?: ShopierOffer) {
  const { t } = useTranslation();
  const [state, setState] = useState<ShopierState | null>(null);
  const start = async (itemId: ItemId): Promise<void> => {
    if (!offer) return;
    setState({ itemId, status: 'loading' });
    try {
      const page = await offer.requestCheckout(itemId);
      setState({ itemId, status: 'ready', url: page.url });
    } catch (reason) {
      setState({ itemId, status: 'error', message: reason instanceof ApiError ? describeError(reason) : t('skins.shopierCheckoutError') });
    }
  };
  return { of: (itemId: ItemId) => state?.itemId === itemId ? state : null, start };
}

/** Kuruş as lira with the ₺ mark in every language; whole lira drop the decimals. */
export const shopierPrice = (amount: number, locale: string): string => new Intl.NumberFormat(locale, {
  style: 'currency', currency: 'TRY', currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: amount % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
}).format(amount / 100);

/** The press itself: Shopier, in lira. It waits visibly while the page is being opened. */
export function ShopierPayButton({ amount, state, onPress, wide = false }: {
  amount: number; state: ShopierState | null; onPress: () => void; wide?: boolean;
}) {
  const { t } = useTranslation();
  const busy = state?.status === 'loading';
  // Once the page is open, the panel's link is the way forward; this one steps back.
  const ready = state?.status === 'ready';
  return <GameButton tone="action" wide={wide} heavy glyph={ready ? 'check' : undefined} pending={busy} onPress={onPress}
    disabledReason={busy ? t('skins.shopierPreparing') : ready ? t('skins.shopierReady') : null}>
    {t('skins.shopierBuy', { price: shopierPrice(amount, t('units.numberLocale')) })}
  </GameButton>;
}

/** What follows the press: the commander's own page — or why it could not be opened. */
export function ShopierProgress({ state }: { state: ShopierState | null }) {
  if (state?.status === 'error') return <Banner tone="warn" role="alert" title={state.message} />;
  return state?.status === 'ready' ? <ShopierPagePanel url={state.url} /> : null;
}

function ShopierPagePanel({ url }: ShopierPage) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('skins.shopierPanelTitle')} className="gk-cut gk-shopier">
      <p className="gk-label gk-shopier__title"><Glyph id="check" />{t('skins.shopierPanelTitle')}</p>
      <a href={url} target="_blank" rel="noreferrer noopener" {...OWN_SOUND}
        onClick={() => { playSound('confirm'); haptic('commit'); }}
        className="gk-btn gk-btn--action gk-btn--wide">
        <span>{t('skins.shopierGo')}</span>
        <span className="gk-btn__glyph"><Glyph id="share" /></span>
      </a>
      <p className="gk-shopier__line"><Glyph id="help" /><span>{t('skins.shopierWhy')}</span></p>
      <p role="status" className="gk-shopier__line gk-shopier__line--wait"><Glyph id="clock" /><span>{t('skins.shopierWaiting')}</span></p>
    </section>
  );
}
