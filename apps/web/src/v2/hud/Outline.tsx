import { BUILD } from '@astera/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OutlineLaneId, OutlineQueue, OutlineWorld } from '../../lib/outline.js';
import type { AirborneItem } from '../../shell/PendingStrip.js';
import { Icon } from '../icons.js';
import { OrderLeft, OrderName, OrderRing } from '../kit/QueueLane.js';
import { FlightRow } from './FleetPage.js';

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
} as const satisfies Record<OutlineLaneId, string>;

function Part({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="flex items-baseline gap-1.5 text-micro font-semibold uppercase tracking-wide text-v2-ink-3">
        {title}
        {count !== undefined && <span className="font-v2-mono text-v2-ink-2">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function WorldRow({ world, onWorld }: { world: OutlineWorld; onWorld: (id: string) => void }) {
  const { t } = useTranslation();
  const ships = world.ships > 0 ? t('fleetPage.shipsHome', { count: world.ships }) : t('fleetPage.noShips');
  const where = [ships, ...(world.away > 0 ? [t('fleetPage.away', { count: world.away })] : [])].join(' · ');
  return (
    <button
      type="button"
      aria-label={[
        world.name,
        t(world.capital ? 'fleetPage.capital' : 'fleetPage.colony'),
        ...(world.threats > 0 ? [t('outline.threat', { count: world.threats })] : []),
        where,
      ].join(' · ')}
      {...(world.active ? { 'aria-current': 'true' as const } : {})}
      onClick={() => { onWorld(world.id); }}
      className={`relative flex w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-control border px-2.5 py-2 text-left ${
        world.active ? 'border-v2-self/40 bg-v2-self/5' : 'border-v2-line bg-v2-panel hover:border-v2-line-hi'
      }`}
    >
      {world.active && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-v2-self" />}
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon id={world.capital ? 'm-capital' : 'm-colony'} className="size-3.5 shrink-0 text-v2-self" />
        <span className="min-w-0 flex-1 truncate text-caption font-semibold text-v2-ink">{world.name}</span>
        {world.threats > 0 && (
          <span
            data-tone="hostile"
            className="flex shrink-0 items-center gap-0.5 rounded-full border border-v2-hostile/60 bg-v2-hostile/15 px-1.5 font-v2-mono text-micro font-semibold leading-4 text-v2-ink"
          >
            <Icon id="i-attack" className="size-3 text-v2-hostile" />
            {world.threats}
          </span>
        )}
      </span>
      <span className="truncate pl-5 text-micro text-v2-ink-3">{where}</span>
    </button>
  );
}

function LaneRow({ queue, now, onQueue }: { queue: OutlineQueue; now: number; onQueue: (queue: OutlineQueue) => void }) {
  const { t } = useTranslation();
  const label = t(LANE[queue.lane]);
  const free = Math.max(0, BUILD.queueDepth - queue.orders.length);
  const idle = queue.orders.length === 0;
  const state = idle
    ? t('outline.idle', { count: free })
    : t('outline.filled', { count: queue.orders.length, total: BUILD.queueDepth });
  return (
    <button
      type="button"
      aria-label={`${label} · ${state}`}
      data-tone={idle ? 'warn' : 'self'}
      onClick={() => { onQueue(queue); }}
      className={`flex w-full min-w-0 flex-col gap-1 rounded-control border px-2.5 py-1.5 text-left ${
        // An empty lane is drawn as the queue's own free slot is: a dashed cell. Its words are warn.
        idle ? 'border-dashed border-v2-line-hi hover:border-v2-warn/50' : 'border-v2-line bg-v2-panel hover:border-v2-line-hi'
      }`}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-micro font-semibold text-v2-ink-2">{label}</span>
        <span className={`shrink-0 font-v2-mono text-micro ${idle ? 'text-v2-warn' : 'text-v2-ink-3'}`}>
          {idle ? state : `${String(queue.orders.length)}/${String(BUILD.queueDepth)}`}
        </span>
      </span>
      {queue.orders.map((order) => (
        <span key={order.id} className="flex min-w-0 items-center gap-1.5">
          <OrderRing order={order} now={now} />
          <span className="grid min-w-0 flex-1">
            <OrderName order={order} />
          </span>
          <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2"><OrderLeft order={order} now={now} /></span>
        </span>
      ))}
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
  const research = queues.filter((queue) => queue.worldId === null);
  const byWorld = worlds
    .map((world) => ({ world, lanes: queues.filter((queue) => queue.worldId === world.id) }))
    .filter(({ lanes }) => lanes.length > 0);

  return (
    <aside
      aria-label={t('outline.label')}
      className="flex h-full w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-v2-line bg-v2-deep/95 px-3 py-3 font-v2-ui"
    >
      <Part title={t('outline.worlds')} count={worlds.length}>
        <ul className="flex flex-col gap-1.5">
          {worlds.map((world) => <li key={world.id}><WorldRow world={world} onWorld={onWorld} /></li>)}
        </ul>
      </Part>

      <Part title={t('outline.air')} {...(flights.length > 0 ? { count: flights.length } : {})}>
        {flights.length === 0 ? (
          <p className="text-micro leading-snug text-v2-ink-3">{t('outline.airEmpty')}</p>
        ) : (
          <ul className="flex flex-col">
            {flights.map((item) => (
              <FlightRow key={item.key} item={item} now={now} recalling={false} onFocus={onFlight} />
            ))}
          </ul>
        )}
      </Part>

      <Part title={t('outline.queues')}>
        <div className="flex flex-col gap-1.5">
          {research.map((queue) => <LaneRow key="research" queue={queue} now={now} onQueue={onQueue} />)}
          {byWorld.map(({ world, lanes }) => (
            <div key={world.id} className="flex flex-col gap-1.5">
              {several && <h3 className="mt-1 truncate text-micro font-semibold text-v2-ink-2">{world.name}</h3>}
              {lanes.map((queue) => <LaneRow key={queue.lane} queue={queue} now={now} onQueue={onQueue} />)}
            </div>
          ))}
        </div>
      </Part>
    </aside>
  );
}
