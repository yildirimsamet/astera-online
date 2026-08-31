import type { ReactNode } from 'react';
import i18n from '../i18n/index.js';
import { compact, decimal } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import {
  AttackIcon,
  BuildIcon,
  CargoIcon,
  ClaimIcon,
  HullIcon,
  InstallIcon,
  LockIcon,
  RaiseIcon,
  SendIcon,
  SpeedIcon,
  UnlockIcon,
} from './icons/index.js';
import { RESOURCE_ART } from './assets.js';

/**
 * The painted resource renders, not the line glyphs.
 *
 * The icon set's rule is "icons carry shape, the interface carries colour", which
 * is right for instruments and verbs. Alloy and Crystal are different: they are
 * the two most-shown objects in the game, they have finished art, and the owner's
 * direction is that the art should be in front. A price is exactly where a player
 * wants to recognise a substance at a glance rather than parse a symbol.
 */
function Mark({
  of,
  className = 'size-4',
}: {
  of: 'alloy' | 'crystal' | 'deuterium';
  /** Sized by the caller where it stands beside icons that grow, as in `StatStrip`. */
  className?: string;
}) {
  return (
    <img
      src={RESOURCE_ART[of]}
      alt=""
      aria-hidden
      className={`${className} shrink-0 object-contain`}
    />
  );
}

/**
 * ONE CONTROL, FOUR STATES, AND THE STATE IS VISIBLE.
 *
 * `interface.md` I1 opens by saying every item in a progression system is in
 * exactly one of four states — owned, affordable, unaffordable, locked — and that
 * "the standard failure is rendering the last two identically, or rendering all
 * four identically". This interface was committing the second version of that
 * failure: RAISE, BUILD and INSTALL were the same grey slab whether you could
 * afford them, whether you were three thousand alloy short, or whether the thing
 * needed a building you had not built. The owner's note was exact — *"basılabilir
 * mi basılamaz mı belli değil"*.
 *
 * So the button now carries three things a word alone cannot:
 *
 *   · THE VERB, as a shape. Raising something that exists, adding a new unit,
 *     seating a part in a socket and taking a haul home are four different acts,
 *     and an icon distinguishes them before the label is read.
 *   · AFFORDABILITY, as weight. Ready is filled and bright; short is an outline
 *     with the shortfall named in resource icons, never a dead grey rectangle.
 *   · A PREREQUISITE, as a door. Locked shows a lock and the requirement, and
 *     pressing it takes you to the thing that satisfies it — I1's "the
 *     requirement is a button", not a sign.
 */

export type Verb = 'raise' | 'build' | 'install' | 'claim' | 'send';

const VERB_ICON: Record<Verb, (props: { className?: string }) => ReactNode> = {
  raise: RaiseIcon,
  build: BuildIcon,
  install: InstallIcon,
  claim: ClaimIcon,
  send: SendIcon,
};

/**
 * The word on the button, as a KEY.
 *
 * A table of finished strings would be built once at module load and would still
 * be in the old language after the switcher was pressed — the same trap every
 * other `Record<..., string>` of copy in this codebase had.
 */
const VERB_LABEL = {
  raise: 'action.verbRaise',
  build: 'action.verbBuild',
  install: 'action.verbInstall',
  claim: 'action.verbClaim',
  send: 'action.verbSend',
} as const satisfies Record<Verb, string>;

export interface Shortfall {
  alloy: number;
  crystal: number;
  deuterium: number;
}

