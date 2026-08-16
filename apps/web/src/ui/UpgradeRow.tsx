import type { ReactNode } from 'react';
import type { Gain } from '../lib/gains.js';
import { compact } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { RESOURCE_ART } from './assets.js';
import { LockMark } from './marks.js';
import { ProgressToNext } from './Meter.js';

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
 * PROGRESS IS SHOWN, NOT STATED. When a row is unaffordable it carries a bar
 * toward the price, because "62% of the way to a Bulwark" is a reason to come back
 * and "Need 940" is a refusal.
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
  role,
  gain,
  cost,
  held,
  blocked,
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
  level?: number;
  role: string;
  gain?: Gain;
  cost: { alloy: number; crystal: number };
  held: { alloy: number; crystal: number };
  blocked?: Blocked;
  actionLabel: string;
  onAct: () => void;
  /** Opens the full picture. The row is the summary; the sheet is the decision. */
  onOpen?: () => void;
  pending?: boolean;
  highlighted?: boolean;
  /** Set briefly after a successful purchase. */
  flash?: boolean;
}) {
  const shortAlloy = Math.max(0, cost.alloy - held.alloy);
  const shortCrystal = Math.max(0, cost.crystal - held.crystal);
  const affordable = shortAlloy === 0 && shortCrystal === 0;
  const total = cost.alloy + cost.crystal;
  const have = Math.min(held.alloy, cost.alloy) + Math.min(held.crystal, cost.crystal);

  const locked = blocked !== undefined;

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
          aria-label={`About ${name}`}
          className="absolute inset-0 z-0"
          onClick={() => {
            haptic('tap');
            onOpen();
          }}
        />
      )}

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
                alt={`${name} at the next tier`}
                className="size-11 object-contain drop-shadow-[0_0_8px_rgba(111,211,224,0.35)]"
                loading="lazy"
              />
            </div>
          </>
        )}

        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h3 className="truncate font-display text-[15px] uppercase tracking-wide text-bone">
            {name}
          </h3>
          {level !== undefined && level > 0 && (
            <span className={`num text-[12px] text-faint ${flash ? 'pop inline-block' : ''}`}>
              L{level}
            </span>
          )}
        </div>

        {blocked ? (
          <button
            type="button"
            onClick={() => {
              haptic('tap');
              blocked.onFix?.();
            }}
            disabled={!blocked.onFix}
            className="chip chip-locked pointer-events-auto shrink-0"
          >
            {blocked.reason}
          </button>
        ) : (
          <button
            type="button"
            className="btn pointer-events-auto shrink-0 px-3 text-[11px] active:scale-95"
            disabled={!affordable || pending}
            onClick={() => {
              haptic('commit');
              onAct();
            }}
          >
            {actionLabel}
          </button>
        )}
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
            <span className="mx-1 text-faint" aria-label="becomes">
              →
            </span>
            <span className="text-bone">{gain.next}</span>
          </p>
        )}
        <Price cost={cost} />
      </div>
      {gain?.unlocks && (
        <p className="pointer-events-none relative z-10 mt-1 text-[11px] text-crystal/80">
          {gain.unlocks}
        </p>
      )}

      <p className="pointer-events-none relative z-10 mt-1.5 text-[12px] leading-snug text-faint">
        {role}
      </p>

      {!affordable && !blocked && (
        <div className="pointer-events-none relative z-10 mt-2.5">
          <ProgressToNext have={have} need={total} label={`Saving for ${name.toLowerCase()}`} />
        </div>
      )}
    </div>
  );
}

function Price({ cost }: { cost: { alloy: number; crystal: number } }) {
  return (
    <span className="num flex items-center gap-2.5 text-[12px]">
      <span className="flex items-center gap-1 text-alloy">
        <img src={RESOURCE_ART.alloy} alt="alloy" className="size-4 object-contain" />
        {compact(cost.alloy)}
      </span>
      {cost.crystal > 0 && (
        <span className="flex items-center gap-1 text-crystal">
          <img src={RESOURCE_ART.crystal} alt="crystal" className="size-4 object-contain" />
          {compact(cost.crystal)}
        </span>
      )}
    </span>
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
