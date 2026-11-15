import { useTranslation } from 'react-i18next';
import { ADMIRAL_WAIT, ADMIRAL_XP, type ShipClass } from '@astera/rules/arena/ui';
import { arenaCopy } from '../arena/copy.js';
import { clockText } from '../arena/hangarDesk.js';
import { SHIP_TONE } from '../arena/shipTone.js';
import type { Escort } from '../lib/admiralEscort.js';
import { useNow } from '../lib/time.js';
import { Toggle } from '../game-ui/index.js';

/** What each class lends, as one glyph on the Gözlemevi grid: the strike, the shield, the route. */
const MARKS: Record<ShipClass, React.ReactNode> = {
  akinci: <path d="M13.5 3 6 13.5h5.5L10 21l8-11h-5.5z" />,
  muhafiz: <path d="M12 3.5l7 2.8v5.2c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6.3z" />,
  kilavuz: <><path d="M5 7l5 5-5 5M12 7l5 5-5 5" /></>,
};

const pct = (factor: number): number => Math.round(Math.abs(factor - 1) * 100);

/**
 * THE COMMANDER SHIP AS A RAID ESCORT (Y9), one row on the raid sheet.
 *
 * The row states the three things the choice turns on: who flies (class and level, in the class's
 * own colour), what it lends (the bonus, in the numbers the route and fight will use), and what it
 * risks (repair after a lost battle), and what it earns (ship XP by the battle's size). A busy ship
 * keeps the row with its reason and clock, so the player learns when it can fly instead of finding
 * the control gone.
 */
export function EscortRow({ escort, on, onChange, now, defence = false, monument = false }: {
  escort: Escort | null; on: boolean; onChange: (on: boolean) => void;
  /** A support wave: only a decisive defeat of the line sends it to repair. */
  defence?: boolean;
  /** A monument raid: a monument won keeps the fleet there, and the ship comes home on its own. */
  monument?: boolean;
  /** Pinned in tests; the row otherwise counts the repair down on its own clock. */
  now?: number;
}) {
  const { t } = useTranslation();
  if (!escort) return null;
  const c = arenaCopy();
  const ready = escort.kind === 'ready';
  const lit = ready && on;
  const gives = !ready ? null : escort.ship === 'akinci'
    ? t('launch.escortBonusAkinci', { pct: pct(escort.bonuses.damage) })
    : escort.ship === 'muhafiz'
      ? t('launch.escortBonusMuhafiz', { pct: pct(escort.bonuses.hull) })
      : t('launch.escortBonusKilavuz', { time: pct(escort.bonuses.time), fuel: pct(escort.bonuses.fuel) });
  return (
    <div data-launch-escort={escort.kind} className="gk-escort" style={{ '--ship': SHIP_TONE[escort.ship] } as React.CSSProperties}>
      <Toggle
        checked={lit}
        onChange={onChange}
        locked={!ready}
        spoken={t('launch.escort')}
        label={(
          <span className="gk-escort__who">
            <span aria-hidden className="gk-escort__mark" {...(ready ? {} : { 'data-busy': '' })}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">{MARKS[escort.ship]}</svg>
            </span>
            <span className="gk-escort__name">
              <span className="gk-label">{t('launch.escortLabel')}</span>
              <span>{c.classes[escort.ship].name} <span className="gk-num gk-escort__level">{c.level(escort.level)}</span></span>
            </span>
          </span>
        )}
        sub={escort.kind === 'ready'
          ? <span data-escort-bonus className="gk-num gk-escort__gives">{gives}</span>
          : <span data-escort-busy className="gk-num gk-escort__busy"><BusyLine escort={escort} now={now} /></span>}
      />
      {ready && <p className="gk-sub">{t(defence ? 'launch.escortRuleDefence' : 'launch.escortRule', { minutes: ADMIRAL_WAIT.repairMinutes })}</p>}
      {/* F23: what it earns, beside what it risks, and the service every return costs. */}
      {ready && <p data-escort-gain className="gk-sub gk-escort__gain">
        {monument && `${t('launch.escortMonument')} `}{t('launch.escortGain', { min: ADMIRAL_XP.min, max: ADMIRAL_XP.max, idle: ADMIRAL_XP.idle, service: ADMIRAL_WAIT.serviceMinutes })}</p>}
    </div>
  );
}

/** Why a busy ship stays home; a repair or maintenance with its clock running down. */
function BusyLine({ escort, now }: { escort: Extract<Escort, { kind: 'busy' }>; now: number | undefined }) {
  const { t } = useTranslation();
  const live = useNow();
  const at = now ?? live;
  if (escort.reason === 'yarik') return t('launch.escortYarik');
  if (escort.reason === 'admiral') return t('launch.escortAway');
  return t(escort.reason === 'repair' ? 'launch.escortRepair' : 'launch.escortService', { clock: clockText((escort.until ?? at) - at) });
}
