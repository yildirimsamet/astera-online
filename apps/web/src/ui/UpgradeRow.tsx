import type { ReactNode } from 'react';
import type { Gain } from '../lib/gains.js';
import { compact } from '../lib/format.js';
import { RESOURCE_ART } from './assets.js';

/**
 * One decision, presented as a decision.
 *
 * The rule this component exists to enforce: **nothing here is ever greyed out.**
 * An upgrade you cannot afford yet is the reason to go and earn; an upgrade you
 * have not unlocked is the reason to build the thing that unlocks it. Fading both
 * to 45% opacity — which is what the first version did — deletes exactly the
 * ambition the game runs on and leaves a screen of dead rows.
 *
 * Layout note, learned from a screenshot: on a 390 px screen the action cannot
 * share a line with the copy. The button sits on the title line, and the text gets
 * the full width, or every row wraps into four lines of soup.
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
  level,
  role,
  gain,
  cost,
  held,
  blocked,
  actionLabel,
  onAct,
  pending = false,
  highlighted = false,
}: {
  art?: string | null;
  /** Drawn when there is no art for this thing yet. */
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
  pending?: boolean;
  highlighted?: boolean;
}) {
  const shortAlloy = Math.max(0, cost.alloy - held.alloy);
  const shortCrystal = Math.max(0, cost.crystal - held.crystal);
  const affordable = shortAlloy === 0 && shortCrystal === 0;

  return (
    <div
      className={`border-b border-line-soft p-3 last:border-b-0 ${
        highlighted ? 'bg-crystal/10 ring-1 ring-inset ring-crystal/40' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="art-well flex size-11 shrink-0 items-center justify-center rounded">
          {art ? (
            <img src={art} alt="" aria-hidden className="size-10 object-contain" loading="lazy" />
          ) : (
            mark
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h3 className="truncate font-display text-[15px] uppercase tracking-wide text-bone">
            {name}
          </h3>
          {level !== undefined && level > 0 && (
            <span className="num text-[12px] text-faint">L{level}</span>
          )}
        </div>

        {blocked ? (
          <button
            type="button"
            onClick={blocked.onFix}
            disabled={!blocked.onFix}
            className="chip chip-locked shrink-0"
          >
            {blocked.reason}
          </button>
        ) : (
          <button
            type="button"
            className="btn shrink-0 px-3 text-[11px]"
            disabled={!affordable || pending}
            onClick={onAct}
          >
            {affordable ? actionLabel : `Need ${compact(shortAlloy > 0 ? shortAlloy : shortCrystal)}`}
          </button>
        )}
      </div>

      <p className="mt-2 text-[12px] leading-snug text-dim">{role}</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {/* The whole argument for pressing the button, in one line of numbers. */}
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
      {gain?.unlocks && <p className="mt-1 text-[11px] text-crystal/80">{gain.unlocks}</p>}
    </div>
  );
}

function Price({ cost }: { cost: { alloy: number; crystal: number } }) {
  return (
    <span className="num flex items-center gap-2.5 text-[12px]">
      <span className="flex items-center gap-1 text-alloy">
        <img src={RESOURCE_ART.alloy} alt="alloy" className="size-3.5 object-contain" />
        {compact(cost.alloy)}
      </span>
      {cost.crystal > 0 && (
        <span className="flex items-center gap-1 text-crystal">
          <img src={RESOURCE_ART.crystal} alt="crystal" className="size-3.5 object-contain" />
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
      <div className="group">{children}</div>
    </section>
  );
}
