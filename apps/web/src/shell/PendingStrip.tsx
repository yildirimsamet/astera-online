import { usePending } from '../api/queries.js';
import type { PendingThread } from '../api/schemas.js';
import { countdown, useNow } from '../lib/time.js';

/**
 * DESIGN LAW #1, made visible.
 *
 * "Every session must end with something in flight." A player can only act on
 * that if they can see it, so this strip is always on screen, above the tabs,
 * counting down. When it is empty it says so plainly — an empty strip is the
 * game telling you there is no reason to come back yet, which is a prompt, not a
 * decoration.
 */
export function PendingStrip() {
  const { data, dataUpdatedAt } = usePending();
  const now = useNow(1000);
  const threads = data?.pending ?? [];

  const incoming = threads.find((t) => t.kind === 'incoming');
  const soonest = [...threads].sort((a, b) => a.minutesRemaining - b.minutesRemaining)[0];
  const shown = incoming ?? soonest;

  return (
    <div
      className={`border-t px-4 py-2 ${
        incoming ? 'border-alert/40 bg-alert/10' : 'border-line-soft bg-deep/80'
      }`}
    >
      {shown ? (
        <div className="flex items-center gap-3">
          <span className={`legend ${incoming ? 'text-[#e08a7c]' : ''}`}>{title(shown)}</span>
          <span className="h-px flex-1 bg-line-soft" />
          <span className={`num text-[13px] ${incoming ? 'text-[#ffb9ae]' : 'text-bone'}`}>
            {countdown(arrivalOf(shown, dataUpdatedAt) - now)}
          </span>
          {threads.length > 1 && (
            <span className="num text-[11px] text-faint">+{String(threads.length - 1)}</span>
          )}
        </div>
      ) : (
        <p className="legend text-faint">Nothing in flight</p>
      )}
    </div>
  );
}

const title = (thread: PendingThread): string => {
  if (thread.kind === 'incoming') return 'Inbound fleet';
  if (thread.kind === 'probe') return `Probe → ${thread.targetName}`;
  return thread.leg === 'return'
    ? `Fleet returning from ${thread.targetName}`
    : `Fleet → ${thread.targetName}`;
};

/**
 * The server sends whole minutes remaining, as of the moment it answered — so the
 * arrival instant is fixed against THAT timestamp, not against now. Anchoring to
 * now would make the countdown stand still: both sides would advance together.
 */
export const arrivalOf = (thread: PendingThread, answeredAt: number): number =>
  answeredAt + thread.minutesRemaining * 60_000;
