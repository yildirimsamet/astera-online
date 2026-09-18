import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanetSkinId } from '@astera/rules';
import type { z } from 'zod';
import type { skinCollectionSchema } from '../api/schemas.js';
import { useEquipSkin, useSkins } from '../api/queries.js';
import { planetArt } from '../ui/assets.js';
import { Button } from '../ui/kit/index.js';
import { PLANET_SKIN_CATALOG } from '../ui/skinCatalog.js';
import { PLANET_SKIN_IDS } from '@astera/rules';

type Collection = z.infer<typeof skinCollectionSchema>;

/** The owned shelf and the worlds it can dress; no sales state is mixed in. */
export function SkinInventoryContent({
  collection,
  onEquip,
  pendingPlanetId,
  onOpenShop,
}: {
  collection: Collection;
  onEquip: (planetId: string, skinId: PlanetSkinId | null) => void;
  pendingPlanetId: string | null;
  onOpenShop: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<PlanetSkinId | null>(collection.ownedSkinIds[0] ?? null);
  useEffect(() => {
    if (selected !== null && collection.ownedSkinIds.includes(selected)) return;
    setSelected(collection.ownedSkinIds[0] ?? null);
  }, [collection.ownedSkinIds, selected]);
  const name = (id: PlanetSkinId) => t(PLANET_SKIN_CATALOG[id].nameKey);

  return (
    <div className="min-h-full bg-[#080d17] pb-[calc(28px+env(safe-area-inset-bottom))] text-bone">
      <header className="relative overflow-hidden px-4 pb-5 pt-5">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/assets/images/skins/galaxy-nebula.webp')] bg-cover bg-center opacity-40" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#080d17]/35 to-[#080d17]" />
        <div className="relative mx-auto w-full max-w-6xl lg:flex lg:items-end lg:justify-between lg:gap-8">
          <div>
            <p className="legend text-crystal">{t('skins.inventoryKicker')}</p>
            <h3 className="mt-2 font-display text-hero uppercase text-bone">{t('skins.inventoryHeadline')}</h3>
            <p className="mt-2 max-w-[36ch] text-body leading-relaxed text-bone/75 lg:max-w-[52ch]">{t('skins.intro')}</p>
          </div>
          <button type="button" onClick={onOpenShop}
            className="mt-3 min-h-10 shrink-0 border-b border-crystal/60 font-display text-label uppercase tracking-label text-crystal transition-colors hover:text-bone">
            {t('skins.openShop')} <span aria-hidden>↗</span>
          </button>
        </div>
      </header>

      {/*
        A SHELF AND THE WORLDS IT DRESSES. On a desk they sit side by side, so the
        pick and the apply are one glance apart; the 326px card art stays in a
        narrow column instead of being blown up across the screen.
      */}
      <div className="mx-auto w-full max-w-6xl px-3 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:px-4">
        <section role="region" aria-label={t('skins.ownedSkins')} className="lg:sticky lg:top-4">
          <div className="mb-3 flex items-end justify-between gap-2 px-1">
            <div>
              <p className="legend text-crystal">{t('skins.yourLooksKicker')}</p>
              <h4 className="mt-1 font-display text-title uppercase tracking-wide text-bone">{t('skins.ownedSkins')}</h4>
            </div>
            <span className="text-caption text-dim">{collection.ownedSkinIds.length}/{PLANET_SKIN_IDS.length}</span>
          </div>
          {collection.ownedSkinIds.length === 0 ? (
            <div className="rounded-plate border border-white/15 bg-white/[0.04] p-4">
              <p className="text-body text-bone/75">{t('skins.noOwnedSkins')}</p>
              <Button size="sm" variant="primary" onClick={onOpenShop} className="mt-3">{t('skins.openShop')}</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-2">
              {collection.ownedSkinIds.map((id) => {
                const look = PLANET_SKIN_CATALOG[id];
                return (
                  <button key={id} type="button" aria-pressed={selected === id}
                    onClick={() => { setSelected(id); }}
                    className={`group overflow-hidden rounded-plate border text-left transition-colors ${selected === id ? 'border-crystal/75 bg-crystal/[0.08]' : 'border-white/15 bg-[#101824] hover:border-white/35'}`}>
                    <span className="block aspect-[1.3] overflow-hidden bg-[#070d17]">
                      <img src={look.image} alt={name(id)} loading="lazy" decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </span>
                    <span className="flex min-h-10 items-center justify-between px-2 py-2">
                      <span className="font-display text-label uppercase tracking-label text-bone">{name(id)}</span>
                      {selected === id && <span aria-hidden className="text-crystal">✓</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {selected !== null && <p className="mt-3 px-1 text-label text-dim">{t('skins.selectedForWorlds', { name: name(selected) })}</p>}
        </section>

        <section aria-label={t('skins.worlds')} className="mt-7 lg:mt-0">
          <div className="mb-3 px-1">
            <p className="legend text-crystal">{t('skins.worldsKicker')}</p>
            <h4 className="mt-1 font-display text-title uppercase tracking-wide text-bone">{t('skins.worlds')}</h4>
            <p className="mt-2 text-label leading-relaxed text-dim">{t('skins.worldsHint')}</p>
          </div>
          {collection.planets.length === 0 && (
            <p className="rounded-plate border border-white/15 bg-white/[0.04] p-4 text-body text-dim">{t('skins.empty')}</p>
          )}
          <div className="grid gap-2 md:grid-cols-2">
            {collection.planets.map((planet) => (
              <div key={planet.id} className="rounded-plate border border-white/15 bg-[#101824] p-3">
                <div className="flex items-center gap-3">
                  <img src={planet.skinId ? PLANET_SKIN_CATALOG[planet.skinId].image : planetArt(planet.id)} alt=""
                    className="size-14 shrink-0 rounded-control bg-[#070d17] object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-label uppercase tracking-label text-bone">{planet.name}</p>
                    <p className="mt-1 text-caption text-dim">{t('skins.current', { name: planet.skinId ? name(planet.skinId) : t('skins.default') })}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <Button size="sm" variant="primary" full
                    disabled={selected === null || planet.skinId === selected || pendingPlanetId !== null}
                    onClick={() => { if (selected !== null) onEquip(planet.id, selected); }}
                    ariaLabel={t('skins.apply', { name: planet.name })}>
                    {selected !== null && planet.skinId === selected ? t('skins.equipped') : t('skins.apply', { name: planet.name })}
                  </Button>
                  <Button size="sm" variant="ghost"
                    disabled={planet.skinId === null || pendingPlanetId !== null}
                    onClick={() => { onEquip(planet.id, null); }}
                    ariaLabel={t('skins.reset', { name: planet.name })}>
                    {t('skins.default')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SkinInventoryScreen({ onOpenShop }: { onOpenShop: () => void }) {
  const { t } = useTranslation();
  const collection = useSkins();
  const equip = useEquipSkin();
  if (collection.isPending) return <p className="p-4 text-body text-dim">{t('skins.ownedSkins')}…</p>;
  if (!collection.data) return <p className="p-4 text-body text-dim">{t('skins.loadError')}</p>;
  return (
    <>
      {equip.isError && <p role="alert" className="px-3 pt-3 text-label text-threat-ink">{t('skins.saveError')}</p>}
      <SkinInventoryContent
        collection={collection.data}
        onEquip={(planetId, skinId) => { equip.mutate({ planetId, skinId }); }}
        pendingPlanetId={equip.isPending ? equip.variables.planetId : null}
        onOpenShop={onOpenShop}
      />
    </>
  );
}
