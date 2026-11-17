import { HULLS, fleetEntries, type Fleet, type HpDamageLots } from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClanSupportWave, Monuments } from '../../api/schemas.js';
import {
  Chip, DOCK_ART, Emblem, GameButton, GameHold, GameTabs, Glyph, InfoPeek, ProgressBar, SectionTag, TimerRow, artIconSrc,
} from '../../game-ui/index.js';
import { hullLabel, hullName, monumentName } from '../../i18n/names.js';
import type { AirborneItem } from '../../lib/airborne.js';
import { supportVerdict } from '../../lib/clanAlarm.js';
import { garrisonOf, paceShown, recallPreview, type roomOf } from '../../lib/fleetPage.js';
import { decimal, full } from '../../lib/format.js';
import { haptic } from '../../lib/haptics.js';
import { homeMaintenanceRows, maintenanceChoice } from '../../lib/maintenanceInventory.js';
import { OWN_SOUND, playSound } from '../../lib/sound.js';
import { clockTime, countdown, durationPrecise } from '../../lib/time.js';
import { ATMOSPHERE } from '../../ui/atmosphere.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
import { ShipHealthInventory } from '../../ui/ShipHealthInventory.js';
import { Sheet } from '../kit/Sheet.js';
import { FLIGHT_MARK } from './Outline.js';

export type FleetTab = 'air' | 'home' | 'room';

export interface FleetWorld {
  id: string;
  name: string;
  capital: boolean;
  /** The world the top bar is reading. */
  active: boolean;
  /** Ships standing at home. */
  fleet: Fleet;
  damage?: HpDamageLots;
  workshopRadiation?: boolean;
  /** How many of its craft are off the world. */
  away: number;
  room: ReturnType<typeof roomOf>;
  /** Ships held in the Repair Station: owned, neither home nor away. */
  docked: number;
}

export interface FleetPageProps {
  /** On a colony ship the galaxy holds ships and outposts, and the empty line says so. */
  aboard?: boolean;
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
  /** The row whose recall is on its way, so it says so instead of offering it again. */
  recalling: string | null;
  onFocus: (item: AirborneItem) => void;
  onRecall: (item: AirborneItem) => void;
  /**
   * THE DOCK COUNT IS A DOOR (2026-09-30): the Repair Station lives in each world's Base,
   * under its Shipyard and Hangar, and this opens the one the ships are held at.
   */
  onOpenRepairStation: (worldId: string) => void;
  onDock?: (worldId: string, groups: HpDamageLots, onSuccess: () => void) => void;
  docking?: boolean;
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

/** A kit press: the tap, the buzz, then the place it opens. */
function usePress(onPress: () => void) {
  return useOwnPress(() => { playSound('tap'); haptic('tap'); onPress(); });
}

/**
 * ONE OF THE PAGE'S TWO READINGS (G2-h2): how full the world on top is, and in words what is
 * left — "free 2" says a launch is possible without counting. Bays are few, so each is a cell.
 */
function Gauge({ kind, label, used, total }: { kind: 'bays' | 'hangar'; label: string; used: number; total: number }) {
  const { t } = useTranslation();
  const atCap = used >= total;
  return (
    <div data-fleet-gauge={kind} {...(atCap ? { 'data-full': '' } : {})} className="gk-fgauge gk-well">
      <span className="gk-label">{label}</span>
      <p className="gk-fgauge__read">
        <span className="gk-fgauge__figure gk-num">{`${full(used)} / ${full(total)}`}</span>
        <span className="gk-fgauge__left gk-num">{atCap ? t('fleetPage.full') : t('roomBar.free', { value: full(total - used) })}</span>
      </p>
      <ProgressBar value={used} max={total} tone={atCap ? 'warn' : 'self'} {...(kind === 'bays' && total <= 12 ? { segments: total } : {})} />
    </div>
  );
}

/**
 * ONE FLIGHT, ONE ROW (G2-h2): the timers sheet's ring row — its mark in a ring that empties,
 * red when it comes for you — and a tap frames the craft. A flight the server says may still
 * turn carries a short steel hold under it with the way home written on it ("Home in 42m"): a
 * recall is not free (K8), and a stray tap on a crowded list must never cancel a raid.
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
  /** Absent where the row is a glance: the recall lives on the Fleet page. */
  onRecall?: (item: AirborneItem) => void;
}) {
  const { t } = useTranslation();
  const pace = paceShown(item.pace);
  const turnable = onRecall !== undefined && item.leg !== 'return'
    && (item.recallMission !== undefined || item.recall !== undefined);
  const home = item.recallMinutes !== undefined ? { backInMs: item.recallMinutes * 60_000 }
    : item.span ? recallPreview(item.span.from, now) : null;
  const detail = [item.detail, ...(pace === null ? [] : [t('fleetPage.pace', { pct: pace })])].filter(Boolean).join(' · ');
  return (
    <li data-tone={item.incoming ? 'hostile' : 'self'} className="gk-flight">
      <TimerRow
        tone={item.incoming ? 'hostile' : 'self'}
        glyph={item.leg === 'return' ? 'recall' : FLIGHT_MARK[item.mark]}
        remaining={Math.max(0, item.arrival - now)}
        total={item.span ? item.span.to - item.span.from : 0}
        title={item.title}
        {...(detail === '' ? {} : { detail })}
        time={countdown(item.arrival - now)}
        at={t('now.at', { time: clockTime(new Date(item.arrival)) })}
        {...(item.focus ? { onPress: () => { onFocus(item); } } : {})}
      />
      {turnable && (recalling ? (
        <p role="status" className="gk-flight__more gk-flight__turning">{t('fleetPage.recalling')}</p>
      ) : (
        <div className="gk-flight__more">
          <GameHold weight="reversible" size="md" tone="steel" glyph="recall"
            label={t('fleetPage.recall')}
            {...(home ? { detail: t('fleetPage.recallHome', { time: countdown(home.backInMs) }) } : {})}
            onCommit={() => { onRecall(item); }} />
        </div>
      ))}
    </li>
  );
}

