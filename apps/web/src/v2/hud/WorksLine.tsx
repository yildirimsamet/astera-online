import { useTranslation } from 'react-i18next';
import { WORKS_RESOURCES, type CollectState, type WorksResource } from '../../lib/collect.js';
import { compact, full } from '../../lib/format.js';
import { duration } from '../../lib/time.js';
import { Icon } from '../icons.js';

export interface WorksLineProps {
  state: CollectState;
  /** Minutes until the first vessel still filling reaches its rim (`worksOutlook`). */
  fullInMinutes: number | null;
  pending: boolean;
  onCollect: () => void;
  /** Where a full store is raised: the Base's production. */
  onOpenBase: () => void;
}

/**
 * THE WORKS, UNDER THE STORES (owner, 2026-09-25: "Works/Havuz section -> top status bar'a
 * taşınmalı. Kullanıcı tek bakışta görebilmeli").
 *
 * The top bar's third line, in the meters' own three columns: under each store, what its
 * vessel in the works holds, and the whole line is the one press that collects. The colour
 * says what to do — quiet while there is little, turquoise once it is worth a tap (the
 * threshold the bubble had), yellow where a vessel is full and that resource has stopped,
 * or where the store has no room left for it: a gap to close, never red (K2). A store that
 * can take none of it is said before the press, and the press opens the base instead.
 *
 * It keeps its height while empty, so the bar never moves under the thumb.
 */
export function WorksLine({ state, fullInMinutes, pending, onCollect, onOpenBase }: WorksLineProps) {
  const { t } = useTranslation();
  const waiting = WORKS_RESOURCES.filter((resource) => state.each[resource] >= 1);
  const said = waiting
    .map((resource) => t(`statusBar.works.${resource}`, { amount: full(Math.floor(state.each[resource])) }))
    .join(', ');
  const status = state.full
    ? t('statusBar.works.fullStopped')
    : fullInMinutes === null || waiting.length === 0 ? null : t('statusBar.works.fillsIn', { time: duration(fullInMinutes) });
  const action = state.blocked ? t('statusBar.works.storeFull') : waiting.length > 0 ? t('statusBar.works.collect') : null;
  const name = [
    t('statusBar.works.label'),
    said || t('statusBar.works.gathers'),
    ...(status === null ? [] : [status]),
    ...(action === null ? [] : [action]),
  ].join(' · ');

  const tone = (resource: WorksResource): string => {
    if (state.stopped.includes(resource) || state.noRoom.includes(resource)) return 'text-v2-warn';
    return state.ripe ? 'text-v2-self' : 'text-v2-ink-3';
  };

  return (
    <button
      type="button"
      aria-label={name}
      data-works-line=""
      disabled={pending || waiting.length === 0}
      onClick={state.blocked ? onOpenBase : onCollect}
      className={`col-span-3 grid h-3 grid-cols-3 gap-2 text-left font-v2-mono text-micro leading-3 tabular-nums disabled:cursor-default ${
        state.full && !pending ? 'animate-pulse' : ''
      }`}
    >
      {WORKS_RESOURCES.map((resource) => (
        <span key={resource} data-works-resource={resource} className={`flex min-w-0 items-center gap-0.5 ${tone(resource)}`}>
          {state.each[resource] >= 1 && (
            <>
              <Icon id="i-collect" className="size-2.5 shrink-0" />
              <span className="truncate">{compact(state.each[resource])}</span>
            </>
          )}
        </span>
      ))}
    </button>
  );
}
