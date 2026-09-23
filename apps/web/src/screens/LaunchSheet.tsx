import { useTranslation } from 'react-i18next';
import {
  HULLS,
  combatValue,
  hullFuelRate,
  hullTech,
  fleetCargo,
  salvageCapacity,
  type MobileHullId,
} from '@astera/rules';
import type { GalaxyPlanet, IntelView, PirateContact, PlanetView, Report } from '../api/schemas.js';
import { combatClassLabel, hullLabel } from '../i18n/names.js';
import { compact } from '../lib/format.js';
import { clockTime, duration, durationPrecise, staleness } from '../lib/time.js';
import { MOBILE } from '../lib/navigation.js';
import { familyGroups } from '../lib/roster.js';
import { useAccordion } from '../lib/accordion.js';
import { useLaunchPlan } from '../lib/useLaunchPlan.js';
import { serverNow } from '../lib/clock.js';
import { StatStrip } from '../ui/Action.js';
import { PaceRow } from '../ui/PaceRow.js';
import { SpendBar } from '../ui/SpendBar.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { SalvageIcon } from '../ui/icons/index.js';
import { FleetLossWarning } from '../ui/ForceCompare.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Icon } from '../v2/icons.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { ForceRuler } from '../v2/kit/ForceRuler.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { MatchupLine } from '../v2/kit/MatchupLine.js';
import { Sheet } from '../v2/kit/Sheet.js';

/**
 * WHAT A FLEET CAN BE COMMITTED AT. D150.
 *
 * Two kinds of target and ONE commitment surface, because to a commander they are
 * one decision: ships leave, the world is uncovered for the round trip, the fuel
 * is paid up front. A pirate had its own picker in the focus rail, and that second
 * surface quietly dropped most of what makes this screen a decision rather than a
 * form — the hull stats a counter cycle is chosen with, the cargo the haul is capped
 * by, the fuel drawn against the tank, the ships already away.
 *
 * THE FOG SHAPE IS THE SAME TOO, which is what makes one component honest rather
 * than merely convenient. A world is RESOLVED or UNKNOWN; a pirate is IDENTIFIED
 * or CONTACT. Either way a commander may commit a fleet at something they cannot
 * read, and either way this screen must refuse to invent the half they were not
 * sold. Everything below that is target-specific is exactly that: the half the
 * reading buys.
 */
export type LaunchTarget =
  | { kind: 'world'; world: GalaxyPlanet }
  | { kind: 'pirate'; pirate: PirateContact };

/**
 * THE COMMITMENT, IN THE ONE ANATOMY. Spec B14, E3 (docs/ui-v2/gozlemevi.md).
 *
 * Head (verb and target) · the force ruler with the matchup line and the tank ·
 * the ships · what they carry · the pace · the flight in figures · and under them
 * the price — what stays home, whether it can be turned — written before the
 * button, which is HELD (K4). There is no second screen: the old confirmation
 * step's lines are always here, because a price read after the decision is not
 * decision support.
 *
 * Every rule lives in `useLaunchPlan`; this file only draws it.
 */
