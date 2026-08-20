import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Gain } from '../lib/gains.js';

import { haptic } from '../lib/haptics.js';
import { duration } from '../lib/time.js';
import { ActionButton, Price, StatStrip, type Verb } from './Action.js';
import { LockMark } from './marks.js';

/**
 * One decision, presented as a decision.
 *
 * Four rules this component exists to enforce.
 *
 * THE ART CARRIES THE STATE; THE WORDS CARRY THE PROMISE. A locked item is
 * desaturated behind a lock, and its name, its payload and its requirement stay at
 * full strength (interface.md I1). The earlier rule here — that nothing is ever
 * greyed out — was aimed at a real failure, fading a whole row to 45% and deleting
 * the ambition the game runs on. It overcorrected into a screen where a hull you
 * cannot build looks exactly like one you can, and a player concludes they already
 * have everything. Locked must look locked. It must not look dead.
 *
 * THE REQUIREMENT IS A DOOR, NOT A SIGN. "Shipyard L4" is a button that takes you
 * to the Shipyard.
 *
 * THE NEXT LEVEL IS VISIBLE BEFORE IT IS BOUGHT. Where the art changes tier, both
 * are shown, current dimmed and next lit. A tech tree that only shows what you
 * already own is a list of receipts. The whole ladder is one tap further, in the
 * detail sheet.
 *
 * AN UNAFFORDABLE ROW ANSWERS "WHEN", NOT "HOW FAR". This used to be a progress
 * bar reading "Saving for bastion · 40%", and the owner could not tell what it was
 * measuring — which settles it, because a bar that needs explaining is worse than
 * no bar. It was also redundant: the button already names the exact shortfall, so
 * the percentage was the same refusal in a second costume. A TIME is different in
 * kind. It is a fact the player can plan around — come back after dinner, or raise
 * production first — and planning around a wait is the behaviour the game wants.
 */
export interface Blocked {
  /** Short, in the player's terms: "Needs Shipyard L4". */
  reason: string;
  /** Takes the player to the thing that would unblock it. */
  onFix?: () => void;
}

