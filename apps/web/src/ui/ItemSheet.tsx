import {
  buildingCost,
  instrumentCost,
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
import { compact } from '../lib/format.js';
import { projectedQueueState } from '../lib/predict.js';
import { ActionButton, ResourceAmounts } from './Action.js';
import {
  buildingGain, instrumentGain, satelliteGain, type Gain,
} from '../lib/gains.js';
import { RESOURCE_ART, SATELLITE_ART, buildingArt, instrumentArt, tierOf } from './assets.js';
import { CoreMark, VaultMark } from './marks.js';
import { SpendBar } from './SpendBar.js';
import { Tally } from './Tally.js';
import { Sheet } from './kit/index.js';
import type { Blocked } from './UpgradeRow.js';

/**
 * WHAT THIS THING BECOMES.
 *
 * The row on the planet screen answers "what does one more level cost and give".
 * This answers the question that actually pulls a player up a tech tree: *where
 * does this end up*. Three levels ahead, each with its number, its price and the
 * art it will be wearing — so a Telescope at L1 is visibly a small dish that
 * becomes an array, and the player can see the array before paying for it.
 *
 * It is also the commit surface. Construction is QUEUED (D4) — cost committed at
 * order, three deep, half back on cancel — so a purchase gets its weight from being
 * considered rather than from being waited out: you open the thing, you see the
 * before and the after, you press once, and the order joins the rack on the planet
 * screen. This docblock said "instant" for two decisions after the queue shipped.
 */

/**
 * THREE KINDS, AND ONLY TWO OF THEM HAVE A LADDER. D25.
 *
 * Buildings and instruments are levelled, so their sheet is a ladder: this level,
 * the next three, and the art each one wears. A satellite has no levels at all —
 * it is up or it is not — so it gets a different sheet entirely rather than a
 * one-rung ladder pretending to be one.
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
  const durableLevel = levelOf(planet, item);
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const level = item.kind === 'building'
    ? projected.buildings[item.id]
    : item.kind === 'instrument'
      ? projected.instruments[item.id] ?? 0
      : projected.orbit.includes(item.id) ? 1 : 0;
  const levels = projected.buildings;
  // A satellite is a one-time purchase. Buildings and instruments keep their
  // action live while earlier levels wait in the same queue.
  const terminal = completed ?? (item.kind === 'satellite' ? queued : undefined);
  const cost = costFor(planet, item, level);
  const short = {
    alloy: Math.max(0, cost.alloy - held.alloy),
    crystal: Math.max(0, cost.crystal - held.crystal),
  };
  const affordable = short.alloy === 0 && short.crystal === 0;
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

  const rungs = Array.from({ length: HORIZON }, (_, i) => level + 1 + i);

  return (
    <div data-item-sheet>
    <Sheet
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
        <span data-act className="block">
        <ActionButton
          verb={level === 0 ? 'install' : 'raise'}
          cost={cost}
          held={held}
          full
          pending={pending}
          {...(terminal ? { completed: terminal } : {})}
          {...(blocked
            ? {
                blocked: {
                  reason: blocked.reason,
                  ...(blocked.onFix
                    ? {
                        onFix: () => {
                          blocked.onFix?.();
                          onClose();
                        },
                      }
                    : {}),
                },
              }
            : {})}
          label={
            item.kind === 'satellite'
              ? level === 0
                ? t('itemSheet.actPutInOrbit')
                : t('itemSheet.actAlreadyInOrbit')
              : level === 0
                ? t('itemSheet.actInstall')
                : t('itemSheet.actRaise', { level: level + 1 })
          }
          onAct={() => {
            onAct();
            onClose();
          }}
        />
        </span>
      }
    >
      <Portrait item={item} level={durableLevel} name={name} />

      <div className="mt-4">
        <p className="legend text-crystal/85">{tag}</p>
        <p className="mt-2 text-body leading-relaxed text-dim">{role}</p>
        <p data-item-detail className="mt-2 text-caption leading-relaxed text-faint">{detail}</p>
      </div>

      {queued && (
        <p className="mt-3 border border-crystal/30 bg-crystal/10 px-3 py-2 text-caption text-crystal">
          {queued}
        </p>
      )}

      {/*
        A REQUIREMENT IS A DOOR, NOT AN ALARM (interface.md I1). This was the one
        locked state in the game still painted in threat red, while the row that
        opened this sheet drew the same fact in amber — one screen giving two
        answers to "is a prerequisite an attack". Red is reserved for something
        that can harm the commander; a Shipyard they have not built cannot.
      */}
      {blocked && !terminal && (
        <p className="mt-3 border border-alloy/30 bg-alloy/10 px-3 py-2 text-caption text-alloy">
          {t('itemSheet.lockedNote', { reason: blocked.reason })}
        </p>
      )}

      {/*
        HOW FAR OFF, AS A DISTANCE RATHER THAN AS A DEFICIT. Owner instruction.

        "Short 1.2k alloy and 300 crystal" states the gap and hides the thing a
        player actually wants, which is how CLOSE they are: eight hundred of a
        thousand and forty of a thousand are the same sentence and completely
        different situations — one is worth waiting for and the other is not.

        Two spend bars answer that by drawing the price against the store it has
        to come out of, so a nearly-full bar with a short red tail reads as "come
        back after dinner" and a mostly-red one reads as "not this session". The
        row that opened this sheet already says WHEN in words; this says how far,
        and the two agree because they are the same two numbers.
      */}
      {!blocked && !terminal && !affordable && (
        <div className="mt-3 flex flex-col gap-3">
          <SpendBar
            stock={held.alloy}
            spend={cost.alloy}
            tone="alloy"
            label={t('vocabulary.resource.alloy')}
          />
          {cost.crystal > 0 && (
            <SpendBar
              stock={held.crystal}
              spend={cost.crystal}
              tone="crystal"
              label={t('vocabulary.resource.crystal')}
            />
          )}
        </div>
      )}

      {item.kind === 'satellite' ? (
        <Orbital
          id={item.id}
          cost={cost}
          slots={planet.orbitSlots}
          used={planet.orbit.length}
        />
      ) : terminal ? null : (
        <div className="mt-6">
          <p className="legend mb-2">{t('itemSheet.ladderHeading')}</p>
          <div className="plate plate-inset">
            {rungs.map((rung) => (
              <Rung
                key={rung}
                item={item}
                level={rung}
                cost={costFor(planet, item, rung - 1)}
                next={rung === level + 1}
                // Several levels of the same instrument sell the same capability,
                // and printing that sentence three times turns the ladder into
                // wallpaper. A rung states its unlock only when it is a new one.
                repeats={rung > level + 1 && gainFor(item, rung - 1, levels).unlocks
                  === gainFor(item, rung - 2, levels).unlocks}
                levels={levels}
              />
            ))}
          </div>
        </div>
      )}
    </Sheet>
    </div>
  );
}

