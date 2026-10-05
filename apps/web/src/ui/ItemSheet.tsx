import { useState, type CSSProperties } from 'react';
import {
  BUILD,
  INSTRUMENT_MAX_LEVEL,
  buildingCost,
  instrumentCost,
  productionMult,
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
import { buildingGain, instrumentGain, satelliteGain, type Gain } from '../lib/gains.js';
import { orderMinutes } from '../lib/orderTime.js';
import { projectedQueueState } from '../lib/predict.js';
import { duration } from '../lib/time.js';
import { Icon } from '../v2/icons.js';
import { Cost } from '../v2/kit/Cost.js';
import { NeedBar } from '../v2/kit/NeedBar.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { useOrderDuration } from './Action.js';
import { BUILDING_TOP, SATELLITE_ART, buildingArt, instrumentArt } from './assets.js';
import type { Blocked } from './UpgradeRow.js';
import { CoreTierInfo } from './CoreTierInfo.js';

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

const HEADING = 'text-micro font-semibold uppercase tracking-wide text-v2-ink-3';

/** The still sky behind a render: decoration, never a meaning. */
const SKY: CSSProperties = {
  backgroundImage:
    'radial-gradient(70% 90% at 22% 45%, color-mix(in srgb, var(--color-v2-sky-blue) 30%, transparent), transparent 75%)',
};

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
        footer={
          terminal ? (
            <span data-act className="block">
              <p
                role="status"
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-control border border-v2-line px-3 text-caption font-semibold text-v2-ink-2"
              >
                {!completed && <Icon id="i-clock" className="size-3.5 shrink-0" />}
                {terminal}
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
          )
        }
      >
        <div className="flex flex-col gap-3 pt-1">
          {item.kind === 'satellite' ? (
            <OrbitHero id={item.id} orbit={projected.orbit} slots={orbitSlots} tag={tag} />
          ) : (
            <Hero item={item} level={durableLevel} name={name} gain={gainFor(item, level, levels, production)} />
          )}

          <div className="flex flex-col gap-1.5">
            <p className="text-caption leading-snug text-v2-ink-2">
              {item.kind !== 'satellite' && <span className="font-semibold text-v2-ink">{tag} · </span>}
              <span>{role}</span>{' '}
              <button
                type="button"
                aria-expanded={explained}
                onClick={() => {
                  setExplained((open) => !open);
                }}
                className="font-semibold text-v2-self"
              >
                {t('itemSheet.howItWorks')} ›
              </button>
            </p>
            {explained && (
              <p data-item-detail className="text-caption leading-snug text-v2-ink-3">{detail}</p>
            )}
          </div>

          {item.kind === 'building' && item.id === 'CORE' && <CoreTierInfo level={durableLevel} />}

          {inactiveOpensAt !== null && (
            <p role="status" className="text-caption leading-snug text-v2-warn">
              {t('planet.orbit.inactiveSatellite')} {t('planet.orbit.slotsNext', { level: inactiveOpensAt })}
            </p>
          )}

          {queued && !terminal && (
            <p className="flex items-center gap-1.5 rounded-chip border border-v2-self/30 bg-v2-self/10 px-2.5 py-1.5 text-caption text-v2-self">
              <Icon id="i-clock" className="size-3.5 shrink-0" />
              {queued}
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
            <section className="flex flex-col gap-1.5">
              <p className={`flex items-center gap-2 ${HEADING}`}>
                {t('itemSheet.ladderHeading')}
                <span aria-hidden="true" className="h-px flex-1 bg-v2-line" />
              </p>
              <ol className="divide-y divide-v2-line overflow-hidden rounded-control border border-v2-line bg-v2-deep/60">
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
                    repeats={rung === level + 1 || gainFor(item, rung - 1, levels, production).unlocks
                      === gainFor(item, rung - 2, levels, production).unlocks}
                    heroLabel={gainFor(item, level, levels, production).label}
                    levels={levels}
                    production={production}
                  />
                ))}
              </ol>
            </section>
          )}

          {look && (
            <p data-next-look className="flex items-center gap-2.5 text-caption text-v2-ink-2">
              <img src={look.art} alt="" aria-hidden className="size-9 shrink-0 object-contain opacity-80" />
              {t('itemSheet.nextLook', { level: look.level })}
            </p>
          )}

          {/*
            HOW FAR OFF, AS A DISTANCE RATHER THAN AS A DEFICIT. Owner instruction. It
            sits last, against the footer's price and its "enough in" — the two read
            as one answer because they are the same numbers.
          */}
          {!blocked && !terminal && !affordable && (
            <div className="flex flex-col gap-2 rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2.5">
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
    <section data-item-hero className="flex items-center gap-3 rounded-control border border-v2-line bg-v2-deep p-3" style={SKY}>
      {art && (
        // Grey means "you do not have this", the rule every buyable in the game uses.
        <img
          src={art}
          alt={name}
          className={`size-24 shrink-0 object-contain ${level === 0 ? 'opacity-45 grayscale' : ''}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className={HEADING}>{gain.label}</p>
        <p className="mt-0.5 font-v2-mono text-body font-semibold tabular-nums text-v2-ink">
          {gain.maxed ? gain.now : (
            <>
              {gain.now} <span className="text-v2-ink-3">→</span> <span className="text-v2-self">{gain.next}</span>
            </>
          )}
        </p>
        {/* A sentence of its own ("Up to 7.3k at the top rung"): the Hangar is the one ladder here with one. */}
        {gain.ceiling !== undefined && gain.maxed !== true && (
          <p className="mt-0.5 text-micro text-v2-ink-3">{gain.ceiling}</p>
        )}
        {gain.unlocks && <p className="mt-1 text-micro leading-snug text-v2-ink-2">{gain.unlocks}</p>}
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
  const gain = gainFor(item, level - 1, levels, production);
  const takes = useOrderDuration(takesFor(planet, item, cost, level));
  // The Core's gain IS its level, which the rung already names: "L3 · L3" read as a fault.
  const value = item.kind === 'building' && item.id === 'CORE' ? null : gain.next;

  return (
    <li data-rung={level} className={`flex items-start gap-2 px-2.5 py-2 ${first ? '' : 'opacity-70'}`}>
      <span className={`w-10 shrink-0 font-v2-mono text-caption ${first ? 'text-v2-self' : 'text-v2-ink-3'}`}>
        {t('itemSheet.rungLevel', { level })}
      </span>
      <span className="min-w-0 flex-1">
        {value !== null && (
          <span className="block font-v2-mono text-caption text-v2-ink">
            {gain.label !== heroLabel && <span className="font-v2-ui text-v2-ink-3">{gain.label} </span>}
            {value}
          </span>
        )}
        {gain.unlocks && !repeats && (
          <span className="mt-0.5 block text-micro leading-snug text-v2-ink-2">{gain.unlocks}</span>
        )}
      </span>
      <Cost cost={cost} />
      <span className="w-12 shrink-0 whitespace-nowrap text-right font-v2-mono text-micro text-v2-ink-3">{takes}</span>
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <Cost cost={cost} held={{ alloy: cost.alloy - short.alloy, crystal: cost.crystal - short.crystal }} />
          <span className="flex items-center gap-1 whitespace-nowrap font-v2-mono text-micro text-v2-ink-2">
            <Icon id="i-clock" className="size-3 shrink-0" />
            {takes}
          </span>
        </span>
        <span data-queue-fill className="shrink-0 text-micro text-v2-ink-3">
          {t('itemSheet.queueFill', { used, total: BUILD.queueDepth })}
        </span>
      </div>
      <span data-act className="block">
        {blocked ? (
          // A REQUIREMENT IS A DOOR, NOT AN ALARM (I1): warn, and it goes where the fix is.
          blocked.onFix ? (
            <button
              type="button"
              onClick={() => {
                blocked.onFix?.();
                onClose();
              }}
              className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-control border border-v2-warn/50 px-3 text-caption font-semibold text-v2-warn"
            >
              <Icon id="i-lock" className="size-3.5 shrink-0" />
              {sentence(blocked.reason)} →
            </button>
          ) : (
            <p className="flex min-h-10 items-center justify-center gap-1.5 rounded-control border border-v2-line px-3 text-caption text-v2-ink-2">
              <Icon id="i-lock" className="size-3.5 shrink-0" />
              {sentence(blocked.reason)}
            </p>
          )
        ) : (
          <button
            type="button"
            disabled={!affordable || pending}
            onClick={onAct}
            className="min-h-10 w-full rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-2"
          >
            {affordable
              ? label
              : wait === null
                ? t('itemSheet.short')
                : t('itemSheet.affordIn', { duration: duration(wait) })}
          </button>
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

const SOCKET: Record<Socket, string> = {
  self: 'border-v2-self bg-v2-self/15',
  taken: 'border-v2-self/50 bg-v2-panel',
  inactive: 'border-v2-line bg-v2-void text-v2-ink-3',
  target: 'border-dashed border-v2-self bg-v2-self/10',
  free: 'border-v2-line-hi bg-v2-deep',
  shut: 'border-v2-line bg-v2-void text-v2-ink-3',
};

function OrbitHero({ id, orbit, slots, tag }: { id: SatelliteId; orbit: readonly SatelliteId[]; slots: number; tag: string }) {
  const { t } = useTranslation();
  const gain = satelliteGain(id);
  const sockets = orbitSockets(id, orbit, slots);

  return (
    <section data-item-hero className="flex items-center gap-3 rounded-control border border-v2-line bg-v2-deep p-3" style={SKY}>
      <div aria-hidden="true" className="relative size-28 shrink-0">
        <span className="absolute inset-3 rounded-full border border-v2-line-hi" />
        <img src={SATELLITE_ART[id]} alt="" className="absolute inset-0 m-auto size-14 object-contain" />
        {sockets.map((socket, index) => {
          const angle = ((-135 + (index * 360) / sockets.length) * Math.PI) / 180;
          // The sockets start with the orbit, in its order.
          const other = socket === 'taken' || socket === 'inactive' ? orbit[index] : undefined;
          return (
            <span
              key={index}
              data-socket={socket}
              className={`absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border ${SOCKET[socket]}`}
              style={{ left: `${String(50 + 44 * Math.cos(angle))}%`, top: `${String(50 + 44 * Math.sin(angle))}%` }}
            >
              {socket === 'shut' && <Icon id="i-lock" className="size-3" />}
              {other && <img src={SATELLITE_ART[other]} alt="" className={socket === 'inactive' ? 'size-4 object-contain opacity-45 grayscale' : 'size-4 object-contain'} />}
              {socket === 'inactive' && <Icon id="i-lock" className="absolute -right-1 -top-1 size-2.5" />}
              {socket === 'self' && <img src={SATELLITE_ART[id]} alt="" className="size-4 object-contain" />}
            </span>
          );
        })}
      </div>
      <div className="min-w-0 flex-1">
        <p className={HEADING}>{t('itemSheet.orbitalDoesHeading')}</p>
        <p className="mt-0.5 text-body font-semibold leading-snug text-v2-ink">{tag}</p>
        <p className="mt-1 font-v2-mono text-micro text-v2-ink-2">
          <span className="font-v2-ui text-v2-ink-3">{gain.label}: </span>
          {gain.now} <span className="text-v2-ink-3">→</span> <span className="text-v2-self">{gain.next}</span>
        </p>
        {gain.unlocks && <p className="mt-1 text-micro leading-snug text-v2-ink-2">{gain.unlocks}</p>}
        <p className="mt-1 text-micro text-v2-ink-3">{t('itemSheet.orbitalOnce')}</p>
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
    <section className="flex flex-col gap-1 rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2.5">
      <p className={`flex items-center justify-between gap-2 ${HEADING}`}>
        {t('itemSheet.slotHeading')}
        <span className="font-v2-mono normal-case tracking-normal text-v2-ink-2">
          {t('itemSheet.orbitalFree', { free, total: slots })}
        </span>
      </p>
      {free === 0 ? (
        <p className="text-caption leading-snug text-v2-warn">
          {opener === null ? t('itemSheet.orbitalNoSlotMax') : t('itemSheet.orbitalNoSlot', { level: opener })}
        </p>
      ) : placing ? (
        <p data-slot-after className="text-caption leading-snug text-v2-ink-2">
          {t('itemSheet.slotAfter', { count: free - 1 })}
          {free - 1 === 0 && opener !== null && <> {t('itemSheet.nextSlotCore', { level: opener })}</>}
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

/** The top of a ladder, where it has one: the range tables and the Hangar. Null: none. */
const topOf = (item: ItemRef): number | null =>
  item.kind === 'instrument'
    ? INSTRUMENT_MAX_LEVEL[item.id]
    : item.kind === 'building'
      ? BUILDING_TOP[item.id]
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
    // Flat, and always the server's own figure. There is no rung beyond this one.
    return planet.satelliteCosts[item.id] ?? { alloy: 0, crystal: 0 };
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
): Gain =>
  item.kind === 'building'
    ? buildingGain(item.id, level, 0, levels, production)
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
