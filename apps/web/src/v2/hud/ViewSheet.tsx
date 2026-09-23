import { useTranslation } from 'react-i18next';
import { haptic } from '../../lib/haptics.js';
import { Icon, type IconId } from '../icons.js';
import { Sheet } from '../kit/Sheet.js';

/** The chip at top right of the galaxy: the one control in that corner. */
export function ViewChip({ layersOn, onOpen }: { layersOn: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => { haptic('tap'); onOpen(); }}
      className={`pointer-events-auto flex h-8 items-center gap-1.5 rounded-full border bg-v2-deep/85 px-2.5 font-v2-ui text-caption ${
        layersOn ? 'border-v2-self/50 text-v2-ink' : 'border-v2-line text-v2-ink-2'
      }`}
    >
      <Icon id="i-telescope" className={`size-4 ${layersOn ? 'text-v2-self' : ''}`} />
      {t('view.chip')}
    </button>
  );
}

export interface ViewSheetProps {
  /** The galaxy's short code. */
  shard: string;
  online?: number;
  onlineToday?: number;
  counts: { worlds: number; fleetsAway: number; rocks: number; pirates: number; wrecks: number };
  telescope: boolean;
  onToggleTelescope: () => void;
  /** Absent until the active world runs a Radar: no dead switch. */
  radar?: boolean;
  onToggleRadar?: () => void;
  onOpenEvents: () => void;
  onClose: () => void;
}

function Layer({
  icon,
  label,
  detail,
  on,
  onPress,
}: {
  icon: IconId;
  label: string;
  detail: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => { haptic('tap'); onPress(); }}
      className="flex w-full items-center gap-3 border-b border-v2-line/60 py-2.5 text-left last:border-b-0"
    >
      <Icon id={icon} className={`size-5 shrink-0 ${on ? 'text-v2-self' : 'text-v2-ink-3'}`} />
      <span className="grid min-w-0 flex-1">
        <span className="text-caption font-semibold text-v2-ink">{label}</span>
        <span className="text-micro text-v2-ink-3">{detail}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full border ${on ? 'border-v2-self/60 bg-v2-self/25' : 'border-v2-line bg-v2-raise'}`}
      >
        <span className={`absolute top-0.5 size-3.5 rounded-full ${on ? 'right-0.5 bg-v2-self' : 'left-0.5 bg-v2-ink-3'}`} />
      </span>
    </button>
  );
}

/**
 * THE VIEW SHEET. The "every surface's new place" table (docs/ui-v2/gozlemevi.md).
 *
 * What was scattered over the disc's top-left corner — the caption naming the
 * galaxy and counting what is out there, the Telescope and Radar switches, the
 * events guide — is one sheet behind one chip, so the corners hold at most one
 * thing each and the galaxy gets the screen.
 *
 * The switches keep their rules: the Telescope's is always there (every world
 * has a naked-eye neighbourhood); the Radar's is ABSENT, not greyed, until a
 * Radar runs — a control that draws nothing teaches that the pair is decorative.
 * A figure an older server does not send is left out, never printed as zero.
 */
export function ViewSheet({
  shard,
  online,
  onlineToday,
  counts,
  telescope,
  onToggleTelescope,
  radar,
  onToggleRadar,
  onOpenEvents,
  onClose,
}: ViewSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet title={t('view.title')} eyebrow={shard} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2">
          {/* The galaxy's code is the sheet's eyebrow; this box says who is in it and what is out there. */}
          <div className="flex items-center gap-2 text-caption">
            {online !== undefined && (
              <span className="flex items-center gap-1.5 text-v2-ink-2">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-v2-self" />
                <span>{t('galaxy.online', { count: online })}</span>
                {onlineToday !== undefined && (
                  <span className="text-v2-ink-3">{t('galaxy.onlineToday', { count: onlineToday })}</span>
                )}
              </span>
            )}
          </div>
          <p data-testid="view-caption" className="mt-1 font-v2-mono text-micro text-v2-ink">
            {t('galaxy.worlds', { count: counts.worlds })}
            {counts.fleetsAway > 0 && <span className="text-v2-self">{t('galaxy.fleetAway', { count: counts.fleetsAway })}</span>}
            {counts.rocks > 0 && <span className="text-v2-crystal">{t('galaxy.rocks', { count: counts.rocks })}</span>}
            {counts.pirates > 0 && <span className="text-v2-hostile">{t('galaxy.pirates', { count: counts.pirates })}</span>}
            {counts.wrecks > 0 && <span className="text-v2-alloy">{t('galaxy.wrecks', { count: counts.wrecks })}</span>}
          </p>
        </div>

        <div>
          <p className="text-micro uppercase tracking-wide text-v2-ink-3">{t('view.layers')}</p>
          <Layer
            icon="i-telescope"
            label={t('view.telescope')}
            detail={t('view.telescopeDetail')}
            on={telescope}
            onPress={onToggleTelescope}
          />
          {radar !== undefined && onToggleRadar !== undefined && (
            <Layer icon="i-radar" label={t('view.radar')} detail={t('view.radarDetail')} on={radar} onPress={onToggleRadar} />
          )}
        </div>

        <button
          type="button"
          onClick={() => { haptic('tap'); onOpenEvents(); }}
          className="flex items-center justify-between rounded-control border border-v2-line px-3 py-2.5 text-caption text-v2-ink"
        >
          {t('view.events')}
          <Icon id="i-chev" className="size-4 text-v2-ink-3" />
        </button>
      </div>
    </Sheet>
  );
}
