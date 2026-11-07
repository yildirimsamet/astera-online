import { VESSEL_SYSTEMS, vesselHull, vesselLook, type VesselProgress, type VesselSystem } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { goalRepair, useStarterGoal } from './tutorial/visualGoal.js';
import { Icon } from '../v2/icons.js';
import { HERO_BAYS, SYSTEM_ICON, heroArt, systemPercent, type HeroBay } from './shipScreen.js';

const LIVE = 'var(--color-v2-self)';
const DEAD = 'var(--color-v2-hostile)';

function Mark({ system, percent, selected, onSelect, bay, next }: {
  system: VesselSystem; percent: number; selected: boolean; onSelect: () => void; bay: HeroBay; next: boolean;
}) {
  const { t } = useTranslation();
  const lit = percent > 0 || next;
  const tone = lit ? LIVE : DEAD;
  return (
    <button
      type="button"
      aria-label={t(`starter.system.${system}`)}
      aria-pressed={selected}
      onClick={onSelect}
      style={{ left: `${String(bay.markX)}%`, top: `${String(bay.markY)}%` }}
      className={`absolute flex min-h-8 -translate-y-1/2 items-center gap-1 ${bay.words === 'left' ? 'flex-row-reverse' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-7 shrink-0 place-items-center rounded-full ${selected ? 'shadow-[0_0_10px_1px_var(--color-v2-self)]' : ''}`}
        style={{ background: `conic-gradient(${tone} ${String(Math.max(percent, 6))}%, color-mix(in srgb, ${tone} 28%, transparent) 0)` }}
      >
        <span className="grid size-6 place-items-center rounded-full bg-v2-void/90" style={{ color: tone }}>
          <Icon id={SYSTEM_ICON[system]} className="size-3.5" />
        </span>
      </span>
      <span className={`flex flex-col text-micro leading-tight [text-shadow:0_1px_3px_#000,0_0_8px_#000] ${bay.words === 'left' ? 'items-end' : 'items-start'}`}>
        <span className="font-medium text-v2-ink">{t(`starter.systemShort.${system}`)}</span>
        <span className="font-v2-mono" style={{ color: lit ? tone : 'var(--color-v2-ink-2)' }}>{percent}%</span>
      </span>
    </button>
  );
}

/**
 * THE SHIP ITSELF, the top of the screen and the reason for all of it. One painting per hull and
 * state, swapped as repairs add up, so the player watches their own ship come back. A thin line ties
 * each mark to the machine it stands for, and a mark is a door to that system's card.
 */
export function ShipHero({ id, progress, selected, onSelect, compact = false }: {
  id: string; progress: VesselProgress; selected: VesselSystem; onSelect: (system: VesselSystem) => void;
  /** A shorter frame when the deck switch needs the height: the painting fills the width, and the marks stay on their machines. */
  compact?: boolean;
}) {
  const hull = vesselHull(id);
  const bays = HERO_BAYS[hull];
  const next = goalRepair(useStarterGoal())?.system;
  return (
    <div data-testid="ship-hero" className="shrink-0 overflow-hidden">
      {/* Everything here is percent of the painting, so the frame keeps its shape on any screen. */}
      <div className={`relative mx-auto w-full max-w-[440px] ${compact ? 'aspect-[7/4]' : 'aspect-[3/2]'}`}>
        <img src={heroArt(hull, vesselLook(progress))} alt="" draggable={false} className={`absolute inset-0 size-full object-cover brightness-125 saturate-110 ${compact ? '[mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]' : 'v2-split:[mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]'}`} />
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-v2-void to-transparent" />
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
          {VESSEL_SYSTEMS.map(system => {
            const bay = bays[system];
            const tone = next === system || systemPercent(progress, system) > 0 ? LIVE : DEAD;
            return <line key={system} x1={bay.markX + 4} y1={bay.markY} x2={bay.x} y2={bay.y} stroke={tone} strokeOpacity={0.7} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        {VESSEL_SYSTEMS.map(system => {
          const bay = bays[system];
          const tone = next === system || systemPercent(progress, system) > 0 ? LIVE : DEAD;
          return <span key={system} aria-hidden="true" className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${String(bay.x)}%`, top: `${String(bay.y)}%`, background: tone, boxShadow: `0 0 6px ${tone}` }} />;
        })}
        {VESSEL_SYSTEMS.map(system => (
          <Mark key={system} system={system} percent={systemPercent(progress, system)} selected={selected === system}
            onSelect={() => { onSelect(system); }} bay={bays[system]} next={next === system} />
        ))}
      </div>
    </div>
  );
}
