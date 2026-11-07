import { STARTER } from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCancelBuildOrder } from '../api/queries.js';
import type { BuildOrderView } from '../api/schemas.js';
import type { VesselView } from '../api/starterSchemas.js';
import { full } from '../lib/format.js';
import { orderProgress } from '../lib/orders.js';
import { useNow } from '../lib/time.js';
import { describe, useToast } from '../ui/Toast.js';
import { Icon } from '../v2/icons.js';
import { orderLeft } from '../v2/kit/QueueLane.js';
import { QueueSheet } from '../v2/kit/QueueSheet.js';
import { moduleArt, orderModule } from './shipScreen.js';

const FRAME = 'size-[52px] shrink-0 rounded-full';

/**
 * THE THREE REPAIRS THAT CAN RUN AT ONCE, each a ring around the machine being mended. Pressing a
 * running one opens the queue, which asks before a cancel. Pressing an empty one takes the repair on
 * the card above, and it offers itself only when that repair can be ordered.
 */
export function RepairSlots({ orders, queue, addLabel, onAdd }: {
  orders: readonly BuildOrderView[];
  /** The ship's own view of the same orders, which knows the repair each one is. */
  queue: VesselView['queue'];
  addLabel: string;
  onAdd: (() => void) | null;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const say = useToast();
  const cancel = useCancelBuildOrder();
  const [open, setOpen] = useState(false);
  const slots = Array.from({ length: STARTER.queues.construction }, (_, index) => orders[index] ?? null);
  const onCancel = (order: BuildOrderView): void => {
    cancel.mutate(order.id, {
      onSuccess: (result) => {
        say(t('planet.queue.cancelled', { alloy: full(result.refund.alloy), crystal: full(result.refund.crystal), deuterium: full(result.refund.deuterium) }));
      },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };
  return (
    <section data-testid="repair-slots" aria-label={t('starter.slots')} className="mx-3 flex items-center gap-2 rounded-control border border-v2-line bg-v2-panel/70 px-2 py-1.5">
      <p className="flex min-w-0 flex-1 flex-col gap-0.5 text-caption leading-tight text-v2-ink">
        <span className="flex items-center gap-1.5"><Icon id="i-settings" className="size-3.5 shrink-0 text-v2-self" />{t('starter.slots')}</span>
        <span data-testid="slot-count" className="pl-5 font-v2-mono text-micro text-v2-ink-3">{orders.length}/{STARTER.queues.construction}</span>
      </p>
      {slots.map((order, index) => {
        if (!order) {
          const empty = `${FRAME} grid place-items-center border border-dashed border-v2-line-hi text-v2-ink-2`;
          return onAdd
            ? <button key={index} type="button" data-testid="repair-slot" aria-label={addLabel} onClick={onAdd} className={empty}><span aria-hidden="true" className="text-title leading-none">+</span></button>
            : <span key={index} data-testid="repair-slot" aria-hidden="true" className={`${empty} opacity-60`}><span className="text-title leading-none">+</span></span>;
        }
        const module = orderModule(order.subject);
        const stage = queue.find(entry => entry.id === order.id)?.stage ?? 1;
        return (
          <button
            key={order.id}
            type="button"
            data-testid="repair-slot"
            aria-label={orderLeft(order, now)}
            onClick={() => { setOpen(true); }}
            className={`${FRAME} relative shadow-[0_0_10px_-2px_var(--color-v2-self)]`}
            style={{ background: `conic-gradient(var(--color-v2-self) ${String(orderProgress(order, now))}turn, var(--color-v2-line) 0)` }}
          >
            <span className="absolute inset-[3px] overflow-hidden rounded-full bg-v2-void">
              {module && <img src={moduleArt(module, stage)} alt="" draggable={false} className="size-full object-cover" />}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-v2-void to-transparent pb-1 pt-2 text-center font-v2-mono text-micro leading-none text-v2-ink">{orderLeft(order, now)}</span>
            </span>
          </button>
        );
      })}
      {open && (
        <QueueSheet
          queues={{ CONSTRUCTION: [...orders], YARD: [] }}
          now={now}
          {...(cancel.isPending ? { cancelling: cancel.variables } : {})}
          onCancel={onCancel}
          onClose={() => { setOpen(false); }}
        />
      )}
    </section>
  );
}
