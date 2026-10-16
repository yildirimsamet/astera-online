import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CosmeticId } from '@astera/rules';
import { ApiError } from '../api/client.js';
import { describeError } from '../i18n/errors.js';
import { Icon } from '../v2/icons.js';

type ItemId = CosmeticId | 'bundle';
export interface ShopierCode { code: string; url: string }
export interface ShopierOffer {
  /** Kuruş, and only for items that have a Shopier product. */
  prices: Readonly<Partial<Record<string, number>>>;
  requestCode: (itemId: ItemId) => Promise<ShopierCode>;
}
type ShopierState = { itemId: ItemId; status: 'loading' }
  | ({ itemId: ItemId; status: 'ready' } & ShopierCode)
  | { itemId: ItemId; status: 'error'; message: string };

/**
 * SHOPIER CANNOT KNOW THE COMMANDER (owner 2026-10-16). Its order has no account field, only
 * the buyer's note, so the store hands a single-use code to paste there and the server binds
 * the paid order by it. One state for the whole store: the press and its panel may sit apart.
 */
export function useShopierCheckout(offer?: ShopierOffer) {
  const { t } = useTranslation();
  const [state, setState] = useState<ShopierState | null>(null);
  const start = async (itemId: ItemId): Promise<void> => {
    if (!offer) return;
    setState({ itemId, status: 'loading' });
    try {
      const issued = await offer.requestCode(itemId);
      setState({ itemId, status: 'ready', code: issued.code, url: issued.url });
    } catch (reason) {
      setState({ itemId, status: 'error', message: reason instanceof ApiError ? describeError(reason) : t('skins.shopierCodeError') });
    }
  };
  return { of: (itemId: ItemId) => state?.itemId === itemId ? state : null, start };
}

/** Kuruş as lira with the ₺ mark in every language; whole lira drop the decimals. */
export const shopierPrice = (amount: number, locale: string): string => new Intl.NumberFormat(locale, {
  style: 'currency', currency: 'TRY', currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: amount % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
}).format(amount / 100);

/** The press itself: Shopier, in lira. It waits visibly while its code is being issued. */
export function ShopierPayButton({ amount, state, onPress, className }: {
  amount: number; state: ShopierState | null; onPress: () => void; className: string;
}) {
  const { t } = useTranslation();
  const busy = state?.status === 'loading';
  // Once the code is out, the panel's own press is the way forward; this one steps back.
  const ready = state?.status === 'ready';
  return <button type="button" onClick={onPress} disabled={busy || ready} aria-busy={busy} className={`${className} disabled:opacity-60`}>
    <span className="inline-flex items-center justify-center gap-1">
      {ready && <Icon id="i-check" className="size-3.5" />}
      {busy ? t('skins.shopierPreparing') : ready ? t('skins.shopierCodeReady')
        : t('skins.shopierBuy', { price: shopierPrice(amount, t('units.numberLocale')) })}
    </span>
  </button>;
}

/** What follows the press: the code, where it goes, and why it matters — or why it failed. */
export function ShopierProgress({ state }: { state: ShopierState | null }) {
  if (state?.status === 'error') {
    return <p role="alert" className="mt-2 rounded-control border border-v2-warn/30 bg-v2-warn/5 px-3 py-2 text-caption text-v2-warn">{state.message}</p>;
  }
  return state?.status === 'ready' ? <ShopierCodePanel code={state.code} url={state.url} /> : null;
}

function ShopierCodePanel({ code, url }: ShopierCode) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => { setCopied(false); }, 2500);
    return () => { clearTimeout(timer); };
  }, [copied]);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch { /* The code stays on screen and selectable. */ }
  };
  const steps = [t('skins.shopierStepPaste'), t('skins.shopierStepPay')];
  return (
    <section aria-label={t('skins.shopierCodeTitle')} className="mt-2 grid gap-2.5 rounded-control border border-v2-premium/45 bg-v2-deep/85 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('skins.shopierCodeTitle')}</p>
          <p className="select-all font-v2-mono text-figure font-semibold tracking-wide text-v2-premium">{code}</p>
        </div>
        <button type="button" onClick={() => { void copy(); }}
          className="flex h-9 shrink-0 items-center gap-1 rounded-control border border-v2-premium/50 bg-v2-premium/10 px-2.5 text-micro font-semibold text-v2-premium">
          {copied && <Icon id="i-check" className="size-3" />}
          {t(copied ? 'skins.shopierCopied' : 'skins.shopierCopy')}
        </button>
      </div>
      <ol className="grid gap-1.5">
        {steps.map((step, index) => (
          <li key={step} className="flex items-start gap-2 text-caption leading-snug text-v2-ink-2">
            <span aria-hidden className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-v2-premium/20 font-v2-mono text-micro font-semibold text-v2-premium">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <a href={url} target="_blank" rel="noreferrer noopener" onClick={() => { void copy(); }}
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
