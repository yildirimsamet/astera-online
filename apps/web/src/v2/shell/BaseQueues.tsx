import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILD } from '@astera/rules';
import { useCancelBuildOrder } from '../../api/queries.js';
import type { BuildOrderView, PlanetView } from '../../api/schemas.js';
import { FreeSlot, QueueSlot, type SlotState } from '../../game-ui/index.js';
import { full } from '../../lib/format.js';
import { buildOrderArt, buildOrderLabel, orderProgress, orderWaiting, repairSubject } from '../../lib/orders.js';
import { useNow } from '../../lib/time.js';
import { describe, useToast } from '../../ui/Toast.js';
import { orderLeft } from '../kit/QueueLane.js';
import { QueueSheet } from '../kit/QueueSheet.js';

/** Where an order stands, for its slot: a vacation stops it, only the head runs. */
const slotState = (order: BuildOrderView, now: number): SlotState => {
  if ('pausedAt' in order && order.pausedAt) return 'paused';
  if (orderWaiting(order, now)) return 'waiting';
  return order.finishesAt ? 'running' : 'staged';
};

/**
 * ONE LANE OF THE KIT'S SLOTS (stage 4.1): an order is a ring round its picture that
 * fills as it builds, an empty slot says so. A slot is a glance; a press opens the sheet.
 */
function Lane({ label, orders, now, onOpen }: { label: string; orders: readonly BuildOrderView[]; now: number; onOpen: () => void }) {
  const { t } = useTranslation();
  const labelId = useId();
  const free = Math.max(0, BUILD.queueDepth - orders.length);
  return (
    <div data-queue-lane role="group" aria-labelledby={labelId} className="gk-lane">
      <p id={labelId} className="gk-label">{label}</p>
      <div className="gk-lane__slots">
        {orders.map((order) => {
          const name = buildOrderLabel(order);
          const left = orderLeft(order, now);
          return (
            <QueueSlot
              key={order.id}
              art={buildOrderArt(order)}
              name={order.kind === 'REPAIR' ? repairSubject(order) : name}
              count={order.count}
              progress={orderProgress(order, now)}
              left={left}
              state={slotState(order, now)}
              label={t('planet.queue.segment', { name, duration: left })}
              onPress={onOpen}
            />
          );
        })}
        {Array.from({ length: free }, (_unused, slot) => <FreeSlot key={`free-${String(slot)}`} text={t('lane.free')} />)}
      </div>
    </div>
  );
}

/**
 * THE BASE'S QUEUES AS RINGS. Spec B12 · E5 (docs/ui-v2/gozlemevi.md).
 *
 * Construction and the Yard, each a lane of rings that fill as the head builds, with
 * the free slots said (I6b). A lane is a glance, not a control: a tap opens the queue
 * sheet, which asks through Confirm — stating the half that burns — before a cancel.
 *
 * NOTHING BUILDING IS ONE LINE, NOT TWO LANES OF EMPTY CELLS. Owner report: *"Üretim
 * sıraları sectionda üretim yoksa bile full section açık bom bom duruyor."* The
 * capacity stays on that line, so the rule the cells teach is still on screen.
 */
export function BaseQueues({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const cancel = useCancelBuildOrder();
  const say = useToast();
  const [open, setOpen] = useState(false);
  const queues = planet.queues ?? { CONSTRUCTION: [], YARD: [] };
  // The Repair Station's lane shows only while it works (Kalıcı gemi hasarı).
  const repairs = queues.REPAIR ?? [];
  const working = queues.CONSTRUCTION.length + queues.YARD.length + repairs.length;

  if (working === 0) {
    return (
      <section data-queues-idle aria-label={t('planet.queue.title')} className="gk gk-queues-idle">
        <h2 className="gk-label">{t('planet.queue.title')}</h2>
        <span className="gk-tag__rule" aria-hidden="true" />
        <span className="gk-queues-idle__what">{t('planet.queue.idle')}</span>
        <span className="gk-sub gk-num">{t('planet.queue.capacity', { count: BUILD.queueDepth })}</span>
      </section>
    );
  }

  const onCancel = (order: BuildOrderView): void => {
    cancel.mutate(order.id, {
      onSuccess: (result) => {
        say(t('planet.queue.cancelled', {
          alloy: full(result.refund.alloy),
          crystal: full(result.refund.crystal),
          deuterium: full(result.refund.deuterium),
        }));
      },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };

  return (
    <section aria-label={t('planet.queue.title')} className="gk grid gap-2">
      <Lane label={t('planet.queue.construction')} orders={queues.CONSTRUCTION} now={now} onOpen={() => { setOpen(true); }} />
      <Lane label={t('planet.queue.yard')} orders={queues.YARD} now={now} onOpen={() => { setOpen(true); }} />
      {repairs.length > 0 && (
        <Lane label={t('planet.queue.repair')} orders={repairs} now={now} onOpen={() => { setOpen(true); }} />
      )}
      {open && (
        <QueueSheet
          queues={queues}
          now={now}
          {...(cancel.isPending ? { cancelling: cancel.variables } : {})}
          onCancel={onCancel}
          onClose={() => { setOpen(false); }}
        />
      )}
    </section>
  );
}
