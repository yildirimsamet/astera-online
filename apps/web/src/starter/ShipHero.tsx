import { VESSEL_SYSTEMS, moduleStage, vesselHull, vesselLook, type VesselProgress, type VesselSystem } from '@astera/rules';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { goalRepair, useStarterGoal } from './tutorial/visualGoal.js';
import { Icon } from '../v2/icons.js';
import { HERO_BAYS, SYSTEM_ICON, bayCondition, heroArt, repairMoment, systemPercent, type HeroBay, type RepairMoment, type RepairTier } from './shipScreen.js';
import './shipHero.css';

const LIVE = 'var(--color-v2-self)';
const DEAD = 'var(--color-v2-hostile)';

const MOMENT_MS: Record<RepairTier, number> = { routine: 1000, capability: 1600, big: 2400 };

const ignitionKey = (id: string) => `astera.starter.ignition.${id}`;

function rememberIgnition(id: string): void {
  try { window.localStorage.setItem(ignitionKey(id), '1'); } catch { /* the moment may play again */ }
}

/**
 * Hours of work usually end with the player away, and the engines coming in is worth coming back to:
 * an ignition nobody watched waits for the first look at the ship. Everything else starts from now.
 */
function beforeThisVisit(id: string, progress: VesselProgress): VesselProgress {
  if (moduleStage(progress, 'DRIVE_THRUST') < 1) return progress;
  try {
    if (window.localStorage.getItem(ignitionKey(id)) !== null) return progress;
  } catch {
    return progress;
  }
  return { ...progress, modules: { ...progress.modules, DRIVE_THRUST: 0 } };
}

/**
 * THE ANSWER TO A REPAIR THAT JUST CAME IN (plan F8), one per event. A new capability's sound belongs
 * to the card that names it, so only the routine and the engines speak here.
 */
function useRepairMoment(id: string, progress: VesselProgress): RepairMoment | null {
  const [opening] = useState(() => beforeThisVisit(id, progress));
  const last = useRef(opening);
  const [moment, setMoment] = useState<RepairMoment | null>(null);
  useEffect(() => {
    const found = repairMoment(last.current, progress);
    last.current = progress;
    if (!found) return;
    setMoment(found);
    if (found.tier === 'routine') { playSound('weld'); haptic('tap'); }
    if (found.tier === 'big') { playSound('ignite'); haptic('rumble'); rememberIgnition(id); }
  }, [id, progress]);
  useEffect(() => {
    if (!moment) return undefined;
    const timer = window.setTimeout(() => { setMoment(null); }, MOMENT_MS[moment.tier]);
    return () => { window.clearTimeout(timer); };
  }, [moment]);
  return moment;
}

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
  const moment = useRepairMoment(id, progress);
  return (
    <div data-testid="ship-hero" {...(moment ? { 'data-moment': moment.tier } : {})} className="shrink-0 overflow-hidden">
      {/* Everything here is percent of the painting, so the frame keeps its shape on any screen. */}
      <div className={`ship-hero-frame relative mx-auto w-full max-w-[440px] ${compact ? 'aspect-[7/4]' : 'aspect-[3/2]'}`}>
        <img src={heroArt(hull, vesselLook(progress))} alt="" draggable={false} className={`ship-hero-art absolute inset-0 size-full object-cover brightness-125 saturate-110 ${compact ? '[mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]' : 'v2-split:[mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]'}`} />
        {VESSEL_SYSTEMS.map(system => (
          <span key={system} aria-hidden="true" data-bay={system} data-condition={bayCondition(systemPercent(progress, system))}
            {...(moment?.system === system ? { 'data-just': moment.tier } : {})}
            className="ship-bay" style={{ left: `${String(bays[system].x)}%`, top: `${String(bays[system].y)}%` }} />
        ))}
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
