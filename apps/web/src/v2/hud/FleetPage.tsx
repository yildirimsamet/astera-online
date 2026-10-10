import { HULLS, fleetEntries, type Fleet } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { ClanSupportWave, Monuments } from '../../api/schemas.js';
import { hullLabel, hullName, monumentName } from '../../i18n/names.js';
import { garrisonOf, legProgress, paceShown, recallPreview, type roomOf } from '../../lib/fleetPage.js';
import { decimal, full } from '../../lib/format.js';
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
  /** Ships held in the Repair Station: owned, neither home nor away. */
  docked: number;
}

export interface FleetPageProps {
  monuments?: { view: Monuments; onFocus: (monumentId: string) => void };
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
  /**
   * THE DOCK COUNT IS A DOOR (2026-09-30): the Repair Station lives in each world's Base,
   * under its Shipyard and Hangar, and this opens the one the ships are held at.
   */
  onOpenRepairStation: (worldId: string) => void;
  /** A world's name in the home and Hangar views frames that world in the galaxy (owner, 2026-10-07). */
  onFocusWorld: (worldId: string) => void;
  /**
   * KLAN SAVUNMA DESTEĞİ: my waves still out, and the one control each may carry —
   * recall (standing) or turn back (in flight). Absent before the feature loads.
   */
  support?: {
    waves: readonly ClanSupportWave[];
    recalling: string | null;
    onRecall: (waveId: string) => void;
  };
  onClose: () => void;
}

