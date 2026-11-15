import { TempoNote } from '../starter/TempoNote.js';
import { useTranslation } from 'react-i18next';
import { RadiationPreview } from '../ui/RadiationPreview.js';
import {
  HULLS,
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
import { namedWall } from '../lib/matchup.js';
import { familyGroups } from '../lib/roster.js';
import { useLaunchPlan } from '../lib/useLaunchPlan.js';
import { serverNow } from '../lib/clock.js';
import { PaceRow } from '../ui/PaceRow.js';
import { EscortRow } from '../ui/EscortRow.js';
import { SpendBar } from '../ui/SpendBar.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { MatchupMark } from '../ui/CounterMark.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { ForceRuler } from '../v2/kit/ForceRuler.js';
import { Figure, Figures } from '../v2/kit/Figure.js';
import { MatchupLine } from '../v2/kit/MatchupLine.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { PirateProfitCard } from '../ui/PirateProfitCard.js';
import { HonorTargetCard } from '../ui/HonorTargetCard.js';
import { useSchoolPresentation } from '../onboarding/flightSchool/presentation.js';
import { GameButton, GameHold, Glyph } from '../game-ui/index.js';

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
  const school = useSchoolPresentation();
  const {
    sending, set, roomFor, allowance, selectionComplete, lesson, season, honorTarget, spendsShield, pirate, mods, radiation,
    paces, pace, setWantedPace, route, fullSpeedRoute, paceReset, total, salvageRoom, baysFree, tooLate, busy,
    escort, escorted, setEscortWanted,
    holding, away, atHome, recordAge, opposing, power, escape, notes, refusal,
    commit, classReading, report, pirateProfit, pirateProfitState,
  } = useLaunchPlan({ target, planet, intel, reports, onLaunched, onAim });
  const choosing = school !== null && !selectionComplete;
  const wall = namedWall(classReading);

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
      <div key={hull} data-hull-row={hull} className="gk-lrow" {...(chosen > 0 ? { 'data-chosen': '' } : {})}>
        <span data-art className="gk-lrow__art">
          {art ? (
            <img src={art} alt="" aria-hidden width={36} height={36} loading="lazy" />
          ) : (
            <HullMark hull={hull} className="gk-lrow__mark" />
          )}
        </span>
        <span className="gk-lrow__name">
          {hullLabel(hull)}
          {/*
            THE ROLE IT FIGHTS AS, not the band it was bought under (D124): the
            emblem, named for a reader; the matchup line above names it in words.
          */}
          <ClassEmblem cls={HULLS[hull].cls} className="gk-lrow__cls" />
          {/* How it meets the class the probe named (F4c); a hull that does not fight meets nothing. */}
          {wall && HULLS[hull].cls !== 'SUPPORT' && <MatchupMark attacker={HULLS[hull].cls} defender={wall} />}
        </span>
        <span className="gk-sub gk-num gk-lrow__info">
          {t('launch.atHome', { count: available })}
          {carries > 0 && (
            <span className="gk-lrow__carry">
              {' · '}
              {chosen > 0
                ? t('launch.cargoAdds', { amount: compact(carries * chosen) })
                : t('launch.cargoEach', { amount: compact(carries) })}
            </span>
          )}
        </span>
        <QuantityStepper
          look="kit"
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
    // A ship flies from the one place and bears its commander's name, which read as the target.
    ...(planet.vessel ? [] : [planet.planet.name]),
    ...(route === null ? [] : [t('launch.range', { d: route.distance.toFixed(0) })]),
    ...(pirate
      ? [t('launch.goneIn', { duration: duration(pirate.expiresInMinutes) })]
      : recordAge === null ? [] : [t('launch.lastSeen', { age: staleness(recordAge) })]),
  ].join(' · ');
  const exposure = route !== null && route.exposureMinutes > 0 ? duration(route.exposureMinutes) : null;

  return (
    <Sheet
      detents={['full']}
      kit={{ tone: 'hostile' }}
      /*
        THE VERB, WHERE FROM AND HOW FAR — then what this reading is and how old. A world's
        provenance is its record age (D151); a pirate's orbit and roster are current
        even after Telescope discovery is remembered, so its deadline leads here.
      */
      eyebrow={eyebrow}
      {...(owned ? {
        lead: (
          <>
            <Glyph id="next" />
            <span
              data-launch-owner
              className="gk-chip gk-launch__owner"
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
        <div data-launch-commit className="gk gk-launch__commit">
          {/*
            THE PRICE, BEFORE THE BUTTON. What stays home while the fleet is out, and —
            since K8 — whether it can be turned: a raid at a world once, a pirate raid
            never. Nothing is said while nothing is picked: a price for no fleet is noise.
          */}
          {total > 0 && !choosing && (
            <div className="gk-launch__price">
              {/* The mock's "Başkent 2 sa 52 dk zayıf kalır": the world and how long; the count is a figure above. */}
              <p data-launch-warning className="gk-launch__warn">
                {exposure === null
                  ? t(pirate ? 'launch.warningPirateOpen' : 'launch.warningWorldOpen', { world: planet.planet.name })
                  : t(pirate ? 'launch.warningPirate' : 'launch.warningWorld', { world: planet.planet.name, duration: exposure })}
              </p>
              {spendsShield && (
                <p data-shield-warning className="gk-launch__warn">
                  {season.data?.shieldKind === 'RECOVERY' ? t('launch.recoveryShieldWarning') : t('launch.shieldWarning')}
                </p>
              )}
              {/* Radyasyon (D10): what the route takes from every ship, or how many it finishes. */}
              <RadiationPreview radiation={radiation} combat />
              <p className="gk-sub">
                {!pirate && !lesson && <span data-launch-recall>{t('launch.recallNote')} </span>}
                {/* Fleetsave (D28): a launch is a risk to the world AND the only way to make the fleet safe. */}
                {planet.vessel ? t('starter.launchFleetsave') : t('launch.fleetsave')}
              </p>
            </div>
          )}
          {/* A launch spends fuel and uncovers the world: the kit's spend weight, one second. */}
          <GameHold
            weight="spends"
            glyph={pirate ? 'pirate' : 'attack'}
            commitSound="impact"
            label={pirate ? t('launch.holdPirate', { count: total }) : t('launch.holdWorld', { count: total })}
            disabledReason={busy ? t('launch.launching') : refusal}
            onCommit={() => { commit(() => undefined); }}
          />
        </div>
      }
    >
      <div className="gk gk-launch">
        {honorTarget.data && <HonorTargetCard value={honorTarget.data} />}
        {honorTarget.isFetching && !honorTarget.data && <p className="gk-sub">{t('leaderboard.honorTarget.loading')}</p>}
        {honorTarget.isError && <div className="gk-launch__retry">
          <p className="gk-sub">{t('leaderboard.honorTarget.unavailable')}</p>
          <GameButton size="sm" glyph="refresh" onPress={() => { void honorTarget.refetch(); }}>{t('leaderboard.honorTarget.retry')}</GameButton>
        </div>}
        {/*
          WHAT YOU ARE FLYING AT, ON THE SAME AXIS AS WHAT YOU ARE SENDING (B5), with
          the counter cycle against what the probe read (B6) and the tank the trip
          draws on. Sticky, and the tank inside it — owner correction D183: the two
          figures a wing is adjusted against move on the same "+", so they travel
          together while the ships scroll under them.
        */}
        {!choosing && <div className="gk-launch__ruler" {...(school ? {} : { 'data-sticky': '' })}>
          <ForceRuler
            power={power}
            theirs={opposing}
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
        </div>}

        {/*
          THE COUNTER CYCLE AGAINST WHAT THE PROBE READ (B6), under the ruler as the mock
          has it — and out of the sticky header, which keeps only what a "+" moves: the
          two strips and the tank. The ships scroll under those, not under a paragraph.
        */}
        {!choosing && classReading && <MatchupLine wing={sending} reading={classReading} />}
        {!choosing && <div><TempoNote aboard={planet.vessel !== undefined} beforeLaunch /></div>}

        <section data-launch-fleet className="gk-launch__fleet">
          {/*
            WHAT IS ALREADY IN THE AIR, DRAWN AS THE SHIPS THEMSELVES. Absent and
            accounted for, which is a different thing from gone.
          */}
          {away.length > 0 && (
            <div data-away className="gk-launch__away">
              {away.map((entry) => {
                const art = HULL_ART[entry.hull];
                return (
                  <span
                    key={entry.hull}
                    className="gk-launch__gone"
                    title={hullLabel(entry.hull)}
                  >
                    {art ? (
                      <img src={art} alt="" aria-hidden loading="lazy" />
                    ) : (
                      <HullMark hull={entry.hull} className="gk-launch__gonemark" />
                    )}
                    <span className="gk-num">
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
          <div className="gk-ledger gk-launch__rows">{(lessonOrder ?? order).map(row)}</div>
          {atHome === 0 && <p className="gk-sub">{t('launch.noShips')}</p>}
        </section>

        {pirate && !lesson && <PirateProfitCard forecast={pirateProfit} state={pirateProfitState}
          radiation={radiation?.kind === 'HP' && radiation.doseHp > 0} />}

        {/* WHAT THE COLLECTORS WILL LIFT, IF THEY LIVE (D200), and a pirate's one handicap (D124). */}
        {salvageRoom > 0 && (
          <p data-testid="launch-salvage" className="gk-inote" data-tone="warn">
            <Glyph id="debris" />
            {t('launch.salvage', { amount: compact(salvageRoom) })}
          </p>
        )}
        {pirate?.damageMult !== undefined && (
          <p className="gk-inote" data-tone="self">
            <Glyph id="pirate" />
            {t('pirate.damagePenalty', { percent: Math.round((1 - pirate.damageMult) * 100) })}
          </p>
        )}

        {/*
          HOW FAST TO FLY IT (B10) — and the arrival figure below is what it moves. The
          two rules a player needs here are on the row: slower saves fuel, and
          nothing may stay up past the ceiling. Hidden when only full speed is legal.
        */}
        {/*
          THE COMMANDER SHIP AS ESCORT (Y9): who flies, what it lends, what a lost battle costs it.
          Above the pace, because its time bonus is part of what the pace row and the figures quote.
        */}
        <EscortRow escort={escort} on={escorted} onChange={setEscortWanted} />
        <PaceRow data-launch-pace paces={paces} pace={pace} onChange={setWantedPace}
          brief={t('launch.paceBrief')} reset={paceReset}
          {...(route && fullSpeedRoute && !lesson && target.kind === 'world' ? {
            comparison: { fuel: route.fuel, fullFuel: fullSpeedRoute.fuel,
              minutes: route.oneWayMinutes, fullMinutes: fullSpeedRoute.oneWayMinutes },
          } : {})} />

        {/*
          THE FLIGHT IN FIGURES (the mock's five). Arrival is the one figure quoted to the
          second (D182) — a raid lands at an authoritative instant — with the clock beside
          it; back is when the world is covered again, and how long it is not; the hold
          stands against the haul the probe read; the bay is counted as it will stand; and
          what stays home is counted and weighed.
        */}
        {!choosing && <Figures data-launch-figures="">
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
        </Figures>}
      </div>
    </Sheet>
  );
}
