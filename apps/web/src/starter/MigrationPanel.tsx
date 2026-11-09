import { REPAIR_LADDER, STARTER, canLoadFuel, moduleStage, partsVisible, type VesselProgress } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { MigrationView, VesselView } from '../api/starterSchemas.js';
import { full } from '../lib/format.js';
import { duration, useNow } from '../lib/time.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { describe, useToast } from '../ui/Toast.js';
import { Icon } from '../v2/icons.js';
import { useGalaxy, useMining } from '../api/queries.js';
import { partsSeen } from './partMarks.js';
import { LeftBehind } from './LandingChoice.js';
import { useLoadFuel, useMigration } from './queries.js';
import { departurePlan, jumpOutlook, type DeparturePlan, type EngineState, type JumpOutlook } from './departurePlan.js';
import { moduleName, requirementLine } from './shipCopy.js';
import './jumpCall.css';

const LOAD_STEP = 30;

const minutesTo = (at: Date, now: number): number => Math.max(0, (at.getTime() - now) / 60_000);

const ENGINE_LOOK: Record<EngineState['state'], { icon: 'i-check' | 'i-clock' | 'i-spark' | 'i-lock'; tone: string }> = {
  done: { icon: 'i-check', tone: 'text-v2-self' },
  queued: { icon: 'i-clock', tone: 'text-v2-warn' },
  open: { icon: 'i-spark', tone: 'text-v2-ink' },
  waiting: { icon: 'i-lock', tone: 'text-v2-ink-3' },
};

/** One engine's line: a queued engine is queued, with its finish; never a tick before the repair is done. */
function EngineRow({ module, state, now }: { module: 'DRIVE_HULL' | 'DRIVE_THRUST'; state: EngineState; now: number }) {
  const { t } = useTranslation();
  const look = ENGINE_LOOK[state.state];
  const said = state.state === 'done' ? t('starter.plan.done')
    : state.state === 'queued' ? t('starter.plan.queued', { time: duration(minutesTo(state.readyAt, now)) })
      : state.state === 'open' ? t('starter.plan.open', { time: duration(state.minutes) })
        : t('starter.plan.waiting', { what: state.missing.map(requirementLine).join(', ') });
  return (
    <li data-testid={`plan-${module}`} data-state={state.state} className="flex items-center gap-2 text-caption">
      <Icon id={look.icon} className={`size-3.5 shrink-0 ${look.tone}`} />
      <span className="shrink-0 text-v2-ink-2">{moduleName(module)}</span>
      <span className={`min-w-0 flex-1 truncate text-right text-micro ${look.tone}`}>{said}</span>
    </li>
  );
}

/** The fuel's own line: what is aboard, when the rest is, and what the second plant would change. */
function FuelLines({ plan, now, plant }: { plan: DeparturePlan; now: number; plant: number }) {
  const { t } = useTranslation();
  const { fuel } = plan;
  const counts = { have: full(Math.min(fuel.have, fuel.needed)), needed: fuel.needed };
  const line = fuel.have >= fuel.needed ? t('starter.plan.fuelNow', counts)
    : fuel.readyAt ? t('starter.plan.fuelAt', { ...counts, time: duration(minutesTo(fuel.readyAt, now)) })
      : t('starter.plan.fuelNoPlant', { ...counts, name: moduleName('DEUTERIUM_PLANT') });
  return (
    <>
      <p data-testid="plan-fuel" className="text-micro leading-snug text-v2-ink-2">{line}</p>
      {fuel.lever && <p data-testid="plan-lever" className="text-micro leading-snug text-v2-deut">{t('starter.plan.lever', { name: moduleName('DEUTERIUM_PLANT'), time: duration(minutesTo(fuel.lever, now)) })}</p>}
      {fuel.have < fuel.needed && plant > 0 && <p data-testid="plan-flights" className="text-micro leading-snug text-v2-ink-3">{t('starter.plan.flights')}</p>}
    </>
  );
}

