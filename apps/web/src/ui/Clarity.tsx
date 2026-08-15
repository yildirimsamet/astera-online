import type { ClarityState, FleetStatus } from '@blindspace/rules';
import { staleness } from '../lib/time.js';

/**
 * THE SIGNATURE ELEMENT.
 *
 * Clarity is the whole information layer made visible. Certainty is rendered as
 * luminance, so a degraded reading is literally harder to see than a confirmed
 * one, and the player feels the fog before reading a word of it.
 *
 * There are two different kinds of nothing here and they must never be confused:
 *   UNKNOWN  — you looked and their Veil beat your Telescope. Real information.
 *   absent   — you are not watching them at all. Not information.
 * Rendering the second as the first would tell the player they know something
 * they do not, which is the one lie this UI is not allowed to tell.
 */

const SEGMENTS: Record<ClarityState, number> = {
  FULL: 5,
  CLEAR: 4,
  INTERMITTENT: 3,
  DEGRADED: 2,
  BLIND: 1,
};

const TONE: Record<ClarityState, string> = {
  FULL: 'text-clarity-full',
  CLEAR: 'text-clarity-clear',
  INTERMITTENT: 'text-clarity-int',
  DEGRADED: 'text-clarity-deg',
  BLIND: 'text-clarity-blind',
};

const FILL: Record<ClarityState, string> = {
  FULL: 'bg-clarity-full',
  CLEAR: 'bg-clarity-clear',
  INTERMITTENT: 'bg-clarity-int',
  DEGRADED: 'bg-clarity-deg',
  BLIND: 'bg-clarity-blind',
};

export const clarityTone = (state: ClarityState): string => TONE[state];

/** Signal-strength bars. Five steps, one per clarity band. */
export function ClarityBars({ state }: { state: ClarityState }) {
  const lit = SEGMENTS[state];
  return (
    <span
      className="inline-flex items-end gap-[2px]"
      role="img"
      aria-label={`Clarity ${state.toLowerCase()}`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-[1px] ${i < lit ? FILL[state] : 'bg-line'}`}
          style={{ height: `${String(4 + i * 2)}px` }}
        />
      ))}
    </span>
  );
}

export interface ReadingProps {
  status: FleetStatus;
  staleMinutes: number;
  etaMinutes: number | null;
  state: ClarityState;
}

/**
 * One telescope reading, in full.
 *
 * "FLEET AWAY · 18 min ago" is a different decision from "FLEET AWAY · live", so
 * the age is never omitted and never rounded away.
 */
export function Reading({ status, staleMinutes, etaMinutes, state }: ReadingProps) {
  const unknown = status === 'UNKNOWN';
  return (
    <span className="flex items-center gap-2">
      <ClarityBars state={state} />
      <span className={`num text-[13px] tracking-wide ${TONE[state]}`}>
        {unknown ? 'UNREADABLE' : `FLEET ${status}`}
      </span>
      {!unknown && (
        <span className="num text-[11px] text-faint">
          {staleness(staleMinutes)}
          {etaMinutes !== null && ` · back in ${String(etaMinutes)}m`}
        </span>
      )}
    </span>
  );
}

/** What a planet you have never pointed anything at looks like. */
export function Unwatched() {
  return <span className="num text-[12px] text-faint">no watch assigned</span>;
}
