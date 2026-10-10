import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';
import { useAbandonColony, useColonyAbandonment } from '../api/colonyAbandonment.js';
import { colonyAbandonmentReasonSchema, type PlanetView } from '../api/schemas.js';
import { describe, useToast } from '../ui/Toast.js';
import { Icon } from '../v2/icons.js';
import { Sheet } from '../v2/kit/Sheet.js';
import type { z } from 'zod';

type Reason = z.infer<typeof colonyAbandonmentReasonSchema>;

export function ColonyAbandonment({ planet }: { planet: PlanetView }) {
  return planet.planet.kind === 'COLONY'
    ? <ColonyControl key={planet.planet.id} planet={planet} />
    : null;
}

function ColonyControl({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => { setOpen(true); }}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-control border border-v2-line bg-v2-deep/40 px-2.5 text-left font-v2-ui text-caption text-v2-ink-2 hover:border-v2-hostile/50 hover:text-v2-hostile"
    >
      <span className="flex items-center gap-2"><Icon id="m-colony" className="size-4 text-v2-hostile" />{t('planet.abandon.action')}</span>
      <Icon id="i-chev" className="size-4" />
    </button>
    {open && <AbandonColonySheet planet={planet} onClose={() => { setOpen(false); }} />}
  </>;
}

function AbandonColonySheet({ planet, onClose }: { planet: PlanetView; onClose: () => void }) {
  const { t } = useTranslation();
  const say = useToast();
  const eligibility = useColonyAbandonment(planet.planet.id);
  const abandon = useAbandonColony();
  const submitting = useRef(false);
  const [refusal, setRefusal] = useState<Reason | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const checking = eligibility.isPending || eligibility.isFetching;
  const reasons = [...new Set([...(eligibility.data?.reasons ?? []), ...(refusal ? [refusal] : [])])];
  const allowed = eligibility.isSuccess && !checking && eligibility.data.allowed && reasons.length === 0 && !failure;
  const close = () => { if (!submitting.current) onClose(); };
  const recheck = () => {
    if (checking || submitting.current) return;
    setRefusal(null);
    setFailure(null);
    abandon.reset();
    void eligibility.refetch();
  };

  return <Sheet title={t('planet.abandon.title')} eyebrow={planet.planet.name} placement="card" detents={['fit']} onClose={close}
    footer={<div className="grid grid-cols-2 gap-2 font-v2-ui text-caption">
      <button type="button" disabled={abandon.isPending} onClick={close}
        className="min-h-11 rounded-control border border-v2-line bg-v2-panel px-2 font-semibold text-v2-ink-2 disabled:opacity-50">
        {t('planet.abandon.cancel')}
      </button>
      <button type="button" disabled={!allowed || abandon.isPending}
        className="min-h-11 rounded-control border border-v2-hostile/70 bg-v2-hostile px-2 font-semibold text-v2-self-ink disabled:border-v2-line disabled:bg-v2-raise disabled:text-v2-ink-3"
        onClick={() => {
          if (!allowed || submitting.current) return;
          submitting.current = true;
          abandon.mutate(planet.planet.id, {
            onSuccess: () => {
              say(t('planet.abandon.success', { planet: planet.planet.name }));
              onClose();
            },
            onError: error => {
              submitting.current = false;
              const reason = error instanceof ApiError && error.code === 'COLONY_ABANDON_BLOCKED'
                ? colonyAbandonmentReasonSchema.safeParse(error.params?.reason) : null;
              if (reason?.success) setRefusal(reason.data);
              else setFailure(describe(error));
            },
          });
        }}>
        {t(abandon.isPending ? 'planet.abandon.pending' : 'planet.abandon.confirm')}
      </button>
    </div>}
  >
    <div className="flex flex-col gap-3 font-v2-ui text-caption leading-snug">
      <div className="flex items-start gap-2 rounded-control border border-v2-hostile/30 bg-v2-hostile/10 p-2.5">
        <Icon id="i-warn" className="mt-0.5 size-5 shrink-0 text-v2-hostile" />
        <p className="text-v2-ink">{t('planet.abandon.irreversible')}</p>
      </div>
      <ul className="flex flex-col gap-2 text-v2-ink-2">
        <li className="flex gap-2"><Icon id="m-neutral" className="size-4 shrink-0 text-v2-ink-3" /><span>{t('planet.abandon.keeps')}</span></li>
        <li className="flex gap-2"><Icon id="i-transfer" className="size-4 shrink-0 text-v2-self" /><span>{t('planet.abandon.ships')}</span></li>
        <li className="flex gap-2"><Icon id="i-close" className="size-4 shrink-0 text-v2-hostile" /><span>{t('planet.abandon.queue')}</span></li>
      </ul>
      <p className="text-v2-ink-3">{t('planet.abandon.rule')}</p>
      {checking ? <p role="status" className="text-v2-ink-2">{t('planet.abandon.checking')}</p> : null}
      {!checking && (reasons.length > 0 || failure !== null || eligibility.isError) && (
        <section role="alert" className="rounded-control border border-v2-warn/35 bg-v2-warn/5 p-2.5">
          <p className="mb-1.5 font-semibold text-v2-warn">{t('planet.abandon.blocked')}</p>
          <ul className="flex flex-col gap-2 text-v2-ink-2">
            {reasons.map(reason => <li key={reason}>{t(`planet.abandon.reasons.${reason}`)}</li>)}
          </ul>
          {failure && <p className="text-v2-ink-2">{failure}</p>}
          {eligibility.isError && <p className="text-v2-ink-2">{t('planet.abandon.checkFailed')}</p>}
          <button type="button" disabled={abandon.isPending} onClick={recheck}
            className="mt-2 min-h-11 w-full rounded-control border border-v2-line bg-v2-panel px-2 font-semibold text-v2-ink-2 disabled:opacity-50">
            {t('planet.abandon.recheck')}
          </button>
        </section>
      )}
    </div>
  </Sheet>;
}
