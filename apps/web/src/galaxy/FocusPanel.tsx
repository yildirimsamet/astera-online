import { useEffect, useState, type ReactNode } from 'react';
import { HULLS, PROBE, fleetCount, telescopeSlots, type HullId } from '@blindspace/rules';
import type {
  AsteroidView,
  BattleReport,
  Contact,
  GalaxyPlanet,
  IntelView,
  MiningRun,
  PendingThread,
  PlanetView,
} from '../api/schemas.js';
import { useProbe, useWatch } from '../api/queries.js';
import { compact } from '../lib/format.js';
import {
  confidenceWord,
  dossier,
  headline,
  isStale,
  sourceLabel,
  type Fact,
  type Gap,
  type Headline as HeadlineKind,
} from '../lib/dossier.js';
import { duration, staleness } from '../lib/time.js';
import { reachMinutes } from '../lib/navigation.js';
import { HullMark } from '../ui/icons/hulls.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * FOCUS — what is this thing, and what do I know about it?
 *
 * The panel that replaced the tab bar (D20). Tapping ANYTHING in the disc focuses
 * it and opens this; it states what the player is entitled to know about that
 * object, where each fact came from and how old it is, and offers the one or two
 * actions that make sense next.
 *
 * It is deliberately a STRIP, not a sheet. A sheet covers the galaxy and ends the
 * spatial thought the player was having; this leaves the object visible above it,
 * so "that one, over there" stays true while they read. The full surfaces — the
 * planet's four decision groups, the launch planner — still open as sheets when
 * the player asks for them.
 *
 * The fog is not enforced here and must never be: the server already withheld
 * anything unearned, and `dossier()` only arranges what arrived.
 */

export type Focus =
  | { kind: 'planet'; id: string }
  | { kind: 'asteroid'; index: number }
  | { kind: 'run'; id: string }
  | { kind: 'thread'; key: string }
  /** Somebody else's craft. Selectable since D24, like everything else out there. */
  | { kind: 'contact'; id: string }
  /** Wreckage from a battle. Public to the whole galaxy, and on a clock. D32. */
  | { kind: 'debris'; id: string };

/* ── shared chrome ───────────────────────────────────────────── */

/**
 * FOCUS OPENS CLOSED. Owner decision.
 *
 * Tapping something in the disc used to throw a full panel over the bottom of the
 * screen. That is wrong for the gesture it answers: most taps are the player
 * LOOKING — sweeping from world to world, getting a feel for the neighbourhood —
 * and a panel that lands on every one of them turns exploring into operating a
 * menu. The camera flying to what you tapped is the reward; a wall of text is not.
 *
 * So focus is a rail by default: one line, thumb height, saying what you selected
 * and the single fact that matters about it. It confirms the tap, it leaves the
 * object visible, and it costs nothing to ignore. The detail is one more tap, and
 * only once the player has decided this is the one.
 */
