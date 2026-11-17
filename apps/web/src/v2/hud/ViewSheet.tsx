import { useTranslation } from 'react-i18next';
import { haptic } from '../../lib/haptics.js';
import { OWN_SOUND, playSound } from '../../lib/sound.js';
import { instrumentArt } from '../../ui/assets.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
import { Sheet } from '../kit/Sheet.js';
import { Glyph, RoundButton, SectionTag, Toggle, artIconSrc } from '../../game-ui/index.js';

/**
 * THE VIEW CHIP: the telescope, the one control in that corner beside home. Owner,
 * 2026-09-24: the icon says it — home and chat carry no word either; the word stays as its
 * accessible name. Painted as the bell and chat are since G1-d2 (2026-11-14); a lamp at its
 * foot says a sensor's reach is drawn on the map, as the old teal ring did.
 * `data-view-chip` is its handle for the Academy and the visual tools.
 */
export function ViewChip({ layersOn, onOpen }: { layersOn: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <span data-view-chip="" className="pointer-events-auto inline-grid">
      <RoundButton art={artIconSrc('hud-view')} label={t('view.chip')} lit={layersOn} onPress={onOpen} />
    </span>
  );
}

export interface ViewSheetProps {
  /** The galaxy's short code. */
  shard: string;
  telescope: boolean;
  onToggleTelescope: () => void;
  /** Absent until the active world runs a Radar: no dead switch. */
  radar?: boolean;
  onToggleRadar?: () => void;
  onOpenEvents: () => void;
  onClose: () => void;
}

/**
 * ONE LAYER, ONE KIT SWITCH (C10): the instrument pictured beside the lever that draws
 * its reach. `data-sensor-toggle` names the instrument for the Academy's Telescope
 * exercise, which points at `[data-sensor-toggle="telescope"]`.
 */
function Layer({
  id,
  label,
  detail,
  on,
  onPress,
}: {
  id: 'telescope' | 'radar';
  label: string;
  detail: string;
  on: boolean;
  onPress: () => void;
}) {
  const art = instrumentArt(id === 'telescope' ? 'TELESCOPE' : 'RADAR', 1);
  return (
    <div data-sensor-toggle={id}>
      <Toggle checked={on} onChange={onPress} label={label} sub={detail} {...(art ? { art } : {})} />
    </div>
  );
}

/** The door to the events guide: a kit row that says where it goes. */
function EventsDoor({ label, onOpen }: { label: string; onOpen: () => void }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onOpen(); });
  return (
    <div className="gk-ledger">
      <button type="button" className="gk-ledger__row" {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick}>
        <span className="gk-ledger__mark gk-view__mark" aria-hidden="true"><Glyph id="timed" /></span>
        <span className="gk-ledger__words"><span className="gk-ledger__title">{label}</span></span>
        <span className="gk-ledger__mark" aria-hidden="true"><Glyph id="next" /></span>
      </button>
    </div>
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
 * C10: on the kit — its painted head, the kit's lever switches, a door to the guide.
 */
export function ViewSheet({
  shard,
  telescope,
  onToggleTelescope,
  radar,
  onToggleRadar,
  onOpenEvents,
  onClose,
}: ViewSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet title={t('view.title')} eyebrow={shard} onClose={onClose} kit={{ art: artIconSrc('hud-view'), tone: 'self' }}>
      <div className="gk gk-view">
        <SectionTag>{t('view.layers')}</SectionTag>
        {/*
          A LAYER IS SWITCHED TO BE SEEN: the sheet closes on the press so the circle
          it drew is on screen at once — and the Academy's Telescope exercise, which
          offers no close button, is never left under a sheet.
        */}
        <div className="gk-switches gk-view__layers">
          <Layer
            id="telescope"
            label={t('view.telescope')}
            detail={t('view.telescopeDetail')}
            on={telescope}
            onPress={() => { onToggleTelescope(); onClose(); }}
          />
          {radar !== undefined && onToggleRadar !== undefined && (
            <Layer
              id="radar"
              label={t('view.radar')}
              detail={t('view.radarDetail')}
              on={radar}
              onPress={() => { onToggleRadar(); onClose(); }}
            />
          )}
        </div>
        <EventsDoor label={t('view.events')} onOpen={onOpenEvents} />
      </div>
    </Sheet>
  );
}