/** The current tier, at the size the art was drawn for. */
function Portrait({ item, level, name }: { item: ItemRef; level: number; name: string }) {
  const art = artFor(item, Math.max(1, level));
  const mark = markFor(item);

  return (
    <div className="item-portrait flex h-48 items-center justify-center overflow-hidden">
      <span aria-hidden className="item-portrait-orbit" />
      <span aria-hidden className="item-portrait-index num">{String(Math.max(0, level)).padStart(2, '0')}</span>
      {art ? (
        <img
          src={art}
          alt={name}
          className={`relative z-[1] h-36 object-contain ${level === 0 ? 'opacity-45 grayscale' : ''}`}
        />
      ) : (
        <div className={`relative z-[1] ${level === 0 ? 'opacity-45 grayscale' : ''}`}>{mark}</div>
      )}
    </div>
  );
}

/**
 * One level of the ladder.
 *
 * The next one is lit and priced; the two beyond it are dimmer but still fully
 * legible — they are the reason to keep going, not decoration. Art appears only on
 * the rungs where it actually changes, which is what makes those rungs feel like
 * arriving somewhere.
 */
function Rung({
  item,
  level,
  cost,
  next,
  repeats,
  levels,
}: {
  item: ItemRef;
  level: number;
  cost: { alloy: number; crystal: number };
  next: boolean;
  /** True when this rung's unlock line is the same one the rung above already made. */
  repeats: boolean;
  /**
   * The whole building record, because two rows cannot be priced without their
   * siblings: the store's ceiling scales with the Vault, and the Vault's floor is
   * hours of the Refinery's and Extractor's production.
   */
  levels: BuildingLevels;
}) {
  const { t } = useTranslation();
  const gain = gainFor(item, level - 1, levels);
  /**
   * EVERY RUNG WEARS ITS OWN PICTURE.
   *
   * Art used to appear only on the rungs where the TIER changed, which for a
   * ladder starting from nothing meant L1 and L2 were blank and L3 was the first
   * thing a player ever saw a picture of — so the sheet looked broken and, worse,
   * implied the first two levels had no hardware. The renders for tier 1 exist and
   * were simply never asked for.
   *
   * The tier change is still marked, as a lit ring rather than as the presence or
   * absence of the image. That keeps the "at L3 your telescope becomes THAT"
   * anticipation hook while every level still shows what you are buying.
   */
  const art = artFor(item, level);
  const upgrades = tierChangesAt(item, level);

  return (
    <div
      className={`flex items-start gap-3 border-b border-line-soft p-3 last:border-b-0 ${
        next ? '' : 'opacity-65'
      }`}
    >
      <div className="w-9 shrink-0 pt-1">
        <span className={`num text-body ${next ? 'text-crystal' : 'text-faint'}`}>
          {t('itemSheet.rungLevel', { level })}
        </span>
      </div>

      {art && (
        <div
          className={`socket size-11 shrink-0 rounded-control ${
            upgrades ? 'ring-1 ring-crystal/40' : ''
          }`}
          title={upgrades ? t('itemSheet.rungNewHardware', { level }) : undefined}
        >
          <img
            src={art}
            alt=""
            aria-hidden
            className={`size-10 object-contain ${
              upgrades ? 'drop-shadow-[0_0_8px_rgba(111,211,224,0.35)]' : ''
            }`}
            loading="lazy"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="num text-body">
          <span className="text-faint">{gain.label} </span>
          {gain.resourcePair
            ? <ResourceAmounts resources={gain.resourcePair.next} label={gain.next} />
            : <span className={next ? 'text-bone' : 'text-dim'}>{gain.next}</span>}
        </p>
        {gain.unlocks && !repeats && (
          <p className="mt-1 text-label leading-snug text-crystal/80">{gain.unlocks}</p>
        )}
      </div>

      <span className="num shrink-0 pt-1 text-right text-label text-faint">
        <span className="flex items-center gap-1">
          <img
            src={RESOURCE_ART.alloy}
            alt={i18n.t('vocabulary.resource.alloy')}
            className="size-3.5 object-contain"
          />
          {compact(cost.alloy)}
        </span>
        {cost.crystal > 0 && (
          <span className="mt-1 flex items-center gap-1 text-crystal/70">
            <img
              src={RESOURCE_ART.crystal}
              alt={i18n.t('vocabulary.resource.crystal')}
              className="size-3.5 object-contain"
            />
            {compact(cost.crystal)}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * A SATELLITE'S BODY, WHICH IS NOT A LADDER. D25.
 *
 * There is exactly one thing to say — what it does — and exactly one number that
 * costs the player something they cannot get back cheaply: the SLOT. The Command
 * Core opens slots at 1, 3, 5 and 9, so on a young planet putting this up is
 * choosing it over the other three, and the sheet says so in as many words rather
 * than letting the player discover it from a refusal.
 */
function Orbital({
  id,
  cost,
  slots,
  used,
}: {
  id: SatelliteId;
  cost: { alloy: number; crystal: number };
  slots: number;
  used: number;
}) {
  const { t } = useTranslation();
  const free = Math.max(0, slots - used);
  const gain = satelliteGain(id);

  return (
    <div className="mt-6">
      <p className="legend mb-2">{t('itemSheet.orbitalDoesHeading')}</p>
      <div className="plate plate-inset p-3">
        <p className="num text-body">
          <span className="text-faint">{gain.label} </span>
          <span className="text-bone">{gain.next}</span>
        </p>
        {gain.unlocks && (
          <p className="mt-1 text-label leading-snug text-crystal/80">{gain.unlocks}</p>
        )}
      </div>

      <p className="legend mb-2 mt-6">{t('itemSheet.orbitalCostHeading')}</p>
      <div className="plate plate-inset p-3">
        {/*
          THE ORE PRICE LIVES HERE BECAUSE THERE IS NO RUNG TO PUT IT ON.
          An instrument's ladder prints a price beside every level. A satellite has
          no levels, so the sheet showed the slot meter and no figure at all — a
          commit surface that never says what it charges.
        */}
        <div className="flex items-center gap-4 border-b border-line-soft pb-3">
          <span className="num flex items-center gap-2 text-body text-bone">
            <img
              src={RESOURCE_ART.alloy}
              alt={i18n.t('vocabulary.resource.alloy')}
              className="size-4 object-contain"
            />
            {compact(cost.alloy)}
          </span>
          {cost.crystal > 0 && (
            <span className="num flex items-center gap-2 text-body text-crystal">
              <img
                src={RESOURCE_ART.crystal}
                alt={i18n.t('vocabulary.resource.crystal')}
                className="size-4 object-contain"
              />
              {compact(cost.crystal)}
            </span>
          )}
          <span className="text-caption text-faint">{t('itemSheet.orbitalOnce')}</span>
        </div>

        {/*
          THE SLOTS ARE A RACK, and the same rack the flight bays and the
          telescope draw. This was a fourth hand-rolled row of pips that happened
          to look like the others and could drift from them.
        */}
        <div className="flex items-center justify-between gap-3 pt-3">
          <Tally
            used={used}
            total={Math.max(slots, 1)}
            label={t('itemSheet.orbitalFree', { free, total: slots })}
          />
          <span className={`num text-caption ${free > 0 ? 'text-dim' : 'text-alloy'}`}>
            {free > 0
              ? t('itemSheet.orbitalFree', { free, total: slots })
              : t('itemSheet.orbitalNoSlot')}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── the three kinds, in one place ──────────────────────────── */

const levelOf = (planet: PlanetView, item: ItemRef): number => {
  if (item.kind === 'building') return planet.buildings[item.id] ?? 0;
  if (item.kind === 'instrument') return planet.instruments[item.id] ?? 0;
  // A satellite is up or it is not, and "1" is what every level-shaped control on
  // this sheet reads as "installed".
  return planet.orbit.includes(item.id) ? 1 : 0;
};

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

const gainFor = (item: ItemRef, level: number, levels: BuildingLevels): Gain =>
  item.kind === 'building'
    ? buildingGain(item.id, level, 0, levels)
    : item.kind === 'instrument'
      ? instrumentGain(item.id, level)
      : satelliteGain(item.id);

function artFor(item: ItemRef, level: number): string | null {
  if (item.kind === 'satellite') return SATELLITE_ART[item.id];
  return item.kind === 'instrument' ? instrumentArt(item.id, level) : buildingArt(item.id, level);
}

/**
 * Which rungs of the ladder bring NEW hardware rather than another of the same.
 *
 * No longer decides whether art is drawn — every rung shows its own picture now —
 * only whether that picture is marked as an arrival. Instruments re-tier at L3 and
 * L5, and so do the Command Core, the Vault and the Shipyard; the Refinery and
 * Extractor wear the resource they produce and never light up.
 */
const TIERED_BUILDINGS = new Set<BuildingId>(['CORE', 'VAULT', 'SHIPYARD']);

const tierChangesAt = (item: ItemRef, level: number): boolean =>
  item.kind !== 'satellite' &&
  (item.kind === 'instrument' || TIERED_BUILDINGS.has(item.id)) &&
  tierOf(level) !== tierOf(level - 1);

/**
 * The stand-in for an item with no render.
 *
 * Every instrument and every building has one now, so nothing here is reached in
 * practice — it stays as the well's floor, because an empty art well reads as a
 * broken image rather than as a thing without a picture.
 */
function markFor(item: ItemRef) {
  if (item.kind !== 'building') return null;
  switch (item.id) {
    case 'CORE':
      return <CoreMark />;
    case 'VAULT':
      return <VaultMark />;
    default:
      return null;
  }
}