export function UpgradeRow({
  art,
  nextArt,
  mark,
  name,
  level,
  tag,
  role,
  gain,
  cost,
  held,
  income,
  blocked,
  verb,
  actionLabel,
  stats,
  onAct,
  onOpen,
  pending = false,
  highlighted = false,
  flash = false,
}: {
  art?: string | null;
  /** The art one level from now, when it visibly changes. */
  nextArt?: string | null;
  mark?: ReactNode;
  name: string;
  level?: number;
  /**
   * TWO OR THREE WORDS SAYING WHAT THIS IS. Owner request.
   *
   * Sits directly under the name, before any number, because the first question a
   * player has about an unfamiliar card is not "what does the next level cost" —
   * it is "what is this". `role` answers the second question and is a sentence;
   * this answers the first and must never become one.
   */
  tag?: string;
  role: string;
  gain?: Gain;
  cost: { alloy: number; crystal: number };
  held: { alloy: number; crystal: number };
  /** Production rates, so an unaffordable row can say WHEN instead of how far. */
  income?: { alloyPerHour: number; crystalPerHour: number };
  blocked?: Blocked;
  /** Which act this is, so the control can carry its shape. */
  verb: Verb;
  /** Overrides the verb's own word where a row needs something specific. */
  actionLabel?: string;
  /** Hull figures, where the row is a ship. */
  stats?: { atk: number; hp: number; speed: number; cargo: number };
  onAct: () => void;
  /** Opens the full picture. The row is the summary; the sheet is the decision. */
  onOpen?: () => void;
  pending?: boolean;
  highlighted?: boolean;
  /** Set briefly after a successful purchase. */
  flash?: boolean;
}) {
  const { t } = useTranslation();
  const shortAlloy = Math.max(0, cost.alloy - held.alloy);
  const shortCrystal = Math.max(0, cost.crystal - held.crystal);
  const affordable = shortAlloy === 0 && shortCrystal === 0;
  const locked = blocked !== undefined;

  /**
   * How long until this is affordable, at the planet's current rates.
   *
   * The larger of the two waits, since both prices must be met. It assumes the
   * works keep being emptied (D16) — the estimate is a floor, and a player who
   * leaves the collectors full will wait longer than it says.
   *
   * Null when the question has no answer — nothing is being produced — because
   * "affordable in ∞" is worse than saying nothing at all.
   */
  const waitMinutes =
    income && (income.alloyPerHour > 0 || income.crystalPerHour > 0)
      ? Math.max(
          shortAlloy > 0 ? (shortAlloy / Math.max(1, income.alloyPerHour)) * 60 : 0,
          shortCrystal > 0 ? (shortCrystal / Math.max(1, income.crystalPerHour)) * 60 : 0,
        )
      : null;

  return (
    <div
      className={`relative overflow-hidden border-b border-line-soft p-3 last:border-b-0 ${
        highlighted ? 'bg-crystal/10 ring-1 ring-inset ring-crystal/40' : ''
      } ${flash ? 'sweep' : ''}`}
    >
      {/*
        The whole row opens the detail, except where a control sits on top of it.
        A card that only responds on one small chevron is a card players never
        learn is tappable.
      */}
      {onOpen && (
        <button
          type="button"
          aria-label={t('upgradeRow.about', { name })}
          className="absolute inset-0 z-0"
          onClick={() => {
            haptic('tap');
            onOpen();
          }}
        />
      )}

      {/*
        THE NAME GETS THE WHOLE WIDTH.

        It used to share a line with the art, the tier arrow, the next tier's art
        and the button, and on a 390px phone that left it about eighty pixels —
        "COMMAND…", which names nothing. A truncated label is worse than a small
        one: the player cannot tell what they are being sold, and this row exists
        to sell it.

        Everything else on that line has a fixed width and cannot be squeezed, so
        the name was always going to be what gave. Putting it above costs one line
        of height and makes the row read in the order a player asks: what is it,
        what does it look like, what does it cost, what do I press.
      */}
      <div className="pointer-events-none relative z-10 mb-2">
        <div className="flex items-baseline gap-2">
          <h3 className="min-w-0 font-display text-[15px] uppercase tracking-wide text-bone">
            {name}
          </h3>
          {level !== undefined && level > 0 && (
            <span className={`num text-[12px] text-faint ${flash ? 'pop inline-block' : ''}`}>
              L{level}
            </span>
          )}
        </div>
        {/*
          Small and BOLD, at the owner's direction, and deliberately not the same
          grey as the sentence lower down: it has to survive a thumb scrolling past
          at speed, which is the only moment it is ever read.
        */}
        {tag && <p className="mt-0.5 text-[11px] font-semibold leading-snug text-dim">{tag}</p>}
      </div>

      <div className="pointer-events-none relative z-10 flex items-center gap-3">
        <div className="art-well relative flex size-12 shrink-0 items-center justify-center rounded">
          {art ? (
            <img
              src={art}
              alt=""
              aria-hidden
              className={`size-11 object-contain ${locked ? 'opacity-35 grayscale' : ''}`}
              loading="lazy"
            />
          ) : (
            <span className={locked ? 'opacity-35 grayscale' : ''}>{mark}</span>
          )}
          {locked && (
            <span className="absolute inset-0 flex items-center justify-center">
              <LockMark />
            </span>
          )}
        </div>

        {/* The upgrade you are being sold, shown rather than described. */}
        {!locked && nextArt && (
          <>
            <span aria-hidden className="text-[13px] text-faint">
              →
            </span>
            <div className="art-well flex size-12 shrink-0 items-center justify-center rounded ring-1 ring-crystal/30">
              <img
                src={nextArt}
                alt={t('upgradeRow.nextTierAlt', { name })}
                className="size-11 object-contain drop-shadow-[0_0_8px_rgba(111,211,224,0.35)]"
                loading="lazy"
              />
            </div>
          </>
        )}

        {/* Pushes the control to the right edge, where every row's control sits. */}
        <div className="flex-1" />

        {/*
          `data-act` marks THE control this row commits with, so a surface outside
          the row can point at it without knowing how the row is built. The
          onboarding gate (D56) lights exactly one control per beat and refuses
          every other press; a selector reaching in for "the last button" would
          break the first time a row grew a second one.
        */}
        <span data-act className="pointer-events-auto shrink-0">
          <ActionButton
            verb={verb}
            cost={cost}
            held={held}
            {...(blocked ? { blocked } : {})}
            onAct={onAct}
            pending={pending}
            {...(actionLabel ? { label: actionLabel } : {})}
          />
        </span>
      </div>

      {/*
        The payload first, the explanation second.

        "Safe from any raid 300 → 390" is the reason to press the button; the
        sentence underneath is context for a player who wants it. Reading order
        follows decision order.
      */}
      <div className="pointer-events-none relative z-10 mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {gain && (
          <p className="num text-[13px]">
            <span className="text-faint">{gain.label} </span>
            <span className="text-dim">{gain.now}</span>
            <span className="mx-1 text-faint" aria-label={t('upgradeRow.becomes')}>
              →
            </span>
            <span className="text-bone">{gain.next}</span>
          </p>
        )}
        <Price cost={cost} held={held} />
      </div>
      {gain?.unlocks && (
        <p className="pointer-events-none relative z-10 mt-1 text-[11px] text-crystal/80">
          {gain.unlocks}
        </p>
      )}

      {stats && (
        <div className="pointer-events-none relative z-10 mt-2">
          <StatStrip {...stats} />
        </div>
      )}

      <p className="pointer-events-none relative z-10 mt-1.5 text-[12px] leading-snug text-faint">
        {role}
      </p>

      {/*
        WHEN, not how far along.

        This used to be a progress bar reading "Saving for bastion · 40%". The
        owner could not tell what it was measuring, which settles it — a bar that
        needs explaining is worse than no bar, and 40% of a price is not a fact
        anyone can act on. It also duplicated the button, which already names the
        exact shortfall.

        What a player actually wants to know is WHEN. Production is a known rate
        and the gap is a known number, so the answer is a time, and a time is
        something you can plan a session around.
      */}
      {!affordable && !blocked && waitMinutes !== null && (
        <p className="pointer-events-none relative z-10 mt-2 text-[11px] text-faint">
          <Trans
            i18nKey="upgradeRow.affordableIn"
            values={{ duration: duration(waitMinutes) }}
            components={[<span key="n" className="num text-alloy" />]}
          />
        </p>
      )}
    </div>
  );
}

