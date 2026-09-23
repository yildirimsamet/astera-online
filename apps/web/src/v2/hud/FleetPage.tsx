import { HULLS, type Fleet } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { hullLabel } from '../../i18n/names.js';
import { garrisonOf, legProgress, paceShown, recallPreview, type roomOf } from '../../lib/fleetPage.js';
import { full } from '../../lib/format.js';
import { clockTime, countdown } from '../../lib/time.js';
import type { AirborneItem, FlightMark } from '../../shell/PendingStrip.js';
import { Icon, type IconId } from '../icons.js';
import { ClassEmblem } from '../kit/ClassEmblem.js';
import { Segmented } from '../kit/Segmented.js';
import { Sheet } from '../kit/Sheet.js';

export type FleetTab = 'air' | 'home' | 'room';

export interface FleetWorld {
  id: string;
  name: string;
  capital: boolean;
  /** The world the top bar is reading. */
  active: boolean;
  /** Ships standing at home. */
  fleet: Fleet;
  /** How many of its craft are off the world. */
  away: number;
  room: ReturnType<typeof roomOf>;
}

export interface FleetPageProps {
  tab: FleetTab;
  onTab: (tab: FleetTab) => void;
  /** Server time, ticking. */
  now: number;
  /** The active world's flight bays and Hangar room; null before it has loaded. */
  bays: { used: number; total: number } | null;
  hangar: { used: number; total: number } | null;
  /** `useAirborne().items`: yours and the enemy coming for you, soonest first. */
  flights: readonly AirborneItem[];
  worlds: readonly FleetWorld[];
  /** The row whose recall is on its way, so its button holds. */
  recalling: string | null;
  onFocus: (item: AirborneItem) => void;
  onRecall: (item: AirborneItem) => void;
  onClose: () => void;
}

/** The act as a picture: the glyph the rest of the game uses for it. */
const MARK: Record<FlightMark, IconId> = {
  fleet: 'i-attack',
  probe: 'i-probe',
  incoming: 'i-attack',
  transfer: 'i-transfer',
  settlement: 'm-colony',
  death_star: 'i-attack',
  mining: 'i-mine',
  salvage: 'm-debris',
  pirate: 'm-pirate',
  trade: 'i-trade',
  intergalactic_convoy: 'i-attack',
};

/** A figure and its fill: the header's two readings. */
function Room({ label, used, total }: { label: string; used: number; total: number }) {
  const atCap = used >= total;
  return (
    <div className="rounded-control border border-v2-line bg-v2-panel px-2.5 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-micro uppercase tracking-wide text-v2-ink-3">{label}</span>
        <span className={`font-v2-mono text-caption ${atCap ? 'text-v2-warn' : 'text-v2-ink'}`}>{`${full(used)}/${full(total)}`}</span>
      </div>
      <span aria-hidden="true" className="mt-1 block h-0.5 rounded-full bg-v2-line">
        <span
          className={`block h-full rounded-full ${atCap ? 'bg-v2-warn' : 'bg-v2-self'}`}
          style={{ width: `${String(total > 0 ? Math.min(100, (used / total) * 100) : 0)}%` }}
        />
      </span>
    </div>
  );
}

/**
 * ONE FLIGHT, ONE ROW. Spec B11.
 *
 * What it is, the time left, a track filled to where it is on this leg, and one
 * line of detail: the craft, the pace when it is not full speed, the clock it lands
 * at. A flight the server says may still turn carries the recall at its right edge
 * with the price written under it — the way home, as long as the way out so far.
 */
