import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MISSION_PACES, type MissionPace } from '@astera/rules';
import { full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { durationPrecise } from '../lib/time.js';
import { Glyph } from '../game-ui/index.js';

/** Every speed the rules know, slow to fast: the bar's fixed stops, left to right. */
const RUNGS: readonly MissionPace[] = [...MISSION_PACES].sort((a, b) => a - b);
const SLOWEST = RUNGS[0] ?? 0.1;
/** Where a speed stands along the bar: the slowest at the left end, full speed at the right. */
const at = (pace: number): number => (pace - SLOWEST) / (1 - SLOWEST);

/**
 * THE FLIGHT SPEED, ONE THROTTLE ON EVERY LAUNCH THAT TAKES A PACE. Owner decisions, 2026-09-21
 * (one shape on every launch) and 2026-11-16 (a progress bar, not a row of buttons: a worm at
 * the slow end, a rocket at the fast one, a cold colour turning to flame).
 *
 * Every speed the rules know keeps its stop, so the bar never changes shape; the ones this flight
 * may not take are locked. A press or a drag anywhere on the bar lands on the nearest speed it may
 * take. The trade reads as two deltas under it — the fuel it saves, the time it adds — and the
 * sentence under the label is the caller's, because a raid is slowed to land on time and a
 * transfer to stay in the air.
 *
 * A single legal speed hides the control, except when explaining why a previous slower
 * selection now falls back to full speed.
 */
export function PaceRow({
  paces,
  pace,
  onChange,
  hint,
  brief,
  comparison,
  reset = false,
  ...data
}: {
  paces: readonly MissionPace[];
  pace: MissionPace;
  onChange: (pace: MissionPace) => void;
  /** The rule in a sentence, under the row. */
  hint?: string;
  /** The rule in a phrase, beside the label. */
  brief?: string;
  /** Personal flights opt in; prepaid clan strikes must not promise these savings. */
  comparison?: { fuel: number; fullFuel: number; minutes: number; fullMinutes: number };
  reset?: boolean;
} & Record<`data-${string}`, boolean>) {
  const { t } = useTranslation();
  const dragging = useRef(false);
  if (paces.length <= 1 && !reset) return null;
  const legal = (rung: number): boolean => paces.includes(rung as MissionPace);
  const pick = (rung: MissionPace): void => {
    if (rung === pace || !legal(rung)) return;
    playSound('tab');
    haptic(rung === 1 ? 'thunk' : 'tap');
    onChange(rung);
  };
  const nearest = (fraction: number): MissionPace => paces.reduce((best, rung) =>
    Math.abs(at(rung) - fraction) < Math.abs(at(best) - fraction) ? rung : best, paces[0] ?? 1);
  const follow = (event: PointerEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    pick(nearest(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))));
  };
  const step = (event: KeyboardEvent<HTMLDivElement>): void => {
    const by = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (by === 0) return;
    event.preventDefault();
    const open = RUNGS.filter(legal);
    const next = open[open.indexOf(pace) + by];
    if (next !== undefined) pick(next);
  };
  const saving = comparison ? Math.max(0, comparison.fullFuel - comparison.fuel) : 0;
  const delay = comparison ? durationPrecise(Math.max(0, Math.round(comparison.minutes * 60) - Math.round(comparison.fullMinutes * 60)) / 60) : '';
  const place: CSSProperties & Record<'--pace', string> = { '--pace': String(at(pace)) };
  return (
    <div {...data} className="gk-pace">
      <div className="gk-pace__head">
        <span className="gk-label">{t('launch.pace')}</span>
        {brief && <span className="gk-sub">{brief}</span>}
      </div>
      {paces.length > 1 && (
        <div data-pace-throttle className="gk-throttle" style={place} {...(pace === 1 ? { 'data-flat-out': '' } : {})}>
          <span data-pace-end="slow" className="gk-throttle__end gk-throttle__end--slow" aria-hidden="true"><Glyph id="worm" /></span>
          <div className="gk-throttle__rail">
            <div
              data-pace-track
              className="gk-throttle__track"
              aria-hidden="true"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                follow(event);
              }}
              onPointerMove={(event) => { if (dragging.current) follow(event); }}
              onPointerUp={() => { dragging.current = false; }}
              onPointerCancel={() => { dragging.current = false; }}
            >
              <span className="gk-throttle__fill" />
              <span className="gk-throttle__thumb" />
            </div>
            <div role="radiogroup" aria-label={t('launch.pace')} className="gk-throttle__rungs" onKeyDown={step} {...OWN_SOUND}>
              {RUNGS.map((rung) => {
                const stop: CSSProperties & Record<'--at', string> = { '--at': String(at(rung)) };
                return (
                  <button key={rung} type="button" role="radio" aria-checked={rung === pace} disabled={!legal(rung)}
                    tabIndex={rung === pace ? 0 : -1} className="gk-throttle__rung gk-num" style={stop} onClick={() => { pick(rung); }}>
                    {rung === 1 ? t('launch.paceFull') : t('units.percent', { value: Math.round(rung * 100) })}
                  </button>
                );
              })}
            </div>
          </div>
          <span data-pace-end="fast" className="gk-throttle__end gk-throttle__end--fast" aria-hidden="true"><Glyph id="rocket" /></span>
        </div>
      )}
      {reset && <p data-pace-reset role="status" className="gk-inote" data-tone="warn">{t('launch.paceReset')}</p>}
      {comparison && (
        <div data-pace-comparison aria-live="polite" aria-atomic="true" className="gk-pace__trade">
          <span className="gk-pace__side">
            <Glyph id="fuel" />
            <b data-pace-fuel className="gk-num">{t('launch.paceFuelValue', { amount: full(comparison.fuel) })}</b>
            {pace < 1 && (
              <span data-pace-saving className="gk-num" data-tone="self">
                <span aria-hidden="true">−{full(saving)}</span>
                <span className="sr-only">{t('launch.paceSaved', { amount: full(saving) })}</span>
              </span>
            )}
          </span>
          <span className="gk-pace__side">
            <Glyph id="clock" />
            <b data-pace-time className="gk-num">{durationPrecise(comparison.minutes)}</b>
            {pace < 1 && (
              <span data-pace-delay className="gk-num" data-tone="warn">
                <span aria-hidden="true">+{delay}</span>
                <span className="sr-only">{t('launch.paceDelay', { duration: delay })}</span>
              </span>
            )}
          </span>
        </div>
      )}
      {comparison && pace < 1 && saving === 0 && <p data-pace-zero-saving className="gk-sub">{t('launch.paceRounding')}</p>}
      {hint && <p className="gk-sub">{hint}</p>}
    </div>
  );
}
