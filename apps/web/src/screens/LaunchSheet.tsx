import { useTranslation } from 'react-i18next';
import {
  HULLS,
  combatValue,
  fleetCargo,
  type MobileHullId,
} from '@astera/rules';
import type { GalaxyPlanet, IntelView, PirateContact, PlanetView, Report } from '../api/schemas.js';
import { rivalColour } from '../galaxy/PlanetField.js';
import { hullLabel } from '../i18n/names.js';
import { compact } from '../lib/format.js';
import { lootEstimate } from '../lib/lootEstimate.js';
import { clockTime, duration, durationPrecise, staleness } from '../lib/time.js';
import { MOBILE, homePowerAfter } from '../lib/navigation.js';
import { familyGroups } from '../lib/roster.js';
import { useLaunchPlan } from '../lib/useLaunchPlan.js';
import { serverNow } from '../lib/clock.js';
import { PaceRow } from '../ui/PaceRow.js';
import { SpendBar } from '../ui/SpendBar.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { SalvageIcon } from '../ui/icons/index.js';
import { FleetLossWarning } from '../ui/ForceCompare.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { ForceRuler } from '../v2/kit/ForceRuler.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { Figure, Figures } from '../v2/kit/Figure.js';
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
 * A world may be RESOLVED or UNKNOWN when attacked. A pirate must be identified
 * by Telescope before this commitment surface can open; its reading can then be
 * remembered beyond the current sensor circle.
 */
export type LaunchTarget =
  | { kind: 'world'; world: GalaxyPlanet }
  | { kind: 'pirate'; pirate: PirateContact };

