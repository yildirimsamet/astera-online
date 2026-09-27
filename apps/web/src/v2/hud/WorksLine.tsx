import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WORKS_RESOURCES, type CollectState, type WorksResource } from '../../lib/collect.js';
import { compact, full } from '../../lib/format.js';
import { duration } from '../../lib/time.js';
import { RESOURCE_ART } from '../../ui/assets.js';

export interface WorksLineProps {
  state: CollectState;
  fill: Record<WorksResource, number>;
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
 * says what to do — quiet while there is little, a subtle ring once it is worth a tap,
 * yellow where a vessel is full and that resource has stopped,
 * or where the store has no room left for it: a gap to close, never red (K2). A store that
 * can take none of it is said before the press, and the press opens the base instead.
 *
 * It keeps its height while empty, so the bar never moves under the thumb.
 */
const TONE: Record<WorksResource, { ink: string; track: string; fill: string }> = {
  alloy: { ink: 'text-v2-alloy', track: 'border-v2-alloy/35 bg-v2-alloy/[0.06]', fill: 'bg-v2-alloy/15' },
  crystal: { ink: 'text-v2-crystal', track: 'border-v2-crystal/35 bg-v2-crystal/[0.06]', fill: 'bg-v2-crystal/15' },
  deuterium: { ink: 'text-v2-deut', track: 'border-v2-deut/35 bg-v2-deut/[0.06]', fill: 'bg-v2-deut/15' },
};

export function WorksLine({ state, fill, fullInMinutes, pending, onCollect, onOpenBase }: WorksLineProps) {
  const { t } = useTranslation();
  const [tip, setTip] = useState(() => {
    try { return window.localStorage.getItem('astera:works-tip-v1') !== 'seen'; }
    catch { return false; }
  });
  const waiting = WORKS_RESOURCES.filter((resource) => state.each[resource] >= 1);
  useEffect(() => {
    if (!tip || waiting.length === 0) return;
    try { window.localStorage.setItem('astera:works-tip-v1', 'seen'); } catch { /* Storage is optional. */ }
  }, [tip, waiting.length]);
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

  const dismissTip = (): void => {
    setTip(false);
    try { window.localStorage.setItem('astera:works-tip-v1', 'seen'); } catch { /* Storage is optional. */ }
  };

  return (
    <div className="relative col-span-3 min-w-0">
    <button
      type="button"
      aria-label={name}
      data-works-line=""
      disabled={pending || waiting.length === 0}
      onClick={() => { dismissTip(); (state.blocked ? onOpenBase : onCollect)(); }}
      data-ripe={state.ripe ? '' : undefined}
      className={`grid h-4 w-full grid-cols-3 gap-1.5 text-left font-v2-mono text-micro tabular-nums disabled:cursor-default ${state.full && !pending ? 'animate-pulse' : ''}`}
    >
      {WORKS_RESOURCES.map((resource) => {
        const empty = state.each[resource] < 1;
        const warn = state.stopped.includes(resource) || state.noRoom.includes(resource);
        return (
          <span key={resource} data-works-resource={resource} data-empty={empty ? '' : undefined}
            className={`relative flex min-w-0 items-center justify-center gap-0.5 overflow-hidden rounded-full border px-1 ${empty ? 'border-v2-line/35 bg-v2-deep/25 opacity-40 text-v2-ink-3' : warn ? 'border-v2-warn/65 bg-v2-warn/10 text-v2-warn' : `${TONE[resource].track} ${TONE[resource].ink} ${state.ripe ? 'ring-1 ring-inset ring-current/25' : ''}`}`}>
            <span data-works-fill="" aria-hidden="true" className={`absolute inset-0 origin-left ${TONE[resource].fill} transition-transform duration-500`} style={{ transform: `scaleX(${String(fill[resource])})` }} />
            <img src={RESOURCE_ART[resource]} alt="" className="relative size-2.5 shrink-0 object-contain" />
            {!empty && <span className="relative truncate font-semibold">+{compact(state.each[resource])}</span>}
          </span>
        );
      })}
    </button>
    {tip && waiting.length > 0 && <span role="note" className="pointer-events-none absolute left-0 top-full z-30 mt-12 rounded-control border border-v2-line-hi bg-v2-deep/95 px-2 py-1 text-micro text-v2-ink shadow-md"><span aria-hidden="true" className="mr-1">☝</span>{t('statusBar.works.firstTip')}</span>}
    </div>
  );
}
