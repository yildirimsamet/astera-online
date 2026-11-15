import { useTranslation } from 'react-i18next';
import { cosmeticById } from '@astera/rules';
import type { CosmeticTrial } from '../galaxy/cosmeticTrial.js';
import { cosmeticCopy } from '../ui/cosmeticCopy.js';
import { Choices, GameButton, RoundButton } from '../game-ui/index.js';

/**
 * TRYING A LOOK ON A WORLD OF MINE, OVER THE GALAXY. On the kit since C39 (2026-11-15): a cut plate
 * in the look's gold, the world as a kit choice (no native select), the shop as the move.
 */
export function CosmeticTrialBar({ trial, worlds, onSelect, onCompare, onEnd, onShop }: {
  trial: CosmeticTrial; worlds: readonly { id: string; name: string }[];
  onSelect: (id: string) => void; onCompare: () => void; onEnd: () => void; onShop: () => void;
}) {
  const { t } = useTranslation();
  const item = cosmeticById(trial.cosmeticId);
  if (!item) return null;
  return <section data-cosmetic-trial aria-label={t('skins.trialTitle')} className="gk gk-cut gk-trial absolute inset-x-2.5 z-30 mx-auto mb-2 max-w-lg">
    <div className="gk-trial__head">
      <div className="min-w-0">
        <p className="gk-label gk-trial__eyebrow">{t('skins.trialTitle')}</p>
        <p className="gk-trial__name gk-display">{t(cosmeticCopy(item.id).nameKey)}</p>
      </div>
      <RoundButton glyph="close" label={t('skins.trialEnd')} onPress={onEnd} />
    </div>
    <p className="gk-trial__hint">{t('skins.trialHint')}</p>
    {worlds.length > 1 && <Choices label={t('skins.trialWorld')} options={worlds.map(world => ({ id: world.id, label: world.name }))}
      value={trial.planetId} onChange={onSelect} />}
    <div className="gk-trial__moves">
      <GameButton glyph="eye" onPress={onCompare}>{t(trial.enabled ? 'skins.trialCompare' : 'skins.trialShow')}</GameButton>
      <GameButton tone="action" glyph="next" onPress={onShop}>{t('skins.trialShop')}</GameButton>
    </div>
  </section>;
}
