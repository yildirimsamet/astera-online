import { useTranslation } from 'react-i18next';
import type { Contact } from '../../api/schemas.js';
import { describeNow, type NowEntry } from '../../lib/nowLine.js';
import type { FlightFocus } from '../../lib/flights.js';
import { clockTime, countdown } from '../../lib/time.js';
import { Icon } from '../icons.js';
import { Sheet } from '../kit/Sheet.js';

export interface NowLineProps {
  /** `nowEntries(...)`, most urgent first. */
  entries: readonly NowEntry[];
  /**
   * `nowEntries(..., 'sheet')`: what the sheet lists — the whole work queue, the orders behind
   * each lane's head marked waiting. The line's own entries when absent.
   */
  sheet?: readonly NowEntry[];
  /** Server time, ticking. */
  now: number;
  /** The disc's contacts, so an inbound line says whether the attacker is in sight. */
  contacts?: readonly Contact[];
  /**
   * The timers sheet, held by the shell: every move the shell makes closes it, so it
   * is never left open under a page the player went on to.
   */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onFocus?: (focus: FlightFocus) => void;
  /** Float over the galaxy when owned by the live shell; gallery examples remain in flow. */
  floating?: boolean;
}

/**
 * THE NOW LINE. Spec B2 (docs/ui-v2/gozlemevi.md).
 *
 * The single most urgent timer in the game, on one line under the top bar: a dot,
 * what it is, one clause, the countdown, and "+N" for the rest. Red belongs to an
 * enemy coming for you and to nothing else. When nothing is timed the line is not
 * drawn at all — an empty row is a row of nothing on a 350-wide screen.
 *
 * AN ENEMY IS ANNOUNCED ONCE. The title is the live region, not the countdown: a
 * region that changes every second would read the clock aloud forever.
 *
 * A tap opens every timer, each with its countdown and the clock time it lands
 * at — the answer a countdown otherwise makes the player compute.
 */
export function NowLine({ entries, sheet = entries, now, contacts = [], open, onOpen, onClose, onFocus, floating = false }: NowLineProps) {
  const { t } = useTranslation();
  const head = entries[0];
  if (!head) return null;
  /** How many more the sheet holds: the line promises what one tap shows. */
  const more = Math.max(entries.length, sheet.length) - 1;

  const enemy = head.kind === 'incoming';
  const { title, detail } = describeNow(head, contacts);

  return (
    <>
      {/* An inset card under the top bar, as the mock draws it — not a strip bled to the edges. */}
      <div {...(floating ? { 'data-now-float': '' } : {})}
        className={`${floating ? 'pointer-events-none absolute inset-x-0 top-full z-20' : ''} px-2.5 pt-2`}>
      <button
        type="button"
        data-now-line=""
        data-tone={enemy ? 'hostile' : 'self'}
        onClick={onOpen}
        className={`flex h-8 w-full items-center gap-2 rounded-control border px-3 text-left font-v2-ui ${
          enemy ? 'pointer-events-auto border-v2-hostile/50 bg-v2-deep/65' : 'pointer-events-auto border-v2-line/80 bg-v2-deep/55'
        }`}
      >
        <span className="sr-only">{t('now.label')}</span>
        {/* Something is running: the dot beats for every timer (owner, 2026-09-24), in its owner's colour. */}
        <span
          aria-hidden="true"
          data-now-dot=""
          className={`size-2 shrink-0 animate-pulse rounded-full ${enemy ? 'bg-v2-hostile' : 'bg-v2-self'}`}
        />
        <span
          {...(enemy ? { 'aria-live': 'polite' as const } : {})}
          className="min-w-0 shrink truncate text-caption font-semibold text-v2-ink"
        >
          {title}
        </span>
        {detail && <span className="min-w-0 flex-1 truncate text-micro text-v2-ink-3">{detail}</span>}
        {!detail && <span className="flex-1" />}
        <span className={`shrink-0 font-v2-mono text-caption tabular-nums ${enemy ? 'text-v2-hostile' : 'text-v2-ink'}`}>
          {countdown(head.at - now)}
        </span>
        {more > 0 && (
          <span className="shrink-0 font-v2-mono text-micro text-v2-ink-3">+{more}</span>
        )}
      </button>
      </div>

      {open && (
        <Sheet title={t('now.sheet')} onClose={onClose}>
          <ul className="flex flex-col">
            {sheet.map((entry) => {
              const said = describeNow(entry, contacts);
              const hostile = entry.kind === 'incoming';
              const focus = 'focus' in entry ? entry.focus : undefined;
              const queued = 'waiting' in entry && entry.waiting;
              const row = <>
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${hostile ? 'bg-v2-hostile' : 'bg-v2-self'}`} />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-caption font-semibold text-v2-ink">{said.title}</span>
                  {said.detail && <span className="truncate text-micro text-v2-ink-3">{said.detail}</span>}
                </span>
                {/*
                  AN ORDER BEHIND THE HEAD OF ITS LANE HAS NO RUNNING CLOCK (owner, 2026-10-06):
                  it wears the Base lane's own hourglass and "Queued", never a countdown that
                  reads as work already under way.
                */}
                {queued ? (
                  <span data-waiting="" className="inline-flex shrink-0 items-center gap-0.5 font-v2-mono text-caption text-v2-warn">
                    <Icon id="i-hourglass" className="size-3 shrink-0" />
                    {t('planet.queue.waiting')}
                  </span>
                ) : (
                  <span className="grid shrink-0 justify-items-end">
                    <span className={`font-v2-mono text-caption tabular-nums ${hostile ? 'text-v2-hostile' : 'text-v2-ink'}`}>
                      {countdown(entry.at - now)}
                    </span>
                    <span className="font-v2-mono text-micro text-v2-ink-3">
                      {t('now.at', { time: clockTime(new Date(entry.at)) })}
                    </span>
                  </span>
                )}
              </>;
              return (
                <li
                  key={`${entry.kind}:${String(entry.at)}:${said.title}`}
                  className="border-b border-v2-line/60 last:border-b-0"
                >
                  {focus && onFocus ? (
                    <button type="button" aria-label={said.title}
                      onClick={() => { onClose(); onFocus(focus); }}
                      className="flex w-full items-center gap-2 py-2 text-left transition-colors hover:bg-v2-self/5 active:bg-v2-self/10 focus-visible:outline-2 focus-visible:outline-v2-self">
                      {row}
                    </button>
                  ) : <div className="flex items-center gap-2 py-2">{row}</div>}
                </li>
              );
            })}
          </ul>
        </Sheet>
      )}
    </>
  );
}
