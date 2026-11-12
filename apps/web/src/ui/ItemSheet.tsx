import { useState } from 'react';
import {
  BUILD,
  INSTRUMENT_MAX_LEVEL,
  buildingCost,
  instrumentCost,
  productionMult,
  plantCeiling,
  RESEARCH_MAX_LEVEL,
  satelliteCost,
  satelliteSlots,
  type BuildingId,
  type InstrumentId,
  type SatelliteId,
  type BuildingLevels,
} from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { PlanetView } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import {
  buildingDetail,
  buildingTag,
  instrumentDetail,
  instrumentTag,
  satelliteDetail,
  satelliteTag,
} from '../i18n/names.js';
import { affordWait } from '../lib/afford.js';
import { buildingGain, instrumentGain, productionPaceOf, satelliteGain, type Gain } from '../lib/gains.js';
import { orderMinutes } from '../lib/orderTime.js';
import { projectedQueueState } from '../lib/predict.js';
import { duration } from '../lib/time.js';
import { NeedBar } from '../v2/kit/NeedBar.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { useOrderDuration } from './Action.js';
import { CostLine, GameButton, Glyph, SectionTag } from '../game-ui/index.js';
import { playSound } from '../lib/sound.js';
import { BUILDING_TOP, SATELLITE_ART, buildingArt, instrumentArt } from './assets.js';
import type { Blocked } from './UpgradeRow.js';
import { CoreTierInfo } from './CoreTierInfo.js';
import { PlanetRadiationProtection } from './PlanetRadiationProtection.js';
import { useVisibleTelemetry } from '../lib/playerAnalytics/useVisibleTelemetry.js';

/**
 * WHAT ONE MORE LEVEL BUYS, AND WHAT THIS THING BECOMES. D1 (docs/ui-v2/design-mocks).
 *
 * The card on the planet screen answers "what does one more level cost". This is
 * the commit surface, and it answers the four questions in the order a player asks
 * them:
 *
 *   · WHAT IT GIVES — one render of what stands and the gain the next level buys,
 *     now against next, in the hero. The rule behind it is one tap deeper ("How it
 *     works"), not a paragraph under every sheet.
 *   · WHERE IT GOES — the next three levels, each with its gain, its price and its
 *     time, and the level where the look next changes. That line carries the
 *     anticipation hook the per-rung pictures used to: "at L9 your refinery becomes
 *     THAT".
 *   · HOW FAR OFF — per resource, the price against what you hold, and on the button
 *     the one figure a short player wants: when it will be enough.
 *   · WHAT IT JOINS — construction is QUEUED (D4), so the footer says how full the
 *     queue is before the press, not after.
 *
 * Owner, round 2: a sheet opens to its content's height and becomes a page only when
 * the content does not fit (`fit`).
 */

/**
 * THREE KINDS, AND ONLY TWO OF THEM HAVE A LADDER. D25.
 *
 * Buildings and instruments are levelled. A satellite is up or it is not, so it
 * gets its orbit and its slot instead of a one-rung ladder pretending to be one.
 */
export type ItemRef =
  | { kind: 'building'; id: BuildingId }
  | { kind: 'instrument'; id: InstrumentId }
  | { kind: 'satellite'; id: SatelliteId };

/** How many levels ahead the ladder shows. Past three, nobody is planning. */
const HORIZON = 3;



