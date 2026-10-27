import type { ArenaCopy } from './copy.js';

export type FlightMode = 'online' | 'solo';

/**
 * Practice or the real thing (F8): each mode says what it is worth. Below the Core a ship needs,
 * the live room is shut where it is chosen, with the Core it waits for (F3); practice stays open.
 */
export function ModePicker({ c, mode, onPick, lock }: {
  c: ArenaCopy; mode: FlightMode; onPick: (mode: FlightMode) => void; lock: { core: number; need: number } | null;
}) {
  return <div className="ap-mode is-noted" role="radiogroup">
    {(['online', 'solo'] as const).map(value => {
      const shut = value === 'online' && lock !== null;
      return <button key={value} type="button" role="radio" aria-checked={mode === value} disabled={shut}
        className={mode === value ? 'is-selected' : ''} onClick={() => { onPick(value); }}>
        <b>{value === 'solo' ? c.solo : c.shared}</b>
        <small>{shut ? c.coreShort(lock.core, lock.need) : value === 'solo' ? c.soloNote : c.sharedNote}</small>
      </button>;
    })}
  </div>;
}
