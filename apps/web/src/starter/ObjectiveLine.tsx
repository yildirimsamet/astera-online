import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { VesselView } from '../api/starterSchemas.js';
import { galaxyCover, watchGalaxyCover } from '../lib/galaxyCover.js';
import { haptic } from '../lib/haptics.js';
import { useProjected } from '../lib/projection.js';
import { playSound } from '../lib/sound.js';
import { clockTime, duration, useNow } from '../lib/time.js';
import { Icon } from '../v2/icons.js';
import { vesselToPlanetView } from './adapter.js';
import { opportunities, type Opportunity } from './opportunities.js';
import { moduleName } from './shipCopy.js';
import { goalRepair, useStarterGoal } from './tutorial/visualGoal.js';
import { repairWait } from './tutorial/script.js';
import { repairGainIcon, stepEffects } from './steps.js';

const progressOf = (vessel: VesselView) => ({ modules: vessel.modules, facts: vessel.facts, parts: vessel.parts, fuel: vessel.fuel });

/** Longer than this and the line says "that is all for now" with a clock time, so leaving is fine. */
const REST_MINUTES = 15;

type Tap = 'ship' | 'neighbour' | 'rock' | 'up' | null;

/** What the step is, in the player's words, and where a tap takes them. */
function useLine(objective: Opportunity, now: number): { text: string; tap: Tap; rest: boolean } {
  const { t } = useTranslation();
  const at = (minutes: number) => clockTime(new Date(now + minutes * 60_000));
  switch (objective.kind) {
    case 'repair': return { text: t('starter.objective.repair', { name: moduleName(objective.step.module) }), tap: 'ship', rest: false };
    case 'collect': return { text: t('starter.objective.collect'), tap: 'up', rest: false };
    case 'save': {
      const name = moduleName(objective.step.module);
      if (objective.minutes === null) return { text: t('starter.objective.saveNever', { name }), tap: 'ship', rest: false };
      if (objective.minutes > REST_MINUTES) return { text: t('starter.objective.restSave', { name, clock: at(objective.minutes) }), tap: 'ship', rest: true };
      return { text: t('starter.objective.save', { name, time: duration(objective.minutes) }), tap: 'ship', rest: false };
    }
    case 'wait': {
      const minutes = Math.max(0, objective.readyAt.getTime() - now) / 60_000;
      return minutes > REST_MINUTES
        ? { text: t('starter.objective.restWait', { clock: clockTime(objective.readyAt) }), tap: 'ship', rest: true }
        : { text: t('starter.objective.wait', { time: duration(minutes) }), tap: 'ship', rest: false };
    }
    case 'probe': return { text: t('starter.objective.probe'), tap: 'neighbour', rest: false };
    case 'mine': return { text: t('starter.objective.mine'), tap: 'rock', rest: false };
    case 'underway': return { text: t(objective.what === 'probe' ? 'starter.objective.underwayProbe' : 'starter.objective.underwayMine'), tap: null, rest: false };
    case 'fact': return { text: t(`starter.factHow.${objective.fact}`), tap: null, rest: false };
    case 'parts': return { text: t('starter.objective.parts', { count: objective.count }), tap: null, rest: false };
    case 'fuel': return { text: t('starter.objective.fuel'), tap: 'ship', rest: false };
    case 'jump': return { text: t('starter.mainRow.ready'), tap: 'ship', rest: false };
  }
}

/**
 * THE NEXT STEP, ALWAYS IN SIGHT (owner 2026-11-06: "boş ekranda ne yapacağımı bilmiyorum"). One line
 * over the galaxy that names the single next thing and, in a word, what it opens; a tap takes the
 * player where it is done. A new step arrives with a sweep of light and a chime, so finishing one is
 * felt. A long wait says so plainly, with the time to come back (onboarding design §5.1).
 */
