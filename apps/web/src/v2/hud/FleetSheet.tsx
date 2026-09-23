import { useTranslation } from 'react-i18next';
import { FlightList, type StripFocus } from '../../shell/PendingStrip.js';
import { Sheet } from '../kit/Sheet.js';

export interface FleetSheetProps {
  /** The active world's flight bays; null before the planet has loaded. */
  flight: { used: number; total: number } | null;
  /** Frame a craft on the disc. The sheet closes first. */
  onFocus: (focus: StripFocus) => void;
  onClose: () => void;
}

/**
 * THE FLEET TAB. Spec B4 and the "every surface's new place" table
 * (docs/ui-v2/gozlemevi.md): the flight roster and the flight bays.
 *
 * AN INTERIM PAGE. The full E4 page (B10 pace, B11 flight rows, attack recall)
 * arrives in F3; until then this is the flight board the strip has always opened
 * — the same rows, focus and recall — so nothing is lost while the shell moves.
 */
export function FleetSheet({ flight, onFocus, onClose }: FleetSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      title={t('dock.fleet')}
      {...(flight ? { eyebrow: t('statusBar.bays.hint', { used: flight.used, total: flight.total }) } : {})}
      onClose={onClose}
    >
      <FlightList onFocus={onFocus} onDone={onClose} />
    </Sheet>
  );
}
