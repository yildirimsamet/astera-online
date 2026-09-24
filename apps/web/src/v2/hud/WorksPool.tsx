import { useTranslation } from 'react-i18next';
import { WORKS_RESOURCES, type CollectState, type WorksResource } from '../../lib/collect.js';
import { compact, full } from '../../lib/format.js';
import { duration } from '../../lib/time.js';
import { RESOURCE_ART } from '../../ui/assets.js';
import { Icon } from '../icons.js';

const LEVEL: Record<WorksResource, string> = { alloy: 'bg-v2-alloy', crystal: 'bg-v2-crystal', deuterium: 'bg-v2-deut' };
const VESSEL: Record<WorksResource, string> = { alloy: 'bg-v2-alloy/15', crystal: 'bg-v2-crystal/15', deuterium: 'bg-v2-deut/15' };

export interface WorksPoolProps {
  /** `collectState(...)` of the active world, projected. */
  state: CollectState;
  /** Each vessel's share of what it can hold (`worksOutlook`). */
  fill: Record<WorksResource, number>;
  /** When the first vessel reaches its rim; null when nothing is flowing in. */
  fullInMinutes: number | null;
  /** A collect is in flight: the button holds so a second tap sends nothing. */
  pending: boolean;
  onCollect: () => void;
  /** A store with no room: the base, where a store is raised. */
  onOpenBase: () => void;
}

/**
 * THE WORKS, AS A POOL THAT FILLS. Owner, 2026-09-24, with the old "WORKS FULL · Collect"
 * panel as the picture: on the Base the works were a pill beside the store figures, which
 * would not fit once those reach 10k and 100k, and nothing said the works FILL — so nobody
 * knew to come back and move the pool into the store.
 *
 * Its own row under the store: three vessels, each filled to its share; when the first of
 * them is full, which is the moment production stops and the reason to return; what is
 * waiting, resource by resource; and Collect. Full is warn, a gap you can close (K2) —
 * production has stopped — and the button beats. A store with no room says so before the
 * tap and opens the base instead. Empty, it says what it is for.
 */
export function WorksPool({ state, fill, fullInMinutes, pending, onCollect, onOpenBase }: WorksPoolProps) {
  const { t } = useTranslation();
  const waiting = WORKS_RESOURCES.filter((resource) => state.each[resource] >= 1);
  const said = waiting
    .map((resource) => t(`statusBar.works.${resource}`, { amount: full(Math.floor(state.each[resource])) }))
    .join(', ');
  const status = state.full
    ? t('statusBar.works.fullStopped')
    : fullInMinutes === null ? null : t('statusBar.works.fillsIn', { time: duration(fullInMinutes) });

  return (
    <section
      aria-label={t('statusBar.works.label')}
      {...(state.full ? { 'data-full': '' } : {})}
      className={`flex items-center gap-2.5 rounded-control border px-2.5 py-2 font-v2-ui ${
        state.full ? 'border-v2-warn/60 bg-v2-warn/5' : 'border-v2-line bg-v2-panel'
      }`}
    >
      <span aria-hidden className="flex h-7 shrink-0 items-end gap-1">
        {WORKS_RESOURCES.map((resource) => (
          <span key={resource} data-vessel={resource} className={`relative h-full w-1.5 overflow-hidden rounded-full ${VESSEL[resource]}`}>
            <span
              data-level=""
              className={`absolute inset-x-0 bottom-0 rounded-full ${LEVEL[resource]}`}
              style={{ height: `${String(Math.round(Math.min(1, Math.max(0, fill[resource])) * 100))}%` }}
            />
          </span>
        ))}
      </span>

      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-caption font-semibold text-v2-ink">{t('statusBar.works.label')}</span>
          {status !== null && (
            <span className={`truncate text-micro ${state.full ? 'text-v2-warn' : 'text-v2-ink-3'}`}>{status}</span>
          )}
        </span>
        {waiting.length === 0 ? (
          <span className="truncate text-micro text-v2-ink-3">{t('statusBar.works.gathers')}</span>
        ) : (
          <span className="flex min-w-0 items-center gap-2 font-v2-mono text-micro text-v2-ink-2">
            {waiting.map((resource) => (
              <span
                key={resource}
                data-works-resource={resource}
                className={`flex shrink-0 items-center gap-0.5 ${state.noRoom.includes(resource) ? 'text-v2-warn' : ''}`}
              >
                <img src={RESOURCE_ART[resource]} alt="" aria-hidden className="size-3 object-contain" />
                {compact(state.each[resource])}
              </span>
            ))}
          </span>
        )}
      </span>

      {state.blocked ? (
        <button
          type="button"
          onClick={onOpenBase}
          className="flex h-8 shrink-0 items-center gap-1 rounded-control border border-v2-warn/60 px-2.5 text-caption font-semibold text-v2-warn"
        >
          <Icon id="i-warn" className="size-3.5" />
          {t('statusBar.works.storeFull')}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending || state.waiting < 1}
          aria-label={state.full
            ? t('statusBar.works.hintFull')
            : `${t('statusBar.works.collect')}${said ? ` · ${said}` : ''}`}
          onClick={onCollect}
          className={`flex h-8 shrink-0 items-center gap-1 rounded-control border border-v2-self/60 bg-v2-self/15 px-2.5 text-caption font-semibold text-v2-ink disabled:opacity-40 ${
            state.full ? 'animate-pulse' : ''
          }`}
        >
          <Icon id="i-collect" className="size-3.5 text-v2-self" />
          {t('statusBar.works.collect')}
        </button>
      )}
    </section>
  );
}
