import { BUILD } from '@astera/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BuildOrderView } from '../../api/schemas.js';
import { Glyph, SectionTag, TimerRow, type GlyphId } from '../../game-ui/index.js';
import { haptic } from '../../lib/haptics.js';
import type { OutlineLaneId, OutlineQueue, OutlineWorld } from '../../lib/outline.js';
import type { AirborneItem, FlightMark } from '../../lib/airborne.js';
import { paceShown } from '../../lib/fleetPage.js';
import { buildOrderLabel, orderWaiting } from '../../lib/orders.js';
import { OWN_SOUND, playSound } from '../../lib/sound.js';
import { clockTime, countdown } from '../../lib/time.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
import { orderLeft } from '../kit/QueueLane.js';

export type { OutlineQueue, OutlineWorld } from '../../lib/outline.js';

export interface OutlineProps {
  /** Server time, ticking. */
  now: number;
  worlds: readonly OutlineWorld[];
  /** `useAirborne().items`: yours and the enemy coming for you, soonest first. */
  flights: readonly AirborneItem[];
  /** Research first, then each world's Construction and Yard. */
  queues: readonly OutlineQueue[];
  onWorld: (id: string) => void;
  onFlight: (item: AirborneItem) => void;
  onQueue: (queue: OutlineQueue) => void;
}

const LANE = {
  research: 'outline.research',
  construction: 'planet.queue.construction',
  yard: 'planet.queue.yard',
  repair: 'starter.queue.title',
} as const satisfies Record<OutlineLaneId, string>;

/** Each lane's mark, as the timers sheet draws its work: a build rises, research looks closer. */
const LANE_MARK = { research: 'zoom', construction: 'up', yard: 'up', repair: 'repair' } as const satisfies Record<OutlineLaneId, GlyphId>;

/** What kind of flight it is, as the timers sheet marks it (G1-c); a flight coming home is a recall. */
const FLIGHT_MARK: Record<FlightMark, GlyphId> = {
  unknown_signal: 'target',
  monument: 'star',
  fleet: 'rocket',
  probe: 'eye',
  incoming: 'siren',
  transfer: 'crate',
  settlement: 'colony',
  death_star: 'rocket',
  radiation_bomb: 'radiation',
  mining: 'mine',
  salvage: 'debris',
  pirate: 'pirate',
  trade: 'crate',
  intergalactic_convoy: 'crate',
};

/** A kit press: the tap, the buzz, then the place it opens. */
function usePress(onPress: () => void) {
  return useOwnPress(() => { playSound('tap'); haptic('tap'); onPress(); });
}

function Part({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <SectionTag as="h2" {...(count === undefined ? {} : { aside: <span className="gk-num">{count}</span> })}>{title}</SectionTag>
      {children}
    </section>
  );
}

/** A world: its mark on a coin, its name, its ships; an attack coming for it is a red siren. */
function WorldRow({ world, onWorld }: { world: OutlineWorld; onWorld: (id: string) => void }) {
  const { t } = useTranslation();
  const own = usePress(() => { onWorld(world.id); });
  const ships = world.ships > 0 ? t('fleetPage.shipsHome', { count: world.ships }) : t('fleetPage.noShips');
  const where = [ships, ...(world.away > 0 ? [t('fleetPage.away', { count: world.away })] : [])].join(' · ');
  return (
    <button
      type="button"
      {...OWN_SOUND}
      aria-label={[
        world.name,
        t(world.capital ? 'fleetPage.capital' : 'fleetPage.colony'),
        ...(world.threats > 0 ? [t('outline.threat', { count: world.threats })] : []),
        where,
      ].join(' · ')}
      {...(world.active ? { 'aria-current': 'true' as const } : {})}
      className="gk-wrow gk-cut"
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="gk-wrow__coin" aria-hidden="true"><Glyph id={world.capital ? 'home' : 'colony'} /></span>
      <span className="grid min-w-0">
        <span className="gk-wrow__name">{world.name}</span>
        <span className="gk-sub">{where}</span>
      </span>
      {world.threats > 0 && (
        <span data-tone="hostile" className="gk-wrow__threat gk-num"><Glyph id="siren" />{world.threats}</span>
      )}
    </button>
  );
}

/** A flight, as the timers sheet draws it: its mark in a ring that empties, red when it comes for you. */
function FlightLine({ item, now, onFlight }: { item: AirborneItem; now: number; onFlight: (item: AirborneItem) => void }) {
  const { t } = useTranslation();
  const pace = paceShown(item.pace);
  const detail = [item.detail, ...(pace === null ? [] : [t('fleetPage.pace', { pct: pace })])].filter(Boolean).join(' · ');
  return (
    <TimerRow
      tone={item.incoming ? 'hostile' : 'self'}
      glyph={item.leg === 'return' ? 'recall' : FLIGHT_MARK[item.mark]}
      remaining={Math.max(0, item.arrival - now)}
      total={item.span ? item.span.to - item.span.from : 0}
      title={item.title}
      {...(detail === '' ? {} : { detail })}
      time={countdown(item.arrival - now)}
      at={t('now.at', { time: clockTime(new Date(item.arrival)) })}
      {...(item.focus ? { onPress: () => { onFlight(item); } } : {})}
    />
  );
}

