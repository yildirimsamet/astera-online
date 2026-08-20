import { useEffect, useMemo, useState } from 'react';
import {
  useGalaxy,
  useIntel,
  useHarvest,
  useMine,
  useFleetArrivals,
  useMining,
  useMiningArrivals,
  usePending,
  usePlanet,
  useReports,
  useSeason,
  useTraffic,
} from '../api/queries.js';
import type { AsteroidView, MiningRun, MiningView } from '../api/schemas.js';
import { GalaxyCanvas } from '../galaxy/GalaxyCanvas.jsx';
import {
  AsteroidFocus,
  DebrisFocus,
  ContactFocus,
  PlanetFocus,
  RunFocus,
  ThreadFocus,
  minutesLeftFor,
  type Focus,
} from '../galaxy/FocusPanel.jsx';
import { threadKey } from '../galaxy/Fleets.jsx';
import { HomeworldIcon } from '../ui/icons/index.js';
import { haptic } from '../lib/haptics.js';
import { duration, minutesLeft, useNow } from '../lib/time.js';
import { distance, engagementEndsAt, interceptAsteroid, travelMinutes } from '@blindspace/rules';
import { LaunchSheet } from './LaunchSheet.jsx';
import { PlanetScreen } from './PlanetScreen.jsx';
import { IntelScreen } from './IntelScreen.jsx';
import { Sheet } from '../ui/Sheet.js';
import { Button } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';
import { GALAXY_ASSETS, usePreload } from '../lib/preload.js';
import { LoadingScreen } from '../shell/LoadingScreen.js';
import { useArrivals } from '../session/useArrivals.js';
import { serverNow } from '../lib/clock.js';

/**
 * THE GALAXY IS THE GAME. D20.
 *
 * There is no longer anywhere else to be. The canvas is mounted once and never
 * unmounted, it fills everything between the resource header and the in-flight
 * strip, and every other surface in the game — your own planet, its four decision
 * groups, the intel centre, a neighbour's dossier, an asteroid, a squadron in
 * transit — opens over it.
 *
 * The tab bar is gone. It was the last thing insisting the map was a place you
 * VISIT, and D1 has said since the design phase that the information game "makes
 * the 3D galaxy an interface rather than a target list".
 *
 * FOCUS IS THE PRIMITIVE. Tapping anything selects it, points the camera at it —
 * following, if it is moving — and opens a panel stating exactly what the player
 * is entitled to know about that object and how they came to know it.
 */

export type Panel = 'planet' | 'intel' | 'commander' | null;

