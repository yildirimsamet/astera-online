import {
  REPAIR_LADDER, STARTER, missingForStep, moduleStage, type RepairStep, type VesselModule, type VesselProgress,
} from '@astera/rules';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { compact, full } from '../lib/format.js';
import type { Projected } from '../lib/projection.js';
import { duration, durationPrecise } from '../lib/time.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Icon } from '../v2/icons.js';
import { moduleArt, rateChange, systemSteps } from './shipScreen.js';
import { effectLine, moduleName, requirementLine } from './shipCopy.js';
import { repairGainIcon, stepEffects, timeToAfford } from './steps.js';

/** A repair's length as the NPC says it: 90 seconds is "1 min 30 s", never a rounded "2 min" (owner playtest 2026-11-07). */
const repairTime = (minutes: number): string => (Number.isInteger(minutes) ? duration(minutes) : durationPrecise(minutes));

/** The ship opens with Refinery 1, which no order bought, so this is the top stage and not a count of rows. */
const stagesOf = (module: VesselModule): number => Math.max(...REPAIR_LADDER.filter(s => s.module === module).map(s => s.stage));

export interface RepairContext {
  /** The ship now, and as it will be once the queue has run: what a new order is judged against. */
  now: VesselProgress;
  ahead: VesselProgress;
  held: Projected;
  income: { alloyPerHour: number; crystalPerHour: number };
  queueFull: boolean;
  busy: boolean;
  order: (step: RepairStep) => void;
}

type StepState = 'done' | 'queued' | 'closed' | 'open';

const stateOf = (step: RepairStep, context: RepairContext): StepState => {
  if (moduleStage(context.now, step.module) >= step.stage) return 'done';
  if (moduleStage(context.ahead, step.module) >= step.stage) return 'queued';
  return missingForStep(context.ahead, step).length > 0 ? 'closed' : 'open';
};

/** Whether this repair can be ordered this moment: the card's button and an empty slot ask the same. */
export const canOrder = (step: RepairStep, context: RepairContext): boolean =>
  stateOf(step, context) === 'open' && !context.queueFull && !context.busy
  && context.held.alloy >= step.alloy && context.held.crystal >= step.crystal;

/** Why the button cannot be pressed yet, and when it can: the wait is the decision. */
function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-v2-line-hi bg-v2-void/50 px-1.5 py-0.5">{children}</span>;
}

function Price({ resource, amount, held }: { resource: 'alloy' | 'crystal'; amount: number; held: number }) {
  const { t } = useTranslation();
  return (
    <Pill>
      <span className={`flex items-center gap-1 font-v2-mono text-caption tabular-nums ${amount > held ? 'text-v2-warn' : 'text-v2-ink'}`}>
        <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} className="size-3.5 shrink-0 object-contain" />
        {compact(amount)}
      </span>
    </Pill>
  );
}

function PaymentLine({ step, context }: { step: RepairStep; context: RepairContext }) {
  const { t } = useTranslation();
  const { held, income, queueFull } = context;
  if (queueFull) return <p className="text-micro text-v2-warn">{t('starter.queueFull', { count: STARTER.queues.construction })}</p>;
  if (held.alloy >= step.alloy && held.crystal >= step.crystal) return null;
  const minutes = timeToAfford(step, held, income);
  const inWorks = held.alloy + held.bufferAlloy >= step.alloy && held.crystal + held.bufferCrystal >= step.crystal;
  return (
    <p data-testid="repair-wait" className="text-micro text-v2-warn">
      {inWorks ? t('starter.collectFirst') : minutes === null ? t('starter.noIncome') : t('starter.affordIn', { time: duration(minutes) })}
    </p>
  );
}

