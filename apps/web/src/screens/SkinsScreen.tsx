import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { type PlanetSkinId, type PlanetSkinStatus } from '@astera/rules';
import type { z } from 'zod';
import type { polarPricingSchema, skinCollectionSchema } from '../api/schemas.js';
import { usePolarPricing, usePolarShop, usePurchasePolarSkin, useSkins } from '../api/queries.js';
import {
  BUNDLE_PRICE,
  SHOPIER_LINKS,
  SKIN_PRICE,
  bundleSaving,
  priceText,
  type Currency,
} from '../lib/skinStore.js';
import {
  PLANET_SKIN_CATALOG,
  SKIN_COLLECTION_IDS,
  SKIN_COLLECTIONS,
  skinEditionTotal,
  type SkinCollectionId,
} from '../ui/skinCatalog.js';
import { Icon } from '../v2/icons.js';
import { navigateToPolarCheckout } from '../lib/polarCheckout.js';
import { SkinPreview } from './SkinPreview.jsx';

type Collection = z.infer<typeof skinCollectionSchema>;
type Pricing = z.infer<typeof polarPricingSchema>;
type ItemId = PlanetSkinId | 'bundle';
type PriceQuote = Pick<Pricing['prices'][string], 'formatted' | 'currencyCode'>;
type PriceMap = Partial<Record<ItemId, PriceQuote>>;
const EUR_ONLY_COUNTRY_SKINS = new Set<ItemId>(
  SKIN_COLLECTIONS.country.ids.filter((id) => id !== 'planet-turkey'),
);

/** Embers rising from the world: where, when and how fast, fixed so a render never reshuffles them. */
const EMBERS = [
  ['22%', '0s', '5.6s'], ['34%', '1.8s', '6.4s'], ['47%', '0.9s', '5.1s'],
  ['58%', '2.6s', '6.8s'], ['69%', '1.3s', '5.8s'], ['78%', '3.4s', '6.1s'],
] as const;

/** Stars over the stage: left, top, size, twinkle period and delay. */
const STARS = [
  [8, 14, 1, '3.1s', '0s'], [18, 46, 2, '4.4s', '1.2s'], [27, 78, 1, '3.7s', '0.4s'], [36, 22, 1, '5.2s', '2.1s'],
  [44, 88, 2, '4.1s', '0.8s'], [61, 9, 1, '3.4s', '1.7s'], [72, 64, 2, '4.8s', '0.2s'], [83, 31, 1, '3.9s', '2.6s'],
  [91, 72, 1, '4.6s', '1.1s'], [95, 16, 2, '3.6s', '0.6s'],
] as const;

/**
 * THE SKIN STORE (owner, 2026-09-25: "premium bir UI/UX ile baştan tasarlanmalı ... satış
 * arttırıcı görsel taktikler ... kımıl kımıl hareketli canlı ... Bu sayfa şuanda tek para
 * kaynağımız olacak").
 *
 * The look is the product, so it leads: the live model turning in its own light, over a
 * backdrop that never stops moving (`store.css`). Under it the price and the one press that
 * buys it — gold, the colour kept for the store alone (K2). Elemental and country
 * collections have separate tabs; only the original elemental four have a set offer.
 * Every claim is true of the game: the galaxy shows a look to everyone, it is the
 * account's for good, and its shielded look comes with it.
 * No invented counts, no invented scarcity.
 *
 * Polar creates a hosted checkout through the authenticated server route.
 */
