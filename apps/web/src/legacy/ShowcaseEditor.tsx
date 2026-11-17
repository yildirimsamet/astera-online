/**
 * CHOOSING THE SIX: every piece you hold, in the order a tap picks it. The order is the shelf
 * — the first three stand on the top shelf — so the number on a tile is the plinth it goes to.
 * On the kit since C27: the count in gold, the refusals as banners, save as the screen's move.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LEGACY_SHOWCASE_SLOTS } from '@astera/rules';
import type { LegacyAward } from '../api/legacySchemas.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Banner, GameButton } from '../game-ui/index.js';
import { AwardTile } from './AwardTile.js';
import { sortLegacyAwards } from './presentation.js';
import { useSetLegacyShowcase } from './queries.js';
import { useLegacyDialogFocus } from './useLegacyDialogFocus.js';

export function ShowcaseEditor({ collection, current, onClose }: {
  collection: readonly LegacyAward[];
  current: readonly string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const focus = useLegacyDialogFocus();
  const save = useSetLegacyShowcase();
  const [picked, setPicked] = useState<string[]>(() => current.filter(id => collection.some(award => award.id === id)));
  const [full, setFull] = useState(false);
  const [failed, setFailed] = useState(false);
  const toggle = (id: string) => {
    setFailed(false);
    if (picked.includes(id)) { setFull(false); setPicked(picked.filter(other => other !== id)); return; }
    if (picked.length >= LEGACY_SHOWCASE_SLOTS) { setFull(true); return; }
    setPicked([...picked, id]);
  };
  const commit = () => {
    setFailed(false);
    save.mutateAsync(picked).then(onClose, () => { setFailed(true); });
  };
  return (
    <Sheet placement="dialog" detents={['full']} kit={{}} title={t('legacy.editor.title')} onClose={onClose}
      footer={(
        <div className="gk-legacy__foot">
          {picked.length > 0 && (
            <GameButton tone="ghost" glyph="close" pending={save.isPending} onPress={() => { setPicked([]); setFull(false); }}>{t('legacy.editor.clear')}</GameButton>
          )}
          <GameButton tone="action" wide glyph="check" pending={save.isPending} onPress={commit}>
            {save.isPending ? t('legacy.editor.saving') : t('legacy.editor.save')}
          </GameButton>
        </div>
      )}>
      <div ref={focus} tabIndex={-1} data-legacy-editor className="gk-legacy gk-legacy__editor">
        <p className="gk-legacy__note">{t('legacy.editor.hint')}</p>
        <p aria-live="polite" className="gk-legacy__picked gk-num">{t('legacy.editor.selected', { count: picked.length })}</p>
        {full && <Banner tone="warn" role="alert" title={t('legacy.editor.full')} />}
        {failed && <Banner tone="hostile" role="alert" title={t('legacy.editor.failed')} />}
        {collection.length === 0
          ? <p className="gk-legacy__note">{t('legacy.editor.empty')}</p>
          : (
            <div className="gk-legacy__grid">
              {sortLegacyAwards(collection).map(award => {
                const index = picked.indexOf(award.id);
                return <AwardTile key={award.id} award={award} onOpen={() => { toggle(award.id); }}
                  selected={index >= 0} {...(index >= 0 ? { order: index + 1 } : {})} />;
              })}
            </div>
          )}
      </div>
    </Sheet>
  );
}