export function ActionButton({
  verb,
  cost,
  held,
  blocked,
  completed,
  onAct,
  pending = false,
  label,
  full = false,
}: {
  verb: Verb;
  cost: { alloy: number; crystal: number; deuterium?: number };
  held: { alloy: number; crystal: number; deuterium?: number };
  /** A prerequisite that is not met. Takes precedence over affordability. */
  blocked?: { reason: string; onFix?: () => void };
  /** Terminal success state; never represented as a prerequisite lock. */
  completed?: string;
  onAct: () => void;
  pending?: boolean;
  /** Overrides the verb's own word, where the row needs something specific. */
  label?: string;
  full?: boolean;
}) {
  const Icon = VERB_ICON[verb];
  const short = {
    alloy: Math.max(0, cost.alloy - held.alloy),
    crystal: Math.max(0, cost.crystal - held.crystal),
    deuterium: Math.max(0, (cost.deuterium ?? 0) - (held.deuterium ?? 0)),
  };
  const affordable = short.alloy === 0 && short.crystal === 0 && short.deuterium === 0;

  if (completed) {
    return (
      <span
        className={`act act-locked ${full ? 'w-full' : ''}`}
        data-lock-state="open"
        role="status"
      >
        <UnlockIcon className="size-4 shrink-0" />
        <span className="act-word">{completed}</span>
      </span>
    );
  }

  /**
   * LOCKED. Not disabled — pressing it is how you find out what to do about it.
   * A dead control teaches nothing; a door teaches where to go.
   */
  if (blocked) {
    return (
      <button
        type="button"
        onClick={() => {
          haptic('tap');
          blocked.onFix?.();
        }}
        disabled={!blocked.onFix}
        className={`act act-locked ${full ? 'w-full' : ''}`}
        data-lock-state="closed"
      >
        <LockIcon className="size-4 shrink-0" />
        <span className="act-word">{blocked.reason}</span>
        {blocked.onFix && (
          <span aria-hidden className="act-go">
            →
          </span>
        )}
      </button>
    );
  }

  /**
   * SHORT — AND IT SAYS SO IN A WORD.
   *
   * The figure on this button is the SHORTFALL, not the price, and that was the
   * whole problem with it: "⛁ 50" beside an icon reads as "costs 50" in every
   * other place those two marks appear together, so a player who was fifty alloy
   * short believed the thing was cheap and could not work out why the control did
   * nothing. The owner's note was exactly that — the number means the opposite of
   * what it looks like.
   *
   * Two changes fix it, and both are needed. The word SHORT leads, so the figures
   * are read as a deficit rather than a price. And each figure carries a minus, so
   * even at a glance with the label clipped, the sign says which direction it goes.
   * The full price still appears on the row itself, where it belongs.
   */
  if (!affordable) {
    return (
      <button
        type="button"
        disabled
        className={`act act-short ${full ? 'w-full' : ''}`}
        aria-label={shortfallLabel(short)}
        title={shortfallLabel(short)}
      >
        {/*
          TWO LINES: what the state is, then how far off it is.

          One line was the widest thing this control ever had to render — verb icon,
          the word, and two figures — and beside two 48px art wells on a 390px phone
          it ran off the card and was clipped. Stacking costs 12px of height and
          takes about 45% off the width, which is what keeps the last digit of a
          price on screen.
        */}
        <span className="act-need">
          <span className="act-need-word">
            <Icon className="size-3.5 shrink-0 opacity-50" />
            {i18n.t('action.short')}
          </span>
          <span className="act-need-figs">
            {short.alloy > 0 && (
              <span className="act-need-part">
                <Mark of="alloy" />
                &minus;{compact(short.alloy)}
              </span>
            )}
            {short.crystal > 0 && (
              <span className="act-need-part act-need-crystal">
                <Mark of="crystal" />
                &minus;{compact(short.crystal)}
              </span>
            )}
            {short.deuterium > 0 && (
              <span className="act-need-part">
                <Mark of="deuterium" />
                &minus;{compact(short.deuterium)}
              </span>
            )}
          </span>
        </span>
      </button>
    );
  }

  /** READY. The only state that is filled, and the only one that does anything. */
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        haptic('commit');
        onAct();
      }}
      className={`act act-ready ${full ? 'w-full' : ''}`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="act-word">{label ?? i18n.t(VERB_LABEL[verb])}</span>
    </button>
  );
}

/** Said in full for a screen reader, and on hover, where icons cannot carry it. */
function shortfallLabel(short: Shortfall): string {
  const parts: string[] = [];
  if (short.alloy > 0) {
    parts.push(i18n.t('action.shortfallAlloy', { amount: compact(short.alloy) }));
  }
  if (short.crystal > 0) {
    parts.push(i18n.t('action.shortfallCrystal', { amount: compact(short.crystal) }));
  }
  if (short.deuterium > 0) {
    parts.push(i18n.t('action.shortfallDeuterium', { amount: compact(short.deuterium) }));
  }
  return i18n.t('action.shortfallLabel', { parts: parts.join(i18n.t('action.shortfallJoin')) });
}

/* ── combat statistics ───────────────────────────────────────── */

/**
 * THE FOUR NUMBERS THAT DECIDE A FLEET, made scannable.
 *
 * They were four identical grey figures under four identical grey labels, which
 * is a paragraph pretending to be data. Each now has a shape and a fixed hue —
 * attack is the threat colour, hull is bone, speed is crystal, cargo is alloy —
 * so a hull reads as a profile at a glance and two hulls can be compared without
 * reading a single word.
 *
 * The hues are not decoration: they are the same ones the rest of the interface
 * already uses for those ideas, so "the amber number" means the same thing on a
 * ship card as it does in the header.
 */
