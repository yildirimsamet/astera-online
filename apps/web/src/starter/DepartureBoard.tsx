import { useTranslation } from 'react-i18next';
import { Flag } from '../v2/identity/Flag.js';
import { duration } from '../lib/time.js';
import { useDepartures } from './queries.js';

/** Who has made it across. Nothing to do here but want it: it is the social proof of the whole galaxy. */
export function DepartureBoard({ now }: { now: number }) {
  const { t } = useTranslation();
  const { data } = useDepartures(true);
  if (!data) return null;
  return (
    <section data-testid="departure-board" aria-label={t('starter.board.title')} className="flex flex-col gap-1 rounded-control border border-v2-line bg-v2-void/50 px-2.5 py-2 font-v2-ui">
      <h3 className="text-label font-semibold uppercase tracking-label text-v2-ink-2">{t('starter.board.title')}</h3>
      {data.departures.length === 0
        ? <p data-testid="departure-empty" className="text-caption text-v2-ink-3">{t('starter.board.empty')}</p>
        : <ul className="flex flex-col gap-1">
          {data.departures.map(row => (
            <li key={`${row.name}-${row.at.toISOString()}`} className="flex items-center gap-1.5 text-caption text-v2-ink">
              <Flag code={row.country} size="small" />
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="shrink-0 font-v2-mono text-micro text-v2-ink-3">{t('starter.board.ago', { time: duration(Math.max(0, now - row.at.getTime()) / 60_000) })}</span>
            </li>
          ))}
        </ul>}
    </section>
  );
}
