import { cosmeticCopy, cosmeticCard, COSMETIC_SCOPE } from '../ui/cosmeticCopy.js';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cosmeticCategoriesFor, cosmeticsInCategory, type CosmeticCategory, type CosmeticId, type CosmeticEquipment, type CosmeticDefinition, type MobileHullId } from '@astera/rules';
import { CosmeticPreview } from './CosmeticPreview.jsx';
import { hullLabel } from '../i18n/names.js';
import { capabilities } from '../platform/runtime.js';
import { Banner, EmptyState, GameButton, Glyph, artIconSrc, type ArtIconId } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';

/** Each shelf's painting: the same art the menu's tiles wear for it. */
const CATEGORY_ART: Readonly<Record<CosmeticCategory, ArtIconId>> = {
  PLANET: 'cos-planet', RING: 'cos-ring', SHIP: 'cos-ship', PROBE: 'cos-probe', MINER: 'cos-miner', ENGINE: 'cos-engine', FLAG: 'cos-flag',
};

export function CosmeticCategories({ active, onChange, owned, inventory }: {
  active: CosmeticCategory; onChange: (category: CosmeticCategory) => void; owned: readonly string[]; inventory: boolean;
}) {
  const { t } = useTranslation();
  return <nav aria-label={t('skins.categories')} className="gk-cosmo__cats">
    {cosmeticCategoriesFor(inventory ? owned : undefined).map(category => {
      const items = cosmeticsInCategory(category);
      const count = inventory ? items.filter(item => item.free || owned.includes(item.id)).length : items.length;
      return <CategoryPlate key={category} category={category} count={count} on={active === category} onPress={() => { onChange(category); }} />;
    })}
  </nav>;
}

