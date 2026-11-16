import { CosmeticCategories, CosmeticCollection } from './CosmeticCollection.jsx';
import { cosmeticById, type CosmeticCategory, type CosmeticId } from '@astera/rules';
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { type PlanetSkinId, type PlanetSkinStatus } from '@astera/rules';
import type { z } from 'zod';
import type { polarPricingSchema, skinCollectionSchema } from '../api/schemas.js';
import { usePolarPricing, usePolarShop, usePurchasePolarSkin, useOpenShopierCheckout, useShopierShop, useSkins } from '../api/queries.js';
import {
  BUNDLE_PRICE,
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
import { Banner, Choices, GameButton, GameTabs, Glyph, SectionTag } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Waiting } from '../ui/kit/index.js';
import { navigateToPolarCheckout } from '../lib/polarCheckout.js';
import { SkinPreview } from './SkinPreview.jsx';
import { CosmeticNavigation } from './CosmeticNavigation.js';
import { ApiError } from '../api/client.js';
import { describeError } from '../i18n/errors.js';
import { ShopierPayButton, ShopierProgress, shopierPrice, useShopierCheckout, type ShopierOffer } from './ShopierCheckout.js';
import { capabilities } from '../platform/runtime.js';
import SkinInventoryScreen from './SkinInventoryScreen.js';

type Collection = z.infer<typeof skinCollectionSchema>;
type Pricing = z.infer<typeof polarPricingSchema>;
type ItemId = CosmeticId | 'bundle';
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
 * Polar creates a hosted checkout through the authenticated server route. In Turkey, an item
 * with a Shopier product is paid there first (owner 2026-10-16: Polar's fixed fee takes half of
 * a ₺49–99 sale) and Polar stays below it as the second way.
 */
export function SkinShopContent(props: Parameters<typeof PlanetShopContent>[0]) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CosmeticCategory>(props.initialId ? cosmeticById(props.initialId)?.category ?? 'PLANET' : 'PLANET');
  const owned = props.collection.ownedCosmeticIds ?? props.collection.ownedSkinIds;
  const pricingReady = !props.pricingState || props.pricingState === 'ready';
  const unavailable = props.enabled && !pricingReady
    ? t(props.pricingState === 'loading' ? 'skins.priceLoading' : 'skins.priceUnavailable')
    : t('skins.onSaleSoon');
  const checkout = useShopierCheckout(props.shopier);
  const purchase = (id: CosmeticId) => {
    const lira = props.countryCode === 'TR' ? props.shopier?.prices[id] : undefined;
    const quote = props.prices?.[id];
    const polar = props.enabled && pricingReady && props.onPurchase && quote ? <GameButton tone={lira === undefined ? 'action' : 'ghost'} wide heavy={lira === undefined}
      pending={props.pending} disabledReason={props.pending ? t('skins.checkoutStarting') : null} onPress={() => { void props.onPurchase?.(id); }}>
      {t('skins.buy', { price: quote.formatted })}
    </GameButton> : null;
    if (lira === undefined) return polar ?? <GameButton wide disabledReason={unavailable} onPress={() => undefined}>{unavailable}</GameButton>;
    return <div className="grid gap-2">
      <ShopierPayButton amount={lira} state={checkout.of(id)} onPress={() => { void checkout.start(id); }} wide />
      <ShopierProgress state={checkout.of(id)} />
      {polar}
    </div>;
  };
  const pricingFailed = props.pricingState === 'error';
  return <div className="gk gk-shopfront">
    <CosmeticNavigation active="shop" onShop={() => undefined} onInventory={props.onOpenInventory} />
    <CosmeticCategories active={category} onChange={setCategory} owned={owned} inventory={false} />
    {props.enabled && !pricingReady && <div className="gk-shopfront__status">
      <Banner tone={pricingFailed ? 'warn' : 'info'} role={pricingFailed ? 'alert' : 'status'}
        title={t(pricingFailed ? 'skins.pricingError' : 'skins.priceLoading')}
        action={pricingFailed && props.onRetryPricing ? <GameButton size="sm" glyph="refresh" onPress={props.onRetryPricing}>{t('skins.retryPrices')}</GameButton> : undefined} />
    </div>}
    {category === 'PLANET' ? <PlanetShopContent {...props} /> : <CosmeticCollection key={category}
      category={category} inventory={false} owned={owned} onTry={props.onTry} initialId={props.initialId} equipment={props.collection.equipment ?? {}} onOpenOther={props.onOpenInventory}
      prices={props.prices} purchaseError={props.purchaseError} purchase={purchase} />}
  </div>;
}

