import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILD } from '@astera/rules';
import type { BuildOrderView } from '../../api/schemas.js';
import { buildOrderArt, buildOrderLabel, orderProgress } from '../../lib/orders.js';
import { countdown } from '../../lib/time.js';

export interface QueueLaneProps {
  /** Which lane: Construction or Yard. Research has its own segment. */
  label: string;
  orders: readonly BuildOrderView[];
  /** Server time, ticking, so the running ring fills without a refetch. */
  now: number;
  /** Opens the queue sheet, where an order is cancelled behind `Confirm`. */
  onOpen: () => void;
}

/**
 * A LANE OF WORK AS RINGS. Spec B12 (docs/ui-v2/gozlemevi.md).
 *
 * One cell per slot (`BUILD.queueDepth`): an order is a ring that fills as it
 * builds, its picture inside, its name and the time until it is done beside it;
 * an empty slot says so, because how much room is left must be visible without
 * counting (I6b). Only the head runs (D4), so only the head's ring fills.
 *
 * A GLANCE, NOT A CONTROL. Cancelling burns half of what an order cost, so there
 * is no cancel mark here to hit by accident: a tap opens the queue sheet, which
 * states the loss before it happens.
 */
export function QueueLane({ label, orders, now, onOpen }: QueueLaneProps) {
  const { t } = useTranslation();
  const labelId = useId();
  const free = Math.max(0, BUILD.queueDepth - orders.length);

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1">
      <p id={labelId} className="font-v2-ui text-micro uppercase tracking-wide text-v2-ink-3">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {orders.map((order) => {
          const progress = Math.round(orderProgress(order, now) * 100) / 100;
          const name = buildOrderLabel(order);
          const art = buildOrderArt(order);
          const left = order.finishesAt
            ? countdown(order.finishesAt.getTime() - now)
            : t('optimistic' in order ? 'planet.queue.committing' : 'planet.queue.staged');
          return (
            <button
              key={order.id}
              type="button"
              onClick={onOpen}
              aria-label={t('planet.queue.segment', { name, duration: left })}
              className="flex h-11 min-w-0 items-center gap-1.5 rounded-control border border-v2-line bg-v2-panel px-1.5 text-left"
            >
              <span
                data-ring=""
                data-progress={String(progress)}
                className="relative size-7.5 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(var(--color-v2-self) ${String(progress)}turn, var(--color-v2-line) 0)`,
                }}
              >
                <span className="absolute inset-0.5 rounded-full bg-v2-panel" />
                {art && <img src={art} alt="" draggable={false} className="absolute inset-1.25 size-5 object-contain" />}
              </span>
              <span className="grid min-w-0">
                <span className="flex min-w-0 items-baseline gap-1">
                  <span className="truncate font-v2-ui text-caption font-semibold text-v2-ink">{name}</span>
                  {order.count > 1 && (
                    <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">×{order.count}</span>
                  )}
                </span>
                <span className="truncate font-v2-mono text-micro text-v2-ink-2">{left}</span>
              </span>
            </button>
          );
        })}
        {Array.from({ length: free }, (_unused, slot) => (
          <span
            key={`free-${String(slot)}`}
            data-free-slot=""
            className="flex h-11 items-center justify-center rounded-control border border-dashed border-v2-line font-v2-ui text-caption text-v2-ink-3"
          >
            {t('lane.free')}
          </span>
        ))}
      </div>
    </div>
  );
}