/** The season and the frontier, said while there is still time to plan around them. */
function Outlook({ outlook, now }: { outlook: JumpOutlook; now: number }) {
  const { t } = useTranslation();
  const said = outlook.kind === 'noFrontier' ? t('starter.outlook.noFrontier')
    : outlook.kind === 'seasonClosed' ? t('starter.outlook.seasonClosed', { days: outlook.daysLeft })
      : t('starter.outlook.seasonLate', { time: duration(minutesTo(outlook.closesAt, now)) });
  return (
    <p data-testid="jump-outlook" className="flex items-start gap-1.5 rounded-control border border-v2-warn/40 bg-v2-warn/10 px-2 py-1 text-micro leading-snug text-v2-warn">
      <Icon id="i-clock" className="mt-px size-3 shrink-0" />{said}
    </p>
  );
}

/**
 * THE LAST STRETCH: three parts, a full tank, and the press. The tank is filled by hand because every
 * unit in it is one that does not fly a fleet, and that is the decision of the last days aboard.
 */
export function MigrationPanel({ vessel, onJump }: { vessel: VesselView; onJump: (view: MigrationView) => void }) {
  const { t } = useTranslation();
  const say = useToast();
  const load = useLoadFuel();
  const { data: view } = useMigration();
  const seen = partsSeen(useGalaxy().data?.planets, useMining().fieldData?.debris);
  const progress: VesselProgress = { modules: vessel.modules, facts: vessel.facts, parts: vessel.parts, fuel: vessel.fuel };
  const needed = STARTER.fuelForJump;
  const room = Math.max(0, needed - vessel.fuel);
  const all = Math.floor(Math.min(vessel.deuterium, room));
  const now = useNow(30_000);
  const plan = departurePlan(vessel, now);
  const readyAt = plan.enginesAt && plan.fuel.readyAt ? new Date(Math.max(plan.enginesAt.getTime(), plan.fuel.readyAt.getTime())) : null;
  const tankBlock = view?.block && room <= 0 ? view.block : null;
  const outlook = view && !tankBlock ? jumpOutlook(view.target, readyAt, now) : null;
  const optional = REPAIR_LADDER.filter(step => !step.required && moduleStage(progress, step.module) < step.stage).length;
  const send = (amount: number): void => {
    load.mutate(amount, { onError: (error) => { say(describe(error), 'error'); } });
  };
  return (
    <section data-testid="migration-panel" aria-label={t('starter.jump.panel')}
      className="mx-3 flex flex-col gap-2 rounded-plate border border-v2-line-hi bg-gradient-to-b from-v2-panel to-v2-void/80 p-2.5">
      <h3 className="v2-legend text-v2-ink-2">{t('starter.plan.title')}</h3>
      <ul className="-mt-1 flex flex-col gap-1">
        <EngineRow module="DRIVE_HULL" state={plan.hull} now={now} />
        <EngineRow module="DRIVE_THRUST" state={plan.thrust} now={now} />
      </ul>
      <div className="flex items-center gap-2 text-caption">
        <span className="min-w-0 flex-1 text-v2-ink-2">{t('starter.jump.parts')}</span>
        <span data-testid="parts-count" className="font-v2-mono text-v2-ink">{vessel.parts}/{STARTER.parts.needed}</span>
        <span aria-hidden="true" className="flex gap-1">
          {Array.from({ length: STARTER.parts.needed }, (_, index) => (
            <span key={index} className={`size-2 rotate-45 border ${index < vessel.parts ? 'border-v2-self bg-v2-self shadow-[0_0_6px_var(--color-v2-self)]' : 'border-v2-line-hi'}`} />
          ))}
        </span>
      </div>
      {vessel.parts < STARTER.parts.needed && (
        <p data-testid="parts-seen" className="-mt-1 text-micro leading-snug text-v2-ink-3">
          {t('starter.jump.partsHint')}{' '}
          {/* No hunt is offered before the parts are on the map (player test D-03). */}
          {!partsVisible(progress) ? t('starter.jump.partsLater')
            : seen > 0 ? <span className="font-semibold text-v2-deut">{t('starter.jump.partsSeen', { count: seen })}</span> : t('starter.jump.partsNone')}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-caption">
          <img src={RESOURCE_ART.deuterium} alt="" className="size-3.5 object-contain" />
          <span className="min-w-0 flex-1 text-v2-ink-2">{t('starter.jump.tank')}</span>
          <span data-testid="tank-level" className="font-v2-mono tabular-nums text-v2-ink">{Math.floor(vessel.fuel)}/{needed}</span>
        </div>
        <span className="block h-2 overflow-hidden rounded-full border border-v2-line-hi bg-v2-void">
          <span className="block h-full rounded-full bg-gradient-to-r from-v2-deut/70 to-v2-deut shadow-[0_0_8px_var(--color-v2-deut)] transition-[width] duration-500"
            style={{ width: `${String(Math.min(100, (vessel.fuel / needed) * 100))}%` }} />
        </span>
        <FuelLines plan={plan} now={now} plant={moduleStage(progress, 'DEUTERIUM_PLANT')} />
      </div>
      {plan.waitsOn && <p data-testid="plan-waits" className="text-micro font-semibold leading-snug text-v2-ink">{t(plan.waitsOn === 'fuel' ? 'starter.plan.waitsFuel' : 'starter.plan.waitsEngines')}</p>}
      {outlook && <Outlook outlook={outlook} now={now} />}

      {!canLoadFuel(progress)
        ? <p data-testid="tank-locked" className="flex items-center gap-1 text-micro leading-snug text-v2-ink-3"><Icon id="i-lock" className="size-3 shrink-0" />{t('starter.jump.tankLocked')}</p>
        : room > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-micro leading-snug text-v2-ink-3">{t('starter.jump.tankHint', { needed })}</p>
            <div className="flex gap-1.5">
              {all > LOAD_STEP && (
                <button type="button" disabled={load.isPending} onClick={() => { send(LOAD_STEP); }}
                  className="min-h-9 flex-1 rounded-control border border-v2-line-hi bg-v2-void/60 text-caption text-v2-ink disabled:opacity-50">
                  {t('starter.jump.load', { amount: LOAD_STEP })}
                </button>
              )}
              <button type="button" data-guide="fuel" disabled={load.isPending || all <= 0} onClick={() => { send(all); }}
                className="min-h-9 flex-1 rounded-control border border-v2-deut/70 bg-v2-deut/15 text-caption font-medium text-v2-ink disabled:opacity-50">
                {t('starter.jump.loadAll')}
              </button>
            </div>
          </div>
        )}

      {/* The loss is said while it can still be spent or flown home (player test, 2026-11-05). */}
      {view && <LeftBehind left={view.left} />}
      <p data-testid="jump-carry" className="text-micro leading-snug text-v2-ink-3">
        {t('starter.jump.carryMost', { alloy: full(STARTER.carry.alloy), crystal: full(STARTER.carry.crystal), deuterium: full(STARTER.carry.deuterium), ships: STARTER.carry.ships })}
      </p>
      {optional > 0 && <p data-testid="plan-optional" className="text-micro leading-snug text-v2-ink-3">{t('starter.plan.optional', { count: optional })}</p>}
      {tankBlock && <p data-testid="jump-block" className="text-micro leading-snug text-v2-warn">{tankBlock.code === 'MIGRATION_SEASON_WAIT' ? t('errors.MIGRATION_SEASON_WAIT', { daysLeft: tankBlock.daysLeft }) : t(`errors.${tankBlock.code}`)}</p>}
      {view && !view.block && (
        <button type="button" onClick={() => { onJump(view); }}
          className="jump-call relative min-h-11 overflow-hidden rounded-control border border-v2-self bg-gradient-to-b from-v2-self to-v2-self/55 text-body font-bold uppercase tracking-wide text-v2-void shadow-[0_0_18px_-2px_var(--color-v2-self)]">
          {t('starter.jump.go')}
        </button>
      )}
    </section>
  );
}
