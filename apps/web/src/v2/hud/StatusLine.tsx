import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Chip, Glyph, RoundButton, StatusChip, artIconSrc } from '../../game-ui/index.js';
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
  vacationUntil: number | null;
  /** Rewards ready to claim (`useRewards().claimable`). */
  rewards: number;
  /** The worlds sheet. */
  onWorld: () => void;
  onRewards: () => void;
  /** What a chip means, said where the player asked (the shell's toast). */
  onHint: (text: string) => void;
}

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
 * time left; a vacation; a reward waiting to be claimed. A press on an effect says what
 * it means. The recovery boost wears the shield's colour: the two are one story
 * (owner, 2026-09-16), and it folds into the signal's factor while both run.
 */
export function StatusLine({ now, world, shield, recoveryUntil, signalUntil, vacationUntil, rewards, onWorld, onRewards, onHint }: StatusLineProps) {
  const { t, i18n } = useTranslation();
  const shieldLeft = shield ? shield.until - now : 0;
  const recoveryLeft = recoveryUntil === null ? 0 : recoveryUntil - now;
  const signalLeft = signalUntil === null ? 0 : signalUntil - now;
  const vacationLeft = vacationUntil === null ? 0 : vacationUntil - now;
  const shielded = shield !== null && shieldLeft > 0;
  const signal = signalLeft > 0;
  const recovery = recoveryLeft > 0 && !signal;
  const vacation = vacationUntil !== null && vacationLeft > 0;
  if (!world && !shielded && !recovery && !signal && !vacation && rewards <= 0) return null;

  return (
    <div data-status-line="" className="pointer-events-none flex flex-wrap items-center gap-x-1 pl-[calc(var(--gk-gutter)-2px)] pr-1.5 [&_button]:pointer-events-auto">
      {world && (
        <Chip label={t(world.capital ? 'statusBar.capitalWorld' : 'statusBar.colonyWorld', { name: world.name })} onPress={onWorld}>
          <Glyph id={world.capital ? 'home' : 'colony'} />
          {world.name}
        </Chip>
      )}
      {shield && shielded && (
        <StatusChip
          glyph="shield"
          tone="info"
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
          tone="info"
          label={t('statusBar.recoveryBoost.name')}
          value={t('statusBar.recoveryBoost.value')}
          until={chipTime(recoveryLeft, t)}
          onPress={() => { onHint(t('statusBar.recoveryBoost.note')); }}
        />
      )}
      {signal && (
        <StatusChip
          glyph="up"
          tone="good"
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
      {rewards > 0 && (
        <RoundButton art={artIconSrc('gift')} label={`${t('rewards.title')} · ${t('rewards.waiting', { count: rewards })}`} count={rewards} onPress={onRewards} />
      )}
    </div>
  );
}