/** Where a support wave's clock runs to, and what that clock means beside it. */
function waveClock(wave: ClanSupportWave, now: number, left: string): {
  remaining: number; total: number; time?: string; at?: string;
} {
  const at = (date: Date) => clockTime(date);
  if (wave.status === 'OUTBOUND') {
    const arrive = wave.arriveAt.getTime();
    return { remaining: Math.max(0, arrive - now), total: arrive - wave.sentAt.getTime(), time: countdown(arrive - now), at: at(wave.arriveAt) };
  }
  if (wave.status === 'STATIONED' && wave.expiresAt) {
    const ends = wave.expiresAt.getTime();
    return { remaining: Math.max(0, ends - now), total: ends - (wave.stationedAt ?? wave.arriveAt).getTime(), time: countdown(ends - now), at: left };
  }
  if (wave.returnAt) return { remaining: Math.max(0, wave.returnAt.getTime() - now), total: 0, time: countdown(wave.returnAt.getTime() - now), at: at(wave.returnAt) };
  return { remaining: 0, total: 0 };
}

/**
 * MY SUPPORT WAVES. Where each stands, what is in it, how long it has — and, under it, the one
 * way home as the flights take it: a short hold to recall it once it stands, to turn it back
 * while it flies (the K8 price said in words), nothing once it is already coming home.
 */
