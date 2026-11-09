import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { Icon } from '../v2/icons.js';

/**
 * THE WAY INTO THE UNIVERSE VIEW, AND OUT. Zooming out a little more opens it too; this says it is
 * there the moment the limit is reached, and is what a thumb reaches for.
 */
export function UniverseChip({ open, atLimit, available, onOpen, onClose }: {
  open: boolean;
  atLimit: boolean;
  available: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!open && !(atLimit && available)) return null;
  return (
    <button
      type="button"
      data-universe-chip=""
      onClick={() => { haptic('tap'); if (open) onClose(); else onOpen(); }}
      aria-label={t(open ? 'universe.back' : 'universe.open')}
      title={t(open ? 'universe.back' : 'universe.open')}
      // Round and wordless, under the telescope, as its neighbours are (owner, 2026-11-09).
      className={`pointer-events-auto grid size-9 place-items-center rounded-full border bg-v2-panel/60 ${open ? 'border-v2-self/60 text-v2-self' : 'border-v2-line-hi text-v2-ink-2'}`}
    >
      <Icon id={open ? 'i-back' : 'i-universe'} className="size-4" />
    </button>
  );
}
