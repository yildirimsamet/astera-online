import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BuildOrderView } from '../../api/schemas.js';
import { buildOrderLabel } from '../../lib/orders.js';
import { clockTime } from '../../lib/time.js';
import { CancelConfirm } from '../../ui/QueueStrip.js';
import { OrderName, OrderRing, orderLeft } from './QueueLane.js';
import { Sheet } from './Sheet.js';

type Lanes = Record<'CONSTRUCTION' | 'YARD', readonly BuildOrderView[]>;

const LANES = [
  ['CONSTRUCTION', 'planet.queue.construction'],
  ['YARD', 'planet.queue.yard'],
] as const;

export interface QueueSheetProps {
  queues: Lanes;
  /** Server time, ticking. */
  now: number;
  /** The id of the order whose cancel is in flight; every cancel holds until it lands. */
  cancelling?: string;
  onCancel: (order: BuildOrderView) => void;
  onClose: () => void;
}

/**
 * THE QUEUE SHEET, ONE TAP UNDER THE RINGS. Spec B12 and K4 (docs/ui-v2/gozlemevi.md).
 *
 * Both lanes, each order with its ring and its time, and when the whole lane is
 * done — the figure that decides whether to queue a fourth thing. It holds the
 * only cancel in the new interface, and a cancel never happens on the tap: it
 * opens `Confirm` (`CancelConfirm`), which leads with what is destroyed.
 *
 * ESCAPE CLOSES ONE THING. With the Confirm open, Escape answers the Confirm and
 * leaves this sheet where it was.
 */
export function QueueSheet({ queues, now, cancelling, onCancel, onClose }: QueueSheetProps) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState<BuildOrderView | null>(null);

  return (
    <>
      <Sheet
        title={t('planet.queue.title')}
        onClose={() => {
          if (asking === null) onClose();
        }}
      >
        <div className="flex flex-col gap-3">
          {LANES.map(([lane, label]) => (
            <Lane
              key={lane}
              label={t(label)}
              orders={queues[lane]}
              now={now}
              cancelling={cancelling}
              onAsk={setAsking}
            />
          ))}
        </div>
      </Sheet>
      {asking && (
        <CancelConfirm
          order={asking}
          pending={cancelling !== undefined}
          onClose={() => { setAsking(null); }}
          onConfirm={() => {
            const order = asking;
            setAsking(null);
            onCancel(order);
          }}
        />
      )}
    </>
  );
}

function Lane({
  label,
  orders,
  now,
  cancelling,
  onAsk,
}: {
  label: string;
  orders: readonly BuildOrderView[];
  now: number;
  cancelling: string | undefined;
  onAsk: (order: BuildOrderView) => void;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const ends = orders.reduce<Date | null>(
    (latest, order) => (order.finishesAt && (!latest || order.finishesAt > latest) ? order.finishesAt : latest),
    null,
  );

  return (
    <section role="group" aria-labelledby={labelId} className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2 border-b border-v2-line pb-1">
        <p id={labelId} className="text-micro uppercase tracking-wide text-v2-ink-3">{label}</p>
        {ends && (
          <span data-lane-ends className="font-v2-mono text-micro text-v2-ink-3">
            {t('planet.queue.ends', { time: clockTime(ends) })}
          </span>
        )}
      </div>
      {orders.length === 0 ? (
        <p className="py-2 text-caption text-v2-ink-3">{t('planet.queue.idle')}</p>
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id} className="flex items-center gap-2 border-b border-v2-line/60 py-1.5 last:border-b-0">
              <OrderRing order={order} now={now} />
              <span className="grid min-w-0 flex-1">
                <OrderName order={order} />
                <span className="font-v2-mono text-micro text-v2-ink-2">{orderLeft(order, now)}</span>
              </span>
              {order.finishesAt && (
                <button
                  type="button"
                  disabled={cancelling !== undefined}
                  aria-label={t('planet.queue.cancelOne', { name: buildOrderLabel(order) })}
                  onClick={() => { onAsk(order); }}
                  className="shrink-0 rounded-control border border-v2-line-hi px-2.5 py-1 text-caption text-v2-ink-2 disabled:opacity-40"
                >
                  {t(cancelling === order.id ? 'planet.queue.cancelling' : 'planet.queue.cancel')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