/** An order in a lane: the ring fills as it builds; behind the head it says it waits. */
function OrderLine({ order, lane, now }: { order: BuildOrderView; lane: OutlineLaneId; now: number }) {
  const left = orderLeft(order, now);
  const finishes = order.finishesAt?.getTime() ?? null;
  const started = order.startedAt?.getTime() ?? null;
  const running = finishes !== null && !orderWaiting(order, now);
  return (
    <TimerRow
      tone="self"
      glyph={LANE_MARK[lane]}
      remaining={running ? Math.max(0, finishes - now) : 0}
      total={running && started !== null ? finishes - started : 0}
      title={order.count > 1 ? `${buildOrderLabel(order)} ×${String(order.count)}` : buildOrderLabel(order)}
      {...(running ? { time: left } : { waiting: left })}
    />
  );
}

/** A lane of work: its name and how full it is; empty, it is a free slot — a gap you can close. */
function LaneRow({ queue, now, onQueue }: { queue: OutlineQueue; now: number; onQueue: (queue: OutlineQueue) => void }) {
  const { t } = useTranslation();
  const own = usePress(() => { onQueue(queue); });
  const label = t(LANE[queue.lane]);
  const free = Math.max(0, BUILD.queueDepth - queue.orders.length);
  const idle = queue.orders.length === 0;
  const state = idle
    ? t('outline.idle', { count: free })
    : t('outline.filled', { count: queue.orders.length, total: BUILD.queueDepth });
  return (
    <button
      type="button"
      {...OWN_SOUND}
      aria-label={`${label} · ${state}`}
      data-tone={idle ? 'warn' : 'self'}
      {...(idle ? { 'data-idle': '' } : {})}
      className="gk-olane"
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="gk-olane__head">
        <span className="gk-olane__name">{label}</span>
        <span className="gk-olane__state gk-num">{idle ? state : `${String(queue.orders.length)}/${String(BUILD.queueDepth)}`}</span>
      </span>
      {queue.orders.map((order) => <OrderLine key={order.id} order={order} lane={queue.lane} now={now} />)}
    </button>
  );
}

/**
 * THE DESK OUTLINE. Spec E11 · K10 (docs/ui-v2/gozlemevi.md).
 *
 * On a wide screen the phone is not scaled up: a column opens beside the galaxy and
 * keeps in view what the phone keeps one tab away — the worlds, what is in the air,
 * the work queues. Each row opens the place that answers it: a world or a flight on
 * the galaxy, a lane on its Base page. An idle lane is warn (a gap you can close); an
 * attack coming for a world is the one red thing here (K2).
 */
export function Outline({ now, worlds, flights, queues, onWorld, onFlight, onQueue }: OutlineProps) {
  const { t } = useTranslation();
  const several = worlds.length > 1;
  const ownLanes = queues.filter((queue) => queue.worldId === null || queue.lane === 'repair');
  const byWorld = worlds
    .map((world) => ({ world, lanes: queues.filter((queue) => queue.worldId === world.id) }))
    .filter(({ lanes }) => lanes.length > 0);

  return (
    <aside
      data-outline=""
      aria-label={t('outline.label')}
      className="gk gk-desk flex h-full w-[260px] shrink-0 flex-col gap-4 overflow-y-auto"
    >
      {worlds.length > 0 && <Part title={t('outline.worlds')} count={worlds.length}>
        <ul className="flex flex-col gap-1.5">
          {worlds.map((world) => <li key={world.id}><WorldRow world={world} onWorld={onWorld} /></li>)}
        </ul>
      </Part>}

      {(worlds.length > 0 || flights.length > 0) && <Part title={t('outline.air')} {...(flights.length > 0 ? { count: flights.length } : {})}>
        {flights.length === 0 ? (
          <p className="gk-sub">{t('outline.airEmpty')}</p>
        ) : (
          <ul className="grid">
            {flights.map((item) => <li key={item.key}><FlightLine item={item} now={now} onFlight={onFlight} /></li>)}
          </ul>
        )}
      </Part>}

      <Part title={t('outline.queues')}>
        <div className="flex flex-col gap-1.5">
          {ownLanes.map((queue) => <LaneRow key={queue.lane} queue={queue} now={now} onQueue={onQueue} />)}
          {byWorld.map(({ world, lanes }) => (
            <div key={world.id} className="flex flex-col gap-1.5">
              {several && <h3 className="gk-label mt-1 truncate">{world.name}</h3>}
              {lanes.map((queue) => <LaneRow key={queue.lane} queue={queue} now={now} onQueue={onQueue} />)}
            </div>
          ))}
        </div>
      </Part>
    </aside>
  );
}
