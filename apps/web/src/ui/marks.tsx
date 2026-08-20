/**
 * Marks for the things that have no art.
 *
 * This file used to hold six. Four of them — the Shipyard, the Veil, the Bastion
 * and the Thorn — were placeholders waiting on renders that have now arrived, and
 * a drawn line stood where finished art of the exact thing was about to sit. They
 * are gone: `ui/assets.ts` owns those four, tiered.
 *
 * What is left is the Core and the Vault, which are the floor of an art well that
 * can never be reached now that every building has a render, and the lock, which
 * is not a placeholder at all — it marks a STATE, and there is no photograph of
 * "you cannot have this yet".
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
