import { worldKindKey } from './worldKind.js';
import { OutpostReading, sealedVictoryCrate } from '../starter/OutpostReading.js';
import { FlightEscort } from '../ui/FlightEscort.js';
import { GameActions } from '../session/seasonLock.js';
import { RadiationBombControl } from '../screens/RadiationBombControls.js';
import { TargetRadiationInstrument } from '../ui/TargetRadiationInstrument.js';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useSchoolPresentation } from '../onboarding/flightSchool/presentation.js';
import type { TFunction } from 'i18next';
import {
  DEATH_STAR,
  FEATURE_FLAGS,
  HULLS,
  MONUMENT_BALANCE,
  MULTI_WORLD,
  SETTLEMENT_CLAIM_MINUTES,
  SETTLEMENT_PRIORITY_MINUTES,
  PROBE,
  clanDefenseApplies,
  colonyCapacity,
  combatValue,
  crackLimit,
  effectiveCracks,
  prospectorAvailability,
  distance,
  fleetCargo,
  fleetCount,
  fleetEntries,
  fleetTravelExact,
  STARTER,
  missionFuel,
  nextColonyCore,
  telescopeSlots,
  transferCargoCapacity,
  MOBILE_HULLS,
  UNAIDED,
  type Fleet,
  type HullId,
  type MoonRarity,
  type WorldBody,
  siteCode,
  vesselHull,
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
  PublicMonument,
} from '../api/schemas.js';
import { useGalaxy, useProbe, useRetargetMission, useSetRival, useWatch } from '../api/queries.js';
import { useMoonT } from '../i18n/moon.js';
import { RetargetButton, TargetBodyPicker } from '../screens/MoonControls.js';
import { gateOf } from '../starter/gate.js';
import { heroArt } from '../starter/shipScreen.js';
import { radiationAt, toRadiationSources } from '../lib/radiation.js';
import { rivalColour } from './PlanetField.jsx';
import type { TargetMiningRun } from './scene.js';
import { hullLabel, hullName, monumentName, satelliteLabel } from '../i18n/names.js';
import { compact, decimal, full } from '../lib/format.js';
import { serverNow } from '../lib/clock.js';
import {
  colonizationPhase,
  priorityWaitMinutes,
  settlementBlock,
  type ColonizationPhase,
  type SettlementBlock,
} from '../lib/colonization.js';
import { useAccordion } from '../lib/accordion.js';
import { launchFault, type LaunchFault } from '../lib/faults.js';
import type { HaulHome } from '../lib/collect.js';
import { deathStarsOf, hitsToTakeLoyalColony, readyDeathStar } from '../lib/strategic.js';
import { commanderLabel } from '../lib/identity.js';
import {
  beyondDossier,
  confidenceWord,
  dossier,
  factId,
  headline,
  isStale,
  sourceLabel,
  type Source,
  type Fact,
  type Gap,
  type Headline as HeadlineKind,
} from '../lib/dossier.js';
import { countdown, duration, staleness, useNow } from '../lib/time.js';
import { flightModifiers, reachMinutes, techOf } from '../lib/navigation.js';
import { rateAnchor } from '../lib/trade.js';
import type { TradeShipEvent } from '../lib/trade.js';
import type { IntergalacticConvoyEvent } from '../lib/intergalacticConvoy.js';
import { HullMark } from '../ui/icons/hulls.js';
import { Band } from '../ui/UpgradeRow.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { describe, useToast } from '../ui/Toast.js';
import { useOwnPress } from '../ui/kit/index.js';
import { Choices, CostLine, GameButton, GameHold, Glyph, InfoPeek, RoundButton, SectionTag, StrikeFold, type GlyphId, type TimerTone } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { TargetDossier } from '../v2/hud/TargetDossier.js';
import { Sheet as V2Sheet } from '../v2/kit/Sheet.js';
import { useNativeBack } from '../platform/nativeBack.js';

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
  | { kind: 'unknownSignal'; id: string }
  | { kind: 'planet'; id: string }
  | { kind: 'monument'; id: string }
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
  | { kind: 'tradeShip'; id: string }
  | { kind: 'intergalacticConvoy'; id: string };

/* ── shared chrome ───────────────────────────────────────────── */

