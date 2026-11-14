import { ATMOSPHERE } from '../ui/atmosphere.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';
import { HULLS, SHIP_DAMAGE, honorRepairResources } from '@astera/rules';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCancelRepair, useMaintenance, useStartRepair } from '../api/queries.js';
import type { BuildOrderView, PlanetView } from '../api/schemas.js';
import { Banner, Chip, CostLine, Emblem, GameButton, GameHold, GameTabs, Glyph, InfoPeek, Lever, Timer, type TabItem } from '../game-ui/index.js';
import { buildingName, hullLabel, researchName } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { repairSubject } from '../lib/orders.js';
import {
  damagePct,
  jobLots,
  stationSummary,
  type DockLot,
  type RepairDock,
} from '../lib/repairStation.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { countdown, durationPrecise, useNow } from '../lib/time.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { CancelConfirm } from '../ui/QueueStrip.js';
import { describe, useToast } from '../ui/Toast.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { ShipHealthInventory } from '../ui/ShipHealthInventory.js';
import { HonorEffectQuote } from '../ui/HonorBenefits.js';
import { createIdempotencyKey, type MaintenanceAction, type MaintenanceSelection, type RepairRequest } from '../api/client.js';
import { dockMaintenanceRows, homeMaintenanceRows, maintenanceChoice, type MaintenanceRow } from '../lib/maintenanceInventory.js';

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
 * On the game kit (G2-f, 2026-11-14): the card is half the height it was, the workshop's
 * picture behind it; the menu opens on the place that needs a decision, the places are tabs,
 * repair-or-scrap is a lever, a repair is a one-second hold (it spends) and a scrap a
 * second and a half (it is final).
 *
 * Every figure comes off the planet view the server priced (`dock`, `queues.REPAIR`);
 * nothing here computes a price of its own (`lib/repairStation.ts`).
 */

interface Held { alloy: number; crystal: number; deuterium: number }

/** How far a running job has gone, 0 to 1. */
const doneShare = (order: BuildOrderView, now: number): number => {
  if (!order.finishesAt) return 0;
  const start = order.startedAt.getTime();
  const span = order.finishesAt.getTime() - start;
  return span > 0 ? Math.min(1, Math.max(0, (now - start) / span)) : 1;
};

