import type { VesselProgress } from '@astera/rules';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { VesselView } from '../api/starterSchemas.js';
import { compact } from '../lib/format.js';
import { galaxyCover, watchGalaxyCover } from '../lib/galaxyCover.js';
import { haptic } from '../lib/haptics.js';
import { observe } from '../lib/playerAnalytics/runtime.js';
import { useProjected } from '../lib/projection.js';
import { playSound } from '../lib/sound.js';
import { clockTime, duration, durationPrecise, useNow } from '../lib/time.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Glyph, Plate, SectionTag, type GlyphId } from '../game-ui/index.js';
import { Icon, type IconId } from '../v2/icons.js';
import { vesselToPlanetView } from './adapter.js';
import type { HuntStage } from './hunt.js';
import { opportunities, opportunityKey, type Opportunity } from './opportunities.js';
import { moduleName } from './shipCopy.js';
import { useAdviceMemory } from './tutorial/adviceMemory.js';
import { goalRepair, useStarterGoal, useStarterLesson } from './tutorial/visualGoal.js';
import { repairWait } from './tutorial/script.js';
import { repairGainIcon, stepEffects } from './steps.js';
import { holdFull } from './hold.js';
import './objectiveLine.css';

const progressOf = (vessel: VesselView) => ({ modules: vessel.modules, facts: vessel.facts });

/** Longer than this and the line says "that is all for now" with a clock time, so leaving is fine. */
const REST_MINUTES = 15;

type Tap = 'ship' | 'neighbour' | 'rock' | 'up' | 'outpost' | 'reports' | null;

/** What the step is, in the player's words, and where a tap takes them. */
function useLine(objective: Opportunity, now: number): { text: string; tap: Tap; rest: boolean } {
  const { t } = useTranslation();
  const at = (minutes: number) => clockTime(new Date(now + minutes * 60_000));
  switch (objective.kind) {
    case 'repair': return { text: t('starter.objective.repair', { name: moduleName(objective.step.module) }), tap: 'ship', rest: false };
    case 'collect': return { text: t('starter.objective.collect'), tap: 'up', rest: false };
    case 'crate': return { text: t('starter.objective.crate'), tap: 'ship', rest: false };
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
    case 'jump': return { text: t('starter.mainRow.ready'), tap: 'ship', rest: false };
    case 'hunt': return huntLine(objective, t);
  }
}

/** The first hunt's story, one beat per step (plan §5.1): the outposts, the probes, the choice, the flight. */
function huntLine(objective: Extract<Opportunity, { kind: 'hunt' }>, t: TFunction): { text: string; tap: Tap; rest: boolean } {
  switch (objective.hunt.stage) {
    case 'probe': return { text: t(objective.mining ? 'starter.objective.huntProbeMining' : 'starter.objective.huntProbe'), tap: 'outpost', rest: false };
    case 'probing': return { text: t('starter.objective.huntProbing'), tap: null, rest: false };
    case 'decide': return { text: t('starter.objective.huntDecide'), tap: 'reports', rest: false };
    case 'retry': return { text: t('starter.objective.huntRetry', { name: objective.hunt.name }), tap: 'outpost', rest: false };
    case 'raid': return { text: t('starter.objective.huntRaid'), tap: null, rest: false };
  }
}

/** The advisor offers this many at most (plan F3, N1): enough for a choice, few enough to weigh. */
const MAX_OFFERS = 3;

/** The first offers, best first; a pick further down the list keeps its row. */
function offerRows(list: readonly Opportunity[], picked: Opportunity | undefined): Opportunity[] {
  const rows = list.slice(0, MAX_OFFERS);
  return picked && !rows.includes(picked) ? [...rows.slice(0, MAX_OFFERS - 1), picked] : rows;
}

function offerIcon(offer: Opportunity): IconId {
  switch (offer.kind) {
    case 'repair': return repairGainIcon(offer.step);
    case 'collect': return 'i-collect';
    case 'crate': return 'i-spark';
    case 'probe': return 'i-probe';
    case 'mine': return 'i-mine';
    case 'jump': return 'i-galaxy';
    case 'underway': return offer.what === 'probe' ? 'i-probe' : 'i-mine';
    case 'save': case 'wait': return 'i-hourglass';
    case 'fact': return 'i-info';
    case 'hunt': return offer.hunt.stage === 'probe' || offer.hunt.stage === 'probing' ? 'i-probe' : 'i-attack';
  }
}

function Amount({ resource, value, plus = false }: { resource: 'alloy' | 'crystal' | 'deuterium'; value: number; plus?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-0.5 font-v2-mono tabular-nums text-v2-ink">
      <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} className="size-3.5 shrink-0 object-contain" />
      {plus ? '+' : ''}{compact(value)}
    </span>
  );
}