export function ItemSheet({
  item,
  name,
  role,
  planet,
  held,
  blocked,
  completed,
  queued,
  pending,
  onAct,
  onClose,
}: {
  item: ItemRef;
  name: string;
  role: string;
  planet: PlanetView;
  held: { alloy: number; crystal: number };
  blocked?: Blocked;
  completed?: string;
  queued?: string;
  pending: boolean;
  onAct: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [explained, setExplained] = useState(false);
  const durableLevel = levelOf(planet, item);
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const orbitSlots = satelliteSlots(projected.buildings.CORE);
  const inactiveSatelliteIndex = item.kind === 'satellite' && !projected.effectiveOrbit.includes(item.id)
    ? planet.orbit.indexOf(item.id)
    : -1;
  const inactiveOpensAt = inactiveSatelliteIndex < 0 ? null : nextSlotCore(0, inactiveSatelliteIndex);
  const level = item.kind === 'building'
    ? projected.buildings[item.id]
    : item.kind === 'instrument'
      ? projected.instruments[item.id] ?? 0
      : projected.orbit.includes(item.id) ? 1 : 0;
  const levels = projected.buildings;
  const production = productionMult(projected.effectiveOrbit);
  // A satellite is a one-time purchase. Buildings and instruments keep their
  // action live while earlier levels wait in the same queue.
  const terminal = completed ?? (item.kind === 'satellite' ? queued : undefined);
  const cost = costFor(planet, item, level);
  const short = {
    alloy: Math.max(0, cost.alloy - held.alloy),
    crystal: Math.max(0, cost.crystal - held.crystal),
  };
  const affordable = short.alloy === 0 && short.crystal === 0;
  const observation = useVisibleTelemetry('development_item', item.id,
    terminal ? null : blocked ? 'requirements' : !affordable ? 'insufficient_resources' : null);
  const top = topOf(item);
  const rungs = item.kind === 'satellite' || terminal
    ? []
    : Array.from({ length: HORIZON }, (_, i) => level + 1 + i).filter((rung) => top === null || rung <= top);
  const look = item.kind === 'satellite' || terminal ? null : nextLook(item, level, top);
  const tag = item.kind === 'building'
    ? buildingTag(item.id)
    : item.kind === 'instrument'
      ? instrumentTag(item.id)
      : satelliteTag(item.id);
  const detail = item.kind === 'building'
    ? buildingDetail(item.id)
    : item.kind === 'instrument'
      ? instrumentDetail(item.id)
      : satelliteDetail(item.id);

  return (
    <div data-item-sheet>
      <Sheet
        detents={['fit']}
        kit={{ tone: 'self', meta: <span className="gk-sub">{tag}</span> }}
        eyebrow={
          item.kind === 'satellite'
            ? durableLevel === 0
              ? t('itemSheet.eyebrowNotInOrbit')
              : t('itemSheet.eyebrowInOrbit')
            : durableLevel === 0
              ? t('itemSheet.eyebrowNotInstalled')
              : t('itemSheet.eyebrowLevel', { level: durableLevel })
        }
        title={name}
        onClose={onClose}
        footer={<div ref={observation}>
          {terminal ? (
            <span data-act className="block">
              <p role="status" className="gk-inote gk-inote--plate">
                <Glyph id={completed ? 'check' : 'timed'} />
                <span>{terminal}</span>
              </p>
            </span>
          ) : (
            <Commit
              item={item}
              planet={planet}
              level={level}
              cost={cost}
              short={short}
              pending={pending}
              {...(blocked ? { blocked } : {})}
              onAct={() => {
                onAct();
                onClose();
              }}
              onClose={onClose}
            />
          )}
        </div>}
      >
        <div className="grid gap-3">
          {item.kind === 'satellite' ? (
            <OrbitHero id={item.id} orbit={projected.orbit} slots={orbitSlots} />
          ) : (
            <Hero item={item} level={durableLevel} name={name} gain={gainFor(item, level, levels, production, productionPaceOf(planet))} />
          )}

          <div className="grid gap-1.5">
            <div className="gk-iabout">
              <p className="gk-iabout__role">{role}</p>
              <button
                type="button"
                aria-expanded={explained}
                onClick={() => {
                  playSound('tap');
                  setExplained((open) => !open);
                }}
                className="gk-hit gk-iabout__how"
              >
                <span className="gk-chip">
                  <Glyph id="help" />
                  {t('itemSheet.howItWorks')}
                </span>
              </button>
            </div>
            {explained && (
              <p data-item-detail className="gk-well gk-iabout__detail">{detail}</p>
            )}
          </div>

          {item.kind === 'building' && item.id === 'CORE' && <CoreTierInfo level={durableLevel} />}
          {item.kind === 'instrument' && item.id === 'AEGIS' && <PlanetRadiationProtection planet={planet} />}

          {inactiveOpensAt !== null && (
            <p role="status" className="gk-inote" data-tone="warn">
              <Glyph id="warn" />
              <span>{t('planet.orbit.inactiveSatellite')} {t('planet.orbit.slotsNext', { level: inactiveOpensAt })}</span>
            </p>
          )}

          {queued && !terminal && (
            <p className="gk-inote gk-inote--plate" data-tone="self">
              <Glyph id="timed" />
              <span>{queued}</span>
            </p>
          )}

          {item.kind === 'satellite' && (
            <SlotCard
              orbit={projected.orbit}
              slots={orbitSlots}
              core={projected.buildings.CORE}
              placing={!terminal && level === 0}
            />
          )}

          {rungs.length > 0 && (
            <section className="grid gap-1.5">
              <SectionTag>{t('itemSheet.ladderHeading')}</SectionTag>
              {item.kind === 'building' && item.id === 'SHIPYARD' && <p className="gk-sub">{t('gains.shipyard.rowNote')}</p>}
              <ol className="gk-ladder gk-well">
                {rungs.map((rung) => (
                  <Rung
                    key={rung}
                    item={item}
                    level={rung}
                    first={rung === level + 1}
                    planet={planet}
                    // Several levels of the same instrument sell the same capability,
                    // and printing that sentence three times turns the ladder into
                    // wallpaper. A rung states its unlock only when it is a new one;
                    // the first rung's is the hero's, already on screen.
                    repeats={rung === level + 1 || gainFor(item, rung - 1, levels, production, productionPaceOf(planet)).unlocks
                      === gainFor(item, rung - 2, levels, production, productionPaceOf(planet)).unlocks}
                    heroLabel={gainFor(item, level, levels, production, productionPaceOf(planet)).label}
                    levels={levels}
                    production={production}
                  />
                ))}
              </ol>
            </section>
          )}

          {look && (
            <p data-next-look className="gk-ilook">
              <img src={look.art} alt="" aria-hidden />
              <span>{t('itemSheet.nextLook', { level: look.level })}</span>
            </p>
          )}

          {/*
            HOW FAR OFF, AS A DISTANCE RATHER THAN AS A DEFICIT. Owner instruction. It
            sits last, against the footer's price and its "enough in" — the two read
            as one answer because they are the same numbers.
          */}
          {!blocked && !terminal && !affordable && (
            <div className="gk-well grid gap-2 px-2.5 py-2">
              {short.alloy > 0 && <NeedBar resource="alloy" have={held.alloy} need={cost.alloy} />}
              {short.crystal > 0 && <NeedBar resource="crystal" have={held.crystal} need={cost.crystal} />}
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

/** What stands, and what the next level buys. */
function Hero({ item, level, name, gain }: { item: ItemRef; level: number; name: string; gain: Gain }) {
  const art = artFor(item, Math.max(1, level));
  return (
    <section data-item-hero className="gk-cut gk-cut--self gk-ihero">
      {art && (
        // Grey means "you do not have this", the rule every buyable in the game uses.
        <img src={art} alt={name} className={`gk-ihero__art ${level === 0 ? 'opacity-45 grayscale' : ''}`} />
      )}
      <div className="min-w-0">
        <p className="gk-label">{gain.label}</p>
        <p className="gk-ihero__value gk-display gk-num gk-outlined">
          {gain.maxed ? gain.now : gain.now === undefined ? <span className="gk-ihero__next">{gain.next}</span> : (
            <>
              <span className="inline-block">{gain.now}</span>{' '}
              <span className="inline-block"><span className="gk-ihero__arrow">→</span>{' '}<span className="gk-ihero__next">{gain.next}</span></span>
            </>
          )}
        </p>
        {gain.note && <p className="gk-ihero__line">{gain.note}</p>}
        {/* A sentence of its own ("Up to 7.3k at the top rung"): the Hangar is the one ladder here with one. */}
        {gain.ceiling !== undefined && gain.maxed !== true && (
          <p className="gk-sub">{gain.ceiling}</p>
        )}
        {gain.unlocks && <p className="gk-ihero__line">{gain.unlocks}</p>}
      </div>
    </section>
  );
}

/** One level of the ladder: what it buys, what it costs, how long it takes. */
function Rung({
  item,
  level,
  first,
  planet,
  repeats,
  heroLabel,
  levels,
  production,
}: {
  item: ItemRef;
  level: number;
  /** The level the button sells; the two beyond it are the reason to keep going. */
  first: boolean;
  planet: PlanetView;
  /** True when this rung's unlock line is already on screen, above it or in the hero. */
  repeats: boolean;
  /**
   * What the hero says the next level buys. A rung that buys something else names it:
   * a Telescope's rungs alternate a slot and range, and bare figures read as nonsense.
   */
  heroLabel: string;
  /**
   * The whole building record, because two rows cannot be priced without their
   * siblings: the store's ceiling scales with the Vault, and the Vault's floor is
   * hours of the Refinery's and Extractor's production.
   */
  levels: BuildingLevels;
  production: number;
}) {
  const { t } = useTranslation();
  const cost = costFor(planet, item, level - 1);
  const gain = gainFor(item, level - 1, levels, production, productionPaceOf(planet));
  const takes = useOrderDuration(takesFor(planet, item, cost, level));
  // The Core's gain IS its level, which the rung already names: "L3 · L3" read as a fault.
  const value = item.kind === 'building' && item.id === 'CORE' ? null : gain.next;

  return (
    <li data-rung={level} className="gk-ladder__rung" {...(first ? { 'data-first': '' } : {})}>
      <span className="gk-ladder__level gk-display gk-num">{t('itemSheet.rungLevel', { level })}</span>
      <span className="gk-ladder__value">
        {value !== null && (
          <>
            {gain.label !== heroLabel && <span className="gk-ladder__label">{gain.label} </span>}
            <span className="gk-num">{value}</span>
          </>
        )}
      </span>
      <CostLine
        cost={cost}
        time={<span className="gk-cost__time"><Glyph id="clock" />{takes}</span>}
      />
      {gain.unlocks && !repeats && (
        <span className="gk-ladder__unlock">{gain.unlocks}</span>
      )}
    </li>
  );
}

/**
 * THE FOOTER: the price and the time of the level being sold, the queue it joins,
 * and the one press. Short, it says WHEN; blocked, it is the door to the fix.
 */
function Commit({
  item,
  planet,
  level,
  cost,
  short,
  blocked,
  pending,
  onAct,
  onClose,
}: {
  item: ItemRef;
  planet: PlanetView;
  level: number;
  cost: { alloy: number; crystal: number };
  short: { alloy: number; crystal: number };
  blocked?: Blocked;
  pending: boolean;
  onAct: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const takes = useOrderDuration(takesFor(planet, item, cost, level + 1));
  const affordable = short.alloy === 0 && short.crystal === 0;
  const wait = affordable
    ? 0
    : affordWait(short, { alloyPerHour: planet.planet.alloyPerHour, crystalPerHour: planet.planet.crystalPerHour });
  const used = planet.queues?.CONSTRUCTION.length ?? 0;
  const label = item.kind === 'satellite'
    ? t('itemSheet.actPutInOrbit')
    : level === 0
      ? t('itemSheet.actInstall')
      : t('itemSheet.actRaise', { level: level + 1 });

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <CostLine
          cost={cost}
          held={{ alloy: cost.alloy - short.alloy, crystal: cost.crystal - short.crystal }}
          time={<span className="gk-cost__time"><Glyph id="clock" />{takes}</span>}
        />
        <span data-queue-fill className="gk-sub shrink-0">
          {t('itemSheet.queueFill', { used, total: BUILD.queueDepth })}
        </span>
      </div>
      <span data-act className="block">
        {blocked ? (
          // A REQUIREMENT IS A DOOR, NOT AN ALARM (I1): warn, and it goes where the fix is.
          blocked.onFix ? (
            <GameButton
              wide
              glyph="lock"
              className="gk-btn--door"
              onPress={() => {
                blocked.onFix?.();
                onClose();
              }}
            >
              {sentence(blocked.reason)} →
            </GameButton>
          ) : (
            <p className="gk-inote gk-inote--plate">
              <Glyph id="lock" />
              <span>{sentence(blocked.reason)}</span>
            </p>
          )
        ) : (
          <GameButton
            tone="action"
            size="lg"
            wide
            heavy
            glyph={affordable ? 'up' : 'timed'}
            pending={pending}
            disabledReason={affordable
              ? null
              : wait === null
                ? t('itemSheet.short')
                : t('itemSheet.affordIn', { duration: duration(wait) })}
            onPress={onAct}
          >
            {label}
          </GameButton>
        )}
      </span>
    </div>
  );
}

/** A requirement is written to follow "needs"; on a door of its own it starts a sentence. */
const sentence = (text: string): string =>
  text.charAt(0).toLocaleUpperCase(i18n.language) + text.slice(1);

/* ── the satellite ───────────────────────────────────────────── */

/** Every slot the Command Core can ever open. */
const MOST_SLOTS = satelliteSlots(Number.MAX_SAFE_INTEGER);

type Socket = 'self' | 'taken' | 'inactive' | 'target' | 'free' | 'shut';

/**
 * THE ORBIT AS SOCKETS. What is up there, the slot this one would take (dashed), the
 * open ones, and the ones the Core has not opened yet (shut).
 */
function orbitSockets(id: SatelliteId, orbit: readonly SatelliteId[], slots: number): Socket[] {
  const up = orbit.map((satellite, index): Socket =>
    index >= slots ? 'inactive' : satellite === id ? 'self' : 'taken');
  const open = Math.max(0, slots - orbit.length);
  const placing = !orbit.includes(id);
  const free = Array.from({ length: open }, (_, i): Socket => (placing && i === 0 ? 'target' : 'free'));
  const shut = Array.from({ length: Math.max(0, Math.max(MOST_SLOTS, slots) - up.length - free.length) }, (): Socket => 'shut');
  return [...up, ...free, ...shut];
}


function OrbitHero({ id, orbit, slots }: { id: SatelliteId; orbit: readonly SatelliteId[]; slots: number }) {
  const { t } = useTranslation();
  const gain = satelliteGain(id);
  const sockets = orbitSockets(id, orbit, slots);

  return (
    <section data-item-hero className="gk-cut gk-cut--self gk-ihero">
      <div aria-hidden="true" className="gk-orbit">
        <span className="gk-orbit__ring" />
        <img src={SATELLITE_ART[id]} alt="" className="gk-orbit__self" />
        {sockets.map((socket, index) => {
          const angle = ((-135 + (index * 360) / sockets.length) * Math.PI) / 180;
          // The sockets start with the orbit, in its order.
          const other = socket === 'taken' || socket === 'inactive' ? orbit[index] : undefined;
          return (
            <span
              key={index}
              data-socket={socket}
              className="gk-orbit__socket"
              style={{ left: `${String(50 + 44 * Math.cos(angle))}%`, top: `${String(50 + 44 * Math.sin(angle))}%` }}
            >
              {socket === 'shut' && <Glyph id="lock" />}
              {other && <img src={SATELLITE_ART[other]} alt="" className={socket === 'inactive' ? 'opacity-45 grayscale' : ''} />}
              {socket === 'self' && <img src={SATELLITE_ART[id]} alt="" />}
            </span>
          );
        })}
      </div>
      <div className="min-w-0">
        <p className="gk-label">{t('itemSheet.orbitalDoesHeading')}</p>
        <p className="gk-ihero__line">
          <span className="gk-ihero__dim">{gain.label}: </span>
          <span className="gk-num">{gain.now}</span> <span className="gk-ihero__arrow">→</span> <span className="gk-ihero__next gk-num">{gain.next}</span>
        </p>
        {gain.unlocks && <p className="gk-ihero__line">{gain.unlocks}</p>}
        <p className="gk-sub">{t('itemSheet.orbitalOnce')}</p>
      </div>
    </section>
  );
}

/**
 * THE SLOT IS THE REAL COST, so the sheet states it before the refusal does: what
 * placing this leaves, and which Core opens the next one. D25.
 */
function SlotCard({
  orbit,
  slots,
  core,
  placing,
}: {
  orbit: readonly SatelliteId[];
  slots: number;
  core: number;
  /** Not up and not ordered: the consequence line is about THIS press. */
  placing: boolean;
}) {
  const { t } = useTranslation();
  const free = Math.max(0, slots - orbit.length);
  const opener = nextSlotCore(core, slots);

  return (
    <section className="gk-well grid gap-1 px-2.5 py-2">
      <SectionTag aside={<span className="gk-num">{t('itemSheet.orbitalFree', { free, total: slots })}</span>}>
        {t('itemSheet.slotHeading')}
      </SectionTag>
      {free === 0 ? (
        <p className="gk-inote" data-tone="warn">
          <Glyph id="warn" />
          <span>{opener === null ? t('itemSheet.orbitalNoSlotMax') : t('itemSheet.orbitalNoSlot', { level: opener })}</span>
        </p>
      ) : placing ? (
        <p data-slot-after className="gk-inote">
          <span>
            {t('itemSheet.slotAfter', { count: free - 1 })}
            {free - 1 === 0 && opener !== null && <> {t('itemSheet.nextSlotCore', { level: opener })}</>}
          </span>
        </p>
      ) : null}
    </section>
  );
}

/** The Command Core level that opens one more orbit slot, or null past the last. */
const nextSlotCore = (core: number, now: number): number | null => {
  for (let level = core + 1; level <= core + 40; level += 1) {
    if (satelliteSlots(level) > now) return level;
  }
  return null;
};

/* ── the three kinds, in one place ──────────────────────────── */

const levelOf = (planet: PlanetView, item: ItemRef): number => {
  if (item.kind === 'building') return planet.buildings[item.id] ?? 0;
  if (item.kind === 'instrument') return planet.instruments[item.id] ?? 0;
  // A satellite is up or it is not, and "1" is what every level-shaped control on
  // this sheet reads as "installed".
  return planet.orbit.includes(item.id) ? 1 : 0;
};

/** The permanent ceiling, independent of the player's current research rung. */
const topOf = (item: ItemRef): number | null =>
  item.kind === 'instrument'
    ? INSTRUMENT_MAX_LEVEL[item.id]
    : item.kind === 'building'
      ? item.id === 'DEUTERIUM_PLANT'
        ? plantCeiling(RESEARCH_MAX_LEVEL.DEUTERIUM_SYNTHESIS)
        : BUILDING_TOP[item.id]
      : 1;

/**
 * The server's own price for the next step, and the rules' price beyond it.
 *
 * `nextCosts` is authoritative and may include modifiers the client does not know
 * about, so it wins wherever it applies — which is only ever the very next level.
 */
function costFor(
  planet: PlanetView,
  item: ItemRef,
  from: number,
): { alloy: number; crystal: number } {
  if (item.kind === 'satellite') {
    // Flat: the server's own figure, or the rules' when it sent none (as the base card does).
    // There is no rung beyond this one.
    const price = planet.satelliteCosts[item.id] ?? satelliteCost(item.id);
    return { alloy: price.alloy, crystal: price.crystal };
  }
  const current = levelOf(planet, item);
  if (from === current) {
    const quoted =
      item.kind === 'building' ? planet.nextCosts[item.id] : planet.instrumentCosts[item.id];
    if (quoted) return quoted;
  }
  // Beyond the next level the server has no opinion, so the ladder prices itself
  // from the rules — with the instrument multiplier where it applies (D25).
  return item.kind === 'instrument' ? instrumentCost(item.id, from) : buildingCost(item.id, from);
}

/** Minutes the order for `level` takes once it starts, as the server will time it. */
const takesFor = (
  planet: PlanetView,
  item: ItemRef,
  cost: { alloy: number; crystal: number },
  level: number,
): number => {
  const priced = { alloy: cost.alloy, crystal: cost.crystal, deuterium: 0 };
  if (item.kind === 'building') return orderMinutes('BUILDING', priced, planet, 1, { building: item.id, level });
  if (item.kind === 'instrument') return orderMinutes('INSTRUMENT', priced, planet);
  return orderMinutes('SATELLITE', priced, planet, 1, { satellite: item.id });
};

const gainFor = (
  item: ItemRef,
  level: number,
  levels: BuildingLevels,
  production = 1,
  pace = 1,
): Gain =>
  item.kind === 'building'
    ? buildingGain(item.id, level, 0, levels, production, pace)
    : item.kind === 'instrument'
      ? instrumentGain(item.id, level)
      : satelliteGain(item.id);

function artFor(item: ItemRef, level: number): string | null {
  if (item.kind === 'satellite') return SATELLITE_ART[item.id];
  return item.kind === 'instrument' ? instrumentArt(item.id, level) : buildingArt(item.id, level);
}

/**
 * WHERE THE LOOK NEXT CHANGES, read off the renders themselves: a hand-kept list of
 * tiered buildings had already missed the Hangar once. Null on the last picture, and
 * for the Deuterium Plant, which wears the same render at every level.
 */
function nextLook(item: ItemRef, level: number, top: number | null): { level: number; art: string } | null {
  const now = artFor(item, Math.max(1, level));
  const last = top ?? level + 20;
  for (let rung = level + 1; rung <= last; rung += 1) {
    const art = artFor(item, rung);
    if (art && art !== now) return { level: rung, art };
  }
  return null;
}
