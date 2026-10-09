import { useState } from 'react';
import { cosmeticCategoriesFor, type CosmeticCategory, type CosmeticId, type MobileHullId } from '@astera/rules';
import { CosmeticCategories, CosmeticCollection } from './CosmeticCollection.jsx';
import { useEquipCosmetic } from '../api/queries.js';
import { useTranslation } from 'react-i18next';
import { PLANET_SKIN_IDS, type PlanetSkinId } from '@astera/rules';
import type { z } from 'zod';
import type { skinCollectionSchema } from '../api/schemas.js';
import { useEquipSkin, useSkins } from '../api/queries.js';
import { describeError } from '../i18n/errors.js';
import { planetArt } from '../ui/assets.js';
import { Waiting } from '../ui/kit/index.js';
import { PLANET_SKIN_CATALOG } from '../ui/skinCatalog.js';
import { Button, EmptyState, Note, SectionHead } from '../v2/kit/Surface.js';
import { Icon } from '../v2/icons.js';

type Collection = z.infer<typeof skinCollectionSchema>;

/**
 * DRESSING A WORLD IS ONE TAP ON THAT WORLD (owner 2026-09-27: "giydirme ve çıkartma …
 * user friendly bir şekilde tasarlanmış mı?"). It used to be a shelf to pick from above and a
 * button per world to apply below — a scroll between the two on a phone, and four primary
 * presses on one screen. Now each world carries its own choices: the default and every owned
 * look. The lit chip is what the world wears, so the state and the control are one thing; a
 * tap on another dresses it at once, and Default takes the look off. Drawn in the Gözlemevi
 * language; no sales state is mixed in.
 */
export function SkinInventoryContent(props: Parameters<typeof PlanetInventoryContent>[0] & {
  onEquipCosmetic?: (category: CosmeticCategory, id: CosmeticId | null, hull?: MobileHullId) => void;
  cosmeticPending?: boolean;
  cosmeticError?: string;
}) {
  const { t } = useTranslation();
  const [chosenCategory, setCategory] = useState<CosmeticCategory>('PLANET');
  const owned = props.collection.ownedCosmeticIds ?? props.collection.ownedSkinIds;
  const categories = cosmeticCategoriesFor(owned);
  const category = categories.includes(chosenCategory) ? chosenCategory : categories[0] ?? 'PLANET';
  return <div className="min-h-full bg-v2-void font-v2-ui text-v2-ink">
    <header className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-3 pt-3">
      <h2 className="text-body font-semibold">{t('menu.skinsInventoryLabel')} · {owned.length}</h2>
      <button type="button" onClick={props.onOpenShop} className="min-h-10 rounded-control border border-v2-premium/50 px-3 text-caption text-v2-premium">{t('menu.skinsShopLabel')}</button>
    </header>
    <CosmeticCategories active={category} onChange={setCategory} owned={owned} inventory />
    {category === 'PLANET' ? <PlanetInventoryContent {...props} /> : <CosmeticCollection key={category}
      category={category} inventory owned={owned} equipment={props.collection.equipment ?? {}}
      canEquipFlag={props.collection.canEquipFlag ?? false} onOpenOther={props.onOpenShop} onEquip={props.onEquipCosmetic} busy={props.cosmeticPending} error={props.cosmeticError} />}
  </div>;
}