/** The running job's bar and clock on the card. Its own component, so only it ticks, and only while a job runs. */
function RunningClock({ order }: { order: BuildOrderView }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  if (!order.finishesAt) return null;
  const left = order.finishesAt.getTime() - now;
  return (
    <span className="gk-scard__run">
      <span className="gk-bar gk-scard__bar" aria-hidden="true">
        <span className="gk-bar__fill" style={{ width: `${String(doneShare(order, now) * 100)}%` }} />
      </span>
      <span className="gk-scard__time gk-num">{left > 0 ? countdown(left) : t('repairStation.finishing')}</span>
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
    <span data-testid="repair-wait" className="gk-station__wait">
      <Glyph id="timed" />
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
  const door = useOwnPress(() => {
    playSound('tap');
    haptic('tap');
    onOpen();
  });
  return (
    <div id="row-REPAIR_STATION" data-highlighted={highlighted ? '' : undefined} data-working={summary.repairingShips > 0 ? '' : undefined}
      className="gk gk-scard col-span-2">
      <AtmosphereImage art={ATMOSPHERE.repair} />
      <button type="button" {...OWN_SOUND} className="gk-scard__door" onPointerDown={door.onPointerDown} onClick={door.onClick}>
        <span className="gk-scard__head">
          <span className="gk-scard__name">{t('repairStation.title')}</span>
          <span data-queue-fill className="gk-scard__fill gk-num" {...(summary.full ? { 'data-tone': 'warn' } : {})}>
            {t('repairStation.queueFill', { used: summary.jobs, total: summary.depth })}
          </span>
        </span>
        <span className="gk-scard__role">{t('repairStation.role')}</span>
        {idle ? (
          <span className="gk-scard__idle"><Glyph id="check" />{t('repairStation.idle')}</span>
        ) : (
          <span className="gk-scard__tags">
            {summary.waitingShips > 0 && (
              <span className="gk-scard__tag" data-tone="warn"><Glyph id="damaged" />{t('repairStation.waitingShips', { count: summary.waitingShips })}</span>
            )}
            {summary.repairingShips > 0 && (
              <span className="gk-scard__tag" data-tone="self"><Glyph id="repair" />{t('repairStation.repairingShips', { count: summary.repairingShips })}</span>
            )}
          </span>
        )}
        {head && <RunningClock order={head} />}
        <span className="gk-scard__next" aria-hidden="true"><Glyph id="next" /></span>
      </button>
    </div>
  );
}

/* ── the menu ───────────────────────────────────────────────────── */

/** One job: its ring, what it holds, how far along it is or when it starts, and its cancel. */
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
  // the station already says it is a repair: the job is named by its ships
  const label = repairSubject(order);
  const started = !order.startedAt || order.startedAt.getTime() <= now;
  const span = order.finishesAt ? order.finishesAt.getTime() - order.startedAt.getTime() : 0;
  const left = order.finishesAt ? Math.max(0, order.finishesAt.getTime() - now) : 0;
  // A job of one lot names its wound in its title; a job of several lists its lots.
  const only = lots.length === 1 ? lots[0] : undefined;
  return (
    <li data-testid="repair-job" className="gk-job" data-state={started ? 'running' : 'waiting'}>
      <div className="gk-job__main">
        <Timer remaining={started ? left : span} total={span} glyph={started ? 'repair' : 'timed'} tone="self" beat={started} />
        <span className="gk-job__text">
          <span className="gk-job__title">
            {label} <span className="gk-num">{`×${String(order.count)}`}</span>
          </span>
          {only && <span className="gk-job__harm gk-num">{t('repairStation.damaged', { pct: damagePct(only.damageBp + (only.remainderBp ?? 0)) })}</span>}
          {order.finishesAt && (
            <span className="gk-sub gk-num">
              {!started ? t('repairStation.startsIn', { time: countdown(order.startedAt.getTime() - now) })
                : left > 0 ? t('repairStation.ends', { time: countdown(left) }) : t('repairStation.finishing')}
            </span>
          )}
        </span>
        {order.finishesAt && (
          <GameButton size="sm" tone="ghost" pending={busy} onPress={onCancel}>{t('repairStation.cancel')}</GameButton>
        )}
      </div>
      {lots.length > 1 && (
        <ul className="gk-job__lots">
          {lots.map((lot) => (
            <li key={lot.id} className="gk-job__lot">
              <Emblem cls={HULLS[lot.hull].cls} />
              {hullLabel(lot.hull)}
              <span className="gk-num">{`×${String(lot.count)}`}</span>
              <span className="gk-job__harm gk-num">{t('repairStation.damaged', { pct: damagePct(lot.damageBp + (lot.remainderBp ?? 0)) })}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** What a scrap gives back, every resource said, a zero too: the figure the final hold is weighed on. */
function Returned({ scrap }: { scrap: Held }) {
  const { t } = useTranslation();
  return (
    <span className="gk-station__returned">
      <span className="gk-sub">{t('repairStation.maintenance.returnedResources')}</span>
      {(['alloy', 'crystal', 'deuterium'] as const).map((resource) => (
        <span key={resource} className="gk-cost__part gk-num">
          <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} draggable={false} />
          {full(scrap[resource])}
        </span>
      ))}
    </span>
  );
}

type View = 'HOME' | 'DOCK' | 'QUEUE';
/** The work order for the chosen ships. Back to the hangar is offered only in the workshop. */
type Work = 'REPAIR' | 'RETURN' | 'SCRAP';

const wounded = (row: MaintenanceRow): boolean => row.damageBp > 0 || (row.remainderBp ?? 0) > 0;

/**
 * WHERE THE STATION OPENS: on the place that needs a decision. Wounded ships at home first
 * (they still fly, hurt), then ships waiting in the workshop (they neither fly nor defend), then
 * the queue when all that is docked is already being worked on.
 */
function opening(planet: PlanetView): View {
  if (homeMaintenanceRows(planet.fleet, planet.fleetDamage).some(wounded)) return 'HOME';
  if ((planet.dock?.lots ?? []).some((lot) => !lot.repairing)) return 'DOCK';
  if ((planet.queues?.REPAIR ?? []).length > 0) return 'QUEUE';
  return 'HOME';
}

/**
 * THE STATION ITSELF, for the world this Base is reading.
 *
 * The head carries the workshop's picture and what a repair costs this player; under it the
 * rule in one line, the arithmetic one tap deeper. Then the three places as tabs — the hangar,
 * the workshop, the queue — each with what waits for a decision on it; in a place, the lever
 * that says what the work is, the ships to choose, and in the footer, where the thumb is, the
 * choice's price and the press or hold that commits it.
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
  const ids = useId();
  const radiation = planet.workshopRadiation === true;
  // Under radiation the workshop takes one order only, the way back: it opens on it.
  const workFor = (next: View): Work => (next === 'DOCK' && radiation ? 'RETURN' : 'REPAIR');
  const [view, setView] = useState<View>(() => opening(planet));
  const [mode, setMode] = useState<Work>(() => workFor(view));
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({});
  const [asking, setAsking] = useState<BuildOrderView | null>(null);
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  const intentKey = (action: MaintenanceAction | 'REPAIR', selection: MaintenanceSelection | RepairRequest): string => {
    const fingerprint = JSON.stringify({ planetId: planet.planet.id, action, selection });
    if (intent.current?.fingerprint !== fingerprint) intent.current = { fingerprint, key: createIdempotencyKey() };
    return intent.current.key;
  };
  const place = view === 'DOCK' ? 'DOCK' : 'HOME';
  const repairs = planet.queues?.REPAIR ?? [];
  const last = repairs.at(-1);
  const dock = planet.dock;
  const summary = stationSummary(dock, repairs);
  const lots = dock?.lots ?? [];
  const home = homeMaintenanceRows(planet.fleet, planet.fleetDamage);
  const damagedHome = home.filter(wounded).reduce((sum, row) => sum + row.count, 0);
  const allRows = place === 'HOME' ? home : dockMaintenanceRows(lots, planet.workshopRadiation ? 'LOT' : 'HEALTH');
  // the ships still to choose first; a group already on the cradle after them, as one line
  const rows = (mode === 'REPAIR' ? allRows.filter(wounded) : allRows).toSorted((a, b) => Number(a.busy) - Number(b.busy));
  const choice = maintenanceChoice(rows, quantities, dock?.pct ?? 100);
  const selectable = rows.filter(row => !row.busy && row.count > 0);
  const bulkSelection = selectable.slice(0, SHIP_DAMAGE.repairLotsPerOrder);
  const allSelected = selectable.length > 0 && !choice.stale
    && bulkSelection.every(row => quantities[row.key] === row.count) && choice.selected.length === bulkSelection.length;
  const chosenAny = Object.values(quantities).some(count => count > 0);
  const adjustedRepairCost = planet.honorBenefits ? honorRepairResources(choice.repairCost, planet.honorBenefits) : choice.repairCost;
  const busy = start.isPending || cancel.isPending || maintenance.isPending;
  const canPay = adjustedRepairCost.alloy <= held.alloy && adjustedRepairCost.crystal <= held.crystal
    && adjustedRepairCost.deuterium <= held.deuterium;
  // A new place starts clean: no ships chosen, and its own first order (never a scrap carried over).
  const switchView = (next: View): void => { setView(next); setMode(workFor(next)); setQuantities({}); };
  const switchMode = (next: string): void => { setMode(next === 'SCRAP' ? 'SCRAP' : next === 'RETURN' ? 'RETURN' : 'REPAIR'); setQuantities({}); };
  const move = (action: MaintenanceAction, selection: MaintenanceSelection): void => {
    if (busy) return;
    // Evacuation uses current server health; changing radiation damage must not turn
    // a retry of the same lot/count into another withdrawal.
    const request = action === 'RETURN' && selection.source === 'DOCK'
      ? { source: 'DOCK' as const, lots: selection.lots.map(({ id, count }) => ({ id, count })) } : selection;
    maintenance.mutate({ planetId: planet.planet.id, action, selection: request, key: intentKey(action, request) }, {
      onSuccess: () => {
        intent.current = null;
        setQuantities({});
        if (action === 'DOCK') setView('DOCK');
        say(t(`repairStation.maintenance.${action === 'DOCK' ? 'moved' : action === 'RETURN' ? 'returned' : 'scrapped'}`));
      },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };
  const repair = (): void => {
    if (busy || !choice.repair) return;
    const request = { ...choice.repair, ...(planet.honorBenefits ? { expectedHonorTier: planet.honorBenefits.tier } : {}) };
    start.mutate({ planetId: planet.planet.id, request, key: intentKey('REPAIR', request) }, {
      onSuccess: () => { intent.current = null; setQuantities({}); say(t('repairStation.started')); },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };

  // Why a commitment cannot be made, on its face: the first reason that holds, in the order a player fixes them.
  const blocked = radiation ? t('repairStation.maintenance.radiationShort')
    : choice.tooMany ? t('repairStation.tooManyShort') : null;
  const repairReason = start.isPending ? t('repairStation.starting')
    : blocked ?? (summary.full ? t('repairStation.queueFullShort', { used: summary.jobs, total: summary.depth })
      : choice.selection === null ? t('repairStation.pick')
        : !canPay ? t('itemSheet.short') : null);
  const otherReason = blocked ?? (choice.selection === null ? t('repairStation.maintenance.select') : null);
  const commitment = mode === 'RETURN' ? (
    // free and undone by moving them again: a plain press; radiation never closes the way out
    <GameButton tone="action" size="lg" wide glyph="back_home" pending={maintenance.isPending}
      disabledReason={choice.tooMany ? t('repairStation.tooManyShort') : choice.selection === null ? t('repairStation.maintenance.select') : null}
      onPress={() => { if (choice.selection) move('RETURN', choice.selection); }}>
      {t('repairStation.maintenance.return')}
    </GameButton>
  ) : mode === 'SCRAP' ? (
    <GameHold weight="final" tone="danger" glyph="debris" commitSound="impact"
      label={t('repairStation.maintenance.scrapSelected', { count: choice.ships })} disabledReason={otherReason}
      onCommit={() => { if (choice.selection) move('SCRAP', choice.selection); }} />
  ) : place === 'HOME' ? (
    <GameButton tone="action" size="lg" wide glyph="repair" disabledReason={otherReason} pending={maintenance.isPending}
      onPress={() => { if (choice.selection) move('DOCK', choice.selection); }}>
      {t('repairStation.maintenance.move')}
    </GameButton>
  ) : (
    <GameHold weight="spends" glyph="repair" commitSound="weld"
      label={t('repairStation.repairSelected', { count: choice.ships })} disabledReason={repairReason} onCommit={repair} />
  );

  const tabs: TabItem<View>[] = [
    { id: 'HOME', label: t('repairStation.maintenance.hangar'), ...(damagedHome > 0 ? {
      badge: damagedHome, spoken: `${t('repairStation.maintenance.hangar')} · ${t('repairStation.damagedShips', { count: damagedHome })}` } : {}) },
    { id: 'DOCK', label: t('repairStation.maintenance.workshop'), ...(summary.waitingShips > 0 ? {
      badge: summary.waitingShips, spoken: `${t('repairStation.maintenance.workshop')} · ${t('repairStation.waitingShips', { count: summary.waitingShips })}` } : {}) },
    { id: 'QUEUE', label: t('repairStation.queueFill', { used: summary.jobs, total: summary.depth }) },
  ];
  const rules = [t('repairStation.ruleFree'), t('repairStation.rulePrice'),
    t('repairStation.ruleTime', { shipyard: buildingName('SHIPYARD'), automation: researchName('YARD_AUTOMATION') }),
    t('repairStation.ruleIndustrial', { industrial: researchName('INDUSTRIAL') }),
    t('repairStation.ruleQueue', { depth: summary.depth }), t('repairStation.ruleCancel')];

  const footer = view === 'QUEUE' ? undefined : (
    <div className="gk-station__foot">
      {choice.stale && <p role="status" className="gk-station__note">{t('repairStation.maintenance.stale')}</p>}
      {choice.tooMany && <p role="status" className="gk-station__note">{t('repairStation.tooMany', { max: SHIP_DAMAGE.repairLotsPerOrder })}</p>}
      <div className="gk-station__total" data-testid="repair-total">
        <span className="gk-sub gk-num">{t('repairStation.maintenance.selected', { count: choice.ships })}</span>
        {mode === 'SCRAP' ? <Returned scrap={choice.scrap} /> : mode === 'REPAIR' && place === 'DOCK' && choice.ships > 0 && (
          <CostLine cost={adjustedRepairCost} held={held}
            time={<span className="gk-cost__time"><Glyph id="clock" />{durationPrecise(choice.minutes)}</span>} />
        )}
      </div>
      {mode === 'REPAIR' && place === 'DOCK' && choice.ships > 0 && (
        <HonorEffectQuote kind="repair" value={planet.honorBenefits} base={choice.repairCost} net={adjustedRepairCost} />
      )}
      {mode === 'REPAIR' && place === 'DOCK' && last && <QueueWait last={last} />}
      {commitment}
    </div>
  );

  return <Sheet detents={['fit']} eyebrow={planet.planet.name} title={t('repairStation.title')} onClose={onClose}
    headerArt={ATMOSPHERE.repair}
    kit={{ tone: 'self', meta: <span className="gk-sub">{planet.honorBenefits
      ? t('honorBenefits.researchShare', { pct: dock?.pct ?? 100 }) : t('repairStation.youPay', { pct: dock?.pct ?? 100 })}</span> }}
    {...(footer === undefined ? {} : { footer })}>
    <div className="gk-station">
      {radiation && <Banner tone="warn" variant="strip" glyph="radiation" role="status" title={t('repairStation.maintenance.radiation')} />}
      <InfoPeek fact={t('repairStation.maintenance.rule')} about={t('repairStation.howItWorks')}
        rule={<ul data-repair-rules className="gk-station__rules">{rules.map(line => <li key={line}>{line}</li>)}</ul>} />
      <GameTabs label={t('repairStation.title')} tabs={tabs} value={view} onChange={switchView}
        ids={{ tab: (id) => `${ids}-tab-${id}`, panel: () => `${ids}-panel` }} />
      <div role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-tab-${view}`} className="gk-station__panel">
        {view === 'QUEUE' ? (
          repairs.length === 0 ? <p className="gk-sub">{t('repairStation.queueEmpty')}</p> : (
            <ul className="gk-jobs">
              {repairs.map((order) => (
                <JobRow key={order.id} order={order} lots={jobLots(order, lots)} busy={busy} onCancel={() => { setAsking(order); }} />
              ))}
            </ul>
          )
        ) : (
          <>
            <Lever label={t('repairStation.maintenance.order')} value={mode} onChange={switchMode} options={[
              { id: 'REPAIR', label: t('repairStation.maintenance.repair') },
              ...(place === 'DOCK' ? [{ id: 'RETURN', label: t('repairStation.maintenance.back') }] : []),
              { id: 'SCRAP', label: t('repairStation.maintenance.scrap') },
            ]} />
            <p className="gk-sub" {...(mode === 'SCRAP' ? { 'data-tone': 'warn' } : {})}>
              {mode === 'SCRAP' && <Glyph id="lock" />}
              {mode === 'SCRAP' ? t('repairStation.maintenance.scrapRule') : mode === 'RETURN' ? t('repairStation.outOfAction')
                : place === 'HOME' ? t('repairStation.maintenance.homeHint') : t('repairStation.maintenance.dockRule')}
            </p>
            {(mode !== 'SCRAP' || chosenAny) && (
              <div className="gk-station__picks">
                {mode !== 'SCRAP' && (
                  <Chip disabled={busy || selectable.length === 0 || allSelected}
                    onPress={() => { setQuantities(Object.fromEntries(bulkSelection.map(row => [row.key, row.count]))); }}>
                    {selectable.length > SHIP_DAMAGE.repairLotsPerOrder
                      ? t('repairStation.selectBatch', { max: SHIP_DAMAGE.repairLotsPerOrder }) : t('repairStation.selectAll')}
                  </Chip>
                )}
                {chosenAny && (
                  <Chip disabled={busy} onPress={() => { setQuantities({}); }}>{t('repairStation.maintenance.clear')}</Chip>
                )}
              </div>
            )}
            {rows.length === 0 ? <p className="gk-sub">{t('repairStation.maintenance.empty')}</p>
              : <ShipHealthInventory rows={rows} quantities={quantities} disabled={busy}
                onQuantity={(key, count) => { setQuantities((current) => ({ ...current, [key]: count })); }} />}
          </>
        )}
      </div>
    </div>
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