export function GalaxyView({
  panel,
  onPanel,
  commander,
  onSignOut,
}: {
  /** Opened from the header, which is the only chrome left outside the canvas. */
  panel: Panel;
  onPanel: (panel: Panel) => void;
  /** Who is signed in. Shown on the one surface that is about you rather than the world. */
  commander: string;
  onSignOut: () => void;
}) {
  const galaxy = useGalaxy();
  const planet = usePlanet();
  const intel = useIntel();
  const season = useSeason();
  const pending = usePending();
  const traffic = useTraffic();
  const mining = useMining();
  const reports = useReports();
  const mine = useMine();
  const harvest = useHarvest();
  const say = useToast();
  const now = useNow(5_000);

  /**
   * WAKE UP WHEN SOMETHING LANDS. D48.
   *
   * Both lists are polled on a timer, and a timer is the wrong instrument for an
   * instant the payload already names. Every leg is drawn by an interpolation that
   * CLAMPS, so a craft whose payload is thirty seconds stale is not missing — it is
   * parked on its destination: a squadron hanging over a world it has already
   * finished fighting, a drill sitting at a point its rock left half a minute ago.
   */
  useMiningArrivals(mining.data?.runs);
  useFleetArrivals(pending.data?.pending);

  const [focus, setFocus] = useState<Focus | null>(null);
  /**
   * Whether the focus rail is expanded. Reset to closed on every new selection —
   * a panel that stayed open as the player swept from world to world would undo
   * the whole point of it opening closed.
   */
  const [detail, setDetail] = useState(false);
  const [attacking, setAttacking] = useState(false);
  const [homeSignal, setHomeSignal] = useState(0);

  /**
   * THE DISC COMES UP UNDER A COVER, NOT AFTER ONE. Owner decision.
   *
   * Eleven models have to arrive and decode before the galaxy is smooth, and on a
   * phone that is a second or two of a half-built scene: worlds without their
   * instruments, rocks popping in, a stutter as each hull lands. The canvas is
   * mounted and working the whole time this is up — the cover hides the jank
   * rather than delaying the work, which is the point of it being an overlay and
   * not a gate.
   */
  const assets = usePreload(GALAXY_ASSETS);

  /**
   * AND THE COVER STAYS UNTIL THERE IS A GALAXY UNDER IT. Owner decision.
   *
   * It used to come off on `assets.ready && !galaxy.isPending`, and both halves
   * were early. `assets.ready` means the BYTES arrived — the models still have to
   * be parsed, compiled and uploaded, which is the part a phone shows as worlds
   * popping in one at a time. And `galaxy` is one of four payloads the first frame
   * is drawn from: without `planet` there is no home to centre on, without
   * `season` the rocks cannot be placed on their orbits at all, and without
   * `mining` there is no rock field and no wreckage. The disc was uncovered and
   * then visibly assembled itself.
   *
   * So three things now have to be true: the files are in, every first-paint
   * payload has SETTLED, and the canvas has painted a frame with all of it in
   * (`onReady` — see `FirstFrame`).
   *
   * SETTLED, NOT SUCCEEDED. A failed request must open the door: the surfaces
   * below degrade on their own, and a loading screen that outlives the network is
   * a game nobody can reach.
   */
  const [drawn, setDrawn] = useState(false);
  const dataSettled =
    !galaxy.isPending && !planet.isPending && !season.isPending && !mining.isPending;
  const covered = !(assets.ready && dataSettled && drawn);


  /**
   * THERE IS ALWAYS A DEADLINE, for the reason `preload.ts` gives: a cover with no
   * way out is a game that cannot be reached. `onReady` needs a working WebGL
   * context and a frame loop, and neither is something a player can fix.
   *
   * ARMED ONLY ONCE EVERYTHING ELSE IS IN, so it measures the thing it is actually
   * a net for. Started at mount it was really a timer on the network — a slow
   * first fetch spent the whole allowance before the canvas had been given
   * anything to draw, and the net fired over an empty disc, which is precisely
   * what it exists to prevent.
   */
  const armed = assets.ready && dataSettled;
  useEffect(() => {
    if (drawn || !armed) return;
    const timer = setTimeout(() => {
      setDrawn(true);
    }, 15_000);
    return () => {
      clearTimeout(timer);
    };
  }, [drawn, armed]);

  const planets = useMemo(() => galaxy.data?.planets ?? [], [galaxy.data]);
  const asteroids = useMemo(() => mining.data?.asteroids ?? [], [mining.data]);
  const runs = useMemo(() => mining.data?.runs ?? [], [mining.data]);
  const wrecks = useMemo(() => mining.data?.debris ?? [], [mining.data]);
  const threads = useMemo(() => pending.data?.pending ?? [], [pending.data]);

  /**
   * REFETCH THE MOMENT ANYTHING LANDS.
   *
   * Every list here draws its craft by interpolating between two timestamps, and
   * that interpolation clamps — so a craft whose list has gone stale does not turn
   * for home or disappear, it sits on its target. See `useArrivals`; the instants
   * are gathered here because this is the one place that holds all four lists.
   *
   * A mining run's next event is its arrival on the way out and its landing on the
   * way back, so both are offered and the hook takes whichever is sooner.
   */
  useArrivals(
    useMemo(
      () => [
        ...threads.map((t) => t.arriveAt),
        /**
         * AND THE INSTANT THE BATTLE IS ACTUALLY SETTLED. D44, D45.
         *
         * A raid reaches its target at `arriveAt` and is decided ten seconds
         * later, and only `arriveAt` was offered here. So the one refetch an
         * attacker got landed while the mission was still in flight and nothing
         * had happened yet: the strip still counted a fleet that was over its
         * target, the report did not exist, and the next refresh was whenever a
         * poll or a focus event came along. The player watched the bombardment
         * play out and the interface never acknowledged it.
         *
         * A return leg lands at `arriveAt` with no window at all, and a probe has
         * none either — only an outbound fleet is going to fight.
         */
        ...threads
          .filter((t) => t.kind === 'fleet' && t.leg === 'outbound')
          .map((t) => new Date(engagementEndsAt(t.arriveAt.getTime()))),
        ...runs.map((r) => (r.status === 'returning' ? r.homeAt : r.arriveAt)),
        ...(traffic.data?.contacts ?? []).map((c) => c.endAt),
        /**
         * AND SOMEBODY ELSE'S BATTLE, WHICH IS NOW EVERYBODY'S. D52.
         *
         * A bystander has no pending thread of their own, so nothing here was ever
         * armed for a raid they are only WATCHING — their traffic list polls every
         * twenty seconds, which is twenty seconds of a squadron hanging over a
         * world with its volley finished. Both edges are offered: the landing, so
         * the bombardment starts on the instant, and the settlement, so the wreck
         * of it clears the moment the server says so.
         */
        ...(traffic.data?.contacts ?? []).flatMap((c) =>
          c.engagement ? [c.engagement.arriveAt, c.engagement.endsAt] : [],
        ),
      ],
      [threads, runs, traffic.data],
    ),
  );

  const selected = focus?.kind === 'planet' ? planets.find((p) => p.id === focus.id) : undefined;

  // Selecting your own world opens the planet surface rather than a dossier —
  // there is nothing to find out about a planet you own.
  useEffect(() => {
    if (selected?.isSelf) {
      onPanel('planet');
      setFocus(null);
    }
  }, [selected, onPanel]);

  const close = (): void => {
    setFocus(null);
    setDetail(false);
    setAttacking(false);
  };

  /**
   * FOLLOW WHAT YOU JUST SENT. Owner decision.
   *
   * Committing a fleet is the biggest thing a player does — it cannot be recalled
   * (Principle 3) — and until now the reward for it was a sheet closing and a line
   * of toast. The camera stayed exactly where it was, and the craft the player had
   * just paid for left without them.
   *
   * IT CANNOT BE FOCUSED IMMEDIATELY, and that is the awkward part. A launch
   * returns before the craft exists in any list the disc draws from: the mutation
   * invalidates `pending` or `mining`, the refetch lands a moment later, and only
   * then is there something to point at. So the intent is REMEMBERED and resolved
   * on the first render that actually has the craft in it.
   *
   * Matched on target rather than on id because a thread's key is positional —
   * `threadKey` includes its index — so there is no id a launch could return that
   * would identify it in a list that does not exist yet. A mining run does have
   * one, and uses it.
   */
  const [awaiting, setAwaiting] = useState<
    { kind: 'outbound'; targetName: string } | { kind: 'run'; id: string } | null
  >(null);

  useEffect(() => {
    if (!awaiting) return;

    if (awaiting.kind === 'run') {
      if (runs.some((r) => r.id === awaiting.id)) {
        setFocus({ kind: 'run', id: awaiting.id });
        setAwaiting(null);
      }
    } else {
      const i = threads.findIndex(
        (t) => t.leg === 'outbound' && t.targetName === awaiting.targetName,
      );
      if (i >= 0) {
        setFocus({ kind: 'thread', key: threadKey(threads[i]!, i) });
        setAwaiting(null);
      }
    }
  }, [awaiting, threads, runs]);

  /**
   * Give up after a few seconds rather than hanging on a craft that never arrives.
   * A refused launch, a dropped refetch or a craft that resolved before the list
   * came back would otherwise leave the intent armed, and the NEXT unrelated
   * refetch would snap the camera onto something the player did not ask for.
   */
  useEffect(() => {
    if (!awaiting) return;
    const timer = setTimeout(() => {
      setAwaiting(null);
    }, 8000);
    return () => {
      clearTimeout(timer);
    };
  }, [awaiting]);

  const toggle = (): void => {
    setDetail((open) => !open);
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <GalaxyCanvas
        planets={planets}
        pending={threads}
        contacts={traffic.data?.contacts ?? []}
        watching={(intel.data?.watching ?? []).map((w) => w.targetPlanetId)}
        asteroids={asteroids}
        runs={runs}

        wrecks={wrecks}
        {...(planet.data ? { homePosition: planet.data.planet.position } : { homePosition: undefined })}
        aegisLevel={planet.data?.instruments.AEGIS ?? 0}
        {...(season.data ? { seasonStart: season.data.startsAt } : { seasonStart: undefined })}
        focus={focus}
        onReady={() => {
          setDrawn(true);
        }}
        onFocus={(next) => {
          if (next) haptic('tap');
          setFocus(next);
          setDetail(false);
          setAttacking(false);
        }}
        homeSignal={homeSignal}
      />

      {/* ── the only chrome on the canvas ───────────────────── */}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        {/*
          THE DISC READOUT, TAKEN DOWN A SIZE. Owner decision.

          It is a caption on a map, not a panel: it names what is out there and it
          is read once a session. At `frame px-3 py-2` with a 12px numeral it was
          competing with the worlds for the top-left corner of the only screen the
          game has, on the device the game is aimed at. Smaller box, smaller type,
          and the tracking on the label eased off so it still reads at 9px.
        */}
        <div className="pointer-events-auto frame px-2 py-1">
          <p className="legend text-[9px] tracking-[0.10em]">The disc</p>
          <p className="num mt-0.5 text-[10px] leading-tight text-bone">
            {planets.length} worlds
            {windowsOpen(planets) > 0 && (
              <span className="text-opportunity"> · {windowsOpen(planets)} fleet away</span>
            )}
            {asteroids.length > 0 && (
              <span className="text-crystal"> · {asteroids.length} rocks</span>
            )}
            {/*
              WRECKAGE IS COUNTED HERE BECAUSE IT IS PUBLIC. D32.

              A field is a landmark at a known address with a clock on it, and the
              whole value of the mechanic is that somebody who is not at war notices
              it. Making a player spot amber motes on a dark disc would hide the one
              thing it exists to advertise.
            */}
            {wrecks.length > 0 && (
              <span className="text-alloy">
                {' '}
                · {wrecks.length} {wrecks.length === 1 ? 'wreck' : 'wrecks'}
              </span>
            )}
          </p>
        </div>

        {/*
          HOME, as a mark rather than a word.
          A labelled button in the corner of a map reads as browser chrome — the
          owner's note was that it "looks like a home page". A glyph at low opacity
          is furniture the eye skips until it is wanted, which is exactly the right
          weight for a control that only recovers the camera.
        */}
        <button
          type="button"
          aria-label="Centre on your planet"
          onClick={() => {
            haptic('tap');
            // Going home means letting go of what you were looking at. Leaving the
            // selection in place made the camera ease home and then snap straight
            // back, because a focused subject is followed every frame.
            close();
            setHomeSignal((n) => n + 1);
          }}
          className="pointer-events-auto flex size-10 items-center justify-center rounded-sm border border-line-soft/60 bg-void/35 text-dim backdrop-blur-sm transition-colors hover:border-line hover:text-bone active:scale-95"
        >
          <HomeworldIcon className="size-5" />
        </button>
      </div>

      {/*
        The colour legend that used to sit down here is gone (owner decision). It
        explained the stance colours to a player who had no reason to be reading a
        key — and now that tapping a world says what it is in words, the panel is
        both the explanation and the answer.
      */}

      {/* ── focus ───────────────────────────────────────────── */}

      {focus?.kind === 'planet' && selected && !selected.isSelf && planet.data && !attacking && (
        <PlanetFocus
          target={selected}
          planet={planet.data}
          intel={intel.data}
          reports={reports.data?.reports ?? []}
          now={now}
          onClose={close}
          onLaunched={(targetName) => {
            close();
            setAwaiting({ kind: 'outbound', targetName });
          }}
          onAttack={() => {
            setAttacking(true);
          }}
          onInstallTelescope={() => {
            onPanel('planet');
          }}
          open={detail}
          onToggle={toggle}
        />
      )}

      {focus?.kind === 'debris' && (
        <DebrisFocusHost
          field={(mining.data?.debris ?? []).find((d) => d.id === focus.id)}
          planets={galaxy.data?.planets ?? []}
          runs={runs}
          mining={mining.data}
          homePosition={planet.data?.planet.position}
          busy={harvest.isPending}
          open={detail}
          onToggle={toggle}
          onClose={close}
          onSend={(fieldId, craft) => {
            harvest.mutate(
              { fieldId, craft },
              {
                onSuccess: (r) => {
                  say(`${String(r.craft)} away · ${String(Math.round(r.flightMinutes))}m to the wreck`);
                  close();
                  setAwaiting({ kind: 'run', id: r.runId });
                },
                onError: (err) => {
                  say(describe(err), 'error');
                },
              },
            );
          }}
        />
      )}

      {focus?.kind === 'asteroid' && season.data && (
        <AsteroidFocusHost
          rock={asteroids.find((a) => a.index === focus.index)}
          runs={runs}
          mining={mining.data}
          seasonStart={season.data.startsAt}
          homePosition={planet.data?.planet.position}
          now={now}
          busy={mine.isPending}
          open={detail}
          onToggle={toggle}
          onClose={close}
          onSend={(index, craft) => {
            mine.mutate(
              { asteroidIndex: index, craft },
              {
                onSuccess: (r) => {
                  say(`${String(r.craft)} away · meets the rock in ${String(Math.round(r.flightMinutes))}m`);
                  close();
                  setAwaiting({ kind: 'run', id: r.runId });
                },
                onError: (err) => {
                  say(describe(err), 'error');
                },
              },
            );
          }}
        />
      )}

      {focus?.kind === 'run' &&
        (() => {
          const run = runs.find((r) => r.id === focus.id);
          if (!run) return null;
          const target = run.status === 'returning' ? run.homeAt : run.arriveAt;
          /**
           * A HARVEST HAS NO ROCK. D32.
           *
           * `asteroidIndex` is null on a salvage run, so the rock lookup below can
           * only ever miss — and a miss is what `RunFocus` renders as "Rock has
           * passed". The field is the target, and it is in the same payload.
           */
          const field =
            run.debrisFieldId === null
              ? undefined
              : (mining.data?.debris ?? []).find((d) => d.id === run.debrisFieldId);
          return (
            <RunFocus
              run={run}
              rock={asteroids.find((a) => a.index === run.asteroidIndex)}
              wreck={
                run.targetKind === 'debris'
                  ? field && {
                      planetName: planets.find((p) => p.id === field.planetId)?.name,
                      minutesLeft: field.minutesLeft,
                    }
                  : undefined
              }
              minutesRemaining={target ? minutesLeft(target, now) : 0}
              onClose={close}
              open={detail}
              onToggle={toggle}
            />
          );
        })()}

      {focus?.kind === 'thread' &&
        (() => {
          const index = threads.findIndex((t, i) => threadKey(t, i) === focus.key);
          const thread = threads[index];
          // The thread landed between the tap and the render. Dropping the
          // selection is honest — there is nothing there any more.
          if (!thread) return null;
          return (
            <ThreadFocus
              thread={thread}
              /**
               * OFF THE CLOCK, NOT OFF THE PAYLOAD.
               *
               * `minutesRemaining` is computed on the server at request time and
               * rounded to a whole minute, and `pending` refetches once a minute —
               * so this rail sat on a figure that was up to a minute stale and only
               * ever moved in whole minutes, while the pending strip DIRECTLY BELOW
               * IT counted the same craft down in seconds off `arriveAt`. Two clocks
               * for one fleet, stacked, disagreeing, one of them not moving.
               *
               * `arriveAt` is the instant itself and needs no anchor — the same
               * reasoning as `arrivalOf` in the strip, which is the surface this
               * now agrees with.
               */
              minutesRemaining={minutesLeft(thread.arriveAt, now)}
              onClose={close}
              open={detail}
              onToggle={toggle}
            />
          );
        })()}

      {/* Somebody else's craft. D24: selectable, and readable up to a point. */}
      {focus?.kind === 'contact' &&
        (() => {
          const contact = (traffic.data?.contacts ?? []).find((c) => c.id === focus.id);
          if (!contact) return null;
          return (
            <ContactFocus contact={contact} onClose={close} open={detail} onToggle={toggle} />
          );
        })()}

      {/* ── full surfaces, over the live galaxy ─────────────── */}

      {panel === 'planet' && planet.data && (
        <Sheet
          eyebrow="Your planet"
          title={planet.data.planet.name}
          onClose={() => {
            onPanel(null);
          }}
        >
          <div className="-mx-4">
            <PlanetScreen embedded />
          </div>
        </Sheet>
      )}

      {panel === 'commander' && (
        <Sheet
          eyebrow="Commander"
          title={commander}
          onClose={() => {
            onPanel(null);
          }}
        >
          <CommanderPanel
            galaxy={season.data?.shardName ?? null}
            shard={season.data?.shard ?? null}
            endsAt={season.data?.endsAt ?? null}
            onSignOut={onSignOut}
          />
        </Sheet>
      )}

      {panel === 'intel' && (
        <Sheet
          eyebrow="What you know"
          title="Intel"
          onClose={() => {
            onPanel(null);
          }}
        >
          <div className="-mx-4">
            <IntelScreen />
          </div>
        </Sheet>
      )}


      {attacking && selected && planet.data && (
        <LaunchSheet
          target={selected}
          planet={planet.data}
          onClose={() => {
            setAttacking(false);
          }}
          onLaunched={() => {
            close();
            setAwaiting({ kind: 'outbound', targetName: selected.name });
          }}
        />
      )}

      {covered && (
        <LoadingScreen
          caption={
            !dataSettled ? 'Sweeping the disc' : !assets.ready ? 'Charting the disc' : 'Bringing it up'
          }
          {...(dataSettled && !assets.ready ? { progress: assets.progress } : {})}
        />
      )}
    </div>
  );
}

