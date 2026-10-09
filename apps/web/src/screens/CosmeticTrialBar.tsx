import { useTranslation } from 'react-i18next';
import { cosmeticById } from '@astera/rules';
import type { CosmeticTrial } from '../galaxy/cosmeticTrial.js';
import { cosmeticCopy } from '../ui/cosmeticCopy.js';

export function CosmeticTrialBar({ trial, worlds, onSelect, onCompare, onEnd, onShop }: {
  trial: CosmeticTrial; worlds: readonly { id: string; name: string }[];
  onSelect: (id: string) => void; onCompare: () => void; onEnd: () => void; onShop: () => void;
}) {
  const { t } = useTranslation();
  const item = cosmeticById(trial.cosmeticId);
  if (!item) return null;
  return <section data-cosmetic-trial aria-label={t('skins.trialTitle')} className="absolute inset-x-2.5 bottom-[var(--v2-dock-h,0px)] z-30 mx-auto mb-2 max-w-lg rounded-control border border-v2-premium/50 bg-v2-panel p-3 font-v2-ui text-v2-ink shadow-xl">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-micro font-semibold uppercase tracking-wide text-v2-premium">{t('skins.trialTitle')}</p>
        <p className="mt-1 text-body font-semibold">{t(cosmeticCopy(item.id).nameKey)}</p></div>
      <button type="button" onClick={onEnd} className="min-h-11 shrink-0 rounded-control border border-v2-line-hi px-3 text-caption text-v2-ink-2">{t('skins.trialEnd')}</button>
    </div>
    <p className="mt-1 text-caption leading-snug text-v2-ink-3">{t('skins.trialHint')}</p>
    <label className="mt-2 block text-micro text-v2-ink-3">{t('skins.trialWorld')}
      <select value={trial.planetId} onChange={event => { onSelect(event.target.value); }} className="mt-1 min-h-11 w-full rounded-control border border-v2-line-hi bg-v2-deep px-2 text-caption text-v2-ink">
        {worlds.map(world => <option key={world.id} value={world.id}>{world.name}</option>)}
      </select>
    </label>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button type="button" aria-pressed={!trial.enabled} onClick={onCompare} className="min-h-11 rounded-control border border-v2-line-hi px-2 text-caption text-v2-ink-2">{t(trial.enabled ? 'skins.trialCompare' : 'skins.trialShow')}</button>
      <button type="button" onClick={onShop} className="min-h-11 rounded-control bg-v2-premium px-2 text-caption font-semibold text-v2-void">{t('skins.trialShop')}</button>
    </div>
  </section>;
}
