import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Gain } from '../lib/gains.js';

import { haptic } from '../lib/haptics.js';
import { Rungs } from './Rungs.js';
import { duration } from '../lib/time.js';
import { ActionButton, Price, ResourceAmounts, TimeCost, type Verb } from './Action.js';
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
  mark,
  name,
  nameAside,
  nameBadge,
  level,
  maxLevel,
  tag,
  role,
  gain,
  cost,
  held,
  income,
  takes,
  blocked,
  completed,
  queued,
  queuedActionable = false,
  unowned = false,
  inactive,
  verb,
  actionLabel,
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
  /** Compact state that belongs beside the name, such as home/away hull counts. */
  nameAside?: string;
  /**
   * A MARK BESIDE THE NAME, where the row's own taxonomy is not the whole story.
   *
   * Exists for one case and should stay that way: a hull's COMBAT CLASS. The
   * shipyard bands hulls by family — where to find it — and the counter cycle runs
   * at right angles to that, so a Pike sits under "Offensive" and is beaten by a
   * "Defensive" Rampart. A node rather than a string because it is a chip with a
   * glyph in it; `nameAside` remains the slot for plain text.
   */
  nameBadge?: ReactNode;
  level?: number;
  /**
   * The top of a ladder that HAS one, so the row can read "L2 / 5". T12.
   *
   * Buildings have no ceiling and pass nothing; a research permission has a
   * ceiling of one and also passes nothing, because "L1 / 1" is a number on a card
   * that has nothing to count. Only a real ladder — two rungs or more — earns the
   * second figure.
   */
  maxLevel?: number;
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
  cost: { alloy: number; crystal: number; deuterium?: number };
  held: { alloy: number; crystal: number; deuterium?: number };
  /** Production rates, so an unaffordable row can say WHEN instead of how far. */
  income?: { alloyPerHour: number; crystalPerHour: number };
  /**
   * MINUTES THE WORK ITSELF TAKES, from `orderMinutes`. Owner report.
   *
   * *"hiç bir geliştirmede, geliştirme yapmadan önce: kaç saat, kaç dakika sürecek
   * bilgisi yok!"* — and it was true of every row in the game. The four functions
   * that answer it have been pure and exported in `@astera/rules` since the economy
   * was written and `apps/web` called none of them.
   *
   * NOT THE SAME CLOCK AS `income`'s. That one is `affordableIn` — a property of
   * the WALLET, which only ever appeared when the player was short. This is a
   * property of the ITEM and shows whether or not they can pay, because a commander
   * who can afford the thing is exactly the one for whom the wait is the only
   * remaining question.
   *
   * Optional, and absent means absent: a row with no time to quote prints none
   * rather than a zero.
   */
  takes?: number;
  blocked?: Blocked;
  /** Owned once, researched, or at the real final level. */
  completed?: string;
  /** Paid for and waiting in one of the planet's two build queues. */
  queued?: string;
  /** This level/batch is queued, but another order of the same repeatable item may follow it. */
  queuedActionable?: boolean;
  /** Available to buy, but not yet owned. Grey art without a lock. */
  unowned?: boolean;
  /** Owned permanently, but temporarily below its stored effect after Core damage. */
  inactive?: string;
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
  const shortDeuterium = Math.max(0, (cost.deuterium ?? 0) - (held.deuterium ?? 0));
  const affordable = shortAlloy === 0 && shortCrystal === 0 && shortDeuterium === 0;
  const locked = blocked !== undefined
    && completed === undefined
    && (queued === undefined || queuedActionable);
  // A requirement belongs to the NEXT action. It must never repaint something
  // the commander already owns as if it had been taken away (interface I1).
  const artLocked = locked && unowned;
  // An optimistic/server queue row appears before the success acknowledgement.
  // During that seam the NEXT purchase may already be blocked by Core/slots or a
  // full queue; showing that refusal first makes a successful tap flash as an
  // error. Acknowledge the order, then expose the next action after the flash.
  const acknowledging = queued !== undefined && (pending || flash);

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
    shortDeuterium > 0
      ? null
      : income && (income.alloyPerHour > 0 || income.crystalPerHour > 0)
      ? Math.max(
          shortAlloy > 0 ? (shortAlloy / Math.max(1, income.alloyPerHour)) * 60 : 0,
          shortCrystal > 0 ? (shortCrystal / Math.max(1, income.crystalPerHour)) * 60 : 0,
        )
      : null;

  return (
    <div
      data-progression-state={
        completed
          ? 'complete'
          : queued
            ? 'queued'
            : locked
              ? 'locked'
              : unowned
                ? 'available-unowned'
                : 'owned'
      }
      /*
        `group` here is Tailwind's MARKER for `group-hover:`, and for a long time
        it was also a real card style: `chrome.css` gave `.group` a 10px radius, a
        radial ground and a 1px inset ring, so every purchasable row in the game
        silently drew a card background and a second ring inside the plate that
        already had one. The legacy rule is deleted; the marker is what it says.
      */
      className={`group relative overflow-hidden border-b border-line-soft px-3 py-3 last:border-b-0 ${
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
          data-open-item
          className="absolute inset-0 z-0 rounded-chip outline-none transition-colors duration-200 hover:bg-bone/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-crystal/70"
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
      <div className="pointer-events-none relative z-10 flex items-center gap-2">
        {/*
          THE ART IS THE SUBJECT, AT THE SIZE IT WAS DRAWN FOR.

          `visual-design.md`: the renders are the most expensive thing this
          project owns, they belong at 96–140px inside a lit socket, and "a render
          used at 40px in a text row is a wasted asset and reads as a favicon".
          This row — the most-seen surface in the game — showed them at 48px in a
          flat radial wash. A socket at 74px is a recess with its own pool of
          light, so the object sits IN the plate rather than on top of it.
        */}
        <div data-art className="socket relative size-[74px] shrink-0 rounded-control">
          {art ? (
            <img
              src={art}
              alt=""
              aria-hidden
              className={`socket-art size-[86%] object-contain transition-[filter,opacity,transform] duration-300 group-hover:scale-[1.04] ${
                artLocked ? 'opacity-20' : unowned ? 'opacity-65' : ''
              }`}
              loading="lazy"
            />
          ) : (
            <span className={artLocked ? 'opacity-20' : unowned ? 'opacity-65' : ''}>
              {mark}
            </span>
          )}
          {artLocked && (
            <span className="absolute inset-0 flex items-center justify-center">
              <LockMark />
            </span>
          )}
        </div>

        {/*
          THE NAME GETS THE COLUMN; THE PRICE SHARES A LINE WITH THE GAIN.

          The price used to sit in its own right-hand block beside the name, and
          between them the socket, the chevron and two gaps left the name about a
          hundred pixels — "ISOTOPE SPECT…", which names nothing. This component's
          own docblock records that exact failure and the reason it matters: this
          row exists to sell the thing, and a truncated label is worse than a small
          one because the player cannot tell WHAT they are being sold.

          Everything on the price's old line had a fixed width, so the name was
          always going to be what gave. Moving the price down onto the state line —
          where it is read in the same glance as "what does this become" — costs no
          height at all and hands the name the whole column back.
        */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 self-stretch py-1">
          {/*
            LINE ONE IS THE NAME'S, AND NOTHING ELSE MAY SPEND IT. D109 · owner report.

            At 375px this column has about 241px, which is roughly twenty-four
            characters. The class chip and the home/away counts were both put on
            this line and between them left "E...", "P..." and "K..." where a ship's
            name should have been — the exact failure this component's docblock was
            written about, committed twice.

            Only the LEVEL shares it, because a ladder is a fixed 40-odd pixels that
            cannot grow with a longer word, and because "which rung am I on" is part
            of naming the thing rather than a fact about it.
          */}
          <div data-row-line="name" className="flex min-w-0 items-baseline gap-2">
            <h3 className="name min-w-0 flex-1 truncate">{name}</h3>
            {/*
              A LADDER IS DRAWN; A LEVEL IS WRITTEN.

              `L2 / 5` is a fraction the player has to read and then convert into
              the thing they wanted, which is how much is left. Five marks with two
              lit is that fact arriving without being read. A building has no
              ceiling and so has no ladder to draw — it keeps its numeral.
            */}
            {maxLevel !== undefined && maxLevel > 1 ? (
              <span className={flash ? 'pop inline-block' : ''}>
                <Rungs level={level ?? 0} max={maxLevel} next={!completed} />
              </span>
            ) : level !== undefined && level > 0 ? (
              <span className={`num shrink-0 text-label text-faint ${flash ? 'pop inline-block' : ''}`}>
                L{level}
              </span>
            ) : null}
          </div>
          {/*
            LINE TWO CARRIES EVERYTHING THAT USED TO CROWD LINE ONE.

            The class chip is here rather than beside the name because it is a fact
            ABOUT the ship, not part of its identity — and because it is 60-odd
            pixels the name cannot afford. The counts follow it, and the tag takes
            whatever is left and truncates, which is the right thing to lose: it is
            flavour, and the chip beside it is the rule.
          */}
          {nameBadge === undefined && nameAside === undefined && !tag ? null : (
              <div data-row-line="support" className="flex min-w-0 items-center gap-1.5">
                {nameBadge}
                {nameAside ? (
                  <span className="num shrink-0 whitespace-nowrap text-micro text-faint">
                    {nameAside}
                  </span>
                ) : null}
                {tag ? (
                  <p className="min-w-0 truncate text-caption leading-snug text-dim">{tag}</p>
                ) : null}
              </div>
            )}

          <div className="min-w-0 items-baseline gap-2">
            <div className="min-w-0 flex-1">
            {inactive ? (
              <p className="truncate text-caption text-alloy">{inactive}</p>
            ) : blocked && !acknowledging ? (
              /* A REQUIREMENT IS A DOOR, NOT AN ALARM (I1). Amber is the game's
                 word for a gap you can close; red is something happening to you.

                 AND A DOOR YOU CAN WALK THROUGH. Owner instruction: a locked row
                 must say why AND take you to the thing that would open it. The
                 `onFix` has existed since I1, but on a row that opens a detail
                 sheet — which is nearly all of them — `UpgradeRow` draws a chevron
                 where the inline action would be, so the only way to reach the fix
                 was to open the sheet and find the lock inside it. Two taps and a
                 discovery, for the one thing a stuck player needs most.

                 So the SENTENCE is the button. It sits above the row's own press
                 (`z-[1]`, `pointer-events-auto`) and stops the event, because the
                 row underneath opens the sheet and this is the one place on it that
                 means something else. The arrow is what makes it read as pressable
                 without a word being spent on saying so. */
              blocked.onFix ? (
                <button
                  type="button"
                  data-blocked-reason
                  data-has-fix
                  onClick={(event) => {
                    event.stopPropagation();
                    haptic('tap');
                    blocked.onFix?.();
                  }}
                  className="pointer-events-auto relative z-[1] -mx-1 flex max-w-full items-center gap-1 rounded-chip px-1 text-caption text-alloy transition-colors hover:bg-alloy/10 active:scale-[0.98]"
                >
                  <span className="truncate">{blocked.reason}</span>
                  <span aria-hidden className="shrink-0">→</span>
                </button>
              ) : (
                <p data-blocked-reason className="truncate text-caption text-alloy">
                  {blocked.reason}
                </p>
              )
            ) : queued ? (
              <p role="status" className="truncate text-caption text-crystal">{queued}</p>
            ) : completed ? (
              <p role="status" className="truncate text-caption text-faint">{completed}</p>
            ) : gain ? (
              <p className="num truncate text-caption">
                <span className="text-faint">{gain.label} </span>
                {gain.resourcePair
                  ? <ResourceAmounts resources={gain.resourcePair.now} label={gain.now} />
                  : <span className="text-dim">{gain.now}</span>}
                <span className="mx-1 text-faint" aria-label={t('upgradeRow.becomes')}>→</span>
                {gain.resourcePair
                  ? <ResourceAmounts resources={gain.resourcePair.next} label={gain.next} />
                  : <span className="text-bone">{gain.next}</span>}
                {/*
                  AND WHERE THE LADDER ENDS, on the rows that have one. Owner
                  report: *"Ne kadar arttırıyor anlaşılamıyor."* A rung of Ship
                  Power is +2.3%, which a commander reads as nothing; +2.3% of an
                  eventual +11.8% is a decision about whether to start climbing.
                  Dropped once the ladder is finished, where the ceiling is the
                  figure already standing to the left of it.
                */}
                {gain.ceiling !== undefined && gain.maxed !== true && (
                  <span data-gain-ceiling className="ml-1.5 text-faint">
                    {t('upgradeRow.ceiling', { value: gain.ceiling })}
                  </span>
                )}
              </p>
            ) : (
              <p className="truncate text-caption text-faint">{role}</p>
            )}
            </div>
            {!completed && (!queued || queuedActionable) && (
              /*
                TWO CURRENCIES, ONE COLUMN. Time sits under the price because in
                this game it IS a price: a hull that lands after the season's last
                raid cost more than its alloy, and a commander budgeting an evening
                needs both figures in the same glance.

                It is deliberately quieter than the resources — the wait is a fact
                to plan around rather than a refusal, and `affordableIn` below still
                owns the louder amber when the player cannot pay at all.
              */
              <div className="flex shrink-0 items-center gap-0.5 mt-1">
                <Price cost={cost} held={held} layout="row" />
                {takes === undefined ? null : (<div className="flex items-center ml-1"><TimeCost minutes={takes} /></div>)}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-right">
          {onOpen ? (
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="size-4 shrink-0 text-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-crystal"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M7 4.5 12.5 10 7 15.5" />
            </svg>
          ) : (
            <span data-act className="pointer-events-auto shrink-0">
              <ActionButton
                verb={verb}
                cost={cost}
                held={held}
                {...(blocked && !acknowledging ? { blocked } : {})}
                {...(completed || acknowledging || (queued && !queuedActionable)
                  ? { completed: completed ?? queued }
                  : {})}
                onAct={onAct}
                pending={pending}
                {...(actionLabel ? { label: actionLabel } : {})}
              />
            </span>
          )}
        </div>
      </div>

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
      {!affordable && !blocked && (!queued || queuedActionable) && waitMinutes !== null && (
        <p className="pointer-events-none relative z-10 mt-2 text-label text-faint">
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
export function Band({
  label,
  note,
  aside,
  count,
  open,
  onToggle,
}: {
  label: string;
  note?: string;
  aside?: ReactNode;
  /**
   * HOW MANY ROWS ARE UNDER THIS HEADING. Shown whenever the band can fold.
   *
   * A shut band must say what it is holding back, or it is just a word the player
   * has to open to find out about — which costs the tap the fold was meant to save.
   */
  count?: number;
  /** Whether the rows below are showing. Undefined leaves the band a plain heading. */
  open?: boolean;
  /**
   * MAKES THE BAND AN ACCORDION. Owner instruction.
   *
   * Nineteen hull rows at ~98px is nearly two thousand pixels — about four screens
   * of a 375-wide phone before a commander has seen the catalogue once, and the
   * same list is what an attack sheet asks them to choose a wing from under a
   * clock. Folding costs nothing that the row height would not cost far more of:
   * the art stays at the 74px `visual-design.md` requires, and the bands the player
   * is not shopping in stay out of the way with their counts on them.
   *
   * Absent leaves `Band` exactly as it was — a heading — because several surfaces
   * use it over a group of two or three where a fold would be pure ceremony.
   */
  onToggle?: () => void;
}) {
  const body = (
    <>
      <div className="flex min-w-0 items-baseline gap-2">
        <h3 className="legend text-crystal/85">{label}</h3>
        <span className="rail-soft flex-1" />
        {count === undefined ? null : (
          <span className="num shrink-0 text-micro text-faint">{count}</span>
        )}
        {aside}
        {onToggle === undefined ? null : (
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className={`size-3.5 shrink-0 text-faint transition-transform duration-200 ${
              open === true ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M7 4.5 12.5 10 7 15.5" />
          </svg>
        )}
      </div>
      {note && <p className="text-caption leading-snug text-faint">{note}</p>}
    </>
  );

  const shell = 'flex w-full flex-col gap-1 border-b border-line-soft bg-void/30 px-3 py-2 text-left';

  if (onToggle === undefined) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      aria-expanded={open === true}
      onClick={() => {
        haptic('tap');
        onToggle();
      }}
      className={`${shell} transition-colors hover:bg-bone/[0.03] active:bg-raised/60`}
    >
      {body}
    </button>
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
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <header className="flex items-baseline gap-2">
          <h2 className="headline shrink-0">{problem}</h2>
          <span className="rail-soft flex-1" />
          {aside}
        </header>
        <p className="text-caption text-faint">{question}</p>
      </div>
      <div className="plate plate-inset overflow-hidden">{children}</div>
    </section>
  );
}
