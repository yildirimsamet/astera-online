import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allowedPaces,
  type MissionPace,
  COMBAT_HULLS,
  ENGAGEMENT_MS,
  fleetCount,
  salvageCapacity,
  hpRadiationApplies,
  type Fleet,
  type MobileHullId,
} from '@astera/rules';
import { useGalaxy, useLaunch, useRaidPirate, useSeason } from '../api/queries.js';
import type { IntelView, PlanetView, Report } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { recordAgeMinutes } from '../lib/dossier.js';
import { duration } from '../lib/time.js';
import {
  MOBILE,
  homeDefenceAfter,
  planPirateRoute,
  planRoute,
  flightModifiers,
} from '../lib/navigation.js';
import { useAcademyLesson } from '../onboarding/lessonScope.js';
import { useTargetReading } from './useTargetReading.js';
import {
  lethalAfterRefusal, radiationRefusalCount, routeRadiation, routeHpRadiation, toHpRadiationSources, toRadiationSources, type RadiationRefusal,
} from './radiation.js';
import { ACADEMY_LEG_SECONDS, academyLessonFleet } from '@astera/rules';
import type { LaunchTarget } from '../screens/LaunchSheet.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * EVERYTHING A LAUNCH DECIDES BEFORE IT IS DRAWN. Spec B14, F3.4a.
 *
 * Lifted verbatim out of `LaunchSheet` so the v2 composer and the sheet it replaces read one
 * statement of the rules — the route and its pace, the fuel, what stays home, the reading of the
 * target, the forecast lines, the escape line, the notes, every reason the launch would be
 * refused, and the commitment itself. It draws nothing.
 */