interface Held { alloy: number; crystal: number; deuterium: number; bufferAlloy: number; bufferCrystal: number; bufferDeuterium: number }

/** The row's facts in icons and numbers: price and time, what a collect brings, what a repair opens. */
function OfferFacts({ offer, held, progress }: { offer: Opportunity; held: Held; progress: VesselProgress }) {
  const { t } = useTranslation();
  if (offer.kind === 'repair') {
    const opens = stepEffects(offer.step, progress).find(effect => effect.kind === 'feature');
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-micro">
        <Amount resource="alloy" value={offer.step.alloy} />
        {offer.step.crystal > 0 && <Amount resource="crystal" value={offer.step.crystal} />}
        <span className="flex items-center gap-0.5 font-v2-mono text-v2-ink-2"><Icon id="i-clock" className="size-3" />{durationPrecise(offer.step.minutes)}</span>
        {opens?.kind === 'feature' && <span className="font-semibold text-v2-self">{t(`starter.feature.${opens.feature}.gain`)}</span>}
      </span>
    );
  }
  if (offer.kind === 'collect') {
    return (
      <span className="flex flex-wrap items-center gap-x-2 text-micro">
        {held.bufferAlloy >= 1 && <Amount resource="alloy" value={Math.floor(held.bufferAlloy)} plus />}
        {held.bufferCrystal >= 1 && <Amount resource="crystal" value={Math.floor(held.bufferCrystal)} plus />}
        {held.bufferDeuterium >= 1 && <Amount resource="deuterium" value={Math.floor(held.bufferDeuterium)} plus />}
      </span>
    );
  }
  return null;
}

/** An offer named in a word or two; a state the advisor only names keeps its sentence. */
function useOfferName(offer: Opportunity, now: number): string {
  const { t } = useTranslation();
  const line = useLine(offer, now);
  switch (offer.kind) {
    case 'repair': return moduleName(offer.step.module);
    case 'collect': return t('starter.visual.collect');
    case 'crate': return t('starter.visual.crate');
    case 'probe': return t('starter.visual.probe');
    case 'mine': return t('starter.visual.mine');
    case 'jump': return t('starter.visual.galaxy');
    case 'hunt': return offer.hunt.stage === 'probe' ? t('starter.advice.huntProbe') : offer.hunt.stage === 'decide' ? t('starter.advice.huntDecide') : offer.hunt.stage === 'retry' ? t('starter.advice.huntRetry') : line.text;
    default: return line.text;
  }
}