export function LaunchSheet({
  target,
  planet,
  intel,
  reports = [],
  onClose,
  onLaunched,
  onAim,
}: {
  target: LaunchTarget;
  planet: PlanetView;
  /**
   * THE DOSSIER'S OWN READINGS, so this sheet can put the target's defence on the
   * same axis as the fleet being packed. Optional, and its absence is a real state:
   * a commander who has never probed this world gets no enemy band, which is the
   * honest picture and the reason to buy one.
   */
  intel?: IntelView | undefined;
  /** The commander's battle reports, for what the last raid at this world sank. D199. */
  reports?: readonly Report[];
  onClose: () => void;
  onLaunched: () => void;
  /**
   * WHERE THE CHOSEN WING WOULD MEET A MOVING TARGET, for the disc to draw. D155.
   * `null` whenever there is nothing to draw.
   */
  onAim?: (at: { x: number; y: number; z: number } | null) => void;
}) {
  const { t } = useTranslation();
  const {
    sending, set, roomFor, allowance, lesson, season, spendsShield, pirate, mods,
    paces, pace, setWantedPace, route, total, salvageRoom, baysFree, tooLate, busy,
    holding, away, atHome, recordAge, opposing, lines, loss, escape, notes, refusal,
    commit, classReading,
  } = useLaunchPlan({ target, planet, intel, reports, onLaunched, onAim });

  /**
   * ONE HULL'S ROW: the ship, its class, the four numbers it is chosen on, and the
   * stepper. `available` is what stands here and what the row prints; `roomFor` is
   * the lesson's ceiling and what the stepper obeys. A hull the lesson does not
   * want keeps its row with every control dead — owner correction: hiding the
   * captured Warden made the commander's prize vanish from the one screen that
   * lists their fleet.
   */
  const row = (hull: MobileHullId) => {
    const available = planet.fleet[hull] ?? 0;
    if (available === 0) return null;
    const chosen = sending[hull] ?? 0;
    const tech = hullTech(mods.tech, hull);
    const art = HULL_ART[hull];
    return (
      <div
        key={hull}
        data-hull-row={hull}
        className={`grid gap-2 border-b border-v2-line px-1 py-2.5 last:border-b-0 ${chosen > 0 ? 'bg-v2-self/5' : ''}`}
      >
        <div className="flex items-center gap-2.5">
          <div data-art className="grid size-10 shrink-0 place-items-center rounded-control border border-v2-line bg-v2-raise">
            {art ? (
              <img src={art} alt="" aria-hidden className="size-9 object-contain" width={36} height={36} loading="lazy" />
            ) : (
              <HullMark hull={hull} className="size-6 text-v2-ink-3" />
            )}
          </div>
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex items-baseline gap-1.5">
              <p className="truncate text-caption font-semibold text-v2-ink">{hullLabel(hull)}</p>
              {/*
                THE ROLE IT FIGHTS AS, not the band it was bought under. D124: the
                picker groups by family, which says nothing about how a hull fights.
              */}
              <span className="flex shrink-0 items-center gap-1 text-micro text-v2-ink-3">
                <ClassEmblem cls={HULLS[hull].cls} className="size-2.5" decorative />
                {combatClassLabel(HULLS[hull].cls)}
              </span>
              <span className="ml-auto shrink-0 font-v2-mono text-micro text-v2-ink-3">
                {t('launch.atHome', { count: available })}
              </span>
            </div>
            <StatStrip
              atk={HULLS[hull].atk * tech.atk}
              hp={HULLS[hull].hp * tech.hp}
              speed={HULLS[hull].speed * tech.speed}
              cargo={fleetCargo({ [hull]: 1 }, mods.tech)}
              salvage={salvageCapacity({ [hull]: 1 })}
              fuel={hullFuelRate(hull)}
              showLabels
            />
          </div>
        </div>
        <QuantityStepper
          value={chosen}
          min={0}
          max={roomFor(hull)}
          onChange={(value) => { set(hull, value); }}
          decreaseLabel={t('launch.fewer', { name: hullLabel(hull) })}
          increaseLabel={t('launch.more', { name: hullLabel(hull) })}
          valueLabel={t('launch.quantity', { name: hullLabel(hull) })}
          editable
          maxLabel={t('launch.max', { name: hullLabel(hull) })}
          maxText={t('launch.maxShort')}
        />
      </div>
    );
  };

  /** The roster's own families, in the shipyard's order; a family with nothing here gets no heading. */
  const groups = familyGroups(MOBILE.filter((hull) => (planet.fleet[hull] ?? 0) > 0));

  /**
   * THE LESSON'S OWN READING ORDER, or null outside a lesson: the kept-back prize
   * first, then the hulls the lesson wants in the order `academyLessonFleet` names
   * them, so the Max presses the hand teaches run top to bottom.
   */
  const lessonOrder = allowance === null ? null : [
    ...MOBILE.filter((hull) => (planet.fleet[hull] ?? 0) > 0 && roomFor(hull) === 0),
    ...Object.keys(allowance).filter((hull): hull is MobileHullId =>
      MOBILE.includes(hull as MobileHullId) && roomFor(hull as MobileHullId) > 0),
  ];

  /**
   * WHICH BANDS ARE OPEN. One on arrival (the first with anything in it), the rest
   * folded with their counts, so the shape of a twenty-hull roster arrives in one
   * screen. Held as a set so opening one never shuts another: comparing a
   * Skirmisher with a Bulwark needs both on screen.
   */
  const families = useAccordion('launch', groups[0] ? [groups[0].family] : []);

  const landsAt = route !== null && route.oneWayMinutes > 0
    ? clockTime(new Date(serverNow() + route.oneWayMinutes * 60_000))
    : null;

  return (
    <Sheet
      detents={['full']}
      /*
        WHAT THIS READING IS, AND HOW OLD. A world's provenance is its record age; a
        pirate is never remembered (D150), so what belongs here is how long it will
        still be out there.
      */
      eyebrow={pirate
        ? t('launch.eyebrowPirate', { duration: duration(pirate.expiresInMinutes) })
        : recordAge === null
          ? t('launch.eyebrow')
          : t('launch.eyebrowRecord', { age: staleness(recordAge) })}
      // A world you cannot see has no name to put here (D127): an unsurveyed title, never a blank.
      title={target.kind === 'pirate'
        ? (target.pirate.zone === 'IDENTIFIED' && target.pirate.level !== undefined
            ? t('pirate.name', { level: target.pirate.level, callsign: target.pirate.callsign })
            : t('pirate.unknownContact'))
        : target.world.intel === 'UNKNOWN'
          ? t('focus.planet.unsurveyedTitle')
          : target.world.name}
      onClose={onClose}
      footer={
        <div data-launch-commit className="grid gap-2">
          <FleetLossWarning loss={loss} />
          {/*
            THE PRICE, BEFORE THE BUTTON. What stays home while the fleet is out, and —
            since K8 — whether it can be turned: a raid at a world once, a pirate raid
            never. Nothing is said while nothing is picked: a price for no fleet is noise.
          */}
          {total > 0 && (
            <div className="grid gap-1">
              <p data-launch-warning className="text-caption leading-snug text-v2-ink">
                {pirate ? t('launch.warningPirate', { count: holding }) : t('launch.warningWorld', { count: holding })}
              </p>
              {spendsShield && (
                <p data-shield-warning className="text-caption leading-snug text-v2-warn">
                  {season.data?.shieldKind === 'RECOVERY' ? t('launch.recoveryShieldWarning') : t('launch.shieldWarning')}
                </p>
              )}
              <p className="text-micro leading-snug text-v2-ink-3">
                {!pirate && !lesson && <span data-launch-recall>{t('launch.recallNote')} </span>}
                {/* Fleetsave (D28): a launch is a risk to the world AND the only way to make the fleet safe. */}
                {t('launch.fleetsave')}
              </p>
            </div>
          )}
          <HoldButton
            tone="hostile"
            label={pirate ? t('launch.holdPirate', { count: total }) : t('launch.holdWorld', { count: total })}
            disabledReason={busy ? t('launch.launching') : refusal}
            onCommit={() => { commit(() => undefined); }}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-3 pt-1">
        {/*
          WHAT YOU ARE FLYING AT, ON THE SAME AXIS AS WHAT YOU ARE SENDING (B5), with
          the counter cycle against what the probe read (B6) and the tank the trip
          draws on. Sticky, and the tank inside it — owner correction D183: the two
          figures a wing is adjusted against move on the same "+", so they travel
          together while the ships scroll under them.
        */}
        <div className="sticky top-0 z-10 -mx-3 bg-v2-panel px-3 pb-1">
          <ForceRuler
            yours={combatValue(sending)}
            theirs={opposing}
            lines={lines}
            loss={loss}
            notes={notes}
            escape={escape}
          >
            {classReading && <MatchupLine wing={sending} reading={classReading} />}
            {route !== null && (
              <div data-launch-meters className="mt-2">
                <SpendBar stock={planet.planet.deuterium} spend={route.fuel} tone="deuterium" label={t('launch.fuel')} />
              </div>
            )}
          </ForceRuler>
        </div>

        <section data-launch-fleet className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h3 className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('launch.fleetHeading')}</h3>
            <span className="text-micro text-v2-ink-3">{t('launch.perShipStats')}</span>
          </div>
          {/*
            WHAT IS ALREADY IN THE AIR, DRAWN AS THE SHIPS THEMSELVES. Absent and
            accounted for, which is a different thing from gone.
          */}
          {away.length > 0 && (
            <div data-away className="flex flex-wrap items-center gap-1.5 px-1">
              {away.map((entry) => {
                const art = HULL_ART[entry.hull];
                return (
                  <span
                    key={entry.hull}
                    className="flex items-center gap-1 rounded-chip border border-dashed border-v2-line px-1.5 py-0.5"
                    title={hullLabel(entry.hull)}
                  >
                    {art ? (
                      <img src={art} alt="" aria-hidden className="size-5 object-contain opacity-40 grayscale" loading="lazy" />
                    ) : (
                      <HullMark hull={entry.hull} className="size-4 text-v2-ink-3" />
                    )}
                    <span className="font-v2-mono text-micro text-v2-ink-3">
                      {t('launch.awayHull', { count: entry.count, name: hullLabel(entry.hull) })}
                    </span>
                  </span>
                );
              })}
              <span className="sr-only">
                {t('launch.away', {
                  fleet: away
                    .map((entry) => t('launch.awayHull', { count: entry.count, name: hullLabel(entry.hull) }))
                    .join(t('launch.awaySeparator')),
                })}
              </span>
            </div>
          )}
          {/* A lesson reads as one list, in the order the lesson means; the ordinary picker keeps its bands. */}
          {lessonOrder !== null ? (
            <div className="rounded-control border border-v2-line">{lessonOrder.map(row)}</div>
          ) : (
            groups.map(({ family, hulls }) => {
              // A lone band never folds: hiding the only group costs a tap to save nothing.
              const foldable = groups.length > 1;
              const open = !foldable || families.isOpen(family);
              const count = hulls.reduce((sum, hull) => sum + (planet.fleet[hull] ?? 0), 0);
              const label = t(`planet.reach.family.${family}.label`);
              return (
                <section key={family} data-fleet-family={family} className="overflow-hidden rounded-control border border-v2-line">
                  {foldable ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => { families.toggle(family); }}
                      className="flex w-full items-center gap-2 bg-v2-raise px-2.5 py-1.5 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate text-micro font-semibold uppercase tracking-wide text-v2-ink-2">{label}</span>
                      <span className="font-v2-mono text-micro text-v2-ink-3">{count}</span>
                      <Icon id="i-chev" className={`size-3 text-v2-ink-3 ${open ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                  ) : (
                    <p className="bg-v2-raise px-2.5 py-1.5 text-micro font-semibold uppercase tracking-wide text-v2-ink-2">{label}</p>
                  )}
                  {open && <div className="px-1.5">{hulls.map(row)}</div>}
                </section>
              );
            })
          )}
          {atHome === 0 && <p className="px-1 text-caption text-v2-ink-3">{t('launch.noShips')}</p>}
        </section>

        {/* WHAT THE COLLECTORS WILL LIFT, IF THEY LIVE (D200), and a pirate's one handicap (D124). */}
        {salvageRoom > 0 && (
          <p data-testid="launch-salvage" className="flex items-center gap-2 px-1 text-caption leading-snug text-v2-alloy">
            <SalvageIcon className="size-4 shrink-0" />
            {t('launch.salvage', { amount: compact(salvageRoom) })}
          </p>
        )}
        {pirate?.damageMult !== undefined && (
          <p className="border-l-2 border-v2-crystal/60 pl-2.5 text-caption leading-snug text-v2-crystal">
            {t('pirate.damagePenalty', { percent: Math.round((1 - pirate.damageMult) * 100) })}
          </p>
        )}

        {/*
          HOW FAST TO FLY IT (B10) — and the arrival figure below is what it moves. The
          two rules a player needs here are on the row: the fuel does not move, and
          nothing may stay up past the ceiling. Hidden when only full speed is legal.
        */}
        <PaceRow data-launch-pace paces={paces} pace={pace} onChange={setWantedPace} hint={t('launch.paceHint')} />

        {/*
          THE FLIGHT IN FIGURES. The one-way leg is the one figure quoted to the second
          (D182) — a raid lands at an authoritative instant — with the clock it lands at
          beside it; the exposure is the shape of the bet.
        */}
        <dl data-launch-figures className="grid grid-cols-3 gap-1.5">
          <Figure
            label={t('launch.oneWay')}
            value={route !== null && route.oneWayMinutes > 0 ? durationPrecise(route.oneWayMinutes) : t('launch.oneWayUnknown')}
            {...(landsAt ? { sub: t('now.at', { time: landsAt }) } : {})}
            {...(tooLate ? { tone: 'threat' as const } : {})}
          />
          <Figure
            label={t('launch.exposed')}
            value={route !== null && route.exposureMinutes > 0 ? duration(route.exposureMinutes) : t('launch.oneWayUnknown')}
          />
          <Figure label={t('launch.cargo')} value={compact(route?.cargo ?? 0)} />
          <Figure
            label={t('fleetPage.bays')}
            value={t('launch.baysFree', { count: baysFree })}
            {...(baysFree <= 0 ? { tone: 'threat' as const } : {})}
          />
          <Figure label={t('launch.distance')} value={route === null ? t('launch.oneWayUnknown') : route.distance.toFixed(0)} />
        </dl>
      </div>
    </Sheet>
  );
}

function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Red for a figure that is the reason the commit will refuse. */
  tone?: 'threat';
}) {
  return (
    <div className="rounded-control border border-v2-line bg-v2-panel px-2 py-1.5">
      <dt className="truncate text-micro uppercase tracking-wide text-v2-ink-3">{label}</dt>
      <dd className={`mt-0.5 font-v2-mono text-caption ${tone === 'threat' ? 'text-v2-hostile' : 'text-v2-ink'}`}>{value}</dd>
      {sub && <dd className="font-v2-mono text-micro text-v2-ink-3">{sub}</dd>}
    </div>
  );
}
