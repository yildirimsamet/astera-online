import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILD } from '@astera/rules';
import { useCancelBuildOrder } from '../../api/queries.js';
import type { BuildOrderView, PlanetView } from '../../api/schemas.js';
import { full } from '../../lib/format.js';
import { useNow } from '../../lib/time.js';
import { describe, useToast } from '../../ui/Toast.js';
import { QueueLane } from '../kit/QueueLane.js';
import { QueueSheet } from '../kit/QueueSheet.js';

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
      <section
        data-queues-idle
        aria-label={t('planet.queue.title')}
        className="flex items-baseline gap-2 rounded-control border border-v2-line bg-v2-panel px-3 py-2 font-v2-ui"
      >
        <h2 className="v2-legend text-v2-ink-2">{t('planet.queue.title')}</h2>
        <span className="h-px flex-1 bg-v2-line/70" />
        <span className="text-caption text-v2-ink-3">{t('planet.queue.idle')}</span>
        <span className="font-v2-mono text-micro text-v2-ink-3">{t('planet.queue.capacity', { count: BUILD.queueDepth })}</span>
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
    <section aria-label={t('planet.queue.title')} className="flex flex-col gap-2">
      <QueueLane label={t('planet.queue.construction')} orders={queues.CONSTRUCTION} now={now} onOpen={() => { setOpen(true); }} />
      <QueueLane label={t('planet.queue.yard')} orders={queues.YARD} now={now} onOpen={() => { setOpen(true); }} />
      {repairs.length > 0 && (
        <QueueLane label={t('planet.queue.repair')} orders={repairs} now={now} onOpen={() => { setOpen(true); }} />
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
