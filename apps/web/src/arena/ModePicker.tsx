import type { ArenaCopy } from './copy.js';

export type FlightMode = 'online' | 'solo';

/**
 * Practice or the real thing (F8): each mode says what it is worth. Below the Core a ship needs,
 * the live room is shut where it is chosen, with the Core it waits for (F3); practice stays open.
 */
export function ModePicker({ c, mode, onPick, lock }: {
  c: ArenaCopy; mode: FlightMode; onPick: (mode: FlightMode) => void; lock: { core: number; need: number } | null;
}) {
  return <div className="gk-tabs gk-choices gk-flightmode" role="radiogroup" aria-label={c.modeTitle}>
    {(['online', 'solo'] as const).map(value => {
      const shut = value === 'online' && lock !== null;
      return <button key={value} type="button" role="radio" aria-checked={mode === value} disabled={shut}
        className="gk-tab gk-flightmode__opt" onClick={() => { onPick(value); }}>
        <b>{value === 'solo' ? c.solo : c.shared}</b>
        <small>{shut ? c.coreShort(lock.core, lock.need) : value === 'solo' ? c.soloNote : c.sharedNote}</small>
      </button>;
    })}
  </div>;
}
