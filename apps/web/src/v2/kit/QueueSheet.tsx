import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILD, cancelRefund } from '@astera/rules';
import type { BuildOrderView } from '../../api/schemas.js';
import { CostLine, GameButton, GameHold, Glyph, SectionTag, SlotRing, slotMark } from '../../game-ui/index.js';
import { haptic } from '../../lib/haptics.js';
import { buildOrderArt, buildOrderLabel, orderProgress } from '../../lib/orders.js';
import { OWN_SOUND, playSound } from '../../lib/sound.js';
import { clockTime } from '../../lib/time.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
import { orderLeft, slotState } from './QueueLane.js';
import { Sheet } from './Sheet.js';

type Lanes = Record<'CONSTRUCTION' | 'YARD', readonly BuildOrderView[]> & {
  /** The Repair Station's lane, listed only while it works. */
  REPAIR?: readonly BuildOrderView[];
};

const LANES = [
  ['CONSTRUCTION', 'planet.queue.construction'],
  ['YARD', 'planet.queue.yard'],
  ['REPAIR', 'planet.queue.repair'],
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
 * only cancel in the interface, and a cancel never happens on the tap: the row opens
 * what is destroyed and what comes back, and the cancel is the kit's shortest hold
 * (G2-k, 2026-11-15; owner 2026-11-14: a former confirm is a 0.6 s hold).
 *
 * ESCAPE CLOSES ONE THING. With a cancel open, Escape folds it and leaves this sheet
 * where it was.
 */
export function QueueSheet({ queues, now, cancelling, onCancel, onClose }: QueueSheetProps) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState<string | null>(null);

  return (
    <Sheet
      title={t('planet.queue.title')}
      detents={['fit']}
      kit={{ tone: 'self' }}
      onClose={() => {
        if (asking === null) onClose();
        else setAsking(null);
      }}
    >
      <div className="gk-qsheet">
        {LANES.filter(([lane]) => lane !== 'REPAIR' || (queues.REPAIR?.length ?? 0) > 0).map(([lane, label]) => (
          <Lane
            key={lane}
            label={t(label)}
            orders={queues[lane] ?? []}
            now={now}
            cancelling={cancelling}
            asking={asking}
            onAsk={setAsking}
            onCancel={(order) => { setAsking(null); onCancel(order); }}
          />
        ))}
      </div>
    </Sheet>
  );
}

function Lane({
  label,
  orders,
  now,
  cancelling,
  asking,
  onAsk,
  onCancel,
}: {
  label: string;
  orders: readonly BuildOrderView[];
  now: number;
  cancelling: string | undefined;
  asking: string | null;
  onAsk: (id: string | null) => void;
  onCancel: (order: BuildOrderView) => void;
}) {
  const { t } = useTranslation();
  const ends = orders.reduce<Date | null>(
    (latest, order) => (order.finishesAt && (!latest || order.finishesAt > latest) ? order.finishesAt : latest),
    null,
  );

  return (
    <section role="group" aria-label={label} className="gk-qsheet__lane">
      <SectionTag aside={ends ? <span data-lane-ends className="gk-num">{t('planet.queue.ends', { time: clockTime(ends) })}</span> : undefined}>
        {label}
      </SectionTag>
      {orders.length === 0 ? (
        <p className="gk-sub">{t('planet.queue.idle')}</p>
      ) : (
        <ul className="gk-qsheet__rows">
          {orders.map((order) => (
            <Row
              key={order.id}
              order={order}
              now={now}
              cancelling={cancelling}
              open={asking === order.id}
              onAsk={() => { onAsk(asking === order.id ? null : order.id); }}
              onKeep={() => { onAsk(null); }}
              onCancel={() => { onCancel(order); }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ order, now, cancelling, open, onAsk, onKeep, onCancel }: {
  order: BuildOrderView;
  now: number;
  cancelling: string | undefined;
  open: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const name = buildOrderLabel(order);
  const state = slotState(order, now);
  const mark = slotMark(state);
  const ask = useOwnPress(() => { playSound('tap'); haptic('tap'); onAsk(); });
  const paused = 'pausedAt' in order && order.pausedAt !== undefined;

  return (
    <li className="gk-qrow" data-state={state} {...(open ? { 'data-asking': '' } : {})}>
      <SlotRing art={buildOrderArt(order)} count={order.kind === 'RESEARCH' ? 1 : order.count} progress={orderProgress(order, now)} />
      <span className="gk-qrow__text">
        <span className="gk-qrow__name">{name}</span>
        <span className="gk-qrow__left gk-num">
          {mark !== undefined && <Glyph id={mark} />}
          <span>{orderLeft(order, now)}</span>
        </span>
      </span>
      {order.finishesAt && (
        <button
          type="button"
          {...OWN_SOUND}
          disabled={cancelling !== undefined || paused}
          aria-label={t('planet.queue.cancelOne', { name })}
          aria-expanded={open}
          onPointerDown={ask.onPointerDown}
          onClick={ask.onClick}
          className="gk-btn gk-btn--sm gk-qrow__ask"
        >
          {t(cancelling === order.id ? 'planet.queue.cancelling' : 'planet.queue.cancel')}
        </button>
      )}
      {open && <CancelUndo order={order} onKeep={onKeep} onCancel={onCancel} />}
    </li>
  );
}

/**
 * WHAT A CANCEL BURNS, SAID UNDER THE ORDER IT WOULD DESTROY. The share that is lost, the
 * two sums side by side, and the way back before the commitment: the kit's shortest hold,
 * a confirm dialog once (owner, 2026-11-14). The Repair Station's jobs open the same.
 */
export function CancelUndo({ order, onKeep, onCancel }: { order: BuildOrderView; onKeep: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const back = cancelRefund(order.cost);
  const lost = {
    alloy: order.cost.alloy - back.alloy,
    crystal: order.cost.crystal - back.crystal,
    deuterium: order.cost.deuterium - back.deuterium,
  };
  return (
    <div className="gk-qrow__undo">
      <p className="gk-qrow__lead">{t('planet.queue.confirm.lead', { share: Math.round((1 - BUILD.cancelRefund) * 100) })}</p>
      <div className="gk-qrow__sums">
        <span className="gk-qrow__sum" data-tone="lost">
          <span className="gk-label">{t('planet.queue.confirm.lost')}</span>
          <CostLine cost={lost} />
        </span>
        <span className="gk-qrow__sum">
          <span className="gk-label">{t('planet.queue.confirm.kept')}</span>
          <CostLine cost={back} />
        </span>
      </div>
      <div className="gk-qrow__acts">
        <GameButton size="sm" onPress={onKeep}>{t('planet.queue.confirm.back')}</GameButton>
        <GameHold weight="reversible" tone="danger" size="md" glyph="close" commitSound="impact"
          label={t('planet.queue.confirm.commit')} onCommit={onCancel} />
      </div>
    </div>
  );
}