function PlanetInventoryContent({
  collection,
  onEquip,
  pending,
  failure,
  onOpenShop,
}: {
  collection: Collection;
  onEquip: (planetId: string, skinId: PlanetSkinId | null) => void;
  /** The world being dressed, and with what: every choice waits until it lands. */
  pending: { planetId: string; skinId: PlanetSkinId | null } | null;
  /** The last dress that failed, and why, said on that world. */
  failure: { planetId: string; message: string } | null;
  onOpenShop: () => void;
}) {
  const { t } = useTranslation();
  const owned = collection.ownedSkinIds;
  const name = (id: PlanetSkinId) => t(PLANET_SKIN_CATALOG[id].nameKey);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-3 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 font-v2-ui text-v2-ink">
      <p className="text-caption leading-snug text-v2-ink-2">{t('skins.intro')}</p>

      {owned.length === 0 ? (
        <EmptyState
          icon={<Icon id="i-spark" className="size-6 text-v2-premium" />}
          title={t('skins.noOwnedSkins')}
          action={<Button variant="primary" onClick={onOpenShop}>{t('skins.openShop')}</Button>}
        />
      ) : (
        <>
          {/* WHAT YOU OWN, AT A GLANCE: the looks, how many of the collection, and the way to more. */}
          <section aria-label={t('skins.ownedSkins')}
            className="flex items-center gap-2.5 rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
            <span aria-hidden className="flex shrink-0 -space-x-2">
              {owned.map((id) => (
                <img key={id} src={PLANET_SKIN_CATALOG[id].image} alt="" loading="lazy" decoding="async"
                  className="size-7 rounded-full border-2 border-v2-panel object-cover" />
              ))}
            </span>
            <span className="min-w-0 truncate text-caption text-v2-ink-2">{t('skins.ownedSkins')}</span>
            <span className="font-v2-mono text-caption tabular-nums text-v2-ink">{owned.length}/{PLANET_SKIN_IDS.length}</span>
            <button type="button" onClick={onOpenShop}
              className="ml-auto shrink-0 text-caption font-semibold text-v2-premium underline decoration-v2-premium/40 underline-offset-4">
              {t('skins.openShop')}
            </button>
          </section>

          <section aria-label={t('skins.worlds')} className="flex flex-col gap-2">
            <SectionHead label={t('skins.worlds')} />
            <Note>{t('skins.worldsHint')}</Note>
            {collection.planets.length === 0 && (
              <p className="rounded-control border border-dashed border-v2-line-hi px-3 py-4 text-center text-caption text-v2-ink-2">{t('skins.empty')}</p>
            )}
            {collection.planets.map((planet) => (
              <article key={planet.id} aria-label={planet.name} className="rounded-control border border-v2-line bg-v2-panel p-2.5">
                <div className="flex items-center gap-2.5">
                  <img src={planet.skinId ? PLANET_SKIN_CATALOG[planet.skinId].image : planetArt(planet.id)} alt=""
                    className="size-11 shrink-0 rounded-full bg-v2-deep object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-body font-semibold text-v2-ink">{planet.name}</p>
                    <p className="text-micro text-v2-ink-3">
                      {t('skins.current', { name: planet.skinId ? name(planet.skinId) : t('skins.default') })}
                    </p>
                  </div>
                </div>
                <div role="group" aria-label={t('skins.looksFor', { name: planet.name })} className="mt-2.5 flex flex-wrap gap-1">
                  <LookChip
                    label={t('skins.reset', { name: planet.name })}
                    text={t('skins.defaultChip')}
                    art={planetArt(planet.id)}
                    worn={planet.skinId === null}
                    busy={pending?.planetId === planet.id && pending.skinId === null}
                    waiting={pending !== null}
                    onPick={() => { onEquip(planet.id, null); }}
                  />
                  {owned.map((id) => (
                    <LookChip
                      key={id}
                      label={t('skins.wear', { look: name(id), world: planet.name })}
                      text={name(id)}
                      art={PLANET_SKIN_CATALOG[id].image}
                      worn={planet.skinId === id}
                      busy={pending?.planetId === planet.id && pending.skinId === id}
                      waiting={pending !== null}
                      onPick={() => { onEquip(planet.id, id); }}
                    />
                  ))}
                </div>
                {failure?.planetId === planet.id && (
                  <p role="alert" className="mt-2 flex items-start gap-1.5 text-caption text-v2-warn">
                    <Icon id="i-warn" className="mt-0.5 size-3.5 shrink-0" />
                    {failure.message}
                  </p>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * ONE LOOK A WORLD CAN WEAR. Lit in your colour with a tick when it is the one worn — and then
 * not pressable, because pressing it again would change nothing. While any world is being
 * dressed every chip waits, and the one on its way pulses.
 */
function LookChip({ label, text, art, worn, busy, waiting, onPick }: {
  label: string;
  text: string;
  art: string;
  worn: boolean;
  busy: boolean;
  waiting: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={worn}
      aria-busy={busy}
      disabled={worn || waiting}
      onClick={onPick}
      className={`flex h-8 items-center gap-1 rounded-full border pl-0.5 pr-2 text-micro font-semibold transition-colors ${
        worn ? 'border-v2-self bg-v2-self/10 text-v2-ink' : 'border-v2-line-hi bg-v2-deep text-v2-ink-2 hover:border-v2-ink-3 hover:text-v2-ink'
      } ${busy ? 'animate-pulse border-v2-self/70 text-v2-ink' : ''} ${waiting && !worn && !busy ? 'opacity-50' : ''}`}
    >
      <img src={art} alt="" loading="lazy" decoding="async" className="size-6 rounded-full object-cover" />
      <span>{text}</span>
      {worn && <Icon id="i-check" className="size-3 text-v2-self" />}
    </button>
  );
}

export default function SkinInventoryScreen({ onOpenShop }: { onOpenShop: () => void }) {
  const { t } = useTranslation();
  const collection = useSkins();
  const equip = useEquipSkin();
  const cosmetic = useEquipCosmetic();
  if (collection.isPending) return <Waiting>{t('skins.ownedSkins')}</Waiting>;
  if (!collection.data) return <p className="p-4 text-caption text-v2-ink-2">{t('skins.loadError')}</p>;
  return (
    <SkinInventoryContent
      collection={collection.data}
      onEquipCosmetic={(category, cosmeticId, hull) => { cosmetic.mutate({ category, cosmeticId, hull }); }}
      cosmeticPending={cosmetic.isPending}
      cosmeticError={cosmetic.isError ? describeError(cosmetic.error) : undefined}
      onEquip={(planetId, skinId) => { equip.mutate({ planetId, skinId }); }}
      pending={equip.isPending ? equip.variables : null}
      failure={equip.isError ? { planetId: equip.variables.planetId, message: describeError(equip.error) } : null}
      onOpenShop={onOpenShop}
    />
  );
}
