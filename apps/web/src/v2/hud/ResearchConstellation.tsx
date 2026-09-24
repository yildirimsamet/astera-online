import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RESEARCH_PROJECTS, type ResearchProjectId } from '@astera/rules';
import { RESEARCH_GROUPS, constellationLayout, type ResearchGroupId } from '../../lib/constellation.js';
import { StarField } from '../kit/StarField.js';

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

/**
 * A line down a column runs under the labels on it; a feathered patch of the night keeps
 * them read — soft-edged, so over the sky it is a shadow, not a box.
 */
const HALO = 'rounded-full bg-v2-deep/70 px-1 shadow-[0_0_6px_3px_color-mix(in_srgb,var(--color-v2-deep)_70%,transparent)]';

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
      className="relative isolate aspect-[1/1.05] w-full overflow-hidden rounded-control font-v2-ui"
    >
      {/* The map on the galaxy, as the mock draws it (owner, 2026-09-24). */}
      <StarField className="absolute inset-0 -z-10" />
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
            className={`absolute flex w-[76px] -translate-x-1/2 flex-col items-center gap-1 ${dim || star.locked ? 'opacity-60' : ''}`}
            style={{ left: `${String(node.x * 100)}%`, top: `calc(${String(node.y * 100)}% - 6px)` }}
          >
            {/*
              A STAR IN EVERY RING (owner, 2026-09-24). The ring is the project; the star in
              it is how far up its ladder: a white one at nothing held, then teal, brighter and
              glowing the higher it stands (E8: "parlaklık = seviye / en yüksek"). Larger and
              brighter than any star of the sky behind it (owner, 2026-09-24: "görmekte
              zorlanılıyor"), held or not.
            */}
            <span className="relative grid size-3.5 place-items-center">
              <span
                className={`absolute inset-0 rounded-full border ${
                  star.level > 0 ? 'border-v2-self bg-v2-self/20' : 'border-v2-ink-2 bg-v2-deep/70'
                }`}
              />
              <svg
                data-star-glyph
                viewBox="0 0 10 10"
                aria-hidden="true"
                className={`relative size-3 ${
                  star.level > 0
                    ? 'fill-v2-self drop-shadow-[0_0_5px_color-mix(in_srgb,var(--color-v2-self)_90%,transparent)]'
                    : 'fill-v2-ink drop-shadow-[0_0_3px_color-mix(in_srgb,var(--color-v2-ink)_60%,transparent)]'
                }`}
                style={{ opacity: star.level > 0 ? 0.8 + 0.2 * share : 0.85 }}
              >
                <path d="M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z" />
              </svg>
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