function Gain({ step, context }: { step: RepairStep; context: RepairContext }) {
  const { t } = useTranslation();
  const rate = rateChange(step);
  const others = stepEffects(step, context.ahead).filter(effect => effect.kind !== 'rate');
  return (
    <>
      {rate && (
        <p data-testid="repair-rate" className="flex items-center gap-1.5 font-v2-mono text-body leading-none">
          <img src={RESOURCE_ART[rate.resource]} alt={t(`vocabulary.resource.${rate.resource}`)} className="size-4 object-contain" />
          {rate.from > 0 && (
            <>
              <span className="text-v2-ink-2">+{full(rate.from)}<span className="text-micro">{t('starter.perHour')}</span></span>
              <Icon id="i-chev" className="size-3 text-v2-ink-2" />
            </>
          )}
          <span className="font-semibold text-v2-self">+{full(rate.to)}<span className="text-micro">{t('starter.perHour')}</span></span>
        </p>
      )}
      {others.length > 0 && <p data-testid="repair-effects" className="text-micro leading-snug text-v2-ink-2"><span className="inline-flex items-center gap-1"><Icon id="i-chev" className="size-3"/><Icon id={repairGainIcon(step)} className="size-4 text-v2-self"/>{others.map(effectLine).join(' · ')}</span></p>}
      {/* What the Aegis invites is a cost of the decision, so it stands before it (player test D-01). */}
      {others.some(effect => effect.kind === 'feature' && effect.feature === 'defence') && (
        <p data-testid="repair-risk" className="text-micro leading-snug text-v2-warn">{t('starter.feature.defence.risk')}</p>
      )}
    </>
  );
}

/** How long a card just put under the finger waits before its button takes a press (player test G-04). */
const SETTLE_MS = 600;

/** True while the step on show has only just replaced another: a second tap must not buy it. */
function useSettling(key: string): boolean {
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    if (settled === key) return undefined;
    const timer = setTimeout(() => { setSettled(key); }, SETTLE_MS);
    return () => { clearTimeout(timer); };
  }, [key, settled]);
  return settled !== key;
}

