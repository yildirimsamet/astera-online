import { VESSEL_SYSTEMS, jumpWindowOpen, vesselHull, vesselLook, type VesselProgress, type VesselSystem } from '@astera/rules';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { holdScroll, releaseScroll } from '../lib/scrollHold.js';
import { playSound } from '../lib/sound.js';
import { goalRepair, useStarterGoal } from './tutorial/visualGoal.js';
import { Icon } from '../v2/icons.js';
import { HERO_BAYS, HERO_SIZES, SYSTEM_ICON, bayCondition, heroArt, heroPlaceholder, heroSrcSet, repairMoment, systemPercent, type HeroBay, type RepairMoment, type RepairTier } from './shipScreen.js';
import './shipHero.css';

const LIVE = 'var(--color-v2-self)';
const DEAD = 'var(--color-v2-hostile)';

const MOMENT_MS: Record<RepairTier, number> = { routine: 1000, capability: 1600, big: 2400 };

const ignitionKey = (id: string) => `astera.starter.ignition.${id}`;

function rememberIgnition(id: string): void {
  try { window.localStorage.setItem(ignitionKey(id), '1'); } catch { /* the moment may play again */ }
}

/**
 * The first loop often ends with the player away (a mining run home), and the drive waking is worth
 * coming back to: an ignition nobody watched waits for the first look at the ship. Everything else
 * starts from now. The ship a moment before is the one whose run had not come home yet.
 */
function beforeThisVisit(id: string, progress: VesselProgress): VesselProgress {
  if (!jumpWindowOpen(progress)) return progress;
  try {
    if (window.localStorage.getItem(ignitionKey(id)) !== null) return progress;
  } catch {
    return progress;
  }
  return { ...progress, facts: progress.facts.filter(fact => fact !== 'FIRST_MINING_RETURN') };
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
    if (found.tier === 'routine') { playSound('weld', { seconds: 1 }); haptic('tap'); }
    if (found.tier === 'big') { playSound('ignite', { seconds: 2.5 }); haptic('rumble'); rememberIgnition(id); }
  }, [id, progress]);
  useEffect(() => {
    if (!moment) return undefined;
    const timer = window.setTimeout(() => { setMoment(null); }, MOMENT_MS[moment.tier]);
    return () => { window.clearTimeout(timer); };
  }, [moment]);
  return moment;
}

/** The part repaired counts up through this, shakes the ship this long, and rests a breath (owner 2026-11-18, item 5). */
export const GAIN_COUNT_MS = 900;
export const GAIN_SHAKE_MS = 320;
const GAIN_REST_MS = 200;

type Shares = Record<VesselSystem, number>;
const seenKey = (id: string) => `astera.starter.heroSeen.${id}`;

/** What the player last saw of each part, on this device; null on a first look or a record that will not read. */
function seenShares(id: string): Shares | null {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(seenKey(id)) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return null;
    const seen = Object.fromEntries(VESSEL_SYSTEMS.map(system => [system, (raw as Record<string, unknown>)[system]]));
    return VESSEL_SYSTEMS.every(system => typeof seen[system] === 'number') ? seen as Shares : null;
  } catch {
    return null;
  }
}

function rememberShares(id: string, shares: Shares): void {
  try { window.localStorage.setItem(seenKey(id), JSON.stringify(shares)); } catch { /* the moment may play again */ }
}

/**
 * THE REPAIR SHOWN ON THE SHIP (owner phone playtest 2026-11-18, item 5). The page steps aside while a
 * repair is shown on the galaxy, so the change lands while it is closed. The ship remembers what was last
 * seen on it: a part that grew is lit and counts up from there, the ship gives one light, short shake, and
 * the page goes on to the next Repair. A first look, or nothing grown, shows the ship as it is.
 */