/** A shelf to open: its painting, its name and how many it holds; the open one is lit. */
function CategoryPlate({ category, count, on, onPress }: { category: CosmeticCategory; count: number; on: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const own = useOwnPress(() => { playSound('tab'); haptic('tap'); onPress(); });
  return <button type="button" {...OWN_SOUND} aria-pressed={on} className="gk-cosmo__cat" onPointerDown={own.onPointerDown} onClick={own.onClick}>
    <img className="gk-cosmo__catart" src={artIconSrc(CATEGORY_ART[category])} alt="" draggable={false} />
    <span className="gk-cosmo__catname">{t(`skins.category${category}`)}</span>
    <span className="gk-num gk-cosmo__catcount">{String(count).padStart(2, '0')}</span>
  </button>;
}

export function CosmeticCollection({ category, inventory, owned, equipment, onOpenOther, onEquip, busy = false, error, purchase, canEquipFlag = true, onTry, initialId, prices, purchaseError }: {
  onTry?: (id: CosmeticId) => void; initialId?: CosmeticId;
  category: CosmeticCategory; inventory: boolean; owned: readonly string[];
  equipment: CosmeticEquipment;
  onOpenOther: () => void; onEquip?: (category: CosmeticCategory, id: CosmeticId | null, hull?: MobileHullId) => void;
  canEquipFlag?: boolean; busy?: boolean; error?: string; purchase?: (id: CosmeticId) => ReactNode;
  prices?: Readonly<Partial<Record<CosmeticId, { formatted: string }>>>;
  purchaseError?: { itemId: CosmeticId | 'bundle'; message: string };
}) {
  const { t } = useTranslation();
  const items = cosmeticsInCategory(category).filter(item => !inventory || item.free || owned.includes(item.id));
  const worn = (item: CosmeticDefinition): boolean => item.category === 'SHIP'
    ? Boolean(item.hull && equipment.SHIP?.[item.hull] === item.id) : equipment[item.category] === item.id;
  const [selection, setSelection] = useState<CosmeticId | undefined>(initialId ?? (!inventory && category === 'FLAG' ? items.find(item => !item.free)?.id : items.find(worn)?.id ?? items[0]?.id));
  const selected = items.find(item => item.id === selection) ?? items[0];
  const equipped = selected ? worn(selected) : false;
  // A look that lands on the one being looked at is heard and felt: the confirmation is the shelf itself.
  const was = useRef({ id: selected?.id, equipped });
  useEffect(() => {
    if (was.current.id === selected?.id && !was.current.equipped && equipped) {
      playSound('confirm');
      haptic('commit');
    }
    was.current = { id: selected?.id, equipped };
  }, [selected?.id, equipped]);
  if (!selected) return <section className="gk gk-cosmo">
    <EmptyState
      art={artIconSrc(CATEGORY_ART[category])}
      title={t(inventory ? 'skins.categoryEmpty' : 'skins.modelsComing')}
      body={t(inventory ? 'skins.categoryEmptyHint' : 'skins.modelsComingHint')}
      action={inventory && capabilities().webCheckout ? <GameButton tone="action" onPress={onOpenOther}>{t('skins.openShop')}</GameButton> : undefined}
    />
  </section>;
  const isOwned = selected.free || owned.includes(selected.id);
  const failure = error ?? (purchaseError?.itemId === selected.id ? purchaseError.message : undefined);
  const canRestore = selected.category === 'SHIP' ? Boolean(selected.hull && equipment.SHIP?.[selected.hull]) : Boolean(equipment[selected.category]);
  const locked = !onEquip || (category === 'FLAG' && !canEquipFlag);
  const equip = (id: CosmeticId | null) => {
    if (selected.hull) onEquip?.(category, id, selected.hull);
    else onEquip?.(category, id);
  };
  return <section className="gk gk-cosmo" style={{ '--cosmetic-accent': selected.accent } as CSSProperties}>
    {/* THE STAGE: the product turning in its own light, what it is, and what it costs. */}
    <div className="gk-cut gk-cosmo__stage">
      <div className="gk-cosmo__stagehead">
        <span className="gk-label">{t(`skins.category${category}`)}</span>
        <span className="gk-label" style={{ color: selected.accent }}>{t(selected.free ? 'skins.included' : 'skins.premium')}</span>
      </div>
      <CosmeticPreview id={selected.id} />
      <div className="gk-cosmo__info">
        <p className="gk-note gk-cosmo__drag"><Glyph id="refresh" />{t('skins.dragHint')}</p>
        <div className="gk-cosmo__namerow">
          <h2 className="gk-display gk-outlined gk-cosmo__name" style={{ color: selected.accent }}>{t(cosmeticCopy(selected.id).nameKey)}</h2>
          {!inventory && !isOwned && <p className="gk-display gk-num gk-cosmo__price">{prices?.[selected.id]?.formatted ?? '—'}</p>}
        </div>
        {!inventory && !isOwned && <p className="gk-note">{t('skins.oneTime')}</p>}
        <p className="gk-copy">{t(cosmeticCopy(selected.id).storyKey)}</p>
        {selected.hull && <p className="gk-cosmo__fits"><Glyph id="rocket" />{t('skins.shipFits', { hull: hullLabel(selected.hull) })}</p>}
      </div>
    </div>
    <p className="gk-note">{t(COSMETIC_SCOPE[category])}</p>
    {!inventory && category === 'RING' && onTry && <GameButton wide glyph="eye" onPress={() => { onTry(selected.id); }}>{t('skins.tryOnWorld')}</GameButton>}
    {inventory ? <div className="gk-cosmo__actions">
      <GameButton tone="action" glyph={equipped ? 'check' : undefined} pending={busy}
        disabledReason={equipped ? t('skins.equipped') : busy || locked ? t('skins.equip') : null} onPress={() => { equip(selected.id); }}>
        {t('skins.equip')}
      </GameButton>
      <GameButton disabledReason={busy || !canRestore || locked ? t('skins.restoreDefault') : null} onPress={() => { equip(null); }}>{t('skins.restoreDefault')}</GameButton>
    </div> : isOwned ? <GameButton tone="self" wide glyph="check" onPress={onOpenOther}>{t('menu.skinsInventoryLabel')}</GameButton>
      : purchase ? purchase(selected.id) : <GameButton wide disabledReason={t('skins.onSaleSoon')} onPress={() => undefined}>{t('skins.onSaleSoon')}</GameButton>}
    {inventory && category === 'FLAG' && !canEquipFlag && <p className="gk-note gk-cosmo__lock"><Glyph id="lock" />{t('skins.flagLeaderOnly')}</p>}
    {failure && <Banner tone="warn" role="alert" title={failure} />}
    <p className="gk-note">{t('skins.cosmeticOnly')}</p>
    <div className="gk-shop__cards gk-cosmo__cards">
      {items.map(item => <CosmeticCard key={item.id} item={item} chosen={item.id === selected.id} onPick={() => { setSelection(item.id); }}
        price={!inventory && !item.free && !owned.includes(item.id) ? prices?.[item.id]?.formatted : undefined}
        status={t(worn(item) ? 'skins.equipped' : item.free ? 'skins.included' : owned.includes(item.id) ? 'skins.owned' : 'skins.inspect')}
        worn={worn(item)} />)}
    </div>
  </section>;
}

/** One product on the shelf: its painting, its name in its colour, what it fits, and its price or standing. */
function CosmeticCard({ item, chosen, price, status, worn, onPick }: {
  item: CosmeticDefinition; chosen: boolean; price: string | undefined; status: string; worn: boolean; onPick: () => void;
}) {
  const { t } = useTranslation();
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPick(); });
  return <button type="button" {...OWN_SOUND} aria-pressed={chosen} className="gk-shop__card" style={{ '--card': item.accent } as CSSProperties}
    onPointerDown={own.onPointerDown} onClick={own.onClick}>
    <span className="gk-shop__art gk-cosmo__art"><img src={cosmeticCard(item.id)} alt="" loading="lazy" decoding="async" /></span>
    <span className="gk-shop__cardfoot">
      <span className="gk-shop__cardname" style={{ color: item.accent }}>{t(cosmeticCopy(item.id).nameKey)}</span>
      {price !== undefined && <span className="gk-num gk-shop__cardprice">{price}</span>}
    </span>
    {(Boolean(item.hull) || price === undefined) && <span className="gk-cosmo__cardsub">
      {item.hull && <span>{t('skins.shipFits', { hull: hullLabel(item.hull) })}</span>}
      {price === undefined && <span className={worn ? 'gk-cosmo__worn' : undefined}>{status}</span>}
    </span>}
  </button>;
}
