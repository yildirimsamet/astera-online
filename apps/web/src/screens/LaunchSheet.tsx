import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COMBAT_HULLS,
  HULLS,
  fleetCount,
  fleetValue,
  hullFuelRate,
  type Fleet,
  type MobileHullId,
} from '@astera/rules';
import { useLaunch, useRaidPirate } from '../api/queries.js';
import type { GalaxyPlanet, IntelView, PirateContact, PlanetView } from '../api/schemas.js';
import { hullLabel } from '../i18n/names.js';
import { compact } from '../lib/format.js';
import { serverNow } from '../lib/clock.js';
import { recordAgeMinutes, sourceLabel } from '../lib/dossier.js';
import { duration, staleness } from '../lib/time.js';
import {
  MOBILE,
  homeDefenceAfter,
  planPirateRoute,
  planRoute,
  techOf,
} from '../lib/navigation.js';
import { familyGroups } from '../lib/roster.js';
import { useAccordion } from '../lib/accordion.js';
import { StatStrip } from '../ui/Action.js';
import { Band } from '../ui/UpgradeRow.js';
import { CapacityBar } from '../ui/CapacityBar.js';
import { SpendBar } from '../ui/SpendBar.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { ClassChip } from '../ui/CounterMark.js';
import { ForceCompare, type ForceReading } from '../ui/ForceCompare.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Button, Sheet } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * WHAT A FLEET CAN BE COMMITTED AT. D150.
 *
 * Two kinds of target and ONE commitment surface, because to a commander they are
 * one decision: ships leave, the world is uncovered for the round trip, the fuel
 * is paid up front and nothing can be recalled. A pirate had its own picker in the
 * focus rail, and that second surface quietly dropped most of what makes this
 * screen a decision rather than a form — the hull stats a counter cycle is chosen
 * with, the cargo the haul is capped by, the fuel drawn against the tank, the
 * hangar, the ships already away, and the confirmation step with the fleetsave
 * line on it.
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
  const launch = useLaunch();
  const raid = useRaidPirate();
  const say = useToast();
  const [sending, setSending] = useState<Fleet>({});
  const [confirming, setConfirming] = useState(false);

  const pirate = target.kind === 'pirate' ? target.pirate : null;
  // The commander's own ladders, off the payload, so the preview quotes exactly
  // what the server will charge and carry. T8.
  const tech = techOf(planet);
  /**
   * THE LEG, AND ONLY ITS OUTBOUND HALF DIFFERS.
   *
   * A world sits still and the client solves its own leg. A pirate is on a closed
   * orbit, so the rendezvous is a numerical solve against a moving target and the
   * SERVER answers it — per hull standing at this world, so the sheet can quote the
   * exact minute for whatever has been picked without a second request. `null`
   * means the slowest ship selected cannot get there at all, which is the same
   * refusal the launch will make.
   */
  const route = target.kind === 'pirate'
    ? planPirateRoute(target.pirate.reach, sending, planet.fleet, planet.ground, tech)
    : planRoute(
        planet.planet.position, target.world.position, sending, planet.fleet, planet.ground, tech,
      );
  const aim = route?.rendezvous ?? null;
  /**
   * HAND THE AIM POINT TO THE DISC, AND TAKE IT BACK ON THE WAY OUT.
   *
   * The cleanup is the load-bearing half: a mark left behind by a closed sheet is
   * a target sitting on the galaxy as though the player had committed to it. It
   * runs on unmount and on every change of the point, so the disc holds at most
   * one, and it is always the one this selection would actually fly to.
   *
   * Depends on the COORDINATES rather than on the object, because `route` is
   * rebuilt on every render and an object identity would republish the same point
   * on each keystroke in the picker.
   */
  useEffect(() => {
    onAim?.(aim);
    return () => { onAim?.(null); };
  }, [onAim, aim?.x, aim?.y, aim?.z]);

  const total = fleetCount(sending);
  /**
   * A LAUNCH TAKES A FLIGHT BAY, and this screen never said so. D28.
   *
   * `assertFreeBay` fires server-side for every launch there is, so a commander
   * with none learned it as a toast after committing — the pirate rail had already
   * been taught to state it, and the rule is not different for a world.
   * `interface.md`: an unavailable action stays visible with its reason.
   */
  const baysFree = Math.max(0, planet.flight.total - planet.flight.used);
  /** It will be gone before anything could reach it. Pirates only: worlds keep. */
  const tooLate = pirate !== null
    && route !== null
    && route.oneWayMinutes >= pirate.expiresInMinutes;
  const busy = launch.isPending || raid.isPending;
  /*
    READ HERE RATHER THAN OFF THE ROUTE, because the garrison is a fact about this
    world and this selection and does not stop being true when there is no route to
    quote — nothing picked yet, or a rendezvous the chosen wing cannot make. Same
    helper both planners use, so the two figures cannot drift on one screen.
  */
  const holding = homeDefenceAfter(planet.fleet, planet.ground, sending);
  /**
   * A RAID AT A WORLD NEEDS SOMETHING THAT CAN FIGHT. Owner report.
   *
   * `launchAttack` refuses a fleet with no combat hull in it — `NOT_A_WARSHIP`,
   * thrown before the transaction even opens — and this sheet did not, so a
   * commander could pack a hold of Couriers, press the one irreversible control
   * in the game, sit through the confirmation step and learn the rule from a red
   * toast. Every other reason this commitment can be refused is already stated on
   * the button before it is pressed; this one was the exception.
   *
   * A PIRATE IS NOT THE SAME TARGET. `launchPirateRaid` takes any mobile hull —
   * sending cargo at a pirate is a bad decision, not an illegal one — so the
   * refusal is scoped to the target that actually carries it.
   */
  const needsWarship = target.kind === 'world'
    && total > 0
    && !COMBAT_HULLS.some((hull) => (sending[hull] ?? 0) > 0);
  const canSend = total > 0
    && route !== null
    && route.oneWayMinutes > 0
    && !tooLate
    && baysFree > 0
    && !needsWarship
    // The server refuses this too; offering a control that cannot work is worse
    // than refusing early, because it teaches a rule that is not true.
    && route.fuel <= planet.planet.deuterium;

  /**
   * WHERE THE REST OF THE FLEET IS. Owner report.
   *
   * `planet.fleet` is only what is STANDING on this world, which is the right
   * number to offer — nothing in the air can be launched again. But a hull that
   * is entirely away loses its row altogether, so the sheet read as a fleet that
   * had shrunk, with nothing on it to say why. A raid is a twelve-minute round
   * trip and a mining run is longer; players forget what they sent.
   *
   * MOBILE hulls only. `fleetAway` also carries Prospectors out on a run, and
   * naming those here would promise a craft this sheet can never send.
   *
   * THE SENTENCE MAY NOT PROMISE A RETURN. `fleetAway` is every unit of this
   * world whose `location` is not `home`, and a transfer or a settlement fleet
   * never comes back — `resolveTransfer` and `resolveSettlement` hand it to the
   * destination world for good. So the caption says what is true of every mission
   * kind: these are away, and only what is standing here can be sent.
   */
  const away = MOBILE.map((hull) => ({ hull, count: planet.fleetAway[hull] ?? 0 })).filter(
    (entry) => entry.count > 0,
  );
  /**
   * Launchable ships at home — NOT `fleetCount(planet.fleet)`, which counts the
   * Prospector too. A world whose only craft at home was a miner showed an empty
   * list and no explanation for it.
   */
  const atHome = MOBILE.reduce((sum, hull) => sum + (planet.fleet[hull] ?? 0), 0);

  const set = (hull: MobileHullId, value: number): void => {
    const available = planet.fleet[hull] ?? 0;
    setSending((current) => ({ ...current, [hull]: Math.max(0, Math.min(available, value)) }));
  };

  /**
   * HOW OLD THE TARGET IS, ON THE SURFACE WHERE THE FLEET STOPS BEING RECALLABLE.
   * D151.
   *
   * The dossier stamps the age on every fact it draws from a record, and the disc
   * label names the record under the world. This sheet — the last screen before an
   * irreversible commitment — said only "Attack", and printed a name and a
   * commander copied out of a frozen silhouette exactly as it prints them for a
   * world under a live Telescope.
   *
   * IT ADDS NO FACT. Every figure on this sheet is one the player had already
   * bought; what was missing was the PROVENANCE of them, which is the half an
   * information game cannot leave off its commitment surface. `null` on a live
   * reading, because a reading has no age and inventing one is the same lie
   * inverted.
   *
   * ON `serverNow()`, LIKE THE DISC LABEL. D51 · D52. `seenAt` is server-authored,
   * so a device `Date.now()` subtracts two different epochs and prints the age plus
   * whatever that phone's clock is wrong by — the same record then read one age
   * under the world and another on the sheet, and the sheet was the wrong one.
   */
  const recordAge = target.kind === 'world'
    ? recordAgeMinutes(target.world, serverNow())
    : null;

  /**
   * WHAT IS STANDING AT THE TARGET, ON THE AXIS THE FLEET IS MEASURED IN.
   *
   * `fleetValue` on both sides, because that is the one quantity a commander can
   * already read of somebody else's world: a probe's defence band IS
   * `fleetValue(homeFleet)`, fuzzed at the look. Until now nothing in the game
   * expressed the player's own ships in the same units, so the band was a figure
   * with nothing to be compared to.
   *
   * THE TWO TARGET KINDS ARE HONESTLY DIFFERENT HERE, and the difference is the
   * whole economy of the intel layer:
   *
   *   · A WORLD is a memory. The band has width (the probe fuzzed it) and an age
   *     (the world has moved on), and both are drawn.
   *   · A PIRATE is current sight. An IDENTIFIED contact hands over its exact
   *     roster, so the reading has no width and no age — a solid bar beside the
   *     world's hatched one, which is what paying for a look buys.
   *
   * Null in every other case, and null draws NO enemy bar. An empty bar would say
   * the target is undefended, on the one screen where that mistake cannot be taken
   * back.
   */
  const opposing: ForceReading | null = (() => {
    if (target.kind === 'pirate') {
      const roster = target.pirate.fleet;
      if (!roster) return null;
      const exact = fleetValue(roster);
      return { low: exact, high: exact, source: sourceLabel('public'), ageMinutes: null };
    }
    const report = intel?.probeReports.find((r) => r.targetPlanetId === target.world.id);
    if (!report) return null;
    return {
      low: report.defence.low,
      high: report.defence.high,
      source: sourceLabel('probe'),
      ageMinutes: Math.max(0, (serverNow() - report.at.getTime()) / 60_000),
    };
  })();

  /**
   * ONE HULL'S ROW IN THE PICKER: the ship, the four numbers, and the stepper.
   *
   * Lifted out of the list so the bands above it are the only thing the layout
   * says — a family loop that also carried eighty lines of row markup would make
   * the grouping the hardest thing on the screen to read.
   */
  const row = (hull: MobileHullId) => {
    const available = planet.fleet[hull] ?? 0;
    const chosen = sending[hull] ?? 0;
    if (available === 0) return null;
    return (
      <div
        key={hull}
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
              <StatStrip
                atk={HULLS[hull].atk}
                hp={HULLS[hull].hp}
                speed={HULLS[hull].speed}
                cargo={HULLS[hull].cargo}
                fuel={hullFuelRate(hull)}
              />
            </div>
          </div>
        </div>

        <div className="mt-2">
          <QuantityStepper
            value={chosen}
            min={0}
            max={available}
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
              disabled={busy}
              onClick={() => {
                if (pirate) {
                  raid.mutate(
                    { pirateId: pirate.id, fleet: sending },
                    {
                      onSuccess: (result) => {
                        say(t('pirate.send', {
                          count: fleetCount(result.fleet),
                          duration: duration(result.flightMinutes),
                        }));
                        onLaunched();
                      },
                      onError: (err) => {
                        say(describe(err), 'error');
                        setConfirming(false);
                      },
                    },
                  );
                  return;
                }
                if (target.kind !== 'world') return;
                launch.mutate(
                  { targetPlanetId: target.world.id, fleet: sending },
                  {
                    onSuccess: (result) => {
                      say(
                        t('launch.launched', {
                          duration: duration(result.exposureMinutes),
                          count: result.homeDefenceAfter,
                        }),
                      );
                      onLaunched();
                    },
                    onError: (err) => {
                      say(describe(err), 'error');
                      setConfirming(false);
                    },
                  },
                );
              }}
            >
              {busy ? t('launch.launching') : t('launch.commit')}
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
            {total === 0
              ? t('launch.chooseFleet')
              : baysFree <= 0
                ? t('launch.noBay')
                : route === null
                  ? (pirate?.reach.length === 0
                      ? t('launch.unreachable')
                      : t('launch.tooSlow'))
                  : tooLate
                    ? t('launch.tooLate')
                    : route.fuel > planet.planet.deuterium
                      ? t('launch.noFuel')
                      : needsWarship
                        ? t('launch.noEscort')
                        : t('launch.send', { count: total })}
          </Button>
        )
      }
    >
      {/*
        WHAT YOU ARE FLYING AT, ON THE SAME AXIS AS WHAT YOU ARE SENDING.

        Directly under the home-defence bar, so the sheet's argument runs in the
        order the decision is actually made: what this costs me at home, what I am
        up against, what the trip costs, and only then which ships go. It reacts to
        the picker exactly as the bar above it does — pressing "+" moves both, which
        is the same cause and effect in two different currencies.

        It states no verdict. The reading is stale, fuzzed and blind to the counter
        cycle, and a sheet that answered "will I win" would end the bet the whole
        game is built on.
      */}
      <ForceCompare yours={fleetValue(sending)} theirs={opposing} />

      {/*
        THE FLIGHT, IN THREE FIGURES AND ONE PICTURE.

        Time, cargo and distance stay as numerals — a duration is one of the few
        quantities that reads faster written than drawn, and the other two have no
        ceiling to draw them against. FUEL has one, and it is the tank: a spend
        against a store is exactly the shape `SpendBar` exists for, and it replaces
        a figure that went red with no way of telling whether the player was ten
        deuterium short or a thousand.
      */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <Figure
          label={t('launch.oneWay')}
          value={
            route !== null && route.oneWayMinutes > 0
              ? duration(route.oneWayMinutes)
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
        THE ONE MODIFIER THE FIGHT HAS, ON THE SURFACE WHERE IT IS PRICED. D124.

        A pirate's whole difference from a player fleet of the same roster is a
        per-level cut to its attack, and it is the reason a PvE prize can be
        affordable at all. IDENTIFIED only — a Radar return has no level to read it
        from, and inventing one here would sell a reading nobody bought.
      */}
      {pirate?.damageMult !== undefined && (
        <p className="mt-3 border-l border-crystal/60 pl-3 text-caption leading-snug text-crystal">
          {t('pirate.damagePenalty', {
            percent: Math.round((1 - pirate.damageMult) * 100),
          })}
        </p>
      )}
      {/*
        THE TWO METERS SHARE A ROW. Owner directive: *"gereksiz progress bar
        tasarımları ile dikey alanı uzatıyoruz."*

        Fuel and hangar are the same SHAPE of fact — a quantity against a ceiling —
        and they were stacked as two full-width blocks, one of them inside a plate
        of its own, for a total of four bars down a sheet that already carries the
        force comparison. Side by side they are the same two readings in half the
        height, and putting them level also states the thing the stack never did:
        these are the two limits on the same launch, and either can be the one that
        stops it.

        They wrap back to full width below ~320px, which is the right degradation —
        a bar too narrow to read is worse than a bar on its own line.
      */}
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
          {planet.capacity && (
            <div className="min-w-[9rem] flex-1">
              <CapacityBar
                className='px-0'
                total={planet.capacity.hangar}
                used={planet.capacity.hangarUsed}
                incoming={0}
                label={t('launch.hangarLabel')}
              />
            </div>
          )}
        </div>
      ) : null}
      {/*
        THE RULE NO PICTURE CAN CARRY: a fleet in the air still occupies this
        world's hangar, so launching frees nothing. One micro line under both
        meters rather than a caption belonging to one of them.
      */}
      {planet.capacity && (
        <p className="mt-2 text-micro leading-snug text-faint">{t('launch.hangarNote')}</p>
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
        {groups.map(({ family, hulls }) => {
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
          const open = !foldable || families.isOpen(family);
          return (
            <section key={family} data-fleet-family={family}>
              <Band
                label={t(`planet.reach.family.${family}.label`)}
                {...(foldable
                  ? {
                    count: hulls.reduce((sum, hull) => sum + (planet.fleet[hull] ?? 0), 0),
                    open,
                    onToggle: () => { families.toggle(family); },
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
