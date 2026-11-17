import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Contact } from '../../api/schemas.js';
import { TimerPlate, TimerRow, artIconSrc } from '../../game-ui/index.js';
import { describeNow, nowGlyph, nowSpan, nowTone, type NowEntry } from '../../lib/nowLine.js';
import type { FlightFocus } from '../../lib/flights.js';
import { clockTime, countdown } from '../../lib/time.js';
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
}

/**
 * THE NOW LINE. Spec B2 (docs/ui-v2/gozlemevi.md); on the game kit since G1-c (2026-11-14).
 *
 * The single most urgent timer in the game, as a plate under the status line: a ring that
 * drains as its time runs out, with the mark of what it is; the time, large; what it is and
 * one clause; and "+N" for the rest. Red belongs to an enemy coming for you and to nothing
 * else. When nothing is timed the plate is not drawn at all.
 *
 * AN ENEMY IS ANNOUNCED ONCE. The title is the live region, not the countdown: a
 * region that changes every second would read the clock aloud forever.
 *
 * A tap opens every timer under a painted stopwatch, each with its countdown and the clock
 * time it lands at — the answer a countdown otherwise makes the player compute — and the
 * order they are listed in, so an enemy an hour out above a transfer landing in a minute
 * reads as the rule it is.
 */
export function NowLine({ entries, sheet = entries, now, contacts = [], open, onOpen, onClose, onFocus }: NowLineProps) {
  const { t } = useTranslation();
  const head = entries[0];
  if (!head) return null;
  /** How many more the sheet holds: the plate promises what one tap shows. */
  const more = Math.max(entries.length, sheet.length) - 1;
  /** The ring's reading: the time left over the whole, or no whole at all. */
  const ring = (entry: NowEntry): { remaining: number; total: number } => {
    const span = nowSpan(entry, contacts);
    return span ? { remaining: entry.at - now, total: span.to - span.from } : { remaining: 0, total: 0 };
  };
  const { title, detail } = describeNow(head, contacts);
  const tone = nowTone(head);

  return (
    <>
      {/* `data-now-line` is the line's handle for the shell and the visual tools; it wears the tone. */}
      <div data-now-line="" data-tone={tone} className="px-[var(--gk-gutter)] pt-1 [&_button]:pointer-events-auto">
        <TimerPlate
          // A new head drops in, so the plate answers what just changed.
          key={`${head.kind}:${String(head.at)}:${title}`}
          tone={tone}
          glyph={nowGlyph(head)}
          {...ring(head)}
          time={countdown(head.at - now)}
          title={title}
          {...(detail ? { detail } : {})}
          more={more}
          live={tone === 'hostile'}
          label={t('now.label')}
          onPress={onOpen}
        />
      </div>

      {/*
        The board opens over the whole game, not in the layer the plate floats in: inside it,
        the galaxy's cards drew over the sheet (found on the phone, 2026-11-14).
      */}
      {open && createPortal(
        <Sheet
          title={t('now.sheet')}
          kit={{
            art: artIconSrc('hud-timers'),
            tone: sheet.some((entry) => entry.kind === 'incoming') ? 'hostile' : 'self',
            meta: <span className="gk-sub">{t('now.order')}</span>,
          }}
          onClose={onClose}
        >
          <ul className="gk-tlist">
            {sheet.map((entry) => {
              const said = describeNow(entry, contacts);
              const focus = 'focus' in entry ? entry.focus : undefined;
              /*
                AN ORDER BEHIND THE HEAD OF ITS LANE HAS NO RUNNING CLOCK (owner, 2026-10-06):
                it wears the Base lane's own hourglass and "Queued", never a countdown that
                reads as work already under way.
              */
              const queued = 'waiting' in entry && entry.waiting;
              return (
                <li key={`${entry.kind}:${String(entry.at)}:${said.title}`}>
                  <TimerRow
                    tone={nowTone(entry)}
                    glyph={nowGlyph(entry)}
                    {...ring(entry)}
                    title={said.title}
                    {...(said.detail ? { detail: said.detail } : {})}
                    {...(queued
                      ? { waiting: t('planet.queue.waiting') }
                      : { time: countdown(entry.at - now), at: t('now.at', { time: clockTime(new Date(entry.at)) }) })}
                    {...(focus && onFocus ? { onPress: () => { onClose(); onFocus(focus); } } : {})}
                  />
                </li>
              );
            })}
          </ul>
        </Sheet>,
        document.body,
      )}
    </>
  );
}