export function useLaunchPlan({
  target,
  planet,
  intel,
  reports = [],
  onLaunched,
  onAim,
}: {
  target: LaunchTarget;
  planet: PlanetView;
  intel?: IntelView | undefined;
  reports?: readonly Report[];
  onLaunched: () => void;
  onAim?: ((at: { x: number; y: number; z: number } | null) => void) | undefined;
}) {
  const { t } = useTranslation();
  const launch = useLaunch();
  const raid = useRaidPirate();
  const say = useToast();
  const [sending, setSending] = useState<Fleet>({});
  const lesson = useAcademyLesson();
  /**
   * THE COMMANDER'S OWN RAID IMMUNITY, IF THEY STILL HAVE ONE. D183 · 2026-09-14.
   *
   * EITHER SHIELD, because either is spent by this launch: the server composes the
   * first day and the recovery window into one instant and names which is standing.
   *
   * A raid at another COMMANDER's world spends it; a pirate is not a commander and
   * costs nothing (`assertAttackProtections` takes a `defenderPlayerId` and a pirate
   * has none), so the price is only ever quoted on the lane that actually charges
   * it.
   *
   * AND A CARETAKER WORLD IS NOT A COMMANDER EITHER. `target.kind === 'world'` is
   * this file's "the target is a planet" discriminator and says nothing about
   * WHOSE planet — so on its own it quoted the shield against every neutral raid,
   * a cost the server never charges. `mission.ts` decides on exactly the value
   * read here (`defenderPlayerId: target.kind === 'NEUTRAL' ? null : …`), so the
   * two sides now answer from the same discriminator instead of from two
   * different ideas of what a target is.
   *
   * AN UNSURVEYED WORLD STILL PAYS, and that asymmetry is deliberate. `kind` is
   * optional on the public payload, and the safe direction is to WARN: the server
   * refuses an unacknowledged launch outright (`SHIELD_WOULD_DROP`), so a missing
   * warning costs a refusal, while a missing acknowledgement on a real commander's
   * world would be a shield spent on a press that never mentioned it.
   *
   * Read off the season payload rather than the planet's, because the shield
   * belongs to the commander and not to the world the fleet is leaving — the same
   * reason D168 measures the attack band on the commander.
   */
  const season = useSeason();
  const shieldUntil = season.data?.shieldUntil ?? null;
  const spendsShield = target.kind === 'world'
    && target.world.kind !== 'NEUTRAL'
    && shieldUntil !== null
    && shieldUntil.getTime() > serverNow();

  const pirate = target.kind === 'pirate' ? target.pirate : null;
  // The commander's own ladders AND the origin's Beacon, off the payload, so the
  // preview quotes exactly what the server will charge, carry and fly. T8 · D180.
  // Kept per payload: the forecast below keys on `mods.tech`, and a fresh object
  // every render would re-run a few dozen battles for nothing. D199.
  const mods = useMemo(() => flightModifiers(planet), [planet]);
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
  /**
   * HOW FAST THE COMMANDER WANTS THIS TO ARRIVE. Owner decision, 2026-09-21.
   *
   * Held here rather than derived, because it is the one thing on this sheet the player states
   * instead of the sheet computing: the ladder narrows as the wing and the target change, and a
   * rung that stops being legal falls back to full speed rather than refusing the launch.
   */
  const [wantedPace, setWantedPace] = useState<MissionPace>(1);
  const unpaced = target.kind === 'pirate'
    ? planPirateRoute(target.pirate.reach, sending, planet.fleet, planet.ground, mods)
    : planRoute(
        planet.planet.position, target.world.position, sending, planet.fleet, planet.ground, mods,
      );
  /**
   * WORLD TARGETS ONLY, FOR NOW — and the reason is that a quote must not lie.
   *
   * A pirate is on a closed orbit, so its leg is a rendezvous SOLVE against a moving target that
   * the server answers; slowing the wing moves the meeting point, not just the clock. The raid
   * endpoint takes no pace, so offering the rungs here would change the minutes on screen and then
   * fly at full speed. The pirate lane gets this when the intercept solve does.
   *
   * AND NOT DURING A LESSON, for the same reason: the Academy pins its leg to six seconds, so a
   * rung would offer to slow down a flight whose length the tutorial has already decided.
   */
  const paces = target.kind === 'world' && !lesson
    ? allowedPaces(unpaced?.distance ?? 0, sending, mods)
    : [1 as MissionPace];
  const pace = paces.includes(wantedPace) ? wantedPace : 1;
  const paced = useMemo(() => ({ ...mods, pace }), [mods, pace]);
  const planned = target.kind === 'pirate'
    ? planPirateRoute(target.pirate.reach, sending, planet.fleet, planet.ground, paced)
    : planRoute(
        planet.planet.position, target.world.position, sending, planet.fleet, planet.ground, paced,
      );
  const route = lesson && planned ? { ...planned,
    oneWayMinutes: ACADEMY_LEG_SECONDS / 60, exposureMinutes: (ACADEMY_LEG_SECONDS * 2 + 10) / 60 } : planned;
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
   * RADYASYON ON THE WAY OUT, QUOTED BEFORE THE PRESS. Plan D10 · F10.
   *
   * The same dose the server settles at the landing, fed the galaxy's clouds and this leg.
   * World targets only: a pirate raid takes no dose in v1, and the Academy's pinned leg is
   * not the flight the clouds would see. A route that would finish ships makes the hold
   * the commander's acknowledgement, which the server refuses to fly without.
   */
  const galaxy = useGalaxy();
  const clouds = galaxy.data?.radiation;
  const sources = useMemo(() => toRadiationSources(clouds ?? []), [clouds]);
  const hpClouds = galaxy.data?.hpRadiation;
  const hpSources = useMemo(() => toHpRadiationSources(hpClouds ?? []), [hpClouds]);
  const hpModel = galaxy.data?.radiationModel === 'HP'
    || hpRadiationApplies(season.data?.rulesetVersion ?? 0)
    || hpSources.length > 0;
  const departMs = serverNow();
  /*
    THE SERVER'S REFUSAL IS A FORECAST TOO. At a window's edge, or for a cloud about to light,
    the server can find lethal a route this sheet quoted as safe; its count is kept against the
    selection it refused, so the next hold is the acknowledgement it asked for.
  */
  const [refused, setRefused] = useState<RadiationRefusal | null>(null);
  const endpoint = target.kind === 'world' ? target.world.position : route?.rendezvous;
  const arriveMs = departMs + (route?.oneWayMinutes ?? 0) * 60_000;
  const homeMs = departMs + (route?.exposureMinutes ?? 0) * 60_000;
  const hpQuote = hpModel && route !== null && endpoint && !lesson ? routeHpRadiation({ fleet: sending, tech: mods.tech,
    path: [{ from: planet.planet.position, to: endpoint, startMs: departMs, endMs: arriveMs },
      { from: endpoint, to: endpoint, startMs: arriveMs, endMs: arriveMs + ENGAGEMENT_MS },
      { from: endpoint, to: planet.planet.position, startMs: arriveMs + ENGAGEMENT_MS, endMs: homeMs }] }, hpSources) : null;
  const radiation = hpModel ? lethalAfterRefusal(hpQuote, refused, sending) : target.kind === 'world' && route !== null && !lesson
    ? lethalAfterRefusal(routeRadiation({
        fleet: sending,
        from: planet.planet.position,
        to: target.world.position,
        departMs,
        arriveMs: departMs + route.oneWayMinutes * 60_000,
      }, sources), refused, sending)
    : null;
  /** Wreck the chosen collectors can lift, if they come through the fight. D200. */
  const salvageRoom = salvageCapacity(sending);
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
  const shipyardRevolt = (planet.faults ?? []).some(
    (fault) => fault.kind === 'SHIPYARD_REVOLT',
  );
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
    && !shipyardRevolt
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

  /**
   * WHAT A LESSON LETS THE COMMANDER PICK, AND WHY IT IS A CEILING NOT A HINT.
   *
   * The Academy teaches one gesture for filling this picker — press Max — and its
   * hand points at nothing else. So inside a mission lesson the picker may only
   * offer numbers Max is allowed to produce, or the tutorial teaches a gesture
   * that gets the launch refused. It did: the raid lesson wanted two Darts while
   * three were standing, Max sent three, the private API refused it, and the
   * Academy silences toasts — so the commit button simply did nothing.
   *
   * `academyLessonFleet` is the single statement of what each lesson sends, read
   * here and by the Academy's own API, so the picker and the refusal cannot
   * disagree. Outside a lesson this is `null` and the sheet is the ordinary one:
   * everything standing at home, up to what is standing at home.
   */
  const allowance = lesson === 'pirate' || lesson === 'raid' ? academyLessonFleet(lesson) : null;
  const roomFor = (hull: MobileHullId): number => {
    const home = planet.fleet[hull] ?? 0;
    return allowance ? Math.min(home, allowance[hull] ?? 0) : home;
  };

  const set = (hull: MobileHullId, value: number): void => {
    setSending((current) => ({ ...current, [hull]: Math.max(0, Math.min(roomFor(hull), value)) }));
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

  const { report, opposing, lines, matchups, hint, loss, escape, notes } = useTargetReading({
    target,
    intel,
    reports,
    tech: mods.tech,
    wing: sending,
    rulesetVersion: season.data?.rulesetVersion ?? 0,
  });

  /**
   * A DISABLED CONTROL STATES ITS OWN REASON, and there are six of them. `interface.md`: an
   * unavailable action stays visible with the reason on it. Null when the launch can go.
   *
   * THE TWO SPEED REFUSALS ARE NOT THE SAME REFUSAL. An empty reach table means nothing standing
   * at this world can catch it; a table with no row for the slowest ship SELECTED means this fleet
   * cannot — a faster one could.
   */
  const refusal: string | null = shipyardRevolt
    ? t('launch.shipyardRevolt')
    : total === 0
      ? t('launch.chooseFleet')
      : baysFree <= 0
        ? t('launch.noBay')
        : route === null
          ? (pirate?.reach.length === 0 ? t('launch.unreachable') : t('launch.tooSlow'))
          : tooLate
            ? t('launch.tooLate')
            : route.fuel > planet.planet.deuterium
              ? t('launch.noFuel')
              : needsWarship
                ? t('launch.noEscort')
                : null;

  /**
   * THE COMMITMENT. TWO ENDPOINTS, ONE ACT: a raid at a world and a raid at a pirate are
   * different routes because they are different tables, but they are the same commitment.
   * `onRefused` hands a server refusal back to the surface that asked.
   */
  const commit = (onRefused: () => void): void => {
    if (pirate) {
      raid.mutate(
        {
          pirateId: pirate.id,
          fleet: sending,
          ...(radiation !== null && radiation.destroyed > 0 ? { acknowledgeRadiationLoss: true } : {}),
          /*
            THE MINUTE ON THIS SCREEN RIDES THE LAUNCH. D183. A pirate's rendezvous is an
            instantaneous solve, and a table even half a minute old can name a different lap of
            the orbit; the server refuses rather than flying a fleet at an answer nobody read.
            `undefined` when the lesson has overridden the figure: the Academy quotes its own
            flight time and the live server would rightly refuse it.
          */
          ...(lesson || route === null ? {} : { quotedMinutes: route.oneWayMinutes }),
        },
        {
          onSuccess: (result) => {
            say(t('pirate.send', { count: fleetCount(result.fleet), duration: duration(result.flightMinutes) }));
            onLaunched();
          },
          onError: (err) => {
            say(describe(err), 'error');
            const count = radiationRefusalCount(err);
            if (count !== null) setRefused({ count, fleet: sending });
            onRefused();
          },
        },
      );
      return;
    }
    if (target.kind !== 'world') return;
    launch.mutate(
      {
        targetPlanetId: target.world.id,
        fleet: sending,
        /*
          THE ANSWER TO A QUESTION THAT HAS ALREADY BEEN ASKED. D183. Sent only when there is
          actually a shield to spend, so a launch that costs nothing carries no acknowledgement.
        */
        ...(spendsShield ? { acknowledgeShieldLoss: true } : {}),
        pace,
        // The hold on a lethal route is the answer the server asks for (D10).
        ...(radiation !== null && radiation.destroyed > 0 ? { acknowledgeRadiation: true } : {}),
      },
      {
        onSuccess: (result) => {
          say(t('launch.launched', { duration: duration(result.exposureMinutes), count: result.homeDefenceAfter }));
          onLaunched();
        },
        onError: (err) => {
          say(describe(err), 'error');
          const count = radiationRefusalCount(err);
          if (count !== null) setRefused({ count, fleet: sending });
          onRefused();
        },
      },
    );
  };

  return {
    sending, set, roomFor, allowance, lesson, season, spendsShield, pirate, mods,
    paces, pace, setWantedPace, route, total, salvageRoom, baysFree, tooLate, busy, radiation,
    shipyardRevolt, holding, needsWarship, canSend, away, atHome, recordAge, opposing,
    lines, matchups, hint, loss, escape, notes, refusal, commit,
    /** What the probe read of the wall, for the matchup line (B6); null where nobody looked. */
    classReading: report?.classReading ?? null,
    /** The probe's reading of this world, for the haul the hold is set against (E3's cargo). */
    report,
  };
}
