import { ABUSE, NEWCOMER_HOUR, UNKNOWN_SIGNAL } from '@astera/rules';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StatusChip } from '../../game-ui/index.js';
import { factor } from '../../lib/format.js';
import { countdown, duration } from '../../lib/time.js';

export interface StatusLineProps {
  /** Server time. */
  now: number;
  /** The world the top bar is reading — only once the commander holds a second one. */
  world: { capital: boolean; name: string } | null;
  /** The attack shield, while one is set (`season.shieldUntil`, `shieldKind`). */
  shield: { until: number; kind: 'NEWCOMER' | 'RECOVERY' } | null;
  /** The recovery boost on the active world (`productionBoostUntil`). */
  recoveryUntil: number | null;
  /** The unknown signal's production boost on the active world (`signalBoostUntil`). */
  signalUntil: number | null;
  /** Kuruluş Saati on the active world (`newcomerBoostUntil`): five-fold alloy and crystal. */
  newcomerUntil: number | null;
  vacationUntil: number | null;
  /** The worlds sheet. */
  onWorld: () => void;
  /** What a chip means, said where the player asked (the shell's toast). */
  onHint: (text: string) => void;
}

/** The founding hour's last stretch, when its chip turns amber. */
const FOUNDING_LAST_MS = 10 * 60_000;

/** Time left on a chip, rounded down so it never promises time it does not have. */
function chipTime(ms: number, t: TFunction): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes >= 24 * 60) return t('units.daysHours', { d: Math.floor(minutes / 1_440), h: Math.floor((minutes % 1_440) / 60) });
  if (minutes >= 60) return t('topBar.hours', { h: Math.floor(minutes / 60) });
  return t('units.minutes', { m: Math.max(1, minutes) });
}

/**
 * WHAT HOLDS OVER YOUR WORLDS (G1-b, 2026-11-14). It floats over the galaxy under the
 * top bar, so it costs the scene no row, and draws nothing while nothing holds.
 *
 * The world being read, once there are two; the shield ("am I safe?" is the first thing
 * a player asks when the game opens) and the boosts, each a chip of its colour with its
 * time left; a vacation. (The gift went to the galaxy's tools, H1.) A press on an effect says what
 * it means. The recovery boost wears the shield's colour: the two are one story
 * (owner, 2026-09-16), and it folds into the signal's factor while both run.
 */
export function StatusLine({ now, world, shield, recoveryUntil, signalUntil, newcomerUntil, vacationUntil, onWorld, onHint }: StatusLineProps) {
  const { t, i18n } = useTranslation();
  const shieldLeft = shield ? shield.until - now : 0;
  const recoveryLeft = recoveryUntil === null ? 0 : recoveryUntil - now;
  const signalLeft = signalUntil === null ? 0 : signalUntil - now;
  const newcomerLeft = newcomerUntil === null ? 0 : newcomerUntil - now;
  const vacationLeft = vacationUntil === null ? 0 : vacationUntil - now;
  const shielded = shield !== null && shieldLeft > 0;
  const signal = signalLeft > 0;
  const recovery = recoveryLeft > 0 && !signal;
  const founding = newcomerLeft > 0;
  const vacation = vacationUntil !== null && vacationLeft > 0;
  if (!world && !shielded && !recovery && !signal && !founding && !vacation) return null;
  // What alloy and crystal run at while the hour lasts: the windows add, as on the server.
  const foundingFactor = 1 + NEWCOMER_HOUR.productionBonus + (signal ? UNKNOWN_SIGNAL.energyProductionBonus : 0)
    + (recoveryLeft > 0 ? ABUSE.recoveryProductionMult - 1 : 0);

  return (
    <div data-status-line="" className="pointer-events-none flex flex-col items-start pl-[var(--gk-gutter)] [&_button]:pointer-events-auto">
      {world && (
        // One of the pills, not a square of its own (owner 2026-11-17, ek-14); the drop mark says a list opens.
        <StatusChip glyph={world.capital ? 'home' : 'colony'} tone="self" named drop
          label={t(world.capital ? 'statusBar.capitalWorld' : 'statusBar.colonyWorld', { name: world.name })}
          value={world.name} onPress={onWorld} />
      )}
      {founding && (
        // Counted to the second, and amber for its last ten minutes: the hour is worth not leaving (plan 2026-11-20 §4).
        <StatusChip
          glyph="up"
          tone={newcomerLeft <= FOUNDING_LAST_MS ? 'warn' : 'self'}
          label={t('statusBar.founding.name')}
          value={factor(foundingFactor)}
          until={countdown(newcomerLeft)}
          onPress={() => { onHint(t('statusBar.founding.hint', { time: countdown(newcomerLeft) })); }}
        />
      )}
      {shield && shielded && (
        <StatusChip
          glyph="shield"
          tone="good"
          label={t(shield.kind === 'RECOVERY' ? 'statusBar.recoveryShield.name' : 'statusBar.newcomerShield.name')}
          value={chipTime(shieldLeft, t)}
          onPress={() => {
            onHint(t(shield.kind === 'RECOVERY' ? 'statusBar.recoveryShield.hint' : 'statusBar.newcomerShield.hint', { duration: duration(shieldLeft / 60_000) }));
          }}
        />
      )}
      {recovery && (
        <StatusChip
          glyph="up"
          tone="good"
          label={t('statusBar.recoveryBoost.name')}
          value={t('statusBar.recoveryBoost.value')}
          until={chipTime(recoveryLeft, t)}
          onPress={() => { onHint(t('statusBar.recoveryBoost.note')); }}
        />
      )}
      {signal && (
        <StatusChip
          glyph="up"
          tone="self"
          label={t('unknownSignal.boostName')}
          value={factor(recoveryLeft > 0 ? 2.5 : 2)}
          until={chipTime(signalLeft, t)}
          onPress={() => { onHint(t('unknownSignal.boostDetail', { time: countdown(signalLeft) })); }}
        />
      )}
      {vacation && (
        <StatusChip
          glyph="timed"
          tone="info"
          label={t('vacation.title')}
          value={chipTime(vacationLeft, t)}
          onPress={() => {
            onHint(t('vacation.until', { time: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(vacationUntil) }));
          }}
        />
      )}
    </div>
  );
}
