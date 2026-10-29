import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CosmeticId } from '@astera/rules';
import { ApiError } from '../api/client.js';
import { describeError } from '../i18n/errors.js';
import { Icon } from '../v2/icons.js';

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
export function ShopierPayButton({ amount, state, onPress, className }: {
  amount: number; state: ShopierState | null; onPress: () => void; className: string;
}) {
  const { t } = useTranslation();
  const busy = state?.status === 'loading';
  // Once the page is open, the panel's link is the way forward; this one steps back.
  const ready = state?.status === 'ready';
  return <button type="button" onClick={onPress} disabled={busy || ready} aria-busy={busy} className={`${className} disabled:opacity-60`}>
    <span className="inline-flex items-center justify-center gap-1">
      {ready && <Icon id="i-check" className="size-3.5" />}
      {busy ? t('skins.shopierPreparing') : ready ? t('skins.shopierReady')
        : t('skins.shopierBuy', { price: shopierPrice(amount, t('units.numberLocale')) })}
    </span>
  </button>;
}

/** What follows the press: the commander's own page — or why it could not be opened. */
export function ShopierProgress({ state }: { state: ShopierState | null }) {
  if (state?.status === 'error') {
    return <p role="alert" className="mt-2 rounded-control border border-v2-warn/30 bg-v2-warn/5 px-3 py-2 text-caption text-v2-warn">{state.message}</p>;
  }
  return state?.status === 'ready' ? <ShopierPagePanel url={state.url} /> : null;
}

function ShopierPagePanel({ url }: ShopierPage) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('skins.shopierPanelTitle')} className="mt-2 grid gap-2 rounded-control border border-v2-premium/45 bg-v2-deep/85 p-2.5">
      <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wide text-v2-premium">
        <Icon id="i-check" className="size-3 shrink-0" />
        {t('skins.shopierPanelTitle')}
      </p>
      <a href={url} target="_blank" rel="noreferrer noopener"
        className="v2-store-shimmer flex h-11 items-center justify-center gap-1.5 rounded-control bg-v2-premium px-3 text-caption font-bold text-v2-void">
        {t('skins.shopierGo')}
        <Icon id="i-share" className="size-3.5" />
      </a>
      <p className="flex items-start gap-1.5 text-micro leading-snug text-v2-ink-3">
        <Icon id="i-info" className="mt-0.5 size-3 shrink-0" />
        <span>{t('skins.shopierWhy')}</span>
      </p>
      <p role="status" className="flex items-center gap-1.5 text-micro text-v2-ink-2">
        <Icon id="i-hourglass" className="size-3 shrink-0 text-v2-premium" />
        <span>{t('skins.shopierWaiting')}</span>
      </p>
    </section>
  );
}
