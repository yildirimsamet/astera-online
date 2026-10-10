import { useTranslation } from 'react-i18next';
import { Icon } from '../v2/icons.js';
import { ShopShowcasePoster } from './ShopShowcasePoster.js';

/** A still cosmetic illustration keeps the menu independent of model loading and WebGL. */
export function ShopShowcase({ onShop, onInventory }: {
  onShop: () => void;
  onInventory: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section data-shop-showcase aria-label={t('skins.collection')} className="shop-showcase overflow-hidden rounded-control border border-v2-premium/35 bg-v2-deep">
      <button
        type="button"
        onClick={onShop}
        aria-label={`${t('menu.skinsShopLabel')}. ${t('menu.skinsShopHint')}`}
        className="shop-showcase-hero group relative isolate block w-full overflow-hidden px-3 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-v2-premium v2-split:px-4 v2-split:py-4"
      >
        <div aria-hidden="true" className="shop-showcase-light pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="shop-showcase-art pointer-events-none absolute" data-showcase-art>
          <ShopShowcasePoster />
        </div>
        <div className="shop-showcase-copy relative z-10">
          <span className="inline-flex items-center gap-1.5 text-micro font-semibold uppercase tracking-label text-v2-premium">
            <Icon id="i-spark" className="size-3" />{t('skins.premium')}
          </span>
          <h2 className="mt-1.5 font-v2-ui text-readout font-semibold leading-none tracking-tight text-v2-ink v2-split:mt-2">{t('menu.skinsShopLabel')}</h2>
          <p className="mt-1.5 max-w-40 text-caption leading-snug text-v2-ink-2 v2-split:mt-2">{t('skins.showcaseDescription')}</p>
          <span className="mt-2.5 inline-flex min-h-8 items-center gap-2 rounded-control border border-v2-premium/40 bg-v2-premium/10 px-2.5 text-caption font-semibold text-v2-premium transition-colors group-hover:bg-v2-premium/20 v2-split:mt-4 v2-split:min-h-9">
            {t('skins.openShop')}<Icon id="i-chev" className="size-3.5 shrink-0" />
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={onInventory}
        aria-label={`${t('menu.skinsInventoryLabel')}. ${t('menu.skinsInventoryHint')}`}
        className="group flex min-h-12 w-full items-center gap-2.5 border-t border-v2-premium/20 bg-v2-panel/70 px-3 py-2 text-left transition-colors hover:bg-v2-raise focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-v2-premium v2-split:min-h-14 v2-split:px-4 v2-split:py-2.5"
      >
        <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-control border border-v2-line-hi bg-v2-deep text-v2-ink-2 v2-split:size-8"><Icon id="i-base" className="size-4" /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-caption font-semibold text-v2-ink">{t('menu.skinsInventoryLabel')}</span>
          <span className="text-micro text-v2-ink-3">{t('menu.skinsInventoryHint')}</span>
        </span>
        <Icon id="i-chev" className="size-4 shrink-0 text-v2-ink-3 transition-transform group-hover:translate-x-0.5" />
      </button>
    </section>
  );
}
