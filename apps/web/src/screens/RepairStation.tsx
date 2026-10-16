import { ATMOSPHERE } from '../ui/atmosphere.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';
import { HULLS, SHIP_DAMAGE, honorRepairResources } from '@astera/rules';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCancelRepair, useMaintenance, useStartRepair } from '../api/queries.js';
import type { BuildOrderView, PlanetView } from '../api/schemas.js';
import { buildingName, hullLabel, researchName } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { buildOrderLabel } from '../lib/orders.js';
import {
  damagePct,
  jobLots,
  stationSummary,
  type DockLot,
  type RepairDock,
} from '../lib/repairStation.js';
import { countdown, durationPrecise, useNow } from '../lib/time.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { CancelConfirm } from '../ui/QueueStrip.js';
import { describe, useToast } from '../ui/Toast.js';
import { Icon } from '../v2/icons.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { Cost } from '../v2/kit/Cost.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Segmented } from '../v2/kit/Segmented.js';
import { Confirm } from '../ui/kit/Confirm.js';
import { ShipHealthInventory } from '../ui/ShipHealthInventory.js';
import { HonorEffectQuote } from '../ui/HonorBenefits.js';
import { createIdempotencyKey, type MaintenanceAction, type MaintenanceSelection, type RepairRequest } from '../api/client.js';
import { dockMaintenanceRows, homeMaintenanceRows, maintenanceChoice } from '../lib/maintenanceInventory.js';

/**
 * THE REPAIR STATION, IN THE BASE. Kalıcı gemi hasarı; owner instruction, 2026-09-30:
 * *"Tershane ve Hangar'ın altına 2 kolonu kaplayacak şekilde yatay bir tasarım … bu
 * Tamirhane'ye tıklayınca içine giricez ve tamirhane menüsü açılacak."*
 *
 * The station has no ladder, so its card is not a level-up: it is a door. The card
 * answers the glance — what waits, what is being worked on, how full the lane is — and
 * the menu behind it holds the decision: which damaged ships to put back in the fight,
 * what that costs against new ones, and the queue it joins.
 *
 * Every figure comes off the planet view the server priced (`dock`, `queues.REPAIR`);
 * nothing here computes a price of its own (`lib/repairStation.ts`).
 */

interface Held { alloy: number; crystal: number; deuterium: number }

/** A thin bar a running job fills as it goes. */
function JobBar({ order, now }: { order: BuildOrderView; now: number }) {
  if (!order.finishesAt) return null;
  const start = order.startedAt.getTime();
  const span = order.finishesAt.getTime() - start;
  const done = span > 0 ? Math.min(1, Math.max(0, (now - start) / span)) : 1;
  return (
    <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-v2-line">
      <span className="block h-full rounded-full bg-v2-self" style={{ width: `${String(done * 100)}%` }} />
    </span>
  );
}

/** The running job's bar and clock. Its own component, so only it ticks, and only while a job runs. */
function RunningClock({ order }: { order: BuildOrderView }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  if (!order.finishesAt) return null;
  const left = order.finishesAt.getTime() - now;
  return (
    <span className="flex items-center gap-2">
      <span className="min-w-0 flex-1"><JobBar order={order} now={now} /></span>
      <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">
        {left > 0 ? countdown(left) : t('repairStation.finishing')}
      </span>
    </span>
  );
}

/**
 * WHEN A JOB ORDERED NOW WOULD START. The lane is serial, so behind other jobs the ships come
 * back after the wait plus the work, not after the work alone. Ticks on its own clock.
 */
function QueueWait({ last }: { last: BuildOrderView }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  // Past its end the lane frees the moment the worker settles it: there is no wait to state.
  if (!last.finishesAt || last.finishesAt.getTime() <= now) return null;
  return (
    <span data-testid="repair-wait" className="flex items-center gap-1 text-micro text-v2-ink-3">
      <Icon id="i-hourglass" className="size-3 shrink-0" />
      {t('repairStation.afterQueue', { time: countdown(last.finishesAt.getTime() - now) })}
    </span>
  );
}

/* ── the card ───────────────────────────────────────────────────── */

