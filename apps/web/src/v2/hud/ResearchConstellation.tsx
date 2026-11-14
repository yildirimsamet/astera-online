import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RESEARCH_PROJECTS, type ResearchProjectId } from '@astera/rules';
import { haptic } from '../../lib/haptics.js';
import { OWN_SOUND, playSound } from '../../lib/sound.js';
import {
  CONSTELLATION_ASPECT, RESEARCH_GROUPS, constellationLayout, type ResearchGroupId,
} from '../../lib/constellation.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
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
}

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
 * another group is named under it. Names are whole, on up to two lines (G2-i: a cut name
 * was a guess). The star in the research lane pulses; the selected one is ringed, and the
 * card under the map is the decision.
 */
export function ResearchConstellation({ stars, selected, onSelect }: ResearchConstellationProps) {
  const { t } = useTranslation();
  const layout = useMemo(() => constellationLayout(RESEARCH_GROUPS, (id) => RESEARCH_PROJECTS[id].prerequisite), []);
  const byId = new Map(stars.map((star) => [star.id, star]));
  const at = new Map(layout.nodes.map((node) => [node.id, node]));

  return (
    <div
      data-constellation
      role="group"
      aria-label={t('researchMap.label')}
      className="gk gk-cmap"
      style={{ aspectRatio: `1 / ${String(CONSTELLATION_ASPECT)}` }}
    >
      {/* The map on the galaxy, as the mock draws it (owner, 2026-09-24). */}
      <StarField className="gk-cmap__sky" />
      {layout.regions.map((region) => {
        const group = RESEARCH_GROUPS.find((candidate) => candidate.id === region.group);
        if (!group) return null;
        return (
          <p
            key={region.group}
            data-region={region.group}
            className="gk-label gk-cmap__region"
            style={{
              top: `${String(region.y * 100 + 0.5)}%`,
              ...(LABEL_SIDE[region.group] === 'left'
                ? { left: `${String(region.x * 100 + 2)}%` }
                : { right: `${String((1 - region.x - region.w) * 100 + 2)}%` }),
            }}
          >
            {t(group.label)}
          </p>
        );
      })}

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="gk-cmap__lines">
        {layout.edges.map((edge) => {
          const from = at.get(edge.from);
          const to = at.get(edge.to);
          // A project this season was not dealt has no star, so nothing leads to its spot.
          if (!from || !to || !byId.has(edge.from) || !byId.has(edge.to)) return null;
          const lit = (byId.get(edge.from)?.level ?? 0) > 0 && (byId.get(edge.to)?.level ?? 0) > 0;
          return (
            <line
              key={`${edge.from}>${edge.to}`}
              x1={from.x * 100}
              y1={from.y * 100}
              x2={to.x * 100}
              y2={to.y * 100}
              vectorEffect="non-scaling-stroke"
              {...(lit ? { 'data-lit': '' } : {})}
            />
          );
        })}
      </svg>

      {layout.nodes.map((node) => {
        const star = byId.get(node.id);
        if (!star) return null;
        const outside = node.outside === null ? null : byId.get(node.outside)?.name ?? null;
        return <Star key={node.id} star={star} x={node.x} y={node.y} group={node.group} outside={outside} on={selected === node.id} onSelect={onSelect} />;
      })}
    </div>
  );
}

/**
 * A PROJECT ON THE MAP, A THUMB'S TARGET (G2-i). The ring is the project; the star in it is
 * how far up its ladder: white at nothing held, then the own colour, brighter the higher it
 * stands (E8: "parlaklık = seviye / en yüksek"). A shut one dims its ring, never its name;
 * the one in the lane pulses; the selected one is ringed. The name is whole, on two lines.
 */
function Star({ star, x, y, group, outside, on, onSelect }: {
  star: StarState;
  x: number;
  y: number;
  group: ResearchGroupId;
  outside: string | null;
  on: boolean;
  onSelect: (id: ResearchProjectId) => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onSelect(star.id); });
  const share = star.maxLevel > 0 ? star.level / star.maxLevel : 0;
  return (
    <button
      type="button"
      {...OWN_SOUND}
      data-star={star.id}
      data-group={group}
      data-level={String(star.level)}
      {...(star.locked ? { 'data-locked': '' } : {})}
      {...(star.running ? { 'data-running': '' } : {})}
      aria-pressed={on}
      aria-label={`${star.name} · ${String(star.level)}/${String(star.maxLevel)}`}
      className="gk-cmap__star"
      style={{ left: `${String(x * 100)}%`, top: `calc(${String(y * 100)}% - 8px)` }}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="gk-cmap__dot" data-held={star.level > 0 ? '' : undefined}>
        <svg data-star-glyph viewBox="0 0 10 10" aria-hidden="true" style={{ opacity: star.level > 0 ? 0.8 + 0.2 * share : 0.85 }}>
          <path d="M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z" />
        </svg>
      </span>
      <span className="gk-cmap__name">{star.name}</span>
      {outside !== null && <span className="gk-cmap__from">← {outside}</span>}
    </button>
  );
}