function SupportGroup({ support, now }: { support: NonNullable<FleetPageProps['support']>; now: number }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('clanSupport.groupTitle')} data-support-group="" className="gk-fleet__group">
      <SectionTag aside={<span className="gk-num">{support.waves.length}</span>}>{t('clanSupport.groupTitle')}</SectionTag>
      <ul className="gk-tlist">
        {support.waves.map((wave) => {
          const flying = wave.status === 'OUTBOUND';
          const landing = flying && wave.arriveAt.getTime() <= now;
          const status = flying
            ? t('clanSupport.statusOutbound', { world: wave.hostPlanetName })
            : wave.status === 'STATIONED'
              ? t('clanSupport.statusStationed', { world: wave.hostPlanetName })
              : t('clanSupport.statusReturning', { world: wave.hostPlanetName });
          const clock = waveClock(wave, now, t('clanSupport.timeLeft'));
          const control = wave.status === 'STATIONED' ? t('clanSupport.recall')
            : flying && !landing ? t('clanSupport.recallFlight') : null;
          // F2 corridor: a raid the clan was alarmed about, still ahead, on the world this wave guards.
          const raidAt = wave.raidAt && wave.raidAt.getTime() > now ? wave.raidAt : null;
          const race = raidAt && flying && !landing ? supportVerdict(wave.arriveAt, raidAt) : null;
          return (
            <li key={wave.id} data-support-wave={wave.id} className="gk-flight">
              <TimerRow
                tone="self"
                glyph="support"
                remaining={clock.remaining}
                total={clock.total}
                title={status}
                detail={fleetEntries(wave.fleet).map(([hull, n]) => `${String(n)} ${hullName(hull)}`).join(' · ')}
                {...(landing ? { waiting: t('clanSupport.landing') } : {
                  ...(clock.time === undefined ? {} : { time: clock.time }),
                  ...(clock.at === undefined ? {} : { at: clock.at }),
                })}
              />
              {race && raidAt && (
                <p data-raid-race={race.inTime ? 'in-time' : 'late'} className="gk-flight__more gk-flight__race">
                  <span className="gk-num">{t('clanSupport.corridorTimes', { arrive: clockTime(wave.arriveAt), raid: clockTime(raidAt) })}</span>
                  <span data-tone={race.inTime ? 'good' : 'warn'} className="gk-flight__verdict">
                    {t(race.inTime ? 'clanSupport.alarmInTime' : 'clanSupport.alarmLate', { time: durationPrecise(race.minutes) })}
                  </span>
                </p>
              )}
              {raidAt && wave.status === 'STATIONED' && (
                <p data-raid-race="standing" data-tone="hostile" className="gk-flight__more gk-flight__note">
                  <Glyph id="siren" />{t('clanSupport.alarmRaidIn', { time: countdown(raidAt.getTime() - now) })}
                </p>
              )}
              {wave.outOfBand && <p data-tone="warn" className="gk-flight__more gk-flight__note">{t('clanSupport.outOfBand')}</p>}
              {flying && !landing && <p className="gk-flight__more gk-flight__note">{t('clanSupport.recallFlightRule')}</p>}
              {control !== null && (support.recalling === wave.id ? (
                <p role="status" className="gk-flight__more gk-flight__turning">{t('fleetPage.recalling')}</p>
              ) : (
                <div className="gk-flight__more">
                  <GameHold weight="reversible" size="md" tone="steel" glyph="recall"
                    label={control} onCommit={() => { support.onRecall(wave.id); }} />
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A monument wave holding its post: what it carries and makes, and when it next loses a ship. */
function MonumentHold({ title, count, cargo, rate, loss, onPress }: {
  title: string;
  count: string;
  cargo: string;
  rate: string;
  loss: string | null;
  onPress: () => void;
}) {
  const own = usePress(onPress);
  return (
    <button type="button" {...OWN_SOUND} className="gk-mhold" onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-mhold__coin" aria-hidden="true"><Glyph id="star" /></span>
      <span className="gk-mhold__text">
        <span className="gk-mhold__title">{title} · <span className="gk-num">{count}</span></span>
        <span data-tone="deut" className="gk-sub">{cargo}</span>
        <span className="gk-sub">{rate}</span>
        {loss !== null && <span data-tone="hostile" className="gk-sub">{loss}</span>}
      </span>
      <Glyph id="next" />
    </button>
  );
}

/**
 * A WORLD'S NAME, AND THE WAY TO IT. Owner, 2026-10-07: "gezegenlerime tıklayınca tıkladığım
 * gezegene focus olsun." The head of the card is the door — a thumb's 44 px, the chevron says
 * so — while the hull chips, the dock count and the room bars keep their own jobs.
 */
function WorldDoor({ world, onFocus }: { world: FleetWorld; onFocus: () => void }) {
  const { t } = useTranslation();
  const own = usePress(onFocus);
  return (
    <button type="button" {...OWN_SOUND} aria-label={t('fleetPage.focusWorld', { world: world.name })} className="gk-world__door"
      onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-world__coin" aria-hidden="true"><Glyph id={world.capital ? 'home' : 'colony'} /></span>
      <span className="gk-world__name">{world.name}</span>
      <span className="gk-world__kind">{t(world.capital ? 'fleetPage.capital' : 'fleetPage.colony')}</span>
      <Glyph id="next" />
    </button>
  );
}

/** A world's ships at home, by hull under its class emblem, and the hurt ones' way to the station. */
function Garrison({ world, aboard, onOpenRepairStation, onFocusWorld, onDock, docking }: {
  world: FleetWorld;
  aboard: boolean;
  onOpenRepairStation: () => void;
  onFocusWorld: () => void;
  onDock?: (worldId: string, groups: HpDamageLots, onSuccess: () => void) => void;
  docking?: boolean;
}) {
  const { t } = useTranslation();
  const rows = garrisonOf(world.fleet);
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({});
  const damaged = homeMaintenanceRows(world.fleet, world.damage).filter((row) => row.damageBp > 0 || (row.remainderBp ?? 0) > 0);
  const choice = maintenanceChoice(damaged, quantities, 100);
  const total = rows.reduce((n, row) => n + row.count, 0);
  const radiation = world.workshopRadiation === true;
  const moveReason = radiation ? t('repairStation.maintenance.radiationShort')
    : choice.tooMany ? t('repairStation.tooManyShort')
      : choice.selection === null ? t('repairStation.maintenance.select') : null;
  return (
    <li className="gk-world gk-well">
      {/* Aboard with ships hurt, the ship's own row leads to the station it was pressed to find (player test F-01). */}
      <WorldDoor world={world} onFocus={aboard && damaged.length > 0 ? onOpenRepairStation : onFocusWorld} />
      <div className="gk-world__counts">
        {total > 0 && <span className="gk-num">{t('fleetPage.shipsHome', { count: total })}</span>}
        {world.away > 0 && <span className="gk-num" data-tone="away">{t('fleetPage.away', { count: world.away })}</span>}
        {/* Why the count is lower than the ships owned: they wait for repair, and one tap opens that station. */}
        {world.docked > 0 && (
          <Chip onPress={onOpenRepairStation}><Glyph id="repair" />{t('repairStation.docked', { count: world.docked })}</Chip>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="gk-sub">{t('fleetPage.noShips')}</p>
      ) : (
        <p className="gk-garrison">
          {rows.map(({ hull, count }) => (
            <span key={hull} data-testid="garrison-hull" className="gk-garrison__hull">
              <Emblem cls={HULLS[hull].cls} />
              <span>{hullLabel(hull)}</span>
              <span className="gk-num">{count}</span>
            </span>
          ))}
        </p>
      )}
      {/* A ship's station takes everything hurt at home, so there is nothing to choose and nothing to transfer. */}
      {damaged.length > 0 && aboard && (
        <section className="gk-world__hurt">
          <p className="gk-world__hurt-head"><Glyph id="damaged" />{t('repairStation.damagedHeading')}</p>
          <GameButton tone="self" wide glyph="repair" onPress={onOpenRepairStation}>{t('starter.fleetPage.openStation')}</GameButton>
        </section>
      )}
      {damaged.length > 0 && !aboard && (
        <section className="gk-world__hurt">
          <p className="gk-world__hurt-head"><Glyph id="damaged" />{t('repairStation.damagedHeading')}</p>
          {radiation && <p data-tone="warn" className="gk-sub">{t('repairStation.maintenance.radiation')}</p>}
          <ShipHealthInventory rows={damaged} quantities={quantities} disabled={docking === true || radiation}
            onQuantity={(key, count) => { setQuantities((current) => ({ ...current, [key]: count })); }} />
          {choice.stale && (
            <p role="status" data-tone="warn" className="gk-world__stale gk-sub">
              {t('repairStation.maintenance.stale')}
              <Chip onPress={() => { setQuantities({}); }}>{t('repairStation.maintenance.clear')}</Chip>
            </p>
          )}
          {onDock && (
            <GameButton tone="self" wide glyph="repair" disabledReason={moveReason} pending={docking === true}
              onPress={() => {
                if (choice.selection?.source === 'HOME') onDock(world.id, choice.selection.groups, () => { setQuantities({}); });
              }}>
              {t('repairStation.maintenance.move')}
            </GameButton>
          )}
        </section>
      )}
    </li>
  );
}

/** A world's Hangar and ground room, each on a kit bar that warms when full. */
function WorldRoom({ world, onFocusWorld }: { world: FleetWorld; onFocusWorld: () => void }) {
  const { t } = useTranslation();
  const line = (kind: 'hangar' | 'ground', label: string, room: { used: number; total: number; full: boolean }, note?: string) => (
    <div data-room={kind} {...(room.full ? { 'data-full': '' } : {})} className="gk-wroom">
      <p className="gk-wroom__head">
        <span className="gk-label">{label}</span>
        {room.full && <span className="gk-wroom__full">{t('fleetPage.full')}</span>}
        <span className="gk-wroom__figure gk-num">{`${full(room.used)} / ${full(room.total)}`}</span>
      </p>
      <ProgressBar value={room.used} max={room.total} tone={room.full ? 'warn' : 'self'} />
      {note && <p className="gk-sub">{note}</p>}
    </div>
  );
  return (
    <li className="gk-world gk-well">
      <WorldDoor world={world} onFocus={onFocusWorld} />
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
 * THE FLEET PAGE. Spec E4 (docs/ui-v2/gozlemevi.md), on the game kit since G2-h2 (2026-11-15).
 *
 * The dock's Fleet tab. Its head names the world the gauges read and turns red while an
 * attack comes; the flight bays and the Hangar room decide whether the next launch or the
 * next hull is possible at all; the three views under them are what is up, what is home, and
 * how much room is left.
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
  onDock,
  docking,
  onFocusWorld,
  support,
  monuments,
  onClose,
  aboard = false,
}: FleetPageProps) {
  const { t } = useTranslation();
  const active = worlds.find((world) => world.active);
  const threats = flights.filter((item) => item.incoming).length;
  const holding = monuments ? monuments.view.waves.filter((wave) => wave.status === 'HOLD') : [];
  return (
    // As tall as what it holds, a page at most (owner, 2026-09-25); a column on a wide screen.
    <Sheet
      title={t('dock.fleet')}
      headerArt={ATMOSPHERE.fleet}
      onClose={onClose}
      detents={['fit']}
      placement="page"
      kit={{
        art: artIconSrc(DOCK_ART.fleet),
        tone: threats > 0 ? 'hostile' : 'self',
        // The world the gauges read; an attack coming said in words, since the art hides the plate's tone.
        meta: (
          <span className="gk-fleet__meta">
            {active && <span className="gk-fleet__where"><Glyph id={active.capital ? 'home' : 'colony'} />{active.name}</span>}
            {threats > 0 && <span data-tone="hostile" className="gk-fleet__threat"><Glyph id="siren" />{t('outline.threat', { count: threats })}</span>}
          </span>
        ),
      }}
    >
      <div className="gk-fleet">
        <GameTabs
          stacked
          label={t('fleetPage.views')}
          tabs={[
            { id: 'air', label: flights.length > 0 ? `${t('fleetPage.air')} · ${String(flights.length)}` : t('fleetPage.air'), glyph: { id: 'rocket' } },
            { id: 'home', label: t('fleetPage.home'), glyph: { id: 'home' } },
            { id: 'room', label: t('fleetPage.hangar'), glyph: { id: 'bay' } },
          ]}
          value={tab}
          onChange={onTab}
        />
        {(bays !== null || hangar !== null) && (
          <div className="gk-fleet__gauges">
            {/* Aboard only attacks and outpost raids take a bay; a probe or a Prospector does not (player test B-01). */}
            {bays && <Gauge kind="bays" label={t(aboard ? 'starter.fleetPage.bays' : 'fleetPage.bays')} used={bays.used} total={bays.total} />}
            {hangar && <Gauge kind="hangar" label={t('fleetPage.hangar')} used={hangar.used} total={hangar.total} />}
          </div>
        )}
        {tab === 'air' && (flights.length === 0 ? (
          <p className="gk-fleet__empty gk-well"><Glyph id="rocket" /><span>{t(aboard ? 'starter.fleetPage.emptyAir' : 'fleetPage.emptyAir')}</span></p>
        ) : (
          <ul className="gk-tlist">
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
        {tab === 'air' && monuments && holding.length > 0 && (
          <section data-testid="monument-hold-group" className="gk-fleet__group">
            <SectionTag aside={<span className="gk-num">{holding.length}</span>}>{`${t('monument.yourWaves')} · ${t('monument.status.HOLD')}`}</SectionTag>
            {holding.map((wave) => (
              <MonumentHold
                key={wave.id}
                title={monumentName(monuments.view.monuments.find((row) => row.id === wave.monumentId)?.ordinal)}
                count={full(fleetEntries(wave.fleet).reduce((sum, [, count]) => sum + count, 0))}
                cargo={t('monument.cargo', { amount: decimal(wave.deuterium), capacity: decimal(wave.lots.reduce((sum, lot) => sum + lot.cargoCapacity, 0)) })}
                rate={t('monument.ownRate', { rate: decimal(wave.productionPerMinute) })}
                loss={wave.nextLossAt ? t('monument.lossAt', { time: countdown(wave.nextLossAt.getTime() - now) }) : null}
                onPress={() => { monuments.onFocus(wave.monumentId); }}
              />
            ))}
          </section>
        )}
        {tab === 'home' && (
          <ul className="gk-fleet__worlds">
            {worlds.map((world) => (
              <Garrison
                key={world.id}
                world={world}
                aboard={aboard}
                {...(onDock ? { onDock } : {})}
                {...(docking === undefined ? {} : { docking })}
                onOpenRepairStation={() => { onOpenRepairStation(world.id); }}
                onFocusWorld={() => { onFocusWorld(world.id); }}
              />
            ))}
          </ul>
        )}
        {tab === 'room' && (
          <>
            <InfoPeek fact={<span className="gk-sub">{t('fleetPage.roomFact')}</span>}
              rule={<p className="gk-sub">{t(aboard ? 'starter.fleetPage.roomRule' : 'fleetPage.roomRule')}</p>} />
            <ul className="gk-fleet__worlds">
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
