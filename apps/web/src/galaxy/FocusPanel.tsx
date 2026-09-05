import { GameActions } from '../session/seasonLock.js';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import {
  DEATH_STAR,
  MULTI_WORLD,
  SETTLEMENT_CLAIM_MINUTES,
  PROBE,
  distance,
  fleetCount,
  fleetEntries,
  fleetTravelExact,
  missionFuel,
  telescopeSlots,
  transferCargoCapacity,
  MOBILE_HULLS,
  type Fleet,
  type HullId,
  recoveryMinutesFor,
} from '@astera/rules';
import type {
  AsteroidView,
  Contact,
  PirateContact,
  GalaxyPlanet,
  IntelView,
  MiningRun,
  PendingThread,
  PlanetView,
  Report,
  RivalSummary,
} from '../api/schemas.js';
import { useProbe, useSetRival, useWatch } from '../api/queries.js';
import { hullLabel, hullName, satelliteLabel } from '../i18n/names.js';
import { compact, full } from '../lib/format.js';
import { colonizationPhase, type ColonizationPhase } from '../lib/colonization.js';
import { useAccordion } from '../lib/accordion.js';
import { commanderLabel } from '../lib/identity.js';
import {
  confidenceWord,
  dossier,
  headline,
  isStale,
  sourceLabel,
  type Source,
  type Fact,
  type Gap,
  type Headline as HeadlineKind,
} from '../lib/dossier.js';
import { countdown, duration, staleness, useNow } from '../lib/time.js';
import { serverNow } from '../lib/clock.js';
import { reachMinutes } from '../lib/navigation.js';
import type { TradeShipEvent } from '../lib/trade.js';
import { HullMark } from '../ui/icons/hulls.js';
import { AttackIcon, EyeIcon } from '../ui/icons/index.js';
import { Price } from '../ui/Action.js';
import { Band } from '../ui/UpgradeRow.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { describe, useToast } from '../ui/Toast.js';
import { useOwnPress } from '../ui/kit/index.js';

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
  | { kind: 'asteroid'; id: string }
  | { kind: 'run'; id: string }
  | { kind: 'thread'; key: string }
  /** An eight-second anti-strategic launch; camera-only, with no information rail. */
  | { kind: 'interception'; id: string }
  /** The collision phase is distinct so it can reframe even after a missed launch follow. */
  | { kind: 'interceptionImpact'; id: string }
  /**
   * Somebody else's craft. Selectable since D24, like everything else out there.
   *
   * A PIRATE ARRIVES THROUGH HERE TOO, and deliberately has no variant of its own:
   * it is a contact on the disc like any other, and the rail that opens for it is
   * chosen from the payload's `kind` rather than from a second focus state that
   * the camera and the renderer would both have to learn. D150.
   */
  | { kind: 'contact'; id: string }
  /** Wreckage from a battle. Public to the whole galaxy, and on a clock. D32. */
  | { kind: 'debris'; id: string }
  /**
   * The merchant. D156.
   *
   * Its own variant rather than a `contact`, because it is not one: a contact is
   * somebody else's craft, fogged and read through `sensorZone`, and this is an
   * announced public moment with no sight to buy. The id is the OCCURRENCE's, which
   * is also what the launch posts.
   */
  | { kind: 'tradeShip'; id: string };

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
  const { t } = useTranslation();

  /**
   * THIS RAIL MOUNTS UNDER THE FINGER THAT SUMMONED IT. D109a.
   *
   * It appears along the bottom edge the instant a world is selected, and a world
   * can be tapped there — so the tap's own click, dispatched after the rail has
   * rendered, lands on whichever of these two controls is beneath it. One of them
   * EXPANDS the rail, which contradicts the owner's rule that focus opens closed;
   * the other is CLEAR, which deselects the world the player just chose. Both on
   * the same gesture that chose it.
   *
   * Same shape as the sheet scrim, same answer: a press belongs to the surface it
   * started on.
   */
  const toggle = useOwnPress(onToggle);
  const clear = useOwnPress(onClose);

  return (
    <section
      /**
       * `data-focus-rail` is how the onboarding gate (D56) finds this surface. The
       * beat that asks for a fleet to be sent has to leave the rail live — the
       * commitment is inside it — without leaving the rest of the screen live too.
       */
      data-focus-rail
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 border-t border-line bg-void/92"
      aria-label={t('focus.shellLabel', { title })}
    >
      {/* The rail. Always present, and the whole control when collapsed. */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          {...toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {art}
          <span className="min-w-0 flex-1">
            <span className="legend block">{eyebrow}</span>
            <span className="name block truncate text-bone">
              {title}
            </span>
          </span>
          <span className="min-w-0 shrink-0 text-right text-caption leading-tight text-dim">
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
          aria-label={t('focus.clear')}
          {...clear}
          className="flex size-11 shrink-0 items-center justify-center rounded-chip text-figure leading-none text-faint hover:bg-raised hover:text-bone"
        >
          &times;
        </button>
      </div>

      {open && (
        <div className="max-h-[52dvh] overflow-y-auto overscroll-contain border-t border-line-soft">
          {/*
            Every focus card goes through this shell, so wrapping it here is what
            stops a frozen season offering launches, probes and settlements it
            would refuse. The clear (x) above sits OUTSIDE it on purpose: looking
            around the final galaxy is the one thing still on offer.
          */}
          <GameActions>
            <div className="px-2 py-3">{children}</div>
            {/*
              THE ACTIONS WRAP, AND A COMMITMENT GETS A ROW TO ITSELF.

              Up to four slabs used to share one line across a 390px phone — about
              eighty-five pixels each — and they were held at `text-[9px]` to make
              that fit. Two of them can carry a REFUSAL REASON as their label
              ("Death Star · origin recovering"), so the most consequential surface
              in the game was setting sentences below the size anything else on
              screen is allowed to be. Wrapping costs one row of height and gives
              every label the width it needs.
            */}
            {actions && (
              <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-line-soft bg-void/95 px-2 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                {actions}
              </div>
            )}
          </GameActions>
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
/**
 * THE FOUR SOURCES, IN ASCENDING ORDER OF WHAT THEY COST TO GET.
 *
 * `dossier.ts` states the same order in prose — free sight, a Telescope slot, a
 * probe and a round trip, ships you cannot get back — and this is that order as
 * data, so the panel's sections can never drift from the ranking the dossier's own
 * docblock describes.
 */
const SOURCE_ORDER: readonly Source[] = ['public', 'telescope', 'probe', 'battle'];

function FactRow({ fact }: { fact: Fact }) {
  const stale = isStale(fact.ageMinutes);
  const confidence = confidenceWord(fact.accuracy);

  return (
    <div
      className={`border-l-2 py-2 pl-3 ${ fact.opportunity ? 'border-opportunity' : stale ? 'border-alloy/40' : 'border-crystal/40' }`}
    >
      <div className="flex items-baseline gap-2">
        <p className="legend">{fact.label}</p>
        <span className="legend ml-auto shrink-0">
          {sourceLabel(fact.source)}
          {fact.ageMinutes !== null && (
            <span className={stale ? 'text-alloy' : ''}> · {staleness(fact.ageMinutes)}</span>
          )}
          {confidence && <span> · {confidence}</span>}
        </span>
      </div>
      <p
        className={`num mt-1 text-body ${ fact.opportunity ? 'text-opportunity' : 'text-bone' }`}
      >
        {fact.value}
      </p>
      {fact.note && <p className="mt-1 text-label leading-snug text-faint">{fact.note}</p>}
    </div>
  );
}

/** Something you do not know, presented as a goal rather than an absence. */
/**
 * SOMETHING THIS COMMANDER DOES NOT KNOW, AND THE CONTROL THAT WOULD CLOSE IT.
 *
 * A dossier can hold four of these at once, and each one drew a label, the fact, a
 * two-line argument for why it matters and a full-width control. Four of that is
 * most of a 375-wide screen spent on what the player does NOT know, sitting above
 * the two commitments that would act on it.
 *
 * SO THE PROSE FOLDS AND THE ACTION NEVER DOES — the same division `RouteStep`
 * takes, and the same reason. What is missing and the button that fixes it are the
 * decision; the argument for caring is the pitch, and a pitch the reader has
 * already heard four times is cost without information.
 *
 * IT IS FOLDED, NOT DELETED. `interface.md`'s fourth question is about interaction
 * cost, and answering it by removing the answer to its third — does the player
 * know why this feature exists — would trade one failure for a worse one. One tap.
 */
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
  const { t } = useTranslation();
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div data-gap className="rounded-chip border border-dashed border-line px-3 py-2">
      <button
        type="button"
        aria-expanded={showWhy}
        className="w-full text-left"
        onClick={() => { setShowWhy((open) => !open); }}
      >
        <span className="flex items-baseline gap-2">
          <span className="legend">{label}</span>
          <span className="legend ml-auto shrink-0">{t('focus.unknown')}</span>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className={`size-3.5 shrink-0 text-faint transition-transform duration-200 ${
              showWhy ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M7 4.5 12.5 10 7 15.5" />
          </svg>
        </span>
        {/* The FACT is never folded: it is the reading, not the argument. */}
        <span data-gap-missing className="mt-1 block text-body text-alloy">{missing}</span>
      </button>

      {showWhy && (
        <p data-gap-why className="mt-1 text-label leading-snug text-dim">{why}</p>
      )}
      {/* A refusal is not a pitch — it is why the control below will not work. */}
      {blocked && <p className="mt-1 text-label leading-snug text-threat">{blocked}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ── world focus ─────────────────────────────────────────────── */

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
 * fixes. A controlled destination branches into the compact transfer route below;
 * it has no intelligence gaps or hostile commitments to explain.
 */
export function PlanetFocus({
  target,
  planet,
  intel,
  reports,
  rival,
  isRival = false,
  now,
  onClose,
  onAttack,
  onSettle,
  onDeathStar,
  onTransfer,
  onInstallTelescope,
  onLaunched,
  settlementInFlight = false,
  open,
  onToggle,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  intel: IntelView | undefined;
  reports: readonly Report[];
  rival?: RivalSummary;
  isRival?: boolean;
  now: number;
  onClose: () => void;
  onAttack: () => void;
  onSettle?: () => void;
  onDeathStar?: () => void;
  onTransfer?: () => void;
  /** Takes the player to the orbit surface, where the instrument is bought. */
  onInstallTelescope: () => void;
  /** Called with the target's name once a probe is away, so the disc can follow it. */
  onLaunched: (targetName: string) => void;
  /** An outbound colony mission already targets this world. */
  settlementInFlight?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const setRival = useSetRival();
  const say = useToast();

  if (target.isOwned) {
    return (
      <OwnedPlanetFocus
        target={target}
        origin={planet}
        now={now}
        onClose={onClose}
        {...(onTransfer ? { onTransfer } : {})}
        open={open}
        onToggle={onToggle}
      />
    );
  }

  const read = dossier({ target, planet, intel, reports, ...(rival ? { rival } : {}), now });
  const reach = reachMinutes(planet.planet.position, target.position, planet.fleet);
  const away = target.fleet?.status === 'AWAY';
  const known = headline(read, target);
  const originRecovering = Boolean(
    planet.planet.recoveryUntil && planet.planet.recoveryUntil.getTime() > now,
  );
  const colonyPhase = colonizationPhase(target, now, settlementInFlight);
  /*
    The PROBE band leads: it is the section a commander opens this panel to read,
    and the one they paid alloy and a round trip for. Remembered per device.
  */
  const dossierBands = useAccordion('dossier', ['probe']);
  /**
   * A CLAIM WINDOW SURVIVES THE FOG, SO THE CONTROL HAS TO AS WELL. D112/D127.
   *
   * This tested `kind === 'NEUTRAL'`, which is a field D127 REMOVED from an
   * unsurveyed world — so the disc drew the claim ring and the label said "Claim
   * open" on a world whose panel then offered no way to settle it. The one race
   * the design deliberately keeps public was visible to everybody and enterable
   * only by the people who had already probed the rock, which is the exact
   * sentence D127 uses to explain why the window is published at all.
   *
   * The window is the gate. The server publishes it only while it is genuinely
   * open, and the settlement guards below are what actually refuse a bad launch.
   */
  const claimUntil = target.kind === 'CAPITAL' || target.kind === 'COLONY'
    ? null
    : target.neutral?.claimUntil ?? null;
  const claimActive = Boolean(claimUntil && claimUntil.getTime() > now);
  const settlementEta = fleetTravelExact(
    distance(planet.planet.position, target.position),
    { COURIER: MULTI_WORLD.settlement.transports },
  );
  const settlementCanArrive = Boolean(
    claimUntil && now + settlementEta * 60_000 < claimUntil.getTime(),
  );
  /**
   * WHAT THE SETTLERS BURN GETTING THERE. T6 — and this panel is the fourth door
   * into a launch, so it quotes the charge like the other three.
   *
   * One leg: they land and become the colony, and nothing comes home. Off
   * `missionFuel`, the same function `launchSettlement` charges with, because a
   * requirement list computing its own arithmetic is a requirement list that
   * eventually disagrees with the server it is predicting.
   */
  const settlementFuel = missionFuel(
    { COURIER: MULTI_WORLD.settlement.transports },
    distance(planet.planet.position, target.position),
    1,
  );
  /*
    THE FOUNDING STOCK COMES OFF THE TOP, exactly as the server's guard counts it:
    `settlement.cost` is cargo the settlers carry, not a fee, so its deuterium has
    already left this world before the engines ask for any. Zero today, and written
    as the sum so the panel cannot start disagreeing with the launch the day it
    is not.
  */
  const settlementFuelled =
    planet.planet.deuterium - MULTI_WORLD.settlement.cost.deuterium >= settlementFuel;
  const colonyStanding = planet.colonies ?? {
    colonies: 0,
    reservations: 0,
    capacity: 0,
    highestCore: planet.buildings.CORE ?? 0,
  };
  const colonySlotOpen = colonyStanding.colonies + colonyStanding.reservations
    < colonyStanding.capacity;
  const flightBayOpen = planet.flight.used < planet.flight.total;
  const settlementBlock = originRecovering
    ? t('focus.planet.settleRecovering')
    : !colonySlotOpen
      ? t('focus.planet.settleNeedSlot')
      : !flightBayOpen
        ? t('focus.planet.settleNeedBay')
        : (planet.fleet.COURIER ?? 0) < MULTI_WORLD.settlement.transports
          ? t('focus.planet.settleNeedCourier')
          : planet.planet.alloy < MULTI_WORLD.settlement.cost.alloy
            ? t('focus.planet.settleNeedAlloy')
            : planet.planet.crystal < MULTI_WORLD.settlement.cost.crystal
              ? t('focus.planet.settleNeedCrystal')
              // Beside the other two stores, because it is one: the founding stock
              // is carried and the flight is burned, and both come off this world.
              : !settlementFuelled
                ? t('focus.planet.settleNeedFuel')
                : !settlementCanArrive
                  ? t('focus.planet.settleTooLate')
                  : null;
  const settlementReady = claimActive && settlementBlock === null;
  /**
   * A STRIKE IS NEVER AN ACQUISITION. D167.
   *
   * Every gate below used to exist because a second impact inside the recovery
   * window handed the colony over: an open colony slot, and a flight that could
   * land before the window closed. The weapon takes nothing now — it restarts the
   * target's deadline — so both refusals are gone and the button says one thing.
   */
  const deathStarReady = planet.strategic?.status === 'READY';
  const deathStarBlock = !deathStarReady
    ? t('focus.planet.deathStarUnavailable')
    : target.state.kind === 'PROTECTED'
      ? t('focus.planet.deathStarProtected')
      : originRecovering
        ? t('focus.planet.deathStarOriginRecovering')
        : !flightBayOpen
          ? t('focus.planet.deathStarNeedBay')
          : null;
  const deathStarEnabled = deathStarBlock === null;

  /**
   * THE HEADER OF A WORLD NOBODY HAS SURVEYED. D127.
   *
   * Every line above was reading a field the server DELIBERATELY OMITS, and the
   * schema's defaults made each of them look like an answer: the eyebrow printed
   * "Location: " with an empty name, the title printed an empty commander, and
   * `WorldKind` fell through both of its branches to announce NEUTRAL. A player
   * who had just been told they cannot see this world was shown three confident
   * claims about it, one of which was wrong.
   *
   * The panel still opens — the tap asked for it, and a control that does nothing
   * reads as broken — and it says the one true thing instead. Everything below,
   * the range and the flight time and the commitment, is computed from the
   * POSITION, which is public in every state and is exactly why an attack on an
   * unsurveyed world is still offered.
   */
  const unsurveyed = target.intel === 'UNKNOWN';
  const anonymous = unsurveyed && !target.clanmate;

  return (
    <Shell
      art={<PlanetSigil seed={target.id} size={40} dark={known.kind === 'none'} />}
      eyebrow={anonymous
        ? t('focus.planet.unsurveyedEyebrow')
        : t('focus.planet.location', { planet: target.name })}
      title={anonymous
        ? t('focus.planet.unsurveyedTitle')
        : commanderLabel(target.owner, target.clan?.tag)}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={(
        <span className="flex flex-col items-end gap-1">
          {!unsurveyed && <WorldKind target={target} rival={isRival} />}
          <Headline of={known} />
        </span>
      )}
      /**
       * THE COMMITMENT, AND IT IS ALWAYS ON OFFER NOW. D127.
       *
       * This used to hide behind D49's ±2 development band: a world too far up or
       * down the ladder could not be attacked, so offering "Plan an attack" would
       * have walked the player through picking a fleet and pressing the
       * irreversible button to be told no — on the one surface where being sure is
       * the whole product. D127 retired the band, because with development private
       * the rule could only ever have BECOME that refusal. The control is simply
       * here; the fleet is yours to lose.
      */
      actions={(
          <>
          {/*
            AND YOU CANNOT MARK WHAT YOU CANNOT SEE. Owner's instruction. This
            tested `kind !== 'NEUTRAL'`, a field an unsurveyed world does not
            carry — so the Rival control appeared on exactly the worlds where
            `isRivalNode` then refuses to draw the reticle. A button whose effect
            is invisible is worse than an absent one.
          */}
          {!target.clanmate && !unsurveyed && target.kind !== 'NEUTRAL' && (
          <button
            type="button"
            className={`slab slab-ghost min-w-[8rem] flex-1 whitespace-normal px-3 leading-tight ${isRival ? 'text-alloy' : ''}`}
            disabled={setRival.isPending}
            onClick={() => {
              setRival.mutate(isRival ? null : target.id, {
                onSuccess: () => {
                  say(t(isRival ? 'focus.planet.rivalCleared' : 'focus.planet.rivalMarked', {
                    commander: target.owner,
                  }));
                },
                onError: (error) => { say(describe(error), 'error'); },
              });
            }}
          >
            {/*
              A SECOND PRESS TAKES THE MARK OFF AGAIN. Owner instruction,
              reversing D103. The button used to freeze the moment the two
              commanders had shared a probe, a battle or a strike, and read "Rival
              fixed" for the rest of the season — so the control that says "watch
              this one" became one that refused. The mark is a bookmark on a disc
              of three hundred worlds; changing your mind about who you are
              watching is not a decision the game needs to protect you from.
            */}
            {t(isRival ? 'focus.planet.rivalMarkedAction' : 'focus.planet.markRival')}
          </button>
          )}
          {onSettle && claimActive && colonyPhase !== 'SETTLEMENT_IN_FLIGHT' && (
            <button
              type="button"
              className="slab slab-primary min-w-[8rem] flex-1 whitespace-normal px-3 leading-tight"
              disabled={!settlementReady}
              onClick={onSettle}
            >
              {settlementBlock ?? t('focus.planet.settle')}
            </button>
          )}
          {/*
            A WEAPON YOU DO NOT OWN TAKES NO ROW. Owner report, with a screenshot.

            This slab rendered unconditionally and, for the overwhelming majority
            of commanders, read "No ready Death Star" — a full-width control on a
            375-wide rail whose entire content was the absence of a thing they had
            never built. Three stacked slabs, one of them announcing nothing.

            `interface.md` I1 — an unavailable action stays visible with its reason
            on it — is not violated by hiding it, because that rule is about a gap
            the player is ABOUT TO CLOSE. Once a strategic asset exists in any
            state, the block reason is something they can act on (finish it, free a
            bay, wait for the recovery window) and the control belongs on the rail.
            With `strategic` null there is no gap, no reason worth reading, and no
            action — only a row of type.
          */}
          {onDeathStar && !target.clanmate && planet.strategic != null && (
            <button
              type="button"
              data-death-star
              className="slab slab-commit basis-full whitespace-normal px-3 leading-tight"
              disabled={!deathStarEnabled}
              onClick={onDeathStar}
            >
              {deathStarBlock ?? t('focus.planet.deathStarStrike')}
            </button>
          )}
          {/*
            NO DEVELOPMENT GATE ON THE LAUNCH ANY MORE. D127.
            The button used to appear only for a target inside the ±2 tier band,
            which was honest while tier was public: the player could see why. With
            development private the gate would be invisible, and an invisible gate
            is the failure D49 replaced a wealth ratio for. The band is retired,
            so the control is simply here — and the fleet is yours to lose.
          */}
          {/*
            THE TWO COMMITMENTS SIT SIDE BY SIDE. Owner instruction, with a
            screenshot: *"Butonlar gereksiz büyük ve dikey alanı uzatıyor. Örnegin
            [icon] Saldır, [icon] Sonda gibi yan yana 2-3 buton koyulabilir."*

            The probe used to live in the panel BODY, below the list of gaps, while
            the attack lived down here — so the two things a commander opens this
            panel to do were separated by everything they already knew, and each ate
            a full row of a 375-wide phone.

            Pairing them costs the labels their sentences, so the COST moves onto
            its own micro line inside the probe's button rather than out of the
            interface: a spend the player cannot see before pressing is a worse
            failure than a wide button.

            A probe at a clanmate is `CLAN_FRIENDLY_FIRE` before it is anything
            else, so both are hidden there rather than offered and refused.
          */}
          {!target.clanmate && (
            <ProbeControl target={target} intel={intel} onLaunched={onLaunched} />
          )}
          {!target.clanmate && <button
            type="button"
            // Marked so a surface outside this panel can point at the commitment.
            // The onboarding opens exactly this path and refuses the rest of the
            // rail, because nothing else on it is affordable out of the opening
            // grant — a probe alone needs crystal the mandatory upgrades spent.
            data-attack
            className="slab slab-commit slab-compact min-w-[7.5rem] flex-1 basis-[calc(50%-0.25rem)] leading-tight"
            aria-label={t(originRecovering
              ? 'focus.planet.attackOriginRecovering'
              : colonyPhase === 'NEUTRAL_RACE' || colonyPhase === 'SETTLEMENT_IN_FLIGHT'
                ? 'focus.planet.attackNeutralAgain'
                : 'focus.planet.attack')}
            disabled={originRecovering}
            onClick={onAttack}
          >
            {/*
              THE ONE IRREVERSIBLE CONTROL IN THE GAME NOW CARRIES A MARK.

              `slab-commit` is reserved for the launch and nothing else, and the
              glyph is the second half of that same argument: on a rail where
              every other control is a slab of the same size, weight and colour
              family, shape is what a thumb recognises before the word is read.
              `.slab` is already a flex row with an 8px gap, so the icon needs no
              layout of its own.
            */}
            <AttackIcon className="size-4 shrink-0" />
            {t(originRecovering
              ? 'focus.planet.attackOriginRecovering'
              : colonyPhase === 'NEUTRAL_RACE' || colonyPhase === 'SETTLEMENT_IN_FLIGHT'
                ? 'focus.planet.attackNeutralAgain'
                : 'focus.planet.attackShort')}
          </button>}
          </>
        )}
    >
      {/*
        NO STRATEGY GUIDE FOR A WORLD YOU CANNOT SEE. D127.

        Every branch of this guide is keyed on `target.kind`, and an unsurveyed
        world has none — so it fell through to the Death Star route, which ends
        with "the second impact captures it". That is a promise the panel cannot
        keep: the world may be a CAPITAL, which is uncapturable and returns from
        the guide long before that line, and the guide's own comment says as much.
        A commitment surface may state a rule or say nothing; it may not guess.
      */}
      {!target.clanmate && (!unsurveyed
        || colonyPhase === 'NEUTRAL_RACE'
        || colonyPhase === 'SETTLEMENT_IN_FLIGHT') && (
      <StrategicWorldGuide
        target={target}
        planet={planet}
        now={now}
        colonySlotOpen={colonySlotOpen}
        flightBayOpen={flightBayOpen}
        settlementEta={settlementEta}
        settlementCanArrive={settlementCanArrive}
        settlementFuel={settlementFuel}
        settlementFuelled={settlementFuelled}
        claimActive={claimActive}
        isRival={isRival}
        phase={colonyPhase}
      />
      )}
      {away && (
        <p className="mb-3 rounded-chip border border-opportunity/40 bg-opportunity/10 px-3 py-2 text-body text-opportunity">
          {t('focus.planet.windowOpen')}
        </p>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2">
        <Figure label={t('focus.planet.distance')} value={String(Math.round(read.range))} />
        <Figure
          label={t('focus.planet.reach')}
          value={reach === null ? t('focus.planet.reachUnknown') : duration(reach)}
        />
        <Figure
          label={t('focus.planet.known')}
          value={t('focus.planet.knownOf', {
            have: read.facts.length,
            total: read.facts.length + read.gaps.length,
          })}
        />
      </div>

      {(isRival || rival) && (
        <RivalHistory
          summary={rival}
          probeAt={intel?.probeReports.find((report) => report.targetPlanetId === target.id)?.at}
          now={now}
          marked={isRival}
        />
      )}

      {/*
        WHAT YOU KNOW, GROUPED BY WHAT PAID FOR IT. Owner instruction:
        *"focus sheet'indeki telescope bilgileri ve sonda bilgileri hem daha compact
        ve net yapılabilir hemde sectionlar ayrı accordionlara alınabilir."*

        The dossier already carries the one grouping that matters — `Fact.source`,
        the four instruments in ascending order of what they COST: free sight, a
        Telescope slot, a probe and a round trip, ships you cannot get back. It was
        rendered as one flat list, so a commander could not tell at a glance which
        half of a world's dossier they had actually bought, and every reading a
        probe brought home sat at the same weight as the world's public position.
      */}
      {SOURCE_ORDER.map((source) => {
        const rows = read.facts.filter((fact) => fact.source === source);
        if (rows.length === 0) return null;
        return (
          <section key={source} data-fact-source={source} className="mb-2">
            <Band
              label={sourceLabel(source)}
              count={rows.length}
              open={dossierBands.isOpen(source)}
              onToggle={() => { dossierBands.toggle(source); }}
            />
            {dossierBands.isOpen(source) && (
              <div className="mt-2 space-y-2">
                {rows.map((fact) => <FactRow key={fact.key} fact={fact} />)}
              </div>
            )}
          </section>
        );
      })}

      <div className="space-y-2">
        {read.gaps.map((gap) => (
          <GapRow
            key={gap.key}
            label={gap.label}
            missing={gap.missing}
            why={gap.why}
            {...(gap.blocked === undefined ? {} : { blocked: gap.blocked })}
            {...(gap.closes === 'telescope'
              /*
                THE PROP, NOT THE RENDER, IS WHAT RESERVES THE ROOM. `GapRow`
                gates its action slot on `action &&`, and a React element is
                truthy even when the component returns null — so passing one for
                a gap `CloseGap` has no control for left an empty 8px box under
                every probe gap on the rail.
              */
              ? {
                  action: (
                    <CloseGap
                      gap={gap}
                      target={target}
                      telescope={planet.instruments.TELESCOPE ?? 0}
                      observerPlanetId={planet.planet.id}
                      intel={intel}
                      onInstallTelescope={onInstallTelescope}
                    />
                  ),
                }
              : {})}
          />
        ))}
      </div>
    </Shell>
  );
}

/**
 * A CONTROLLED DESTINATION IS A ROUTE, NOT AN INTELLIGENCE DOSSIER.
 *
 * Reusing the hostile-world detail here buried the only relevant action below
 * public facts, telescope gaps and attack language. This surface names both ends
 * of the one-way transfer, shows whether craft can make the trip, and leads into
 * the actual picker. The irreversible Send remains inside that picker.
 */
function OwnedPlanetFocus({
  target,
  origin,
  now,
  onClose,
  onTransfer,
  open,
  onToggle,
}: {
  target: GalaxyPlanet;
  origin: PlanetView;
  now: number;
  onClose: () => void;
  onTransfer?: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const routeDistance = distance(origin.planet.position, target.position);
  const reach = reachMinutes(origin.planet.position, target.position, origin.fleet);
  const originRecovering = Boolean(
    origin.planet.recoveryUntil && origin.planet.recoveryUntil.getTime() > now,
  );

  return (
    <Shell
      art={<PlanetSigil seed={target.id} size={40} />}
      eyebrow={t(target.kind === 'CAPITAL'
        ? 'focus.planet.yourCapital'
        : 'focus.planet.yourColony')}
      title={target.name}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={(
        <span className="flex flex-col items-end gap-1">
          <WorldKind target={target} rival={false} />
          <span>{t('focus.planet.transferFrom', { origin: origin.planet.name })}</span>
        </span>
      )}
    >
      <div className="rounded-chip border border-crystal/35 bg-crystal/8 px-3 py-3">
        <p className="legend text-crystal">{t('focus.planet.transferRoute')}</p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0">
            <p className="legend text-faint">{t('focus.planet.transferOrigin')}</p>
            <p className="name mt-1 truncate text-bone">{origin.planet.name}</p>
          </div>
          <span aria-hidden className="text-title text-crystal">→</span>
          <div className="min-w-0 text-right">
            <p className="legend text-faint">{t('focus.planet.transferTarget')}</p>
            <p className="name mt-1 truncate text-bone">{target.name}</p>
          </div>
        </div>
        <p className="mt-3 text-label leading-snug text-dim">
          {t('focus.planet.transferHint')}
        </p>
      </div>

      <div className="my-3 grid grid-cols-3 gap-2">
        <Figure
          label={t('focus.planet.transferCraft')}
          value={compact(fleetCount(origin.fleet))}
        />
        <Figure label={t('focus.planet.distance')} value={String(Math.round(routeDistance))} />
        <Figure
          label={t('focus.planet.reach')}
          value={reach === null ? t('focus.planet.reachUnknown') : duration(reach)}
        />
      </div>

      {onTransfer && (
        <button
          type="button"
          className="slab slab-primary w-full whitespace-normal px-3 leading-tight"
          disabled={originRecovering}
          onClick={onTransfer}
        >
          {t(originRecovering
            ? 'focus.planet.transferRecovering'
            : 'focus.planet.transferPrepare')}
        </button>
      )}
    </Shell>
  );
}

function WorldKind({ target, rival }: { target: GalaxyPlanet; rival: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="legend flex items-center gap-1">
      <span className={target.kind === 'CAPITAL'
        ? 'text-crystal'
        : target.kind === 'COLONY' ? 'text-opportunity' : 'text-dim'}>
        {t(target.kind === 'CAPITAL'
          ? 'focus.planet.kindCapital'
          : target.kind === 'COLONY'
            ? 'focus.planet.kindColony'
            : 'focus.planet.kindNeutral')}
      </span>
      {rival && <span className="text-alloy-glow">· {t('focus.planet.rivalMarkedAction')}</span>}
    </span>
  );
}

function Requirement({
  ok,
  label,
  explanation,
  children,
}: {
  /** Null is an explanatory badge rather than a pass/fail requirement. */
  ok: boolean | null;
  label: string;
  explanation: string;
  children: ReactNode;
}) {
  const tooltipId = useId();
  const [explaining, setExplaining] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ bottom: 0, left: 16, width: 256 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);

  const explain = (): void => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    const button = document.getElementById(`${tooltipId}-button`);
    if (button) {
      const rect = button.getBoundingClientRect();
      const width = Math.min(256, Math.max(0, window.innerWidth - 32));
      setTooltipPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - width - 16)),
        width,
      });
    }
    setExplaining(true);
    closeTimer.current = setTimeout(() => {
      setExplaining(false);
      closeTimer.current = null;
    }, 2_000);
  };

  const tone = ok === null
    ? 'border-crystal/35 bg-crystal/10 text-crystal'
    : ok
      ? 'border-opportunity/35 bg-opportunity/10 text-opportunity'
      : 'border-alert/35 bg-alert/10 text-threat-ink';

  return (
    <span className="relative inline-flex">
      <button
        id={`${tooltipId}-button`}
        type="button"
        aria-label={label}
        aria-describedby={explaining ? tooltipId : undefined}
        aria-expanded={explaining}
        className={`flex min-h-8 touch-manipulation items-center gap-2 rounded-chip border px-2 text-micro hover:brightness-125 focus-visible:ring-2 focus-visible:ring-crystal/70 ${tone}`}
        onClick={explain}
      >
        <span aria-hidden className="text-micro">{ok === null ? '?' : ok ? '●' : '○'}</span>
        {children}
      </button>
      {explaining && createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          aria-live="polite"
          className="fixed z-[100] rounded-chip border border-crystal/45 bg-void px-3 py-2 text-left text-label leading-snug text-bone shadow-[0_0_20px_rgba(98,215,232,0.18)]"
          style={tooltipPosition}
        >
          {explanation}
        </span>,
        document.body,
      )}
    </span>
  );
}

/**
 * WHAT THE ROCKET DOES, BESIDE THE CONTROL THAT FIRES IT. D113.
 *
 * The route strip said "Damage" and then "Control transfers", which describes
 * the SEQUENCE and never once the effect. Same five facts as the forge card and
 * deliberately its own strings (D55): this one is written about the world under
 * the crosshair, not about the weapon on your own pad.
 */
/**
 * WHAT A STRIKE ACTUALLY DOES, AND FOR A COLONY THE LAST LINE IS THE FEATURE. D167.
 *
 * `capturable` used to mean "a second rocket can take this world". It means the
 * world can be LOST now: a struck colony whose commander sends no ship before the
 * window closes stops being theirs and belongs to nobody. The window itself is the
 * world's own (`recoveryMinutesFor`) — eight hours for a colony, two for a capital
 * — so the sentence and the clock can never disagree.
 */
function StrikeEffects({ capturable }: { capturable: boolean }) {
  const { t } = useTranslation();
  const lines = [
    t('focus.planet.strikeFleet'),
    t('focus.planet.strikeStock'),
    t('focus.planet.strikeCore'),
    t('focus.planet.strikeAegis', { levels: DEATH_STAR.aegisLevelsLost }),
    t('focus.planet.strikeDark', {
      duration: duration(recoveryMinutesFor(capturable ? 'COLONY' : 'CAPITAL')),
    }),
  ];
  return (
    <div className="plate plate-inset mt-3 flex flex-col gap-2 p-3">
      <p className="legend text-threat-ink">{t('focus.planet.strikeTitle')}</p>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line} className="flex gap-2 text-caption text-bone">
            <span aria-hidden className="text-threat-ink">▪</span>
            <span>{line}</span>
          </li>
        ))}
        {/* What the SECOND one does, which is the only reason to plan a first. */}
        <li className="flex gap-2 text-caption text-dim">
          <span aria-hidden className="text-faint">▪</span>
          <span>{t(capturable ? 'focus.planet.strikeCapture' : 'focus.planet.strikeNoCapture')}</span>
        </li>
      </ul>
    </div>
  );
}

function StrategicWorldGuide({
  target,
  planet,
  now,
  colonySlotOpen,
  flightBayOpen,
  settlementEta,
  settlementCanArrive,
  settlementFuel,
  settlementFuelled,
  claimActive,
  isRival,
  phase,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  now: number;
  colonySlotOpen: boolean;
  flightBayOpen: boolean;
  settlementEta: number;
  settlementCanArrive: boolean;
  /** Deuterium the two Haulers burn on the one leg they fly. T6. */
  settlementFuel: number;
  settlementFuelled: boolean;
  claimActive: boolean;
  isRival: boolean;
  phase: ColonizationPhase;
}) {
  const { t } = useTranslation();
  const standing = planet.colonies;

  /**
   * WHICH STEP IS SHOWING ITS DETAIL.
   *
   * `null` means "whichever step is live", which is the state a commander arrives
   * in and the only one that needs no tap. Pressing a step pins it; pressing it
   * again hands the route back to the phase. Exactly one is ever open — this is a
   * stepper rather than a list of collapsibles, and two open steps is the layout
   * the fold was introduced to remove.
   */
  const [pinnedStep, setPinnedStep] = useState<string | null>(null);
  const isOpen = (id: string, live: boolean): boolean =>
    pinnedStep === null ? live : pinnedStep === id;
  const toggleStep = (id: string): void => {
    setPinnedStep((current) => (current === id ? null : id));
  };

  if (target.isOwned) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-chip border border-crystal/35 bg-crystal/8 px-3 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-crystal/50 text-crystal">
          {target.kind === 'CAPITAL' ? '◆' : '▲'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="legend text-crystal">
            {t(target.kind === 'CAPITAL' ? 'focus.planet.yourCapital' : 'focus.planet.yourColony')}
          </p>
          <p className="mt-1 text-label text-dim">{t('focus.planet.transferHint')}</p>
        </div>
        {standing && (
          <span className="num shrink-0 text-micro text-crystal">
            {standing.colonies + standing.reservations}/{standing.capacity}
          </span>
        )}
      </div>
    );
  }

  if (target.kind === 'CAPITAL') {
    const recovery = target.state.kind === 'RECOVERY' ? target.state : null;
    return (
      <div className={`mb-3 rounded-chip border px-3 py-3 ${ recovery ? 'border-alert/55 bg-alert/12' : 'border-crystal/30 bg-crystal/8' }`}>
        <div className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-crystal/45 text-crystal">◆</span>
          <div className="min-w-0 flex-1">
            <p className={`legend ${ recovery ? 'text-threat-ink' : 'text-crystal' }`}>
              {t(recovery ? 'focus.planet.capitalRecovering' : 'focus.planet.capitalProtected')}
            </p>
            <p className="mt-1 text-label text-dim">
              {t(recovery ? 'focus.planet.capitalRecoveringHint' : 'focus.planet.capitalProtectedHint')}
            </p>
          </div>
          {recovery && (
            <span className="num shrink-0 text-label text-threat-ink">
              {duration((recovery.until.getTime() - now) / 60_000)}
            </span>
          )}
        </div>
        <StrikeEffects capturable={false} />
      </div>
    );
  }

  if (
    phase === 'NEUTRAL_PREP'
    || phase === 'NEUTRAL_RACE'
    || phase === 'SETTLEMENT_IN_FLIGHT'
  ) {
    const until = target.neutral?.claimUntil;
    const hauler = (planet.fleet.COURIER ?? 0) >= MULTI_WORLD.settlement.transports;
    const alloy = planet.planet.alloy >= MULTI_WORLD.settlement.cost.alloy;
    const crystal = planet.planet.crystal >= MULTI_WORLD.settlement.cost.crystal;
    return (
      <div className={`mb-3 rounded-chip border px-3 py-3 ${
        claimActive ? 'border-opportunity/50 bg-opportunity/10' : 'border-line-soft bg-deep/65'
      }`}>
        <div className="flex items-center gap-2">
          <p className={`legend ${ claimActive ? 'text-opportunity' : 'text-bone' }`}>
            {t(phase === 'SETTLEMENT_IN_FLIGHT'
              ? 'focus.planet.settlementInFlight'
              : claimActive ? 'focus.planet.claimOpen' : 'focus.planet.colonyRoute')}
          </p>
        </div>
        <ol className="mt-2 grid grid-cols-1 items-stretch gap-2 md:grid-cols-3">
          <RouteStep
            status={phase === 'NEUTRAL_PREP' ? 'current' : 'complete'}
            open={isOpen('colony-1', phase === 'NEUTRAL_PREP')}
            onToggle={() => { toggleStep('colony-1'); }}
            number="1"
            label={t('focus.planet.routeRaid')}
            description={t('focus.planet.routeRaidDetail')}
            dataStep="1"
          >
            <Requirement
              ok={null}
              label={t('focus.planet.raidFleetBadge')}
              explanation={t('focus.planet.raidFleetExplain')}
            >
              {t('focus.planet.raidFleetBadge')}
            </Requirement>
          </RouteStep>
          <RouteStep
            status={phase === 'NEUTRAL_PREP' ? 'upcoming' : 'complete'}
            open={isOpen('colony-2', false)}
            onToggle={() => { toggleStep('colony-2'); }}
            number="2"
            label={t('focus.planet.routeClaim')}
            description={t('focus.planet.routeClaimDetail')}
            dataStep="2"
          >
            <Requirement
              ok={null}
              label={t('focus.planet.automaticBadge')}
              explanation={t('focus.planet.automaticExplain')}
            >
              {t('focus.planet.automaticBadge')}
            </Requirement>
          </RouteStep>
          <RouteStep
            status={phase === 'NEUTRAL_PREP' ? 'upcoming' : 'current'}
            open={isOpen('colony-3', phase !== 'NEUTRAL_PREP')}
            onToggle={() => { toggleStep('colony-3'); }}
            number="3"
            label={t('focus.planet.routeSettle')}
            description={t(phase === 'SETTLEMENT_IN_FLIGHT'
              ? 'focus.planet.routeSettleInFlightDetail'
              : 'focus.planet.routeSettleDetail')}
            dataStep="3"
          >
            {phase === 'SETTLEMENT_IN_FLIGHT' ? (
              <Requirement
                ok={null}
                label={t('focus.planet.settlementAwayBadge')}
                explanation={t('focus.planet.settlementAwayExplain')}
              >
                {t('focus.planet.settlementAwayBadge')}
              </Requirement>
            ) : (
              <>
                <Requirement
                  ok={colonySlotOpen}
                  label={t('focus.planet.openColonySlot')}
                  explanation={t('focus.planet.colonySlotExplain')}
                >
                  {t('focus.planet.openColonySlot')}
                </Requirement>
                <Requirement
                  ok={flightBayOpen}
                  label={t('focus.planet.openFlightBay')}
                  explanation={t('focus.planet.flightBayExplain')}
                >
                  {t('focus.planet.openFlightBay')}
                </Requirement>
                <Requirement
                  ok={hauler}
                  label={t('focus.planet.courierCount')}
                  explanation={t('focus.planet.haulerExplain')}
                >
                  {t('focus.planet.courierCount')}
                </Requirement>
                <Requirement
                  ok={alloy}
                  label={t('focus.planet.foundingAlloy', {
                    amount: compact(MULTI_WORLD.settlement.cost.alloy),
                  })}
                  explanation={t('focus.planet.foundingAlloyExplain', {
                    amount: compact(MULTI_WORLD.settlement.cost.alloy),
                  })}
                >
                  <img src={RESOURCE_ART.alloy} alt="" aria-hidden className="size-3.5 object-contain" />
                  {compact(MULTI_WORLD.settlement.cost.alloy)}
                </Requirement>
                <Requirement
                  ok={crystal}
                  label={t('focus.planet.foundingCrystal', {
                    amount: compact(MULTI_WORLD.settlement.cost.crystal),
                  })}
                  explanation={t('focus.planet.foundingCrystalExplain', {
                    amount: compact(MULTI_WORLD.settlement.cost.crystal),
                  })}
                >
                  <img src={RESOURCE_ART.crystal} alt="" aria-hidden className="size-3.5 object-contain" />
                  {compact(MULTI_WORLD.settlement.cost.crystal)}
                </Requirement>
                <Requirement
                  ok={settlementFuelled}
                  label={t('focus.planet.settlementFuel', { amount: compact(settlementFuel) })}
                  explanation={t('focus.planet.settlementFuelExplain', {
                    amount: compact(settlementFuel),
                  })}
                >
                  <img src={RESOURCE_ART.deuterium} alt="" aria-hidden className="size-3.5 object-contain" />
                  {compact(settlementFuel)}
                </Requirement>
                <Requirement
                  ok={claimActive ? settlementCanArrive : settlementEta < SETTLEMENT_CLAIM_MINUTES}
                  label={t('focus.planet.arrivesIn', { duration: duration(settlementEta) })}
                  explanation={t('focus.planet.settlementArrivalExplain', {
                    duration: duration(settlementEta),
                  })}
                >
                  {t('focus.planet.arrivesIn', { duration: duration(settlementEta) })}
                </Requirement>
              </>
            )}
          </RouteStep>
        </ol>
        {claimActive && (
          <p className="mt-2 text-center text-body text-bone">
            {t('focus.planet.claimRaceExplain')}
          </p>
        )}
        {claimActive && until && (
          <p className="num mt-2 text-center text-body text-opportunity">
            {t('focus.planet.claimCloses', { duration: duration((until.getTime() - now) / 60_000) })}
          </p>
        )}
        {claimActive && (
          <div className="mt-2 grid gap-1 border-t border-opportunity/20 pt-2 text-label leading-snug text-dim">
            <p className="flex items-start gap-2">
              <AttackIcon className="mt-1 size-3.5 shrink-0 text-alloy" />
              <span>{t('focus.planet.claimRaidStillOpen')}</span>
            </p>
            <p className="flex items-start gap-2">
              <span aria-hidden className="mt-px shrink-0 text-alert">◆</span>
              <span>{t('focus.planet.claimDeathStarConsequence', {
                duration: duration(recoveryMinutesFor('COLONY')),
              })}</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  const recovery = target.state.kind === 'RECOVERY' ? target.state : null;
  const protectedState = target.state.kind === 'PROTECTED' ? target.state : null;
  return (
    <div className={`mb-3 rounded-chip border px-3 py-3 ${
      recovery
        ? 'border-alert/55 bg-alert/12'
        : isRival ? 'border-[#ff6b43]/45 bg-[#ff6b43]/8' : 'border-line-soft bg-deep/65'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`legend ${recovery ? 'text-threat-ink' : 'text-bone'}`}>
          {t(recovery
            ? 'focus.planet.recoveryBreach'
            : protectedState
              ? 'focus.planet.occupationProtected'
              : 'focus.planet.deathStarRoute')}
        </p>
        {recovery && <span className="num text-label text-threat-ink">{duration((recovery.until.getTime() - now) / 60_000)}</span>}
      </div>
      {protectedState ? (
        <p className="mt-1 text-label text-dim">
          {t('focus.planet.protectedFor', { duration: duration((protectedState.until.getTime() - now) / 60_000) })}
        </p>
      ) : (
        <ol className="mt-2 grid grid-cols-2 items-start gap-2 text-center">
          <RouteStep
            status={recovery ? 'complete' : 'current'}
            open={isOpen('strike-1', !recovery)}
            onToggle={() => { toggleStep('strike-1'); }}
            number="1"
            label={t('focus.planet.firstImpact', {
              duration: duration(recoveryMinutesFor('COLONY')),
            })}
            danger
          />
          <RouteStep
            status={recovery ? 'current' : 'upcoming'}
            open={isOpen('strike-2', Boolean(recovery))}
            onToggle={() => { toggleStep('strike-2'); }}
            number="2"
            label={t('focus.planet.secondImpact')}
            danger
          />
        </ol>
      )}
      {/* A capital never reaches this guide — it returns above — so this is always
          a colony, and a colony is the world that can actually be lost. */}
      {!protectedState && <StrikeEffects capturable />}
      {/*
        THE THREE CHIPS HERE WERE THE CAPTURE GATES — an open colony slot, a ready
        weapon, a flight that lands before the window shuts — and D167 removed the
        route they belonged to. What a reader needs in their place is the one fact
        that decides this world's fate: whoever holds it has until the clock runs
        out to put a ship on it, and nobody has to fire anything for it to fall.
      */}
      {recovery && (
        <p className="mt-2 text-label leading-snug text-threat-ink">
          {t('focus.planet.recoveryDropWarning', {
            duration: duration((recovery.until.getTime() - now) / 60_000),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * ONE STEP OF THE ROUTE, AND ONLY THE LIVE ONE IS OPEN. Owner report.
 *
 * All three steps used to render fully expanded — number, label, prose and
 * requirement chips — stacked down a 375-wide phone. A three-step process the
 * commander is only ever standing on ONE step of filled the screen with the two
 * they were not on, and pushed the controls that act on it below the fold.
 *
 * So the route is a stepper. The current step carries its explanation; the others
 * are a number and a label on one line, and pressing one opens it — the player may
 * always read ahead, they are simply not made to. The same progressive disclosure
 * the ship lists took, for the same reason: `interface.md`'s fourth question.
 *
 * THE HEADER IS A BUTTON ONLY WHERE THERE IS SOMETHING BEHIND IT. A step with no
 * prose and no requirements opens onto nothing, and a control that does nothing
 * teaches a player that the controls here do not work.
 */
function RouteStep({
  status,
  number,
  label,
  description,
  dataStep,
  danger = false,
  open,
  onToggle,
  children,
}: {
  status: 'complete' | 'current' | 'upcoming';
  number: string;
  label: string;
  description?: string;
  dataStep?: string;
  danger?: boolean;
  /** Whether this step is showing its detail. */
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const tone = status === 'current'
    ? danger ? 'border-alert/45 bg-alert/10 text-threat-ink' : 'border-opportunity/45 bg-opportunity/10 text-opportunity'
    : status === 'complete'
      ? 'border-crystal/30 bg-crystal/5 text-crystal'
      : 'border-line-soft bg-void/25 text-faint';
  /**
   * ONLY THE PROSE FOLDS. THE REQUIREMENTS NEVER DO.
   *
   * The first cut of this folded `children` too, and `focus-actions.test.tsx`
   * caught what that costs: the founding requirements — two Couriers, the alloy,
   * the crystal — sit on step THREE, and a commander standing on step one would
   * not have seen them until the race was already open. That test is named "so the
   * claim cannot reveal a surprise cost", and hiding a cost behind a tap is the
   * Decision-support failure `interface.md` lists third.
   *
   * The prose is the bulk of the height anyway — two or three lines per step
   * against one row of chips — so folding it is where the screen is won, and
   * folding the chips would have bought almost nothing for a real regression.
   */
  const hasDetail = description !== undefined;

  const header = (
    <span className="flex w-full items-center gap-2 text-left">
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-current text-micro">
        {status === 'complete' ? '✓' : number}
      </span>
      <span className="legend block min-w-0 flex-1 leading-tight">{label}</span>
      {hasDetail && (
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`size-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M7 4.5 12.5 10 7 15.5" />
        </svg>
      )}
    </span>
  );

  return (
    <li
      className={`relative rounded-chip border px-2 py-2 text-left ${tone}`}
      aria-current={status === 'current' ? 'step' : undefined}
      data-colony-step={dataStep}
      data-open={open ? 'true' : 'false'}
    >
      {hasDetail ? (
        <button type="button" aria-expanded={open} className="w-full" onClick={onToggle}>
          {header}
        </button>
      ) : header}

      {open && description !== undefined && (
        <span data-step-detail className="mt-2 block text-label leading-snug text-dim">
          {description}
        </span>
      )}
      {children && <span className="mt-2 flex flex-wrap gap-1.5">{children}</span>}
    </li>
  );
}

function RivalHistory({
  summary,
  probeAt,
  now,
  marked,
}: {
  summary: RivalSummary | undefined;
  probeAt: Date | undefined;
  now: number;
  marked: boolean;
}) {
  const { t } = useTranslation();
  const battleAt = summary?.lastInteractionAt.getTime() ?? 0;
  const probeTime = probeAt?.getTime() ?? 0;
  const lastAt = Math.max(battleAt, probeTime);
  const story = !summary
    ? probeAt
      ? t('focus.planet.rivalProbeOnly')
      : t('focus.planet.rivalNoContact')
    : summary.battles >= 3
      ? t('focus.planet.rivalFeud', { count: summary.battles })
      : summary.dominionGained > summary.dominionLost
        ? t('focus.planet.rivalAhead')
        : summary.dominionLost > summary.dominionGained
          ? t('focus.planet.rivalBehind')
          : t('focus.planet.rivalEven');

  return (
    <section
      className="mb-3 rounded-chip border border-alloy/25 bg-alloy/5 px-3 py-3"
      aria-label={t('focus.planet.rivalHeading')}
    >
      <div className="flex items-baseline gap-2">
        <h3 className="legend text-alloy">{t('focus.planet.rivalHeading')}</h3>
        {marked && (
          <span className="legend ml-auto text-alloy">
            {t('focus.planet.rivalMarkedBadge')}
          </span>
        )}
      </div>
      <p className="mt-1 text-caption leading-snug text-dim">{story}</p>
      {marked && <p className="mt-2 text-micro leading-snug text-faint">{t('focus.planet.rivalPurpose')}</p>}
      {summary && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          <Figure label={t('focus.planet.rivalEncounters')} value={String(summary.battles)} />
          <Figure label={t('focus.planet.rivalYourRaids')} value={String(summary.attacks)} />
          <Figure label={t('focus.planet.rivalTheirRaids')} value={String(summary.defences)} />
          <Figure
            label={t('focus.planet.rivalDominion')}
            value={t('focus.planet.rivalDominionValue', {
              gained: compact(summary.dominionGained),
              lost: compact(summary.dominionLost),
            })}
          />
        </div>
      )}
      {lastAt > 0 && (
        <p className="legend mt-2">
          {t('focus.planet.rivalLastContact', { age: staleness((now - lastAt) / 60_000) })}
        </p>
      )}
    </section>
  );
}

/** The collapsed rail's single line. Never claims ignorance the player does not have. */
function Headline({ of }: { of: HeadlineKind }) {
  const { t } = useTranslation();
  switch (of.kind) {
    case 'fleet-away':
      return <span className="text-opportunity">{t('focus.planet.headlineFleetAway')}</span>;
    case 'fleet-home':
      return <span>{t('focus.planet.headlineFleetHome')}</span>;
    case 'veiled':
      return <span className="text-dim">{t('focus.planet.headlineVeiled')}</span>;
    case 'probed':
      return (
        <span className="text-dim">
          {t('focus.planet.headlineProbed', { age: staleness(of.ageMinutes) })}
        </span>
      );
    case 'fought':
      return (
        <span className="text-dim">
          {t('focus.planet.headlineFought', { age: staleness(of.ageMinutes) })}
        </span>
      );
    case 'none':
      return <span className="text-faint">{t('focus.planet.headlineNone')}</span>;
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
  observerPlanetId,
  intel,
  onInstallTelescope,
}: {
  gap: Gap;
  target: GalaxyPlanet;
  telescope: number;
  observerPlanetId: string;
  intel: IntelView | undefined;
  onInstallTelescope: () => void;
}) {
  const { t } = useTranslation();
  const watch = useWatch();
  const say = useToast();

  if (gap.closes === 'telescope') {
    if (telescope === 0) {
      return (
        <button type="button" className="slab slab-ghost w-full" onClick={onInstallTelescope}>
          {t('focus.planet.installTelescope')}
        </button>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: telescopeSlots(telescope) }, (_, slot) => {
          const current = intel?.watching.find((w) =>
            w.slot === slot && (!w.observerPlanetId || w.observerPlanetId === observerPlanetId));
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
                      say(t('focus.planet.watching', { target: target.name }));
                    },
                    onError: (err) => {
                      say(describe(err), 'error');
                    },
                  },
                );
              }}
            >
              {current
                ? t('focus.planet.replaceSlot', { slot: slot + 1, target: current.targetName })
                : t('focus.planet.watchSlot', { slot: slot + 1 })}
            </button>
          );
        })}
      </div>
    );
  }

  // `probe` has its own control, below the list — see `ProbeControl`, which is
  // where the reason it cannot live in a gap row is written.
  // `battle` closes itself, by fighting. There is no button for that here — the
  // one at the bottom of the panel is it.
  return null;
}

/**
 * SEND A PROBE — AND IT IS NOT A GAP, IT IS A STANDING OFFER. Owner report.
 *
 * This button used to be rendered by `CloseGap` off the "nobody has looked here"
 * gap, and that made the most-used control in the game a ONE-SHOT: the newest
 * report per target is kept for the whole season (`readProbeReports`), so the
 * moment the first probe came home the gap closed and the launch vanished with
 * it. A world probed six hours ago — with a dossier going stale on the screen
 * beside it, which is exactly when a commander wants another look — offered no
 * way to look again. Reading intelligence is not something you finish.
 *
 * Being one control rather than a per-gap one also fixes the twin: an unsurveyed
 * world is missing its surface AND its stock, two gaps closed by the same launch,
 * so the rail grew two identical buttons.
 *
 * THE COOLDOWN IS THE ONLY THING THAT CLOSES IT. D121 — one look per world per
 * hour, enforced in `launchProbe` under the planet lock, which is the only place
 * it can be enforced. What this does is stop the interface offering a launch it
 * already knows will be refused (principle 10), reading the SAME instant the
 * guard reads, published by `/api/intel`, so the two can never disagree by a
 * rounding. `serverNow()` because a drifted phone must not open it early (D52).
 */
function ProbeControl({
  target,
  intel,
  onLaunched,
}: {
  target: GalaxyPlanet;
  intel: IntelView | undefined;
  /** Called with the target's name once a probe is away, so the disc can follow it. */
  onLaunched: (targetName: string) => void;
}) {
  const { t } = useTranslation();
  const probe = useProbe();
  const say = useToast();

  const readyAt = intel?.probeCooldowns.find(
    (row) => row.targetPlanetId === target.id,
  )?.readyAt;
  /*
    HALF A ROW, BECAUSE IT SHARES ONE WITH THE ATTACK. Owner instruction.
    `min-w` keeps the pair from collapsing into slivers on a narrow phone: below
    that the flex row wraps and each takes a line again, which is the right
    degradation.
  */
  const shape = 'slab-compact min-w-[7.5rem] flex-1 basis-[calc(50%-0.25rem)] leading-tight';

  if (readyAt !== undefined && readyAt.getTime() > serverNow()) {
    return (
      <button
        type="button"
        className={`slab ${shape}`}
        disabled
        /*
          THE WHOLE SENTENCE SURVIVES FOR ANYONE WHO CANNOT SEE THE LAYOUT.
          Pairing the controls shortened the visible label to a verb; the
          accessible name keeps what the label used to say, because a compact
          button is a visual saving and must not become an information loss.
        */
        aria-label={t('focus.planet.probeCooling', {
          duration: duration((readyAt.getTime() - serverNow()) / 60_000),
        })}
      >
        <EyeIcon className="size-4 shrink-0" />
        {t('focus.planet.probeShort')}
        <span className="num text-micro text-faint">
          {duration((readyAt.getTime() - serverNow()) / 60_000)}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`slab slab-primary ${shape}`}
      // The verb is the label; the sentence — cost and all — is the accessible name.
      aria-label={t('focus.planet.sendProbe', {
        alloy: compact(PROBE.alloy),
        crystal: compact(PROBE.crystal),
      })}
      disabled={probe.isPending}
      onClick={() => {
        probe.mutate(target.id, {
          onSuccess: (r) => {
            say(t('focus.planet.probeAway', { duration: duration(r.flightMinutes) }));
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
      {/* An eye, deliberately — see `EyeIcon`. A probe looks at somebody else's
          world and that world is told, which is the opposite of the aperture the
          Intel centre wears. */}
      <EyeIcon className="size-4 shrink-0" />
      {t('focus.planet.probeShort')}
      {/*
        THE COST STAYS ON THE CONTROL, AND ON THE SAME LINE AS THE VERB.

        Pairing the commitments cost the label its sentence, and the one part of
        that sentence that may not be dropped is the SPEND — a price the player
        cannot see before pressing is a worse failure than a button that was too
        wide. Stacked under the verb it made the button two lines tall, which is the
        thing the pairing was for; inline it costs nothing but width the resource
        marks already fit in.
      */}
      <Price cost={{ alloy: PROBE.alloy, crystal: PROBE.crystal }} layout="row" />
    </button>
  );
}

/* ── a rock crossing the disc ────────────────────────────────── */

/**
 * ASTEROID FOCUS — D19.
 *
 * Its trajectory, remaining ore and anomaly signature are public because the race
 * only means something if everyone can see it. Spectrometry alone reveals the
 * isotope mix and permits launch. The two lines that decide whether to go are the
 * ore left and the time left, so they lead.
 */
export function AsteroidFocus({
  rock,
  isotopeAccess,
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
  /** Commander-wide Spectrometry permission; target composition is not an access flag. */
  isotopeAccess: boolean;
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
  const { t } = useTranslation();
  const crystal = Math.round(rock.crystalShare * 100);
  const deuterium = Math.round((rock.deuteriumShare ?? 0) * 100);
  const needsSpectrometry = rock.isotopeRich && !isotopeAccess;
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
      eyebrow={t('focus.asteroid.eyebrow', { level: rock.level })}
      title={t('focus.asteroid.title')}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={
        <span>
          <Trans
            i18nKey={rock.isotopeRich ? 'focus.asteroid.summaryAnomaly' : 'focus.asteroid.summaryOre'}
            values={{ amount: compact(rock.oreRemaining) }}
            components={[<span key="n" className="text-crystal" />]}
          />
          {' · '}
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
          <p className="num text-caption text-crystal">
            {t('focus.asteroid.working', {
              count: run.craft,
              state: t(
                run.status === 'returning'
                  ? 'focus.asteroid.stateReturning'
                  : 'focus.asteroid.stateInbound',
              ),
            })}
          </p>
        ) : (
          <button
            type="button"
            className="slab slab-primary basis-full whitespace-normal px-3 leading-tight max-h-10 min-h-10"
            disabled={busy || needsSpectrometry || craftAvailable < 1 || tooLate}
            onClick={() => {
              onSend(sending);
            }}
          >
            {needsSpectrometry
              ? t('focus.asteroid.researchNeeded')
              : craftAvailable < 1
                ? t('focus.asteroid.noCraft')
                : tooLate
                  ? t('focus.asteroid.tooLate')
                  : t('focus.asteroid.send', { count: sending, duration: duration(reach) })}
          </button>
        )
      }
    >
      {!run && !needsSpectrometry && (
        <CraftPicker
          available={craftAvailable}
          value={sending}
          onPick={setCraft}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <Figure
          label={t('focus.asteroid.oreLeft')}
          value={compact(rock.oreRemaining)}
          tone="crystal"
        />
        <Figure
          label={t('focus.asteroid.leavesIn')}
          value={duration(minutesLeft)}
          tone={minutesLeft < 60 ? 'threat' : undefined}
        />
        <Figure
          label={t('focus.asteroid.composition')}
          value={
            rock.isotopeRich
              ? rock.deuteriumShare === null
                ? t('focus.asteroid.compositionUnknown')
                : t('focus.asteroid.compositionIsotope', {
                    crystal,
                    deuterium,
                  })
              : t('focus.asteroid.compositionValue', { percent: crystal })
          }
        />
        <Figure
          label={t('focus.asteroid.speed')}
          value={t('focus.asteroid.speedValue', { rate: rock.speed.toFixed(1) })}
        />
      </div>

      {rock.isotopeRich && (
        <p className="mt-3 border-l border-deuterium/60 pl-3 text-caption leading-snug text-deuterium">
          {t('focus.asteroid.deuteriumRoute')}
        </p>
      )}

      {spill > 0 && !run && (
        /**
         * Said BEFORE the commitment, not after it. A squadron is a real decision
         * and the works filling up while it was away is the one thing that can
         * make that decision worse without the player doing anything wrong —
         * so it is stated here, with the fix, rather than reported on arrival.
         */
        <p className="mt-3 text-caption leading-snug text-alloy">
          {t('focus.asteroid.spill', { room: compact(worksRoom), lost: compact(spill) })}
        </p>
      )}

      <p className="mt-3 text-caption leading-snug text-dim">
        {rock.oreRemaining < rock.ore
          ? t('focus.asteroid.taken', { amount: compact(rock.ore - rock.oreRemaining) })
          : t('focus.asteroid.untouched')}
      </p>

      <p className="num mt-2 text-label text-faint">
        {t('focus.asteroid.fleetLine', {
          count: craftAvailable,
          hold: compact(craftHold),
          total: compact(canCarry),
        })}
      </p>

      {/* The one thing a Derrick changes about this trip, priced as a reason. */}
      {!derrick && derrickHold > craftHold && (
        <p className="mt-1 text-label leading-snug text-faint">
          <Trans
            i18nKey="focus.asteroid.derrickPitch"
            values={{ name: satelliteLabel('DERRICK'), hold: compact(derrickHold) }}
            components={[
              <span key="n" className="text-bone" />,
              <span key="h" className="num text-crystal" />,
            ]}
          />
        </p>
      )}

      {/*
        Speed is a fact about the ROCK, not about the trip. Stating the flight time
        beside it is what turns "9.2 a minute" into a decision, because the only
        question that matters is whether the craft gets there first.
      */}
      {reach !== null && !tooLate && (
        <p className="mt-1 text-label leading-snug text-faint">
          {t('focus.asteroid.intercept', {
            reach: duration(reach),
            spare: duration(minutesLeft - reach),
          })}
        </p>
      )}
    </Shell>
  );
}

/** Every hull that may fly an attack, in catalogue order. */
const MOBILE_HULL_IDS = MOBILE_HULLS;

/* ── a pirate fleet crossing the disc ────────────────────────── */

/**
 * PIRATE FOCUS — D150.
 *
 * SHAPED LIKE `AsteroidFocus`, deliberately: to a player these are the same
 * decision wearing two costumes — something is passing through, it is worth
 * something, it will not be there later, and the only question is whether what you
 * can send arrives in time. Reusing the shape means the second one is already
 * learned the first time it is seen.
 *
 * WHAT IS DIFFERENT IS THAT IT SHOOTS BACK, and that is why the level and its
 * damage handicap lead. A rule the player cannot see is not a usable rule (D124):
 * the level sets what the crew flies, how hard it hits and how likely a ship is to
 * come home with you, and none of those exist anywhere else in the interface.
 *
 * AND SINCE D160 IT MAY BE DESCRIBING SOMETHING OUT OF SIGHT. A pirate this
 * commander has once identified stays on the list, and stays raidable, until it
 * dies — exactly like a rock, and like a rock its figures stay current. What the
 * rail adds is the one thing the numbers cannot say: no circle is covering this
 * right now. Then it offers the commitment anyway, because an opportunity nobody
 * can act on is not a decision (D124).
 */
export function PirateFocus({
  pirate,
  fleetAtHome,
  onClose,
  onAttack,
  raiding,
  open,
  onToggle,
}: {
  pirate: PirateContact;
  /** What is STANDING at the selected world. Nothing in the air can be sent again. */
  fleetAtHome: Fleet;
  onClose: () => void;
  /** Opens `LaunchSheet` — the game's one commitment surface. */
  onAttack: () => void;
  /** This world already has a raid out at this pirate — one per world. */
  raiding: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const identified = pirate.zone === 'IDENTIFIED';
  const crew = pirate.fleet;
  const crewEntries = crew ? fleetEntries(crew) : [];

  /**
   * Whether there is anything here that could be sent at all.
   *
   * MOBILE hulls only: a Prospector cannot fly an attack, so a world holding
   * nothing but miners has an empty hangar as far as this decision is concerned.
   * Every other refusal — no bay, no fuel, too slow, too late — belongs to the
   * sheet, which is where the fleet is actually chosen and therefore the only
   * place those questions have an answer.
   */
  const hasShips = MOBILE_HULL_IDS.some((hull) => (fleetAtHome[hull] ?? 0) > 0);

  /**
   * THE BEST CASE THIS WORLD COULD MANAGE, AND IT IS LABELLED AS ONE.
   *
   * `reachMinutes` is the soonest rendezvous the world's FASTEST hull could keep —
   * an honest upper bound on opportunity, which is the question a rail answers:
   * could I reach this at all. What the launch will actually use depends on the
   * slowest ship SELECTED, and the sheet quotes that exactly, from the same table.
   */
  const soonest = pirate.reachMinutes;

  return (
    <Shell
      /*
        A RADAR RETURN HAS NO LEVEL, AND MAY NOT BE GIVEN ONE. D123.

        This read `level ?? 0` and printed "Level 0 pirates" over a title that said
        "Unidentified contact" in the same breath — a number the schema does not
        even allow (levels are 1-4) sitting where the fog has nothing to say.
      */
      eyebrow={pirate.level === undefined
        ? t('pirate.eyebrowUnknown')
        : t('pirate.eyebrow', { level: pirate.level })}
      title={
        identified && pirate.level !== undefined
          ? t('pirate.name', { level: pirate.level, callsign: pirate.callsign })
          : t('pirate.unknownContact')
      }
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={
        <span>
          <span className={pirate.expiresInMinutes < 30 ? 'text-threat' : ''}>
            {duration(pirate.expiresInMinutes)}
          </span>
          {soonest !== null && ` · ${t('pirate.reach', { duration: duration(soonest) })}`}
        </span>
      }
      /*
        ONE TAP TO THE GAME'S OWN COMMITMENT SURFACE. D150 — owner instruction.

        This rail used to carry its own picker and its own send button, which made
        it a second, thinner `LaunchSheet`: no hull stats, no cargo, no hangar, no
        ships-away, no confirmation step and no fleetsave line. Flying at a pirate
        is the same bet as flying at a world — ships leave, the world is uncovered
        for the round trip, the fuel is prepaid and nothing can be recalled — so it
        is the same screen. What is left here is what only a rail can say.
      */
      actions={
        raiding ? (
          <p className="num text-caption text-crystal">{t('pirate.alreadyRaiding')}</p>
        ) : (
          <button
            type="button"
            className="slab slab-primary basis-full whitespace-normal px-3 leading-tight max-h-10 min-h-10"
            disabled={!hasShips}
            onClick={onAttack}
          >
            {hasShips ? t('pirate.attack') : t('pirate.noShips')}
          </button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Figure
          label={t('pirate.leavesIn')}
          value={duration(pirate.expiresInMinutes)}
          tone={pirate.expiresInMinutes < 30 ? 'threat' : undefined}
        />
        <Figure
          label={t('pirate.reachLabel')}
          value={soonest === null ? '—' : duration(soonest)}
          tone={soonest === null ? 'threat' : undefined}
        />
      </div>

      {/*
        THE HANDICAP, IN WORDS AND AS A NUMBER. It is the only combat modifier in
        the feature and the entire reason a PvE prize can be affordable — so a
        player who cannot read it is being asked to price a fight blind.
      */}
      {identified && pirate.damageMult !== undefined && (
        <p className="mt-3 border-l border-crystal/60 pl-3 text-caption leading-snug text-crystal">
          {t('pirate.damagePenalty', { percent: Math.round((1 - pirate.damageMult) * 100) })}
        </p>
      )}

      {/*
        "YOU CANNOT SEE THIS", ABOVE THE THING IT QUALIFIES. D160.

        Placed immediately over the crew because the crew is what it is about — a
        line at the foot of the rail would be read after the decision it is supposed
        to inform. One line, no panel: this is a caveat, not a section.
      */}
      {pirate.remembered === true && (
        <p className="mt-3 border-l border-line pl-3 text-caption leading-snug text-faint">
          {t('pirate.remembered')}
        </p>
      )}

      {/* Actual sight carries the actual crew; a radar return carries a size. */}
      <p className="legend mt-2 mb-2">{t('pirate.roster')}</p>
      {crewEntries.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {crewEntries.map(([hull, count]) => (
            <span
              key={hull}
              className="flex items-center gap-1.5 rounded-chip border border-line px-2 py-1"
              title={hullLabel(hull)}
            >
              <HullMark hull={hull} className="size-4 text-dim" />
              <span className="num text-caption text-bone">{count}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-caption text-faint">{t('pirate.rosterUnknown')}</p>
      )}

      <p className="mt-3 text-caption leading-snug text-faint">{t('pirate.captureHint')}</p>
      <p className="mt-1 text-caption leading-snug text-faint">{t('pirate.hoardHint')}</p>
      <p className="mt-3 text-caption leading-snug text-dim">{t('pirate.boundary')}</p>
      <p className="mt-2 text-caption leading-snug text-threat-ink">{t('pirate.outbound')}</p>
    </Shell>
  );
}

/* ── the merchant crossing the disc ──────────────────────────── */

/**
 * TRADE FOCUS — D156.
 *
 * The third rail in this file with the same bones, and that is the point: a rock,
 * a pirate and a merchant are one decision in three costumes. Something is passing
 * through, it is worth something, it will not be there later, and the only question
 * is whether what you can send arrives in time. Reusing `AsteroidFocus`'s shape
 * means the third one is already learned the first time it is seen.
 *
 * WHAT ONLY THIS ONE HAS IS THE RATE, and it is the entire reason to fly at it. A
 * rule the player cannot see is not a usable rule (D124), and until this rail
 * existed the rate lived in a constants file and two docblocks. So it is DRAWN
 * (D142) — three bars against one deuterium — rather than written as a sentence
 * the player has to hold in their head while sizing a convoy.
 *
 * THERE IS NO FOG HERE AND THERE NEVER WILL BE. The merchant is an announced
 * public moment: every commander in the galaxy sees the same ship, the same orbit
 * and the same rate, which is why the boundary line says so out loud rather than
 * leaving a player to wonder what they have not bought.
 */
export function TradeFocus({
  merchant,
  fleetAtHome,
  fleetAway,
  minutesLeft,
  reachMinutes: reach,
  onClose,
  onTrade,
  open,
  onToggle,
}: {
  merchant: TradeShipEvent;
  /** What is STANDING at the selected world. Nothing in the air can be sent again. */
  fleetAtHome: Fleet;
  /** Already committed elsewhere — a convoy in the air is not a convoy you lack. */
  fleetAway: Fleet;
  /** How long the window has left, off the shared clock. */
  minutesLeft: number;
  /**
   * THE BEST CASE THIS WORLD COULD MANAGE, AND IT IS LABELLED AS ONE.
   *
   * The soonest rendezvous the world's fastest hull could keep — an honest upper
   * bound on opportunity, which is the question a rail answers: could I reach this
   * at all. What the launch will actually use depends on the slowest ship SELECTED,
   * and the sheet quotes that exactly, from the same solver.
   */
  reachMinutes: number | null;
  onClose: () => void;
  /** Opens `TradeSheet` — the surface the swap is actually committed on. */
  onTrade: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const hasCraft = MOBILE_HULL_IDS.some((hull) => (fleetAtHome[hull] ?? 0) > 0);
  /*
    A CONVOY WITH NO CARRIER HAS NO HOLD, and that is a different refusal from
    having no craft at all — one is fixed by waiting for a fleet to land, the other
    by building a transport. `services/trade.ts` answers them separately
    (`EMPTY_FLEET` against `TRANSFER_NEEDS_CARGO_HULL`) and so does this.
  */
  const hasCarrier = transferCargoCapacity(fleetAtHome) > 0;
  /*
    "YOU HAVE NONE" AND "YOURS ARE OUT" ARE NOT THE SAME SENTENCE. Owner report: a
    commander who had just sent their only Atlas at this merchant was told
    *"Burada Kurye, Seyyah veya Atlas yok"* — true of the pad, and nonsense to read
    while watching that very convoy fly. One is fixed by building a transport, the
    other by waiting for one to land, and a rail that cannot tell them apart sends
    a player to the shipyard to buy what they already own.
  */
  const carriersAway = !hasCarrier && transferCargoCapacity(fleetAway) > 0;
  const tooLate = reach === null;

  return (
    <Shell
      eyebrow={t('trade.eyebrow')}
      title={t('trade.title')}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={(
        <span>
          <span className={minutesLeft < 30 ? 'text-threat' : ''}>{duration(minutesLeft)}</span>
          {reach !== null && ` · ${t('trade.summaryReach', { duration: duration(reach) })}`}
        </span>
      )}
      actions={(
        <button
          type="button"
          data-testid="trade-open"
          className="slab slab-primary basis-full whitespace-normal px-3 leading-tight max-h-10 min-h-10"
          disabled={!hasCraft || !hasCarrier || tooLate}
          onClick={onTrade}
        >
          {/*
            THE SAME LADDER THE SHEET USES, TRUNCATED TO WHAT A RAIL CAN KNOW.
            Everything below this — the bay, the swap, the hold, the store, the fuel
            — depends on a convoy that has not been chosen yet, so it belongs to the
            sheet. What a rail can answer is whether there is any point opening one.
          */}
          {carriersAway
            ? t('trade.carriersAway')
            : !hasCraft
              ? t('trade.noCraft')
              : !hasCarrier
                ? t('trade.noCarrier')
                : tooLate
                  ? t('trade.tooLate')
                  : t('trade.open')}
        </button>
      )}
    >
      {/*
        THE RATE, DRAWN. D124 · D142.

        One anchor — a single deuterium — and what it is worth in each of the three
        substances, as bars against the largest of them. The numerals are there, but
        the SHAPE is what says "alloy is cheap and deuterium is dear" before a word
        is read, which is the judgement a player actually makes here.
      */}
      <p className="legend mb-2">{t('trade.rateHeading')}</p>
      <div data-testid="trade-rate" className="space-y-2">
        {TRADE_RESOURCES.map((resource) => {
          const amount = merchant.rate.deuterium / merchant.rate[resource];
          const widest = merchant.rate.deuterium / Math.min(
            merchant.rate.alloy,
            merchant.rate.crystal,
            merchant.rate.deuterium,
          );
          return (
            <div key={resource} data-rate-row data-resource={resource} className="flex items-center gap-2">
              <img
                src={RESOURCE_ART[resource]}
                alt=""
                aria-hidden
                className="size-4 shrink-0 object-contain"
              />
              <span
                className="socket h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
                role="img"
                aria-label={t('trade.rateReading', {
                  amount: full(amount),
                  resource: t(`trade.${resource}`),
                })}
              >
                <span
                  className={`block h-full ${RATE_FILL[resource]}`}
                  style={{ width: `${String(Math.max(2, (amount / widest) * 100))}%` }}
                />
              </span>
              <span className="num w-14 shrink-0 text-right text-caption text-bone">
                {full(amount)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Figure
          label={t('trade.leavesIn')}
          value={duration(minutesLeft)}
          tone={minutesLeft < 30 ? 'threat' : undefined}
        />
        <Figure
          label={t('trade.reachLabel')}
          value={reach === null ? t('trade.reachNone') : duration(reach)}
          tone={reach === null ? 'threat' : undefined}
        />
      </div>

      <p className="mt-3 text-caption leading-snug text-dim">{t('trade.boundary')}</p>
    </Shell>
  );
}

/** The three substances, in the order every surface in the game lists them. */
const TRADE_RESOURCES = ['alloy', 'crystal', 'deuterium'] as const;

/** Each substance's own colour, so a bar is identified before it is read. */
const RATE_FILL: Record<(typeof TRADE_RESOURCES)[number], string> = {
  alloy: 'bg-alloy/80',
  crystal: 'bg-crystal/80',
  deuterium: 'bg-deuterium/80',
};

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
  const { t } = useTranslation();
  const returning = run.status === 'returning';
  const salvage = run.targetKind === 'debris';
  const now = useNow(1000);
  const arriveAt = returning ? (run.homeAt ?? run.arriveAt) : run.arriveAt;
  const remainingMs = arriveAt.getTime() - now;

  return (
    <Shell
      eyebrow={t(
        returning
          ? 'focus.run.eyebrowHome'
          : salvage
            ? 'focus.run.eyebrowSalvage'
            : 'focus.run.eyebrowOutbound',
      )}
      title={t('focus.run.title', { count: run.craft })}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={<span>{countdown(remainingMs)}</span>}
    >
      <div className="grid grid-cols-2 gap-2">
        <Figure
          label={t(
            returning
              ? 'focus.run.homeIn'
              : salvage
                ? 'focus.run.reachesIn'
                : 'focus.run.meetsRockIn',
          )}
          value={duration(minutesRemaining)}
        />
        <Figure
          label={t('focus.run.target')}
          value={
            salvage
              ? wreck
                ? wreck.planetName === undefined
                  ? t('focus.run.targetWreckAnon')
                  : t('focus.run.targetWreck', { planet: wreck.planetName })
                : t('focus.run.targetDecayed')
              : rock
                ? t('focus.run.targetRock', { level: rock.level })
                : t('focus.run.targetRockGone')
          }
        />
      </div>

      {returning ? (
        <p className="mt-3 text-body leading-snug text-bone">
          {run.minedAlloy + run.minedCrystal + run.minedDeuterium > 0
            ? t(
                run.minedDeuterium > 0
                  ? 'focus.run.carryingDeuterium'
                  : 'focus.run.carrying',
                {
                  alloy: compact(run.minedAlloy),
                  crystal: compact(run.minedCrystal),
                  deuterium: compact(run.minedDeuterium),
                },
              )
            : t(salvage ? 'focus.run.emptySalvage' : 'focus.run.emptyRock')}
        </p>
      ) : salvage ? (
        <p className="mt-3 text-caption leading-snug text-dim">
          {t('focus.run.salvageNote', {
            clock: wreck ? t('focus.run.salvageClock', { duration: duration(wreck.minutesLeft) }) : '',
          })}
        </p>
      ) : (
        <p className="mt-3 text-caption leading-snug text-dim">{t('focus.run.miningNote')}</p>
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
  const { t } = useTranslation();
  const composition = thread.fleet ? describeThreadFleet(thread.fleet) : null;
  const now = useNow(1000);
  const remainingMs = thread.arriveAt.getTime() - now;

  return (
    <Shell
      eyebrow={t(
        thread.kind === 'probe'
          ? thread.leg === 'return'
            ? 'focus.thread.eyebrowProbeHome'
            : 'focus.thread.eyebrowProbeOut'
          : thread.leg === 'return'
            ? 'focus.thread.eyebrowFleetHome'
            : 'focus.thread.eyebrowFleetOut',
      )}
      title={thread.targetName}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={<span>{countdown(remainingMs)}</span>}
    >
      <div className="grid grid-cols-2 gap-2">
        <Figure label={t('focus.thread.arrivesIn')} value={duration(minutesRemaining)} />
        <Figure
          label={t('focus.thread.craft')}
          value={
            composition
              ? String(fleetCount(thread.fleet ?? {}))
              : t('focus.thread.craftUnknown')
          }
        />
      </div>

      {composition && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.entries(thread.fleet ?? {}) as [HullId, number][])
            .filter(([, n]) => n > 0)
            .map(([hull, n]) => (
              <span
                key={hull}
                className="flex items-center gap-2 rounded-chip border border-line-soft px-2 py-1"
              >
                <HullMark hull={hull} className="size-4 text-dim" />
                <span className="num text-caption text-bone">
                  {n} {hullLabel(hull)}
                </span>
              </span>
            ))}
        </div>
      )}

      <p className="mt-3 text-caption leading-snug text-dim">
        {t(thread.leg === 'return' ? 'focus.thread.returning' : 'focus.thread.outbound')}
      </p>
    </Shell>
  );
}

/**
 * Only ever tested for emptiness by the panel, but it is still a string a
 * developer reads in a debugger — so it names hulls the way the rest of the game
 * does rather than printing the raw enum.
 */
const describeThreadFleet = (fleet: Record<string, number>): string =>
  Object.entries(fleet)
    .filter(([, n]) => n > 0)
    .map(([hull, n]) => `${String(n)} ${hullName(hull) ?? hull}`)
    .join(' · ');

/* ── someone else's craft ────────────────────────────────────── */

/**
 * A CONTACT YOU CAN NOW READ — UP TO A POINT. D24.
 *
 * This panel used to say "unattributable" and explain that you were not entitled
 * to resolve it. The owner changed what the galaxy publishes: other people's craft
 * are real objects with real positions, they carry their neon, and focusing one
 * tells you its approximate SIZE when Radar earns it, or its TYPE and exact fleet
 * manifest once Telescope sight reaches the craft.
 *
 * So the panel's job flipped. It no longer explains an absence; it states the
 * three facts that are public and then names the two that are not, because in an
 * information game the boundary is itself information. What you cannot have here
 * is WHOSE it is and WHERE it is going — and that is what still makes a Telescope
 * and a probe worth paying for.
 *
 * The one exception is a mining run whose target you already discovered: the rock,
 * clock and line are then visible. What it is bringing home is not, and never was.
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
  const { t } = useTranslation();
  /** Radar estimates size; Telescope sight resolves the exact hull tally. */
  /**
   * BEYOND THE TELESCOPE'S REACH. D125.
   *
   * The one case where the panel's job is not to describe a contact but to explain
   * why it cannot. Naming the instrument is the whole point: the player learns
   * there is a thing to buy by meeting the limit, not by being told about it.
   */
  const unidentified = contact.kind === 'unknown';
  /**
   * WHAT THE RADAR SAYS ABOUT SOMETHING THE EYE CANNOT REACH. Radar L5.
   *
   * The top of the radar ladder, and the first time it pays out on ordinary
   * traffic rather than only on a raid aimed at you. It names the KIND and never
   * the craft, so the panel keeps its "Unidentified" heading and adds one line
   * saying where the reading came from — a radar return is not sight, and a panel
   * that presented it as sight would be the interface claiming an instrument it
   * does not have.
   */
  const radarKind = unidentified ? contact.silhouette : undefined;
  const exactFleet = contact.kind === 'fleet' ? contact.fleet : undefined;
  const exactEntries = exactFleet ? fleetEntries(exactFleet) : [];
  const exactCount = exactFleet ? fleetCount(exactFleet) : null;
  const mass = contact.mass;
  const massLabel = mass
    ? t(
      mass === 'HEAVY'
        ? 'focus.contact.massHeavy'
        : mass === 'MEDIUM'
          ? 'focus.contact.massMedium'
          : 'focus.contact.massLight',
    )
    : null;
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
      eyebrow={t(
        battle
          ? 'focus.contact.eyebrowBattle'
          : contact.inbound === true
            ? 'focus.contact.eyebrowInbound'
          : salvage
            ? 'focus.contact.eyebrowSalvage'
            : mining
              ? 'focus.contact.eyebrowMining'
              : contact.kind === 'unknown'
                ? 'focus.contact.eyebrowUnknown'
                : contact.kind === 'pirate'
                  ? 'focus.contact.eyebrowPirate'
                : contact.kind === 'probe'
                  ? 'focus.contact.eyebrowProbe'
                  : 'focus.contact.eyebrowMoving',
      )}
      title={t(battle ? 'focus.contact.titleBattle' : CONTACT_TITLE[contact.kind])}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={
        mining ? (
          <span className="text-alloy">
            {contact.minutesRemaining === undefined
              ? t('focus.contact.working')
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
            <span className="text-threat-ink">
              {exactCount === null
                ? massLabel ?? t('focus.contact.bombarding')
                : t('focus.contact.craftCount', { count: exactCount })}
            </span>
            <span className="block text-label text-faint">{t('focus.contact.settling')}</span>
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
            <span className={massLabel || exactCount !== null ? '' : 'text-faint'}>
              {exactCount === null
                ? massLabel ?? t('focus.contact.unattributed')
                : t('focus.contact.craftCount', { count: exactCount })}
            </span>
            <span className="block text-label text-faint">
              {t(contact.inbound === true
                ? 'focus.contact.inboundNoClock'
                : 'focus.contact.arrivalUnknown')}
            </span>
          </>
        )
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Figure
          label={t('focus.contact.craftLabel')}
          /*
            THE COUNT IS GENUINELY UNKNOWN NOW, so the figure says so. D123. The
            summary above already carries the size estimate; repeating it here
            under a label reading "Craft" would dress an estimate up as a tally.
          */
          value={
            mining
              ? String(contact.craft ?? 0)
              : exactCount === null
                ? t('focus.contact.craftUnknown')
                : String(exactCount)
          }
        />
        <Figure
          label={t(battle ? 'focus.contact.statusLabel' : 'focus.contact.arrivesIn')}
          value={
            battle
              ? t('focus.contact.statusLanded')
              : mining
                ? contact.minutesRemaining === undefined
                  ? t('focus.contact.craftUnknown')
                  : duration(contact.minutesRemaining)
                : t('focus.contact.arrivesUnknown')
          }
          {...(battle
            ? { tone: 'threat' as const }
            : mining
              ? { tone: 'crystal' as const }
              : {})}
        />
      </div>

      {exactEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {exactEntries.map(([hull, count]) => (
            <span
              key={hull}
              className="flex items-center gap-2 rounded-chip border border-line-soft px-2 py-1"
            >
              <HullMark hull={hull} className="size-4 text-dim" />
              <span className="num text-caption text-bone">
                {count} {hullLabel(hull)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/*
        WHERE THE HULL CHIPS USED TO BE. D123.
        Naming the limit in the place that used to hold the answer, because in an
        information game the boundary is itself information — and because a blank
        reads as a bug while a stated absence reads as a price.
      */}
      {unidentified && (
        <p className="mt-3 text-caption text-faint">{t('focus.contact.unknownHint')}</p>
      )}
      {radarKind !== undefined && (
        <p className="mt-3 text-caption text-crystal/80">
          {t('focus.contact.radarKind', { kind: t(CONTACT_TITLE[radarKind]).toLowerCase() })}
        </p>
      )}
      {massLabel !== null && exactFleet === undefined && !mining && (
        <p className="mt-3 text-caption text-faint">{t('focus.contact.massHint')}</p>
      )}
      {contact.inbound === true && !battle && (
        <p className="mt-3 text-caption text-threat-ink">{t('focus.contact.inboundHint')}</p>
      )}

      {/*
        THE BOUNDARY, STATED. Knowing exactly what you are NOT being told is the
        thing that sends a player to the Telescope — an absence they cannot see is
        an absence they will not pay to close.
      */}
      <p className="mt-3 text-caption leading-snug text-dim">
        {t(
          battle
            ? 'focus.contact.boundaryBattle'
            : salvage
              ? 'focus.contact.boundarySalvage'
              : mining
                ? 'focus.contact.boundaryMining'
                : unidentified
                  ? 'focus.contact.boundaryUnknown'
                  : 'focus.contact.boundaryFleet',
        )}
      </p>
      {!mining && !battle && (
        <p className="mt-2 text-caption leading-snug text-faint">
          {t('focus.contact.telescopeHint')}
        </p>
      )}
      {battle && (
        <p className="mt-2 text-caption leading-snug text-faint">{t('focus.contact.wreckHint')}</p>
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
 * took the whole available squadron and the second target was unreachable until they came home.
 *
 * `PROSPECTOR.max` is two (D74), so this is two buttons and never a stepper.
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
  const { t } = useTranslation();
  if (available < 2) return null;
  return (
    <div className="mt-3">
      <p className="legend mb-2">{t('focus.craftPicker.label')}</p>
      <div className="flex items-center gap-2">
        {/* The chosen count is LIT AND RAISED, the same grammar every other
            segmented control in the game uses. It used to be cyan text plus a
            `border-crystal/60` that never drew, because `.btn` sets no border
            width — so on a picker whose whole job is to say which number is
            selected, half the answer was a declaration the browser dropped. */}
        {Array.from({ length: available }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            className={`slab flex-1 ${value === n ? 'slab-primary' : ''}`}
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
  field: {
    id: string;
    alloy: number;
    crystal: number;
    deuterium: number;
    minutesLeft: number;
  };
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
  const { t } = useTranslation();
  const left = field.alloy + field.crystal + field.deuterium;
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
      eyebrow={t('focus.debris.eyebrow')}
      title={
        planetName === undefined
          ? t('focus.debris.titleUnknown')
          : t('focus.debris.titleOver', { planet: planetName })
      }
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={
        <span>
          <Trans
            i18nKey="focus.debris.summarySalvage"
            values={{ amount: compact(left) }}
            components={[<span key="n" className="text-alloy" />]}
          />
          {' · '}
          <span className={field.minutesLeft < 30 ? 'text-threat' : ''}>
            {duration(field.minutesLeft)}
          </span>
        </span>
      }
      actions={
        run ? (
          <p className="num text-caption text-alloy">
            {t('focus.debris.working', {
              count: run.craft,
              state: t(
                run.status === 'returning'
                  ? 'focus.debris.stateReturning'
                  : 'focus.debris.stateInbound',
              ),
            })}
          </p>
        ) : (
          <button
            type="button"
            className="slab slab-primary basis-full whitespace-normal px-3 leading-tight max-h-10 min-h-10"
            disabled={busy || craftAvailable < 1 || tooLate}
            onClick={() => {
              onSend(sending);
            }}
          >
            {craftAvailable < 1
              ? t('focus.debris.noCraft')
              : tooLate
                ? t('focus.debris.tooLate')
                : t('focus.debris.send', { count: sending, duration: duration(reach) })}
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

      <div className="grid grid-cols-2 gap-2">
        <Figure label={t('focus.debris.alloyLeft')} value={compact(field.alloy)} tone="alloy" />
        <Figure
          label={t('focus.debris.crystalLeft')}
          value={compact(field.crystal)}
          tone="crystal"
        />
        {field.deuterium > 0 && (
          <Figure
            label={t('focus.debris.deuteriumLeft')}
            value={compact(field.deuterium)}
            tone="opportunity"
          />
        )}
        <Figure
          label={t('focus.debris.goneIn')}
          value={duration(field.minutesLeft)}
          tone={field.minutesLeft < 30 ? 'threat' : undefined}
        />
        <Figure label={t('focus.debris.yourHold')} value={compact(canCarry)} />
      </div>

      {spill > 0 && !run && (
        <p className="mt-3 text-caption leading-snug text-alloy">
          {t('focus.debris.spill', { room: compact(worksRoom), lost: compact(spill) })}
        </p>
      )}

      <p className="mt-3 text-caption leading-snug text-dim">{t('focus.debris.body')}</p>
    </Shell>
  );
}

/** What each kind of foreign craft is called. Keys, so it follows the language. */
const CONTACT_TITLE = {
  unknown: 'focus.contact.titleUnknown',
  fleet: 'focus.contact.titleFleet',
  probe: 'focus.contact.titleProbe',
  mining: 'focus.contact.titleMining',
  harvest: 'focus.contact.titleHarvest',
  death_star: 'focus.contact.titleDeathStar',
  pirate: 'focus.contact.titlePirate',
} as const satisfies Record<Contact['kind'], string>;

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
  tone?: 'crystal' | 'alloy' | 'opportunity' | 'threat';
}) {
  const colour =
    tone === 'crystal'
      ? 'text-crystal'
      : tone === 'alloy'
        ? 'text-alloy'
        : tone === 'opportunity'
          ? 'text-opportunity'
        : tone === 'threat'
          ? 'text-threat'
          : 'text-bone';
  return (
    <div>
      <p className="legend">{label}</p>
      <p className={`num mt-1 text-body ${colour}`}>
        {value}
      </p>
    </div>
  );
}

/** Minutes a rock has left in the disc, from the season clock. */
export const minutesLeftFor = (rock: AsteroidView, seasonStart: Date, now: number): number =>
  Math.max(0, rock.expiresAt - (now - seasonStart.getTime()) / 60_000);
