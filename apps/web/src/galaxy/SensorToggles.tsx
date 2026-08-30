import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { haptic } from '../lib/haptics.js';
import { RadarIcon, TelescopeIcon } from '../ui/icons/index.js';

/**
 * TURN THE BOUNDARIES OFF, AND ON. Owner instruction.
 *
 * The Telescope shell and the Radar volumes are the only things in this game that
 * are drawn BETWEEN the camera and the worlds. They are also where D124's whole
 * principle lives — a rule the player cannot see is not a rule — so they cannot
 * simply be made quieter until they stop mattering. Both facts are true at once,
 * and a switch is what lets them both be true: the instruments state the rule, and
 * a player who wants to look at the galaxy for a moment can take them off the
 * glass and put them straight back.
 *
 * TWO MARKS, AND THEY ARE THE INSTRUMENTS' OWN GLYPHS. The same Telescope and
 * Radar icons the orbit sheet, the intel screen and every upgrade row already use,
 * so nothing has to say which switch is which. `docs/visual-design.md`: a labelled
 * button in the corner of a map reads as browser chrome — the note that made the
 * disc controls glyphs in the first place, and it applies to these for the same
 * reason.
 *
 * ON IS LIT AND OFF IS DRAINED, which is the state pair `SoundSwitch` already
 * uses. `aria-pressed` carries it for a screen reader rather than a label that
 * changes underneath the player.
 *
 * THEY SIT UNDER THE DISC READOUT rather than in the `DiscControls` grid on the
 * other side. That grid is four ways OFF the disc — research, worlds, intel, the
 * clan — and these two go nowhere. Mixing a switch into a row of doors teaches
 * that the doors might be switches.
 */
export function SensorToggles({
  telescope,
  radar,
  onToggleTelescope,
  onToggleRadar,
}: {
  telescope: boolean;
  onToggleTelescope: () => void;
  /**
   * THE RADAR SWITCH ONLY EXISTS IF THERE IS A RADAR. Owner instruction.
   *
   * The Telescope switch is always meaningful: the naked-eye neighbourhood is
   * free, so every commander has a boundary to draw whether or not they ever
   * installed the instrument. A Radar circle is hardware. A switch that draws
   * nothing when pressed teaches that the pair is decorative, which costs the
   * Telescope switch its credibility as well as its own.
   *
   * Absent rather than disabled: a greyed control still says "there is a thing
   * here you cannot have", and the row is two glyphs on a map, not a shop.
   */
  radar?: boolean;
  onToggleRadar?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div data-sensor-toggles className="pointer-events-auto mt-2 flex gap-2">
      <Switch
        id="telescope"
        on={telescope}
        label={t(telescope ? 'galaxy.hideTelescope' : 'galaxy.showTelescope')}
        onPress={onToggleTelescope}
      >
        <TelescopeIcon className="size-[18px]" />
      </Switch>
      {radar !== undefined && onToggleRadar !== undefined && (
        <Switch
          id="radar"
          on={radar}
          label={t(radar ? 'galaxy.hideRadar' : 'galaxy.showRadar')}
          onPress={onToggleRadar}
        >
          <RadarIcon className="size-[18px]" />
        </Switch>
      )}
    </div>
  );
}

/**
 * ONE SWITCH, AT THE SIZE A THUMB HITS.
 *
 * 36px rather than the disc controls' 40: these sit under a readout in the corner
 * rather than in the thumb's own arc, and the pair must not out-weigh the caption
 * they hang from. Still comfortably over the 32px floor `interface.md` sets for a
 * control that is pressed rather than merely tapped past.
 */
function Switch({
  id,
  on,
  label,
  onPress,
  children,
}: {
  id: string;
  on: boolean;
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-sensor-toggle={id}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={() => {
        haptic('tap');
        onPress();
      }}
      className={`relative grid size-9 place-items-center rounded-chip border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-crystal/70 ${
        on
          ? 'border-crystal/40 bg-crystal/10 text-crystal'
          : 'border-line-soft bg-deep/70 text-faint hover:text-dim'
      }`}
    >
      {children}
      {/*
        OFF IS A STRUCK-THROUGH GLYPH, NOT ONLY A DIMMER ONE. Colour alone is the
        one thing a state pair may never rest on: about one player in twelve cannot
        separate these two hues, and "is my radar drawn" is then unanswerable
        without pressing the button to find out.
      */}
      {!on && (
        <span
          aria-hidden
          className="pointer-events-none absolute h-px w-5 rotate-45 bg-faint"
        />
      )}
    </button>
  );
}
