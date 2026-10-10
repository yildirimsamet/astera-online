import { cosmeticCopy, cosmeticCard, COSMETIC_SCOPE } from '../ui/cosmeticCopy.js';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cosmeticCategoriesFor, cosmeticsInCategory, type CosmeticCategory, type CosmeticId, type CosmeticEquipment, type CosmeticDefinition, type MobileHullId } from '@astera/rules';
import { CosmeticPreview } from './CosmeticPreview.jsx';
import { hullLabel } from '../i18n/names.js';

export function CosmeticCategories({ active, onChange, owned, inventory }: {
  active: CosmeticCategory; onChange: (category: CosmeticCategory) => void; owned: readonly string[]; inventory: boolean;
}) {
  const { t } = useTranslation();
  return <nav aria-label={t('skins.categories')} className="mx-auto grid w-full max-w-2xl grid-cols-[repeat(auto-fit,minmax(76px,1fr))] gap-1.5 px-3 py-3">
    {cosmeticCategoriesFor(inventory ? owned : undefined).map(category => {
      const items = cosmeticsInCategory(category);
      const count = inventory ? items.filter(item => item.free || owned.includes(item.id)).length : items.length;
      return <button key={category} type="button" aria-pressed={active === category} onClick={() => { onChange(category); }}
        className={`flex min-h-12 min-w-0 flex-col items-start justify-center gap-1 rounded-control border px-2 py-2 text-left text-micro font-semibold transition-colors ${active === category ? 'border-v2-premium/70 bg-v2-premium/10 text-v2-premium' : 'border-v2-line bg-v2-panel text-v2-ink-2 hover:border-v2-line-hi'}`}>
        <span>{t(`skins.category${category}`)}</span><span className="font-v2-mono text-v2-ink-3">{String(count).padStart(2, '0')}</span>
      </button>;
    })}
  </nav>;
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
  if (!selected) return <section className="mx-auto max-w-2xl px-3 py-12 text-center">
    <p className="text-body font-semibold text-v2-ink">{t(inventory ? 'skins.categoryEmpty' : 'skins.modelsComing')}</p>
    <p className="mx-auto mt-2 max-w-sm text-caption text-v2-ink-3">{t(inventory ? 'skins.categoryEmptyHint' : 'skins.modelsComingHint')}</p>
    {inventory && <button type="button" onClick={onOpenOther} className="mt-5 min-h-11 rounded-control border border-v2-premium/60 px-5 text-caption text-v2-premium">{t('skins.openShop')}</button>}
  </section>;
  const isOwned = selected.free || owned.includes(selected.id);
  const equipped = worn(selected);
  const failure = error ?? (purchaseError?.itemId === selected.id ? purchaseError.message : undefined);
  const canRestore = selected.category === 'SHIP' ? Boolean(selected.hull && equipment.SHIP?.[selected.hull]) : Boolean(equipment[selected.category]);
  const equip = (id: CosmeticId | null) => {
    if (selected.hull) onEquip?.(category, id, selected.hull);
    else onEquip?.(category, id);
  };
  return <section className="cosmetic-collection mx-auto max-w-2xl px-3 pb-6" style={{ '--cosmetic-accent': selected.accent } as CSSProperties}>
    <div className="relative isolate overflow-hidden rounded-control border border-v2-line bg-v2-deep">
      <div aria-hidden className="cosmetic-stage-glow pointer-events-none absolute inset-0" />
      <div className="relative flex items-center justify-between px-4 pt-4 text-micro uppercase tracking-wide">
        <span className="text-v2-ink-3">{t(`skins.category${category}`)}</span>
        <span style={{ color: selected.accent }}>{t(selected.free ? 'skins.included' : 'skins.premium')}</span>
      </div>
      <CosmeticPreview id={selected.id} />
      <div className="relative px-4 pb-4">
        <p className="mb-1 text-micro text-v2-ink-3">{t('skins.dragHint')}</p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-figure font-semibold tracking-wide" style={{ color: selected.accent }}>{t(cosmeticCopy(selected.id).nameKey)}</h2>
          {!inventory && !isOwned && <p className="font-v2-mono text-figure font-semibold text-v2-premium">{prices?.[selected.id]?.formatted ?? '—'}</p>}
        </div>
        {!inventory && !isOwned && <p className="mt-1 text-micro text-v2-ink-3">{t('skins.oneTime')}</p>}
        <p className="mt-1.5 text-caption leading-relaxed text-v2-ink-2">{t(cosmeticCopy(selected.id).storyKey)}</p>
        {selected.hull && <p className="mt-3 w-fit rounded-control border border-v2-line-hi bg-v2-panel px-3 py-2 text-caption font-semibold text-v2-ink">{t('skins.shipFits', { hull: hullLabel(selected.hull) })}</p>}
      </div>
    </div>
    <p className="my-3 text-caption leading-relaxed text-v2-ink-3">{t(COSMETIC_SCOPE[category])}</p>
    {!inventory && category === 'RING' && onTry && <button type="button" onClick={() => { onTry(selected.id); }}
      className="mb-2 min-h-11 w-full rounded-control border border-v2-premium/60 bg-v2-premium/10 px-3 text-caption font-semibold text-v2-premium">{t('skins.tryOnWorld')}</button>}
    {inventory ? <div className="flex gap-2">
      <button type="button" aria-busy={busy} disabled={busy || equipped || !onEquip || (category === 'FLAG' && !canEquipFlag)} onClick={() => { equip(selected.id); }}
        className="min-h-11 flex-1 rounded-control bg-v2-premium px-3 text-caption font-semibold text-v2-void disabled:opacity-50">{t(equipped ? 'skins.equipped' : 'skins.equip')}</button>
      <button type="button" disabled={busy || !canRestore || !onEquip || (category === 'FLAG' && !canEquipFlag)} onClick={() => { equip(null); }}
        className="min-h-11 rounded-control border border-v2-line-hi px-3 text-caption text-v2-ink-2 disabled:opacity-50">{t('skins.restoreDefault')}</button>
    </div> : isOwned ? <button type="button" onClick={onOpenOther} className="min-h-11 w-full rounded-control border border-v2-premium/60 px-3 text-caption font-semibold text-v2-premium">{t('menu.skinsInventoryLabel')}</button>
      : purchase ? purchase(selected.id) : <button type="button" disabled className="min-h-11 w-full rounded-control border border-v2-line-hi text-caption text-v2-ink-3">{t('skins.onSaleSoon')}</button>}
    {inventory && category === 'FLAG' && !canEquipFlag && <p className="mt-2 text-caption text-v2-ink-3">{t('skins.flagLeaderOnly')}</p>}
    {failure && <p role="alert" className="mt-2 rounded-control border border-v2-warn/30 bg-v2-warn/5 px-3 py-2 text-caption text-v2-warn">{failure}</p>}
    <p className="mt-3 text-micro text-v2-ink-3">{t('skins.cosmeticOnly')}</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map(item => <button key={item.id} type="button" aria-pressed={item.id === selected.id}
        onClick={() => { setSelection(item.id); }} className={`overflow-hidden rounded-control border bg-v2-panel text-left ${item.id === selected.id ? 'border-v2-premium' : 'border-v2-line'}`}>
        <img src={cosmeticCard(item.id)} alt="" loading="lazy" className="aspect-[1.5] w-full object-cover" />
        <span className="block px-2.5 py-2 text-caption font-semibold" style={{ color: item.accent }}>{t(cosmeticCopy(item.id).nameKey)}</span>
        {item.hull && <span className="block px-2.5 pb-2 text-micro text-v2-ink-2">{t('skins.shipFits', { hull: hullLabel(item.hull) })}</span>}
        {!inventory && !item.free && !owned.includes(item.id) && prices?.[item.id] ?
          <span className="block px-2.5 pb-2 font-v2-mono text-caption font-semibold text-v2-premium">{prices[item.id]?.formatted}</span> :
          <span className="block px-2.5 pb-2 text-micro text-v2-ink-3">{t(worn(item) ? 'skins.equipped' : item.free ? 'skins.included' : owned.includes(item.id) ? 'skins.owned' : 'skins.inspect')}</span>}
      </button>)}
    </div>
  </section>;
}