export function StatStrip({
  atk,
  hp,
  speed,
  cargo,
  fuel,
  size = 'row',
}: {
  atk: number;
  hp: number;
  speed: number;
  cargo: number;
  /**
   * Deuterium this hull burns over `FUEL.reference`, off `hullFuelRate`. T6.
   *
   * A RATE, and the value carries its own span because the row form of this strip
   * renders no labels: `0.1 /1k` says what a bare `0.1` beside a deuterium mark
   * cannot. The launch and transfer sheets quote the CHARGE — this card has no
   * destination to charge against, which is exactly why it quotes a rate instead.
   */
  fuel: number;
  size?: 'row' | 'card';
}) {
  const big = size === 'card';

  return (
    <div className={`stats ${big ? 'stats-card' : ''}`}>
      <Stat
        icon={<AttackIcon className={big ? 'size-5' : 'size-4'} />}
        tone="attack"
        label={i18n.t('action.statAttack')}
        value={atk}
        big={big}
      />
      <Stat
        icon={<HullIcon className={big ? 'size-5' : 'size-4'} />}
        tone="hull"
        label={i18n.t('action.statHull')}
        value={hp}
        big={big}
      />
      <Stat
        icon={<SpeedIcon className={big ? 'size-5' : 'size-4'} />}
        tone="speed"
        label={i18n.t('action.statSpeed')}
        value={speed}
        // A Bastion never moves, and printing "0" invites the reader to think it
        // is slow rather than fixed in place.
        text={speed === 0 ? i18n.t('action.statSpeedFixed') : undefined}
        big={big}
      />
      <Stat
        icon={<CargoIcon className={big ? 'size-5' : 'size-4'} />}
        tone="cargo"
        label={i18n.t('action.statCargo')}
        value={cargo}
        text={cargo === 0 ? i18n.t('action.statCargoNone') : undefined}
        big={big}
      />
      <Stat
        icon={<Mark of="deuterium" className={big ? 'size-5' : 'size-4'} />}
        tone="fuel"
        label={i18n.t('action.statFuel')}
        value={fuel}
        // A gun never leaves the ground, so it has no rate — the same reason the
        // speed beside it says "fixed" rather than nought.
        text={
          fuel <= 0
            ? i18n.t('action.statFuelNone')
            : i18n.t('action.statFuelRate', { value: decimal(fuel) })
        }
        big={big}
      />
    </div>
  );
}

function Stat({
  icon,
  tone,
  label,
  value,
  text,
  big,
}: {
  icon: ReactNode;
  tone: 'attack' | 'hull' | 'speed' | 'cargo' | 'fuel';
  label: string;
  value: number;
  text?: string;
  big: boolean;
}) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-body">
        {big && <span className="legend">{label}</span>}
        <span className="stat-value">{text ?? compact(value)}</span>
      </span>
    </div>
  );
}

/** A price in resource marks. Zero-valued secondary resources are omitted. */
export function Price({
  cost,
  held,
}: {
  cost: { alloy: number; crystal: number; deuterium?: number };
  held?: { alloy: number; crystal: number; deuterium?: number };
}) {
  const shortAlloy = held ? cost.alloy > held.alloy : false;
  const shortCrystal = held ? cost.crystal > held.crystal : false;
  const shortDeuterium = held ? (cost.deuterium ?? 0) > (held.deuterium ?? 0) : false;

  return (
    <span className="price">
      <span className={`price-part ${shortAlloy ? 'price-short' : ''}`}>
        <Mark of="alloy" />
        {compact(cost.alloy)}
      </span>
      {cost.crystal > 0 && (
        <span className={`price-part price-crystal ${shortCrystal ? 'price-short' : ''}`}>
          <Mark of="crystal" />
          {compact(cost.crystal)}
        </span>
      )}
      {(cost.deuterium ?? 0) > 0 && (
        <span className={`price-part ${shortDeuterium ? 'price-short' : ''}`}>
          <Mark of="deuterium" />
          {compact(cost.deuterium ?? 0)}
        </span>
      )}
    </span>
  );
}

/** A resource value, using the same learnt shapes as prices without implying a cost. */
export function ResourceAmounts({
  resources,
  label,
}: {
  resources: { alloy: number; crystal: number; deuterium?: number };
  label: string;
}) {
  return (
    <span className="price" aria-label={label}>
      <span aria-hidden className="contents">
        <span className="price-part">
          <Mark of="alloy" />
          {compact(resources.alloy)}
        </span>
        <span className="price-part price-crystal">
          <Mark of="crystal" />
          {compact(resources.crystal)}
        </span>
        {resources.deuterium !== undefined && (
          <span className="price-part">
            <Mark of="deuterium" />
            {compact(resources.deuterium)}
          </span>
        )}
      </span>
    </span>
  );
}
