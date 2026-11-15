import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEndVacation, useStartVacation, useVacation } from '../api/vacation.js';
import { describe } from '../ui/Toast.js';
import { full } from '../lib/format.js';
import { useNow } from '../lib/time.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Banner, Chip, GameButton, GameHold, InfoPeek, SectionTag, SpendBar, Well } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * VACATION (G10, C24 2026-11-15): "I will be away — can I go, for how long, and what does it
 * cost?" The rule and the price are said where the choice is made: every world's line, the
 * total against what the capital holds, what stands in the way. Starting spends the capital's
 * deuterium, so it is the kit's spending hold (1 s); the early return keeps no refund and was a
 * confirm window, so it is the shortest hold (0.6 s, owner 2026-11-14) with the rule above it.
 */
export function VacationSheet({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(1);
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
  // A hold that cannot go names the one thing in its way; the list above names them all.
  const startReason = start.isPending ? t('vacation.submitting') : query.isError ? t('vacation.loadError')
    : checking ? t('vacation.checking') : reasons.length > 0 ? t('vacation.blockersTitle') : null;
  const total = q?.price?.total ?? 0;
  const available = q === undefined ? 0 : q.store + q.buffer;
  const footer = q === undefined ? undefined : active
    ? <GameHold weight="reversible" tone="steel" glyph="recall" label={t('vacation.end')}
      disabledReason={end.isPending ? t('vacation.submitting') : active.endsAt.getTime() <= now ? t('vacation.until', { time: time(active.endsAt) }) : null}
      onCommit={() => { end.mutate(active.id); }} />
    : <GameHold weight="spends" glyph="shield" label={t('vacation.start', { count: days })} detail={<Price amount={total} />}
      disabledReason={startReason} onCommit={submit} />;
  // The body portal sits outside the shell; the shell publishes the top bar on the document.
  return createPortal(<div>
    <Sheet placement="dialog" title={t('vacation.title')} onClose={onClose} detents={['full']} kit={{ tone: 'self' }} footer={footer}>
      <div data-vacation-sheet className="gk-vac">
        <Banner tone="good" glyph="shield" title={t('vacation.coverage')} body={t('vacation.summary')} />
        {!q ? <>
          <p role="status" className="gk-acct__note">{query.isPending ? t('vacation.loading') : t('vacation.loadError')}</p>
          {!query.isPending && <GameButton onPress={() => { void query.refetch(); }}>{t('vacation.retry')}</GameButton>}
        </> : active ? <>
          <Well className="gk-vac__until">
            <span className="gk-acct__note">{t('vacation.paused')}</span>
            <span className="gk-vac__untilvalue gk-display gk-num gk-outlined">{t('vacation.until', { time: time(active.endsAt) })}</span>
          </Well>
          <section className="gk-vac__return" aria-label={t('vacation.endTitle')}>
            <h3 className="gk-vac__ask">{t('vacation.endTitle')}</h3>
            <p className="gk-acct__note">{t('vacation.endBody')}</p>
          </section>
        </> : <>
          {blocked && <section aria-labelledby={blockersTitleId} className="gk-vac__blockers gk-well">
            <h3 id={blockersTitleId} className="gk-vac__blockerstitle">{t('vacation.blockersTitle')}</h3>
            <ul className="gk-vac__reasons">
              {reasons.map(reason => <li key={reason}>{reason === 'VACATION_FUNDS' && q.price && q.price.total > q.store + q.buffer
                ? t('vacation.missing', { amount: full(Math.ceil(q.price.total - q.store - q.buffer)) })
                : reason === 'SEASON_FROZEN' ? t('errors.SEASON_FROZEN')
                : t(`vacation.${reason}`, { defaultValue: t('vacation.conditionsChanged') })}</li>)}
              {checking && <li>{t('vacation.checking')}</li>}
              {pending && <li>{t('vacation.submitting')}</li>}
              {query.isError && <li>{t('vacation.loadError')}</li>}
            </ul>
            {query.isError && <GameButton size="sm" pending={query.isFetching} onPress={() => { void query.refetch(); }}>{t('vacation.retry')}</GameButton>}
          </section>}
          <section className="gk-vac__days" aria-label={t('vacation.days')}>
            <SectionTag as="h3">{t('vacation.days')}</SectionTag>
            <div className="gk-vac__chips" role="group" aria-label={t('vacation.days')}>
              {DAYS.map(n => <Chip key={n} on={n === days} disabled={n > q.maxDays || pending} onPress={() => { setDays(n); }}>
                {t('vacation.dayOption', { count: n })}</Chip>)}
            </div>
            <p className="gk-acct__note">{t('vacation.seasonRule')}</p>
          </section>
          <ul className="gk-vac__worlds gk-well">
            {q.price?.worlds.map(line => <li key={line.id} className="gk-vac__world">
              <span className="gk-vac__worldtext">
                <span className="gk-vac__worldname">{q.worlds.find(w => w.id === line.id)?.name}</span>
                <span className="gk-label">{t(line.capital ? 'vacation.capital' : 'vacation.colony')}</span>
                <span className="gk-vac__line">{t('vacation.line', { core: line.coreLevel, level: line.referenceLevel, hours: line.hours })}</span>
              </span>
              <Price amount={line.cost} exact />
            </li>)}
          </ul>
          <Well className="gk-vac__total">
            <div className="gk-vac__totalhead">
              <span className="gk-vac__totallabel">{t('vacation.total')}</span>
              <Price amount={total} big />
            </div>
            <p className="gk-vac__fine">{t('vacation.rounding')}</p>
            <SpendBar spend={total} stock={available} label={t('vacation.available')} art={RESOURCE_ART.deuterium}
              text={`${full(total)} / ${full(available)}`} />
            <dl className="gk-vac__sums">
              {([[t('vacation.store'), q.store], [t('vacation.buffer'), q.buffer]] as const).map(([label, value]) =>
                <div key={label}><dt>{label}</dt><dd className="gk-num">{full(value)}</dd></div>)}
            </dl>
          </Well>
          <InfoPeek fact={t('vacation.formulaTitle')} rule={<p className="gk-acct__note">{t('vacation.formula')}</p>} about={t('vacation.formulaTitle')} />
        </>}
        {error && <Banner tone="hostile" title={describe(error)} role="alert" />}
      </div>
    </Sheet>
  </div>, document.body);
}

/** Deuterium, as the game draws it: its picture and the figure — whole, or with the two decimals a line carries. */
function Price({ amount, exact = false, big = false }: { amount: number; exact?: boolean; big?: boolean }) {
  const { i18n } = useTranslation();
  const figure = exact ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(amount) : full(amount);
  return (
    <span className={`gk-vac__price gk-num${big ? ' gk-vac__price--big gk-display' : ''}`}>
      <img src={RESOURCE_ART.deuterium} alt="" draggable={false} />
      {figure}
    </span>
  );
}