export function ObjectiveLine({ vessel, fetchedAt, onOpenShip, onFocusNeighbour, onFocusRock, probing = false, mining = false, alone = false }: {
  vessel: VesselView;
  fetchedAt: number;
  onOpenShip: () => void;
  /** Turns the camera to the nearest ship; without it the probe step is only a line. */
  onFocusNeighbour?: () => void;
  onFocusRock?: () => void;
  probing?: boolean;
  mining?: boolean;
  /** No other ship in this galaxy: there is nobody to probe yet. */
  alone?: boolean;
}) {
  const { t } = useTranslation();
  const now = useNow(15_000);
  const view = useMemo(() => vesselToPlanetView(vessel), [vessel]);
  const held = useProjected(view.planet, fetchedAt);
  const progress = progressOf(vessel);
  const [objective] = opportunities({
    progress,
    queue: vessel.queue,
    held: { alloy: held.alloy, crystal: held.crystal, deuterium: held.deuterium, bufferAlloy: held.bufferAlloy, bufferCrystal: held.bufferCrystal, bufferDeuterium: held.bufferDeuterium },
    income: { alloyPerHour: view.planet.alloyPerHour, crystalPerHour: view.planet.crystalPerHour },
    features: vessel.features,
    probing,
    mining,
    alone,
  });
  const original = useLine(objective, now);
  const goal = useStarterGoal();
  const repair = goalRepair(goal);
  const id = goal?.kind === 'step' ? goal.id : null;
  const waiting = goal?.kind === 'step' && goal.step === 'wait';
  const wait = id ? repairWait(id, vessel.queue) : null;
  const short = repair ? moduleName(repair.module)
    : id === 'probe' ? t('starter.visual.probe') : id === 'mine' ? t('starter.visual.mine')
    : id?.toLowerCase().includes('crate') ? t('starter.visual.crate')
    : id?.startsWith('collect') ? t('starter.visual.collect')
    : waiting ? (wait ? duration(Math.max(0, wait.until.getTime() - now) / 60_000) : t('starter.visual.waiting')) : null;
  const nextTap: Tap = repair || id?.toLowerCase().includes('crate') ? 'ship'
    : id === 'probe' ? 'neighbour' : id === 'mine' ? 'rock' : id?.startsWith('collect') ? 'up' : null;
  const line = short ? { text: short, tap: nextTap, rest: waiting } : original;
  const tap = line.tap === 'neighbour' && !onFocusNeighbour || line.tap === 'rock' && !onFocusRock ? null : line.tap;
  const step = repair ?? (objective.kind === 'repair' || objective.kind === 'save' ? objective.step : null);
  const opens = step ? stepEffects(step, progress).find(effect => effect.kind === 'feature') : undefined;
  const key = step ? `${objective.kind}:${step.module}:${String(step.stage)}` : objective.kind === 'underway' ? `underway:${objective.what}` : objective.kind;
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== null && last.current !== key) { playSound('confirm'); haptic('tap'); }
    last.current = key;
  }, [key]);
  // Under a sheet it waits, as the unlock note does: a tap there would land on the sheet's scrim.
  const covered = useSyncExternalStore(watchGalaxyCover, () => galaxyCover() !== null);
  if (covered) return null;
  const body = (
    <>
      <span aria-hidden="true" className="relative grid size-6 shrink-0 place-items-center">
        <span className={`absolute inset-0 rounded-full border ${line.rest ? 'border-v2-ink-3/50' : 'animate-[ember_1.8s_ease-in-out_infinite] border-v2-self/70'}`} />
        <span className={`size-1.5 rounded-full ${line.rest ? 'bg-v2-ink-3' : 'bg-v2-self shadow-[0_0_8px_var(--color-v2-self)]'}`} />
      </span>
      <span className="min-w-0 flex-1 text-left text-caption leading-snug text-v2-ink">
        {!line.rest && <span className="v2-legend mr-1.5 text-v2-self">{t('starter.next')}</span>}
        {line.text}
        {short && <span className="ml-2 inline-flex items-center gap-1 text-v2-self"><Icon id="i-chev" className="size-3"/><Icon id={repair ? repairGainIcon(repair) : id === 'probe' ? 'i-intel' : 'i-fleet'} className="size-4"/></span>}
        {!short && opens?.kind === 'feature' && <span className="ml-1.5 whitespace-nowrap font-semibold text-v2-self">· {t(`starter.feature.${opens.feature}.gain`)}</span>}
      </span>
      {tap === 'up' && <Icon id="i-chev" className="size-4 shrink-0 -rotate-90 animate-[nudge_1.6s_ease-in-out_infinite] text-v2-alloy" />}
      {(tap === 'ship' || tap === 'neighbour' || tap === 'rock') && <Icon id="i-chev" className="size-4 shrink-0 text-v2-self" />}
    </>
  );
  const frame = `relative flex w-full items-center gap-2.5 overflow-hidden rounded-control border bg-v2-deep/90 px-2.5 py-1.5 font-v2-ui shadow-lg animate-[line-in_0.45s_ease-out_both] ${line.rest ? 'border-v2-line-hi' : 'border-v2-self/40'}`;
  const sweep = <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/2 animate-[sweep_1.1s_ease-out_1_both] bg-gradient-to-r from-transparent via-v2-self/25 to-transparent" />;
  const marks = { 'data-testid': 'ship-objective', 'data-kind': objective.kind, 'data-guide': 'objective', ...(line.rest ? { 'data-rest': '' } : {}) };
  const press = tap === 'ship' ? onOpenShip : tap === 'neighbour' ? onFocusNeighbour : tap === 'rock' ? onFocusRock : undefined;
  return press
    ? <button key={key} type="button" {...marks} onClick={() => { haptic('tap'); press(); }} className={frame}>{sweep}{body}</button>
    : <div key={key} {...marks} className={frame}>{sweep}{body}</div>;
}
