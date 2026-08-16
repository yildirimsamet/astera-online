/**
 * Marks for the things that have no art yet.
 *
 * Deliberately drawn rather than borrowed: giving the Bastion a ship render would
 * state the one thing about it that is false — that it can leave. Each of these is
 * on the asset request list; until then they are honest, quiet, and consistent.
 */

const wrap = 'size-10 text-dim';

export function CoreMark() {
  return (
    <svg viewBox="0 0 24 24" className={wrap} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M4 7h16" strokeLinecap="round" className="text-bone" />
      <path d="M12 10.5 16.5 13v5L12 20.5 7.5 18v-5Z" strokeLinejoin="round" />
      <path d="M12 10.5V20.5M16.5 13 7.5 18M7.5 13l9 5" strokeOpacity=".35" />
    </svg>
  );
}

export function VaultMark() {
  return (
    <svg viewBox="0 0 24 24" className={wrap} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 6.5v2M12 15.5v2M6.5 12h2M15.5 12h2" strokeLinecap="round" />
    </svg>
  );
}

export function ShipyardMark() {
  return (
    <svg viewBox="0 0 24 24" className={wrap} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M4 5v14M20 5v14" strokeLinecap="round" />
      <path d="M4 9h16M4 15h16" strokeOpacity=".4" />
      <path d="M8 12.5 12 8l4 4.5-4 3.5Z" strokeLinejoin="round" className="text-crystal" />
    </svg>
  );
}

/** Unused since the Ring got real art. Kept: the Drill mark may need the same shape. */
export function RingMark() {
  return (
    <svg viewBox="0 0 24 24" className={wrap} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="12" cy="12" r="4.5" />
      <ellipse cx="12" cy="12" rx="9.5" ry="3.6" transform="rotate(-18 12 12)" />
      <circle cx="20" cy="9.6" r="1.1" fill="currentColor" className="text-crystal" />
      <circle cx="4" cy="14.4" r="1.1" fill="currentColor" className="text-crystal" />
    </svg>
  );
}

/** A gun on a base plate. The plate is the point: it never lifts off. */
export function BastionMark() {
  return (
    <svg viewBox="0 0 24 24" className={wrap} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M2.5 20h19" strokeLinecap="round" className="text-bone" />
      <path d="M5.5 20v-2.5h13V20" strokeLinejoin="round" />
      <path d="M9 17.5v-3.5h6v3.5" strokeLinejoin="round" />
      <path d="M12 14V9M12 9l3-3" strokeLinecap="round" className="text-crystal" />
    </svg>
  );
}

/**
 * The lock.
 *
 * Small and quiet on purpose: it marks a state, it does not scold. Drawn open at
 * the shackle so it reads as "not yet" rather than "never".
 */
export function LockMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-faint" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.4-2" strokeLinecap="round" />
    </svg>
  );
}
