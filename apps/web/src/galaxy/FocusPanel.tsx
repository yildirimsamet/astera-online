import { GameActions } from '../session/seasonLock.js';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import {
  DEATH_STAR,
  MULTI_WORLD,
  SETTLEMENT_CLAIM_MINUTES,
  PROBE,
  distance,
  fleetCount,
  fleetTravelExact,
  telescopeSlots,
  travelExact,
  type HullId,
} from '@astera/rules';
import type {
  AsteroidView,
  BattleReport,
  Contact,
  GalaxyPlanet,
  IntelView,
  MiningRun,
  PendingThread,
  PlanetView,
  RivalSummary,
} from '../api/schemas.js';
import { useProbe, useSetRival, useWatch } from '../api/queries.js';
import { hullLabel, hullName, satelliteLabel } from '../i18n/names.js';
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
import { AttackIcon, EyeIcon } from '../ui/icons/index.js';
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
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          {...toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
            <div className="px-4 py-3">{children}</div>
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
              <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-line-soft bg-void/95 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
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
  return (
    <div className="rounded-chip border border-dashed border-line px-3 py-2">
      <div className="flex items-baseline gap-2">
        <p className="legend">{label}</p>
        <span className="legend ml-auto shrink-0">
          {t('focus.unknown')}
        </span>
      </div>
      <p className="mt-1 text-body text-alloy">{missing}</p>
      <p className="mt-1 text-label leading-snug text-dim">{why}</p>
      {blocked && <p className="mt-1 text-label leading-snug text-threat">{blocked}</p>}
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
  rival,
  isRival = false,
  rivalCommitted = false,
  now,
  onClose,
  onAttack,
  onSettle,
  onDeathStar,
  onTransfer,
  onInstallTelescope,
  onLaunched,
  open,
  onToggle,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  intel: IntelView | undefined;
  reports: readonly BattleReport[];
  rival?: RivalSummary;
  isRival?: boolean;
  rivalCommitted?: boolean;
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
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const setRival = useSetRival();
  const say = useToast();
  const read = dossier({ target, planet, intel, reports, ...(rival ? { rival } : {}), now });
  const reach = reachMinutes(planet.planet.position, target.position, planet.fleet);
  const away = target.fleet?.status === 'AWAY';
  const known = headline(read, target);
  const originRecovering = Boolean(
    planet.planet.recoveryUntil && planet.planet.recoveryUntil.getTime() > now,
  );
  const claimUntil = target.kind === 'NEUTRAL' ? target.neutral?.claimUntil : null;
  const claimActive = Boolean(claimUntil && claimUntil.getTime() > now);
  const settlementEta = fleetTravelExact(
    distance(planet.planet.position, target.position),
    { HAULER: MULTI_WORLD.settlement.haulers },
  );
  const settlementCanArrive = Boolean(
    claimUntil && now + settlementEta * 60_000 < claimUntil.getTime(),
  );
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
        : (planet.fleet.HAULER ?? 0) < MULTI_WORLD.settlement.haulers
          ? t('focus.planet.settleNeedHauler')
          : planet.planet.alloy < MULTI_WORLD.settlement.cost.alloy
            ? t('focus.planet.settleNeedAlloy')
            : planet.planet.crystal < MULTI_WORLD.settlement.cost.crystal
              ? t('focus.planet.settleNeedCrystal')
              : !settlementCanArrive
                ? t('focus.planet.settleTooLate')
                : null;
  const settlementReady = claimActive && settlementBlock === null;
  const captureAttempt = target.kind !== 'CAPITAL' && target.state?.kind === 'RECOVERY';
  const deathStarEta = travelExact(
    distance(planet.planet.position, target.position),
    DEATH_STAR.speed,
  );
  const recoveryCanArrive = !captureAttempt
    || (target.state?.kind === 'RECOVERY'
      && now + deathStarEta * 60_000 < target.state.until.getTime());
  const deathStarReady = planet.strategic?.status === 'READY';
  const deathStarBlock = !deathStarReady
    ? t('focus.planet.deathStarUnavailable')
    : target.state?.kind === 'PROTECTED'
      ? t('focus.planet.deathStarProtected')
      : originRecovering
        ? t('focus.planet.deathStarOriginRecovering')
        : !flightBayOpen
          ? t('focus.planet.deathStarNeedBay')
          : !recoveryCanArrive
            ? t('focus.planet.deathStarTooLate')
            : captureAttempt && !colonySlotOpen
              ? t('focus.planet.deathStarNeedSlot')
              : null;
  const deathStarEnabled = deathStarBlock === null;

  return (
    <Shell
      art={<PlanetSigil seed={target.id} size={40} dark={known.kind === 'none'} />}
      eyebrow={t('focus.planet.location', { planet: target.name })}
      title={target.owner}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      summary={(
        <span className="flex flex-col items-end gap-1">
          <WorldKind target={target} rival={isRival} />
          <Headline of={known} />
        </span>
      )}
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
        <>
          {target.isOwned ? (
            <button
              type="button"
              className="slab slab-primary basis-full"
              disabled={originRecovering}
              onClick={onTransfer}
            >
              {t('focus.planet.transfer')}
            </button>
          ) : (
          <>
          {target.kind !== 'NEUTRAL' && (
          <button
            type="button"
            className={`slab slab-ghost min-w-[8rem] flex-1 whitespace-normal px-3 leading-tight ${isRival ? 'text-alloy' : ''}`}
            disabled={setRival.isPending || rivalCommitted}
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
            {t(rivalCommitted
              ? 'focus.planet.rivalCommittedAction'
              : isRival ? 'focus.planet.rivalMarkedAction' : 'focus.planet.markRival')}
          </button>
          )}
          {onSettle && target.kind === 'NEUTRAL' && claimActive && (
            <button
              type="button"
              className="slab slab-primary min-w-[8rem] flex-1 whitespace-normal px-3 leading-tight"
              disabled={!settlementReady}
              onClick={onSettle}
            >
              {settlementBlock ?? t('focus.planet.settle')}
            </button>
          )}
          {onDeathStar && (
            <button
              type="button"
              className="slab slab-commit basis-full whitespace-normal px-3 leading-tight"
              disabled={!deathStarEnabled}
              onClick={onDeathStar}
            >
              {deathStarBlock ?? t(captureAttempt
                ? 'focus.planet.deathStarCapture'
                : 'focus.planet.deathStarStrike')}
            </button>
          )}
          {target.kind === 'NEUTRAL' || read.inBand ? <button
            type="button"
            // Marked so a surface outside this panel can point at the commitment.
            // The onboarding opens exactly this path and refuses the rest of the
            // rail, because nothing else on it is affordable out of the opening
            // grant — a probe alone needs crystal the mandatory upgrades spent.
            data-attack
            className="slab slab-commit basis-full whitespace-normal px-3 leading-tight"
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
            <AttackIcon className="size-[18px] shrink-0" />
            {t(originRecovering
              ? 'focus.planet.attackOriginRecovering'
              : target.kind === 'NEUTRAL' && claimActive
                ? 'focus.planet.attackNeutralAgain'
                : 'focus.planet.attack')}
          </button> : (
          <span className="slab slab-ghost basis-full cursor-default whitespace-normal px-3 text-center leading-tight opacity-60">
            {t('focus.planet.outOfBand', {
              tier: target.coreTier,
              low: read.band.low,
              high: read.band.high,
            })}
          </span>
          )}
          </>
          )}
        </>
      }
    >
      <StrategicWorldGuide
        target={target}
        planet={planet}
        now={now}
        colonySlotOpen={colonySlotOpen}
        flightBayOpen={flightBayOpen}
        settlementEta={settlementEta}
        settlementCanArrive={settlementCanArrive}
        claimActive={claimActive}
        deathStarEta={deathStarEta}
        isRival={isRival}
      />
      {away && (
        <p className="mb-3 rounded-chip border border-opportunity/40 bg-opportunity/10 px-3 py-2 text-body text-opportunity">
          {t('focus.planet.windowOpen')}
        </p>
      )}

      <div className="mb-3 grid grid-cols-3 gap-3">
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
                observerPlanetId={planet.planet.id}
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

function Requirement({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={`flex min-h-7 items-center gap-2 rounded-chip border px-2 text-micro ${ ok ? 'border-opportunity/35 bg-opportunity/10 text-opportunity' : 'border-alert/35 bg-alert/10 text-threat-ink' }`}>
      <span aria-hidden className="text-micro">{ok ? '●' : '○'}</span>
      {children}
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
function StrikeEffects({ capturable }: { capturable: boolean }) {
  const { t } = useTranslation();
  const lines = [
    t('focus.planet.strikeFleet'),
    t('focus.planet.strikeStock'),
    t('focus.planet.strikeCore'),
    t('focus.planet.strikeAegis', { levels: DEATH_STAR.aegisLevelsLost }),
    t('focus.planet.strikeDark', { duration: duration(MULTI_WORLD.recoveryMinutes) }),
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
  claimActive,
  deathStarEta,
  isRival,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  now: number;
  colonySlotOpen: boolean;
  flightBayOpen: boolean;
  settlementEta: number;
  settlementCanArrive: boolean;
  claimActive: boolean;
  deathStarEta: number;
  isRival: boolean;
}) {
  const { t } = useTranslation();
  const standing = planet.colonies;

  if (target.isOwned) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-chip border border-crystal/35 bg-crystal/8 px-3 py-3">
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
    const recovery = target.state?.kind === 'RECOVERY' ? target.state : null;
    return (
      <div className={`mb-3 rounded-chip border px-3 py-3 ${ recovery ? 'border-alert/55 bg-alert/12' : 'border-crystal/30 bg-crystal/8' }`}>
        <div className="flex items-center gap-3">
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

  if (target.kind === 'NEUTRAL') {
    const until = target.neutral?.claimUntil;
    const hauler = (planet.fleet.HAULER ?? 0) >= MULTI_WORLD.settlement.haulers;
    const alloy = planet.planet.alloy >= MULTI_WORLD.settlement.cost.alloy;
    const crystal = planet.planet.crystal >= MULTI_WORLD.settlement.cost.crystal;
    return (
      <div className={`mb-3 rounded-chip border px-3 py-3 ${
        claimActive ? 'border-opportunity/50 bg-opportunity/10' : 'border-line-soft bg-deep/65'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`legend ${ claimActive ? 'text-opportunity' : 'text-bone' }`}>
            {t(claimActive ? 'focus.planet.claimOpen' : 'focus.planet.colonyRoute')}
          </p>
          {standing && (
            <span className={`num text-micro ${colonySlotOpen ? 'text-opportunity' : 'text-threat-ink'}`}>
              {t('focus.planet.colonySlots', {
                used: standing.colonies + standing.reservations,
                total: standing.capacity,
              })}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1 text-center">
          <RouteStep active={!claimActive} number="1" label={t('focus.planet.routeRaid')} />
          <span className="text-faint">→</span>
          <RouteStep active={claimActive} number="2" label={t('focus.planet.routeClaim')} />
          <span className="text-faint">→</span>
          <RouteStep active={claimActive} number="3" label={t('focus.planet.routeSettle')} />
        </div>
        {claimActive && until && (
          <p className="num mt-2 text-center text-body text-opportunity">
            {t('focus.planet.claimCloses', { duration: duration((until.getTime() - now) / 60_000) })}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Requirement ok={colonySlotOpen}>{t('focus.planet.openColonySlot')}</Requirement>
          <Requirement ok={flightBayOpen}>{t('focus.planet.openFlightBay')}</Requirement>
          <Requirement ok={hauler}>{t('focus.planet.haulerCount')}</Requirement>
          <Requirement ok={alloy}>
            <img src={RESOURCE_ART.alloy} alt="" aria-hidden className="size-3.5 object-contain" />
            {compact(MULTI_WORLD.settlement.cost.alloy)}
          </Requirement>
          <Requirement ok={crystal}>
            <img src={RESOURCE_ART.crystal} alt="" aria-hidden className="size-3.5 object-contain" />
            {compact(MULTI_WORLD.settlement.cost.crystal)}
          </Requirement>
          <Requirement ok={claimActive ? settlementCanArrive : settlementEta < SETTLEMENT_CLAIM_MINUTES}>
            {t('focus.planet.arrivesIn', { duration: duration(settlementEta) })}
          </Requirement>
        </div>
        {claimActive && (
          <div className="mt-2 grid gap-1 border-t border-opportunity/20 pt-2 text-label leading-snug text-dim">
            <p className="flex items-start gap-2">
              <AttackIcon className="mt-1 size-3.5 shrink-0 text-alloy" />
              <span>{t('focus.planet.claimRaidStillOpen')}</span>
            </p>
            <p className="flex items-start gap-2">
              <span aria-hidden className="mt-px shrink-0 text-alert">◆</span>
              <span>{t('focus.planet.claimDeathStarConsequence', {
                duration: duration(MULTI_WORLD.recoveryMinutes),
              })}</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  const recovery = target.state?.kind === 'RECOVERY' ? target.state : null;
  const protectedState = target.state?.kind === 'PROTECTED' ? target.state : null;
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
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <RouteStep
            active={!recovery}
            number="1"
            label={t('focus.planet.firstImpact', {
              duration: duration(MULTI_WORLD.recoveryMinutes),
            })}
            danger
          />
          <span className="text-threat-ink">→</span>
          <RouteStep active={Boolean(recovery)} number="2" label={t('focus.planet.secondImpact')} danger />
        </div>
      )}
      {/* A capital never reaches this guide — it returns above — so the second
          impact here is always the capture route. */}
      {!protectedState && <StrikeEffects capturable />}
      {recovery && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Requirement ok={colonySlotOpen}>{t('focus.planet.openColonySlot')}</Requirement>
          <Requirement ok={planet.strategic?.status === 'READY'}>{t('focus.planet.deathStarReadyRequirement')}</Requirement>
          <Requirement ok={now + deathStarEta * 60_000 < recovery.until.getTime()}>
            {t('focus.planet.arrivesIn', { duration: duration(deathStarEta) })}
          </Requirement>
        </div>
      )}
    </div>
  );
}

function RouteStep({
  active,
  number,
  label,
  danger = false,
}: {
  active: boolean;
  number: string;
  label: string;
  danger?: boolean;
}) {
  const tone = active ? (danger ? 'text-threat-ink' : 'text-opportunity') : 'text-faint';
  return (
    <span className={tone}>
      <span className="mx-auto grid size-7 place-items-center rounded-full border border-current text-micro">{number}</span>
      <span className="legend mt-1 block">{label}</span>
    </span>
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
  onLaunched,
}: {
  gap: Gap;
  target: GalaxyPlanet;
  telescope: number;
  observerPlanetId: string;
  intel: IntelView | undefined;
  onInstallTelescope: () => void;
  /** Called with the target's name once a probe is away, so the disc can follow it. */
  onLaunched: (targetName: string) => void;
}) {
  const { t } = useTranslation();
  const watch = useWatch();
  const probe = useProbe();
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

  if (gap.closes === 'probe') {
    return (
      <button
        type="button"
        className="slab slab-primary w-full whitespace-normal px-3 leading-tight"
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
        <EyeIcon className="size-[18px] shrink-0" />
        {t('focus.planet.sendProbe', {
          alloy: compact(PROBE.alloy),
          crystal: compact(PROBE.crystal),
        })}
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
 * Its trajectory, remaining ore and anomaly signature are public because the race
 * only means something if everyone can see it. Spectrometry alone reveals the
 * isotope mix and permits launch. The two lines that decide whether to go are the
 * ore left and the time left, so they lead.
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
  const { t } = useTranslation();
  const crystal = Math.round(rock.crystalShare * 100);
  const deuterium = Math.round((rock.deuteriumShare ?? 0) * 100);
  const needsSpectrometry = rock.isotopeRich && rock.deuteriumShare === null;
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
      title={t('focus.asteroid.title', { index: rock.index })}
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
            className="slab slab-primary basis-full whitespace-normal px-3 leading-tight"
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

      <div className="grid grid-cols-2 gap-3">
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
      summary={<span>{duration(minutesRemaining)}</span>}
    >
      <div className="grid grid-cols-2 gap-3">
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
      summary={<span>{duration(minutesRemaining)}</span>}
    >
      <div className="grid grid-cols-2 gap-3">
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
  const { t } = useTranslation();
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
      eyebrow={t(
        battle
          ? 'focus.contact.eyebrowBattle'
          : salvage
            ? 'focus.contact.eyebrowSalvage'
            : mining
              ? 'focus.contact.eyebrowMining'
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
              {total > 0
                ? t('focus.contact.craftCount', { count: total })
                : t('focus.contact.bombarding')}
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
            <span className={total > 0 ? '' : 'text-faint'}>
              {total > 0
                ? t('focus.contact.craftCount', { count: total })
                : t('focus.contact.unattributed')}
            </span>
            <span className="block text-label text-faint">
              {t('focus.contact.arrivalUnknown')}
            </span>
          </>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Figure
          label={t('focus.contact.craftLabel')}
          value={
            mining
              ? String(contact.craft ?? 0)
              : total > 0
                ? String(total)
                : t('focus.contact.craftUnknown')
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

      {hulls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hulls.map(([hull, n]) => (
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
            className="slab slab-primary basis-full whitespace-normal px-3 leading-tight"
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

      <div className="grid grid-cols-2 gap-3">
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
  fleet: 'focus.contact.titleFleet',
  probe: 'focus.contact.titleProbe',
  mining: 'focus.contact.titleMining',
  harvest: 'focus.contact.titleHarvest',
  death_star: 'focus.contact.titleDeathStar',
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
