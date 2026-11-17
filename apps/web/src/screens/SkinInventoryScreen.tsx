import { useEffect, useRef, useState } from 'react';
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
import { Banner, EmptyState, GameButton, Glyph, SectionTag, artIconSrc } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { CosmeticNavigation } from './CosmeticNavigation.js';
import { capabilities } from '../platform/runtime.js';

type Collection = z.infer<typeof skinCollectionSchema>;

/**
 * DRESSING A WORLD IS ONE TAP ON THAT WORLD (owner 2026-09-27: "giydirme ve çıkartma …
 * user friendly bir şekilde tasarlanmış mı?"). It used to be a shelf to pick from above and a
 * button per world to apply below — a scroll between the two on a phone, and four primary
 * presses on one screen. Now each world carries its own choices: the default and every owned
 * look. The lit chip is what the world wears, so the state and the control are one thing; a
 * tap on another dresses it at once, and Default takes the look off. Drawn in the game kit
 * (C36); no sales state is mixed in.
 */
export function SkinInventoryContent(props: Parameters<typeof PlanetInventoryContent>[0] & {
  onEquipCosmetic?: (category: CosmeticCategory, id: CosmeticId | null, hull?: MobileHullId) => void;
  cosmeticPending?: boolean;
  cosmeticError?: string;
}) {
  const [chosenCategory, setCategory] = useState<CosmeticCategory>('PLANET');
  const owned = props.collection.ownedCosmeticIds ?? props.collection.ownedSkinIds;
  const categories = cosmeticCategoriesFor(owned);
  const category = categories.includes(chosenCategory) ? chosenCategory : categories[0] ?? 'PLANET';
  return <div className="gk gk-shopfront">
    <CosmeticNavigation active="inventory" onShop={props.onOpenShop} onInventory={() => undefined} />
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
  const showShop = capabilities().webCheckout;

  return (
    <div className="gk-closet">
      <p className="gk-copy">{t('skins.intro')}</p>

      {owned.length === 0 ? (
        <EmptyState
          art={artIconSrc('cos-planet')}
          title={t('skins.categoryEmpty')}
          body={t('skins.noOwnedSkins')}
          action={showShop ? <GameButton tone="action" onPress={onOpenShop}>{t('skins.openShop')}</GameButton> : undefined}
        />
      ) : (
        <>
          {/* WHAT YOU OWN, AT A GLANCE: the looks and how many of the collection; the Store tab above is the way to more. */}
          <section aria-label={t('skins.ownedSkins')} className="gk-well gk-closet__owned">
            <span aria-hidden className="gk-closet__stack">
              {owned.map((id) => (
                <img key={id} src={PLANET_SKIN_CATALOG[id].image} alt="" width={28} height={28} loading="lazy" decoding="async" />
              ))}
            </span>
            <span className="gk-closet__ownedname">{t('skins.ownedSkins')}</span>
            <span className="gk-num gk-closet__count">{owned.length}/{PLANET_SKIN_IDS.length}</span>
          </section>

          <section aria-label={t('skins.worlds')} className="gk-closet__worlds">
            <SectionTag>{t('skins.worlds')}</SectionTag>
            <p className="gk-note">{t('skins.worldsHint')}</p>
            {collection.planets.length === 0 && <p className="gk-well gk-closet__none">{t('skins.empty')}</p>}
            {collection.planets.map((planet) => (
              <WorldPlate key={planet.id} planet={planet} owned={owned} pending={pending} failure={failure} onEquip={onEquip} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * ONE WORLD AND ITS WARDROBE: the world as it looks now, what it wears, and every look it can
 * wear. When a new look lands the picture swaps with a small swell, and the moment is heard and
 * felt — the confirmation is the world itself, not a toast.
 */
function WorldPlate({ planet, owned, pending, failure, onEquip }: {
  planet: Collection['planets'][number];
  owned: readonly PlanetSkinId[];
  pending: { planetId: string; skinId: PlanetSkinId | null } | null;
  failure: { planetId: string; message: string } | null;
  onEquip: (planetId: string, skinId: PlanetSkinId | null) => void;
}) {
  const { t } = useTranslation();
  const name = (id: PlanetSkinId) => t(PLANET_SKIN_CATALOG[id].nameKey);
  const worn = useRef(planet.skinId);
  useEffect(() => {
    if (worn.current === planet.skinId) return;
    worn.current = planet.skinId;
    playSound('confirm');
    haptic('commit');
  }, [planet.skinId]);
  return (
    <article aria-label={planet.name} className="gk-cut gk-closet__world">
      <div className="gk-closet__head">
        <img key={planet.skinId ?? 'default'} src={planet.skinId ? PLANET_SKIN_CATALOG[planet.skinId].image : planetArt(planet.id)} alt="" width={44} height={44}
          className="gk-closet__globe" />
        <div className="min-w-0">
          <p className="gk-closet__name">{planet.name}</p>
          <p className="gk-sub">{t('skins.current', { name: planet.skinId ? name(planet.skinId) : t('skins.default') })}</p>
        </div>
      </div>
      <div role="group" aria-label={t('skins.looksFor', { name: planet.name })} className="gk-closet__looks">
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
      {failure?.planetId === planet.id && <Banner tone="warn" role="alert" title={failure.message} />}
    </article>
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
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPick(); });
  return (
    <button
      type="button"
      {...OWN_SOUND}
      aria-label={label}
      aria-pressed={worn}
      aria-busy={busy}
      disabled={worn || waiting}
      className="gk-closet__look"
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <img src={art} alt="" width={28} height={28} loading="lazy" decoding="async" />
      <span>{text}</span>
      {worn && <Glyph id="check" />}
    </button>
  );
}

export default function SkinInventoryScreen({ onOpenShop }: { onOpenShop: () => void }) {
  const { t } = useTranslation();
  const collection = useSkins();
  const equip = useEquipSkin();
  const cosmetic = useEquipCosmetic();
  if (collection.isPending) return <Waiting>{t('skins.ownedSkins')}</Waiting>;
  if (!collection.data) return <div className="gk gk-shopfront__status"><Banner tone="warn" role="alert" title={t('skins.loadError')} /></div>;
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
