import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILD } from '@astera/rules';
import type { BuildOrderView } from '../../api/schemas.js';
import i18n from '../../i18n/index.js';
import { buildOrderArt, buildOrderLabel, orderProgress } from '../../lib/orders.js';
import { countdown } from '../../lib/time.js';

/** Time until an order is done, or why it has no clock yet. */
export function orderLeft(order: BuildOrderView, now: number): string {
  if (order.finishesAt) return countdown(order.finishesAt.getTime() - now);
  return i18n.t('optimistic' in order ? 'planet.queue.committing' : 'planet.queue.staged');
}

/** The ring: a conic fill of how far the order has built, its render inside. */
export function OrderRing({ order, now }: { order: BuildOrderView; now: number }) {
  const progress = Math.round(orderProgress(order, now) * 100) / 100;
  const art = buildOrderArt(order);
  return (
    <span
      data-ring=""
      data-progress={String(progress)}
      className="relative size-7.5 shrink-0 rounded-full"
      style={{ background: `conic-gradient(var(--color-v2-self) ${String(progress)}turn, var(--color-v2-line) 0)` }}
    >
      <span className="absolute inset-0.5 rounded-full bg-v2-panel" />
      {art && <img src={art} alt="" draggable={false} className="absolute inset-1.25 size-5 object-contain" />}
    </span>
  );
}

/** The order's name, and how many when it is more than one. */
export function OrderName({ order }: { order: BuildOrderView }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1">
      {/*
        Archivo's narrow width holds "Alloy Refinery" whole in a third of a 350 px row.
        A German compound still ends in an ellipsis: a two-line wrap was tried, and
        where the browser has no hyphenation dictionary it split the word mid-syllable
        with no hyphen, which read worse. The queue sheet prints the name at full width.
      */}
      <span className="truncate font-v2-ui text-caption font-semibold text-v2-ink font-stretch-condensed">
        {buildOrderLabel(order)}
      </span>
      {order.count > 1 && <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">×{order.count}</span>}
    </span>
  );
}

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
 * is no cancel mark here to hit by accident: a tap opens the queue sheet
 * (`QueueSheet`), which states the loss before it happens.
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
          const left = orderLeft(order, now);
          return (
            <button
              key={order.id}
              type="button"
              onClick={onOpen}
              aria-label={t('planet.queue.segment', { name: buildOrderLabel(order), duration: left })}
              className="flex h-11 min-w-0 items-center gap-1.5 rounded-control border border-v2-line bg-v2-panel px-1.5 text-left"
            >
              <OrderRing order={order} now={now} />
              <span className="grid min-w-0">
                <OrderName order={order} />
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