const windowsOpen = (planets: readonly { isSelf: boolean; fleet?: { status: string } }[]): number =>
  planets.filter((p) => !p.isSelf && p.fleet?.status === 'AWAY').length;

/**
 * The asteroid panel needs three things the panel itself should not compute:
 * how long the rock has left, whether your craft could catch it, and how many are
 * free to send. Gathered here so the panel stays a view.
 */
function AsteroidFocusHost({
  rock,
  runs,
  mining,
  seasonStart,
  homePosition,
  now,
  busy,
  open,
  onToggle,
  onClose,
  onSend,
}: {
  rock: AsteroidView | undefined;
  runs: readonly MiningRun[];
  mining: MiningView | undefined;
  seasonStart: Date;
  homePosition: { x: number; y: number; z: number } | undefined;
  now: number;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSend: (index: number, craft: number) => void;
}) {
  const planet = usePlanet();
  if (!rock) return null;

  const minutesLeft = minutesLeftFor(rock, seasonStart, now);
  const speed = mining?.craftSpeed ?? 0;

  /**
   * The real interception, solved with the same function the server uses.
   *
   * It used to be a straight-line guess to where the rock is NOW, which was close
   * enough on a slow one-way path and is badly wrong on a fast orbit — a rock can
   * be on the far side of its circle by the time a craft arrives. Running the
   * actual solver means the flight time shown is the flight time you get, and the
   * button is never offered for a trip the server would refuse.
   */
  /**
   * How much the works can still absorb. D31 — mined ore lands in the buffer, so
   * this is the ceiling that decides how much of a haul survives the trip home.
   */
  const p = planet.data?.planet;
  const worksRoom = p
    ? Math.max(0, p.bufferAlloyCap - p.bufferAlloy) + Math.max(0, p.bufferCrystalCap - p.bufferCrystal)
    : 0;

  const minutesNow = (now - seasonStart.getTime()) / 60_000;
  const hit =
    homePosition && speed > 0
      ? interceptAsteroid(homePosition, speed, rock, minutesNow)
      : null;
  const reach = hit ? hit.flightMinutes : null;

  return (
    <AsteroidFocus
      rock={rock}
      craftAvailable={planet.data?.fleet.PROSPECTOR ?? 0}
      craftHold={mining?.craftHold ?? 0}
      derrick={mining?.derrick ?? false}
      derrickHold={mining?.derrickHold ?? 0}
      minutesLeft={minutesLeft}
      reachMinutes={reach}
      worksRoom={worksRoom}
      run={runs.find((r) => r.asteroidIndex === rock.index && r.status !== 'done')}
      onClose={onClose}
      busy={busy}
      open={open}
      onToggle={onToggle}
      onSend={(craft) => {
        onSend(rock.index, craft);
      }}
    />
  );
}