/**
 * THE CARD UNDER THE SHIPYARD AND THE HANGAR, ACROSS BOTH COLUMNS.
 *
 * Its three facts are the three a commander weighs before a raid: how many ships are out
 * of the fight (warn — they can neither fly nor defend), how many are coming back (your
 * colour, with the running job's clock), and whether the lane has room for another job.
 */
export function RepairStationCard({
  dock,
  repairs,
  highlighted,
  onOpen,
}: {
  dock: RepairDock | null | undefined;
  repairs: readonly BuildOrderView[];
  highlighted: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const summary = stationSummary(dock, repairs);
  const head = repairs[0];
  const idle = summary.waitingShips === 0 && summary.jobs === 0;
  return (
    <div
      id="row-REPAIR_STATION"
      data-highlighted={highlighted ? '' : undefined}
      className={`scene-panel repair-scene col-span-2 overflow-hidden rounded-control border bg-v2-panel font-v2-ui ${
        highlighted ? 'border-v2-self/60 ring-1 ring-v2-self/40' : 'border-v2-line'
      }`}
    >
      <AtmosphereImage art={ATMOSPHERE.repair} />
      <button
        type="button"
        onClick={() => {
          haptic('tap');
          onOpen();
        }}
        className="group flex min-h-[240px] w-full items-stretch gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-self/70"
      >
        <span data-repair-copy className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
          <span className="flex items-baseline gap-2">
            <span className="v2-name min-w-0 flex-1 text-caption leading-tight">{t('repairStation.title')}</span>
            <span className={`shrink-0 font-v2-mono text-micro ${summary.full ? 'text-v2-warn' : 'text-v2-ink-3'}`}>
              {t('repairStation.queueFill', { used: summary.jobs, total: summary.depth })}
            </span>
          </span>
          <span className="text-micro leading-snug text-v2-ink-3">{t('repairStation.role')}</span>
          <span className="mt-auto flex flex-col gap-1.5 pt-0.5">
            {idle ? (
              <span className="flex items-center gap-1.5 text-micro text-v2-ink-2">
                <Icon id="i-check" className="size-3.5 shrink-0 text-v2-self" />
                {t('repairStation.idle')}
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                {summary.waitingShips > 0 && (
                  <span className="flex items-center gap-1 rounded-chip border border-v2-warn/45 bg-v2-warn/10 px-1.5 py-0.5 text-micro font-semibold text-v2-warn">
                    <Icon id="i-warn" className="size-3 shrink-0" />
                    {t('repairStation.waitingShips', { count: summary.waitingShips })}
                  </span>
                )}
                {summary.repairingShips > 0 && (
                  <span className="flex items-center gap-1 rounded-chip border border-v2-self/40 bg-v2-self/10 px-1.5 py-0.5 text-micro font-semibold text-v2-self">
                    <Icon id="i-spark" className="size-3 shrink-0" />
                    {t('repairStation.repairingShips', { count: summary.repairingShips })}
                  </span>
                )}
              </span>
            )}
            {head && <RunningClock order={head} />}
          </span>
        </span>
        <Icon id="i-chev" className="size-4 shrink-0 self-center text-v2-ink-3" />
      </button>
    </div>
  );
}

/* ── the menu ───────────────────────────────────────────────────── */

const HEADING = 'flex items-center gap-2 text-micro font-semibold uppercase tracking-wide text-v2-ink-3';

/** One figure of the hero: what it counts, and the count, coloured by what it means. */
function Stat({ label, value, tone }: { label: string; value: string; tone: 'warn' | 'self' | 'ink' }) {
  const colour = tone === 'warn' ? 'text-v2-warn' : tone === 'self' ? 'text-v2-self' : 'text-v2-ink';
  return (
    <span className="flex flex-col items-center gap-0.5 rounded-control border border-v2-line bg-v2-panel/80 px-1 py-1.5">
      <span className={`font-v2-mono text-body font-semibold tabular-nums ${colour}`}>{value}</span>
      <span className="text-center text-micro leading-tight text-v2-ink-3">{label}</span>
    </span>
  );
}

/** One job: what it holds, how far along it is or when it starts, and its cancel. */
function JobRow({ order, lots, busy, onCancel }: {
  order: BuildOrderView;
  lots: readonly DockLot[];
  /** A start or cancel is on its way; the cancel holds until it lands. */
  busy: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  // Its own clock, so the menu around it is not redrawn every second.
  const now = useNow(1000);
  const label = buildOrderLabel(order);
  const started = !order.startedAt || order.startedAt.getTime() <= now;
  // A job of one lot names it in its title; the chips are for a job of several.
  const only = lots.length === 1 ? lots[0] : undefined;
  return (
    <li
      data-testid="repair-job"
      className={`flex flex-col gap-1.5 rounded-control border px-2.5 py-2 ${started ? 'border-v2-self/35 bg-v2-self/[0.05]' : 'border-v2-line bg-v2-panel'}`}
    >
      <span className="flex items-center gap-2">
        <Icon id={started ? 'i-spark' : 'i-hourglass'} className={`size-3.5 shrink-0 ${started ? 'text-v2-self' : 'text-v2-ink-3'}`} />
        <span className="min-w-0 flex-1 truncate text-caption font-semibold text-v2-ink">
          {label} <span className="font-v2-mono font-normal text-v2-ink-2">{`×${String(order.count)}`}</span>
          {only && (
            <span className="ml-1.5 font-v2-mono text-micro font-normal text-v2-warn">
              {t('repairStation.damaged', { pct: damagePct(only.damageBp + (only.remainderBp ?? 0)) })}
            </span>
          )}
        </span>
        {order.finishesAt && (
          <button
            type="button"
            disabled={busy}
            aria-label={t('planet.queue.cancelOne', { name: label })}
            onClick={onCancel}
            className="shrink-0 rounded-control border border-v2-line-hi px-2.5 py-1 text-micro text-v2-ink-2 hover:text-v2-ink disabled:opacity-40"
          >
            {t('repairStation.cancel')}
          </button>
        )}
      </span>
      {lots.length > 1 && (
        <span className="flex flex-wrap gap-1">
          {lots.map((lot) => (
            <span key={lot.id} className="flex items-center gap-1 rounded-chip border border-v2-line bg-v2-raise px-1.5 py-0.5 text-micro text-v2-ink-2">
              <ClassEmblem cls={HULLS[lot.hull].cls} className="size-2.5" decorative />
              {hullLabel(lot.hull)}
              <span className="font-v2-mono text-v2-ink">{`×${String(lot.count)}`}</span>
              <span className="text-v2-warn">{t('repairStation.damaged', { pct: damagePct(lot.damageBp + (lot.remainderBp ?? 0)) })}</span>
            </span>
          ))}
        </span>
      )}
      {order.finishesAt && (started ? (
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1"><JobBar order={order} now={now} /></span>
          <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">
            {order.finishesAt.getTime() > now
              ? t('repairStation.ends', { time: countdown(order.finishesAt.getTime() - now) })
              : t('repairStation.finishing')}
          </span>
        </span>
      ) : (
        <span className="font-v2-mono text-micro text-v2-ink-3">
          {t('repairStation.startsIn', { time: countdown(order.startedAt.getTime() - now) })}
        </span>
      ))}
    </li>
  );
}

/**
 * THE STATION ITSELF, for the world this Base is reading.
 *
 * Top to bottom it answers the four questions in the order a commander asks them: what
 * is this and what is in it (the bay and its three counts); why are my ships here and
 * what does a repair cost (the rule in one line, the arithmetic one tap deeper); what is
 * already being done (the queue, with its clocks and cancels); and what shall I do now
 * (the damaged ships, every one chosen until left out, with the choice's price and the
 * commit held in the footer where the thumb is).
 */
interface RepairStationSheetProps {
  planet: PlanetView;
  held: Held;
  onClose: () => void;
}

export function RepairStationSheet(props: RepairStationSheetProps) {
  return <RepairStationContent key={props.planet.planet.id} {...props} />;
}

function RepairStationContent({ planet, held, onClose }: RepairStationSheetProps) {
  const { t } = useTranslation();
  const say = useToast();
  const start = useStartRepair();
  const cancel = useCancelRepair();
  const maintenance = useMaintenance();
  const [place, setPlace] = useState<'HOME' | 'DOCK'>(() =>
    (planet.fleetDamage?.length ?? 0) === 0 && (planet.dock?.lots.length ?? 0) > 0 ? 'DOCK' : 'HOME');
  const [mode, setMode] = useState<'REPAIR' | 'SCRAP'>('REPAIR');
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({});
  const [asking, setAsking] = useState<BuildOrderView | null>(null);
  const [explained, setExplained] = useState(false);
  const [scrap, setScrap] = useState<{ selection: MaintenanceSelection; count: number;
    returned: Held; key: string } | null>(null);
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  const intentKey = (action: MaintenanceAction | 'REPAIR', selection: MaintenanceSelection | RepairRequest): string => {
    const fingerprint = JSON.stringify({ planetId: planet.planet.id, action, selection });
    if (intent.current?.fingerprint !== fingerprint) intent.current = { fingerprint, key: createIdempotencyKey() };
    return intent.current.key;
  };
  const repairs = planet.queues?.REPAIR ?? [];
  const dock = planet.dock;
  const summary = stationSummary(dock, repairs);
  const lots = dock?.lots ?? [];
  const home = homeMaintenanceRows(planet.fleet, planet.fleetDamage);
  const allRows = place === 'HOME' ? home : dockMaintenanceRows(lots, planet.workshopRadiation ? 'LOT' : 'HEALTH');
  const rows = mode === 'SCRAP' ? allRows : allRows.filter((row) => row.damageBp > 0 || (row.remainderBp ?? 0) > 0);
  const choice = maintenanceChoice(rows, quantities, dock?.pct ?? 100);
  const adjustedRepairCost = planet.honorBenefits ? honorRepairResources(choice.repairCost, planet.honorBenefits) : choice.repairCost;
  const busy = start.isPending || cancel.isPending || maintenance.isPending;
  const canPay = adjustedRepairCost.alloy <= held.alloy && adjustedRepairCost.crystal <= held.crystal
    && adjustedRepairCost.deuterium <= held.deuterium;
  const switchPlace = (next: 'HOME' | 'DOCK'): void => { setPlace(next); setQuantities({}); };
  const switchMode = (next: 'REPAIR' | 'SCRAP'): void => { setMode(next); setQuantities({}); };
  const move = (action: MaintenanceAction, selection: MaintenanceSelection, key?: string): void => {
    // Evacuation uses current server health; changing radiation damage must not turn
    // a retry of the same lot/count into another withdrawal.
    const request = action === 'RETURN' && selection.source === 'DOCK'
      ? { source: 'DOCK' as const, lots: selection.lots.map(({ id, count }) => ({ id, count })) } : selection;
    maintenance.mutate({ planetId: planet.planet.id, action, selection: request, key: key ?? intentKey(action, request) }, {
      onSuccess: () => {
        intent.current = null;
        setQuantities({}); setScrap(null);
        if (action === 'DOCK') setPlace('DOCK');
        say(t(`repairStation.maintenance.${action === 'DOCK' ? 'moved' : action === 'RETURN' ? 'returned' : 'scrapped'}`));
      },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };
  const commit = (): void => {
    const selection = choice.selection;
    if (!selection) return;
    if (mode === 'SCRAP') setScrap({ selection, count: choice.ships, returned: choice.scrap, key: intentKey('SCRAP', selection) });
    else if (place === 'HOME') move('DOCK', selection);
    else if (choice.repair) {
      const request = { ...choice.repair, ...(planet.honorBenefits ? { expectedHonorTier: planet.honorBenefits.tier } : {}) };
      start.mutate({ planetId: planet.planet.id, request,
      key: intentKey('REPAIR', request) }, {
      onSuccess: () => { intent.current = null; setQuantities({}); say(t('repairStation.started')); },
      onError: (error) => { say(describe(error), 'error'); },
    });
    }
  };
  const label = mode === 'SCRAP' ? t('repairStation.maintenance.scrapAction') : place === 'HOME'
    ? t('repairStation.maintenance.move') : t('repairStation.repairSelected', { count: choice.ships });
  const ready = choice.selection !== null && !busy && !planet.workshopRadiation
    && (mode === 'SCRAP' || place === 'HOME' || (!summary.full && canPay));
  return <Sheet detents={['fit']} eyebrow={planet.planet.name} title={t('repairStation.title')} onClose={onClose}
    footer={<div className="flex flex-col gap-2">
      {choice.stale && <p role="status" className="text-micro text-v2-warn">{t('repairStation.maintenance.stale')}</p>}
      {choice.tooMany && <p role="status" className="text-micro text-v2-warn">{t('repairStation.tooMany', { max: SHIP_DAMAGE.repairLotsPerOrder })}</p>}
      <div className="flex items-center justify-between gap-2" data-testid="repair-total">
        <span className="text-micro text-v2-ink-3">{t('repairStation.maintenance.selected', { count: choice.ships })}</span>
        {mode === 'SCRAP' ? <Cost cost={choice.scrap} /> : place === 'DOCK' && <span className="flex items-center gap-2">
          <Cost cost={adjustedRepairCost} held={held} /><span className="font-v2-mono text-micro text-v2-ink-2">{durationPrecise(choice.minutes)}</span>
        </span>}
      </div>
      {mode === 'REPAIR' && place === 'DOCK' && choice.ships > 0 ? <HonorEffectQuote kind="repair" value={planet.honorBenefits}
        base={choice.repairCost} net={adjustedRepairCost} /> : null}
      {mode === 'REPAIR' && place === 'DOCK' && repairs.at(-1) && <QueueWait last={repairs.at(-1)!} />}
      <div className="flex gap-2">
        {place === 'DOCK' && <button type="button" disabled={!choice.selection || busy}
          onClick={() => { if (choice.selection) move('RETURN', choice.selection); }}
          className="min-h-10 flex-1 rounded-control border border-v2-line-hi px-2 text-caption font-semibold text-v2-ink-2 disabled:opacity-40">
          {t('repairStation.maintenance.return')}
        </button>}
        <button type="button" disabled={!ready} onClick={commit}
          className={`min-h-10 flex-1 rounded-control px-3 text-caption font-semibold disabled:bg-v2-raise disabled:text-v2-ink-3 ${mode === 'SCRAP' ? 'bg-v2-warn text-v2-deep' : 'bg-v2-self text-v2-self-ink'}`}>
          {start.isPending ? t('repairStation.starting')
            : mode === 'REPAIR' && place === 'DOCK' && summary.full ? t('repairStation.queueFullShort', { used: summary.jobs, total: summary.depth })
              : mode === 'REPAIR' && place === 'DOCK' && !canPay ? t('itemSheet.short')
                : mode === 'REPAIR' && place === 'DOCK' && choice.ships === 0 ? t('repairStation.pick') : label}
        </button>
      </div>
    </div>}>
    <div className="flex flex-col gap-3 pt-1">
      {planet.workshopRadiation && <p role="status" className="rounded-control border border-v2-warn/35 bg-v2-warn/10 p-2 text-caption leading-snug text-v2-warn">
        {t('repairStation.maintenance.radiation')}
      </p>}
      <section data-repair-hero className="scene-panel repair-hero flex min-h-[250px] flex-col justify-end gap-2 rounded-control border border-v2-line bg-v2-deep px-3 pb-3 pt-2.5">
        <AtmosphereImage art={ATMOSPHERE.repair} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-caption leading-snug text-v2-ink-2">{t('repairStation.maintenance.rule')}</p>
          <span className="text-micro text-v2-self">{planet.honorBenefits
            ? t('honorBenefits.researchShare', { pct: dock?.pct ?? 100 }) : t('repairStation.youPay', { pct: dock?.pct ?? 100 })}</span>
        </div>
      </section>
      <button type="button" aria-expanded={explained} onClick={() => { setExplained(current => !current); }}
        className="min-h-9 self-end px-1 text-micro font-semibold text-v2-self">{t('repairStation.howItWorks')} ›</button>
      {explained && <ul data-repair-rules className="flex flex-col gap-1 rounded-control border border-v2-line bg-v2-deep/60 px-2 py-2 text-micro leading-snug text-v2-ink-2">
        {[t('repairStation.ruleFree'), t('repairStation.rulePrice'),
          t('repairStation.ruleTime', { shipyard: buildingName('SHIPYARD'), automation: researchName('YARD_AUTOMATION') }),
          t('repairStation.ruleIndustrial', { industrial: researchName('INDUSTRIAL') }),
          t('repairStation.ruleQueue', { depth: summary.depth }), t('repairStation.ruleCancel')]
          .map(line => <li key={line}>{line}</li>)}
      </ul>}
      <div className="grid grid-cols-3 gap-1.5">
        <Stat label={t('repairStation.damagedHeading')} value={full(home.filter((row) => row.damageBp > 0 || (row.remainderBp ?? 0) > 0).reduce((sum, row) => sum + row.count, 0))} tone="warn" />
        <Stat label={t('repairStation.statWaiting')} value={full(summary.waitingShips)} tone="ink" />
        <Stat label={t('repairStation.statRepairing')} value={full(summary.repairingShips)} tone="self" />
      </div>
      <Segmented label={t('repairStation.title')} options={[
        { id: 'REPAIR', label: t('repairStation.maintenance.repair') },
        { id: 'SCRAP', label: t('repairStation.maintenance.scrap') },
      ]} value={mode} onChange={switchMode} />
      <Segmented label={t('repairStation.maintenance.hangar')} options={[
        { id: 'HOME', label: t('repairStation.maintenance.hangar') },
        { id: 'DOCK', label: t('repairStation.maintenance.workshop') },
      ]} value={place} onChange={switchPlace} />
      <p className="text-micro leading-snug text-v2-ink-3">{mode === 'SCRAP' ? t('repairStation.maintenance.scrapRule')
        : place === 'HOME' ? t('repairStation.maintenance.homeHint') : t('repairStation.maintenance.dockRule')}</p>
      {Object.values(quantities).some((count) => count > 0) && <button type="button" onClick={() => { setQuantities({}); }}
        className="self-end text-micro font-semibold text-v2-self">{t('repairStation.maintenance.clear')}</button>}
      {rows.length === 0 ? <p className="py-2 text-caption text-v2-ink-3">{t('repairStation.maintenance.empty')}</p>
        : <ShipHealthInventory rows={rows} quantities={quantities} disabled={busy}
          onQuantity={(key, count) => { setQuantities((current) => ({ ...current, [key]: count })); }} />}
      <section className="flex flex-col gap-1.5">
        <p className={HEADING}>{t('repairStation.queueHeading')}<span className="h-px flex-1 bg-v2-line" />
          <span className="font-v2-mono">{summary.jobs}/{summary.depth}</span></p>
        {repairs.length === 0 ? <p className="text-micro text-v2-ink-3">{t('repairStation.queueEmpty')}</p>
          : <ul className="flex flex-col gap-1.5">{repairs.map((order) => <JobRow key={order.id} order={order}
            lots={jobLots(order, lots)} busy={busy} onCancel={() => { setAsking(order); }} />)}</ul>}
      </section>
    </div>
    {scrap && <Confirm eyebrow={planet.planet.name} title={t('repairStation.maintenance.scrapConfirm', { count: scrap.count })}
      confirmLabel={t('repairStation.maintenance.scrapAction')} backLabel={t('repairStation.maintenance.keep')}
      pending={busy || choice.stale || planet.workshopRadiation === true} onClose={() => { setScrap(null); }} onConfirm={() => { move('SCRAP', scrap.selection, scrap.key); }}>
      <p className="text-caption text-v2-ink-2">{t('repairStation.maintenance.scrapRule')}</p>
      <div className="mt-3 flex items-center justify-between rounded-control border border-v2-line bg-v2-deep p-3">
        <span className="text-caption text-v2-ink-2">{t('repairStation.maintenance.returnedResources')}</span>
        <span className="flex flex-col items-end gap-1 font-v2-mono text-caption tabular-nums">
          {(['alloy', 'crystal', 'deuterium'] as const).map(resource =>
            <span key={resource} className="flex items-center gap-1">
              <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} className="size-3.5 object-contain" />
              {full(scrap.returned[resource])}
            </span>)}
        </span>
      </div>
    </Confirm>}
    {asking && <CancelConfirm order={asking} pending={cancel.isPending} onClose={() => { setAsking(null); }}
      onConfirm={() => {
        const order = asking;
        setAsking(null);
        cancel.mutate({ planetId: planet.planet.id, orderId: order.id }, {
          onSuccess: (result) => { say(t('planet.queue.cancelled', { alloy: full(result.refund.alloy),
            crystal: full(result.refund.crystal), deuterium: full(result.refund.deuterium) })); },
          onError: (error) => { say(describe(error), 'error'); },
        });
      }} />}
  </Sheet>;
}
