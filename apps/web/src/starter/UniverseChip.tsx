import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';

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
      className="pointer-events-auto rounded-full border border-v2-line-hi bg-v2-panel/90 px-3 py-1.5 text-caption text-v2-ink"
    >
      {t(open ? 'universe.back' : 'universe.open')}
    </button>
  );
}
