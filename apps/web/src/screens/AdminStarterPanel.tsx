import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { Button } from '../v2/kit/Surface.js';

const CELL = 'rounded-control border border-v2-line bg-v2-deep px-2 py-1.5';
const LABEL = 'text-micro uppercase tracking-wide text-v2-ink-3';
const FIGURE = 'font-v2-mono text-body font-semibold text-v2-ink';

function Figure({ label, value, testId }: { label: string; value: number | string; testId: string }) {
  return (
    <div className={CELL}>
      <p className={LABEL}>{label}</p>
      <p data-testid={testId} className={FIGURE}>{value}</p>
    </div>
  );
}

/** Plan §5, admin: how many ships, how far along, how late the queue runs, and who is playing them. */
export function AdminStarterPanel() {
  const api = useApi();
  const { t } = useTranslation();
  const view = useQuery({ queryKey: ['admin-starter'], queryFn: () => api.adminStarter(), retry: false, staleTime: 0 });
  if (view.isPending) return null;
  if (view.isError) return <p role="alert" className="pt-2 text-caption text-v2-warn">{t('community.admin.starter.unavailable')}</p>;
  const { ships, people, crew, spread, galaxies, queue } = view.data;
  const tallest = Math.max(1, ...spread);
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-3 pt-1 font-v2-ui">
      <div className="grid grid-cols-3 gap-1.5">
        <Figure label={t('community.admin.starter.active')} value={ships.active} testId="starter-active" />
        <Figure label={t('community.admin.starter.dormant')} value={ships.dormant} testId="starter-dormant" />
        <Figure label={t('community.admin.starter.departed')} value={ships.departed} testId="starter-departed" />
        <Figure label={t('community.admin.starter.people')} value={people} testId="starter-people" />
        <Figure label={t('community.admin.starter.crew')} value={crew} testId="starter-crew" />
        <Figure label={t('community.admin.starter.failed')} value={queue.failed} testId="starter-failed" />
      </div>
      <div className={CELL}>
        <p className={LABEL}>{t('community.admin.starter.spread')}</p>
        <div className="mt-1 grid grid-cols-4 items-end gap-1.5">
          {spread.map((count, band) => (
            <div key={band} data-testid="starter-band" className="flex flex-col items-center gap-0.5">
              <span className="font-v2-mono text-micro text-v2-ink-2">{count}</span>
              <span className="block w-full rounded-chip bg-v2-self" style={{ height: `${String(4 + (count / tallest) * 36)}px` }} />
              <span className="text-micro text-v2-ink-3">{band * 25}–{(band + 1) * 25}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className={CELL}>
        <p className={LABEL}>{t('community.admin.starter.lag')}</p>
        <p className={FIGURE}>{queue.lagSeconds === null ? t('community.admin.starter.none') : t('community.admin.starter.seconds', { n: Math.round(queue.lagSeconds) })}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className={LABEL}>{t('community.admin.starter.galaxies')}</p>
        {galaxies.map(galaxy => (
          <div key={galaxy.ordinal} data-testid="starter-galaxy" className={`${CELL} flex items-center gap-2`}>
            <span className="min-w-0 flex-1 truncate text-caption text-v2-ink">{t('community.admin.starter.galaxy', { n: galaxy.ordinal })}</span>
            <span className="font-v2-mono text-caption text-v2-ink-2">{galaxy.seated}/{galaxy.capacity}</span>
            <span className={`text-micro ${galaxy.open ? 'text-v2-self' : 'text-v2-ink-3'}`}>{galaxy.open ? t('community.admin.starter.open') : t('community.admin.starter.full')}</span>
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" disabled={view.isFetching} onClick={() => { void view.refetch(); }}>{t('community.admin.starter.refresh')}</Button>
    </section>
  );
}