function PlanetShopContent({
  collection,
  commander,
  onOpenInventory,
  onTry,
  initialId,
  prices = {},
  countryCode,
  enabled = false,
  pending = false,
  purchaseError,
  pricingState = 'ready',
  onPurchase = () => undefined,
  shopier,
}: {
  collection: Collection;
  commander: string;
  onOpenInventory: () => void;
  onTry?: (id: CosmeticId) => void;
  initialId?: CosmeticId;
  prices?: PriceMap;
  countryCode?: string;
  /** Polar checkout is enabled. */
  enabled?: boolean;
  /** A checkout is being created: its press waits rather than vanishing. */
  pending?: boolean;
  purchaseError?: { itemId: ItemId; message: string };
  pricingState?: 'loading' | 'error' | 'ready';
  onRetryPricing?: () => void;
  onPurchase?: (itemId: ItemId) => void | Promise<void>;
  /** Shopier is open: its lira prices and the commander's own page. Offered only in Turkey. */
  shopier?: ShopierOffer;
}) {
  const { t } = useTranslation();
  const owned = new Set(collection.ownedSkinIds);
  const initialPlanet = initialId ? SKIN_COLLECTION_IDS.flatMap(id => SKIN_COLLECTIONS[id].ids).find(id => id === initialId) : undefined;
  const [activeCollection, setActiveCollection] = useState<SkinCollectionId>(initialPlanet && SKIN_COLLECTIONS.country.ids.some(id => id === initialPlanet) ? 'country' : 'elemental');
  const collectionIds = SKIN_COLLECTIONS[activeCollection].ids;
  // It opens on something to buy, where there is anything left to buy.
  const [selected, setSelected] = useState<PlanetSkinId>(
    () => initialPlanet ?? SKIN_COLLECTIONS.elemental.ids.find((id) => !owned.has(id)) ?? SKIN_COLLECTIONS.elemental.ids[0],
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
  const checkout = useShopierCheckout(shopier);
  const shopierAmount = (itemId: ItemId): number | undefined =>
    countryCode === 'TR' && !EUR_ONLY_COUNTRY_SKINS.has(itemId) ? shopier?.prices[itemId] : undefined;
  const money = (itemId: ItemId, amounts: Readonly<Record<Currency, number>>): string => {
    const quote = quoteFor(itemId);
    const lira = shopierAmount(itemId);
    if (!quote && lira !== undefined) return shopierPrice(lira, locale);
    if (enabled && pricingState !== 'ready' && !quote) return '—';
    const fallbackCurrency = EUR_ONLY_COUNTRY_SKINS.has(itemId) ? 'EUR' : currency;
    return quote?.formatted ?? priceText(amounts[fallbackCurrency], fallbackCurrency, locale);
  };
  const look = PLANET_SKIN_CATALOG[selected];
  const name = t(look.nameKey);
  const mine = owned.has(selected);
  const buyReady = enabled && pricingState === 'ready' && Boolean(quoteFor(selected)) && Boolean(onPurchase);
  const bundleReady = enabled && pricingState === 'ready' && Boolean(prices.bundle) && Boolean(onPurchase);
  const unavailable = enabled && pricingState !== 'ready'
    ? t(pricingState === 'loading' ? 'skins.priceLoading' : 'skins.priceUnavailable')
    : t('skins.onSaleSoon');
  const offerSet = activeCollection === 'elemental' && SKIN_COLLECTIONS.elemental.ids.every((id) => !owned.has(id));
  const lira = mine ? undefined : shopierAmount(selected);
  const bundleLira = shopierAmount('bundle');
  const canPay = buyReady || bundleReady || lira !== undefined || (offerSet && bundleLira !== undefined);

  const stageStyle = { '--look': look.accent, '--look-glow': look.glow } as CSSProperties;
  const owning = collectionIds.filter((id) => owned.has(id)).length;
  const polarPress = (itemId: ItemId, label: string, tone: 'action' | 'ghost') => (
    <GameButton tone={tone} wide heavy={tone === 'action'} pending={pending} disabledReason={pending ? t('skins.checkoutStarting') : null}
      onPress={() => { void onPurchase(itemId); }}>
      {label}
    </GameButton>
  );
  const closed = <GameButton wide disabledReason={unavailable} onPress={() => undefined}>{unavailable}</GameButton>;

  return (
    <div className="gk-shop" style={stageStyle}>
      {/* The living backdrop: a drifting nebula lit by the chosen look, stars twinkling over it. */}
      <div aria-hidden className="v2-store-nebula gk-shop__sky" />
      <div aria-hidden className="gk-shop__sky gk-shop__fade" />
      <div aria-hidden className="gk-shop__stars">
        {STARS.map(([x, y, size, dur, delay], index) => (
          <span
            key={index}
            className="v2-store-star"
            style={{ left: `${String(x)}%`, top: `${String(y)}%`, width: size, height: size, '--dur': dur, '--delay': delay } as CSSProperties}
          />
        ))}
      </div>

      <div className="gk-shop__body">
        <GameTabs
          label={t('skins.collections')}
          tabs={SKIN_COLLECTION_IDS.map((id) => ({ id, label: t(SKIN_COLLECTIONS[id].nameKey) }))}
          value={activeCollection}
          onChange={selectCollection}
          ids={{ tab: (id) => `skin-tab-${id}`, panel: () => 'skin-collection-panel' }}
        />
        <p className="gk-note">{t(SKIN_COLLECTIONS[activeCollection].descriptionKey)}</p>

        <div id="skin-collection-panel" role="tabpanel" aria-labelledby={`skin-tab-${activeCollection}`} className="gk-shop__panel">

        {/* THE STAGE: the look turning in its own light, an orbit round it, embers rising. */}
        <section aria-label={t('skins.inspect')} className="gk-shop__stage">
          <div aria-hidden className="v2-store-aura gk-shop__aura" />
          <div aria-hidden className="v2-store-orbit gk-shop__orbit" />
          <div aria-hidden className="gk-shop__embers">
            {EMBERS.map(([x, delay, dur]) => (
              <span key={x} className="v2-store-ember" style={{ '--x': x, '--delay': delay, '--dur': dur } as CSSProperties} />
            ))}
          </div>
          <SkinPreview skinId={selected} status={status} className="h-[15rem] md:h-[21rem]" />
          <p className="gk-note gk-shop__drag"><Glyph id="refresh" />{t('skins.dragHint')}</p>
        </section>

        <div className="gk-shop__name">
          <span className="gk-label gk-shop__edition"><Glyph id="star" />{t('skins.premium')} · <span className="gk-num">{look.edition}/{skinEditionTotal(activeCollection)}</span></span>
          <h3 className="gk-display gk-outlined gk-shop__title" style={{ color: look.accent }}>{name}</h3>
          <p className="gk-copy">{t(look.storyKey)}</p>
          <Choices
            label={t('skins.inspect')}
            options={[{ id: 'NORMAL', label: t('skins.normal') }, { id: 'RECOVERY_SHIELD', label: t('skins.recovery') }]}
            value={status}
            onChange={setStatus}
          />
        </div>

        {onTry && <GameButton wide glyph="eye" onPress={() => { onTry(selected); }}>{t('skins.tryOnWorld')}</GameButton>}
        {/* THE ONE PRESS THAT BUYS IT, under its price; a look already owned goes to be worn. */}
        <section aria-label={t('skins.priceTitle')} className="gk-cut gk-shop__price">
          <div className="gk-shop__pricehead">
            <span className="gk-display gk-num gk-shop__amount">{mine ? t('skins.owned') : money(selected, SKIN_PRICE)}</span>
            <span className="gk-note">{t(mine ? 'skins.ownedNote' : 'skins.oneTime')}</span>
          </div>
          {mine ? (
            <GameButton tone="self" wide glyph="check" onPress={onOpenInventory}>{t('skins.wearIt')}</GameButton>
          ) : lira !== undefined ? (
            <ShopierPayButton amount={lira} state={checkout.of(selected)} onPress={() => { void checkout.start(selected); }} wide />
          ) : buyReady ? polarPress(selected, t('skins.buy', { price: money(selected, SKIN_PRICE) }), 'action') : closed}
          {purchaseError?.itemId === selected && <Banner tone="warn" role="alert" title={purchaseError.message} />}
          {/* After the Shopier press: the commander's own page. Polar stays below as the second way. */}
          {lira !== undefined && <ShopierProgress state={checkout.of(selected)} />}
          {lira !== undefined && buyReady && polarPress(selected, t('skins.buy', { price: money(selected, SKIN_PRICE) }), 'ghost')}
        </section>

        {/* The collection is visible together so players can compare looks and ownership. */}
        <section aria-label={t('skins.collection')} className="gk-shop__collection">
          <SectionTag aside={<span className="gk-num">{owning}/{collectionIds.length} {t('skins.collected')}</span>}>{t('skins.collection')}</SectionTag>
          <div className="gk-shop__cards" data-many={activeCollection === 'country' ? '' : undefined}>
            {collectionIds.map((id) => (
              <SkinCard key={id} id={id} chosen={selected === id} owned={owned.has(id)}
                price={owned.has(id) ? '' : money(id, SKIN_PRICE)} onPick={() => { setSelected(id); }} />
            ))}
          </div>
        </section>

        {/* THE FOUR TOGETHER, set against the four apart — only to a player who owns none. */}
        {offerSet && (
          <section aria-label={t('skins.bundleTitle')} className="gk-cut gk-shop__bundle">
            <div className="gk-shop__bundlehead">
              <span aria-hidden className="gk-shop__fan">
                {SKIN_COLLECTIONS.elemental.ids.map((id, index) => (
                  <img
                    key={id}
                    src={PLANET_SKIN_CATALOG[id].image}
                    alt=""
                    style={{ left: index * 13, transform: `rotate(${String((index - 1.5) * 7)}deg)`, zIndex: index }}
                  />
                ))}
              </span>
              <div className="min-w-0">
                <p className="gk-label gk-shop__kicker">{t('skins.bundleKicker')}</p>
                <p className="gk-shop__bundletitle">{t('skins.bundleTitle')}</p>
                <p className="gk-shop__bundleprice">
                  <s className="gk-num" aria-label={t('skins.bundleWas', { price: priceText(SKIN_PRICE[currency] * 4, currency, locale) })}>
                    {priceText(SKIN_PRICE[currency] * 4, currency, locale)}
                  </s>
                  <span className="gk-display gk-num">{money('bundle', BUNDLE_PRICE)}</span>
                  <span className="gk-shop__save gk-num">{t('skins.bundleSave', { pct: bundleSaving(currency) })}</span>
                </p>
              </div>
            </div>
            {bundleLira !== undefined ? <>
              <ShopierPayButton amount={bundleLira} state={checkout.of('bundle')} onPress={() => { void checkout.start('bundle'); }} wide />
              <ShopierProgress state={checkout.of('bundle')} />
              {bundleReady && polarPress('bundle', t('skins.bundleBuy', { price: money('bundle', BUNDLE_PRICE) }), 'ghost')}
            </> : bundleReady ? polarPress('bundle', t('skins.bundleBuy', { price: money('bundle', BUNDLE_PRICE) }), 'action') : closed}
            {purchaseError?.itemId === 'bundle' && <Banner tone="warn" role="alert" title={purchaseError.message} />}
          </section>
        )}
        </div>

        {/* WHAT A LOOK GIVES — each line true of the game. */}
        <ul className="gk-shop__values">
          {([
            ['eye', 'skins.valueSeen'],
            ['star', 'skins.valueYours'],
            ['shield', 'skins.valueLooks'],
          ] as const).map(([glyph, key]) => (
            <li key={key}><Glyph id={glyph} /><span>{t(key)}</span></li>
          ))}
        </ul>

        {(canPay || !enabled || pricingState === 'ready') && <p className="gk-well gk-shop__trust">
          <Glyph id="lock" />
          <span>{t(canPay ? 'skins.trust' : 'skins.trustSoon', { commander })}</span>
        </p>}
      </div>
    </div>
  );
}

/**
 * ONE LOOK ON THE SHELF: its picture, its number in the collection, its name in its own colour
 * and what it costs, or a tick if it is yours. The chosen one glows in its colour; a press
 * answers at once with a tap and sinks, and the stage above turns to it.
 */
function SkinCard({ id, chosen, owned, price, onPick }: { id: PlanetSkinId; chosen: boolean; owned: boolean; price: string; onPick: () => void }) {
  const { t } = useTranslation();
  const item = PLANET_SKIN_CATALOG[id];
  const itemName = t(item.nameKey);
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPick(); });
  return (
    <button
      type="button"
      {...OWN_SOUND}
      aria-pressed={chosen}
      aria-label={`${itemName} · ${owned ? t('skins.owned') : price}`}
      className="gk-shop__card"
      style={{ '--card': item.accent } as CSSProperties}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="gk-shop__art">
        <img src={item.image} alt={itemName} loading="lazy" decoding="async" />
        <span className="gk-num gk-shop__ed">{item.edition}</span>
        {owned && <span className="gk-shop__owned"><Glyph id="check" />{t('skins.owned')}</span>}
      </span>
      <span className="gk-shop__cardfoot">
        <span className="gk-shop__cardname" style={{ color: item.accent }}>{itemName}</span>
        {price !== '' && <span className="gk-num gk-shop__cardprice">{price}</span>}
      </span>
    </button>
  );
}

