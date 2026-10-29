import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { cosmeticById } from '@astera/rules';
import { useShopierAction, useShopierQueue, useShopierSync } from '../api/queries.js';
import type { shopierQueueSchema } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { shopierPrice } from './ShopierCheckout.js';
import { cosmeticCopy } from '../ui/cosmeticCopy.js';

type ShopierOrder = z.infer<typeof shopierQueueSchema>['orders'][number];

const FIELD = 'h-9 min-w-0 flex-1 rounded-control border border-v2-line-hi bg-v2-deep px-2.5 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self';
const QUIET = 'h-9 shrink-0 rounded-control border border-v2-line-hi px-2.5 text-micro font-semibold text-v2-ink-2 disabled:opacity-50';
const STATUS_TONE: Record<ShopierOrder['status'], string> = {
  UNMATCHED: 'border-v2-warn/50 text-v2-warn',
  MATCHED: 'border-v2-self/50 text-v2-self',
  RESOLVED: 'border-v2-self/50 text-v2-self',
  DISMISSED: 'border-v2-line-hi text-v2-ink-3',
  REFUNDED: 'border-v2-line-hi text-v2-ink-3',
  REVOKED: 'border-v2-line-hi text-v2-ink-3',
};

/**
 * THE SHOPIER QUEUE (owner 2026-10-16, 2026-10-29). A paid order is granted by itself only when
 * it was paid on a commander's own product. Every other order — a support card, an old product,
 * a wrong amount — waits here with its reason and the buyer's note, so the operator can name the
 * commander, close it, or take back what a chargeback paid for.
 */
export function AdminShopierQueue() {
  const { t } = useTranslation();
  const queue = useShopierQueue();
  const sync = useShopierSync();
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-3 pt-1">
      <p className="text-caption leading-snug text-v2-ink-2">{t('community.admin.shopier.intro')}</p>
      <button type="button" onClick={() => { sync.mutate(); }} disabled={sync.isPending}
        className="h-10 rounded-control border border-v2-premium/60 bg-v2-premium/10 px-3 text-caption font-semibold text-v2-premium disabled:opacity-50">
        {t(sync.isPending ? 'community.admin.shopier.syncing' : 'community.admin.shopier.sync')}
      </button>
      {sync.data && <p role="status" className="text-micro text-v2-ink-2">{t('community.admin.shopier.synced', sync.data)}</p>}
      {sync.error && <p role="alert" className="text-micro text-v2-warn">{describeError(sync.error)}</p>}
      {queue.error ? <p role="alert" className="text-caption text-v2-warn">{describeError(queue.error)}</p>
        : queue.data?.orders.length === 0 ? <p className="text-caption text-v2-ink-3">{t('community.admin.shopier.empty')}</p>
          : <ul className="grid gap-2">{queue.data?.orders.map(order => <ShopierOrderRow key={order.orderId} order={order} />)}</ul>}
    </section>
  );
}

function ShopierOrderRow({ order }: { order: ShopierOrder }) {
  const { t } = useTranslation();
  const ids = { commander: useId() };
  const action = useShopierAction();
  const [commander, setCommander] = useState('');
  const [confirming, setConfirming] = useState(false);
  const known = order.itemId ? cosmeticById(order.itemId) : null;
  const item = order.itemId === 'bundle' ? t('skins.bundleTitle')
    : known ? t(cosmeticCopy(known.id).nameKey) : t('community.admin.shopier.otherProduct');
  const total = order.total && order.currency === 'TRY' && Number.isFinite(Number(order.total))
    ? shopierPrice(Math.round(Number(order.total) * 100), t('units.numberLocale')) : `${order.total ?? '—'} ${order.currency ?? ''}`.trim();
  const waiting = order.status === 'UNMATCHED';
  const delivered = order.status === 'MATCHED' || order.status === 'RESOLVED';
  const label = t('community.admin.shopier.order', { id: order.orderId });
  return (
    <li aria-label={label} className="grid gap-2 rounded-control border border-v2-line bg-v2-panel/90 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-caption font-semibold text-v2-ink">{item} · <span className="font-v2-mono text-v2-premium">{total}</span></p>
          <p className="font-v2-mono text-micro text-v2-ink-3">{label} · {order.receivedAt.toLocaleString(t('units.numberLocale'))}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-micro font-semibold ${STATUS_TONE[order.status]}`}>
          {t(`community.admin.shopier.status.${order.status}`)}
        </span>
      </div>
      {order.reason && <p className="text-micro text-v2-warn">{t(`community.admin.shopier.reason.${order.reason}`, { defaultValue: order.reason })}</p>}
      {order.note && <p className="break-words rounded-cell bg-v2-deep/70 px-2 py-1 text-micro text-v2-ink-2">
        <span className="text-v2-ink-3">{t('community.admin.shopier.noteLabel')}: </span>{order.note}</p>}
      {order.username && <p className="text-micro text-v2-ink-2">@{order.username}</p>}
      {!order.closed && (delivered || order.status === 'DISMISSED') && <p className="text-micro text-v2-ink-3">{t('community.admin.shopier.unclosed')}</p>}
      {waiting && order.itemId && (
        <form className="flex gap-1.5" onSubmit={event => {
          event.preventDefault();
          if (commander.trim().length < 2 || action.isPending) return;
          action.mutate({ kind: 'grant', orderId: order.orderId, username: commander.trim() });
        }}>
          <label htmlFor={ids.commander} className="sr-only">{t('community.admin.shopier.commander')}</label>
          <input id={ids.commander} value={commander} onChange={event => { setCommander(event.target.value); }} autoComplete="off" spellCheck={false}
            placeholder={t('community.admin.shopier.commander')} className={FIELD} />
          <button type="submit" disabled={action.isPending || commander.trim().length < 2}
            className="h-9 shrink-0 rounded-control bg-v2-premium px-3 text-micro font-bold text-v2-void disabled:opacity-50">{t('community.admin.shopier.grant')}</button>
        </form>
      )}
      {(waiting || delivered) && <div className="flex flex-wrap justify-end gap-1.5">
        {waiting && <button type="button" disabled={action.isPending} onClick={() => { action.mutate({ kind: 'dismiss', orderId: order.orderId }); }}
          className={QUIET}>{t('community.admin.shopier.dismiss')}</button>}
        {delivered && (confirming
          ? <button type="button" disabled={action.isPending} onClick={() => { action.mutate({ kind: 'revoke', orderId: order.orderId }); }}
            className="h-9 shrink-0 rounded-control border border-v2-warn/60 bg-v2-warn/10 px-2.5 text-micro font-semibold text-v2-warn disabled:opacity-50">{t('community.admin.shopier.revokeConfirm')}</button>
          : <button type="button" onClick={() => { setConfirming(true); }} className={QUIET}>{t('community.admin.shopier.revoke')}</button>)}
      </div>}
      {action.isPending && <p role="status" className="text-micro text-v2-ink-3">{t('community.admin.shopier.working')}</p>}
      {action.error && <p role="alert" className="text-micro text-v2-warn">{describeError(action.error)}</p>}
    </li>
  );
}
