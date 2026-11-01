/**
 * CHOOSING THE SIX: every piece you hold, in the order a tap picks it. The order is the shelf
 * — the first three stand on the top shelf — so the number on a tile is the plinth it goes to.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LEGACY_SHOWCASE_SLOTS } from '@astera/rules';
import type { LegacyAward } from '../api/legacySchemas.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { Button } from '../v2/kit/Surface.js';
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
    <Sheet placement="dialog" detents={['full']} headerArt={ATMOSPHERE.legacy} title={t('legacy.editor.title')} onClose={onClose}
      footer={(
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={picked.length === 0 || save.isPending} onClick={() => { setPicked([]); setFull(false); }}>{t('legacy.editor.clear')}</Button>
          <Button variant="primary" full disabled={save.isPending} onClick={commit}>{save.isPending ? t('legacy.editor.saving') : t('legacy.editor.save')}</Button>
        </div>
      )}>
      <div ref={focus} tabIndex={-1} data-legacy-editor className="flex flex-col gap-3 pb-3 font-v2-ui outline-none">
        <p className="text-label text-v2-ink-2">{t('legacy.editor.hint')}</p>
        <p aria-live="polite" className="font-v2-mono text-micro font-semibold text-v2-premium">{t('legacy.editor.selected', { count: picked.length })}</p>
        {full && <p role="alert" className="text-label text-v2-warn">{t('legacy.editor.full')}</p>}
        {failed && <p role="alert" className="text-label text-v2-hostile">{t('legacy.editor.failed')}</p>}
        {collection.length === 0
          ? <p className="text-caption text-v2-ink-2">{t('legacy.editor.empty')}</p>
          : (
            <div className="grid grid-cols-3 gap-2">
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