/**
 * A BAND INSIDE A SECTION, WHERE THE CARDS BELOW IT OBEY A DIFFERENT RULE.
 *
 * Not decoration and not a second heading level for its own sake. It exists
 * wherever one surface holds two kinds of thing that a player has to be able to
 * tell apart before choosing — satellites that cost a slot against instruments
 * that do not, warships against the craft that never fight. Those distinctions
 * were carried by a paragraph, and a paragraph between cards is a paragraph nobody
 * reads while scrolling.
 *
 * `note` is the rule in one short clause. If it needs two, the band is wrong.
 */
export function Band({ label, note, aside }: { label: string; note?: string; aside?: ReactNode }) {
  return (
    <div className="border-b border-line-soft bg-void/30 px-3.5 py-2">
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-[11px] uppercase tracking-[0.16em] text-crystal/85">
          {label}
        </h3>
        <span className="h-px flex-1 bg-gradient-to-r from-line-soft to-transparent" />
        {aside}
      </div>
      {note && <p className="mt-1 text-[11px] leading-snug text-faint">{note}</p>}
    </div>
  );
}

/** A section headed by the problem it solves, not by where the code keeps it. */
export function DecisionGroup({
  problem,
  question,
  children,
  aside,
}: {
  problem: string;
  question: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <header className="mb-1.5 flex items-baseline gap-3">
        <h2 className="font-display text-[13px] uppercase tracking-[0.18em] text-bone">
          {problem}
        </h2>
        <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
        {aside}
      </header>
      <p className="mb-2.5 text-[12px] text-faint">{question}</p>
      <div className="frame">{children}</div>
    </section>
  );
}