/**
 * WHO YOU ARE, WHERE YOU ARE, AND HOW LONG YOU HAVE. D21.
 *
 * The one surface in the game that is about the account rather than about the
 * world, and the only place sign-out lives. Opened from the season clock in the
 * header, because that figure already belongs to this commander in this galaxy.
 *
 * It states the galaxy by name. With ten of them, "which one am I in" stopped
 * being a question with one possible answer, and a player who cannot name their own
 * galaxy cannot tell a friend where to find them.
 */
function CommanderPanel({
  galaxy,
  shard,
  endsAt,
  onSignOut,
}: {
  galaxy: string | null;
  shard: string | null;
  endsAt: Date | null;
  onSignOut: () => void;
}) {
  const hoursLeft = endsAt === null ? null : (endsAt.getTime() - serverNow()) / 3_600_000;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="plate plate-cut plate-cut-sm p-3">
          <p className="legend">Galaxy</p>
          <p className="mt-1 truncate text-[15px] text-bone">{galaxy ?? '—'}</p>
          {shard !== null && shard !== galaxy && (
            <p className="mt-0.5 text-[11px] text-faint">{shard}</p>
          )}
        </div>
        <div className="plate plate-cut plate-cut-sm p-3">
          <p className="legend">Season ends in</p>
          <p className="readout mt-1 text-[15px] text-bone">
            {hoursLeft === null ? '—' : duration(Math.max(0, hoursLeft) * 60)}
          </p>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-dim">
        Your commander is a name and a password, so this planet is waiting on any browser
        you sign into. At the wipe every galaxy resets and everyone starts again.
      </p>

      <Button variant="ghost" size="lg" full onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}

