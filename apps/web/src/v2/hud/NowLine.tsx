import { useTranslation } from 'react-i18next';
import type { Contact } from '../../api/schemas.js';
import { describeNow, type NowEntry } from '../../lib/nowLine.js';
import { clockTime, countdown } from '../../lib/time.js';
import { Sheet } from '../kit/Sheet.js';

export interface NowLineProps {
  /** `nowEntries(...)`, most urgent first. */
  entries: readonly NowEntry[];
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
export function NowLine({ entries, now, contacts = [], open, onOpen, onClose }: NowLineProps) {
  const { t } = useTranslation();
  const head = entries[0];
  if (!head) return null;

  const enemy = head.kind === 'incoming';
  const { title, detail } = describeNow(head, contacts);

  return (
    <>
      {/* An inset card under the top bar, as the mock draws it — not a strip bled to the edges. */}
      <div className="px-2.5 pt-2">
      <button
        type="button"
        data-tone={enemy ? 'hostile' : 'self'}
        onClick={onOpen}
        className={`flex h-8 w-full items-center gap-2 rounded-control border px-3 text-left font-v2-ui ${
          enemy ? 'border-v2-hostile/50 bg-v2-hostile/15' : 'border-v2-line bg-v2-panel/85'
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
        {entries.length > 1 && (
          <span className="shrink-0 font-v2-mono text-micro text-v2-ink-3">+{entries.length - 1}</span>
        )}
      </button>
      </div>

      {open && (
        <Sheet title={t('now.sheet')} onClose={onClose}>
          <ul className="flex flex-col">
            {entries.map((entry) => {
              const said = describeNow(entry, contacts);
              const hostile = entry.kind === 'incoming';
              return (
                <li
                  key={`${entry.kind}:${String(entry.at)}:${said.title}`}
                  className="flex items-center gap-2 border-b border-v2-line/60 py-2 last:border-b-0"
                >
                  <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${hostile ? 'bg-v2-hostile' : 'bg-v2-self'}`} />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-caption font-semibold text-v2-ink">{said.title}</span>
                    {said.detail && <span className="truncate text-micro text-v2-ink-3">{said.detail}</span>}
                  </span>
                  <span className="grid shrink-0 justify-items-end">
                    <span className={`font-v2-mono text-caption tabular-nums ${hostile ? 'text-v2-hostile' : 'text-v2-ink'}`}>
                      {countdown(entry.at - now)}
                    </span>
                    <span className="font-v2-mono text-micro text-v2-ink-3">
                      {t('now.at', { time: clockTime(new Date(entry.at)) })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Sheet>
      )}
    </>
  );
}