function Shell({
  art,
  eyebrow,
  title,
  summary,
  children,
  actions,
  open,
  onToggle,
  onClose,
}: {
  art?: ReactNode;
  eyebrow: string;
  title: string;
  /** The one line worth seeing without asking. Shown collapsed. */
  summary: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <section
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 border-t border-line bg-void/92 backdrop-blur-md"
      aria-label={`${title} — focus`}
    >
      {/* The rail. Always present, and the whole control when collapsed. */}
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {art}
          <span className="min-w-0 flex-1">
            <span className="legend block">{eyebrow}</span>
            <span className="block truncate font-display text-[15px] uppercase tracking-wide text-bone">
              {title}
            </span>
          </span>
          <span className="min-w-0 shrink-0 text-right text-[12px] leading-tight text-dim">
            {summary}
          </span>
          <span
            aria-hidden
            className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`}
          >
            &#9650;
          </span>
        </button>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={onClose}
          className="shrink-0 rounded-sm px-1.5 py-1 text-[16px] leading-none text-faint hover:text-bone"
        >
          &times;
        </button>
      </div>

      {open && (
        <div className="max-h-[52dvh] overflow-y-auto overscroll-contain border-t border-line-soft">
          <div className="px-4 py-3">{children}</div>
          {actions && (
            <div className="sticky bottom-0 flex gap-2 border-t border-line-soft bg-void/95 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Keeps the rail clear of the home indicator when it is the only thing shown. */}
      {!open && <div className="h-[env(safe-area-inset-bottom)]" />}
    </section>
  );
}

/**
 * One known thing, with where it came from stamped on it.
 *
 * The provenance line is the component's reason to exist. Without it this is a
 * spreadsheet, and a player reads "defence 1,400" as a fact about now rather than
 * as something a probe guessed at four hours ago to within forty percent.
 */
function FactRow({ fact }: { fact: Fact }) {
  const stale = isStale(fact.ageMinutes);
  const confidence = confidenceWord(fact.accuracy);

  return (
    <div
      className={`border-l-2 py-1.5 pl-3 ${
        fact.opportunity ? 'border-opportunity' : stale ? 'border-alloy/40' : 'border-crystal/40'
      }`}
    >
      <div className="flex items-baseline gap-2">
        <p className="legend">{fact.label}</p>
        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-faint">
          {sourceLabel(fact.source)}
          {fact.ageMinutes !== null && (
            <span className={stale ? 'text-alloy' : ''}> · {staleness(fact.ageMinutes)}</span>
          )}
          {confidence && <span> · {confidence}</span>}
        </span>
      </div>
      <p
        className={`num mt-0.5 text-[15px] ${
          fact.opportunity ? 'text-opportunity' : 'text-bone'
        }`}
      >
        {fact.value}
      </p>
      {fact.note && <p className="mt-0.5 text-[11px] leading-snug text-faint">{fact.note}</p>}
    </div>
  );
}

/** Something you do not know, presented as a goal rather than an absence. */
function GapRow({
  label,
  missing,
  why,
  blocked,
  action,
}: {
  label: string;
  missing: string;
  why: string;
  blocked?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded border border-dashed border-line px-3 py-2">
      <div className="flex items-baseline gap-2">
        <p className="legend">{label}</p>
        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-faint">
          Unknown
        </span>
      </div>
      <p className="mt-0.5 text-[13px] text-alloy">{missing}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-dim">{why}</p>
      {blocked && <p className="mt-1 text-[11px] leading-snug text-threat">{blocked}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ── another player's world ──────────────────────────────────── */

/**
 * ONE WORLD, ONE SURFACE. D22.
 *
 * There used to be two. This panel listed what you knew, and a "What I know"
 * button opened a full sheet that listed what you knew again — in a different
 * layout, with different wording, and with the ACTIONS that close a gap only on
 * the second one. A player could not tell which was which or why both existed,
 * and the owner's note was exactly that.
 *
 * The rail is now the whole dossier. Collapsed it is one line — the headline fact
 * about this world and how recently anyone looked. Opened it is everything you
 * know with its provenance, everything you do not with the control that would
 * close it, and one commitment at the bottom. The second surface is gone rather
 * than reconciled: two views of one object is a bug that no amount of styling
 * fixes.
 */
export function PlanetFocus({
  target,
  planet,
  intel,
  reports,
  now,
  onClose,
  onAttack,
  onInstallTelescope,
  onLaunched,
  open,
  onToggle,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  intel: IntelView | undefined;
  reports: readonly BattleReport[];
  now: number;
  onClose: () => void;
  onAttack: () => void;
  /** Takes the player to the orbit surface, where the instrument is bought. */
  onInstallTelescope: () => void;
  /** Called with the target's name once a probe is away, so the disc can follow it. */
  onLaunched: (targetName: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const read = dossier({ target, planet, intel, reports, now });
  const reach = reachMinutes(planet.planet.position, target.position, planet.fleet);
  const away = target.fleet?.status === 'AWAY';
  const known = headline(read, target);

  return (
    <Shell
      art={<PlanetSigil seed={target.id} size={40} dark={known.kind === 'none'} />}
      eyebrow={`Held by ${target.owner}`}
      title={target.name}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={<Headline of={known} />}
      /**
       * THE COMMITMENT, AND WHEN IT IS NOT ON OFFER. D49.
       *
       * A world more than two development tiers away cannot be attacked, and the
       * server refuses the launch. Offering "Plan an attack" anyway would walk the
       * player through picking a fleet, reading the exposure line and pressing the
       * irreversible button, to be told no — on the one surface in the game where
       * being sure is the whole product. The control states the rule instead, and
       * the reason is on the Development row above it.
       */
      actions={
        read.inBand ? (
          <button type="button" className="slab slab-commit flex-1" onClick={onAttack}>
            Plan an attack
          </button>
        ) : (
          <span className="slab slab-ghost flex-1 cursor-default text-center opacity-60">
            Tier {target.coreTier} — you may fight {read.band.low}–{read.band.high}
          </span>
        )
      }
    >
      {away && (
        <p className="mb-3 rounded border border-opportunity/40 bg-opportunity/10 px-3 py-2 text-[13px] text-opportunity">
          Their fleet is not home. This is the window the whole game is about.
        </p>
      )}

      <div className="mb-3 grid grid-cols-3 gap-3">
        <Figure label="Distance" value={String(Math.round(read.range))} />
        <Figure label="Your reach" value={reach === null ? '—' : duration(reach)} />
        <Figure
          label="Known"
          value={`${String(read.facts.length)} of ${String(read.facts.length + read.gaps.length)}`}
        />
      </div>

      <div className="space-y-2">
        {read.facts.map((fact) => (
          <FactRow key={fact.key} fact={fact} />
        ))}
        {read.gaps.map((gap) => (
          <GapRow
            key={gap.key}
            label={gap.label}
            missing={gap.missing}
            why={gap.why}
            {...(gap.blocked === undefined ? {} : { blocked: gap.blocked })}
            action={
              <CloseGap
                gap={gap}
                target={target}
                telescope={planet.instruments.TELESCOPE ?? 0}
                intel={intel}
                onInstallTelescope={onInstallTelescope}
                onLaunched={onLaunched}
              />
            }
          />
        ))}
      </div>
    </Shell>
  );
}

/** The collapsed rail's single line. Never claims ignorance the player does not have. */
function Headline({ of }: { of: HeadlineKind }) {
  switch (of.kind) {
    case 'fleet-away':
      return <span className="text-opportunity">Fleet away</span>;
    case 'fleet-home':
      return <span>Fleet home</span>;
    case 'veiled':
      return <span className="text-dim">Veiled</span>;
    case 'probed':
      return <span className="text-dim">Probed {staleness(of.ageMinutes)}</span>;
    case 'fought':
      return <span className="text-dim">Fought {staleness(of.ageMinutes)}</span>;
    case 'none':
      return <span className="text-faint">No intel</span>;
  }
}

/**
 * THE CONTROL THAT CLOSES THE GAP, where the gap is stated.
 *
 * This is the half that used to live only in the second sheet, which is what made
 * the second sheet feel necessary. A gap a player can read but not act on is a
 * complaint; a gap with its own button is the information layer's entire
 * on-ramp — `game-design.md`'s warning is that if nobody ever thinks "I do not
 * know enough about this planet yet", the game is a worse OGame.
 */
function CloseGap({
  gap,
  target,
  telescope,
  intel,
  onInstallTelescope,
  onLaunched,
}: {
  gap: Gap;
  target: GalaxyPlanet;
  telescope: number;
  intel: IntelView | undefined;
  onInstallTelescope: () => void;
  /** Called with the target's name once a probe is away, so the disc can follow it. */
  onLaunched: (targetName: string) => void;
}) {
  const watch = useWatch();
  const probe = useProbe();
  const say = useToast();

  if (gap.closes === 'telescope') {
    if (telescope === 0) {
      return (
        <button type="button" className="slab slab-ghost w-full" onClick={onInstallTelescope}>
          Install a Telescope
        </button>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: telescopeSlots(telescope) }, (_, slot) => {
          const current = intel?.watching.find((w) => w.slot === slot);
          return (
            <button
              key={slot}
              type="button"
              className="slab slab-ghost"
              disabled={watch.isPending}
              onClick={() => {
                watch.mutate(
                  { targetPlanetId: target.id, slot },
                  {
                    onSuccess: () => {
                      say(`Watching ${target.name}`);
                    },
                    onError: (err) => {
                      say(describe(err), 'error');
                    },
                  },
                );
              }}
            >
              {current
                ? `Slot ${String(slot + 1)} · replace ${current.targetName}`
                : `Watch · slot ${String(slot + 1)}`}
            </button>
          );
        })}
      </div>
    );
  }

  if (gap.closes === 'probe') {
    return (
      <button
        type="button"
        className="slab slab-primary w-full"
        disabled={probe.isPending}
        onClick={() => {
          probe.mutate(target.id, {
            onSuccess: (r) => {
              say(`Probe away · reports back in ${duration(r.flightMinutes)}`);
              // Close the dossier and go with it. Owner decision — a launch you
              // cannot recall should feel like something left, not like a form
              // being submitted.
              onLaunched(target.name);
            },
            onError: (err) => {
              say(describe(err), 'error');
            },
          });
        }}
      >
        Send a probe · {compact(PROBE.alloy)} alloy · {compact(PROBE.crystal)} crystal
      </button>
    );
  }

  // `battle` closes itself, by fighting. There is no button for that here — the
  // one at the bottom of the panel is it.
  return null;
}

/* ── a rock crossing the disc ────────────────────────────────── */

/**
 * ASTEROID FOCUS — D19.
 *
 * Everything here is public and everyone sees the same numbers, because the race
 * only means something if the prize is visible to all of it. The two lines that
 * decide whether to go are the ore left and the time left, so they lead.
 */
export function AsteroidFocus({
  rock,
  craftAvailable,
  craftHold,
  derrick,
  derrickHold,
  minutesLeft,
  reachMinutes: reach,
  worksRoom,
  run,
  onClose,
  onSend,
  busy,
  open,
  onToggle,
}: {
  rock: AsteroidView;
  craftAvailable: number;
  craftHold: number;
  /** Is a Derrick in orbit. D25 — it makes mining better, it never gates it. */
  derrick: boolean;
  /** What one would raise the hold to, so the panel can sell it. */
  derrickHold: number;
  minutesLeft: number;
  /** Flight time for the interception, or null when it cannot be caught. */
  reachMinutes: number | null;
  /**
   * What the WORKS can still absorb, not what storage can. D31.
   *
   * Mined ore comes home into the buffer now, and the buffer is smaller than
   * storage AND has been filling with ordinary production the whole time the craft
   * was away. A player who commits a squadron and gets half a haul has to be able
   * to see that coming — otherwise the honest rule reads as a bug.
   */
  worksRoom: number;
  /** Your own craft already working this rock, if any. */
  run: MiningRun | undefined;
  onClose: () => void;
  onSend: (craft: number) => void;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const crystal = Math.round(rock.crystalShare * 100);
  // What a full squadron could actually take, which is the number that decides
  // how many to send — not the rock's total.
  const canCarry = craftHold * craftAvailable;
  const worthSending = Math.max(1, Math.min(craftAvailable, Math.ceil(rock.oreRemaining / Math.max(1, craftHold))));
  const tooLate = reach === null || reach >= minutesLeft;
  // The player's choice, defaulting to the sensible one. Re-defaulted whenever the
  // fleet at home changes, so a squadron landing does not leave a stale number in
  // a control the player has not touched.
  const [craft, setCraft] = useState(worthSending);
  const sending = Math.min(Math.max(1, craft), Math.max(1, craftAvailable));
  useEffect(() => {
    setCraft(worthSending);
  }, [worthSending]);
  // What this trip would actually bring home, once the works are taken into
  // account. Anything above the room available is lost on arrival. D31.
  const bringing = Math.min(craftHold * sending, rock.oreRemaining);
  const spill = Math.max(0, Math.round(bringing - worksRoom));

  return (
    <Shell
      eyebrow={`Level ${String(rock.level)} asteroid`}
      title={`Rock ${String(rock.index)}`}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={
        <span>
          <span className="text-crystal">{compact(rock.oreRemaining)}</span> ore &middot;{' '}
          <span className={minutesLeft < 60 ? 'text-threat' : ''}>{duration(minutesLeft)}</span>
        </span>
      }
      actions={
        /**
         * NOTHING GATES MINING ANY MORE. D25.
         *
         * This used to refuse the whole panel unless a DRILL satellite was
         * installed, and the copy pointed at an Orbital Ring that was retired in
         * D22 — two dead references in one sentence. A Prospector is an ordinary
         * hull now, so the only reason not to offer the button is having no craft,
         * which the button itself already says.
         */
        run ? (
          <p className="num text-[12px] text-crystal">
            {run.craft} craft already working this rock ·{' '}
            {run.status === 'returning' ? 'heading home' : 'inbound'}
          </p>
        ) : (
          <button
            type="button"
            className="slab slab-primary flex-1"
            disabled={busy || craftAvailable < 1 || tooLate}
            onClick={() => {
              onSend(sending);
            }}
          >
            {craftAvailable < 1
              ? 'No Prospectors at home'
              : tooLate
                ? 'It will be gone before you arrive'
                : `Send ${String(sending)} · ${duration(reach)}`}
          </button>
        )
      }
    >
      {!run && (
        <CraftPicker
          available={craftAvailable}
          value={sending}
          onPick={setCraft}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Figure label="Ore left" value={compact(rock.oreRemaining)} tone="crystal" />
        <Figure
          label="Leaves in"
          value={duration(minutesLeft)}
          tone={minutesLeft < 60 ? 'threat' : undefined}
        />
        <Figure label="Composition" value={`${String(crystal)}% crystal`} />
        <Figure label="Speed" value={`${rock.speed.toFixed(1)}/min`} />
      </div>

      {spill > 0 && !run && (
        /**
         * Said BEFORE the commitment, not after it. A squadron is a real decision
         * and the works filling up while it was away is the one thing that can
         * make that decision worse without the player doing anything wrong —
         * so it is stated here, with the fix, rather than reported on arrival.
         */
        <p className="mt-3 text-[12px] leading-snug text-alloy">
          Your works can only take {compact(worksRoom)} more. About {compact(spill)} of this
          haul would be lost on arrival — empty them first.
        </p>
      )}

      <p className="mt-3 text-[12px] leading-snug text-dim">
        {rock.oreRemaining < rock.ore
          ? `Somebody has already taken ${compact(rock.ore - rock.oreRemaining)} out of it.`
          : 'Untouched. First craft to reach it takes what it can carry.'}
      </p>

      <p className="num mt-2 text-[11px] text-faint">
        {craftAvailable} Prospector{craftAvailable === 1 ? '' : 's'} at home · each carries{' '}
        {compact(craftHold)} · {compact(canCarry)} between them
      </p>

      {/* The one thing a Derrick changes about this trip, priced as a reason. */}
      {!derrick && derrickHold > craftHold && (
        <p className="mt-1 text-[11px] leading-snug text-faint">
          A <span className="text-bone">Derrick</span> in orbit would make that{' '}
          <span className="num text-crystal">{compact(derrickHold)}</span> each, and get them there
          sooner.
        </p>
      )}

      {/*
        Speed is a fact about the ROCK, not about the trip. Stating the flight time
        beside it is what turns "9.2 a minute" into a decision, because the only
        question that matters is whether the craft gets there first.
      */}
      {reach !== null && !tooLate && (
        <p className="mt-1 text-[11px] leading-snug text-faint">
          Your craft would meet it in {duration(reach)}, with {duration(minutesLeft - reach)} to
          spare.
        </p>
      )}
    </Shell>
  );
}

/* ── your own craft, in transit ──────────────────────────────── */

export function RunFocus({
  run,
  rock,
  wreck,
  minutesRemaining,
  onClose,
  open,
  onToggle,
}: {
  run: MiningRun;
  rock: AsteroidView | undefined;
  /** The wreck field, on a harvest. Named where the rock would be. */
  wreck: { planetName: string | undefined; minutesLeft: number } | undefined;
  minutesRemaining: number;
  onClose: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const returning = run.status === 'returning';
  /**
   * A HARVEST IS NOT A MINING RUN, AND THIS PANEL USED TO SAY IT WAS. D32.
   *
   * The two share the table, the launch path, the traffic contact and the flight
   * rendering, which is the whole point of D32 — but they do not share their
   * TARGET, and every word here was written about a rock. A harvest carries no
   * `asteroidIndex`, so the rock lookup could only ever come back empty, and the
   * panel then stated the one thing that lookup means on a mining run: "Rock has
   * passed". A player who had just sent four Prospectors at a wreck field was told
   * their target was gone, in the very panel that exists to tell them where their
   * craft is.
   *
   * The other two lines were wrong in the same direction and more quietly: a field
   * does not move, so there is no interception to explain and no rock to be
   * stripped by somebody faster — a field is CLAIMED, and it decays on a clock.
   */
  const salvage = run.targetKind === 'debris';

  return (
    <Shell
      eyebrow={returning ? 'Coming home' : salvage ? 'Salvage run' : 'Outbound'}
      title={`${String(run.craft)} Prospector${run.craft === 1 ? '' : 's'}`}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={<span>{duration(minutesRemaining)}</span>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Figure
          label={returning ? 'Home in' : salvage ? 'Reaches it in' : 'Meets the rock in'}
          value={duration(minutesRemaining)}
        />
        <Figure
          label="Target"
          value={
            salvage
              ? wreck
                ? `Wreckage over ${wreck.planetName ?? 'a world'}`
                : 'Field has decayed'
              : rock
                ? `Level ${String(rock.level)} rock`
                : 'Rock has passed'
          }
        />
      </div>

      {returning ? (
        <p className="mt-3 text-[13px] leading-snug text-bone">
          {run.minedAlloy + run.minedCrystal > 0
            ? `Carrying ${compact(run.minedAlloy)} alloy and ${compact(run.minedCrystal)} crystal.`
            : salvage
              ? 'Arrived to find the field already picked over. Coming back empty.'
              : 'Arrived to find the rock already stripped. Coming back empty.'}
        </p>
      ) : salvage ? (
        <p className="mt-3 text-[12px] leading-snug text-dim">
          A field does not move, and everybody can see it.{' '}
          {wreck ? `It is gone in ${duration(wreck.minutesLeft)}.` : ''} Whoever gets there first
          takes what they can carry.
        </p>
      ) : (
        <p className="mt-3 text-[12px] leading-snug text-dim">
          Flying to where the rock will be, not where it is. Whoever gets there first takes what
          they can carry.
        </p>
      )}
    </Shell>
  );
}

/* ── a fleet of your own, in transit ─────────────────────────── */

export function ThreadFocus({
  thread,
  minutesRemaining,
  onClose,
  open,
  onToggle,
}: {
  thread: PendingThread;
  minutesRemaining: number;
  onClose: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const composition = thread.fleet ? describeThreadFleet(thread.fleet) : null;

  return (
    <Shell
      eyebrow={
        thread.kind === 'probe'
          ? thread.leg === 'return'
            ? 'Probe coming home'
            : 'Probe outbound'
          : thread.leg === 'return'
            ? 'Fleet returning'
            : 'Fleet outbound'
      }
      title={thread.targetName}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={<span>{duration(minutesRemaining)}</span>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Figure label="Arrives in" value={duration(minutesRemaining)} />
        <Figure label="Craft" value={composition ? String(fleetCount(thread.fleet ?? {})) : '—'} />
      </div>

      {composition && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.entries(thread.fleet ?? {}) as [HullId, number][])
            .filter(([, n]) => n > 0)
            .map(([hull, n]) => (
              <span
                key={hull}
                className="flex items-center gap-1.5 rounded border border-line-soft px-2 py-1"
              >
                <HullMark hull={hull} className="size-4 text-dim" />
                <span className="num text-[12px] text-bone">
                  {n} {HULLS[hull].name}
                </span>
              </span>
            ))}
        </div>
      )}

      <p className="mt-3 text-[12px] leading-snug text-dim">
        {thread.leg === 'return'
          ? 'On its way back. Nothing more to decide.'
          : 'A launched fleet cannot be recalled.'}
      </p>
    </Shell>
  );
}

const describeThreadFleet = (fleet: Record<string, number>): string =>
  Object.entries(fleet)
    .filter(([, n]) => n > 0)
    .map(([hull, n]) => `${String(n)} ${hull}`)
    .join(' · ');

/* ── someone else's craft ────────────────────────────────────── */

/**
 * A CONTACT YOU CAN NOW READ — UP TO A POINT. D24.
 *
 * This panel used to say "unattributable" and explain that you were not entitled
 * to resolve it. The owner changed what the galaxy publishes: other people's craft
 * are real objects with real positions, they carry their neon, and focusing one
 * tells you WHAT IT IS and WHAT IS IN IT.
 *
 * So the panel's job flipped. It no longer explains an absence; it states the
 * three facts that are public and then names the two that are not, because in an
 * information game the boundary is itself information. What you cannot have here
 * is WHOSE it is and WHERE it is going — and that is what still makes a Telescope
 * and a probe worth paying for.
 *
 * The one exception is a mining run, which is public in full: the rock, the clock
 * and the line. What it is bringing home is not, and never was.
 */
export function ContactFocus({
  contact,
  onClose,
  open,
  onToggle,
}: {
  contact: Contact;
  onClose: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const hulls = (Object.entries(contact.fleet ?? {}) as [HullId, number][]).filter(
    ([, n]) => n > 0,
  );
  const total = hulls.reduce((sum, [, n]) => sum + n, 0);
  /**
   * BOTH ERRANDS THAT ARE PUBLIC IN FULL. D19 and D32.
   *
   * A harvest is a mining run flying at a wreck field instead of at a rock: same
   * craft, same table, same public leg and public clock, different destination and
   * different words. This branch used to read `kind === 'mining'` alone, which was
   * harmless only because the SERVER never sent `harvest` — it published every run
   * as `mining`, so a salvage flight was described as heading for a rock.
   */
  const salvage = contact.kind === 'harvest';
  const mining = contact.kind === 'mining' || salvage;
  /**
   * A BATTLE IS NOT "SOMEBODY MOVING". D52.
   *
   * The rail described a squadron putting missiles into a world as traffic, because
   * a contact used to have only one thing it could be. The engagement is public now
   * and it is the loudest thing on the disc — the panel has to agree with the
   * picture above it, or the interface is calmly narrating something else.
   */
  const battle = contact.engagement !== undefined;

  return (
    <Shell
      eyebrow={
        battle
          ? 'A raid is landing'
          : salvage
            ? 'Somebody is salvaging'
            : mining
              ? 'Somebody is mining'
              : contact.kind === 'probe'
                ? 'Somebody is scouting'
                : 'Somebody is moving'
      }
      title={battle ? 'Under fire' : CONTACT_TITLE[contact.kind]}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={
        mining ? (
          <span className="text-alloy">
            {contact.minutesRemaining === undefined
              ? 'Working'
              : duration(contact.minutesRemaining)}
          </span>
        ) : battle ? (
          /*
            AND HERE THE CLOCK IS NOT BLANK, because there is one and everybody has
            it: the engagement is a real ten-second window and the payload carries
            both its edges. It is the one thing about somebody else's fleet the
            galaxy is ever told the timing of, and only because the fleet is already
            standing on the world.
          */
          <>
            <span className="text-[#ffb9ae]">
              {total > 0 ? `${String(total)} craft` : 'Bombarding'}
            </span>
            <span className="block text-[11px] text-faint">Settling now</span>
          </>
        ) : (
          /*
            THE CLOCK'S SLOT, LEFT DELIBERATELY BLANK.

            Every other rail in the game puts a countdown exactly here — your own
            fleet, your probe, a mining run — and the pending strip that sits
            directly under this one is a countdown too. So a foreign contact whose
            summary was a bare craft count read as a flight whose clock was simply
            somewhere nearby, and the owner attributed the strip's figure to it.
            Naming the absence in the position the eye is already looking is what
            stops that: the arrival of somebody else's fleet is not a fact this
            player holds, and the panel says so rather than leaving a gap.
          */
          <>
            <span className={total > 0 ? '' : 'text-faint'}>
              {total > 0 ? `${String(total)} craft` : 'Unattributed'}
            </span>
            <span className="block text-[11px] text-faint">Arrival unknown</span>
          </>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Figure
          label="Craft"
          value={
            mining
              ? String(contact.craft ?? 0)
              : total > 0
                ? String(total)
                : '—'
          }
        />
        <Figure
          label={battle ? 'Status' : 'Arrives in'}
          value={
            battle
              ? 'Landed'
              : mining
                ? contact.minutesRemaining === undefined
                  ? '—'
                  : duration(contact.minutesRemaining)
                : 'Unknown'
          }
          {...(battle
            ? { tone: 'threat' as const }
            : mining
              ? { tone: 'crystal' as const }
              : {})}
        />
      </div>

      {hulls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hulls.map(([hull, n]) => (
            <span
              key={hull}
              className="flex items-center gap-1.5 rounded border border-line-soft px-2 py-1"
            >
              <HullMark hull={hull} className="size-4 text-dim" />
              <span className="num text-[12px] text-bone">
                {n} {HULLS[hull].name}
              </span>
            </span>
          ))}
        </div>
      )}

      {/*
        THE BOUNDARY, STATED. Knowing exactly what you are NOT being told is the
        thing that sends a player to the Telescope — an absence they cannot see is
        an absence they will not pay to close.
      */}
      <p className="mt-3 text-[12px] leading-snug text-dim">
        {battle
          ? 'A fleet is over that world and firing. Whose it is, and where it came from, are still not in this reading — and neither is who wins.'
          : salvage
          ? 'A salvage run is public — the field, the route and the clock. What it brings home is not.'
          : mining
          ? 'A mining run is public — the rock, the route and the clock. What it brings home is not.'
          : 'You can see what is flying and what is in it. Whose it is, where it came from and where it is going are not in this reading.'}
      </p>
      {!mining && !battle && (
        <p className="mt-2 text-[12px] leading-snug text-faint">
          A Telescope pointed at a world tells you when ITS fleet leaves. That is the only way
          to put a name to movement.
        </p>
      )}
      {battle && (
        <p className="mt-2 text-[12px] leading-snug text-faint">
          Wreckage is public. Whatever is left of both fleets will be in orbit there shortly,
          and anyone may go and get it.
        </p>
      )}
    </Shell>
  );
}

/**
 * A WRECK FIELD. D32.
 *
 * Deliberately shaped like `AsteroidFocus`, because to a player it is the same
 * kind of object: something out there with a quantity and a clock that anybody may
 * fly to. What differs is that it does not move and that it exists because two
 * people fought — which the panel says, because that is the information the field
 * is really carrying.
 */

/**
 * HOW MANY CRAFT TO COMMIT — and why it has to be a choice.
 *
 * The panel used to send `worthSending`: everything at home, capped at what the
 * target could actually fill. That is the right DEFAULT and it was the wrong
 * BEHAVIOUR, because it silently spent the whole squadron. A player who wants one
 * craft on a rock and one on a wreck field had no way to say so — the first launch
 * took all three and the second target was unreachable until they came home.
 *
 * `PROSPECTOR.max` is three (D34), so this is three buttons and never a stepper.
 * The default stays `worthSending`, so the common case is still one tap.
 */
function CraftPicker({
  available,
  value,
  onPick,
}: {
  available: number;
  value: number;
  onPick: (n: number) => void;
}) {
  if (available < 2) return null;
  return (
    <div className="mt-3">
      <p className="legend mb-1.5">How many to send</p>
      <div className="flex items-center gap-2">
        {Array.from({ length: available }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            className={`btn flex-1 ${value === n ? 'border-crystal/60 text-crystal' : ''}`}
            onClick={() => {
              onPick(n);
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DebrisFocus({
  field,
  planetName,
  craftAvailable,
  craftHold,
  reachMinutes: reach,
  worksRoom,
  run,
  onSend,
  onClose,
  busy,
  open,
  onToggle,
}: {
  field: { id: string; alloy: number; crystal: number; minutesLeft: number };
  planetName: string | undefined;
  craftAvailable: number;
  craftHold: number;
  reachMinutes: number | null;
  worksRoom: number;
  run: MiningRun | undefined;
  onSend: (craft: number) => void;
  onClose: () => void;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const left = field.alloy + field.crystal;
  const canCarry = craftHold * craftAvailable;
  const worthSending = Math.max(
    1,
    Math.min(craftAvailable, Math.ceil(left / Math.max(1, craftHold))),
  );
  const tooLate = reach === null || reach >= field.minutesLeft;
  const [craft, setCraft] = useState(worthSending);
  const sending = Math.min(Math.max(1, craft), Math.max(1, craftAvailable));
  useEffect(() => {
    setCraft(worthSending);
  }, [worthSending]);
  const spill = Math.max(0, Math.round(Math.min(craftHold * sending, left) - worksRoom));

  return (
    <Shell
      eyebrow="Wreckage"
      title={planetName === undefined ? 'Debris field' : `Debris over ${planetName}`}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={
        <span>
          <span className="text-alloy">{compact(left)}</span> salvage &middot;{' '}
          <span className={field.minutesLeft < 30 ? 'text-threat' : ''}>
            {duration(field.minutesLeft)}
          </span>
        </span>
      }
      actions={
        run ? (
          <p className="num text-[12px] text-alloy">
            {run.craft} craft already there &middot;{' '}
            {run.status === 'returning' ? 'heading home' : 'inbound'}
          </p>
        ) : (
          <button
            type="button"
            className="slab slab-primary flex-1"
            disabled={busy || craftAvailable < 1 || tooLate}
            onClick={() => {
              onSend(sending);
            }}
          >
            {craftAvailable < 1
              ? 'No craft at home'
              : tooLate
                ? 'It will be gone before you arrive'
                : `Send ${String(sending)} · ${duration(reach)}`}
          </button>
        )
      }
    >
      {!run && (
        <CraftPicker
          available={craftAvailable}
          value={sending}
          onPick={setCraft}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Figure label="Alloy left" value={compact(field.alloy)} tone="alloy" />
        <Figure label="Crystal left" value={compact(field.crystal)} tone="crystal" />
        <Figure
          label="Gone in"
          value={duration(field.minutesLeft)}
          tone={field.minutesLeft < 30 ? 'threat' : undefined}
        />
        <Figure label="Your hold" value={compact(canCarry)} />
      </div>

      {spill > 0 && !run && (
        <p className="mt-3 text-[12px] leading-snug text-alloy">
          Your works can only take {compact(worksRoom)} more. About {compact(spill)} of this
          would be lost on arrival — empty them first.
        </p>
      )}

      <p className="mt-3 text-[12px] leading-snug text-dim">
        Somebody lost a fleet here. It is fading, and everyone can see it — whoever gets
        there first takes what is left.
      </p>
    </Shell>
  );
}

const CONTACT_TITLE: Record<Contact['kind'], string> = {
  fleet: 'Squadron',
  probe: 'Probe',
  mining: 'Mining run',
  harvest: 'Salvage run',
};

/* ── shared ──────────────────────────────────────────────────── */

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  // `alloy` since D32: a wreck field is priced in both metals, and showing the two
  // piles in the palette the whole game uses for them is what makes it readable at
  // a glance as "salvage" rather than as an abstract number.
  tone?: 'crystal' | 'alloy' | 'threat';
}) {
  const colour =
    tone === 'crystal'
      ? 'text-crystal'
      : tone === 'alloy'
        ? 'text-alloy'
        : tone === 'threat'
          ? 'text-threat'
          : 'text-bone';
  return (
    <div>
      <p className="legend">{label}</p>
      <p className={`num mt-0.5 text-[15px] ${colour}`}>
        {value}
      </p>
    </div>
  );
}

/** Minutes a rock has left in the disc, from the season clock. */
export const minutesLeftFor = (rock: AsteroidView, seasonStart: Date, now: number): number =>
  Math.max(0, rock.expiresAt - (now - seasonStart.getTime()) / 60_000);


