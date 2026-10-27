import { useTranslation } from 'react-i18next';
import { ADMIRAL_XP, ARENA_ECONOMY, type ShipClass } from '@astera/rules/arena';
import { arenaCopy } from '../arena/copy.js';
import { clockText } from '../arena/hangarDesk.js';
import { SHIP_TONE } from '../arena/shipTone.js';
import type { Escort } from '../lib/admiralEscort.js';
import { useNow } from '../lib/time.js';

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
    <div data-launch-escort={escort.kind} className="grid gap-1 font-v2-ui" style={{ '--ship': SHIP_TONE[escort.ship] } as React.CSSProperties}>
      <button
        type="button"
        role="switch"
        aria-checked={lit}
        aria-label={t('launch.escort')}
        disabled={!ready}
        onClick={() => { onChange(!on); }}
        className="flex w-full items-center gap-2.5 rounded-control border border-v2-line bg-v2-panel/60 px-2 py-1.5 text-left disabled:cursor-default"
        style={lit ? { borderColor: 'color-mix(in srgb, var(--ship) 45%, transparent)' } : undefined}
      >
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border"
          style={{ color: ready ? 'var(--ship)' : undefined, borderColor: 'color-mix(in srgb, var(--ship) 35%, transparent)' }}>
          <svg viewBox="0 0 24 24" className={`size-3.5 ${ready ? '' : 'text-v2-ink-3'}`} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">{MARKS[escort.ship]}</svg>
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="text-micro uppercase leading-tight tracking-label text-v2-ink-3">{t('launch.escortLabel')}</span>
          <span className="flex items-baseline gap-1.5 text-caption">
            <span className="font-semibold text-v2-ink">{c.classes[escort.ship].name}</span>
            <span className="font-v2-mono text-micro tabular-nums text-v2-ink-3">{c.level(escort.level)}</span>
          </span>
          {escort.kind === 'ready'
            ? <span data-escort-bonus className="font-v2-mono text-micro tabular-nums" style={{ color: 'var(--ship)' }}>{gives}</span>
            : <span data-escort-busy className="font-v2-mono text-micro tabular-nums text-v2-warn"><BusyLine escort={escort} now={now} /></span>}
        </span>
        <span aria-hidden className={`relative h-5 w-9 shrink-0 rounded-full border ${lit ? '' : 'border-v2-line bg-v2-raise'} ${ready ? '' : 'opacity-40'}`}
          style={lit ? { borderColor: 'color-mix(in srgb, var(--ship) 60%, transparent)', background: 'color-mix(in srgb, var(--ship) 22%, transparent)' } : undefined}>
          <span className={`absolute top-0.5 size-3.5 rounded-full ${lit ? 'right-0.5' : 'left-0.5 bg-v2-ink-3'}`} style={lit ? { background: 'var(--ship)' } : undefined} />
        </span>
      </button>
      {ready && <p className="px-1 text-micro leading-snug text-v2-ink-3">{t(defence ? 'launch.escortRuleDefence' : 'launch.escortRule', { minutes: ARENA_ECONOMY.repairMinutes })}</p>}
      {/* F23: what it earns, beside what it risks, and the service every return costs. */}
      {ready && <p data-escort-gain className="px-1 text-micro leading-snug text-v2-ink-2">
        {monument && `${t('launch.escortMonument')} `}{t('launch.escortGain', { min: ADMIRAL_XP.min, max: ADMIRAL_XP.max, idle: ADMIRAL_XP.idle, service: ARENA_ECONOMY.serviceMinutes })}</p>}
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
