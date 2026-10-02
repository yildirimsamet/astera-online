import { HULLS, SHIP_DAMAGE } from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCancelRepair, useStartRepair } from '../api/queries.js';
import type { BuildOrderView, PlanetView } from '../api/schemas.js';
import { buildingName, hullLabel, researchName } from '../i18n/names.js';
import { affordWait } from '../lib/afford.js';
import { full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { buildOrderLabel } from '../lib/orders.js';
import {
  damagePct,
  jobLots,
  newShipShare,
  repairSelection,
  stationSummary,
  type DockLot,
  type RepairDock,
} from '../lib/repairStation.js';
import { countdown, duration, durationPrecise, useNow } from '../lib/time.js';
import { REPAIR_STATION_ART } from '../ui/assets.js';
import { CancelConfirm } from '../ui/QueueStrip.js';
import { describe, useToast } from '../ui/Toast.js';
import { Icon } from '../v2/icons.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { Cost } from '../v2/kit/Cost.js';
import { Sheet } from '../v2/kit/Sheet.js';

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

/** The warm light of the bay behind its render: decoration, never a meaning. */
const BAY_GLOW = {
  backgroundImage:
    'radial-gradient(60% 60% at 50% 55%, color-mix(in srgb, var(--color-v2-sky-warm) 16%, transparent), transparent 72%)',
};

/** How much of the hull is gone, as a thin bar that fills with the damage. */
function DamageBar({ damageBp }: { damageBp: number }) {
  return (
    <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-v2-line">
      <span className="block h-full rounded-full bg-v2-warn" style={{ width: `${String(Math.min(100, damageBp / 100))}%` }} />
    </span>
  );
}

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
      className={`col-span-2 overflow-hidden rounded-control border bg-v2-panel font-v2-ui ${
        highlighted ? 'border-v2-self/60 ring-1 ring-v2-self/40' : 'border-v2-line'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          haptic('tap');
          onOpen();
        }}
        className="group flex w-full items-stretch gap-3 p-2 text-left outline-none transition-colors hover:bg-v2-ink/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-self/70"
      >
        <span
          className="grid w-[92px] shrink-0 place-items-center rounded-control bg-v2-deep/70"
          style={BAY_GLOW}
        >
          <img
            src={REPAIR_STATION_ART}
            alt=""
            aria-hidden
            loading="lazy"
            className="size-[84px] scale-[1.18] object-contain transition-transform duration-300 group-hover:scale-[1.24]"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
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
        <Icon id="i-chev" className="size-4 shrink-0 self-center text-v2-ink-3 transition-transform group-hover:translate-x-0.5" />
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

/**
 * ONE WAITING LOT, CHOSEN OR NOT. The whole row is the switch, because on a phone the box
 * alone is a target the thumb misses. Its damage, what that is against a new ship, the
 * price and the time are the comparison the choice is made on: a lot at 90% costs nearly
 * a new ship, one at 25% little.
 */
function LotRow({ lot, pct, held, chosen, onToggle }: {
  lot: DockLot;
  pct: number;
  held: Held;
  chosen: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const name = hullLabel(lot.hull);
  const damage = damagePct(lot.damageBp);
  return (
    <li data-testid="dock-lot">
      <label
        className={`flex cursor-pointer items-start gap-2.5 rounded-control border px-2.5 py-2 transition-colors ${
          chosen ? 'border-v2-self/45 bg-v2-self/[0.06]' : 'border-v2-line bg-v2-panel'
        }`}
      >
        <input
          type="checkbox"
          checked={chosen}
          onChange={onToggle}
          aria-label={t('repairStation.choose', { name, count: lot.count })}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-cell border peer-focus-visible:ring-2 peer-focus-visible:ring-v2-self/70 ${
            chosen ? 'border-v2-self bg-v2-self text-v2-self-ink' : 'border-v2-line-hi bg-v2-deep'
          }`}
        >
          {chosen && <Icon id="i-check" className="size-3" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <ClassEmblem cls={HULLS[lot.hull].cls} className="size-3 shrink-0" decorative />
            <span className="min-w-0 flex-1 truncate text-caption font-semibold text-v2-ink">
              {name} <span className="font-v2-mono font-normal text-v2-ink-2">{`×${String(lot.count)}`}</span>
            </span>
            <span className="shrink-0 font-v2-mono text-micro font-semibold text-v2-warn">
              {t('repairStation.damaged', { pct: damage })}
            </span>
          </span>
          <DamageBar damageBp={lot.damageBp} />
          <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="text-micro text-v2-ink-3">
              {t('repairStation.share', { pct: newShipShare(lot.damageBp, pct) })}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <Cost cost={lot.cost} held={held} />
              <span className="flex items-center gap-1 font-v2-mono text-micro text-v2-ink-2">
                <Icon id="i-clock" className="size-3 shrink-0" />
                {durationPrecise(lot.minutes)}
              </span>
            </span>
          </span>
        </span>
      </label>
    </li>
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
              {t('repairStation.damaged', { pct: damagePct(only.damageBp) })}
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
              <span className="text-v2-warn">{t('repairStation.damaged', { pct: damagePct(lot.damageBp) })}</span>
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
export function RepairStationSheet({ planet, held, onClose }: {
  planet: PlanetView;
  held: Held;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const start = useStartRepair();
  const cancel = useCancelRepair();
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const [explained, setExplained] = useState(false);
  const [asking, setAsking] = useState<BuildOrderView | null>(null);

  const dock = planet.dock ?? null;
  const repairs = planet.queues?.REPAIR ?? [];
  const last = repairs.at(-1);
  const pct = dock?.pct ?? 100;
  const summary = stationSummary(dock, repairs);
  const lots = dock?.lots ?? [];
  const waiting = lots.filter((lot) => !lot.repairing);
  const choice = repairSelection(dock, excluded);
  const everyChosen = choice.lots.length === waiting.length;
  const busy = start.isPending || cancel.isPending;

  const short = {
    alloy: Math.max(0, choice.cost.alloy - held.alloy),
    crystal: Math.max(0, choice.cost.crystal - held.crystal),
    deuterium: Math.max(0, choice.cost.deuterium - held.deuterium),
  };
  const canPay = short.alloy === 0 && short.crystal === 0 && short.deuterium === 0;
  // Deuterium has no rate on this payload, so a fuel shortfall says so rather than when.
  const wait = canPay || short.deuterium > 0
    ? null
    : affordWait(short, { alloyPerHour: planet.planet.alloyPerHour, crystalPerHour: planet.planet.crystalPerHour });

  const toggle = (id: string): void => {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const commit = (): void => {
    if (!choice.request) return;
    haptic('tap');
    start.mutate({ planetId: planet.planet.id, request: choice.request }, {
      onSuccess: () => { say(t('repairStation.started')); },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };

  /** What the commit says, and whether it may be pressed: the first thing in the way wins. */
  const action: { label: string; ready: boolean } = start.isPending
    ? { label: t('repairStation.starting'), ready: false }
    : summary.full
      ? { label: t('repairStation.queueFullShort', { used: summary.jobs, total: summary.depth }), ready: false }
      : choice.tooMany
        ? { label: t('repairStation.tooMany', { max: SHIP_DAMAGE.repairLotsPerOrder }), ready: false }
        : choice.request === null
          ? { label: t('repairStation.pick'), ready: false }
          : !canPay
            ? { label: wait === null ? t('itemSheet.short') : t('itemSheet.affordIn', { duration: duration(wait) }), ready: false }
            : { label: t('repairStation.repairSelected', { count: choice.ships }), ready: true };

  return (
    <Sheet
      detents={['fit']}
      eyebrow={planet.planet.name}
      title={t('repairStation.title')}
      onClose={onClose}
      footer={waiting.length === 0 ? undefined : (
        <div className="flex flex-col gap-2">
          {/* Only while the lane has room: a full lane says so on the commit instead. */}
          {last && !summary.full && <QueueWait last={last} />}
          <div data-testid="repair-total" className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-micro text-v2-ink-3">
              {t('repairStation.selected', { count: choice.ships })}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Cost cost={choice.cost} held={held} />
              <span className="flex items-center gap-1 whitespace-nowrap font-v2-mono text-micro text-v2-ink-2">
                <Icon id="i-clock" className="size-3 shrink-0" />
                {durationPrecise(choice.minutes)}
              </span>
            </span>
          </div>
          <button
            type="button"
            disabled={!action.ready || busy}
            onClick={commit}
            className="min-h-10 w-full rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-2"
          >
            {action.label}
          </button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3 pt-1">
        {/* WHAT IT IS AND WHAT IS IN IT. */}
        <section className="relative flex flex-col gap-2 rounded-control border border-v2-line bg-v2-deep px-3 pb-3 pt-2.5" style={BAY_GLOW}>
          {pct < 100 && (
            <span className="absolute left-2.5 top-2.5 rounded-chip border border-v2-self/40 bg-v2-deep/80 px-1.5 py-0.5 font-v2-mono text-micro text-v2-self">
              {t('repairStation.industrialChip', { industrial: researchName('INDUSTRIAL'), off: 100 - pct })}
            </span>
          )}
          <img src={REPAIR_STATION_ART} alt={t('repairStation.title')} className="mx-auto h-28 w-40 scale-110 object-contain" />
          <p className="text-center text-caption text-v2-ink-2">{t('repairStation.tagline')}</p>
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label={t('repairStation.statWaiting')} value={full(summary.waitingShips)} tone={summary.waitingShips > 0 ? 'warn' : 'ink'} />
            <Stat label={t('repairStation.statRepairing')} value={full(summary.repairingShips)} tone={summary.repairingShips > 0 ? 'self' : 'ink'} />
            <Stat label={t('repairStation.statQueue')} value={`${String(summary.jobs)}/${String(summary.depth)}`} tone={summary.full ? 'warn' : 'ink'} />
          </div>
        </section>

        {/* WHY THEY ARE HERE, AND THE ARITHMETIC ONE TAP DEEPER (progressive disclosure). */}
        <div className="flex flex-col gap-1.5">
          <p className="text-caption leading-snug text-v2-ink-2">
            <span>{t('repairStation.outOfAction')}</span>{' '}
            <button
              type="button"
              aria-expanded={explained}
              onClick={() => { setExplained((open) => !open); }}
              className="font-semibold text-v2-self"
            >
              {t('repairStation.howItWorks')} ›
            </button>
          </p>
          {explained && (
            <ul data-repair-rules className="flex flex-col gap-1 rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2.5 text-micro leading-snug text-v2-ink-2">
              {[
                t('repairStation.ruleFree'),
                t('repairStation.rulePrice'),
                t('repairStation.ruleTime', { shipyard: buildingName('SHIPYARD'), automation: researchName('YARD_AUTOMATION') }),
                `${t('repairStation.ruleIndustrial', { industrial: researchName('INDUSTRIAL') })}${pct < 100 ? ` ${t('repairStation.youPay', { pct })}` : ''}`,
                t('repairStation.ruleQueue', { depth: summary.depth }),
                t('repairStation.ruleCancel'),
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true" className="mt-[0.45em] size-1 shrink-0 rounded-full bg-v2-self/70" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* WHAT IS ALREADY BEING DONE. */}
        <section className="flex flex-col gap-1.5">
          <p className={HEADING}>
            {t('repairStation.queueHeading')}
            <span aria-hidden="true" className="h-px flex-1 bg-v2-line" />
            <span className={`font-v2-mono normal-case ${summary.full ? 'text-v2-warn' : ''}`}>{`${String(summary.jobs)}/${String(summary.depth)}`}</span>
          </p>
          {repairs.length === 0 ? (
            <p className="px-1 text-micro text-v2-ink-3">{t('repairStation.queueEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {repairs.map((order) => (
                <JobRow
                  key={order.id}
                  order={order}
                  lots={jobLots(order, lots)}
                  busy={busy}
                  onCancel={() => { setAsking(order); }}
                />
              ))}
            </ul>
          )}
        </section>

        {/* WHAT TO DO NOW. */}
        <section className="flex flex-col gap-1.5">
          <p className={HEADING}>
            {t('repairStation.damagedHeading')}
            <span aria-hidden="true" className="h-px flex-1 bg-v2-line" />
            {waiting.length > 0 && (
              <button
                type="button"
                onClick={() => { setExcluded(everyChosen ? new Set(waiting.map((lot) => lot.id)) : new Set()); }}
                className="font-semibold normal-case tracking-normal text-v2-self"
              >
                {everyChosen ? t('repairStation.selectNone') : t('repairStation.selectAll')}
              </button>
            )}
          </p>
          {waiting.length === 0 ? (
            <p className="px-1 text-micro leading-snug text-v2-ink-3">
              {summary.jobs === 0 ? t('repairStation.idle') : t('repairStation.noneWaiting')}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {waiting.map((lot) => (
                <LotRow
                  key={lot.id}
                  lot={lot}
                  pct={pct}
                  held={held}
                  chosen={!excluded.has(lot.id)}
                  onToggle={() => { toggle(lot.id); }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {asking && (
        <CancelConfirm
          order={asking}
          pending={cancel.isPending}
          onClose={() => { setAsking(null); }}
          onConfirm={() => {
            const order = asking;
            setAsking(null);
            cancel.mutate({ planetId: planet.planet.id, orderId: order.id }, {
              onSuccess: (result) => {
                say(t('planet.queue.cancelled', {
                  alloy: full(result.refund.alloy),
                  crystal: full(result.refund.crystal),
                  deuterium: full(result.refund.deuterium),
                }));
              },
              onError: (error) => { say(describe(error), 'error'); },
            });
          }}
        />
      )}
    </Sheet>
  );
}
