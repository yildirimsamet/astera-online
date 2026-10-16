import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEndVacation, useStartVacation, useVacation } from '../api/vacation.js';
import { describe } from '../ui/Toast.js';
import { full } from '../lib/format.js';
import { useNow } from '../lib/time.js';
import { Confirm } from '../ui/kit/Confirm.js';
import { ShieldIcon } from '../ui/icons/index.js';
import { Button, Note, Section } from '../v2/kit/Surface.js';
import { Sheet } from '../v2/kit/Sheet.js';

export function VacationSheet({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(1);
  const [returnConfirm, setReturnConfirm] = useState(false);
  const query = useVacation(days);
  const start = useStartVacation();
  const end = useEndVacation();
  const request = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const now = useNow();
  const q = query.data;
  const active = q?.active;
  const pending = start.isPending || end.isPending;
  const checking = query.isFetching || (q !== undefined && q.days !== days);
  const reasons = q?.reasons.length ? q.reasons : q?.blocker ? [q.blocker] : [];
  const blocked = pending || checking || query.isError || reasons.length > 0;
  const blockersTitleId = useId();
  const time = (date: Date) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  const submit = () => {
    if (!q || blocked) return;
    if (request.current?.fingerprint !== q.fingerprint) request.current = { fingerprint: q.fingerprint, requestId: crypto.randomUUID() };
    start.mutate({ days, ...request.current }, {
      onSuccess: () => { request.current = null; },
      onError: () => { void query.refetch(); },
    });
  };
  const error = start.error ?? end.error;
  // The body portal sits outside the shell that normally supplies this sheet offset.
  return createPortal(<div className="[--v2-top-h:0px]">
    <Sheet placement="dialog" title={t('vacation.title')} onClose={onClose} detents={['full']}
      footer={q ? active ? <Button size="lg" full variant="commit" disabled={pending || active.endsAt.getTime() <= now}
        onClick={() => { setReturnConfirm(true); }}>{t('vacation.end')}</Button>
        : <Button size="lg" full variant="primary" disabled={blocked} onClick={submit}>
          {t('vacation.start', { count: days })}</Button> : undefined}>
      <div data-vacation-sheet className="flex flex-col gap-4 pb-3">
        <div className="flex items-start gap-3 rounded-control border border-v2-self/25 bg-v2-self/5 p-3">
          <ShieldIcon className="mt-0.5 size-6 shrink-0 text-v2-self" />
          <div className="flex flex-col gap-1"><p className="font-semibold text-v2-ink">{t('vacation.coverage')}</p>
            <p className="text-caption leading-relaxed text-v2-ink-2">{t('vacation.summary')}</p></div>
        </div>
        {!q ? <Note>{query.isPending ? t('vacation.loading') : t('vacation.loadError')}</Note> : active ? <>
          <p className="font-v2-mono text-body text-v2-self">{t('vacation.until', { time: time(active.endsAt) })}</p>
          <Note>{t('vacation.paused')}</Note>
        </> : <>
          {blocked && <section aria-labelledby={blockersTitleId} className="rounded-control border border-v2-warn/30 bg-v2-warn/5 p-3">
            <h3 id={blockersTitleId} className="text-body font-semibold text-v2-warn">{t('vacation.blockersTitle')}</h3>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-4 text-caption leading-relaxed text-v2-ink-2">
              {reasons.map(reason => <li key={reason}>{reason === 'VACATION_FUNDS' && q.price && q.price.total > q.store + q.buffer
                ? t('vacation.missing', { amount: full(Math.ceil(q.price.total - q.store - q.buffer)) })
                : reason === 'SEASON_FROZEN' ? t('errors.SEASON_FROZEN')
                : t(`vacation.${reason}`, { defaultValue: t('vacation.conditionsChanged') })}</li>)}
              {checking && <li>{t('vacation.checking')}</li>}
              {pending && <li>{t('vacation.submitting')}</li>}
              {query.isError && <li>{t('vacation.loadError')}</li>}
            </ul>
            {query.isError && <Button className="mt-3" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>{t('vacation.retry')}</Button>}
          </section>}
          <Section label={t('vacation.days')}>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label={t('vacation.days')}>
              {[1, 2, 3, 4, 5, 6, 7].map(n => <button type="button" key={n} aria-pressed={n === days}
                disabled={n > q.maxDays || pending} onClick={() => { setDays(n); }}
                className={`min-h-11 rounded-control border px-2 py-2 font-v2-mono text-caption transition-colors disabled:opacity-30 ${n === days ? 'border-v2-self/60 bg-v2-self/10 text-v2-self' : 'border-v2-line bg-v2-panel text-v2-ink-2'}`}>
                {t('vacation.dayOption', { count: n })}</button>)}
            </div>
            <p className="text-caption leading-relaxed text-v2-ink-3">{t('vacation.seasonRule')}</p>
          </Section>
          <div className="divide-y divide-v2-line rounded-control border border-v2-line bg-v2-panel px-3">
            {q.price?.worlds.map(line => <div key={line.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="break-words text-body font-semibold">{q.worlds.find(w => w.id === line.id)?.name}</p>
                <p className="text-micro text-v2-ink-3">{t(line.capital ? 'vacation.capital' : 'vacation.colony')}</p>
                <p className="mt-1 text-caption text-v2-ink-2">{t('vacation.line', { core: line.coreLevel, level: line.referenceLevel, hours: line.hours })}</p></div>
              <span className="shrink-0 font-v2-mono text-body text-v2-self">{new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(line.cost)}</span>
            </div>)}
          </div>
          <div className="rounded-control border border-v2-self/30 bg-v2-self/5 p-3">
            <div className="flex items-baseline justify-between gap-3"><span className="text-body font-semibold">{t('vacation.total')}</span>
              <strong className="font-v2-mono text-title text-v2-self">{full(q.price?.total ?? 0)}</strong></div>
            <p className="mt-1 text-micro text-v2-ink-3">{t('vacation.rounding')}</p>
            <dl className="mt-3 flex flex-col gap-1 text-caption text-v2-ink-2">
              {[[t('vacation.store'), q.store], [t('vacation.buffer'), q.buffer], [t('vacation.available'), q.store + q.buffer]].map(([label, value]) =>
                <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-v2-mono">{full(Number(value))}</dd></div>)}
            </dl>
          </div>
          <details className="rounded-control border border-v2-line p-3 text-caption text-v2-ink-2">
            <summary className="cursor-pointer font-semibold text-v2-ink">{t('vacation.formulaTitle')}</summary>
            <p className="mt-2 leading-relaxed">{t('vacation.formula')}</p>
          </details>
        </>}
        {error && <Note>{describe(error)}</Note>}
        {!q && !query.isPending && <Button onClick={() => { void query.refetch(); }}>{t('vacation.retry')}</Button>}
      </div>
    </Sheet>
    {returnConfirm && active && <Confirm eyebrow={t('vacation.title')} title={t('vacation.endTitle')}
      confirmLabel={t('vacation.endConfirm')} backLabel={t('vacation.back')} pending={end.isPending}
      onClose={() => { setReturnConfirm(false); }} onConfirm={() => {
        end.mutate(active.id, { onSuccess: () => { setReturnConfirm(false); } });
      }}><p className="text-body leading-relaxed text-v2-ink-2">{t('vacation.endBody')}</p></Confirm>}
  </div>, document.body);
}