export function MonumentFocus({ monument, onInspect, onClose }: {
  monument: PublicMonument; onInspect: () => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const controller = monument.controller.kind === 'PLAYER' ? monument.controller.name
    : monument.controller.kind === 'CLAN' ? `[${monument.controller.tag}] ${monument.controller.name}` : t(monument.emptySince ? 'monument.empty' : 'monument.neutral');
  return <Shell glyph="flag" title={monumentName(monument.ordinal)} eyebrow={controller}
    summary={<><span className="block">{t('monument.capacityShort', { used: full(monument.used), total: full(monument.capacity) })}</span>
      <span className="block text-v2-deut">{t('monument.production', { rate: decimal(monument.productionPerMinute) })}</span>
      <span className="flex items-center gap-1 text-v2-warn"><span data-radiation-mark aria-hidden="true" className="radiation-meter__mark"><Glyph id="radiation" /></span>{monument.difficulty === 'LEGACY'
        ? t('monument.radiationRate', { rate: decimal(monument.radiationHpPerMinute) })
        : t('monument.radiationLevelRate', { level: MONUMENT_BALANCE[monument.difficulty].radiationLevel, rate: decimal(monument.radiationHpPerMinute) })}</span></>}
    // One meter line, not the dial: the dial made the rail taller than the monument it frames.
    peek={<div className="flex"><TargetRadiationInstrument target={{ kind: 'MONUMENT', id: monument.id }} variant="bar" /></div>}
    open={false} onToggle={onInspect} onClose={onClose}>{null}</Shell>;
}

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
  glyph = 'target',
  tone,
  eyebrow,
  title,
  summary,
  children,
  actions,
  peek,
  above,
  open,
  onToggle,
  onClose,
}: {
  art?: ReactNode;
  /** The thing's mark when it has no portrait: in a ring, the context card's way. */
  glyph?: GlyphId;
  /** Whose it is: mine wears my colour, a threat the enemy's; anything else the steel. */
  tone?: TimerTone;
  eyebrow: string;
  title: string;
  /** The one line worth seeing without asking. Shown collapsed. */
  summary: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  /** What the closed card shows under its header: the mock's glance and its commitments. */
  peek?: ReactNode;
  /** Over the closed card: the next step a followed flight must not hide (isolated player test 2026-11-18). */
  above?: ReactNode;
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
   * the same gesture that chose it. The kit's round press guards its own the same way.
   *
   * Same shape as the sheet scrim, same answer: a press belongs to the surface it
   * started on.
   */
  const toggle = useOwnPress(() => { playSound('tap'); haptic('tap'); onToggle(); });
  const panel = useRef<HTMLElement>(null);
  useNativeBack(panel, open ? onToggle : onClose);

  return (
    <section
      /**
       * `data-focus-rail` is how the onboarding gate (D56) finds this surface. The
       * beat that asks for a fleet to be sent has to leave the rail live — the
       * commitment is inside it — without leaving the rest of the screen live too.
       */
      data-focus-rail
      ref={panel}
      data-native-back-layer="context"
      data-open={open ? 'true' : 'false'}
      {...(tone === undefined ? {} : { 'data-tone': tone })}
      /*
        THE MOCK'S TWO SHAPES (G4-a, 2026-11-15). Closed, the context card: a cut plate inset
        over the galaxy, which stays the screen (I5). Open, the file: the same plate from the
        dock up, 65dvh at most — the missing third is the world being decided about.
      */
      className="gk gk-focus pointer-events-auto absolute inset-x-0 bottom-[var(--v2-dock-h,0px)] z-20 v2-split:left-auto v2-split:w-80"
      aria-label={t('focus.shellLabel', { title })}
    >
      {above && !open && <div className="gk-focus__above">{above}</div>}
      <div className={`gk-focus__plate gk-cut${tone === undefined ? '' : ` gk-cut--${tone}`}`}>
        {/* The header. Always present, and the whole control when closed. */}
        <div className="gk-focus__head">
          <button type="button" {...OWN_SOUND} {...toggle} aria-expanded={open} className="gk-focus__toggle">
            {art ?? <span className="gk-focus__coin" aria-hidden="true"><Glyph id={glyph} /></span>}
            <span className="gk-focus__heading">
              <span className="gk-label gk-focus__eyebrow">{eyebrow}</span>
              <span className="gk-focus__title">{title}</span>
              <span className="gk-focus__summary">{summary}</span>
            </span>
            <span aria-hidden="true" className="gk-focus__chev"><Glyph id={open ? 'down' : 'up'} /></span>
          </button>
          <span data-focus-close="" className="gk-focus__clear">
            <RoundButton small glyph="close" label={t('focus.clear')} onPress={onClose} />
          </span>
        </div>

        {!open && peek && (
          <GameActions>
            <div className="gk-focus__peek">{peek}</div>
          </GameActions>
        )}

        {open && (
          /*
            THE BODY IS 65dvh AT MOST, AND THE MISSING THIRD IS THE PRODUCT. Owner report:
            a world with any intel on it put the commander into a scroll before they had
            finished the first fact, and a decision taken over two screens is a different
            decision from one taken over one (`interface.md`'s fourth question). It goes
            no further: what is left above is the world being decided about (I5).
          */
          <div className="gk-focus__file">
            {/*
              Every focus card goes through this shell, so wrapping it here is what
              stops a frozen season offering launches, probes and settlements it
              would refuse. The clear (x) above sits OUTSIDE it on purpose: looking
              around the final galaxy is the one thing still on offer.
            */}
            <GameActions>
              <div className="gk-focus__body">{children}</div>
              {/*
                THE ACTIONS WRAP, AND A COMMITMENT GETS A ROW TO ITSELF. A refusal
                rides a control's label ("Death Star · origin recovering"), and wrapping
                costs one row where squeezing four across set it below the size anything
                else on screen may be.
              */}
              {actions && <div className="gk-focus__acts">{actions}</div>}
            </GameActions>
          </div>
        )}
      </div>

      {/* Keeps the card clear of the home indicator when it is the only thing shown. */}
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
  const [noted, setNoted] = useState(false);
  const fold = useOwnPress(() => { playSound('tap'); haptic('tap'); setNoted((open) => !open); });
  const stale = isStale(fact.ageMinutes);
  const stamp = [
    fact.ageMinutes === null ? null : staleness(fact.ageMinutes),
    confidenceWord(fact.accuracy),
  ].filter((part) => part !== null).join(' · ');

  /*
    ONE LINE, THE STAMP UNDER IT, THE NOTE ONE TAP DEEPER (M2, the mock's density). The
    band above already names the source, so the row carries only how old and how sharp;
    what the figure means is a tap away rather than a paragraph under every row.
  */
  const head = (
    <>
      <span className="gk-fact__line">
        <span className="gk-fact__label">{fact.label}</span>
        <span className="gk-fact__value gk-num">{fact.value}</span>
      </span>
      {(stamp !== '' || fact.note) && (
        <span className="gk-fact__stamp" {...(stale ? { 'data-stale': '' } : {})}>
          <span>{stamp}</span>
          {fact.note && <span className="gk-fact__chev" aria-hidden="true"><Glyph id={noted ? 'up' : 'down'} /></span>}
        </span>
      )}
    </>
  );

  return (
    <div data-fact={factId(fact)} className="gk-fact" {...(fact.opportunity ? { 'data-tone': 'self' } : {})}>
      {fact.note ? (
        <button type="button" {...OWN_SOUND} aria-expanded={noted} onPointerDown={fold.onPointerDown} onClick={fold.onClick}
          className="gk-fact__head">
          {head}
        </button>
      ) : <div className="gk-fact__head">{head}</div>}
      {noted && fact.note && <p data-fact-note className="gk-fact__note">{fact.note}</p>}
    </div>
  );
}

/** Something you do not know, presented as a goal rather than an absence. */
/**
 * SOMETHING THIS COMMANDER DOES NOT KNOW, AND THE CONTROL THAT WOULD CLOSE IT.
 *
 * A dossier can hold four of these at once, and each one drew a label, the fact, a
 * two-line argument for why it matters and a full-width control. Four of that is
 * most of a 350-wide screen spent on what the player does NOT know, sitting above
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
  const fold = useOwnPress(() => { playSound('tap'); haptic('tap'); setShowWhy((open) => !open); });

  /*
    THE SAME ROW AS A READING (M2), dashed and in warn because it is a gap you can close
    (K2): the label and what is missing on one line, "unknown" and the fold under it.
  */
  return (
    <div data-gap className="gk-fact gk-fact--gap">
      <button type="button" {...OWN_SOUND} aria-expanded={showWhy} className="gk-fact__head"
        onPointerDown={fold.onPointerDown} onClick={fold.onClick}>
        <span className="gk-fact__line">
          <span className="gk-fact__label">{label}</span>
          {/* The FACT is never folded: it is the reading, not the argument. */}
          <span data-gap-missing className="gk-fact__value">{missing}</span>
        </span>
        <span className="gk-fact__stamp">
          <span>{t('focus.unknown')}</span>
          <span className="gk-fact__chev" aria-hidden="true"><Glyph id={showWhy ? 'up' : 'down'} /></span>
        </span>
      </button>

      {showWhy && <p data-gap-why className="gk-fact__note">{why}</p>}
      {/* A refusal is not a pitch — it is why the control below will not work. */}
      {blocked && <p className="gk-fact__note" data-tone="warn">{blocked}</p>}
      {action && <div className="gk-fact__act">{action}</div>}
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
/** The short label a blocked settle slab carries, one per refusal. D209. */
const SETTLE_LABEL = {
  RECOVERING: 'focus.planet.settleRecovering',
  COLONY_CORE: 'focus.planet.settleNeedSlot',
  COLONY_MAX: 'focus.planet.settleNeedSlot',
  FLIGHT_BAY: 'focus.planet.settleNeedBay',
  COURIER: 'focus.planet.settleNeedCourier',
  ALLOY: 'focus.planet.settleNeedAlloy',
  CRYSTAL: 'focus.planet.settleNeedCrystal',
  FUEL: 'focus.planet.settleNeedFuel',
  TOO_LATE: 'focus.planet.settleTooLate',
  PRIORITY: 'focus.planet.settleNeedPriority',
} as const satisfies Record<SettlementBlock['code'], string>;

/** The sentence above the slab: what is missing, and the number that fixes it. D209. */
function settleReason(block: SettlementBlock, t: TFunction): string {
  switch (block.code) {
    case 'RECOVERING': return t('focus.planet.settleWhy.recovering');
    case 'COLONY_CORE':
      return t('focus.planet.settleWhy.colonyCore', { required: block.requiredCore, current: block.currentCore });
    case 'COLONY_MAX': return t('focus.planet.settleWhy.colonyMax', { max: block.max });
    case 'FLIGHT_BAY': return t('focus.planet.settleWhy.flightBay');
    case 'COURIER': return t('focus.planet.settleWhy.courier', { need: block.need, have: block.have });
    case 'ALLOY':
      return t('focus.planet.settleWhy.alloy', { need: compact(block.need), have: compact(block.have) });
    case 'CRYSTAL':
      return t('focus.planet.settleWhy.crystal', { need: compact(block.need), have: compact(block.have) });
    case 'FUEL':
      return t('focus.planet.settleWhy.fuel', { need: compact(block.need), have: compact(block.have) });
    case 'TOO_LATE': return t('focus.planet.settleWhy.tooLate');
    case 'PRIORITY': return t('focus.planet.settleWhy.priority', { wait: duration(block.waitMinutes) });
  }
}

export function PlanetFocus({
  target,
  planet,
  intel,
  reports,
  rival,
  rivalSlot = null,
  now,
  outOfBand: outOfBandProp = false,
  ownPeakCore = null,
  onClose,
  onAttack,
  onSettle,
  onDeathStar,
  onTransfer,
  onInstallTelescope,
  onLaunched,
  showClanTargetAction = false,
  clanTargetReason = null,
  clanTargetPending = false,
  onMarkClanTarget,
  onSendSupport,
  settlementInFlight = false,
  open,
  onToggle,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  intel: IntelView | undefined;
  reports: readonly Report[];
  rival?: RivalSummary;
  /**
   * WHICH OF THE COMMANDER'S MARKS THIS WORLD WEARS, OR NULL. D183.
   *
   * The slot rather than a boolean, because a mark's colour comes off it — five
   * identical reticles would be five marks and no information, which is the whole
   * point of raising the ceiling from one.
   */
  rivalSlot?: number | null;
  now: number;
  /**
   * IS THE BAND ALREADY REFUSING THIS TARGET, PROVABLY. D168 · D127.
   *
   * Computed by `lib/band.ts` from the disc the caller can actually see, and it
   * is one-directional on purpose: fog can prove "further developed than you"
   * and can never prove the reverse. Passed in rather than read here because
   * `GalaxyView` is holding the whole galaxy already, and the arithmetic stays
   * pure and testable away from a panel with thirty hooks.
   */
  outOfBand?: boolean;
  /**
   * The caller's tallest Core across every world they hold (`lib/band.ts`), so the
   * dossier's development row can set their own tier beside this world's. D168.
   */
  ownPeakCore?: number | null;
  onClose: () => void;
  onAttack: () => void;
  onSettle?: () => void;
  onDeathStar?: (targetBody?: WorldBody) => void;
  onTransfer?: () => void;
  /** Takes the player to the orbit surface, where the instrument is bought. */
  onInstallTelescope: () => void;
  /** Called with the target's name once a probe is away, so the disc can follow it. */
  onLaunched: (targetName: string) => void;
  showClanTargetAction?: boolean;
  clanTargetReason?: string | null;
  clanTargetPending?: boolean;
  onMarkClanTarget?: () => void;
  /** Klan Savunma Desteği: open the send sheet for this clanmate's world. */
  onSendSupport?: () => void;
  /** An outbound colony mission already targets this world. */
  settlementInFlight?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const setRival = useSetRival();
  const say = useToast();
  const school = useSchoolPresentation();
  const galaxy = useGalaxy();
  const targetMoonEntry = galaxy.data?.moons?.list.find((m) => m.planetId === target.id) ?? null;
  const targetMoonRarity = galaxy.data?.moons?.rarity[target.id];
  const targetMoonInfo = targetMoonEntry
    ? {
        cracks: targetMoonEntry.cracks,
        lastHitAt: targetMoonEntry.lastHitAt,
        ...(targetMoonRarity ? { rarity: targetMoonRarity } : {}),
      }
    : null;
  // A ship opens these one by one, and it holds no marks: those belong to the main galaxy.
  const gate = gateOf(planet.vessel);
  // No tier in the starter galaxy, so no band to fall out of.
  const outOfBand = !gate.aboard && outOfBandProp;
  /*
    The PROBE band leads: it is the section a commander opens this panel to read,
    and the one they paid alloy and a round trip for. Remembered per device.

    ABOVE THE OWNED-WORLD RETURN BELOW, and it has to be. This sat under it and
    took the whole app down in production (React #310). The rail is drawn with no
    `key` and `planetFocusRailVisible` keeps it up across a change of subject, so
    moving the focus between your own colony and a foreign world re-renders THIS
    fiber — and a hook that only some of those renders reach changes the hook
    count on a live component. Owned or foreign, this panel now calls the same
    hooks in the same order; only what it draws is a branch.
  */
  const dossierBands = useAccordion('dossier', ['probe']);

  /**
   * IS THE STRIKE BEING ASKED ABOUT. Owner report: *"yanlışlıkla"*.
   *
   * A Death Star strike is the most expensive single action a commander takes,
   * it consumes the weapon, and it was one slab in a wrapped row of four whose
   * neighbour is an ordinary raid. Every other commitment in this game has a
   * sheet between the press and the spend — a raid picks its fleet, a settlement
   * states its convoy — and this one, which spends more than any of them, had
   * nothing.
   *
   * UP HERE FOR THE REASON THE COMMENT ABOVE GIVES, and it was first written
   * below the owned-world return, where `focus-hook-order.test.tsx` caught it
   * immediately: the rail keeps its fiber across a change of subject, so a hook
   * only some renders reach is React #310 in production. Every hook this panel
   * has is called on every render; only what it draws is a branch.
   */

  /**
   * AND IT DIES WITH THE WORLD IT WAS ASKED ABOUT.
   *
   * The rail keeps its fiber across a change of subject — that is exactly what
   * `focus-hook-order.test.tsx` exists to protect — so this state survived one.
   * Open the strike question on Grimhold, focus your own colony without
   * answering (the panel early-returns and the sheet vanishes), then focus any
   * foreign world: it came back by itself, naming a world the commander had
   * pressed nothing on. That is a worse version of the mis-tap the confirmation
   * was added to prevent.
   *
   * Keyed on the world's id rather than on the object, because the galaxy
   * payload re-parses and a fresh `target` for the same world is an ordinary
   * refetch, not a change of subject.
   */
  /*
    THE SKY THIS WORLD STANDS IN. Radyasyon (plan F10): the dose a minute and the one rule
    that makes it a decision, on the world a route would be planned to — before a fleet
    is picked, not in the report after it landed.
    Above the owned-world return, like every hook here: `focus-hook-order.test.tsx`.
  */
  const clouds = useGalaxy().data?.radiation;
  const radiation = useMemo(
    () => radiationAt(target.position, toRadiationSources(clouds ?? []), now),
    [clouds, target.position, now],
  );


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

  const read = dossier({ target, planet, intel, reports, ...(rival ? { rival } : {}), ownPeakCore, now });
  /** What the dossier page above does not already draw (M2: never the page read twice). */
  const others = beyondDossier(read.facts);
  const away = target.fleet?.status === 'AWAY';
  const known = headline(read, target);
  const originRecovering = Boolean(
    planet.planet.recoveryUntil && planet.planet.recoveryUntil.getTime() > now,
  );
  const originShipyardRevolt = (planet.faults ?? []).some(
    (fault) => fault.kind === 'SHIPYARD_REVOLT',
  );
  /*
    SILENT SPACE CLOSES EVERY FIGHT, AND IT IS NAMED FIRST (D212): no repair, clock or
    development lifts it — only going home does. Probe and transfer stay open.
  */
  const originSilentSpace = planet.silentSpace === true;
  const clanTargetRefusal = originSilentSpace ? t('faults.launchBlock.SILENT_SPACE') : clanTargetReason;
  // A ship settles nothing: an outpost is a place to raid, and the jump is the only way to a world.
  const colonyPhase = gate.aboard ? 'FOREIGN_COLONY' : colonizationPhase(target, now, settlementInFlight);
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
  const claimActive = !gate.aboard && Boolean(claimUntil && claimUntil.getTime() > now);
  /*
    THE FIGURE THAT DECIDES WHETHER THE SHEET OFFERS THE RACE AT ALL. D180.

    `settlementCanArrive` below is built from this, so an inflated number was not a
    wrong label — it was a REFUSAL, telling a commander with a doubled engine that
    they could not reach a claim window they could comfortably reach. It quoted
    catalogue speed until this line took the modifiers.

    `boost: 1` mirrors `launchSettlement` exactly; see the note in `SettlementSheet`.
  */
  const settlementEta = fleetTravelExact(
    distance(planet.planet.position, target.position),
    { COURIER: MULTI_WORLD.settlement.transports },
    { boost: 1, tech: flightModifiers(planet).tech },
  );
  const settlementCanArrive = Boolean(
    claimUntil && now + settlementEta * 60_000 < claimUntil.getTime(),
  );
  /*
    THE RAIDER'S FIRST HOUR. Owner decision, 2026-10-07: only the commander whose raid opened
    the claim may land in its first sixty minutes. The raider is told it is theirs; anyone
    else is told whose it is, when it ends, and how long until a launch lands as it ends —
    the server refuses an earlier landing (`CLAIM_PRIORITY`), and a refusal met only as an
    error is a rule taught after the fact.
  */
  const priorityUntil = claimActive ? target.neutral?.claimPriorityUntil ?? null : null;
  const priority = priorityUntil && priorityUntil.getTime() > now
    ? { until: priorityUntil, mine: target.claimPriorityMine === true }
    : null;
  const priorityWait = claimActive ? priorityWaitMinutes(target, now, settlementEta) : 0;
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
    planet.planet.deuterium - MULTI_WORLD.settlement.charge.deuterium >= settlementFuel;
  const colonyStanding = planet.colonies ?? {
    colonies: 0,
    reservations: 0,
    capacity: 0,
    // The capital's Core, which every world's payload carries (D209).
    capitalCore: planet.researchCore,
  };
  const colonySlotOpen = colonyStanding.colonies + colonyStanding.reservations
    < colonyStanding.capacity;
  const flightBayOpen = planet.flight.used < planet.flight.total;
  /*
    ONE STATEMENT OF WHAT STANDS IN THE WAY, READ TWICE. D209, owner instruction.
    The slab keeps its short label; the note above it says what is missing with the
    number that fixes it. Both come off `settlementBlock`, so they cannot disagree.
  */
  const settleBlock = settlementBlock({
    originRecovering,
    colonies: colonyStanding,
    flight: planet.flight,
    couriers: planet.fleet.COURIER ?? 0,
    stock: planet.planet,
    fuel: settlementFuel,
    canArrive: settlementCanArrive,
    priorityWait,
  });
  const settlementBlockLabel = originShipyardRevolt
    ? t('faults.launchBlock.SHIPYARD_REVOLT')
    : settleBlock === null ? null : t(SETTLE_LABEL[settleBlock.code]);
  const settlementBlockReason = settleBlock === null ? null : settleReason(settleBlock, t);
  const settlementReady = claimActive && settleBlock === null && !originShipyardRevolt;
  /**
   * A STRIKE IS NEVER AN ACQUISITION. D167.
   *
   * Every gate below used to exist because a second impact inside the recovery
   * window handed the colony over: an open colony slot, and a flight that could
   * land before the window closed. The weapon takes nothing now — it restarts the
   * target's deadline — so both refusals are gone and the button says one thing.
   */
  /**
   * A WORLD THAT CANNOT BE RAIDED, AND THE CONTROL HAS TO SAY SO. D124 · D183.
   *
   * `PROTECTED` covers two rules that mean one thing to a raider: the occupation
   * window on a world just captured (D98), and its commander's first-day shield
   * (D183). Both refuse a launch, and until now only the Death Star control knew —
   * the ordinary raid offered the button, took the player through picking a fleet,
   * and refused at the moment the fleet stopped being recallable.
   *
   * That is precisely the failure D124 names, and it is the whole reason the state
   * is public: a raider who cannot tell a shielded commander from a reachable one
   * learns the rule as an error message. The clock is read against `now` rather
   * than trusted, because a payload sits on screen while its window expires.
   *
   * THE PROBE IS DELIBERATELY OUTSIDE IT. A shield stops raids, not sight.
   */
  const attackProtectedUntil = target.attackProtectedUntil;
  const shieldedUntil = attackProtectedUntil && attackProtectedUntil.getTime() > now
    ? attackProtectedUntil
    : target.state.kind === 'PROTECTED' && target.state.until.getTime() > now
      ? target.state.until
      : null;

  const deathStarReady = readyDeathStar(planet) !== undefined;
  const deathStarBlock = target.vacation
    ? t('errors.TARGET_VACATION')
    : originSilentSpace
    ? t('faults.launchBlock.SILENT_SPACE')
    : !deathStarReady
    ? t('focus.planet.deathStarUnavailable')
    : originShipyardRevolt
      ? t('faults.launchBlock.SHIPYARD_REVOLT')
    /*
      THE STRIKE ANSWERS TO THE BAND TOO (D168, owner report 2026-10-01), and the band
      is ordered before the shield for the attack button's reason: a shield expires,
      a development gap does not.
    */
    : outOfBand
      ? t('focus.planet.deathStarOutOfBand')
    : shieldedUntil !== null
      ? t('focus.planet.deathStarProtected')
      : originRecovering
        ? t('focus.planet.deathStarOriginRecovering')
        : !flightBayOpen
          ? t('focus.planet.deathStarNeedBay')
          : null;

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

  const probeControl = !target.clanmate && (
    target.vacation ? <span className="gk-inote gk-inote--plate gk-focus__half" data-tone="self">{t('vacation.title')}</span> : <ProbeControl target={target} intel={intel} onLaunched={onLaunched} />
  );
  /*
    THE RIVAL MARK, A CHIP IN THE DOSSIER'S HEADER (M2, the mock) rather than a slab among
    the commitments. A new mark needs a surveyed, non-neutral, non-clanmate world.
    An existing mark may always be removed, even if the world leaves sight or its
    commander has since joined the clan.

    A SECOND PRESS TAKES THE MARK OFF AGAIN (owner, reversing D103): the mark is a bookmark
    on a disc of three hundred worlds, not a decision the game protects you from. THE SAME
    WORLD BOTH WAYS (D183): the press is a toggle on the server — `null` empties the whole
    set and is never sent from here. The chip wears the mark's own colour, as the reticle does.
  */
  const rivalControl = !gate.aboard && (rivalSlot !== null || (!target.clanmate && !unsurveyed && target.kind !== 'NEUTRAL'))
    ? {
      pending: setRival.isPending,
      onToggle: () => {
        setRival.mutate(target.id, {
          onSuccess: () => {
            say(t(rivalSlot !== null ? 'focus.planet.rivalCleared' : 'focus.planet.rivalMarked', {
              commander: target.owner,
            }));
          },
          onError: (error) => { say(describe(error), 'error'); },
        });
      },
    }
    : null;

  /*
    An outpost is the shipyard's first fight; a ship asks for the attacker's own Aegis and a battle
    behind it (owner 2026-11-08, N2–N3).
  */
  const outpostTarget = target.body === 'OUTPOST';
  /** THE COMMITMENT, drawn in the open dossier and on the closed card alike (the mock). */
  const attackControl = !target.clanmate && (!gate.open(outpostTarget ? 'fleet' : 'attack')
    // A closed attack says why and how it opens (player test A-05, owner K1 2026-11-05).
    ? <p data-testid="attack-locked" className="gk-inote gk-focus__wide gk-focus__locked"><Glyph id="lock" />{t(outpostTarget ? 'starter.outpostLocked' : 'starter.attackLocked')}</p>
    : (
      /*
        Marked so a surface outside this panel can point at the commitment: the onboarding
        opens exactly this path and refuses the rest of the rail. THE BAND IS ORDERED FIRST,
        as on the server (`canAttack`): a permanent refusal outranks a temporary one, and the
        development gap does not expire where a shield does. A refusal rides the face and
        names the CLOCK ("protected for 4h"), a fact to plan against (G4-b1, 2026-11-15).
      */
      <GameButton
        tone="action"
        glyph="attack"
        size="sm" className="gk-focus__grow"
        marks={{ 'data-attack': '', 'data-primary': '' }}
        spoken={target.vacation ? t('errors.TARGET_VACATION') : t(originSilentSpace
          ? 'focus.planet.attackSilentSpace'
          : originShipyardRevolt
          ? 'focus.planet.attackShipyardRevolt'
          : outOfBand
          ? 'focus.planet.attackOutOfBand'
          : shieldedUntil !== null
            ? 'focus.planet.attackProtected'
            : originRecovering
              ? 'focus.planet.attackOriginRecovering'
              : colonyPhase === 'NEUTRAL_RACE' || colonyPhase === 'SETTLEMENT_IN_FLIGHT'
                ? 'focus.planet.attackNeutralAgain'
                : 'focus.planet.attack')}
        disabledReason={target.vacation ? t('vacation.title')
          : originSilentSpace ? t('focus.planet.attackSilentSpaceShort')
          : originShipyardRevolt ? t('focus.planet.attackShipyardRevoltShort')
          : outOfBand ? t('focus.planet.attackOutOfBandShort')
          : shieldedUntil !== null ? t('focus.planet.attackProtectedShort', { duration: countdown(shieldedUntil.getTime() - now) })
          : originRecovering ? t('focus.planet.attackOriginRecovering')
          : null}
        onPress={onAttack}
      >
        {t(colonyPhase === 'NEUTRAL_RACE' || colonyPhase === 'SETTLEMENT_IN_FLIGHT'
          ? 'focus.planet.attackNeutralAgainShort'
          : 'focus.planet.attackShort')}
      </GameButton>
  ));

  /*
    THE CARD'S ONE LINE OF POWER (the mock's context card): the wing at home against the
    probe's band, or the plain fact that nobody has measured it. The dossier behind the tap
    has the ruler; this is the glance that decides whether to take it.
  */
  const probeBand = intel?.probeReports.find((r) => r.spatiallyCurrent !== false && r.targetPlanetId === target.id)?.defence;
  const peekPower = [
    t('dossier.page.peekWing', { value: compact(combatValue(planet.fleet)) }),
    probeBand
      ? t('dossier.page.peekDefence', {
        band: probeBand.low === probeBand.high
          ? compact(probeBand.low)
          : `${compact(probeBand.low)}${t('units.rangeJoin')}${compact(probeBand.high)}`,
      })
      : t('dossier.page.peekDefenceUnknown'),
  ].join(' · ');

  // The first hunt (plan F4): the loot is what the holds carry, and a probe reads who holds the place.
  const outpostReport = target.body === 'OUTPOST'
    ? intel?.probeReports.find((r) => r.spatiallyCurrent !== false && r.targetPlanetId === target.id && r.outpost === true)
    : undefined;
  const carry = fleetCargo(planet.fleet, flightModifiers(planet).tech);
  const outpostLines = target.body === 'OUTPOST' ? (
    <>
      <p data-testid="outpost-rule" className="gk-sub">
        {t('starter.outpost.rule', {
          amount: full(STARTER.sites.outposts.stock[Math.min(STARTER.sites.outposts.stock.length, Math.max(1, target.coreLevel)) - 1] ?? 0),
          carry: full(carry),
        })}
      </p>
      {outpostReport && (
        <OutpostReading reading={outpostReport.classReading} carry={null} stock={null}
          crate={planet.vessel ? sealedVictoryCrate(planet.vessel) : null} />
      )}
    </>
  ) : null;
  return (
    <Shell
      art={target.body === 'VESSEL'
        ? <img src={heroArt(vesselHull(target.id), target.look ?? 'WRECKED')} alt="" draggable={false} className="size-10 rounded-control object-cover" />
        : <PlanetSigil seed={target.id} skinId={target.skin?.id} size={36} dark={known.kind === 'none'} />}
      eyebrow={target.body === 'VESSEL'
        ? t('starter.eyebrow')
        // The kind and the code that tells two alike apart; the name leads (player test).
        : target.body === 'OUTPOST' ? `${t('starter.outpost.title')} · ${siteCode({ id: target.id, kind: 'OUTPOST' })}`
        : anonymous
          ? t('focus.planet.unsurveyedEyebrow')
          : t('focus.planet.location', { planet: target.name })}
      title={target.body === 'OUTPOST' ? target.name : anonymous
        ? t(target.body === 'VESSEL' ? 'starter.reading.unknownShip' : 'focus.planet.unsurveyedTitle')
        : commanderLabel(target.owner, target.clan?.tag)}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={(
        <span className="flex flex-col items-start gap-0.5">
          {target.body === 'OUTPOST'
            ? <span className="gk-label" data-tone="warn">{t('starter.readout.level', { level: Math.max(1, target.coreLevel) })}</span>
            // A ship travels with the CAPITAL kind, and is not a world's capital (player test).
            : !unsurveyed && target.body !== 'VESSEL' && <WorldKind target={target} rivalSlot={rivalSlot} />}
          <Headline of={known} />
        </span>
      )}
      peek={target.clanmate ? undefined : (
        <>
          {outpostLines}
          {/* The ships' price, not the dossier's power range: one name, one measure (player test B-04). */}
          <p data-testid="peek-value" className="gk-focus__value">
            <span className="gk-label">{t('dossier.page.value')}</span>
            <span className="gk-num">{peekPower}</span>
          </p>
          <div className="gk-focus__pair">
            {probeControl}
            {attackControl}
          </div>
        </>
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
          {open && outpostLines && <div className="gk-focus__wide gk-focus__stack">{outpostLines}</div>}
          {/*
            AND YOU CANNOT MARK WHAT YOU CANNOT SEE. Owner's instruction. This
            tested `kind !== 'NEUTRAL'`, a field an unsurveyed world does not
            carry — so the Rival control appeared on exactly the worlds where
            `isRivalNode` then refuses to draw the reticle. A button whose effect
            is invisible is worse than an absent one.
          */}
          {onSettle && settlementBlockReason && (
            (claimActive && colonyPhase !== 'SETTLEMENT_IN_FLIGHT')
            // Before any raid only the colony slot is a reason: the rest belongs to step 3 (D209).
            || (colonyPhase === 'NEUTRAL_PREP'
              && (settleBlock?.code === 'COLONY_CORE' || settleBlock?.code === 'COLONY_MAX'))
          ) && (
            <p data-settle-reason role="note" className="gk-inote gk-inote--plate gk-focus__wide">
              {settlementBlockReason}
            </p>
          )}
          {onSettle && claimActive && colonyPhase !== 'SETTLEMENT_IN_FLIGHT' && (
            <GameButton glyph="colony" size="sm" wide className="gk-focus__wide" onPress={onSettle}
              disabledReason={settlementReady ? null : (settlementBlockLabel ?? t('focus.planet.settle'))}>
              {settlementBlockLabel ?? t('focus.planet.settle')}
            </GameButton>
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
            a full row of a 350-wide phone.

            Pairing them costs the labels their sentences, so the COST moves onto
            its own micro line inside the probe's button rather than out of the
            interface: a spend the player cannot see before pressing is a worse
            failure than a wide button.

            A probe at a clanmate is `CLAN_FRIENDLY_FIRE` before it is anything
            else, so both are hidden there rather than offered and refused.
          */}
          {/*
            KLAN SAVUNMA DESTEĞİ. A clanmate's world is the one place a fleet can be sent to
            stand in somebody else's line; the sentence says what that means before the tap.
          */}
          {target.clanmate && onSendSupport && clanDefenseApplies(planet.rulesetVersion ?? 0) && (
            <div className="gk-focus__wide gk-focus__stack">
              {/* A world closed to support says so here, before a ship is picked on the sheet. */}
              <GameButton wide glyph="support" marks={{ 'data-send-support': '' }} onPress={onSendSupport}
                disabledReason={target.supportOpen === false ? t('clanSupport.sendAction') : null}>
                {t('clanSupport.sendAction')}
              </GameButton>
              <p className="gk-sub">
                {target.supportOpen === false
                  ? t('clanSupport.closedHint', { name: target.owner })
                  : t('clanSupport.sendActionHint')}
              </p>
            </div>
          )}
          {showClanTargetAction && onMarkClanTarget && <div className="gk-focus__wide gk-focus__stack">
            <GameButton wide glyph="flag" pending={clanTargetPending} onPress={onMarkClanTarget}
              disabledReason={clanTargetRefusal === null ? null : t('clanWar.markTarget')}>
              {t('clanWar.markTarget')}
            </GameButton>
            {clanTargetRefusal && <p className="gk-sub">{clanTargetRefusal}</p>}
          </div>}
          {(probeControl || attackControl) && (
            <div className="gk-focus__pair gk-focus__wide">
              {probeControl}
              {attackControl}
            </div>
          )}
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
      {!school && !gate.aboard && !target.clanmate && (!unsurveyed
        || colonyPhase === 'NEUTRAL_RACE'
        || colonyPhase === 'SETTLEMENT_IN_FLIGHT') && (
      <StrategicWorldGuide
        target={target}
        planet={planet}
        now={now}
        colonySlotOpen={colonySlotOpen}
        flightBayOpen={flightBayOpen}
        settlementEta={settlementEta}
        settlementCanArrive={settlementCanArrive && priorityWait === 0}
        settlementFuel={settlementFuel}
        settlementFuelled={settlementFuelled}
        claimActive={claimActive}
        priority={priority}
        isRival={rivalSlot !== null}
        phase={colonyPhase}
      />
      )}
      {away && (
        <p className="gk-inote gk-inote--plate gk-focus__note" data-tone="self">
          {t('focus.planet.windowOpen')}
        </p>
      )}
      {radiation && (
        <p data-radiation-here className="gk-inote gk-inote--plate gk-focus__note" {...(radiation.sheltered ? {} : { 'data-tone': 'warn' })}>
          <Glyph id={radiation.sheltered ? 'shield' : 'radiation'} />
          {radiation.sheltered
            ? t('focus.planet.radiationShelter')
            : t('focus.planet.radiationHere', {
                // In the player's own notation, and no ",0" on a whole figure.
                pct: Number.isInteger(radiation.pctPerMinute) ? full(radiation.pctPerMinute) : decimal(radiation.pctPerMinute),
              })}
        </p>
      )}

      {/*
        THE DOSSIER (E2): the mark, the range and the flight; the reading's source and age;
        power against the wing at home with the counter cycle; the haul against the hold; on
        a colony, the loyalty rule. The facts and gaps below are what it was built from.
      */}
      {!school && <div className="mb-3">
        <TargetDossier
          target={target}
          planet={planet}
          intel={intel}
          reports={reports}
          rivalSlot={rivalSlot}
          now={now}
          ownPeakCore={ownPeakCore}
          moon={targetMoonInfo}
          {...(rivalControl ? { rival: rivalControl } : {})}
        />
      </div>}

      {(rivalSlot !== null || rival) && (
        <RivalHistory
          summary={rival}
          probeAt={intel?.probeReports.find((report) => report.spatiallyCurrent !== false && report.targetPlanetId === target.id)?.at}
          now={now}
          marked={rivalSlot !== null}
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
      {others.length > 0 && (
        <SectionTag as="h3">{t('dossier.page.others')}</SectionTag>
      )}
      {SOURCE_ORDER.map((source) => {
        const rows = others.filter((fact) => fact.source === source);
        if (rows.length === 0) return null;
        return (
          <section key={source} data-fact-source={source} className="gk-facts">
            <Band
              label={sourceLabel(source)}
              count={rows.length}
              open={dossierBands.isOpen(source)}
              onToggle={() => { dossierBands.toggle(source); }}
            />
            {dossierBands.isOpen(source) && (
              <div className="gk-facts__rows">
                {rows.map((fact) => <FactRow key={fact.key} fact={fact} />)}
              </div>
            )}
          </section>
        );
      })}

      <div className="gk-facts__rows">
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

      <TargetRadiationInstrument target={{ kind: 'PLANET', id: target.id }} tech={techOf(planet)} />
      {/*
        THE DEATH STAR IS A SECTION, LIKE THE RADIATION STRIKE. Owner, 2026-10-16: *"focus
        sheet'te radyasyon saldırısı section gibi benzer bir sectionda ölüm yıldızı için yap.
        İkisi de açılıp kapanabilir accordion olsun."* It replaces the grey slab on the rail and
        the sheet it opened: the price and the readings sit above a red hold, folded until wanted.

        Owner, 2026-11-16: it stands folded even before one exists, as the radiation strike does
        with "0 ready" — red beside the strike's yellow; opened, it says what building one takes.
      */}
      {onDeathStar && !target.clanmate && (
        <DeathStarSection
          target={target}
          origin={planet}
          report={intel?.probeReports.find((report) => report.spatiallyCurrent !== false && report.targetPlanetId === target.id)}
          moon={targetMoonInfo}
          now={now}
          disabledReason={deathStarBlock}
          onLaunch={onDeathStar}
        />
      )}
      {planet.radiationBombsAvailable && !target.clanmate && <RadiationBombControl collapsible origin={planet}
        target={{ kind: 'PLANET', id: target.id }} targetName={anonymous ? t('focus.planet.unsurveyedTitle') : target.name}
        position={target.position} onLaunched={onClose}
        hasMoon={targetMoonInfo !== null}
        moonRarity={targetMoonRarity}
        disabledReason={originSilentSpace ? t('faults.launchBlock.SILENT_SPACE')
          : originShipyardRevolt ? t('faults.launchBlock.SHIPYARD_REVOLT')
          : outOfBand ? t('focus.planet.deathStarOutOfBand')
          : shieldedUntil ? t('focus.planet.deathStarProtected')
          : originRecovering ? t('focus.planet.deathStarOriginRecovering')
          : !flightBayOpen ? t('focus.planet.deathStarNeedBay') : null} />}
    </Shell>
  );
}

type ProbeReading = IntelView['probeReports'][number];

/**
 * WHAT A STRIKE SPENDS, WHAT IT DOES, AND WHAT THE LAST LOOK SAID — the one statement of it,
 * read in the panel's Death Star section and in the gallery's sheet alike.
 *
 * The ranking is deliberate: what is consumed, which world fires and what it has left, then
 * what the target suffers and what it does NOT (D179: the world stays, the fleet survives).
 */
function StrikeDetails({ target, report, origin }: {
  target: GalaxyPlanet;
  /** The newest probe of this world, if any: what its pad and its loyalty looked like. */
  report?: ProbeReading | undefined;
  /** The world the weapon leaves from: the selected one, whose pad this launch spends. */
  origin?: PlanetView | undefined;
}) {
  const { t } = useTranslation();
  /*
    THE TWO READINGS THIS HIT IS DECIDED BY, FROM THE LAST LOOK. Owner, 2026-10-01.

    A colony loses `colonyLoyaltyLoss` per hit and goes neutral at that or less, and a
    ready charge downs one weapon. Both figures are the probe's, dated, so the commander
    forms an expectation before the hold — and the age says how far to trust it.
  */
  const loss = DEATH_STAR.colonyLoyaltyLoss;
  const colony = target.kind === 'COLONY';
  const hits = report?.loyalty === undefined ? null : Math.max(1, Math.ceil(report.loyalty / loss));
  const age = report ? staleness((Date.now() - report.at.getTime()) / 60_000) : null;
  // Owner question, 2026-10-15: which world is about to be spent, and what it has left.
  const ready = origin ? deathStarsOf(origin).filter((asset) => asset.status === 'READY').length : 0;

  return (
    <>
    <p className="gk-strike__lead">{t('focus.planet.strikeConfirm.lead')}</p>
    <dl className="gk-well gk-strike__facts">
      {origin && (
        <div data-strike-origin className="gk-strike__fact">
          <dt className="gk-label">{t('focus.planet.strikeConfirm.origin')}</dt>
          <dd>{t('focus.planet.strikeConfirm.originRead', { world: origin.planet.name, ready })}</dd>
        </div>
      )}
      <div className="gk-strike__fact">
        <dt className="gk-label">{t('focus.planet.strikeConfirm.outage')}</dt>
        <dd className="gk-num">{duration(DEATH_STAR.empMinutes)}</dd>
      </div>
      {colony && (
        <div data-strike-loyalty className="gk-strike__fact" {...(hits === 1 ? { 'data-tone': 'hostile' } : {})}>
          <dt className="gk-label">{t('focus.planet.strikeConfirm.loyalty')}</dt>
          <dd>
            {report?.loyalty === undefined || hits === null
              ? t('focus.planet.strikeConfirm.loyaltyUnknown')
              : t('focus.planet.strikeConfirm.loyaltyRead', {
                value: report.loyalty,
                hits: t('focus.planet.strikeConfirm.hits', { count: hits }),
              })}
          </dd>
        </div>
      )}
      {report?.interceptors !== undefined && (
        <div data-strike-charges className="gk-strike__fact">
          <dt className="gk-label">{t('focus.planet.strikeConfirm.charges')}</dt>
          <dd>
            {report.interceptors > 0
              ? t('focus.planet.strikeConfirm.chargesRead', { count: report.interceptors, needed: report.interceptors + 1 })
              : t('focus.planet.strikeConfirm.chargesNone')}
          </dd>
        </div>
      )}
    </dl>
    {/* Both readings come from one look, so its age is said once, under them. */}
    {age !== null && ((colony && report?.loyalty !== undefined) || report?.interceptors !== undefined) && (
      <p data-strike-probe-age className="gk-sub gk-strike__age">{t('focus.planet.strikeConfirm.probeAge', { age })}</p>
    )}
    {/* And what it does NOT do, because D179 took the teeth out and a commander
        about to spend twenty thousand alloy should know what they are buying. */}
    <p className="gk-sub">{t('focus.planet.strikeConfirm.keeps')}</p>
    {colony && <p className="gk-sub">{t('focus.planet.strikeConfirm.keepsColony', { loss, hits: hitsToTakeLoyalColony })}</p>}
    <WeaponHonor credit={origin?.honorTacticalCredit === true}>
      {origin?.honorTacticalCredit ? <>
        <p className="gk-sub">{t('leaderboard.honorEmpGain')}</p>
        <p className="gk-sub">{t('leaderboard.honorEmpRisk')}</p>
      </> : <p className="gk-sub">{t('leaderboard.honorWeaponsInactive')}</p>}
    </WeaponHonor>
    </>
  );
}

/** A weapon's Honor rule, in the launch's Honor box (G4-e3): the same for the Death Star and the radiation strike. */
function WeaponHonor({ credit, children }: { credit: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section data-honor-weapon-rule className="gk-well gk-honor" data-kind={credit ? 'credit' : 'none'}>
      <p className="gk-label gk-honor__title"><Glyph id="ranking" />{t('leaderboard.honorTitle')}</p>
      {children}
    </section>
  );
}

/**
 * THE DEATH STAR, AS A SECTION OF THE PANEL. Owner, 2026-10-16 — the radiation strike's shape
 * in the colour of harm, folded until wanted.
 *
 * HELD, NOT CONFIRMED (K4, B9: every launch and the Death Star). The hold is the only press
 * that spends it; a tap does nothing, and folding the section is the way back.
 */
export function DeathStarSection({ target, origin, report, moon = null, now, disabledReason, onLaunch }: {
  target: GalaxyPlanet;
  origin: PlanetView;
  report?: ProbeReading | undefined;
  moon?: { cracks: number; lastHitAt: Date | null; rarity?: MoonRarity } | null;
  now?: number;
  /** Why it cannot fly right now; the hold shows it instead of arming. */
  disabledReason: string | null;
  onLaunch: (targetBody?: WorldBody) => void;
}) {
  const { t } = useTranslation();
  const tMoon = useMoonT();
  const [targetBody, setTargetBody] = useState<WorldBody>('PLANET');
  const [lastTargetId, setLastTargetId] = useState(target.id);
  if (lastTargetId !== target.id) {
    setLastTargetId(target.id);
    setTargetBody('PLANET');
  }
  const effectiveBody: WorldBody = moon ? targetBody : 'PLANET';
  const world = target.intel === 'UNKNOWN' ? t('focus.planet.unsurveyedTitle') : target.name;
  const ready = deathStarsOf(origin).filter((asset) => asset.status === 'READY').length;
  const cracksNow = moon
    ? effectiveCracks({ cracks: moon.cracks, lastHitAtMs: moon.lastHitAt?.getTime() ?? null }, now ?? serverNow())
    : 0;
  return (
    <StrikeFold data-strike-section="" data-weapon="death-star" glyph="target" title={t('focus.planet.deathStarSection.title')}
      target={t('planet.radiationBomb.target', { target: world })} ready={t('focus.planet.strikeReady', { ready })}>
      {deathStarsOf(origin).length === 0 && (
        <p data-death-star-build className="gk-inote" data-tone="warn"><Glyph id="lock" />{t('planet.deathStar.none')} · {t('planet.deathStar.needs', {
          need: `${t('planet.deathStar.needCore', { level: DEATH_STAR.requiredCore })}, ${t('planet.deathStar.needShipyard', { level: DEATH_STAR.requiredShipyard })}`,
        })}</p>
      )}
      {moon && (
        <div className="flex flex-col gap-1.5">
          <TargetBodyPicker
            value={effectiveBody}
            hasMoon
            knownRarity={moon.rarity}
            showAttackHint={false}
            onChange={setTargetBody}
          />
          {effectiveBody === 'MOON' && (
            <div className="gk-well flex flex-col gap-1 text-caption">
              <p className="font-semibold text-amber-200 gk-num">
                {moon.rarity
                  ? tMoon('body.deathStarMoonCracks', { cracks: cracksNow, limit: crackLimit(moon.rarity) })
                  : tMoon('body.deathStarMoonCracksUnknown', { cracks: cracksNow })}
              </p>
              <p className="text-slate-300">{tMoon('body.deathStarMoonHint')}</p>
            </div>
          )}
        </div>
      )}
      {effectiveBody === 'PLANET' && <StrikeDetails target={target} report={report} origin={origin} />}
      {/* A weapon fired is gone and cannot be called back: the kit's final weight, 1.5 s. */}
      <GameHold weight="final" tone="danger" glyph="target" commitSound="impact" marks={{ 'data-death-star': '' }}
        label={t('focus.planet.deathStarSection.hold')} disabledReason={disabledReason} onCommit={() => { onLaunch(effectiveBody); }} />
    </StrikeFold>
  );
}

/**
 * THE STRIKE AS A SHEET — kept for the v2 gallery's camera, which photographs it whole. The
 * panel itself carries the strike as `DeathStarSection` since 2026-10-16.
 */
export function StrikeSheet({
  target,
  report,
  onConfirm,
  onClose,
  origin,
}: {
  target: GalaxyPlanet;
  /** The world the weapon leaves from: the selected one, whose pad this launch spends. */
  origin?: PlanetView | undefined;
  /** The newest probe of this world, if any: what its pad and its loyalty looked like. */
  report?: ProbeReading | undefined;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const world = target.intel === 'UNKNOWN'
    ? t('focus.planet.unsurveyedTitle')
    : target.name;
  // THROUGH A PORTAL: the focus shell is `absolute z-20`, a stacking context that would
  // paint the strip and the toasts over this sheet's scrim (the confirm's old fault).
  return createPortal(
    <V2Sheet
      detents={['full']}
      kit={{ tone: 'hostile' }}
      eyebrow={t('focus.planet.strikeConfirm.eyebrow')}
      title={t('focus.planet.strikeConfirm.title', { world })}
      onClose={onClose}
      footer={(
        <div className="gk gk-launch__commit">
          <GameHold weight="final" tone="danger" glyph="target" commitSound="impact" label={t('focus.planet.strikeConfirm.commit')} onCommit={onConfirm} />
        </div>
      )}
    >
      <div data-strike-sheet className="gk gk-strike__body">
        <StrikeDetails target={target} report={report} origin={origin} />
      </div>
    </V2Sheet>,
    document.body,
  );
}

/**
 * A CONTROLLED DESTINATION IS A ROUTE, NOT AN INTELLIGENCE DOSSIER.
 *
 * Reusing the hostile-world detail here buried the only relevant action below
 * public facts, telescope gaps and attack language. This surface names both ends
 * of the owned-world transfer, shows whether craft can make the trip, and leads into
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
  const reach = reachMinutes(origin.planet.position, target.position, origin.fleet, flightModifiers(origin), 'transport');
  const originRecovering = Boolean(
    origin.planet.recoveryUntil && origin.planet.recoveryUntil.getTime() > now,
  );
  const originShipyardRevolt = launchFault(origin.faults, 'fleet') !== null;

  return (
    <Shell
      tone="self"
      art={<PlanetSigil seed={target.id} skinId={target.skin?.id} size={36} />}
      eyebrow={t(target.kind === 'CAPITAL'
        ? 'focus.planet.yourCapital'
        : 'focus.planet.yourColony')}
      title={target.name}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={t('focus.planet.transferFrom', { origin: origin.planet.name })}
    >
      <TargetRadiationInstrument target={{ kind: 'PLANET', id: target.id }} tech={techOf(origin)} />
      {/*
        ONE LINE, TWO ENDS, AND WHAT CAN GO ALONG IT. The worlds panel's route, read-only
        here: the ends are fixed by what was touched, so they are plates, not doors.
      */}
      <section aria-label={t('focus.planet.transferRoute')} className="gk-well gk-ferry">
        <SectionTag>{t('focus.planet.transferRoute')}</SectionTag>
        <div className="gk-ferry__line">
          <span className="gk-ferry__end">
            <span className="gk-label">{t('focus.planet.transferOrigin')}</span>
            <span className="gk-ferry__name">{origin.planet.name}</span>
          </span>
          <span aria-hidden="true" className="gk-ferry__arrow"><Glyph id="next" /></span>
          <span className="gk-ferry__end" data-end="to">
            <span className="gk-label">{t('focus.planet.transferTarget')}</span>
            <span className="gk-ferry__name">{target.name}</span>
          </span>
        </div>
        <div className="gk-figures">
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
        <p className="gk-sub">{t('focus.planet.transferHint')}</p>
      </section>

      {onTransfer && (
        <GameButton
          tone="action"
          wide
          glyph="crate"
          className="gk-focus__wide"
          marks={{ 'data-primary': '' }}
          disabledReason={originShipyardRevolt
            ? t('faults.launchBlock.SHIPYARD_REVOLT')
            : originRecovering ? t('focus.planet.transferRecovering') : null}
          onPress={onTransfer}
        >
          {t('focus.planet.transferPrepare')}
        </GameButton>
      )}
    </Shell>
  );
}

function WorldKind({
  target,
  rivalSlot,
}: {
  target: GalaxyPlanet;
  /** The mark's slot, so the word wears the same colour the disc draws. D183. */
  rivalSlot: number | null;
}) {
  const { t } = useTranslation();
  return (
    <span className="gk-label gk-focus__kind">
      <span {...(target.kind === 'CAPITAL' || target.kind === 'COLONY' ? { 'data-tone': 'self' } : {})}>
        {t(`focus.planet.${worldKindKey(target)}`)}
      </span>
      {rivalSlot !== null && (
        <span style={{ color: rivalColour(rivalSlot) }}>
          · {t('focus.planet.rivalMarkedAction')}
        </span>
      )}
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

  const press = useOwnPress(() => { playSound('tap'); haptic('tap'); explain(); });

  /*
    THE KIT'S NEED CHIP ON A 44 px DOOR (G4-b3, 2026-11-15): met is quiet with a tick, unmet
    in warning with an open ring, a state not yet known with a question mark. A press says
    why the step needs it, for two seconds, over everything.
  */
  return (
    <span className="gk-req">
      <button
        id={`${tooltipId}-button`}
        type="button"
        {...OWN_SOUND}
        aria-label={label}
        aria-describedby={explaining ? tooltipId : undefined}
        aria-expanded={explaining}
        className="gk-need-door"
        onPointerDown={press.onPointerDown}
        onClick={press.onClick}
      >
        <span className="gk-need-chip" {...(ok === true ? { 'data-met': '' } : {})} {...(ok === null ? { 'data-open': '' } : {})}>
          <Glyph id={ok === null ? 'help' : ok ? 'check' : 'lock'} />
          {children}
        </span>
      </button>
      {explaining && createPortal(
        <span id={tooltipId} role="tooltip" aria-live="polite" className="gk fixed gk-tip" style={tooltipPosition}>
          {explanation}
        </span>,
        document.body,
      )}
    </span>
  );
}

/**
 * THE STRIKE ESSAY IS GONE FROM THIS PANEL, AND THAT IS THE POINT. Owner report.
 *
 * `StrikeEffects` drew six lines of what a Death Star does, under a world the
 * commander was merely LOOKING at. Three things were wrong with it at once:
 *
 * · IT ANSWERED A QUESTION NOBODY HERE ASKED. `focus-density.test.tsx` already
 *   refuses to draw the death-star CONTROL to a commander who owns no weapon —
 *   "you have no Death Star" is not a gap they are about to close (I1). The
 *   explanation of that control outlived the control itself, so the panel spent
 *   half a phone screen arguing for a rocket that was not on offer.
 * · IT WAS ALREADY WRITTEN SOMEWHERE BETTER. The forge card states the same five
 *   facts beside the thing that fires them (D55/D113), which is where a commander
 *   is actually deciding to build one.
 * · IT COST THE SHEET ITS HEIGHT. Six bullet lines on the one surface an attack
 *   is chosen from, above the intel that the attack is chosen WITH.
 *
 * What stays is the route strip and the control — the strike is still named and
 * still offered. `focus-sheet-owner-fixes.test.tsx` holds both halves: no essay,
 * and the route still there.
 */
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
  priority,
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
  /** The raider's first hour on a live claim, while it runs. */
  priority: { until: Date; mine: boolean } | null;
  isRival: boolean;
  phase: ColonizationPhase;
}) {
  const { t } = useTranslation();
  const standing = planet.colonies;
  const nextCore = standing ? nextColonyCore(standing.colonies, standing.reservations) : null;
  const colonySlotLabel = colonySlotOpen
    ? t('focus.planet.colonySlotOpen')
    : nextCore === null
      ? t('focus.planet.colonySlotsFull', { max: colonyCapacity(Infinity) })
      : t('focus.planet.colonySlotNeedsCore', { required: nextCore, current: standing?.capitalCore ?? planet.researchCore });

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
      <div className="gk-guide" data-tone="self">
        <div className="gk-guide__head">
          <Glyph id={target.kind === 'CAPITAL' ? 'home' : 'colony'} />
          <p className="gk-label gk-guide__title">
            {t(target.kind === 'CAPITAL' ? 'focus.planet.yourCapital' : 'focus.planet.yourColony')}
          </p>
          {standing && <span className="gk-num gk-guide__aside">{standing.colonies + standing.reservations}/{standing.capacity}</span>}
        </div>
        <p className="gk-sub">{t('focus.planet.transferHint')}</p>
      </div>
    );
  }

  if (target.kind === 'CAPITAL') {
    const emp = target.state.kind === 'EMP' ? target.state : null;
    return (
      /*
        A RULE ABOUT SOMEBODY ELSE'S WORLD, SO NOT IN YOUR COLOUR (K2, M2): teal is you, and
        a stranger's capital was boxed in it. Neutral and one line tall, as the dossier's
        other rules are; only the EMP window — an opening for you — keeps the teal edge.
      */
      <div className="gk-guide" {...(emp ? { 'data-tone': 'self' } : {})}>
        <div className="gk-guide__head">
          <Glyph id="shield" />
          <div className="gk-guide__text">
            <p className="gk-guide__title">
              {t(emp ? 'focus.planet.capitalEmp' : 'focus.planet.capitalProtected')}
            </p>
            {/*
              WHAT A CAPITAL COSTS A RAIDER, IN THE VOCABULARY THAT IS ON SCREEN.

              Both sentences below the headline were written about the Death Star
              — what it halves, and that a second one takes half of the remainder
              — and `STRATEGIC_CRAFTING_ENABLED` took the forge, the research row
              and the launch control away without touching them. That left the one
              surface a raider reads before committing explaining a weapon they
              cannot build, own or find, which reads as a broken game rather than
              as a rule. The flag-off line states the rule that IS live: raids take
              resources here and control never moves.
            */}
            <p className="gk-sub">
              {t(!FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED
                ? 'focus.planet.capitalRaidOnlyHint'
                : emp
                  ? 'focus.planet.capitalEmpHint'
                  : 'focus.planet.capitalProtectedHint')}
            </p>
          </div>
          {emp && <span className="gk-num gk-guide__aside">{duration((emp.until.getTime() - now) / 60_000)}</span>}
        </div>
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
    const alloy = planet.planet.alloy >= MULTI_WORLD.settlement.charge.alloy;
    const crystal = planet.planet.crystal >= MULTI_WORLD.settlement.charge.crystal;
    const title = t(phase === 'SETTLEMENT_IN_FLIGHT'
      ? 'focus.planet.settlementInFlight'
      : !claimActive
        ? 'focus.planet.colonyRoute'
        : priority === null
          ? 'focus.planet.claimOpen'
          : priority.mine ? 'focus.planet.claimPriorityMineTitle' : 'focus.planet.claimPriorityOtherTitle');
    const steps = (
      <ol className="gk-steps">
        <RouteStep
          status={phase === 'NEUTRAL_PREP' ? 'current' : 'complete'}
          open={isOpen('colony-1', phase === 'NEUTRAL_PREP')}
          onToggle={() => { toggleStep('colony-1'); }}
          number="1"
          label={t('focus.planet.routeRaid')}
          description={t('focus.planet.routeRaidDetail')}
          dataStep="1"
        />
        <RouteStep
          status={phase === 'NEUTRAL_PREP' ? 'upcoming' : 'complete'}
          open={isOpen('colony-2', false)}
          onToggle={() => { toggleStep('colony-2'); }}
          number="2"
          label={t('focus.planet.routeClaim')}
          description={t('focus.planet.routeClaimDetail', { minutes: SETTLEMENT_PRIORITY_MINUTES })}
          dataStep="2"
        />
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
              {/*
                THE CHIP SAYS WHICH WAY IT IS (owner report, 2026-10-07): "○ Koloni yuvası" read
                as an open slot to a Core 6 commander. Open, the Core that opens the next one, or
                full — never the bare name with its state left to a dot.
              */}
              <Requirement
                ok={colonySlotOpen}
                label={colonySlotLabel}
                explanation={t('focus.planet.colonySlotExplain', { minutes: SETTLEMENT_PRIORITY_MINUTES })}
              >
                {colonySlotLabel}
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
                  amount: compact(MULTI_WORLD.settlement.charge.alloy),
                })}
                explanation={t('focus.planet.foundingAlloyExplain', {
                  amount: compact(MULTI_WORLD.settlement.charge.alloy),
                })}
              >
                <img src={RESOURCE_ART.alloy} alt="" aria-hidden className="gk-req__art" />
                {compact(MULTI_WORLD.settlement.charge.alloy)}
              </Requirement>
              <Requirement
                ok={crystal}
                label={t('focus.planet.foundingCrystal', {
                  amount: compact(MULTI_WORLD.settlement.charge.crystal),
                })}
                explanation={t('focus.planet.foundingCrystalExplain', {
                  amount: compact(MULTI_WORLD.settlement.charge.crystal),
                })}
              >
                <img src={RESOURCE_ART.crystal} alt="" aria-hidden className="gk-req__art" />
                {compact(MULTI_WORLD.settlement.charge.crystal)}
              </Requirement>
              <Requirement
                ok={settlementFuelled}
                label={t('focus.planet.settlementFuel', { amount: compact(settlementFuel) })}
                explanation={t('focus.planet.settlementFuelExplain', {
                  amount: compact(settlementFuel),
                })}
              >
                <img src={RESOURCE_ART.deuterium} alt="" aria-hidden className="gk-req__art" />
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
    );
    /*
      THE ROUTE BEHIND ITS ⓘ (owner 2026-11-17: "koloni nasıl kurulur section'ı bir infobox'a wrap et"). Before
      a race opens the steps are a lesson, not a state, so the title keeps its line and the steps open from
      the ⓘ; once a race is open or a colony fleet flies, they are the live state and stay in sight.
    */
    if (phase === 'NEUTRAL_PREP') {
      return (
        <div className="gk-guide" data-colony-route="">
          <InfoPeek lead={<Glyph id="colony" />} fact={<span className="gk-label gk-guide__title">{title}</span>}
            about={t('itemSheet.howItWorks')} rule={steps} />
        </div>
      );
    }
    return (
      <div className="gk-guide" data-colony-route="" {...(claimActive ? { 'data-tone': 'self' } : {})}>
        <div className="gk-guide__head">
          <Glyph id="colony" />
          <p className="gk-label gk-guide__title">{title}</p>
        </div>
        {steps}
        {claimActive && (
          <p className="gk-guide__lead">
            {priority === null
              ? t('focus.planet.claimRaceExplain')
              : t(priority.mine ? 'focus.planet.claimPriorityMineExplain' : 'focus.planet.claimPriorityOtherExplain', {
                minutes: SETTLEMENT_PRIORITY_MINUTES,
              })}
          </p>
        )}
        {claimActive && until && (
          <p className="gk-num gk-guide__clock">
            {priority === null
              ? t('focus.planet.claimCloses', { duration: duration((until.getTime() - now) / 60_000) })
              : t('focus.planet.claimPriorityCloses', {
                priority: duration((priority.until.getTime() - now) / 60_000),
                closes: duration((until.getTime() - now) / 60_000),
              })}
          </p>
        )}
        {claimActive && (
          <p className="gk-inote gk-guide__foot" data-tone="warn">
            <Glyph id="attack" />
            <span>{t('focus.planet.claimRaidStillOpen')}</span>
          </p>
        )}
      </div>
    );
  }

  const emp = target.state.kind === 'EMP' ? target.state : null;
  const attackProtectedUntil = target.attackProtectedUntil;
  const protectedUntil = attackProtectedUntil && attackProtectedUntil.getTime() > now
    ? attackProtectedUntil
    : target.state.kind === 'PROTECTED' && target.state.until.getTime() > now
      ? target.state.until
      : null;
  /**
   * A ROUTE WITH NO VEHICLE IS NOT A ROUTE. `STRATEGIC_CRAFTING_ENABLED`.
   *
   * Everything below except the occupation notice describes an IMPACT — "what a
   * strike does", the damage step, the clock, the warning that the world produces
   * nothing until it runs out. None of it can be caused while the weapon is off,
   * and `recoveryUntil` is written in exactly one place in the server
   * (`services/strategic.ts`), so the recovery branch is unreachable too.
   *
   * THE OCCUPATION WINDOW SURVIVES IT, and that is the whole reason this is a
   * filter rather than a `return null`: `PROTECTED` also refuses an ordinary raid
   * (D98 · D183), so a commander looking at a freshly captured colony still needs
   * to be told why the attack control will not fire.
   */
  if (!FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED && protectedUntil === null) return null;
  return (
    <div className="gk-guide" {...(emp ? { 'data-tone': 'self' } : isRival ? { 'data-tone': 'warn' } : {})}>
      <div className="gk-guide__head">
        <Glyph id={protectedUntil ? 'shield' : 'target'} />
        <p className="gk-label gk-guide__title">
          {t(emp
            ? 'focus.planet.empBreach'
            : protectedUntil
              ? 'focus.planet.occupationProtected'
              : 'focus.planet.deathStarRoute')}
        </p>
        {emp && <span className="gk-num gk-guide__aside">{duration((emp.until.getTime() - now) / 60_000)}</span>}
      </div>
      {protectedUntil ? (
        <p className="gk-sub">
          {t('focus.planet.protectedFor', { duration: duration((protectedUntil.getTime() - now) / 60_000) })}
        </p>
      ) : (
        <ol className="gk-steps gk-steps--two">
          <RouteStep
            status={emp ? 'complete' : 'current'}
            open={isOpen('strike-1', !emp)}
            onToggle={() => { toggleStep('strike-1'); }}
            number="1"
            label={t('focus.planet.firstImpact', {
              duration: duration(DEATH_STAR.empMinutes),
            })}
            // A colony also pays in loyalty (owner, 2026-10-01); a capital has none to lose.
            {...(target.kind === 'COLONY'
              ? { description: t('focus.planet.firstImpactColony', { loss: DEATH_STAR.colonyLoyaltyLoss, hits: hitsToTakeLoyalColony }) }
              : {})}
            danger
          />
          <RouteStep
            status={emp ? 'current' : 'upcoming'}
            open={isOpen('strike-2', Boolean(emp))}
            onToggle={() => { toggleStep('strike-2'); }}
            number="2"
            label={t('focus.planet.secondImpact')}
            danger
          />
        </ol>
      )}
      {/*
        THE THREE CHIPS HERE WERE THE CAPTURE GATES — an open colony slot, a ready
        weapon, a flight that lands before the window shuts — and D167 removed the
        route they belonged to. What a reader needs in their place is the one fact
        that decides this world's fate: whoever holds it has until the clock runs
        out to put a ship on it, and nobody has to fire anything for it to fall.
      */}
      {emp && (
        <p className="gk-inote" data-tone="self">
          {t('focus.planet.empWarning', {
            duration: duration((emp.until.getTime() - now) / 60_000),
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
 * requirement chips — stacked down a 350-wide phone. A three-step process the
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
  const hasDetail = description !== undefined;
  const fold = useOwnPress(() => { playSound('tap'); haptic('tap'); onToggle(); });

  /*
    A STEP OF THE ROUTE (G4-b3, 2026-11-15): its number in a ring (a tick once done), its name,
    the fold; the step under way lit in your colour — in warning when it is a strike.
  */
  const header = (
    <span className="gk-step__head">
      <span className="gk-step__n gk-num">{status === 'complete' ? <Glyph id="check" /> : number}</span>
      <span className="gk-step__name">{label}</span>
      {hasDetail && <span className="gk-step__chev" aria-hidden="true"><Glyph id={open ? 'up' : 'down'} /></span>}
    </span>
  );

  return (
    <li
      className="gk-step"
      data-status={status}
      {...(danger ? { 'data-danger': '' } : {})}
      aria-current={status === 'current' ? 'step' : undefined}
      data-colony-step={dataStep}
      data-open={open ? 'true' : 'false'}
    >
      {hasDetail ? (
        <button type="button" {...OWN_SOUND} aria-expanded={open} className="gk-step__fold"
          onPointerDown={fold.onPointerDown} onClick={fold.onClick}>
          {header}
        </button>
      ) : header}

      {open && description !== undefined && <span data-step-detail className="gk-step__detail">{description}</span>}
      {children && <span className="gk-step__reqs">{children}</span>}
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

  /*
    A SECTION OF THE DOSSIER, IN ITS LANGUAGE (M2): a hairline, a heading, the story, the
    counts. It was a warn-tinted box, and warn is a gap you can close (K2) — a history is
    not one. The mark wears the rival's own colour; the counts sit on one shared row and
    the dominion, the one pair of figures, gets the line under them.
  */
  const cell = (label: string, value: string) => (
    <div className="gk-rival__cell">
      <dt className="gk-label">{label}</dt>
      <dd className="gk-num">{value}</dd>
    </div>
  );
  return (
    <section className="gk-rival" aria-label={t('focus.planet.rivalHeading')}>
      <SectionTag as="h3" aside={lastAt > 0 ? t('focus.planet.rivalLastContact', { age: staleness((now - lastAt) / 60_000) }) : undefined}>
        {t('focus.planet.rivalHeading')}
      </SectionTag>
      {marked && <span className="gk-chip gk-rival__mark">{t('focus.planet.rivalMarkedBadge')}</span>}
      <p className="gk-rival__story">{story}</p>
      {marked && <p className="gk-sub">{t('focus.planet.rivalPurpose')}</p>}
      {summary && (
        <dl className="gk-well gk-rival__counts">
          <div className="gk-rival__cells">
            {cell(t('focus.planet.rivalEncounters'), String(summary.battles))}
            {cell(t('focus.planet.rivalYourRaids'), String(summary.attacks))}
            {cell(t('focus.planet.rivalTheirRaids'), String(summary.defences))}
          </div>
          <div className="gk-rival__dominion">
            <dt className="gk-label">{t('focus.planet.rivalDominion')}</dt>
            <dd className="gk-num">
              {t('focus.planet.rivalDominionValue', {
                gained: compact(summary.dominionGained),
                lost: compact(summary.dominionLost),
              })}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function Headline({ of }: { of: HeadlineKind }) {
  const { t } = useTranslation();
  switch (of.kind) {
    case 'fleet-away':
      return <span data-tone="self">{t('focus.planet.headlineFleetAway')}</span>;
    case 'fleet-home':
      return <span>{t('focus.planet.headlineFleetHome')}</span>;
    case 'veiled':
      return <span>{t('focus.planet.headlineVeiled')}</span>;
    case 'probed':
      return (
        <span>
          {t('focus.planet.headlineProbed', { age: staleness(of.ageMinutes) })}
        </span>
      );
    case 'fought':
      return (
        <span>
          {t('focus.planet.headlineFought', { age: staleness(of.ageMinutes) })}
        </span>
      );
    case 'none':
      return <span>{t('focus.planet.headlineNone')}</span>;
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
        <GameButton size="sm" glyph="eye" onPress={onInstallTelescope}>{t('focus.planet.installTelescope')}</GameButton>
      );
    }
    return (
      <div className="gk-focus__slots">
        {Array.from({ length: telescopeSlots(telescope) }, (_, slot) => {
          const current = intel?.watching.find((w) =>
            w.slot === slot && (!w.observerPlanetId || w.observerPlanetId === observerPlanetId));
          return (
            <GameButton key={slot} size="sm" glyph="eye" pending={watch.isPending}
              onPress={() => {
                watch.mutate(
                  { targetPlanetId: target.id, slot },
                  {
                    onSuccess: () => { say(t('focus.planet.watching', { target: target.name })); },
                    onError: (err) => { say(describe(err), 'error'); },
                  },
                );
              }}>
              {current
                ? t('focus.planet.replaceSlot', { slot: slot + 1, target: current.targetName })
                : t('focus.planet.watchSlot', { slot: slot + 1 })}
            </GameButton>
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
 * THE COOLDOWN IS THE ONLY THING THAT CLOSES IT — five seconds per world,
 * enforced in `launchProbe` under the planet lock, which is the only place
 * it can be enforced. What this does is stop the interface offering a launch it
 * already knows will be refused (principle 10), reading the SAME instant the
 * guard reads, published by `/api/intel`, so the two can never disagree by a
 * rounding. `useNow()` reads the server-corrected clock so a drifted phone cannot
 * open it early, and also re-renders when the five seconds expire (D52).
 */
function ProbeControl({
  target,
  intel,
  onLaunched,
}: {
  target: Pick<GalaxyPlanet, 'id' | 'name'>;
  intel: IntelView | undefined;
  /** Called with the target's name once a probe is away, so the disc can follow it. */
  onLaunched: (targetName: string) => void;
}) {
  const { t } = useTranslation();
  const probe = useProbe();
  const say = useToast();
  // Five seconds is short enough that waiting for an unrelated React update would
  // visibly strand the disabled control. Tick from the server-corrected clock.
  const now = useNow(1000);

  const readyAt = intel?.probeCooldowns.find(
    (row) => row.targetPlanetId === target.id,
  )?.readyAt;
  /*
    HALF A ROW, BECAUSE IT SHARES ONE WITH THE ATTACK (owner). The verb is the face, the
    price rides beside it — a spend the player cannot see before pressing is a worse failure
    than a wide button — and the whole sentence is the name a reader hears. A probe cannot be
    recalled, so its press lands with the weight of a spend (G4-b1, 2026-11-15).
  */
  if (readyAt !== undefined && readyAt.getTime() > now) {
    const left = duration((readyAt.getTime() - now) / 60_000);
    return (
      <GameButton glyph="eye" size="sm" className="gk-focus__half" onPress={() => undefined}
        spoken={t('focus.planet.probeCooling', { duration: left })}
        disabledReason={`${t('focus.planet.probeShort')} · ${left}`}>
        {t('focus.planet.probeShort')}
      </GameButton>
    );
  }
  return (
    <GameButton
      glyph="eye"
      heavy
      size="sm" className="gk-focus__half"
      marks={{ 'data-guide': 'probe' }}
      spoken={t('focus.planet.sendProbe', { alloy: compact(PROBE.alloy), crystal: compact(PROBE.crystal) })}
      pending={probe.isPending}
      cost={<CostLine cost={{ alloy: PROBE.alloy, crystal: PROBE.crystal }} />}
      onPress={() => {
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
      {t('focus.planet.probeShort')}
    </GameButton>
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
  craftAvailable: craftAtHome,
  craftHold,
  derrick,
  derrickHold,
  minutesLeft,
  reachMinutes: reach,
  atHome,
  onCollect,
  storeFull = false,
  run,
  craftReadyAt,
  craftCooldowns,
  launchBlock,
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
   * What the WORKS will hold for this haul when the craft land, not what storage can. D31.
   *
   * Mined ore comes home into the buffer, and the buffer is smaller than storage AND
   * fills with ordinary production the whole time the craft are away. A player who
   * commits a squadron and gets half a haul has to be able to see that coming —
   * otherwise the honest rule reads as a bug. Null while the flight is unknown.
   */
  atHome: (haul: { alloy: number; crystal: number; deuterium: number }) => HaulHome | null;
  /** Collects the works now, offered when a haul would not fit and something is waiting. */
  onCollect?: (() => void) | undefined;
  /** Something is waiting in the works and the store can take none of it. */
  storeFull?: boolean;
  /** Your own craft already working this rock, if any. */
  run: TargetMiningRun | undefined;
  /** Legacy aggregate fallback only when an older server omits independent batches. */
  craftReadyAt: Date | null;
  craftCooldowns?: readonly CraftCooldown[];
  launchBlock?: LaunchFault;
  onClose: () => void;
  onSend: (craft: number) => void;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const { available: craftAvailable, resting } = craftReadiness(craftAtHome, craftReadyAt, craftCooldowns, now);
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
  // What this trip would bring, split as the rock is made; the works decide how much of it lands. D31.
  const bringing = Math.min(craftHold * sending, rock.oreRemaining);
  const deuteriumShare = rock.deuteriumShare ?? 0;
  const home = bringing > 0 ? atHome({
    alloy: bringing * (1 - rock.crystalShare - deuteriumShare), crystal: bringing * rock.crystalShare, deuterium: bringing * deuteriumShare,
  }) : null;

  return (
    <Shell
      glyph="asteroid"
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
            components={[<span key="n" className="gk-tone-self" />]}
          />
          {' · '}
          <span className={minutesLeft < 60 ? 'gk-tone-warn' : ''}>{duration(minutesLeft)}</span>
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
        <>
          {run && <MiningCommitments run={run} lane="asteroid" />}
          {/* Whether the craft catch it, said beside the press: speed is the rock's, the race is mine. */}
          {reach !== null && !tooLate && (
            <p className="gk-inote gk-focus__wide" data-tone="self"><Glyph id="timed" />
              {t('focus.asteroid.intercept', { reach: duration(reach), spare: duration(minutesLeft - reach) })}
            </p>
          )}
          <GameButton tone="action" wide glyph="mine" className="gk-focus__wide" marks={{ 'data-primary': '', 'data-guide': 'mine' }}
            pending={busy}
            disabledReason={launchBlock !== undefined
              ? t(`faults.launchBlock.${launchBlock}`)
              : needsSpectrometry
                ? t('focus.asteroid.researchNeeded')
                : resting !== null
                  ? t('focus.asteroid.resting', { duration: countdown(resting) })
                  : craftAvailable < 1
                    ? t('focus.asteroid.noCraft')
                    : tooLate ? t('focus.asteroid.tooLate') : null}
            onPress={() => { onSend(sending); }}>
            {/* with no reach the press is refused and its reason is the label */}
            {reach === null ? null : t('focus.asteroid.send', { count: sending, duration: duration(reach) })}
          </GameButton>
        </>
      }
    >
      <div className="gk-mine">
        {!needsSpectrometry && <CraftPicker available={craftAvailable} value={sending} onPick={setCraft} />}
        <p className="gk-sub gk-num gk-mine__fleet">
          {t('focus.asteroid.fleetLine', { count: craftAvailable, hold: compact(craftHold), total: compact(canCarry) })}
        </p>
        <CraftRests cooldowns={craftCooldowns} now={now} lane="asteroid" />

        <div className="gk-well gk-figures gk-figures--well gk-figures--two">
          <Figure label={t('focus.asteroid.oreLeft')} value={compact(rock.oreRemaining)} tone="crystal" />
          <Figure label={t('focus.asteroid.leavesIn')} value={duration(minutesLeft)} tone={minutesLeft < 60 ? 'threat' : undefined} />
          <Figure
            label={t('focus.asteroid.composition')}
            value={
              rock.isotopeRich
                ? rock.deuteriumShare === null
                  ? t('focus.asteroid.compositionUnknown')
                  : t('focus.asteroid.compositionIsotope', { crystal, deuterium })
                : t('focus.asteroid.compositionValue', { percent: crystal })
            }
          />
          <Figure label={t('focus.asteroid.speed')} value={t('focus.asteroid.speedValue', { rate: rock.speed.toFixed(1) })} />
        </div>

        {rock.isotopeRich && <p className="gk-inote" data-tone="deut"><Glyph id="fuel" />{t('focus.asteroid.deuteriumRoute')}</p>}

        {/*
          Said BEFORE the commitment, not after it. A squadron is a real decision and the
          works filling up while it is away is the one thing that can make it worse without
          the player doing anything wrong — so it is stated here, with the fix.
        */}
        {home && !run && <HaulHomeLine home={home} onCollect={onCollect} storeFull={storeFull} />}

        <div className="gk-mine__notes">
          <p className="gk-sub">
            {rock.oreRemaining < rock.ore
              ? t('focus.asteroid.taken', { amount: compact(rock.ore - rock.oreRemaining) })
              : t('focus.asteroid.untouched')}
          </p>
          {/* The one thing a Derrick changes about this trip, priced as a reason. */}
          {!derrick && derrickHold > craftHold && (
            <p className="gk-sub">
              <Trans
                i18nKey="focus.asteroid.derrickPitch"
                values={{ name: satelliteLabel('DERRICK'), hold: compact(derrickHold) }}
                components={[<b key="n" />, <b key="h" className="gk-num gk-tone-self" />]}
              />
            </p>
          )}
        </div>
      </div>
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
  launchBlock = null,
  onClose,
  onAttack,
  raiding,
  open,
  onToggle,
}: {
  pirate: PirateContact;
  /** What is STANDING at the selected world. Nothing in the air can be sent again. */
  fleetAtHome: Fleet;
  /** Why nothing may leave this world for this lane, if anything stops it. D212 adds Silent Space. */
  launchBlock?: LaunchFault | null;
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
   * `reachMinutes` is the soonest rendezvous the world's fastest COMBAT hull could keep —
   * an honest upper bound on opportunity, which is the question a rail answers:
   * could I reach this at all. What the launch will actually use depends on the
   * slowest ship SELECTED, and the sheet quotes that exactly, from the same table.
   */
  const soonest = pirate.reachMinutes;

  return (
    <Shell
      glyph="pirate"
      tone="hostile"
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
          <span className={pirate.expiresInMinutes < 30 ? 'gk-tone-warn' : ''}>
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
          <p className="gk-inote gk-focus__wide" data-tone="self"><Glyph id="rocket" />{t('pirate.alreadyRaiding')}</p>
        ) : (
          <GameButton tone="action" wide glyph="attack" className="gk-focus__wide" marks={{ 'data-primary': '' }} onPress={onAttack}
            disabledReason={launchBlock !== null ? t(`faults.launchBlock.${launchBlock}`) : hasShips ? null : t('pirate.noShips')}>
            {t('pirate.attack')}
          </GameButton>
        )
      }
    >
      <div className="gk-fbody">
      <div className="gk-well gk-figures gk-figures--well gk-figures--two">
        <Figure
          label={t('pirate.leavesIn')}
          value={duration(pirate.expiresInMinutes)}
          tone={pirate.expiresInMinutes < 30 ? 'alloy' : undefined}
        />
        <Figure
          label={t('pirate.reachLabel')}
          value={soonest === null ? '—' : duration(soonest)}
          tone={soonest === null ? 'threat' : undefined}
        />
        {/*
          HOW BIG THE FIGHT IS, ON THE RAIL THAT DESCRIBES IT. D183, owner report:
          *"Bir korsan filoya focus olunca, focus sheette korsan filonun gücü
          gözükmüyor. Ancak saldır butona basınca açılan sheette gözüküyor."*

          The crew list below answers "what is out there"; it does not answer "how
          much is it", and that figure was two taps away inside the commitment sheet
          — on the far side of the decision the commander was trying to make. D124:
          the one rule this feature turns on is "is this fight my size".

          `combatValue`, the same axis `ForceCompare` puts the commander's own wing
          on a tap later. A rail quoting a different quantity would be worse than a
          rail quoting none. IDENTIFIED only: a Radar return carries no roster (D123)
          and a strength invented from a silhouette is a reading nobody bought.
        */}
        {identified && crew && (
          <Figure
            label={t('pirate.strengthLabel')}
            value={full(combatValue(crew))}
            testId="pirate-strength"
          />
        )}
      </div>

      {/*
        THE HANDICAP, IN WORDS AND AS A NUMBER. It is the only combat modifier in
        the feature and the entire reason a PvE prize can be affordable — so a
        player who cannot read it is being asked to price a fight blind.
      */}
      {identified && pirate.damageMult !== undefined && (
        <p className="gk-inote" data-tone="self"><Glyph id="shield" />
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
        <p className="gk-inote"><Glyph id="eye" />
          {t('pirate.remembered')}
        </p>
      )}

      {/* Actual sight carries the actual crew; a radar return carries a size. */}
      <p className="gk-label">{t('pirate.roster')}</p>
      {crewEntries.length > 0
        ? <CrewChips entries={crewEntries} />
        : <p className="gk-sub">{t('pirate.rosterUnknown')}</p>}

      <div className="gk-fnotes">
        {crewEntries.some(([hull]) => HULLS[hull].cls === 'SUPPORT') && <p className="gk-sub">{t('pirate.holdsHint')}</p>}
        <p className="gk-sub">{t('pirate.captureHint')}</p>
        <p className="gk-sub">{t('pirate.hoardHint')}</p>
        <p className="gk-sub">{t('pirate.boundary')}</p>
        {/* Information now, not a warning: the raid can turn home once before its engagement (owner, 2026-10-08). */}
        <p className="gk-sub">{t('pirate.outbound')}</p>
      </div>
      </div>
    </Shell>
  );
}

/* ── the public convoy crossing the disc ─────────────────────── */

/**
 * INTERGALACTIC CONVOY FOCUS — D201.
 *
 * The target and its route are public. The rail therefore spends its scarce room
 * on the decision: time remaining, this world's best reach, the exact five-second
 * firing window, no retaliation, and whether this physical world already owns the
 * one allowed strike for the occurrence.
 */
export function IntergalacticConvoyFocus({
  convoy,
  minutesLeft,
  reachMinutes,
  hasCombatCraft,
  launchLocked,
  occurrenceSpent,
  launchBlock = null,
  onClose,
  onRaid,
  open,
  onToggle,
}: {
  convoy: IntergalacticConvoyEvent;
  minutesLeft: number;
  reachMinutes: number | null;
  hasCombatCraft: boolean;
  launchLocked: boolean;
  /** This world has already spent its one strike at the convoy that is up. D124. */
  occurrenceSpent: boolean;
  /** Why nothing may leave this world for this lane, if anything stops it. D212 adds Silent Space. */
  launchBlock?: LaunchFault | null;
  onClose: () => void;
  onRaid: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  /*
    THE SPENT QUOTA COMES FIRST, AND IT IS THE ONE THIS RAIL USED TO MISS. D124.

    A world strikes each crossing exactly once, ever, while the crossing lasts two
    hours and the round trip rarely lasts one — so the ordinary case is a commander
    whose fleet is home again, inside the same window, looking at a live button
    with nothing behind it. `launchLocked` clears the moment the fleet lands and
    said nothing about the quota, so the control invited a launch the server was
    always going to refuse.
  */
  const refusal = launchBlock !== null
    ? t(`faults.launchBlock.${launchBlock}`)
    : occurrenceSpent
      ? t('convoy.alreadyStruck')
    : launchLocked
      ? t('convoy.alreadyAway')
      : !hasCombatCraft
        ? t('convoy.noCraft')
        : reachMinutes === null
          ? t('convoy.cannotReach')
          : null;

  return (
    <Shell
      glyph="crate"
      eyebrow={t('convoy.eyebrow')}
      title={t('convoy.title')}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={(
        <span>
          <span className={minutesLeft < 15 ? 'gk-tone-warn' : ''}>{duration(minutesLeft)}</span>
          {reachMinutes !== null
            ? ` · ${t('convoy.summaryReach', { duration: duration(reachMinutes) })}`
            : ''}
        </span>
      )}
      actions={(
        <GameButton tone="action" wide glyph="attack" className="gk-focus__wide" marks={{ 'data-testid': 'convoy-open', 'data-primary': '' }}
          disabledReason={refusal} onPress={onRaid}>
          {t('convoy.open')}
        </GameButton>
      )}
    >
      <div className="gk-fbody">
        <div className="gk-well gk-figures gk-figures--well gk-figures--two">
          <Figure label={t('convoy.engagementLabel')} value={t('convoy.engagementDuration')} />
          <Figure label={t('convoy.shipChance')} value={`${compact(convoy.rewardPolicy.shipDropChanceAtFullQuality * 100)}%`} />
        </div>
        <p className="gk-sub gk-convoy__lead">{t('convoy.boundary')}</p>
        <p className="gk-inote" data-tone="warn"><Glyph id="lock" />{t('convoy.irreversible')}</p>
      </div>
    </Shell>
  );
}

export function TradeFocus({
  merchant,
  fleetAtHome,
  fleetAway,
  minutesLeft,
  reachMinutes: reach,
  launchBlock = null,
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
  /** Why nothing may leave this world for this lane, if anything stops it. D212 adds Silent Space. */
  launchBlock?: LaunchFault | null;
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
  /*
    IS THERE A CARRIER AT ALL — a question no ladder can answer. D180.

    `UNAIDED.tech` deliberately, and it is the same argument `startAttack` makes for
    `fleetSpeed`: `cargoMult` is a multiplier of at least 1, so it cannot turn a
    zero hold into a positive one or the reverse. This rail asks whether the
    commander OWNS a transport, never how much it holds — the figure itself is
    quoted on `TradeSheet`, which does read their research.
  */
  const hasCarrier = transferCargoCapacity(fleetAtHome, UNAIDED.tech) > 0;
  /*
    "YOU HAVE NONE" AND "YOURS ARE OUT" ARE NOT THE SAME SENTENCE. Owner report: a
    commander who had just sent their only Atlas at this merchant was told
    *"Burada Kurye, Seyyah veya Atlas yok"* — true of the pad, and nonsense to read
    while watching that very convoy fly. One is fixed by building a transport, the
    other by waiting for one to land, and a rail that cannot tell them apart sends
    a player to the shipyard to buy what they already own.
  */
  const carriersAway = !hasCarrier && transferCargoCapacity(fleetAway, UNAIDED.tech) > 0;
  const tooLate = reach === null;

  return (
    <Shell
      glyph="crate"
      eyebrow={t('trade.eyebrow')}
      title={t('trade.title')}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={(
        <span>
          <span className={minutesLeft < 30 ? 'gk-tone-warn' : ''}>{duration(minutesLeft)}</span>
          {reach !== null && ` · ${t('trade.summaryReach', { duration: duration(reach) })}`}
        </span>
      )}
      actions={(
        /*
          THE SAME LADDER THE SHEET USES, TRUNCATED TO WHAT A RAIL CAN KNOW. Everything below
          this — the bay, the swap, the hold, the store, the fuel — depends on a convoy that has
          not been chosen yet, so it belongs to the sheet.
        */
        <GameButton tone="action" wide glyph="share" className="gk-focus__wide" marks={{ 'data-testid': 'trade-open', 'data-primary': '' }}
          onPress={onTrade}
          disabledReason={launchBlock !== null
            ? t(`faults.launchBlock.${launchBlock}`)
            : carriersAway
              ? t('trade.carriersAway')
              : !hasCraft
                ? t('trade.noCraft')
                : !hasCarrier
                  ? t('trade.noCarrier')
                  : tooLate ? t('trade.tooLate') : null}>
          {t('trade.open')}
        </GameButton>
      )}
    >
      {/*
        THE RATE, DRAWN. D124 · D142.

        ONE ANCHOR, AND IT IS THE SMALLEST ONE THAT COMES OUT WHOLE.
        `rateAnchor` is the least common multiple of the occurrence's three prices,
        so current and persisted historical rates both render without fractions.
        D208's 1 · 2 · 32 rate reads 32 Alloy · 16 Crystal · 1 Deuterium.
      */}
      <div className="gk-fbody">
      <p className="gk-label">{t('trade.rateHeading')}</p>
      <div data-testid="trade-rate" className="gk-par">
        {TRADE_RESOURCES.map((resource) => {
          const anchor = rateAnchor(merchant.rate);
          const amount = anchor / merchant.rate[resource];
          const widest = anchor / Math.min(
            merchant.rate.alloy,
            merchant.rate.crystal,
            merchant.rate.deuterium,
          );
          return (
            <div key={resource} data-rate-row data-resource={resource} className="gk-par__row">
              <img src={RESOURCE_ART[resource]} alt="" aria-hidden />
              <span
                className="gk-par__bar"
                data-resource={resource}
                role="img"
                aria-label={t('trade.rateReading', {
                  amount: full(amount),
                  resource: t(`trade.${resource}`),
                })}
              >
                <span className="gk-par__fill" style={{ width: `${String(Math.max(2, (amount / widest) * 100))}%` }} />
              </span>
              <span className="gk-num gk-par__amount">{full(amount)}</span>
            </div>
          );
        })}
      </div>

      <div className="gk-well gk-figures gk-figures--well gk-figures--two">
        <Figure
          label={t('trade.leavesIn')}
          value={duration(minutesLeft)}
          tone={minutesLeft < 30 ? 'threat' : undefined}
        />
        {/*
          "YOU CANNOT CATCH IT" IS AN ANSWER TO A QUESTION A SHIPLESS WORLD NEVER
          ASKED. D170, owner report: *"Gemim yok ama focus sheet'te 'yetişemezsin'
          diyor. Gemim yok zaten nasıl yetişeyim."*

          `reach` is null for two entirely different reasons — nothing here can
          make the window, or there is nothing here at all — and printing the same
          red "unreachable" for both told a commander their fleet was too slow when
          what they actually needed was a fleet. It also contradicted the button
          directly underneath, which was already saying the true thing.

          So the figure states the reason it is empty, in the same ladder the
          button uses, and it is only a THREAT when the answer really is about
          speed. Missing craft is a gap to close, not a race that was lost.
        */}
        <Figure
          label={t('trade.reachLabel')}
          value={reach !== null
            ? duration(reach)
            : carriersAway
              ? t('trade.reachCarriersAway')
              : !hasCraft
                ? t('trade.reachNoCraft')
                : !hasCarrier
                  ? t('trade.reachNoCarrier')
                  : t('trade.reachNone')}
          tone={reach === null && hasCraft && hasCarrier ? 'threat' : undefined}
        />
      </div>

      <p className="gk-sub">{t('trade.boundary')}</p>
      </div>
    </Shell>
  );
}

/** The three substances, in the order every surface in the game lists them. */
const TRADE_RESOURCES = ['alloy', 'crystal', 'deuterium'] as const;


/* ── your own craft, in transit ──────────────────────────────── */

export function RunFocus({
  run,
  rock,
  wreck,
  minutesRemaining,
  onClose,
  open,
  onToggle,
  onRecall,
  recalling = false,
  above,
}: {
  run: MiningRun;
  rock: AsteroidView | undefined;
  /** The wreck field, on a harvest. Named where the rock would be. */
  wreck: { planetName: string | undefined; minutesLeft: number } | undefined;
  minutesRemaining: number;
  onClose: () => void;
  open: boolean;
  onToggle: () => void;
  onRecall?: () => void;
  recalling?: boolean;
  /** Over the closed card (`Shell`). */
  above?: ReactNode;
}) {
  const { t } = useTranslation();
  const returning = run.status === 'returning';
  const salvage = run.targetKind === 'debris';
  const now = useNow(1000);
  const arriveAt = returning ? (run.homeAt ?? run.arriveAt) : run.arriveAt;
  const remainingMs = arriveAt.getTime() - now;
  const recallable = run.status === 'outbound' && run.recalledAt === null && run.arriveAt.getTime() > now;

  return (
    <Shell
      above={above}
      glyph="mine"
      tone="self"
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
      actions={recallable && onRecall ? (
        // Once, and never undone, but nothing spent: the kit's light hold (owner 2026-11-14, 0.6 s).
        <div className="gk-focus__wide">
          <GameHold weight="reversible" size="md" tone="steel" glyph="recall" label={t('pendingStrip.recallProspectors')}
            disabledReason={recalling ? t('pendingStrip.recallingProspectors') : null} onCommit={onRecall} />
        </div>
      ) : undefined}
    >
      <div className="gk-fbody">
      <div className="gk-well gk-figures gk-figures--well gk-figures--two">
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
        <p className="gk-inote" data-tone="self"><Glyph id="crate" />
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
        <p className="gk-sub">
          {t('focus.run.salvageNote', {
            clock: wreck ? t('focus.run.salvageClock', { duration: duration(wreck.minutesLeft) }) : '',
          })}
        </p>
      ) : (
        <p className="gk-sub">{t('focus.run.miningNote')}</p>
      )}
      </div>
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
  onFocusMonument,
  onRecall,
  recalling = false,
  above,
}: {
  thread: PendingThread;
  minutesRemaining: number;
  onClose: () => void;
  open: boolean;
  onToggle: () => void;
  onFocusMonument?: (monumentId: string) => void;
  onRecall?: () => void;
  recalling?: boolean;
  /** Over the closed card (`Shell`). */
  above?: ReactNode;
}) {
  const { t } = useTranslation();
  const tMoon = useMoonT();
  const say = useToast();
  const galaxy = useGalaxy();
  const retarget = useRetargetMission();
  const composition = thread.fleet ? describeThreadFleet(thread.fleet) : null;
  const now = useNow(1000);
  const remainingMs = thread.arriveAt.getTime() - now;
  const recallable = thread.recallable === true && thread.id !== undefined
    && thread.kind !== 'incoming' && thread.leg !== 'return' && remainingMs > 0;
  const targetWorld = thread.targetPlanetId
    ? galaxy.data?.planets.find((w) => w.id === thread.targetPlanetId)
    : undefined;
  const targetHasMoon = thread.targetPlanetId !== undefined
    && (galaxy.data?.moons?.list.some((m) => m.planetId === thread.targetPlanetId) ?? false);
  const canRetarget = thread.kind === 'fleet' && thread.leg !== 'return' && thread.id !== undefined
    && targetHasMoon && targetWorld?.kind !== 'NEUTRAL' && remainingMs > 0;
  const currentBody: WorldBody = thread.targetBody ?? 'PLANET';
  const titleBase = thread.kind === 'trade' ? t('trade.title') : thread.targetName;
  const titleText = thread.targetBody === 'MOON' ? `${titleBase} · ${tMoon('body.MOON')}` : titleBase;

  return (
    <Shell
      above={above}
      glyph={thread.kind === 'probe' ? 'eye' : 'rocket'}
      tone="self"
      eyebrow={t(
        thread.kind === 'probe'
          ? thread.leg === 'return'
            ? 'focus.thread.eyebrowProbeHome'
            : 'focus.thread.eyebrowProbeOut'
          : thread.leg === 'return'
            ? 'focus.thread.eyebrowFleetHome'
            : 'focus.thread.eyebrowFleetOut',
      )}
      title={titleText}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      peek={thread.admiral ? <FlightEscort admiral={thread.admiral} /> : undefined}
      summary={<span>{countdown(remainingMs)}</span>}
      actions={(recallable && onRecall) || canRetarget ? (
        <div className="gk-focus__wide flex flex-col gap-2">
          {canRetarget && thread.id && (
            <RetargetButton
              missionId={thread.id}
              currentBody={currentBody}
              disabled={retarget.isPending}
              onRetarget={(missionId, body) => {
                retarget.mutate({ missionId, body }, {
                  onSuccess: (res) => {
                    say(tMoon(res.targetBody === 'MOON' ? 'body.retargetedToMoon' : 'body.retargetedToPlanet'));
                  },
                  onError: (err) => { say(describe(err), 'error'); },
                });
              }}
            />
          )}
          {recallable && onRecall && (
            <GameHold weight="reversible" size="md" tone="steel" glyph="recall" label={t('pendingStrip.recallFleet')}
              disabledReason={recalling ? t('pendingStrip.recallingFleet') : null} onCommit={onRecall} />
          )}
        </div>
      ) : undefined}
    >
      <div className="gk-fbody">
      <div className="gk-well gk-figures gk-figures--well gk-figures--two">
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

      {thread.admiral && <FlightEscort admiral={thread.admiral} />}

      {composition && thread.fleet && <CrewChips entries={fleetEntries(thread.fleet)} />}

      {/*
        WHAT IS TRUE OF THIS FLIGHT, NOT OF FLIGHTS IN GENERAL. Owner report, 2026-10-06: every
        outbound fleet read "a launched fleet cannot be recalled" — right over the Recall button.
      */}
      <p className="gk-sub">
        {t(thread.leg === 'return'
          ? 'focus.thread.returning'
          : recallable
            ? thread.kind === 'monument' ? 'monument.recallFlightRule' : 'focus.thread.recallable'
            : thread.kind === 'pirate' ? 'focus.thread.outboundPirate' : 'focus.thread.outbound')}
      </p>
      {thread.monumentId && onFocusMonument && (
        <GameButton size="sm" wide glyph="eye" onPress={() => { if (thread.monumentId) onFocusMonument(thread.monumentId); }}>
          {t('monument.look', { name: thread.targetName })}
        </GameButton>
      )}
      </div>
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
      title={contact.scout ? t('starter.contact.scout') : contact.kind === 'fleet' && exactFleet && contact.clanFleet
        ? contact.clanFleet.label
        : t(battle ? 'focus.contact.titleBattle' : CONTACT_TITLE[contact.kind])}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      peek={contact.kind === 'fleet' && !contact.effectOnly && contact.admiral ? <FlightEscort admiral={contact.admiral} /> : undefined}
      summary={
        mining ? (
          <span className="gk-tone-warn">
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
            <span className="gk-tone-hostile">
              {exactCount === null
                ? massLabel ?? t('focus.contact.bombarding')
                : t('focus.contact.craftCount', { count: exactCount })}
            </span>
            <span className="gk-focus__quiet">{t('focus.contact.settling')}</span>
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
            <span className={massLabel || exactCount !== null ? '' : 'gk-focus__quiet'}>
              {exactCount === null
                ? massLabel ?? t('focus.contact.unattributed')
                : t('focus.contact.craftCount', { count: exactCount })}
            </span>
            <span className="gk-focus__quiet">
              {t(contact.inbound === true
                ? 'focus.contact.inboundNoClock'
                : 'focus.contact.arrivalUnknown')}
            </span>
          </>
        )
      }
    >
      <div className="gk-fbody">
      <div className="gk-well gk-figures gk-figures--well gk-figures--two">
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

      {contact.kind === 'fleet' && !contact.effectOnly && contact.admiral && <FlightEscort admiral={contact.admiral} />}

      {exactEntries.length > 0 && <CrewChips entries={exactEntries} />}

      {/*
        WHERE THE HULL CHIPS USED TO BE. D123.
        Naming the limit in the place that used to hold the answer, because in an
        information game the boundary is itself information — and because a blank
        reads as a bug while a stated absence reads as a price.
      */}
      {unidentified && (
        <p className="gk-sub">{t('focus.contact.unknownHint')}</p>
      )}
      {radarKind !== undefined && (
        <p className="gk-inote" data-tone="self"><Glyph id="target" />
          {t('focus.contact.radarKind', { kind: t(CONTACT_TITLE[radarKind]).toLowerCase() })}
        </p>
      )}
      {massLabel !== null && exactFleet === undefined && !mining && (
        <p className="gk-sub">{t('focus.contact.massHint')}</p>
      )}
      {contact.inbound === true && !battle && (
        <p className="gk-inote" data-tone="hostile"><Glyph id="siren" />{t('focus.contact.inboundHint')}</p>
      )}

      {/*
        THE BOUNDARY, STATED. Knowing exactly what you are NOT being told is the
        thing that sends a player to the Telescope — an absence they cannot see is
        an absence they will not pay to close.
      */}
      <p className="gk-sub">
        {t(
          contact.kind === 'fleet' && exactFleet && contact.clanFleet
            ? 'clanWar.contactBoundary'
            : battle
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
        <p className="gk-sub">{t('focus.contact.telescopeHint')}</p>
      )}
      {battle && (
        <p className="gk-sub">{t('focus.contact.wreckHint')}</p>
      )}
      </div>
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
 * HOW LONG THIS WORLD'S DRILLS ARE STILL RESTING, OR NULL. D183.
 *
 * One statement for both mining rails, because they are the same decision in two
 * costumes and a rest that read differently on each would be two rules. Null the
 * moment the instant is behind us, so the control comes back on the tick rather
 * than on the next refetch.
 */
const restingFor = (readyAt: Date | null, now: number): number | null => {
  if (!readyAt) return null;
  const left = readyAt.getTime() - now;
  return left > 0 ? left : null;
};

interface CraftCooldown { runId: string; craft: number; readyAt: Date }

/** Keep independently launched batches visible without pretending they share a leg. */
function MiningCommitments({ run, lane }: {
  run: TargetMiningRun;
  lane: 'asteroid' | 'debris';
}) {
  const { t } = useTranslation();
  const batches = run.outboundCraft === undefined || run.returningCraft === undefined
    ? [{ count: run.craft, status: run.status }]
    : [
        { count: run.outboundCraft, status: 'outbound' as const },
        { count: run.returningCraft, status: 'returning' as const },
      ].filter((batch) => batch.count > 0);

  // What is already out on this target, in the lane's colour: a rock is mine to work, a wreck a scramble.
  return batches.map((batch) => (
    <p key={batch.status} className="gk-inote gk-focus__wide" data-tone={lane === 'asteroid' ? 'self' : 'warn'}>
      <Glyph id={batch.status === 'returning' ? 'home' : 'rocket'} />
      {t(lane === 'asteroid' ? 'focus.asteroid.working' : 'focus.debris.working', {
        count: batch.count,
        state: t(
          batch.status === 'returning'
            ? lane === 'asteroid'
              ? 'focus.asteroid.stateReturning'
              : 'focus.debris.stateReturning'
            : lane === 'asteroid'
              ? 'focus.asteroid.stateInbound'
              : 'focus.debris.stateInbound',
        ),
      })}
    </p>
  ));
}

/** Derive selectable craft every second; expired batches need no network poll. */
const craftReadiness = (home: number, legacy: Date | null, cooldowns: readonly CraftCooldown[] | undefined, now: number) => {
  if (cooldowns === undefined) return { available: home, resting: restingFor(legacy, now) };
  const view = prospectorAvailability(home,
    cooldowns.map((rest) => ({ craft: rest.craft, readyAtMs: rest.readyAt.getTime() })), now);
  return {
    available: view.available,
    resting: view.available === 0 && view.readyAtMs !== null ? view.readyAtMs - now : null,
  };
};

function CraftRests({ cooldowns, now, lane }: {
  cooldowns: readonly CraftCooldown[] | undefined; now: number; lane: 'asteroid' | 'debris';
}) {
  const { t } = useTranslation();
  return cooldowns?.filter((rest) => rest.readyAt.getTime() > now).map((rest) => (
    <p key={rest.runId} className="gk-inote"><Glyph id="timed" />
      {rest.craft} × {t(lane === 'asteroid' ? 'focus.asteroid.resting' : 'focus.debris.resting', {
        duration: countdown(rest.readyAt.getTime() - now),
      })}
    </p>
  ));
}

/**
 * HOW MANY CRAFT TO COMMIT — and why it has to be a choice.
 *
 * The panel used to send `worthSending`: everything at home, capped at what the
 * target could actually fill. That is the right DEFAULT and it was the wrong
 * BEHAVIOUR, because it silently spent the whole squadron. A player who wants one
 * craft on a rock and one on a wreck field had no way to say so — the first launch
 * took the whole available squadron and the second target was unreachable until they came home.
 *
 * The ceiling is two, or three once Prospector Holds reaches its third rung (D170),
 * so this is a handful of plates and never a stepper — it reads `craftAvailable`
 * rather than the constant, which is why the third berth needed nothing here.
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
  // The kit's plates (G4-h1): the chosen count lit and raised, as every choice in the game.
  const options = Array.from({ length: available }, (_, i) => ({ id: String(i + 1), label: String(i + 1) }));
  return (
    <div className="gk-mine__pick">
      <p className="gk-label">{t('focus.craftPicker.label')}</p>
      <Choices label={t('focus.craftPicker.label')} options={options} value={String(value)}
        onChange={(next) => { onPick(Number(next)); }} />
    </div>
  );
}

/**
 * THE ROOM A HAUL COMES HOME TO (plan F5, N5): always said, quietly when it all fits; in warning
 * when some of it will be lost, with the one fix that helps on the spot — collect first.
 */
function HaulHomeLine({ home, onCollect, storeFull }: { home: HaulHome; onCollect: (() => void) | undefined; storeFull: boolean }) {
  const { t, i18n } = useTranslation();
  // Named by resource: a full crystal store loses crystal however much alloy room there is.
  const short = (['alloy', 'crystal', 'deuterium'] as const).filter((resource) => home.lost[resource] >= 1);
  const lost = short.length > 0;
  const what = new Intl.ListFormat(i18n.language, { type: 'conjunction' })
    .format(short.map((resource) => t(`focus.haul.amount.${resource}`, { value: compact(home.lost[resource]) })));
  return (
    <div data-testid="haul-home" data-lost={lost} className="gk-inote gk-haulhome" {...(lost ? { 'data-tone': 'warn' } : {})}>
      <img src={RESOURCE_ART.alloy} alt="" aria-hidden="true" />
      <p>
        {lost ? t('focus.haul.spill', { room: compact(home.room), what, count: short.length }) : t('focus.haul.fits', { room: compact(home.room) })}
        {/* Collecting into a full store moves nothing: the way out is to spend first. */}
        {lost && !onCollect && storeFull && ` ${t('focus.haul.storeFull')}`}
      </p>
      {lost && onCollect && (
        <GameButton size="sm" glyph="crate" onPress={onCollect}>{t('focus.haul.collectFirst')}</GameButton>
      )}
    </div>
  );
}

export function DebrisFocus({
  field,
  planetName,
  craftAvailable: craftAtHome,
  craftHold,
  reachMinutes: reach,
  atHome,
  onCollect,
  storeFull = false,
  run,
  craftReadyAt,
  craftCooldowns,
  launchBlock,
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
  /** What the works will hold for this haul when the craft land (see `AsteroidFocus`). */
  atHome: (haul: { alloy: number; crystal: number; deuterium: number }) => HaulHome | null;
  onCollect?: (() => void) | undefined;
  storeFull?: boolean;
  run: TargetMiningRun | undefined;
  /** Legacy fallback only; new servers publish the independent landed batches. */
  craftReadyAt: Date | null;
  craftCooldowns?: readonly CraftCooldown[];
  launchBlock?: LaunchFault;
  onSend: (craft: number) => void;
  onClose: () => void;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const { available: craftAvailable, resting } = craftReadiness(craftAtHome, craftReadyAt, craftCooldowns, now);
  const left = field.alloy + field.crystal + field.deuterium;
  const canCarry = craftHold * craftAvailable;
  const worthSending = Math.max(
    1,
    Math.min(craftAvailable, Math.ceil(left / Math.max(1, craftHold))),
  );
  // Unknown is not "too late": the craft's speed or the home world may still be loading.
  const measuring = reach === null;
  const tooLate = reach !== null && reach >= field.minutesLeft;
  const [craft, setCraft] = useState(worthSending);
  const sending = Math.min(Math.max(1, craft), Math.max(1, craftAvailable));
  useEffect(() => {
    setCraft(worthSending);
  }, [worthSending]);
  // Split as the field holds it, since each resource lands against its own ceiling.
  const bringing = Math.min(craftHold * sending, left);
  const home = bringing > 0 && left > 0 ? atHome({
    alloy: bringing * (field.alloy / left), crystal: bringing * (field.crystal / left), deuterium: bringing * (field.deuterium / left),
  }) : null;

  return (
    <Shell
      glyph="debris"
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
            components={[<span key="n" className="gk-tone-warn" />]}
          />
          {' · '}
          <span className={field.minutesLeft < 30 ? 'gk-tone-hostile' : ''}>
            {duration(field.minutesLeft)}
          </span>
        </span>
      }
      actions={
        <>
        {run && <MiningCommitments run={run} lane="debris" />}
          <GameButton tone="action" wide glyph="debris" className="gk-focus__wide" marks={{ 'data-primary': '' }}
            pending={busy}
            disabledReason={launchBlock !== undefined
              ? t(`faults.launchBlock.${launchBlock}`)
              : resting !== null
                ? t('focus.debris.resting', { duration: countdown(resting) })
                : craftAvailable < 1
                  ? t('focus.debris.noCraft')
                  : measuring
                    ? t('focus.debris.measuring')
                    : tooLate ? t('focus.debris.tooLate') : null}
            onPress={() => { onSend(sending); }}>
            {/* with no reach the press is refused and its reason is the label */}
            {reach === null ? null : t('focus.debris.send', { count: sending, duration: duration(reach) })}
          </GameButton>
        </>
      }
    >
      <div className="gk-mine">
        <CraftPicker available={craftAvailable} value={sending} onPick={setCraft} />
        <CraftRests cooldowns={craftCooldowns} now={now} lane="debris" />

        <div className="gk-well gk-figures gk-figures--well gk-figures--two">
          <Figure label={t('focus.debris.alloyLeft')} value={compact(field.alloy)} tone="alloy" />
          <Figure label={t('focus.debris.crystalLeft')} value={compact(field.crystal)} tone="crystal" />
          {field.deuterium > 0 && <Figure label={t('focus.debris.deuteriumLeft')} value={compact(field.deuterium)} tone="opportunity" />}
          <Figure label={t('focus.debris.goneIn')} value={duration(field.minutesLeft)} tone={field.minutesLeft < 30 ? 'threat' : undefined} />
          <Figure label={t('focus.debris.yourHold')} value={compact(canCarry)} />
        </div>

        {home && !run && <HaulHomeLine home={home} onCollect={onCollect} storeFull={storeFull} />}

        <p className="gk-sub gk-mine__notes">{t('focus.debris.body')}</p>
      </div>
    </Shell>
  );
}

/**
 * A CREW, HULL BY HULL, ON KIT CHIPS (G4-h2): the hull's mark, its name, the count.
 *
 * THE NAME IS DRAWN, BECAUSE A PHONE HAS NO HOVER (owner instruction): the name says what,
 * the number says how many, and they are not the same question — so the count is the figure
 * the eye lands on and the name a label beside it.
 */
function CrewChips({ entries }: { entries: readonly (readonly [HullId, number])[] }) {
  return (
    <ul className="gk-crew">
      {entries.map(([hull, count]) => (
        <li key={hull} data-crew-hull={hull} className="gk-crew__hull">
          <HullMark hull={hull} className="gk-crew__mark" />
          <span data-crew-name className="gk-crew__name">{hullLabel(hull)}</span>
          <span className="gk-num gk-crew__count">{count}</span>
        </li>
      ))}
    </ul>
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
  radiation_bomb: 'planet.radiationBomb.title',
  pirate: 'focus.contact.titlePirate',
} as const satisfies Record<Contact['kind'], string>;

/* ── shared ──────────────────────────────────────────────────── */

function Figure({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: string;
  // `alloy` since D32: a wreck field is priced in both metals, and showing the two
  // piles in the palette the whole game uses for them is what makes it readable at
  // a glance as "salvage" rather than as an abstract number.
  tone?: 'crystal' | 'alloy' | 'opportunity' | 'threat';
  /** A handle for the one figure a test needs to find among several. */
  testId?: string;
}) {
  const kitTone = tone === 'alloy' ? 'warn' : tone === 'threat' ? 'hostile' : tone === undefined ? undefined : 'self';
  return (
    <div className="gk-figure" {...(testId ? { 'data-testid': testId } : {})}>
      <span className="gk-label">{label}</span>
      <span className="gk-num gk-figure__value" {...(kitTone ? { 'data-tone': kitTone } : {})}>{value}</span>
    </div>
  );
}

/** Minutes a rock has left in the disc, from the season clock. */
export const minutesLeftFor = (rock: AsteroidView, seasonStart: Date, now: number): number =>
  Math.max(0, rock.expiresAt - (now - seasonStart.getTime()) / 60_000);