/**
 * THE COMMITMENT, IN THE ONE ANATOMY. Spec B14, E3 (docs/ui-v2/gozlemevi.md), drawn as
 * the mock draws it (M3, owner 2026-09-25).
 *
 * Head (the verb, where it flies from and how far; then whose world) · the force ruler
 * with the matchup line and the tank · the ships, one run of rows · what they carry ·
 * the pace · the flight in five figures — arrival, back, cargo against the haul, the
 * bay, what stays home · and under them the price — how long the world stays thin,
 * whether it can be turned — written before the button, which is HELD (K4). There is
 * no second screen: a price read after the decision is not decision support.
 *
 * THE TANK STAYS ON THE RULER (owner correction D183): the two figures a wing is
 * adjusted against move on the same "+", so the summary does not quote it again.
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
    commit, classReading, report,
  } = useLaunchPlan({ target, planet, intel, reports, onLaunched, onAim });

  /**
   * ONE HULL'S ROW, AS THE MOCK DRAWS IT: the ship, its class, how many stand ready,
   * and the stepper. What a wing is worth here is the ruler's job above, the stats the
   * shipyard's; a hull that carries rather than fires says what it adds to the hold,
   * because the hold is what it is sent for. `available` is what stands here; `roomFor`
   * is the lesson's ceiling and what the stepper obeys. A hull the lesson does not want
   * keeps its row with every control dead — owner correction: hiding the captured
   * Warden made the commander's prize vanish from the one screen that lists their fleet.
   */
  const row = (hull: MobileHullId) => {
    const available = planet.fleet[hull] ?? 0;
    if (available === 0) return null;
    const chosen = sending[hull] ?? 0;
    const art = HULL_ART[hull];
    const carries = HULLS[hull].atk <= 0 ? fleetCargo({ [hull]: 1 }, mods.tech) : 0;
    return (
      <div
        key={hull}
        data-hull-row={hull}
        className={`grid gap-1 border-b border-v2-line/70 px-1 py-1.5 last:border-b-0 ${chosen > 0 ? 'bg-v2-self/5' : ''}`}
      >
        <div className="flex items-center gap-2">
          <div data-art className="grid size-8 shrink-0 place-items-center">
            {art ? (
              <img src={art} alt="" aria-hidden className="size-8 object-contain" width={32} height={32} loading="lazy" />
            ) : (
              <HullMark hull={hull} className="size-6 text-v2-ink-3" />
            )}
          </div>
          <div className="grid min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1 text-caption font-semibold text-v2-ink">
              <span className="truncate">{hullLabel(hull)}</span>
              {/*
                THE ROLE IT FIGHTS AS, not the band it was bought under (D124): the
                emblem, named for a reader; the matchup line above names it in words.
              */}
              <ClassEmblem cls={HULLS[hull].cls} className="size-2.5 shrink-0 text-v2-ink-2" />
            </p>
            <span className="truncate font-v2-mono text-micro text-v2-ink-3">
              {t('launch.atHome', { count: available })}
              {carries > 0 && (
                <span className="text-v2-ink-2">
                  {' · '}
                  {chosen > 0
                    ? t('launch.cargoAdds', { amount: compact(carries * chosen) })
                    : t('launch.cargoEach', { amount: compact(carries) })}
                </span>
              )}
            </span>
          </div>
          <QuantityStepper
            look="v2"
            value={chosen}
            min={0}
            max={roomFor(hull)}
            onChange={(value) => { set(hull, value); }}
            decreaseLabel={t('launch.fewer', { name: hullLabel(hull) })}
            increaseLabel={t('launch.more', { name: hullLabel(hull) })}
            valueLabel={t('launch.quantity', { name: hullLabel(hull) })}
            maxLabel={t('launch.max', { name: hullLabel(hull) })}
            maxText={t('launch.maxShort')}
          />
        </div>
      </div>
    );
  };

  /**
   * ONE RUN, IN THE SHIPYARD'S ORDER (the roster's families, flattened). The bands that
   * folded it were for a picker with nothing above it; the mock lists what stands home.
   */
  const order = familyGroups(MOBILE.filter((hull) => (planet.fleet[hull] ?? 0) > 0)).flatMap((group) => group.hulls);

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

  const landsAt = route !== null && route.oneWayMinutes > 0
    ? clockTime(new Date(serverNow() + route.oneWayMinutes * 60_000))
    : null;
  /** When the world is covered again: the mock's "Dönüş 23:06". */
  const homeAt = route !== null && route.exposureMinutes > 0
    ? clockTime(new Date(serverNow() + route.exposureMinutes * 60_000))
    : null;
  /** The haul the probe read, against the hold picked (a world only; nobody looked, no figure). */
  const loot = lootEstimate(report, route?.cargo ?? fleetCargo(sending, mods.tech));
  /** Whose world, and the mark it wears (D183): the mock's "→ [VEX] Kestrel". */
  const owned = target.kind === 'world' && target.world.intel !== 'UNKNOWN' && target.world.owner !== ''
    ? target.world
    : null;
  const rivalSlot = owned ? season.data?.rivals.find((mark) => mark.planetId === owned.id)?.slot ?? null : null;
  const eyebrow = [
    t('launch.eyebrow'),
    planet.planet.name,
    ...(route === null ? [] : [t('launch.range', { d: route.distance.toFixed(0) })]),
    ...(pirate
      ? [t('launch.goneIn', { duration: duration(pirate.expiresInMinutes) })]
      : recordAge === null ? [] : [t('launch.lastSeen', { age: staleness(recordAge) })]),
  ].join(' · ');
  const exposure = route !== null && route.exposureMinutes > 0 ? duration(route.exposureMinutes) : null;

  return (
    <Sheet
      detents={['full']}
      /*
        THE VERB, WHERE FROM AND HOW FAR — then what this reading is and how old. A world's
        provenance is its record age (D151); a pirate's orbit and roster are current
        even after Telescope discovery is remembered, so its deadline leads here.
      */
      eyebrow={eyebrow}
      {...(owned ? {
        lead: (
          <>
            <span aria-hidden className="text-v2-ink-3">→</span>
            <span
              data-launch-owner
              className="max-w-[8rem] shrink-0 truncate rounded-chip border border-v2-line px-1.5 py-0.5 text-micro font-semibold text-v2-ink-2"
              {...(rivalSlot === null ? {} : { style: { color: rivalColour(rivalSlot), borderColor: rivalColour(rivalSlot) } })}
            >
              {owned.owner}
            </span>
          </>
        ),
      } : {})}
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
              {/* The mock's "Başkent 2 sa 52 dk zayıf kalır": the world and how long; the count is a figure above. */}
              <p data-launch-warning className="text-caption leading-snug text-v2-warn">
                {exposure === null
                  ? t(pirate ? 'launch.warningPirateOpen' : 'launch.warningWorldOpen', { world: planet.planet.name })
                  : t(pirate ? 'launch.warningPirate' : 'launch.warningWorld', { world: planet.planet.name, duration: exposure })}
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
        <div className="sticky top-0 z-10 -mx-3 border-b border-v2-line bg-v2-panel px-3 pb-2.5">
          <ForceRuler
            yours={combatValue(sending)}
            theirs={opposing}
            lines={lines}
            loss={loss}
            notes={notes}
            escape={escape}
            heading={t('dossier.page.power')}
          >
            {route !== null && (
              <div data-launch-meters>
                <SpendBar inline stock={planet.planet.deuterium} spend={route.fuel} tone="deuterium" label={t('launch.fuel')} />
              </div>
            )}
          </ForceRuler>
        </div>

        {/*
          THE COUNTER CYCLE AGAINST WHAT THE PROBE READ (B6), under the ruler as the mock
          has it — and out of the sticky header, which keeps only what a "+" moves: the
          two strips and the tank. The ships scroll under those, not under a paragraph.
        */}
        {classReading && <div className="px-1"><MatchupLine wing={sending} reading={classReading} /></div>}

        <section data-launch-fleet className="grid gap-1.5">
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
          {/* A lesson reads in the order the lesson means; the ordinary picker in the shipyard's. */}
          <div>{(lessonOrder ?? order).map(row)}</div>
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
        <PaceRow data-launch-pace paces={paces} pace={pace} onChange={setWantedPace} brief={t('launch.paceBrief')} />

        {/*
          THE FLIGHT IN FIGURES (the mock's five). Arrival is the one figure quoted to the
          second (D182) — a raid lands at an authoritative instant — with the clock beside
          it; back is when the world is covered again, and how long it is not; the hold
          stands against the haul the probe read; the bay is counted as it will stand; and
          what stays home is counted and weighed.
        */}
        <Figures data-launch-figures="">
          <Figure
            label={t('launch.arrive')}
            value={route !== null && route.oneWayMinutes > 0 ? durationPrecise(route.oneWayMinutes) : t('launch.oneWayUnknown')}
            {...(landsAt ? { sub: t('now.at', { time: landsAt }) } : {})}
            {...(tooLate ? { tone: 'threat' as const } : {})}
          />
          <Figure
            label={t('launch.homeLabel')}
            value={homeAt ?? t('launch.oneWayUnknown')}
            {...(exposure === null ? {} : { sub: t('launch.exposedShort', { duration: exposure }) })}
          />
          <Figure
            label={t('launch.cargo')}
            value={compact(route?.cargo ?? fleetCargo(sending, mods.tech))}
            {...(loot ? {
              sub: t('launch.lootSub', {
                band: loot.decisive.low === loot.decisive.high
                  ? compact(loot.decisive.low)
                  : `${compact(loot.decisive.low)}${t('units.rangeJoin')}${compact(loot.decisive.high)}`,
              }),
            } : {})}
          />
          <Figure
            label={t('launch.bay')}
            value={`${String(Math.min(planet.flight.total, planet.flight.used + (baysFree > 0 ? 1 : 0)))} / ${String(planet.flight.total)}`}
            sub={baysFree > 0 ? t('launch.bayThis') : t('launch.bayNone')}
            {...(baysFree <= 0 ? { tone: 'threat' as const } : {})}
          />
          <Figure
            label={t('launch.stays')}
            value={t('launch.staysUnits', { count: holding })}
            sub={t('launch.staysPower', { value: compact(homePowerAfter(planet.fleet, planet.ground, sending)) })}
          />
        </Figures>
      </div>
    </Sheet>
  );
}
