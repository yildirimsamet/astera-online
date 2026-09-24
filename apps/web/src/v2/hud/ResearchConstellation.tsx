import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RESEARCH_PROJECTS, type ResearchProjectId } from '@astera/rules';
import { RESEARCH_GROUPS, constellationLayout, type ResearchGroupId } from '../../lib/constellation.js';

export interface StarState {
  id: ResearchProjectId;
  name: string;
  level: number;
  maxLevel: number;
  /** Something stands in front of it: a prerequisite, the act clock, the Core. */
  locked: boolean;
  /** In the commander's research lane now. */
  running: boolean;
}

export interface ResearchConstellationProps {
  stars: readonly StarState[];
  selected: ResearchProjectId | null;
  onSelect: (id: ResearchProjectId) => void;
  /** The strategic group is behind its release flag: drawn, dimmed and said closed. */
  dimStrategic?: boolean;
}

/** A line down a column runs under the labels on it; a patch of the sheet's colour keeps them read. */
const HALO = 'rounded-cell bg-v2-panel/85 px-0.5';

/** Where each group's name sits in its quarter: the left pair on the left, the right pair on the right. */
const LABEL_SIDE: Record<ResearchGroupId, 'left' | 'right'> = {
  frontier: 'left',
  doctrine: 'right',
  industry: 'left',
  strategic: 'right',
};

/**
 * THE RESEARCH CONSTELLATION. Spec E8 · K9 (docs/ui-v2/gozlemevi.md), the mock's
 * "Araştırma takımyıldızı": what is next, at one glance, where the list took four bands.
 *
 * Each group a quarter of the sky, each project a star: hollow at zero, brighter the
 * higher it stands on its ladder, dim with a lock while something stands in front of it.
 * A line runs to a project from the one it needs inside its group; one it needs from
 * another group is named under it. Names are one line and cut short, as the mock's
 * are: the card under the map carries the whole one. The star in the research lane pulses; the selected
 * one is ringed, and the card under the map is the decision.
 */
export function ResearchConstellation({ stars, selected, onSelect, dimStrategic = false }: ResearchConstellationProps) {
  const { t } = useTranslation();
  const layout = useMemo(() => constellationLayout(RESEARCH_GROUPS, (id) => RESEARCH_PROJECTS[id].prerequisite), []);
  const byId = new Map(stars.map((star) => [star.id, star]));
  const at = new Map(layout.nodes.map((node) => [node.id, node]));

  return (
    <div
      data-constellation
      role="group"
      aria-label={t('researchMap.label')}
      className="relative aspect-[1/1.05] w-full overflow-hidden bg-[radial-gradient(60%_55%_at_50%_48%,rgb(24_36_64/55%),transparent_85%)] font-v2-ui"
    >
      {layout.regions.map((region) => {
        const group = RESEARCH_GROUPS.find((candidate) => candidate.id === region.group);
        if (!group) return null;
        const dim = dimStrategic && region.group === 'strategic';
        return (
          <p
            key={region.group}
            data-region={region.group}
            className={`absolute text-micro font-semibold uppercase tracking-wide ${dim ? 'text-v2-ink-3/60' : 'text-v2-ink-3'}`}
            style={{
              top: `${String(region.y * 100 + 0.5)}%`,
              ...(LABEL_SIDE[region.group] === 'left'
                ? { left: `${String(region.x * 100 + 2)}%` }
                : { right: `${String((1 - region.x - region.w) * 100 + 2)}%` }),
            }}
          >
            {dim ? t('researchMap.closed', { group: t(group.label) }) : t(group.label)}
          </p>
        );
      })}

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full">
        {layout.edges.map((edge) => {
          const from = at.get(edge.from);
          const to = at.get(edge.to);
          if (!from || !to) return null;
          const lit = (byId.get(edge.from)?.level ?? 0) > 0 && (byId.get(edge.to)?.level ?? 0) > 0;
          return (
            <line
              key={`${edge.from}>${edge.to}`}
              x1={from.x * 100}
              y1={from.y * 100}
              x2={to.x * 100}
              y2={to.y * 100}
              vectorEffect="non-scaling-stroke"
              className={lit ? 'stroke-v2-self/70' : 'stroke-v2-line-hi'}
              strokeWidth={1}
            />
          );
        })}
      </svg>

      {layout.nodes.map((node) => {
        const star = byId.get(node.id);
        if (!star) return null;
        const dim = dimStrategic && node.group === 'strategic';
        const share = star.maxLevel > 0 ? star.level / star.maxLevel : 0;
        const on = selected === node.id;
        const outside = node.outside === null ? null : byId.get(node.outside)?.name ?? null;
        return (
          <button
            key={node.id}
            type="button"
            data-star={node.id}
            data-group={node.group}
            data-level={String(star.level)}
            {...(star.locked ? { 'data-locked': '' } : {})}
            {...(star.running ? { 'data-running': '' } : {})}
            aria-pressed={on}
            aria-label={`${star.name} · ${String(star.level)}/${String(star.maxLevel)}`}
            onClick={() => { onSelect(node.id); }}
            className={`absolute flex w-[76px] -translate-x-1/2 flex-col items-center gap-1 ${dim || star.locked ? 'opacity-50' : ''}`}
            style={{ left: `${String(node.x * 100)}%`, top: `calc(${String(node.y * 100)}% - 6px)` }}
          >
            <span className="relative grid size-3 place-items-center">
              {star.level > 0 ? (
                <span className="size-3 rounded-full bg-v2-self shadow-[0_0_8px_rgb(46_230_200/60%)]" style={{ opacity: 0.35 + 0.65 * share }} />
              ) : (
                <span className="size-3 rounded-full border border-v2-ink-2" />
              )}
              {on && <span className="absolute -inset-1 rounded-full border border-dashed border-v2-self" />}
              {star.running && <span className="absolute -inset-1 animate-ping rounded-full border border-v2-self/70" />}
            </span>
            <span className={`max-w-full truncate text-micro leading-tight ${HALO} ${on ? 'text-v2-ink' : 'text-v2-ink-2'}`}>{star.name}</span>
            {outside !== null && <span className={`max-w-full truncate text-micro leading-tight text-v2-ink-3 ${HALO}`}>← {outside}</span>}
          </button>
        );
      })}
    </div>
  );
}
