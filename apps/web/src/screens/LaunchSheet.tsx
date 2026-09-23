import { useState } from 'react';
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
import { duration, durationPrecise, staleness } from '../lib/time.js';
import {
  MOBILE,
} from '../lib/navigation.js';
import { familyGroups } from '../lib/roster.js';
import { useAccordion } from '../lib/accordion.js';
import { StatStrip } from '../ui/Action.js';
import { PaceRow } from '../ui/PaceRow.js';
import { Band } from '../ui/UpgradeRow.js';
import { SpendBar } from '../ui/SpendBar.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { SalvageIcon } from '../ui/icons/index.js';
import { ClassChip } from '../ui/CounterMark.js';
import { FleetLossWarning, ForceCompare } from '../ui/ForceCompare.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Button, Sheet } from '../ui/kit/index.js';
import { useLaunchPlan } from '../lib/useLaunchPlan.js';

/**
 * WHAT A FLEET CAN BE COMMITTED AT. D150.
 *
 * Two kinds of target and ONE commitment surface, because to a commander they are
 * one decision: ships leave, the world is uncovered for the round trip, the fuel
 * is paid up front and nothing can be recalled. A pirate had its own picker in the
 * focus rail, and that second surface quietly dropped most of what makes this
 * screen a decision rather than a form — the hull stats a counter cycle is chosen
 * with, the cargo the haul is capped by, the fuel drawn against the tank, the
 * ships already away, and the confirmation step with the fleetsave line on it.
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
 * The commitment.
 *
 * This screen is built around one line — home defence after launch, and for how
 * long — because that is the actual bet. A fleet in flight is a fleet that is not
 * defending you, and the player must feel that before pressing the button, not
 * discover it when someone else's fleet lands.
 *
 * There is no recall endpoint and there is not going to be one.
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
   * same axis as the fleet being packed. Owner report: *"Savunma gücü yazıyor ama
   * bunun neye karşılık geldiğini bilmiyorum."*
   *
   * Optional, and its absence is a real state rather than a loading artefact: a
   * commander who has never probed this world gets no enemy bar, which is the
   * honest picture and the reason to buy one.
   */
  intel?: IntelView | undefined;
  /**
   * The commander's battle reports, for what the last raid at this world sank. D199.
   * Optional: a sheet opened before they load simply has one note fewer.
   */
  reports?: readonly Report[];
  onClose: () => void;
  onLaunched: () => void;
  /**
   * WHERE THE CHOSEN WING WOULD MEET A MOVING TARGET, for the disc to draw. D155.
   *
   * Reported upward rather than drawn here because the rendezvous is a point in
   * the galaxy and this is a sheet over it — the same division `InterceptMarks`
   * already keeps for a mining run. `null` whenever there is nothing to draw:
   * nothing selected, a wing that cannot make it, or a target that IS an address
   * and is therefore already on screen with a label under it.
   */
  onAim?: (at: { x: number; y: number; z: number } | null) => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const {
    sending, set, roomFor, allowance, lesson, season, spendsShield, pirate, mods,
    paces, pace, setWantedPace, route, total, salvageRoom, tooLate, busy,
    shipyardRevolt, holding, canSend, away, atHome, recordAge, opposing,
    lines, matchups, hint, loss, escape, notes, refusal, commit,
  } = useLaunchPlan({ target, planet, intel, reports, onLaunched, onAim });

  /**
   * ONE HULL'S ROW IN THE PICKER: the ship, the four numbers, and the stepper.
   *
   * Lifted out of the list so the bands above it are the only thing the layout
   * says — a family loop that also carried eighty lines of row markup would make
   * the grouping the hardest thing on the screen to read.
   */
  const row = (hull: MobileHullId) => {
    /**
     * WHAT IS STANDING HERE, AND WHAT THIS LESSON WILL LET YOU SPEND.
     *
     * They are different numbers and the row needs both. `available` is what is
     * actually standing here and it is what the row prints; `pickable` is the
     * lesson's ceiling and it is what the stepper obeys.
     *
     * A hull the lesson does not want keeps its row with every control dead —
     * owner correction, and the better reading. Hiding the captured Warden made
     * the commander's own prize disappear from the one screen that lists their
     * fleet, minutes after they were told they had won it.
     */
    const available = planet.fleet[hull] ?? 0;
    const pickable = roomFor(hull);
    const chosen = sending[hull] ?? 0;
    const tech = hullTech(mods.tech, hull);
    if (available === 0) return null;
    return (
      <div
        key={hull}
        data-hull-row={hull}
        className={`border-b border-line-soft py-3 px-1 ${chosen > 0 ? 'bg-crystal/[0.05]' : ''}`}
      >
        {/*
          THE SHIP, NOT ITS NAME.
          This picker used to be a name and a speed, which is the one place
          in the game a player is actually choosing between hulls and the one
          place they were given nothing to choose WITH. The counter cycle is
          the whole of combat, and it is decided by these four numbers.
        */}
        <div className="flex items-center gap-2">
          <div data-art className="socket size-12 shrink-0 rounded-control">
            {HULL_ART[hull] ? (
              <img
                src={HULL_ART[hull]}
                alt=""
                aria-hidden
                className="size-11 object-contain"
                width={44}
                height={44}
                loading="lazy"
              />
            ) : (
              <HullMark hull={hull} className="size-7 text-dim" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="name text-bone">
                {hullLabel(hull)}
              </p>
              {/*
                THE ROLE IT FIGHTS AS, not the band it was bought under. D124.

                The picker groups by FAMILY, which is where a hull lives in the
                shipyard and says nothing about how it fights — Pike is Offensive,
                Rampart is Defensive, and the Rampart beats the Pike. Without this
                chip the only taxonomy on the one irreversible screen in the game
                pointed the wrong way.
              */}
              <ClassChip cls={HULLS[hull].cls} />
              <span className="num text-label text-faint">
                {t('launch.atHome', { count: available })}
              </span>
            </div>
            <div className="mt-1">
              <p className="mb-2 text-body leading-relaxed text-dim">{t('launch.perShipStats')}</p>
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
        </div>

        <div className="mt-3">
          <QuantityStepper
            value={chosen}
            min={0}
            max={pickable}
            onChange={(value) => { set(hull, value); }}
            decreaseLabel={t('launch.fewer', { name: hullLabel(hull) })}
            increaseLabel={t('launch.more', { name: hullLabel(hull) })}
            valueLabel={t('launch.quantity', { name: hullLabel(hull) })}
            editable
            maxLabel={t('launch.max', { name: hullLabel(hull) })}
            maxText={t('launch.maxShort')}
          />
        </div>
      </div>
    );
  };

  /**
   * THE PICKER'S BANDS. Owner instruction.
   *
   * Only what is standing on this world, grouped by the roster's own families, so
   * a commander reads Offensive, Defensive, Special, Cargo here exactly as they do
   * in the shipyard. A family this world has nothing of gets no heading.
   */
  const groups = familyGroups(MOBILE.filter((hull) => (planet.fleet[hull] ?? 0) > 0));

  /**
   * THE LESSON'S OWN READING ORDER, or null outside a lesson.
   *
   * Kept-back hulls first — the captured Warden is the commander's prize and
   * belongs where it can be seen, but it is context rather than the task — then
   * the hulls the lesson actually wants, in the order `academyLessonFleet` names
   * them, so the Max presses the hand teaches run top to bottom with no dead row
   * between them. A rule rather than a list: add a hull to a lesson and it sorts
   * itself into the right half.
   */
  const lessonOrder = allowance === null ? null : [
    ...MOBILE.filter((hull) => (planet.fleet[hull] ?? 0) > 0 && roomFor(hull) === 0),
    ...Object.keys(allowance).filter((hull): hull is MobileHullId =>
      MOBILE.includes(hull as MobileHullId) && roomFor(hull as MobileHullId) > 0),
  ];

  /**
   * WHICH BANDS ARE SHOWING THEIR ROWS.
   *
   * Seeded with the FIRST band that has anything in it rather than with a fixed
   * family, because a world holding only transports would otherwise open on an
   * empty Offensive heading and look broken. Held as a set so opening one band
   * never shuts another — a commander comparing a Skirmisher against a Bulwark
   * needs both on screen, and an accordion that allows only one open group makes
   * exactly that comparison impossible.
   *
   * Lazy `useState` initialiser: the seed is read once, so a band the player shuts
   * stays shut when the picker re-renders under them on every keystroke.
   */
  const families = useAccordion('launch', groups[0] ? [groups[0].family] : []);

  return (
    <Sheet
      /*
        WHAT THIS READING IS, AND HOW OLD. Both targets answer, differently.

        A world's provenance is its RECORD AGE — the sheet is the last screen before
        a fleet stops being recallable, so it names how stale the facts under it
        are. A pirate is never remembered (D150): the reading is live by definition
        and has no age, so what belongs here is the other clock — how long the thing
        will still be there, which is the whole reason to hurry.
      */
      eyebrow={pirate
        ? t('launch.eyebrowPirate', { duration: duration(pirate.expiresInMinutes) })
        : recordAge === null
          ? t('launch.eyebrow')
          : t('launch.eyebrowRecord', { age: staleness(recordAge) })}
      /**
       * A WORLD YOU CANNOT SEE HAS NO NAME TO PUT HERE. D127.
       *
       * `name` is omitted for an unsurveyed world and the schema fills it with an
       * empty string, so the single most important commitment surface in the game
       * — the one where a fleet becomes irreversible — opened with a BLANK TITLE.
       * The launch itself is legitimate and stays: diving blind is the choice D127
       * exists to create. What it may not do is look broken while you make it.
       */
      title={target.kind === 'pirate'
        ? (target.pirate.zone === 'IDENTIFIED' && target.pirate.level !== undefined
            ? t('pirate.name', {
                level: target.pirate.level,
                callsign: target.pirate.callsign,
              })
            : t('pirate.unknownContact'))
        : target.world.intel === 'UNKNOWN'
          ? t('focus.planet.unsurveyedTitle')
          : target.world.name}
      onClose={onClose}
      footer={
        <>
        <FleetLossWarning loss={loss} />
        {/*
          A RAID ON A WORLD MAY BE TURNED ONCE WHILE IT FLIES (K8), and the button used to say it
          could not. Stated where the commitment is made; a pirate raid is still final, and the
          Academy has no recall to offer, so neither says anything.
        */}
        {confirming && !pirate && !lesson && (
          <p data-launch-recall className="mb-2 text-caption text-dim">{t('launch.recallNote')}</p>
        )}
        {
        confirming ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t('launch.back')}
            </Button>
            {/*
              TWO ENDPOINTS, ONE BUTTON. A raid at a world and a raid at a pirate
              are different routes because they are different tables — a pirate has
              no address and never became a `missions` row — but they are the same
              commitment, so they are the same control and the same confirmation.
            */}
            <Button
              variant="commit"
              size="sm"
              className="flex-[2]"
              disabled={busy || shipyardRevolt}
              onClick={() => { commit(() => { setConfirming(false); }); }}
            >
              {shipyardRevolt
                ? t('launch.shipyardRevolt')
                : busy ? t('launch.launching') : pirate ? t('launch.commit') : t('launch.commitWorld')}
            </Button>
          </div>
        ) : (
          <Button
            variant="commit"
            size="sm"
            full
            disabled={!canSend}
            onClick={() => {
              setConfirming(true);
            }}
          >
            {/*
              A DISABLED CONTROL STATES ITS OWN REASON, and there are five of them.
              `interface.md`: an unavailable action stays visible with the reason
              on it, because a button that simply will not press teaches nothing.

              THE TWO SPEED REFUSALS ARE NOT THE SAME REFUSAL. An empty reach table
              means nothing standing at this world can catch it; a table with no row
              for the slowest ship SELECTED means this fleet cannot — a faster one
              could. Saying "nothing could" in the second case tells a commander
              their world is helpless when what they need to do is leave the slow
              hull behind.
            */}
            {refusal ?? t('launch.send', { count: total })}
          </Button>
        )
        }
        </>
      }
    >
      {/*
        WHAT YOU ARE FLYING AT, ON THE SAME AXIS AS WHAT YOU ARE SENDING.

        Directly under the home-defence bar, so the sheet's argument runs in the
        order the decision is actually made: what this costs me at home, what I am
        up against, what the trip costs, and only then which ships go. It reacts to
        the picker exactly as the bar above it does — pressing "+" moves both, which
        is the same cause and effect in two different currencies.

        It states no verdict. Since D199 it draws where this wing stops clearing and
        stops breaking a wall — the battle engine's own lines, counter cycle and a
        known shield included — but the reading stays stale and fuzzed and the roll
        is left out, and a sheet that answered "will I win" would end the bet the
        whole game is built on.
      */}
      {/*
        THE COMPARISON AND WHAT THE TRIP COSTS, IN ONE BOX. D183, owner correction:
        *"aynı kutunun içinde altında olsun. güç gösteren kutu sticky, sheet'te
        scroll yapınca yakıt gösteren alan sayfanın üstünde kalıyor."*

        The fuel meter was moved up to sit under this box and that was still wrong:
        the box is `sticky`, so a sibling scrolls out from under a header that stays
        pinned. The two figures a wing is adjusted against — the force it represents
        and the deuterium it burns — both move on the same "+", so they travel
        together or they are not a comparison at all.
      */}
      <ForceCompare
        yours={combatValue(sending)}
        theirs={opposing}
        lines={lines}
        loss={loss}
        notes={notes}
        escape={escape}
      >
        {/*
          THE COUNTER CYCLE, WHERE THE FLEET IS CHOSEN — with the reading's own limit beside it.
          `matchupsAgainst` answers null for a wall the probe never read, so this appears exactly
          when the composition was bought. The caveat lines are not hedging: a majority reading
          genuinely leaves half the wall unmeasured, and that half can carry this wing's counter.
        */}
        {matchups && (
          <div data-launch-matchup className="mt-2 space-y-1">
            <p className="legend text-dim">
              {matchups.kind === 'MIXED'
                ? t('counter.matchupMixed')
                : matchups.kind === 'SPLIT'
                  ? t('counter.matchupSplit')
                  : matchups.wall === null
                    ? t('counter.matchupMixed')
                    : t('counter.matchupMajority', { class: combatClassLabel(matchups.wall) })}
              {matchups.unknownShare > 0 && matchups.kind !== 'MIXED'
                ? ` — ${t('counter.matchupRemainder')}`
                : ''}
            </p>
            {/*
              WHAT THE PROBE ACTUALLY READ, BEFORE ANY OF IT IS ABOUT THE PLAYER'S WING.

              The row below answers "what does MY Bulwark do here" and needs a wing to be keyed
              by; this answers "what is over there", which is the thing the probe was paid for and
              the thing a commander is choosing a wing AGAINST. Without it a full split arrived as
              two percentages hanging off one chip, and a commander who had not picked a ship yet
              saw no distribution at all — the plan's own acceptance test for this surface is that
              a SHARES reading may not silently drop a class.

              The unread remainder rides the same line, because "60% Lance" and "60% Lance and 40%
              I could not see" are different facts and only one of them is true.
            */}
            {matchups.wallShares.length > 0 && (
              <div data-launch-wall className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {matchups.wallShares.map((row) => (
                  <span key={row.cls} className="inline-flex shrink-0 items-center gap-1">
                    <ClassChip cls={row.cls} />
                    {/*
                      A MAJORITY READING'S SHARE IS A FLOOR, AND THE ROW SAYS SO.

                      A par probe cannot tell a pure Lance wall from a 52.6% one — both come back
                      `DOMINANT` — so what it resolved is "at least half". The heading beside it
                      already says "more than half", and a bare 50% told the player two different
                      things on one line. A full split is exact and carries no mark.
                    */}
                    <span className="num text-micro text-bone">
                      {matchups.kind === 'MAJORITY' ? '≥' : ''}{Math.round(row.share * 100)}%
                    </span>
                  </span>
                ))}
                {matchups.unknownShare > 0 && (
                  <span className="num text-micro text-faint">
                    {t('counter.matchupUnread', {
                      share: Math.round(matchups.unknownShare * 100),
                    })}
                  </span>
                )}
              </div>
            )}
            {matchups.rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {matchups.rows.map((row) => (
                  <span key={row.cls} className="inline-flex shrink-0 items-center gap-1">
                    <ClassChip cls={row.cls} />
                    <span className="num text-micro text-dim">
                      {t('counter.matchupExposure', {
                        strong: Math.round(row.strongShare * 100),
                        weak: Math.round(row.weakShare * 100),
                      })}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {/*
              ONE HINT, AND ONLY WHEN IT CHANGES WHAT THE COMMANDER WOULD DO. Congratulating a
              correct choice spends a line to say nothing, and an empty paragraph still takes
              height on a 350-wide screen.
            */}
            {hint !== null && <p className="text-micro text-alloy/80">{hint}</p>}
          </div>
        )}
        {(route !== null) || planet.capacity ? (
          <div data-launch-meters className="mt-2 gap-2">
            {route !== null && (
              <div className="min-w-[9rem] flex-1 flex items-center">
                <SpendBar
                  stock={planet.planet.deuterium}
                  spend={route.fuel}
                  tone="deuterium"
                  label={t('launch.fuel')}
                />
              </div>
            )}
          </div>
        ) : null}
      </ForceCompare>

      {/*
        THE FLIGHT, IN THREE FIGURES AND ONE PICTURE.

        Time, cargo and distance stay as numerals — a duration is one of the few
        quantities that reads faster written than drawn, and the other two have no
        ceiling to draw them against. FUEL has one, and it is the tank: a spend
        against a store is exactly the shape `SpendBar` exists for, and it replaces
        a figure that went red with no way of telling whether the player was ten
        deuterium short or a thousand.
      */}
      {/* Marked so the sheet's block ORDER can be pinned by a test. D183. */}
      <div data-launch-figures className="mt-6 grid grid-cols-3 gap-2">
        {/*
          THE ONE FIGURE ON THIS SCREEN QUOTED TO THE SECOND. D182, owner request.

          A raid lands at an authoritative instant and the whole game is built on
          being there for it, so a flight rounded to the minute hides up to
          fifty-nine seconds of the thing the player is actually committing to.
          `durationPrecise` rather than `duration`, and only here — the exposure
          figure below is a shape of the bet, not a moment to be at.
        */}
        <Figure
          label={t('launch.oneWay')}
          value={
            route !== null && route.oneWayMinutes > 0
              ? durationPrecise(route.oneWayMinutes)
              : t('launch.oneWayUnknown')
          }
          tone={tooLate ? 'threat' : undefined}
        />
        <Figure label={t('launch.cargo')} value={compact(route?.cargo ?? 0)} />
        <Figure
          label={t('launch.distance')}
          value={route === null ? t('launch.oneWayUnknown') : route.distance.toFixed(0)}
        />
      </div>
      {/*
        HOW FAST TO FLY IT — and the rungs are not the point, the ARRIVAL is.

        The figure directly above is what this row moves, which is why it sits under it rather than
        beside the fleet: a commander is choosing between "lands while I sleep" and "lands before I
        leave", and the only honest way to show that is to let them watch the ETA change.

        THE TWO RULES A PLAYER NEEDS AT THIS MOMENT ARE ON THE ROW, not in a wiki: the fuel does
        not move, and nothing may stay up past the ceiling. Without the first, everyone assumes
        slow is cheap (it is in every other game of this shape); without the second, the missing
        rungs on a long flight look like a bug.

        Hidden when only full speed is legal — an immobile wing, or a crossing already past the
        ceiling — which `PaceRow` does itself.
      */}
      <PaceRow
        data-launch-pace
        paces={paces}
        pace={pace}
        onChange={setWantedPace}
        hint={t('launch.paceHint')}
      />
      {/*
        THE ONE MODIFIER THE FIGHT HAS, ON THE SURFACE WHERE IT IS PRICED. D124.

        A pirate's whole difference from a player fleet of the same roster is a
        per-level cut to its attack, and it is the reason a PvE prize can be
        affordable at all. IDENTIFIED only — a Radar return has no level to read it
        from, and inventing one here would sell a reading nobody bought.
      */}
      {/*
        WHAT THE COLLECTORS WILL LIFT, IF THEY LIVE. D200.

        One line, and only when a collector is in the wing: the hold figure above
        says nothing about it (a collector carries no cargo), and a hull whose whole
        purpose is a number the launch never states is a rule the player cannot see
        (D124). "Up to", because it is a ceiling on a wreck nobody has made yet — a
        collector that dies, or a fight that kills little, lifts less.
      */}
      {salvageRoom > 0 && (
        <p
          data-testid="launch-salvage"
          className="mt-3 flex items-center gap-2 text-caption leading-snug text-alloy"
        >
          <SalvageIcon className="size-4 shrink-0" />
          {t('launch.salvage', { amount: compact(salvageRoom) })}
        </p>
      )}
      {pirate?.damageMult !== undefined && (
        <p className="mt-3 border-l border-crystal/60 pl-3 text-caption leading-snug text-crystal">
          {t('pirate.damagePenalty', {
            percent: Math.round((1 - pirate.damageMult) * 100),
          })}
        </p>
      )}

      <div className="mt-6">
        <p className="legend mb-2">{t('launch.fleetHeading')}</p>
        {/*
          WHAT IS ALREADY IN THE AIR, DRAWN AS THE SHIPS THEMSELVES. Owner report.

          This was a joined sentence — "2 Wasp · 1 Hauler away on a flight" — sitting
          above a list of art wells, so the one question it answers ("where did my
          Haulers go") was the only thing on the sheet a player had to READ rather
          than recognise. The same hulls now appear as their own renders, greyed and
          at half size, in a row that is visibly OUTSIDE the picker below it. Absent
          and accounted for, which is a different thing from gone.
        */}
        {away.length > 0 && (
          <div data-away className="mb-3 flex flex-wrap items-center gap-2">
            {away.map((entry) => {
              // Bound to a local: TS narrows an element access by a `const` key,
              // never by a property, so `HULL_ART[entry.hull]` stays `string | null`.
              const art = HULL_ART[entry.hull];
              return (
              <span
                key={entry.hull}
                className="flex items-center gap-1.5 rounded-chip border border-dashed border-line px-2 py-1"
                title={hullLabel(entry.hull)}
              >
                {art ? (
                  <img
                    src={art}
                    alt=""
                    aria-hidden
                    className="size-6 object-contain opacity-40 grayscale"
                    loading="lazy"
                  />
                ) : (
                  <HullMark hull={entry.hull} className="size-5 text-faint" />
                )}
                <span className="num text-label text-faint">
                  {t('launch.awayHull', { count: entry.count, name: hullLabel(entry.hull) })}
                </span>
              </span>
              );
            })}
            <span className="sr-only">
              {t('launch.away', {
                fleet: away
                  .map((entry) =>
                    t('launch.awayHull', { count: entry.count, name: hullLabel(entry.hull) }),
                  )
                  .join(t('launch.awaySeparator')),
              })}
            </span>
          </div>
        )}
        {/*
          A LESSON READS AS ONE LIST, IN THE ORDER THE LESSON MEANS. Owner
          instruction: Warden, Dart, Courier.

          Four band headings over three ships is the "never hold a section open"
          rule broken for nothing, and the banding is not what a tutorial is
          teaching here. What it IS teaching is two Max presses, so the two hulls
          it wants run together at the bottom of the list, in the order
          `academyLessonFleet` names them — and the captured Warden, which the
          lesson will not let you send, sits above them where the commander can
          still see the prize they just won.

          The ordinary picker is untouched: outside a lesson this is `groups` and
          `roster.ts` remains the only statement of the band order.
        */}
        {lessonOrder !== null
          ? lessonOrder.map(row)
          : groups.map(({ family, hulls }) => {
          /*
            THE SAME BAND, IN THE SAME ORDER, AS THE TAB THESE SHIPS WERE BOUGHT ON —
            AND IT FOLDS. Owner instruction.

            No note under it. On the shipyard tab a band teaches what a family is
            for, because that is where the hull is chosen for good; here the player
            already owns them and is picking a wing under a clock. The label alone
            is what carries over.

            The FOLD is what makes that clock survivable. A developed world offers
            close to twenty hulls here, and a commander scrolling four screens to
            find a Cargo band is a commander who has stopped weighing the decision
            and started operating a list. One band is open on arrival and the rest
            state their counts, so the shape of the roster arrives in one screen.

            A LONE BAND NEVER FOLDS (`foldable`): hiding the only group on the sheet
            would cost a tap to save nothing at all.
          */
          const foldable = groups.length > 1;
          const open = lesson !== null || !foldable || families.isOpen(family);
          return (
            <section key={family} data-fleet-family={family}>
              <Band
                label={t(`planet.reach.family.${family}.label`)}
                {...(foldable
                  ? {
                    count: hulls.reduce((sum, hull) => sum + (planet.fleet[hull] ?? 0), 0),
                    open,
                    onToggle: () => { if (!lesson) families.toggle(family); },
                  }
                  : {})}
              />
              {open ? hulls.map(row) : null}
            </section>
          );
          })}
        {atHome === 0 && <p className="text-body text-dim">{t('launch.noShips')}</p>}
      </div>

      {confirming && (
        <>
          <p className="mt-6 text-body leading-relaxed text-threat-ink">
            {t('launch.warning', { count: holding })}
          </p>
          {/*
            AND THE SECOND THING THIS PRESS COSTS. D183, owner instruction: *"Kişi
            kendisi saldırı yapmak isterse uyarı verilir ve kabul ederse kalkanı
            kalkar."*

            Beside the exposure warning rather than in a dialogue of its own,
            because they are two halves of one price — what this launch costs at
            home, and what it costs for the rest of the day. A commander reading
            them apart is reading half a decision.
          */}
          {spendsShield && (
            <p data-shield-warning className="mt-2 text-body leading-relaxed text-alloy">
              {/*
                NAMED, BECAUSE THE TWO COST DIFFERENT THINGS TO GIVE UP. The first
                day never comes back; a recovery window can be earned again by
                losing badly again. A confirmation that called one the other would
                misprice the decision it exists to price.
              */}
              {season.data?.shieldKind === 'RECOVERY'
                ? t('launch.recoveryShieldWarning')
                : t('launch.shieldWarning')}
            </p>
          )}
          {/*
            THE CHEAPEST DEPTH IN THE GAME. D28.

            A fleet in flight is already untouchable — nothing can be raided that is
            not on the ground — and the player was never told. In OGame this same
            rule is called fleetsave and it took their players years to discover on
            their own; it is the single most important behaviour in that game and
            nobody designed it.

            Saying it out loud turns an existing rule into a strategy, and it makes
            the sentence above cut both ways: a launch is a risk to your planet AND
            the only way to make your fleet safe. That is a real decision, and it
            costs one line of text.
          */}
          <p className="mt-2 text-body leading-relaxed text-dim">{t('launch.fleetsave')}</p>
        </>
      )}
    </Sheet>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  /** Red for a figure that is the reason the commit will refuse. */
  tone?: 'threat';
}) {
  return (
    <div>
      <p className="legend">{label}</p>
      <p className={`num mt-1 text-title ${tone === 'threat' ? 'text-threat-ink' : 'text-bone'}`}>
        {value}
      </p>
    </div>
  );
}