function FlightRow({
  item,
  now,
  recalling,
  onFocus,
  onRecall,
}: {
  item: AirborneItem;
  now: number;
  recalling: boolean;
  onFocus: (item: AirborneItem) => void;
  onRecall: (item: AirborneItem) => void;
}) {
  const { t } = useTranslation();
  const progress = legProgress(item.span, now);
  const pace = paceShown(item.pace);
  const turnable = item.leg !== 'return' && (item.recallMission !== undefined || item.recall !== undefined);
  const home = item.span ? recallPreview(item.span.from, now) : null;
  const hostile = item.incoming;
  const detail = [
    item.detail,
    ...(pace === null ? [] : [t('fleetPage.pace', { pct: pace })]),
    t('now.at', { time: clockTime(new Date(item.arrival)) }),
  ].join(' · ');

  const body = (
    <>
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-control border ${
          hostile ? 'border-v2-hostile/50 bg-v2-hostile/15 text-v2-hostile' : 'border-v2-line bg-v2-raise text-v2-ink-2'
        }`}
      >
        <Icon id={MARK[item.mark]} className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-caption font-semibold text-v2-ink">{item.title}</span>
          <span className={`shrink-0 font-v2-mono text-caption tabular-nums ${hostile ? 'text-v2-hostile' : 'text-v2-self'}`}>
            {countdown(item.arrival - now)}
          </span>
        </span>
        <span
          aria-hidden="true"
          data-progress={progress === null ? undefined : String(Math.round(progress * 100) / 100)}
          className={`block h-0.5 rounded-full ${progress === null ? 'bg-v2-line/60' : 'bg-v2-line'}`}
        >
          {progress !== null && (
            <span
              className={`block h-full rounded-full ${hostile ? 'bg-v2-hostile' : 'bg-v2-self'} ${item.leg === 'return' ? 'ml-auto' : ''}`}
              style={{ width: `${String(Math.round(progress * 100))}%` }}
            />
          )}
        </span>
        <span className="truncate text-micro text-v2-ink-3">{detail}</span>
      </span>
    </>
  );

  return (
    <li
      data-tone={hostile ? 'hostile' : 'self'}
      className="flex items-stretch overflow-hidden rounded-control border border-v2-line bg-v2-panel"
    >
      {item.focus ? (
        <button
          type="button"
          aria-label={item.title}
          onClick={() => { onFocus(item); }}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2">{body}</div>
      )}
      {turnable && (
        <button
          type="button"
          aria-label={[
            t('fleetPage.recall'),
            recalling ? t('fleetPage.recalling') : home ? t('fleetPage.recallHome', { time: countdown(home.backInMs) }) : null,
          ].filter(Boolean).join(' · ')}
          disabled={recalling}
          onClick={() => { onRecall(item); }}
          className="flex w-24 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-v2-line px-1.5 text-v2-warn disabled:opacity-50"
        >
          <Icon id="m-recover" className="size-3.5" />
          <span className="text-micro font-semibold">{recalling ? t('fleetPage.recalling') : t('fleetPage.recall')}</span>
          {home && !recalling && (
            <span className="whitespace-nowrap font-v2-mono text-micro text-v2-ink-3">{t('fleetPage.recallHome', { time: countdown(home.backInMs) })}</span>
          )}
        </button>
      )}
    </li>
  );
}

/** A world's ships at home, by hull, with its class shape. */
function Garrison({ world }: { world: FleetWorld }) {
  const { t } = useTranslation();
  const rows = garrisonOf(world.fleet);
  const total = rows.reduce((n, row) => n + row.count, 0);
  return (
    <li className="rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Icon id={world.capital ? 'm-capital' : 'm-colony'} className="size-3.5 shrink-0 text-v2-self" title={t(world.capital ? 'fleetPage.capital' : 'fleetPage.colony')} />
        <span className="min-w-0 flex-1 truncate text-caption font-semibold text-v2-ink">{world.name}</span>
        {total > 0 && <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">{t('fleetPage.shipsHome', { count: total })}</span>}
        {world.away > 0 && <span className="shrink-0 font-v2-mono text-micro text-v2-ink-3">{t('fleetPage.away', { count: world.away })}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="mt-1 text-micro text-v2-ink-3">{t('fleetPage.noShips')}</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {rows.map(({ hull, count }) => (
            <span
              key={hull}
              data-testid="garrison-hull"
              className="flex items-center gap-1 rounded-chip border border-v2-line bg-v2-raise px-1.5 py-0.5 text-micro text-v2-ink-2"
            >
              <ClassEmblem cls={HULLS[hull].cls} className="size-2.5" decorative />
              <span>{hullLabel(hull)}</span>
              <span className="font-v2-mono text-v2-ink">{count}</span>
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

/** A world's Hangar and ground room, each with its fill, warn when full. */
function WorldRoom({ world }: { world: FleetWorld }) {
  const { t } = useTranslation();
  const line = (kind: 'hangar' | 'ground', label: string, room: { used: number; total: number; full: boolean }, note?: string) => (
    <div data-room={kind} {...(room.full ? { 'data-full': '' } : {})} className="grid gap-1">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-micro text-v2-ink-2">{label}</span>
        {room.full && <span className="shrink-0 text-micro font-semibold uppercase text-v2-warn">{t('fleetPage.full')}</span>}
        <span className={`shrink-0 font-v2-mono text-caption ${room.full ? 'text-v2-warn' : 'text-v2-ink'}`}>
          {`${full(room.used)}/${full(room.total)}`}
        </span>
      </div>
      <span aria-hidden="true" className="block h-0.5 rounded-full bg-v2-line">
        <span
          className={`block h-full rounded-full ${room.full ? 'bg-v2-warn' : 'bg-v2-self'}`}
          style={{ width: `${String(room.total > 0 ? Math.min(100, (room.used / room.total) * 100) : 0)}%` }}
        />
      </span>
      {note && <span className="text-micro text-v2-ink-3">{note}</span>}
    </div>
  );
  return (
    <li className="grid gap-2 rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Icon id={world.capital ? 'm-capital' : 'm-colony'} className="size-3.5 shrink-0 text-v2-self" title={t(world.capital ? 'fleetPage.capital' : 'fleetPage.colony')} />
        <span className="min-w-0 flex-1 truncate text-caption font-semibold text-v2-ink">{world.name}</span>
      </div>
      {world.room.hangar && line(
        'hangar',
        t('fleetPage.hangar'),
        world.room.hangar,
        world.room.hangar.ceiling !== null && world.room.hangar.ceiling > world.room.hangar.total
          ? t('fleetPage.ceiling', { count: world.room.hangar.ceiling, shown: full(world.room.hangar.ceiling) })
          : undefined,
      )}
      {world.room.ground && line('ground', t('fleetPage.ground'), world.room.ground)}
    </li>
  );
}

/**
 * THE FLEET PAGE. Spec E4 (docs/ui-v2/gozlemevi.md).
 *
 * The dock's Fleet tab. The flight bays and the Hangar room head it because they
 * decide whether the next launch or the next hull is possible at all; the three
 * views under them are what is up, what is home, and how much room is left.
 */
export function FleetPage({
  tab,
  onTab,
  now,
  bays,
  hangar,
  flights,
  worlds,
  recalling,
  onFocus,
  onRecall,
  onClose,
}: FleetPageProps) {
  const { t } = useTranslation();
  return (
    <Sheet title={t('dock.fleet')} onClose={onClose}>
      <div className="flex flex-col gap-2.5 pt-1">
        {(bays !== null || hangar !== null) && (
          <div className="grid grid-cols-2 gap-2">
            {bays && <Room label={t('fleetPage.bays')} used={bays.used} total={bays.total} />}
            {hangar && <Room label={t('fleetPage.hangar')} used={hangar.used} total={hangar.total} />}
          </div>
        )}
        <Segmented
          label={t('fleetPage.views')}
          options={[
            { id: 'air', label: t('fleetPage.air') },
            { id: 'home', label: t('fleetPage.home') },
            { id: 'room', label: t('fleetPage.hangar') },
          ]}
          value={tab}
          onChange={onTab}
        />
        {tab === 'air' && (flights.length === 0 ? (
          <p className="px-1 py-2 text-caption text-v2-ink-3">{t('fleetPage.emptyAir')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {flights.map((item) => (
              <FlightRow
                key={item.key}
                item={item}
                now={now}
                recalling={recalling === item.key}
                onFocus={onFocus}
                onRecall={onRecall}
              />
            ))}
          </ul>
        ))}
        {tab === 'home' && (
          <ul className="flex flex-col gap-1.5">
            {worlds.map((world) => <Garrison key={world.id} world={world} />)}
          </ul>
        )}
        {tab === 'room' && (
          <>
            <p className="px-1 text-micro leading-snug text-v2-ink-3">{t('fleetPage.roomRule')}</p>
            <ul className="flex flex-col gap-1.5">
              {worlds.map((world) => <WorldRoom key={world.id} world={world} />)}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