function Action({ step, state, context }: { step: RepairStep; state: StepState; context: RepairContext }) {
  const { t } = useTranslation();
  const settling = useSettling(`${step.module}-${String(step.stage)}`);
  if (state === 'done') return <p className="flex items-center gap-1 text-caption text-v2-self"><Icon id="i-check" className="size-3.5" />{t('starter.state.done')}</p>;
  if (state === 'queued') return <p className="flex items-center gap-1 text-caption text-v2-self"><Icon id="i-hourglass" className="size-3.5" />{t('starter.inQueue')}</p>;
  if (state === 'closed') {
    const missing = missingForStep(context.ahead, step);
    // An event is not bought: say how it comes (player test A-05).
    const how = missing.flatMap((need) => need.kind === 'FACT' ? [t(`starter.factHow.${need.fact}`)] : []);
    return (
      <>
        <p data-testid="repair-missing" className="text-caption leading-snug text-v2-warn">{t('starter.needs', { what: missing.map(requirementLine).join(', ') })}</p>
        {how.length > 0 && <p data-testid="repair-how" className="text-micro leading-snug text-v2-ink-2">{how.join(' ')}</p>}
      </>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        <Price resource="alloy" amount={step.alloy} held={context.held.alloy} />
        {step.crystal > 0 && <Price resource="crystal" amount={step.crystal} held={context.held.crystal} />}
        <Pill><span className="flex items-center gap-1 font-v2-mono text-caption text-v2-ink"><Icon id="i-clock" className="size-3 shrink-0" />{repairTime(step.minutes)}</span></Pill>
      </div>
      <button
        type="button"
        data-guide="repair-order"
        data-step={`${step.module}:${String(step.stage)}`}
        disabled={settling || !canOrder(step, context)}
        onClick={() => { context.order(step); }}
        className="min-h-8 w-full rounded-control border border-v2-self/80 bg-gradient-to-b from-v2-self/90 to-v2-self/50 text-caption font-bold uppercase tracking-wider text-v2-void shadow-[0_0_14px_-3px_var(--color-v2-self),inset_0_1px_0_rgba(255,255,255,.35)] disabled:border-v2-line disabled:bg-none disabled:bg-v2-raise disabled:text-v2-ink-3 disabled:shadow-none"
      >
        {t('starter.repair')}
      </button>
      <PaymentLine step={step} context={context} />
    </>
  );
}

/**
 * THE STRIP SAYS IT GOES ON (player test F-02): its label counts the repairs and moves it along, its
 * far edge fades rather than cuts, and every thumbnail carries its stage.
 */
function Strip({ steps, shown, context, onShow }: { steps: readonly RepairStep[]; shown: RepairStep; context: RepairContext; onShow: (step: RepairStep) => void }) {
  const { t } = useTranslation();
  const rail = useRef<HTMLDivElement>(null);
  return (
    <div className="flex items-center gap-1.5 border-t border-v2-line/70 py-1.5 pl-2.5">
      <button type="button" aria-label={`${t('starter.moreRepairs')} (${String(steps.length)})`}
        onClick={() => { const el = rail.current; if (el) el.scrollBy({ left: el.clientWidth * 0.8, behavior: 'smooth' }); }}
        className="flex min-h-8 shrink-0 items-center gap-0.5 text-micro text-v2-ink-2">
        {t('starter.nextRepairs')}<span className="font-v2-mono text-v2-ink-3">({steps.length})</span><Icon id="i-chev" className="size-2.5" />
      </button>
      <div ref={rail} data-testid="repair-strip" aria-label={t('starter.nextRepairs')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-1.5 [mask-image:linear-gradient(to_right,black_82%,transparent)] [scrollbar-width:none]">
        {steps.map(step => {
          const state = stateOf(step, context);
          const on = step === shown;
          return (
            <button
              key={`${step.module}-${String(step.stage)}`}
              type="button"
              aria-label={`${moduleName(step.module)}, ${t('starter.stepCount', { stage: step.stage, total: stagesOf(step.module) })}, ${t(`starter.stepState.${state}`)}`}
              aria-pressed={on}
              data-guide="repair-show"
              data-step={`${step.module}:${String(step.stage)}`}
              onClick={() => { onShow(step); }}
              className={`relative h-8 w-[54px] shrink-0 -skew-x-12 overflow-hidden rounded-cell border bg-v2-void ${on ? 'border-v2-self shadow-[0_0_6px_var(--color-v2-self)]' : 'border-v2-line'}`}
            >
              <img src={moduleArt(step.module, step.stage)} alt="" draggable={false} className={`absolute inset-[-4px] size-[calc(100%+8px)] max-w-none skew-x-12 object-cover ${state === 'closed' ? 'opacity-40 saturate-50' : state === 'done' ? 'opacity-55' : ''}`} />
              <span className="absolute right-1 top-0.5 skew-x-12">
                {state === 'done' && <Icon id="i-check" className="size-2.5 text-v2-self" />}
                {state === 'queued' && <Icon id="i-hourglass" className="size-2.5 text-v2-self" />}
                {state === 'closed' && <Icon id="i-lock" className="size-2.5 text-v2-ink" />}
              </span>
              <span aria-hidden="true" className="absolute bottom-0 left-1.5 skew-x-12 font-v2-mono text-micro font-semibold leading-none text-v2-ink [text-shadow:0_1px_2px_var(--color-v2-void)]">{step.stage}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ONE REPAIR, AS A MACHINE WORTH FIXING. The picture, the reward before the price, one press; the rest
 * of the system's repairs sit underneath as pictures to look through, so the list never returns.
 */
export function RepairCard({ shown, system, context, onShow }: {
  shown: RepairStep; system: RepairStep['system']; context: RepairContext; onShow: (step: RepairStep) => void;
}) {
  const { t } = useTranslation();
  const state = stateOf(shown, context);
  return (
    <section data-testid="next-repair" aria-label={moduleName(shown.module)} className="mx-3 overflow-hidden rounded-plate border border-v2-line-hi bg-v2-panel">
      <div className="grid grid-cols-[42%_1fr]">
        <div className="relative min-h-[164px] bg-v2-void">
          <img src={moduleArt(shown.module, shown.stage)} alt="" draggable={false} className={`absolute inset-0 size-full object-cover ${state === 'closed' ? 'opacity-50 saturate-50' : ''}`} />
          <span aria-hidden="true" className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-v2-panel to-transparent" />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1.5 py-2.5 pr-2.5">
          <h3 className="text-title font-semibold leading-tight text-v2-ink">{moduleName(shown.module)}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-v2-self/50 bg-v2-self/10 px-1.5 py-px font-v2-mono text-micro text-v2-self">{t('starter.stepCount', { stage: shown.stage, total: stagesOf(shown.module) })}</span>
            {!shown.required && <span className="text-micro text-v2-ink-3">{t('starter.optional')}</span>}
          </div>
          {state !== 'done' && <Gain step={shown} context={context} />}
          <Action step={shown} state={state} context={context} />
        </div>
      </div>
      <Strip steps={systemSteps(system)} shown={shown} context={context} onShow={onShow} />
    </section>
  );
}