export default function SkinsScreen({ commander, onOpenInventory, onTry, initialId }: { commander: string; onOpenInventory: () => void; onTry?: (id: CosmeticId) => void; initialId?: CosmeticId }) {
  // Do not mount web pricing/checkout hooks in an app, including a stale shop route.
  return capabilities().webCheckout
    ? <WebSkinsScreen commander={commander} onOpenInventory={onOpenInventory} onTry={onTry} initialId={initialId} />
    : <SkinInventoryScreen onOpenShop={onOpenInventory} />;
}

function WebSkinsScreen({ commander, onOpenInventory, onTry, initialId }: { commander: string; onOpenInventory: () => void; onTry?: (id: CosmeticId) => void; initialId?: CosmeticId }) {
  const { t } = useTranslation();
  const collection = useSkins();
  const shop = usePolarShop();
  const pricing = usePolarPricing();
  const purchase = usePurchasePolarSkin();
  const shopierShop = useShopierShop();
  const shopierCheckout = useOpenShopierCheckout();
  const [checkoutFailure, setCheckoutFailure] = useState<{ itemId: ItemId; reason: unknown } | null>(null);
  const onPurchase = async (itemId: ItemId): Promise<void> => {
    if (!shop.data?.enabled) return;
    setCheckoutFailure(null);
    try {
      const created = await purchase.mutateAsync(itemId);
      navigateToPolarCheckout(created.url);
    } catch (reason) { setCheckoutFailure({ itemId, reason }); }
  };
  if (collection.isPending) return <Waiting>{t('skins.collection')}</Waiting>;
  if (!collection.data) return <div className="gk gk-shopfront__status"><Banner tone="warn" role="alert" title={t('skins.loadError')} /></div>;
  return <SkinShopContent collection={collection.data} commander={commander} onOpenInventory={onOpenInventory} onTry={onTry} initialId={initialId}
    prices={pricing.data?.prices} countryCode={pricing.data?.countryCode ?? 'ZZ'}
    enabled={Boolean(shop.data?.enabled)} pending={purchase.isPending}
    purchaseError={checkoutFailure ? { itemId: checkoutFailure.itemId,
      message: checkoutFailure.reason instanceof ApiError ? describeError(checkoutFailure.reason) : t('skins.checkoutError') } : undefined}
    pricingState={pricing.isPending || (pricing.isFetching && !pricing.data) ? 'loading' : pricing.isError ? 'error' : 'ready'}
    onRetryPricing={() => { void pricing.refetch(); }} onPurchase={onPurchase}
    shopier={shopierShop.data?.enabled ? { prices: shopierShop.data.prices, requestCheckout: itemId => shopierCheckout.mutateAsync(itemId) } : undefined} />;
}
