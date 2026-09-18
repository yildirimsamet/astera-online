import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PLANET_SKIN_IDS, type PlanetSkinId, type PlanetSkinStatus } from '@astera/rules';
import type { z } from 'zod';
import type { skinCollectionSchema } from '../api/schemas.js';
import { useSkins } from '../api/queries.js';
import { PLANET_SKIN_CATALOG, SKIN_EDITION_TOTAL } from '../ui/skinCatalog.js';
import { SkinPreview } from './SkinPreview.jsx';

type Collection = z.infer<typeof skinCollectionSchema>;

/** A storefront: inspect and compare the actual looks. Equipment lives in Inventory. */
export function SkinShopContent({
  collection,
  onOpenInventory,
}: {
  collection: Collection;
  onOpenInventory: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<PlanetSkinId>('planet-lava');
  const [status, setStatus] = useState<PlanetSkinStatus>('NORMAL');
  const owned = new Set(collection.ownedSkinIds);
  const look = PLANET_SKIN_CATALOG[selected];
  const name = t(look.nameKey);

  const toggle = (active: boolean) =>
    `min-h-11 rounded-chip border px-2 font-display text-label uppercase tracking-label transition-colors ${active ? 'border-crystal/70 bg-crystal/15 text-bone' : 'border-white/15 bg-white/[0.03] text-dim hover:text-bone'}`;

  /*
    ONE COLUMN ON A PHONE, A STAGE AND A SHELF ON A DESK.

    The Sheet is the full viewport wide, so this screen bounds itself. On a desk
    the live model is the product and gets the big stage; the cards are 326px
    screenshots and stay in a narrow shelf beside it, never stretched past the
    pixels they have.
  */
  return (
    <div className="min-h-full bg-[#080d17] pb-[calc(28px+env(safe-area-inset-bottom))] text-bone">
      <header className="relative overflow-hidden px-4 pb-5 pt-5 lg:pb-7 lg:pt-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/assets/images/skins/galaxy-nebula.webp')] bg-cover bg-center opacity-60" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#080d17]/15 via-[#080d17]/50 to-[#080d17]" />
        <div className="relative mx-auto w-full max-w-6xl lg:flex lg:items-end lg:justify-between lg:gap-8">
          <div>
            <p className="legend text-crystal">{t('skins.shopKicker')}</p>
            <h3 className="mt-3 max-w-[12ch] font-display text-hero uppercase text-bone lg:max-w-none">{t('skins.shopHeadline')}</h3>
            <p className="mt-3 max-w-[36ch] text-body leading-relaxed text-bone/80 lg:max-w-[52ch]">{t('skins.shopIntro')}</p>
          </div>
          <button type="button" onClick={onOpenInventory}
            className="mt-4 min-h-10 shrink-0 border-b border-crystal/60 font-display text-label uppercase tracking-label text-crystal transition-colors hover:text-bone">
            {t('skins.openInventory', { count: collection.ownedSkinIds.length })} <span aria-hidden>↗</span>
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:items-start lg:gap-8 lg:px-4">
        <section aria-label={t('skins.inspect')} className="lg:sticky lg:top-4">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="legend" style={{ color: look.accent }}>{t('skins.edition', { number: look.edition, total: SKIN_EDITION_TOTAL })}</p>
              <h4 className="mt-1 font-display text-title uppercase tracking-wide text-bone">{name}</h4>
            </div>
            <span className="text-right text-caption text-dim">{t('skins.dragHint')}</span>
          </div>
          <SkinPreview skinId={selected} status={status} className="h-72 md:h-96 lg:h-[min(34rem,60dvh)]" />
          <div className="lg:mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start lg:gap-4">
            <div role="group" aria-label={t('skins.inspect')} className="mt-3 grid grid-cols-2 gap-2 lg:mt-0">
              <button type="button" aria-pressed={status === 'NORMAL'} onClick={() => { setStatus('NORMAL'); }}
                className={toggle(status === 'NORMAL')}>
                {t('skins.normal')}
              </button>
              <button type="button" aria-pressed={status === 'RECOVERY_SHIELD'} onClick={() => { setStatus('RECOVERY_SHIELD'); }}
                className={toggle(status === 'RECOVERY_SHIELD')}>
                {t('skins.recovery')}
              </button>
            </div>
            <div>
              <p className="mt-3 px-1 text-label leading-relaxed text-bone/75 lg:mt-0">{t(look.storyKey)}</p>
              <p className="mt-2 px-1 text-micro leading-relaxed text-dim">{t('skins.includedLooks')}</p>
            </div>
          </div>
        </section>

        <div className="mt-7 lg:mt-0">
          <section aria-label={t('skins.collection')}>
            <div className="mb-3 flex items-end justify-between gap-2 px-1">
              <div>
                <p className="legend text-crystal">{t('skins.allLooksKicker')}</p>
                <h4 className="mt-1 font-display text-title uppercase tracking-wide text-bone">{t('skins.collection')}</h4>
              </div>
              <span className="text-caption text-dim">01—{SKIN_EDITION_TOTAL}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-2">
              {PLANET_SKIN_IDS.map((id) => {
                const item = PLANET_SKIN_CATALOG[id];
                const active = selected === id;
                return (
                  <button key={id} type="button" aria-pressed={active}
                    onClick={() => { setSelected(id); }}
                    className={`group overflow-hidden rounded-plate border text-left transition-colors ${active ? 'border-crystal/75 bg-crystal/[0.08]' : 'border-white/15 bg-[#101824] hover:border-white/35'}`}>
                    <span className="relative block aspect-[1.25] overflow-hidden bg-[#070d17]">
                      <img src={item.image} alt={t(item.nameKey)} loading="lazy" decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#080d17]/50 to-transparent" />
                      <span className="absolute left-2 top-2 font-display text-micro tracking-wide text-bone/85">{item.edition}</span>
                    </span>
                    <span className="flex min-h-15 flex-col justify-center gap-1 px-2 py-2">
                      <span className="font-display text-label uppercase tracking-label text-bone">{t(item.nameKey)}</span>
                      <span className="text-caption" style={{ color: owned.has(id) ? '#94dce7' : item.accent }}>
                        {owned.has(id) ? t('skins.owned') : t('skins.comingSoon')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="mt-6 border-l-2 border-crystal/65 bg-white/[0.04] px-3 py-3">
            <p className="font-display text-label uppercase tracking-label text-bone">{t('skins.salesComingTitle')}</p>
            <p className="mt-2 text-label leading-relaxed text-bone/70">{t('skins.comingSoonNote')}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function SkinsScreen({ onOpenInventory }: { onOpenInventory: () => void }) {
  const { t } = useTranslation();
  const collection = useSkins();
  if (collection.isPending) return <p className="p-4 text-body text-dim">{t('skins.collection')}…</p>;
  if (!collection.data) return <p className="p-4 text-body text-dim">{t('skins.loadError')}</p>;
  return <SkinShopContent collection={collection.data} onOpenInventory={onOpenInventory} />;
}
