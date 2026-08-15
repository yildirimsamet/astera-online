import type { ReturnEntry, ReturnPayload } from '../api/schemas.js';
import { duration } from '../lib/time.js';

/**
 * "While you were gone."
 *
 * The single most important screen in the game: it must answer *what happened?*
 * before the player thinks to ask. Three kinds of line — what I did, what
 * accrued, what is new — capped at five, never a wall of logs.
 *
 * And it must not close the loop. It re-opens it: the last thing on it is what is
 * still in flight, or, if nothing is, the fact that nothing is.
 */
export function ReturnOverlay({
  arrival,
  playerName,
  onDismiss,
}: {
  arrival: ReturnPayload;
  playerName: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-void/97 px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(56px+env(safe-area-inset-top))] backdrop-blur-sm">
      <header className="animate-[line-in_260ms_ease-out]">
        <p className="legend">While you were gone</p>
        <h1 className="num mt-1 text-[38px] leading-none text-bone">
          {duration(arrival.awayMinutes)}
        </h1>
        <p className="mt-2 text-[13px] text-faint">{playerName}</p>
      </header>

      <div className="mt-9 flex-1 overflow-y-auto">
        {arrival.entries.length === 0 ? (
          <p className="text-[14px] leading-relaxed text-dim">
            Nothing happened. The galaxy did not notice you were away — which is its own kind of
            information.
          </p>
        ) : (
          <ul>
            {arrival.entries.map((entry, i) => (
              <li
                key={`${entry.kind}-${String(entry.at.getTime())}-${String(i)}`}
                className="animate-[line-in_320ms_ease-out_both] border-b border-line-soft py-4 first:pt-0"
                // Lines arrive in sequence, like a log printing — the one place in
                // this interface where a few hundred milliseconds of theatre earns
                // its keep.
                style={{ animationDelay: `${String(90 + i * 70)}ms` }}
              >
                <div className="flex items-baseline gap-3">
                  <span className={`num text-[15px] ${tone(entry)}`}>{entry.title}</span>
                </div>
                <p className="mt-1 text-[13px] text-dim">{entry.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="pt-6">
        {arrival.pending.length > 0 ? (
          <div className="mb-5">
            <p className="legend mb-2">Still in flight</p>
            {arrival.pending.map((thread, i) => (
              <div
                key={`${thread.kind}-${thread.targetName}-${String(i)}`}
                className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2 last:border-b-0"
              >
                <span className="text-[13px] text-bone">
                  {thread.kind === 'incoming'
                    ? 'Inbound fleet'
                    : thread.kind === 'probe'
                      ? `Probe → ${thread.targetName}`
                      : thread.leg === 'return'
                        ? `Fleet returning from ${thread.targetName}`
                        : `Fleet → ${thread.targetName}`}
                </span>
                <span className="num text-[12px] text-faint">
                  {duration(thread.minutesRemaining)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-5 text-[13px] leading-relaxed text-faint">
            Nothing is in flight. Nothing is going to happen to you until you make it happen.
          </p>
        )}

        <button type="button" className="btn w-full" onClick={onDismiss}>
          Continue
        </button>
      </footer>
    </div>
  );
}

/** Only two things get colour here: what you gained, and what it cost you. */
function tone(entry: ReturnEntry): string {
  switch (entry.kind) {
    case 'raided':
    case 'scan_detected':
      return 'text-alert';
    case 'accrued':
      return 'text-alloy';
    case 'unlock':
      return 'text-crystal';
    default:
      return 'text-bone';
  }
}