export function SkinShopContent({
  collection,
  commander,
  onOpenInventory,
  prices = {},
  countryCode,
  enabled = false,
  pending = false,
  purchaseError = false,
  onPurchase = () => undefined,
}: {
  collection: Collection;
  commander: string;
  onOpenInventory: () => void;
  prices?: PriceMap;
  countryCode?: string;
  /** Polar checkout is enabled. */
  enabled?: boolean;
  /** A checkout is being created: its press waits rather than vanishing. */
  pending?: boolean;
  purchaseError?: boolean;
  onPurchase?: (itemId: ItemId) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const owned = new Set(collection.ownedSkinIds);
  const [activeCollection, setActiveCollection] = useState<SkinCollectionId>('elemental');
  const collectionIds = SKIN_COLLECTIONS[activeCollection].ids;
  // It opens on something to buy, where there is anything left to buy.
  const [selected, setSelected] = useState<PlanetSkinId>(
    () => SKIN_COLLECTIONS.elemental.ids.find((id) => !owned.has(id)) ?? SKIN_COLLECTIONS.elemental.ids[0],
  );
  const selectCollection = (id: SkinCollectionId): void => {
    setActiveCollection(id);
    const ids = SKIN_COLLECTIONS[id].ids;
    setSelected(ids.find((skinId) => !owned.has(skinId)) ?? ids[0]);
    setStatus('NORMAL');
  };
  const [status, setStatus] = useState<PlanetSkinStatus>('NORMAL');
  const locale = t('units.numberLocale');
  const currency: Currency = prices['planet-lava']?.currencyCode ?? (countryCode ? 'EUR' : 'TRY');
  const quoteFor = (itemId: ItemId): PriceQuote | undefined => {
    const quote = prices[itemId];
    return EUR_ONLY_COUNTRY_SKINS.has(itemId) && quote?.currencyCode !== 'EUR' ? undefined : quote;
  };
  const money = (itemId: ItemId, amounts: Readonly<Record<Currency, number>>): string => {
    const quote = quoteFor(itemId);
    const fallbackCurrency = EUR_ONLY_COUNTRY_SKINS.has(itemId) ? 'EUR' : currency;
    return quote?.formatted ?? priceText(amounts[fallbackCurrency], fallbackCurrency, locale);
  };
  const lira = (amount: number): string => priceText(amount, 'TRY', locale);
  const look = PLANET_SKIN_CATALOG[selected];
  const name = t(look.nameKey);
  const mine = owned.has(selected);
  const buyReady = enabled && Boolean(quoteFor(selected)) && Boolean(onPurchase);
  const bundleReady = enabled && Boolean(prices.bundle) && Boolean(onPurchase);
  const buy = (): void => { void onPurchase(selected); };
  const bundleBuy = (): void => { void onPurchase('bundle'); };
  const offerSet = activeCollection === 'elemental' && SKIN_COLLECTIONS.elemental.ids.every((id) => !owned.has(id));
  const shopierAllowed = (itemId: ItemId): boolean => !EUR_ONLY_COUNTRY_SKINS.has(itemId)
    && (!countryCode || (countryCode === 'TR' && prices[itemId]?.currencyCode === 'TRY'));
  const shopier = mine || !shopierAllowed(selected) ? null : SHOPIER_LINKS[selected];
  const bundleShopier = shopierAllowed('bundle') ? SHOPIER_LINKS.bundle : null;
  const canPay = buyReady || bundleReady || shopier !== null || (offerSet && bundleShopier !== null);

  const stageStyle = { '--look': look.accent, '--look-glow': look.glow } as CSSProperties;
  const buyClass = 'v2-store-shimmer flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control bg-v2-premium px-3 text-caption font-bold text-v2-void';

  return (
    <div className="v2-store relative min-h-full overflow-hidden bg-v2-void pb-[calc(24px+env(safe-area-inset-bottom))] font-v2-ui text-v2-ink" style={stageStyle}>
      {/* The living backdrop: a drifting nebula lit by the chosen look. */}
      <div aria-hidden className="v2-store-nebula pointer-events-none absolute inset-x-0 top-0 h-[34rem]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-transparent via-v2-void/30 to-v2-void" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[26rem]">
        {STARS.map(([x, y, size, dur, delay], index) => (
          <span
            key={index}
            className="v2-store-star"
            style={{ left: `${String(x)}%`, top: `${String(y)}%`, width: size, height: size, '--dur': dur, '--delay': delay } as CSSProperties}
          />
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-xl px-3 pt-2">
        <header className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-v2-premium/50 bg-v2-premium/10 px-2 py-0.5 text-micro font-semibold uppercase tracking-wide text-v2-premium">
            <Icon id="i-spark" className="size-3" />
            {t('skins.premium')} · {look.edition}/{skinEditionTotal(activeCollection)}
          </span>
          <button type="button" onClick={onOpenInventory} className="text-caption font-semibold text-v2-ink-2 underline decoration-v2-line-hi underline-offset-4">
            {t('skins.openInventory', { count: collection.ownedSkinIds.length })}
          </button>
        </header>

        <div role="tablist" aria-label={t('skins.collections')} className="mt-3 grid grid-cols-2 gap-2">
          {SKIN_COLLECTION_IDS.map((id) => {
            const category = SKIN_COLLECTIONS[id];
            const active = activeCollection === id;
            const count = category.ids.filter((skinId) => owned.has(skinId)).length;
            return (
              <button
                key={id}
                id={`skin-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="skin-collection-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => { selectCollection(id); }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  const next = id === 'elemental' ? 'country' : 'elemental';
                  selectCollection(next);
                  document.getElementById(`skin-tab-${next}`)?.focus();
                }}
                className={`relative min-h-16 overflow-hidden rounded-control border px-3 py-2 text-left transition-colors ${active
                  ? 'border-v2-premium/70 bg-v2-premium/15 text-v2-ink'
                  : 'border-v2-line bg-v2-panel/90 text-v2-ink-2 hover:border-v2-line-hi'}`}
              >
                {active && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-v2-premium" />}
                <span className="block text-caption font-semibold leading-tight">{t(category.nameKey)}</span>
                <span className="mt-1 block font-v2-mono text-micro text-v2-ink-3">{count}/{category.ids.length} {t('skins.collected')}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-0.5 text-micro leading-snug text-v2-ink-3">{t(SKIN_COLLECTIONS[activeCollection].descriptionKey)}</p>

        <div id="skin-collection-panel" role="tabpanel" aria-labelledby={`skin-tab-${activeCollection}`}>

        {/* THE STAGE: the look turning in its own light, an orbit round it, embers rising. */}
        <section aria-label={t('skins.inspect')} className="relative">
          <div aria-hidden className="v2-store-aura pointer-events-none absolute inset-x-[12%] top-[8%] h-[80%] rounded-full" />
          <div aria-hidden className="v2-store-orbit pointer-events-none absolute left-1/2 top-1/2 h-[34%] w-[88%] -translate-x-1/2 -translate-y-1/2" />
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {EMBERS.map(([x, delay, dur]) => (
              <span key={x} className="v2-store-ember" style={{ '--x': x, '--delay': delay, '--dur': dur } as CSSProperties} />
            ))}
          </div>
          <SkinPreview skinId={selected} status={status} className="h-[15rem] md:h-[21rem]" />
          <p className="pointer-events-none absolute bottom-1 right-0 flex items-center gap-1 text-micro text-v2-ink-3">
            <Icon id="i-rotate" className="size-3" />
            {t('skins.dragHint')}
          </p>
        </section>

        <div className="relative -mt-1">
          <h3 className="text-figure font-semibold tracking-wide" style={{ color: look.accent }}>{name}</h3>
          <p className="mt-1 text-caption leading-snug text-v2-ink-2">{t(look.storyKey)}</p>
          <div role="group" aria-label={t('skins.inspect')} className="mt-2 inline-flex rounded-control border border-v2-line bg-v2-deep/70 p-0.5">
            {(['NORMAL', 'RECOVERY_SHIELD'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => { setStatus(value); }}
                className={`rounded-cell px-2.5 py-1 text-micro font-semibold ${status === value ? 'bg-v2-raise text-v2-ink' : 'text-v2-ink-3'}`}
              >
                {t(value === 'NORMAL' ? 'skins.normal' : 'skins.recovery')}
              </button>
            ))}
          </div>
        </div>

        {/* THE ONE PRESS THAT BUYS IT, with its price; a look already owned goes to be worn. */}
        <div className="mt-3 flex items-center gap-3 rounded-control border border-v2-premium/35 bg-v2-panel/95 p-2.5">
          <div className="min-w-0">
            <p className="font-v2-mono text-figure font-semibold text-v2-premium">
              {mine ? t('skins.owned') : money(selected, SKIN_PRICE)}
            </p>
            <p className="text-micro text-v2-ink-3">{t(mine ? 'skins.ownedNote' : 'skins.oneTime')}</p>
          </div>
          {mine ? (
            <button type="button" onClick={onOpenInventory} className="flex h-11 flex-1 items-center justify-center rounded-control border border-v2-self/60 bg-v2-self/15 px-3 text-caption font-bold text-v2-ink">
              {t('skins.wearIt')}
            </button>
          ) : buyReady ? (
            <button type="button" onClick={buy} disabled={pending} className={`${buyClass} disabled:opacity-60`}>
              {t('skins.buy', { price: money(selected, SKIN_PRICE) })}
            </button>
          ) : shopier ? (
            <ShopierPress href={shopier} price={lira(SKIN_PRICE.TRY)} className={buyClass} />
          ) : (
            <button type="button" disabled className="flex h-11 flex-1 items-center justify-center rounded-control border border-v2-line-hi px-3 text-caption font-semibold text-v2-ink-2">
              {t('skins.onSaleSoon')}
            </button>
          )}
        </div>
        {/* Shopier is a separate manual route, with the name to write in its order. */}
        {shopier && (
          <section aria-label={t('skins.shopierAlternative')} className="mt-2 grid gap-1.5 rounded-control border border-v2-line bg-v2-deep/60 p-2.5">
            {buyReady && <h4 className="text-caption font-semibold text-v2-ink-2">{t('skins.shopierAlternative')}</h4>}
            {buyReady && <ShopierPress href={shopier} price={lira(SKIN_PRICE.TRY)} className={SHOPIER_SECOND} />}
            <ShopierNote commander={commander} />
          </section>
        )}

        {/* The collection is visible together so players can compare looks and ownership. */}
        <section aria-label={t('skins.collection')} className="mt-5">
          <p className="mb-2 text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('skins.collection')}</p>
          <div className={`grid grid-cols-2 gap-2 ${activeCollection === 'country' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            {collectionIds.map((id) => {
              const item = PLANET_SKIN_CATALOG[id];
              const chosen = selected === id;
              const itemName = t(item.nameKey);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={chosen}
                  aria-label={`${itemName} · ${owned.has(id) ? t('skins.owned') : money(id, SKIN_PRICE)}`}
                  onClick={() => { setSelected(id); }}
                  className={`group relative overflow-hidden rounded-control border bg-v2-panel text-left transition-transform duration-300 active:scale-[0.98] ${
                    chosen ? 'v2-store-chosen border-transparent' : 'border-v2-line'
                  }`}
                  style={{ '--card': item.accent } as CSSProperties}
                >
                  <span className="relative block aspect-[1.25] overflow-hidden bg-v2-deep">
                    <img src={item.image} alt={itemName} loading="lazy" decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-v2-void/70 to-transparent" />
                    <span className="absolute left-1.5 top-1.5 font-v2-mono text-micro text-v2-ink/80">{item.edition}</span>
                    {owned.has(id) && (
                      <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-v2-self/90 px-1.5 text-micro font-semibold text-v2-void">
                        <Icon id="i-check" className="size-2.5" />
                        {t('skins.owned')}
                      </span>
                    )}
                  </span>
                  <span className="flex items-baseline justify-between gap-1 px-2 py-1.5">
                    <span className="truncate text-caption font-semibold" style={{ color: item.accent }}>{itemName}</span>
                    <span className="shrink-0 font-v2-mono text-micro text-v2-premium">
                      {owned.has(id) ? '' : money(id, SKIN_PRICE)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* THE FOUR TOGETHER, set against the four apart — only to a player who owns none. */}
        {offerSet && (
          <section aria-label={t('skins.bundleTitle')} className="relative mt-4 overflow-hidden rounded-control border border-v2-premium/50 bg-gradient-to-br from-v2-premium/15 via-v2-panel to-v2-panel p-3">
            <span className="absolute right-2 top-2 rounded-full bg-v2-premium px-2 py-0.5 text-micro font-bold text-v2-void">
              {t('skins.bundleSave', { pct: bundleSaving(currency) })}
            </span>
            <div className="flex items-center gap-3">
              <span aria-hidden className="relative h-14 w-24 shrink-0">
                {SKIN_COLLECTIONS.elemental.ids.map((id, index) => (
                  <img
                    key={id}
                    src={PLANET_SKIN_CATALOG[id].image}
                    alt=""
                    className="absolute top-0 size-14 rounded-control border border-v2-line object-cover shadow-lg"
                    style={{ left: index * 13, transform: `rotate(${String((index - 1.5) * 7)}deg)`, zIndex: index }}
                  />
                ))}
              </span>
              <div className="min-w-0">
                <p className="text-micro font-semibold uppercase tracking-wide text-v2-premium">{t('skins.bundleKicker')}</p>
                <p className="text-caption font-semibold text-v2-ink">{t('skins.bundleTitle')}</p>
                <p className="mt-0.5 flex items-baseline gap-2 font-v2-mono">
                  <s className="text-micro text-v2-ink-3" aria-label={t('skins.bundleWas', { price: priceText(SKIN_PRICE[currency] * 4, currency, locale) })}>
                    {priceText(SKIN_PRICE[currency] * 4, currency, locale)}
                  </s>
                  <span className="text-body font-semibold text-v2-premium">{money('bundle', BUNDLE_PRICE)}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-1.5">
              {bundleReady ? (
                <button type="button" onClick={bundleBuy} disabled={pending} className={`${buyClass} w-full disabled:opacity-60`}>
                  {t('skins.bundleBuy', { price: money('bundle', BUNDLE_PRICE) })}
                </button>
              ) : bundleShopier === null ? (
                <button type="button" disabled className="flex h-11 w-full items-center justify-center rounded-control border border-v2-line-hi text-caption font-semibold text-v2-ink-2">
                  {t('skins.onSaleSoon')}
                </button>
              ) : null}
              {bundleShopier !== null && (
                <section aria-label={t('skins.shopierAlternative')} className="mt-1 grid gap-1.5 rounded-control border border-v2-line bg-v2-deep/60 p-2.5">
                  {bundleReady && <h4 className="text-caption font-semibold text-v2-ink-2">{t('skins.shopierAlternative')}</h4>}
                  <ShopierPress href={bundleShopier} price={lira(BUNDLE_PRICE.TRY)}
                    className={bundleReady ? SHOPIER_SECOND : `${buyClass} w-full`} />
                  <ShopierNote commander={commander} />
                </section>
              )}
            </div>
          </section>
        )}
        </div>

        {/* WHAT A LOOK GIVES — each line true of the game. */}
        <ul className="mt-4 grid gap-2">
          {([
            ['i-intel', 'skins.valueSeen'],
            ['i-infinity', 'skins.valueYours'],
            ['i-shield', 'skins.valueLooks'],
          ] as const).map(([icon, key]) => (
            <li key={key} className="flex items-start gap-2 text-caption leading-snug text-v2-ink-2">
              <Icon id={icon} className="mt-0.5 size-3.5 shrink-0 text-v2-premium" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 flex items-start gap-2 rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2 text-micro leading-snug text-v2-ink-3">
          <Icon id="i-lock" className="mt-0.5 size-3 shrink-0" />
          <span>{t(canPay ? 'skins.trust' : 'skins.trustSoon', { commander })}</span>
        </p>
        {purchaseError && <p role="alert" className="mt-2 rounded-control border border-v2-hostile/50 bg-v2-hostile/10 px-3 py-2 text-caption text-v2-ink">
          {t('skins.checkoutError')}
        </p>}
      </div>
    </div>
  );
}

/** A quiet alternative to the primary Polar payment. */
const SHOPIER_SECOND = 'flex h-10 w-full items-center justify-center gap-1.5 rounded-control border border-v2-line-hi px-3 text-caption font-semibold text-v2-ink-2 transition-colors hover:bg-v2-raise hover:text-v2-ink';

/** A Shopier product page, in a new tab: it is somewhere else, and the store stays open here. */
function ShopierPress({ href, price, className }: { href: string; price: string; className: string }) {
  const { t } = useTranslation();
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
      {t('skins.shopierBuy', { price })}
    </a>
  );
}

/**
 * WHAT SHOPIER CANNOT KNOW. Its page has no idea which commander is buying, so the look is
 * granted by hand from the order — and the order is only matched if the note names the
 * commander. Said where the press is, because a buyer reads nothing after it.
 */
function ShopierNote({ commander }: { commander: string }) {
  const { t } = useTranslation();
  return (
    <p className="flex items-start gap-1.5 text-micro leading-snug text-v2-ink-2">
      <Icon id="i-warn" className="mt-0.5 size-3 shrink-0 text-v2-warn" />
      <span>{t('skins.shopierNote', { commander })}</span>
    </p>
  );
}

export default function SkinsScreen({ commander, onOpenInventory }: { commander: string; onOpenInventory: () => void }) {
  const { t } = useTranslation();
  const collection = useSkins();
  const shop = usePolarShop();
  const pricing = usePolarPricing();
  const purchase = usePurchasePolarSkin();
  const [checkoutFailed, setCheckoutFailed] = useState(false);
  const onPurchase = async (itemId: ItemId): Promise<void> => {
    if (!shop.data?.enabled) return;
    setCheckoutFailed(false);
    try {
      const created = await purchase.mutateAsync(itemId);
      navigateToPolarCheckout(created.url);
    } catch { setCheckoutFailed(true); }
  };
  if (collection.isPending) return <p className="p-4 text-body text-dim">{t('skins.collection')}…</p>;
  if (!collection.data) return <p className="p-4 text-body text-dim">{t('skins.loadError')}</p>;
  return <SkinShopContent collection={collection.data} commander={commander} onOpenInventory={onOpenInventory}
    prices={pricing.data?.prices} countryCode={pricing.data?.countryCode ?? 'ZZ'}
    enabled={Boolean(shop.data?.enabled)} pending={purchase.isPending}
    purchaseError={checkoutFailed} onPurchase={onPurchase} />;
}