/**
 * A wreck field, and what it would take to go and get it. D32.
 *
 * A field does not move, so this is a plain flight to a fixed point — no
 * interception solve, unlike a rock. Everything else is the asteroid host's shape,
 * because to the player it is the same kind of decision.
 */
function DebrisFocusHost({
  field,
  planets,
  runs,
  mining,
  homePosition,
  busy,
  open,
  onToggle,
  onClose,
  onSend,
}: {
  field: { id: string; planetId: string; alloy: number; crystal: number; minutesLeft: number } | undefined;
  planets: readonly { id: string; name: string; position: { x: number; y: number; z: number } }[];
  runs: readonly MiningRun[];
  mining: MiningView | undefined;
  homePosition: { x: number; y: number; z: number } | undefined;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSend: (fieldId: string, craft: number) => void;
}) {
  const planetQuery = usePlanet();
  if (!field) return null;

  const at = planets.find((p) => p.id === field.planetId);
  const speed = mining?.craftSpeed ?? 0;
  const reach =
    homePosition && at && speed > 0
      ? travelMinutes(distance(homePosition, at.position), speed)
      : null;

  const p = planetQuery.data?.planet;
  const worksRoom = p
    ? Math.max(0, p.bufferAlloyCap - p.bufferAlloy) + Math.max(0, p.bufferCrystalCap - p.bufferCrystal)
    : 0;

  return (
    <DebrisFocus
      field={field}
      planetName={at?.name}
      craftAvailable={planetQuery.data?.fleet.PROSPECTOR ?? 0}
      craftHold={mining?.craftHold ?? 0}
      reachMinutes={reach}
      worksRoom={worksRoom}
      run={runs.find((r) => r.debrisFieldId === field.id && r.status !== 'done')}
      busy={busy}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      onSend={(craft) => {
        onSend(field.id, craft);
      }}
    />
  );
}