/** The act as a picture: the glyph the rest of the game uses for it. */
const MARK: Record<FlightMark, IconId> = {
  monument: 'i-attack',
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
    <div className="rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
      <span className="block truncate text-micro text-v2-ink-3">{label}</span>
      <span className={`mt-0.5 block font-v2-mono text-body font-semibold ${atCap ? 'text-v2-warn' : 'text-v2-ink'}`}>{`${full(used)} / ${full(total)}`}</span>
      <span aria-hidden="true" className="mt-1.5 block h-1 rounded-full bg-v2-line">
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
 * What it is and the time left, one line of detail — the craft, the pace when it
 * is not full speed, the clock it lands at — and a track filled to where it is on
 * this leg. A flight the server says may still turn carries a last line, as the mock
 * draws it: the price of turning in words ("home in 42m"), and the Recall beside it.
 */
export function FlightRow({
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
  /** Absent where the row is a glance (the desk outline): the recall lives on the Fleet page. */
  onRecall?: (item: AirborneItem) => void;
}) {
  const { t } = useTranslation();
  const progress = legProgress(item.span, now);
  const pace = paceShown(item.pace);
  const turnable = onRecall !== undefined && item.leg !== 'return'
    && (item.recallMission !== undefined || item.recall !== undefined);
  const home = item.recallMinutes !== undefined ? { backInMs: item.recallMinutes * 60_000 }
    : item.span ? recallPreview(item.span.from, now) : null;
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
          <span className={`shrink-0 font-v2-mono text-caption font-semibold tabular-nums ${hostile ? 'text-v2-hostile' : 'text-v2-ink'}`}>
            {countdown(item.arrival - now)}
          </span>
        </span>
        <span className="truncate text-micro text-v2-ink-3">{detail}</span>
        <span
          aria-hidden="true"
          data-progress={progress === null ? undefined : String(Math.round(progress * 100) / 100)}
          className={`mt-0.5 block h-[3px] rounded-full ${progress === null ? 'bg-v2-line/60' : 'bg-v2-line'}`}
        >
          {progress !== null && (
            <span
              className={`block h-full rounded-full ${hostile ? 'bg-v2-hostile' : 'bg-v2-self'} ${item.leg === 'return' ? 'ml-auto' : ''}`}
              style={{ width: `${String(Math.round(progress * 100))}%` }}
            />
          )}
        </span>
      </span>
    </>
  );
  const price = home && !recalling ? t('fleetPage.recallHome', { time: countdown(home.backInMs) }) : null;

  return (
    <li data-tone={hostile ? 'hostile' : 'self'} className="border-b border-v2-line/70 py-2.5 last:border-b-0">
      {item.focus ? (
        <button
          type="button"
          aria-label={item.title}
          onClick={() => { onFocus(item); }}
          className="flex w-full min-w-0 items-start gap-2.5 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 items-start gap-2.5">{body}</div>
      )}
      {turnable && (
        <div className="mt-1.5 flex items-center gap-2 pl-[2.625rem]">
          <span className="min-w-0 flex-1 truncate text-micro text-v2-ink-3">{recalling ? t('fleetPage.recalling') : price}</span>
          <button
            type="button"
            aria-label={[t('fleetPage.recall'), recalling ? t('fleetPage.recalling') : price].filter(Boolean).join(' · ')}
            disabled={recalling}
            onClick={() => { onRecall(item); }}
            className="shrink-0 rounded-control border border-v2-line-hi bg-v2-raise px-2.5 py-1 text-micro font-semibold text-v2-ink disabled:opacity-50"
          >
            {t('fleetPage.recall')}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * MY SUPPORT WAVES. Where each stands, what is in it, how long it has — and, beside it,
 * the one way home: Recall once it stands, Turn back while it flies (the K8 price said
 * in words), nothing once it is already coming home.
 */
function SupportGroup({ support, now }: { support: NonNullable<FleetPageProps['support']>; now: number }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('clanSupport.groupTitle')} data-support-group="" className="flex flex-col gap-1.5">
      <p className="px-1 text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('clanSupport.groupTitle')}</p>
      <ul className="flex flex-col gap-1.5">
        {support.waves.map((wave) => {
          const flying = wave.status === 'OUTBOUND';
          const landing = flying && wave.arriveAt.getTime() <= now;
          const status = flying
            ? t('clanSupport.statusOutbound', { world: wave.hostPlanetName })
            : wave.status === 'STATIONED'
              ? t('clanSupport.statusStationed', { world: wave.hostPlanetName })
              : t('clanSupport.statusReturning', { world: wave.hostPlanetName });
          const when = flying
            ? t('clanSupport.arriving', { time: countdown(wave.arriveAt.getTime() - now) })
            : wave.status === 'STATIONED' && wave.expiresAt
              ? t('clanSupport.leftFor', { time: countdown(wave.expiresAt.getTime() - now) })
              : wave.returnAt ? t('now.at', { time: clockTime(wave.returnAt) }) : '';
          const control = wave.status === 'STATIONED' ? t('clanSupport.recall')
            : flying && !landing ? t('clanSupport.recallFlight') : null;
          return (
            <li key={wave.id} data-support-wave={wave.id} className="rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
              <div className="flex items-center gap-2">
                <Icon id="i-transfer" className="size-3.5 shrink-0 text-v2-self" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-caption font-semibold text-v2-ink">{status}</span>
                  <span className="block truncate text-micro text-v2-ink-2">
                    {fleetEntries(wave.fleet).map(([hull, n]) => `${String(n)} ${hullName(hull)}`).join(' · ')}
                    {when && <> · {when}</>}
                  </span>
                </span>
                {control !== null && (
                  <button
                    type="button"
                    disabled={support.recalling === wave.id}
                    onClick={() => { support.onRecall(wave.id); }}
                    className="min-h-8 shrink-0 rounded-control border border-v2-line px-2 text-micro text-v2-ink disabled:opacity-60"
                  >
                    {control}
                  </button>
                )}
              </div>
              {flying && !landing && <p className="mt-1 text-micro text-v2-ink-3">{t('clanSupport.recallFlightRule')}</p>}
              {landing && <p className="mt-1 text-micro text-v2-ink-3">{t('clanSupport.landing')}</p>}
              {wave.outOfBand && <p className="mt-1 text-micro text-v2-warn">{t('clanSupport.outOfBand')}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A WORLD'S NAME, AND THE WAY TO IT. Owner, 2026-10-07: "gezegenlerime tıklayınca tıkladığım
 * gezegene focus olsun." The head of the row is the door — the chevron says so — while the
 * hull chips, the dock count and the room bars keep their own jobs.
 */
function WorldName({ world, onFocus }: { world: FleetWorld; onFocus: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onFocus}
      aria-label={t('fleetPage.focusWorld', { world: world.name })}
      className="flex min-w-0 flex-1 items-center gap-2 text-left"
    >
      <Icon id={world.capital ? 'm-capital' : 'm-colony'} className="size-3.5 shrink-0 text-v2-self" title={t(world.capital ? 'fleetPage.capital' : 'fleetPage.colony')} />
      <span className="min-w-0 truncate text-caption font-semibold text-v2-ink">{world.name}</span>
      <Icon id="i-chev" className="size-3 shrink-0 text-v2-ink-3" />
    </button>
  );
}

/** A world's ships at home, by hull, with its class shape. */
function Garrison({ world, onOpenRepairStation, onFocusWorld }: {
  world: FleetWorld;
  onOpenRepairStation: () => void;
  onFocusWorld: () => void;
}) {
  const { t } = useTranslation();
  const rows = garrisonOf(world.fleet);
  const total = rows.reduce((n, row) => n + row.count, 0);
  return (
    <li className="rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
      <div className="flex items-center gap-2">
        <WorldName world={world} onFocus={onFocusWorld} />
        {total > 0 && <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">{t('fleetPage.shipsHome', { count: total })}</span>}
        {world.away > 0 && <span className="shrink-0 font-v2-mono text-micro text-v2-ink-3">{t('fleetPage.away', { count: world.away })}</span>}
        {/* Why the count is lower than the ships owned: they wait for repair, and one tap opens that station. */}
        {world.docked > 0 && (
          <button
            type="button"
            onClick={onOpenRepairStation}
            className="shrink-0 rounded-chip border border-v2-warn/50 px-1.5 py-0.5 font-v2-mono text-micro text-v2-warn"
          >
            {t('repairStation.docked', { count: world.docked })}
          </button>
        )}
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
function WorldRoom({ world, onFocusWorld }: { world: FleetWorld; onFocusWorld: () => void }) {
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
        <WorldName world={world} onFocus={onFocusWorld} />
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
  onOpenRepairStation,
  onFocusWorld,
  support,
  monuments,
  onClose,
}: FleetPageProps) {
  const { t } = useTranslation();
  return (
    // As tall as what it holds, a page at most (owner, 2026-09-25); a column on a wide screen.
    <Sheet title={t('dock.fleet')} onClose={onClose} detents={['fit']} placement="page">
      <div className="flex flex-col gap-2.5 pt-1">
        <Segmented
          label={t('fleetPage.views')}
          options={[
            { id: 'air', label: flights.length > 0 ? `${t('fleetPage.air')} · ${String(flights.length)}` : t('fleetPage.air') },
            { id: 'home', label: t('fleetPage.home') },
            { id: 'room', label: t('fleetPage.hangar') },
          ]}
          value={tab}
          onChange={onTab}
        />
        {(bays !== null || hangar !== null) && (
          <div className="grid grid-cols-2 gap-2">
            {bays && <Room label={t('fleetPage.bays')} used={bays.used} total={bays.total} />}
            {hangar && <Room label={t('fleetPage.hangar')} used={hangar.used} total={hangar.total} />}
          </div>
        )}
        {tab === 'air' && (flights.length === 0 ? (
          <p className="px-1 py-2 text-caption text-v2-ink-3">{t('fleetPage.emptyAir')}</p>
        ) : (
          <ul className="flex flex-col">
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
        {tab === 'air' && support && support.waves.length > 0 && <SupportGroup support={support} now={now} />}
        {tab === 'air' && monuments && monuments.view.waves.some((wave) => wave.status === 'HOLD') && (
          <section data-testid="monument-hold-group" className="flex flex-col gap-1.5 border-t border-v2-line pt-2">
            <h3 className="text-caption font-semibold text-v2-ink">{t('monument.yourWaves')} · {t('monument.status.HOLD')}</h3>
            {monuments.view.waves.filter((wave) => wave.status === 'HOLD').map((wave) => <button key={wave.id} type="button"
              onClick={() => { monuments.onFocus(wave.monumentId); }} className="rounded-control border border-v2-line bg-v2-panel p-2.5 text-left">
              <span className="block text-caption font-semibold text-v2-self">{monumentName(monuments.view.monuments.find((row) => row.id === wave.monumentId)?.ordinal)} · {full(fleetEntries(wave.fleet).reduce((sum, [, count]) => sum + count, 0))}</span>
              <span className="block text-micro text-v2-deut">{t('monument.cargo', { amount: decimal(wave.deuterium), capacity: decimal(wave.lots.reduce((sum, lot) => sum + lot.cargoCapacity, 0)) })}</span>
              <span className="block text-micro text-v2-ink-2">{t('monument.ownRate', { rate: decimal(wave.productionPerMinute) })}</span>
              {wave.nextLossAt && <span className="block text-micro text-v2-hostile">{t('monument.lossAt', { time: countdown(wave.nextLossAt.getTime() - now) })}</span>}
            </button>)}
          </section>
        )}
        {tab === 'home' && (
          <ul className="flex flex-col gap-1.5">
            {worlds.map((world) => (
              <Garrison
                key={world.id}
                world={world}
                onOpenRepairStation={() => { onOpenRepairStation(world.id); }}
                onFocusWorld={() => { onFocusWorld(world.id); }}
              />
            ))}
          </ul>
        )}
        {tab === 'room' && (
          <>
            <p className="px-1 text-micro leading-snug text-v2-ink-3">{t('fleetPage.roomRule')}</p>
            <ul className="flex flex-col gap-1.5">
              {worlds.map((world) => (
                <WorldRoom key={world.id} world={world} onFocusWorld={() => { onFocusWorld(world.id); }} />
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
