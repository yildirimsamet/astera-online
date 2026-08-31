import { useTranslation } from 'react-i18next';
import { BUILD, cancelRefund } from '@astera/rules';
import type { BuildOrderView } from '../api/schemas.js';
import { buildOrderArt, buildOrderLabel } from '../lib/orders.js';
import { clockTime, countdown } from '../lib/time.js';

/**
 * ONE LANE OF WORK, AS A TIMELINE. Owner instruction.
 *
 * The queue was three stacked rows — an index, a name, a clock and the word
 * "Cancel" — and only the first row said anything about time at all. Two things a
 * player actually wants were nowhere on it:
 *
 *   · HOW THE ORDERS COMPARE. A Bulwark is not a Wasp and the list did not say so;
 *     both were one row of the same height with a clock nobody lines up side by
 *     side. Here the segment IS the duration, so the long one is the wide one.
 *   · WHEN THE WHOLE LANE IS DONE. The figure that decides whether to queue a
 *     fourth thing, and it appeared on no screen in the game.
 *
 * THE HEAD IS THE ONLY THING RUNNING, so it is the only one that fills. The rest
 * are committed, not started, and drawing them as partially done would be a lie
 * about a queue that processes one order at a time (D4).
 *
 * EMPTY SLOTS ARE STILL DRAWN (`interface.md` I6b): anything rationed into slots is
 * a rack, and how much room is left has to be visible without counting.
 *
 * CANCELLING IS A MARK ON THE SEGMENT rather than a word on every row. The word
 * spent three columns of a phone screen on every order, forever, to offer a thing
 * a player does once in a session.
 */
export function QueueStrip({
  label,
  orders,
  now,
  cancelling,
  onCancel,
}: {
  label: string;
  orders: readonly BuildOrderView[];
  /** Server time, ticking, so the head fills without the row re-fetching. */
  now: number;
  cancelling?: string;
  /** Omit for irreversible lanes such as commander research. */
  onCancel?: (order: BuildOrderView) => void;
}) {
  const { t } = useTranslation();

  const timed = orders.map((order) => {
    const startedAt = order.startedAt instanceof Date ? order.startedAt : null;
    const finishesAt = order.finishesAt instanceof Date ? order.finishesAt : null;
    return {
      order,
      startedAt,
      finishesAt,
      minutes: startedAt && finishesAt
        ? Math.max(0, (finishesAt.getTime() - startedAt.getTime()) / 60_000)
        : 0,
    };
  });
  const span = timed.reduce((sum, entry) => sum + entry.minutes, 0);
  const lastFinish = timed.reduce<Date | null>(
    (latest, entry) => (entry.finishesAt && (!latest || entry.finishesAt > latest)
      ? entry.finishesAt
      : latest),
    null,
  );
  const free = Math.max(0, BUILD.queueDepth - orders.length);

  return (
    <div className="flex flex-col gap-2 border-b border-line-soft px-3 py-3 last:border-b-0">
      <div className="flex items-baseline gap-2">
        <h3 className="legend text-crystal/80">{label}</h3>
        <span className="h-px flex-1 bg-gradient-to-r from-line-soft to-transparent" />
        {/*
          THE END OF THE WORK. Absolute, for the same reason research is (D140): a
          queue runs for hours while nobody watches it, and "done at 21:40" is the
          answer a countdown makes the player compute against their own evening.
        */}
        {lastFinish && (
          <span data-lane-ends className="num text-micro text-faint">
            {t('planet.queue.ends', { time: clockTime(lastFinish) })}
          </span>
        )}
      </div>

      <div className="flex h-11 w-full items-stretch gap-1">
        {timed.map((entry, index) => {
          const { order, startedAt, finishesAt, minutes } = entry;
          /*
            A SHORT ORDER STILL HAS TO BE A THING ON SCREEN. A one-minute Wasp
            beside a ten-hour Death Star is 0.2% of the strip; the floor keeps it
            pressable and countable without making it look longer than it is.
          */
          const width = span > 0 ? Math.max(9, (minutes / span) * 100) : 100 / orders.length;
          const running = index === 0 && startedAt !== null && finishesAt !== null;
          const progress = running
            ? Math.max(0, Math.min(1, (now - startedAt.getTime()) / Math.max(1, finishesAt.getTime() - startedAt.getTime())))
            : 0;
          const art = buildOrderArt(order);
          const name = buildOrderLabel(order);
          const refund = cancelRefund(order.cost);

          return (
            <span
              key={order.id}
              data-segment
              aria-label={t('planet.queue.segment', {
                name,
                duration: finishesAt ? countdown(finishesAt.getTime() - now) : '',
              })}
              className="socket relative flex shrink-0 items-center justify-center overflow-hidden rounded-chip"
              style={{ width: `${String(width)}%` }}
            >
              {/* WHAT IS DONE OF IT, behind the picture rather than beside it. */}
              {running && (
                <span
                  data-fill
                  className="absolute inset-y-0 left-0 bg-crystal/25 transition-[width] duration-1000"
                  style={{ width: `${String(progress * 100)}%` }}
                />
              )}
              {/* WHAT IT IS. The render, because a picture survives a 40px column. */}
              {art && (
                <img
                  src={art}
                  alt=""
                  aria-hidden
                  className="relative z-[1] max-h-7 max-w-full object-contain opacity-90"
                />
              )}
              {order.count > 1 && (
                <span className="num absolute bottom-0 left-1 z-[1] text-micro text-bone/80">
                  ×{order.count}
                </span>
              )}
              {/* WHEN, on the one that is running. The others start when it ends. */}
              {running && (
                <span className="num absolute right-1 bottom-0.5 z-[1] text-micro text-crystal">
                  {countdown(finishesAt.getTime() - now)}
                </span>
              )}
              {finishesAt && onCancel && (
                <button
                  type="button"
                  data-cancel
                  disabled={cancelling !== undefined}
                  aria-label={t('planet.queue.cancelOne', { name })}
                  title={t('planet.queue.refund', {
                    alloy: refund.alloy,
                    crystal: refund.crystal,
                    deuterium: refund.deuterium,
                  })}
                  onClick={() => { onCancel(order); }}
                  className="absolute right-0 top-0 z-[2] flex size-5 items-center justify-center rounded-bl-chip bg-void/70 text-micro text-faint transition-colors hover:bg-threat/30 hover:text-threat-ink disabled:opacity-40"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}

        {Array.from({ length: free }, (_unused, slot) => (
          <span
            key={`free-${String(slot)}`}
            data-free-slot
            aria-label={t('planet.queue.slotFree')}
            className="flex-1 rounded-chip border border-dashed border-line-soft"
          />
        ))}
      </div>
    </div>
  );
}