function OfferRow({ offer, index, recommended, chosen, held, progress, now, onPick }: {
  offer: Opportunity; index: number; recommended: boolean; chosen: boolean; held: Held; progress: VesselProgress; now: number; onPick: () => void;
}) {
  const { t } = useTranslation();
  const name = useOfferName(offer, now);
  return (
    <li>
      <button
        type="button"
        data-advice={opportunityKey(offer)}
        aria-pressed={chosen}
        onClick={onPick}
        style={{ animationDelay: `${String(index * 60)}ms` }}
        // The lead offer is lit like the kit's own plates; the rest sit in the well.
        className={`flex min-h-11 w-full items-center gap-2.5 px-2 py-1.5 text-left animate-[line-in_0.3s_ease-out_both] active:scale-[0.98] ${recommended || chosen ? 'gk-cut gk-cut--self' : 'rounded-control border border-v2-line bg-v2-void/40'}`}
      >
        <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full border ${recommended || chosen ? 'border-v2-self/70 text-v2-self shadow-[0_0_10px_-2px_var(--color-v2-self)]' : 'border-v2-line-hi text-v2-ink-2'}`}>
          <Icon id={offerIcon(offer)} className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 text-caption font-medium leading-snug text-v2-ink">{name}</span>
            {recommended && <span className="v2-legend shrink-0 rounded-full bg-v2-self/20 px-1.5 py-px text-v2-self">{t('starter.advice.recommended')}</span>}
          </span>
          <OfferFacts offer={offer} held={held} progress={progress} />
        </span>
        {chosen ? <Icon id="i-check" className="size-4 shrink-0 text-v2-self" /> : <Icon id="i-chev" className="size-4 shrink-0 text-v2-ink-3" />}
      </button>
    </li>
  );
}

/**
 * THE NEXT STEP, ALWAYS IN SIGHT (owner 2026-11-06: "boş ekranda ne yapacağımı bilmiyorum"). One line
 * over the galaxy that names the single next thing and, in a word, what it opens; a tap takes the
 * player where it is done. A new step arrives with a sweep of light and a chime, so finishing one is
 * felt. A long wait says so plainly, with the time to come back (onboarding design §5.1).
 */
export function ObjectiveLine({ vessel, fetchedAt, onOpenShip, onFocusNeighbour, onFocusRock, onFocusOutpost, onOpenReports, probing = false, mining = false, alone = false, hunt = null }: {
  vessel: VesselView;
  fetchedAt: number;
  onOpenShip: () => void;
  /** Turns the camera to the nearest ship; without it the probe step is only a line. */
  onFocusNeighbour?: () => void;
  onFocusRock?: () => void;
  /** Turns the camera to an outpost of the first hunt, and opens the probe reports on it. */
  onFocusOutpost?: (id: string) => void;
  onOpenReports?: () => void;
  probing?: boolean;
  mining?: boolean;
  /** No other ship in this galaxy: there is nobody to probe yet. */
  alone?: boolean;
  /** Where the first hunt stands, while the map marks its outposts. */
  hunt?: HuntStage | null;
}) {
  const { t } = useTranslation();
  const now = useNow(15_000);
  const view = useMemo(() => vesselToPlanetView(vessel), [vessel]);
  const held = useProjected(view.planet, fetchedAt);
  const progress = progressOf(vessel);
  const purse: Held = { alloy: held.alloy, crystal: held.crystal, deuterium: held.deuterium, bufferAlloy: held.bufferAlloy, bufferCrystal: held.bufferCrystal, bufferDeuterium: held.bufferDeuterium };
  const list = opportunities({
    progress,
    queue: vessel.queue,
    held: purse,
    income: { alloyPerHour: view.planet.alloyPerHour, crystalPerHour: view.planet.crystalPerHour },
    features: vessel.features,
    crateReady: vessel.crates.some(crate => crate.state === 'ready'),
    probing,
    mining,
    alone,
    hunt,
    holdFull: holdFull({ ...purse, queue: vessel.queue, crates: vessel.crates }),
  });
  // THE ADVISOR (plan F3, N1). The line names what the player picked, else the first offer.
  const [memory, remember] = useAdviceMemory(vessel.id);
  const picked = memory.pick === null ? undefined : list.find(offer => opportunityKey(offer) === memory.pick);
  const objective = picked ?? list[0];
  const rows = offerRows(list, picked);
  const lesson = useStarterLesson();
  const holding = lesson?.kind === 'step' && lesson.strict;
  const choosing = rows.length > 1 && !holding;
  const [open, setOpen] = useState(false);
  // Under a sheet it waits, as the unlock note does: a tap there would land on the sheet's scrim.
  const covered = useSyncExternalStore(watchGalaxyCover, () => galaxyCover() !== null);
  // A pick no longer on offer is over, done or out of reach: the advisor may speak again.
  const over = memory.pick !== null && !picked;
  useEffect(() => { if (over) remember({ pick: null, shown: false }); }, [over, remember]);
  // It speaks up by itself only for the guide: when the core hands over, and after each pick ends.
  const offer = lesson?.kind === 'advise' && choosing && !memory.shown && !over && !covered;
  useEffect(() => {
    if (!offer) return;
    remember({ pick: null, shown: true });
    setOpen(true);
  }, [offer, remember]);
  const showing = open && choosing && !covered;
  useEffect(() => {
    if (!showing) return;
    observe('surface_visible', { surface: 'starter_advisor' });
    playSound('tap');
    haptic('tap');
  }, [showing]);
  const choose = (choice: Opportunity): void => {
    const key = opportunityKey(choice);
    remember({ pick: key, shown: true });
    setOpen(false);
    playSound('confirm');
    haptic('commit');
    observe('interaction', { surface: 'starter_advisor', subject: key, code: 'picked' });
  };
  const original = useLine(objective, now);
  // While the guide speaks, the line names its step in a word, so the two never disagree (owner item Z2).
  const goal = useStarterGoal();
  const guide = goal?.step ?? null;
  const repair = guide ? goalRepair(goal) : undefined;
  const id = guide?.id ?? null;
  const waiting = guide?.step === 'wait';
  const wait = id ? repairWait(id, vessel.queue) : null;
  const short = repair ? moduleName(repair.module)
    : id === 'mine' ? t('starter.visual.mine')
    : id === 'probe' ? t('starter.visual.probe')
    : id?.toLowerCase().includes('crate') ? t('starter.visual.crate')
    : id?.startsWith('collect') ? t('starter.visual.collect')
    : waiting ? (wait ? duration(Math.max(0, wait.until.getTime() - now) / 60_000) : t('starter.visual.waiting')) : null;
  const nextTap: Tap = repair || id?.toLowerCase().includes('crate') ? 'ship'
    : id === 'mine' ? 'rock' : id === 'probe' ? 'neighbour' : id?.startsWith('collect') ? 'up' : null;
  const line = short ? { text: short, tap: nextTap, rest: waiting }
    : id === 'zoomRock' ? { text: t('starter.objective.zoomRock'), tap: null, rest: false } : original;
  const outpost = objective.kind === 'hunt' && (objective.hunt.stage === 'probe' || objective.hunt.stage === 'retry') ? objective.hunt.target : null;
  const unheld = line.tap === 'neighbour' && !onFocusNeighbour || line.tap === 'rock' && !onFocusRock
    || line.tap === 'outpost' && !(onFocusOutpost && outpost) || line.tap === 'reports' && !onOpenReports;
  const tap = unheld ? null : line.tap;
  const step = repair ?? (objective.kind === 'repair' || objective.kind === 'save' ? objective.step : null);
  const opens = step ? stepEffects(step, progress).find(effect => effect.kind === 'feature') : undefined;
  const key = step ? `${objective.kind}:${step.module}:${String(step.stage)}` : objective.kind === 'underway' ? `underway:${objective.what}` : opportunityKey(objective);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== null && last.current !== key) { playSound('confirm'); haptic('tap'); }
    last.current = key;
  }, [key]);
  if (covered) return null;
  // The kit's strip (owner phone playtest 2026-11-18, item 22): a coin that says what kind of step it is,
  // the "Next" label over the step, and the kit's own open arrow where a press takes the player there.
  const glyph: GlyphId = line.rest ? 'timed' : tap === 'rock' ? 'mine' : tap === 'neighbour' ? 'eye' : tap === 'outpost' ? 'target'
    : tap === 'reports' ? 'mail' : tap === 'up' ? 'up' : tap === 'ship' ? 'repair' : 'next';
  const body = (
    <>
      <span aria-hidden="true" className="objective-line__coin">
        {repair ? <Icon id={repairGainIcon(repair)} className="size-4" /> : <Glyph id={glyph} />}
      </span>
      <span className="objective-line__text">
        {!line.rest && <span className="gk-label objective-line__eyebrow">{t('starter.next')} </span>}
        <span className="objective-line__title">
          {line.text}
          {!short && opens?.kind === 'feature' && <span className="objective-line__gain"> · {t(`starter.feature.${opens.feature}.gain`)}</span>}
        </span>
      </span>
      {tap === 'up' && <span aria-hidden="true" className="objective-line__open objective-line__open--up"><Glyph id="up" /></span>}
      {tap !== null && tap !== 'up' && <span aria-hidden="true" className="objective-line__open"><Glyph id="next" /></span>}
    </>
  );
  const frame = `objective-line gk-cut ${line.rest ? '' : 'gk-cut--self'}`;
  const inner = 'objective-line__press';
  const sweep = <span aria-hidden="true" className="objective-line__sweep" />;
  const marks = { 'data-testid': 'ship-objective', 'data-kind': objective.kind, 'data-guide': 'objective', ...(line.rest ? { 'data-rest': '' } : {}) };
  const press = tap === 'ship' ? onOpenShip : tap === 'neighbour' ? onFocusNeighbour : tap === 'rock' ? onFocusRock
    : tap === 'outpost' && onFocusOutpost && outpost ? () => { onFocusOutpost(outpost); } : tap === 'reports' ? onOpenReports : undefined;
  return (
    <>
      {showing && (
        <section data-testid="starter-advice" aria-label={t('starter.advice.title')} className="gk mb-2 animate-[line-in_0.25s_ease-out_both]">
          <Plate bolts className="flex flex-col gap-1 py-1 pl-2 pr-1 shadow-lg">
            <SectionTag aside={(
              <button type="button" aria-label={t('starter.advice.close')} onClick={() => { playSound('tap'); haptic('tap'); setOpen(false); }} className="-my-2 grid size-11 shrink-0 place-items-center text-v2-ink-2">
                <Glyph id="close" className="gk-glyph size-4" />
              </button>
            )}>{t('starter.advice.title')}</SectionTag>
            <ul className="flex flex-col gap-1 pb-1 pr-1">
              {rows.map((row, index) => (
                <OfferRow key={opportunityKey(row)} offer={row} index={index} recommended={index === 0} chosen={row === picked}
                  held={purse} progress={progress} now={now} onPick={() => { choose(row); }} />
              ))}
            </ul>
          </Plate>
        </section>
      )}
      <div key={key} className={frame} data-rest={line.rest ? '' : undefined}>
        {sweep}
        {press
          ? <button type="button" {...marks} onClick={() => { haptic('tap'); press(); }} className={inner}>{body}</button>
          : <div {...marks} className={inner}>{body}</div>}
        {choosing && (
          <button type="button" aria-label={t('starter.advice.open')} aria-expanded={showing}
            onClick={() => { haptic('tap'); setOpen(value => !value); }}
            className="objective-line__offers">
            <span aria-hidden="true" className={`objective-line__offers-turn ${showing ? 'objective-line__offers-turn--open' : ''}`}><Glyph id="up" /></span>
            <span className="gk-num">{rows.length}</span>
          </button>
        )}
      </div>
    </>
  );
}