function useGains(id: string, shares: Shares): { shown: Shares; gains: readonly VesselSystem[]; shaking: boolean } {
  const key = VESSEL_SYSTEMS.map(system => shares[system]).join(',');
  const last = useRef<Shares | null>(null);
  const latest = useRef(shares);
  latest.current = shares;
  const [run, setRun] = useState<{ from: Shares; gains: VesselSystem[]; started: number } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const now = latest.current;
    const seen = last.current ?? seenShares(id) ?? now;
    last.current = now;
    const gains = VESSEL_SYSTEMS.filter(system => now[system] > seen[system]);
    if (gains.length === 0) { rememberShares(id, now); return; }
    setRun({ from: seen, gains, started: Date.now() });
  }, [id, key]);
  useEffect(() => {
    if (!run) return undefined;
    // The moment is where the player looks: nothing else moves the page until it is over (item 25).
    holdScroll(GAIN_COUNT_MS + GAIN_SHAKE_MS + GAIN_REST_MS);
    const counting = window.setInterval(() => { setTick(n => n + 1); }, 30);
    const shake = window.setTimeout(() => {
      window.clearInterval(counting);
      setTick(n => n + 1);
      setShaking(true);
      haptic('tap');
      playSound('tick');
    }, GAIN_COUNT_MS);
    const done = window.setTimeout(() => {
      setShaking(false);
      setRun(null);
      rememberShares(id, latest.current);
      releaseScroll();
      // With the guide speaking, its pointer takes the page to what it names (a crate, or the next repair).
      if (document.querySelector('[data-school-coach]')) return;
      (document.querySelector('[data-starter-next]') ?? document.querySelector('[data-guide="repair-order"]'))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, GAIN_COUNT_MS + GAIN_SHAKE_MS + GAIN_REST_MS);
    return () => { window.clearInterval(counting); window.clearTimeout(shake); window.clearTimeout(done); releaseScroll(); };
  }, [run, id]);
  if (!run) return { shown: shares, gains: [], shaking };
  const share = Math.min(1, (Date.now() - run.started) / GAIN_COUNT_MS);
  const shown = Object.fromEntries(VESSEL_SYSTEMS.map(system => [system, run.gains.includes(system)
    ? Math.round(run.from[system] + (shares[system] - run.from[system]) * share)
    : shares[system]])) as Shares;
  return { shown, gains: run.gains, shaking };
}

function Mark({ system, percent, selected, onSelect, bay, next, gain }: {
  system: VesselSystem; percent: number; selected: boolean; onSelect: () => void; bay: HeroBay; next: boolean; gain: boolean;
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
      data-mark={system}
      {...(gain ? { 'data-gain': '' } : {})}
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
        <span data-percent="" className="font-v2-mono" style={{ color: lit ? tone : 'var(--color-v2-ink-2)' }}>{percent}%</span>
      </span>
    </button>
  );
}

/**
 * THE SHIP ITSELF, the top of the screen and the reason for all of it. One painting per hull and
 * state, swapped as repairs add up, so the player watches their own ship come back. A thin line ties
 * each mark to the machine it stands for, and a mark is a door to that system's card.
 */
export function ShipHero({ id, progress, selected, onSelect, compact = false, sealed = false }: {
  id: string; progress: VesselProgress; selected: VesselSystem; onSelect: (system: VesselSystem) => void;
  /** The hold is full: the cargo hatches stay closed (plan 2026-11-13 §4.5). */
  sealed?: boolean;
  /** A shorter frame when the deck switch needs the height: the painting fills the width, and the marks stay on their machines. */
  compact?: boolean;
}) {
  const hull = vesselHull(id);
  const bays = HERO_BAYS[hull];
  const next = goalRepair(useStarterGoal())?.system;
  const moment = useRepairMoment(id, progress);
  const shares = Object.fromEntries(VESSEL_SYSTEMS.map(system => [system, systemPercent(progress, system)])) as Shares;
  const { shown, gains, shaking } = useGains(id, shares);
  const look = vesselLook(progress);
  const mask = compact ? '[mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]' : 'v2-split:[mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]';
  return (
    <div data-testid="ship-hero" {...(moment ? { 'data-moment': moment.tier } : {})} {...(shaking ? { 'data-shake': '' } : {})} className="shrink-0 overflow-hidden">
      {/* Everything here is percent of the painting, so the frame keeps its shape on any screen. */}
      <div className={`ship-hero-frame relative mx-auto w-full max-w-[396px] ${compact ? 'aspect-[7/4]' : 'aspect-[3/2]'}`}>
        {/* A blur of it stands in at once, and the painting is asked for first, in the width it is drawn (owner phone playtest 2026-11-19). */}
        <img aria-hidden="true" src={heroPlaceholder(hull, look)} alt="" draggable={false} className={`absolute inset-0 size-full object-cover blur-md brightness-125 saturate-110 ${mask}`} />
        <img src={heroArt(hull, look)} srcSet={heroSrcSet(hull, look)} sizes={HERO_SIZES} fetchPriority="high" decoding="async" alt="" draggable={false} className={`ship-hero-art absolute inset-0 size-full object-cover brightness-125 saturate-110 ${mask}`} />
        {VESSEL_SYSTEMS.map(system => (
          <span key={system} aria-hidden="true" data-bay={system} data-condition={bayCondition(systemPercent(progress, system))}
            {...(moment?.system === system ? { 'data-just': moment.tier } : gains.includes(system) ? { 'data-just': 'routine' } : {})}
            {...(sealed && system === 'CARGO' ? { 'data-sealed': '' } : {})}
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
          <Mark key={system} system={system} percent={shown[system]} selected={selected === system}
            onSelect={() => { onSelect(system); }} bay={bays[system]} next={next === system} gain={gains.includes(system)} />
        ))}
      </div>
    </div>
  );
}
